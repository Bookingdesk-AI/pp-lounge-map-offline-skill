import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const report = JSON.parse(fs.readFileSync(new URL('../public/data/source-intake-report.json', import.meta.url), 'utf8'));
const catalog = JSON.parse(fs.readFileSync(new URL('../public/data/lounge-guru-catalog.json', import.meta.url), 'utf8'));
const candidates = JSON.parse(
  fs.readFileSync(new URL('../public/data/non-priority-lounge-candidates.json', import.meta.url), 'utf8'),
);
const validationReport = JSON.parse(
  fs.readFileSync(new URL('../public/data/non-priority-validation-report.json', import.meta.url), 'utf8'),
);
const sourceRegistry = JSON.parse(fs.readFileSync(new URL('../public/data/source-registry.json', import.meta.url), 'utf8'));
const projectRoot = new URL('..', import.meta.url);

test('canonical reports use the latest source-run timestamp without refreshing PP provenance', () => {
  assert.equal(catalog.generatedAt, report.generatedAt);

  const priorityPassRecord = catalog.records.find((record) =>
    record.sources.some((source) => source.sourceId === 'priority-pass'),
  );
  const nonPriorityRecord = catalog.records.find((record) =>
    record.sources.some((source) => source.sourceId !== 'priority-pass' && source.sourceId !== 'ourairports'),
  );
  const priorityPassSource = sourceRegistry.find((source) => source.id === 'priority-pass');
  const oneworldSource = sourceRegistry.find((source) => source.id === 'oneworld');

  assert.ok(priorityPassRecord);
  assert.ok(nonPriorityRecord);
  assert.notEqual(priorityPassRecord.sources[0].retrievedAt, catalog.generatedAt);
  assert.equal(nonPriorityRecord.sources[0].retrievedAt, report.generatedAt);
  assert.equal(priorityPassSource.lastRunAt, priorityPassRecord.sources[0].retrievedAt);
  assert.equal(oneworldSource.lastRunAt, report.generatedAt);
});

test('source intake report records guarded public-source fetch policy', () => {
  assert.equal(report.policy.fetchMode, 'single_public_source_url_per_registry_entry');
  assert.equal(report.policy.childFetchMode, 'bounded_lounge_link_crawl');
  assert.ok(report.policy.childPageLimit > 0);
  assert.equal(report.policy.rawSnapshotsCommitted, false);
  assert.match(report.policy.guardrail, /official\/public sources only/);
  assert.equal(report.policy.execution.requiredRuntime, 'cloudflare');
  assert.equal(report.policy.execution.localScrawl, 'blocked');
  assert.equal(report.policy.execution.proofEnv, 'LOUNGE_GURU_SOURCE_INTAKE_RUNTIME=cloudflare');
  assert.ok(report.stats.totalSources >= 15);
  assert.ok(report.stats.childPagesFetched > 0);
  assert.ok(report.stats.knownAirportCodes > 1000);
});

test('source snapshot script blocks local scrawl by default', () => {
  const result = spawnSync(process.execPath, ['scripts/scrape-source-snapshots.mjs'], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      LOUNGE_GURU_SOURCE_INTAKE_RUNTIME: '',
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /local scrawl is blocked/);
});

test('Visa source intake has Cloudflare fetch repair candidates', () => {
  const visa = sourceRegistry.find((source) => source.id === 'visa-airport-companion');

  assert.equal(visa.url, 'https://www.visaairportcompanion.com/');
  assert.ok(visa.fetchUrls.includes('https://www.visaairportcompanion.com/'));
  assert.ok(visa.fetchUrls.includes('https://visaairportcompanion.ca/'));
  assert.ok(visa.fetchUrls.includes('https://www.visa.gp/pay-with-visa/find-a-card/benefits/visa-airport-companion.html'));
  assert.ok(visa.fetchUrls.every((url) => url.startsWith('https://')));
});

test('latest Visa intake failure remains Cloudflare-only evidence', () => {
  const visa = report.sources.find((source) => source.sourceId === 'visa-airport-companion');

  assert.equal(report.policy.execution.requiredRuntime, 'cloudflare');
  assert.equal(visa.status, 'fetch_error');
  assert.equal(visa.reason, 'fetch failed');
  assert.ok(!Object.hasOwn(visa, 'text'));
  assert.ok(!Object.hasOwn(visa, 'html'));
});

test('source intake report keeps provenance without committing raw page content', () => {
  for (const source of report.sources) {
    assert.ok(source.sourceId);
    assert.ok(source.publisher);
    assert.ok(source.url.startsWith('https://'));
    assert.ok(source.status);
    assert.ok(Array.isArray(source.airportCodes));
    assert.ok(Array.isArray(source.loungeLinks));

    if (source.status === 'fetched') {
      assert.ok(source.finalUrl.startsWith('https://'));
      assert.ok(source.sha256);
      assert.ok(source.snapshotFile.startsWith('.cache/source-snapshots/'));
      assert.ok(!Object.hasOwn(source, 'text'));
      assert.ok(!Object.hasOwn(source, 'html'));
    }
  }
});

test('non-Priority Pass intake validates every candidate before approval', () => {
  assert.ok(candidates.length > 0);

  const sourceIds = new Set(candidates.flatMap((record) => record.sources.map((source) => source.sourceId)));
  assert.ok(sourceIds.has('chase-sapphire'));
  assert.ok(sourceIds.has('amex-global-lounge-collection'));
  assert.ok(sourceIds.has('capital-one'));
  assert.ok(sourceIds.has('oneworld'));
  assert.ok(sourceIds.has('air-canada'));
  assert.ok(sourceIds.has('airport-dimensions'));
  assert.ok(sourceIds.has('escape-lounges'));
  assert.ok(!sourceIds.has('priority-pass'));
  assert.ok(candidates.length >= 800);

  assert.equal(validationReport.rows.length, candidates.length);
  assert.ok(validationReport.stats.byStatus.verified_official_structured_payload >= 700);
  assert.ok(validationReport.stats.byStatus.airport_code_evidence_only > 0);
  assert.ok(validationReport.stats.byDecision.approved > 0);
  assert.ok(validationReport.stats.byDecision.review > 0);
  assert.equal(validationReport.policy.lineReviewRule.includes('reviewAction'), true);
  assert.ok(validationReport.stats.byReviewQueue.publishable > 0);
  assert.ok(validationReport.stats.byReviewQueue.official_airport_code_review > 0);
  assert.ok(validationReport.stats.byConflict.manual_review_required > 0);
  assert.ok(Array.isArray(validationReport.stats.bySourceDecision));
  assert.ok(validationReport.stats.bySourceDecision.length >= sourceIds.size);

  for (const record of candidates) {
    const row = validationReport.rows.find((candidateRow) => candidateRow.recordId === record.lounge.id);
    assert.ok(row);
    assert.equal(row.publisher, record.sources[0].publisher);
    assert.equal(row.airportName, record.airport.name);
    assert.equal(row.city, record.airport.city);
    assert.equal(row.country, record.airport.country);
    assert.equal(row.terminal, record.location.terminal);
    assert.ok(['publish', 'manual_review'].includes(row.reviewAction.action));
    assert.ok(row.reviewAction.queue);
    assert.ok(row.reviewAction.reason);

    if (record.quality.reviewStatus === 'approved') {
      assert.equal(record.sources[0].sourceId, 'oneworld');
      assert.equal(record.quality.conflicts.length, 0);
      assert.ok(record.sources[0].confidence >= 0.8);
      assert.equal(row.reviewAction.action, 'publish');
      assert.equal(row.reviewAction.queue, 'publishable');
    } else {
      assert.ok(record.quality.conflicts.includes('manual_review_required'));
      assert.equal(row.reviewAction.action, 'manual_review');
    }
    assert.ok(record.sources[0].url.startsWith('https://'));
    assert.match(record.lounge.id, /^candidate-/);
    assert.match(record.airport.iata, /^[A-Z0-9]{3}$/);
  }
});
