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
  assert.deepEqual(parseRouteSmokeArgs(['--base-url=https://loungeguru.desk.travel/path', '--min-records=2000']), {
    baseUrl: 'https://loungeguru.desk.travel',
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
    args: ['--base-url=https://loungeguru.desk.travel', '--min-records=2600'],
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
    'https://loungeguru.desk.travel/healthz',
    'https://loungeguru.desk.travel/mcp',
    'https://loungeguru.desk.travel/sse',
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
  assert.match(packageJson.scripts['smoke:production'], /smoke:deploy/);
  assert.match(packageJson.scripts['smoke:production'], /smoke:routes/);
  assert.match(packageJson.scripts['smoke:production'], /smoke:ui/);
  assert.match(packageJson.scripts['smoke:production'], /loungeguru\.desk\.travel/);
});
