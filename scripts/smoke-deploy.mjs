import { pathToFileURL } from 'node:url';

const DEFAULT_BASE_URL = 'https://loungeguru.desk.travel';

export function parseSmokeArgs(args, env = process.env) {
  const options = {
    baseUrl: env.LOUNGE_GURU_SMOKE_BASE_URL || DEFAULT_BASE_URL,
    minCatalogRecords: Number(env.LOUNGE_GURU_SMOKE_MIN_RECORDS || 1),
    adminReport: env.LOUNGE_GURU_SMOKE_ADMIN_REPORT || 'forbidden',
  };

  for (const arg of args) {
    if (arg.startsWith('--base-url=')) {
      options.baseUrl = arg.slice('--base-url='.length);
      continue;
    }
    if (arg.startsWith('--min-records=')) {
      options.minCatalogRecords = Number(arg.slice('--min-records='.length));
      continue;
    }
    if (arg.startsWith('--admin-report=')) {
      options.adminReport = arg.slice('--admin-report='.length);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  const url = new URL(options.baseUrl);
  if (url.protocol !== 'https:') {
    throw new Error('Deploy smoke base URL must use HTTPS');
  }

  if (!Number.isFinite(options.minCatalogRecords) || options.minCatalogRecords < 1) {
    throw new Error('Minimum catalog records must be a positive number');
  }

  if (!['forbidden', 'static-fallback'].includes(options.adminReport)) {
    throw new Error('Admin report expectation must be forbidden or static-fallback');
  }

  return {
    ...options,
    baseUrl: url.origin,
  };
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchJson(fetchImpl, url) {
  const response = await fetchImpl(url, {
    headers: {
      accept: 'application/json',
    },
  });
  return {
    response,
    body: await readJson(response),
  };
}

export async function runDeploySmoke({
  args = process.argv.slice(2),
  env = process.env,
  fetchImpl = fetch,
  log = console.log,
} = {}) {
  const options = parseSmokeArgs(args, env);
  const rootUrl = new URL('/', options.baseUrl);
  const catalogUrl = new URL('/data/lounge-guru-catalog.json', options.baseUrl);
  const adminReportUrl = new URL('/admin/source-intake/report', options.baseUrl);

  const rootResponse = await fetchImpl(rootUrl, {
    headers: {
      accept: 'text/html',
    },
  });
  if (!rootResponse.ok) {
    throw new Error(`Deploy smoke failed: root ${rootResponse.status}`);
  }

  const catalog = await fetchJson(fetchImpl, catalogUrl);
  if (!catalog.response.ok) {
    throw new Error(`Deploy smoke failed: catalog ${catalog.response.status}`);
  }

  const totalCatalogRecords = Number(catalog.body?.stats?.totalCatalogRecords ?? 0);
  if (totalCatalogRecords < options.minCatalogRecords) {
    throw new Error(`Deploy smoke failed: catalog records ${totalCatalogRecords}`);
  }

  const adminReport = await fetchJson(fetchImpl, adminReportUrl);
  if (options.adminReport === 'forbidden') {
    if (adminReport.response.status !== 403 || adminReport.body?.error !== 'forbidden') {
      throw new Error(`Deploy smoke failed: admin guard ${adminReport.response.status}`);
    }
  } else if (adminReport.response.status !== 200) {
    throw new Error(`Deploy smoke failed: static admin fallback ${adminReport.response.status}`);
  }

  const summary = {
    ok: true,
    baseUrl: options.baseUrl,
    rootStatus: rootResponse.status,
    catalogRecords: totalCatalogRecords,
    catalogGeneratedAt: catalog.body?.generatedAt ?? null,
    adminReportGuard: options.adminReport,
  };

  log(JSON.stringify(summary, null, 2));
  return summary;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  runDeploySmoke().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
