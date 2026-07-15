import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractPlazaPremiumFindUrls,
  parsePlazaPremiumStructuredRecords,
} from '../scripts/lib/plaza-premium-structured.mjs';

test('Plaza Premium parser extracts current official find URLs from navigation', () => {
  const html = `
    <nav>
      <a href="/en-uk/find/asia/australia/brisbane">Brisbane (BNE)</a>
      <a href="/en-uk/find/asia/australia/brisbane">Brisbane duplicate</a>
      <a href="https://www.plazapremiumlounge.com/en-uk/find/asia/singapore/singapore">Singapore (SIN)</a>
      <a href="/en-uk/airport-lounge-passes">Passes</a>
    </nav>
  `;

  assert.deepEqual(extractPlazaPremiumFindUrls(html), [
    'https://www.plazapremiumlounge.com/en-uk/find/asia/australia/brisbane',
    'https://www.plazapremiumlounge.com/en-uk/find/asia/singapore/singapore',
  ]);
});

test('Plaza Premium parser extracts official airport page lounge cards', () => {
  const html = `
    <html>
      <head>
        <title>Lounges in Cleveland | Cleveland Hopkins International Airport (CLE) | Plaza Premium Lounge</title>
      </head>
      <body>
        <a href="/en-uk/find/americas/united-states-of-america/cleveland-hopkins-international-airport-cle/cleveland-hopkins-international-airport-cle/vino-volo-terminal-b-gate-b2?propertycode=PRPRTY704"
           class="lounge-title loungedirect">
          <h3>Vino Volo</h3>
        </a>
        <span class="flight-details">Concourse B, Gate B2, Cleveland Hopkins International Airport</span>
        Airport dining services available
        <div class="lounge-tags mb-3">
          <span class="tag pink xs">Bar</span>
          <span class="tag pink xs">Charging Station</span>
          <span class="tag pink xs">Food &amp; Beverage</span>
          <span class="tag pink xs">Wi-Fi</span>
        </div>
      </body>
    </html>
  `;

  const records = parsePlazaPremiumStructuredRecords(html, {
    url: 'https://www.plazapremiumlounge.com/en-uk/find/americas/united-states-of-america/cleveland-hopkins-international-airport-cle',
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].airportCode, 'CLE');
  assert.equal(records[0].name, 'Vino Volo');
  assert.equal(records[0].operator, 'Plaza Premium Lounge');
  assert.equal(records[0].airportName, 'Cleveland Hopkins International Airport');
  assert.equal(records[0].terminal, 'Concourse B');
  assert.equal(records[0].concourse, 'Concourse B');
  assert.match(records[0].near, /Gate B2/);
  assert.equal(records[0].amenities['Food & Beverage'], true);
  assert.equal(records[0].price, null);
  assert.match(records[0].sourceUrl, /vino-volo-terminal-b-gate-b2/);
});

test('Plaza Premium parser extracts detail page price without inventing hours', () => {
  const html = `
    <html>
      <head>
        <title>Lounge in Cleveland | Vino Volo | Plaza Premium Lounge</title>
      </head>
      <body>
        <section class="pageTitle greyBg">
          <h2 class="title text-start mb-0">
            Vino Volo
            <small>Concourse B, Gate B2, Cleveland Hopkins International Airport (CLE)</small>
          </h2>
        </section>
        <div class="lounge-booking-price">
          <span>from</span>
          <b>USD 42.00</b>
        </div>
        <div class="lounge-tags mb-3">
          <span class="tag pink xs"><img alt="Bar"> Bar </span>
          <span class="tag pink xs"><img alt="Wi-Fi"> Wi-Fi </span>
        </div>
      </body>
    </html>
  `;

  const records = parsePlazaPremiumStructuredRecords(html, {
    url: 'https://www.plazapremiumlounge.com/en-uk/find/americas/united-states-of-america/cleveland-hopkins-international-airport-cle/cleveland-hopkins-international-airport-cle/vino-volo-terminal-b-gate-b2',
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].airportCode, 'CLE');
  assert.equal(records[0].terminal, 'Concourse B');
  assert.deepEqual(records[0].price, {
    amount: 42,
    currencyCode: 'USD',
  });
  assert.deepEqual(records[0].openHours, []);
});

test('Plaza Premium parser extracts list-page hours and excludes non-lounge services', () => {
  const html = `
    <html>
      <head>
        <title>Lounges in Dallas Fort Worth | Dallas Fort Worth International Airport (DFW) | Plaza Premium Lounge</title>
      </head>
      <body>
        <div class="lounge-details">
          <span class="time d-none d-md-block d-lg-block">0700 - 2200 Daily</span>
          <a href="/en-uk/find/americas/united-states-of-america/dallas-fort-worth/dfw-international-airport/ppfintdeptd?propertycode=PRPRTY1126&amp;currency=USD" class="lounge-title loungedirect">
            <h3>Plaza Premium First</h3>
          </a>
          <span class="flight-details">International Departures, Terminal D, Dallas Fort Worth International Airport</span>
          <span class="time d-none d-md-block d-lg-block">0700 - 2200 Daily</span>
          <span class="tag pink xs">Food &amp; Beverage</span>
          <div class="lounge-price">from <strong class="fs-5">USD 124.49</strong></div>
        </div>
        <div class="lounge-details">
          <span class="time d-none d-md-block d-lg-block">0500 - 2100 Daily</span>
          <a href="/en-uk/find/americas/united-states-of-america/dallas-fort-worth/dfw-international-airport/pplintdeptd?propertycode=PRPRTY1125&amp;currency=USD" class="lounge-title loungedirect">
            <h3>Plaza Premium Lounge</h3>
          </a>
          <span class="flight-details">International Departures, Terminal D, Dallas Fort Worth International Airport</span>
          <span class="tag pink xs">Wi-Fi</span>
          <div class="lounge-price">from <strong class="fs-5">USD 32.48</strong></div>
        </div>
        <div class="lounge-details">
          <a href="/en-uk/find/americas/united-states-of-america/dallas-fort-worth/dfw-international-airport/allways-airport-meet-greet" class="lounge-title loungedirect">
            <h3>ALLWAYS Airport Meet &amp; Greet and Porter Services</h3>
          </a>
          <span class="flight-details">Departures, Arrivals &amp; Transit Services, Dallas Fort Worth International Airport</span>
        </div>
      </body>
    </html>
  `;

  const records = parsePlazaPremiumStructuredRecords(html, {
    url: 'https://www.plazapremiumlounge.com/en-uk/find/americas/united-states-of-america/dallas-fort-worth',
  });

  assert.equal(records.length, 2);
  const first = records.find((record) => record.name === 'Plaza Premium First');
  const lounge = records.find((record) => record.name === 'Plaza Premium Lounge');
  assert.equal(first?.terminal, 'Terminal D');
  assert.deepEqual(first?.price, { amount: 124.49, currencyCode: 'USD' });
  assert.equal(first?.openHours.length, 7);
  assert.deepEqual(first?.openHours[0], {
    Day: 1,
    OpeningHour: '07:00',
    ClosingHour: '22:00',
  });
  assert.deepEqual(lounge?.price, { amount: 32.48, currencyCode: 'USD' });
});

test('Plaza Premium parser preserves official variable hours text', () => {
  const html = `
    <html>
      <head>
        <title>Lounges in Shanghai (PVG/SHA) | Shanghai Pudong International Airport (PVG) | Plaza Premium Lounge</title>
      </head>
      <body>
        <div class="lounge-details">
          <span class="time d-none d-md-block d-lg-block">0530 till the last flight daily</span>
          <a href="/en-uk/find/china-regions/mainland-china/shanghai/shanghai-pudong-international-airport/no35-china-eastern" class="lounge-title loungedirect">
            <h3>No. 35 China Eastern Lounge</h3>
          </a>
          <span class="flight-details">Domestic Departures, Terminal 1, Shanghai Pudong International Airport</span>
          <div class="lounge-price">from <strong>CNY 230.00</strong></div>
        </div>
      </body>
    </html>
  `;

  const records = parsePlazaPremiumStructuredRecords(html, {
    url: 'https://www.plazapremiumlounge.com/en-uk/find/china-regions/mainland-china/shanghai',
  });

  assert.equal(records.length, 1);
  assert.deepEqual(records[0].openHours, []);
  assert.equal(records[0].hoursText, '0530 till the last flight daily');
});

test('Plaza Premium parser handles 2400 closing time', () => {
  const html = `
    <html>
      <head>
        <title>Bogota (BOG) | Plaza Premium Lounge</title>
      </head>
      <body>
        <div class="lounge-details">
          <span class="time d-none d-md-block d-lg-block">0330 - 2400 daily</span>
          <a href="/en-uk/find/americas/colombia/bogota/bogota-el-dorado-international-airport/avianca-bogota-gold-lounge-international-terminal" class="lounge-title loungedirect">
            <h3>Avianca Bogotá Gold Lounge</h3>
          </a>
          <span class="flight-details">International, El Dorado International Airport</span>
          <div class="lounge-price">from <strong>USD 50.09</strong></div>
        </div>
      </body>
    </html>
  `;

  const records = parsePlazaPremiumStructuredRecords(html, {
    url: 'https://www.plazapremiumlounge.com/en-uk/find/americas/colombia/bogota',
  });

  assert.equal(records.length, 1);
  assert.deepEqual(records[0].openHours[0], {
    Day: 1,
    OpeningHour: '03:30',
    ClosingHour: '24:00',
  });
  assert.equal(records[0].hoursText, '');
});

test('Plaza Premium parser ignores generic non-hour placeholders', () => {
  const html = `
    <html>
      <head>
        <title>Hamilton (BDA) | Plaza Premium Lounge</title>
      </head>
      <body>
        <div class="lounge-details">
          <span class="time d-none d-md-block d-lg-block">Please refer to lounge details section for operating hours</span>
          <a href="/en-uk/find/americas/bermuda/hamilton-bda/l-f-wade-international-airport-bda/primeclass_lou_int_dep" class="lounge-title loungedirect">
            <h3>Primeclass Lounge</h3>
          </a>
          <span class="flight-details">International Departures, L.F. Wade International Airport</span>
          <div class="lounge-price">from <strong>EUR 52.00</strong></div>
        </div>
      </body>
    </html>
  `;

  const records = parsePlazaPremiumStructuredRecords(html, {
    url: 'https://www.plazapremiumlounge.com/en-uk/find/americas/bermuda/hamilton-bda',
  });

  assert.equal(records.length, 1);
  assert.deepEqual(records[0].openHours, []);
  assert.equal(records[0].hoursText, '');
});

test('Plaza Premium parser separates multi-airport city pages by official airport name', () => {
  const html = `
    <html>
      <head>
        <title>Lounges in London (LHR/LGW) | London Heathrow Airport (LHR) | Plaza Premium Lounge</title>
      </head>
      <body>
        <div class="lounge-details">
          <span class="time d-none d-md-block d-lg-block">0400 - 2000 daily</span>
          <a href="/en-uk/find/europe/united-kingdom/london/london-heathrow-airport/international-arrivals-terminal-three" class="lounge-title loungedirect">
            <h3>Plaza Premium Lounge</h3>
          </a>
          <span class="flight-details">International Arrivals, Terminal 3, London Heathrow Airport</span>
          <div class="lounge-price">from <strong>GBP 22.00</strong></div>
        </div>
        <div class="lounge-details">
          <span class="time d-none d-md-block d-lg-block">0400 - 2000 daily</span>
          <a href="/en-uk/find/europe/united-kingdom/london/london-gatwick-airport/departures-north-terminal" class="lounge-title loungedirect">
            <h3>Plaza Premium Lounge</h3>
          </a>
          <span class="flight-details">Departures, North Terminal, London Gatwick Airport</span>
          <div class="lounge-price">from <strong>GBP 46.00</strong></div>
        </div>
      </body>
    </html>
  `;

  const records = parsePlazaPremiumStructuredRecords(html, {
    url: 'https://www.plazapremiumlounge.com/en-uk/find/europe/united-kingdom/london',
  });

  assert.equal(records.find((record) => /Heathrow/.test(record.near))?.airportCode, 'LHR');
  assert.equal(records.find((record) => /Gatwick/.test(record.near))?.airportCode, 'LGW');
});

test('Plaza Premium parser excludes access-pass products from physical lounge records', () => {
  const html = `
    <html>
      <head>
        <title>Lounges in Hong Kong | Hong Kong International Airport (HKG) | Plaza Premium Lounge</title>
      </head>
      <body>
        <div class="lounge-details">
          <a href="/en-uk/find/china-regions/hong-kong/hong-kong/hong-kong-international-airport/plaza-premium-lounge-pass?propertycode=PRPRTY750" class="lounge-title loungedirect">
            <h3>Plaza Premium Lounge Pass - Save Up to 50%</h3>
          </a>
          <span class="flight-details">HKG, Hong Kong International Airport</span>
        </div>
        <div class="lounge-details">
          <a href="/en-uk/find/europe/italy/rome/leonardo-da-vinci-fiumicino-airport/plaza-premium-first-lounge-experience-pass-save-up-to-50?propertycode=PRPRTY999" class="lounge-title loungedirect">
            <h3>Plaza Premium First Lounge Experience Pass - Save Up to 50%</h3>
          </a>
          <span class="flight-details">Access Plaza Premium Lounge Globally, Leonardo da Vinci-Fiumicino Airport</span>
        </div>
        <div class="lounge-details">
          <a href="/en-uk/find/china-regions/hong-kong/hong-kong/hong-kong-international-airport/plaza-premium-first-near-gate-35-departures" class="lounge-title loungedirect">
            <h3>Plaza Premium First</h3>
          </a>
          <span class="flight-details">Near Gate 35, Terminal 1, Hong Kong International Airport</span>
          <div class="lounge-price">from <strong>HKD 880</strong></div>
        </div>
      </body>
    </html>
  `;

  const records = parsePlazaPremiumStructuredRecords(html, {
    url: 'https://www.plazapremiumlounge.com/en-uk/find/china-regions/hong-kong/hong-kong/hong-kong-international-airport',
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].name, 'Plaza Premium First');
  assert.ok(!records.some((record) => /Lounge Pass/i.test(record.name)));
  assert.ok(!records.some((record) => /Experience Pass/i.test(record.name)));
});

test('Plaza Premium parser separates Shanghai airport pages from railway products', () => {
  const html = `
    <html>
      <head>
        <title>Lounges in Shanghai | Shanghai Pudong International Airport (PVG) | Plaza Premium Lounge</title>
      </head>
      <body>
        <div class="lounge-details">
          <a href="/en-uk/find/china-regions/mainland-china/shanghai/shanghai-pudong-international-airport/no-73" class="lounge-title loungedirect">
            <h3>No. 73 VIP Lounge</h3>
          </a>
          <span class="flight-details">Domestic Departures, Terminal 2, Shanghai Pudong International Airport</span>
          <div class="lounge-price">from <strong>CNY 200</strong></div>
        </div>
        <div class="lounge-details">
          <a href="/en-uk/find/china-regions/mainland-china/shanghai/shanghai-hongqiao-international-airport/v1-vip-lounge" class="lounge-title loungedirect">
            <h3>V1 VIP Lounge</h3>
          </a>
          <span class="flight-details">Domestic Departure, Terminal 2, Shanghai Hongqiao International Airport</span>
          <div class="lounge-price">from <strong>CNY 200</strong></div>
        </div>
        <div class="lounge-details">
          <a href="/en-uk/find/china-regions/mainland-china/shanghai/shanghai-railway-station/joyful-journey-railway-vip-lounge" class="lounge-title loungedirect">
            <h3>Joyful Journey Railway VIP Lounge</h3>
          </a>
          <span class="flight-details">Domestic Departures, Shanghai Hongqiao Railway Station</span>
          <div class="lounge-price">from <strong>CNY 97.98</strong></div>
        </div>
      </body>
    </html>
  `;

  const records = parsePlazaPremiumStructuredRecords(html, {
    url: 'https://www.plazapremiumlounge.com/en-uk/find/china-regions/mainland-china/shanghai',
  });

  assert.equal(records.length, 2);
  assert.equal(records.find((record) => record.name === 'No. 73 VIP Lounge')?.airportCode, 'PVG');
  assert.equal(records.find((record) => record.name === 'V1 VIP Lounge')?.airportCode, 'SHA');
  assert.ok(!records.some((record) => /Railway/i.test(record.name)));
});
