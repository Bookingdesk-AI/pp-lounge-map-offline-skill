import test from 'node:test';
import assert from 'node:assert/strict';

import { parseAmericanAirlinesClubRecords } from '../scripts/lib/american-airlines-structured.mjs';

test('American Airlines parser extracts Admirals Club gate, hours, and amenities', () => {
  const records = parseAmericanAirlinesClubRecords(`
    <h1>Dallas Fort Worth International Airport (DFW)</h1>
    <h2>Admirals Club, Terminal A</h2>
    <div class="row">
      <div class="span3"><h3>Location</h3><p>After security, across from gate A24</p></div>
      <div class="span3"><h3>Hours</h3><p>Daily:<br />4 a.m. &ndash; 10:15 p.m.</p></div>
      <div class="span3"><h3>Amenities</h3>
        <ul class="list-basic">
          <li>Complimentary food and drinks</li>
          <li>Full service bar</li>
          <li>Complimentary Wi-Fi</li>
          <li>Showers</li>
          <li>Kids Room</li>
        </ul>
      </div>
    </div>
  `, { url: 'https://www.aa.com/i18n/travelInformation/airportAmenities/dfw-club.jsp' });

  assert.equal(records.length, 1);
  assert.equal(records[0].airportCode, 'DFW');
  assert.equal(records[0].airportName, 'Dallas Fort Worth International Airport');
  assert.equal(records[0].name, 'Admirals Club, Terminal A');
  assert.equal(records[0].terminal, 'Terminal A');
  assert.equal(records[0].near, 'After security, across from gate A24');
  assert.equal(records[0].openHours[0].OpeningHour, '04:00');
  assert.equal(records[0].openHours[0].ClosingHour, '22:15');
  assert.equal(records[0].amenities.WiFi, true);
  assert.equal(records[0].amenities.Shower, true);
  assert.equal(records[0].amenities.FoodBeverageSnackBuffet, true);
});

test('American Airlines parser keeps premium lounge records from official pages', () => {
  const records = parseAmericanAirlinesClubRecords(`
    <h1>New York Kennedy International Airport (JFK)</h1>
    <h2>Joint premium lounges, Terminal 8</h2>
    <div class="row">
      <div><h3>Location</h3><p>Concourse B, near gate 14</p></div>
      <div><h3>Hours</h3><p>Daily: 4:30 a.m. - 12:30 a.m.</p></div>
      <div><h3>Amenities</h3><ul><li>Complimentary Wi-Fi</li><li>Full service bar</li></ul></div>
    </div>
  `, { url: 'https://www.aa.com/i18n/travelInformation/airportAmenities/jfk-club.jsp' });

  assert.equal(records.length, 1);
  assert.equal(records[0].airportCode, 'JFK');
  assert.equal(records[0].name, 'Joint premium lounges, Terminal 8');
  assert.equal(records[0].brand, 'American Airlines premium lounges');
  assert.deepEqual(records[0].programs, ['Flagship Lounge', 'Premium cabin']);
  assert.equal(records[0].terminal, 'Terminal 8');
  assert.equal(records[0].near, 'Concourse B, near gate 14');
  assert.equal(records[0].openHours[0].ClosingHour, '00:30');
});
