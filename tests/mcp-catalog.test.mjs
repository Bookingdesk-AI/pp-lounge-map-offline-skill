import test from 'node:test';
import assert from 'node:assert/strict';

import { getAllLounges, getCatalogMeta, getLoungeById, searchLounges } from '../mcp/catalog.js';

test('catalog metadata is present and sanitized', () => {
  const meta = getCatalogMeta();
  assert.ok(meta.generatedAt);
  assert.ok(meta.sourceFile.endsWith('.xlsx'));
  assert.ok(meta.stats.totalFeatures > 0);
  assert.doesNotMatch(JSON.stringify(meta), /\/Users\//u);
});

test('search_lounges paginates bounded results', () => {
  const result = searchLounges({ limit: 2 });
  assert.equal(result.results.length, 2);
  assert.ok(result.nextCursor);

  const secondPage = searchLounges({ limit: 2, cursor: result.nextCursor });
  assert.equal(secondPage.results.length, 2);
  assert.notEqual(secondPage.results[0].id, result.results[0].id);
});

test('search_lounges rejects unsupported filters', () => {
  assert.throws(
    () =>
      searchLounges({
        types: ['NOT_A_REAL_TYPE'],
      }),
    /Unsupported type filter/u,
  );
});

test('get_lounge returns a known lounge by stable id', () => {
  const known = getAllLounges()[0];
  const lounge = getLoungeById(known.id);
  assert.ok(lounge);
  assert.equal(lounge.id, known.id);
  assert.equal(typeof lounge.lat, 'number');
  assert.equal(typeof lounge.lon, 'number');
});
