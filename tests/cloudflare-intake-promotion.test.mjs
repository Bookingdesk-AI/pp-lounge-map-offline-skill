import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  findRawContentFields,
  parsePromotionArgs,
  promoteCloudflareSourceIntakeReport,
  validatePromotableCloudflareReport,
} from '../scripts/promote-cloudflare-source-intake-report.mjs';

function sourceFixture(index, overrides = {}) {
  return {
    sourceId: `source-${String(index).padStart(2, '0')}`,
    publisher: `Source ${index}`,
    url: `https://example.com/source-${index}`,
    adapter: 'official_page',
    status: 'fetched',
    records: 0,
    airportCodes: ['LAX', 'JFK', 'SIN', 'HKG'],
    loungeLinks: [`https://example.com/source-${index}/lounges`],
    cloudflareSnapshot: true,
    finalUrl: `https://example.com/source-${index}`,
    httpStatus: 200,
    contentType: 'text/html',
    bytes: 1000 + index,
    sha256: `sha-${index}`,
    runId: `cloudflare-run-${index}`,
    retrievedAt: '2026-06-19T00:00:00.000Z',
    fetchAttempts: [],
    ...overrides,
  };
}

function promotableReport(overrides = {}) {
  const sources = Array.from({ length: 30 }, (_item, index) => sourceFixture(index + 1));
  return {
    ok: true,
    generatedAt: '2026-06-19T00:00:00.000Z',
    runId: 'cloudflare-report-2026-06-19',
    policy: {
      fetchMode: 'cloudflare_d1_full_catalog_report',
      rawSnapshotsCommitted: false,
      rawPageContentCommitted: false,
      guardrail: 'official/public source-run evidence only; no local page fetch',
      execution: {
        requiredRuntime: 'cloudflare',
        runtime: 'cloudflare',
        localScrawl: 'blocked',
        proofEnv: 'LOUNGE_GURU_INTAKE_TOKEN',
      },
    },
    stats: {
      totalSources: sources.length,
      fetched: 20,
      skipped: 3,
      httpErrors: 4,
      fetchErrors: 3,
      childPagesFetched: 20,
      discoveredAirportCodes: 120,
      discoveredLoungeLinks: 60,
      cloudflareSourceRuns: sources.length,
    },
    terminalImpact: {
      fullCatalogIntakeReport: true,
      coverageGateStillRequiresFullCloudflareReport: false,
    },
    sources,
    ...overrides,
  };
}

test('Cloudflare intake promotion parses explicit paths', () => {
  const options = parsePromotionArgs(['--input=.cache/report.json', '--output=public/data/source-intake-report.json']);
  assert.match(options.input, /\/\.cache\/report\.json$/);
  assert.match(options.output, /\/public\/data\/source-intake-report\.json$/);
  assert.throws(() => parsePromotionArgs(['--bad']), /Unknown argument/);
});

test('Cloudflare intake promotion rejects probe-only report shape', () => {
  const report = promotableReport({
    stats: {
      totalSources: 3,
      fetched: 3,
      discoveredAirportCodes: 0,
      discoveredLoungeLinks: 0,
      cloudflareSourceRuns: 4,
    },
    terminalImpact: {
      fullCatalogIntakeReport: false,
      coverageGateStillRequiresFullCloudflareReport: true,
    },
    sources: [sourceFixture(1), sourceFixture(2), sourceFixture(3)],
  });

  const issues = validatePromotableCloudflareReport(report);
  assert.ok(issues.includes('full catalog intake report is not true'));
  assert.ok(issues.includes('coverage gate still requires full Cloudflare report'));
  assert.ok(issues.includes('source count below 30'));
  assert.ok(issues.includes('fetched source count below 15'));
});

test('Cloudflare intake promotion rejects raw page content recursively', () => {
  const report = promotableReport({
    sources: [
      sourceFixture(1, {
        text: '<html>raw body</html>',
        fetchAttempts: [{ status: 'fetched', html: '<html>raw attempt</html>' }],
      }),
      ...Array.from({ length: 29 }, (_item, index) => sourceFixture(index + 2)),
    ],
  });

  assert.deepEqual(findRawContentFields(report).sort(), [
    '$.sources[0].fetchAttempts[0].html',
    '$.sources[0].text',
  ]);
  assert.match(validatePromotableCloudflareReport(report).join('\n'), /raw page content fields present/);
});

test('Cloudflare intake promotion writes only promotable full catalog report', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lounge-guru-promotion-'));
  const input = path.join(tempDir, 'cloudflare-source-intake-report.json');
  const output = path.join(tempDir, 'source-intake-report.json');
  const report = promotableReport();

  await fs.writeFile(input, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const summary = await promoteCloudflareSourceIntakeReport({ input, output });
  const promoted = JSON.parse(await fs.readFile(output, 'utf8'));

  assert.equal(summary.sources, 30);
  assert.equal(summary.fetched, 20);
  assert.deepEqual(promoted, report);
  await fs.rm(tempDir, { recursive: true, force: true });
});

test('Cloudflare intake promotion does not overwrite canonical report on failure', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lounge-guru-promotion-'));
  const input = path.join(tempDir, 'probe-report.json');
  const output = path.join(tempDir, 'source-intake-report.json');
  const original = { kept: true };
  const probeReport = promotableReport({
    stats: {
      totalSources: 3,
      fetched: 3,
      discoveredAirportCodes: 0,
      discoveredLoungeLinks: 0,
      cloudflareSourceRuns: 4,
    },
    terminalImpact: {
      fullCatalogIntakeReport: false,
      coverageGateStillRequiresFullCloudflareReport: true,
    },
    sources: [sourceFixture(1), sourceFixture(2), sourceFixture(3)],
  });

  await fs.writeFile(input, `${JSON.stringify(probeReport, null, 2)}\n`, 'utf8');
  await fs.writeFile(output, `${JSON.stringify(original, null, 2)}\n`, 'utf8');

  await assert.rejects(promoteCloudflareSourceIntakeReport({ input, output }), /not promotable/);
  assert.deepEqual(JSON.parse(await fs.readFile(output, 'utf8')), original);
  await fs.rm(tempDir, { recursive: true, force: true });
});
