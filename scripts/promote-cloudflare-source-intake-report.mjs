import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), '..');

const DEFAULT_INPUT = path.resolve(projectRoot, 'public', 'data', 'cloudflare-source-intake-report.json');
const DEFAULT_OUTPUT = path.resolve(projectRoot, 'public', 'data', 'source-intake-report.json');
const MIN_SOURCE_COUNT = 30;
const MIN_FETCHED_COUNT = 15;
const MIN_AIRPORT_CODES = 100;

export function parsePromotionArgs(args) {
  const options = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
  };

  for (const arg of args) {
    if (arg.startsWith('--input=')) {
      options.input = path.resolve(arg.slice('--input='.length));
      continue;
    }
    if (arg.startsWith('--output=')) {
      options.output = path.resolve(arg.slice('--output='.length));
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function walk(value, visit, trail = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visit, `${trail}[${index}]`));
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const childTrail = `${trail}.${key}`;
    visit(key, child, childTrail);
    walk(child, visit, childTrail);
  }
}

export function findRawContentFields(report) {
  const matches = [];
  walk(report, (key, _value, trail) => {
    if (key === 'html' || key === 'text') {
      matches.push(trail);
    }
  });
  return matches;
}

function issue(condition, message, issues) {
  if (!condition) {
    issues.push(message);
  }
}

export function validatePromotableCloudflareReport(report) {
  const issues = [];
  const rawContentFields = findRawContentFields(report);
  const sources = Array.isArray(report?.sources) ? report.sources : [];
  const stats = report?.stats ?? {};

  issue(report?.ok === true, 'report ok flag is not true', issues);
  issue(report?.policy?.execution?.requiredRuntime === 'cloudflare', 'required runtime is not cloudflare', issues);
  issue(report?.policy?.execution?.runtime === 'cloudflare', 'execution runtime is not cloudflare', issues);
  issue(report?.policy?.execution?.localScrawl === 'blocked', 'local scrawl is not blocked', issues);
  issue(report?.policy?.rawSnapshotsCommitted === false, 'raw snapshots policy is not false', issues);
  issue(report?.policy?.rawPageContentCommitted === false, 'raw page content policy is not false', issues);
  issue(rawContentFields.length === 0, `raw page content fields present: ${rawContentFields.slice(0, 5).join(', ')}`, issues);
  issue(report?.terminalImpact?.fullCatalogIntakeReport === true, 'full catalog intake report is not true', issues);
  issue(
    report?.terminalImpact?.coverageGateStillRequiresFullCloudflareReport === false,
    'coverage gate still requires full Cloudflare report',
    issues,
  );
  issue(sources.length >= MIN_SOURCE_COUNT, `source count below ${MIN_SOURCE_COUNT}`, issues);
  issue(Number(stats.totalSources ?? 0) === sources.length, 'stats totalSources does not match sources length', issues);
  issue(Number(stats.fetched ?? 0) >= MIN_FETCHED_COUNT, `fetched source count below ${MIN_FETCHED_COUNT}`, issues);
  issue(
    Number(stats.discoveredAirportCodes ?? 0) >= MIN_AIRPORT_CODES,
    `discovered airport codes below ${MIN_AIRPORT_CODES}`,
    issues,
  );
  issue(Number(stats.cloudflareSourceRuns ?? 0) >= sources.length, 'Cloudflare source runs below source count', issues);

  for (const [index, source] of sources.entries()) {
    const prefix = `sources[${index}]`;
    issue(Boolean(source.sourceId), `${prefix}: sourceId missing`, issues);
    issue(Boolean(source.publisher), `${prefix}: publisher missing`, issues);
    issue(/^https:\/\//.test(source.url ?? ''), `${prefix}: url must be https`, issues);
    issue(Boolean(source.adapter), `${prefix}: adapter missing`, issues);
    issue(Boolean(source.status), `${prefix}: status missing`, issues);
    issue(Array.isArray(source.airportCodes), `${prefix}: airportCodes missing`, issues);
    issue(Array.isArray(source.loungeLinks), `${prefix}: loungeLinks missing`, issues);
    if (source.status === 'fetched') {
      issue(/^https:\/\//.test(source.finalUrl ?? ''), `${prefix}: finalUrl must be https for fetched source`, issues);
      issue(Boolean(source.sha256), `${prefix}: sha256 missing for fetched source`, issues);
      issue(Number(source.bytes ?? 0) > 0, `${prefix}: bytes missing for fetched source`, issues);
    }
  }

  return issues;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

export async function promoteCloudflareSourceIntakeReport({ input = DEFAULT_INPUT, output = DEFAULT_OUTPUT } = {}) {
  const report = await readJson(input);
  const issues = validatePromotableCloudflareReport(report);
  if (issues.length > 0) {
    const error = new Error(`Cloudflare source intake report is not promotable:\n- ${issues.join('\n- ')}`);
    error.issues = issues;
    throw error;
  }

  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, serialized, 'utf8');
  return {
    input,
    output,
    sources: report.sources.length,
    fetched: Number(report.stats?.fetched ?? 0),
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  promoteCloudflareSourceIntakeReport(parsePromotionArgs(process.argv.slice(2)))
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
