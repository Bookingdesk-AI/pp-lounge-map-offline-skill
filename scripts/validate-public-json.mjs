import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), '..');
const dataDir = path.resolve(projectRoot, 'public', 'data');
const issues = [];

function readJson(relativePath) {
  const fullPath = path.resolve(projectRoot, relativePath);
  try {
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (error) {
    issues.push(`${relativePath}: invalid JSON (${error instanceof Error ? error.message : String(error)})`);
    return null;
  }
}

function issue(condition, message) {
  if (!condition) {
    issues.push(message);
  }
}

function noAbsoluteLocalPath(value, relativePath, trail = relativePath) {
  if (typeof value === 'string') {
    issue(!value.includes(projectRoot), `${trail}: exposes project root`);
    issue(!value.includes(path.dirname(projectRoot)), `${trail}: exposes workspace path`);
    issue(!value.includes(process.env.HOME ?? '\0'), `${trail}: exposes home path`);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => noAbsoluteLocalPath(item, relativePath, `${trail}[${index}]`));
    return;
  }

  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      noAbsoluteLocalPath(child, relativePath, `${trail}.${key}`);
    }
  }
}

function assertIsoDate(value, message) {
  issue(typeof value === 'string' && !Number.isNaN(Date.parse(value)), message);
}

function validateCatalog(catalog) {
  issue(catalog?.schema?.version === '2026-06-14', 'lounge-guru-catalog.json: unexpected schema version');
  issue(Array.isArray(catalog?.schema?.fields), 'lounge-guru-catalog.json: schema fields missing');
  const schemaGroups = new Set((catalog?.schema?.fields ?? []).map((field) => field.group));
  for (const group of ['lounge', 'airport', 'location', 'operations', 'record']) {
    issue(schemaGroups.has(group), `lounge-guru-catalog.json: schema group ${group} missing`);
  }
  issue(Array.isArray(catalog?.records) && catalog.records.length > 0, 'lounge-guru-catalog.json: records missing');
  issue(
    catalog?.stats?.totalCatalogRecords === catalog?.records?.length,
    'lounge-guru-catalog.json: stats.totalCatalogRecords mismatch',
  );
  issue(Array.isArray(catalog?.sources) && catalog.sources.length >= 30, 'lounge-guru-catalog.json: sources incomplete');

  for (const [index, record] of (catalog?.records ?? []).entries()) {
    const prefix = `lounge-guru-catalog.json.records[${index}]`;
    issue(Boolean(record?.lounge?.id), `${prefix}: lounge.id missing`);
    issue(Boolean(record?.lounge?.name), `${prefix}: lounge.name missing`);
    issue(/^[A-Z0-9]{3}$/.test(record?.airport?.iata ?? ''), `${prefix}: airport.iata invalid`);
    issue(Array.isArray(record?.sources) && record.sources.length > 0, `${prefix}: sources missing`);
    issue(record?.quality && typeof record.quality === 'object', `${prefix}: quality missing`);

    for (const [sourceIndex, source] of (record?.sources ?? []).entries()) {
      const sourcePrefix = `${prefix}.sources[${sourceIndex}]`;
      issue(Boolean(source.sourceId), `${sourcePrefix}: sourceId missing`);
      issue(Boolean(source.publisher), `${sourcePrefix}: publisher missing`);
      issue(/^https:\/\//.test(source.url ?? ''), `${sourcePrefix}: url must be https`);
      assertIsoDate(source.retrievedAt, `${sourcePrefix}: retrievedAt invalid`);
      issue(typeof source.confidence === 'number', `${sourcePrefix}: confidence missing`);
      issue(Boolean(source.rightsNote), `${sourcePrefix}: rightsNote missing`);
    }
  }
}

function validateGeoJson(geoJson) {
  issue(geoJson?.type === 'FeatureCollection', 'lounges.geojson: type must be FeatureCollection');
  issue(Array.isArray(geoJson?.features) && geoJson.features.length > 0, 'lounges.geojson: features missing');

  for (const [index, feature] of (geoJson?.features ?? []).entries()) {
    const prefix = `lounges.geojson.features[${index}]`;
    issue(feature?.type === 'Feature', `${prefix}: type must be Feature`);
    issue(feature?.geometry?.type === 'Point', `${prefix}: geometry must be Point`);
    issue(Array.isArray(feature?.geometry?.coordinates), `${prefix}: coordinates missing`);
    issue(
      feature.geometry.coordinates.every((value) => typeof value === 'number' && Number.isFinite(value)),
      `${prefix}: coordinates invalid`,
    );
    issue(Boolean(feature?.properties?.name), `${prefix}: name missing`);
    issue(/^[A-Z0-9]{3}$/.test(feature?.properties?.airportCode ?? ''), `${prefix}: airportCode invalid`);
  }
}

function validateCoverage(goal, gap) {
  issue(goal?.id === 'lounge-guru-worldwide-coverage', 'worldwide-coverage-goal.json: goal id mismatch');
  issue(goal?.cloudflareDatabase?.product === 'd1', 'worldwide-coverage-goal.json: database product mismatch');
  issue(goal?.cloudflareDatabase?.databaseName === 'lounge-guru-catalog', 'worldwide-coverage-goal.json: D1 name mismatch');
  issue(goal?.terminalGoal?.requiresPlaywrightSourceRuntime === true, 'worldwide-coverage-goal.json: Playwright source runtime not required');
  issue(
    goal?.terminalGoal?.minReadyMemberGapCoverageRatio === 1,
    'worldwide-coverage-goal.json: source proof coverage target missing',
  );
  issue(gap?.goalId === goal?.id, 'coverage-gap-report.json: goal id mismatch');
  issue(typeof gap?.terminalPassed === 'boolean', 'coverage-gap-report.json: terminalPassed missing');
  issue(
    Boolean(gap?.current?.sourceIntakeRuntime),
    'coverage-gap-report.json: source intake runtime missing',
  );
  issue(
    gap?.current?.cloudflareSourceRuntimePassed ===
      (gap?.current?.sourceIntakeRuntime === 'playwright' &&
        gap?.nextCloudflareIntake?.localScrawl === 'playwright_only'),
    'coverage-gap-report.json: Playwright source runtime status mismatch',
  );
  issue(
    typeof gap?.current?.cloudflareSourceEvidence?.readyTasksWithCloudflareEvidence === 'number',
    'coverage-gap-report.json: Cloudflare source evidence missing',
  );
  issue(
    typeof gap?.current?.cloudflareSourceEvidence?.readyTaskCoverageRatio === 'number',
    'coverage-gap-report.json: Cloudflare ready task ratio missing',
  );
  issue(
    typeof gap?.current?.cloudflareSourceEvidence?.readyMemberGapCoverageRatio === 'number',
    'coverage-gap-report.json: Cloudflare ready member gap ratio missing',
  );
  issue(
    gap?.current?.cloudflareSourceEvidence?.readyMemberGapCoverageRatio >=
      goal?.terminalGoal?.minReadyMemberGapCoverageRatio ||
      gap?.blockers?.includes('cloudflare_source_proof_incomplete'),
    'coverage-gap-report.json: incomplete source proof not blocked',
  );
  issue(
    gap?.current?.sourceIntakeRuntime === 'playwright' ||
      gap?.blockers?.includes('source_intake_runtime_not_playwright'),
    'coverage-gap-report.json: non-Playwright source runtime not blocked',
  );
  issue(
    gap?.current?.cloudflareSourceEvidence?.fullSourceIntakeReportRequired !== true ||
      gap?.blockers?.includes('source_intake_runtime_not_playwright') ||
      gap?.current?.sourceIntakeRuntime === 'playwright',
    'coverage-gap-report.json: probe-only source evidence not blocked',
  );
  issue(Array.isArray(gap?.deltas?.missingSourceFamilies), 'coverage-gap-report.json: missing source families malformed');
  issue(
    typeof gap?.deltas?.approvedRecordsRemaining === 'number',
    'coverage-gap-report.json: approvedRecordsRemaining missing',
  );
  issue(
    gap?.nextCloudflareIntake?.requiredTokenEnv === 'LOUNGE_GURU_INTAKE_TOKEN',
    'coverage-gap-report.json: Cloudflare intake token env missing',
  );
  issue(
    gap?.nextCloudflareIntake?.localScrawl === 'playwright_only',
    'coverage-gap-report.json: Playwright scrawl preflight missing',
  );
  issue(
    Array.isArray(gap?.nextCloudflareIntake?.readySourceIds),
    'coverage-gap-report.json: ready Cloudflare source ids missing',
  );
  issue(
    Array.isArray(gap?.nextCloudflareIntake?.accessBlockedSourceIds),
    'coverage-gap-report.json: access-blocked Cloudflare source ids missing',
  );
  issue(
    Array.isArray(gap?.deltas?.missingSourceProofIds),
    'coverage-gap-report.json: missing source proof ids missing',
  );
  issue(
    Array.isArray(gap?.deltas?.missingSourceProofLanes),
    'coverage-gap-report.json: missing source proof lanes missing',
  );
  issue(
    gap?.deltas?.missingSourceProofIds?.length === 0 ||
      (typeof gap?.nextCloudflareIntake?.commands?.proofRepair === 'string' &&
        gap.nextCloudflareIntake.commands.proofRepair.includes('npm run intake:cloudflare')),
    'coverage-gap-report.json: Cloudflare proof repair command missing',
  );
  issue(
    typeof gap?.nextCloudflareIntake?.commands?.probe === 'string' &&
      gap.nextCloudflareIntake.commands.probe.includes('npm run intake:cloudflare'),
    'coverage-gap-report.json: probe command must use Cloudflare intake',
  );
  issue(
    typeof gap?.nextCloudflareIntake?.commands?.report === 'string' &&
      gap.nextCloudflareIntake.commands.report.includes('source-intake-report.json'),
    'coverage-gap-report.json: Playwright report command missing',
  );
}

function validateIntakePlan(plan, gap) {
  issue(plan?.coverageGoalId === gap?.goalId, 'cloudflare-source-intake-plan.json: goal id mismatch');
  issue(plan?.policy?.requiredRuntime === 'playwright', 'cloudflare-source-intake-plan.json: required runtime mismatch');
  issue(plan?.policy?.localScrawl === 'playwright_only', 'cloudflare-source-intake-plan.json: local scrawl mode mismatch');
  issue(plan?.policy?.rawSnapshotsCommitted === false, 'cloudflare-source-intake-plan.json: raw snapshots should not be committed');
  issue(Array.isArray(plan?.tasks), 'cloudflare-source-intake-plan.json: tasks missing');
  issue(
    plan?.summary?.tasks === plan?.tasks?.length,
    'cloudflare-source-intake-plan.json: summary task count mismatch',
  );
  issue(Array.isArray(plan?.memberGaps), 'cloudflare-source-intake-plan.json: memberGaps missing');
  issue(
    plan?.summary?.memberGaps === plan?.memberGaps?.length,
    'cloudflare-source-intake-plan.json: summary member gap count mismatch',
  );

  const planFamilies = new Set((plan?.tasks ?? []).map((task) => task.familyId));
  for (const familyId of gap?.deltas?.missingSourceFamilies ?? []) {
    issue(planFamilies.has(familyId), `cloudflare-source-intake-plan.json: missing family ${familyId} not planned`);
  }

  function validatePlanItem(item, prefix) {
    issue(Boolean(item.sourceId), `${prefix}: sourceId missing`);
    issue(Boolean(item.publisher), `${prefix}: publisher missing`);
    issue(['ready', 'blocked'].includes(item.status), `${prefix}: status invalid`);
    issue(Boolean(item.action), `${prefix}: action missing`);
    issue(Boolean(item.next), `${prefix}: next missing`);
    issue(/^https:\/\//.test(item.url ?? ''), `${prefix}: url must be https`);
    if (item.fetchUrls) {
      issue(Array.isArray(item.fetchUrls), `${prefix}: fetchUrls must be an array`);
      for (const [urlIndex, url] of item.fetchUrls.entries()) {
        issue(/^https:\/\//.test(url), `${prefix}.fetchUrls[${urlIndex}]: url must be https`);
      }
    }
    issue(Boolean(item.rightsNote), `${prefix}: rightsNote missing`);
  }

  for (const [index, task] of (plan?.tasks ?? []).entries()) {
    validatePlanItem(task, `cloudflare-source-intake-plan.json.tasks[${index}]`);
  }

  for (const [index, gapItem] of (plan?.memberGaps ?? []).entries()) {
    const prefix = `cloudflare-source-intake-plan.json.memberGaps[${index}]`;
    validatePlanItem(gapItem, prefix);
    issue(typeof gapItem.familyPresent === 'boolean', `${prefix}: familyPresent missing`);
    issue(typeof gapItem.terminalFamilyBlocked === 'boolean', `${prefix}: terminalFamilyBlocked missing`);
  }
}

function validateMaxCoveragePlan(plan, goal, gap) {
  issue(plan?.goalId === goal?.id, 'max-coverage-plan.json: goal id mismatch');
  issue(plan?.goalVersion === goal?.version, 'max-coverage-plan.json: goal version mismatch');
  issue(plan?.status === (gap?.terminalPassed ? 'complete' : 'blocked'), 'max-coverage-plan.json: status mismatch');
  issue(
    plan?.baseline?.totalRecords === gap?.current?.totalRecords,
    'max-coverage-plan.json: baseline total records mismatch',
  );
  issue(
    plan?.deltas?.approvedRecordsRemaining === gap?.deltas?.approvedRecordsRemaining,
    'max-coverage-plan.json: approved delta mismatch',
  );
  issue(Array.isArray(plan?.waves) && plan.waves.length >= 5, 'max-coverage-plan.json: coverage waves missing');
  issue(
    Array.isArray(plan?.sourceScaleEvidence) && plan.sourceScaleEvidence.length >= 8,
    'max-coverage-plan.json: source scale evidence missing',
  );
  const scaleSourceIds = new Set((plan?.sourceScaleEvidence ?? []).map((source) => source.sourceId));
  for (const sourceId of ['priority-pass', 'american-express', 'mastercard-travel-pass', 'star-alliance', 'oneworld', 'skyteam']) {
    issue(scaleSourceIds.has(sourceId), `max-coverage-plan.json: ${sourceId} scale evidence missing`);
  }
  for (const [index, source] of (plan?.sourceScaleEvidence ?? []).entries()) {
    const prefix = `max-coverage-plan.json.sourceScaleEvidence[${index}]`;
    issue(Boolean(source.publisher), `${prefix}: publisher missing`);
    issue(/^https:\/\//.test(source.officialUrl ?? ''), `${prefix}: official URL missing`);
    issue(Boolean(source.publishedScale), `${prefix}: published scale missing`);
    issue(Boolean(source.planningUse), `${prefix}: planning use missing`);
  }
  issue(
    Array.isArray(plan?.officialPriceResearchEvidence) && plan.officialPriceResearchEvidence.length >= 5,
    'max-coverage-plan.json: official price research missing',
  );
  const priceResearchSourceIds = new Set((plan?.officialPriceResearchEvidence ?? []).map((source) => source.sourceId));
  for (const sourceId of ['plaza-premium', 'airport-dimensions', 'aspire-lounges', 'escape-lounges', 'no1-lounges']) {
    issue(priceResearchSourceIds.has(sourceId), `max-coverage-plan.json: ${sourceId} price research missing`);
  }
  for (const [index, source] of (plan?.officialPriceResearchEvidence ?? []).entries()) {
    const prefix = `max-coverage-plan.json.officialPriceResearchEvidence[${index}]`;
    issue(Boolean(source.publisher), `${prefix}: publisher missing`);
    issue(/^https:\/\//.test(source.officialUrl ?? ''), `${prefix}: official URL missing`);
    issue(
      Array.isArray(source.evidenceFields) && source.evidenceFields.includes('access.accessOffers'),
      `${prefix}: access offer evidence field missing`,
    );
    issue(Boolean(source.researchUse), `${prefix}: research use missing`);
    issue(Boolean(source.firstBatchRule), `${prefix}: first batch rule missing`);
  }
  issue(
    Array.isArray(plan?.airportEnrichmentBacklog) && plan.airportEnrichmentBacklog.length > 0,
    'max-coverage-plan.json: airport backlog missing',
  );
  issue(
    Array.isArray(plan?.sourceBacklog) && plan.sourceBacklog.length > 0,
    'max-coverage-plan.json: source backlog missing',
  );
  issue(
    Array.isArray(plan?.priceOfferWorklist) && plan.priceOfferWorklist.length > 0,
    'max-coverage-plan.json: price offer worklist missing',
  );
  const priceOfferSourceIds = new Set((plan?.priceOfferWorklist ?? []).map((source) => source.sourceId));
  for (const sourceId of ['plaza-premium', 'airport-dimensions', 'primeclass']) {
    issue(priceOfferSourceIds.has(sourceId), `max-coverage-plan.json: ${sourceId} price work missing`);
  }
  for (const [index, source] of (plan?.priceOfferWorklist ?? []).entries()) {
    const prefix = `max-coverage-plan.json.priceOfferWorklist[${index}]`;
    issue(Boolean(source.sourceId), `${prefix}: sourceId missing`);
    issue(Boolean(source.publisher), `${prefix}: publisher missing`);
    issue(Number.isFinite(Number(source.missingPrice)), `${prefix}: missing price count missing`);
    issue(Boolean(source.evidenceTarget), `${prefix}: evidence target missing`);
    issue(Boolean(source.acceptance) && source.acceptance.includes('amount, currency'), `${prefix}: price acceptance missing`);
  }
  issue(
    Array.isArray(plan?.sourceFamilyBacklog) && plan.sourceFamilyBacklog.length === goal?.sourceFamilies?.length,
    'max-coverage-plan.json: source family backlog mismatch',
  );
  issue(
    plan?.d1EvidenceContract?.databaseName === goal?.cloudflareDatabase?.databaseName,
    'max-coverage-plan.json: D1 database contract mismatch',
  );
  issue(
    plan?.d1EvidenceContract?.binding === goal?.cloudflareDatabase?.binding,
    'max-coverage-plan.json: D1 binding contract mismatch',
  );
  issue(
    Array.isArray(plan?.d1EvidenceContract?.proofTables) &&
      plan.d1EvidenceContract.proofTables.includes('record_field_evidence') &&
      plan.d1EvidenceContract.proofTables.includes('coverage_validation_runs'),
    'max-coverage-plan.json: D1 proof tables missing',
  );
  issue(
    plan?.d1EvidenceContract?.rawSnapshotPolicy?.includes('raw HTML/JSON bodies stay out of git'),
    'max-coverage-plan.json: raw snapshot policy missing',
  );
  issue(
    Array.isArray(plan?.terminalBurndown) && plan.terminalBurndown.length === 4,
    'max-coverage-plan.json: terminal burndown missing',
  );
  const burndownById = new Map((plan?.terminalBurndown ?? []).map((batch) => [batch.id, batch]));
  issue(
    burndownById.get('close-approved-record-gap')?.remaining === gap?.deltas?.approvedRecordsRemaining,
    'max-coverage-plan.json: approved record burndown mismatch',
  );
  issue(
    burndownById.get('raise-hours-coverage')?.remaining === gap?.deltas?.hoursCoverageRecordsRemaining,
    'max-coverage-plan.json: hours burndown mismatch',
  );
  issue(
    burndownById.get('raise-gate-coverage')?.remaining === gap?.deltas?.gateCoverageRecordsRemaining,
    'max-coverage-plan.json: gate burndown mismatch',
  );
  issue(
    burndownById.get('raise-price-coverage')?.remaining === gap?.deltas?.priceCoverageRecordsRemaining,
    'max-coverage-plan.json: price burndown mismatch',
  );
  for (const [index, batch] of (plan?.terminalBurndown ?? []).entries()) {
    const prefix = `max-coverage-plan.json.terminalBurndown[${index}]`;
    issue(Boolean(batch.gapMetric), `${prefix}: gap metric missing`);
    issue(Number.isFinite(Number(batch.remaining)), `${prefix}: remaining gap missing`);
    issue(Boolean(batch.target), `${prefix}: target missing`);
    issue(Array.isArray(batch.firstBatch) && batch.firstBatch.length > 0, `${prefix}: first batch missing`);
    issue(Boolean(batch.acceptance), `${prefix}: acceptance missing`);
  }
  const operatorPriceSlice = (plan?.currentWorkOrder?.slices ?? []).find((slice) => slice.id === 'operator-price-offers');
  issue(
    Array.isArray(operatorPriceSlice?.scope) &&
      operatorPriceSlice.scope[0] === plan?.priceOfferWorklist?.[0]?.sourceId,
    'max-coverage-plan.json: operator price slice does not use price worklist',
  );
  issue(
    plan?.validation?.terminal === goal?.validation?.terminalCommand,
    'max-coverage-plan.json: terminal command mismatch',
  );
  issue(
    plan?.validation?.d1SmokeQueries?.fieldCoverage === goal?.validation?.d1SmokeQueries?.fieldCoverage,
    'max-coverage-plan.json: D1 field coverage smoke mismatch',
  );
  issue(
    plan?.validation?.d1SmokeQueries?.openReviewQueue === goal?.validation?.d1SmokeQueries?.openReviewQueue,
    'max-coverage-plan.json: D1 review smoke mismatch',
  );
  issue(
    plan?.validation?.d1SmokeQueries?.provenance === goal?.validation?.d1SmokeQueries?.provenance,
    'max-coverage-plan.json: D1 provenance smoke mismatch',
  );
  issue(
    plan?.reviewQueueSla?.staleOpenHighConfidenceDays === goal?.reviewQueue?.staleOpenHighConfidenceDays,
    'max-coverage-plan.json: review SLA mismatch',
  );
  issue(
    plan?.reviewQueueSla?.maxStaleOpenReviewRecords === goal?.terminalGoal?.maxStaleOpenReviewRecords,
    'max-coverage-plan.json: stale review target mismatch',
  );

  const firstAirport = plan?.airportEnrichmentBacklog?.[0];
  const lastAirport = plan?.airportEnrichmentBacklog?.at(-1);
  issue(/^[A-Z0-9]{3}$/.test(firstAirport?.airportCode ?? ''), 'max-coverage-plan.json: first airport code invalid');
  issue(
    Number(firstAirport?.missingFieldScore ?? 0) >= Number(lastAirport?.missingFieldScore ?? 0),
    'max-coverage-plan.json: airport backlog not sorted by missing field score',
  );
  issue(
    firstAirport?.nextEvidenceRule?.includes('field evidence'),
    'max-coverage-plan.json: airport evidence rule missing',
  );
  issue(
    plan?.guardrails?.includes('No licensed commercial global lounge feeds.'),
    'max-coverage-plan.json: commercial-feed guardrail missing',
  );
  issue(
    plan?.guardrails?.includes('Airport pages enrich matched records before creating new physical lounges.'),
    'max-coverage-plan.json: enrichment-before-create guardrail missing',
  );
}

function validateSourceIntake(report) {
  issue(report?.policy?.execution?.requiredRuntime === 'playwright', 'source-intake-report.json: required runtime mismatch');
  issue(report?.policy?.execution?.localScrawl === 'playwright_only', 'source-intake-report.json: local scrawl mode mismatch');
  issue(report?.policy?.rawSnapshotsCommitted === false, 'source-intake-report.json: raw snapshots should not be committed');
  issue(Array.isArray(report?.sources) && report.sources.length >= 30, 'source-intake-report.json: sources incomplete');

  for (const [index, source] of (report?.sources ?? []).entries()) {
    const prefix = `source-intake-report.json.sources[${index}]`;
    issue(Boolean(source.sourceId), `${prefix}: sourceId missing`);
    issue(/^https:\/\//.test(source.url ?? ''), `${prefix}: url must be https`);
    issue(Array.isArray(source.airportCodes), `${prefix}: airportCodes missing`);
    issue(Array.isArray(source.loungeLinks), `${prefix}: loungeLinks missing`);
    issue(!Object.hasOwn(source, 'html') && !Object.hasOwn(source, 'text'), `${prefix}: raw page content leaked`);
    if (source.snapshotFile) {
      issue(source.snapshotFile.startsWith('.cache/source-snapshots/'), `${prefix}: snapshot path should be repo-relative cache`);
    }
  }
}

function validateCloudflareSourceRunEvidence(evidence, intakePlan) {
  issue(evidence?.policy?.source === 'cloudflare-d1-source_runs', 'cloudflare-source-run-evidence.json: source mismatch');
  issue(evidence?.policy?.database === 'lounge-guru-catalog', 'cloudflare-source-run-evidence.json: database mismatch');
  issue(evidence?.policy?.binding === 'LOUNGE_GURU_DB', 'cloudflare-source-run-evidence.json: binding mismatch');
  issue(evidence?.policy?.localScrawl === 'blocked', 'cloudflare-source-run-evidence.json: local scrawl not blocked');
  issue(evidence?.policy?.rawSnapshotsCommitted === false, 'cloudflare-source-run-evidence.json: raw snapshots should not be committed');
  issue(
    evidence?.policy?.rawPageContentCommitted === false,
    'cloudflare-source-run-evidence.json: raw page content should not be committed',
  );
  issue(Array.isArray(evidence?.sources), 'cloudflare-source-run-evidence.json: sources missing');
  issue(Array.isArray(evidence?.readyTaskEvidence), 'cloudflare-source-run-evidence.json: ready task evidence missing');
  issue(
    Array.isArray(evidence?.readyMemberGapEvidence),
    'cloudflare-source-run-evidence.json: ready member gap evidence missing',
  );
  issue(
    evidence?.stats?.uniqueSources === evidence?.sources?.length,
    'cloudflare-source-run-evidence.json: unique source count mismatch',
  );

  if (intakePlan?.policy?.requiredRuntime === 'playwright') {
    return;
  }

  const readyTasks = (intakePlan?.tasks ?? []).filter((task) => task.status === 'ready').map((task) => task.sourceId);
  const evidenceTasks = new Set((evidence?.readyTaskEvidence ?? []).map((task) => task.sourceId));
  for (const sourceId of readyTasks) {
    issue(evidenceTasks.has(sourceId), `cloudflare-source-run-evidence.json: ready task ${sourceId} missing`);
  }

  const readyMemberGaps = (intakePlan?.memberGaps ?? []).filter((gap) => gap.status === 'ready');
  issue(
    evidence?.stats?.readyMemberGaps === readyMemberGaps.length,
    'cloudflare-source-run-evidence.json: ready member gap count mismatch',
  );
  const memberGapKeys = new Set(
    (evidence?.readyMemberGapEvidence ?? []).map((gap) => `${gap.familyId}:${gap.sourceId}`),
  );
  for (const gap of readyMemberGaps) {
    issue(
      memberGapKeys.has(`${gap.familyId}:${gap.sourceId}`),
      `cloudflare-source-run-evidence.json: ready member gap ${gap.sourceId} missing`,
    );
  }

  for (const [index, source] of (evidence?.sources ?? []).entries()) {
    const prefix = `cloudflare-source-run-evidence.json.sources[${index}]`;
    issue(Boolean(source.sourceId), `${prefix}: sourceId missing`);
    issue(/^https:\/\//.test(source.url ?? ''), `${prefix}: url must be https`);
    issue(Boolean(source.runId), `${prefix}: runId missing`);
    assertIsoDate(source.generatedAt, `${prefix}: generatedAt invalid`);
    issue(source.cloudflareSnapshot === true, `${prefix}: Cloudflare snapshot missing`);
    issue(!Object.hasOwn(source, 'html') && !Object.hasOwn(source, 'text'), `${prefix}: raw page content leaked`);
    for (const [attemptIndex, attempt] of (source.fetchAttempts ?? []).entries()) {
      const attemptPrefix = `${prefix}.fetchAttempts[${attemptIndex}]`;
      issue(!Object.hasOwn(attempt, 'html') && !Object.hasOwn(attempt, 'text'), `${attemptPrefix}: raw page content leaked`);
      if (attempt.url) {
        issue(/^https:\/\//.test(attempt.url), `${attemptPrefix}: url must be https`);
      }
    }
  }
}

function validateNonPriorityValidationReport(report, candidates) {
  issue(report?.policy?.lineReviewRule?.includes('reviewAction'), 'non-priority-validation-report.json: line review rule missing');
  issue(
    report?.stats?.total === report?.rows?.length,
    'non-priority-validation-report.json: stats.total row mismatch',
  );
  issue(
    report?.stats?.total === candidates?.length,
    'non-priority-validation-report.json: candidate count mismatch',
  );
  issue(
    typeof report?.stats?.byReviewQueue?.publishable === 'number',
    'non-priority-validation-report.json: publishable queue missing',
  );
  issue(report?.stats?.byConflict && typeof report.stats.byConflict === 'object', 'non-priority-validation-report.json: conflict summary missing');
  issue(
    Array.isArray(report?.stats?.bySourceDecision) && report.stats.bySourceDecision.length > 0,
    'non-priority-validation-report.json: source decision summary missing',
  );

  const candidateIds = new Set((candidates ?? []).map((candidate) => candidate?.lounge?.id));
  for (const [index, row] of (report?.rows ?? []).entries()) {
    const prefix = `non-priority-validation-report.json.rows[${index}]`;
    issue(candidateIds.has(row.recordId), `${prefix}: recordId not present in candidates`);
    issue(Boolean(row.sourceId), `${prefix}: sourceId missing`);
    issue(Boolean(row.publisher), `${prefix}: publisher missing`);
    issue(Boolean(row.name), `${prefix}: name missing`);
    issue(/^[A-Z0-9]{3}$/.test(row.airportCode ?? ''), `${prefix}: airportCode invalid`);
    issue(Boolean(row.airportName), `${prefix}: airportName missing`);
    issue(Boolean(row.city), `${prefix}: city missing`);
    issue(Object.hasOwn(row, 'country'), `${prefix}: country field missing`);
    issue(/^https:\/\//.test(row.sourceUrl ?? ''), `${prefix}: sourceUrl must be https`);
    issue(['approved', 'review'].includes(row.reviewStatus), `${prefix}: reviewStatus invalid`);
    issue(typeof row.confidence === 'number', `${prefix}: confidence missing`);
    issue(Array.isArray(row.conflicts), `${prefix}: conflicts missing`);
    issue(Boolean(row.checks) && typeof row.checks === 'object', `${prefix}: checks missing`);
    issue(['publish', 'manual_review'].includes(row.reviewAction?.action), `${prefix}: reviewAction invalid`);
    issue(Boolean(row.reviewAction?.queue), `${prefix}: reviewAction.queue missing`);
    issue(Boolean(row.reviewAction?.reason), `${prefix}: reviewAction.reason missing`);
  }
}

function validateArrays() {
  const brandRegistry = readJson('public/data/brand-registry.json');
  const sourceRegistry = readJson('public/data/source-registry.json');
  const candidates = readJson('public/data/non-priority-lounge-candidates.json');
  issue(Array.isArray(brandRegistry) && brandRegistry.length > 0, 'brand-registry.json: expected non-empty array');
  issue(Array.isArray(sourceRegistry) && sourceRegistry.length >= 30, 'source-registry.json: expected registered source list');
  for (const [index, source] of (sourceRegistry ?? []).entries()) {
    if (source.fetchUrls) {
      issue(Array.isArray(source.fetchUrls), `source-registry.json[${index}].fetchUrls: expected array`);
      for (const [urlIndex, url] of source.fetchUrls.entries()) {
        issue(/^https:\/\//.test(url), `source-registry.json[${index}].fetchUrls[${urlIndex}]: url must be https`);
      }
    }
  }
  issue(Array.isArray(candidates) && candidates.length > 0, 'non-priority-lounge-candidates.json: expected candidates');
}

for (const fileName of fs.readdirSync(dataDir)) {
  const relativePath = `public/data/${fileName}`;
  const fullPath = path.resolve(dataDir, fileName);
  if (fileName.endsWith('.json') || fileName.endsWith('.geojson')) {
    const parsed = readJson(relativePath);
    noAbsoluteLocalPath(parsed, relativePath);
  } else if (fileName === 'brand-logos' && fs.statSync(fullPath).isDirectory()) {
    const logoFiles = fs.readdirSync(fullPath);
    issue(logoFiles.length > 0, `${relativePath}: expected logo files`);
    for (const logoFile of logoFiles) {
      issue(/\.(svg|png)$/.test(logoFile), `${relativePath}/${logoFile}: expected SVG or PNG logo`);
    }
  } else {
    issue(fs.statSync(fullPath).isFile(), `${relativePath}: unexpected public data entry`);
  }
}

const catalog = readJson('public/data/lounge-guru-catalog.json');
const geoJson = readJson('public/data/lounges.geojson');
const goal = readJson('public/data/worldwide-coverage-goal.json');
const gap = readJson('public/data/coverage-gap-report.json');
const maxCoveragePlan = readJson('public/data/max-coverage-plan.json');
const intakePlan = readJson('public/data/cloudflare-source-intake-plan.json');
const sourceIntake = readJson('public/data/source-intake-report.json');
const cloudflareEvidence = readJson('public/data/cloudflare-source-run-evidence.json');
const nonPriorityValidation = readJson('public/data/non-priority-validation-report.json');
const nonPriorityCandidates = readJson('public/data/non-priority-lounge-candidates.json');

validateCatalog(catalog);
validateGeoJson(geoJson);
validateCoverage(goal, gap);
validateMaxCoveragePlan(maxCoveragePlan, goal, gap);
validateIntakePlan(intakePlan, gap);
validateSourceIntake(sourceIntake);
validateCloudflareSourceRunEvidence(cloudflareEvidence, intakePlan);
validateNonPriorityValidationReport(nonPriorityValidation, nonPriorityCandidates);
validateArrays();

if (issues.length > 0) {
  console.error(`public-json-check: failed with ${issues.length} issue(s)`);
  for (const message of issues.slice(0, 80)) {
    console.error(`- ${message}`);
  }
  if (issues.length > 80) {
    console.error(`- ${issues.length - 80} more issue(s) omitted`);
  }
  process.exit(1);
}

console.log(`public-json-check: validated ${fs.readdirSync(dataDir).length} public data files.`);
