import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  parseAirportGroupSmokeArgs,
  readCatalogAirportCounts,
} from '../scripts/smoke-airport-groups.mjs';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('airport group smoke parses local preview options', () => {
  const options = parseAirportGroupSmokeArgs([
    '--base-url=http://127.0.0.1:4302/path',
    '--airports=ewr, sea',
    '--mobile-airport=sea',
    '--timeout-ms=7000',
  ]);

  assert.equal(options.baseUrl, 'http://127.0.0.1:4302');
  assert.deepEqual(options.airports, ['EWR', 'SEA']);
  assert.equal(options.mobileAirport, 'SEA');
  assert.equal(options.timeoutMs, 7000);
});

test('airport group smoke rejects unsafe or incomplete options', () => {
  assert.throws(() => parseAirportGroupSmokeArgs(['--base-url=file:///tmp/index.html']), /HTTP or HTTPS/);
  assert.throws(() => parseAirportGroupSmokeArgs(['--airports=']), /IATA\/ICAO-like/);
  assert.throws(() => parseAirportGroupSmokeArgs(['--mobile-airport=']), /mobile airport/);
  assert.throws(() => parseAirportGroupSmokeArgs(['--timeout-ms=1000']), /at least 5000ms/);
  assert.throws(() => parseAirportGroupSmokeArgs(['--unknown']), /Unknown argument/);
});

test('airport group smoke derives expected counts from the canonical catalog', () => {
  const counts = readCatalogAirportCounts();

  assert.equal(counts.get('EWR'), 6);
  assert.equal(counts.get('SEA'), 12);
});

test('package exposes airport group smoke command', () => {
  assert.equal(packageJson.scripts['smoke:airport-groups'], 'node scripts/smoke-airport-groups.mjs');
});
