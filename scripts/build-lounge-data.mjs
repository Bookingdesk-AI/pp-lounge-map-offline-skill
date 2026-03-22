import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';
import XLSX from 'xlsx';

import { resolveSourceWorkbookConfig } from './lib/source-workbook.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const { sourcePath } = resolveSourceWorkbookConfig(projectRoot, process.env);
const outputGeoJsonPath = path.resolve(projectRoot, 'public', 'data', 'lounges.geojson');
const outputMetaPath = path.resolve(projectRoot, 'public', 'data', 'meta.json');
const geocodeCachePath = path.resolve(projectRoot, 'data', 'geocode-cache.json');
const ourAirportsUrl =
  process.env.OUR_AIRPORTS_CSV_URL ||
  'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv';
const shouldFallbackGeocode = process.env.GEOCODE_FALLBACK === '1';

const KNOWN_TYPES = new Set(['LOUNGE', 'EAT', 'REST', 'REFRESH', 'UNWIND']);
const AIRPORT_TYPE_RANK = {
  large_airport: 6,
  medium_airport: 5,
  small_airport: 4,
  seaplane_base: 3,
  heliport: 2,
  closed: 1,
};

const countryDisplay = new Intl.DisplayNames(['en'], { type: 'region' });

function clean(value) {
  return String(value ?? '')
    .replaceAll('_x000D_', '\n')
    .replace(/\u00a0/g, ' ')
    .trim();
}

function normalizeCode(value) {
  const code = clean(value).toUpperCase();
  return code || '';
}

function toTitleCase(value) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function normalizeType(value) {
  const raw = clean(value);
  const upper = raw.toUpperCase();
  if (KNOWN_TYPES.has(upper)) {
    return upper;
  }
  if (upper.includes('LOUNGE')) {
    return 'LOUNGE';
  }
  return 'LOUNGE';
}

function splitConditions(value) {
  const normalized = clean(value).replace(/\r\n/g, '\n');
  if (!normalized) {
    return [];
  }

  const segments = normalized
    .split('\n')
    .flatMap((line) => line.split(/\s-\s/g))
    .map((part) => clean(part))
    .filter(Boolean);

  return [...new Set(segments)];
}

function splitFacilities(value) {
  const normalized = clean(value).replace(/\r\n/g, '\n');
  if (!normalized) {
    return [];
  }

  const segments = normalized
    .split('\n')
    .map((part) => clean(part))
    .filter(Boolean);

  return [...new Set(segments)];
}

function slugify(value) {
  const normalized = clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || 'lounge';
}

function parseCountryFromUrl(urlValue) {
  const url = clean(urlValue);
  if (!url.startsWith('http')) {
    return '';
  }
  const match = url.match(/\/lounges\/([^/]+)\//i);
  if (!match) {
    return '';
  }
  return toTitleCase(match[1].replace(/-/g, ' '));
}

function shouldRepairShiftedRow(row) {
  const airportCode = normalizeCode(row.airport_code);
  const type = normalizeCode(row.type);
  return KNOWN_TYPES.has(airportCode) && !KNOWN_TYPES.has(type);
}

function repairShiftedRow(row, airportLookup) {
  const repairedCode = normalizeCode(row.Country);
  const airportMeta = airportLookup.get(repairedCode);

  return {
    Country: clean(airportMeta?.country || parseCountryFromUrl(row.opening_hours_raw) || ''),
    airport_code: repairedCode,
    type: clean(row.airport_code),
    name: clean(row.type),
    location_raw: clean(row.name),
    opening_hours_raw: clean(row.location_raw),
    url: clean(row.opening_hours_raw),
    conditions_raw: clean(row.url),
    facilities_raw: clean(row.conditions_raw),
    slug: clean(row.facilities_raw),
    airport_name: clean(row.slug),
    terminal: clean(row.airport_name),
    City: clean(airportMeta?.city || ''),
  };
}

function readWorkbookRows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found in workbook.`);
  }
  return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
}

async function loadAirportsCsv() {
  const response = await fetch(ourAirportsUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch airport CSV: ${response.status} ${response.statusText}`);
  }

  const csv = await response.text();
  const parsed = Papa.parse(csv, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    const first = parsed.errors[0];
    throw new Error(`CSV parse error: ${first.message}`);
  }

  return parsed.data;
}

function buildAirportCoordinateIndex(rows) {
  const byCode = new Map();

  for (const row of rows) {
    const code = normalizeCode(row.iata_code);
    if (!code) {
      continue;
    }

    const lat = Number(row.latitude_deg);
    const lon = Number(row.longitude_deg);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      continue;
    }

    const rank = AIRPORT_TYPE_RANK[row.type] ?? 0;
    const country = row.iso_country ? countryDisplay.of(row.iso_country) || '' : '';
    const next = {
      code,
      lat,
      lon,
      rank,
      airportName: clean(row.name),
      city: clean(row.municipality),
      country,
    };

    const current = byCode.get(code);
    if (!current || next.rank > current.rank) {
      byCode.set(code, next);
    }
  }

  return byCode;
}

async function readGeocodeCache() {
  try {
    const raw = await fs.readFile(geocodeCachePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeGeocodeCache(cache) {
  await fs.mkdir(path.dirname(geocodeCachePath), { recursive: true });
  await fs.writeFile(geocodeCachePath, `${JSON.stringify(cache, null, 2)}\n`, 'utf-8');
}

async function geocodeFallback(record, cache) {
  const cacheKey = record.airportCode;
  if (cache[cacheKey]) {
    return cache[cacheKey];
  }

  if (!shouldFallbackGeocode) {
    return null;
  }

  const query = [record.airportName, record.city, record.country].filter(Boolean).join(', ');
  if (!query) {
    return null;
  }

  const endpoint = new URL('https://nominatim.openstreetmap.org/search');
  endpoint.searchParams.set('format', 'jsonv2');
  endpoint.searchParams.set('limit', '1');
  endpoint.searchParams.set('q', query);

  const response = await fetch(endpoint, {
    headers: {
      'User-Agent': 'pp-lounge-map-data-builder/1.0',
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  if (!Array.isArray(data) || !data[0]) {
    return null;
  }

  const lat = Number(data[0].lat);
  const lon = Number(data[0].lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  const coordinate = { lat, lon };
  cache[cacheKey] = coordinate;

  await new Promise((resolve) => setTimeout(resolve, 1100));
  return coordinate;
}

function createFeature(row, index, coordinates) {
  const airportCode = normalizeCode(row.airport_code);
  const type = normalizeType(row.type);
  const name = clean(row.name);
  const slugBase = clean(row.slug) || slugify(name);
  const id = `${airportCode}-${slugify(slugBase)}-${index + 1}`;

  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [coordinates.lon, coordinates.lat],
    },
    properties: {
      id,
      airportCode,
      airportName: clean(row.airport_name),
      country: clean(row.Country),
      city: clean(row.City),
      type,
      terminal: clean(row.terminal) || 'Unknown',
      name,
      openingHours: clean(row.opening_hours_raw),
      conditions: splitConditions(row.conditions_raw),
      facilities: splitFacilities(row.facilities_raw),
      url: clean(row.url),
      location: clean(row.location_raw),
      slug: slugBase,
    },
  };
}

async function main() {
  try {
    await fs.access(sourcePath);
  } catch {
    throw new Error(
      `Source workbook not found at "${sourcePath}". Run "npm run release:prepare" or set SOURCE_XLSX to a readable workbook path.`,
    );
  }

  const workbook = XLSX.readFile(sourcePath);
  const loungeRows = readWorkbookRows(workbook, 'pp_lounges-2');
  const airportRows = readWorkbookRows(workbook, 'airports (1)');

  const airportLookup = new Map();
  for (const row of airportRows) {
    const code = normalizeCode(row.IATA);
    if (!code) {
      continue;
    }
    airportLookup.set(code, {
      country: clean(row.Country),
      city: clean(row.City),
    });
  }

  const airportCsvRows = await loadAirportsCsv();
  const coordinatesByCode = buildAirportCoordinateIndex(airportCsvRows);
  const geocodeCache = await readGeocodeCache();

  const features = [];
  const issues = [];

  for (let index = 0; index < loungeRows.length; index += 1) {
    const raw = loungeRows[index];
    const row = shouldRepairShiftedRow(raw) ? repairShiftedRow(raw, airportLookup) : raw;
    const airportCode = normalizeCode(row.airport_code);

    if (!/^[A-Z0-9]{3}$/.test(airportCode)) {
      issues.push({ row: index + 2, reason: 'invalid_airport_code', airportCode });
      continue;
    }

    const coordFromIata = coordinatesByCode.get(airportCode);
    const lookupMeta = airportLookup.get(airportCode);

    row.Country = clean(row.Country) || clean(lookupMeta?.country) || clean(coordFromIata?.country);
    row.City = clean(row.City) || clean(lookupMeta?.city) || clean(coordFromIata?.city);
    row.airport_name = clean(row.airport_name) || clean(coordFromIata?.airportName);

    let coordinates = coordFromIata;
    if (!coordinates) {
      coordinates = await geocodeFallback(
        {
          airportCode,
          airportName: row.airport_name,
          city: row.City,
          country: row.Country,
        },
        geocodeCache,
      );
    }

    if (!coordinates) {
      issues.push({ row: index + 2, reason: 'missing_coordinates', airportCode });
      continue;
    }

    features.push(createFeature(row, index, coordinates));
  }

  await writeGeocodeCache(geocodeCache);

  const countries = [...new Set(features.map((feature) => feature.properties.country).filter(Boolean))].sort();
  const cities = [...new Set(features.map((feature) => feature.properties.city).filter(Boolean))].sort();
  const types = [...new Set(features.map((feature) => feature.properties.type).filter(Boolean))].sort();

  const facilityCounts = new Map();
  for (const feature of features) {
    for (const facility of feature.properties.facilities) {
      facilityCounts.set(facility, (facilityCounts.get(facility) || 0) + 1);
    }
  }

  const topFacilities = [...facilityCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 24)
    .map(([name]) => name);

  const safeSourceFile = path.basename(sourcePath);
  if (safeSourceFile.includes('/') || safeSourceFile.includes('\\') || safeSourceFile.includes(':')) {
    throw new Error('Unsafe source filename detected while building metadata.');
  }

  const meta = {
    generatedAt: new Date().toISOString(),
    sourceFile: safeSourceFile,
    stats: {
      totalInputRows: loungeRows.length,
      totalFeatures: features.length,
      droppedRows: issues.length,
      uniqueAirports: new Set(features.map((feature) => feature.properties.airportCode)).size,
      uniqueCountries: countries.length,
      uniqueCities: cities.length,
    },
    filters: {
      types,
      countries,
      cities,
      facilities: topFacilities,
    },
    issues,
  };

  const geoJson = {
    type: 'FeatureCollection',
    features,
  };

  const geoJsonSerialized = JSON.stringify(geoJson);
  const metaSerialized = JSON.stringify(meta, null, 2);

  const forbiddenFragments = [
    projectRoot,
    path.resolve(projectRoot, '..'),
    process.env.HOME || '',
  ].filter(Boolean);

  for (const fragment of forbiddenFragments) {
    if (geoJsonSerialized.includes(fragment) || metaSerialized.includes(fragment)) {
      throw new Error(`Privacy guard: generated output contains local path fragment: ${fragment}`);
    }
  }

  await fs.mkdir(path.dirname(outputGeoJsonPath), { recursive: true });
  await fs.writeFile(outputGeoJsonPath, `${geoJsonSerialized}\n`, 'utf-8');
  await fs.writeFile(outputMetaPath, `${metaSerialized}\n`, 'utf-8');

  console.log(`Built ${features.length} lounge points from ${loungeRows.length} rows.`);
  if (issues.length > 0) {
    console.log(`Dropped ${issues.length} rows due to validation issues.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
