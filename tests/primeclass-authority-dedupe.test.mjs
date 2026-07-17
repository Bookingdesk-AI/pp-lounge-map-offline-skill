import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const catalog = JSON.parse(fs.readFileSync(new URL('../public/data/lounge-guru-catalog.json', import.meta.url), 'utf8'));

function primeclassRows(airportCode) {
  return catalog.records.filter(
    (record) =>
      record.airport.iata === airportCode &&
      /primeclass|extime|condor|andes|lagos/i.test(
        [record.lounge.name, record.lounge.brand, record.lounge.operator].join(' '),
      ),
  );
}

function source(record, sourceId) {
  return record.sources.find((candidate) => candidate.sourceId === sourceId);
}

test('Primeclass authority consolidates domestic and international duplicates without mixing prices', () => {
  for (const [airportCode, domesticPrice, internationalPrice] of [
    ['ADB', 45, 55],
    ['BJV', 45, 65],
    ['ESB', 45, 55],
  ]) {
    const rows = primeclassRows(airportCode).filter((record) => !/comfort/i.test(record.lounge.name));
    const domestic = rows.find((record) => /domestic/i.test(record.location.terminal));
    const international = rows.find((record) => /international/i.test(record.location.terminal));
    assert.equal(rows.length, 2, `${airportCode} should keep two travel scopes`);
    assert.equal(domestic?.accessOffers[0]?.amount, domesticPrice);
    assert.equal(international?.accessOffers[0]?.amount, internationalPrice);
    assert.ok(source(domestic, 'primeclass'));
    assert.ok(source(international, 'primeclass'));
    assert.equal(domestic?.accessOffers.some((offer) => offer.amount === internationalPrice), false);
    assert.equal(international?.accessOffers.some((offer) => offer.amount === domesticPrice), false);
  }
});

test('Primeclass authority keeps arrival and VIP products separate', () => {
  const bus = primeclassRows('BUS');
  assert.equal(bus.length, 2);
  assert.equal(bus.filter((record) => /arrival/i.test(record.lounge.name)).length, 1);
  assert.equal(bus.find((record) => !/arrival/i.test(record.lounge.name))?.accessOffers[0]?.amount, 40);

  const mct = primeclassRows('MCT');
  assert.equal(mct.length, 2);
  assert.equal(mct.find((record) => !/arrival/i.test(record.lounge.name))?.accessOffers[0]?.amount, 57);
  assert.deepEqual(mct.find((record) => /arrival/i.test(record.lounge.name))?.accessOffers, []);

  const skp = primeclassRows('SKP');
  assert.equal(skp.length, 3);
  assert.equal(skp.filter((record) => /vip/i.test(record.lounge.name)).length, 2);
  assert.equal(skp.find((record) => !/vip/i.test(record.lounge.name))?.accessOffers[0]?.amount, 40);
});

test('Primeclass authority consolidates unique airport products with operator and booking provenance', () => {
  const expected = [
    ['DQM', 24],
    ['FCO', 49],
    ['MIR', 46],
    ['NBE', 46],
    ['OHD', 40],
    ['RIX', 55],
    ['TNR', 45],
    ['ZRH', 54],
  ];
  for (const [airportCode, price] of expected) {
    const rows = primeclassRows(airportCode);
    assert.equal(rows.length, 1, `${airportCode} should have one physical Primeclass product`);
    assert.equal(rows[0].accessOffers[0]?.amount, price);
    assert.ok(source(rows[0], 'primeclass'));
    assert.ok(source(rows[0], 'plaza-premium'));
  }
});

test('Primeclass authority preserves distinct named Santiago lounges', () => {
  const rows = primeclassRows('SCL');
  assert.equal(rows.length, 7);
  for (const name of ['LAGOS', 'Condor', 'Andes', 'DESIERTO', 'ISLA DE PASCUA', 'METROPOLIS', 'PATAGONIA']) {
    assert.equal(rows.filter((record) => new RegExp(name, 'i').test(record.lounge.name)).length, 1, name);
  }
});
