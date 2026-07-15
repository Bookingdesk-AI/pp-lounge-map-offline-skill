import test from 'node:test';
import assert from 'node:assert/strict';

import { parseMarhabaStructuredRecord, parseMarhabaStructuredRecords } from '../scripts/lib/marhaba-structured.mjs';

test('Marhaba parser extracts official product price, terminal, gate, and daily hours', () => {
  const html = `
    <html>
      <head>
        <title>Plaza Premium Lounge Dallas Airport | marhaba</title>
        <meta property="og:product:price:amount" content="184.00">
        <meta property="og:product:price:currency" content="AED">
        <link rel="canonical" href="https://www.marhabaservices.com/ae/english/global-lounges/dallas-departure-lounge.html">
      </head>
      <body>
        <h1 class="b-pdp_info-title">Plaza Premium Lounge Dallas Airport</h1>
        <div data-component="product/Lounges" data-component-options="{&quot;variationAttributesDisplayValues&quot;:{&quot;terminal&quot;:&quot;Terminal E&quot;},&quot;currentAirport&quot;:&quot;DFW&quot;}"></div>
        <div class="b-pdp_info-description">
          <p>Located at Terminal E near Gate E31, a 2-minute walk from the Skylink train.</p>
          <li>Opening hours: 06:00 &ndash; 22:00 daily</li>
        </div>
        <div class="b-pdp_info-cta"></div>
      </body>
    </html>
  `;

  const record = parseMarhabaStructuredRecord(html, {
    url: 'https://www.marhabaservices.com/ae/english/global-lounges/dallas-departure-lounge.html',
  });

  assert.equal(record.airportCode, 'DFW');
  assert.equal(record.name, 'Plaza Premium Lounge Dallas Airport');
  assert.equal(record.brand, 'Plaza Premium Lounge');
  assert.equal(record.terminal, 'Terminal E');
  assert.match(record.near, /Gate E31/);
  assert.deepEqual(record.price, {
    amount: 184,
    currencyCode: 'AED',
  });
  assert.equal(record.openHours.length, 7);
  assert.equal(record.openHours[0].OpeningHour, '06:00');
  assert.equal(record.openHours[0].ClosingHour, '22:00');
});

test('Marhaba parser uses trusted slug fallback and splits published 24 hour terminal areas', () => {
  const html = `
    <html>
      <head>
        <meta property="og:product:price:amount" content="195.00">
        <meta property="og:product:price:currency" content="AED">
      </head>
      <body>
        <h1 class="b-pdp_info-title">Marhaba Lounge Dubai International Airport</h1>
        <div class="header-banner-promotion">Terminal 3, Concourse C Lounge is closed from 3rd June 2026. Lounges in Concourses A and B remain open.</div>
        <div class="b-pdp_info-description">
          <li>Opening hours: Terminal 1: 24 hours Terminal 2: 24 hours Terminal 3, Concourse A, B and C: 24 hours</li>
        </div>
        <div class="b-pdp_info-cta"></div>
      </body>
    </html>
  `;

  const records = parseMarhabaStructuredRecords(html, {
    url: 'https://www.marhabaservices.com/ae/english/airport-lounges/dubai-international-airport-lounges.html',
  });

  assert.deepEqual(
    records.map((record) => record.terminal),
    ['Terminal 1', 'Terminal 2', 'Terminal 3 Concourse A', 'Terminal 3 Concourse B'],
  );
  assert.equal(records[0].airportCode, 'DXB');
  assert.equal(records[0].brand, 'Marhaba');
  assert.equal(records[0].price.amount, 195);
  assert.equal(records[0].openHours.length, 7);
  assert.equal(records[0].openHours[0].OpenAllDay, true);
  assert.equal(records.find((record) => record.terminal === 'Terminal 3 Concourse A')?.concourse, 'Concourse A');
  assert.equal(records.some((record) => /Concourse C/i.test(record.terminal)), false);
});

test('Marhaba parser ignores commented location text', () => {
  const html = `
    <html>
      <head>
        <meta property="og:product:price:amount" content="144.00">
        <meta property="og:product:price:currency" content="AED">
      </head>
      <body>
        <h1 class="b-pdp_info-title">Singapore Airport Lounge</h1>
        <div data-component="product/Lounges" data-component-options="{&quot;variationAttributesDisplayValues&quot;:{&quot;terminal&quot;:null},&quot;currentAirport&quot;:&quot;SIN&quot;}"></div>
        <div class="b-pdp_info-description">
          <li>Opening hours: 24 hours</li>
          <!-- Download our Factsheet and Location Map - Plaza Premium Lounge (International Departures, Terminal KLIA2) -->
        </div>
        <div class="b-pdp_info-cta"></div>
      </body>
    </html>
  `;

  const record = parseMarhabaStructuredRecord(html, {
    url: 'https://www.marhabaservices.com/ae/english/global-lounges/singapore-international-airport-lounge.html',
  });

  assert.equal(record.airportCode, 'SIN');
  assert.equal(record.terminal, '');
  assert.equal(record.openHours.length, 7);
});

test('Marhaba parser extracts daily colon hours with to separator', () => {
  const html = `
    <html>
      <body>
        <h1 class="b-pdp_info-title">Zurich Airport Lounge</h1>
        <div class="b-pdp_info-description">
          <p>Conditions of entry Maximum 6 hour stay Opening hours: Daily: 05:15 to 20:00 Children under the age of 2 years are admitted free.</p>
        </div>
        <div class="b-pdp_info-cta"></div>
      </body>
    </html>
  `;

  const record = parseMarhabaStructuredRecord(html, {
    url: 'https://www.marhabaservices.com/ae/english/global-lounges/zurich-airport.html',
  });

  assert.equal(record.airportCode, 'ZRH');
  assert.equal(record.openHours.length, 7);
  assert.equal(record.openHours[0].OpeningHour, '05:15');
  assert.equal(record.openHours[0].ClosingHour, '20:00');
});

test('Marhaba parser extracts am and pm daily ranges', () => {
  const html = `
    <html>
      <body>
        <h1 class="b-pdp_info-title">Clark International Airport Lounge</h1>
        <div class="b-pdp_info-description">
          <p>The entrance is located in front of Gate 9. Conditions of entry Maximum 3 hour stay Opening hours: 2pm - 2am daily.</p>
        </div>
        <div class="b-pdp_info-cta"></div>
      </body>
    </html>
  `;

  const record = parseMarhabaStructuredRecord(html, {
    url: 'https://www.marhabaservices.com/ae/english/global-lounges/clark-international-airport-lounge.html',
  });

  assert.equal(record.airportCode, 'CRK');
  assert.equal(record.openHours.length, 7);
  assert.equal(record.openHours[0].OpeningHour, '14:00');
  assert.equal(record.openHours[0].ClosingHour, '02:00');
});

test('Marhaba parser extracts explicit midnight-to-midnight daily hours as all day', () => {
  const html = `
    <html>
      <body>
        <h1 class="b-pdp_info-title">Plaza Premium Lounge Istanbul Sabiha Gökçen Airport</h1>
        <div class="b-pdp_info-description">
          <p>Lounge Access Details Opening hours: 00:00 - 24:00 Daily Maximum stay: 3 hours.</p>
        </div>
        <div class="b-pdp_info-cta"></div>
      </body>
    </html>
  `;

  const record = parseMarhabaStructuredRecord(html, {
    url: 'https://www.marhabaservices.com/ae/english/global-lounges/istanbul-airport-lounge.html',
  });

  assert.equal(record.airportCode, 'IST');
  assert.equal(record.openHours.length, 7);
  assert.equal(record.openHours[0].OpenAllDay, true);
});

test('Marhaba parser preserves official closure banner text as operation exception', () => {
  const html = `
    <html>
      <body>
        <h1 class="b-pdp_info-title">Dubai International Airport Lounges</h1>
        <div class="header-banner-promotion">Terminal 3, Concourse C Lounge is closed from 3rd June 2026. Lounges in Concourses A and B remain open.</div>
        <div class="b-pdp_info-description">
          <li>Opening hours:
            <ul>
              <li>Terminal 1: 24 hours</li>
              <li>Terminal 2: 24 hours</li>
              <li>Terminal 3, Concourse A, B and C: 24 hours</li>
            </ul>
          </li>
        </div>
        <div class="b-pdp_info-cta"></div>
      </body>
    </html>
  `;

  const record = parseMarhabaStructuredRecord(html, {
    url: 'https://www.marhabaservices.com/ae/english/airport-lounges/dubai-international-airport-lounges.html',
  });

  assert.equal(record.airportCode, 'DXB');
  assert.deepEqual(record.exceptions, [
    'Terminal 3, Concourse C Lounge is closed from 3rd June 2026. Lounges in Concourses A and B remain open.',
  ]);
});

test('Marhaba parser splits published terminal-specific hours', () => {
  const html = `
    <html>
      <head>
        <meta property="og:product:price:amount" content="171.00">
        <meta property="og:product:price:currency" content="AED">
      </head>
      <body>
        <h1 class="b-pdp_info-title">Plaza Premium Lounge Taiwan Airport</h1>
        <div class="b-pdp_info-description">
          <p>Lounge in Terminal 1 is located in Terminal 1, Zone D, Departure Hall, level 4. Lounge in Terminal 2 is located in Terminal 2, Zone A, Departure Hall, level 4.</p>
          <p>Conditions of entry for Terminal 1 Maximum 10 hour stay Opening hours for Terminal 1: 06:00 - 22:00 Opening hours for Terminal 2: 05:00 - 23:00</p>
        </div>
        <div class="b-pdp_info-cta"></div>
      </body>
    </html>
  `;

  const records = parseMarhabaStructuredRecords(html, {
    url: 'https://www.marhabaservices.com/ae/english/global-lounges/taiwan-taoyuan-international-airport.html',
  });

  assert.equal(records.length, 2);
  assert.equal(records[0].airportCode, 'TPE');
  assert.equal(records[0].terminal, 'Terminal 1');
  assert.match(records[0].near, /Zone D/);
  assert.equal(records[0].openHours[0].OpeningHour, '06:00');
  assert.equal(records[0].openHours[0].ClosingHour, '22:00');
  assert.equal(records[1].terminal, 'Terminal 2');
  assert.match(records[1].near, /Zone A/);
  assert.equal(records[1].openHours[0].OpeningHour, '05:00');
  assert.equal(records[1].openHours[0].ClosingHour, '23:00');
});

test('Marhaba parser splits published Geneva lounge-area hours', () => {
  const html = `
    <html>
      <head>
        <meta property="og:product:price:amount" content="260.00">
        <meta property="og:product:price:currency" content="AED">
      </head>
      <body>
        <h1 class="b-pdp_info-title">Geneva Airport Lounges</h1>
        <div data-component="product/Lounges" data-component-options="{&quot;variationAttributesDisplayValues&quot;:{&quot;terminal&quot;:&quot;Terminal 1&quot;},&quot;currentAirport&quot;:&quot;GVA&quot;}"></div>
        <div class="b-pdp_info-description">
          <p>The lounge is located in the main terminal. Opening hours: 06:00 to 20:30 (Main Lobby) Opening hours: 05:30 to 22:00 (East Wing)</p>
        </div>
        <div class="b-pdp_info-cta"></div>
      </body>
    </html>
  `;

  const records = parseMarhabaStructuredRecords(html, {
    url: 'https://www.marhabaservices.com/ae/english/global-lounges/geneva-airport-lounge.html',
  });

  assert.equal(records.length, 2);
  assert.deepEqual(records.map((record) => record.name), ['Marhaba Lounge Main Lobby', 'Marhaba Lounge East Wing']);
  assert.equal(records[0].terminal, 'Terminal 1');
  assert.equal(records[0].openHours[0].OpeningHour, '06:00');
  assert.equal(records[1].openHours[0].OpeningHour, '05:30');
});

test('Marhaba parser uses the widest published same-lounge service schedule', () => {
  const html = `
    <html>
      <head>
        <meta property="og:product:price:amount" content="211.00">
        <meta property="og:product:price:currency" content="AED">
      </head>
      <body>
        <h1 class="b-pdp_info-title">Plaza Premium Lounge Rome Airport</h1>
        <div data-component="product/Lounges" data-component-options="{&quot;variationAttributesDisplayValues&quot;:{&quot;terminal&quot;:&quot;Terminal 3&quot;},&quot;currentAirport&quot;:&quot;FCO&quot;}"></div>
        <div class="b-pdp_info-description">
          <p>Located in Area E (Upper Level), Terminal 3 Extra Schengen Departures. Opening hours: 2-Hour service: Monday to Sunday: 05:00 to 22:00 5-Hour service: Monday to Sunday: 04:30 to 22:30</p>
        </div>
        <div class="b-pdp_info-cta"></div>
      </body>
    </html>
  `;

  const record = parseMarhabaStructuredRecord(html, {
    url: 'https://www.marhabaservices.com/ae/english/global-lounges/rome-terminal-3-lounge.html',
  });

  assert.equal(record.airportCode, 'FCO');
  assert.equal(record.terminal, 'Terminal 3');
  assert.equal(record.openHours.length, 7);
  assert.equal(record.openHours[0].OpeningHour, '04:30');
  assert.equal(record.openHours[0].ClosingHour, '22:30');
});
