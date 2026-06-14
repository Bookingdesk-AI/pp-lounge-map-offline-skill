import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';

import { cloneSourceRegistry } from './lib/source-registry.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const cacheRoot = path.resolve(projectRoot, '.cache', 'source-snapshots');
const geoJsonPath = path.resolve(projectRoot, 'public', 'data', 'lounges.geojson');
const publicReportPath = path.resolve(projectRoot, 'public', 'data', 'source-intake-report.json');
const latestReportPath = path.resolve(cacheRoot, 'latest-report.json');
const timeoutMs = Number(process.env.SOURCE_FETCH_TIMEOUT_MS || 20000);
const delayMs = Number(process.env.SOURCE_FETCH_DELAY_MS || 1200);
const ourAirportsCsvUrl =
  process.env.OUR_AIRPORTS_CSV_URL ||
  'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv';

const LOUNGE_TERMS = [
  'lounge',
  'club',
  'sky club',
  'admirals',
  'maple leaf',
  'centurion',
  'sapphire',
  'plaza premium',
  'escape',
  'the club',
  'airport companion',
  'travel pass',
];

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function nowRunId() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function safeName(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function cleanText(value) {
  return String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function pageTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return cleanText(match?.[1] ?? '');
}

function extractJsonLdCount(html) {
  return [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>/gi)].length;
}

function extractLinks(html, baseUrl) {
  const links = new Set();
  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
    try {
      const url = new URL(match[1], baseUrl);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        links.add(url.toString());
      }
    } catch {
      // Ignore malformed links from vendor pages.
    }
  }
  return [...links];
}

function isLikelyLoungeLink(url) {
  const parsed = new URL(url);
  const lower = `${parsed.pathname}${parsed.search}`.toLowerCase();
  if (/\.(css|js|mjs|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|eot)(\?|$)/i.test(lower)) {
    return false;
  }
  return LOUNGE_TERMS.some((term) => lower.includes(term.replace(/\s+/g, '-')) || lower.includes(term));
}

function extractAirportCodes(text, knownAirportCodes) {
  const candidates = new Set();
  const codeRegex = /\b[A-Z]{3}\b/g;
  let match;

  while ((match = codeRegex.exec(text)) !== null) {
    const code = match[0];
    if (!knownAirportCodes.has(code)) {
      continue;
    }
    const start = Math.max(0, match.index - 180);
    const end = Math.min(text.length, match.index + 180);
    const context = text.slice(start, end).toLowerCase();
    if (LOUNGE_TERMS.some((term) => context.includes(term))) {
      candidates.add(code);
    }
  }

  return [...candidates].sort();
}

async function loadKnownAirportCodes() {
  const codes = new Set();

  try {
    const geoJson = JSON.parse(await fs.readFile(geoJsonPath, 'utf8'));
    for (const feature of geoJson.features ?? []) {
      const code = String(feature.properties?.airportCode ?? '').toUpperCase();
      if (/^[A-Z0-9]{3}$/.test(code)) {
        codes.add(code);
      }
    }
  } catch {
    // The source workbook build may not have run yet; fall through to OurAirports.
  }

  try {
    const response = await fetchText(ourAirportsCsvUrl);
    if (response.ok) {
      const parsed = Papa.parse(response.text, {
        header: true,
        skipEmptyLines: true,
      });
      for (const row of parsed.data) {
        const code = String(row.iata_code ?? '').toUpperCase();
        if (/^[A-Z0-9]{3}$/.test(code)) {
          codes.add(code);
        }
      }
    }
  } catch {
    // Existing catalog codes are enough for a conservative fallback report.
  }

  return codes;
}

function parseRobots(robotsText) {
  const rules = [];
  let applies = false;

  for (const rawLine of robotsText.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, '').trim();
    if (!line) {
      continue;
    }

    const [rawKey, ...rest] = line.split(':');
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(':').trim();

    if (key === 'user-agent') {
      applies = value === '*';
      continue;
    }

    if (applies && key === 'disallow' && value) {
      rules.push(value);
    }
  }

  return rules;
}

function isDisallowedByRobots(url, disallowRules) {
  const { pathname } = new URL(url);
  return disallowRules.some((rule) => rule === '/' || pathname.startsWith(rule));
}

function summarizeRobots(robots) {
  return {
    checked: Boolean(robots.checked),
    url: robots.url,
    status: robots.status,
    disallowRuleCount: robots.disallowRules?.length ?? 0,
    error: robots.error,
  };
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/json,text/plain;q=0.9,*/*;q=0.8',
        'User-Agent': 'lounge-guru-source-intake/1.0 (+https://loungeguru.desk.travel)',
      },
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      finalUrl: response.url,
      contentType: response.headers.get('content-type') ?? '',
      text,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchRobots(url) {
  try {
    const origin = new URL(url).origin;
    const response = await fetchText(`${origin}/robots.txt`);
    if (!response.ok) {
      return { checked: true, url: `${origin}/robots.txt`, disallowRules: [], status: response.status };
    }
    return {
      checked: true,
      url: `${origin}/robots.txt`,
      disallowRules: parseRobots(response.text),
      status: response.status,
    };
  } catch (error) {
    return {
      checked: false,
      url: null,
      disallowRules: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function scrapeSource(source, runDir, knownAirportCodes) {
  if (source.adapter === 'licensed_api' || source.status === 'blocked') {
    return {
      sourceId: source.id,
      publisher: source.publisher,
      url: source.url,
      adapter: source.adapter,
      status: 'skipped',
      reason: source.adapter === 'licensed_api' ? 'licensed_api_not_fetched' : 'source_marked_blocked',
      records: 0,
      airportCodes: [],
      loungeLinks: [],
    };
  }

  const robots = await fetchRobots(source.url);
  if (robots.checked && isDisallowedByRobots(source.url, robots.disallowRules)) {
    return {
      sourceId: source.id,
      publisher: source.publisher,
      url: source.url,
      adapter: source.adapter,
      status: 'skipped',
      reason: 'robots_disallow',
      robots: summarizeRobots(robots),
      records: 0,
      airportCodes: [],
      loungeLinks: [],
    };
  }

  try {
    const fetched = await fetchText(source.url);
    const extension = fetched.contentType.includes('json') ? 'json' : 'html';
    const snapshotPath = path.join(runDir, `${safeName(source.id)}.${extension}`);
    await fs.writeFile(snapshotPath, fetched.text, 'utf8');

    const text = cleanText(fetched.text);
    const links = extractLinks(fetched.text, fetched.finalUrl);
    const loungeLinks = links.filter(isLikelyLoungeLink).slice(0, 100);
    const airportCodes = extractAirportCodes(text, knownAirportCodes);
    const recordEstimate = Math.max(airportCodes.length, loungeLinks.length);

    return {
      sourceId: source.id,
      publisher: source.publisher,
      url: source.url,
      finalUrl: fetched.finalUrl,
      adapter: source.adapter,
      status: fetched.ok ? 'fetched' : 'http_error',
      httpStatus: fetched.status,
      contentType: fetched.contentType,
      bytes: Buffer.byteLength(fetched.text),
      sha256: sha256(fetched.text),
      title: pageTitle(fetched.text),
      jsonLdBlocks: extractJsonLdCount(fetched.text),
      records: recordEstimate,
      airportCodes,
      loungeLinks,
      snapshotFile: path.relative(projectRoot, snapshotPath),
      robots: summarizeRobots(robots),
    };
  } catch (error) {
    return {
      sourceId: source.id,
      publisher: source.publisher,
      url: source.url,
      adapter: source.adapter,
      status: 'fetch_error',
      reason: error instanceof Error ? error.message : String(error),
      records: 0,
      airportCodes: [],
      loungeLinks: [],
      robots: summarizeRobots(robots),
    };
  }
}

async function main() {
  const runId = nowRunId();
  const runDir = path.join(cacheRoot, runId);
  await fs.mkdir(runDir, { recursive: true });

  const sources = cloneSourceRegistry();
  const knownAirportCodes = await loadKnownAirportCodes();
  const results = [];

  for (const source of sources) {
    const result = await scrapeSource(source, runDir, knownAirportCodes);
    results.push(result);
    await sleep(delayMs);
  }

  const fetched = results.filter((result) => result.status === 'fetched');
  const report = {
    generatedAt: new Date().toISOString(),
    runId,
    policy: {
      fetchMode: 'single_public_source_url_per_registry_entry',
      rawSnapshots: '.cache/source-snapshots',
      rawSnapshotsCommitted: false,
      guardrail: 'official/public sources only; no login, private API, captcha, or broad crawling',
      timeoutMs,
      delayMs,
    },
    stats: {
      totalSources: results.length,
      fetched: fetched.length,
      skipped: results.filter((result) => result.status === 'skipped').length,
      httpErrors: results.filter((result) => result.status === 'http_error').length,
      fetchErrors: results.filter((result) => result.status === 'fetch_error').length,
      discoveredAirportCodes: new Set(results.flatMap((result) => result.airportCodes)).size,
      discoveredLoungeLinks: results.reduce((total, result) => total + result.loungeLinks.length, 0),
      knownAirportCodes: knownAirportCodes.size,
    },
    sources: results,
  };

  await fs.mkdir(path.dirname(publicReportPath), { recursive: true });
  await fs.writeFile(latestReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await fs.writeFile(publicReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(
    `Fetched ${report.stats.fetched}/${report.stats.totalSources} sources; ` +
      `${report.stats.discoveredAirportCodes} airport-code candidates; ` +
      `${report.stats.discoveredLoungeLinks} lounge-link candidates.`,
  );
  console.log(`Report: ${path.relative(projectRoot, publicReportPath)}`);
  console.log(`Raw snapshots: ${path.relative(projectRoot, runDir)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
