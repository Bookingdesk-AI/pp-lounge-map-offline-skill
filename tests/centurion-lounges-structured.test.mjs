import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyCenturionGuestPolicy,
  parseCenturionGuestPolicy,
  parseCenturionLoungeRecord,
} from '../scripts/lib/centurion-lounges-structured.mjs';

const html = `
<h1>Seattle-Tacoma</h1>
<div><div>Terminal</div><div><div>CEN</div><div>Central Terminal</div></div></div>
<div class="tw-prose tw-max-w-none">
  <p>The lounge is located on the mezzanine level in the Central Terminal, above the food court.</p>
  <p>Hours: 5:00am - 10:00pm</p>
</div>`;

test('parses Centurion Lounge location and hours', () => {
  const record = parseCenturionLoungeRecord(html, {
    url: 'https://thecenturionlounge.com/locations/sea/',
  });

  assert.equal(record?.airportCode, 'SEA');
  assert.equal(record?.terminal, 'Central Terminal');
  assert.match(record?.near ?? '', /mezzanine level/);
  assert.equal(record?.openHours[0].OpeningHour, '05:00');
  assert.equal(record?.openHours[0].ClosingHour, '22:00');
  assert.equal(record?.sourceUrl, 'https://thecenturionlounge.com/locations/sea/');
});

test('parses current Centurion Lounge detail-page text contract', () => {
  const record = parseCenturionLoungeRecord(`
    <h1>Dallas Fort Worth</h1>
    <main>
      <div>Find &amp; Visit</div>
      <div>Terminal</div><div>D</div>
      <div>Across from Gate D12</div>
      <p>The Lounge is located in Terminal D, across from Gate D12. The Lounge can be reached from any other terminal via the Skylink train.</p>
      <p>Hours: 5:30 am - 10:00 pm</p>
    </main>
  `, {
    url: 'https://www.thecenturionlounge.com/locations/dfw/',
  });

  assert.equal(record?.airportCode, 'DFW');
  assert.equal(record?.terminal, 'Terminal D');
  assert.match(record?.near ?? '', /Gate D12/);
  assert.equal(record?.openHours[0].OpeningHour, '05:30');
  assert.equal(record?.openHours[0].ClosingHour, '22:00');
});

test('maps Centurion Sidecar URL to the parent airport code', () => {
  const record = parseCenturionLoungeRecord(`
    <h1>Las Vegas - Sidecar</h1>
    <main>
      <div>Terminal 1</div>
      <p>The Lounge is located in Terminal 1, near Gate D1.</p>
      <p>Hours: 6:00 am - 9:00 pm</p>
    </main>
  `, {
    url: 'https://www.thecenturionlounge.com/locations/las-sidecar/',
  });

  assert.equal(record?.airportCode, 'LAS');
  assert.equal(record?.name, 'Sidecar by The Centurion Lounge');
  assert.equal(record?.sourceRecordId, 'centurion-las-sidecar');
});

test('preserves Centurion Lounge weekend-specific hours', () => {
  const record = parseCenturionLoungeRecord(`
    <h1>Ronald Reagan Washington National</h1>
    <main>
      <div>Find &amp; Visit</div>
      <div>Terminal 2</div>
      <p>The lounge is located in Terminal 2 on Level 2, before the entrance to the B gates.</p>
      <p>Hours: 5 am - 9 pm Sun-Fri, 5 am - 7 pm Sat</p>
    </main>
  `, {
    url: 'https://www.thecenturionlounge.com/locations/dca/',
  });

  assert.equal(record?.openHours.find((row) => row.Day === 6)?.ClosingHour, '19:00');
  assert.equal(record?.openHours.find((row) => row.Day === 0)?.ClosingHour, '21:00');
});

test('parses and scopes official Centurion guest fees by location', () => {
  const policy = parseCenturionGuestPolicy(`
    <p>U.S. Consumer Platinum Card and U.S. Business Platinum Card Members:</p>
    <ul>
      <li>$50 fee for each guest 18 and over at U.S. Centurion Lounges (£35,00 per guest at the London Centurion Lounge, HKD 380 per guest at the Hong Kong Centurion Lounge, and JPY 8,300 per guest at the Tokyo Centurion Lounge)</li>
      <li>$30 for children aged 2-17 at U.S. Centurion Lounges (£24,00 per child at the London Centurion Lounge, HKD 230 per child at the Hong Kong Centurion Lounge, and JPY 5,000 per child at the Tokyo Centurion Lounge).</li>
    </ul>
    <p>The above guest policies apply to all Centurion Lounges located in the United States, London, Hong Kong, and Tokyo, including Sidecar by The Centurion Lounge.</p>
  `);

  assert.equal(policy?.offersByRegion.us[0].amount, 50);
  assert.equal(policy?.offersByRegion.london[0].currency, 'GBP');
  assert.equal(policy?.offersByRegion['hong-kong'][1].amount, 230);
  assert.equal(policy?.offersByRegion.tokyo[0].amount, 8300);

  const records = applyCenturionGuestPolicy([
    { airportCode: 'DFW', accessNotes: 'Location evidence.' },
    { airportCode: 'LHR', accessNotes: 'Location evidence.' },
    { airportCode: 'HKG', accessNotes: 'Location evidence.' },
    { airportCode: 'HND', accessNotes: 'Location evidence.' },
    { airportCode: 'DEL', accessNotes: 'Location evidence.' },
  ], policy);
  assert.equal(records[0].prices[0].currency, 'USD');
  assert.equal(records[1].prices[0].amount, 35);
  assert.equal(records[2].prices[0].currency, 'HKD');
  assert.equal(records[3].prices[1].amount, 5000);
  assert.equal(records[4].prices, undefined);
});
