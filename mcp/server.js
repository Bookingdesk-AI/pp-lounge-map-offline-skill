import { createMcpHandler } from 'agents/mcp';

import * as store from './catalog.js';
import { enforceRateLimit } from './rate-limit.js';
import { createCatalogMcpServer, ONLINE_SERVER_INFO } from './server-core.js';

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
  const ip = firstHeaderValue(request.headers.get('cf-connecting-ip'));
  const userAgent = request.headers.get('user-agent')?.slice(0, 160) || 'unknown';
  const query = typeof details.query === 'string' ? details.query : null;
  const safeDetails = {
    ...details,
    query: undefined,
    queryHash: query ? await sha256Hex(query) : undefined,
    queryLength: query?.length ?? 0,
  };

  console.log(
    JSON.stringify({
      service: 'pp-lounge-map-mcp',
      event,
      timestamp: new Date().toISOString(),
      method: request.method,
      path: new URL(request.url).pathname,
      ipHash: await sha256Hex(ip),
      userAgentHash: await sha256Hex(userAgent),
      country: request.headers.get('cf-ipcountry') || 'unknown',
      ...safeDetails,
    }),
  );
}

function createServer(request) {
  return createCatalogMcpServer({
    serverInfo: ONLINE_SERVER_INFO,
    store,
    onEvent: (event, details) => logEvent(request, event, details),
  });
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

export function createHealthResponse() {
  const meta = store.getCatalogMeta();
  return Response.json({
    ok: true,
    service: ONLINE_SERVER_INFO.name,
    version: ONLINE_SERVER_INFO.version,
    generatedAt: meta.generatedAt,
    totalFeatures: meta.stats.totalFeatures,
  });
}

export async function handleMcpRequest(request, env, ctx) {
  const limitResult = await enforceRateLimit(env, request);
  if (!limitResult.ok) {
    await logEvent(request, 'rate_limited', {
      status: limitResult.status ?? 429,
    });
    return new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: limitResult.status ?? 429,
      headers: {
        'content-type': 'application/json',
        ...limitResult.headers,
      },
    });
  }

  const handler = createMcpHandler(createServer(request), {
    route: '/mcp',
    enableJsonResponse: true,
    sessionIdGenerator: undefined,
  });
  const response = await handler(request, env, ctx);
  return appendHeaders(response, limitResult.headers);
}
