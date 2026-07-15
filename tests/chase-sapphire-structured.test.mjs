import test from 'node:test';
import assert from 'node:assert/strict';

import { parseChaseSapphireLoungeRecords } from '../scripts/lib/chase-sapphire-structured.mjs';

function nextDataHtml(cards) {
  return `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: {
      pageProps: {
        modules: cards.map((card) => ({
          values: {
            title: card.title,
            bodyCopy: card.bodyCopy,
            links: card.links ?? [],
          },
        })),
      },
    },
  })}</script>`;
}

test('Chase parser extracts active official lounge cards with hours and location evidence', () => {
  const records = parseChaseSapphireLoungeRecords(
    nextDataHtml([
      {
        title: 'Boston Logan International Airport (BOS)',
        bodyCopy:
          'Boston Logan International Airport (BOS) Terminal B - near gate B40. 5 a.m. - 11 p.m. daily',
        links: [{ url: '/sapphire-cards/lounges/bos' }],
      },
      {
        title: 'The Etihad Lounge - IAD',
        bodyCopy:
          'Washington Dulles International Airport (IAD) Concourse A - near gate A14. 6 a.m. - 10 p.m. daily',
        links: [{ url: 'https://account.chase.com/sapphire-airport-lounge/iad' }],
      },
      {
        title: 'John F. Kennedy International Airport (JFK)',
        bodyCopy:
          'Chase Sapphire Lounge by The Club with Etihad Airways John F. Kennedy International Airport (JFK) Terminal 4 - near gate A2. 5 a.m. - 11 p.m. daily',
        links: [{ url: '/sapphire-cards/lounges/jfk' }],
      },
      {
        title: 'Dallas-Fort Worth International Airport (DFW)',
        bodyCopy: 'Dallas-Fort Worth International Airport (DFW) Coming soon.',
      },
    ]),
    { url: 'https://account.chase.com/sapphire-airport-lounge' },
  );

  assert.equal(records.length, 3);

  const bos = records.find((record) => record.airportCode === 'BOS');
  assert.equal(bos.name, 'Chase Sapphire Lounge by The Club');
  assert.equal(bos.terminal, 'Terminal B');
  assert.equal(bos.near.includes('near gate B40'), true);
  assert.equal(bos.sourceUrl, 'https://account.chase.com/sapphire-cards/lounges/bos');
  assert.deepEqual(bos.openHours[0], { Day: 1, OpeningHour: '05:00', ClosingHour: '23:00' });
  assert.equal(bos.openHours.length, 7);

  const iad = records.find((record) => record.airportCode === 'IAD');
  assert.equal(iad.name, 'The Etihad Lounge');
  assert.equal(iad.brand, 'The Etihad Lounge');
  assert.equal(iad.terminal, 'Concourse A');
  assert.equal(iad.near.includes('gate A14'), true);
  assert.deepEqual(iad.openHours[0], { Day: 1, OpeningHour: '06:00', ClosingHour: '22:00' });

  const jfk = records.find((record) => record.airportCode === 'JFK');
  assert.equal(jfk.name, 'Chase Sapphire Lounge by The Club with Etihad Airways');
  assert.equal(jfk.brand, 'Chase Sapphire Lounge by The Club');
  assert.equal(jfk.terminal, 'Terminal 4');
  assert.equal(jfk.near.includes('gate A2'), true);

  assert.equal(records.some((record) => record.airportCode === 'DFW'), false);
});

test('Chase parser ignores pages without Next location cards', () => {
  assert.deepEqual(parseChaseSapphireLoungeRecords('<p>Chase Sapphire</p>'), []);
});
