import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createAirportAuthorityLookup } from '../scripts/lib/airport-authority.mjs';
import { createNonPriorityCandidateRecords } from '../scripts/lib/source-candidates.mjs';

const airportAuthority = JSON.parse(fs.readFileSync(new URL('../public/data/airport-authority.json', import.meta.url), 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const migrationSql = fs.readFileSync(new URL('../migrations/0001_lounge_guru_catalog.sql', import.meta.url), 'utf8');
const goal = JSON.parse(fs.readFileSync(new URL('../public/data/worldwide-coverage-goal.json', import.meta.url), 'utf8'));

test('airport authority imports the centralized all-routes airport universe', () => {
  assert.equal(airportAuthority.source.id, 'all-routes-airport-authority');
  assert.match(airportAuthority.source.rightsNote, /airport identity normalization only/);
  assert.ok(airportAuthority.stats.airports > 4000);
  assert.ok(airportAuthority.stats.withIcao > 4000);
  assert.ok(airportAuthority.stats.countries > 200);

  const gig = airportAuthority.airports.find((airport) => airport.iata === 'GIG');
  assert.equal(gig?.icao, 'SBGL');
  assert.equal(gig?.country, 'Brazil');
  assert.ok(Number.isFinite(gig?.coordinates.lat));
  assert.ok(Number.isFinite(gig?.coordinates.lon));
});

test('source candidate normalization can use authority airports beyond current catalog features', () => {
  const records = createNonPriorityCandidateRecords({
    generatedAt: '2026-07-13T00:00:00.000Z',
    features: [],
    airportAuthority: {
      airports: [
        {
          iata: 'GIG',
          icao: 'SBGL',
          name: 'Rio Galeao Tom Jobim International Airport',
          city: 'Rio De Janeiro',
          country: 'Brazil',
          countryCode: 'BR',
          timezone: '',
          coordinates: { lat: -22.809999, lon: -43.250557 },
          sourceId: 'all-routes',
          sourceAirportId: 'GIG',
        },
      ],
    },
    report: {
      generatedAt: '2026-07-13T00:00:00.000Z',
      sources: [
        {
          sourceId: 'marhaba',
          status: 'fetched',
          loungeLinks: ['https://www.marhabaservices.com/ae/english/global-lounges/riogaleao-tom-jobim-international-airport-lounge.html'],
        },
      ],
    },
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].airport.iata, 'GIG');
  assert.equal(records[0].airport.country, 'Brazil');
  assert.equal(records[0].sources[0].sourceId, 'marhaba');
});

test('airport authority is part of the D1 coverage contract', () => {
  assert.equal(packageJson.scripts['sync:airport-authority'], 'node scripts/sync-airport-authority.mjs');
  assert.ok(goal.cloudflareDatabase.requiredTables.includes('airport_authority'));
  assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS airport_authority/);
});
