import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const catalog = JSON.parse(fs.readFileSync(new URL('../public/data/lounge-guru-catalog.json', import.meta.url), 'utf8'));

test('Capital One authority keeps one current record per airport with official guest fees', () => {
  const expectations = new Map([
    ['DFW', 'Capital One Lounge'],
    ['DEN', 'Capital One Lounge'],
    ['IAD', 'Capital One Lounge'],
    ['LAS', 'Capital One Lounge'],
    ['JFK', 'Capital One Lounge'],
    ['DCA', 'Capital One Landing'],
    ['LGA', 'Capital One Landing'],
  ]);

  for (const [airportCode, name] of expectations) {
    const records = catalog.records.filter(
      (record) => record.airport.iata === airportCode && record.lounge.name === name,
    );
    assert.equal(records.length, 1, `${airportCode} should have one ${name}`);

    const adultFee = records[0].accessOffers.find((offer) => offer.label === 'Adult guest fee (18+)');
    const childFee = records[0].accessOffers.find((offer) => offer.label === 'Child guest fee (ages 2-17)');
    const standardVisit = records[0].accessOffers.find((offer) => offer.label === 'Standard visit');
    const policySource = records[0].sources.find(
      (source) => source.url === 'https://capitalonetravel.com/airport-lounges/lounge-access-guide/',
    );

    assert.equal(adultFee?.type, 'guest_fee');
    assert.equal(adultFee?.amount, 45);
    assert.equal(adultFee?.currency, 'USD');
    assert.equal(childFee?.amount, 25);
    assert.equal(standardVisit?.type, 'paid_entry');
    assert.equal(standardVisit?.amount, 90);
    assert.ok(policySource?.fieldCoverage.includes('access.accessOffers'));
  }
});
