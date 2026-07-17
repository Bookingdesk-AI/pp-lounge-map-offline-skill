import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseAspireAirportLinks,
  parseAspireAirportRecords,
} from '../scripts/lib/aspire-lounges-structured.mjs';

test('Aspire index parser extracts unique official airport pages', () => {
  const links = parseAspireAirportLinks(
    `
      <a href="/airports/birmingham-airport/">Birmingham</a>
      <a href="/airports/edinburgh-airport/">Edinburgh</a>
      <a href="/airports/birmingham-airport/">Birmingham again</a>
      <a href="/airport-lounges/birmingham-airport-aspire-lounge/">Detail</a>
    `,
    { url: 'https://www.aspirelounges.com/airport-lounges/' },
  );

  assert.deepEqual(links, [
    'https://www.aspirelounges.com/airports/birmingham-airport/',
    'https://www.aspirelounges.com/airports/edinburgh-airport/',
  ]);
});

test('Aspire airport parser preserves lounge-level price, hours, and position evidence', () => {
  const records = parseAspireAirportRecords(
    `
      <script>display_currency: 'GBP'</script>
      <h1>Birmingham Airport (BHX)</h1>
      <h2><a href="/airport-lounges/birmingham-airport-aspire-lounge-south-terminal/">Aspire Lounge (Gate 1)</a></h2>
      <div x-data="{ activeSeason: \`April - October\` }">
        <table>
          <tr><td>Monday</td><td>03:30 - 20:30</td></tr>
          <tr><td>Tuesday</td><td>03:30 - 18:00</td></tr>
          <tr><td>Wednesday</td><td>03:30 - 20:00</td></tr>
          <tr><td>Thursday</td><td>03:30 - 19:30</td></tr>
          <tr><td>Friday</td><td>03:30 - 20:30</td></tr>
          <tr><td>Saturday</td><td>03:30 - 17:30</td></tr>
          <tr><td>Sunday</td><td>03:30 - 20:00</td></tr>
        </table>
        <div x-show="activeSeason == \`November - December\`">
          <table>
            <tr><td>Monday</td><td>04:00 - 18:00</td></tr>
            <tr><td>Tuesday</td><td>04:00 - 18:00</td></tr>
          </table>
        </div>
      </div>
      <p>Prices From</p><p>£42 per person <span>(inc. taxes)</span></p>
    `,
    { url: 'https://www.aspirelounges.com/airports/birmingham-airport/' },
  );

  assert.equal(records.length, 1);
  assert.equal(records[0].airportCode, 'BHX');
  assert.equal(records[0].name, 'Aspire Lounge (Gate 1)');
  assert.equal(records[0].terminal, 'South Terminal');
  assert.equal(records[0].near, 'South Terminal, Gate 1');
  assert.match(records[0].hoursText, /^April - October: Mon 03:30-20:30;/);
  assert.match(records[0].hoursText, /November - December: Mon 04:00-18:00; Tue 04:00-18:00/);
  assert.deepEqual(records[0].price, {
    amount: 42,
    currency: 'GBP',
    label: 'Prices from per person',
    sourceUrl: 'https://www.aspirelounges.com/airport-lounges/birmingham-airport-aspire-lounge-south-terminal/',
  });
});

test('Aspire parser preserves gate zones and partner product ownership', () => {
  const records = parseAspireAirportRecords(
    `
      <script>display_currency: 'GBP'</script>
      <h1>Manchester Airport (MAN)</h1>
      <h2><a href="/airport-lounges/manchester-airport-aspire-lounge-terminal-2-c-gates/">Aspire (C Gates)</a></h2>
      <table><tr><td>Monday</td><td>04:00 - 22:00</td></tr></table>
      <p>Prices From £46 per person</p>
      <h2><a href="/airport-lounges/manchester-airport-no1-lounge-terminal-2/">No1 Lounge Terminal 2</a></h2>
      <table><tr><td>Monday</td><td>05:00 - 21:00</td></tr></table>
      <p>Prices From £42 per person</p>
    `,
    { url: 'https://www.aspirelounges.com/airports/manchester-airport/' },
  );

  assert.equal(records[0].terminal, 'Terminal 2');
  assert.equal(records[0].near, 'Terminal 2, C Gates');
  assert.equal(records[1].brand, 'No1 Lounges');
  assert.equal(records[1].operator, 'No1 Lounges');
});

test('Aspire parser folds duration booking variants into the physical lounge', () => {
  const records = parseAspireAirportRecords(
    `
      <script>display_currency: 'GBP'</script>
      <h1>Melbourne Airport (MEL)</h1>
      <h2><a href="/airport-lounges/melbourne-airport-aspire-lounges/">Aspire Executive Lounge</a></h2>
      <table><tr><td>Monday</td><td>07:00 - 00:45</td></tr></table>
      <p>Prices From £36 per person</p>
      <h2><a href="/airport-lounges/1hr-melbourne-airport-aspire-executive-lounge/">Aspire Executive Lounge (1 Hour Stay)</a></h2>
      <table><tr><td>Monday</td><td>07:00 - 00:45</td></tr></table>
      <p>Prices From £20 per person</p>
      <h2><a href="/airport-lounges/2hr-melbourne-airport-aspire-executive-lounge/">Aspire Executive Lounge (2 Hour Stay)</a></h2>
      <table><tr><td>Monday</td><td>07:00 - 00:45</td></tr></table>
      <p>Prices From £27 per person</p>
    `,
    { url: 'https://www.aspirelounges.com/airports/melbourne-airport/' },
  );

  assert.equal(records.length, 1);
  assert.equal(records[0].name, 'Aspire Executive Lounge');
  assert.equal(records[0].price, undefined);
  assert.deepEqual(
    records[0].prices.map((price) => [price.amount, price.label, price.sourceUrl]),
    [
      [36, 'Prices from per person', 'https://www.aspirelounges.com/airport-lounges/melbourne-airport-aspire-lounges/'],
      [20, '1-hour stay', 'https://www.aspirelounges.com/airport-lounges/1hr-melbourne-airport-aspire-executive-lounge/'],
      [27, '2-hour stay', 'https://www.aspirelounges.com/airport-lounges/2hr-melbourne-airport-aspire-executive-lounge/'],
    ],
  );
});
