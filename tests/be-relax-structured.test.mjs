import test from 'node:test';
import assert from 'node:assert/strict';

import { parseBeRelaxStructuredRecords } from '../scripts/lib/be-relax-structured.mjs';

function page(rows) {
  return `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: {
      pageProps: {
        hydrationData: {
          airports: [
            {
              continent: 'North America',
              list: rows,
            },
          ],
        },
      },
    },
  })}</script>`;
}

test('Be Relax parser extracts official terminal, gate, and daily hours', () => {
  const records = parseBeRelaxStructuredRecords(
    page([
      {
        fullName: 'Atlanta International Airport Terminal B Gate 22',
        shortTitle: 'ATL',
        link: '/find-us/atlanta-international-airport/atlanta-international-airport-terminal-b-gate-22',
        country: 'United States of America',
        locations: { lat: '33.6400325', lng: '-84.4491378' },
        skyCat: { name: 'Atlanta International Airport' },
        booktime: 'Mon 7am-10pm; Tue 7am-10pm; Wed 7am-10pm; Thu 7am-10pm; Fri 7am-10pm; Sat 7am-10pm; Sun 7am-10pm',
        text: 'Terminal B Gate 22',
        slug: 'atlanta-international-airport-terminal-b-gate-22',
      },
    ]),
  );

  assert.equal(records.length, 1);
  assert.equal(records[0].airportCode, 'ATL');
  assert.equal(records[0].airportName, 'Atlanta International Airport');
  assert.equal(records[0].name, 'Be Relax Spa ATL Terminal B Gate 22');
  assert.equal(records[0].terminal, 'Terminal B');
  assert.equal(records[0].near, 'Terminal B Gate 22');
  assert.deepEqual(records[0].airportCoordinates, { lat: 33.6400325, lon: -84.4491378 });
  assert.equal(records[0].sourceUrl, 'https://berelax.com/find-us/atlanta-international-airport/atlanta-international-airport-terminal-b-gate-22');
  assert.equal(records[0].openHours.length, 7);
  assert.deepEqual(records[0].openHours.find((row) => row.Day === 1), {
    Day: 1,
    OpeningHour: '07:00',
    ClosingHour: '22:00',
  });
});

test('Be Relax parser handles 7/7 hours and airport-code typo with explicit Charlotte evidence', () => {
  const records = parseBeRelaxStructuredRecords(
    page([
      {
        fullName: 'Charlotte Douglas International Airport Connector D',
        shortTitle: 'CLA',
        link: '/find-us/charlotte-douglas-international-airport/charlotte-douglas-international-airport-connector-d-e',
        country: 'United States of America',
        locations: { lat: '35.214', lng: '-80.943' },
        skyCat: { name: 'Charlotte Douglas International Airport' },
        booktime: 'Mon 7am-10pm; Tue 7am-10pm; Wed 7am-10pm; Thu 7am-10pm; Fri 7am-10pm; Sat 7am-10pm; Sun 7am-10pm',
        text: 'Connector D',
        slug: 'charlotte-douglas-international-airport-connector-d-e',
      },
      {
        fullName: 'Changi Airport Terminal 3 Gate A1',
        shortTitle: 'SIN',
        link: '/find-us/changi-airport/changi-airport-teminal-3-gate-a1',
        country: 'Singapore',
        locations: { lat: '1.3573944', lng: '103.9793151' },
        skyCat: { name: 'Changi Airport' },
        booktime: '7/7 6 am to 1am',
        text: 'Terminal 3 Gate A1',
        slug: 'changi-airport-teminal-3-gate-a1',
      },
    ]),
  );

  const charlotte = records.find((record) => record.near === 'Connector D');
  const singapore = records.find((record) => record.airportCode === 'SIN');

  assert.equal(charlotte.airportCode, 'CLT');
  assert.equal(charlotte.terminal, 'Connector D');
  assert.equal(singapore.terminal, 'Terminal 3');
  assert.deepEqual(singapore.openHours.find((row) => row.Day === 1), {
    Day: 1,
    OpeningHour: '06:00',
    ClosingHour: '01:00',
  });
});

test('Be Relax parser converts explicit full-day time arrays to all-day hours', () => {
  const time = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => ({
    day,
    time: ['00:00', '00:30', '23:30', '24:00'],
  }));

  const records = parseBeRelaxStructuredRecords(
    page([
      {
        fullName: 'Dubai International Airport Terminal 3 Concourse B Gate 10',
        shortTitle: 'DXB',
        link: '/find-us/dubai-international-airport/dubai-international-airport-terminal-3-concourse-b-gate-10',
        country: 'United Arab Emirates',
        locations: { lat: '25.2532', lng: '55.3657' },
        skyCat: { name: 'Dubai International Airport' },
        booktime: 'Mon 0am-0pm; Tue 0am-0pm; Wed 0am-0pm; Thu 0am-0pm; Fri 0am-0pm; Sat 0am-0pm; Sun 0am-0pm',
        text: 'Terminal 3 Concourse B Gate 10',
        slug: 'dubai-international-airport-terminal-3-concourse-b-gate-10',
        time,
      },
    ]),
  );

  assert.equal(records.length, 1);
  assert.equal(records[0].terminal, 'Terminal 3');
  assert.equal(records[0].concourse, 'Concourse B');
  assert.equal(records[0].openHours.length, 7);
  assert.equal(records[0].openHours.every((row) => row.OpenAllDay), true);
});
