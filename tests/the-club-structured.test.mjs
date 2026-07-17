import test from 'node:test';
import assert from 'node:assert/strict';

import { createNonPriorityCandidateRecords } from '../scripts/lib/source-candidates.mjs';
import { mergeTheClubDetailRecord, parseTheClubStructuredRecords } from '../scripts/lib/the-club-structured.mjs';

test('The Club parser extracts official lounge hours and price from React Flight rows', () => {
  const html = String.raw`<script>self.__next_f.push([1,"1:{}\n2:{}\n3:{}\n4:[]\n5:{\"data\":\"$3\",\"marks\":\"$4\",\"value\":\"Hartsfield Jackson Atlanta International Airport, Concourse F\",\"nodeType\":\"text\"}\n6:[\"$5\"]\n7:{\"data\":\"$2\",\"content\":\"$6\",\"nodeType\":\"paragraph\"}\n8:[\"$7\"]\n9:{\"data\":\"$1\",\"content\":\"$8\",\"nodeType\":\"document\"}\na:{\"json\":\"$9\"}\nb:[]\nc:{\"items\":\"$b\"}\nd:[\"6-22\"]\ne:[\"6-22\"]\nf:[\"6-22\"]\n10:[\"6-22\"]\n11:[\"6-22\"]\n12:[\"6-22\"]\n13:[\"6-22\"]\n14:{\"amount\":\"50.0\",\"currencyCode\":\"USD\"}\n15:{\"US\":\"$14\"}\n16:{\"id\":\"gid://shopify/Product/6708250378398\",\"title\":\"The Club ATL\",\"prices\":\"$15\"}\n17:{\"__typename\":\"Club\",\"address\":\"$a\",\"specificDates\":\"$c\",\"title\":\"ATL  |  Atlanta\",\"description\":\"Concourse F\",\"slug\":\"atl-the-club-concourse-f\",\"mondayOpeningHours\":\"$d\",\"tuesdayOpeningHours\":\"$e\",\"wednesdayOpeningHours\":\"$f\",\"thursdayOpeningHours\":\"$10\",\"fridayOpeningHours\":\"$11\",\"saturdayOpeningHours\":\"$12\",\"sundayOpeningHours\":\"$13\",\"shopifyProductData\":\"$16\"}\n"])</script>`;

  const records = parseTheClubStructuredRecords(html);

  assert.equal(records.length, 1);
  assert.equal(records[0].airportCode, 'ATL');
  assert.equal(records[0].name, 'The Club ATL');
  assert.equal(records[0].airportName, 'Hartsfield Jackson Atlanta International Airport');
  assert.equal(records[0].terminal, 'Concourse F');
  assert.equal(records[0].concourse, 'Concourse F');
  assert.equal(records[0].openHours.length, 7);
  assert.deepEqual(records[0].openHours[0], {
    Day: 1,
    OpeningHour: '06:00',
    ClosingHour: '22:00',
  });
  assert.equal(records[0].shopifyProductData.prices.US.amount, '50.0');
  assert.equal(records[0].shopifyProductData.prices.US.currencyCode, 'USD');
  assert.equal(records[0].sourceUrl, 'https://www.theclubairportlounges.com/lounges/atl-the-club-concourse-f');
});

test('The Club parser treats SJC A15 as a gate within Terminal A', () => {
  const html = String.raw`<script>self.__next_f.push([1,"1:{}\n2:{}\n3:{}\n4:[]\n5:{\"data\":\"$3\",\"marks\":\"$4\",\"value\":\"San Jose International Airport, Terminal A\",\"nodeType\":\"text\"}\n6:[\"$5\"]\n7:{\"data\":\"$2\",\"content\":\"$6\",\"nodeType\":\"paragraph\"}\n8:[\"$7\"]\n9:{\"data\":\"$1\",\"content\":\"$8\",\"nodeType\":\"document\"}\na:{\"json\":\"$9\"}\nb:{\"amount\":\"55.0\",\"currencyCode\":\"USD\"}\nc:{\"US\":\"$b\"}\nd:{\"id\":\"gid://shopify/Product/1\",\"title\":\"The Club SJC, Terminal A15\",\"prices\":\"$c\"}\ne:{\"__typename\":\"Club\",\"address\":\"$a\",\"title\":\"SJC  |  San Jose\",\"description\":\"Terminal A15\",\"slug\":\"sjc-the-club-terminal-a15\",\"shopifyProductData\":\"$d\"}\n"])</script>`;

  const [record] = parseTheClubStructuredRecords(html);

  assert.equal(record?.terminal, 'Terminal A');
  assert.equal(record?.gate, 'Gate A15');
});

test('The Club detail merge preserves official gate directions', () => {
  const record = {
    name: 'The Club, SFO',
    near: 'Harvey Milk Terminal',
    accessNotes: 'Published Club Pass price and hours from the official The Club locations page.',
  };
  const html = `
    <main>
      <p>Located airside in Harvey Milk Terminal 1. After security, follow signs to terminal B gates, just before gate B4 on the right. Address: San Francisco International Airport.</p>
    </main>
  `;

  const merged = mergeTheClubDetailRecord(record, html);

  assert.equal(
    merged.near,
    'airside in Harvey Milk Terminal 1. After security, follow signs to terminal B gates, just before gate B4 on the right.',
  );
  assert.match(merged.accessNotes, /Official detail page publishes/);
});

test('The Club candidate conversion extracts official Shopify variant prices', () => {
  const records = createNonPriorityCandidateRecords({
    generatedAt: '2026-07-14T00:00:00.000Z',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-84.4277, 33.6407] },
        properties: {
          airportCode: 'ATL',
          airportName: 'Hartsfield Jackson Atlanta International Airport',
          city: 'Atlanta',
          country: 'United States',
        },
      },
    ],
    report: {
      generatedAt: '2026-07-14T00:00:00.000Z',
      sources: [
        {
          sourceId: 'airport-dimensions',
          status: 'fetched',
          finalUrl: 'https://www.theclubairportlounges.com/locations',
          structuredRecords: [
            {
              sourceRecordId: 'ATL-the-club-concourse-f',
              name: 'The Club ATL',
              airportCode: 'ATL',
              airportName: 'Hartsfield Jackson Atlanta International Airport',
              terminal: 'Concourse F',
              operator: 'Airport Dimensions / The Club',
              openHours: [{ Day: 1, OpeningHour: '06:00', ClosingHour: '22:00' }],
              sourceUrl: 'https://www.theclubairportlounges.com/lounges/atl-the-club-concourse-f',
              shopifyProductData: {
                title: 'The Club ATL',
                variants: [
                  {
                    id: 'gid://shopify/ProductVariant/1',
                    price: { amount: '50.0', currencyCode: 'USD' },
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  });

  assert.equal(records.length, 1);
  assert.deepEqual(records[0].accessOffers, [
    {
      type: 'paid_entry',
      label: 'USD 50',
      amount: 50,
      currency: 'USD',
      sourceId: 'airport-dimensions',
      url: 'https://www.theclubairportlounges.com/lounges/atl-the-club-concourse-f',
      retrievedAt: '2026-07-14T00:00:00.000Z',
    },
  ]);
  assert.ok(records[0].sources[0].fieldCoverage.includes('access.accessOffers'));
});

test('The Club candidate conversion treats official lounge levels as near-position evidence', () => {
  const records = createNonPriorityCandidateRecords({
    generatedAt: '2026-07-14T00:00:00.000Z',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-84.4277, 33.6407] },
        properties: {
          airportCode: 'ATL',
          airportName: 'Hartsfield Jackson Atlanta International Airport',
          city: 'Atlanta',
          country: 'United States',
        },
      },
    ],
    report: {
      generatedAt: '2026-07-14T00:00:00.000Z',
      sources: [
        {
          sourceId: 'airport-dimensions',
          status: 'fetched',
          finalUrl: 'https://www.theclubairportlounges.com/locations',
          structuredRecords: [
            {
              sourceRecordId: 'ATL-the-club-concourse-f',
              name: 'The Club ATL',
              airportCode: 'ATL',
              airportName: 'Hartsfield Jackson Atlanta International Airport',
              terminal: 'Concourse F',
              near: 'in Concourse F on the Mezzanine level',
              operator: 'Airport Dimensions / The Club',
              openHours: [{ Day: 1, OpeningHour: '06:00', ClosingHour: '22:00' }],
              sourceUrl: 'https://www.theclubairportlounges.com/lounges/atl-the-club-concourse-f',
            },
          ],
        },
      ],
    },
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].location.gate, 'Mezzanine Level');
  assert.ok(records[0].sources[0].fieldCoverage.includes('location.gate'));
});

test('The Club candidate conversion rejects list entries redirected to another operator', () => {
  const records = createNonPriorityCandidateRecords({
    generatedAt: '2026-07-16T00:00:00.000Z',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-0.1821, 51.1537] },
        properties: {
          airportCode: 'LGW',
          airportName: 'London Gatwick Airport',
          city: 'London',
          country: 'United Kingdom',
        },
      },
    ],
    report: {
      generatedAt: '2026-07-16T00:00:00.000Z',
      sources: [
        {
          sourceId: 'airport-dimensions',
          status: 'fetched',
          finalUrl: 'https://www.theclubairportlounges.com/lounges',
          structuredApi: {
            pages: [
              {
                url: 'https://www.theclubairportlounges.com/lounges/lgw-club-aspire-south-terminal',
                finalUrl: 'https://no1lounges.com/locations/london-gatwick/',
              },
            ],
          },
          structuredRecords: [
            {
              sourceRecordId: 'LGW-lgw-club-aspire-south-terminal',
              name: 'The Club LGW',
              airportCode: 'LGW',
              terminal: 'North & South Terminal',
              sourceUrl: 'https://www.theclubairportlounges.com/lounges/lgw-club-aspire-south-terminal',
            },
          ],
        },
      ],
    },
  });

  assert.equal(records.length, 0);
});
