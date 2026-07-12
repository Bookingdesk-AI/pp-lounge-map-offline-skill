import { pathToFileURL } from 'node:url';

const DEFAULT_BASE_URL = 'https://loungeguru.desk.travel';
const DEFAULT_MIN_RECORDS = 2600;
const DEFAULT_TIMEOUT_MS = 12000;

export function parseRouteSmokeArgs(args, env = process.env) {
  const options = {
    baseUrl: env.LOUNGE_GURU_SMOKE_BASE_URL || DEFAULT_BASE_URL,
    minRecords: Number(env.LOUNGE_GURU_SMOKE_MIN_RECORDS || DEFAULT_MIN_RECORDS),
    timeoutMs: Number(env.LOUNGE_GURU_ROUTE_SMOKE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
  };

  for (const arg of args) {
    if (arg.startsWith('--base-url=')) {
      options.baseUrl = arg.slice('--base-url='.length);
      continue;
    }
    if (arg.startsWith('--min-records=')) {
      options.minRecords = Number(arg.slice('--min-records='.length));
      continue;
    }
    if (arg.startsWith('--timeout-ms=')) {
      options.timeoutMs = Number(arg.slice('--timeout-ms='.length));
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  const url = new URL(options.baseUrl);
  if (url.protocol !== 'https:') {
    throw new Error('Route smoke base URL must use HTTPS');
  }
  if (!Number.isFinite(options.minRecords) || options.minRecords < 1) {
    throw new Error('Minimum records must be a positive number');
  }
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error('Route smoke timeout must be a positive number');
  }

  return {
    ...options,
    baseUrl: url.origin,
  };
}

async function fetchWithTimeout(fetchImpl, url, init, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImpl(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function readFirstChunk(response, timeoutMs) {
  const reader = response.body?.getReader?.();
  if (!reader) {
    return response.text();
  }

  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('SSE endpoint did not emit before timeout')), timeoutMs);
  });
  const result = await Promise.race([reader.read(), timeout]);
  await reader.cancel().catch(() => {});

  if (result.done || !result.value) {
    return '';
  }
  return new TextDecoder().decode(result.value);
}

function assertNotHtml(response, route) {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('text/html')) {
    throw new Error(`Route smoke failed: ${route} returned HTML`);
  }
  return contentType;
}

export async function runRouteSmoke({
  args = process.argv.slice(2),
  env = process.env,
  fetchImpl = fetch,
  log = console.log,
} = {}) {
  const options = parseRouteSmokeArgs(args, env);
  const healthUrl = new URL('/healthz', options.baseUrl);
  const mcpUrl = new URL('/mcp', options.baseUrl);
  const sseUrl = new URL('/sse', options.baseUrl);

  const healthResponse = await fetchWithTimeout(
    fetchImpl,
    healthUrl,
    { headers: { accept: 'application/json' } },
    options.timeoutMs,
  );
  const health = await readJson(healthResponse);
  if (!healthResponse.ok || health?.ok !== true) {
    throw new Error(`Route smoke failed: healthz ${healthResponse.status}`);
  }
  if (Number(health.totalFeatures ?? 0) < options.minRecords) {
    throw new Error(`Route smoke failed: healthz records ${Number(health.totalFeatures ?? 0)}`);
  }

  const mcpResponse = await fetchWithTimeout(
    fetchImpl,
    mcpUrl,
    {
      headers: {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
      },
    },
    options.timeoutMs,
  );
  const mcpContentType = assertNotHtml(mcpResponse, '/mcp');
  const mcpBody = await mcpResponse.text();
  if (![200, 400].includes(mcpResponse.status)) {
    throw new Error(`Route smoke failed: mcp ${mcpResponse.status}`);
  }
  if (mcpResponse.status === 400 && !/Mcp-Session-Id|jsonrpc/i.test(mcpBody)) {
    throw new Error('Route smoke failed: mcp did not return MCP JSON-RPC guard');
  }

  const sseResponse = await fetchWithTimeout(
    fetchImpl,
    sseUrl,
    { headers: { accept: 'text/event-stream' } },
    options.timeoutMs,
  );
  const sseContentType = assertNotHtml(sseResponse, '/sse');
  if (!sseResponse.ok || !sseContentType.includes('text/event-stream')) {
    throw new Error(`Route smoke failed: sse ${sseResponse.status}`);
  }
  const sseChunk = await readFirstChunk(sseResponse, options.timeoutMs);
  if (!sseChunk.includes('event: endpoint') || !sseChunk.includes('/messages?sessionId=')) {
    throw new Error('Route smoke failed: sse endpoint event missing');
  }

  const summary = {
    ok: true,
    baseUrl: options.baseUrl,
    healthStatus: healthResponse.status,
    totalFeatures: Number(health.totalFeatures ?? 0),
    mcpStatus: mcpResponse.status,
    mcpContentType,
    sseStatus: sseResponse.status,
    sseContentType,
  };

  log(JSON.stringify(summary, null, 2));
  return summary;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  runRouteSmoke().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
