import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const brands = JSON.parse(fs.readFileSync(new URL('../public/data/brand-registry.json', import.meta.url), 'utf8'));
const sourceRegistry = JSON.parse(fs.readFileSync(new URL('../public/data/source-registry.json', import.meta.url), 'utf8'));
const deskTravelImport = JSON.parse(
  fs.readFileSync(new URL('../public/data/desk-travel-brand-import.json', import.meta.url), 'utf8'),
);
const brandAssetContract = JSON.parse(
  fs.readFileSync(new URL('../public/data/brand-asset-contract.json', import.meta.url), 'utf8'),
);
const canonical = JSON.parse(fs.readFileSync(new URL('../public/data/lounge-guru-catalog.json', import.meta.url), 'utf8'));

test('brand registry exports Desk.Travel asset mappings with provenance', () => {
  assert.ok(brands.length >= 15);
  assert.equal(deskTravelImport.target, 'desk.travel.brand_assets');
  assert.equal(deskTravelImport.mode, 'upsert');
  assert.equal(deskTravelImport.records.length, brands.length);

  for (const brand of brands) {
    assert.ok(brand.id);
    assert.ok(brand.name);
    assert.match(
      brand.logoUrl,
      /^(\/data\/brand-logos\/|https:\/\/src\.desk\.travel\/brand-logos\/|https:\/\/all-routes\.desk\.travel\/brand-logos\/)/,
    );
    assert.match(brand.deskTravelAssetKey, /^(desk-travel|all-routes):brand\//);
    assert.ok(brand.sourceUrl.startsWith('https://'));
    assert.match(brand.rightsNote, /(Desk\.Travel|all-routes)/);
  }
});

test('source registry links providers to brand assets', () => {
  const brandIds = new Set(brands.map((brand) => brand.id));
  const deskTravelSource = sourceRegistry.find((source) => source.id === 'desk-travel-brand-database');
  assert.ok(deskTravelSource);
  assert.equal(deskTravelSource.records, brands.length);

  for (const source of sourceRegistry) {
    for (const brandId of source.brandIds ?? []) {
      assert.ok(brandIds.has(brandId), `${source.id} references missing brand ${brandId}`);
    }
  }
});

test('canonical lounge records include display-ready brand assets', () => {
  const firstRecord = canonical.records[0];
  assert.ok(firstRecord.lounge.brandAsset);
  assert.ok(firstRecord.lounge.brandAsset.logoText);
  assert.ok(firstRecord.lounge.brandAsset.logoUrl);
});

test('airline-operated lounge records prefer airline brand assets over source fallback', () => {
  const expectedAssets = new Map([
    ['IAD-iad6-air-france-klm-lounge-719', 'air-france-klm'],
    ['IAD-iad8-virgin-atlantic-clubhouse-721', 'virgin-atlantic'],
    ['IAD-iad17-the-etihad-lounge-722', 'etihad'],
    ['IAD-iad11-turkish-airlines-lounge-washington-723', 'turkish-airlines'],
    ['candidate-oneworld-iad-836', 'british-airways'],
    ['candidate-oneworld-sea-1583', 'alaska-airlines'],
    ['candidate-oneworld-sea-833', 'british-airways'],
    ['candidate-oneworld-hkg-885', 'cathay-pacific'],
    ['candidate-oneworld-bkk-1017', 'japan-airlines'],
    ['candidate-oneworld-kul-1059', 'malaysia-airlines'],
    ['candidate-oneworld-hel-771', 'finnair'],
    ['candidate-oneworld-mad-945', 'iberia'],
    ['candidate-oneworld-amm-1218', 'royal-jordanian'],
    ['candidate-oneworld-nan-1790', 'fiji-airways'],
    ['candidate-oneworld-bkk-1753', 'oman-air'],
    ['candidate-oneworld-lim-1867', 'latam-airlines'],
    ['candidate-oneworld-hkg-1725', 'qantas'],
    [
      'candidate-airport-official-pages-hkg-airport-official-pages-hkg-cathay-pacific-lounge-the-deck-terminal-1-near-gate-6',
      'cathay-pacific',
    ],
    ['candidate-capital-one-iad-capital-one-iad-capital-one-lounge', 'capital-one'],
  ]);

  for (const [recordId, brandId] of expectedAssets) {
    const record = canonical.records.find((candidate) => candidate.lounge.id === recordId);
    assert.ok(record, `missing canonical record ${recordId}`);
    assert.equal(record.lounge.brandAsset.id, brandId);
    assert.ok(record.lounge.brandAsset.logoUrl, `${recordId} missing display logo`);
  }
});

test('all-routes airline logos are served from centralized Desk.Travel brand storage', () => {
  const airlineBrandIds = [
    'air-france-klm',
    'british-airways',
    'turkish-airlines',
    'etihad',
    'virgin-atlantic',
    'united',
    'delta',
    'american-airlines',
    'air-canada',
    'alaska-airlines',
    'cathay-pacific',
    'japan-airlines',
    'malaysia-airlines',
    'finnair',
    'iberia',
    'royal-jordanian',
    'fiji-airways',
    'oman-air',
    'latam-airlines',
    'royal-air-maroc',
    'srilankan-airlines',
  ];

  for (const brandId of airlineBrandIds) {
    const brand = brands.find((candidate) => candidate.id === brandId);
    assert.ok(brand, `missing brand ${brandId}`);
    assert.ok(brand.logoUrl.startsWith('https://src.desk.travel/brand-logos/airlines/'));
    assert.ok(brand.fallbackLogoUrl.startsWith('https://src.desk.travel/brand-logos/airlines-transparent/'));
    assert.equal(fs.existsSync(new URL(`../public/data/brand-logos/${brand.id}.svg`, import.meta.url)), false);
    assert.ok(brand.rightsNote.includes('all-routes'));
  }
});

test('alliance logos are served from centralized all-routes brand storage', () => {
  const allianceBrands = [
    ['oneworld', 'oneworld.svg', 'oneworld-all-routes.svg', 'f98dba240b28b19a2c4b59152efcd5a6cf27b76833ff7d7a0bfcf09c600e4283'],
    [
      'star-alliance',
      'star-alliance.svg',
      'star-alliance-all-routes.svg',
      '862a2ed13e2373a543c6dae077ff2c24619215158ff6be5ace72b052c8a61e2e',
    ],
    ['skyteam', 'skyteam.png', 'skyteam-all-routes.png', 'a5709c79b6f3dabf760deb1446d5b8b5535310df2e35b3143fca47b83aa9f405'],
  ];

  for (const [brandId, upstreamFileName, fallbackFileName, sha256] of allianceBrands) {
    const brand = brands.find((candidate) => candidate.id === brandId);
    assert.ok(brand, `missing brand ${brandId}`);
    assert.equal(brand.logoUrl, `/data/brand-logos/${fallbackFileName}`);
    assert.equal(brand.upstreamLogoUrl, `https://all-routes.desk.travel/brand-logos/alliances/${upstreamFileName}`);
    assert.equal(brand.fallbackLogoUrl, undefined);
    assert.equal(brand.deskTravelAssetKey, `all-routes:brand/${brandId}`);
    const fallbackPath = new URL(`../public${brand.logoUrl}`, import.meta.url);
    assert.ok(fs.existsSync(fallbackPath));
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(fallbackPath)).digest('hex'), sha256);
    assert.equal(fs.existsSync(new URL(`../public/data/brand-logos/${brand.id}.svg`, import.meta.url)), false);
    assert.ok(brand.rightsNote.includes('all-routes'));
  }
});

test('reviewed lounge program and issuer logos render from same-origin assets', () => {
  const reviewedBrands = [
    [
      'priority-pass',
      'priority-pass-reviewed.svg',
      'https://upload.wikimedia.org/wikipedia/commons/7/77/Priority_Pass_logo.svg',
      '542deab06a712bdc2da4185c1fdde58457cbca96c8f47ad740093cec07c3db68',
    ],
    [
      'chase-sapphire',
      'chase-sapphire-lounge-reviewed.png',
      'https://runway-media-production.global.ssl.fastly.net/us/originals/2021/08/SapphireLoungeTheClub-Logo-FullColor-Digital-Large.jpg',
      '96aca69c0d0c1c5b98f5c23fa788d5869ba951325edb90267e5915b86cbda0b2',
    ],
    [
      'american-express',
      'centurion-lounge-reviewed.png',
      'https://cdn.prod.website-files.com/64146bf94f70d00b60750876/654172fed0b1988b98ff1c18_35-352052_american-express-centurion-lounge-logo-hd-png-download%20(4).png',
      '6422c6098c78a3594de27b0c734d8c3333ed37de2fd616323e0199bba6f97014',
    ],
    [
      'capital-one',
      'capital-one-travel-reviewed.svg',
      'https://images.contentstack.io/v3/assets/blt1788ad84f88b68a8/bltfb0a779302eedf93/61660dc8a8d4d0113d89bb04/COT_logo.svg',
      '02afe7bea7041ea216435dbadd05cf3c565277292210a0910324a0a320aab51b',
    ],
    [
      'mastercard-travel-pass',
      'loungekey-reviewed.png',
      'https://portal.loungekey.com/media/1020/lounge-kye-logo.png',
      '86b0dca59ad73b837f6c91f483c01960fc2b3c778dab84d84866bea5ec841267',
    ],
    [
      'plaza-premium',
      'plaza-premium-reviewed.png',
      'https://www.plazapremiumlounge.com/getContentAsset/7142b141-fd02-452d-919e-4a47a788a792/341dd76e-3aed-4a04-aa89-d958c5c0d319/PPL_logo.png?language=en-uk',
      '24ef2626097e16b404608cbec66c810968c9f96c124e8c90947e17793fbca7f5',
    ],
  ];

  for (const [brandId, fileName, upstreamLogoUrl, sha256] of reviewedBrands) {
    const brand = brands.find((candidate) => candidate.id === brandId);
    assert.ok(brand, `missing brand ${brandId}`);
    assert.equal(brand.logoUrl, `/data/brand-logos/${fileName}`);
    assert.equal(brand.upstreamLogoUrl, upstreamLogoUrl);
    const assetPath = new URL(`../public${brand.logoUrl}`, import.meta.url);
    assert.ok(fs.existsSync(assetPath), `${brandId} logo file missing`);
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(assetPath)).digest('hex'), sha256);
    assert.ok(/reviewed/i.test(brand.rightsNote), `${brandId} missing reviewed rights note`);
  }
});

test('SEA deep links keep explicit lounge selection when query matches airport code', () => {
  const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

  assert.match(appSource, /if \(!query \|\| selectedId \|\| autoSelectDismissedQuery === query\) \{/);
  assert.match(appSource, /\}, \[autoSelectDismissedQuery, query, filteredFeatures, selectedId\]\);/);
});

test('brand asset contract defines the approved Cloudflare storage path', () => {
  assert.equal(brandAssetContract.target.database, 'desk.travel.brand_assets');
  assert.equal(brandAssetContract.target.objectStorage, 'Cloudflare R2');
  assert.equal(brandAssetContract.target.publicOrigin, 'https://src.desk.travel');
  assert.equal(brandAssetContract.target.allRoutesPublicOrigin, 'https://all-routes.desk.travel');
  assert.equal(brandAssetContract.target.sameOriginAllianceFallbackPath, '/data/brand-logos/{allianceId}-all-routes.{svg|png}');
  assert.ok(brandAssetContract.allowedSourceClasses.some((sourceClass) => sourceClass.id === 'official_public_brand_source'));
  assert.ok(brandAssetContract.allowedSourceClasses.some((sourceClass) => sourceClass.id === 'generated_fallback_tile'));
  assert.ok(brandAssetContract.blockedSourceClasses.includes('unknown_rights_svg'));
  assert.ok(brandAssetContract.displayContract.resultRow.includes('before lounge.name'));
});

test('Chase Sapphire source overlap is merged into one physical lounge per airport', () => {
  const chaseRows = canonical.records.filter((record) => record.lounge.brandAsset?.id === 'chase-sapphire');
  const duplicateKeys = chaseRows.map((record) => `${record.airport.iata}:${record.lounge.name}`);

  assert.equal(new Set(duplicateKeys).size, duplicateKeys.length);

  const iadEtihad = canonical.records.find((record) => record.lounge.id === 'IAD-iad17-the-etihad-lounge-722');
  assert.ok(iadEtihad);
  assert.equal(iadEtihad.lounge.brandAsset.id, 'etihad');
  assert.ok(iadEtihad.sources.some((source) => source.sourceId === 'chase-sapphire'));

  const bos = chaseRows.find((record) => record.airport.iata === 'BOS');
  assert.ok(bos);
  assert.equal(bos.lounge.name, 'Chase Sapphire Lounge by The Club');
  assert.ok(bos.lounge.programs.includes('Priority Pass'));
  assert.ok(bos.lounge.programs.includes('Chase Sapphire Reserve'));
  assert.deepEqual(
    bos.sources.map((source) => source.sourceId),
    ['chase-sapphire', 'priority-pass', 'ourairports'],
  );
  assert.equal(bos.location.terminal, 'Terminal B');
  assert.match(bos.operations.hours, /05:00/);
});
