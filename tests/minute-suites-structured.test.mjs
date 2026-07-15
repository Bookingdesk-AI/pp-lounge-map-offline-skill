import test from 'node:test';
import assert from 'node:assert/strict';

import { parseMinuteSuitesStructuredRecords } from '../scripts/lib/minute-suites-structured.mjs';

test('Minute Suites parser extracts 24-hour multi-terminal records with gates and price', () => {
  const records = parseMinuteSuitesStructuredRecords(`
    <title>Minute Suites at JFK Airport | Private Airport Suites</title>
    <main>
      John F. Kennedy International Airport (JFK)
      Terminal 4 (Gate B39)
      Terminal 8 (Gate C37)
      Terminal 4 Near Gate B39 Wi-Fi TV Workstation Showers
      Terminal 8 Near Gate C37 (Concourse C) Wi-Fi TV Workstation
      Is Minute Suites open 24 hours at JFK Airport? Yes, though suite availability may vary depending on demand.
    </main>
  `, { url: 'https://minutesuites.com/locations/jfk-airport/' });

  assert.equal(records.length, 2);
  assert.equal(records[0].airportCode, 'JFK');
  assert.equal(records[0].brand, 'Minute Suites');
  assert.equal(records[0].terminal, 'Terminal 4');
  assert.equal(records[0].near, 'Near Gate B39');
  assert.equal(records[0].openHours[0].OpenAllDay, true);
  assert.deepEqual(records[0].price, {
    amount: 40,
    currencyCode: 'USD',
    url: 'https://minutesuites.com/priority-pass/',
  });
  assert.deepEqual(records[0].programs, ['Minute Suites', 'Priority Pass']);
  assert.equal(records[0].amenities.Showers, true);
  assert.equal(records[1].terminal, 'Terminal 8');
  assert.equal(records[1].concourse, 'Concourse C');
  assert.equal(records[1].near, 'Near Gate C37');
});

test('Minute Suites parser extracts daily hours and skips pages without hours', () => {
  const bwi = parseMinuteSuitesStructuredRecords(`
    <title>Minute Suites BWI Concourse C | Airport Private Suites</title>
    <main>
      Baltimore/Washington Airport - Located Near Gate C3 in Concourse C
      Minute Suites in Concourse C (Gate C3) Wi-Fi TV Workstation
      Open daily 4:00 AM - 10:00 PM
      Last reservation accepted at 9:00 PM
    </main>
  `, { url: 'https://minutesuites.com/locations/baltimore-washington-airport/' });
  const atl = parseMinuteSuitesStructuredRecords(`
    <main>
      Hartsfield-Jackson Atlanta International Airport (ATL)
      Concourse B Near Gate B24
      Is Minute Suites open 24 hours at ATL Airport? Hours vary by location.
    </main>
  `, { url: 'https://minutesuites.com/locations/atlanta-airport/' });

  assert.equal(bwi.length, 1);
  assert.equal(bwi[0].airportCode, 'BWI');
  assert.equal(bwi[0].terminal, 'Concourse C');
  assert.equal(bwi[0].near, 'Near Gate C3');
  assert.equal(bwi[0].openHours[0].OpeningHour, '04:00');
  assert.equal(bwi[0].openHours[0].ClosingHour, '22:00');
  assert.equal(atl.length, 0);
});
