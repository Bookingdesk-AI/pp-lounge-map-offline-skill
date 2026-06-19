import { pathToFileURL } from 'node:url';

const DEFAULT_BASE_URL = 'https://loungeguru.desk.travel';
const DEFAULT_TIMEOUT_MS = 60000;

export function parseSourceIds(value) {
  return String(value ?? '')
    .split(',')
    .map((sourceId) => sourceId.trim())
    .filter(Boolean);
}

export function parseArgs(args, env = process.env) {
  const options = {
    baseUrl: env.LOUNGE_GURU_INTAKE_BASE_URL || DEFAULT_BASE_URL,
    sourceIds: parseSourceIds(env.LOUNGE_GURU_INTAKE_SOURCE_IDS),
    dryRun: env.LOUNGE_GURU_INTAKE_DRY_RUN === '1',
    timeoutMs: Number(env.LOUNGE_GURU_INTAKE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
  };

  for (const arg of args) {
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg.startsWith('--base-url=')) {
      options.baseUrl = arg.slice('--base-url='.length);
      continue;
    }
    if (arg.startsWith('--source-ids=')) {
      options.sourceIds = parseSourceIds(arg.slice('--source-ids='.length));
      continue;
    }
    if (arg.startsWith('--timeout-ms=')) {
      options.timeoutMs = Number(arg.slice('--timeout-ms='.length));
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error('LOUNGE_GURU_INTAKE_TIMEOUT_MS must be a positive number');
  }

  return options;
}

export function buildProbeBatchUrl({ baseUrl, sourceIds = [] }) {
  const url = new URL('/admin/source-intake/probe-batch', baseUrl);
  if (url.protocol !== 'https:') {
    throw new Error('Cloudflare intake base URL must use HTTPS');
  }
  if (sourceIds.length > 0) {
    url.searchParams.set('sourceIds', sourceIds.join(','));
  }
  return url;
}

function compactResult(result) {
  return {
    sourceId: result.sourceId,
    status: result.status,
    cloudflareRuntime: Boolean(result.cloudflareRuntime),
    cloudflareSnapshot: Boolean(result.cloudflareSnapshot),
    fetched: Number(result.stats?.fetched ?? 0),
  };
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function runCloudflareSourceIntake({
  args = process.argv.slice(2),
  env = process.env,
  fetchImpl = fetch,
  log = console.log,
} = {}) {
  const options = parseArgs(args, env);
  const url = buildProbeBatchUrl(options);
  const sourceIds = options.sourceIds;
  const endpoint = `${url.origin}${url.pathname}`;

  if (options.dryRun) {
    const summary = {
      dryRun: true,
      endpoint,
      sourceIds,
      localScrawl: 'blocked',
    };
    log(JSON.stringify(summary, null, 2));
    return summary;
  }

  const token = env.LOUNGE_GURU_INTAKE_TOKEN;
  if (!token) {
    throw new Error('LOUNGE_GURU_INTAKE_TOKEN is required for Cloudflare intake');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'x-lounge-guru-intake-token': token,
      },
    });
    const text = await response.text();
    const body = parseJson(text) ?? {};

    if (!response.ok) {
      const reason = body.error || response.statusText || 'request_failed';
      throw new Error(`Cloudflare intake failed: ${response.status} ${reason}`);
    }

    const summary = {
      ok: Boolean(body.ok),
      endpoint,
      sourceIds,
      totalTasks: Number(body.totalTasks ?? 0),
      fetched: Number(body.fetched ?? 0),
      results: (body.results ?? []).map(compactResult),
      next: 'npm run intake:evidence',
    };
    log(JSON.stringify(summary, null, 2));
    return summary;
  } finally {
    clearTimeout(timeout);
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  runCloudflareSourceIntake().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
