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
const cloudflareReport = JSON.parse(
  fs.readFileSync(new URL('../public/data/cloudflare-source-intake-report.json', import.meta.url), 'utf8'),
);
const migrationSql = fs.readFileSync(new URL('../migrations/0001_lounge_guru_catalog.sql', import.meta.url), 'utf8');
const seedSql = fs.readFileSync(new URL('../migrations/0002_seed_worldwide_coverage_goal.sql', import.meta.url), 'utf8');

function sourceIdsFromCommand(command) {
  const match = String(command ?? '').match(/--source-ids=([^\s]+)/);
  return match ? match[1].split(',').filter(Boolean) : [];
}

test('worldwide coverage goal defines the Cloudflare D1 target', () => {
  assert.equal(goal.id, 'lounge-guru-worldwide-coverage');
  assert.equal(goal.cloudflareDatabase.product, 'd1');
  assert.equal(goal.cloudflareDatabase.databaseName, 'lounge-guru-catalog');
  assert.equal(goal.cloudflareDatabase.databaseId, '7ce3bfa1-3a17-4554-a526-c3703ca3b902');
  assert.equal(goal.cloudflareDatabase.binding, 'LOUNGE_GURU_DB');
  assert.equal(goal.terminalGoal.requiresCloudflareSchema, true);
  assert.equal(goal.terminalGoal.requiresCloudflareSourceRuntime, false);
  assert.equal(goal.terminalGoal.requiresPlaywrightSourceRuntime, true);
  assert.equal(goal.terminalGoal.minApprovedRecords, 3000);
  assert.equal(goal.terminalGoal.minNonPriorityRecords, 1300);
  assert.equal(goal.terminalGoal.minHoursCoverageRatio, 0.97);
  assert.equal(goal.terminalGoal.minGateCoverageRatio, 0.45);
  assert.equal(goal.terminalGoal.minPriceCoverageRatio, 0.25);
  assert.equal(goal.terminalGoal.maxRecordsWithoutFieldEvidence, 0);
  assert.equal(goal.terminalGoal.maxStaleOpenReviewRecords, 0);
  assert.equal(goal.terminalGoal.minReadyMemberGapCoverageRatio, 1);
  assert.equal(goal.reviewQueue.staleOpenHighConfidenceDays, 14);
  assert.equal(goal.reviewQueue.highConfidenceThreshold, 0.75);
  assert.match(goal.reviewQueue.terminalQuery, /review_queue/);
  assert.match(goal.validation.d1SmokeQueries.fieldCoverage, /lounge_field_coverage/);
  assert.match(goal.validation.d1SmokeQueries.openReviewQueue, /review_queue/);
  assert.match(goal.validation.d1SmokeQueries.provenance, /lounge_records/);
});

test('worldwide coverage goal requires official public source lanes', () => {
  const families = new Map(goal.sourceFamilies.map((family) => [family.id, family]));

  for (const familyId of [
    'collinson-networks',
    'bank-issuer-programs',
    'airline-alliance-lounges',
    'airline-operated-lounges',
    'operator-operated-lounges',
    'open-enrichment',
  ]) {
    assert.equal(families.get(familyId)?.requiredForTerminal, true, `missing required family ${familyId}`);
  }

  assert.equal(families.has('licensed-global-baseline'), false);
  assert.equal(families.get('card-network-programs')?.requiredForTerminal, false);
  assert.ok(families.get('collinson-networks').members.includes('loungekey'));
  assert.equal(families.get('card-network-programs').members.includes('mastercard-airport-lounge-programs'), false);
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

test('coverage validator reports current terminal completion', () => {
  const textOutput = execFileSync(
    process.execPath,
    ['scripts/validate-worldwide-coverage-goal.mjs'],
    {
      cwd: new URL('..', import.meta.url),
      encoding: 'utf8',
    },
  );
  const output = execFileSync(
    process.execPath,
    ['scripts/validate-worldwide-coverage-goal.mjs', '--json'],
    {
      cwd: new URL('..', import.meta.url),
      encoding: 'utf8',
    },
  );
  const summary = JSON.parse(output);

  const sourceProof = coverageGap.current.cloudflareSourceEvidence;
  assert.match(
    textOutput,
    new RegExp(`Source proof: ${sourceProof.readyMemberGapsWithCloudflareEvidence}/${sourceProof.readyMemberGaps}`),
  );
  assert.doesNotMatch(textOutput, /Source proof missing:/);
  assert.match(textOutput, /Intake token env: LOUNGE_GURU_INTAKE_TOKEN/);
  assert.match(textOutput, /Intake preflight: intake token (present|missing), API token (present|missing), local scrawl playwright_only/);
  assert.match(
    textOutput,
    new RegExp(
      `Playwright lanes: ready ${coverageGap.nextCloudflareIntake.readySourceIds.length}, ` +
        `access ${coverageGap.nextCloudflareIntake.accessBlockedSourceIds.length}, ` +
        `cred ${coverageGap.nextCloudflareIntake.credentialSourceIds.length}, ` +
        `rights ${coverageGap.nextCloudflareIntake.rightsReviewSourceIds.length}`,
    ),
  );
  assert.match(textOutput, /Source proof repair: LOUNGE_GURU_INTAKE_TOKEN=<redacted> .*npm run intake:cloudflare/);
  for (const sourceId of coverageGap.nextCloudflareIntake.readySourceIds) {
    assert.ok(textOutput.includes(sourceId), `missing ready repair source ${sourceId}`);
  }
  assert.match(textOutput, /Intake report: public\/data\/source-intake-report\.json/);
  assert.match(
    textOutput,
    new RegExp(
      `Field coverage: hours ${(coverageGap.current.fieldCoverage.hoursRatio * 100).toFixed(2)}%, ` +
        `gate ${(coverageGap.current.fieldCoverage.gateRatio * 100).toFixed(2)}%, ` +
        `price ${(coverageGap.current.fieldCoverage.priceRatio * 100).toFixed(2)}%`,
    ),
  );
  assert.match(textOutput, /Review SLA: 0 stale open high-confidence over 14 days/);
  assert.match(textOutput, /Terminal goal: passed/);
  assert.doesNotMatch(textOutput, /approved_records_below_3000/);
  assert.doesNotMatch(textOutput, /non_priority_records_below_1300/);
  assert.doesNotMatch(textOutput, /hours_coverage_below_0\.97/);
  assert.doesNotMatch(textOutput, /gate_coverage_below_0\.45/);
  assert.doesNotMatch(textOutput, /price_coverage_below_0\.25/);
  assert.equal(summary.goalId, goal.id);
  assert.equal(summary.database.databaseName, 'lounge-guru-catalog');
  assert.ok(summary.totalRecords > 0);
  assert.equal(summary.recordsWithoutSources, 0);
  assert.equal(summary.recordsWithoutQuality, 0);
  assert.equal(summary.recordsWithoutFieldEvidence, 0);
  assert.equal(summary.staleOpenReviewRecords, 0);
  assert.equal(summary.reviewQueueSla.staleOpenHighConfidenceDays, 14);
  assert.equal(summary.reviewQueueSla.maxStaleOpenReviewRecords, 0);
  assert.equal(summary.terminalPassed, true);
  assert.equal(summary.blockers.includes('approved_records_below_3000'), false);
  assert.ok(summary.approvedRecords >= goal.terminalGoal.minApprovedRecords);
  assert.equal(summary.blockers.includes('non_priority_records_below_1300'), false);
  assert.equal(summary.blockers.includes('hours_coverage_below_0.97'), false);
  assert.equal(summary.blockers.includes('gate_coverage_below_0.45'), false);
  assert.equal(summary.blockers.includes('price_coverage_below_0.25'), false);
  assert.equal(summary.gapReport.current.fieldCoverage.hours, coverageGap.current.fieldCoverage.hours);
  assert.equal(summary.gapReport.current.fieldCoverage.gates, coverageGap.current.fieldCoverage.gates);
  assert.equal(summary.gapReport.current.fieldCoverage.prices, coverageGap.current.fieldCoverage.prices);
  assert.equal(summary.gapReport.deltas.approvedRecordsRemaining, coverageGap.deltas.approvedRecordsRemaining);
  assert.equal(summary.gapReport.deltas.nonPriorityRecordsRemaining, 0);
  assert.equal(summary.sourceIntakeRuntime, coverageGap.current.sourceIntakeRuntime);
  assert.equal(summary.cloudflareSourceRuntimePassed, true);
  assert.equal(
    summary.cloudflareSourceEvidence.readyTasksWithCloudflareEvidence,
    cloudflareEvidence.stats.readyTasksWithCloudflareEvidence,
  );
  assert.equal(summary.cloudflareSourceEvidence.fullSourceIntakeReportRequired, true);
  assert.equal(summary.gapReport.nextCloudflareIntake.requiredTokenEnv, 'LOUNGE_GURU_INTAKE_TOKEN');
  assert.equal(summary.gapReport.nextCloudflareIntake.localScrawl, 'playwright_only');
  assert.deepEqual([...summary.gapReport.nextCloudflareIntake.accessBlockedSourceIds].sort(), []);
  assert.deepEqual(Object.keys(summary.credentialPreflight).sort(), [
    'baseUrlEnvPresent',
    'cloudflareApiTokenPresent',
    'cloudflareAuthCurrentEnv',
    'cloudflareAuthFailure',
    'cloudflareAuthOauthFallback',
    'cloudflareAuthStatus',
    'intakeTokenEnv',
    'intakeTokenPresent',
    'localScrawl',
  ]);
  assert.equal(summary.credentialPreflight.intakeTokenEnv, 'LOUNGE_GURU_INTAKE_TOKEN');
  assert.equal(typeof summary.credentialPreflight.intakeTokenPresent, 'boolean');
  assert.equal(typeof summary.credentialPreflight.cloudflareApiTokenPresent, 'boolean');
  assert.equal(summary.credentialPreflight.cloudflareAuthStatus, 'unchecked');
  assert.equal(summary.credentialPreflight.localScrawl, 'playwright_only');
  assert.ok(summary.gapReport.nextCloudflareIntake.commands.report.includes('source-intake-report.json'));
  assert.equal(
    summary.cloudflareSourceEvidence.readyMemberGapsWithCloudflareEvidence,
    cloudflareEvidence.stats.readyMemberGapsWithCloudflareEvidence,
  );
  assert.equal(summary.cloudflareSourceEvidence.readyMemberGaps, cloudflareEvidence.stats.readyMemberGaps);
  assert.deepEqual(summary.gapReport.deltas.missingSourceProofIds, []);
  assert.deepEqual(summary.gapReport.deltas.missingSourceProofLanes, []);
  assert.equal(summary.blockers.includes('source_intake_runtime_not_cloudflare'), false);
  assert.equal(summary.blockers.includes('source_intake_runtime_not_playwright'), false);
  assert.deepEqual(summary.missingSourceFamilies, coverageGap.deltas.missingSourceFamilies);
  assert.equal(summary.gapReport.catalogHash, coverageGap.catalogHash);
});

test('coverage gap report names terminal blockers and missing source lanes', () => {
  assert.equal(coverageGap.goalId, goal.id);
  assert.equal(coverageGap.terminalPassed, true);
  assert.equal(coverageGap.blockers.includes('approved_records_below_target'), false);
  assert.equal(coverageGap.blockers.includes('non_priority_records_below_target'), false);
  assert.equal(coverageGap.blockers.includes('hours_coverage_below_target'), false);
  assert.equal(coverageGap.blockers.includes('gate_coverage_below_target'), false);
  assert.equal(coverageGap.blockers.includes('price_coverage_below_target'), false);
  assert.equal(coverageGap.blockers.includes('source_family_gaps_present'), false);
  assert.equal(coverageGap.blockers.includes('source_intake_runtime_not_cloudflare'), false);
  assert.equal(coverageGap.blockers.includes('source_intake_runtime_not_playwright'), false);
  assert.equal(coverageGap.current.sourceIntakeRuntime, 'playwright');
  assert.equal(coverageGap.current.cloudflareSourceRuntimePassed, true);
  assert.ok(coverageGap.current.approvedRecords >= goal.terminalGoal.minApprovedRecords);
  assert.ok(coverageGap.current.nonPriorityRecords >= goal.terminalGoal.minNonPriorityRecords);
  assert.ok(coverageGap.current.fieldCoverage.hours > 0);
  assert.ok(coverageGap.current.fieldCoverage.gates > 0);
  assert.ok(coverageGap.current.fieldCoverage.prices > 0);
  assert.equal(
    coverageGap.current.fieldCoverage.hoursRatio,
    Number((coverageGap.current.fieldCoverage.hours / coverageGap.current.fieldCoverage.total).toFixed(4)),
  );
  assert.equal(
    coverageGap.current.fieldCoverage.gateRatio,
    Number((coverageGap.current.fieldCoverage.gates / coverageGap.current.fieldCoverage.total).toFixed(4)),
  );
  assert.equal(
    coverageGap.current.fieldCoverage.priceRatio,
    Number((coverageGap.current.fieldCoverage.prices / coverageGap.current.fieldCoverage.total).toFixed(4)),
  );
  assert.equal(coverageGap.current.fieldCoverage.recordsWithoutFieldEvidence, 0);
  assert.equal(
    coverageGap.current.cloudflareSourceEvidence.readyTasksWithCloudflareEvidence,
    cloudflareEvidence.stats.readyTasksWithCloudflareEvidence,
  );
  assert.equal(coverageGap.current.cloudflareSourceEvidence.readyTaskCoverageRatio, 0);
  assert.equal(coverageGap.current.cloudflareSourceEvidence.readyMemberGaps, cloudflareEvidence.stats.readyMemberGaps);
  assert.equal(
    coverageGap.current.cloudflareSourceEvidence.readyMemberGapsWithCloudflareEvidence,
    cloudflareEvidence.stats.readyMemberGapsWithCloudflareEvidence,
  );
  assert.equal(coverageGap.current.cloudflareSourceEvidence.readyMemberGapCoverageRatio, 1);
  assert.equal(coverageGap.current.cloudflareSourceEvidence.fullSourceIntakeReportRequired, true);
  assert.equal(coverageGap.targets.minReadyMemberGapCoverageRatio, 1);
  assert.equal(coverageGap.deltas.sourceIntakeRuntimeRequired, 'playwright');
  assert.equal(coverageGap.nextCloudflareIntake.requiredTokenEnv, 'LOUNGE_GURU_INTAKE_TOKEN');
  assert.equal(coverageGap.nextCloudflareIntake.localScrawl, 'playwright_only');
  assert.equal(coverageGap.nextCloudflareIntake.missingRuntime, false);
  assert.equal(coverageGap.nextCloudflareIntake.fullReportRequired, true);
  assert.deepEqual(coverageGap.nextCloudflareIntake.rightsReviewSourceIds, ['nominatim']);
  assert.deepEqual([...coverageGap.nextCloudflareIntake.accessBlockedSourceIds].sort(), []);
  assert.equal(coverageGap.nextCloudflareIntake.credentialSourceIds.length, 0);
  assert.ok(coverageGap.nextCloudflareIntake.commands.probe.includes('npm run intake:cloudflare'));
  assert.deepEqual(
    sourceIdsFromCommand(coverageGap.nextCloudflareIntake.commands.proofRepair).sort(),
    [...coverageGap.nextCloudflareIntake.readySourceIds].sort(),
  );
  assert.equal(coverageGap.nextCloudflareIntake.commands.report, 'public/data/source-intake-report.json');
  assert.equal(coverageGap.nextCloudflareIntake.commands.promote, 'npm run build:canonical-data');
  assert.equal(
    coverageGap.deltas.approvedRecordsRemaining,
    Math.max(0, goal.terminalGoal.minApprovedRecords - coverageGap.current.approvedRecords),
  );
  assert.equal(coverageGap.deltas.nonPriorityRecordsRemaining, 0);
  assert.equal(
    coverageGap.deltas.hoursCoverageRecordsRemaining,
    Math.max(0, Math.ceil(goal.terminalGoal.minHoursCoverageRatio * coverageGap.current.fieldCoverage.total) - coverageGap.current.fieldCoverage.hours),
  );
  assert.equal(
    coverageGap.deltas.gateCoverageRecordsRemaining,
    Math.max(0, Math.ceil(goal.terminalGoal.minGateCoverageRatio * coverageGap.current.fieldCoverage.total) - coverageGap.current.fieldCoverage.gates),
  );
  assert.equal(
    coverageGap.deltas.priceCoverageRecordsRemaining,
    Math.max(0, Math.ceil(goal.terminalGoal.minPriceCoverageRatio * coverageGap.current.fieldCoverage.total) - coverageGap.current.fieldCoverage.prices),
  );
  assert.equal(coverageGap.deltas.reviewRecordsToResolve, 0);
  assert.equal(coverageGap.deltas.recordsWithoutFieldEvidenceToResolve, 0);
  assert.deepEqual([...coverageGap.deltas.missingSourceFamilies].sort(), []);

  const families = new Map(coverageGap.sourceFamilies.map((family) => [family.id, family]));
  assert.equal(families.has('licensed-global-baseline'), false);
  assert.equal(families.has('card-network-programs'), false);
  assert.equal(families.get('open-enrichment')?.present, true);
});

test('Cloudflare source intake plan tracks missing source lanes', () => {
  assert.equal(intakePlan.coverageGoalId, goal.id);
  assert.equal(intakePlan.policy.requiredRuntime, 'playwright');
  assert.equal(intakePlan.policy.localScrawl, 'playwright_only');
  assert.equal(intakePlan.policy.rawSnapshotsCommitted, false);
  assert.equal(intakePlan.sourceRunId, cloudflareReport.runId);
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
  for (const sourceId of ['loungekey', 'united']) {
    assert.ok(memberGapIds.has(sourceId), `missing member gap ${sourceId}`);
  }
  assert.equal(memberGapIds.has('plaza-premium'), false);
  assert.ok(coverageGap.sourceFamilies.some((family) => family.presentMembers.includes('plaza-premium')));
  assert.equal(
    intakePlan.memberGaps.some((gap) => gap.sourceId === 'visa-airport-companion'),
    false,
  );

  assert.equal(intakePlan.tasks.some((task) => task.action === 'credential_review'), false);
  assert.equal(intakePlan.tasks.length, 0);
  assert.ok(intakePlan.memberGaps.some((task) => task.action === 'structured_adapter' && task.status === 'ready'));
  assert.equal(intakePlan.memberGaps.find((task) => task.sourceId === 'loungekey')?.runStatus, 'skipped');
});
