import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createBrandLogoSvg } from './lib/brand-registry.mjs';
import { createBrandAssetContract } from './lib/brand-asset-contract.mjs';
import { createCloudflareSourceIntakePlan } from './lib/cloudflare-source-intake-plan.mjs';
import { createCoverageGapReport } from './lib/coverage-gap-report.mjs';
import { createMaxCoveragePlan } from './lib/max-coverage-plan.mjs';
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
const outputBrandAssetContractPath = path.resolve(projectRoot, 'public', 'data', 'brand-asset-contract.json');
const outputQualityPath = path.resolve(projectRoot, 'public', 'data', 'quality-report.json');
const outputFieldCoveragePath = path.resolve(projectRoot, 'public', 'data', 'lounge-field-coverage-report.json');
const outputCoverageGapPath = path.resolve(projectRoot, 'public', 'data', 'coverage-gap-report.json');
const outputMaxCoveragePlanPath = path.resolve(projectRoot, 'public', 'data', 'max-coverage-plan.json');
const outputIntakePlanPath = path.resolve(projectRoot, 'public', 'data', 'cloudflare-source-intake-plan.json');
const airportAuthorityPath = path.resolve(projectRoot, 'public', 'data', 'airport-authority.json');
const priorityPassDetailEvidencePath = path.resolve(projectRoot, 'public', 'data', 'priority-pass-detail-evidence.json');
const sourceIntakeReportPath = path.resolve(projectRoot, 'public', 'data', 'source-intake-report.json');
const cloudflareSourceIntakeReportPath = path.resolve(projectRoot, 'public', 'data', 'cloudflare-source-intake-report.json');
const sourceRunEvidencePath = path.resolve(projectRoot, 'public', 'data', 'cloudflare-source-run-evidence.json');
const outputCandidatePath = path.resolve(projectRoot, 'public', 'data', 'non-priority-lounge-candidates.json');
const outputValidationPath = path.resolve(projectRoot, 'public', 'data', 'non-priority-validation-report.json');
const outputBrandLogoDir = path.resolve(projectRoot, 'public', 'data', 'brand-logos');
const sourceAllianceLogoDir = path.resolve(projectRoot, 'assets', 'brand-logos', 'alliances');
const sourceReviewedLogoDir = path.resolve(projectRoot, 'assets', 'brand-logos', 'reviewed');
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

async function readAirportAuthority() {
  try {
    return JSON.parse(await fs.readFile(airportAuthorityPath, 'utf8'));
  } catch {
    return null;
  }
}

async function readPriorityPassDetailEvidence() {
  try {
    return JSON.parse(await fs.readFile(priorityPassDetailEvidencePath, 'utf8'));
  } catch {
    return null;
  }
}

function mergeTextList(first, second) {
  return uniqueByValue([...(Array.isArray(first) ? first : [first]), ...(Array.isArray(second) ? second : [second])]);
}

function applyPriorityPassDetailEvidence(features, evidence) {
  const records = Array.isArray(evidence?.records) ? evidence.records : [];
  if (records.length === 0) {
    return features;
  }

  const byUrl = new Map(records.map((record) => [record.url, record]));
  const byId = new Map(records.map((record) => [record.recordId, record]));

  return features.map((feature) => {
    const properties = feature.properties ?? {};
    const evidenceRecord = byId.get(properties.id) ?? byUrl.get(properties.url);
    if (!evidenceRecord) {
      return feature;
    }

    return {
      ...feature,
      properties: {
        ...properties,
        openingHours: evidenceRecord.openingHours ?? properties.openingHours,
        terminal: evidenceRecord.terminal ?? properties.terminal,
        location: evidenceRecord.location ?? properties.location,
        conditions: mergeTextList(properties.conditions, evidenceRecord.conditions),
        facilities: mergeTextList(properties.facilities, evidenceRecord.facilities),
        sourceRetrievedAt: evidenceRecord.retrievedAt ?? properties.sourceRetrievedAt,
      },
    };
  });
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

function applyCandidateApprovalPolicy(records, policy) {
  if (policy?.mode !== 'approve_all_current_records') {
    return records;
  }

  return records.map((record) => ({
    ...record,
    quality: {
      ...record.quality,
      conflicts: [],
      reviewStatus: 'approved',
    },
  }));
}

function isPhysicalCandidateRecord(record) {
  const primarySource = record.sources?.[0];
  if (!primarySource || primarySource.sourceId === 'priority-pass') {
    return true;
  }

  const fieldCoverage = new Set(primarySource.fieldCoverage ?? []);
  const conflicts = new Set(record.quality?.conflicts ?? []);
  const sourceId = primarySource.sourceId;
  const loungeName = String(record.lounge?.name ?? '');
  const terminal = String(record.location?.terminal ?? '');
  const isAccessPassProduct =
    sourceId === 'plaza-premium' &&
    /\b(?:lounge|experience)\s+pass\b/i.test(loungeName) &&
    terminal === 'Unknown' &&
    !fieldCoverage.has('operations.hours') &&
    !fieldCoverage.has('location.gate') &&
    !fieldCoverage.has('access.accessOffers');
  const isGenericProgramAccessRecord =
    sourceId === 'amex-global-lounge-collection' &&
    conflicts.has('program_page_not_operator_record') &&
    /^American Express lounge access - [A-Z0-9]{3}$/.test(loungeName) &&
    terminal === 'Unknown';
  const isGenericAllianceAccessRecord =
    sourceId === 'skyteam' &&
    /^SkyTeam lounge access - [A-Z0-9]{3}$/.test(loungeName) &&
    terminal === 'Unknown' &&
    !fieldCoverage.has('operations.hours') &&
    !fieldCoverage.has('location.gate');
  const isAirportCodeOnly =
    conflicts.has('airport_code_only') ||
    (!fieldCoverage.has('lounge.name') && !fieldCoverage.has('source.url') && String(record.location?.terminal ?? '') === 'Unknown');
  const isSourceLinkOnly =
    !fieldCoverage.has('lounge.name') &&
    fieldCoverage.has('source.url') &&
    terminal === 'Unknown' &&
    !fieldCoverage.has('operations.hours') &&
    !fieldCoverage.has('location.gate') &&
    !fieldCoverage.has('access.accessOffers');

  return !isAirportCodeOnly && !isSourceLinkOnly && !isGenericProgramAccessRecord && !isGenericAllianceAccessRecord && !isAccessPassProduct;
}

function uniqueByValue(values) {
  return [...new Set((values ?? []).filter(Boolean))];
}

function mergeSourceIntakeReports(primaryReport, secondaryReport) {
  if (!secondaryReport?.sources?.length) {
    return primaryReport;
  }

  const sourcesById = new Map((primaryReport.sources ?? []).map((source) => [source.sourceId, source]));
  for (const secondarySource of secondaryReport.sources ?? []) {
    const primarySource = sourcesById.get(secondarySource.sourceId);
    if (!primarySource) {
      sourcesById.set(secondarySource.sourceId, secondarySource);
      continue;
    }

    const preferredScalarSource = primarySource.status === 'fetched' ? primarySource : secondarySource;
    sourcesById.set(secondarySource.sourceId, {
      ...primarySource,
      ...preferredScalarSource,
      sourceId: primarySource.sourceId,
      publisher: primarySource.publisher || secondarySource.publisher,
      adapter: primarySource.adapter || secondarySource.adapter,
      status: primarySource.status === 'fetched' || secondarySource.status === 'fetched' ? 'fetched' : preferredScalarSource.status,
      records: Math.max(Number(primarySource.records ?? 0), Number(secondarySource.records ?? 0)),
      airportCodes: uniqueByValue([...(primarySource.airportCodes ?? []), ...(secondarySource.airportCodes ?? [])]),
      loungeLinks: uniqueByValue([...(primarySource.loungeLinks ?? []), ...(secondarySource.loungeLinks ?? [])]),
      structuredRecords: [...(primarySource.structuredRecords ?? []), ...(secondarySource.structuredRecords ?? [])],
      childPages: [...(primarySource.childPages ?? []), ...(secondarySource.childPages ?? [])],
      fetchAttempts: [...(primarySource.fetchAttempts ?? []), ...(secondarySource.fetchAttempts ?? [])],
    });
  }

  return {
    ...primaryReport,
    sources: [...sourcesById.values()],
  };
}

function hasText(value) {
  return String(value ?? '').trim() !== '';
}

function createLoungeFieldCoverageReport(catalog) {
  const rows = catalog.records.map((record) => {
    const primarySource = record.sources[0];
    const accessOffers = Array.isArray(record.accessOffers) ? record.accessOffers : [];
    return {
      recordId: record.lounge.id,
      name: record.lounge.name,
      airportCode: record.airport.iata,
      airportName: record.airport.name,
      sourceId: primarySource?.sourceId ?? 'unknown',
      publisher: primarySource?.publisher ?? 'Unknown',
      sourceUrl: primarySource?.url ?? '',
      reviewStatus: record.quality.reviewStatus,
      hours: record.operations.hours,
      gate: record.location.gate,
      accessOfferLabels: accessOffers.map((offer) => offer.label).filter(Boolean),
      hasHours: hasText(record.operations.hours),
      hasGate: hasText(record.location.gate),
      hasAccessOffer: accessOffers.length > 0,
    };
  });

  const emptyStats = () => ({
    total: 0,
    hours: 0,
    missingHours: 0,
    gate: 0,
    missingGate: 0,
    accessOffers: 0,
    missingAccessOffers: 0,
  });
  const totals = emptyStats();
  const bySource = {};

  for (const row of rows) {
    const sourceStats = bySource[row.sourceId] ?? emptyStats();
    for (const stats of [totals, sourceStats]) {
      stats.total += 1;
      stats.hours += row.hasHours ? 1 : 0;
      stats.missingHours += row.hasHours ? 0 : 1;
      stats.gate += row.hasGate ? 1 : 0;
      stats.missingGate += row.hasGate ? 0 : 1;
      stats.accessOffers += row.hasAccessOffer ? 1 : 0;
      stats.missingAccessOffers += row.hasAccessOffer ? 0 : 1;
    }
    bySource[row.sourceId] = sourceStats;
  }

  return {
    generatedAt: catalog.generatedAt,
    policy: {
      sourceMode: 'official structured/public sources only',
      priceRule: 'Only publish price/accessOffer values with explicit structured amount and ISO currency from an official source.',
      missingValueRule: 'Missing gate, hours, or price values remain blank and reviewable; do not infer from airport maps or blogs.',
    },
    stats: {
      totals,
      bySource: Object.fromEntries(Object.entries(bySource).sort(([first], [second]) => first.localeCompare(second))),
    },
    rows,
  };
}

async function main() {
  const geoJson = JSON.parse(await fs.readFile(geoJsonPath, 'utf8'));
  const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
  const [
    intakeReport,
    cloudflareSourceIntakeReport,
    sourceRunEvidence,
    approvalPolicy,
    airportAuthority,
    priorityPassDetailEvidence,
  ] = await Promise.all([
    readSourceIntakeReport(),
    readCloudflareSourceIntakeReport(),
    readSourceRunEvidence(),
    readApprovalPolicy(),
    readAirportAuthority(),
    readPriorityPassDetailEvidence(),
  ]);
  const features = applyPriorityPassDetailEvidence(geoJson.features ?? [], priorityPassDetailEvidence);
  const candidateIntakeReport = mergeSourceIntakeReports(intakeReport, cloudflareSourceIntakeReport);
  const candidateRecords = createNonPriorityCandidateRecords({
    report: candidateIntakeReport,
    features,
    generatedAt: meta.generatedAt,
    airportAuthority,
  });
  const catalogCandidateRecords = candidateRecords.filter(isPhysicalCandidateRecord);
  const outputCandidateRecords = applyCandidateApprovalPolicy(candidateRecords, approvalPolicy);
  const catalog = applyApprovalPolicy({
    catalog: createCanonicalCatalog({
      features,
      meta,
      additionalRecords: catalogCandidateRecords,
    }),
    features,
    meta,
    policy: approvalPolicy,
  });
  const validationReport = createNonPriorityValidationReport({
    records: outputCandidateRecords,
    report: candidateIntakeReport,
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
    sourceIntakeReport: intakeReport,
    cloudflareSourceIntakeReport,
    sourceRunEvidence,
  });
  const intakePlan = createCloudflareSourceIntakePlan({
    coverageGap: coverageGapReport,
    sourceRegistry: catalog.sources,
    sourceRunReport: cloudflareSourceIntakeReport,
  });
  const brandAssetContract = createBrandAssetContract({ generatedAt: catalog.generatedAt });
  const fieldCoverageReport = createLoungeFieldCoverageReport(catalog);
  const maxCoveragePlan = createMaxCoveragePlan({
    goal: worldwideCoverageGoal,
    catalog,
    coverageGap: coverageGapReport,
    fieldCoverageReport,
    sourceRegistry: catalog.sources,
  });

  const serialized = JSON.stringify(catalog);
  const forbiddenFragments = [projectRoot, path.resolve(projectRoot, '..'), process.env.HOME || ''].filter(Boolean);
  for (const fragment of forbiddenFragments) {
    if (fragment && serialized.includes(fragment)) {
      throw new Error(`Privacy guard: canonical output contains local path fragment ${fragment}`);
    }
  }

  await fs.mkdir(path.dirname(outputCatalogPath), { recursive: true });
  await fs.rm(outputBrandLogoDir, { recursive: true, force: true });
  await fs.mkdir(outputBrandLogoDir, { recursive: true });
  await fs.writeFile(outputCatalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  await fs.writeFile(outputFieldCoveragePath, `${JSON.stringify(fieldCoverageReport, null, 2)}\n`, 'utf8');
  await fs.writeFile(outputCoverageGapPath, `${JSON.stringify(coverageGapReport, null, 2)}\n`, 'utf8');
  await fs.writeFile(outputMaxCoveragePlanPath, `${JSON.stringify(maxCoveragePlan, null, 2)}\n`, 'utf8');
  await fs.writeFile(outputIntakePlanPath, `${JSON.stringify(intakePlan, null, 2)}\n`, 'utf8');
  await fs.writeFile(outputCandidatePath, `${JSON.stringify(outputCandidateRecords, null, 2)}\n`, 'utf8');
  await fs.writeFile(outputValidationPath, `${JSON.stringify(validationReport, null, 2)}\n`, 'utf8');
  await fs.writeFile(outputSourcesPath, `${JSON.stringify(catalog.sources, null, 2)}\n`, 'utf8');
  await fs.writeFile(outputBrandsPath, `${JSON.stringify(catalog.brands, null, 2)}\n`, 'utf8');
  await fs.writeFile(outputBrandImportPath, `${JSON.stringify(catalog.deskTravelBrandImport, null, 2)}\n`, 'utf8');
  await fs.writeFile(outputBrandAssetContractPath, `${JSON.stringify(brandAssetContract, null, 2)}\n`, 'utf8');
  await Promise.all(
    catalog.brands
      .filter((brand) => brand.logoUrl.startsWith('/data/brand-logos/') && !brand.upstreamLogoUrl)
      .map((brand) => fs.writeFile(path.join(outputBrandLogoDir, `${brand.id}.svg`), createBrandLogoSvg(brand), 'utf8')),
  );
  await Promise.all(
    [
      ['oneworld.svg', 'oneworld-all-routes.svg'],
      ['star-alliance.svg', 'star-alliance-all-routes.svg'],
      ['skyteam.png', 'skyteam-all-routes.png'],
    ].map(([sourceFileName, outputFileName]) =>
      fs.copyFile(path.join(sourceAllianceLogoDir, sourceFileName), path.join(outputBrandLogoDir, outputFileName)),
    ),
  );
  await Promise.all(
    (await fs.readdir(sourceReviewedLogoDir)).map((fileName) =>
      fs.copyFile(path.join(sourceReviewedLogoDir, fileName), path.join(outputBrandLogoDir, fileName)),
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
