import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const geoJsonPath = path.resolve(projectRoot, 'public', 'data', 'lounges.geojson');
const metaPath = path.resolve(projectRoot, 'public', 'data', 'meta.json');
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
    ...record.facilities,
    ...record.conditions,
  ]
    .join(' ')
    .toLowerCase();
}

async function main() {
  const geoJson = JSON.parse(await fs.readFile(geoJsonPath, 'utf8'));
  const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));

  const lounges = geoJson.features
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
      };
    })
    .map((lounge) => ({
      ...lounge,
      searchText: normalizeSearchText(lounge),
    }))
    .sort((first, second) => first.id.localeCompare(second.id));

  const sourceFile = path.basename(clean(meta.sourceFile));
  const catalog = {
    generatedAt: clean(meta.generatedAt),
    sourceFile,
    stats: meta.stats,
    filters: meta.filters,
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
