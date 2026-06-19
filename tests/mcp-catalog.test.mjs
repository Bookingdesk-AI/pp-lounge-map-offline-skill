import test from 'node:test';
import assert from 'node:assert/strict';

import { getAllLounges, getCatalogMeta, getLoungeById, searchLounges } from '../mcp/catalog.js';

test('catalog metadata is present and sanitized', () => {
  const meta = getCatalogMeta();
  assert.ok(meta.generatedAt);
  assert.ok(meta.sourceFile.endsWith('.xlsx'));
  assert.ok(meta.stats.totalFeatures > 0);
  assert.ok(meta.schema.version);
  assert.ok(meta.stats.totalSources > 0);
  assert.ok(meta.quality.averageCompleteness > 0);
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

test('search_lounges supports provider, program, and review-status filters', () => {
  const provider = 'Chase Sapphire Lounge by The Club';
  const program = 'Chase Sapphire Reserve';
  const status = 'review';

  const result = searchLounges({
    providers: [provider],
    programs: [program],
    reviewStatus: status,
    limit: 5,
  });

  assert.ok(result.results.length > 0);
  for (const lounge of result.results) {
    assert.equal(lounge.provider, provider);
    assert.ok(lounge.programs.includes(program));
    assert.equal(lounge.quality.reviewStatus, status);
  }
});

test('search_lounges exposes non-Priority Pass intake candidates for review', () => {
  const result = searchLounges({
    programs: ['Chase Sapphire Reserve'],
    reviewStatus: 'review',
    limit: 10,
  });

  assert.ok(result.results.length > 0);
  for (const lounge of result.results) {
    assert.ok(lounge.id.startsWith('candidate-chase-sapphire-'));
    assert.ok(lounge.programs.includes('Chase Sapphire Reserve'));
    assert.equal(lounge.quality.reviewStatus, 'review');
  }
});

test('catalog metadata counts non-Priority Pass candidate intake', () => {
  const meta = getCatalogMeta();
  assert.ok(meta.stats.totalCatalogRecords > meta.stats.totalFeatures);
  assert.ok(meta.stats.nonPriorityRecords > 0);
  assert.ok(meta.filters.programs.includes('American Express Platinum'));
  assert.ok(meta.filters.programs.includes('Capital One Venture X'));
});

test('get_lounge returns a known lounge by stable id', () => {
  const known = getAllLounges()[0];
  const lounge = getLoungeById(known.id);
  assert.ok(lounge);
  assert.equal(lounge.id, known.id);
  assert.equal(typeof lounge.lat, 'number');
  assert.equal(typeof lounge.lon, 'number');
  assert.ok(lounge.sources.length > 0);
  assert.ok(lounge.canonical);
});
