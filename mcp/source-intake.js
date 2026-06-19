import intakePlan from '../public/data/cloudflare-source-intake-plan.json' with { type: 'json' };

const USER_AGENT = 'lounge-guru-source-intake/1.0 (+https://loungeguru.desk.travel)';
const DEFAULT_TIMEOUT_MS = 12000;
const MAX_FETCH_URLS = 3;

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
      finalUrl: response.url,
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

function selectTask(sourceId) {
  const readyTasks = intakePlan.tasks.filter((task) => task.status === 'ready' && task.adapter === 'official_page');
  if (sourceId) {
    return readyTasks.find((task) => task.sourceId === sourceId) ?? null;
  }
  return readyTasks[0] ?? null;
}

function sourceFetchUrls(task) {
  return [...new Set([...(task.fetchUrls ?? []), task.url].filter(Boolean))].slice(0, MAX_FETCH_URLS);
}

async function runProbe({ request, env, fetchImpl = fetch }) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, { status: 405, headers: { allow: 'POST' } });
  }

  const authResponse = requireAuthorized(request, env);
  if (authResponse) {
    return authResponse;
  }

  if (!env.LOUNGE_GURU_DB) {
    return jsonResponse({ error: 'd1_not_configured' }, { status: 503 });
  }

  const url = new URL(request.url);
  const sourceId = url.searchParams.get('sourceId');
  const task = selectTask(sourceId);
  if (!task) {
    return jsonResponse({ error: 'source_not_ready', sourceId }, { status: 404 });
  }

  const generatedAt = new Date().toISOString();
  const runId = `cloudflare-probe-${generatedAt.replace(/[:.]/g, '-')}-${task.sourceId}`;
  const timeoutMs = Number(env.SOURCE_FETCH_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const attempts = [];
  let fetched = null;

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
        fetched = attempt;
        break;
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
    records: 0,
    airportCodes: [],
    loungeLinks: [],
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

  return jsonResponse({
    ok: true,
    runId,
    generatedAt,
    sourceId: task.sourceId,
    status: sourceResult.status,
    cloudflareRuntime: true,
    cloudflareSnapshot: sourceResult.cloudflareSnapshot,
    stats,
  });
}

export async function createSourceIntakeProbeResponse(request, env, options = {}) {
  return runProbe({ request, env, fetchImpl: options.fetchImpl ?? fetch });
}
