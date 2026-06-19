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
const childPageLimit = Number(process.env.SOURCE_CHILD_PAGE_LIMIT || 25);
const childCrawlSourceIds = new Set(
  String(process.env.SOURCE_CHILD_CRAWL_SOURCES || 'escape-lounges')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);
const ourAirportsCsvUrl =
  process.env.OUR_AIRPORTS_CSV_URL ||
  'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv';
const oneworldAirportsUrl =
  'https://api.oneworld.com/wayfinding/v1/Airports?app_id=1&app_key=A3676D53BD00428BA198937061A835EE';
const oneworldLoungeUrl =
  'https://api.oneworld.com/lounge/v1/lounges/airport';
const oneworldLoungeQuery = 'app_id=2&app_key=A3676D53BD00428BA198937061A835DD';
const requiredIntakeRuntime = 'cloudflare';
const intakeRuntime = process.env.LOUNGE_GURU_SOURCE_INTAKE_RUNTIME || '';

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

const AMBIGUOUS_AIRPORT_CODES = new Set([
  'ACE',
  'ADD',
  'AGE',
  'AIR',
  'AND',
  'ANY',
  'APP',
  'ARE',
  'ASK',
  'BAR',
  'BUT',
  'CAD',
  'CAF',
  'CAN',
  'CAR',
  'CAT',
  'COM',
  'DAY',
  'DOG',
  'DON',
  'EYE',
  'FLY',
  'FOR',
  'GBP',
  'GET',
  'GOL',
  'HOT',
  'HOW',
  'HUB',
  'INS',
  'INT',
  'JOS',
  'KEY',
  'MAP',
  'MAR',
  'MAY',
  'MIN',
  'NET',
  'NEW',
  'NOT',
  'NOW',
  'OFF',
  'OLD',
  'ONE',
  'OPT',
  'OUR',
  'OUT',
  'PET',
  'PRE',
  'REG',
  'SAN',
  'SEE',
  'SIT',
  'SKY',
  'SPA',
  'THE',
  'TRY',
  'USA',
  'USE',
  'VIP',
  'WEB',
  'WWW',
  'YOU',
]);

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function nowRunId() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function requireCloudflareSourceIntakeRuntime() {
  if (intakeRuntime === requiredIntakeRuntime) {
    return;
  }

  throw new Error(
    'Source intake must run from the Cloudflare-approved runner. ' +
      'Set LOUNGE_GURU_SOURCE_INTAKE_RUNTIME=cloudflare only inside that runner; local scrawl is blocked.',
  );
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
  if (['twitter.com', 'www.linkedin.com', 'www.facebook.com'].includes(parsed.hostname)) {
    return false;
  }
  const lower = `${parsed.pathname}${parsed.search}`.toLowerCase();
  if (/\.(css|js|mjs|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|eot)(\?|$)/i.test(lower)) {
    return false;
  }
  return LOUNGE_TERMS.some((term) => lower.includes(term.replace(/\s+/g, '-')) || lower.includes(term));
}

function shouldCrawlChildLink(source, url) {
  if (childPageLimit <= 0) {
    return false;
  }
  if (!childCrawlSourceIds.has(source.id)) {
    return false;
  }

  const parsed = new URL(url);
  const seed = new URL(source.url);
  const host = parsed.hostname.replace(/^www\./, '');
  const seedHost = seed.hostname.replace(/^www\./, '');

  if (host === seedHost || host.endsWith(`.${seedHost}`)) {
    return true;
  }

  if (source.id === 'capital-one' && host === 'capitalonetravel.com') {
    return true;
  }

  return false;
}

function extractAirportCodes(text, knownAirportCodes) {
  const candidates = new Set();
  const codeRegex = /\b[A-Z]{3}\b/g;
  let match;

  while ((match = codeRegex.exec(text)) !== null) {
    const code = match[0];
    if (!knownAirportCodes.has(code) || AMBIGUOUS_AIRPORT_CODES.has(code)) {
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

async function fetchJson(url) {
  const response = await fetchText(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  return {
    finalUrl: response.finalUrl,
    json: JSON.parse(response.text),
    text: response.text,
  };
}

function compactOneworldLounge(lounge, airport) {
  return {
    sourceRecordId: String(lounge.Id ?? lounge.ExternalId ?? `${lounge.AirportCode}-${lounge.Name}-${lounge.Terminal}`),
    name: lounge.Name,
    airportCode: lounge.AirportCode,
    airportName: lounge.AirportName,
    airportCity: airport?.City ?? '',
    airportRegion: airport?.Region ?? '',
    airportCoordinates: {
      lat: Number(airport?.Latitude),
      lon: Number(airport?.Longitude),
    },
    terminal: lounge.Terminal,
    concourse: lounge.Concourse,
    near: lounge.Near,
    securitySide: lounge.LocationSecurity,
    operator: lounge.OwnedBy,
    accessClass: lounge.AccessClass,
    accessTier: lounge.AccessTier,
    accessConditions: lounge.AccessConditions,
    accessNotes: lounge.AccessNotes,
    openHours: lounge.OpenHours,
    airlines: (lounge.Airlines ?? []).map((airline) => ({
      code: airline.Code,
      name: airline.Name,
    })),
    amenities: Object.fromEntries(
      [
        'BusinessCenter',
        'TV',
        'FoodBeverageSnackBuffet',
        'Phone',
        'PreFlightDinner',
        'RelaxationRoom',
        'Shower',
        'SPA',
        'WheelchairAccess',
        'WiFi',
        'FoodBeverageHotBuffet',
        'AirConditioning',
        'Restroom',
        'RunwayViews',
        'FlighInformationScreen',
      ]
        .filter((key) => Object.hasOwn(lounge, key))
        .map((key) => [key, Boolean(lounge[key])]),
    ),
  };
}

async function fetchOneworldStructuredRecords(runDir) {
  const airportsResponse = await fetchJson(oneworldAirportsUrl);
  const airports = Array.isArray(airportsResponse.json) ? airportsResponse.json : [];
  const airportByCode = new Map(airports.map((airport) => [airport.Code, airport]));
  const records = [];
  const errors = [];
  let index = 0;

  async function worker() {
    for (;;) {
      const current = index;
      index += 1;
      if (current >= airports.length) {
        return;
      }
      const airport = airports[current];
      const code = airport.Code;
      try {
        const loungeResponse = await fetchJson(`${oneworldLoungeUrl}/${encodeURIComponent(code)}?${oneworldLoungeQuery}`);
        const lounges = Array.isArray(loungeResponse.json) ? loungeResponse.json : [];
        for (const lounge of lounges) {
          records.push(compactOneworldLounge(lounge, airportByCode.get(lounge.AirportCode) ?? airport));
        }
      } catch (error) {
        errors.push({
          airportCode: code,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  await Promise.all(Array.from({ length: 6 }, worker));

  const deduped = new Map();
  for (const record of records) {
    deduped.set(record.sourceRecordId, record);
  }

  const snapshot = {
    generatedAt: new Date().toISOString(),
    airports: airports.length,
    errors,
    records: [...deduped.values()].sort((first, second) =>
      `${first.airportCode}-${first.name}`.localeCompare(`${second.airportCode}-${second.name}`),
    ),
  };
  const snapshotPath = path.join(runDir, 'oneworld-structured-records.json');
  await fs.writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

  return {
    api: {
      airportsUrl: oneworldAirportsUrl,
      loungeUrlTemplate: `${oneworldLoungeUrl}/{airportCode}`,
      airportCount: airports.length,
      errorCount: errors.length,
      snapshotFile: path.relative(projectRoot, snapshotPath),
    },
    records: snapshot.records,
  };
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
    const childPages = [];
    const airportCodes = new Set(extractAirportCodes(text, knownAirportCodes));
    const childLinks = loungeLinks.filter((link) => shouldCrawlChildLink(source, link)).slice(0, childPageLimit);

    for (const [index, childLink] of childLinks.entries()) {
      const childRobots = await fetchRobots(childLink);
      if (childRobots.checked && isDisallowedByRobots(childLink, childRobots.disallowRules)) {
        childPages.push({
          url: childLink,
          status: 'skipped',
          reason: 'robots_disallow',
          airportCodes: [],
          loungeLinks: [],
          robots: summarizeRobots(childRobots),
        });
        await sleep(delayMs);
        continue;
      }

      try {
        const childFetched = await fetchText(childLink);
        const childExtension = childFetched.contentType.includes('json') ? 'json' : 'html';
        const childSnapshotPath = path.join(runDir, `${safeName(source.id)}-${String(index + 1).padStart(2, '0')}.${childExtension}`);
        await fs.writeFile(childSnapshotPath, childFetched.text, 'utf8');
        const childText = cleanText(childFetched.text);
        const childAirportCodes = extractAirportCodes(childText, knownAirportCodes);
        for (const code of childAirportCodes) {
          airportCodes.add(code);
        }
        childPages.push({
          url: childLink,
          finalUrl: childFetched.finalUrl,
          status: childFetched.ok ? 'fetched' : 'http_error',
          httpStatus: childFetched.status,
          contentType: childFetched.contentType,
          bytes: Buffer.byteLength(childFetched.text),
          sha256: sha256(childFetched.text),
          title: pageTitle(childFetched.text),
          airportCodes: childAirportCodes,
          loungeLinks: extractLinks(childFetched.text, childFetched.finalUrl).filter(isLikelyLoungeLink).slice(0, 25),
          snapshotFile: path.relative(projectRoot, childSnapshotPath),
          robots: summarizeRobots(childRobots),
        });
      } catch (error) {
        childPages.push({
          url: childLink,
          status: 'fetch_error',
          reason: error instanceof Error ? error.message : String(error),
          airportCodes: [],
          loungeLinks: [],
          robots: summarizeRobots(childRobots),
        });
      }

      await sleep(delayMs);
    }

    const childLoungeLinks = childPages.flatMap((page) => page.loungeLinks ?? []);
    const allLoungeLinks = [...new Set([...loungeLinks, ...childLoungeLinks])].slice(0, 200);
    let structuredApi = null;
    let structuredRecords = [];

    if (source.id === 'oneworld') {
      structuredApi = await fetchOneworldStructuredRecords(runDir);
      structuredRecords = structuredApi.records;
      for (const record of structuredRecords) {
        if (/^[A-Z0-9]{3}$/.test(record.airportCode)) {
          airportCodes.add(record.airportCode);
        }
      }
    }

    const recordEstimate = Math.max(airportCodes.size, allLoungeLinks.length, structuredRecords.length);

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
      airportCodes: [...airportCodes].sort(),
      loungeLinks: allLoungeLinks,
      structuredApi: structuredApi?.api,
      structuredRecords,
      childPages,
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
  requireCloudflareSourceIntakeRuntime();

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
      childFetchMode: 'bounded_lounge_link_crawl',
      childPageLimit,
      childCrawlSources: [...childCrawlSourceIds].sort(),
      rawSnapshots: '.cache/source-snapshots',
      rawSnapshotsCommitted: false,
      guardrail: 'official/public sources only; no login, private API, captcha, or broad crawling',
      execution: {
        requiredRuntime: requiredIntakeRuntime,
        runtime: intakeRuntime,
        localScrawl: 'blocked',
        proofEnv: 'LOUNGE_GURU_SOURCE_INTAKE_RUNTIME=cloudflare',
      },
      timeoutMs,
      delayMs,
    },
    stats: {
      totalSources: results.length,
      fetched: fetched.length,
      skipped: results.filter((result) => result.status === 'skipped').length,
      httpErrors: results.filter((result) => result.status === 'http_error').length,
      fetchErrors: results.filter((result) => result.status === 'fetch_error').length,
      childPagesFetched: results.reduce(
        (total, result) => total + (result.childPages ?? []).filter((page) => page.status === 'fetched').length,
        0,
      ),
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
