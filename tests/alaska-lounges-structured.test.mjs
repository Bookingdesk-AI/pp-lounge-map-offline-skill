import test from 'node:test';
import assert from 'node:assert/strict';

import { parseAlaskaLoungePass, parseAlaskaLoungeRecords } from '../scripts/lib/alaska-lounges-structured.mjs';

const html = `
<table>
  <thead><tr><th>Airport</th><th>Location</th><th>Hours</th><th>Lounge pass available?</th></tr></thead>
  <tbody>
    <tr>
      <td>Seattle/Tacoma Airport (SEA)</td>
      <td>C Concourse, on the mezzanine level next to Gate C-16</td>
      <td>Daily:<br>5am–7pm</td>
      <td>Yes</td>
    </tr>
    <tr>
      <td>Seattle/Tacoma Airport (SEA)</td>
      <td>North Satellite on the mezzanine level, above Gates N13–18</td>
      <td>Daily:<br>5am–11pm</td>
      <td>Yes</td>
    </tr>
  </tbody>
</table>`;

test('parses distinct Alaska Lounge locations and daily hours', () => {
  const records = parseAlaskaLoungeRecords(html);

  assert.equal(records.length, 2);
  assert.equal(records[0].airportCode, 'SEA');
  assert.equal(records[0].terminal, 'Concourse C');
  assert.match(records[0].near, /Gate C16/);
  assert.equal(records[0].openHours[0].OpeningHour, '05:00');
  assert.equal(records[0].openHours[0].ClosingHour, '19:00');
  assert.equal(records[0].loungePassAvailable, true);
  assert.equal(records[1].terminal, 'N Concourse');
  assert.match(records[1].near, /Gates N13-N18/);
  assert.equal(records[1].openHours[0].ClosingHour, '23:00');
});

test('parses the official Alaska single-entry lounge pass', () => {
  const offer = parseAlaskaLoungePass(`
    <p>Single-entry Lounge passes are $65 USD per person.</p>
    <p>Passes are sold when space is available and capacity may be managed based on operational needs.</p>
    <p>Lounge passes must be used in conjunction with same-day, ticketed air travel on Alaska or Hawaiian Airlines, a fellow oneworld member airline, or one of our additional global partners.</p>
  `);

  assert.equal(offer?.amount, 65);
  assert.equal(offer?.currencyCode, 'USD');
  assert.equal(offer?.label, 'USD 65 Single-Entry Lounge Pass');
  assert.equal(offer?.capacityRestricted, true);
});
