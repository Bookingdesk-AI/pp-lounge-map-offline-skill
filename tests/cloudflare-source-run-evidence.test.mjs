import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createCloudflareSourceRunEvidence } from '../scripts/lib/cloudflare-source-run-evidence.mjs';
import {
  evidenceMatchesExceptGeneratedAt,
  shouldRetryWithoutApiToken,
  writeEvidenceIfChanged,
} from '../scripts/export-cloudflare-source-run-evidence.mjs';

const publicEvidence = JSON.parse(
  fs.readFileSync(new URL('../public/data/cloudflare-source-run-evidence.json', import.meta.url), 'utf8'),
);
const intakePlan = JSON.parse(
  fs.readFileSync(new URL('../public/data/cloudflare-source-intake-plan.json', import.meta.url), 'utf8'),
);

test('Cloudflare source-run evidence keeps latest bounded row per source', () => {
  const d1Result = [
    {
      results: [
        {
          id: 'cloudflare-probe-new-visa',
          generated_at: '2026-06-19T10:00:00.000Z',
          policy_json: JSON.stringify({ fetchMode: 'cloudflare_single_source_probe', execution: { runtime: 'cloudflare' } }),
          stats_json: JSON.stringify({ fetched: 1 }),
          sources_json: JSON.stringify([
            {
              sourceId: 'visa-airport-companion',
              publisher: 'Visa Airport Companion',
              url: 'https://www.visaairportcompanion.com/',
              adapter: 'official_page',
              status: 'fetched',
              records: 0,
              airportCodes: [],
              loungeLinks: [],
              cloudflareSnapshot: true,
              finalUrl: 'https://visaairportcompanion.ca/',
              httpStatus: 200,
              contentType: 'text/html',
              bytes: 120,
              sha256: 'abc',
              fetchAttempts: [
                {
                  url: 'https://www.visaairportcompanion.com/',
                  status: 'fetched',
                  httpStatus: 200,
                  finalUrl: 'https://visaairportcompanion.ca/',
                  contentType: 'text/html',
                  bytes: 120,
                  sha256: 'abc',
                  robots: {
                    checked: true,
                    url: 'https://www.visaairportcompanion.com/robots.txt',
                    status: 200,
                    disallowed: false,
                    disallowRuleCount: 0,
                  },
                },
              ],
              text: '<html>not exported</html>',
            },
          ]),
        },
        {
          id: 'cloudflare-probe-old-visa',
          generated_at: '2026-06-19T09:00:00.000Z',
          policy_json: JSON.stringify({ fetchMode: 'cloudflare_single_source_probe', execution: { runtime: 'cloudflare' } }),
          stats_json: JSON.stringify({ fetched: 1 }),
          sources_json: JSON.stringify([
            {
              sourceId: 'visa-airport-companion',
              publisher: 'Visa Airport Companion',
              url: 'https://www.visaairportcompanion.com/',
              adapter: 'official_page',
              status: 'http_error',
              records: 0,
              airportCodes: [],
              loungeLinks: [],
              cloudflareSnapshot: false,
            },
          ]),
        },
      ],
    },
  ];
  const evidence = createCloudflareSourceRunEvidence({
    d1Result,
    sourceIntakePlan: {
      tasks: [{ sourceId: 'visa-airport-companion', status: 'ready' }],
      memberGaps: [
        {
          sourceId: 'visa-airport-companion',
          familyId: 'card-network-programs',
          status: 'ready',
          terminalFamilyBlocked: true,
        },
      ],
    },
    generatedAt: '2026-06-19T11:00:00.000Z',
  });

  assert.equal(evidence.stats.sourceRunsRead, 2);
  assert.equal(evidence.stats.uniqueSources, 1);
  assert.equal(evidence.stats.readyTasksWithCloudflareEvidence, 1);
  assert.equal(evidence.stats.readyMemberGaps, 1);
  assert.equal(evidence.stats.readyMemberGapsWithCloudflareEvidence, 1);
  assert.deepEqual(evidence.readyMemberGapEvidence, [
    {
      sourceId: 'visa-airport-companion',
      familyId: 'card-network-programs',
      terminalFamilyBlocked: true,
      present: true,
      status: 'fetched',
      cloudflareSnapshot: true,
    },
  ]);
  assert.equal(evidence.sources[0].runId, 'cloudflare-probe-new-visa');
  assert.equal(evidence.sources[0].status, 'fetched');
  assert.equal(evidence.sources[0].cloudflareSnapshot, true);
  assert.ok(!Object.hasOwn(evidence.sources[0], 'text'));
  assert.ok(!Object.hasOwn(evidence.sources[0], 'html'));
  assert.ok(!Object.hasOwn(evidence.sources[0].fetchAttempts[0], 'text'));
  assert.ok(!Object.hasOwn(evidence.sources[0].fetchAttempts[0], 'html'));
});

test('public Cloudflare evidence covers current ready intake tasks only', () => {
  const readyTaskIds = intakePlan.tasks.filter((task) => task.status === 'ready').map((task) => task.sourceId).sort();
  const evidenceTaskIds = publicEvidence.readyTaskEvidence.map((task) => task.sourceId).sort();
  const readyMemberGapKeys = intakePlan.memberGaps
    .filter((gap) => gap.status === 'ready')
    .map((gap) => `${gap.familyId}:${gap.sourceId}`)
    .sort();
  const evidenceMemberGapKeys = publicEvidence.readyMemberGapEvidence
    .map((gap) => `${gap.familyId}:${gap.sourceId}`)
    .sort();

  assert.deepEqual(evidenceTaskIds, readyTaskIds);
  assert.deepEqual(evidenceMemberGapKeys, readyMemberGapKeys);
  assert.equal(publicEvidence.policy.localScrawl, 'blocked');
  assert.equal(publicEvidence.policy.rawPageContentCommitted, false);
  assert.equal(publicEvidence.stats.readyTasksWithCloudflareEvidence, readyTaskIds.length);
  assert.equal(publicEvidence.stats.readyMemberGaps, readyMemberGapKeys.length);
  assert.ok(publicEvidence.stats.readyMemberGapsWithCloudflareEvidence > 0);
  assert.equal(publicEvidence.terminalImpact.coverageGateStillRequiresFullCloudflareReport, true);

  for (const source of publicEvidence.sources) {
    assert.equal(source.cloudflareSnapshot, true);
    assert.ok(source.runId.startsWith('cloudflare-probe-'));
    assert.ok(source.sha256);
    assert.ok(!Object.hasOwn(source, 'text'));
    assert.ok(!Object.hasOwn(source, 'html'));
  }
});

test('Cloudflare evidence export does not rewrite timestamp-only changes', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'lounge-guru-evidence-test-'));
  const outputPath = path.join(tempDir, 'evidence.json');
  const existing = {
    generatedAt: '2026-06-01T00:00:00.000Z',
    policy: { source: 'cloudflare-d1-source_runs' },
    stats: { uniqueSources: 3 },
    sources: [{ sourceId: 'visa-airport-companion', sha256: 'abc' }],
  };
  const next = {
    ...existing,
    generatedAt: '2026-07-11T19:55:24.064Z',
  };

  try {
    await writeFile(outputPath, `${JSON.stringify(existing, null, 2)}\n`, 'utf8');

    assert.equal(evidenceMatchesExceptGeneratedAt(existing, next), true);
    assert.equal(await writeEvidenceIfChanged(outputPath, next), false);
    assert.deepEqual(JSON.parse(await readFile(outputPath, 'utf8')), existing);

    const changed = {
      ...next,
      stats: { uniqueSources: 4 },
    };
    assert.equal(await writeEvidenceIfChanged(outputPath, changed), true);
    assert.deepEqual(JSON.parse(await readFile(outputPath, 'utf8')), changed);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('Cloudflare evidence export retries only stale API token auth failures', () => {
  const authError = Object.assign(new Error('Command failed'), {
    stdout: JSON.stringify({
      error: {
        notes: [{ text: 'Authentication error [code: 10000]' }],
      },
    }),
  });

  assert.equal(shouldRetryWithoutApiToken(authError, { CLOUDFLARE_API_TOKEN: 'stale' }), true);
  assert.equal(shouldRetryWithoutApiToken(authError, {}), false);
  assert.equal(shouldRetryWithoutApiToken(new Error('network timeout'), { CLOUDFLARE_API_TOKEN: 'token' }), false);
});
