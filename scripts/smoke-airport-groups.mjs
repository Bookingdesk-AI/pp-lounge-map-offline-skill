import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const DEFAULT_BASE_URL = 'http://127.0.0.1:4173';
const DEFAULT_AIRPORTS = ['EWR', 'SEA'];
const DEFAULT_MOBILE_AIRPORT = 'SEA';

export function parseAirportGroupSmokeArgs(args, env = process.env) {
  const options = {
    baseUrl: env.LOUNGE_GURU_AIRPORT_GROUP_SMOKE_BASE_URL || DEFAULT_BASE_URL,
    airports: (env.LOUNGE_GURU_AIRPORT_GROUP_SMOKE_AIRPORTS || DEFAULT_AIRPORTS.join(','))
      .split(',')
      .map((airport) => airport.trim().toUpperCase())
      .filter(Boolean),
    mobileAirport: (env.LOUNGE_GURU_AIRPORT_GROUP_SMOKE_MOBILE_AIRPORT || DEFAULT_MOBILE_AIRPORT)
      .trim()
      .toUpperCase(),
    timeoutMs: Number(env.LOUNGE_GURU_AIRPORT_GROUP_SMOKE_TIMEOUT_MS || 20_000),
  };

  for (const arg of args) {
    if (arg.startsWith('--base-url=')) {
      options.baseUrl = arg.slice('--base-url='.length);
      continue;
    }
    if (arg.startsWith('--airports=')) {
      options.airports = arg
        .slice('--airports='.length)
        .split(',')
        .map((airport) => airport.trim().toUpperCase())
        .filter(Boolean);
      continue;
    }
    if (arg.startsWith('--mobile-airport=')) {
      options.mobileAirport = arg.slice('--mobile-airport='.length).trim().toUpperCase();
      continue;
    }
    if (arg.startsWith('--timeout-ms=')) {
      options.timeoutMs = Number(arg.slice('--timeout-ms='.length));
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  const url = new URL(options.baseUrl);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Airport group smoke base URL must use HTTP or HTTPS');
  }
  if (options.airports.length === 0 || options.airports.some((airport) => !/^[A-Z0-9]{3,4}$/.test(airport))) {
    throw new Error('Airport group smoke airports must be comma-separated IATA/ICAO-like codes');
  }
  if (!/^[A-Z0-9]{3,4}$/.test(options.mobileAirport)) {
    throw new Error('Airport group smoke mobile airport must be an IATA/ICAO-like code');
  }
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 5_000) {
    throw new Error('Airport group smoke timeout must be at least 5000ms');
  }

  return {
    ...options,
    baseUrl: url.origin,
  };
}

export function readCatalogAirportCounts(catalogPath = new URL('../public/data/lounge-guru-catalog.json', import.meta.url)) {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const counts = new Map();

  for (const record of catalog.records ?? []) {
    const iata = String(record.airport?.iata ?? '').trim().toUpperCase();
    if (!iata) {
      continue;
    }
    counts.set(iata, (counts.get(iata) ?? 0) + 1);
  }

  return counts;
}

function isMissingPlaywrightBrowser(error) {
  return error instanceof Error && /Executable doesn't exist|playwright install/i.test(error.message);
}

async function launchChromium() {
  try {
    const { chromium } = await import('playwright');
    return await chromium.launch({ headless: true });
  } catch (error) {
    if (isMissingPlaywrightBrowser(error)) {
      throw new Error('Playwright Chromium is missing. Run `npx playwright install chromium`.');
    }
    throw error;
  }
}

function airportUrl(baseUrl, airport, mode = 'results') {
  const url = new URL('/', baseUrl);
  url.searchParams.set('q', airport.toLowerCase());
  url.searchParams.set('sheet', 'mid');
  url.searchParams.set('mode', mode);
  return url.href;
}

async function inspectAirportGroup(page, { baseUrl, airport, expectedCount, mobile, timeoutMs }) {
  await page.goto(airportUrl(baseUrl, airport, mobile ? 'details' : 'results'), {
    waitUntil: 'domcontentloaded',
    timeout: timeoutMs,
  });
  await page.waitForSelector('.leaflet-marker-icon', { timeout: timeoutMs });
  await page.waitForTimeout(700);

  const result = await page.evaluate(() => {
    const clusterBadges = Array.from(document.querySelectorAll('.cluster-badge'));
    const bodyText = document.body.textContent?.replace(/\s+/g, ' ').trim() ?? '';

    return {
      markerIcons: document.querySelectorAll('.leaflet-marker-icon').length,
      clusterBadges: clusterBadges.length,
      markerDots: document.querySelectorAll('.marker-dot').length,
      burstSpokes: document.querySelectorAll('.airport-burst-spoke').length,
      spiderLegs: document.querySelectorAll('.leaflet-cluster-spider-leg').length,
      clusterLabels: clusterBadges.map((badge) => badge.textContent?.replace(/\s+/g, ' ').trim()),
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      hasDevProofCopy: /\bProof\b/.test(bodyText),
      bodyText,
    };
  });

  const expectedLabel = `${expectedCount} ${expectedCount === 1 ? 'lounge' : 'lounges'}`;
  const expectedDetailGroup = `${expectedCount} at ${airport}`;
  const failures = [];

  if (!result.clusterLabels.includes(expectedLabel)) {
    failures.push(`expected marker label ${expectedLabel}`);
  }
  if (result.clusterBadges !== 1) {
    failures.push(`expected one airport marker, got ${result.clusterBadges}`);
  }
  if (result.markerDots !== expectedCount) {
    failures.push(`expected ${expectedCount} burst lounge points, got ${result.markerDots}`);
  }
  if (result.burstSpokes !== expectedCount) {
    failures.push(`expected ${expectedCount} burst spokes, got ${result.burstSpokes}`);
  }
  if (expectedCount > 1 && !result.bodyText.includes(expectedDetailGroup)) {
    failures.push(`expected detail group ${expectedDetailGroup}`);
  }
  if (result.spiderLegs !== 0) {
    failures.push(`expected no spider legs, got ${result.spiderLegs}`);
  }
  if (result.horizontalOverflow) {
    failures.push('horizontal overflow');
  }
  if (result.hasDevProofCopy) {
    failures.push('dev proof copy visible');
  }

  delete result.bodyText;

  return {
    airport,
    mobile,
    expectedCount,
    expectedLabel,
    ...result,
    failures,
  };
}

export async function runAirportGroupSmoke({
  args = process.argv.slice(2),
  env = process.env,
  log = console.log,
} = {}) {
  const options = parseAirportGroupSmokeArgs(args, env);
  const catalogCounts = readCatalogAirportCounts();
  const browser = await launchChromium();
  const checks = [
    ...options.airports.map((airport) => ({ airport, mobile: false, width: 1365, height: 860 })),
    { airport: options.mobileAirport, mobile: true, width: 390, height: 844 },
  ];
  const results = [];

  try {
    for (const check of checks) {
      const expectedCount = catalogCounts.get(check.airport);
      if (!expectedCount) {
        throw new Error(`Airport group smoke has no catalog records for ${check.airport}`);
      }

      const page = await browser.newPage({
        viewport: { width: check.width, height: check.height },
        isMobile: check.mobile,
      });
      try {
        results.push(await inspectAirportGroup(page, {
          baseUrl: options.baseUrl,
          airport: check.airport,
          expectedCount,
          mobile: check.mobile,
          timeoutMs: options.timeoutMs,
        }));
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  const failed = results.filter((result) => result.failures.length > 0);
  const summary = {
    ok: failed.length === 0,
    baseUrl: options.baseUrl,
    results,
  };

  log(JSON.stringify(summary, null, 2));

  if (failed.length > 0) {
    throw new Error(`Airport group smoke failed: ${failed.map((result) => `${result.airport} ${result.failures.join(', ')}`).join('; ')}`);
  }

  return summary;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  runAirportGroupSmoke().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
