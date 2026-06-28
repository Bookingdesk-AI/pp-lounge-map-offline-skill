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
  });
  assert.throws(() => parseSmokeArgs(['--base-url=http://example.com']), /must use HTTPS/);
  assert.throws(() => parseSmokeArgs(['--min-records=0']), /positive number/);
  assert.throws(() => parseSmokeArgs(['--unknown']), /Unknown argument/);
});

test('deploy smoke treats unauthenticated admin report 403 as expected guard', async () => {
  const calls = [];
  const logs = [];
  const summary = await runDeploySmoke({
    args: ['--base-url=https://loungeguru.desk.travel', '--min-records=2000'],
    fetchImpl: async (url) => {
      calls.push(String(url));
      if (String(url).endsWith('/data/lounge-guru-catalog.json')) {
        return jsonResponse({
          generatedAt: '2026-06-19T00:00:00.000Z',
          stats: {
            totalCatalogRecords: 2644,
          },
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
    'https://loungeguru.desk.travel/',
    'https://loungeguru.desk.travel/data/lounge-guru-catalog.json',
    'https://loungeguru.desk.travel/admin/source-intake/report',
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
        if (String(url).endsWith('/data/lounge-guru-catalog.json')) {
          return jsonResponse({
            stats: {
              totalCatalogRecords: 100,
            },
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
      args: [],
      fetchImpl: async (url) => {
        if (String(url).endsWith('/data/lounge-guru-catalog.json')) {
          return jsonResponse({
            stats: {
              totalCatalogRecords: 2644,
            },
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

test('package exposes deploy smoke command', () => {
  assert.equal(packageJson.scripts['smoke:deploy'], 'node scripts/smoke-deploy.mjs');
});
