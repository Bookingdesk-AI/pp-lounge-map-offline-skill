import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { parseAmexDeltaSkyClubAccessPolicy } from '../scripts/lib/amex-delta-sky-club-access.mjs';

test('Amex parser extracts eligibility-scoped Delta Sky Club visit pricing', () => {
  const policy = parseAmexDeltaSkyClubAccessPolicy(`
    <h1>Delta Sky Club Access</h1>
    <p>Once all 15 Visits have been used, Eligible Card Members may purchase additional Delta Sky Club Visits at a per-Visit rate of $50 per person.</p>
    <p>During a Visit, Eligible Card Members may bring either up to two (2) guests, or their immediate family at a per-Visit rate of $50 per person.</p>
    <p>Benefit valid only at Delta Sky Club. Partner lounges are not included.</p>
  `);

  assert.equal(policy?.product, 'delta-sky-club');
  assert.equal(policy?.offers[0].type, 'guest_fee');
  assert.equal(policy?.offers[0].amount, 50);
  assert.equal(policy?.offers[0].currency, 'USD');
});

test('Amex parser rejects incomplete or partner-inclusive policy text', () => {
  assert.equal(parseAmexDeltaSkyClubAccessPolicy('<p>Delta Sky Club access may be available.</p>'), null);
});

test('Amex policy prices only Delta Sky Club physical records', () => {
  const catalog = JSON.parse(
    fs.readFileSync(new URL('../public/data/lounge-guru-catalog.json', import.meta.url), 'utf8'),
  );
  const skyClubs = catalog.records.filter(
    (record) =>
      record.sources.some((source) => source.sourceId === 'delta') &&
      record.lounge.name === 'Delta Sky Club',
  );
  const deltaOne = catalog.records.filter(
    (record) =>
      record.sources.some((source) => source.sourceId === 'delta') &&
      record.lounge.name === 'Delta One Lounge',
  );
  const partners = catalog.records.filter(
    (record) =>
      record.sources.some((source) => source.sourceId === 'delta') &&
      !/^Delta (?:Sky Club|One Lounge)$/.test(record.lounge.name),
  );
  const hasDeltaPolicyOffer = (record) =>
    record.accessOffers.some(
      (offer) =>
        offer.sourceId === 'amex-global-lounge-collection' &&
        offer.label === 'Eligible guest or additional visit',
    );

  assert.ok(skyClubs.length >= 40);
  assert.ok(
    skyClubs.every((record) =>
      record.accessOffers.some(
        (offer) =>
          offer.sourceId === 'amex-global-lounge-collection' &&
          offer.label === 'Eligible guest or additional visit' &&
          offer.currency === 'USD' &&
          offer.amount === 50,
      ),
    ),
  );
  assert.ok(
    skyClubs.every((record) =>
      record.sources.some(
        (source) =>
          source.sourceId === 'amex-global-lounge-collection' &&
          source.fieldCoverage.includes('access.accessOffers'),
      ),
    ),
  );
  assert.ok(deltaOne.every((record) => !hasDeltaPolicyOffer(record)));
  assert.ok(partners.every((record) => !hasDeltaPolicyOffer(record)));
});
