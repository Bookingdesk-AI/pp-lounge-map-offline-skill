import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const report = JSON.parse(fs.readFileSync(new URL('../public/data/source-intake-report.json', import.meta.url), 'utf8'));
const candidates = JSON.parse(
  fs.readFileSync(new URL('../public/data/non-priority-lounge-candidates.json', import.meta.url), 'utf8'),
);
const validationReport = JSON.parse(
  fs.readFileSync(new URL('../public/data/non-priority-validation-report.json', import.meta.url), 'utf8'),
);

test('source intake report records guarded public-source fetch policy', () => {
  assert.equal(report.policy.fetchMode, 'single_public_source_url_per_registry_entry');
  assert.equal(report.policy.childFetchMode, 'bounded_lounge_link_crawl');
  assert.ok(report.policy.childPageLimit > 0);
  assert.equal(report.policy.rawSnapshotsCommitted, false);
  assert.match(report.policy.guardrail, /official\/public sources only/);
  assert.ok(report.stats.totalSources >= 15);
  assert.ok(report.stats.childPagesFetched > 0);
  assert.ok(report.stats.knownAirportCodes > 1000);
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

  for (const record of candidates) {
    if (record.quality.reviewStatus === 'approved') {
      assert.equal(record.sources[0].sourceId, 'oneworld');
      assert.equal(record.quality.conflicts.length, 0);
      assert.ok(record.sources[0].confidence >= 0.8);
    } else {
      assert.ok(record.quality.conflicts.includes('manual_review_required'));
    }
    assert.ok(record.sources[0].url.startsWith('https://'));
    assert.match(record.lounge.id, /^candidate-/);
    assert.match(record.airport.iata, /^[A-Z0-9]{3}$/);
  }
});
