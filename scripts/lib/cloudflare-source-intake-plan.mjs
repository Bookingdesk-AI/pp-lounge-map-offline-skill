function sourceRunById(sourceIntakeReport) {
  return new Map((sourceIntakeReport?.sources ?? []).map((source) => [source.sourceId, source]));
}

function sourceById(sourceRegistry) {
  return new Map((sourceRegistry ?? []).map((source) => [source.id, source]));
}

function actionForSource({ registrySource, runSource }) {
  if (registrySource?.adapter === 'licensed_api') {
    return {
      action: 'credential_review',
      status: 'blocked',
      next: 'Credentials',
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

export function createCloudflareSourceIntakePlan({ coverageGap, sourceRegistry, sourceIntakeReport }) {
  const registry = sourceById(sourceRegistry);
  const runs = sourceRunById(sourceIntakeReport);
  const missingFamilies = (coverageGap?.sourceFamilies ?? []).filter((family) => !family.present);
  const tasks = missingFamilies.flatMap((family) =>
    (family.missingMembers ?? []).map((sourceId) => {
      const registrySource = registry.get(sourceId);
      const runSource = runs.get(sourceId);
      const action = actionForSource({ registrySource, runSource });
      return {
        familyId: family.id,
        familyLabel: family.label,
        sourceId,
        publisher: registrySource?.publisher ?? sourceId,
        adapter: registrySource?.adapter ?? 'missing',
        sourceStatus: registrySource?.status ?? 'missing',
        runStatus: runSource?.status ?? 'not_run',
        runRecords: Number(runSource?.records ?? 0),
        cloudflareSnapshot: Boolean(runSource?.snapshotFile),
        action: action.action,
        status: action.status,
        next: action.next,
        url: registrySource?.url ?? runSource?.url ?? '',
        rightsNote: registrySource?.rightsNote ?? '',
      };
    }),
  );

  const blockedTasks = tasks.filter((task) => task.status === 'blocked').length;

  return {
    generatedAt: coverageGap?.generatedAt ?? new Date().toISOString(),
    coverageGoalId: coverageGap?.goalId ?? '',
    sourceRunId: sourceIntakeReport?.runId ?? null,
    policy: {
      requiredRuntime: 'cloudflare',
      localScrawl: 'blocked',
      rawSnapshotsCommitted: false,
      proofEnv: 'LOUNGE_GURU_SOURCE_INTAKE_RUNTIME=cloudflare',
    },
    summary: {
      missingFamilies: missingFamilies.length,
      tasks: tasks.length,
      readyTasks: tasks.length - blockedTasks,
      blockedTasks,
      fetchedWithoutRecords: tasks.filter((task) => task.cloudflareSnapshot && task.runRecords === 0).length,
    },
    tasks,
  };
}
