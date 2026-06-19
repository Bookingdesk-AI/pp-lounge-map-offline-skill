import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), '..');
const dataDir = path.resolve(projectRoot, 'public', 'data');
const issues = [];

function readJson(relativePath) {
  const fullPath = path.resolve(projectRoot, relativePath);
  try {
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (error) {
    issues.push(`${relativePath}: invalid JSON (${error instanceof Error ? error.message : String(error)})`);
    return null;
  }
}

function issue(condition, message) {
  if (!condition) {
    issues.push(message);
  }
}

function noAbsoluteLocalPath(value, relativePath, trail = relativePath) {
  if (typeof value === 'string') {
    issue(!value.includes(projectRoot), `${trail}: exposes project root`);
    issue(!value.includes(path.dirname(projectRoot)), `${trail}: exposes workspace path`);
    issue(!value.includes(process.env.HOME ?? '\0'), `${trail}: exposes home path`);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => noAbsoluteLocalPath(item, relativePath, `${trail}[${index}]`));
    return;
  }

  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      noAbsoluteLocalPath(child, relativePath, `${trail}.${key}`);
    }
  }
}

function assertIsoDate(value, message) {
  issue(typeof value === 'string' && !Number.isNaN(Date.parse(value)), message);
}

function validateCatalog(catalog) {
  issue(catalog?.schema?.version === '2026-06-14', 'lounge-guru-catalog.json: unexpected schema version');
  issue(Array.isArray(catalog?.schema?.fields), 'lounge-guru-catalog.json: schema fields missing');
  const schemaGroups = new Set((catalog?.schema?.fields ?? []).map((field) => field.group));
  for (const group of ['lounge', 'airport', 'location', 'operations', 'record']) {
    issue(schemaGroups.has(group), `lounge-guru-catalog.json: schema group ${group} missing`);
  }
  issue(Array.isArray(catalog?.records) && catalog.records.length > 0, 'lounge-guru-catalog.json: records missing');
  issue(
    catalog?.stats?.totalCatalogRecords === catalog?.records?.length,
    'lounge-guru-catalog.json: stats.totalCatalogRecords mismatch',
  );
  issue(Array.isArray(catalog?.sources) && catalog.sources.length >= 30, 'lounge-guru-catalog.json: sources incomplete');

  for (const [index, record] of (catalog?.records ?? []).entries()) {
    const prefix = `lounge-guru-catalog.json.records[${index}]`;
    issue(Boolean(record?.lounge?.id), `${prefix}: lounge.id missing`);
    issue(Boolean(record?.lounge?.name), `${prefix}: lounge.name missing`);
    issue(/^[A-Z0-9]{3}$/.test(record?.airport?.iata ?? ''), `${prefix}: airport.iata invalid`);
    issue(Array.isArray(record?.sources) && record.sources.length > 0, `${prefix}: sources missing`);
    issue(record?.quality && typeof record.quality === 'object', `${prefix}: quality missing`);

    for (const [sourceIndex, source] of (record?.sources ?? []).entries()) {
      const sourcePrefix = `${prefix}.sources[${sourceIndex}]`;
      issue(Boolean(source.sourceId), `${sourcePrefix}: sourceId missing`);
      issue(Boolean(source.publisher), `${sourcePrefix}: publisher missing`);
      issue(/^https:\/\//.test(source.url ?? ''), `${sourcePrefix}: url must be https`);
      assertIsoDate(source.retrievedAt, `${sourcePrefix}: retrievedAt invalid`);
      issue(typeof source.confidence === 'number', `${sourcePrefix}: confidence missing`);
      issue(Boolean(source.rightsNote), `${sourcePrefix}: rightsNote missing`);
    }
  }
}

function validateGeoJson(geoJson) {
  issue(geoJson?.type === 'FeatureCollection', 'lounges.geojson: type must be FeatureCollection');
  issue(Array.isArray(geoJson?.features) && geoJson.features.length > 0, 'lounges.geojson: features missing');

  for (const [index, feature] of (geoJson?.features ?? []).entries()) {
    const prefix = `lounges.geojson.features[${index}]`;
    issue(feature?.type === 'Feature', `${prefix}: type must be Feature`);
    issue(feature?.geometry?.type === 'Point', `${prefix}: geometry must be Point`);
    issue(Array.isArray(feature?.geometry?.coordinates), `${prefix}: coordinates missing`);
    issue(
      feature.geometry.coordinates.every((value) => typeof value === 'number' && Number.isFinite(value)),
      `${prefix}: coordinates invalid`,
    );
    issue(Boolean(feature?.properties?.name), `${prefix}: name missing`);
    issue(/^[A-Z0-9]{3}$/.test(feature?.properties?.airportCode ?? ''), `${prefix}: airportCode invalid`);
  }
}

function validateCoverage(goal, gap) {
  issue(goal?.id === 'lounge-guru-worldwide-coverage', 'worldwide-coverage-goal.json: goal id mismatch');
  issue(goal?.cloudflareDatabase?.product === 'd1', 'worldwide-coverage-goal.json: database product mismatch');
  issue(goal?.cloudflareDatabase?.databaseName === 'lounge-guru-catalog', 'worldwide-coverage-goal.json: D1 name mismatch');
  issue(gap?.goalId === goal?.id, 'coverage-gap-report.json: goal id mismatch');
  issue(gap?.terminalPassed === false, 'coverage-gap-report.json: terminalPassed should remain false until proven complete');
  issue(
    Array.isArray(gap?.deltas?.missingSourceFamilies) && gap.deltas.missingSourceFamilies.length > 0,
    'coverage-gap-report.json: missing source families not reported',
  );
  issue(
    typeof gap?.deltas?.approvedRecordsRemaining === 'number',
    'coverage-gap-report.json: approvedRecordsRemaining missing',
  );
}

function validateSourceIntake(report) {
  issue(report?.policy?.execution?.requiredRuntime === 'cloudflare', 'source-intake-report.json: required runtime mismatch');
  issue(report?.policy?.execution?.localScrawl === 'blocked', 'source-intake-report.json: local scrawl not blocked');
  issue(report?.policy?.rawSnapshotsCommitted === false, 'source-intake-report.json: raw snapshots should not be committed');
  issue(Array.isArray(report?.sources) && report.sources.length >= 30, 'source-intake-report.json: sources incomplete');

  for (const [index, source] of (report?.sources ?? []).entries()) {
    const prefix = `source-intake-report.json.sources[${index}]`;
    issue(Boolean(source.sourceId), `${prefix}: sourceId missing`);
    issue(/^https:\/\//.test(source.url ?? ''), `${prefix}: url must be https`);
    issue(Array.isArray(source.airportCodes), `${prefix}: airportCodes missing`);
    issue(Array.isArray(source.loungeLinks), `${prefix}: loungeLinks missing`);
    issue(!Object.hasOwn(source, 'html') && !Object.hasOwn(source, 'text'), `${prefix}: raw page content leaked`);
    if (source.snapshotFile) {
      issue(source.snapshotFile.startsWith('.cache/source-snapshots/'), `${prefix}: snapshot path should be repo-relative cache`);
    }
  }
}

function validateArrays() {
  const brandRegistry = readJson('public/data/brand-registry.json');
  const sourceRegistry = readJson('public/data/source-registry.json');
  const candidates = readJson('public/data/non-priority-lounge-candidates.json');
  issue(Array.isArray(brandRegistry) && brandRegistry.length > 0, 'brand-registry.json: expected non-empty array');
  issue(Array.isArray(sourceRegistry) && sourceRegistry.length >= 30, 'source-registry.json: expected registered source list');
  issue(Array.isArray(candidates) && candidates.length > 0, 'non-priority-lounge-candidates.json: expected candidates');
}

for (const fileName of fs.readdirSync(dataDir)) {
  const relativePath = `public/data/${fileName}`;
  const fullPath = path.resolve(dataDir, fileName);
  if (fileName.endsWith('.json') || fileName.endsWith('.geojson')) {
    const parsed = readJson(relativePath);
    noAbsoluteLocalPath(parsed, relativePath);
  } else if (fileName === 'brand-logos' && fs.statSync(fullPath).isDirectory()) {
    const logoFiles = fs.readdirSync(fullPath);
    issue(logoFiles.length > 0, `${relativePath}: expected logo files`);
    for (const logoFile of logoFiles) {
      issue(logoFile.endsWith('.svg'), `${relativePath}/${logoFile}: expected SVG logo`);
    }
  } else {
    issue(fs.statSync(fullPath).isFile(), `${relativePath}: unexpected public data entry`);
  }
}

const catalog = readJson('public/data/lounge-guru-catalog.json');
const geoJson = readJson('public/data/lounges.geojson');
const goal = readJson('public/data/worldwide-coverage-goal.json');
const gap = readJson('public/data/coverage-gap-report.json');
const sourceIntake = readJson('public/data/source-intake-report.json');

validateCatalog(catalog);
validateGeoJson(geoJson);
validateCoverage(goal, gap);
validateSourceIntake(sourceIntake);
validateArrays();

if (issues.length > 0) {
  console.error(`public-json-check: failed with ${issues.length} issue(s)`);
  for (const message of issues.slice(0, 80)) {
    console.error(`- ${message}`);
  }
  if (issues.length > 80) {
    console.error(`- ${issues.length - 80} more issue(s) omitted`);
  }
  process.exit(1);
}

console.log(`public-json-check: validated ${fs.readdirSync(dataDir).length} public data files.`);
