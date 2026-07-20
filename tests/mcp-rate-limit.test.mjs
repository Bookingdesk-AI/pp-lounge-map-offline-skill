import test from 'node:test';
import assert from 'node:assert/strict';

import { McpRateLimiter, enforceRateLimit } from '../mcp/rate-limit.js';

function createStorageState() {
  const records = new Map();
  return {
    records,
    state: {
      storage: {
        async get(key) {
          return records.get(key);
        },
        async put(key, value) {
          records.set(key, value);
        },
      },
    },
  };
}

function createLimiterRequest(body, method = 'POST') {
  return new Request('https://internal/rate-limit', {
    method,
    headers: method === 'POST' ? { 'content-type': 'application/json' } : undefined,
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
}

test('MCP rate-limit bucket increments, rejects, normalizes options, and resets', async () => {
  const { records, state } = createStorageState();
  const limiter = new McpRateLimiter(state);
  const originalNow = Date.now;
  let now = 1_000_000;
  Date.now = () => now;

  try {
    const methodRejected = await limiter.fetch(createLimiterRequest({}, 'GET'));
    assert.equal(methodRejected.status, 405);

    const oversizedKey = 'x'.repeat(200);
    const options = {
      key: oversizedKey,
      limit: 2.9,
      windowMs: 25,
    };

    const first = await limiter.fetch(createLimiterRequest(options));
    assert.equal(first.status, 200);
    assert.deepEqual(await first.json(), {
      ok: true,
      remaining: 1,
      retryAfterMs: 1_000,
    });

    const second = await limiter.fetch(createLimiterRequest(options));
    assert.equal(second.status, 200);
    assert.deepEqual(await second.json(), {
      ok: true,
      remaining: 0,
      retryAfterMs: 1_000,
    });

    const rejected = await limiter.fetch(createLimiterRequest(options));
    assert.equal(rejected.status, 429);
    assert.deepEqual(await rejected.json(), {
      ok: false,
      remaining: 0,
      retryAfterMs: 1_000,
    });

    assert.deepEqual([...records.keys()], [`bucket:${'x'.repeat(128)}`]);

    now += 1_000;
    const reset = await limiter.fetch(createLimiterRequest(options));
    assert.equal(reset.status, 200);
    assert.deepEqual(await reset.json(), {
      ok: true,
      remaining: 1,
      retryAfterMs: 1_000,
    });
  } finally {
    Date.now = originalNow;
  }
});

test('MCP rate-limit enforcement bypasses missing bindings and preflight requests', async () => {
  const request = new Request('https://example.com/mcp', {
    method: 'POST',
  });
  const disabled = await enforceRateLimit({}, request);
  assert.deepEqual(disabled, {
    ok: true,
    headers: {
      'x-rate-limit-mode': 'disabled',
    },
  });

  let bindingUsed = false;
  const preflight = await enforceRateLimit(
    {
      MCP_RATE_LIMITER: {
        idFromName() {
          bindingUsed = true;
        },
      },
    },
    new Request('https://example.com/mcp', {
      method: 'OPTIONS',
    }),
  );

  assert.deepEqual(preflight, {
    ok: true,
    headers: {
      'x-rate-limit-mode': 'disabled',
    },
  });
  assert.equal(bindingUsed, false);
});

test('MCP rate-limit enforcement hashes client identity and returns bounded headers', async () => {
  const calls = [];
  let stubStatus = 200;
  let stubPayload = {
    ok: true,
    remaining: 4,
    retryAfterMs: 1_234,
  };
  const env = {
    MCP_RATE_LIMITER: {
      idFromName(name) {
        assert.equal(name, 'lounge-guru-anon');
        return 'limiter-id';
      },
      get(id) {
        assert.equal(id, 'limiter-id');
        return {
          async fetch(url, init) {
            calls.push({
              url,
              init,
              body: JSON.parse(init.body),
            });
            return Response.json(stubPayload, {
              status: stubStatus,
            });
          },
        };
      },
    },
  };
  const request = new Request('https://example.com/mcp', {
    method: 'POST',
    headers: {
      'cf-connecting-ip': '203.0.113.9, 198.51.100.2',
      'user-agent': 'Lounge Guru Test Client',
    },
  });

  const allowed = await enforceRateLimit(env, request, {
    limit: 5,
    windowMs: 2_000,
  });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.headers['x-rate-limit-limit'], '5');
  assert.equal(allowed.headers['x-rate-limit-remaining'], '4');
  assert.equal(allowed.headers['x-rate-limit-window-ms'], '2000');
  assert.equal(calls[0].url, 'https://internal/rate-limit');
  assert.equal(calls[0].init.method, 'POST');
  assert.match(calls[0].body.key, /^[a-f0-9]{64}$/u);
  assert.doesNotMatch(JSON.stringify(calls[0].body), /203\.0\.113\.9|Lounge Guru Test Client/u);
  assert.deepEqual(
    {
      limit: calls[0].body.limit,
      windowMs: calls[0].body.windowMs,
    },
    {
      limit: 5,
      windowMs: 2_000,
    },
  );

  stubStatus = 429;
  stubPayload = {
    ok: false,
    remaining: 0,
    retryAfterMs: 2_500,
  };
  const rejected = await enforceRateLimit(env, request, {
    limit: 5,
    windowMs: 2_000,
  });
  assert.deepEqual(rejected, {
    ok: false,
    status: 429,
    headers: {
      'retry-after': '3',
      'x-rate-limit-limit': '5',
      'x-rate-limit-remaining': '0',
      'x-rate-limit-window-ms': '2000',
    },
  });
});
