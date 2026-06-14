import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createCanonicalCatalog } from './lib/lounge-canonical.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const geoJsonPath = path.resolve(projectRoot, 'public', 'data', 'lounges.geojson');
const metaPath = path.resolve(projectRoot, 'public', 'data', 'meta.json');
const outputCatalogPath = path.resolve(projectRoot, 'public', 'data', 'lounge-guru-catalog.json');
const outputSourcesPath = path.resolve(projectRoot, 'public', 'data', 'source-registry.json');
const outputQualityPath = path.resolve(projectRoot, 'public', 'data', 'quality-report.json');

async function main() {
  const geoJson = JSON.parse(await fs.readFile(geoJsonPath, 'utf8'));
  const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
  const catalog = createCanonicalCatalog({ features: geoJson.features ?? [], meta });

  const serialized = JSON.stringify(catalog);
  const forbiddenFragments = [projectRoot, path.resolve(projectRoot, '..'), process.env.HOME || ''].filter(Boolean);
  for (const fragment of forbiddenFragments) {
    if (fragment && serialized.includes(fragment)) {
      throw new Error(`Privacy guard: canonical output contains local path fragment ${fragment}`);
    }
  }

  await fs.mkdir(path.dirname(outputCatalogPath), { recursive: true });
  await fs.writeFile(outputCatalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  await fs.writeFile(outputSourcesPath, `${JSON.stringify(catalog.sources, null, 2)}\n`, 'utf8');
  await fs.writeFile(
    outputQualityPath,
    `${JSON.stringify(
      {
        generatedAt: catalog.generatedAt,
        schema: catalog.schema,
        stats: catalog.stats,
        quality: catalog.quality,
        sources: catalog.sources,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  console.log(`Wrote ${catalog.records.length} canonical Lounge Guru records.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
