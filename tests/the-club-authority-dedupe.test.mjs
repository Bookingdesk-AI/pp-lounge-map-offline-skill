import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const catalog = JSON.parse(fs.readFileSync(new URL('../public/data/lounge-guru-catalog.json', import.meta.url), 'utf8'));

function clubRows(airportCode) {
  return catalog.records.filter(
    (record) =>
      record.airport.iata === airportCode &&
      /\bthe club\b|\bthe lounge boston\b|\bkyra lounge\b/i.test(record.lounge.name),
  );
}

function source(record, sourceId) {
  return record.sources.find((candidate) => candidate.sourceId === sourceId);
}

test('Airport Dimensions authority consolidates exact The Club physical lounge identities', () => {
  for (const airportCode of ['ATL', 'BUF', 'BWI', 'CHS', 'CLE', 'CLT', 'CVG', 'MSY', 'PIT']) {
    const rows = clubRows(airportCode).filter((record) => source(record, 'airport-dimensions'));
    assert.equal(rows.length, 1, `${airportCode} should have one current Airport Dimensions lounge`);
    assert.ok(rows[0].accessOffers.length > 0, `${airportCode} should retain official Club Pass prices`);
  }

  const atl = clubRows('ATL').find((record) => source(record, 'airport-dimensions'));
  assert.ok(source(atl, 'priority-pass'));
  assert.ok(source(atl, 'oneworld'));
  assert.ok(source(atl, 'no1-lounges'));
  assert.equal(atl.location.terminal, 'Concourse F');
  assert.equal(atl.location.gate, 'Mezzanine Level');
});

test('Airport Dimensions authority keeps SEA concourses and SJC gates distinct', () => {
  const sea = clubRows('SEA').filter((record) => source(record, 'airport-dimensions'));
  assert.equal(sea.length, 2);
  assert.deepEqual(new Set(sea.map((record) => record.location.gate)), new Set(['Gate A11', 'Gate S9']));
  assert.ok(sea.every((record) => record.accessOffers.length > 0));

  const sjc = clubRows('SJC').filter((record) => source(record, 'airport-dimensions'));
  assert.equal(sjc.length, 2);
  assert.deepEqual(new Set(sjc.map((record) => record.location.gate)), new Set(['Gate A15', 'Gate A8']));
});

test('Airport Dimensions authority preserves MCO and LIM travel scopes', () => {
  const mco = clubRows('MCO').filter((record) => source(record, 'airport-dimensions'));
  assert.equal(mco.length, 1);
  assert.equal(mco[0].location.gate, 'Gate 91');
  assert.ok(source(mco[0], 'priority-pass'));

  const lim = clubRows('LIM').filter((record) => source(record, 'airport-dimensions'));
  assert.equal(lim.length, 2);
  const domestic = lim.find((record) => /domestic/i.test(record.location.terminal));
  const international = lim.find((record) => /international/i.test(record.location.terminal));
  assert.ok(domestic);
  assert.deepEqual(domestic.accessOffers, []);
  assert.ok(international);
  assert.ok(international.accessOffers.length > 0);
  assert.ok(source(international, 'priority-pass'));
});

test('Airport Dimensions authority excludes stale redirects and Chase products', () => {
  assert.equal(clubRows('LGW').some((record) => source(record, 'airport-dimensions')), false);
  assert.equal(clubRows('LHR').some((record) => source(record, 'airport-dimensions')), false);

  const chase = catalog.records.find(
    (record) => record.airport.iata === 'BOS' && /Chase Sapphire Lounge by The Club/i.test(record.lounge.name),
  );
  assert.ok(chase);
  assert.equal(Boolean(source(chase, 'airport-dimensions')), false);

  const boston = clubRows('BOS').find((record) => /The Lounge Boston/i.test(record.lounge.name));
  assert.ok(source(boston, 'airport-dimensions'));
});

test('Airport Dimensions Kyra authority does not absorb Taste of Priceless', () => {
  const kyra = clubRows('HKG').filter((record) => source(record, 'airport-dimensions'));
  assert.equal(kyra.length, 1);
  assert.ok(source(kyra[0], 'priority-pass'));
  assert.equal(/Taste of Priceless/i.test(kyra[0].lounge.name), false);
  assert.ok(catalog.records.some((record) => record.airport.iata === 'HKG' && /Taste of Priceless/i.test(record.lounge.name)));
});
