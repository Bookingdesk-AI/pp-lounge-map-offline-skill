import test from 'node:test';
import assert from 'node:assert/strict';

import { parseSleepoverStructuredRecord } from '../scripts/lib/sleepover-structured.mjs';

test('Sleepover parser extracts DXB terminal gate area, 24-hour operations, and price', () => {
  const html = `
    <html>
      <head>
        <title>Sleepover | Dubai T3 A-Gates Sleeping Pods &amp; Rooms | Sleepover</title>
        <meta name="description" content="Airport sleeping pods, cabins and rooms at DXB Terminal 3, A-Gates. A quiet place to rest on a layover, book online.">
        <meta name="keywords" content="Sleepover, Dubai Airport, Terminal 3 A-Gates lounge">
        <link rel="canonical" href="https://www.airport-sleepover.com/en/terminals/dubai-terminal-3-concourse-a">
      </head>
      <body>
        <div>Open 24 hours 7 days a week</div>
        <a href="/en/search?propertyId=1">BOOK FROM $45 PER PERSON</a>
        <p>Airport sleeping pods, cabins and rooms.</p>
      </body>
    </html>
  `;

  const record = parseSleepoverStructuredRecord(html, {
    url: 'https://www.airport-sleepover.com/en/terminals/dubai-terminal-3-concourse-a',
  });

  assert.equal(record.airportCode, 'DXB');
  assert.equal(record.name, 'Sleepover DXB Terminal 3 A-Gates');
  assert.equal(record.terminal, 'Terminal 3');
  assert.equal(record.concourse, 'Concourse A');
  assert.equal(record.near, 'A-Gates');
  assert.equal(record.openHours.length, 7);
  assert.equal(record.openHours[0].OpenAllDay, true);
  assert.deepEqual(record.price, {
    amount: 45,
    currencyCode: 'USD',
  });
  assert.equal(record.amenities['Sleeping pods'], true);
});

test('Sleepover parser extracts DOH node and gate without exact terminal fabrication', () => {
  const html = `
    <html>
      <head>
        <title>Sleepover | Doha North Node Sleeping Pods &amp; Rooms | Sleepover</title>
        <meta name="description" content="Airport sleeping pods, cabins and rooms at Hamad International, North Node (C30).">
        <link rel="canonical" href="https://www.airport-sleepover.com/en/terminals/doha-north">
      </head>
      <body>
        <h1>Gate C30</h1>
        <div>Located in North Node Gate C30, and open 24 hours, 7 days a week.</div>
        <a>BOOK FROM $79 PER PERSON</a>
      </body>
    </html>
  `;

  const record = parseSleepoverStructuredRecord(html, {
    url: 'https://www.airport-sleepover.com/en/terminals/doha-north',
  });

  assert.equal(record.airportCode, 'DOH');
  assert.equal(record.terminal, 'North Node');
  assert.equal(record.near, 'Gate C30');
  assert.deepEqual(record.price, {
    amount: 79,
    currencyCode: 'USD',
  });
});

test('Sleepover parser keeps Lima arrivals-area location as area text', () => {
  const html = `
    <html>
      <head>
        <title>Sleepover | Lima International Terminal Sleeping Pods &amp; Rooms | Sleepover</title>
        <meta name="description" content="Airport sleeping pods, cabins and rooms at Jorge Chavez International (LIM).">
        <link rel="canonical" href="https://www.airport-sleepover.com/en/terminals/lima-international-terminal">
      </head>
      <body>
        <div>Open 24 hours 7 days a week</div>
        <p>Our sleep station is located in the arrivals area.</p>
        <a>BOOK FROM $38 PER PERSON</a>
      </body>
    </html>
  `;

  const record = parseSleepoverStructuredRecord(html, {
    url: 'https://www.airport-sleepover.com/en/terminals/lima-international-terminal',
  });

  assert.equal(record.airportCode, 'LIM');
  assert.equal(record.terminal, 'International & Domestic Terminal');
  assert.equal(record.near, 'Arrivals area');
  assert.equal(record.openHours.length, 7);
});
