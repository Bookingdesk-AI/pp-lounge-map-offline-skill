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

function hasText(value) {
  return String(value ?? '').trim() !== '';
}

function hasExplicitPriceOffer(record) {
  return (record.accessOffers ?? []).some((offer) => Number.isFinite(Number(offer.amount)) && hasText(offer.currency));
}

function hasSourceFieldCoverage(record, field) {
  return (record.sources ?? []).some((source) => (source.fieldCoverage ?? []).includes(field));
}

function hasSourceForAccessOffer(record, offer) {
  const offerSourceId = String(offer?.sourceId ?? '').trim();
  const offerUrl = String(offer?.url ?? '').trim();
  return (record.sources ?? []).some((source) => {
    if (source.sourceId !== offerSourceId || !(source.fieldCoverage ?? []).includes('access.accessOffers')) {
      return false;
    }
    const sourceUrl = String(source.url ?? '').trim();
    return !offerUrl || !sourceUrl || sourceUrl === offerUrl;
  });
}

function hasProvenAccessOffer(record) {
  return (record.accessOffers ?? []).some(
    (offer) => Number.isFinite(Number(offer.amount)) && hasText(offer.currency) && hasSourceForAccessOffer(record, offer),
  );
}

function fieldCoverageStats(records) {
  const totals = records.reduce(
    (stats, record) => {
      const hasHours = hasText(record.operations?.hours);
      const hasGate = hasText(record.location?.gate);
      const hasPrice = hasExplicitPriceOffer(record);
      const hasProvenHours = hasHours && hasSourceFieldCoverage(record, 'operations.hours');
      const hasProvenGate = hasGate && hasSourceFieldCoverage(record, 'location.gate');
      const hasProvenPrice = hasPrice && hasProvenAccessOffer(record);
      stats.hours += hasProvenHours ? 1 : 0;
      stats.gates += hasProvenGate ? 1 : 0;
      stats.prices += hasProvenPrice ? 1 : 0;
      stats.recordsWithoutFieldEvidence +=
        (!hasHours || hasProvenHours) && (!hasGate || hasProvenGate) && (!hasPrice || hasProvenPrice)
        ? 0
        : 1;
      return stats;
    },
    { hours: 0, gates: 0, prices: 0, recordsWithoutFieldEvidence: 0 },
  );
  const total = records.length;

  return {
    total,
    ...totals,
    hoursRatio: total > 0 ? Number((totals.hours / total).toFixed(4)) : 0,
    gateRatio: total > 0 ? Number((totals.gates / total).toFixed(4)) : 0,
    priceRatio: total > 0 ? Number((totals.prices / total).toFixed(4)) : 0,
  };
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

function missingSourceProofLanes(sourceRunEvidence) {
  return (sourceRunEvidence?.readyMemberGapEvidence ?? [])
    .filter((lane) => !lane.cloudflareSnapshot)
    .map((lane) => ({
      sourceId: lane.sourceId,
      familyId: lane.familyId,
      status: lane.status ?? 'missing',
      terminalFamilyBlocked: Boolean(lane.terminalFamilyBlocked),
    }));
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
  missingSourceProof,
  missingSourceProofIds,
}) {
  const runs = intakeSourceRunById(sourceIntakeReport);
  const cloudflareRuns = intakeSourceRunById(cloudflareSourceIntakeReport);
  const missingProofByLane = new Map(
    (missingSourceProof ?? []).map((lane) => [`${lane.familyId}:${lane.sourceId}`, lane]),
  );
  const missingMembers = sourceFamilies.flatMap((family) =>
    family.members
      .filter((member) => member.records === 0)
      .map((member) => {
        const run = runs.get(member.sourceId);
        const cloudflareRun = cloudflareRuns.get(member.sourceId);
        const proofLane = missingProofByLane.get(`${family.id}:${member.sourceId}`);
        const evidenceRun = cloudflareRun ?? run;
        return {
          ...member,
          familyId: family.id,
          runStatus: proofLane?.status ?? run?.status ?? cloudflareRun?.status ?? 'not_run',
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
  const nonRepairableSourceIds = new Set([...credentialSourceIds, ...rightsReviewSourceIds]);
  const missingProofSourceIdArg = [
    ...new Set((missingSourceProofIds ?? []).filter((sourceId) => !nonRepairableSourceIds.has(sourceId))),
  ].join(',');
  const cloudflareCommand = sourceIdArg
    ? `LOUNGE_GURU_INTAKE_TOKEN=<redacted> LOUNGE_GURU_INTAKE_TIMEOUT_MS=240000 npm run intake:cloudflare -- --source-ids=${sourceIdArg}`
    : 'LOUNGE_GURU_INTAKE_TOKEN=<redacted> LOUNGE_GURU_INTAKE_TIMEOUT_MS=240000 npm run intake:cloudflare';
  const proofRepairCommand = missingProofSourceIdArg
    ? `LOUNGE_GURU_INTAKE_TOKEN=<redacted> LOUNGE_GURU_INTAKE_TIMEOUT_MS=240000 npm run intake:cloudflare -- --source-ids=${missingProofSourceIdArg}`
    : cloudflareCommand;

  return {
    requiredTokenEnv: 'LOUNGE_GURU_INTAKE_TOKEN',
    localScrawl: 'playwright_only',
    missingRuntime: sourceRuntime !== 'playwright',
    fullReportRequired: cloudflareEvidence.fullSourceIntakeReportRequired,
    readySourceIds: uniqueReadySourceIds,
    accessBlockedSourceIds: [...new Set(accessBlockedSourceIds)],
    credentialSourceIds: [...new Set(credentialSourceIds)],
    rightsReviewSourceIds: [...new Set(rightsReviewSourceIds)],
    missingSourceProofIds: [...new Set(missingSourceProofIds ?? [])],
    commands: {
      probe: cloudflareCommand,
      proofRepair: proofRepairCommand,
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
  const nonPriorityRecords = Number(catalog.stats?.nonPriorityRecords ?? 0);
  const approvedRatio = records.length > 0 ? approvedRecords / records.length : 0;
  const fieldCoverage = fieldCoverageStats(records);
  const recordsWithoutSources = records.filter((record) => !Array.isArray(record.sources) || record.sources.length === 0).length;
  const recordsWithoutQuality = records.filter((record) => !record.quality).length;
  const unknownAirportRecords = records.filter((record) => {
    const airport = record.airport ?? {};
    return !airport.iata || !airport.name || !Number.isFinite(Number(airport.coordinates?.lat)) || !Number.isFinite(Number(airport.coordinates?.lon));
  }).length;
  const tableStatuses = validateRequiredTables(goal, migrationSql);
  const sourceRuntime = sourceIntakeRuntime(sourceIntakeReport);
  const cloudflareEvidence = cloudflareSourceEvidence(sourceRunEvidence);
  const missingSourceProof = missingSourceProofLanes(sourceRunEvidence);
  const missingSourceProofIds = missingSourceProof.map((lane) => lane.sourceId);
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
  const nonPriorityRecordRemaining = Math.max(0, (goal.terminalGoal.minNonPriorityRecords ?? 0) - nonPriorityRecords);
  const hoursCoverageRemaining = Math.max(0, Math.ceil(records.length * (goal.terminalGoal.minHoursCoverageRatio ?? 0)) - fieldCoverage.hours);
  const gateCoverageRemaining = Math.max(0, Math.ceil(records.length * (goal.terminalGoal.minGateCoverageRatio ?? 0)) - fieldCoverage.gates);
  const priceCoverageRemaining = Math.max(0, Math.ceil(records.length * (goal.terminalGoal.minPriceCoverageRatio ?? 0)) - fieldCoverage.prices);
  const targetApprovedForCurrentCatalog = Math.ceil(records.length * goal.terminalGoal.minApprovedRatio);
  const approvalRatioRemaining = Math.max(0, targetApprovedForCurrentCatalog - approvedRecords);
  const nextCloudflareIntake = createNextCloudflareIntake({
    sourceFamilies,
    sourceIntakeReport,
    cloudflareSourceIntakeReport,
    cloudflareEvidence,
    sourceRuntime,
    missingSourceProof,
    missingSourceProofIds,
  });
  const blockers = [];

  if (approvedRecordRemaining > 0) {
    blockers.push('approved_records_below_target');
  }
  if (nonPriorityRecordRemaining > 0) {
    blockers.push('non_priority_records_below_target');
  }
  if (approvalRatioRemaining > 0) {
    blockers.push('approved_ratio_below_target');
  }
  if (hoursCoverageRemaining > 0) {
    blockers.push('hours_coverage_below_target');
  }
  if (gateCoverageRemaining > 0) {
    blockers.push('gate_coverage_below_target');
  }
  if (priceCoverageRemaining > 0) {
    blockers.push('price_coverage_below_target');
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
  if (fieldCoverage.recordsWithoutFieldEvidence > (goal.terminalGoal.maxRecordsWithoutFieldEvidence ?? 0)) {
    blockers.push('records_without_field_evidence_present');
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
      minNonPriorityRecords: goal.terminalGoal.minNonPriorityRecords ?? 0,
      minApprovedRatio: goal.terminalGoal.minApprovedRatio,
      minHoursCoverageRatio: goal.terminalGoal.minHoursCoverageRatio ?? 0,
      minGateCoverageRatio: goal.terminalGoal.minGateCoverageRatio ?? 0,
      minPriceCoverageRatio: goal.terminalGoal.minPriceCoverageRatio ?? 0,
      minSourceFamilyCoverageRatio: goal.terminalGoal.minSourceFamilyCoverageRatio,
      minReadyMemberGapCoverageRatio,
      maxReviewRecords: goal.terminalGoal.maxReviewRecords,
      maxUnknownAirportRecords: goal.terminalGoal.maxUnknownAirportRecords,
      maxRecordsWithoutFieldEvidence: goal.terminalGoal.maxRecordsWithoutFieldEvidence ?? 0,
    },
    current: {
      totalRecords: records.length,
      approvedRecords,
      nonPriorityRecords,
      reviewRecords,
      approvedRatio: Number(approvedRatio.toFixed(4)),
      fieldCoverage,
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
      nonPriorityRecordsRemaining: nonPriorityRecordRemaining,
      approvalsNeededForCurrentCatalogRatio: approvalRatioRemaining,
      hoursCoverageRecordsRemaining: hoursCoverageRemaining,
      gateCoverageRecordsRemaining: gateCoverageRemaining,
      priceCoverageRecordsRemaining: priceCoverageRemaining,
      reviewRecordsToResolve: Math.max(0, reviewRecords - goal.terminalGoal.maxReviewRecords),
      recordsWithoutFieldEvidenceToResolve: Math.max(
        0,
        fieldCoverage.recordsWithoutFieldEvidence - (goal.terminalGoal.maxRecordsWithoutFieldEvidence ?? 0),
      ),
      missingSourceFamilies: sourceFamilies.filter((family) => !family.present).map((family) => family.id),
      missingSourceProofIds,
      missingSourceProofLanes: missingSourceProof,
      sourceIntakeRuntimeRequired: runtimeRequired,
    },
    nextCloudflareIntake,
    sourceFamilies,
    tableStatuses,
  };
}
