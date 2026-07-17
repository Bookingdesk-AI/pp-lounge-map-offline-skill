import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  parseSmokeArgs,
  runDeploySmoke,
} from '../scripts/smoke-deploy.mjs';

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

test('deploy smoke parses HTTPS base URL and record threshold', () => {
  assert.deepEqual(parseSmokeArgs(['--base-url=https://preview.example.com/path', '--min-records=100']), {
    baseUrl: 'https://preview.example.com',
    minCatalogRecords: 100,
    adminReport: 'static-fallback',
  });
  assert.throws(() => parseSmokeArgs(['--base-url=http://example.com']), /must use HTTPS/);
  assert.throws(() => parseSmokeArgs(['--min-records=0']), /positive number/);
  assert.throws(() => parseSmokeArgs(['--admin-report=open']), /forbidden, not-found, or static-fallback/);
  assert.throws(() => parseSmokeArgs(['--unknown']), /Unknown argument/);
});

test('deploy smoke treats unauthenticated admin report 403 as expected guard', async () => {
  const calls = [];
  const logs = [];
  const summary = await runDeploySmoke({
    args: ['--base-url=https://lounge-guru-mcp.dev-4ee.workers.dev', '--min-records=2000', '--admin-report=forbidden'],
    fetchImpl: async (url) => {
      calls.push(String(url));
      if (String(url).endsWith('/data/lounge-map.json')) {
        return jsonResponse({
          generatedAt: '2026-06-19T00:00:00.000Z',
          records: Array.from({ length: 2644 }, (_, index) => ({ id: index })),
        });
      }
      if (String(url).endsWith('/admin/source-intake/report')) {
        return jsonResponse({ error: 'forbidden' }, { status: 403 });
      }
      return new Response('<html></html>', {
        status: 200,
        headers: {
          'content-type': 'text/html',
        },
      });
    },
    log: (line) => logs.push(line),
  });

  assert.deepEqual(calls, [
    'https://lounge-guru-mcp.dev-4ee.workers.dev/',
    'https://lounge-guru-mcp.dev-4ee.workers.dev/data/lounge-map.json',
    'https://lounge-guru-mcp.dev-4ee.workers.dev/admin/source-intake/report',
  ]);
  assert.equal(summary.ok, true);
  assert.equal(summary.catalogRecords, 2644);
  assert.equal(summary.adminReportGuard, 'forbidden');
  assert.doesNotMatch(logs.join('\n'), /token|secret/i);
});

test('deploy smoke fails when catalog records are below threshold', async () => {
  await assert.rejects(
    runDeploySmoke({
      args: ['--min-records=3000'],
      fetchImpl: async (url) => {
        if (String(url).endsWith('/data/lounge-map.json')) {
          return jsonResponse({
            records: Array.from({ length: 100 }, (_, index) => ({ id: index })),
          });
        }
        if (String(url).endsWith('/admin/source-intake/report')) {
          return jsonResponse({ error: 'forbidden' }, { status: 403 });
        }
        return new Response('<html></html>', { status: 200 });
      },
      log: () => {},
    }),
    /catalog records 100/,
  );
});

test('deploy smoke fails when admin report is not guarded', async () => {
  await assert.rejects(
    runDeploySmoke({
      args: ['--admin-report=forbidden'],
      fetchImpl: async (url) => {
        if (String(url).endsWith('/data/lounge-map.json')) {
          return jsonResponse({
            records: Array.from({ length: 2644 }, (_, index) => ({ id: index })),
          });
        }
        if (String(url).endsWith('/admin/source-intake/report')) {
          return jsonResponse({ ok: true }, { status: 200 });
        }
        return new Response('<html></html>', { status: 200 });
      },
      log: () => {},
    }),
    /admin guard 200/,
  );
});

test('deploy smoke can explicitly accept static preview fallback for admin report', async () => {
  const summary = await runDeploySmoke({
    args: ['--base-url=https://preview.example.com', '--admin-report=static-fallback'],
    fetchImpl: async (url) => {
      if (String(url).endsWith('/data/lounge-map.json')) {
        return jsonResponse({
          records: Array.from({ length: 2644 }, (_, index) => ({ id: index })),
        });
      }
      return new Response('<html></html>', {
        status: 200,
        headers: {
          'content-type': 'text/html',
        },
      });
    },
    log: () => {},
  });

  assert.equal(summary.adminReportGuard, 'static-fallback');
});

test('deploy smoke accepts an absent admin route on Pages', async () => {
  const summary = await runDeploySmoke({
    args: ['--base-url=https://loungeguru-desk-travel.pages.dev', '--admin-report=not-found'],
    fetchImpl: async (url) => {
      if (String(url).endsWith('/data/lounge-map.json')) {
        return jsonResponse({ records: Array.from({ length: 2644 }, (_, index) => ({ id: index })) });
      }
      if (String(url).endsWith('/admin/source-intake/report')) {
        return new Response('Not Found', { status: 404 });
      }
      return new Response('<html></html>', { status: 200 });
    },
    log: () => {},
  });

  assert.equal(summary.adminReportGuard, 'not-found');
});

test('package exposes deploy smoke command', () => {
  assert.equal(packageJson.scripts['smoke:deploy'], 'node scripts/smoke-deploy.mjs');
});
