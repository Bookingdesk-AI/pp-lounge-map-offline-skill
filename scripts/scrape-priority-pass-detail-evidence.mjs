import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { chromium } from 'playwright';

const projectRoot = path.resolve(new URL('..', import.meta.url).pathname);
const geoJsonPath = path.resolve(projectRoot, 'public', 'data', 'lounges.geojson');
const catalogPath = path.resolve(projectRoot, 'public', 'data', 'lounge-guru-catalog.json');
const evidencePath = path.resolve(projectRoot, 'public', 'data', 'priority-pass-detail-evidence.json');

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function parseIntegerArg(args, name, fallback) {
  const prefix = `--${name}=`;
  const value = args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

function parseListArg(args, name) {
  const prefix = `--${name}=`;
  return new Set(
    (args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? '')
      .split(',')
      .map((value) => clean(value).toUpperCase())
      .filter(Boolean),
  );
}

export function isLikelyPriorityPassAccessOfferRecord(value) {
  return /\b(?:restaurant|bar|grill|cafe|coffee|dining|kitchen|terrace|tgi|fridays|gameway|jabbrrbox|spa|massage|relax|xpres|sleep|suite|pod|hotel|capsule|siesta|chiro|wellness|food|bistro|pub|brew|taproom|steakhouse|pizza|burger|eatery|shower|transpa|natureland)\b/i.test(
    clean(value),
  );
}

function existingEvidenceHasField(record, field) {
  if (!record) {
    return false;
  }
  if (field === 'conditions') {
    return Array.isArray(record.conditions) && record.conditions.some((value) => clean(value));
  }
  return Boolean(clean(record[field]));
}

function isPriorityPassUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === 'prioritypass.com' || hostname.endsWith('.prioritypass.com');
  } catch {
    return false;
  }
}

export function normalizeLocationBlock(value) {
  return clean(value).replace(/^Location\s*/i, '').trim();
}

export function parseHoursHeading(value) {
  return clean(value).replace(/^Hours:\s*/i, '').trim();
}

export function selectPriorityPassDetailTargets({
  features,
  catalog,
  existingRecords = [],
  limit = 50,
  airportCodes = new Set(),
  refresh = false,
}) {
  const canonicalById = new Map((catalog.records ?? []).map((record) => [record.lounge.id, record]));
  const existingById = new Map(existingRecords.map((record) => [record.recordId, record]));

  return (features ?? [])
    .map((feature) => feature.properties ?? {})
    .filter((properties) => {
      const canonical = canonicalById.get(properties.id);
      if (!canonical || !isPriorityPassUrl(properties.url)) {
        return false;
      }
      if (airportCodes.size > 0 && !airportCodes.has(clean(properties.airportCode).toUpperCase())) {
        return false;
      }
      const missingFields = [
        ...(!clean(canonical.location?.gate) ? ['location'] : []),
        ...(!clean(canonical.operations?.hours) ? ['openingHours'] : []),
        ...(!(canonical.accessOffers ?? []).some((offer) => Number.isFinite(Number(offer.amount)) && clean(offer.currency)) &&
        isLikelyPriorityPassAccessOfferRecord(canonical.lounge?.name)
          ? ['conditions']
          : []),
      ];
      if (missingFields.length === 0) {
        return false;
      }
      const existing = existingById.get(properties.id);
      return refresh || missingFields.some((field) => !existingEvidenceHasField(existing, field));
    })
    .map((properties) => {
      const canonical = canonicalById.get(properties.id);
      return {
        ...properties,
        missingFields: [
          ...(!clean(canonical?.location?.gate) ? ['location'] : []),
          ...(!clean(canonical?.operations?.hours) ? ['openingHours'] : []),
          ...(!(canonical?.accessOffers ?? []).some(
            (offer) => Number.isFinite(Number(offer.amount)) && clean(offer.currency),
          ) && isLikelyPriorityPassAccessOfferRecord(canonical?.lounge?.name)
            ? ['conditions']
            : []),
        ],
      };
    })
    .sort((first, second) => {
      const firstCanonical = canonicalById.get(first.id);
      const secondCanonical = canonicalById.get(second.id);
      const firstScore =
        Number(first.missingFields.includes('conditions')) * 4 +
        Number(!clean(firstCanonical?.operations?.hours)) * 2 +
        Number(!clean(firstCanonical?.location?.gate));
      const secondScore =
        Number(second.missingFields.includes('conditions')) * 4 +
        Number(!clean(secondCanonical?.operations?.hours)) * 2 +
        Number(!clean(secondCanonical?.location?.gate));
      return secondScore - firstScore || clean(first.airportCode).localeCompare(clean(second.airportCode)) || clean(first.id).localeCompare(clean(second.id));
    })
    .slice(0, limit);
}

function blockerKey(blocker) {
  return [clean(blocker?.recordId), clean(blocker?.url), clean(blocker?.reason)].join('\u0000');
}

export function mergePriorityPassDetailBlockers({
  existingBlockers = [],
  existingHistory = [],
  attemptedRecordIds = [],
  fetchedRecordIds = [],
  blockers = [],
  runAt,
  previousGeneratedAt,
}) {
  const activeByRecordId = new Map(existingBlockers.map((blocker) => [clean(blocker.recordId), { ...blocker }]));
  const fetchedIds = new Set(fetchedRecordIds.map(clean));
  const attemptedIds = new Set(attemptedRecordIds.map(clean));

  for (const recordId of attemptedIds) {
    if (fetchedIds.has(recordId)) {
      activeByRecordId.delete(recordId);
    }
  }

  const historyByKey = new Map();
  for (const blocker of existingHistory) {
    historyByKey.set(blockerKey(blocker), { ...blocker });
  }
  for (const blocker of existingBlockers) {
    const key = blockerKey(blocker);
    if (!historyByKey.has(key)) {
      historyByKey.set(key, {
        ...blocker,
        firstSeenAt: blocker.firstSeenAt ?? previousGeneratedAt ?? runAt,
        lastSeenAt: blocker.lastSeenAt ?? previousGeneratedAt ?? runAt,
        attempts: Math.max(1, Number(blocker.attempts ?? 1)),
      });
    }
  }

  for (const blocker of blockers) {
    const recordId = clean(blocker.recordId);
    const existingActive = activeByRecordId.get(recordId);
    activeByRecordId.set(recordId, {
      ...blocker,
      firstSeenAt: existingActive?.firstSeenAt ?? runAt,
      lastSeenAt: runAt,
      attempts: Math.max(0, Number(existingActive?.attempts ?? 0)) + 1,
    });

    const key = blockerKey(blocker);
    const existing = historyByKey.get(key);
    historyByKey.set(key, {
      ...blocker,
      firstSeenAt: existing?.firstSeenAt ?? runAt,
      lastSeenAt: runAt,
      attempts: Math.max(0, Number(existing?.attempts ?? 0)) + 1,
    });
  }

  for (const entry of historyByKey.values()) {
    if (fetchedIds.has(clean(entry.recordId)) && !entry.resolvedAt) {
      entry.resolvedAt = runAt;
    }
  }

  for (const [recordId, blocker] of activeByRecordId) {
    const history = historyByKey.get(blockerKey(blocker));
    if (history) {
      activeByRecordId.set(recordId, {
        ...blocker,
        firstSeenAt: history.firstSeenAt,
        lastSeenAt: history.lastSeenAt,
        attempts: history.attempts,
      });
    }
  }

  return {
    activeBlockers: [...activeByRecordId.values()].sort((first, second) => clean(first.recordId).localeCompare(clean(second.recordId))),
    blockerHistory: [...historyByKey.values()].sort((first, second) => {
      return clean(first.recordId).localeCompare(clean(second.recordId)) || clean(first.reason).localeCompare(clean(second.reason));
    }),
  };
}

async function extractRenderedDetail(page, target, { timeoutMs }) {
  const response = await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  const status = response?.status() ?? 0;
  if (status >= 400) {
    throw new Error(`http_${status}`);
  }

  await page.locator('main h1').first().waitFor({ state: 'attached', timeout: timeoutMs });
  const title = clean(await page.locator('main h1').first().textContent());
  if (!title) {
    throw new Error('missing_lounge_title');
  }

  const locationHeading = page.getByRole('heading', { name: 'Location', exact: true }).first();
  let location = '';
  if ((await locationHeading.count()) > 0) {
    const block = locationHeading.locator('xpath=ancestor::button[1]/parent::*');
    location = normalizeLocationBlock(await block.innerText());
  }

  const hoursHeadings = await page.locator('main h2').allTextContents();
  const openingHours = parseHoursHeading(hoursHeadings.find((value) => /^Hours:/i.test(clean(value))) ?? '');
  const paragraphTexts = (await page.locator('main p').allTextContents()).map(clean).filter(Boolean);
  const terminal = paragraphTexts.find((value) => /^(?:Terminal|Domestic Terminal|International Terminal|Concourse)\b/i.test(value)) ?? '';
  const conditionsHeading = page.getByRole('heading', { name: 'Conditions', exact: true }).first();
  let conditions = [];
  if ((await conditionsHeading.count()) > 0) {
    const block = conditionsHeading.locator('xpath=ancestor::button[1]/parent::*');
    conditions = [...new Set((await block.locator('li').allTextContents()).map(clean).filter(Boolean))];
  }
  const canonicalUrl = page.url();
  if (!isPriorityPassUrl(canonicalUrl)) {
    throw new Error('redirected_outside_priority_pass');
  }

  return {
    recordId: target.id,
    url: canonicalUrl,
    retrievedAt: new Date().toISOString(),
    ...(openingHours ? { openingHours } : {}),
    ...(terminal ? { terminal } : {}),
    ...(location ? { location } : {}),
    ...(conditions.length > 0 ? { conditions } : {}),
  };
}

async function runWorker({ browser, targets, results, blockers, options }) {
  const page = await browser.newPage({ locale: 'en-GB' });
  while (targets.length > 0) {
    const target = targets.shift();
    if (!target) {
      break;
    }
    try {
      const record = await extractRenderedDetail(page, target, options);
      const resolvedRequestedField = (target.missingFields ?? []).some((field) =>
        field === 'conditions' ? Array.isArray(record.conditions) && record.conditions.length > 0 : clean(record[field]),
      );
      if (!resolvedRequestedField) {
        throw new Error(`missing_target_fields_${(target.missingFields ?? []).join('_') || 'detail'}`);
      }
      results.push(record);
      console.log(`priority-pass-detail: fetched ${target.id}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      blockers.push({ recordId: target.id, url: target.url, reason });
      console.warn(`priority-pass-detail: blocked ${target.id} (${reason})`);
    }
    if (options.delayMs > 0) {
      await page.waitForTimeout(options.delayMs);
    }
  }
  await page.close();
}

async function main() {
  const args = process.argv.slice(2);
  const options = {
    limit: parseIntegerArg(args, 'limit', 50),
    concurrency: Math.max(1, parseIntegerArg(args, 'concurrency', 2)),
    delayMs: parseIntegerArg(args, 'delay-ms', 300),
    timeoutMs: parseIntegerArg(args, 'timeout-ms', 30000),
    airportCodes: parseListArg(args, 'airport-codes'),
    dryRun: args.includes('--dry-run'),
    refresh: args.includes('--refresh'),
    accessOffersOnly: args.includes('--access-offers-only'),
  };
  const [geoJson, catalog, existingEvidence] = await Promise.all([
    fs.readFile(geoJsonPath, 'utf8').then(JSON.parse),
    fs.readFile(catalogPath, 'utf8').then(JSON.parse),
    fs.readFile(evidencePath, 'utf8').then(JSON.parse),
  ]);
  let targets = selectPriorityPassDetailTargets({
    features: geoJson.features,
    catalog,
    existingRecords: existingEvidence.records,
    limit: options.limit,
    airportCodes: options.airportCodes,
    refresh: options.refresh,
  });
  if (options.accessOffersOnly) {
    targets = targets.filter((target) => target.missingFields.includes('conditions'));
  }

  if (options.dryRun) {
    console.log(
      JSON.stringify(
        {
          totalTargets: targets.length,
          targets: targets.map(({ id, airportCode, url, missingFields }) => ({ id, airportCode, url, missingFields })),
        },
        null,
        2,
      ),
    );
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const results = [];
  const blockers = [];
  const queue = [...targets];
  try {
    await Promise.all(
      Array.from({ length: Math.min(options.concurrency, Math.max(1, queue.length)) }, () =>
        runWorker({ browser, targets: queue, results, blockers, options }),
      ),
    );
  } finally {
    await browser.close();
  }

  const recordsById = new Map((existingEvidence.records ?? []).map((record) => [record.recordId, record]));
  for (const record of results) {
    const canonical = catalog.records.find((candidate) => candidate.lounge.id === record.recordId);
    recordsById.set(record.recordId, {
      ...recordsById.get(record.recordId),
      ...record,
      conditions: [...new Set([...(recordsById.get(record.recordId)?.conditions ?? []), ...(record.conditions ?? [])])],
      ...(!clean(canonical?.operations?.hours) && record.openingHours ? { openingHours: record.openingHours } : { openingHours: recordsById.get(record.recordId)?.openingHours }),
    });
  }
  const generatedAt = new Date().toISOString();
  const blockerState = mergePriorityPassDetailBlockers({
    existingBlockers: existingEvidence.blockers,
    existingHistory: existingEvidence.blockerHistory,
    attemptedRecordIds: targets.map((target) => target.id),
    fetchedRecordIds: results.map((record) => record.recordId),
    blockers,
    runAt: generatedAt,
    previousGeneratedAt: existingEvidence.generatedAt,
  });
  const output = {
    generatedAt,
    policy: {
      sourceMode: 'official public Priority Pass detail pages',
      guardrail: 'Use exact public detail-page text only; do not infer hours, gates, or prices from neighboring lounge listings.',
      runtime: 'playwright',
    },
    stats: {
      attempted: targets.length,
      fetched: results.length,
      blocked: blockers.length,
      activeBlockers: blockerState.activeBlockers.length,
      blockerHistory: blockerState.blockerHistory.length,
      totalEvidenceRecords: recordsById.size,
    },
    blockers: blockerState.activeBlockers,
    blockerHistory: blockerState.blockerHistory,
    records: [...recordsById.values()].sort((first, second) => clean(first.recordId).localeCompare(clean(second.recordId))),
  };
  await fs.writeFile(evidencePath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`priority-pass-detail: wrote ${results.length} fetched records, ${blockers.length} blockers, ${recordsById.size} total evidence records`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
