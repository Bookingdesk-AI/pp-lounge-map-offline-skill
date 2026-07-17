import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { parsePriorityPassStandardAccessPolicy } from '../scripts/lib/priority-pass-access.mjs';

test('Priority Pass parser extracts Standard plan member and guest visit fees', () => {
  const policy = parsePriorityPassStandardAccessPolicy(`
    <h1>Airport Lounge Membership Plans</h1>
    <section>
      <h2>STANDARD</h2>
      <p>For the occasional traveller</p>
      <p>US$35 Member visit fee</p>
      <p>US$35 Guest visit fee</p>
    </section>
    <section><h2>STANDARD PLUS</h2></section>
    <p>Access to lounges is subject to space availability.</p>
  `);

  assert.equal(policy?.product, 'priority-pass-lounge-access');
  assert.deepEqual(
    policy?.offers.map((offer) => [offer.type, offer.amount, offer.currency]),
    [
      ['member_visit_fee', 35, 'USD'],
      ['guest_fee', 35, 'USD'],
    ],
  );
});

test('Priority Pass parser rejects incomplete or unscoped pricing text', () => {
  assert.equal(parsePriorityPassStandardAccessPolicy('<p>Membership from US$99.</p>'), null);
});

test('Priority Pass Standard pricing applies only to active lounge records', () => {
  const catalog = JSON.parse(
    fs.readFileSync(new URL('../public/data/lounge-guru-catalog.json', import.meta.url), 'utf8'),
  );
  const eligible = catalog.records.filter(
    (record) =>
      record.lounge.status === 'active' &&
      record.lounge.category === 'lounge' &&
      record.sources.some((source) => source.sourceId === 'priority-pass'),
  );
  const ineligible = catalog.records.filter(
    (record) =>
      record.sources.some((source) => source.sourceId === 'priority-pass') &&
      (record.lounge.status !== 'active' || record.lounge.category !== 'lounge'),
  );
  const policyOffer = (record) =>
    record.accessOffers.find(
      (offer) => offer.sourceId === 'priority-pass' && offer.label === 'Standard plan member visit',
    );

  assert.ok(eligible.length >= 1300);
  assert.ok(eligible.every((record) => policyOffer(record)?.amount === 35));
  assert.ok(
    eligible.every((record) =>
      record.sources.some(
        (source) =>
          source.sourceId === 'priority-pass' &&
          source.url.includes('/join-prioritypass') &&
          source.fieldCoverage.includes('access.accessOffers'),
      ),
    ),
  );
  assert.ok(ineligible.every((record) => !policyOffer(record)));
});
