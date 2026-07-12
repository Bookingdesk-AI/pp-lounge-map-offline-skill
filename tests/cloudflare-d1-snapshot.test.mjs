import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const projectRoot = new URL('..', import.meta.url);
const sqlPath = new URL('../.cache/d1/lounge-guru-current-snapshot.sql', import.meta.url);
const catalog = JSON.parse(fs.readFileSync(new URL('../public/data/lounge-guru-catalog.json', import.meta.url), 'utf8'));

test('D1 snapshot exporter writes a catalog import SQL file', () => {
  const output = execFileSync(process.execPath, ['scripts/export-cloudflare-d1-snapshot.mjs'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
  const summary = JSON.parse(output);
  const sql = fs.readFileSync(sqlPath, 'utf8');

  assert.equal(summary.totalRecords, catalog.records.length);
  assert.equal(summary.terminalPassed, false);
  assert.ok(summary.blockers.includes('approved_records_below_3800'));
  assert.ok(summary.blockers.includes('source_intake_runtime_not_cloudflare'));
  assert.match(sql, /INSERT OR REPLACE INTO coverage_goals/);
  assert.match(sql, /licensed-global-baseline/);
  assert.match(sql, /legacy-local-before-cloudflare-guardrail/);
  assert.match(sql, /source_intake_runtime_not_cloudflare/);
  assert.match(sql, /INSERT INTO catalog_runs/);
  assert.match(sql, /INSERT INTO lounge_records/);
  assert.match(sql, /INSERT INTO lounge_sources/);
  assert.match(sql, /INSERT INTO coverage_validation_runs/);
  assert.doesNotMatch(sql, /DELETE FROM source_runs/);
  assert.doesNotMatch(sql, /INSERT INTO source_runs/);
  assert.doesNotMatch(sql, /BEGIN TRANSACTION/);
  assert.doesNotMatch(sql, /COMMIT;/);
});
