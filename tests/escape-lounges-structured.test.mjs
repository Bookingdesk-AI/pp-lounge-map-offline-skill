import test from 'node:test';
import assert from 'node:assert/strict';

import { parseEscapeLoungeStructuredRecord } from '../scripts/lib/escape-lounges-structured.mjs';

test('Escape Lounges parser extracts official price, hours, and gate text', () => {
  const html = `
    <html>
      <head><title>Cincinnati-Northern Kentucky Airport Lounge (CVG) | Escape Lounges</title></head>
      <body>
        <section>From $45.00 per person Walk-up price $60.00 Mon - Sun | 5:00am - 9:30pm</section>
        <section>Our new space is near Gate B12.</section>
      </body>
    </html>
  `;

  const record = parseEscapeLoungeStructuredRecord(html, {
    url: 'https://escapelounges.com/us/airport-lounges/cincinnati-northern-kentucky/',
  });

  assert.equal(record.airportCode, 'CVG');
  assert.equal(record.name, 'Escape Lounge - CVG');
  assert.equal(record.near, 'near Gate B12');
  assert.deepEqual(record.price, {
    amount: 45,
    currencyCode: 'USD',
  });
  assert.equal(record.openHours.length, 7);
  assert.equal(record.openHours[1].OpeningHour, '05:00');
  assert.equal(record.openHours[1].ClosingHour, '21:30');
});

test('Escape Lounges parser ignores pages without an airport code', () => {
  const record = parseEscapeLoungeStructuredRecord('<title>Airport Lounges | Escape Lounges</title>', {
    url: 'https://escapelounges.com/airport-lounges/',
  });

  assert.equal(record, null);
});

test('Escape Lounges parser skips aggregate airport lounge pages', () => {
  const record = parseEscapeLoungeStructuredRecord('<title>Phoenix Sky Harbor Intl Airport (PHX) Lounges | Escape Lounges</title>', {
    url: 'https://escapelounges.com/us/airport-lounges/phoenix/',
  });

  assert.equal(record, null);
});

test('Escape Lounges parser extracts terminal from title or URL', () => {
  const fromTitle = parseEscapeLoungeStructuredRecord(
    '<title>Sacramento Intl Airport (SMF) Terminal A Lounge | Escape Lounges</title><body>From $45.00 per person</body>',
    {
      url: 'https://escapelounges.com/us/airport-lounges/sacramento/terminal-a/',
    },
  );
  const fromUrl = parseEscapeLoungeStructuredRecord(
    '<title>Phoenix Sky Harbor Intl Airport (PHX) Lounge | Escape Lounges</title><body>From $45.00 per person</body>',
    {
      url: 'https://escapelounges.com/us/airport-lounges/phoenix/terminal-4/',
    },
  );

  assert.equal(fromTitle.terminal, 'Terminal A');
  assert.equal(fromUrl.terminal, 'Terminal 4');
});

test('Escape Lounges parser preserves official sub-brand names and canonical URLs', () => {
  const essence = parseEscapeLoungeStructuredRecord(
    '<title>London Stansted Airport Essence by Escape Lounges (STN) | Escape Lounges</title><body>From £25.99 per person</body>',
    {
      url: 'https://escapelounges.com/uk/airport-lounges/london-stansted/essence/#airlines',
    },
  );
  const executive = parseEscapeLoungeStructuredRecord(
    '<title>Manchester Airport The Executive by Escape Lounges (MAN) | Escape Lounges</title><body>From £57.99 per person</body>',
    {
      url: 'https://escapelounges.com/uk/airport-lounges/manchester/terminal-2/executive/',
    },
  );

  assert.equal(essence.name, 'Essence by Escape Lounges - STN');
  assert.equal(essence.sourceUrl, 'https://escapelounges.com/uk/airport-lounges/london-stansted/essence/');
  assert.equal(executive.name, 'The Executive by Escape Lounges - MAN');
});

test('Escape Lounges parser accepts official dot-separated and split weekday hours', () => {
  const daily = parseEscapeLoungeStructuredRecord(
    '<title>Bradley Intl Airport (BDL) Lounge | Escape Lounges</title><body>From $45.00 per person Mon - Sun | 4.30am - 8pm</body>',
    {
      url: 'https://escapelounges.com/us/airport-lounges/bradley/',
    },
  );
  const split = parseEscapeLoungeStructuredRecord(
    '<title>Reno-Tahoe Intl Airport (RNO) Lounge | Escape Lounges</title><body>From $45.00 per person Mon, Tues, Wed, Sat &amp; Sun | 4:30am - 8:00pm, Thurs &amp; Fri | 4.30am - 10:00pm</body>',
    {
      url: 'https://escapelounges.com/us/airport-lounges/reno-tahoe/',
    },
  );
  const toSeparator = parseEscapeLoungeStructuredRecord(
    '<title>London Stansted Airport Essence by Escape Lounges (STN) | Escape Lounges</title><body>From £25.99 per person Mon to Sun | 4.45am to 8.15pm</body>',
    {
      url: 'https://escapelounges.com/uk/airport-lounges/london-stansted/essence/',
    },
  );
  const openDaily = parseEscapeLoungeStructuredRecord(
    '<title>Manchester Airport (MAN) Terminal 2 Lounge | Escape Lounges</title><body>From £41.99 per person Open daily from 3am - 8:30pm</body>',
    {
      url: 'https://escapelounges.com/uk/airport-lounges/manchester/terminal-2/escape/',
    },
  );

  assert.equal(daily.openHours.length, 7);
  assert.equal(daily.openHours[0].OpeningHour, '04:30');
  assert.equal(daily.openHours[0].ClosingHour, '20:00');
  assert.equal(split.openHours.length, 7);
  assert.equal(split.openHours.find((slot) => slot.Day === 4).ClosingHour, '22:00');
  assert.equal(split.openHours.find((slot) => slot.Day === 5).ClosingHour, '22:00');
  assert.equal(toSeparator.openHours.length, 7);
  assert.equal(toSeparator.openHours[1].OpeningHour, '04:45');
  assert.equal(toSeparator.openHours[1].ClosingHour, '20:15');
  assert.equal(openDaily.openHours.length, 7);
  assert.equal(openDaily.openHours[0].OpeningHour, '03:00');
  assert.equal(openDaily.openHours[0].ClosingHour, '20:30');
});
