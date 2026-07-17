import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  applyOfficialAirlineHoursEvidence,
  validateOfficialAirlineHoursEvidence,
} from '../scripts/lib/official-airline-hours-evidence.mjs';
import { cloneSourceRegistry } from '../scripts/lib/source-registry.mjs';

const evidence = JSON.parse(
  fs.readFileSync(new URL('../data/official-airline-hours-evidence.json', import.meta.url), 'utf8'),
);
const catalog = JSON.parse(
  fs.readFileSync(new URL('../public/data/lounge-guru-catalog.json', import.meta.url), 'utf8'),
);

test('official airline hours evidence is complete and uses registered official sources', () => {
  assert.deepEqual(validateOfficialAirlineHoursEvidence(evidence), []);
  assert.equal(evidence.records.length, 10);

  const registry = new Map(cloneSourceRegistry().map((source) => [source.id, source]));
  for (const row of evidence.records) {
    const source = registry.get(row.sourceId);
    assert.ok(source, `${row.sourceId} must exist in the source registry`);
    assert.equal(source.adapter, 'manual_review');
    assert.equal(source.status, 'active');
    assert.match(row.url, /^https:\/\//);
    assert.ok(row.rightsNote.includes('Official public'));
  }
});

test('official airline hours evidence promotes only guarded target records', () => {
  const row = evidence.records[0];
  const input = [{
    lounge: { id: row.targetRecordId, name: row.expectedName },
    airport: { iata: row.airportCode },
    location: { terminal: row.expectedTerminal, gate: 'Lounge Level' },
    operations: { hours: '', lastVerifiedAt: '2026-07-01T00:00:00.000Z' },
    notes: [],
    sources: [],
  }];

  const [record] = applyOfficialAirlineHoursEvidence(input, {
    ...evidence,
    records: [row],
  });

  assert.equal(record.operations.hours, row.hours);
  assert.equal(record.operations.lastVerifiedAt, row.retrievedAt);
  assert.deepEqual(record.sources[0].fieldCoverage, ['operations.hours']);
  assert.equal(record.sources[0].url, row.url);
});

test('official airline hours evidence rejects identity and hour conflicts', () => {
  const row = evidence.records[0];
  const base = {
    lounge: { id: row.targetRecordId, name: row.expectedName },
    airport: { iata: row.airportCode },
    location: { terminal: row.expectedTerminal, gate: '' },
    operations: { hours: '', lastVerifiedAt: '' },
    notes: [],
    sources: [],
  };
  const singleEvidence = { ...evidence, records: [row] };

  assert.throws(
    () => applyOfficialAirlineHoursEvidence([{ ...base, lounge: { ...base.lounge, name: 'Wrong lounge' } }], singleEvidence),
    /lounge mismatch/,
  );
  assert.throws(
    () => applyOfficialAirlineHoursEvidence([{ ...base, operations: { ...base.operations, hours: 'Daily 00:00-01:00' } }], singleEvidence),
    /hours conflict/,
  );
});

test('canonical catalog retains all ten official airline hours promotions with provenance', () => {
  for (const row of evidence.records) {
    const record = catalog.records.find((candidate) => candidate.lounge.id === row.targetRecordId);
    assert.ok(record, `${row.targetRecordId} must remain in the canonical catalog`);
    assert.equal(record.operations.hours, row.hours);
    const source = record.sources.find((candidate) => candidate.sourceId === row.sourceId);
    assert.ok(source, `${row.targetRecordId} must retain ${row.sourceId} provenance`);
    assert.ok(source.fieldCoverage.includes('operations.hours'));
    assert.equal(source.url, row.url);
    assert.equal(source.retrievedAt, row.retrievedAt);
    assert.equal(source.rightsNote, row.rightsNote);
  }
});
