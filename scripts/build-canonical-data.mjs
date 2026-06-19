import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createBrandLogoSvg } from './lib/brand-registry.mjs';
import { createCloudflareSourceIntakePlan } from './lib/cloudflare-source-intake-plan.mjs';
import { createCoverageGapReport } from './lib/coverage-gap-report.mjs';
import { createCanonicalCatalog } from './lib/lounge-canonical.mjs';
import {
  createNonPriorityCandidateRecords,
  createNonPriorityValidationReport,
} from './lib/source-candidates.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const geoJsonPath = path.resolve(projectRoot, 'public', 'data', 'lounges.geojson');
const metaPath = path.resolve(projectRoot, 'public', 'data', 'meta.json');
const outputCatalogPath = path.resolve(projectRoot, 'public', 'data', 'lounge-guru-catalog.json');
const outputSourcesPath = path.resolve(projectRoot, 'public', 'data', 'source-registry.json');
const outputBrandsPath = path.resolve(projectRoot, 'public', 'data', 'brand-registry.json');
const outputBrandImportPath = path.resolve(projectRoot, 'public', 'data', 'desk-travel-brand-import.json');
const outputQualityPath = path.resolve(projectRoot, 'public', 'data', 'quality-report.json');
const outputCoverageGapPath = path.resolve(projectRoot, 'public', 'data', 'coverage-gap-report.json');
const outputIntakePlanPath = path.resolve(projectRoot, 'public', 'data', 'cloudflare-source-intake-plan.json');
const sourceIntakeReportPath = path.resolve(projectRoot, 'public', 'data', 'source-intake-report.json');
const outputCandidatePath = path.resolve(projectRoot, 'public', 'data', 'non-priority-lounge-candidates.json');
const outputValidationPath = path.resolve(projectRoot, 'public', 'data', 'non-priority-validation-report.json');
const outputBrandLogoDir = path.resolve(projectRoot, 'public', 'data', 'brand-logos');
const worldwideCoverageGoalPath = path.resolve(projectRoot, 'public', 'data', 'worldwide-coverage-goal.json');
const migrationPath = path.resolve(projectRoot, 'migrations', '0001_lounge_guru_catalog.sql');

async function readSourceIntakeReport() {
  try {
    return JSON.parse(await fs.readFile(sourceIntakeReportPath, 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  const geoJson = JSON.parse(await fs.readFile(geoJsonPath, 'utf8'));
  const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
  const intakeReport = await readSourceIntakeReport();
  const candidateRecords = createNonPriorityCandidateRecords({
    report: intakeReport,
    features: geoJson.features ?? [],
    generatedAt: meta.generatedAt,
  });
  const catalog = createCanonicalCatalog({
    features: geoJson.features ?? [],
    meta,
    additionalRecords: candidateRecords,
  });
  const validationReport = createNonPriorityValidationReport({
    records: catalog.records,
    report: intakeReport,
    generatedAt: catalog.generatedAt,
  });
  const [worldwideCoverageGoal, migrationSql] = await Promise.all([
    fs.readFile(worldwideCoverageGoalPath, 'utf8').then(JSON.parse),
    fs.readFile(migrationPath, 'utf8'),
  ]);
  const coverageGapReport = createCoverageGapReport({
    goal: worldwideCoverageGoal,
    catalog,
    sourceRegistry: catalog.sources,
    migrationSql,
  });
  const intakePlan = createCloudflareSourceIntakePlan({
    coverageGap: coverageGapReport,
    sourceRegistry: catalog.sources,
    sourceIntakeReport: intakeReport,
  });

  const serialized = JSON.stringify(catalog);
  const forbiddenFragments = [projectRoot, path.resolve(projectRoot, '..'), process.env.HOME || ''].filter(Boolean);
  for (const fragment of forbiddenFragments) {
    if (fragment && serialized.includes(fragment)) {
      throw new Error(`Privacy guard: canonical output contains local path fragment ${fragment}`);
    }
  }

  await fs.mkdir(path.dirname(outputCatalogPath), { recursive: true });
  await fs.mkdir(outputBrandLogoDir, { recursive: true });
  await fs.writeFile(outputCatalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  await fs.writeFile(outputCoverageGapPath, `${JSON.stringify(coverageGapReport, null, 2)}\n`, 'utf8');
  await fs.writeFile(outputIntakePlanPath, `${JSON.stringify(intakePlan, null, 2)}\n`, 'utf8');
  await fs.writeFile(outputCandidatePath, `${JSON.stringify(candidateRecords, null, 2)}\n`, 'utf8');
  await fs.writeFile(outputValidationPath, `${JSON.stringify(validationReport, null, 2)}\n`, 'utf8');
  await fs.writeFile(outputSourcesPath, `${JSON.stringify(catalog.sources, null, 2)}\n`, 'utf8');
  await fs.writeFile(outputBrandsPath, `${JSON.stringify(catalog.brands, null, 2)}\n`, 'utf8');
  await fs.writeFile(outputBrandImportPath, `${JSON.stringify(catalog.deskTravelBrandImport, null, 2)}\n`, 'utf8');
  await Promise.all(
    catalog.brands.map((brand) =>
      fs.writeFile(path.join(outputBrandLogoDir, `${brand.id}.svg`), createBrandLogoSvg(brand), 'utf8'),
    ),
  );
  await fs.writeFile(
    outputQualityPath,
    `${JSON.stringify(
      {
        generatedAt: catalog.generatedAt,
        schema: catalog.schema,
        stats: catalog.stats,
        quality: catalog.quality,
        sources: catalog.sources,
        brands: catalog.brands,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  console.log(
    `Wrote ${catalog.records.length} canonical Lounge Guru records ` +
      `(${candidateRecords.length} non-Priority Pass candidates).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
