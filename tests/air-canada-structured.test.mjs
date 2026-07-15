import test from 'node:test';
import assert from 'node:assert/strict';

import { parseAirCanadaLoungeRecords } from '../scripts/lib/air-canada-structured.mjs';

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
  assert.deepEqual(lax.prices[0], { amount: 59, currency: 'USD' });

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
