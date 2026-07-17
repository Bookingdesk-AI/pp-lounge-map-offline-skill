import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyCapitalOneGuestPolicy,
  parseCapitalOneGuestPolicy,
  parseCapitalOneLoungeRecords,
} from '../scripts/lib/capital-one-structured.mjs';

const overviewHtml = `
  <h2>Which airports have a Capital One Lounge?</h2>
  <p>You can visit Capital One Lounge locations at these airports:
  Dallas-Fort Worth (DFW) : Located in Terminal D near Gate D22. Open daily from 5 a.m. to 10 p.m.
  Denver (DEN) : Located in Concourse A near Gate 34 on the mezzanine level. Open daily from 5 a.m. to 9 p.m.
  Washington Dulles (IAD) : Located in the Main Terminal after the TSA PreCheck® and Clear security checkpoints. Open daily from 5:30 a.m. to 9 p.m.
  Las Vegas (LAS) : Located in the Concourse D Atrium on the 2nd level near Gate D50. Open daily from 5 a.m. to 11 p.m.
  New York City (JFK) : Located on Level 3 in the Retail Hall of Terminal 4 near the B Gates. Open 24 hours.
  Charlotte (CLT): Scheduled for arrival.</p>
  <h2>Which airports have a Capital One Landing?</h2>
  <p>You can visit Capital One Landing locations at these airports:
  Washington, D.C. (DCA) : Located in Terminal 2 in the National Hall near Concourse D. Open daily from 6 a.m. to 9 p.m.
  New York City (LGA) : Located in Terminal B on the bridge to gates 11-31. Open daily from 5 a.m. to 10 p.m.</p>
  <h2>Capital One Lounge amenities</h2>
`;

test('Capital One parser extracts active Lounge and Landing locations from official overview text', () => {
  const records = parseCapitalOneLoungeRecords(overviewHtml, {
    url: 'https://www.capitalone.com/learn-grow/more-than-money/capital-one-lounges-arriving-in-airports/',
  });

  assert.equal(records.length, 7);
  assert.deepEqual(
    records.map((record) => record.airportCode).sort(),
    ['DCA', 'DEN', 'DFW', 'IAD', 'JFK', 'LAS', 'LGA'],
  );

  const dfw = records.find((record) => record.airportCode === 'DFW');
  assert.equal(dfw.name, 'Capital One Lounge');
  assert.equal(dfw.terminal, 'Terminal D');
  assert.equal(dfw.near, 'Located in Terminal D near Gate D22');
  assert.equal(dfw.hoursText, 'Open daily from 5 a.m. to 10 p.m.');
  assert.deepEqual(dfw.programs, ['Capital One Venture X', 'Capital One Venture X Business']);

  const jfk = records.find((record) => record.airportCode === 'JFK');
  assert.equal(jfk.terminal, 'Terminal 4');
  assert.equal(jfk.near, 'Located on Level 3 in the Retail Hall of Terminal 4 near the B Gates');
  assert.equal(jfk.hoursText, 'Open 24 hours.');

  const lga = records.find((record) => record.airportCode === 'LGA');
  assert.equal(lga.name, 'Capital One Landing');
  assert.equal(lga.brand, 'Capital One Landing');
  assert.equal(lga.terminal, 'Terminal B');
  assert.equal(lga.near, 'Located in Terminal B on the bridge to gates 11-31');

  assert.equal(records.some((record) => record.airportCode === 'CLT'), false);
  assert.equal(records.some((record) => record.prices), false);
});

test('Capital One parser ignores pages without the official location sections', () => {
  assert.deepEqual(parseCapitalOneLoungeRecords('<p>Capital One Travel</p>'), []);
});

test('Capital One parser scopes official guest fees to current Lounge and Landing locations', () => {
  const policyUrl = 'https://capitalonetravel.com/airport-lounges/lounge-access-guide/';
  const policy = parseCapitalOneGuestPolicy(`
    <h2>Capital One Lounges &amp; Landings</h2>
    <h3>Pay-per-visit</h3>
    <p>Venture X cardholders can purchase passes for guests to Capital One Lounges and Landings at discounted rates of $45 per visit per guest 18 and older, and $25 per visit per guest 17 and under. Children under two are free.</p>
    <p>Capital One Lounge and Landing locations are open to all guests at the standard rate of $90 per guest per visit.</p>
  `, { url: policyUrl });

  assert.equal(policy?.offers[0].amount, 45);
  assert.equal(policy?.offers[1].label, 'Child guest fee (ages 2-17)');
  assert.equal(policy?.offers[1].sourceUrl, policyUrl);
  assert.deepEqual(policy?.offers[2], {
    type: 'paid_entry',
    label: 'Standard visit',
    amount: 90,
    currency: 'USD',
    sourceUrl: policyUrl,
  });

  const records = applyCapitalOneGuestPolicy(parseCapitalOneLoungeRecords(overviewHtml), policy);
  assert.equal(records.length, 7);
  assert.ok(records.every((record) => record.prices?.length === 3));
  assert.ok(records.every((record) => record.prices[0].type === 'guest_fee'));

  const unrelated = applyCapitalOneGuestPolicy([
    { airportCode: 'CLT', name: 'Capital One Lounge', brand: 'Capital One Lounge' },
    { airportCode: 'DFW', name: 'Partner Lounge', brand: 'Partner Lounge' },
  ], policy);
  assert.ok(unrelated.every((record) => record.prices === undefined));
});

test('Capital One policy parser rejects incomplete or ambiguous fee text', () => {
  assert.equal(parseCapitalOneGuestPolicy('<p>Capital One Lounges &amp; Landings</p>'), null);
  assert.equal(
    parseCapitalOneGuestPolicy('<h2>Capital One Lounges &amp; Landings</h2><h3>Pay-per-visit</h3><p>Fees may apply.</p>'),
    null,
  );
});
