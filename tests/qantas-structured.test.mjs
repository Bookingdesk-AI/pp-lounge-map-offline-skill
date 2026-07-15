import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseQantasLoungeLinks,
  parseQantasLoungeRecord,
} from '../scripts/lib/qantas-structured.mjs';

test('Qantas parser extracts official lounge links from block links', () => {
  const links = parseQantasLoungeLinks(`
    <a class="BlockLinks__blockListLinkBlock_0YC8vTIw" href="/us/en/qantas-experience/at-the-airport/airport-lounges/all-qantas-airport-lounges/airport-lounge-locations.html/adl/The%20Qantas%20Club.html">Adelaide Qantas Club</a>
    <a class="BlockLinks__blockListLinkBlock_0YC8vTIw" href="/us/en/qantas-experience/at-the-airport/airport-lounges/all-qantas-airport-lounges/the-qantas-london-lounge.html">London International Lounge</a>
    <a href="/us/en/flights.html">Flights</a>
  `);

  assert.equal(links.length, 2);
  assert.equal(links[0].title, 'Adelaide Qantas Club');
  assert.ok(links[0].url.startsWith('https://www.qantas.com/us/en/'));
  assert.match(links[1].url, /the-qantas-london-lounge\.html$/);
});

test('Qantas parser extracts loungeData with gates, hours, and facilities', () => {
  const record = parseQantasLoungeRecord(`
    <script id="props" type="application/json">{
      "resourceType": "qantas/qcom/components/content/lounge/lounge-container",
      "loungeData": {
        "loungeTitle": "Sydney - The Qantas Club (T3)",
        "operator": "Qantas",
        "latitude": "-33.932081",
        "longitude": "151.178976",
        "location": "Departures Level, opposite Gates 4 and 5\u003cbr\u003e\u003ca href\u003d\\\"http://bit.ly/qf-sydney-the-qantas-club-t3\\\"\u003eView map\u003c/a\u003e",
        "openingHours": "4:30am to 9:30pm daily.",
        "commonFeatures": ["Barista coffee", "Lounge dining", "Refreshments", "Showers"],
        "businessFeatures": ["Internet access", "Wireless internet"],
        "loungePathInfo": {
          "portCode": "syd",
          "loungeName": "the-qantas-club"
        }
      }
    }</script>
  `, {
    url: 'https://www.qantas.com/us/en/qantas-experience/at-the-airport/airport-lounges/all-qantas-airport-lounges/airport-lounge-locations.html/syd/The%20Qantas%20Club.html',
  });

  assert.equal(record.airportCode, 'SYD');
  assert.equal(record.name, 'The Qantas Club (T3)');
  assert.equal(record.brand, 'Qantas');
  assert.equal(record.operator, 'Qantas');
  assert.equal(record.terminal, 'Terminal 3');
  assert.match(record.near, /opposite Gates 4 and 5/);
  assert.equal(record.airportCoordinates.lat, -33.932081);
  assert.equal(record.airportCoordinates.lon, 151.178976);
  assert.equal(record.openHours[0].OpeningHour, '04:30');
  assert.equal(record.openHours[0].ClosingHour, '21:30');
  assert.equal(record.amenities.FoodBeverageSnackBuffet, true);
  assert.equal(record.amenities.Shower, true);
  assert.equal(record.amenities.WiFi, true);
});

test('Qantas parser extracts official dot-time and midnight hours', () => {
  const record = parseQantasLoungeRecord(`
    <script id="props" type="application/json">{
      "resourceType": "qantas/qcom/components/content/lounge/lounge-container",
      "loungeData": {
        "loungeTitle": "Auckland - International Lounge",
        "operator": "Qantas",
        "latitude": "-37.0082",
        "longitude": "174.7850",
        "location": "Auckland Airport International Terminal, Airside, Level 2",
        "openingHours": "Daily: 4.30am to 8pm",
        "commonFeatures": ["Lounge dining", "Showers"],
        "businessFeatures": ["Wireless internet"],
        "loungePathInfo": {
          "portCode": "akl",
          "loungeName": "international-lounge"
        }
      }
    }</script>
  `);

  assert.equal(record.airportCode, 'AKL');
  assert.deepEqual(record.openHours.find((row) => row.Day === 1), {
    Day: 1,
    OpeningHour: '04:30',
    ClosingHour: '20:00',
  });
});

test('Qantas parser extracts official midnight closing time', () => {
  const record = parseQantasLoungeRecord(`
    <script id="props" type="application/json">{
      "resourceType": "qantas/qcom/components/content/lounge/lounge-container",
      "loungeData": {
        "loungeTitle": "Jakarta - Plaza Premium Lounge (partner)",
        "operator": "Plaza Premium Lounge",
        "location": "Terminal 3, Gate 7",
        "openingHours": "4am - midnight",
        "commonFeatures": ["Refreshments"],
        "businessFeatures": ["Wireless internet"],
        "loungePathInfo": {
          "portCode": "cgk",
          "loungeName": "plaza-premium-lounge"
        }
      }
    }</script>
  `);

  assert.equal(record.airportCode, 'CGK');
  assert.deepEqual(record.openHours.find((row) => row.Day === 1), {
    Day: 1,
    OpeningHour: '04:00',
    ClosingHour: '00:00',
  });
});

test('Qantas parser preserves official non-clock operating text', () => {
  const html = `
    <script type="application/json">
      {"loungeData":{
        "loungeTitle":"ADL - Adelaide Business Lounge",
        "loungePathInfo":{"portCode":"ADL"},
        "operator":"Qantas",
        "location":"Departures Level, opposite Gate 22.",
        "openingHours":"One hour before each Qantas operated service until 9.15pm",
        "commonFeatures":["Refreshments","Wireless internet"],
        "businessFeatures":["Showers"]
      }}
    </script>
  `;

  const record = parseQantasLoungeRecord(html, {
    url: 'https://www.qantas.com/us/en/qantas-experience/at-the-airport/airport-lounges/all-qantas-airport-lounges/airport-lounge-locations.html/adl/domestic-business-lounge.html',
  });

  assert.equal(record.airportCode, 'ADL');
  assert.equal(record.openHours.length, 0);
  assert.equal(record.hoursText, 'One hour before each Qantas operated service until 9.15pm');
});
