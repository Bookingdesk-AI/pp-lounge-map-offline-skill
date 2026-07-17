import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const catalog = JSON.parse(fs.readFileSync(new URL('../public/data/lounge-guru-catalog.json', import.meta.url), 'utf8'));

function recordsAt(airportCode, predicate) {
  return catalog.records.filter(
    (record) => record.airport.iata === airportCode && predicate(record),
  );
}

function sourceIds(record) {
  return new Set(record.sources.map((source) => source.sourceId));
}

test('Qatar Airways authority merge consolidates premium lounges across official sources', () => {
  for (const airportCode of ['BEY', 'BKK', 'LHR', 'SIN']) {
    const premiumLounges = recordsAt(
      airportCode,
      (record) => /qatar airways.*premium lounge/i.test(record.lounge.name),
    );
    assert.equal(premiumLounges.length, 1, `${airportCode} should have one Qatar Airways Premium Lounge`);
    assert.ok(sourceIds(premiumLounges[0]).has('qatar-airways'));
    assert.ok(sourceIds(premiumLounges[0]).has('oneworld'));
    assert.ok(premiumLounges[0].operations.hours);
  }

  const bkk = recordsAt('BKK', (record) => /qatar airways.*premium lounge/i.test(record.lounge.name))[0];
  assert.ok(sourceIds(bkk).has('airport-official-pages'));
  assert.equal(bkk.location.terminal, 'Concourse D');

  const sin = recordsAt('SIN', (record) => /qatar airways.*premium lounge/i.test(record.lounge.name))[0];
  assert.ok(sourceIds(sin).has('airport-official-pages'));
  assert.equal(sin.location.gate, 'Unit 03-05');
});

test('Qatar Airways authority merge keeps distinct DOH lounges and removes aggregate pages', () => {
  const aggregateNames = new Set([
    'Al Maha lounges',
    'First and Business Class Arrival Lounges',
    'Platinum and Gold Lounges',
  ]);
  assert.equal(
    recordsAt('DOH', (record) => aggregateNames.has(record.lounge.name)).length,
    0,
  );

  const garden = recordsAt('DOH', (record) => /al mourjan.*garden/i.test(record.lounge.name));
  assert.equal(garden.length, 1);
  assert.deepEqual(
    [...sourceIds(garden[0])].sort(),
    ['airport-official-pages', 'oneworld', 'qatar-airways'],
  );
  assert.ok(garden[0].operations.hours);

  const silver = recordsAt('DOH', (record) => /silver lounge/i.test(record.lounge.name));
  assert.equal(silver.length, 1);
  assert.deepEqual(
    [...sourceIds(silver[0])].sort(),
    ['airport-official-pages', 'oneworld', 'qatar-airways'],
  );
  assert.ok(silver[0].operations.hours);

  const mourjanSouth = recordsAt('DOH', (record) => /al mourjan.*south/i.test(record.lounge.name));
  assert.equal(mourjanSouth.length, 1);
  assert.ok(sourceIds(mourjanSouth[0]).has('airport-official-pages'));
  assert.ok(sourceIds(mourjanSouth[0]).has('oneworld'));
  assert.ok(sourceIds(mourjanSouth[0]).has('qatar-airways'));
});
