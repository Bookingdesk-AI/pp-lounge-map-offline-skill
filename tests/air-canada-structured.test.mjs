import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mergeAirCanadaLoungeDetailRecords,
  parseAirCanadaLoungeDetailRecords,
  parseAirCanadaLoungeRecords,
} from '../scripts/lib/air-canada-structured.mjs';

test('Air Canada parser extracts Chase-participating locations with regional guest fees', () => {
  const records = parseAirCanadaLoungeRecords(
    `
    <span class="accordion-title-text">Chase Sapphire Reserve/Reserve for Business and J. P. Morgan Reserve Members</span>
    <div>
      <p><strong>Additional guests</strong></p>
      <p>Additional guests may be invited for a rate of:</p>
      <ul><li>59.00 CAD, for locations within Canada</li></ul>
      <ul><li>59.00 USD for locations within the U.S.</li></ul>
      <ul><li>59.00 EUR for locations within the E.U., and</li></ul>
      <ul><li>59.00 GBP for locations within the U.K.</li></ul>
      <p><strong>Participating locations (subject to change):</strong></p>
      <p><strong>United States </strong></p>
      <ul>
        <li>Los Angeles (LAX) – Air Canada Maple Leaf Lounge, Terminal 6</li>
        <li>New York LaGuardia (LGA) – Air Canada Maple Leaf Lounge, Terminal B Eastern Concourse</li>
      </ul>
      <p><strong>Europe</strong></p>
      <ul>
        <li>Frankfurt (FRA) – Air Canada Maple Leaf Lounge</li>
        <li>London Heathrow (LHR) – Air Canada Maple Leaf Lounge</li>
      </ul>
      <p><strong>Canada</strong></p>
      <ul>
        <li>Halifax (YHZ) – Air Canada Maple Leaf Lounge <strong>(TEMPORARILY CLOSED)</strong></li>
        <li>Toronto Pearson (YYZ)
          <ul>
            <li>Domestic departures – Air Canada Maple Leaf Lounge and Air Canada Café</li>
            <li>U.S. departures – Air Canada Maple Leaf Lounge and Air Canada Maple Leaf Lounge Express</li>
            <li>International departures – Air Canada Maple Leaf Lounge (excludes Air Canada Signature Suite)</li>
          </ul>
        </li>
      </ul>
      <p>Please note: At this time, Chase Sapphire Reserve cardmembers and their guests are not eligible for access to our Montréal lounges.</p>
    </div>
  `,
    { url: 'https://www.aircanada.com/ca/en/aco/home/fly/premium-services/maple-leaf-lounges.html#/' },
  );

  assert.equal(records.length, 5);

  const lax = records.find((record) => record.airportCode === 'LAX');
  assert.equal(lax.name, 'Air Canada Maple Leaf Lounge');
  assert.equal(lax.terminal, 'Terminal 6');
  assert.deepEqual(lax.prices[0], {
    amount: 59,
    currency: 'USD',
    label: 'Additional guest fee',
    sourceUrl: 'https://www.aircanada.com/ca/en/aco/home/fly/premium-services/maple-leaf-lounges.html#/',
  });

  const lga = records.find((record) => record.airportCode === 'LGA');
  assert.equal(lga.terminal, 'Terminal B');
  assert.equal(lga.concourse, 'Eastern Concourse');

  const yyzRows = records.filter((record) => record.airportCode === 'YYZ');
  assert.equal(yyzRows.length, 3);
  assert.deepEqual(
    yyzRows.map((record) => record.terminal).sort(),
    ['Domestic departures', 'International departures', 'Transborder departures'],
  );

  assert.equal(records.some((record) => record.airportCode === 'FRA'), false);
  assert.equal(records.some((record) => record.airportCode === 'YHZ'), false);
});

test('Air Canada parser ignores generic dropdown locations without the Chase participation section', () => {
  const records = parseAirCanadaLoungeRecords(`
    <select>
      <option label="Montréal">Montréal</option>
      <option label="Paris">Paris</option>
    </select>
  `);

  assert.deepEqual(records, []);
});

test('Air Canada detail parser extracts terminal-specific hours from rendered lounge panels', () => {
  const records = parseAirCanadaLoungeDetailRecords(
    `
      <div id="tab_4498_title_0" role="tab"><span>International</span></div>
      <div id="tab_4498_title_1" role="tab"><span>Domestic</span></div>
      <div id="tab_4498_title_2" role="tab"><span>Transborder</span></div>
      <div id="tab_4498_title_3" role="tab"><span>Café</span></div>
      <section id="tab_4498_panel_0" role="tabpanel" aria-labelledby="tab_4498_title_0">
        <h2>Lester B. Pearson International Airport</h2>
        <h2 class="light">Terminal 1, Level 3, Node F</h2>
        <!-- <section class="hours"><span>obsolete template</span></section> -->
        <section class="hours"><h3>Hours of operation:</h3><p><span>Daily: 4:45 - 23:15</span></p></section>
      </section>
      <section id="tab_4498_panel_1" role="tabpanel" aria-labelledby="tab_4498_title_1">
        <h2>Lester B. Pearson International Airport</h2>
        <h2 class="light">Terminal 1</h2>
        <section class="hours"><h3>Hours of operation:</h3><p><span>Daily: 5:00 - 0:00</span></p></section>
      </section>
      <section id="tab_4498_panel_2" role="tabpanel" aria-labelledby="tab_4498_title_2">
        <h2>Lester B. Pearson International Airport</h2>
        <h2 class="light">Terminal 1, Level 4 Node F</h2>
        <section class="hours"><h3>Hours of operation:</h3><p><span>Daily: 4:30 - 20:45</span></p></section>
      </section>
      <section id="tab_4498_panel_3" role="tabpanel" aria-labelledby="tab_4498_title_3">
        <h2>Lester B. Pearson International Airport</h2>
        <h2 class="light">Terminal 1, Domestic Departures area near gate D20</h2>
        <section class="hours"><h3>Hours of operation:</h3><p><span>5:00 - 21:30</span></p></section>
      </section>
    `,
    {
      airportCode: 'YYZ',
      airportCity: 'Toronto',
      url: 'https://www.aircanada.com/lounge-details#!lounge@toronto',
    },
  );

  assert.equal(records.length, 4);
  assert.equal(records.find((record) => record.terminal === 'International departures')?.hoursText, 'Daily: 4:45 - 23:15');
  assert.equal(records.find((record) => record.terminal === 'Transborder departures')?.hoursText, 'Daily: 4:30 - 20:45');
  assert.equal(records.find((record) => record.name === 'Air Canada Café')?.hoursText, '5:00 - 21:30');
  assert.match(records.find((record) => record.name === 'Air Canada Café')?.near ?? '', /gate D20/i);
});

test('Air Canada detail merge keeps guest-fee and hours provenance on their official pages', () => {
  const baseUrl = 'https://www.aircanada.com/maple-leaf-lounges.html';
  const detailUrl = 'https://www.aircanada.com/lounge-details#!lounge@losangeles';
  const merged = mergeAirCanadaLoungeDetailRecords(
    [
      {
        airportCode: 'LAX',
        name: 'Air Canada Maple Leaf Lounge',
        terminal: 'Terminal 6',
        near: 'Terminal 6',
        sourceUrl: baseUrl,
        prices: [{ amount: 59, currency: 'USD' }],
      },
    ],
    [
      {
        airportCode: 'LAX',
        name: 'Air Canada Maple Leaf Lounge',
        terminal: 'Terminal 6',
        near: 'Terminal 6',
        hoursText: 'Daily: 5:00 - 22:00',
        sourceUrl: detailUrl,
      },
    ],
  );

  assert.equal(merged[0].hoursText, 'Daily: 5:00 - 22:00');
  assert.equal(merged[0].sourceUrl, detailUrl);
  assert.equal(merged[0].prices[0].sourceUrl, baseUrl);
  assert.equal(merged[0].prices[0].label, 'Additional guest fee');
});
