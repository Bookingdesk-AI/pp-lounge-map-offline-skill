import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

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

test('airline-operated Priority Pass records prefer airline brand assets over source fallback', () => {
  const expectedAssets = new Map([
    ['IAD-iad6-air-france-klm-lounge-719', 'air-france-klm'],
    ['IAD-iad8-virgin-atlantic-clubhouse-721', 'virgin-atlantic'],
    ['IAD-iad17-the-etihad-lounge-722', 'etihad'],
    ['IAD-iad11-turkish-airlines-lounge-washington-723', 'turkish-airlines'],
    ['candidate-oneworld-iad-836', 'british-airways'],
    ['candidate-oneworld-sea-1583', 'alaska-airlines'],
    ['candidate-oneworld-sea-833', 'british-airways'],
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
    ['oneworld', 'oneworld.svg'],
    ['star-alliance', 'star-alliance.svg'],
    ['skyteam', 'skyteam.png'],
  ];

  for (const [brandId, fileName] of allianceBrands) {
    const brand = brands.find((candidate) => candidate.id === brandId);
    assert.ok(brand, `missing brand ${brandId}`);
    assert.equal(brand.logoUrl, `https://all-routes.desk.travel/brand-logos/alliances/${fileName}`);
    assert.ok(brand.fallbackLogoUrl.startsWith('https://src.desk.travel/brand-logos/alliances/'));
    assert.equal(brand.deskTravelAssetKey, `all-routes:brand/${brandId}`);
    assert.equal(fs.existsSync(new URL(`../public/data/brand-logos/${brand.id}.svg`, import.meta.url)), false);
    assert.ok(brand.rightsNote.includes('all-routes'));
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
