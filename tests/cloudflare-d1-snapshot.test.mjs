import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const projectRoot = new URL('..', import.meta.url);
const sqlPath = new URL('../.cache/d1/lounge-guru-current-snapshot.sql', import.meta.url);
const schemaSourcesSqlPath = new URL('../.cache/d1/lounge-guru-current-snapshot-schema-sources.sql', import.meta.url);
const catalogSqlPath = new URL('../.cache/d1/lounge-guru-current-snapshot-catalog.sql', import.meta.url);
const candidatesSqlPath = new URL('../.cache/d1/lounge-guru-current-snapshot-candidates.sql', import.meta.url);
const fieldsSqlPath = new URL('../.cache/d1/lounge-guru-current-snapshot-fields.sql', import.meta.url);
const validationSqlPath = new URL('../.cache/d1/lounge-guru-current-snapshot-validation.sql', import.meta.url);
const catalog = JSON.parse(fs.readFileSync(new URL('../public/data/lounge-guru-catalog.json', import.meta.url), 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('D1 snapshot exporter writes a catalog import SQL file', () => {
  const output = execFileSync(process.execPath, ['scripts/export-cloudflare-d1-snapshot.mjs'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
  const summary = JSON.parse(output);
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const schemaSourcesSql = fs.readFileSync(schemaSourcesSqlPath, 'utf8');
  const catalogSql = fs.readFileSync(catalogSqlPath, 'utf8');
  const candidatesSql = fs.readFileSync(candidatesSqlPath, 'utf8');
  const fieldsSql = fs.readFileSync(fieldsSqlPath, 'utf8');
  const validationSql = fs.readFileSync(validationSqlPath, 'utf8');

  assert.equal(summary.totalRecords, catalog.records.length);
  assert.deepEqual(summary.splitOutputPaths, [
    '.cache/d1/lounge-guru-current-snapshot-schema-sources.sql',
    '.cache/d1/lounge-guru-current-snapshot-catalog.sql',
    '.cache/d1/lounge-guru-current-snapshot-candidates.sql',
    '.cache/d1/lounge-guru-current-snapshot-fields.sql',
    '.cache/d1/lounge-guru-current-snapshot-validation.sql',
  ]);
  assert.equal(summary.terminalPassed, true);
  assert.equal(summary.blockers.includes('approved_records_below_target'), false);
  assert.equal(summary.blockers.includes('non_priority_records_below_target'), false);
  assert.equal(summary.blockers.includes('hours_coverage_below_target'), false);
  assert.equal(summary.blockers.includes('gate_coverage_below_target'), false);
  assert.equal(summary.blockers.includes('price_coverage_below_target'), false);
  assert.equal(summary.sourceTargets, catalog.sources.length);
  assert.ok(summary.sourceFetchRuns > 0);
  assert.ok(summary.sourceCandidates > 800);
  assert.ok(summary.identityLinks >= catalog.records.length);
  assert.equal(summary.recordFieldEvidenceRows, catalog.records.length * catalog.schema.fields.length);
  assert.equal(summary.reviewQueueRows, 0);
  assert.equal(summary.fieldCoverageRows, catalog.records.length);
  assert.ok(summary.fieldCoverage.hours > 2000);
  assert.ok(summary.fieldCoverage.gates >= 1400);
  assert.ok(summary.fieldCoverage.prices >= 17);
  assert.equal(summary.blockers.includes('source_intake_runtime_not_cloudflare'), false);
  assert.equal(summary.blockers.includes('source_intake_runtime_not_playwright'), false);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS source_targets/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS airport_authority/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS source_fetch_runs/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS source_snapshots/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS source_parse_runs/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS source_candidates/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS lounge_identity_links/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS record_field_evidence/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS review_queue/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS lounge_field_coverage/);
  assert.match(sql, /INSERT OR REPLACE INTO coverage_goals/);
  assert.match(schemaSourcesSql, /"minHoursCoverageRatio":0\.99/);
  assert.match(schemaSourcesSql, /"minGateCoverageRatio":0\.6/);
  assert.match(schemaSourcesSql, /"minPriceCoverageRatio":0\.4/);
  assert.doesNotMatch(sql, /licensed-global-baseline/);
  assert.match(sql, /playwright/);
  assert.doesNotMatch(sql, /source_intake_runtime_not_cloudflare/);
  assert.match(sql, /INSERT INTO catalog_runs/);
  assert.match(sql, /INSERT INTO lounge_records/);
  assert.match(sql, /INSERT INTO lounge_sources/);
  assert.match(sql, /INSERT INTO lounge_field_coverage/);
  assert.match(sql, /INSERT OR REPLACE INTO source_targets/);
  assert.match(sql, /INSERT INTO airport_authority/);
  assert.match(sql, /INSERT INTO source_fetch_runs/);
  assert.match(sql, /INSERT INTO source_snapshots/);
  assert.match(sql, /INSERT INTO source_parse_runs/);
  assert.match(sql, /INSERT INTO source_candidates/);
  assert.match(sql, /INSERT INTO lounge_identity_links/);
  assert.match(sql, /INSERT INTO record_field_evidence/);
  assert.match(sql, /INSERT INTO coverage_validation_runs/);
  assert.match(validationSql, /'passed'/);
  assert.match(schemaSourcesSql, /CREATE TABLE IF NOT EXISTS source_targets/);
  assert.match(schemaSourcesSql, /CREATE TABLE IF NOT EXISTS airport_authority/);
  assert.match(schemaSourcesSql, /INSERT OR REPLACE INTO source_targets/);
  assert.match(schemaSourcesSql, /INSERT INTO airport_authority/);
  assert.doesNotMatch(schemaSourcesSql, /INSERT INTO lounge_records/);
  assert.match(catalogSql, /INSERT INTO lounge_records/);
  assert.doesNotMatch(catalogSql, /INSERT INTO record_field_evidence/);
  assert.match(candidatesSql, /INSERT INTO source_candidates/);
  assert.match(candidatesSql, /INSERT INTO lounge_identity_links/);
  assert.match(fieldsSql, /INSERT INTO record_field_evidence/);
  assert.match(fieldsSql, /'lounge\.name'/);
  assert.match(fieldsSql, /'airport\.coordinates'/);
  assert.match(fieldsSql, /'location\.terminal'/);
  assert.match(fieldsSql, /'operations\.hours'/);
  assert.match(fieldsSql, /'record\.quality'/);
  assert.doesNotMatch(fieldsSql, /INSERT INTO coverage_validation_runs/);
  assert.match(validationSql, /INSERT INTO coverage_validation_runs/);
  assert.match(packageJson.scripts['db:catalog:push'], /lounge-guru-current-snapshot-schema-sources\.sql/);
  assert.match(packageJson.scripts['db:catalog:push'], /lounge-guru-current-snapshot-catalog\.sql/);
  assert.match(packageJson.scripts['db:catalog:push'], /lounge-guru-current-snapshot-candidates\.sql/);
  assert.match(packageJson.scripts['db:catalog:push'], /lounge-guru-current-snapshot-fields\.sql/);
  assert.match(packageJson.scripts['db:catalog:push'], /lounge-guru-current-snapshot-validation\.sql/);
  assert.doesNotMatch(sql, /cloudflare_source_proof_incomplete/);
  assert.doesNotMatch(sql, /DELETE FROM source_runs/);
  assert.doesNotMatch(sql, /INSERT INTO source_runs/);
  assert.doesNotMatch(sql, /BEGIN TRANSACTION/);
  assert.doesNotMatch(sql, /COMMIT;/);
  assert.ok(summary.airportAuthorityRows > 4000);
});
