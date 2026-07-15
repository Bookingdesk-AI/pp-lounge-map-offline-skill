import test from 'node:test';
import assert from 'node:assert/strict';

import { parseSingaporeAirlinesLoungeRecords } from '../scripts/lib/singapore-airlines-structured.mjs';

test('Singapore Airlines parser extracts 24-hour Changi lounge gate areas and facilities', () => {
  const records = parseSingaporeAirlinesLoungeRecords(`
    <div class="cmp-accordion__item">
      <span class="cmp-accordion__title">Singapore</span>
      <h6><span class="font-size-16">Changi Airport</span></h6>
      <table><tbody>
        <tr><td><p><b>Location</b></p></td><td><p>Terminal Two, Level 3 (Nearer to Gates E)</p></td></tr>
        <tr><td><p><b>Opening<br /></b><b>hours</b></p></td><td><p>24 hours</p></td></tr>
        <tr><td><p><b>Facilities</b></p></td><td><ul><li>Wireless internet</li><li>Shower</li><li>TV</li></ul></td></tr>
      </tbody></table>
    </div>
  `);

  assert.equal(records.length, 1);
  assert.equal(records[0].airportCode, 'SIN');
  assert.equal(records[0].airportName, 'Singapore Changi Airport');
  assert.equal(records[0].name, 'Singapore Airlines SilverKris Lounge');
  assert.equal(records[0].terminal, 'Terminal 2');
  assert.equal(records[0].near, 'Terminal Two, Level 3 (Nearer to Gates E)');
  assert.equal(records[0].openHours[0].OpeningHour, '00:00');
  assert.equal(records[0].openHours[0].ClosingHour, '23:59');
  assert.equal(records[0].amenities.WiFi, true);
  assert.equal(records[0].amenities.Shower, true);
  assert.equal(records[0].amenities.TV, true);
});

test('Singapore Airlines parser extracts numeric hour ranges and exact gate text', () => {
  const records = parseSingaporeAirlinesLoungeRecords(`
    <div class="cmp-accordion__item">
      <span class="cmp-accordion__title">Bangkok</span>
      <h6><span class="font-size-16">Suvarnabhumi Airport</span></h6>
      <table><tbody>
        <tr><td><p><b>Location</b></p></td><td><p>Level 3, Concourse D<br />Opposite Gate D7</p></td></tr>
        <tr><td><p><b>Opening<br /></b><b>hours</b></p></td><td><p>0630 to 2300 hours</p></td></tr>
        <tr><td><p><b>Facilities</b></p></td><td><ul><li>Selection of warm food and light snacks</li><li>Meeting room</li></ul></td></tr>
      </tbody></table>
    </div>
    <div class="cmp-accordion__item">
      <span class="cmp-accordion__title">London</span>
      <h6><span class="font-size-16">London Heathrow Airport</span></h6>
      <table><tbody>
        <tr><td><p><b>Location</b></p></td><td><p>Terminal 2B Departure Level<br />Via Lift Lobby, Next to World Duty Free</p></td></tr>
        <tr><td><p><b>Opening</b><br /><b>hours</b></p></td><td><p>0530 to 2200 hours</p></td></tr>
      </tbody></table>
    </div>
  `);

  assert.equal(records.length, 2);
  assert.equal(records[0].airportCode, 'BKK');
  assert.equal(records[0].terminal, 'Concourse D');
  assert.equal(records[0].near, 'Level 3, Concourse D Opposite Gate D7');
  assert.equal(records[0].openHours[0].OpeningHour, '06:30');
  assert.equal(records[0].openHours[0].ClosingHour, '23:00');
  assert.equal(records[0].amenities.FoodBeverageSnackBuffet, true);
  assert.equal(records[0].amenities.BusinessCenter, true);
  assert.equal(records[1].airportCode, 'LHR');
  assert.equal(records[1].terminal, 'Terminal 2B');
  assert.equal(records[1].openHours[0].OpeningHour, '05:30');
  assert.equal(records[1].openHours[0].ClosingHour, '22:00');
});
