import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createAirportAuthorityReport } from './lib/airport-authority.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outputPath = path.resolve(projectRoot, 'public', 'data', 'airport-authority.json');
const defaultEndpoint = 'https://all-routes-web.pages.dev/api/airports-directory';

function parseArgs(argv) {
  const options = {
    endpoint: defaultEndpoint,
    pageSize: 200,
  };

  for (const arg of argv) {
    if (arg.startsWith('--endpoint=')) {
      options.endpoint = arg.slice('--endpoint='.length);
    } else if (arg.startsWith('--page-size=')) {
      options.pageSize = Number(arg.slice('--page-size='.length));
    }
  }

  if (!/^https:\/\/[a-z0-9.-]+\/.+/i.test(options.endpoint)) {
    throw new Error('Airport authority endpoint must be an HTTPS URL.');
  }
  if (!Number.isInteger(options.pageSize) || options.pageSize < 50 || options.pageSize > 200) {
    throw new Error('Airport authority page size must be between 50 and 200.');
  }

  return options;
}

async function fetchPage({ endpoint, page, pageSize }) {
  const url = new URL(endpoint);
  url.searchParams.set('page', String(page));
  url.searchParams.set('pageSize', String(pageSize));

  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'lounge-guru-airport-authority-sync/1.0',
    },
  });
  if (!response.ok) {
    throw new Error(`Airport authority fetch failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload.items)) {
    throw new Error('Airport authority payload missing items array.');
  }
  return payload;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const firstPage = await fetchPage({ ...options, page: 1 });
  const totalPages = Math.max(1, Number(firstPage.totalPages ?? Math.ceil(Number(firstPage.total ?? 0) / options.pageSize)));
  const items = [...firstPage.items];

  for (let page = 2; page <= totalPages; page += 1) {
    const payload = await fetchPage({ ...options, page });
    items.push(...payload.items);
  }

  const report = createAirportAuthorityReport({
    generatedAt: new Date().toISOString(),
    sourceUrl: options.endpoint,
    items,
  });

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    outputPath: path.relative(projectRoot, outputPath),
    airports: report.stats.airports,
    withIcao: report.stats.withIcao,
    withTimezone: report.stats.withTimezone,
    countries: report.stats.countries,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
