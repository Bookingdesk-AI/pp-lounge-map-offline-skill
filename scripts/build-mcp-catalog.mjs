import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createCanonicalCatalog } from './lib/lounge-canonical.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const geoJsonPath = path.resolve(projectRoot, 'public', 'data', 'lounges.geojson');
const metaPath = path.resolve(projectRoot, 'public', 'data', 'meta.json');
const canonicalPath = path.resolve(projectRoot, 'public', 'data', 'lounge-guru-catalog.json');
const outputPath = path.resolve(projectRoot, 'mcp', 'data', 'catalog.json');

function clean(value) {
  return String(value ?? '').trim();
}

function normalizeSearchText(record) {
  return [
    record.airportCode,
    record.airportName,
    record.country,
    record.city,
    record.type,
    record.terminal,
    record.name,
    record.location,
    record.provider,
    ...record.programs,
    ...record.accessMethods,
    ...record.facilities,
    ...record.conditions,
  ]
    .join(' ')
    .toLowerCase();
}

function loungeFromCanonicalRecord(record) {
  return {
    id: clean(record.lounge.id),
    airportCode: clean(record.airport.iata).toUpperCase(),
    airportName: clean(record.airport.name),
    country: clean(record.airport.country),
    city: clean(record.airport.city),
    type: clean(record.lounge.category).toUpperCase() || 'LOUNGE',
    terminal: clean(record.location.terminal) || 'Unknown',
    name: clean(record.lounge.name),
    openingHours: clean(record.operations.hours),
    conditions: Array.isArray(record.restrictions) ? record.restrictions.map(clean).filter(Boolean) : [],
    facilities: Array.isArray(record.amenities) ? record.amenities.map(clean).filter(Boolean) : [],
    url: clean(record.sources[0]?.url),
    location: clean(record.location.directions),
    slug: clean(record.lounge.id),
    lat: Number(record.airport.coordinates.lat),
    lon: Number(record.airport.coordinates.lon),
    provider: clean(record.lounge.brand),
    programs: record.lounge.programs ?? [],
    accessMethods: record.lounge.accessMethods ?? [],
    sources: record.sources ?? [],
    quality: record.quality,
    canonical: record,
  };
}

async function main() {
  const geoJson = JSON.parse(await fs.readFile(geoJsonPath, 'utf8'));
  const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
  let canonicalCatalog = null;

  try {
    canonicalCatalog = JSON.parse(await fs.readFile(canonicalPath, 'utf8'));
  } catch {
    canonicalCatalog = createCanonicalCatalog({ features: geoJson.features ?? [], meta });
  }

  const canonicalById = new Map((canonicalCatalog.records ?? []).map((record) => [record.lounge.id, record]));

  const featureLounges = geoJson.features
    .map((feature) => {
      const [lon, lat] = feature.geometry.coordinates;
      const properties = feature.properties;

      return {
        id: clean(properties.id),
        airportCode: clean(properties.airportCode).toUpperCase(),
        airportName: clean(properties.airportName),
        country: clean(properties.country),
        city: clean(properties.city),
        type: clean(properties.type).toUpperCase(),
        terminal: clean(properties.terminal) || 'Unknown',
        name: clean(properties.name),
        openingHours: clean(properties.openingHours),
        conditions: Array.isArray(properties.conditions) ? properties.conditions.map(clean).filter(Boolean) : [],
        facilities: Array.isArray(properties.facilities) ? properties.facilities.map(clean).filter(Boolean) : [],
        url: clean(properties.url),
        location: clean(properties.location),
        slug: clean(properties.slug),
        lat: Number(lat),
        lon: Number(lon),
        provider: clean(properties.provider) || clean(canonicalById.get(clean(properties.id))?.lounge.brand),
        programs: canonicalById.get(clean(properties.id))?.lounge.programs ?? ['Priority Pass'],
        accessMethods: canonicalById.get(clean(properties.id))?.lounge.accessMethods ?? ['membership'],
        sources: canonicalById.get(clean(properties.id))?.sources ?? [],
        quality: canonicalById.get(clean(properties.id))?.quality ?? {
          completeness: 0,
          freshness: 0,
          conflicts: ['missing_canonical_record'],
          reviewStatus: 'review',
        },
        canonical: canonicalById.get(clean(properties.id)) ?? null,
      };
    })
    .map((lounge) => ({
      ...lounge,
      searchText: normalizeSearchText(lounge),
    }));
  const existingIds = new Set(featureLounges.map((lounge) => lounge.id));
  const candidateLounges = (canonicalCatalog.records ?? [])
    .filter((record) => !existingIds.has(record.lounge.id))
    .map(loungeFromCanonicalRecord)
    .filter((lounge) => Number.isFinite(lounge.lat) && Number.isFinite(lounge.lon))
    .map((lounge) => ({
      ...lounge,
      searchText: normalizeSearchText(lounge),
    }));
  const lounges = [...featureLounges, ...candidateLounges].sort((first, second) => first.id.localeCompare(second.id));

  const sourceFile = path.basename(clean(meta.sourceFile));
  const catalog = {
    generatedAt: clean(canonicalCatalog.generatedAt) || clean(meta.generatedAt),
    sourceFile,
    schema: canonicalCatalog.schema,
    stats: canonicalCatalog.stats ?? meta.stats,
    filters: canonicalCatalog.filters ?? meta.filters,
    quality: canonicalCatalog.quality,
    sources: canonicalCatalog.sources,
    lounges,
  };

  const serialized = JSON.stringify(catalog);
  const forbiddenFragments = [projectRoot, path.resolve(projectRoot, '..'), process.env.HOME || ''].filter(Boolean);
  for (const fragment of forbiddenFragments) {
    if (fragment && serialized.includes(fragment)) {
      throw new Error(`Privacy guard: catalog output contains local path fragment ${fragment}`);
    }
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${lounges.length} lounges to ${path.relative(projectRoot, outputPath)}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
