import test from 'node:test';
import assert from 'node:assert/strict';

import { parseNo1StructuredRecords } from '../scripts/lib/no1-lounges-structured.mjs';

test('No1 parser extracts official lounge cards with price and daily hours', () => {
  const page = {
    components: [
      {
        __typename: 'LocationsLounges',
        locations: [
          {
            label: 'Terminal 3',
            lounges: [
              {
                loungeName: 'Clubrooms at Heathrow T3',
                url: '/lounges-by-location/clubrooms-at-heathrow-t3/',
                priceInformation: 'Prices from: £48',
                openingTimesInformation: 'Open daily from 05:00 to 21:00',
                description: 'Hosted table service and Wi-Fi.',
              },
            ],
          },
        ],
      },
    ],
  };
  const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: { pageProps: { page } },
  })}</script>`;

  const records = parseNo1StructuredRecords(html, {
    url: 'https://no1lounges.com/locations/london-heathrow/',
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].airportCode, 'LHR');
  assert.equal(records[0].name, 'Clubrooms at Heathrow T3');
  assert.equal(records[0].brand, 'Clubrooms');
  assert.equal(records[0].terminal, 'Terminal 3');
  assert.deepEqual(records[0].price, {
    amount: 48,
    currencyCode: 'GBP',
  });
  assert.equal(records[0].openHours.length, 7);
  assert.equal(records[0].openHours[0].OpeningHour, '05:00');
  assert.equal(records[0].openHours[0].ClosingHour, '21:00');
  assert.equal(records[0].sourceUrl, 'https://no1lounges.com/lounges-by-location/clubrooms-at-heathrow-t3/');
});

test('No1 parser maps partner lounge names to conservative airport codes', () => {
  const page = {
    components: [
      {
        __typename: 'LocationsLounges',
        locations: [
          {
            label: 'Partner Lounges',
            lounges: [
              {
                loungeName: 'The Club ATL at Atlanta',
                url: '/lounges-by-location/the-club-at-atlanta/',
                priceInformation: 'Prices from: £42.00',
                openingTimesInformation: 'Open daily from 06:00 to 22:00',
                description: 'The Club ATL at Atlanta Concourse F.',
              },
              {
                loungeName: 'Aspire at Manchester Terminal 2',
                url: '/lounges-by-location/aspire-at-manchester-terminal-2/',
                priceInformation: 'Prices from: £46',
                openingTimesInformation: 'Open daily from 04:00 to 20:00',
                description: 'Manchester Airport Terminal 2.',
              },
            ],
          },
        ],
      },
    ],
  };
  const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: { pageProps: { page } },
  })}</script>`;

  const records = parseNo1StructuredRecords(html, {
    url: 'https://no1lounges.com/partner-lounges/',
  });

  assert.equal(records.length, 2);
  assert.equal(records.find((record) => record.name.includes('ATL')).airportCode, 'ATL');
  assert.equal(records.find((record) => record.name.includes('Manchester')).airportCode, 'MAN');
  assert.equal(records.find((record) => record.name.includes('ATL')).brand, 'The Club');
  assert.equal(records.find((record) => record.name.includes('Manchester')).brand, 'Aspire Lounges');
});

test('No1 parser preserves official opening-only hours text', () => {
  const page = {
    components: [
      {
        __typename: 'LocationsLounges',
        locations: [
          {
            label: 'Partner Lounges',
            lounges: [
              {
                loungeName: 'Aspire at Belfast Airport',
                url: '/lounges-by-location/aspire-at-belfast/',
                priceInformation: 'Prices from: £46',
                openingTimesInformation: 'Open daily from 05:00 AM',
                description: 'Belfast City Airport lounge.',
              },
            ],
          },
        ],
      },
    ],
  };
  const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: { pageProps: { page } },
  })}</script>`;

  const records = parseNo1StructuredRecords(html, {
    url: 'https://no1lounges.com/partner-lounges/',
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].airportCode, 'BHD');
  assert.deepEqual(records[0].openHours, []);
  assert.equal(records[0].hoursText, 'Open daily from 05:00');
  assert.equal(records[0].terminal, '');
});

test('No1 parser derives Gatwick direction from the product name before section labels', () => {
  const page = {
    components: [
      {
        locations: [
          {
            label: 'Terminal A',
            lounges: [
              {
                loungeName: 'Club Aspire at Gatwick South',
                url: '/lounges-by-location/club-aspire-at-gatwick-south/',
                priceInformation: 'Prices from: £34',
                openingTimesInformation: 'Open daily from 04:00 to 20:00',
                description: 'Gatwick Airport lounge.',
              },
            ],
          },
        ],
      },
    ],
  };
  const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: { pageProps: { page } },
  })}</script>`;

  const [record] = parseNo1StructuredRecords(html, {
    url: 'https://no1lounges.com/locations/london-gatwick/',
  });

  assert.equal(record.terminal, 'South Terminal');
});
