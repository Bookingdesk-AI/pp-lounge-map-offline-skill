import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const catalog = JSON.parse(fs.readFileSync(new URL('../public/data/lounge-guru-catalog.json', import.meta.url), 'utf8'));

test('Centurion operator evidence consolidates airport duplicates and keeps Sidecar distinct', () => {
  for (const airportCode of ['DFW', 'HKG', 'HND', 'LGA', 'MIA', 'PHL', 'SFO']) {
    const records = catalog.records.filter(
      (record) =>
        record.airport.iata === airportCode &&
        /centurion/i.test([record.lounge.name, record.lounge.brand, record.lounge.operator].join(' ')) &&
        !/sidecar/i.test(record.lounge.name),
    );
    assert.equal(records.length, 1, `${airportCode} should have one Centurion Lounge`);
    assert.ok(records[0].sources.some((source) => source.sourceId === 'amex-global-lounge-collection'));
    assert.ok(records[0].operations.hours);
  }

  const dfw = catalog.records.find(
    (record) => record.airport.iata === 'DFW' && /centurion/i.test(record.lounge.name),
  );
  assert.equal(dfw?.location.gate, 'Gate D12');
  assert.ok(dfw?.sources.some((source) => source.sourceId === 'airport-official-pages'));

  const las = catalog.records.filter(
    (record) => record.airport.iata === 'LAS' && /centurion|sidecar/i.test(record.lounge.name),
  );
  assert.equal(las.length, 2);
  assert.ok(las.some((record) => /sidecar/i.test(record.lounge.name)));
});

test('Centurion authority preserves official location-scoped guest fees', () => {
  const expectations = [
    ['DFW', 'USD', 50],
    ['LHR', 'GBP', 35],
    ['HKG', 'HKD', 380],
    ['HND', 'JPY', 8300],
  ];
  for (const [airportCode, currency, amount] of expectations) {
    const record = catalog.records.find(
      (candidate) => candidate.airport.iata === airportCode && /centurion/i.test(candidate.lounge.name),
    );
    const offer = record?.accessOffers.find((candidate) => candidate.label === 'Adult guest fee (18+)');
    const policySource = record?.sources.find(
      (source) => source.url === 'https://www.thecenturionlounge.com/info/access/',
    );

    assert.equal(offer?.type, 'guest_fee');
    assert.equal(offer?.currency, currency);
    assert.equal(offer?.amount, amount);
    assert.ok(policySource?.fieldCoverage.includes('access.accessOffers'));
  }

  const sidecar = catalog.records.find((record) => /sidecar/i.test(record.lounge.name));
  assert.equal(sidecar?.accessOffers.find((offer) => offer.label === 'Adult guest fee (18+)')?.amount, 50);
});
