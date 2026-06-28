import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const goal = JSON.parse(fs.readFileSync(new URL('../public/data/worldwide-coverage-goal.json', import.meta.url), 'utf8'));
const coverageGap = JSON.parse(fs.readFileSync(new URL('../public/data/coverage-gap-report.json', import.meta.url), 'utf8'));
const intakePlan = JSON.parse(
  fs.readFileSync(new URL('../public/data/cloudflare-source-intake-plan.json', import.meta.url), 'utf8'),
);
const cloudflareEvidence = JSON.parse(
  fs.readFileSync(new URL('../public/data/cloudflare-source-run-evidence.json', import.meta.url), 'utf8'),
);
const migrationSql = fs.readFileSync(new URL('../migrations/0001_lounge_guru_catalog.sql', import.meta.url), 'utf8');
const seedSql = fs.readFileSync(new URL('../migrations/0002_seed_worldwide_coverage_goal.sql', import.meta.url), 'utf8');

test('worldwide coverage goal defines the Cloudflare D1 target', () => {
  assert.equal(goal.id, 'lounge-guru-worldwide-coverage');
  assert.equal(goal.cloudflareDatabase.product, 'd1');
  assert.equal(goal.cloudflareDatabase.databaseName, 'lounge-guru-catalog');
  assert.equal(goal.cloudflareDatabase.databaseId, '7ce3bfa1-3a17-4554-a526-c3703ca3b902');
  assert.equal(goal.cloudflareDatabase.binding, 'LOUNGE_GURU_DB');
  assert.equal(goal.terminalGoal.requiresCloudflareSchema, true);
  assert.equal(goal.terminalGoal.requiresCloudflareSourceRuntime, true);
});

test('worldwide coverage goal requires real global source lanes', () => {
  const families = new Map(goal.sourceFamilies.map((family) => [family.id, family]));

  for (const familyId of [
    'licensed-global-baseline',
    'collinson-networks',
    'bank-issuer-programs',
    'card-network-programs',
    'airline-alliance-lounges',
    'airline-operated-lounges',
    'operator-operated-lounges',
    'open-enrichment',
  ]) {
    assert.equal(families.get(familyId)?.requiredForTerminal, true, `missing required family ${familyId}`);
  }

  assert.ok(families.get('licensed-global-baseline').members.includes('loungereview-api'));
  assert.ok(families.get('collinson-networks').members.includes('loungekey'));
  assert.ok(families.get('card-network-programs').members.includes('mastercard-airport-lounge-programs'));
  assert.ok(families.get('airline-alliance-lounges').members.includes('star-alliance'));
  assert.ok(families.get('airline-alliance-lounges').members.includes('oneworld'));
  assert.ok(families.get('airline-alliance-lounges').members.includes('skyteam'));
  assert.ok(families.get('operator-operated-lounges').members.includes('plaza-premium'));
  assert.ok(families.get('operator-operated-lounges').members.includes('aspire-lounges'));
});

test('D1 migration includes required terminal coverage tables', () => {
  for (const table of goal.cloudflareDatabase.requiredTables) {
    assert.match(migrationSql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`, 'i'));
  }
});

test('D1 seed migration installs the active worldwide coverage goal', () => {
  assert.match(seedSql, /INSERT OR REPLACE INTO coverage_goals/i);
  assert.match(seedSql, /lounge-guru-worldwide-coverage/);
  assert.match(seedSql, /npm run goal:coverage/);
});

test('coverage validator reports current progress without pretending terminal completion', () => {
  const output = execFileSync(
    process.execPath,
    ['scripts/validate-worldwide-coverage-goal.mjs', '--json'],
    {
      cwd: new URL('..', import.meta.url),
      encoding: 'utf8',
    },
  );
  const summary = JSON.parse(output);

  assert.equal(summary.goalId, goal.id);
  assert.equal(summary.database.databaseName, 'lounge-guru-catalog');
  assert.ok(summary.totalRecords > 0);
  assert.equal(summary.recordsWithoutSources, 0);
  assert.equal(summary.recordsWithoutQuality, 0);
  assert.equal(summary.terminalPassed, false);
  assert.ok(summary.blockers.includes('approved_records_below_3800'));
  assert.ok(summary.blockers.includes('review_records_present'));
  assert.equal(summary.sourceIntakeRuntime, coverageGap.current.sourceIntakeRuntime);
  assert.equal(summary.cloudflareSourceRuntimePassed, false);
  assert.equal(
    summary.cloudflareSourceEvidence.readyTasksWithCloudflareEvidence,
    cloudflareEvidence.stats.readyTasksWithCloudflareEvidence,
  );
  assert.equal(summary.cloudflareSourceEvidence.fullSourceIntakeReportRequired, true);
  assert.ok(summary.blockers.includes('source_intake_runtime_not_cloudflare'));
  assert.deepEqual(summary.missingSourceFamilies, coverageGap.deltas.missingSourceFamilies);
  assert.equal(summary.gapReport.catalogHash, coverageGap.catalogHash);
});

test('coverage gap report names terminal blockers and missing source lanes', () => {
  assert.equal(coverageGap.goalId, goal.id);
  assert.equal(coverageGap.terminalPassed, false);
  assert.ok(coverageGap.blockers.includes('source_family_gaps_present'));
  assert.ok(coverageGap.blockers.includes('source_intake_runtime_not_cloudflare'));
  assert.equal(coverageGap.current.sourceIntakeRuntime, 'legacy-local-before-cloudflare-guardrail');
  assert.equal(coverageGap.current.cloudflareSourceRuntimePassed, false);
  assert.equal(
    coverageGap.current.cloudflareSourceEvidence.readyTasksWithCloudflareEvidence,
    cloudflareEvidence.stats.readyTasksWithCloudflareEvidence,
  );
  assert.equal(coverageGap.current.cloudflareSourceEvidence.readyTaskCoverageRatio, 1);
  assert.equal(coverageGap.current.cloudflareSourceEvidence.fullSourceIntakeReportRequired, true);
  assert.equal(coverageGap.deltas.sourceIntakeRuntimeRequired, 'cloudflare');
  assert.ok(coverageGap.deltas.approvedRecordsRemaining > 0);
  assert.ok(coverageGap.deltas.reviewRecordsToResolve > 0);
  assert.deepEqual([...coverageGap.deltas.missingSourceFamilies].sort(), [
    'card-network-programs',
    'licensed-global-baseline',
  ]);

  const families = new Map(coverageGap.sourceFamilies.map((family) => [family.id, family]));
  assert.equal(families.get('licensed-global-baseline')?.present, false);
  assert.ok(families.get('licensed-global-baseline')?.missingMembers.includes('loungereview-api'));
  assert.equal(families.get('card-network-programs')?.present, false);
  assert.ok(families.get('card-network-programs')?.missingMembers.includes('visa-airport-companion'));
  assert.equal(families.get('open-enrichment')?.present, true);
});

test('Cloudflare source intake plan tracks missing source lanes', () => {
  assert.equal(intakePlan.coverageGoalId, goal.id);
  assert.equal(intakePlan.policy.requiredRuntime, 'cloudflare');
  assert.equal(intakePlan.policy.localScrawl, 'blocked');
  assert.equal(intakePlan.policy.rawSnapshotsCommitted, false);
  assert.equal(intakePlan.summary.missingFamilies, coverageGap.deltas.missingSourceFamilies.length);
  assert.equal(intakePlan.summary.tasks, intakePlan.tasks.length);
  assert.equal(intakePlan.summary.memberGaps, intakePlan.memberGaps.length);

  const taskSourceIds = new Set(intakePlan.tasks.map((task) => task.sourceId));
  for (const family of coverageGap.sourceFamilies.filter((sourceFamily) => !sourceFamily.present)) {
    for (const sourceId of family.missingMembers) {
      assert.ok(taskSourceIds.has(sourceId), `missing intake task ${sourceId}`);
    }
  }

  const memberGapIds = new Set(intakePlan.memberGaps.map((gap) => gap.sourceId));
  for (const sourceId of ['loungekey', 'united', 'plaza-premium']) {
    assert.ok(memberGapIds.has(sourceId), `missing member gap ${sourceId}`);
  }
  assert.equal(
    intakePlan.memberGaps.find((gap) => gap.sourceId === 'plaza-premium')?.familyPresent,
    true,
  );
  assert.equal(
    intakePlan.memberGaps.find((gap) => gap.sourceId === 'visa-airport-companion')?.terminalFamilyBlocked,
    true,
  );

  assert.ok(intakePlan.tasks.some((task) => task.action === 'credential_review' && task.status === 'blocked'));
  assert.ok(intakePlan.tasks.some((task) => task.action === 'structured_adapter' && task.status === 'ready'));
  assert.ok(intakePlan.tasks.some((task) => task.action === 'fetch_repair' && task.status === 'ready'));
  assert.ok(
    intakePlan.tasks
      .find((task) => task.sourceId === 'visa-airport-companion')
      ?.fetchUrls.includes('https://visaairportcompanion.ca/'),
  );
});
