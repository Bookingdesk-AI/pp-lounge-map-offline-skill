import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCoverageGapReport } from './lib/coverage-gap-report.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const goalPath = path.resolve(projectRoot, 'public', 'data', 'worldwide-coverage-goal.json');
const catalogPath = path.resolve(projectRoot, 'public', 'data', 'lounge-guru-catalog.json');
const sourceReportPath = path.resolve(projectRoot, 'public', 'data', 'source-intake-report.json');
const sourceRunEvidencePath = path.resolve(projectRoot, 'public', 'data', 'cloudflare-source-run-evidence.json');
const migrationPath = path.resolve(projectRoot, 'migrations', '0001_lounge_guru_catalog.sql');
const outputPath = path.resolve(projectRoot, '.cache', 'd1', 'lounge-guru-current-snapshot.sql');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sql(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return 'NULL';
    }
    return String(value);
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}

function json(value) {
  return JSON.stringify(value ?? null);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeFileAtomic(filePath, contents) {
  const directory = path.dirname(filePath);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${crypto.randomBytes(6).toString('hex')}.tmp`,
  );

  try {
    await fs.writeFile(temporaryPath, contents, 'utf8');
    await fs.rename(temporaryPath, filePath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
}

function summarize(catalog, goal, migrationSql, sourceReport, sourceRunEvidence) {
  const gapReport = createCoverageGapReport({
    goal,
    catalog,
    sourceRegistry: catalog.sources ?? [],
    migrationSql,
    sourceIntakeReport: sourceReport,
    sourceRunEvidence,
  });
  const records = catalog.records ?? [];
  const approvedRecords = records.filter((record) => record.quality?.reviewStatus === 'approved').length;
  const reviewRecords = records.length - approvedRecords;
  const recordsWithoutSources = records.filter((record) => !Array.isArray(record.sources) || record.sources.length === 0).length;
  const recordsWithoutQuality = records.filter((record) => !record.quality).length;
  const unknownAirportRecords = records.filter((record) => {
    const airport = record.airport ?? {};
    return !airport.iata || !airport.name || !Number.isFinite(Number(airport.coordinates?.lat)) || !Number.isFinite(Number(airport.coordinates?.lon));
  }).length;
  const sourceIds = new Set(records.flatMap((record) => record.sources.map((source) => source.sourceId)));
  const requiredFamilies = goal.sourceFamilies.filter((family) => family.requiredForTerminal);
  const sourceFamilies = requiredFamilies.map((family) => {
    const present = family.members?.length > 0
      ? family.members.some((sourceId) => sourceIds.has(sourceId))
      : sourceIds.has(family.id);
    return { id: family.id, mode: family.mode, present };
  });
  const sourceFamilyCoverageRatio =
    sourceFamilies.length > 0 ? sourceFamilies.filter((family) => family.present).length / sourceFamilies.length : 0;
  const blockers = [];
  const approvedRatio = records.length > 0 ? approvedRecords / records.length : 0;

  if (approvedRecords < goal.terminalGoal.minApprovedRecords) {
    blockers.push(`approved_records_below_${goal.terminalGoal.minApprovedRecords}`);
  }
  if (approvedRatio < goal.terminalGoal.minApprovedRatio) {
    blockers.push(`approved_ratio_below_${goal.terminalGoal.minApprovedRatio}`);
  }
  if (sourceFamilyCoverageRatio < goal.terminalGoal.minSourceFamilyCoverageRatio) {
    blockers.push('source_family_coverage_incomplete');
  }
  if (reviewRecords > goal.terminalGoal.maxReviewRecords) {
    blockers.push('review_records_present');
  }
  if (unknownAirportRecords > goal.terminalGoal.maxUnknownAirportRecords) {
    blockers.push('unknown_airport_records_present');
  }
  if (recordsWithoutSources > goal.terminalGoal.maxRecordsWithoutSources) {
    blockers.push('records_without_sources_present');
  }
  if (recordsWithoutQuality > goal.terminalGoal.maxRecordsWithoutQuality) {
    blockers.push('records_without_quality_present');
  }
  if (gapReport.deltas.sourceIntakeRuntimeRequired && !gapReport.current.cloudflareSourceRuntimePassed) {
    blockers.push(
      gapReport.deltas.sourceIntakeRuntimeRequired === 'playwright'
        ? 'source_intake_runtime_not_playwright'
        : 'source_intake_runtime_not_cloudflare',
    );
  }

  return {
    totalRecords: records.length,
    approvedRecords,
    reviewRecords,
    candidateRecords: catalog.stats?.candidateRecords ?? 0,
    nonPriorityRecords: catalog.stats?.nonPriorityRecords ?? 0,
    uniqueAirports: catalog.stats?.uniqueAirports ?? 0,
    uniqueCountries: catalog.stats?.uniqueCountries ?? 0,
    unknownAirportRecords,
    recordsWithoutSources,
    recordsWithoutQuality,
    sourceIntakeRuntime: gapReport.current.sourceIntakeRuntime,
    cloudflareSourceRuntimePassed: gapReport.current.cloudflareSourceRuntimePassed,
    cloudflareSourceEvidence: gapReport.current.cloudflareSourceEvidence,
    sourceFamilies,
    missingSourceFamilies: gapReport.deltas.missingSourceFamilies,
    gapReport,
    approvedRatio: Number(approvedRatio.toFixed(4)),
    sourceFamilyCoverageRatio: Number(sourceFamilyCoverageRatio.toFixed(4)),
    terminalPassed: blockers.length === 0,
    blockers,
  };
}

function upsertCoverageGoal(goal) {
  return `INSERT OR REPLACE INTO coverage_goals (
  id, version, title, status, target_scope, target_approved_records,
  target_approved_ratio, target_source_family_ratio, max_unknown_airport_records,
  max_records_without_sources, max_records_without_quality, notes_json, updated_at
) VALUES (
  ${sql(goal.id)}, ${sql(goal.version)}, ${sql(goal.title)}, ${sql(goal.status)}, ${sql(goal.targetScope)},
  ${Number(goal.terminalGoal.minApprovedRecords)}, ${Number(goal.terminalGoal.minApprovedRatio)},
  ${Number(goal.terminalGoal.minSourceFamilyCoverageRatio)}, ${Number(goal.terminalGoal.maxUnknownAirportRecords)},
  ${Number(goal.terminalGoal.maxRecordsWithoutSources)}, ${Number(goal.terminalGoal.maxRecordsWithoutQuality)},
  ${sql(json({
    terminalCommand: goal.validation?.terminalCommand,
    progressCommand: goal.validation?.progressCommand,
    strictExitCode: goal.validation?.strictExitCode,
    sourceFamilies: goal.sourceFamilies,
    guardrails: goal.guardrails,
    benchmark: goal.benchmark,
  }))},
  CURRENT_TIMESTAMP
);`;
}

function insertCatalogRun(runId, catalog, goal, summary, catalogHash) {
  return `INSERT INTO catalog_runs (
  id, generated_at, catalog_hash, total_records, approved_records, review_records,
  candidate_records, non_priority_records, unique_airports, unique_countries,
  source_families_json, quality_json
) VALUES (
  ${sql(runId)}, ${sql(catalog.generatedAt)}, ${sql(catalogHash)}, ${summary.totalRecords},
  ${summary.approvedRecords}, ${summary.reviewRecords}, ${summary.candidateRecords},
  ${summary.nonPriorityRecords}, ${summary.uniqueAirports}, ${summary.uniqueCountries},
  ${sql(json(summary.sourceFamilies))}, ${sql(json({
    ...catalog.quality,
    approvedRatio: summary.approvedRatio,
    sourceFamilyCoverageRatio: summary.sourceFamilyCoverageRatio,
    goalId: goal.id,
  }))}
);`;
}

function insertLoungeRecord(runId, record) {
  return `INSERT INTO lounge_records (
  id, catalog_run_id, name, brand, operator, category, status, airport_iata,
  airport_name, city, country, latitude, longitude, terminal, review_status,
  completeness, freshness, source_count, programs_json, access_methods_json,
  conflicts_json, canonical_json
) VALUES (
  ${sql(record.lounge.id)}, ${sql(runId)}, ${sql(record.lounge.name)}, ${sql(record.lounge.brand)},
  ${sql(record.lounge.operator)}, ${sql(record.lounge.category)}, ${sql(record.lounge.status)},
  ${sql(record.airport.iata)}, ${sql(record.airport.name)}, ${sql(record.airport.city)}, ${sql(record.airport.country)},
  ${Number(record.airport.coordinates.lat)}, ${Number(record.airport.coordinates.lon)}, ${sql(record.location.terminal || 'Unknown')},
  ${sql(record.quality.reviewStatus)}, ${Number(record.quality.completeness)}, ${Number(record.quality.freshness)},
  ${record.sources.length}, ${sql(json(record.lounge.programs))}, ${sql(json(record.lounge.accessMethods))},
  ${sql(json(record.quality.conflicts))}, ${sql(json(record))}
);`;
}

function insertLoungeSources(runId, record) {
  return record.sources.map((source) => `INSERT INTO lounge_sources (
  lounge_id, catalog_run_id, source_id, publisher, url, retrieved_at, confidence,
  field_coverage_json, rights_note
) VALUES (
  ${sql(record.lounge.id)}, ${sql(runId)}, ${sql(source.sourceId)}, ${sql(source.publisher)},
  ${sql(source.url)}, ${sql(source.retrievedAt)}, ${Number(source.confidence)},
  ${sql(json(source.fieldCoverage))}, ${sql(source.rightsNote)}
);`);
}

function insertValidationRun(goal, runId, summary) {
  const validationId = `${goal.id}-${runId}`;
  return `INSERT INTO coverage_validation_runs (
  id, coverage_goal_id, catalog_run_id, status, summary_json, blockers_json
) VALUES (
  ${sql(validationId)}, ${sql(goal.id)}, ${sql(runId)}, ${sql(summary.terminalPassed ? 'passed' : 'failed')},
  ${sql(json(summary))}, ${sql(json(summary.blockers))}
);`;
}

async function main() {
  const [goal, catalog, sourceReport, sourceRunEvidence, migrationSql] = await Promise.all([
    readJson(goalPath),
    readJson(catalogPath),
    readJson(sourceReportPath),
    readJson(sourceRunEvidencePath),
    fs.readFile(migrationPath, 'utf8'),
  ]);
  const catalogHash = sha256(JSON.stringify(catalog));
  const runId = `catalog-${catalogHash.slice(0, 16)}`;
  const summary = summarize(catalog, goal, migrationSql, sourceReport, sourceRunEvidence);
  const statements = [
    upsertCoverageGoal(goal),
    'DELETE FROM coverage_validation_runs;',
    'DELETE FROM lounge_sources;',
    'DELETE FROM lounge_records;',
    'DELETE FROM catalog_runs;',
    insertCatalogRun(runId, catalog, goal, summary, catalogHash),
    ...catalog.records.flatMap((record) => [insertLoungeRecord(runId, record), ...insertLoungeSources(runId, record)]),
    insertValidationRun(goal, runId, summary),
  ];

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await writeFileAtomic(outputPath, `${statements.join('\n')}\n`);
  console.log(JSON.stringify({
    outputPath: path.relative(projectRoot, outputPath),
    runId,
    catalogHash,
    totalRecords: summary.totalRecords,
    approvedRecords: summary.approvedRecords,
    reviewRecords: summary.reviewRecords,
    sourceRows: catalog.records.reduce((total, record) => total + record.sources.length, 0),
    terminalPassed: summary.terminalPassed,
    blockers: summary.blockers,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
