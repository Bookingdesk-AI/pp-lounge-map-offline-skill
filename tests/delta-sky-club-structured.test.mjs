import test from 'node:test';
import assert from 'node:assert/strict';

import { parseDeltaSkyClubRecords } from '../scripts/lib/delta-sky-club-structured.mjs';

test('Delta parser extracts lounge rows with hours and gate evidence', () => {
  const records = parseDeltaSkyClubRecords(`
    <li><div class="card">
      <div id="expander-news-heading-0" class="card-header expander-news">
        <h5><a><span class="list-subheading">Kotoka Intl (ACC)</span><span class="list-heading">Accra Ghana</span></a></h5>
      </div>
      <div id="expander-news-panel-0" class="collapse">
        <div class="card-body"><ul class="lounge-list">
          <li><div class="d-flex">
            <p class="location">Sanbra Priority Lounge, Terminal 3, next to Gates 3 and 2</p>
            <p class="status"></p>
            <p class="hours"><span>Daily: 6:00am to 11:00pm</span><br></p>
            <div class="clubAmenitiesImg">
              <div class="clubAmenitiesGrayImage clumAmentiesGrayImg2"></div>
              <div class="clubAmenitiesGrayImage clumAmentiesGrayImg1"></div>
              <div class="clubAmenitiesGrayImage clumAmentiesGrayImg7"></div>
            </div>
          </div></li>
        </ul></div>
      </div>
    </div></li>
  `, { url: 'https://www.delta.com/us/en/delta-sky-club/locations' });

  assert.equal(records.length, 1);
  assert.equal(records[0].airportCode, 'ACC');
  assert.equal(records[0].airportName, 'Kotoka Intl');
  assert.equal(records[0].name, 'Sanbra Priority Lounge');
  assert.equal(records[0].terminal, 'Terminal 3');
  assert.equal(records[0].near, 'Terminal 3, next to Gates 3 and 2');
  assert.equal(records[0].openHours[0].OpeningHour, '06:00');
  assert.equal(records[0].openHours[0].ClosingHour, '23:00');
  assert.equal(records[0].amenities.FoodBeverageSnackBuffet, true);
  assert.equal(records[0].amenities.WiFi, true);
});

test('Delta parser keeps multi-day schedules and partner restrictions', () => {
  const records = parseDeltaSkyClubRecords(`
    <li><div class="card">
      <div class="card-header expander-news">
        <h5><a><span class="list-subheading">Sydney Intl (SYD)</span><span class="list-heading">Sydney Australia</span></a></h5>
      </div>
      <div class="collapse">
        <div class="card-body"><ul class="lounge-list">
          <li><div class="d-flex">
            <p class="location">SkyTeam Lounge, Airside, Terminal 1, Pier B (East), Next to Gate 24</p>
            <p class="status">Temporary access rule</p>
            <p class="hours"><span>Mon-Fri: 5:30am to 10:30am</span><br><span>Sun: 7:30am to 10:30am</span><br></p>
            <div class="clubAmenitiesImg"><div class="clubAmenitiesGrayImage clumAmentiesGrayImg4"></div></div>
          </div></li>
        </ul></div>
      </div>
    </div></li>
  `, { url: 'https://www.delta.com/us/en/delta-sky-club/locations' });

  assert.equal(records.length, 1);
  assert.equal(records[0].airportCode, 'SYD');
  assert.equal(records[0].name, 'SkyTeam Lounge');
  assert.equal(records[0].terminal, 'Terminal 1');
  assert.equal(records[0].near, 'Airside, Terminal 1, Pier B (East), Next to Gate 24');
  assert.deepEqual(records[0].openHours.map((slot) => slot.Day).sort(), [0, 1, 2, 3, 4, 5]);
  assert.equal(records[0].amenities.Shower, true);
  assert.match(records[0].accessNotes, /Temporary access rule/);
});
