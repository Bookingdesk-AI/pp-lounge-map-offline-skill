const DEFAULT_LIMIT = 60;
const DEFAULT_WINDOW_MS = 60_000;

export class McpRateLimiter {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const body = await request.json();
    const key = String(body.key ?? '').slice(0, 128);
    const limit = Number.isFinite(body.limit) ? Math.max(1, Math.floor(body.limit)) : DEFAULT_LIMIT;
    const windowMs = Number.isFinite(body.windowMs)
      ? Math.max(1_000, Math.floor(body.windowMs))
      : DEFAULT_WINDOW_MS;
    const now = Date.now();
    const storageKey = `bucket:${key}`;
    const record = (await this.state.storage.get(storageKey)) ?? {
      count: 0,
      resetAt: now + windowMs,
    };

    const nextRecord =
      record.resetAt <= now
        ? {
            count: 0,
            resetAt: now + windowMs,
          }
        : record;

    if (nextRecord.count >= limit) {
      return Response.json(
        {
          ok: false,
          remaining: 0,
          retryAfterMs: nextRecord.resetAt - now,
        },
        { status: 429 },
      );
    }

    const updated = {
      count: nextRecord.count + 1,
      resetAt: nextRecord.resetAt,
    };

    await this.state.storage.put(storageKey, updated);

    return Response.json({
      ok: true,
      remaining: Math.max(limit - updated.count, 0),
      retryAfterMs: updated.resetAt - now,
    });
  }
}

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

async function rateLimitKey(request) {
  const ip = firstHeaderValue(request.headers.get('cf-connecting-ip'));
  const agent = request.headers.get('user-agent')?.slice(0, 160) || 'unknown';
  return sha256Hex(`${ip}|${agent}`);
}

export async function enforceRateLimit(env, request, options = {}) {
  if (!env?.MCP_RATE_LIMITER || request.method === 'OPTIONS') {
    return {
      ok: true,
      headers: {
        'x-rate-limit-mode': 'disabled',
      },
    };
  }

  const key = await rateLimitKey(request);
  const id = env.MCP_RATE_LIMITER.idFromName('pp-lounge-map-anon');
  const stub = env.MCP_RATE_LIMITER.get(id);
  const limit = options.limit ?? DEFAULT_LIMIT;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const response = await stub.fetch('https://internal/rate-limit', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      key,
      limit,
      windowMs,
    }),
  });

  const payload = await response.json();
  const headers = {
    'retry-after': String(Math.ceil((payload.retryAfterMs ?? 0) / 1_000)),
    'x-rate-limit-limit': String(limit),
    'x-rate-limit-remaining': String(payload.remaining ?? 0),
    'x-rate-limit-window-ms': String(windowMs),
  };

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      headers,
    };
  }

  return {
    ok: true,
    headers,
  };
}
