import intakePlan from '../public/data/cloudflare-source-intake-plan.json' with { type: 'json' };

const USER_AGENT = 'lounge-guru-source-intake/1.0 (+https://loungeguru.desk.travel)';
const DEFAULT_TIMEOUT_MS = 12000;
const MAX_FETCH_URLS = 8;
const MAX_BATCH_TASKS = 20;
const MAX_DERIVED_ITEMS = 40;
const CLOUDFLARE_FETCH_ADAPTERS = new Set(['official_page', 'official_html', 'open_data']);
const LOUNGE_LINK_PATH_INCLUDE = [
  /(^|\/)airport-lounges?(\/|$)/,
  /(^|\/)global-lounges?(\/|$)/,
  /(^|\/)lounges?(\/|$)/,
  /(^|\/)locations?(\/|$)/,
  /(^|\/)our-lounges?(\/|$)/,
  /(^|\/)partner-lounges?(\/|$)/,
  /(^|\/)services\/lounges?(\/|$)/,
  /(^|\/)airportAmenities\/[a-z0-9-]+-club\.jsp$/i,
  /(^|\/)club-?[a-z0-9-]*(\/|$)/,
  /(^|\/)clubrooms?(\/|$)/,
  /(^|\/)terminal-[a-z0-9-]+-lounge(\/|$)/,
];
const LOUNGE_LINK_PATH_EXCLUDE = [
  /(^|\/)blog(\/|$)/,
  /(^|\/)careers?(\/|$)/,
  /(^|\/)events?(\/|$)/,
  /(^|\/)media(\/|$)/,
  /(^|\/)meet-and-greet(\/|$)/,
  /(^|\/)news(\/|$)/,
  /(^|\/)newsroom(\/|$)/,
  /(^|\/)press-room(\/|$)/,
  /(^|\/)representative(\/|$)/,
  /(^|\/)airport-representative(\/|$)/,
  /(^|\/)how-to-[a-z0-9-]*(\/|$)/,
];
const COMMON_AIRPORT_CODE_FALSE_POSITIVES = new Set([
  'ADA',
  'ADD',
  'ALL',
  'AND',
  'ANY',
  'APP',
  'API',
  'ARE',
  'ASP',
  'CAN',
  'CSS',
  'CSV',
  'DOM',
  'FAQ',
  'FOR',
  'GET',
  'HAD',
  'HAS',
  'HTML',
  'HTTP',
  'IMG',
  'IOS',
  'JSON',
  'MAP',
  'NEW',
  'NOT',
  'OUR',
  'PDF',
  'SDK',
  'THE',
  'URL',
  'USA',
  'WEB',
  'WWW',
  'YOU',
]);

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(init.headers ?? {}),
    },
  });
}

function timingSafeEqual(left, right) {
  if (!left || !right || left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

function requireAuthorized(request, env) {
  const configuredToken = env.LOUNGE_GURU_INTAKE_TOKEN;
  if (!configuredToken) {
    return jsonResponse({ error: 'intake_not_configured' }, { status: 503 });
  }

  const requestToken = request.headers.get('x-lounge-guru-intake-token') ?? '';
  if (!timingSafeEqual(requestToken, configuredToken)) {
    return jsonResponse({ error: 'forbidden' }, { status: 403 });
  }

  return null;
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

function isDisallowedByRobots(targetUrl, rules) {
  const { pathname } = new URL(targetUrl);
  return rules.some((rule) => rule === '/' || pathname.startsWith(rule));
}

async function sha256(value) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function fetchText(url, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        accept: 'text/html,application/xhtml+xml,application/json,text/plain;q=0.9,*/*;q=0.8',
        'user-agent': USER_AGENT,
      },
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      finalUrl: response.url || String(url),
      contentType: response.headers.get('content-type') ?? '',
      text,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchRobots(targetUrl, fetchImpl, timeoutMs) {
  const robotsUrl = `${new URL(targetUrl).origin}/robots.txt`;
  try {
    const response = await fetchText(robotsUrl, fetchImpl, timeoutMs);
    if (!response.ok) {
      return {
        checked: true,
        url: robotsUrl,
        status: response.status,
        disallowRuleCount: 0,
        disallowed: false,
      };
    }

    const rules = parseRobots(response.text);
    return {
      checked: true,
      url: robotsUrl,
      status: response.status,
      disallowRuleCount: rules.length,
      disallowed: isDisallowedByRobots(targetUrl, rules),
    };
  } catch (error) {
    return {
      checked: false,
      url: robotsUrl,
      disallowRuleCount: 0,
      disallowed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function readyCloudflareFetchTasks() {
  const candidates = intakePlan.memberGaps?.length > 0 ? intakePlan.memberGaps : intakePlan.tasks;
  const readyTasks = [];
  const seen = new Set();

  for (const task of candidates) {
    if (task.status !== 'ready' || !CLOUDFLARE_FETCH_ADAPTERS.has(task.adapter) || seen.has(task.sourceId)) {
      continue;
    }
    seen.add(task.sourceId);
    readyTasks.push(task);
  }

  return readyTasks;
}

function selectTask(sourceId) {
  const readyTasks = readyCloudflareFetchTasks();
  if (sourceId) {
    return readyTasks.find((task) => task.sourceId === sourceId) ?? null;
  }
  return readyTasks[0] ?? null;
}

function readyOfficialPageTasks() {
  return readyCloudflareFetchTasks();
}

function sourceFetchUrls(task) {
  return [...new Set([...(task.fetchUrls ?? []), task.url].filter(Boolean))].slice(0, MAX_FETCH_URLS);
}

function boundedPushUnique(items, value) {
  if (items.length >= MAX_DERIVED_ITEMS || items.includes(value)) {
    return;
  }
  items.push(value);
}

function validAirportCode(value) {
  return /^[A-Z]{3}$/.test(value) && !COMMON_AIRPORT_CODE_FALSE_POSITIVES.has(value);
}

function extractAirportCodes(text) {
  const airportCodes = [];
  const patterns = [
    /\b(?:iata|airportCode|airport_code|airport-code|stationCode|station_code|locationCode|location_code|airport)\b[^A-Z0-9]{0,24}["']?([A-Z]{3})\b/g,
    /\b[A-Z][A-Za-z .'-]{2,80}\s+Airport\s*\(([A-Z]{3})\)/g,
    /\(([A-Z]{3})\)\s*(?:Airport|Lounge|Terminal)\b/g,
    /\/(?:airport|airports|lounges?|locations?)\/([A-Z]{3})(?:[/?#]|$)/g,
    /\/airport\/([a-z]{3})-map\.html(?:[/?#]|$)/gi,
    /\/airportAmenities\/([a-z]{3})-club\.jsp(?:[/?#]|$)/gi,
    /\b(?:Airport|Lounge|Terminal)\b[^()]{0,80}\(([A-Z]{3})\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const code = String(match[1] ?? '').toUpperCase();
      if (validAirportCode(code)) {
        boundedPushUnique(airportCodes, code);
      }
    }
  }

  return airportCodes.sort();
}

function decodeHtmlAttribute(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function extractLoungeLinks(html, baseUrl) {
  const links = [];
  const linkPattern = /\bhref\s*=\s*["']([^"']+)["']/gi;
  const baseOrigin = new URL(baseUrl).origin;

  for (const match of html.matchAll(linkPattern)) {
    const rawHref = decodeHtmlAttribute(String(match[1] ?? '').trim());
    if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) {
      continue;
    }

    let url;
    try {
      url = new URL(rawHref, baseUrl);
    } catch {
      continue;
    }

    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== baseOrigin) {
      continue;
    }

    const path = url.pathname.toLowerCase();
    if (
      LOUNGE_LINK_PATH_EXCLUDE.some((pattern) => pattern.test(path)) ||
      !LOUNGE_LINK_PATH_INCLUDE.some((pattern) => pattern.test(path))
    ) {
      continue;
    }

    url.hash = '';
    boundedPushUnique(links, url.toString());
  }

  return links.sort();
}

function deriveSourceEvidence(response) {
  return {
    airportCodes: extractAirportCodes(response.text),
    loungeLinks: extractLoungeLinks(response.text, response.finalUrl),
  };
}

function mergeDerivedEvidence(target, source) {
  for (const code of source.airportCodes) {
    boundedPushUnique(target.airportCodes, code);
  }
  for (const link of source.loungeLinks) {
    boundedPushUnique(target.loungeLinks, link);
  }
  target.airportCodes.sort();
  target.loungeLinks.sort();
}

async function runTaskProbe({ task, env, fetchImpl, timeoutMs, generatedAt = new Date().toISOString() }) {
  const runId = `cloudflare-probe-${generatedAt.replace(/[:.]/g, '-')}-${task.sourceId}`;
  const attempts = [];
  let fetched = null;
  let derivedEvidence = { airportCodes: [], loungeLinks: [] };

  for (const fetchUrl of sourceFetchUrls(task)) {
    const robots = await fetchRobots(fetchUrl, fetchImpl, timeoutMs);
    if (robots.checked && robots.disallowed) {
      attempts.push({
        url: fetchUrl,
        status: 'skipped',
        reason: 'robots_disallow',
        robots,
      });
      continue;
    }

    try {
      const response = await fetchText(fetchUrl, fetchImpl, timeoutMs);
      const attempt = {
        url: fetchUrl,
        status: response.ok ? 'fetched' : 'http_error',
        httpStatus: response.status,
        finalUrl: response.finalUrl,
        contentType: response.contentType,
        bytes: new TextEncoder().encode(response.text).byteLength,
        sha256: await sha256(response.text),
        robots,
      };
      attempts.push(attempt);
      if (response.ok) {
        fetched ??= attempt;
        mergeDerivedEvidence(derivedEvidence, deriveSourceEvidence(response));
      }
    } catch (error) {
      attempts.push({
        url: fetchUrl,
        status: 'fetch_error',
        reason: error instanceof Error ? error.message : String(error),
        robots,
      });
    }
  }

  const sourceResult = {
    sourceId: task.sourceId,
    publisher: task.publisher,
    url: task.url,
    adapter: task.adapter,
    status: fetched ? 'fetched' : attempts.at(-1)?.status ?? 'fetch_error',
    records: Math.max(derivedEvidence.airportCodes.length, derivedEvidence.loungeLinks.length),
    airportCodes: derivedEvidence.airportCodes,
    loungeLinks: derivedEvidence.loungeLinks,
    cloudflareSnapshot: Boolean(fetched),
    fetchAttempts: attempts,
    ...(fetched
      ? {
          finalUrl: fetched.finalUrl,
          httpStatus: fetched.httpStatus,
          contentType: fetched.contentType,
          bytes: fetched.bytes,
          sha256: fetched.sha256,
        }
      : {
          reason: attempts.at(-1)?.reason ?? 'fetch failed',
        }),
  };

  const policy = {
    fetchMode: 'cloudflare_single_source_probe',
    rawSnapshotsCommitted: false,
    guardrail: 'official/public sources only; no login, private API, captcha, or broad crawling',
    execution: {
      requiredRuntime: 'cloudflare',
      runtime: 'cloudflare',
      localScrawl: 'blocked',
      proofEnv: 'LOUNGE_GURU_INTAKE_TOKEN',
    },
    timeoutMs,
  };
  const stats = {
    totalSources: 1,
    fetched: fetched ? 1 : 0,
    skipped: attempts.filter((attempt) => attempt.status === 'skipped').length,
    httpErrors: attempts.filter((attempt) => attempt.status === 'http_error').length,
    fetchErrors: attempts.filter((attempt) => attempt.status === 'fetch_error').length,
  };

  await env.LOUNGE_GURU_DB.prepare(
    'INSERT INTO source_runs (id, generated_at, policy_json, stats_json, sources_json) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(runId, generatedAt, JSON.stringify(policy), JSON.stringify(stats), JSON.stringify([sourceResult]))
    .run();

  return {
    runId,
    generatedAt,
    sourceId: task.sourceId,
    status: sourceResult.status,
    cloudflareRuntime: true,
    cloudflareSnapshot: sourceResult.cloudflareSnapshot,
    stats,
  };
}

function parseJsonField(value, fallback) {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function compactStatusSource(source, row) {
  return {
    sourceId: source.sourceId,
    publisher: source.publisher,
    status: source.status,
    runId: row.id,
    generatedAt: row.generated_at,
    cloudflareSnapshot: Boolean(source.cloudflareSnapshot),
    httpStatus: source.httpStatus ?? null,
    bytes: Number(source.bytes ?? 0),
    sha256: source.sha256 ?? null,
  };
}

function compactReportAttempt(attempt) {
  return {
    url: attempt.url,
    status: attempt.status,
    reason: attempt.reason ?? null,
    httpStatus: attempt.httpStatus ?? null,
    finalUrl: attempt.finalUrl ?? null,
    contentType: attempt.contentType ?? '',
    bytes: Number(attempt.bytes ?? 0),
    sha256: attempt.sha256 ?? null,
    robots: attempt.robots
      ? {
          checked: Boolean(attempt.robots.checked),
          url: attempt.robots.url,
          status: attempt.robots.status ?? null,
          disallowed: Boolean(attempt.robots.disallowed),
          disallowRuleCount: Number(attempt.robots.disallowRuleCount ?? 0),
        }
      : null,
  };
}

function compactReportSource(source) {
  return {
    sourceId: source.sourceId,
    publisher: source.publisher,
    url: source.url,
    adapter: source.adapter,
    status: source.status,
    reason: source.reason ?? null,
    records: Number(source.records ?? 0),
    airportCodes: Array.isArray(source.airportCodes) ? source.airportCodes : [],
    loungeLinks: Array.isArray(source.loungeLinks) ? source.loungeLinks : [],
    cloudflareSnapshot: Boolean(source.cloudflareSnapshot),
    finalUrl: source.finalUrl ?? null,
    httpStatus: source.httpStatus ?? null,
    contentType: source.contentType ?? '',
    bytes: Number(source.bytes ?? 0),
    sha256: source.sha256 ?? null,
    fetchAttempts: (source.fetchAttempts ?? []).map(compactReportAttempt),
  };
}

async function requireReadyRequest({ request, env, method }) {
  if (request.method !== method) {
    return jsonResponse({ error: 'method_not_allowed' }, { status: 405, headers: { allow: method } });
  }

  const authResponse = requireAuthorized(request, env);
  if (authResponse) {
    return authResponse;
  }

  if (!env.LOUNGE_GURU_DB) {
    return jsonResponse({ error: 'd1_not_configured' }, { status: 503 });
  }

  return null;
}

async function readCloudflareProbeRows(env, limit = 100) {
  const rowsResult = await env.LOUNGE_GURU_DB.prepare(
    [
      'SELECT id, generated_at, policy_json, stats_json, sources_json',
      'FROM source_runs',
      "WHERE id LIKE 'cloudflare-probe-%'",
      'ORDER BY generated_at DESC',
      `LIMIT ${limit}`,
    ].join(' '),
  ).all();

  return rowsResult.results ?? [];
}

function latestCloudflareSourceRows(rows, compactSource) {
  const latestBySource = new Map();

  for (const row of rows) {
    const policy = parseJsonField(row.policy_json, {});
    if (policy?.execution?.runtime !== 'cloudflare') {
      continue;
    }
    const sources = parseJsonField(row.sources_json, []);
    for (const source of sources) {
      if (!latestBySource.has(source.sourceId)) {
        latestBySource.set(source.sourceId, compactSource(source, row));
      }
    }
  }

  return latestBySource;
}

async function runProbe({ request, env, fetchImpl = fetch }) {
  const readyResponse = await requireReadyRequest({ request, env, method: 'POST' });
  if (readyResponse) {
    return readyResponse;
  }

  const url = new URL(request.url);
  const sourceId = url.searchParams.get('sourceId');
  const task = selectTask(sourceId);
  if (!task) {
    return jsonResponse({ error: 'source_not_ready', sourceId }, { status: 404 });
  }

  const result = await runTaskProbe({
    task,
    env,
    fetchImpl,
    timeoutMs: Number(env.SOURCE_FETCH_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
  });

  return jsonResponse({
    ok: true,
    ...result,
  });
}

async function runBatch({ request, env, fetchImpl = fetch }) {
  const readyResponse = await requireReadyRequest({ request, env, method: 'POST' });
  if (readyResponse) {
    return readyResponse;
  }

  const url = new URL(request.url);
  const requestedSourceIds = new Set(
    (url.searchParams.get('sourceIds') ?? '')
      .split(',')
      .map((sourceId) => sourceId.trim())
      .filter(Boolean),
  );
  const tasks = readyOfficialPageTasks()
    .filter((task) => requestedSourceIds.size === 0 || requestedSourceIds.has(task.sourceId))
    .slice(0, MAX_BATCH_TASKS);

  if (tasks.length === 0) {
    return jsonResponse({ error: 'no_ready_sources' }, { status: 404 });
  }

  const timeoutMs = Number(env.SOURCE_FETCH_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const results = [];
  for (const task of tasks) {
    results.push(await runTaskProbe({ task, env, fetchImpl, timeoutMs }));
  }

  return jsonResponse({
    ok: true,
    mode: 'batch',
    totalTasks: tasks.length,
    fetched: results.filter((result) => result.stats.fetched === 1).length,
    results,
  });
}

async function sourceStatus({ request, env }) {
  const readyResponse = await requireReadyRequest({ request, env, method: 'GET' });
  if (readyResponse) {
    return readyResponse;
  }

  const rows = await readCloudflareProbeRows(env, 50);
  const latestBySource = latestCloudflareSourceRows(rows, compactStatusSource);

  const readyTasks = readyOfficialPageTasks();
  const readyTaskEvidence = readyTasks.map((task) => {
    const source = latestBySource.get(task.sourceId);
    return {
      sourceId: task.sourceId,
      present: Boolean(source),
      status: source?.status ?? 'missing',
      cloudflareSnapshot: Boolean(source?.cloudflareSnapshot),
    };
  });
  const sources = [...latestBySource.values()].sort((left, right) => left.sourceId.localeCompare(right.sourceId));

  return jsonResponse({
    ok: true,
    generatedAt: new Date().toISOString(),
    policy: {
      source: 'cloudflare-d1-source_runs',
      localScrawl: 'blocked',
      rawPageContentCommitted: false,
    },
    stats: {
      sourceRunsRead: rows.length,
      uniqueSources: sources.length,
      readyTasks: readyTasks.length,
      readyTasksWithCloudflareEvidence: readyTaskEvidence.filter((task) => task.cloudflareSnapshot).length,
    },
    readyTaskEvidence,
    sources,
  });
}

async function sourceReport({ request, env }) {
  const readyResponse = await requireReadyRequest({ request, env, method: 'GET' });
  if (readyResponse) {
    return readyResponse;
  }

  const generatedAt = new Date().toISOString();
  const rows = await readCloudflareProbeRows(env, 100);
  const latestBySource = latestCloudflareSourceRows(rows, (source, row) => ({
    ...compactReportSource(source),
    runId: row.id,
    retrievedAt: row.generated_at,
  }));
  const sources = [...latestBySource.values()].sort((left, right) => left.sourceId.localeCompare(right.sourceId));
  const readyTasks = readyOfficialPageTasks();

  return jsonResponse({
    ok: true,
    generatedAt,
    runId: `cloudflare-report-${generatedAt.replace(/[:.]/g, '-')}`,
    policy: {
      fetchMode: 'cloudflare_d1_source_runs_report',
      rawSnapshotsCommitted: false,
      rawPageContentCommitted: false,
      guardrail: 'official/public source-run evidence only; no local page fetch',
      execution: {
        requiredRuntime: 'cloudflare',
        runtime: 'cloudflare',
        localScrawl: 'blocked',
        proofEnv: 'LOUNGE_GURU_INTAKE_TOKEN',
      },
    },
    stats: {
      totalSources: sources.length,
      fetched: sources.filter((source) => source.status === 'fetched').length,
      skipped: sources.filter((source) => source.status === 'skipped').length,
      httpErrors: sources.filter((source) => source.status === 'http_error').length,
      fetchErrors: sources.filter((source) => source.status === 'fetch_error').length,
      childPagesFetched: 0,
      discoveredAirportCodes: sources.reduce((total, source) => total + source.airportCodes.length, 0),
      discoveredLoungeLinks: sources.reduce((total, source) => total + source.loungeLinks.length, 0),
      cloudflareSourceRuns: rows.length,
      readyTasks: readyTasks.length,
      readyTasksWithCloudflareEvidence: sources.filter((source) => source.cloudflareSnapshot).length,
    },
    terminalImpact: {
      fullCatalogIntakeReport: false,
      coverageGateStillRequiresFullCloudflareReport: true,
    },
    sources,
  });
}

export async function createSourceIntakeProbeResponse(request, env, options = {}) {
  return runProbe({ request, env, fetchImpl: options.fetchImpl ?? fetch });
}

export async function createSourceIntakeBatchResponse(request, env, options = {}) {
  return runBatch({ request, env, fetchImpl: options.fetchImpl ?? fetch });
}

export async function createSourceIntakeStatusResponse(request, env) {
  return sourceStatus({ request, env });
}

export async function createSourceIntakeReportResponse(request, env) {
  return sourceReport({ request, env });
}
