import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { getAllLounges, getCatalogMeta, getLoungeById, searchLounges } from '../mcp/catalog.js';

const publicCatalog = JSON.parse(
  fs.readFileSync(new URL('../public/data/lounge-guru-catalog.json', import.meta.url), 'utf8'),
);

test('catalog metadata is present and sanitized', () => {
  const meta = getCatalogMeta();
  assert.equal(meta.generatedAt, publicCatalog.generatedAt);
  assert.ok(meta.sourceFile.endsWith('.xlsx'));
  assert.ok(meta.stats.totalFeatures > 0);
  assert.equal(meta.stats.totalCatalogRecords, getAllLounges().length);
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
  const status = 'approved';

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

test('search_lounges exposes approved non-Priority Pass intake candidates', () => {
  const result = searchLounges({
    programs: ['Chase Sapphire Reserve'],
    reviewStatus: 'approved',
    limit: 10,
  });

  assert.ok(result.results.length > 0);
  for (const lounge of result.results) {
    assert.ok(lounge.id.startsWith('candidate-chase-sapphire-'));
    assert.ok(lounge.programs.includes('Chase Sapphire Reserve'));
    assert.equal(lounge.quality.reviewStatus, 'approved');
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

test('approved catalog records preserve airport normalization provenance', () => {
  const known = getAllLounges().find((lounge) => lounge.sources.some((source) => source.sourceId === 'priority-pass'));
  assert.ok(known);

  const sourceIds = new Set(known.sources.map((source) => source.sourceId));
  assert.ok(sourceIds.has('priority-pass'));
  assert.ok(sourceIds.has('ourairports'));

  const ourAirports = known.sources.find((source) => source.sourceId === 'ourairports');
  assert.ok(ourAirports);
  assert.ok(ourAirports.fieldCoverage.includes('airport.coordinates'));
  assert.match(ourAirports.rightsNote, /normalization/);
});
