import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseQatarAirwaysLoungeLinks,
  parseQatarAirwaysLoungeRecord,
} from '../scripts/lib/qatar-airways-structured.mjs';

test('Qatar Airways parser extracts official lounge detail fields', () => {
  const record = parseQatarAirwaysLoungeRecord(`
    <html>
      <head><title>Al Mourjan Business Lounge | Qatar Airways</title></head>
      <body>
        <h1>Al Mourjan Business Lounge</h1>
        <p>Located at Hamad International Airport in the South Node.</p>
        <p>Opening hours: 5:00am to 11:00pm.</p>
        <p>Enjoy dining, showers, Wi-Fi, quiet areas and meeting rooms.</p>
      </body>
    </html>
  `, { url: 'https://www.qatarairways.com/en-us/lounges/al-mourjan.html' });

  assert.equal(record.airportCode, 'DOH');
  assert.equal(record.airportName, 'Hamad International Airport');
  assert.equal(record.name, 'Al Mourjan Business Lounge');
  assert.equal(record.brand, 'Qatar Airways');
  assert.equal(record.operator, 'Qatar Airways');
  assert.equal(record.terminal, 'South Node');
  assert.equal(record.near, 'Located at Hamad International Airport in the South Node.');
  assert.equal(record.openHours[0].OpeningHour, '05:00');
  assert.equal(record.openHours[0].ClosingHour, '23:00');
  assert.equal(record.amenities.FoodBeverageSnackBuffet, true);
  assert.equal(record.amenities.Shower, true);
  assert.equal(record.amenities.WiFi, true);
  assert.equal(record.amenities.BusinessCenter, true);
  assert.match(record.sourceRecordId, /^qatar-airways-doh-/);
});

test('Qatar Airways parser ignores unrelated 24-hour account messages outside lounge content', () => {
  const record = parseQatarAirwaysLoungeRecord(`
    <html>
      <head><title>First and Business Class Arrival Lounges | Qatar Airways</title></head>
      <body>
        <main id="main">
          <h1>First and Business Class Arrival Lounges</h1>
          <p>They are located in two areas: before immigration and after baggage claim.</p>
        </main>
        <form class="hidden"><p>Your account can be reset after 24 hours.</p></form>
      </body>
    </html>
  `, { url: 'https://www.qatarairways.com/en-us/lounges/first-and-business-class-arrival-lounges.html' });

  assert.deepEqual(record.openHours, []);
  assert.match(record.near, /located in two areas/i);
});

test('Qatar Airways parser keeps official known lounge links only', () => {
  const links = parseQatarAirwaysLoungeLinks(`
    <a href="/en-us/lounges/al-safwa-lounge.html">Al Safwa</a>
    <a href="/en-us/lounges/singapore-premium-lounge.html">Singapore Premium Lounge</a>
    <a href="/en-us/holidays.html">Unrelated</a>
  `);

  assert.deepEqual(
    links.map((link) => link.hint.airportCode),
    ['DOH', 'SIN'],
  );
  assert.ok(links[0].url.startsWith('https://www.qatarairways.com/en-us/lounges/'));
});
