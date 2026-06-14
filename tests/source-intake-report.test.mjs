import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const report = JSON.parse(fs.readFileSync(new URL('../public/data/source-intake-report.json', import.meta.url), 'utf8'));

test('source intake report records guarded public-source fetch policy', () => {
  assert.equal(report.policy.fetchMode, 'single_public_source_url_per_registry_entry');
  assert.equal(report.policy.rawSnapshotsCommitted, false);
  assert.match(report.policy.guardrail, /official\/public sources only/);
  assert.ok(report.stats.totalSources >= 15);
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
