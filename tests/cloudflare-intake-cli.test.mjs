import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  buildProbeBatchUrl,
  buildReportUrl,
  parseArgs,
  parseSourceIds,
  runCloudflareSourceIntake,
} from '../scripts/run-cloudflare-source-intake.mjs';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('Cloudflare intake CLI parses bounded source IDs', () => {
  assert.deepEqual(parseSourceIds(' visa-airport-companion,dragonpass,, '), [
    'visa-airport-companion',
    'dragonpass',
  ]);
  assert.deepEqual(parseArgs(['--dry-run', '--source-ids=dragonpass']).sourceIds, ['dragonpass']);
  assert.equal(parseArgs(['--report']).mode, 'report');
});

test('Cloudflare intake CLI rejects non-HTTPS endpoints', () => {
  assert.throws(
    () => buildProbeBatchUrl({ baseUrl: 'http://127.0.0.1:8787', sourceIds: [] }),
    /must use HTTPS/,
  );
  assert.throws(
    () => buildReportUrl({ baseUrl: 'http://127.0.0.1:8787' }),
    /must use HTTPS/,
  );
});

test('Cloudflare intake CLI dry run does not require token or fetch', async () => {
  const lines = [];
  const summary = await runCloudflareSourceIntake({
    args: ['--dry-run', '--source-ids=visa-airport-companion'],
    env: {},
    fetchImpl: async () => {
      throw new Error('fetch should not run');
    },
    log: (line) => lines.push(line),
  });

  assert.equal(summary.dryRun, true);
  assert.equal(summary.endpoint, 'https://loungeguru.desk.travel/admin/source-intake/probe-batch');
  assert.deepEqual(summary.sourceIds, ['visa-airport-companion']);
  assert.doesNotMatch(lines.join('\n'), /token|secret/i);
});

test('Cloudflare intake CLI posts only to the Worker batch endpoint', async () => {
  const calls = [];
  const lines = [];
  const summary = await runCloudflareSourceIntake({
    args: ['--source-ids=visa-airport-companion,dragonpass'],
    env: {
      LOUNGE_GURU_INTAKE_TOKEN: 'secret-token',
    },
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          ok: true,
          mode: 'batch',
          totalTasks: 2,
          fetched: 2,
          results: [
            {
              sourceId: 'visa-airport-companion',
              status: 'fetched',
              cloudflareRuntime: true,
              cloudflareSnapshot: true,
              stats: { fetched: 1 },
            },
            {
              sourceId: 'dragonpass',
              status: 'fetched',
              cloudflareRuntime: true,
              cloudflareSnapshot: true,
              stats: { fetched: 1 },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
    log: (line) => lines.push(line),
  });

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    'https://loungeguru.desk.travel/admin/source-intake/probe-batch?sourceIds=visa-airport-companion%2Cdragonpass',
  );
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['x-lounge-guru-intake-token'], 'secret-token');
  assert.equal(summary.fetched, 2);
  assert.equal(summary.next, 'npm run intake:evidence');
  assert.doesNotMatch(lines.join('\n'), /secret-token/);
});

test('Cloudflare intake CLI can request D1-derived report endpoint', async () => {
  const calls = [];
  const lines = [];
  const summary = await runCloudflareSourceIntake({
    args: ['--report'],
    env: {
      LOUNGE_GURU_INTAKE_TOKEN: 'secret-token',
    },
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          ok: true,
          stats: {
            totalSources: 3,
            fetched: 3,
            cloudflareSourceRuns: 4,
          },
          terminalImpact: {
            fullCatalogIntakeReport: false,
            coverageGateStillRequiresFullCloudflareReport: true,
          },
          sources: [],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
    log: (line) => lines.push(line),
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://loungeguru.desk.travel/admin/source-intake/report');
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.headers['x-lounge-guru-intake-token'], 'secret-token');
  assert.equal(summary.totalSources, 3);
  assert.equal(summary.cloudflareSourceRuns, 4);
  assert.equal(summary.fullCatalogIntakeReport, false);
  assert.equal(summary.coverageGateStillRequiresFullCloudflareReport, true);
  assert.doesNotMatch(lines.join('\n'), /secret-token/);
});

test('Cloudflare intake CLI requires token for real runs without leaking token', async () => {
  await assert.rejects(
    runCloudflareSourceIntake({
      args: [],
      env: {},
      log: () => {},
    }),
    /LOUNGE_GURU_INTAKE_TOKEN is required/,
  );

  await assert.rejects(
    runCloudflareSourceIntake({
      args: [],
      env: {
        LOUNGE_GURU_INTAKE_TOKEN: 'secret-token',
      },
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: 'forbidden' }), {
          status: 403,
          headers: { 'content-type': 'application/json' },
        }),
      log: () => {},
    }),
    (error) => {
      assert.match(error.message, /Cloudflare intake failed: 403 forbidden/);
      assert.doesNotMatch(error.message, /secret-token/);
      return true;
    },
  );
});

test('package exposes Cloudflare-only intake command before evidence export', () => {
  assert.equal(
    packageJson.scripts['intake:cloudflare'],
    'node scripts/run-cloudflare-source-intake.mjs && npm run intake:evidence',
  );
  assert.equal(
    packageJson.scripts['intake:cloudflare:report'],
    'node scripts/run-cloudflare-source-intake.mjs --report',
  );
  assert.equal(packageJson.scripts['scrape:sources'], 'node scripts/scrape-source-snapshots.mjs');
});
