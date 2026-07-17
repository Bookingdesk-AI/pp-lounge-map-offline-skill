import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { redactSensitiveData, sanitizePublicUrl } from '../shared/security-redaction.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const catalogPath = path.resolve(projectRoot, 'public', 'data', 'lounge-guru-catalog.json');
const outputPath = path.resolve(projectRoot, 'public', 'data', 'lounge-map.json');
const logoHosts = ['src.desk.travel', 'all-routes.desk.travel'];

function compactBrand(brand) {
  if (!brand) {
    return undefined;
  }

  return {
    id: brand.id,
    name: brand.name,
    category: brand.category,
    aliases: Array.isArray(brand.aliases) ? brand.aliases : [],
    logoUrl: sanitizePublicUrl(brand.logoUrl, { allowedHosts: logoHosts }),
    fallbackLogoUrl: sanitizePublicUrl(brand.fallbackLogoUrl, { allowedHosts: logoHosts }),
    logoText: brand.logoText,
    color: brand.color,
    background: brand.background,
    foreground: brand.foreground,
  };
}

function compactSource(source) {
  return {
    sourceId: source.sourceId,
    publisher: source.publisher,
    url: sanitizePublicUrl(source.url, { allowRelative: false }),
    retrievedAt: source.retrievedAt,
    confidence: source.confidence,
  };
}

function compactRecord(record) {
  return {
    lounge: {
      id: record.lounge.id,
      name: record.lounge.name,
      brand: record.lounge.brand,
      brandAssetId: record.lounge.brandAsset?.id,
      operator: record.lounge.operator,
      category: record.lounge.category,
      status: record.lounge.status,
      programs: record.lounge.programs,
      accessMethods: record.lounge.accessMethods,
    },
    airport: {
      iata: record.airport.iata,
      icao: record.airport.icao,
      name: record.airport.name,
      city: record.airport.city,
      country: record.airport.country,
      timezone: record.airport.timezone,
      coordinates: record.airport.coordinates,
    },
    location: {
      terminal: record.location.terminal,
      concourse: record.location.concourse,
      gate: record.location.gate,
      securitySide: record.location.securitySide,
      directions: record.location.directions,
    },
    operations: {
      hours: record.operations.hours,
    },
    amenities: record.amenities,
    restrictions: record.restrictions,
    sources: (record.sources ?? []).slice(0, 1).map(compactSource),
    quality: {
      completeness: record.quality.completeness,
      freshness: record.quality.freshness,
      conflicts: record.quality.conflicts,
      reviewStatus: record.quality.reviewStatus,
    },
  };
}

function compactStats(stats) {
  const allowed = [
    'totalInputRows',
    'totalFeatures',
    'droppedRows',
    'uniqueAirports',
    'uniqueCountries',
    'uniqueCities',
    'totalSources',
    'totalCatalogRecords',
    'candidateRecords',
    'nonPriorityRecords',
    'reviewQueue',
    'approvedRecords',
  ];
  return Object.fromEntries(allowed.filter((key) => Number.isFinite(stats?.[key])).map((key) => [key, stats[key]]));
}

function compactQuality(quality) {
  return {
    averageCompleteness: quality?.averageCompleteness ?? 0,
    averageFreshness: quality?.averageFreshness ?? 0,
    conflictCount: quality?.conflictCount ?? 0,
    reviewQueue: quality?.reviewQueue ?? 0,
  };
}

async function main() {
  const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
  const records = catalog.records.map(compactRecord);
  const payload = redactSensitiveData({
    version: 1,
    generatedAt: catalog.generatedAt,
    meta: {
      generatedAt: catalog.generatedAt,
      sourceFile: 'lounge-guru-catalog',
      stats: compactStats(catalog.stats),
      filters: {
        types: catalog.filters.types,
        countries: catalog.filters.countries,
        cities: catalog.filters.cities,
        facilities: catalog.filters.facilities,
        providers: catalog.filters.providers,
        programs: catalog.filters.programs,
        reviewStatuses: catalog.filters.reviewStatuses,
      },
      quality: compactQuality(catalog.quality),
      issues: [],
    },
    brands: catalog.brands.map(compactBrand),
    records,
  });

  if (payload.records.length !== catalog.records.length) {
    throw new Error('Public map payload record count mismatch.');
  }

  const serialized = JSON.stringify(payload);
  const forbiddenFragments = [projectRoot, path.resolve(projectRoot, '..'), process.env.HOME || ''].filter(Boolean);
  for (const fragment of forbiddenFragments) {
    if (serialized.includes(fragment)) {
      throw new Error('Privacy guard: public map payload contains a local path fragment.');
    }
  }

  await fs.writeFile(outputPath, `${serialized}\n`, 'utf8');
  console.log(`Wrote ${records.length} sanitized lounge records to ${path.relative(projectRoot, outputPath)}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
