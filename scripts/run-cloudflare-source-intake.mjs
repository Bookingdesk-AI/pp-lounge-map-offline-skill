import fs from 'node:fs/promises';
import path from 'node:path';
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
    mode: env.LOUNGE_GURU_INTAKE_MODE || 'batch',
    output: env.LOUNGE_GURU_INTAKE_OUTPUT || '',
    sourceIds: parseSourceIds(env.LOUNGE_GURU_INTAKE_SOURCE_IDS),
    dryRun: env.LOUNGE_GURU_INTAKE_DRY_RUN === '1',
    timeoutMs: Number(env.LOUNGE_GURU_INTAKE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
  };

  for (const arg of args) {
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--report') {
      options.mode = 'report';
      continue;
    }
    if (arg.startsWith('--output=')) {
      options.output = arg.slice('--output='.length);
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
  if (!['batch', 'report'].includes(options.mode)) {
    throw new Error('LOUNGE_GURU_INTAKE_MODE must be batch or report');
  }
  if (options.output && options.mode !== 'report') {
    throw new Error('--output is only supported with --report');
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

export function buildReportUrl({ baseUrl }) {
  const url = new URL('/admin/source-intake/report', baseUrl);
  if (url.protocol !== 'https:') {
    throw new Error('Cloudflare intake base URL must use HTTPS');
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

function compactReport(body) {
  return {
    ok: Boolean(body.ok),
    totalSources: Number(body.stats?.totalSources ?? 0),
    fetched: Number(body.stats?.fetched ?? 0),
    cloudflareSourceRuns: Number(body.stats?.cloudflareSourceRuns ?? 0),
    fullCatalogIntakeReport: Boolean(body.terminalImpact?.fullCatalogIntakeReport),
    coverageGateStillRequiresFullCloudflareReport: Boolean(
      body.terminalImpact?.coverageGateStillRequiresFullCloudflareReport,
    ),
  };
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function redactRawPageContent(value) {
  if (Array.isArray(value)) {
    return value.map((item) => redactRawPageContent(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !['html', 'text'].includes(key))
      .map(([key, entry]) => [key, redactRawPageContent(entry)]),
  );
}

async function writeJsonOutput(outputPath, body) {
  const resolvedPath = path.resolve(outputPath);
  const redactedBody = redactRawPageContent(body);
  await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
  await fs.writeFile(resolvedPath, `${JSON.stringify(redactedBody, null, 2)}\n`, 'utf8');
  return resolvedPath;
}

export async function runCloudflareSourceIntake({
  args = process.argv.slice(2),
  env = process.env,
  fetchImpl = fetch,
  log = console.log,
} = {}) {
  const options = parseArgs(args, env);
  const url = options.mode === 'report' ? buildReportUrl(options) : buildProbeBatchUrl(options);
  const sourceIds = options.sourceIds;
  const endpoint = `${url.origin}${url.pathname}`;

  if (options.dryRun) {
    const summary = {
      dryRun: true,
      mode: options.mode,
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
      method: options.mode === 'report' ? 'GET' : 'POST',
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

    if (options.mode === 'report') {
      const outputPath = options.output ? await writeJsonOutput(options.output, body) : '';
      const summary = {
        endpoint,
        ...compactReport(body),
        ...(outputPath ? { outputPath } : {}),
      };
      log(JSON.stringify(summary, null, 2));
      return summary;
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
