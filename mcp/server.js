import { getAgentByName, getCurrentAgent } from 'agents';
import { McpAgent } from 'agents/mcp';
import { JSONRPCMessageSchema } from '@modelcontextprotocol/sdk/types.js';

import * as store from './catalog.js';
import { enforceRateLimit } from './rate-limit.js';
import { createCatalogMcpServer, ONLINE_SERVER_INFO } from './server-core.js';

const MCP_OBJECT_BINDING = 'LOUNGE_GURU_MCP';
const STREAMABLE_MCP_PATH = '/mcp';
const LEGACY_SSE_PATH = '/sse';
const LEGACY_MESSAGES_PATH = '/messages';
const LEGACY_SSE_METHOD_HEADER = 'cf-mcp-method';
const MAX_LEGACY_MESSAGE_SIZE_BYTES = 4 * 1024 * 1024;
const MCP_CORS_OPTIONS = {
  origin: '*',
  methods: 'GET, POST, DELETE, OPTIONS',
  headers: 'Content-Type, Accept, Authorization, mcp-session-id, mcp-protocol-version',
  exposeHeaders: 'mcp-session-id',
  maxAge: 86400,
};

function firstHeaderValue(value) {
  if (!value) {
    return 'unknown';
  }

  return value.split(',')[0]?.trim() || 'unknown';
}

async function sha256Hex(value) {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function logEvent(request, event, details = {}) {
  const ip = firstHeaderValue(request?.headers.get('cf-connecting-ip'));
  const userAgent = request?.headers.get('user-agent')?.slice(0, 160) || 'unknown';
  const query = typeof details.query === 'string' ? details.query : null;
  const safeDetails = {
    ...details,
    query: undefined,
    queryHash: query ? await sha256Hex(query) : undefined,
    queryLength: query?.length ?? 0,
  };

  console.log(
    JSON.stringify({
      service: 'lounge-guru-mcp',
      event,
      timestamp: new Date().toISOString(),
      method: request?.method ?? 'unknown',
      path: request ? new URL(request.url).pathname : 'unknown',
      ipHash: await sha256Hex(ip),
      userAgentHash: await sha256Hex(userAgent),
      country: request?.headers.get('cf-ipcountry') || 'unknown',
      ...safeDetails,
    }),
  );
}

function corsHeaders() {
  return {
    'access-control-allow-headers': MCP_CORS_OPTIONS.headers,
    'access-control-allow-methods': MCP_CORS_OPTIONS.methods,
    'access-control-allow-origin': MCP_CORS_OPTIONS.origin,
    'access-control-expose-headers': MCP_CORS_OPTIONS.exposeHeaders,
    'access-control-max-age': String(MCP_CORS_OPTIONS.maxAge),
  };
}

function appendHeaders(response, headers) {
  const next = new Response(response.body, response);
  for (const [name, value] of Object.entries(headers)) {
    if (value) {
      next.headers.set(name, value);
    }
  }
  return next;
}

function jsonRpcError(status, message, code = -32000, headers = {}) {
  return new Response(
    JSON.stringify({
      jsonrpc: '2.0',
      error: {
        code,
        message,
      },
      id: null,
    }),
    {
      status,
      headers: {
        'content-type': 'application/json',
        ...corsHeaders(),
        ...headers,
      },
    },
  );
}

function requireMcpNamespace(env) {
  const namespace = env?.[MCP_OBJECT_BINDING];
  if (
    !namespace ||
    typeof namespace !== 'object' ||
    typeof namespace.newUniqueId !== 'function' ||
    typeof namespace.idFromName !== 'function'
  ) {
    throw new Error(`Missing Durable Object binding "${MCP_OBJECT_BINDING}".`);
  }

  return namespace;
}

async function handleRateLimited(request, env, handler) {
  const limitResult = await enforceRateLimit(env, request);
  if (!limitResult.ok) {
    await logEvent(request, 'rate_limited', {
      status: limitResult.status ?? 429,
    });
    return jsonRpcError(limitResult.status ?? 429, 'rate_limited', -32029, limitResult.headers);
  }

  const response = await handler();
  return appendHeaders(response, limitResult.headers);
}

function createLegacyEndpointEvent(messagesUrl) {
  return `event: endpoint\ndata: ${messagesUrl}\n\n`;
}

function openSseStream() {
  const stream = new TransformStream();
  return {
    readable: stream.readable,
    writer: stream.writable.getWriter(),
  };
}

function createWebSocketBridge(request, additionalHeaders = {}) {
  const existingHeaders = {};
  request.headers.forEach((value, key) => {
    existingHeaders[key] = value;
  });

  return new Request(request.url, {
    headers: {
      ...existingHeaders,
      ...additionalHeaders,
      Upgrade: 'websocket',
    },
  });
}

async function handleLegacySseConnect(request, env, ctx) {
  const namespace = requireMcpNamespace(env);
  const sessionUrl = new URL(request.url);
  const sessionId = sessionUrl.searchParams.get('sessionId') || namespace.newUniqueId().toString();
  const agent = await getAgentByName(namespace, `sse:${sessionId}`, {
    props: ctx.props,
  });
  const { readable, writer } = openSseStream();
  const encoder = new TextEncoder();
  const messagesUrl = new URL(request.url);
  messagesUrl.pathname = LEGACY_MESSAGES_PATH;
  messagesUrl.search = '';
  messagesUrl.searchParams.set('sessionId', sessionId);

  writer.write(encoder.encode(createLegacyEndpointEvent(messagesUrl.pathname + messagesUrl.search))).catch(
    (error) => {
      console.error('Error writing legacy SSE endpoint event:', error);
    },
  );

  const bridgeResponse = await agent.fetch(
    createWebSocketBridge(request, {
      [LEGACY_SSE_METHOD_HEADER]: 'SSE',
    }),
  );
  const ws = bridgeResponse.webSocket;
  if (!ws) {
    await writer.close();
    return new Response('Failed to establish WebSocket connection', {
      status: 500,
      headers: corsHeaders(),
    });
  }

  ws.accept();
  ws.addEventListener('message', (event) => {
    async function forward() {
      const payload =
        typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data);
      const result = JSONRPCMessageSchema.safeParse(JSON.parse(payload));
      if (!result.success) {
        return;
      }
      await writer.write(
        encoder.encode(`event: message\ndata: ${JSON.stringify(result.data)}\n\n`),
      );
    }

    forward().catch((error) => {
      console.error('Error forwarding message to SSE:', error);
    });
  });
  ws.addEventListener('error', () => {
    writer.close().catch(() => {});
  });
  ws.addEventListener('close', () => {
    writer.close().catch(() => {});
  });

  return new Response(readable, {
    status: 200,
    headers: {
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'content-type': 'text/event-stream',
      ...corsHeaders(),
    },
  });
}

async function handleLegacyMessages(request, env, ctx) {
  const namespace = requireMcpNamespace(env);
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('sessionId');
  if (!sessionId) {
    return new Response('Missing sessionId. Expected POST to /messages?sessionId=<id>.', {
      status: 400,
      headers: corsHeaders(),
    });
  }

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return new Response(`Unsupported content-type: ${contentType}`, {
      status: 400,
      headers: corsHeaders(),
    });
  }

  const contentLength = Number.parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_LEGACY_MESSAGE_SIZE_BYTES) {
    return new Response(`Request body too large: ${contentLength} bytes`, {
      status: 400,
      headers: corsHeaders(),
    });
  }

  const agent = await getAgentByName(namespace, `sse:${sessionId}`, {
    props: ctx.props,
  });
  const messageBody = await request.json();
  const error = await agent.onSSEMcpMessage(sessionId, messageBody, {
    requestInfo: {
      headers: Object.fromEntries(request.headers.entries()),
    },
  });

  if (error) {
    return new Response(error.message, {
      status: 400,
      headers: {
        'cache-control': 'no-cache',
        connection: 'keep-alive',
        'content-type': 'text/event-stream',
        ...corsHeaders(),
      },
    });
  }

  return new Response('Accepted', {
    status: 202,
    headers: {
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'content-type': 'text/event-stream',
      ...corsHeaders(),
    },
  });
}

export class CatalogMcpAgent extends McpAgent {
  server = createCatalogMcpServer({
    serverInfo: ONLINE_SERVER_INFO,
    store,
    onEvent: (event, details) => logEvent(getCurrentAgent().request, event, details),
  });

  async init() {}
}

const streamableMcpHandler = CatalogMcpAgent.serve(STREAMABLE_MCP_PATH, {
  binding: MCP_OBJECT_BINDING,
  corsOptions: MCP_CORS_OPTIONS,
});

export function createHealthResponse() {
  const meta = store.getCatalogMeta();
  return new Response(
    JSON.stringify({
      ok: true,
      service: ONLINE_SERVER_INFO.name,
      version: ONLINE_SERVER_INFO.version,
      generatedAt: meta.generatedAt,
      totalFeatures: meta.stats.totalFeatures,
    }),
    {
      headers: {
        'content-type': 'application/json',
        ...corsHeaders(),
      },
    },
  );
}

export async function handleMcpRequest(request, env, ctx) {
  return handleRateLimited(request, env, async () => {
    const response = await streamableMcpHandler.fetch(request, env, ctx);
    await logEvent(request, 'transport.streamable_http', {
      status: response.status,
    });
    return response;
  });
}

export async function handleLegacySseRequest(request, env, ctx) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders(),
    });
  }

  return handleRateLimited(request, env, async () => {
    if (request.method === 'GET') {
      const response = await handleLegacySseConnect(request, env, ctx);
      await logEvent(request, 'transport.sse', {
        status: response.status,
      });
      return response;
    }

    if (request.method === 'POST') {
      const response = await handleLegacyMessages(request, env, ctx);
      await logEvent(request, 'transport.sse.message', {
        status: response.status,
      });
      return response;
    }

    return new Response('Method Not Allowed', {
      status: 405,
      headers: corsHeaders(),
    });
  });
}

export function isStreamableMcpRequest(request) {
  return new URL(request.url).pathname === STREAMABLE_MCP_PATH;
}

export function isLegacySseRequest(request) {
  return new URL(request.url).pathname === LEGACY_SSE_PATH;
}

export function isLegacyMessageRequest(request) {
  return new URL(request.url).pathname === LEGACY_MESSAGES_PATH;
}
