import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createCanonicalCatalog,
  createCanonicalRecord,
} from '../scripts/lib/lounge-canonical.mjs';

const generatedAt = '2026-07-20T00:00:00.000Z';

function createFeature({ id, name, airportCode, hours = '', url }) {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [-1, 1],
    },
    properties: {
      id,
      name,
      airportCode,
      airportName: `${airportCode} Airport`,
      city: airportCode,
      country: 'United States',
      terminal: 'Terminal 1',
      location: 'Terminal 1',
      type: 'LOUNGE',
      openingHours: hours,
      facilities: ['Wi-Fi'],
      conditions: [],
      url,
    },
  };
}

test('official location hours never cross airport or lounge identity', () => {
  const target = createFeature({
    id: 'target',
    name: 'Target Lounge',
    airportCode: 'AAA',
    url: 'https://www.prioritypass.com/example',
  });
  const unrelatedEvidence = createCanonicalRecord(
    createFeature({
      id: 'unrelated-delta',
      name: 'Unrelated Delta Sky Club',
      airportCode: 'BBB',
      hours: '06:00 - 22:00',
      url: 'https://www.delta.com/example',
    }),
    {
      sourceId: 'delta',
      publisher: 'Delta Air Lines',
      generatedAt,
    },
  );

  const catalog = createCanonicalCatalog({
    features: [target],
    additionalRecords: [unrelatedEvidence],
    meta: {
      generatedAt,
      sourceFile: 'fixture',
      stats: {},
      filters: {},
    },
  });
  const result = catalog.records.find((record) => record.lounge.id === 'target');

  assert.ok(result);
  assert.equal(result.operations.hours, '');
  assert.equal(result.sources.some((source) => source.sourceId === 'delta'), false);
  assert.equal(
    result.notes.includes('Official location page supplied missing field evidence.'),
    false,
  );
});
