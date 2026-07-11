function sourceRunById(sourceRunReport) {
  return new Map((sourceRunReport?.sources ?? []).map((source) => [source.sourceId, source]));
}

function sourceById(sourceRegistry) {
  return new Map((sourceRegistry ?? []).map((source) => [source.id, source]));
}

function actionForSource({ sourceId, registrySource, runSource, intakeHints }) {
  if (registrySource?.adapter === 'licensed_api' || intakeHints.credentialSourceIds.has(sourceId)) {
    return {
      action: 'credential_review',
      status: 'blocked',
      next: 'Credentials',
    };
  }

  if (!runSource && intakeHints.rightsReviewSourceIds.has(sourceId)) {
    return {
      action: 'rights_review',
      status: 'blocked',
      next: 'Rights',
    };
  }

  if (!runSource) {
    return {
      action: 'cloudflare_snapshot',
      status: 'ready',
      next: 'Snapshot',
    };
  }

  if (runSource.status === 'fetched' && Number(runSource.records ?? 0) > 0) {
    return {
      action: 'review_import',
      status: 'ready',
      next: 'Review',
    };
  }

  if (runSource.status === 'fetched') {
    return {
      action: 'structured_adapter',
      status: 'ready',
      next: 'Adapter',
    };
  }

  if (runSource.status === 'skipped') {
    return {
      action: 'rights_review',
      status: 'blocked',
      next: 'Rights',
    };
  }

  return {
    action: 'fetch_repair',
    status: 'ready',
    next: 'Fetch',
  };
}

function hasCloudflareSnapshot(runSource) {
  return Boolean(runSource?.cloudflareSnapshot || runSource?.snapshotFile);
}

export function createCloudflareSourceIntakePlan({ coverageGap, sourceRegistry, sourceRunReport }) {
  const registry = sourceById(sourceRegistry);
  const runs = sourceRunById(sourceRunReport);
  const sourceFamilies = coverageGap?.sourceFamilies ?? [];
  const missingFamilies = (coverageGap?.sourceFamilies ?? []).filter((family) => !family.present);
  const intakeHints = {
    credentialSourceIds: new Set(coverageGap?.nextCloudflareIntake?.credentialSourceIds ?? []),
    rightsReviewSourceIds: new Set(coverageGap?.nextCloudflareIntake?.rightsReviewSourceIds ?? []),
  };
  const buildPlanItem = (family, sourceId) => {
    const registrySource = registry.get(sourceId);
    const runSource = runs.get(sourceId);
    const action = actionForSource({ sourceId, registrySource, runSource, intakeHints });
    return {
      familyId: family.id,
      familyLabel: family.label,
      sourceId,
      publisher: registrySource?.publisher ?? sourceId,
      adapter: registrySource?.adapter ?? 'missing',
      sourceStatus: registrySource?.status ?? 'missing',
      runStatus: runSource?.status ?? 'not_run',
      runRecords: Number(runSource?.records ?? 0),
      cloudflareSnapshot: hasCloudflareSnapshot(runSource),
      action: action.action,
      status: action.status,
      next: action.next,
      url: registrySource?.url ?? runSource?.url ?? '',
      fetchUrls: [...new Set([registrySource?.url, ...(registrySource?.fetchUrls ?? [])].filter(Boolean))],
      rightsNote: registrySource?.rightsNote ?? '',
    };
  };
  const tasks = missingFamilies.flatMap((family) =>
    (family.missingMembers ?? []).map((sourceId) => buildPlanItem(family, sourceId)),
  );
  const memberGaps = sourceFamilies.flatMap((family) =>
    (family.missingMembers ?? []).map((sourceId) => ({
      ...buildPlanItem(family, sourceId),
      familyPresent: Boolean(family.present),
      terminalFamilyBlocked: !family.present,
    })),
  );

  const blockedTasks = tasks.filter((task) => task.status === 'blocked').length;

  return {
    generatedAt: coverageGap?.generatedAt ?? new Date().toISOString(),
    coverageGoalId: coverageGap?.goalId ?? '',
    sourceRunId: sourceRunReport?.runId ?? null,
    policy: {
      requiredRuntime: 'cloudflare',
      localScrawl: 'blocked',
      rawSnapshotsCommitted: false,
      proofEnv: 'LOUNGE_GURU_SOURCE_INTAKE_RUNTIME=cloudflare',
    },
    summary: {
      missingFamilies: missingFamilies.length,
      memberGaps: memberGaps.length,
      tasks: tasks.length,
      readyTasks: tasks.length - blockedTasks,
      blockedTasks,
      fetchedWithoutRecords: tasks.filter((task) => task.cloudflareSnapshot && task.runRecords === 0).length,
    },
    tasks,
    memberGaps,
  };
}
