import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCoverageGapReport } from './lib/coverage-gap-report.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const goalPath = path.resolve(projectRoot, 'public', 'data', 'worldwide-coverage-goal.json');
const catalogPath = path.resolve(projectRoot, 'public', 'data', 'lounge-guru-catalog.json');
const sourceRegistryPath = path.resolve(projectRoot, 'public', 'data', 'source-registry.json');
const migrationPath = path.resolve(projectRoot, 'migrations', '0001_lounge_guru_catalog.sql');

const strict = process.argv.includes('--strict');
const jsonOutput = process.argv.includes('--json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hasSourceFamilyRecords(catalog, family) {
  const sourceIds = new Set(
    catalog.records.flatMap((record) => record.sources.map((source) => source.sourceId)),
  );

  if (family.members?.length > 0) {
    return family.members.some((sourceId) => sourceIds.has(sourceId));
  }

  return sourceIds.has(family.id);
}

function validateRequiredTables(goal, migrationSql) {
  return goal.cloudflareDatabase.requiredTables.map((table) => ({
    table,
    present: new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`, 'i').test(migrationSql),
  }));
}

function buildSummary({ goal, catalog, sourceRegistry, migrationSql }) {
  const gapReport = createCoverageGapReport({ goal, catalog, sourceRegistry, migrationSql });
  const records = catalog.records ?? [];
  const approvedRecords = records.filter((record) => record.quality?.reviewStatus === 'approved').length;
  const reviewRecords = records.length - approvedRecords;
  const recordsWithoutSources = records.filter((record) => !Array.isArray(record.sources) || record.sources.length === 0).length;
  const recordsWithoutQuality = records.filter((record) => !record.quality).length;
  const unknownAirportRecords = records.filter((record) => {
    const airport = record.airport ?? {};
    return !airport.iata || !airport.name || !Number.isFinite(Number(airport.coordinates?.lat)) || !Number.isFinite(Number(airport.coordinates?.lon));
  }).length;
  const requiredFamilies = goal.sourceFamilies.filter((family) => family.requiredForTerminal);
  const sourceFamilyStatuses = requiredFamilies.map((family) => ({
    id: family.id,
    mode: family.mode,
    present: hasSourceFamilyRecords(catalog, family),
  }));
  const coveredFamilies = sourceFamilyStatuses.filter((family) => family.present).length;
  const tableStatuses = validateRequiredTables(goal, migrationSql);
  const approvedRatio = records.length > 0 ? approvedRecords / records.length : 0;
  const sourceFamilyCoverageRatio = requiredFamilies.length > 0 ? coveredFamilies / requiredFamilies.length : 0;
  const sourceRegistryIds = new Set(sourceRegistry.map((source) => source.id));
  const missingRegisteredMembers = goal.sourceFamilies
    .flatMap((family) => family.members ?? [family.id])
    .filter((sourceId) => !sourceRegistryIds.has(sourceId));

  const blockers = [];
  if (approvedRecords < goal.terminalGoal.minApprovedRecords) {
    blockers.push(`approved_records_below_${goal.terminalGoal.minApprovedRecords}`);
  }
  if (approvedRatio < goal.terminalGoal.minApprovedRatio) {
    blockers.push(`approved_ratio_below_${goal.terminalGoal.minApprovedRatio}`);
  }
  if (sourceFamilyCoverageRatio < goal.terminalGoal.minSourceFamilyCoverageRatio) {
    blockers.push('source_family_coverage_incomplete');
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
  if (reviewRecords > goal.terminalGoal.maxReviewRecords) {
    blockers.push('review_records_present');
  }
  if (tableStatuses.some((table) => !table.present)) {
    blockers.push('cloudflare_d1_schema_missing_tables');
  }
  if (missingRegisteredMembers.length > 0) {
    blockers.push('source_registry_missing_goal_members');
  }

  return {
    goalId: goal.id,
    goalVersion: goal.version,
    database: goal.cloudflareDatabase,
    catalogHash: sha256(JSON.stringify(catalog)),
    generatedAt: catalog.generatedAt,
    totalRecords: records.length,
    approvedRecords,
    reviewRecords,
    candidateRecords: catalog.stats?.candidateRecords ?? 0,
    nonPriorityRecords: catalog.stats?.nonPriorityRecords ?? 0,
    approvedRatio: Number(approvedRatio.toFixed(4)),
    sourceFamilyCoverageRatio: Number(sourceFamilyCoverageRatio.toFixed(4)),
    unknownAirportRecords,
    recordsWithoutSources,
    recordsWithoutQuality,
    sourceFamilyStatuses,
    missingSourceFamilies: gapReport.deltas.missingSourceFamilies,
    gapReport,
    tableStatuses,
    missingRegisteredMembers,
    terminalPassed: blockers.length === 0,
    blockers,
  };
}

const goal = readJson(goalPath);
const catalog = readJson(catalogPath);
const sourceRegistry = readJson(sourceRegistryPath);
const migrationSql = fs.readFileSync(migrationPath, 'utf8');
const summary = buildSummary({ goal, catalog, sourceRegistry, migrationSql });

if (jsonOutput) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log(`Goal: ${summary.goalId} (${summary.goalVersion})`);
  console.log(`D1: ${summary.database.databaseName} / ${summary.database.binding}`);
  console.log(`Catalog: ${summary.totalRecords} records, ${summary.approvedRecords} approved, ${summary.reviewRecords} review`);
  console.log(`Non-PP: ${summary.nonPriorityRecords} records, candidates ${summary.candidateRecords}`);
  console.log(`Approved ratio: ${(summary.approvedRatio * 100).toFixed(2)}%`);
  console.log(`Source families: ${(summary.sourceFamilyCoverageRatio * 100).toFixed(2)}%`);
  console.log(`Schema tables: ${summary.tableStatuses.filter((table) => table.present).length}/${summary.tableStatuses.length}`);
  if (summary.terminalPassed) {
    console.log('Terminal goal: passed');
  } else {
    console.log(`Terminal goal: blocked (${summary.blockers.join(', ')})`);
  }
}

if (strict && !summary.terminalPassed) {
  process.exitCode = 1;
}
