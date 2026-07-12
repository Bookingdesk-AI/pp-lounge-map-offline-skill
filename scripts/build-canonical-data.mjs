import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createBrandLogoSvg } from './lib/brand-registry.mjs';
import { createCloudflareSourceIntakePlan } from './lib/cloudflare-source-intake-plan.mjs';
import { createCoverageGapReport } from './lib/coverage-gap-report.mjs';
import {
  createCanonicalCatalog,
  createSourceRegistryForCatalog,
  summarizeQuality,
} from './lib/lounge-canonical.mjs';
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
const cloudflareSourceIntakeReportPath = path.resolve(projectRoot, 'public', 'data', 'cloudflare-source-intake-report.json');
const sourceRunEvidencePath = path.resolve(projectRoot, 'public', 'data', 'cloudflare-source-run-evidence.json');
const outputCandidatePath = path.resolve(projectRoot, 'public', 'data', 'non-priority-lounge-candidates.json');
const outputValidationPath = path.resolve(projectRoot, 'public', 'data', 'non-priority-validation-report.json');
const outputBrandLogoDir = path.resolve(projectRoot, 'public', 'data', 'brand-logos');
const worldwideCoverageGoalPath = path.resolve(projectRoot, 'public', 'data', 'worldwide-coverage-goal.json');
const approvalPolicyPath = path.resolve(projectRoot, 'public', 'data', 'catalog-approval-policy.json');
const migrationPath = path.resolve(projectRoot, 'migrations', '0001_lounge_guru_catalog.sql');

async function readSourceIntakeReport() {
  try {
    return JSON.parse(await fs.readFile(sourceIntakeReportPath, 'utf8'));
  } catch {
    return null;
  }
}

async function readCloudflareSourceIntakeReport() {
  try {
    return JSON.parse(await fs.readFile(cloudflareSourceIntakeReportPath, 'utf8'));
  } catch {
    return null;
  }
}

async function readSourceRunEvidence() {
  try {
    return JSON.parse(await fs.readFile(sourceRunEvidencePath, 'utf8'));
  } catch {
    return null;
  }
}

async function readApprovalPolicy() {
  try {
    return JSON.parse(await fs.readFile(approvalPolicyPath, 'utf8'));
  } catch {
    return null;
  }
}

function applyApprovalPolicy({ catalog, features, meta, policy }) {
  if (policy?.mode !== 'approve_all_current_records') {
    return catalog;
  }

  const approvedRecords = catalog.records.map((record) => ({
    ...record,
    quality: {
      ...record.quality,
      conflicts: [],
      reviewStatus: 'approved',
    },
  }));
  const quality = summarizeQuality(approvedRecords);
  const sources = createSourceRegistryForCatalog(features, catalog.generatedAt, approvedRecords, {
    priorityPassGeneratedAt: meta.generatedAt ?? catalog.generatedAt,
  });

  return {
    ...catalog,
    records: approvedRecords,
    sources,
    stats: {
      ...catalog.stats,
      reviewQueue: quality.reviewQueue,
      approvedRecords: approvedRecords.length - quality.reviewQueue,
    },
    filters: {
      ...catalog.filters,
      reviewStatuses: [...new Set(approvedRecords.map((record) => record.quality.reviewStatus))].sort(),
    },
    quality: {
      ...quality,
      approvalPolicy: {
        mode: policy.mode,
        approvedAt: policy.approvedAt,
        approvedBy: policy.approvedBy,
        reason: policy.reason,
      },
    },
  };
}

async function main() {
  const geoJson = JSON.parse(await fs.readFile(geoJsonPath, 'utf8'));
  const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
  const [intakeReport, cloudflareSourceIntakeReport, sourceRunEvidence, approvalPolicy] = await Promise.all([
    readSourceIntakeReport(),
    readCloudflareSourceIntakeReport(),
    readSourceRunEvidence(),
    readApprovalPolicy(),
  ]);
  const candidateRecords = createNonPriorityCandidateRecords({
    report: intakeReport,
    features: geoJson.features ?? [],
    generatedAt: meta.generatedAt,
  });
  const catalog = applyApprovalPolicy({
    catalog: createCanonicalCatalog({
      features: geoJson.features ?? [],
      meta,
      additionalRecords: candidateRecords,
    }),
    features: geoJson.features ?? [],
    meta,
    policy: approvalPolicy,
  });
  const validationReport = createNonPriorityValidationReport({
    records: catalog.records,
    report: intakeReport,
    generatedAt: catalog.generatedAt,
  });
  const outputCandidateRecords = catalog.records.filter((record) => record.sources[0]?.sourceId !== 'priority-pass');
  const [worldwideCoverageGoal, migrationSql] = await Promise.all([
    fs.readFile(worldwideCoverageGoalPath, 'utf8').then(JSON.parse),
    fs.readFile(migrationPath, 'utf8'),
  ]);
  const coverageGapReport = createCoverageGapReport({
    goal: worldwideCoverageGoal,
    catalog,
    sourceRegistry: catalog.sources,
    migrationSql,
    sourceIntakeReport: intakeReport,
    cloudflareSourceIntakeReport,
    sourceRunEvidence,
  });
  const intakePlan = createCloudflareSourceIntakePlan({
    coverageGap: coverageGapReport,
    sourceRegistry: catalog.sources,
    sourceRunReport: cloudflareSourceIntakeReport,
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
  await fs.writeFile(outputCandidatePath, `${JSON.stringify(outputCandidateRecords, null, 2)}\n`, 'utf8');
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
      `(${outputCandidateRecords.length} non-Priority Pass candidates).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
