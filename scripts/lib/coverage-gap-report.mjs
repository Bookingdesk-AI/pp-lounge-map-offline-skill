import crypto from 'node:crypto';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sourceRecordCounts(catalog) {
  const counts = new Map();
  for (const record of catalog.records ?? []) {
    for (const source of record.sources ?? []) {
      counts.set(source.sourceId, (counts.get(source.sourceId) ?? 0) + 1);
    }
  }
  return counts;
}

function sourceStatuses(sourceRegistry, counts) {
  const byId = new Map(sourceRegistry.map((source) => [source.id, source]));
  return (sourceId) => {
    const source = byId.get(sourceId);
    return {
      sourceId,
      registered: Boolean(source),
      status: source?.status ?? 'missing',
      adapter: source?.adapter ?? 'missing',
      records: counts.get(sourceId) ?? 0,
      rightsNote: source?.rightsNote ?? '',
    };
  };
}

function validateRequiredTables(goal, migrationSql) {
  return goal.cloudflareDatabase.requiredTables.map((table) => ({
    table,
    present: new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`, 'i').test(migrationSql),
  }));
}

function sourceIntakeRuntime(sourceIntakeReport) {
  return sourceIntakeReport?.policy?.execution?.runtime ?? 'missing';
}

function requiredSourceRuntime(goal) {
  if (goal.terminalGoal.requiresPlaywrightSourceRuntime) {
    return 'playwright';
  }

  if (goal.terminalGoal.requiresCloudflareSourceRuntime) {
    return 'cloudflare';
  }

  return null;
}

function cloudflareSourceEvidence(sourceRunEvidence) {
  const stats = sourceRunEvidence?.stats ?? {};
  const readyTasks = Number(stats.readyTasks ?? 0);
  const readyTasksWithCloudflareEvidence = Number(stats.readyTasksWithCloudflareEvidence ?? 0);
  const readyMemberGaps = Number(stats.readyMemberGaps ?? 0);
  const readyMemberGapsWithCloudflareEvidence = Number(stats.readyMemberGapsWithCloudflareEvidence ?? 0);

  return {
    sourceRunsRead: Number(stats.sourceRunsRead ?? 0),
    cloudflareSourceRuns: Number(stats.cloudflareSourceRuns ?? 0),
    uniqueSources: Number(stats.uniqueSources ?? 0),
    fetched: Number(stats.fetched ?? 0),
    cloudflareSnapshots: Number(stats.cloudflareSnapshots ?? 0),
    readyTasks,
    readyTasksWithCloudflareEvidence,
    readyTaskCoverageRatio: readyTasks > 0 ? Number((readyTasksWithCloudflareEvidence / readyTasks).toFixed(4)) : 0,
    readyMemberGaps,
    readyMemberGapsWithCloudflareEvidence,
    readyMemberGapCoverageRatio:
      readyMemberGaps > 0 ? Number((readyMemberGapsWithCloudflareEvidence / readyMemberGaps).toFixed(4)) : 0,
    fullSourceIntakeReportRequired: Boolean(sourceRunEvidence?.terminalImpact?.coverageGateStillRequiresFullCloudflareReport),
  };
}

function requiredReadyMemberGapCoverageRatio(goal) {
  const value = Number(goal?.terminalGoal?.minReadyMemberGapCoverageRatio ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function intakeSourceRunById(sourceIntakeReport) {
  return new Map((sourceIntakeReport?.sources ?? []).map((source) => [source.sourceId, source]));
}

function isAccessBlockedRun(runSource) {
  if (runSource?.status !== 'http_error') {
    return false;
  }

  const attempts = runSource.fetchAttempts ?? [];
  if (attempts.length === 0) {
    return false;
  }

  const blockStatuses = new Set([401, 403, 429, 520, 521, 522, 523, 524]);
  return attempts.every((attempt) => attempt.status === 'http_error' && blockStatuses.has(Number(attempt.httpStatus)));
}

function createNextCloudflareIntake({
  sourceFamilies,
  sourceIntakeReport,
  cloudflareSourceIntakeReport,
  cloudflareEvidence,
  sourceRuntime,
}) {
  const runs = intakeSourceRunById(sourceIntakeReport);
  const cloudflareRuns = intakeSourceRunById(cloudflareSourceIntakeReport);
  const missingMembers = sourceFamilies.flatMap((family) =>
    family.members
      .filter((member) => member.records === 0)
      .map((member) => {
        const run = runs.get(member.sourceId);
        const cloudflareRun = cloudflareRuns.get(member.sourceId);
        const evidenceRun = cloudflareRun ?? run;
        return {
          ...member,
          familyId: family.id,
          runStatus: run?.status ?? cloudflareRun?.status ?? 'not_run',
          accessBlocked: isAccessBlockedRun(evidenceRun),
        };
      }),
  );
  const credentialSourceIds = missingMembers
    .filter((member) => member.adapter === 'licensed_api')
    .map((member) => member.sourceId);
  const rightsReviewSourceIds = missingMembers
    .filter((member) => member.runStatus === 'skipped' && member.adapter !== 'licensed_api')
    .map((member) => member.sourceId);
  const readySourceIds = missingMembers
    .filter((member) => member.adapter !== 'licensed_api' && member.runStatus !== 'skipped')
    .map((member) => member.sourceId);
  const accessBlockedSourceIds = missingMembers.filter((member) => member.accessBlocked).map((member) => member.sourceId);
  const uniqueReadySourceIds = [...new Set(readySourceIds)];
  const sourceIdArg = uniqueReadySourceIds.join(',');

  return {
    requiredTokenEnv: 'LOUNGE_GURU_SOURCE_INTAKE_RUNTIME',
    localScrawl: 'playwright_only',
    missingRuntime: sourceRuntime !== 'playwright',
    fullReportRequired: cloudflareEvidence.fullSourceIntakeReportRequired,
    readySourceIds: uniqueReadySourceIds,
    accessBlockedSourceIds: [...new Set(accessBlockedSourceIds)],
    credentialSourceIds: [...new Set(credentialSourceIds)],
    rightsReviewSourceIds: [...new Set(rightsReviewSourceIds)],
    commands: {
      probe: sourceIdArg
        ? `LOUNGE_GURU_SOURCE_INTAKE_RUNTIME=playwright SOURCE_SOURCE_IDS=${sourceIdArg} npm run scrape:sources`
        : 'LOUNGE_GURU_SOURCE_INTAKE_RUNTIME=playwright npm run scrape:sources',
      evidence: 'npm run intake:evidence',
      report: 'public/data/source-intake-report.json',
      promote: 'npm run build:canonical-data',
      rebuild: 'npm run build:canonical-data',
      pushD1: 'npm run db:catalog:push',
      validate: 'npm run validate:coverage',
    },
  };
}

function hasRequiredSourceRuntime(goal, sourceIntakeReport, sourceRunEvidence = null) {
  const requiredRuntime = requiredSourceRuntime(goal);

  if (!requiredRuntime) {
    return true;
  }

  if (sourceIntakeRuntime(sourceIntakeReport) !== requiredRuntime) {
    return false;
  }

  if (requiredRuntime === 'playwright') {
    return sourceIntakeReport?.policy?.rawSnapshotsCommitted === false &&
      sourceIntakeReport?.policy?.execution?.localScrawl === 'playwright_only';
  }

  if (!sourceRunEvidence) {
    return false;
  }

  return sourceRunEvidence?.terminalImpact?.coverageGateStillRequiresFullCloudflareReport !== true;
}

export function createCoverageGapReport({
  goal,
  catalog,
  sourceRegistry,
  migrationSql,
  sourceIntakeReport = null,
  cloudflareSourceIntakeReport = null,
  sourceRunEvidence = null,
}) {
  const records = catalog.records ?? [];
  const counts = sourceRecordCounts(catalog);
  const sourceStatus = sourceStatuses(sourceRegistry, counts);
  const approvedRecords = records.filter((record) => record.quality?.reviewStatus === 'approved').length;
  const reviewRecords = records.length - approvedRecords;
  const approvedRatio = records.length > 0 ? approvedRecords / records.length : 0;
  const recordsWithoutSources = records.filter((record) => !Array.isArray(record.sources) || record.sources.length === 0).length;
  const recordsWithoutQuality = records.filter((record) => !record.quality).length;
  const unknownAirportRecords = records.filter((record) => {
    const airport = record.airport ?? {};
    return !airport.iata || !airport.name || !Number.isFinite(Number(airport.coordinates?.lat)) || !Number.isFinite(Number(airport.coordinates?.lon));
  }).length;
  const tableStatuses = validateRequiredTables(goal, migrationSql);
  const sourceRuntime = sourceIntakeRuntime(sourceIntakeReport);
  const cloudflareEvidence = cloudflareSourceEvidence(sourceRunEvidence);
  const minReadyMemberGapCoverageRatio = requiredReadyMemberGapCoverageRatio(goal);
  const cloudflareSourceRuntimePassed = hasRequiredSourceRuntime(goal, sourceIntakeReport, sourceRunEvidence);
  const runtimeRequired = requiredSourceRuntime(goal);
  const requiredFamilies = goal.sourceFamilies.filter((family) => family.requiredForTerminal);
  const sourceFamilies = requiredFamilies.map((family) => {
    const members = family.members ?? [family.id];
    const memberStatuses = members.map(sourceStatus);
    const presentMembers = memberStatuses.filter((member) => member.records > 0).map((member) => member.sourceId);
    return {
      id: family.id,
      label: family.label,
      mode: family.mode,
      acquisition: family.acquisition,
      present: presentMembers.length > 0,
      presentMembers,
      missingMembers: memberStatuses.filter((member) => member.records === 0).map((member) => member.sourceId),
      members: memberStatuses,
    };
  });
  const approvedRecordRemaining = Math.max(0, goal.terminalGoal.minApprovedRecords - approvedRecords);
  const targetApprovedForCurrentCatalog = Math.ceil(records.length * goal.terminalGoal.minApprovedRatio);
  const approvalRatioRemaining = Math.max(0, targetApprovedForCurrentCatalog - approvedRecords);
  const nextCloudflareIntake = createNextCloudflareIntake({
    sourceFamilies,
    sourceIntakeReport,
    cloudflareSourceIntakeReport,
    cloudflareEvidence,
    sourceRuntime,
  });
  const blockers = [];

  if (approvedRecordRemaining > 0) {
    blockers.push('approved_records_below_target');
  }
  if (approvalRatioRemaining > 0) {
    blockers.push('approved_ratio_below_target');
  }
  if (sourceFamilies.some((family) => !family.present)) {
    blockers.push('source_family_gaps_present');
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
  if (tableStatuses.some((table) => !table.present)) {
    blockers.push('cloudflare_d1_schema_missing_tables');
  }
  if (!cloudflareSourceRuntimePassed) {
    blockers.push(runtimeRequired === 'playwright' ? 'source_intake_runtime_not_playwright' : 'source_intake_runtime_not_cloudflare');
  }
  if (
    cloudflareEvidence.readyMemberGaps > 0 &&
    cloudflareEvidence.readyMemberGapCoverageRatio < minReadyMemberGapCoverageRatio
  ) {
    blockers.push('cloudflare_source_proof_incomplete');
  }

  return {
    generatedAt: catalog.generatedAt,
    goalId: goal.id,
    goalVersion: goal.version,
    catalogHash: sha256(JSON.stringify(catalog)),
    terminalPassed: blockers.length === 0,
    blockers,
    targets: {
      minApprovedRecords: goal.terminalGoal.minApprovedRecords,
      minApprovedRatio: goal.terminalGoal.minApprovedRatio,
      minSourceFamilyCoverageRatio: goal.terminalGoal.minSourceFamilyCoverageRatio,
      minReadyMemberGapCoverageRatio,
      maxReviewRecords: goal.terminalGoal.maxReviewRecords,
      maxUnknownAirportRecords: goal.terminalGoal.maxUnknownAirportRecords,
    },
    current: {
      totalRecords: records.length,
      approvedRecords,
      reviewRecords,
      approvedRatio: Number(approvedRatio.toFixed(4)),
      sourceFamilyCoverageRatio: Number(
        (sourceFamilies.filter((family) => family.present).length / sourceFamilies.length).toFixed(4),
      ),
      unknownAirportRecords,
      recordsWithoutSources,
      recordsWithoutQuality,
      sourceIntakeRuntime: sourceRuntime,
      cloudflareSourceRuntimePassed,
      cloudflareSourceEvidence: cloudflareEvidence,
    },
    deltas: {
      approvedRecordsRemaining: approvedRecordRemaining,
      approvalsNeededForCurrentCatalogRatio: approvalRatioRemaining,
      reviewRecordsToResolve: Math.max(0, reviewRecords - goal.terminalGoal.maxReviewRecords),
      missingSourceFamilies: sourceFamilies.filter((family) => !family.present).map((family) => family.id),
      sourceIntakeRuntimeRequired: runtimeRequired,
    },
    nextCloudflareIntake,
    sourceFamilies,
    tableStatuses,
  };
}
