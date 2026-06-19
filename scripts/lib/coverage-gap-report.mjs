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

function hasRequiredCloudflareSourceRuntime(goal, sourceIntakeReport) {
  if (!goal.terminalGoal.requiresCloudflareSourceRuntime) {
    return true;
  }

  return sourceIntakeRuntime(sourceIntakeReport) === 'cloudflare';
}

export function createCoverageGapReport({ goal, catalog, sourceRegistry, migrationSql, sourceIntakeReport = null }) {
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
  const cloudflareSourceRuntimePassed = hasRequiredCloudflareSourceRuntime(goal, sourceIntakeReport);
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
    blockers.push('source_intake_runtime_not_cloudflare');
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
    },
    deltas: {
      approvedRecordsRemaining: approvedRecordRemaining,
      approvalsNeededForCurrentCatalogRatio: approvalRatioRemaining,
      reviewRecordsToResolve: Math.max(0, reviewRecords - goal.terminalGoal.maxReviewRecords),
      missingSourceFamilies: sourceFamilies.filter((family) => !family.present).map((family) => family.id),
      sourceIntakeRuntimeRequired: goal.terminalGoal.requiresCloudflareSourceRuntime ? 'cloudflare' : null,
    },
    sourceFamilies,
    tableStatuses,
  };
}
