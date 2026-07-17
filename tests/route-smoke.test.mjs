import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  parseRouteSmokeArgs,
  runRouteSmoke,
} from '../scripts/smoke-routes.mjs';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'content-type': 'application/json',
    },
    ...init,
  });
}

test('route smoke parses HTTPS base URL and thresholds', () => {
  assert.deepEqual(parseRouteSmokeArgs(['--base-url=https://lounge-guru-mcp.dev-4ee.workers.dev/path', '--min-records=2000']), {
    baseUrl: 'https://lounge-guru-mcp.dev-4ee.workers.dev',
    minRecords: 2000,
    timeoutMs: 12000,
  });
  assert.throws(() => parseRouteSmokeArgs(['--base-url=http://example.com']), /must use HTTPS/);
  assert.throws(() => parseRouteSmokeArgs(['--min-records=0']), /positive number/);
  assert.throws(() => parseRouteSmokeArgs(['--timeout-ms=0']), /positive number/);
  assert.throws(() => parseRouteSmokeArgs(['--unknown']), /Unknown argument/);
});

test('route smoke verifies health, MCP guard, and SSE endpoint event', async () => {
  const calls = [];
  const logs = [];
  const summary = await runRouteSmoke({
    args: ['--base-url=https://lounge-guru-mcp.dev-4ee.workers.dev', '--min-records=2600'],
    fetchImpl: async (url) => {
      calls.push(String(url));
      if (String(url).endsWith('/healthz')) {
        return jsonResponse({
          ok: true,
          service: 'lounge-guru',
          totalFeatures: 2644,
        });
      }
      if (String(url).endsWith('/mcp')) {
        return jsonResponse(
          {
            error: {
              message: 'Bad Request: Mcp-Session-Id header is required',
            },
            jsonrpc: '2.0',
          },
          { status: 400 },
        );
      }
      if (String(url).endsWith('/sse')) {
        return new Response('event: endpoint\ndata: /messages?sessionId=abc\n\n', {
          status: 200,
          headers: {
            'content-type': 'text/event-stream',
          },
        });
      }
      throw new Error(`Unexpected URL ${url}`);
    },
    log: (line) => logs.push(line),
  });

  assert.deepEqual(calls, [
    'https://lounge-guru-mcp.dev-4ee.workers.dev/healthz',
    'https://lounge-guru-mcp.dev-4ee.workers.dev/mcp',
    'https://lounge-guru-mcp.dev-4ee.workers.dev/sse',
  ]);
  assert.equal(summary.ok, true);
  assert.equal(summary.totalFeatures, 2644);
  assert.equal(summary.mcpStatus, 400);
  assert.equal(summary.sseStatus, 200);
  assert.doesNotMatch(logs.join('\n'), /token|secret/i);
});

test('route smoke fails when MCP route serves HTML', async () => {
  await assert.rejects(
    runRouteSmoke({
      args: [],
      fetchImpl: async (url) => {
        if (String(url).endsWith('/healthz')) {
          return jsonResponse({ ok: true, totalFeatures: 2644 });
        }
        if (String(url).endsWith('/mcp')) {
          return new Response('<html></html>', {
            status: 200,
            headers: {
              'content-type': 'text/html',
            },
          });
        }
        return new Response('event: endpoint\ndata: /messages?sessionId=abc\n\n', {
          status: 200,
          headers: {
            'content-type': 'text/event-stream',
          },
        });
      },
      log: () => {},
    }),
    /mcp returned HTML/,
  );
});

test('package exposes route smoke command', () => {
  assert.equal(packageJson.scripts['smoke:routes'], 'node scripts/smoke-routes.mjs');
  assert.match(packageJson.scripts['smoke:production'], /smoke:production:web/);
  assert.match(packageJson.scripts['smoke:production'], /smoke:production:worker/);
  assert.match(packageJson.scripts['smoke:production:web'], /smoke:deploy/);
  assert.match(packageJson.scripts['smoke:production:web'], /smoke:ui/);
  assert.match(packageJson.scripts['smoke:production:worker'], /smoke:routes/);
  assert.match(packageJson.scripts['smoke:production:web'], /loungeguru-desk-travel\.pages\.dev/);
  assert.match(packageJson.scripts['smoke:production:worker'], /lounge-guru-mcp\.dev-4ee\.workers\.dev/);
});
