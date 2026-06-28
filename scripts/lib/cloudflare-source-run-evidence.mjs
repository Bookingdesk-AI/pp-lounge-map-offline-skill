function parseJsonField(value, fallback) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function extractRows(d1Result) {
  if (Array.isArray(d1Result?.results)) {
    return d1Result.results;
  }
  if (Array.isArray(d1Result)) {
    return d1Result.flatMap((entry) => entry?.results ?? []);
  }
  return [];
}

function compactAttempt(attempt) {
  return {
    url: attempt.url,
    status: attempt.status,
    httpStatus: attempt.httpStatus ?? null,
    finalUrl: attempt.finalUrl ?? null,
    contentType: attempt.contentType ?? '',
    bytes: Number(attempt.bytes ?? 0),
    sha256: attempt.sha256 ?? null,
    robots: attempt.robots
      ? {
          checked: Boolean(attempt.robots.checked),
          url: attempt.robots.url,
          status: attempt.robots.status ?? null,
          disallowed: Boolean(attempt.robots.disallowed),
          disallowRuleCount: Number(attempt.robots.disallowRuleCount ?? 0),
        }
      : null,
  };
}

function compactSource(source) {
  return {
    sourceId: source.sourceId,
    publisher: source.publisher,
    url: source.url,
    adapter: source.adapter,
    status: source.status,
    records: Number(source.records ?? 0),
    airportCodeCount: Array.isArray(source.airportCodes) ? source.airportCodes.length : 0,
    loungeLinkCount: Array.isArray(source.loungeLinks) ? source.loungeLinks.length : 0,
    cloudflareSnapshot: Boolean(source.cloudflareSnapshot),
    finalUrl: source.finalUrl ?? null,
    httpStatus: source.httpStatus ?? null,
    contentType: source.contentType ?? '',
    bytes: Number(source.bytes ?? 0),
    sha256: source.sha256 ?? null,
    reason: source.reason ?? null,
    fetchAttempts: (source.fetchAttempts ?? []).map(compactAttempt),
  };
}

export function createCloudflareSourceRunEvidence({ d1Result, sourceIntakePlan, generatedAt }) {
  const rows = extractRows(d1Result)
    .map((row) => ({
      id: row.id,
      generatedAt: row.generated_at,
      policy: parseJsonField(row.policy_json, {}),
      stats: parseJsonField(row.stats_json, {}),
      sources: parseJsonField(row.sources_json, []).map(compactSource),
    }))
    .filter((row) => row.id && row.generatedAt);

  const cloudflareRows = rows.filter((row) => row.policy?.execution?.runtime === 'cloudflare');
  const latestBySource = new Map();
  for (const row of cloudflareRows.sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))) {
    for (const source of row.sources) {
      if (!latestBySource.has(source.sourceId)) {
        latestBySource.set(source.sourceId, {
          ...source,
          runId: row.id,
          generatedAt: row.generatedAt,
          fetchMode: row.policy.fetchMode ?? 'unknown',
        });
      }
    }
  }

  const readyTasks = (sourceIntakePlan?.tasks ?? []).filter((task) => task.status === 'ready');
  const readyTaskIds = readyTasks.map((task) => task.sourceId);
  const readyTaskEvidence = readyTaskIds.map((sourceId) => ({
    sourceId,
    present: latestBySource.has(sourceId),
    status: latestBySource.get(sourceId)?.status ?? 'missing',
    cloudflareSnapshot: Boolean(latestBySource.get(sourceId)?.cloudflareSnapshot),
  }));
  const readyMemberGaps = (sourceIntakePlan?.memberGaps ?? []).filter((gap) => gap.status === 'ready');
  const readyMemberGapEvidence = readyMemberGaps.map((gap) => ({
    sourceId: gap.sourceId,
    familyId: gap.familyId,
    terminalFamilyBlocked: Boolean(gap.terminalFamilyBlocked),
    present: latestBySource.has(gap.sourceId),
    status: latestBySource.get(gap.sourceId)?.status ?? 'missing',
    cloudflareSnapshot: Boolean(latestBySource.get(gap.sourceId)?.cloudflareSnapshot),
  }));
  const sources = [...latestBySource.values()].sort((left, right) => left.sourceId.localeCompare(right.sourceId));
  const fetched = sources.filter((source) => source.status === 'fetched').length;
  const cloudflareSnapshots = sources.filter((source) => source.cloudflareSnapshot).length;

  return {
    generatedAt: generatedAt ?? new Date().toISOString(),
    policy: {
      source: 'cloudflare-d1-source_runs',
      database: 'lounge-guru-catalog',
      binding: 'LOUNGE_GURU_DB',
      localScrawl: 'blocked',
      rawSnapshotsCommitted: false,
      rawPageContentCommitted: false,
      guardrail: 'official/public source-run evidence only; no local page fetch',
    },
    stats: {
      sourceRunsRead: rows.length,
      cloudflareSourceRuns: cloudflareRows.length,
      uniqueSources: sources.length,
      fetched,
      cloudflareSnapshots,
      readyTasks: readyTaskIds.length,
      readyTasksWithCloudflareEvidence: readyTaskEvidence.filter((task) => task.cloudflareSnapshot).length,
      readyMemberGaps: readyMemberGaps.length,
      readyMemberGapsWithCloudflareEvidence: readyMemberGapEvidence.filter((gap) => gap.cloudflareSnapshot).length,
    },
    readyTaskEvidence,
    readyMemberGapEvidence,
    sources,
    terminalImpact: {
      sourceIntakeReportRuntimeUnchanged: true,
      coverageGateStillRequiresFullCloudflareReport: true,
    },
  };
}
