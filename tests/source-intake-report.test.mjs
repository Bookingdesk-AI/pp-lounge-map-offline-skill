import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createCanonicalRecord, extractGateEvidence } from '../scripts/lib/lounge-canonical.mjs';

const report = JSON.parse(fs.readFileSync(new URL('../public/data/source-intake-report.json', import.meta.url), 'utf8'));
const catalog = JSON.parse(fs.readFileSync(new URL('../public/data/lounge-guru-catalog.json', import.meta.url), 'utf8'));
const candidates = JSON.parse(
  fs.readFileSync(new URL('../public/data/non-priority-lounge-candidates.json', import.meta.url), 'utf8'),
);
const validationReport = JSON.parse(
  fs.readFileSync(new URL('../public/data/non-priority-validation-report.json', import.meta.url), 'utf8'),
);
const fieldCoverageReport = JSON.parse(
  fs.readFileSync(new URL('../public/data/lounge-field-coverage-report.json', import.meta.url), 'utf8'),
);
const sourceRegistry = JSON.parse(fs.readFileSync(new URL('../public/data/source-registry.json', import.meta.url), 'utf8'));
const projectRoot = new URL('..', import.meta.url);

test('canonical gate evidence parser keeps explicit gate text only', () => {
  assert.equal(extractGateEvidence({ name: 'Aspire Lounge (Gate 16)' }), 'Gate 16');
  assert.equal(extractGateEvidence({ name: 'The Chiroport (Gate F7)' }), 'Gate F7');
  assert.equal(extractGateEvidence({ name: 'The Club MCO (Gates 1-29)' }), 'Gates 1-29');
  assert.equal(extractGateEvidence({ name: 'Be Relax Spa (Gates A/B)' }), 'Gates A/B');
  assert.equal(extractGateEvidence({ name: 'The Club SEA', terminal: 'South Satellite' }), 'Satellite South');
  assert.equal(extractGateEvidence({ name: 'Neptuno Lounge', terminal: 'Terminal 4 (Satellite)' }), 'Satellite');
  assert.equal(extractGateEvidence({ name: 'The Club LIM', terminal: 'International Pier' }), 'International Pier');
  assert.equal(extractGateEvidence({ name: 'BCS International Premium Lounge', terminal: 'Southernmost point of the E Pier' }), 'Pier E');
  assert.equal(extractGateEvidence({ name: 'Gateau F-Pier', terminal: 'Terminal 5' }), 'Pier F');
  assert.equal(extractGateEvidence({ name: 'VIP Express Club Pier Sul', terminal: 'Domestic Terminal 1' }), 'Pier Sul');
  assert.equal(extractGateEvidence({ name: 'VIP Express Club Pier Norte', terminal: 'Domestic Terminal 1' }), 'Pier Norte');
  assert.equal(extractGateEvidence({ name: 'Plaza Premium Lounge Taiwan Airport', location: 'Terminal 1, Zone D, Departure Hall, level 4' }), 'Zone D');
  assert.equal(extractGateEvidence({ name: 'Marhaba Lounge East Wing', terminal: 'Terminal 1', location: 'East Wing' }), 'East Wing');
  assert.equal(extractGateEvidence({ name: 'Marhaba Lounge Main Lobby', terminal: 'Terminal 1', location: 'Main Lobby' }), 'Main Lobby');
  assert.equal(extractGateEvidence({ name: 'Garden Terrace', location: 'Mezzanine Level' }), 'Mezzanine Level');
  assert.equal(extractGateEvidence({ name: 'Blue Sky Premier Lounge', location: 'Upper Floor' }), 'Upper Floor');
  assert.equal(extractGateEvidence({ name: 'All Day Dining Grande Aile', location: '1st Floor' }), 'Level 1');
  assert.equal(extractGateEvidence({ name: 'First Class Lounge', location: '2nd Floor, via stairs' }), 'Level 2');
  assert.equal(extractGateEvidence({ name: 'Kepler Club', location: 'Landside - Level 2' }), 'Level 2');
  assert.equal(extractGateEvidence({ name: 'First/Business Class Lounge 06', location: '3rd Floor' }), 'Level 3');
  assert.equal(extractGateEvidence({ name: 'TGI Fridays', location: 'Level 5 Pier C' }), 'Pier C');
  assert.equal(
    extractGateEvidence({ name: 'Siesta Box Confins', location: 'Opposite the Azul Airlines Check-in counter' }),
    'Check-in Azul Airlines',
  );
  assert.equal(extractGateEvidence({ name: 'The Lounge Bogota (Domestic Departures - Concourse D)', terminal: 'Terminal 1 Domestic' }), 'Concourse D');
  assert.equal(extractGateEvidence({ name: 'Aspire Lounge', terminal: 'Departure Hall 1', location: 'Amsterdam Schiphol, Departure Hall 1' }), 'Departure Hall 1');
  assert.equal(extractGateEvidence({ name: 'Goldair Handling Lounge Extra', terminal: 'Hall A', location: 'Athens International, Hall A' }), 'Hall A');
  assert.equal(extractGateEvidence({ name: 'ANA Lounge', terminal: 'Terminal 1', location: 'Near the Food Court' }), 'Food Court');
  assert.equal(extractGateEvidence({ name: 'PrimeClass Lounge', terminal: 'Terminal 2C', location: 'Access by elevators or stairs from the Duty Free area' }), 'Duty Free Area');
  assert.equal(extractGateEvidence({ name: 'Sky Hub Lounge', terminal: 'Terminal 1 Concourse', location: 'Seoul Incheon Intl, Terminal 1 Concourse' }), 'Terminal 1 Concourse');
  assert.equal(extractGateEvidence({ name: 'Transpa (Departure Transit Area)', terminal: 'Terminal 2' }), 'Departure Transit Area');
  assert.equal(extractGateEvidence({ name: 'VIP Area V18', terminal: 'Terminal 2' }), 'VIP Area V18');
  assert.equal(extractGateEvidence({ name: 'Elysian lounge - PNQ - First Floor', terminal: 'New Integrated Terminal Bldg' }), 'Level 1');
  assert.equal(
    extractGateEvidence({
      name: 'Advantage VIP Lounge + Fast Track',
      terminal: 'Terminal 2',
      openingHours: 'To access the lounge only outside these hours, use the Airside entrance opposite Boarding Gate 2.',
    }),
    'Gate 2',
  );
  assert.equal(extractGateEvidence({ name: 'Golden Gate Lounge' }), '');
  assert.equal(extractGateEvidence({ name: 'Gate Z' }), '');
  assert.equal(extractGateEvidence({ name: 'Terminal Only Lounge', terminal: 'Terminal 1' }), '');
  assert.equal(extractGateEvidence({ name: 'Concourse Only Lounge' }), '');
});

test('canonical Priority Pass records extract explicit access-credit offers only', () => {
  const record = createCanonicalRecord({
    properties: {
      id: 'test-pp-bne-dining',
      name: 'Test Dining Credit',
      airportCode: 'BNE',
      airportName: 'Brisbane Intl',
      city: 'Brisbane',
      country: 'Australia',
      terminal: 'Domestic Terminal',
      location: 'Brisbane Intl, Domestic Terminal',
      type: 'EAT',
      openingHours: 'Daily 05:00 - 21:00',
      facilities: 'Refreshments',
      conditions:
        'Cardholders can use their lounge visit entitlement to receive AUD$36 off the bill. All subsequent drinks are subject to payment.',
      url: 'https://www.prioritypass.com/en/lounges/australia/brisbane',
    },
    geometry: { coordinates: [153.1175, -27.3842] },
  }, { generatedAt: '2026-07-14T00:00:00.000Z' });

  assert.deepEqual(record.accessOffers, [
    {
      type: 'access_credit',
      label: 'AUD 36 credit',
      amount: 36,
      currency: 'AUD',
      sourceId: 'priority-pass',
      url: 'https://www.prioritypass.com/en/lounges/australia/brisbane',
      retrievedAt: '2026-07-14T00:00:00.000Z',
    },
  ]);
  assert.ok(record.sources[0].fieldCoverage.includes('access.accessOffers'));

  const noOffer = createCanonicalRecord({
    properties: {
      id: 'test-pp-payments',
      name: 'Test Lounge',
      airportCode: 'BNE',
      airportName: 'Brisbane Intl',
      city: 'Brisbane',
      country: 'Australia',
      terminal: 'Domestic Terminal',
      location: 'Brisbane Intl, Domestic Terminal',
      type: 'LOUNGE',
      openingHours: 'Daily 05:00 - 21:00',
      facilities: 'Refreshments',
      conditions: 'Complimentary alcoholic drinks are limited to three per adult, subsequent drinks are subject to payment.',
      url: 'https://www.prioritypass.com/en/lounges/australia/brisbane',
    },
    geometry: { coordinates: [153.1175, -27.3842] },
  }, { generatedAt: '2026-07-14T00:00:00.000Z' });

  assert.deepEqual(noOffer.accessOffers, []);
});

test('canonical Priority Pass records extract official non-USD access values', () => {
  const sweden = createCanonicalRecord({
    properties: {
      id: 'test-pp-arn-dining',
      name: 'Test SEK Dining Credit',
      airportCode: 'ARN',
      airportName: 'Stockholm Arlanda',
      city: 'Stockholm',
      country: 'Sweden',
      terminal: 'Terminal 5',
      location: 'Stockholm Arlanda, Terminal 5',
      type: 'EAT',
      openingHours: 'Daily 05:00 - 21:00',
      facilities: 'Refreshments',
      conditions:
        'Cardholders can use their lounge visit entitlement to receive SEK190 off the bill. Each SEK190 deduction represents a single lounge visit.',
      url: 'https://www.prioritypass.com/en/lounges/sweden/stockholm-arlanda',
    },
    geometry: { coordinates: [17.9186, 59.6519] },
  }, { generatedAt: '2026-07-14T00:00:00.000Z' });

  assert.deepEqual(sweden.accessOffers, [
    {
      type: 'access_credit',
      label: 'SEK 190 credit',
      amount: 190,
      currency: 'SEK',
      sourceId: 'priority-pass',
      url: 'https://www.prioritypass.com/en/lounges/sweden/stockholm-arlanda',
      retrievedAt: '2026-07-14T00:00:00.000Z',
    },
  ]);

  const china = createCanonicalRecord({
    properties: {
      id: 'test-pp-ctu-spa',
      name: 'Test CNY Spa',
      airportCode: 'CTU',
      airportName: 'Chengdu Shuangliu Intl',
      city: 'Chengdu',
      country: 'China',
      terminal: 'Terminal 2',
      location: 'Chengdu Shuangliu Intl, Terminal 2',
      type: 'REFRESH',
      openingHours: 'Daily 07:00 - 21:00',
      facilities: 'Spa',
      conditions: '30-min Body Massage (a CNY198 value); 30-min Foot Massage (a CNY198 value).',
      url: 'https://www.prioritypass.com/en/lounges/china/chengdu-shuangliu-intl',
    },
    geometry: { coordinates: [103.9471, 30.5785] },
  }, { generatedAt: '2026-07-14T00:00:00.000Z' });

  assert.deepEqual(china.accessOffers, [
    {
      type: 'access_credit',
      label: 'CNY 198 credit',
      amount: 198,
      currency: 'CNY',
      sourceId: 'priority-pass',
      url: 'https://www.prioritypass.com/en/lounges/china/chengdu-shuangliu-intl',
      retrievedAt: '2026-07-14T00:00:00.000Z',
    },
  ]);

  const symbolCredit = createCanonicalRecord({
    properties: {
      id: 'test-pp-bhx-dining',
      name: 'Test GBP Dining Credit',
      airportCode: 'BHX',
      airportName: 'Birmingham Airport',
      city: 'Birmingham',
      country: 'United Kingdom',
      terminal: 'Terminal 1',
      location: 'Birmingham Airport, Terminal 1',
      type: 'EAT',
      openingHours: 'Daily 04:00 - last flight',
      facilities: 'Refreshments',
      conditions:
        'Cardholders can use their lounge visit entitlement to receive £18 off the bill. Each £18 deduction represents a single lounge visit.',
      url: 'https://www.prioritypass.com/en/lounges/united-kingdom/birmingham',
    },
    geometry: { coordinates: [-1.748, 52.4539] },
  }, { generatedAt: '2026-07-14T00:00:00.000Z' });

  assert.deepEqual(symbolCredit.accessOffers, [
    {
      type: 'access_credit',
      label: 'GBP 18 credit',
      amount: 18,
      currency: 'GBP',
      sourceId: 'priority-pass',
      url: 'https://www.prioritypass.com/en/lounges/united-kingdom/birmingham',
      retrievedAt: '2026-07-14T00:00:00.000Z',
    },
  ]);

  const noteOnlyValue = createCanonicalRecord({
    properties: {
      id: 'test-pp-note-cny',
      name: 'Test Note-Only CNY Spa',
      airportCode: 'CKG',
      airportName: 'Chongqing Jiangbei Intl',
      city: 'Chongqing',
      country: 'China',
      terminal: 'Terminal 3',
      location: 'Chongqing Jiangbei Intl, Terminal 3',
      type: 'REFRESH',
      openingHours: 'Daily 07:30 - 21:30\r\nNote: 30-minute Body Massage (a CNY198 value)\r\n30-minute Foot Massage (a CNY198 value)',
      facilities: 'Spa',
      conditions: 'No smoking.',
      url: 'https://www.prioritypass.com/en/lounges/china/chongqing-jiangbei-intl',
    },
    geometry: { coordinates: [106.6417, 29.7192] },
  }, { generatedAt: '2026-07-14T00:00:00.000Z' });

  assert.deepEqual(noteOnlyValue.accessOffers, [
    {
      type: 'access_credit',
      label: 'CNY 198 credit',
      amount: 198,
      currency: 'CNY',
      sourceId: 'priority-pass',
      url: 'https://www.prioritypass.com/en/lounges/china/chongqing-jiangbei-intl',
      retrievedAt: '2026-07-14T00:00:00.000Z',
    },
  ]);
});

test('canonical Priority Pass records extract explicit paid access rates', () => {
  const generatedAt = '2026-07-14T00:00:00.000Z';
  const baseProperties = {
    airportCode: 'JFK',
    airportName: 'John F. Kennedy International Airport',
    city: 'New York',
    country: 'United States of America',
    terminal: 'Terminal 4',
    location: 'New York JFK, Terminal 4',
    type: 'REST',
    openingHours: '24 hours daily',
    facilities: 'Wi-Fi',
    url: 'https://www.prioritypass.com/en/lounges/usa/new-york-ny-jfk-international',
  };

  const minuteSuites = createCanonicalRecord({
    properties: {
      ...baseProperties,
      id: 'test-pp-minute-suites-rate',
      name: 'Minute Suites',
      conditions:
        'Each subsequent hour of Minute Suite usage will be charged at a discounted rate of US$40. Shower facilities are subject to payment at a discounted rate of US$20 per 30 minutes.',
    },
    geometry: { coordinates: [-73.7793, 40.6394] },
  }, { generatedAt });

  assert.deepEqual(minuteSuites.accessOffers, [
    {
      type: 'access_credit',
      label: 'USD 40 credit',
      amount: 40,
      currency: 'USD',
      sourceId: 'priority-pass',
      url: 'https://www.prioritypass.com/en/lounges/usa/new-york-ny-jfk-international',
      retrievedAt: generatedAt,
    },
    {
      type: 'access_credit',
      label: 'USD 20 credit',
      amount: 20,
      currency: 'USD',
      sourceId: 'priority-pass',
      url: 'https://www.prioritypass.com/en/lounges/usa/new-york-ny-jfk-international',
      retrievedAt: generatedAt,
    },
  ]);

  const chaseSapphire = createCanonicalRecord({
    properties: {
      ...baseProperties,
      id: 'test-pp-chase-preferential-rate',
      name: 'Chase Sapphire Lounge by The Club',
      type: 'LOUNGE',
      conditions:
        'Guest visits and any additional visits over and above the one entry entitlement will be charged a preferential rate of US$75, payable to the lounge.',
    },
    geometry: { coordinates: [-73.7793, 40.6394] },
  }, { generatedAt });

  assert.equal(chaseSapphire.accessOffers[0]?.currency, 'USD');
  assert.equal(chaseSapphire.accessOffers[0]?.amount, 75);

  const houseUpgrade = createCanonicalRecord({
    properties: {
      ...baseProperties,
      id: 'test-pp-house-upgrade-fee',
      name: 'The House',
      airportCode: 'MEL',
      airportName: 'Melbourne Airport',
      city: 'Melbourne',
      country: 'Australia',
      terminal: 'Terminal 2',
      location: 'Melbourne, Terminal 2',
      type: 'LOUNGE',
      conditions:
        'PREMIUM OFFERING: Access to premium brand alcohol is available using a standard visit allocation and an additional upgrade fee of AUD$20 per person payable directly to the lounge.',
    },
    geometry: { coordinates: [144.8379, -37.6707] },
  }, { generatedAt });

  assert.equal(houseUpgrade.accessOffers[0]?.currency, 'AUD');
  assert.equal(houseUpgrade.accessOffers[0]?.amount, 20);

  const naritaCapsule = createCanonicalRecord({
    properties: {
      ...baseProperties,
      id: 'test-pp-narita-reduction',
      name: '9h nine hours Narita Airport',
      airportCode: 'NRT',
      airportName: 'Tokyo Narita International',
      city: 'Tokyo',
      country: 'Japan',
      terminal: 'Terminal 2',
      location: 'Tokyo Narita International, Terminal 2',
      type: 'REST',
      conditions:
        'An extended stay over 5 hours or stay after 18:00 usage will receive JPY3,400 reduction off the prevailing room charge and payable directly to 9h nine hours Narita Airport.',
    },
    geometry: { coordinates: [140.3864, 35.7647] },
  }, { generatedAt });

  assert.equal(naritaCapsule.accessOffers[0]?.currency, 'JPY');
  assert.equal(naritaCapsule.accessOffers[0]?.amount, 3400);
});

test('canonical reports use the latest source-run timestamp without refreshing PP provenance', () => {
  assert.equal(catalog.generatedAt, report.generatedAt);

  const priorityPassRecord = catalog.records.find((record) =>
    record.sources.some((source) => source.sourceId === 'priority-pass'),
  );
  const nonPriorityRecord = catalog.records.find((record) =>
    record.sources.some((source) => source.sourceId !== 'priority-pass' && source.sourceId !== 'ourairports'),
  );
  const priorityPassSource = sourceRegistry.find((source) => source.id === 'priority-pass');
  const oneworldSource = sourceRegistry.find((source) => source.id === 'oneworld');

  assert.ok(priorityPassRecord);
  assert.ok(nonPriorityRecord);
  assert.notEqual(priorityPassRecord.sources[0].retrievedAt, catalog.generatedAt);
  assert.equal(nonPriorityRecord.sources[0].retrievedAt, report.generatedAt);
  assert.equal(priorityPassSource.lastRunAt, priorityPassRecord.sources[0].retrievedAt);
  assert.equal(oneworldSource.lastRunAt, report.generatedAt);
});

test('source intake report records guarded public-source fetch policy', () => {
  assert.equal(report.policy.fetchMode, 'single_public_source_url_per_registry_entry');
  assert.equal(report.policy.childFetchMode, 'bounded_lounge_link_crawl');
  assert.ok(report.policy.childPageLimit >= 0);
  assert.equal(report.policy.rawSnapshotsCommitted, false);
  assert.match(report.policy.guardrail, /official\/public sources only/);
  assert.equal(report.policy.execution.requiredRuntime, 'playwright');
  assert.equal(report.policy.execution.localScrawl, 'playwright_only');
  assert.equal(report.policy.execution.proofEnv, 'LOUNGE_GURU_SOURCE_INTAKE_RUNTIME=playwright');
  assert.equal(report.policy.execution.fetchDriver, 'playwright');
  assert.ok(report.stats.totalSources >= 15);
  assert.ok(report.stats.childPagesFetched >= 0);
  assert.ok(report.stats.knownAirportCodes > 1000);
});

test('source snapshot script blocks intake without Playwright proof env', () => {
  const result = spawnSync(process.execPath, ['scripts/scrape-source-snapshots.mjs'], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      LOUNGE_GURU_SOURCE_INTAKE_RUNTIME: '',
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Playwright-approved runner/);
});

test('Visa source intake has Cloudflare fetch repair candidates', () => {
  const visa = sourceRegistry.find((source) => source.id === 'visa-airport-companion');

  assert.equal(visa.url, 'https://www.visaairportcompanion.com/');
  assert.ok(visa.fetchUrls.includes('https://www.visaairportcompanion.com/'));
  assert.ok(visa.fetchUrls.includes('https://visaairportcompanion.ca/'));
  assert.ok(visa.fetchUrls.includes('https://www.visa.gp/pay-with-visa/find-a-card/benefits/visa-airport-companion.html'));
  assert.ok(visa.fetchUrls.every((url) => url.startsWith('https://')));
});

test('Aspire intake keeps official operator partner fallback', () => {
  const aspire = sourceRegistry.find((source) => source.id === 'aspire-lounges');

  assert.equal(aspire.url, 'https://www.executivelounges.com/airport-lounges');
  assert.ok(aspire.fetchUrls.includes('https://www.aspirelounges.com/airport-lounges/'));
  assert.ok(aspire.fetchUrls.includes('https://no1lounges.com/partner-lounges/aspire-lounges/'));
  assert.ok(aspire.fetchUrls.every((url) => url.startsWith('https://')));
  assert.match(aspire.rightsNote, /operator partner/);
});

test('airline intake keeps official fallback pages inside Cloudflare fetch cap', () => {
  const american = sourceRegistry.find((source) => source.id === 'american');
  const united = sourceRegistry.find((source) => source.id === 'united');

  assert.equal(american.url, 'https://www.aa.com/i18n/travel-info/clubs/admirals-club-locations.jsp');
  assert.ok(american.fetchUrls.indexOf('https://www.aa.com/i18n/travel-info/clubs/flagship-lounge.jsp') < 2);
  assert.ok(
    american.fetchUrls.indexOf('https://www.american-airlines.co.kr/i18n/travel-info/clubs/admirals-club-locations.jsp') < 3,
  );
  assert.ok(american.fetchUrls.every((url) => url.startsWith('https://')));
  assert.match(american.rightsNote, /American Airlines-owned/);

  assert.equal(united.url, 'https://www.united.com/en/us/fly/travel/airport/united-club-and-lounge-locations.html');
  assert.equal(united.fetchUrls[0], 'https://business.united.com/en/us/blog/How-to-access-and-enjoy-the-United-Club');
  assert.ok(united.fetchUrls.every((url) => url.startsWith('https://')));
  assert.match(united.rightsNote, /United for Business/);
});

test('latest Visa intake remains browser-only evidence', () => {
  const visa = report.sources.find((source) => source.sourceId === 'visa-airport-companion');

  assert.equal(report.policy.execution.requiredRuntime, 'playwright');
  assert.equal(visa.status, 'fetched');
  assert.equal(visa.httpStatus, 200);
  assert.ok(!Object.hasOwn(visa, 'text'));
  assert.ok(!Object.hasOwn(visa, 'html'));
});

test('source intake report keeps provenance without committing raw page content', () => {
  for (const source of report.sources) {
    assert.ok(source.sourceId);
    assert.ok(source.publisher);
    assert.ok(source.url.startsWith('https://'));
    assert.ok(source.status);
    assert.ok(Array.isArray(source.airportCodes));
    assert.ok(Array.isArray(source.loungeLinks));

    if (source.status === 'fetched') {
      assert.ok(source.finalUrl.startsWith('https://'));
      assert.ok(source.sha256);
      assert.ok(source.snapshotFile.startsWith('.cache/source-snapshots/'));
      assert.ok(!Object.hasOwn(source, 'text'));
      assert.ok(!Object.hasOwn(source, 'html'));
    }
  }
});

test('airport-code-only operator discovery stays out of the canonical lounge catalog', () => {
  const genericCatalogRows = catalog.records.filter(
    (record) =>
      record.sources[0]?.sourceId === 'airport-dimensions' &&
      /^Airport Dimensions \/ The Club - [A-Z0-9]{3}$/.test(record.lounge.name),
  );
  const genericCandidateRows = validationReport.rows.filter(
    (row) =>
      row.sourceId === 'airport-dimensions' &&
      /^Airport Dimensions \/ The Club - [A-Z0-9]{3}$/.test(row.name),
  );

  assert.equal(genericCatalogRows.length, 0);
  assert.ok(genericCandidateRows.length > 0);
  assert.ok(genericCandidateRows.every((row) => row.validationStatus === 'airport_code_evidence_only'));
});

test('generic issuer program access pages stay out of the physical lounge catalog', () => {
  const genericCatalogRows = catalog.records.filter(
    (record) =>
      record.sources[0]?.sourceId === 'amex-global-lounge-collection' &&
      /^American Express lounge access - [A-Z0-9]{3}$/.test(record.lounge.name),
  );
  const genericCandidateRows = validationReport.rows.filter(
    (row) =>
      row.sourceId === 'amex-global-lounge-collection' &&
      /^American Express lounge access - [A-Z0-9]{3}$/.test(row.name),
  );

  assert.equal(genericCatalogRows.length, 0);
  assert.ok(genericCandidateRows.length > 0);
  assert.ok(genericCandidateRows.every((row) => row.validationStatus === 'airport_code_evidence_only'));
});

test('generic operator link pages stay out of the physical lounge catalog', () => {
  const genericCatalogRows = catalog.records.filter(
    (record) =>
      ['aspire-lounges', 'marhaba', 'no1-lounges'].includes(record.sources[0]?.sourceId) &&
      /^[A-Za-z0-9 /-]+ - [A-Z0-9]{3}$/.test(record.lounge.name) &&
      record.location.terminal === 'Unknown' &&
      !record.operations.hours &&
      !record.location.gate,
  );
  const genericCandidateRows = validationReport.rows.filter(
    (row) =>
      ['aspire-lounges', 'marhaba', 'no1-lounges'].includes(row.sourceId) &&
      /^[A-Za-z0-9 /-]+ - [A-Z0-9]{3}$/.test(row.name),
  );

  assert.equal(genericCatalogRows.length, 0);
  assert.ok(genericCandidateRows.length > 0);
  assert.ok(genericCandidateRows.every((row) => row.validationStatus === 'airport_code_evidence_only'));
});

test('generic alliance access pages stay out of the physical lounge catalog', () => {
  const genericCatalogRows = catalog.records.filter(
    (record) =>
      record.sources[0]?.sourceId === 'skyteam' &&
      /^SkyTeam lounge access - [A-Z0-9]{3}$/.test(record.lounge.name),
  );
  const genericCandidateRows = validationReport.rows.filter(
    (row) =>
      row.sourceId === 'skyteam' &&
      /^SkyTeam lounge access - [A-Z0-9]{3}$/.test(row.name),
  );

  assert.equal(genericCatalogRows.length, 0);
  assert.ok(genericCandidateRows.length > 0);
  assert.ok(genericCandidateRows.every((row) => row.validationStatus === 'airport_code_evidence_only'));
});

test('operator access-pass products stay out of the physical lounge catalog', () => {
  const passCatalogRows = catalog.records.filter(
    (record) =>
      record.sources[0]?.sourceId === 'plaza-premium' &&
      /\b(?:Lounge|Experience) Pass\b/i.test(record.lounge.name) &&
      record.location.terminal === 'Unknown',
  );
  const passCandidateRows = candidates.filter(
    (record) =>
      record.sources[0]?.sourceId === 'plaza-premium' &&
      /\b(?:Lounge|Experience) Pass\b/i.test(record.lounge.name) &&
      record.location.terminal === 'Unknown',
  );

  assert.equal(passCatalogRows.length, 0);
  assert.equal(passCandidateRows.length, 0);
});

test('non-Priority Pass intake validates every candidate before approval', () => {
  assert.ok(candidates.length > 0);

  const sourceIds = new Set(candidates.flatMap((record) => record.sources.map((source) => source.sourceId)));
  assert.ok(sourceIds.has('chase-sapphire'));
  assert.ok(sourceIds.has('amex-global-lounge-collection'));
  assert.ok(sourceIds.has('capital-one'));
  assert.ok(sourceIds.has('oneworld'));
  assert.ok(sourceIds.has('air-canada'));
  assert.ok(sourceIds.has('airport-dimensions'));
  assert.ok(!sourceIds.has('priority-pass'));
  assert.ok(candidates.length >= 800);

  assert.equal(validationReport.rows.length, candidates.length);
  assert.ok(validationReport.stats.byStatus.verified_official_structured_payload >= 700);
  assert.ok(validationReport.stats.byStatus.airport_code_evidence_only > 0);
  assert.ok(validationReport.stats.byDecision.approved > 0);
  assert.equal(validationReport.stats.byDecision.review ?? 0, 0);
  assert.equal(validationReport.policy.lineReviewRule.includes('reviewAction'), true);
  assert.equal(validationReport.stats.byReviewQueue.publishable, candidates.length);
  assert.equal(validationReport.stats.byReviewQueue.official_airport_code_review ?? 0, 0);
  assert.equal(validationReport.stats.byConflict.manual_review_required ?? 0, 0);
  assert.ok(Array.isArray(validationReport.stats.bySourceDecision));
  assert.ok(validationReport.stats.bySourceDecision.length >= sourceIds.size);

  for (const record of candidates) {
    const row = validationReport.rows.find((candidateRow) => candidateRow.recordId === record.lounge.id);
    assert.ok(row);
    assert.equal(row.publisher, record.sources[0].publisher);
    assert.equal(row.airportName, record.airport.name);
    assert.equal(row.city, record.airport.city);
    assert.equal(row.country, record.airport.country);
    assert.equal(row.terminal, record.location.terminal);
    assert.ok(['publish', 'manual_review'].includes(row.reviewAction.action));
    assert.ok(row.reviewAction.queue);
    assert.ok(row.reviewAction.reason);

    assert.equal(record.quality.reviewStatus, 'approved');
    assert.equal(record.quality.conflicts.length, 0);
    assert.equal(row.reviewAction.action, 'publish');
    assert.equal(row.reviewAction.queue, 'publishable');
    assert.ok(record.sources[0].url.startsWith('https://'));
    assert.match(record.lounge.id, /^candidate-/);
    assert.match(record.airport.iata, /^[A-Z0-9]{3}$/);
  }
});

test('structured location intake preserves closest gate evidence', () => {
  const alaskaSea = candidates.find((record) => record.lounge.id === 'candidate-oneworld-sea-1583');
  const clubDfw = candidates.find((record) => record.lounge.id === 'candidate-oneworld-dfw-1138');
  const centurionDfw = candidates.find(
    (record) =>
      record.sources.some((source) => source.sourceId === 'airport-official-pages') &&
      record.airport.iata === 'DFW' &&
      record.lounge.name === 'American Express Centurion Lounge',
  );
  const britishAirwaysSin = candidates.find(
    (record) =>
      record.sources.some((source) => source.sourceId === 'airport-official-pages') &&
      record.airport.iata === 'SIN' &&
      record.lounge.name === 'British Airways Lounge',
  );
  const sasArn = candidates.find(
    (record) =>
      record.sources.some((source) => source.sourceId === 'delta') &&
      record.airport.iata === 'ARN' &&
      record.lounge.name === 'SAS Lounge by Mastercard',
  );
  const greenDublin = candidates.find(
    (record) =>
      record.sources.some((source) => source.sourceId === 'delta') &&
      record.airport.iata === 'DUB' &&
      record.lounge.name === '51st & Green Lounge',
  );
  const classicMxp = candidates.find(
    (record) =>
      record.sources.some((source) => source.sourceId === 'delta') &&
      record.airport.iata === 'MXP' &&
      record.lounge.name === 'Pergolesi Classic Lounge',
  );
  const cphPier = candidates.find(
    (record) =>
      record.sources.some((source) => source.sourceId === 'oneworld') &&
      record.airport.iata === 'CPH' &&
      record.lounge.name === 'Danske Bank Aviator Business Lounge',
  );
  const premiumMxp = candidates.find(
    (record) =>
      record.sources.some((source) => source.sourceId === 'oneworld') &&
      record.airport.iata === 'MXP' &&
      record.lounge.name === 'Premium Lounge',
  );
  const deltaOrd = candidates.find(
    (record) =>
      record.sources.some((source) => source.sourceId === 'delta') &&
      record.airport.iata === 'ORD' &&
      record.lounge.name === 'Delta Sky Club',
  );
  const plazaPremiumAdl = candidates.find((record) => record.lounge.id === 'candidate-oneworld-adl-1741');
  const amsBetweenGates = candidates.find((record) => record.lounge.id === 'candidate-oneworld-ams-1759');
  const sfoByGates = candidates.find((record) => record.lounge.id === 'candidate-oneworld-sfo-906');
  const seaClub = candidates.find((record) => record.lounge.id === 'candidate-oneworld-sea-1595');
  const dxbSleepover = candidates.find((record) => record.lounge.id === 'candidate-sleepover-dxb-dxb-dubai-terminal-3-concourse-a');
  const baLhrSatellite = candidates.find((record) => record.lounge.id === 'candidate-oneworld-lhr-1633');
  const gamewayDtw = candidates.find((record) => record.lounge.id === 'candidate-gameway-dtw-dtw-near-a17-661');
  const qantasDxbBusiness = candidates.find((record) => record.lounge.id === 'candidate-qantas-dxb-qantas-dxb-international-business-lounge-partner');
  const qantasDxbFirst = candidates.find((record) => record.lounge.id === 'candidate-qantas-dxb-qantas-dxb-international-first-lounge-partner');
  const deltaScl = candidates.find((record) => record.lounge.id === 'candidate-delta-scl-delta-scl-skyteam-lounge-t2-concourse-e-level-1');
  const dohArrival = candidates.find(
    (record) => record.lounge.id === 'candidate-airport-official-pages-doh-airport-official-pages-doh-al-maha-arrival-lounge-after-immigration-first-and-bu',
  );
  const deltaMiaConnector = candidates.find(
    (record) =>
      record.sources.some((source) => source.sourceId === 'delta') &&
      record.airport.iata === 'MIA' &&
      record.lounge.name === 'Delta Sky Club',
  );
  const deltaIndConcourse = candidates.find(
    (record) =>
      record.sources.some((source) => source.sourceId === 'delta') &&
      record.airport.iata === 'IND' &&
      record.lounge.name === 'Delta Sky Club',
  );
  const pauCasalsBcn = candidates.find(
    (record) =>
      record.sources.some((source) => source.sourceId === 'oneworld') &&
      record.airport.iata === 'BCN' &&
      record.lounge.name === 'Pau Casals Lounge',
  );
  const cathaySinMezzanine = candidates.find(
    (record) =>
      record.sources.some((source) => source.sourceId === 'oneworld') &&
      record.airport.iata === 'SIN' &&
      record.lounge.name === 'Cathay Pacific Lounge',
  );
  const beRelaxCltConnector = candidates.find(
    (record) =>
      record.sources.some((source) => source.sourceId === 'be-relax') &&
      record.airport.iata === 'CLT' &&
      record.lounge.name === 'Be Relax Spa CLT Connector A',
  );
  const primeclassBdaDepartures = candidates.find(
    (record) =>
      record.sources.some((source) => source.sourceId === 'oneworld') &&
      record.airport.iata === 'BDA' &&
      record.lounge.name === 'Primeclass Lounge',
  );
  const goldairAthNonSchengen = candidates.find(
    (record) =>
      record.sources.some((source) => source.sourceId === 'oneworld') &&
      record.airport.iata === 'ATH' &&
      record.lounge.name === 'Goldair CIP Lounge',
  );
  const primeclassCdgDutyFree = candidates.find(
    (record) =>
      record.sources.some((source) => source.sourceId === 'oneworld') &&
      record.airport.iata === 'CDG' &&
      record.lounge.name === 'PrimeClass Lounge',
  );
  const anaLisFoodCourt = candidates.find(
    (record) =>
      record.sources.some((source) => source.sourceId === 'oneworld') &&
      record.airport.iata === 'LIS' &&
      record.lounge.name === 'ANA Lounge',
  );
  const virginLhrLoungeH = candidates.find(
    (record) =>
      record.sources.some((source) => source.sourceId === 'delta') &&
      record.airport.iata === 'LHR' &&
      record.lounge.name === 'Virgin Atlantic Clubhouse',
  );
  const qatarBeyLevelTwo = candidates.find(
    (record) =>
      record.sources.some((source) => source.sourceId === 'qatar-airways') &&
      record.airport.iata === 'BEY' &&
      record.lounge.name === 'Qatar Airways Premium Lounge - Beirut',
  );
  const cipAytThirdFloor = candidates.find(
    (record) =>
      record.sources.some((source) => source.sourceId === 'oneworld') &&
      record.airport.iata === 'AYT' &&
      record.lounge.name === 'CIP Lounge',
  );
  const kyraHkgLevelSix = candidates.find(
    (record) =>
      record.sources.some((source) => source.sourceId === 'airport-dimensions') &&
      record.airport.iata === 'HKG' &&
      record.lounge.name === 'Kyra Lounge, Level 6',
  );
  const skyLoungeHndGateArea = candidates.find(
    (record) =>
      record.sources.some((source) => source.sourceId === 'airport-official-pages') &&
      record.airport.iata === 'HND' &&
      record.lounge.name === 'SKY LOUNGE',
  );
  const golGruMezzanine = candidates.find(
    (record) =>
      record.sources.some((source) => source.sourceId === 'airport-official-pages') &&
      record.airport.iata === 'GRU' &&
      record.lounge.name === 'Domestic GOL Premium Lounge',
  );
  const plazaGruCheckin = candidates.find(
    (record) =>
      record.sources.some((source) => source.sourceId === 'airport-official-pages') &&
      record.airport.iata === 'GRU' &&
      record.lounge.name === 'Plaza Premium Lounge Landside',
  );
  const centurionLgaFoodHall = candidates.find(
    (record) =>
      record.sources.some((source) => source.sourceId === 'airport-official-pages') &&
      record.airport.iata === 'LGA' &&
      record.lounge.name === 'Centurion Lounge - American Express',
  );
  const vipKjaDepartures = candidates.find(
    (record) =>
      record.sources.some((source) => source.sourceId === 'oneworld') &&
      record.airport.iata === 'KJA' &&
      record.lounge.name === 'VIP Lounge',
  );
  const qantasDpoDepartureGate = candidates.find(
    (record) =>
      record.sources.some((source) => source.sourceId === 'qantas') &&
      record.airport.iata === 'DPO' &&
      record.lounge.name === 'Devonport Regional Lounge',
  );
  const montanaRojaTfsBoardingGate = candidates.find(
    (record) =>
      record.sources.some((source) => source.sourceId === 'oneworld') &&
      record.airport.iata === 'TFS' &&
      record.lounge.name === 'Montaña Roja Lounge',
  );
  const marhabaGigSouthPier = candidates.find(
    (record) =>
      record.sources.some((source) => source.sourceId === 'marhaba') &&
      record.airport.iata === 'GIG' &&
      record.lounge.name === 'Plaza Premium Lounge Rio Airport',
  );
  const marhabaKulContactPier = candidates.find(
    (record) =>
      record.sources.some((source) => source.sourceId === 'marhaba') &&
      record.airport.iata === 'KUL' &&
      record.lounge.name === 'Plaza Premium Kuala Lumpur Airport',
  );
  const deltaLaxSkyWay = candidates.find((record) => record.lounge.id === 'candidate-delta-lax-delta-lax-delta-sky-club-terminal-3-sky-way');
  const lgaSkyWay = candidates.find(
    (record) =>
      record.sources.some((source) => source.sourceId === 'airport-official-pages') &&
      record.airport.iata === 'LGA' &&
      record.lounge.name === 'Delta Sky Club',
  );
  const cdgAdmiralsBetweenTerminals = candidates.find((record) => record.lounge.id === 'candidate-oneworld-cdg-667');
  const cdgCathayConnectorBuilding = candidates.find((record) => record.lounge.id === 'candidate-oneworld-cdg-904');
  const hbaCheckinArrivals = candidates.find((record) => record.lounge.id === 'candidate-oneworld-hba-1109');
  const limArrivalsArea = candidates.find((record) => record.lounge.id === 'candidate-sleepover-lim-lim-lima-international-terminal');
  const mctCentralArea = candidates.find((record) => record.lounge.id === 'candidate-be-relax-mct-be-relax-mct-muscat-international-airport-central-area');
  const mtyRegionalArea = candidates.find(
    (record) => record.lounge.id === 'candidate-delta-mty-delta-mty-terraza-premier-aerom-xico-by-heineken-terminal-b-area-regional',
  );
  const eblDutyFree = candidates.find((record) => record.lounge.id === 'candidate-oneworld-ebl-1233');
  const qantasCbrLobby = candidates.find((record) => record.lounge.id === 'candidate-qantas-cbr-qantas-cbr-the-qantas-club');
  const oneworldCbrLobby = candidates.find((record) => record.lounge.id === 'candidate-oneworld-cbr-1104');
  const lgwLoungePavilion = candidates.find(
    (record) =>
      record.sources.some((source) => source.sourceId === 'airport-official-pages') &&
      record.airport.iata === 'LGW' &&
      record.lounge.name === 'My Lounge',
  );
  const dubAirlineLounges = candidates.find((record) => record.lounge.id === 'candidate-oneworld-dub-1770');
  const manPremiumLounges = candidates.find((record) => record.lounge.id === 'candidate-oneworld-man-1833');
  const lgaSecurityCheckpoint = candidates.find(
    (record) => record.lounge.id === 'candidate-delta-lga-delta-lga-delta-sky-club-terminal-c-to-the-left-of-the-security-checkpoint-exit',
  );
  const mrsHallThree = candidates.find((record) => record.lounge.id === 'candidate-oneworld-mrs-966');
  const pmiModuleC = candidates.find((record) => record.lounge.id === 'candidate-oneworld-pmi-1659');
  const sinTransferC = candidates.find((record) => record.lounge.id === 'candidate-oneworld-sin-1569');
  const bcnAirShuttleLobby = candidates.find((record) => record.lounge.id === 'candidate-oneworld-bcn-953');
  const cptIconsRestaurant = candidates.find((record) => record.lounge.id === 'candidate-oneworld-cpt-1882');
  const vvoDomesticArea = candidates.find((record) => record.lounge.id === 'candidate-oneworld-vvo-1296');
  const vvoInternationalArea = candidates.find((record) => record.lounge.id === 'candidate-oneworld-vvo-1392');
  const scqSouthDam = candidates.find((record) => record.lounge.id === 'candidate-oneworld-scq-1465');

  assert.equal(alaskaSea?.location.gate, 'Gate C-16');
  assert.equal(clubDfw?.location.gate, 'Gates D21 & D22');
  assert.equal(centurionDfw?.location.gate, 'Gate D18');
  assert.equal(britishAirwaysSin?.location.gate, 'Unit 03-06');
  assert.equal(sasArn?.location.gate, 'Gate Area F');
  assert.equal(greenDublin?.location.gate, 'Gate Area 400');
  assert.equal(classicMxp?.location.gate, 'Boarding Area B');
  assert.equal(cphPier?.location.gate, 'Pier A & B');
  assert.equal(premiumMxp?.location.gate, 'Satellite North');
  assert.equal(deltaOrd?.location.gate, 'Gates M14 & M11');
  assert.equal(plazaPremiumAdl?.location.gate, 'Gates 18-20');
  assert.equal(amsBetweenGates?.location.gate, 'D & E Gates');
  assert.equal(sfoByGates?.location.gate, 'A Gates');
  assert.equal(seaClub?.location.gate, 'S Gate Lounge Level');
  assert.equal(dxbSleepover?.location.gate, 'A Gates');
  assert.equal(baLhrSatellite?.location.gate, 'Satellite B');
  assert.equal(gamewayDtw?.location.gate, 'Gate A17');
  assert.equal(qantasDxbBusiness?.location.gate, 'Level U4');
  assert.equal(qantasDxbFirst?.location.gate, 'Level U3');
  assert.equal(deltaScl?.location.gate, 'Level -1');
  assert.equal(dohArrival?.location.gate, 'Ground Level');
  assert.equal(deltaMiaConnector?.location.gate, 'H-J Connector');
  assert.equal(deltaIndConcourse?.location.gate, 'Concourse A');
  assert.equal(pauCasalsBcn?.location.gate, 'Level 2');
  assert.equal(cathaySinMezzanine?.location.gate, 'Mezzanine Level');
  assert.equal(beRelaxCltConnector?.location.gate, 'Connector A');
  assert.equal(primeclassBdaDepartures?.location.gate, 'Main Departures Area');
  assert.equal(goldairAthNonSchengen?.location.gate, 'Non-Schengen Area');
  assert.equal(primeclassCdgDutyFree?.location.gate, 'Duty Free Area');
  assert.equal(anaLisFoodCourt?.location.gate, 'Food Court');
  assert.equal(virginLhrLoungeH?.location.gate, 'Lounge H');
  assert.equal(qatarBeyLevelTwo?.location.gate, 'Level 2');
  assert.equal(cipAytThirdFloor?.location.gate, 'Level 3');
  assert.equal(kyraHkgLevelSix?.location.gate, 'Level 6');
  assert.equal(skyLoungeHndGateArea?.location.gate, 'Gate Area');
  assert.equal(golGruMezzanine?.location.gate, 'Mezzanine Level');
  assert.equal(plazaGruCheckin?.location.gate, 'Check-in D');
  assert.equal(centurionLgaFoodHall?.location.gate, 'Food Hall');
  assert.equal(vipKjaDepartures?.location.gate, 'Departures Area');
  assert.equal(qantasDpoDepartureGate?.location.gate, 'Gate Area');
  assert.equal(montanaRojaTfsBoardingGate?.location.gate, 'Gate Area');
  assert.equal(marhabaGigSouthPier?.location.gate, 'South Pier');
  assert.equal(marhabaKulContactPier?.location.gate, 'Contact Pier');
  assert.equal(deltaLaxSkyWay?.location.gate, 'Sky Way');
  assert.equal(lgaSkyWay?.location.gate, 'Sky Way');
  assert.equal(cdgAdmiralsBetweenTerminals?.location.gate, 'Terminals 2A & 2C');
  assert.equal(cdgCathayConnectorBuilding?.location.gate, 'Connector Building');
  assert.equal(hbaCheckinArrivals?.location.gate, 'Check-in & Arrivals');
  assert.equal(limArrivalsArea?.location.gate, 'Arrivals Area');
  assert.equal(mctCentralArea?.location.gate, 'Central Area');
  assert.equal(mtyRegionalArea?.location.gate, 'Regional Area');
  assert.equal(eblDutyFree?.location.gate, 'Duty Free Area');
  assert.equal(qantasCbrLobby?.location.gate, 'Lounge Lobby');
  assert.equal(oneworldCbrLobby?.location.gate, 'Lounge Lobby');
  assert.equal(lgwLoungePavilion?.location.gate, 'Upper Level');
  assert.equal(dubAirlineLounges?.location.gate, 'Airline Lounges');
  assert.equal(manPremiumLounges?.location.gate, 'Premium Lounges');
  assert.equal(lgaSecurityCheckpoint?.location.gate, 'Security Checkpoint Exit');
  assert.equal(mrsHallThree?.location.gate, 'Hall 3');
  assert.equal(pmiModuleC?.location.gate, 'Module C');
  assert.equal(sinTransferC?.location.gate, 'Transfer C');
  assert.equal(bcnAirShuttleLobby?.location.gate, 'Air Shuttle Lobby');
  assert.equal(cptIconsRestaurant?.location.gate, 'Icons Restaurant');
  assert.equal(vvoDomesticArea?.location.gate, 'Domestic Area');
  assert.equal(vvoInternationalArea?.location.gate, 'International Area');
  assert.equal(scqSouthDam?.location.gate, 'South Dam');
  assert.ok(alaskaSea?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(clubDfw?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(centurionDfw?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(britishAirwaysSin?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(sasArn?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(greenDublin?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(classicMxp?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(cphPier?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(premiumMxp?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(deltaOrd?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(plazaPremiumAdl?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(amsBetweenGates?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(sfoByGates?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(seaClub?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(dxbSleepover?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(baLhrSatellite?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(gamewayDtw?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(qantasDxbBusiness?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(qantasDxbFirst?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(deltaScl?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(dohArrival?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(deltaMiaConnector?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(deltaIndConcourse?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(pauCasalsBcn?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(cathaySinMezzanine?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(beRelaxCltConnector?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(primeclassBdaDepartures?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(goldairAthNonSchengen?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(primeclassCdgDutyFree?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(anaLisFoodCourt?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(virginLhrLoungeH?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(qatarBeyLevelTwo?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(cipAytThirdFloor?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(kyraHkgLevelSix?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(skyLoungeHndGateArea?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(golGruMezzanine?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(plazaGruCheckin?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(centurionLgaFoodHall?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(qantasDpoDepartureGate?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(montanaRojaTfsBoardingGate?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(vipKjaDepartures?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(marhabaGigSouthPier?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(marhabaKulContactPier?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(deltaLaxSkyWay?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(lgaSkyWay?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(cdgAdmiralsBetweenTerminals?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(cdgCathayConnectorBuilding?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(hbaCheckinArrivals?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(limArrivalsArea?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(mctCentralArea?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(mtyRegionalArea?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(eblDutyFree?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(qantasCbrLobby?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(oneworldCbrLobby?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(lgwLoungePavilion?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(dubAirlineLounges?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(manPremiumLounges?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(lgaSecurityCheckpoint?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(mrsHallThree?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(pmiModuleC?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(sinTransferC?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(bcnAirShuttleLobby?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(cptIconsRestaurant?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(vvoDomesticArea?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(vvoInternationalArea?.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(scqSouthDam?.sources[0].fieldCoverage.includes('location.gate'));
});

test('Gameway paid-entry evidence keeps the official detail page URL', () => {
  const gameway = candidates.find((record) => record.sources.some((source) => source.sourceId === 'gameway'));
  assert.ok(gameway);
  assert.match(gameway.sources[0].url, /^https:\/\/gameway\.gg\/location\//);
  assert.equal(gameway.accessOffers[0]?.url, gameway.sources[0].url);
});

test('Sleepover paid-entry evidence keeps the official terminal page URL', () => {
  const sleepover = candidates.find((record) => record.sources.some((source) => source.sourceId === 'sleepover'));
  assert.ok(sleepover);
  assert.match(sleepover.sources[0].url, /^https:\/\/www\.airport-sleepover\.com\/en\/terminals\//);
  assert.equal(sleepover.accessOffers[0]?.url, sleepover.sources[0].url);
});

test('official airport lounge pages add terminal, hours, and gate evidence', () => {
  const airportOfficialSource = report.sources.find((source) => source.sourceId === 'airport-official-pages');
  const sfoDelta = candidates.find((record) =>
    record.sources.some((source) => source.sourceId === 'airport-official-pages') &&
    record.airport.iata === 'SFO' &&
    record.lounge.name === 'Delta Sky Club'
  );
  const phlAmex = candidates.find((record) =>
    record.sources.some((source) => source.sourceId === 'airport-official-pages') &&
    record.airport.iata === 'PHL' &&
    record.lounge.name === 'American Express Centurion Lounge'
  );
  const changiSats = candidates.find((record) =>
    record.sources.some((source) => source.sourceId === 'airport-official-pages') &&
    record.airport.iata === 'SIN' &&
    record.lounge.name === 'SATS Premier Lounge' &&
    record.location.terminal === 'T1'
  );
  const changiPlaza = candidates.find((record) =>
    record.sources.some((source) => source.sourceId === 'airport-official-pages') &&
    record.airport.iata === 'SIN' &&
    record.lounge.name === 'Plaza Premium Lounge' &&
    record.location.terminal === 'T1' &&
    record.accessOffers.some((offer) => offer.currency === 'SGD')
  );
  const gatwickPlaza = candidates.find((record) =>
    record.sources.some((source) => source.sourceId === 'airport-official-pages') &&
    record.airport.iata === 'LGW' &&
    record.lounge.name === 'Plaza Premium Lounge' &&
    record.location.terminal === 'North Terminal'
  );
  const heathrowNo1 = candidates.find((record) =>
    record.sources.some((source) => source.sourceId === 'airport-official-pages') &&
    record.airport.iata === 'LHR' &&
    record.lounge.name === 'No.1 Lounges' &&
    record.location.terminal === 'Terminal 2'
  );
  const heathrowClubAspire = candidates.find((record) =>
    record.sources.some((source) => source.sourceId === 'airport-official-pages') &&
    record.airport.iata === 'LHR' &&
    record.lounge.name === 'Club Aspire' &&
    record.location.terminal === 'Terminal 5'
  );
  const jfkAerLingus = candidates.find((record) =>
    record.sources.some((source) => source.sourceId === 'airport-official-pages') &&
    record.airport.iata === 'JFK' &&
    record.lounge.name === 'Aer Lingus Lounge'
  );
  const ewrUnitedClub = candidates.find((record) =>
    record.sources.some((source) => source.sourceId === 'airport-official-pages') &&
    record.airport.iata === 'EWR' &&
    record.lounge.name === 'United Club'
  );
  const dfwCapitalOne = candidates.find((record) =>
    record.sources.some((source) => source.sourceId === 'airport-official-pages') &&
    record.airport.iata === 'DFW' &&
    record.lounge.name === 'Capital One Lounge'
  );
  const bkkMiracleD5 = candidates.find((record) =>
    record.sources.some((source) => source.sourceId === 'airport-official-pages') &&
    record.airport.iata === 'BKK' &&
    record.lounge.name === 'Miracle Business Class Lounge' &&
    record.location.terminal === 'Concourse D' &&
    record.location.gate === 'Gate D5'
  );
  const gruWPremiumT3 = candidates.find((record) =>
    record.sources.some((source) => source.sourceId === 'airport-official-pages') &&
    record.airport.iata === 'GRU' &&
    record.lounge.name === 'W Premium Lounge' &&
    record.location.terminal === 'Terminal 3'
  );
  const gruNubank = candidates.find((record) =>
    record.sources.some((source) => source.sourceId === 'airport-official-pages') &&
    record.airport.iata === 'GRU' &&
    record.lounge.name === 'Nubank Ultravioleta Lounge'
  );
  const miaClubAmerica = candidates.find((record) =>
    record.sources.some((source) => source.sourceId === 'airport-official-pages') &&
    record.airport.iata === 'MIA' &&
    record.lounge.name === 'Club America F'
  );
  const seaClubA = candidates.find((record) =>
    record.sources.some((source) => source.sourceId === 'airport-official-pages') &&
    record.airport.iata === 'SEA' &&
    record.lounge.name === 'The Club at SEA' &&
    record.location.terminal === 'Concourse A'
  );
  const hkgCathayDeck = candidates.find((record) =>
    record.sources.some((source) => source.sourceId === 'airport-official-pages') &&
    record.airport.iata === 'HKG' &&
    record.lounge.name === 'Cathay Pacific Lounge - The Deck'
  );
  const hkgCenturion = candidates.find((record) =>
    record.sources.some((source) => source.sourceId === 'airport-official-pages') &&
    record.airport.iata === 'HKG' &&
    record.lounge.name === 'The Centurion® Lounge'
  );
  const melPlaza = candidates.find((record) =>
    record.sources.some((source) => source.sourceId === 'airport-official-pages') &&
    record.airport.iata === 'MEL' &&
    record.lounge.name === 'Plaza Premium Lounge'
  );
  const sydAirNewZealand = candidates.find((record) =>
    record.sources.some((source) => source.sourceId === 'airport-official-pages') &&
    record.airport.iata === 'SYD' &&
    record.lounge.name === 'Air New Zealand Lounge'
  );
  const hndSkyLounge = candidates.find((record) =>
    record.sources.some((source) => source.sourceId === 'airport-official-pages') &&
    record.airport.iata === 'HND' &&
    record.lounge.name === 'SKY LOUNGE'
  );
  const hndTiat = candidates.find((record) =>
    record.sources.some((source) => source.sourceId === 'airport-official-pages') &&
    record.airport.iata === 'HND' &&
    record.lounge.name === 'TIAT LOUNGE'
  );
  const fcoPlazaT1 = candidates.find((record) =>
    record.sources.some((source) => source.sourceId === 'airport-official-pages') &&
    record.airport.iata === 'FCO' &&
    record.lounge.name === 'Plaza Premium Lounge' &&
    record.location.terminal === 'Terminal 1'
  );
  const prgErsteT1 = candidates.find((record) =>
    record.sources.some((source) => source.sourceId === 'airport-official-pages') &&
    record.airport.iata === 'PRG' &&
    record.lounge.name === 'ERSTE Premier Lounge - Terminal 1'
  );
  const dohGoldSouth = candidates.find((record) =>
    record.sources.some((source) => source.sourceId === 'airport-official-pages') &&
    record.airport.iata === 'DOH' &&
    record.lounge.name === 'Gold Lounge - South'
  );
  const dohSilverSouth = candidates.find((record) =>
    record.sources.some((source) => source.sourceId === 'airport-official-pages') &&
    record.airport.iata === 'DOH' &&
    record.lounge.name === 'Silver Lounge - South'
  );
  const bcnJoanMiro = candidates.find((record) =>
    record.sources.some((source) => source.sourceId === 'airport-official-pages') &&
    record.airport.iata === 'BCN' &&
    record.lounge.name === 'Sala VIP Joan Miró'
  );

  assert.equal(airportOfficialSource?.status, 'fetched');
  assert.equal(airportOfficialSource?.records, 250);
  assert.deepEqual(airportOfficialSource?.airportCodes, ['BCN', 'BIO', 'BKK', 'DFW', 'DOH', 'DXB', 'EWR', 'FCO', 'FUE', 'GRU', 'HKG', 'HND', 'IBZ', 'JFK', 'LCG', 'LGA', 'LGW', 'LHR', 'LPA', 'MAD', 'MAH', 'MAN', 'MEL', 'MIA', 'PHL', 'PMI', 'PRG', 'SCQ', 'SEA', 'SFO', 'SIN', 'SVQ', 'SYD', 'TFN', 'TFS', 'VGO', 'VLC']);
  assert.equal(airportOfficialSource?.structuredRecords.length, 250);
  assert.equal(airportOfficialSource?.structuredApi.pages.length, 92);
  assert.ok(bcnJoanMiro);
  assert.equal(bcnJoanMiro.location.gate, 'D & E Gates');
  assert.equal(bcnJoanMiro.operations.hours, '05:00 to last flight');
  assert.ok(bcnJoanMiro.sources[0].url.startsWith('https://www.aena.es/'));
  assert.ok(bcnJoanMiro.sources[0].fieldCoverage.includes('operations.hours'));
  assert.ok(bcnJoanMiro.sources[0].fieldCoverage.includes('location.gate'));
  assert.ok(dohGoldSouth);
  assert.equal(dohGoldSouth.location.gate, 'Gate A1');
  assert.equal(dohGoldSouth.location.concourse, 'Concourse A');
  assert.equal(dohGoldSouth.operations.hours, '');
  assert.ok(dohGoldSouth.sources[0].url.startsWith('https://dohahamadairport.com/'));
  assert.ok(dohSilverSouth);
  assert.equal(dohSilverSouth.location.gate, 'Gate B1');
  assert.equal(dohSilverSouth.location.concourse, 'Concourse B');
  assert.ok(prgErsteT1);
  assert.match(prgErsteT1.operations.hours ?? '', /05:30-22:00/);
  assert.equal(prgErsteT1.accessOffers[0]?.currency, 'CZK');
  assert.equal(prgErsteT1.accessOffers[0]?.amount, 1030);
  assert.ok(prgErsteT1.sources[0].url.startsWith('https://www.prg.aero/'));
  assert.ok(fcoPlazaT1);
  assert.match(fcoPlazaT1.operations.hours ?? '', /04:30-21:30/);
  assert.equal(fcoPlazaT1.accessOffers[0]?.currency, 'EUR');
  assert.equal(fcoPlazaT1.accessOffers[0]?.amount, 29);
  assert.ok(fcoPlazaT1.sources[0].url.startsWith('https://www.adr.it/'));
  assert.ok(dfwCapitalOne);
  assert.equal(dfwCapitalOne.location.gate, 'Gate D22');
  assert.equal(dfwCapitalOne.accessOffers[0]?.currency, 'USD');
  assert.equal(dfwCapitalOne.accessOffers[0]?.amount, 65);
  assert.ok(hndSkyLounge);
  assert.equal(hndSkyLounge.location.terminal, 'Terminal 3');
  assert.match(hndSkyLounge.location.directions, /International Departure Gate Area/);
  assert.equal(hndSkyLounge.accessOffers[0]?.currency, 'JPY');
  assert.ok(hndTiat);
  assert.equal(hndTiat.accessOffers[0]?.amount, 4400);
  assert.ok(melPlaza);
  assert.equal(melPlaza.location.gate, 'Gate 9');
  assert.match(melPlaza.operations.hours ?? '', /08:30-23:00/);
  assert.ok(melPlaza.sources[0].url.startsWith('https://www.melbourneairport.com.au/'));
  assert.ok(sydAirNewZealand);
  assert.equal(sydAirNewZealand.location.gate, 'Gate 59');
  assert.match(sydAirNewZealand.operations.hours ?? '', /06:00-21:00/);
  assert.ok(sydAirNewZealand.sources[0].url.startsWith('https://www.sydneyairport.com.au/'));
  assert.equal(sfoDelta?.location.gate, 'Gate C3');
  assert.match(sfoDelta?.operations.hours ?? '', /04:30-22:30/);
  assert.ok(sfoDelta?.sources[0].fieldCoverage.includes('location.gate'));
  assert.equal(phlAmex?.location.gate, 'Gate A14');
  assert.match(phlAmex?.operations.hours ?? '', /05:30-21:00/);
  assert.ok(phlAmex?.sources[0].url.startsWith('https://www.phl.org/'));
  assert.ok(changiSats);
  assert.match(changiSats.operations.hours ?? '', /24 hours/);
  assert.match(changiSats.location.directions, /Map facilities\/T1L3_03-07\/08/);
  assert.ok(changiSats.sources[0].url.startsWith('https://www.changiairport.com/'));
  assert.ok(changiPlaza);
  assert.match(changiPlaza.operations.hours ?? '', /24 hours/);
  assert.equal(changiPlaza.accessOffers[0]?.currency, 'SGD');
  assert.equal(changiPlaza.accessOffers[0]?.amount, 55);
  assert.ok(changiPlaza.sources[0].url.endsWith('/plaza-premium-lounge.html'));
  assert.ok(gatwickPlaza);
  assert.match(gatwickPlaza.operations.hours ?? '', /04:00-20:00/);
  assert.equal(gatwickPlaza.accessOffers[0]?.currency, 'GBP');
  assert.equal(gatwickPlaza.accessOffers[0]?.amount, 40);
  assert.ok(gatwickPlaza.sources[0].url.startsWith('https://www.gatwickairport.com/'));
  assert.ok(heathrowNo1);
  assert.match(heathrowNo1.operations.hours ?? '', /05:00-21:00/);
  assert.equal(heathrowNo1.location.directions, 'After Security');
  assert.equal(heathrowNo1.accessOffers[0]?.currency, 'GBP');
  assert.equal(heathrowNo1.accessOffers[0]?.amount, 44);
  assert.ok(heathrowNo1.sources[0].url.startsWith('https://www.heathrow.com/'));
  assert.ok(heathrowClubAspire);
  assert.match(heathrowClubAspire.operations.hours ?? '', /05:00-21:00/);
  assert.equal(heathrowClubAspire.accessOffers[0]?.currency, 'GBP');
  assert.equal(heathrowClubAspire.accessOffers[0]?.amount, 39.99);
  assert.ok(heathrowClubAspire.sources[0].url.endsWith('/terminal-5/club-aspire'));
  assert.equal(jfkAerLingus?.location.gate, 'Gate 1');
  assert.match(jfkAerLingus?.operations.hours ?? '', /14:00-21:00/);
  assert.ok(jfkAerLingus?.sources[0].url.startsWith('https://www.jfkairport.com/'));
  assert.ok(ewrUnitedClub);
  assert.ok(ewrUnitedClub.sources[0].url.startsWith('https://www.newarkairport.com/'));
  assert.ok(bkkMiracleD5);
  assert.equal(bkkMiracleD5.location.gate, 'Gate D5');
  assert.match(bkkMiracleD5.operations.hours ?? '', /24 hours/);
  assert.ok(bkkMiracleD5.sources[0].url.startsWith('https://suvarnabhumi.airportthai.co.th/'));
  assert.ok(gruWPremiumT3);
  assert.equal(gruWPremiumT3.location.gate, 'Gates 323 & 324');
  assert.equal(gruWPremiumT3.accessOffers[0]?.currency, 'BRL');
  assert.equal(gruWPremiumT3.accessOffers[0]?.amount, 320);
  assert.ok(gruWPremiumT3.sources[0].url.startsWith('https://www.gru.com.br/'));
  assert.ok(gruNubank);
  assert.equal(gruNubank.location.gate, 'Gate 329');
  assert.equal(gruNubank.accessOffers[0]?.currency, 'USD');
  assert.equal(gruNubank.accessOffers[0]?.amount, 32);
  assert.ok(miaClubAmerica);
  assert.equal(miaClubAmerica.location.terminal, 'Concourse F');
  assert.match(miaClubAmerica.operations.hours ?? '', /07:30-22:00/);
  assert.equal(miaClubAmerica.accessOffers[0]?.currency, 'USD');
  assert.equal(miaClubAmerica.accessOffers[0]?.amount, 50);
  assert.ok(miaClubAmerica.sources[0].url.startsWith('https://www.miami-airport.com/'));
  assert.ok(seaClubA);
  assert.equal(seaClubA.location.gate, 'Gate A12');
  assert.match(seaClubA.operations.hours ?? '', /05:00-00:30/);
  assert.ok(seaClubA.sources[0].url.startsWith('https://www.portseattle.org/'));
  assert.ok(hkgCathayDeck);
  assert.equal(hkgCathayDeck.location.gate, 'Gate 6');
  assert.match(hkgCathayDeck.operations.hours ?? '', /05:30-00:30/);
  assert.ok(hkgCathayDeck.sources[0].url.startsWith('https://www.hongkongairport.com/'));
  assert.ok(hkgCenturion);
  assert.equal(hkgCenturion.location.gate, 'Gate 60');
  assert.match(hkgCenturion.operations.hours ?? '', /06:00-00:00/);
  assert.ok(hkgCenturion.lounge.programs.includes('American Express'));
});

test('official airport location-only evidence does not claim hours', () => {
  const plazaDxb = candidates.find((record) =>
    record.sources.some((source) => source.sourceId === 'airport-official-pages') &&
    record.airport.iata === 'DXB' &&
    record.lounge.name === 'Plaza Premium Lounge'
  );
  const officialSource = plazaDxb?.sources.find((source) => source.sourceId === 'airport-official-pages');

  assert.equal(plazaDxb?.location.gate, 'A Gates');
  assert.ok(officialSource?.fieldCoverage.includes('location.gate'));
  assert.equal(officialSource?.fieldCoverage.includes('operations.hours'), false);
});

test('official airport price evidence enriches matched existing lounge records', () => {
  const heathrowPlazaT3 = catalog.records.find(
    (record) =>
      record.airport.iata === 'LHR' &&
      record.location.terminal === 'Terminal 3' &&
      record.lounge.name === 'Plaza Premium Lounge',
  );
  const officialSource = heathrowPlazaT3?.sources.find((source) => source.sourceId === 'airport-official-pages');
  const officialOffer = heathrowPlazaT3?.accessOffers.find((offer) => offer.sourceId === 'airport-official-pages');

  assert.equal(heathrowPlazaT3?.airport.iata, 'LHR');
  assert.equal(heathrowPlazaT3?.location.terminal, 'Terminal 3');
  assert.equal(officialOffer?.currency, 'GBP');
  assert.equal(officialOffer?.amount, 36);
  assert.ok(officialSource?.url.includes('heathrow.com/at-the-airport/lounges-hotels-spas/terminal-3/plaza-premium'));
  assert.ok(officialSource?.fieldCoverage.includes('access.accessOffers'));
});

test('official airport price evidence can enrich records that already have airport source metadata', () => {
  const gatwickNo1North = catalog.records.find((record) => record.lounge.id === 'LGW-lgw15-no1-lounge-gatwick-908');
  const gatwickNo1South = catalog.records.find((record) => record.lounge.id === 'LGW-lgw17-no1-lounge-gatwick-914');
  const clubroomsNorth = catalog.records.find((record) =>
    record.lounge.id === 'candidate-airport-official-pages-lgw-airport-official-pages-lgw-clubrooms-north-terminal'
  );

  assert.equal(gatwickNo1North?.location.terminal, 'North Terminal');
  assert.equal(gatwickNo1North?.location.gate, 'Upper Level');
  assert.equal(gatwickNo1North?.accessOffers[0]?.currency, 'GBP');
  assert.equal(gatwickNo1North?.accessOffers[0]?.amount, 38);
  assert.ok(gatwickNo1North?.accessOffers[0]?.url.includes('gatwickairport.com/premium-services/lounge-airport/lounge-no1'));

  assert.equal(gatwickNo1South?.location.terminal, 'South Terminal');
  assert.equal(gatwickNo1South?.accessOffers[0]?.currency, 'GBP');
  assert.equal(gatwickNo1South?.accessOffers[0]?.amount, 38);
  assert.ok(gatwickNo1South?.accessOffers[0]?.url.includes('gatwickairport.com/premium-services/lounge-airport/lounge-no1'));

  assert.equal(clubroomsNorth?.location.terminal, 'North Terminal');
  assert.equal(clubroomsNorth?.accessOffers[0]?.currency, 'GBP');
  assert.equal(clubroomsNorth?.accessOffers[0]?.amount, 44);
  assert.ok(clubroomsNorth?.accessOffers[0]?.url.includes('gatwickairport.com/premium-services/lounge-airport/lounge-clubrooms'));
});

test('official partner booking pages enrich only one-to-one same-family price evidence', () => {
  const dfwPlaza = catalog.records.find((record) => record.lounge.id === 'DFW-dfw14-plaza-premium-lounge-410');
  const dfwMarhabaPartner = catalog.records.find((record) => record.lounge.id === 'candidate-marhaba-dfw-dfw-dallas-departure-lounge');
  const mcoClubA = catalog.records.find((record) => record.lounge.id === 'MCO-mco2-the-club-mco-gates-1-29-1019');

  assert.equal(dfwPlaza?.location.terminal, 'Terminal E');
  assert.equal(dfwPlaza?.accessOffers[0]?.currency, 'USD');
  assert.equal(dfwPlaza?.accessOffers[0]?.amount, 69);
  assert.equal(dfwPlaza?.accessOffers[0]?.sourceId, 'plaza-premium');
  assert.ok(dfwPlaza?.accessOffers[0]?.url.includes('plazapremiumlounge.com/en-uk/find/americas/united-states-of-america/dallas-fort-worth'));

  assert.equal(dfwMarhabaPartner?.location.terminal, 'Terminal E');
  assert.equal(dfwMarhabaPartner?.accessOffers[0]?.currency, 'AED');
  assert.equal(dfwMarhabaPartner?.accessOffers[0]?.amount, 184);
  assert.equal(dfwMarhabaPartner?.accessOffers[0]?.sourceId, 'marhaba');
  assert.ok(dfwMarhabaPartner?.accessOffers[0]?.url.includes('marhabaservices.com/ae/english/global-lounges/dallas-departure-lounge'));

  assert.equal(mcoClubA?.location.terminal, 'Terminal A Concourse 1');
  assert.equal(mcoClubA?.accessOffers[0]?.currency, 'GBP');
  assert.equal(mcoClubA?.accessOffers[0]?.amount, 45);
  assert.equal(mcoClubA?.accessOffers[0]?.sourceId, 'no1-lounges');
  assert.ok(mcoClubA?.accessOffers[0]?.url.includes('no1lounges.com/lounges-by-location/the-club-at-orlando'));
});

test('official Be Relax pages enrich same-terminal spa gate evidence only', () => {
  const dfwTerminalB = catalog.records.find((record) => record.lounge.id === 'DFW-dfw12s-be-relax-spa-411');
  const dfwTerminalD = catalog.records.find((record) => record.lounge.id === 'DFW-dfw13s-be-relax-spa-406');
  const laxTerminal1 = catalog.records.find((record) => record.lounge.id === 'LAX-lax19s-be-relax-spa-887');
  const laxTomBradley = catalog.records.find((record) => record.lounge.id === 'LAX-lax22s-be-relax-spa-888');

  assert.equal(dfwTerminalB?.location.terminal, 'Terminal B');
  assert.equal(dfwTerminalB?.location.gate, 'Gate 28');
  assert.ok(dfwTerminalB?.sources.find((source) => source.sourceId === 'be-relax')?.url.includes('dallas-fort-worth'));

  assert.equal(dfwTerminalD?.location.terminal, 'Terminal D');
  assert.equal(dfwTerminalD?.location.gate, 'Gate 21');

  assert.equal(laxTerminal1?.location.terminal, 'Terminal 1');
  assert.equal(laxTerminal1?.location.gate, 'Gate 12');

  assert.equal(laxTomBradley?.location.terminal, 'Tom Bradley International Terminal');
  assert.equal(laxTomBradley?.location.gate, 'Gate 154');
});

test('official alliance pages enrich only bijective gate and hours evidence', () => {
  const amdLounge = catalog.records.find((record) => record.lounge.id === 'AMD-amd7-the-lounge-138');
  const dfwClub = catalog.records.find((record) => record.lounge.id === 'DFW-dfw7-the-club-dfw-409');
  const oakEscape = catalog.records.find((record) => record.lounge.id === 'OAK-oak-escape-lounges-1187');
  const kixLounge = catalog.records.find((record) => record.lounge.id === 'candidate-oneworld-kix-1792');
  const jfkPrimeclass = catalog.records.find(
    (record) =>
      record.airport.iata === 'JFK' &&
      record.lounge.name === 'Primeclass Lounge' &&
      record.sources.some((source) => source.sourceId === 'oneworld'),
  );
  const bkkCathay = catalog.records.find(
    (record) =>
      record.airport.iata === 'BKK' &&
      record.lounge.name === 'Cathay Pacific First and Business Class Lounge' &&
      record.sources.some((source) => source.sourceId === 'airport-official-pages'),
  );
  const bkkJal = catalog.records.find(
    (record) =>
      record.airport.iata === 'BKK' &&
      record.lounge.name === 'Japan Airlines JAL Sakura Lounge' &&
      record.sources.some((source) => source.sourceId === 'airport-official-pages'),
  );
  const adlPlazaFirst = catalog.records.find((record) => record.lounge.id === 'ADL-adl4-plaza-premium-lounge-14');
  const adlPlazaSecond = catalog.records.find((record) => record.lounge.id === 'ADL-adl5-plaza-premium-lounge-16');

  assert.equal(amdLounge?.location.terminal, 'Terminal 2');
  assert.equal(amdLounge?.location.gate, 'Gate 3');
  assert.ok(amdLounge?.sources.find((source) => source.sourceId === 'oneworld')?.fieldCoverage.includes('location.gate'));

  assert.equal(dfwClub?.location.terminal, 'Terminal D');
  assert.equal(dfwClub?.location.gate, 'Gates D21 & D22');
  assert.ok(dfwClub?.sources.find((source) => source.sourceId === 'oneworld')?.fieldCoverage.includes('location.gate'));

  assert.equal(oakEscape?.location.terminal, 'Terminal 1');
  assert.equal(oakEscape?.location.gate, 'Gates 8 & 8A');

  assert.match(kixLounge?.operations.hours ?? '', /Sun 06:00-02:15/);
  assert.ok(kixLounge?.sources.find((source) => source.sourceId === 'oneworld')?.fieldCoverage.includes('operations.hours'));

  assert.equal(jfkPrimeclass?.location.gate, 'Gates 8 & 9');
  assert.match(jfkPrimeclass?.operations.hours ?? '', /Monday: 11:00 - 21:00/);
  assert.ok(jfkPrimeclass?.sources.find((source) => source.sourceId === 'oneworld')?.fieldCoverage.includes('operations.hours'));

  assert.match(bkkCathay?.operations.hours ?? '', /Sun 05:05-18:30/);
  assert.ok(bkkCathay?.sources.find((source) => source.sourceId === 'oneworld')?.fieldCoverage.includes('operations.hours'));

  assert.match(bkkJal?.operations.hours ?? '', /Mon 05:35-08:05/);
  assert.ok(bkkJal?.sources.find((source) => source.sourceId === 'oneworld')?.fieldCoverage.includes('operations.hours'));

  assert.equal(adlPlazaFirst?.location.gate, '');
  assert.equal(adlPlazaSecond?.location.gate, '');
  assert.equal(adlPlazaFirst?.sources.some((source) => source.sourceId === 'oneworld'), false);
  assert.equal(adlPlazaSecond?.sources.some((source) => source.sourceId === 'oneworld'), false);
});

test('official price pages enrich only bijective paid access evidence with source provenance', () => {
  const heathrowClubrooms = catalog.records.find((record) =>
    record.lounge.id === 'LHR-lhr34-clubrooms-lhr-terminal-3-additional-fee-applies-926'
  );
  const manchesterEscapeT1 = catalog.records.find((record) => record.lounge.id === 'candidate-oneworld-man-1618');
  const birminghamNo1 = catalog.records.find((record) => record.lounge.id === 'BHX-bhx6-no1-lounge-birmingham-297');
  const dubaiMarhabaDwc = catalog.records.find((record) => record.lounge.id === 'DWC-dwc-marhaba-lounge-486');
  const bostonChaseTerminalB = catalog.records.find((record) =>
    record.lounge.id === 'BOS-bos19-chase-sapphire-lounge-by-the-club-357'
  );
  const closedDubaiConcourseC = catalog.records.find((record) => record.lounge.id === 'DXB-dxb1-marhaba-lounge-498');
  const manchesterAirportSource = manchesterEscapeT1?.sources.find(
    (source) => source.sourceId === 'airport-official-pages'
  );

  assert.equal(heathrowClubrooms?.accessOffers[0]?.currency, 'GBP');
  assert.equal(heathrowClubrooms?.accessOffers[0]?.amount, 48);
  assert.equal(heathrowClubrooms?.accessOffers[0]?.sourceId, 'no1-lounges');
  assert.ok(heathrowClubrooms?.sources.find((source) => source.sourceId === 'no1-lounges')?.url.includes('clubrooms-at-heathrow-t3'));

  assert.deepEqual(manchesterEscapeT1?.accessOffers, [
    {
      type: 'paid_entry',
      label: 'GBP 45',
      amount: 45,
      currency: 'GBP',
      sourceId: 'plaza-premium',
      url: 'https://www.plazapremiumlounge.com/en-uk/find/europe/united-kingdom/manchester-man/manchester-international-airport-man/escapet1?propertycode=PRPRTY983&currency=GBP&date=2026-07-15&time=0300',
      retrievedAt: report.generatedAt,
    },
  ]);
  assert.ok(manchesterAirportSource?.fieldCoverage.includes('location.gate'));
  assert.equal(manchesterAirportSource?.fieldCoverage.includes('access.accessOffers'), false);
  assert.equal(manchesterEscapeT1?.sources.some((source) => source.sourceId === 'escape-lounges'), false);

  assert.equal(birminghamNo1?.location.terminal, 'Unknown');
  assert.equal(birminghamNo1?.accessOffers[0]?.currency, 'GBP');
  assert.equal(birminghamNo1?.accessOffers[0]?.amount, 40);
  assert.equal(birminghamNo1?.accessOffers[0]?.sourceId, 'no1-lounges');

  assert.equal(dubaiMarhabaDwc?.location.terminal, 'Unknown');
  assert.equal(dubaiMarhabaDwc?.accessOffers[0]?.currency, 'AED');
  assert.equal(dubaiMarhabaDwc?.accessOffers[0]?.amount, 194.5);
  assert.equal(dubaiMarhabaDwc?.accessOffers[0]?.sourceId, 'marhaba');

  assert.deepEqual(bostonChaseTerminalB?.accessOffers, []);
  assert.deepEqual(closedDubaiConcourseC?.accessOffers, []);
});

test('official location pages enrich only bijective name-brand family fields', () => {
  const sinBlossom = catalog.records.find((record) => record.lounge.id === 'SIN-sin20-blossom-lounge-1417');
  const sinQatarPremium = catalog.records.find((record) =>
    record.lounge.id === 'candidate-qatar-airways-sin-qatar-airways-sin-qatar-airways-premium-lounge-singapore-changi-airport'
  );
  const jfkChelsea = catalog.records.find((record) => record.lounge.id === 'candidate-oneworld-jfk-1399');
  const esbPrimeclass = catalog.records.find((record) => record.lounge.id === 'ESB-esb1-primeclass-lounge-525');
  const fcoPrimeclass = catalog.records.find((record) => record.lounge.id === 'FCO-fco3-tav-primeclass-fco-539');
  const jfkPrimeclass = catalog.records.find((record) => record.lounge.id === 'JFK-jfk14-primeclass-lounge-789');
  const manEscape = catalog.records.find((record) => record.lounge.id === 'candidate-oneworld-man-1618');
  const sofPrimeclass = catalog.records.find((record) => record.lounge.id === 'candidate-oneworld-sof-1891');
  const oryExtime = catalog.records.find((record) =>
    record.lounge.id === 'candidate-primeclass-ory-ory-extime-lounge-terminal-4-orly-international-airport'
  );
  const cfsQantasRegional = catalog.records.find((record) => record.lounge.id === 'candidate-oneworld-cfs-1105');
  const kgiQantasRegional = catalog.records.find((record) => record.lounge.id === 'candidate-oneworld-kgi-1110');
  const adlQantasClubDomestic = catalog.records.find((record) => record.lounge.id === 'candidate-oneworld-adl-1094');

  assert.equal(sinBlossom?.location.gate, 'Unit 02-225');
  assert.ok(sinBlossom?.sources.find((source) => source.sourceId === 'airport-official-pages')?.fieldCoverage.includes('location.gate'));

  assert.equal(sinQatarPremium?.location.gate, 'Unit 03-05');
  assert.ok(sinQatarPremium?.sources.find((source) => source.sourceId === 'airport-official-pages')?.fieldCoverage.includes('location.gate'));

  assert.equal(jfkChelsea?.location.gate, 'Lounge Level');
  assert.ok(jfkChelsea?.sources.find((source) => source.sourceId === 'airport-official-pages')?.fieldCoverage.includes('location.gate'));

  assert.equal(esbPrimeclass?.location.gate, 'Gate 109');
  assert.ok(esbPrimeclass?.sources.find((source) => source.sourceId === 'primeclass')?.fieldCoverage.includes('location.gate'));

  assert.equal(fcoPrimeclass?.location.gate, 'Mezzanine Level');
  assert.equal(jfkPrimeclass?.location.gate, 'Gates 8 & 9');
  assert.equal(manEscape?.location.gate, 'Premium Lounges');
  assert.equal(sofPrimeclass?.location.gate, 'Level 2');

  assert.equal(oryExtime?.location.gate, '');
  assert.equal(
    oryExtime?.operations.hours,
    'Mon 06:00-22:00; Tue 06:00-22:00; Wed 06:00-22:00; Thu 06:00-22:00; Fri 06:00-22:00; Sat 06:00-22:00; Sun 06:00-22:00',
  );
  assert.ok(oryExtime?.sources.find((source) => source.sourceId === 'primeclass')?.fieldCoverage.includes('operations.hours'));

  assert.equal(cfsQantasRegional?.operations.hours, 'One hour prior to each Qantas operated service until last Qantas departure.');
  assert.ok(cfsQantasRegional?.sources.find((source) => source.sourceId === 'qantas')?.fieldCoverage.includes('operations.hours'));
  assert.equal(kgiQantasRegional?.operations.hours, 'One hour prior to each Qantas operated service until last Qantas departure.');
  assert.ok(kgiQantasRegional?.sources.find((source) => source.sourceId === 'qantas')?.fieldCoverage.includes('operations.hours'));
  assert.equal(adlQantasClubDomestic?.operations.hours, '');
});

test('official operator price evidence enriches same-family existing records', () => {
  const clubCvg = catalog.records.find((record) => record.lounge.id === 'CVG-cvg2-the-club-cvg-429');
  const airportDimensionsSource = clubCvg?.sources.find((source) => source.sourceId === 'airport-dimensions');

  assert.equal(clubCvg?.location.terminal, 'Concourse A');
  assert.equal(clubCvg?.accessOffers[0]?.currency, 'GBP');
  assert.equal(clubCvg?.accessOffers[0]?.amount, 38);
  assert.equal(clubCvg?.accessOffers[0]?.sourceId, 'airport-dimensions');
  assert.ok(airportDimensionsSource?.url.includes('theclubairportlounges.com/lounges/cvg-the-club-concourse-a'));
  assert.ok(airportDimensionsSource?.fieldCoverage.includes('access.accessOffers'));
});

test('operator enrichment keeps Manchester Aspire terminal prices separated', () => {
  const aspireTerminal13 = catalog.records.find((record) => record.lounge.id === 'MAN-man6-aspire-lounge-1010');
  const aspireTerminal2 = catalog.records.find((record) => record.lounge.id === 'MAN-man3-aspire-lounge-1011');

  assert.equal(aspireTerminal13?.location.terminal, 'Terminal 1 \\u0026 3');
  assert.equal(aspireTerminal13?.accessOffers[0]?.currency, 'GBP');
  assert.equal(aspireTerminal13?.accessOffers[0]?.amount, 38);
  assert.ok(aspireTerminal13?.accessOffers[0]?.url.includes('aspire-at-manchester-terminal-1'));

  assert.equal(aspireTerminal2?.location.terminal, 'Terminal 2');
  assert.equal(aspireTerminal2?.accessOffers[0]?.currency, 'GBP');
  assert.equal(aspireTerminal2?.accessOffers[0]?.amount, 46);
  assert.ok(aspireTerminal2?.accessOffers[0]?.url.includes('aspire-at-manchester-terminal-2'));
});

test('American official club pages add airline-operated gate and hours evidence', () => {
  const americanSource = report.sources.find((source) => source.sourceId === 'american');
  const dfwTerminalA = candidates.find((record) =>
    record.sources.some((source) => source.sourceId === 'american') &&
    record.airport.iata === 'DFW' &&
    record.lounge.name === 'Admirals Club, Terminal A'
  );
  const ordConcourseL = candidates.find((record) =>
    record.sources.some((source) => source.sourceId === 'american') &&
    record.airport.iata === 'ORD' &&
    record.lounge.name === 'Admirals Club, Terminal 3, Concourse L'
  );

  assert.equal(americanSource?.status, 'fetched');
  assert.equal(americanSource?.records, 13);
  assert.deepEqual(americanSource?.airportCodes, ['CLT', 'DFW', 'JFK', 'LAX', 'ORD']);
  assert.equal(americanSource?.structuredRecords.length, 13);
  assert.equal(americanSource?.structuredApi.pages.length, 5);
  assert.equal(dfwTerminalA?.location.gate, 'Gate A24');
  assert.match(dfwTerminalA?.operations.hours ?? '', /04:00-22:15/);
  assert.equal(ordConcourseL?.location.gate, 'Gate L1');
  assert.match(ordConcourseL?.operations.hours ?? '', /05:00-21:45/);
});

test('Delta official locations page adds structured lounge rows', () => {
  const deltaSource = report.sources.find((source) => source.sourceId === 'delta');
  const deltaRows = candidates.filter((record) => record.sources.some((source) => source.sourceId === 'delta'));
  const gateRows = fieldCoverageReport.rows.filter((record) => record.sourceId === 'delta' && record.hasGate);

  assert.equal(deltaSource?.status, 'fetched');
  assert.equal(deltaSource?.structuredApi.parser, 'delta-sky-club-structured');
  assert.ok(deltaSource?.structuredRecords.length >= 90);
  assert.ok(deltaRows.length >= 90);
  assert.ok(gateRows.length >= 40);
  assert.ok(deltaRows.every((record) => record.operations.hours));
  assert.ok(deltaRows.every((record) => record.sources[0].url.startsWith('https://www.delta.com/')));
});

test('lounge field coverage report tracks hours, gate, and price review gaps one by one', () => {
  assert.equal(fieldCoverageReport.rows.length, catalog.records.length);
  assert.equal(fieldCoverageReport.stats.totals.total, catalog.records.length);
  assert.ok(fieldCoverageReport.stats.totals.hours > 2000);
  assert.ok(fieldCoverageReport.stats.totals.gate >= 270);
  assert.ok(fieldCoverageReport.stats.totals.accessOffers >= 46);
  assert.equal(
    fieldCoverageReport.stats.totals.missingAccessOffers,
    catalog.records.length - fieldCoverageReport.stats.totals.accessOffers,
  );
  assert.match(fieldCoverageReport.policy.priceRule, /explicit structured amount and ISO currency/);

  const seaClub = fieldCoverageReport.rows.find((row) => row.recordId === 'candidate-oneworld-sea-1595');
  assert.equal(seaClub.hasHours, true);
  assert.equal(seaClub.hasGate, true);
  assert.equal(seaClub.hasAccessOffer, false);

  const escapeCvg = fieldCoverageReport.rows.find((row) => row.recordId === 'CVG-cvg7-escape-lounges-431');
  assert.equal(escapeCvg.hasHours, true);
  assert.equal(escapeCvg.hasGate, true);
  assert.equal(escapeCvg.hasAccessOffer, true);
});

test('official Priority Pass detail pages enrich missing hours, fee, and position evidence', () => {
  const ambaarCnf = catalog.records.find((record) => record.lounge.id === 'CNF-cnf1-ambaar-lounge-85');
  const advantageCnf = catalog.records.find((record) => record.lounge.id === 'CNF-cnf4-advantage-vip-lounge-86');
  const siestaBox = catalog.records.find((record) => record.lounge.id === 'CNF-cnf8r-siesta-box-confins-87');
  const tgiFridays = catalog.records.find((record) => record.lounge.id === 'AUH-auh13d-tgi-fridays-200');
  const jabbrrbox = catalog.records.find((record) => record.lounge.id === 'AUS-aus1w-jabbrrbox-203');
  const salaVip = catalog.records.find((record) => record.lounge.id === 'BAQ-baq4-sala-vip-lounge-las-americas-119');
  const bahrainAirportHotel = catalog.records.find((record) => record.lounge.id === 'BAH-bah15r-bahrain-airport-hotel-12');
  const anshanFirstClass = catalog.records.find((record) => record.lounge.id === 'AOG-aog-first-class-lounge-151');
  const blueSkyPremier = catalog.records.find((record) => record.lounge.id === 'CGK-cgk18-blue-sky-premier-lounge-251');
  const gardenTerrace = catalog.records.find((record) => record.lounge.id === 'DUB-dub4d-garden-terrace-478');
  const dtwGamewayA17 = catalog.records.find((record) => record.lounge.id === 'DTW-dtw11g-gameway-476');
  const dtwGamewayA63 = catalog.records.find((record) => record.lounge.id === 'DTW-dtw10g-gameway-477');
  const atyrauCip = catalog.records.find((record) => record.lounge.id === 'GUW-guw-cip-lounge-614');
  const wuhanV1 = catalog.records.find((record) => record.lounge.id === 'WUH-wuh14-china-eastern-airlines-v1-lounge-1665');
  const yibinFirstClass = catalog.records.find((record) => record.lounge.id === 'YBP-ybp-first-class-lounge-02-1704');
  const yantaiInternational = catalog.records.find((record) => record.lounge.id === 'YNT-ynt4-frist-business-class-lounge-06-1713');
  const yantaiDomestic = catalog.records.find((record) => record.lounge.id === 'YNT-ynt3-airlines-lounge-02-1714');
  const hanedaGrandeAile = catalog.records.find((record) => record.lounge.id === 'HND-hnd19d-all-day-dining-grande-aile-694');
  const limaTgiFridays = catalog.records.find((record) => record.lounge.id === 'LIM-lim15d-tgi-fridays-938');
  const madridGettSleep = catalog.records.find((record) => record.lounge.id === 'MAD-mad10r-gettsleep-998');
  const kulKepler = catalog.records.find((record) => record.lounge.id === 'KUL-kul41-kepler-club-858');
  const kulTravellers = catalog.records.find(
    (record) => record.lounge.id === 'KUL-kul14d-travellers-bar-and-grill-sama-sama-hotel-865',
  );

  assert.equal(ambaarCnf?.operations.hours, '00:00 - 23:59 daily');
  assert.equal(ambaarCnf?.location.gate, '');
  assert.match(ambaarCnf?.location.directions ?? '', /after check-in and X-ray/);
  assert.equal(ambaarCnf?.sources.find((source) => source.sourceId === 'priority-pass')?.retrievedAt, '2026-07-14T00:00:00.000Z');

  assert.equal(advantageCnf?.operations.hours, '00:00 - 23:59 daily');
  assert.equal(advantageCnf?.location.gate, 'Gate 2');
  assert.match(advantageCnf?.location.directions ?? '', /2nd Floor/);
  assert.ok(advantageCnf?.sources.find((source) => source.sourceId === 'priority-pass')?.fieldCoverage.includes('location.gate'));

  assert.equal(tgiFridays?.location.gate, 'Pier C');
  assert.equal(tgiFridays?.accessOffers[0]?.currency, 'AED');
  assert.equal(tgiFridays?.accessOffers[0]?.amount, 99);

  assert.equal(jabbrrbox?.location.gate, 'Gate 15');
  assert.equal(jabbrrbox?.accessOffers[0]?.currency, 'USD');
  assert.equal(jabbrrbox?.accessOffers[0]?.amount, 37.5);

  assert.equal(siestaBox?.operations.hours, '00:00 - 23:59 daily');
  assert.equal(siestaBox?.location.gate, 'Check-in Azul Airlines');
  assert.match(siestaBox?.location.directions ?? '', /Azul Airlines check-in counter/);
  assert.equal(siestaBox?.sources.find((source) => source.sourceId === 'priority-pass')?.retrievedAt, '2026-07-14T00:00:00.000Z');

  assert.equal(salaVip?.operations.hours, '03:00 - 23:00 daily');
  assert.equal(salaVip?.location.terminal, 'Domestic');
  assert.equal(salaVip?.accessOffers[0]?.currency, 'USD');
  assert.equal(salaVip?.accessOffers[0]?.amount, 10);
  assert.equal(salaVip?.accessOffers[0]?.retrievedAt, '2026-07-14T00:00:00.000Z');
  assert.ok(salaVip?.sources.find((source) => source.sourceId === 'priority-pass')?.fieldCoverage.includes('access.accessOffers'));

  assert.equal(bahrainAirportHotel?.operations.hours, '00:00 - 23:59 daily');
  assert.equal(bahrainAirportHotel?.location.gate, 'Gate 15');
  assert.equal(bahrainAirportHotel?.accessOffers.length, 0);
  assert.ok(bahrainAirportHotel?.sources.find((source) => source.sourceId === 'priority-pass')?.fieldCoverage.includes('location.gate'));

  assert.equal(anshanFirstClass?.operations.hours, '');
  assert.equal(anshanFirstClass?.location.gate, 'Level 2');
  assert.match(anshanFirstClass?.location.directions ?? '', /20 metres ahead/);

  assert.equal(blueSkyPremier?.operations.hours, '');
  assert.equal(blueSkyPremier?.location.gate, 'Upper Floor');

  assert.equal(gardenTerrace?.operations.hours, '');
  assert.equal(gardenTerrace?.location.gate, 'Mezzanine Level');
  assert.equal(gardenTerrace?.accessOffers[0]?.currency, 'EUR');
  assert.equal(gardenTerrace?.accessOffers[0]?.amount, 23);

  assert.equal(dtwGamewayA17?.location.gate, 'Gate A17');
  assert.equal(dtwGamewayA17?.accessOffers[0]?.currency, 'USD');
  assert.equal(dtwGamewayA17?.accessOffers[0]?.amount, 19.95);
  assert.ok(dtwGamewayA17?.accessOffers[0]?.url.includes('gameway.gg/location/dtw-airport-2-2'));
  assert.equal(dtwGamewayA63?.location.gate, 'Gate A63');
  assert.equal(dtwGamewayA63?.accessOffers[0]?.currency, 'USD');
  assert.equal(dtwGamewayA63?.accessOffers[0]?.amount, 19.95);
  assert.ok(dtwGamewayA63?.accessOffers[0]?.url.includes('gameway.gg/location/dtw-airport-9-2'));

  assert.equal(atyrauCip?.operations.hours, '00:00 - 23:59 daily');
  assert.equal(wuhanV1?.operations.hours, '05:50 - 19:00 daily');
  assert.equal(wuhanV1?.location.gate, 'Gate 29');
  assert.equal(yibinFirstClass?.operations.hours, 'Linked to flight: First flight - last flight');
  assert.equal(yibinFirstClass?.location.gate, 'Gate 7');
  assert.equal(yantaiInternational?.operations.hours, 'Linked to flight: Lounge opens 90 minutes prior to each scheduled flight departure.');
  assert.equal(yantaiInternational?.location.gate, 'International Departures');
  assert.equal(yantaiDomestic?.operations.hours, 'Linked to flight: 06:00 - last flight');
  assert.equal(yantaiDomestic?.location.gate, 'Gate 216');
  assert.equal(hanedaGrandeAile?.location.gate, 'Level 1');
  assert.equal(hanedaGrandeAile?.accessOffers[0]?.currency, 'JPY');
  assert.equal(hanedaGrandeAile?.accessOffers[0]?.amount, 3400);

  assert.equal(limaTgiFridays?.operations.hours, '00:00 - 23:59 daily');
  assert.equal(limaTgiFridays?.location.gate, 'Gates A3 & A4');
  assert.equal(limaTgiFridays?.accessOffers[0]?.currency, 'USD');
  assert.equal(limaTgiFridays?.accessOffers[0]?.amount, 27);
  assert.equal(limaTgiFridays?.accessOffers[0]?.retrievedAt, '2026-07-14T00:00:00.000Z');
  assert.ok(limaTgiFridays?.sources.find((source) => source.sourceId === 'priority-pass')?.fieldCoverage.includes('access.accessOffers'));

  assert.equal(madridGettSleep?.operations.hours, '24 hours daily');
  assert.equal(madridGettSleep?.accessOffers.length, 0);

  assert.equal(kulKepler?.operations.hours, '00:00 - 23:59 daily');
  assert.equal(kulKepler?.location.gate, 'Level 2');
  assert.equal(kulKepler?.accessOffers.length, 0);
  assert.equal(kulTravellers?.operations.hours, '16:00 - 01:00 daily');
  assert.equal(kulTravellers?.location.gate, 'Level 2');
  assert.equal(kulTravellers?.accessOffers.length, 0);
});
