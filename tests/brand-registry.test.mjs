import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const brands = JSON.parse(fs.readFileSync(new URL('../public/data/brand-registry.json', import.meta.url), 'utf8'));
const sourceRegistry = JSON.parse(fs.readFileSync(new URL('../public/data/source-registry.json', import.meta.url), 'utf8'));
const deskTravelImport = JSON.parse(
  fs.readFileSync(new URL('../public/data/desk-travel-brand-import.json', import.meta.url), 'utf8'),
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
    assert.ok(brand.logoUrl.startsWith('/data/brand-logos/'));
    assert.ok(brand.deskTravelAssetKey.startsWith('desk-travel:brand/'));
    assert.ok(brand.sourceUrl.startsWith('https://'));
    assert.ok(brand.rightsNote.includes('Desk.Travel'));
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
