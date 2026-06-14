import test from 'node:test';
import assert from 'node:assert/strict';

import offlineCatalogData from '../skills/lounge-guru-offline/assets/catalog.json' with { type: 'json' };

import { createCatalogStore } from '../mcp/catalog-core.js';
import { getCatalogMeta, getLoungeById, searchLounges } from '../mcp/catalog.js';

const offlineStore = createCatalogStore(offlineCatalogData);

test('offline snapshot metadata matches the online catalog source', () => {
  const offlineMeta = offlineStore.getCatalogMeta();
  const onlineMeta = getCatalogMeta();

  assert.equal(offlineMeta.generatedAt, onlineMeta.generatedAt);
  assert.deepEqual(offlineMeta.stats, onlineMeta.stats);
  assert.deepEqual(offlineMeta.filters, onlineMeta.filters);
  assert.equal(offlineMeta.sourceFile, 'offline-snapshot');
});

test('offline snapshot rebuilds search index and preserves lounge lookup', () => {
  const onlineFirst = searchLounges({ limit: 1 }).results[0];
  const offlineLounge = offlineStore.getLoungeById(onlineFirst.id);

  assert.ok(offlineLounge);
  assert.equal(offlineLounge.id, onlineFirst.id);
  assert.equal(typeof offlineLounge.name, 'string');
  assert.ok(offlineStore.searchLounges({ airportCode: onlineFirst.airportCode, limit: 1 }).results.length > 0);
});

test('offline search parity matches online results for representative queries', () => {
  const supportedFacility = getCatalogMeta().filters.facilities[0];
  const cases = [
    { query: 'singapore', limit: 3 },
    { airportCode: 'LHR', limit: 3 },
    { facilities: [supportedFacility], limit: 3 },
    { city: 'Tokyo', types: ['LOUNGE'], limit: 3 },
  ];

  for (const input of cases) {
    const online = searchLounges(input);
    const offline = offlineStore.searchLounges(input);

    assert.equal(offline.totalMatches, online.totalMatches);
    assert.deepEqual(
      offline.results.map((lounge) => lounge.id),
      online.results.map((lounge) => lounge.id),
    );
  }
});

test('offline asset remains within the publish size budget', () => {
  const serialized = JSON.stringify(offlineCatalogData);
  assert.ok(Buffer.byteLength(serialized) < 5 * 1024 * 1024);
});

test('offline and online detail payloads preserve source and quality fields', () => {
  const target = searchLounges({ airportCode: 'SIN', limit: 1 }).results[0];
  const onlineLounge = getLoungeById(target.id);
  const offlineLounge = offlineStore.getLoungeById(target.id);

  assert.equal(offlineLounge.id, onlineLounge.id);
  assert.equal(offlineLounge.provider, onlineLounge.provider);
  assert.deepEqual(offlineLounge.programs, onlineLounge.programs);
  assert.deepEqual(offlineLounge.quality, onlineLounge.quality);
  assert.deepEqual(offlineLounge.sources, onlineLounge.sources);
  assert.equal(offlineLounge.canonical, undefined);
});
