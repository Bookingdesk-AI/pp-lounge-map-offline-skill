import test from 'node:test';
import assert from 'node:assert/strict';

import { mergeGamewayDetailRecord, parseGamewayStructuredRecords } from '../scripts/lib/gameway-structured.mjs';

test('Gameway parser extracts official locations with gate and hours', () => {
  const html = `
    <div class="location" data-location-id="102">
      <div class="location--left">
        <div class="location--left--airport">Dallas/Fort Worth Airport</div>
        <div class="location--left--location text-location-header">DFW</div>
        <div class="location--left--time open"> &bull;&nbsp;Open<br>
          <span>6:00am - 9:00pm CDT</span>
        </div>
      </div>
      <div class="location--right">
        <div class="location--right--top">Terminal</div>
        <div class="location--right--terminal text-location-header">B</div>
        <div class="location--right--location">Near Gate 42</div>
      </div>
    </div>
    <div class="location">
      <div class="location--left location--details">
        <div class="location--details--title text-body">Dallas/Fort Worth Airport</div>
        <div class="location--details--airport">DFW</div>
        <div class="location--details--terminal">B</div>
        <div class="location--details--location text-body">Near Gate 42</div>
        <a href="https://gameway.gg/location/dfw-airport-terminal-b/" class="location--details--button button">MORE INFO</a>
      </div>
    </div>
  `;

  const records = parseGamewayStructuredRecords(html, {
    url: 'https://gameway.gg/locations/',
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].airportCode, 'DFW');
  assert.equal(records[0].name, 'Gameway DFW Terminal B');
  assert.equal(records[0].operator, 'Gameway');
  assert.equal(records[0].terminal, 'Terminal B');
  assert.equal(records[0].near, 'Near Gate 42');
  assert.equal(records[0].sourceUrl, 'https://gameway.gg/location/dfw-airport-terminal-b/');
  assert.equal(records[0].openHours.length, 7);
  assert.equal(records[0].openHours[0].OpeningHour, '06:00');
  assert.equal(records[0].openHours[0].ClosingHour, '21:00');
});

test('Gameway detail merge attaches official prices and amenities to one location', () => {
  const [record] = parseGamewayStructuredRecords(`
    <div class="location" data-location-id="395">
      <div class="location--left">
        <div class="location--left--airport">Los Angeles International Airport</div>
        <div class="location--left--location text-location-header">LAX</div>
        <div class="location--left--time open"><span>5:00am - 10:00pm PDT</span></div>
      </div>
      <div class="location--right">
        <div class="location--right--top">Terminal</div>
        <div class="location--right--terminal text-location-header">3</div>
        <div class="location--right--location">Near Gate 30B</div>
      </div>
    </div>
  `, { url: 'https://gameway.gg/locations/' });
  const detailHtml = `
    <section id="rates">
      <div class="progress-bar">
        <div class="progress-bar--price">$19<sup>.95</sup></div>
        <div class="progress-bar--duration">Up to 30 Mins</div>
      </div>
      <div class="progress-bar">
        <div class="progress-bar--price">$29<sup>.95</sup></div>
        <div class="progress-bar--duration">Up to 1 Hour</div>
      </div>
    </section>
    <section id="features">
      <div class="text-mobile-body">CURRENT GEN GAMING</div>
      <div class="text-mobile-body">PREMIUM GAMING HEADPHONES</div>
    </section>
  `;

  const merged = mergeGamewayDetailRecord(record, detailHtml);

  assert.deepEqual(merged.price, {
    amount: 19.95,
    currencyCode: 'USD',
  });
  assert.equal(merged.prices.length, 2);
  assert.equal(merged.prices[1].duration, 'Up to 1 Hour');
  assert.equal(merged.amenities['Gaming stations'], true);
  assert.equal(merged.amenities.Headsets, true);
});

test('Gameway parser matches detail links by airport and gate rather than raw order', () => {
  const html = `
    <div class="location" data-location-id="375">
      <div class="location--left">
        <div class="location--left--airport">Charlotte Douglas International Airport</div>
        <div class="location--left--location text-location-header">CLT</div>
        <div class="location--left--time open"><span>7:00am - 8:00pm EDT</span></div>
      </div>
      <div class="location--right">
        <div class="location--right--terminal text-location-header">&nbsp;</div>
        <div class="location--right--location">Near Gate 36</div>
      </div>
    </div>
    <div class="location" data-location-id="103">
      <div class="location--left">
        <div class="location--left--airport">Los Angeles International Airport</div>
        <div class="location--left--location text-location-header">LAX</div>
        <div class="location--left--time open"><span>6:00am - 10:00pm PDT</span></div>
      </div>
      <div class="location--right">
        <div class="location--right--terminal text-location-header">6</div>
        <div class="location--right--location">Near Gate 65B</div>
      </div>
    </div>
    <a href="https://gameway.gg/location/laxt6/">LAX Terminal 6</a>
    <a href="https://gameway.gg/location/clt/">CLT</a>
  `;

  const records = parseGamewayStructuredRecords(html, {
    url: 'https://gameway.gg/locations/',
  });

  assert.equal(records.find((record) => record.airportCode === 'CLT').sourceUrl, 'https://gameway.gg/location/clt/');
  assert.equal(records.find((record) => record.near === 'Near Gate 65B').sourceUrl, 'https://gameway.gg/location/laxt6/');
});

test('Gameway parser preserves coming-soon locations as planned openings without fabricated hours', () => {
  const [record] = parseGamewayStructuredRecords(`
    <div class="location" data-location-id="1014">
      <div class="location--left">
        <div class="location--left--airport">Washington Dulles International Airport</div>
        <div class="location--left--location text-location-header">IAD</div>
        <div class="location--left--time"><span>Coming Soon</span></div>
      </div>
      <div class="location--right">
        <div class="location--right--terminal text-location-header">&nbsp;</div>
        <div class="location--right--location">Between Gates 8 and 10</div>
      </div>
    </div>
    <a href="https://gameway.gg/location/iad/">IAD</a>
  `, { url: 'https://gameway.gg/locations/' });

  assert.equal(record.status, 'planned');
  assert.equal(record.plannedOpening, 'Coming Soon');
  assert.deepEqual(record.openHours, []);
});
