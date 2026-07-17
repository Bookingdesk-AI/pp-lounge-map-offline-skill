function clean(value) {
  return String(value ?? '').trim();
}

function hasText(value) {
  return clean(value) !== '';
}

function hasExplicitPriceOffer(record) {
  return (record.accessOffers ?? []).some((offer) => Number.isFinite(Number(offer.amount)) && hasText(offer.currency));
}

const PRICE_SOURCE_PROFILES = [
  {
    sourceId: 'plaza-premium',
    matchTerms: ['plaza premium'],
    evidenceTarget: 'official operator detail and booking pages',
  },
  {
    sourceId: 'airport-dimensions',
    matchTerms: ['the club', 'clubrooms', 'chase sapphire lounge by the club'],
    evidenceTarget: 'official Airport Dimensions and The Club detail/booking pages',
  },
  {
    sourceId: 'escape-lounges',
    matchTerms: ['escape lounge', 'centurion studio partner'],
    evidenceTarget: 'official Escape Lounges detail and booking pages',
  },
  {
    sourceId: 'no1-lounges',
    matchTerms: ['no1 lounge', 'no1 lounges', 'clubrooms', 'my lounge'],
    evidenceTarget: 'official No1 Lounges booking pages',
  },
  {
    sourceId: 'marhaba',
    matchTerms: ['marhaba'],
    evidenceTarget: 'official Marhaba lounge detail and booking pages',
  },
  {
    sourceId: 'primeclass',
    matchTerms: ['primeclass', 'prime class'],
    evidenceTarget: 'official Primeclass location and booking pages',
  },
  {
    sourceId: 'aspire-lounges',
    matchTerms: ['aspire lounge'],
    evidenceTarget: 'official Aspire location and booking pages',
  },
  {
    sourceId: 'minute-suites',
    matchTerms: ['minute suites'],
    evidenceTarget: 'official Minute Suites location and booking pages',
  },
  {
    sourceId: 'gameway',
    matchTerms: ['gameway'],
    evidenceTarget: 'official Gameway location and booking pages',
  },
  {
    sourceId: 'sleepover',
    matchTerms: ['sleepover'],
    evidenceTarget: 'official Sleepover location and booking pages',
  },
  {
    sourceId: 'be-relax',
    matchTerms: ['be relax'],
    evidenceTarget: 'official Be Relax location and booking pages',
  },
];

function missingFieldCounts(record) {
  return {
    missingHours: hasText(record.operations?.hours) ? 0 : 1,
    missingGate: hasText(record.location?.gate) ? 0 : 1,
    missingPrice: hasExplicitPriceOffer(record) ? 0 : 1,
  };
}

function addToSetMap(map, key, value) {
  if (!value) {
    return;
  }
  const set = map.get(key) ?? new Set();
  set.add(value);
  map.set(key, set);
}

function createAirportBacklog(records, limit = 40) {
  const byAirport = new Map();
  const sourceSets = new Map();

  for (const record of records) {
    const airport = record.airport ?? {};
    const iata = clean(airport.iata).toUpperCase();
    if (!iata) {
      continue;
    }

    const current = byAirport.get(iata) ?? {
      airportCode: iata,
      airportName: clean(airport.name),
      city: clean(airport.city),
      country: clean(airport.country),
      totalRecords: 0,
      missingHours: 0,
      missingGate: 0,
      missingPrice: 0,
      officialAirportAction: 'airport_authority_enrichment',
    };
    const missing = missingFieldCounts(record);
    current.totalRecords += 1;
    current.missingHours += missing.missingHours;
    current.missingGate += missing.missingGate;
    current.missingPrice += missing.missingPrice;
    for (const source of record.sources ?? []) {
      addToSetMap(sourceSets, iata, source.sourceId);
    }
    byAirport.set(iata, current);
  }

  return [...byAirport.values()]
    .map((airport) => ({
      ...airport,
      missingFieldScore: airport.missingGate * 3 + airport.missingHours * 2 + airport.missingPrice,
      sourceIds: [...(sourceSets.get(airport.airportCode) ?? new Set())].sort(),
      nextEvidenceRule:
        'Use official airport/operator/airline pages to add field evidence to matched lounges; create records only when no physical match exists.',
    }))
    .filter((airport) => airport.missingFieldScore > 0)
    .sort(
      (first, second) =>
        second.missingFieldScore - first.missingFieldScore ||
        second.totalRecords - first.totalRecords ||
        first.airportCode.localeCompare(second.airportCode),
    )
    .slice(0, limit);
}

function sourceStatsFromFieldCoverage(fieldCoverageReport) {
  return new Map(Object.entries(fieldCoverageReport?.stats?.bySource ?? {}));
}

function recordSearchText(record) {
  return [
    record.name,
    record.brand,
    record.operator,
    record.category,
    record.lounge?.name,
    record.lounge?.brand,
    record.lounge?.operator,
    record.lounge?.category,
    ...(record.programs ?? []),
    ...(record.accessMethods ?? []),
    ...(record.lounge?.programs ?? []),
    ...(record.lounge?.accessMethods ?? []),
  ]
    .map((value) => clean(value).toLowerCase())
    .filter(Boolean)
    .join(' ');
}

function countLikelySourceMatches(records, matchTerms) {
  const normalizedTerms = matchTerms.map((term) => clean(term).toLowerCase()).filter(Boolean);
  if (normalizedTerms.length === 0) {
    return { total: 0, missingPrice: 0, airports: [] };
  }

  const airportCodes = new Set();
  let total = 0;
  let missingPrice = 0;

  for (const record of records) {
    const text = recordSearchText(record);
    if (!normalizedTerms.some((term) => text.includes(term))) {
      continue;
    }
    total += 1;
    missingPrice += hasExplicitPriceOffer(record) ? 0 : 1;
    const iata = clean(record.airport?.iata).toUpperCase();
    if (iata) {
      airportCodes.add(iata);
    }
  }

  return {
    total,
    missingPrice,
    airports: [...airportCodes].sort(),
  };
}

function createSourceBacklog({ records, sourceRegistry, fieldCoverageReport, sourceFamilyIds, limit = 40 }) {
  const recordCounts = new Map();
  for (const record of records) {
    for (const source of record.sources ?? []) {
      recordCounts.set(source.sourceId, (recordCounts.get(source.sourceId) ?? 0) + 1);
    }
  }

  const fieldStats = sourceStatsFromFieldCoverage(fieldCoverageReport);
  return (sourceRegistry ?? [])
    .filter((source) => sourceFamilyIds.has(source.id) || recordCounts.has(source.id))
    .map((source) => {
      const stats = fieldStats.get(source.id) ?? {};
      const recordsForSource = Number(recordCounts.get(source.id) ?? stats.total ?? 0);
      const missingHours = Number(stats.missingHours ?? 0);
      const missingGate = Number(stats.missingGate ?? 0);
      const missingPrice = Number(stats.missingAccessOffers ?? 0);
      const noApprovedRecords = recordsForSource === 0;
      const priorityScore =
        (noApprovedRecords ? 1000 : 0) +
        missingGate * 3 +
        missingHours * 2 +
        Math.min(missingPrice, 250);
      return {
        sourceId: source.id,
        publisher: source.publisher,
        adapter: source.adapter,
        status: source.status,
        records: recordsForSource,
        missingHours,
        missingGate,
        missingPrice,
        priorityScore,
        nextAction: noApprovedRecords
          ? 'run_official_source_intake_or_record_blocker'
          : 'enrich_existing_records_with_field_evidence',
        rightsNote: source.rightsNote,
      };
    })
    .filter((source) => source.priorityScore > 0)
    .sort(
      (first, second) =>
        second.priorityScore - first.priorityScore ||
        second.records - first.records ||
        first.sourceId.localeCompare(second.sourceId),
    )
    .slice(0, limit);
}

function createPriceOfferWorklist({ records, sourceRegistry, fieldCoverageReport, sourceBacklog, limit = 12 }) {
  const sourcesById = new Map((sourceRegistry ?? []).map((source) => [source.id, source]));
  const statsBySource = sourceStatsFromFieldCoverage(fieldCoverageReport);
  const backlogBySource = new Map(sourceBacklog.map((source) => [source.sourceId, source]));

  return PRICE_SOURCE_PROFILES.map((profile, index) => {
    const source = sourcesById.get(profile.sourceId) ?? {};
    const stats = statsBySource.get(profile.sourceId) ?? {};
    const backlog = backlogBySource.get(profile.sourceId) ?? {};
    const likelyMatches = countLikelySourceMatches(records, profile.matchTerms);
    const sourceMissingPrice = Number(stats.missingAccessOffers ?? backlog.missingPrice ?? 0);
    const openPriceRows = Math.max(sourceMissingPrice, likelyMatches.missingPrice);
    const sourceRecordCount = Number(stats.total ?? backlog.records ?? 0);
    const hasLikelyCatalogMatches = likelyMatches.total > 0;

    return {
      sourceId: profile.sourceId,
      publisher: source.publisher ?? profile.sourceId,
      status: source.status ?? 'unregistered',
      adapter: source.adapter ?? 'unknown',
      records: sourceRecordCount,
      likelyCatalogMatches: likelyMatches.total,
      likelyMissingPriceMatches: likelyMatches.missingPrice,
      topLikelyAirports: likelyMatches.airports.slice(0, 12),
      missingPrice: openPriceRows,
      priorityScore:
        openPriceRows * 5 +
        likelyMatches.total * 2 +
        (sourceRecordCount === 0 && hasLikelyCatalogMatches ? 200 : 0) +
        (source.status === 'manual_review' || source.status === 'candidate' ? 50 : 0) -
        index,
      evidenceTarget: profile.evidenceTarget,
      nextAction: hasLikelyCatalogMatches
        ? 'match_existing_catalog_records_then_attach_price_evidence'
        : 'attach_or_refresh_official_price_evidence',
      acceptance: 'Explicit amount, currency, offer label, source URL, retrieved timestamp, and parser version.',
      rightsNote: source.rightsNote ?? '',
    };
  })
    .filter((source) => source.priorityScore > 0)
    .sort(
      (first, second) =>
        second.priorityScore - first.priorityScore ||
        second.missingPrice - first.missingPrice ||
        first.sourceId.localeCompare(second.sourceId),
    )
    .slice(0, limit);
}

function sourceFamilyBacklog(goal, catalog) {
  const sourceCounts = new Map();
  for (const record of catalog.records ?? []) {
    for (const source of record.sources ?? []) {
      sourceCounts.set(source.sourceId, (sourceCounts.get(source.sourceId) ?? 0) + 1);
    }
  }

  return (goal.sourceFamilies ?? [])
    .map((family) => {
      const members = family.members ?? [family.id];
      const memberRows = members.map((sourceId) => ({
        sourceId,
        records: sourceCounts.get(sourceId) ?? 0,
      }));
      return {
        familyId: family.id,
        label: family.label,
        requiredForTerminal: Boolean(family.requiredForTerminal),
        presentMembers: memberRows.filter((member) => member.records > 0).map((member) => member.sourceId),
        missingMembers: memberRows.filter((member) => member.records === 0).map((member) => member.sourceId),
        members: memberRows,
      };
    })
    .sort((first, second) => Number(second.requiredForTerminal) - Number(first.requiredForTerminal));
}

function sourceWaves(goal) {
  const sourceFamilyIds = new Set((goal.sourceFamilies ?? []).map((family) => family.id));
  return [
    {
      id: 'airport-field-enrichment',
      target: 'gate_hours',
      sourceFamilyIds: ['open-enrichment'],
      rule: 'Start from top airport backlog; update existing lounges with field evidence only.',
      acceptance: 'No fabricated gates; every filled field has source URL and retrieved timestamp.',
    },
    {
      id: 'alliance-expansion',
      target: 'non_priority_count',
      sourceFamilyIds: ['airline-alliance-lounges'],
      rule: 'Use alliance finders as discovery and access evidence; operator/airline/airport page confirms canonical identity.',
      acceptance: 'Alliance tier names become program tiers, not separate lounge brands.',
    },
    {
      id: 'airline-owned-expansion',
      target: 'hours_location_access',
      sourceFamilyIds: ['airline-operated-lounges'],
      rule: 'Airline-owned pages outrank alliance and issuer pages for hours, status, and access policy.',
      acceptance: 'Owned lounge status and closures match the cited airline page.',
    },
    {
      id: 'operator-network-expansion',
      target: 'non_priority_price_hours',
      sourceFamilyIds: ['operator-operated-lounges'],
      rule: 'Operator detail and booking pages are preferred for prices, hours, amenities, and restrictions.',
      acceptance: 'Price offers require explicit amount, currency, terms label, and official URL.',
    },
    {
      id: 'issuer-pass-evidence',
      target: 'access_programs',
      sourceFamilyIds: ['bank-issuer-programs', 'card-network-programs', 'collinson-networks'],
      rule: 'Issuer and pass pages prove access eligibility, not physical location when stronger sources exist.',
      acceptance: 'Eligibility fields do not overwrite operator, airline, or airport location evidence.',
    },
  ].filter((wave) => wave.sourceFamilyIds.some((familyId) => sourceFamilyIds.has(familyId)));
}

function sourceScaleEvidence() {
  return [
    {
      sourceId: 'priority-pass',
      publisher: 'Priority Pass',
      officialUrl: 'https://www.prioritypass.com/en-GB/airport-lounges',
      publishedScale: '1900+ lounges and airport experiences',
      planningUse: 'baseline breadth and duplicate detection, not canonical truth by itself',
    },
    {
      sourceId: 'american-express',
      publisher: 'American Express Global Lounge Collection',
      officialUrl: 'https://www.americanexpress.com/en-us/travel/lounges/the-platinum-card/',
      publishedScale: '1550+ airport lounges',
      planningUse: 'issuer access evidence and Centurion/operator confirmation targets',
    },
    {
      sourceId: 'mastercard-travel-pass',
      publisher: 'Mastercard Airport Experiences',
      officialUrl: 'https://airport.mastercard.com/',
      publishedScale: '1600+ airport lounges and travel experiences',
      planningUse: 'card-network access evidence only unless physical inventory is public and stable',
    },
    {
      sourceId: 'star-alliance',
      publisher: 'Star Alliance Lounge Finder',
      officialUrl: 'https://www.staralliance.com/en/lounge-finder',
      publishedScale: '1000+ lounges',
      planningUse: 'alliance discovery and program-tier evidence',
    },
    {
      sourceId: 'oneworld',
      publisher: 'oneworld Airport Lounges',
      officialUrl: 'https://www.oneworld.com/airport-lounge-results',
      publishedScale: 'nearly 700 airport lounges',
      planningUse: 'alliance discovery and program-tier evidence',
    },
    {
      sourceId: 'skyteam',
      publisher: 'SkyTeam Lounges',
      officialUrl: 'https://www.skyteam.com/en/lounges/',
      publishedScale: '750+ lounges worldwide',
      planningUse: 'alliance discovery and program-tier evidence',
    },
    {
      sourceId: 'plaza-premium',
      publisher: 'Plaza Premium Lounge',
      officialUrl: 'https://www.plazapremiumlounge.com/en-uk',
      publishedScale: 'global operator network',
      planningUse: 'operator-owned hours, locations, facilities, and paid-access offers',
    },
    {
      sourceId: 'airport-dimensions',
      publisher: 'Airport Dimensions',
      officialUrl: 'https://www.airportdimensions.com/locations',
      publishedScale: 'global operator location portfolio',
      planningUse: 'operator-owned The Club, Clubrooms, and partner lounge confirmation',
    },
  ];
}

function officialPriceResearchEvidence() {
  return [
    {
      sourceId: 'plaza-premium',
      publisher: 'Plaza Premium Lounge',
      officialUrl: 'https://www.plazapremiumlounge.com/en-uk/find',
      evidenceFields: ['access.accessOffers', 'operations.hours', 'location.terminal', 'amenities'],
      researchUse:
        'Use official operator detail and booking pages to match existing Plaza Premium-branded records and attach explicit paid-entry offers.',
      firstBatchRule: 'Start with likely catalog matches missing prices; do not create new records unless the physical lounge identity is unambiguous.',
    },
    {
      sourceId: 'airport-dimensions',
      publisher: 'Airport Dimensions / The Club',
      officialUrl: 'https://www.airportdimensions.com/locations',
      evidenceFields: ['access.accessOffers', 'operations.hours', 'location.gate', 'location.directions'],
      researchUse:
        'Use The Club and Airport Dimensions official location/detail pages for price, hours, gate, and lounge-level identity reconciliation.',
      firstBatchRule: 'Prefer existing Airport Dimensions and The Club records; generic airport-code-only discovery rows stay out of canonical publish.',
    },
    {
      sourceId: 'aspire-lounges',
      publisher: 'Aspire Lounges',
      officialUrl: 'https://www.executivelounges.com/',
      evidenceFields: ['access.accessOffers', 'operations.hours', 'location.terminal', 'restrictions'],
      researchUse:
        'Use official Aspire booking pages for public pre-book prices and operator-published hours where source rights allow bounded intake.',
      firstBatchRule: 'Attach offers to matched Aspire records first; classify partner-operated records conservatively.',
    },
    {
      sourceId: 'escape-lounges',
      publisher: 'Escape Lounges',
      officialUrl: 'https://escapelounges.com/',
      evidenceFields: ['access.accessOffers', 'operations.hours', 'location.terminal', 'amenities'],
      researchUse:
        'Use official Escape booking/location pages to refresh already-promoted Escape price evidence and close residual location gaps.',
      firstBatchRule: 'Prioritize records without gate or terminal evidence, since most Escape price rows are already covered.',
    },
    {
      sourceId: 'no1-lounges',
      publisher: 'No1 Lounges',
      officialUrl: 'https://www.no1lounges.com/',
      evidenceFields: ['access.accessOffers', 'operations.hours', 'location.terminal', 'restrictions'],
      researchUse:
        'Use official No1 booking pages for UK lounge prices and terminal-level details, then resolve partner lounge naming collisions.',
      firstBatchRule: 'Attach prices to existing UK airport records before expanding partner inventory.',
    },
  ];
}

function d1EvidenceContract(goal) {
  const requiredTables = goal.cloudflareDatabase?.requiredTables ?? [];
  return {
    databaseName: goal.cloudflareDatabase?.databaseName ?? 'lounge-guru-catalog',
    binding: goal.cloudflareDatabase?.binding ?? 'LOUNGE_GURU_DB',
    canonicalTables: requiredTables,
    proofTables: [
      'source_targets',
      'source_fetch_runs',
      'source_snapshots',
      'source_parse_runs',
      'source_candidates',
      'lounge_identity_links',
      'record_field_evidence',
      'lounge_field_coverage',
      'review_queue',
      'coverage_validation_runs',
    ].filter((table) => requiredTables.includes(table)),
    rawSnapshotPolicy: 'R2 or local cache pointer plus hash in D1; raw HTML/JSON bodies stay out of git and public payloads.',
    publishRule: 'D1 is terminal only after db:catalog:push, db:catalog:smoke, D1 smoke SQL, and goal:coverage pass against the pushed catalog.',
  };
}

function terminalBurndown({ coverageGap, airportBacklog, sourceBacklog, priceOfferWorklist }) {
  const deltas = coverageGap?.deltas ?? {};
  const topAirports = airportBacklog.slice(0, 10).map((airport) => airport.airportCode);
  const sourceIds = new Set(sourceBacklog.map((source) => source.sourceId));
  const sourceCandidates = [
    'star-alliance',
    'plaza-premium',
    'airport-dimensions',
    'united',
    'loungekey',
    'collinson-international',
    'citi-travel',
    'openstreetmap',
  ].filter((sourceId) => sourceIds.has(sourceId));

  return [
    {
      id: 'close-approved-record-gap',
      gapMetric: 'approvedRecordsRemaining',
      remaining: Number(deltas.approvedRecordsRemaining ?? 0),
      target: '>= 3000 approved deduped physical lounge records',
      firstBatch: sourceCandidates,
      acceptance: 'Add approved records only from official/public source evidence, or store blocker evidence for each attempted lane.',
    },
    {
      id: 'raise-hours-coverage',
      gapMetric: 'hoursCoverageRecordsRemaining',
      remaining: Number(deltas.hoursCoverageRecordsRemaining ?? 0),
      target: `>= ${Number((coverageGap?.targets?.minHoursCoverageRatio ?? 0) * 100).toFixed(0)}% records with hours and field provenance`,
      firstBatch: topAirports,
      acceptance: 'Hours must be published by official airport, operator, airline, or verified source field evidence.',
    },
    {
      id: 'raise-gate-coverage',
      gapMetric: 'gateCoverageRecordsRemaining',
      remaining: Number(deltas.gateCoverageRecordsRemaining ?? 0),
      target: `>= ${Number((coverageGap?.targets?.minGateCoverageRatio ?? 0) * 100).toFixed(0)}% records with exact gate or published decision-useful location`,
      firstBatch: topAirports,
      acceptance: 'Exact gates and near-gates must come from published text; no map-proximity inference.',
    },
    {
      id: 'raise-price-coverage',
      gapMetric: 'priceCoverageRecordsRemaining',
      remaining: Number(deltas.priceCoverageRecordsRemaining ?? 0),
      target: `>= ${Number((coverageGap?.targets?.minPriceCoverageRatio ?? 0) * 100).toFixed(0)}% records with explicit amount and currency where official pages publish offers`,
      firstBatch: priceOfferWorklist.slice(0, 8).map((source) => source.sourceId),
      acceptance: 'Price offers require amount, currency, offer label, source URL, retrieved timestamp, and parser version.',
    },
  ];
}

function currentWorkOrder({ coverageGap, airportBacklog, sourceBacklog, priceOfferWorklist }) {
  const deltas = coverageGap?.deltas ?? {};
  const countTargetsMet =
    Number(deltas.approvedRecordsRemaining ?? 0) <= 0 && Number(deltas.nonPriorityRecordsRemaining ?? 0) <= 0;
  const topAirports = airportBacklog.slice(0, 10).map((airport) => airport.airportCode);
  const priceSources = priceOfferWorklist.slice(0, 8).map((source) => source.sourceId);
  const airlineSources = sourceBacklog
    .filter((source) => Number(source.missingHours ?? 0) > 0 || Number(source.missingGate ?? 0) > 0)
    .filter((source) =>
      [
        'united',
        'delta',
        'american',
        'air-canada',
        'qantas',
        'qatar-airways',
        'singapore-airlines',
        'skyteam',
        'oneworld',
        'star-alliance',
      ].includes(source.sourceId),
    )
    .slice(0, 8)
    .map((source) => source.sourceId);

  return {
    mode: countTargetsMet ? 'field_enrichment_first' : 'inventory_then_field_enrichment',
    reason: countTargetsMet
      ? 'Approved and non-Priority Pass count targets are met; prioritize hours, gate, and price evidence before adding weak records.'
      : 'Count targets are still open; new records must include enough field evidence to avoid worsening terminal ratios.',
    terminalBlockers: coverageGap?.blockers ?? [],
    slices: [
      {
        id: 'airport-authority-top-backlog',
        type: 'airport_batch',
        scope: topAirports,
        fields: ['operations.hours', 'location.gate', 'access.accessOffers'],
        acceptance:
          'Use official airport pages only; exact or near-gate fields require published text and prices require explicit amount and currency.',
      },
      {
        id: 'operator-price-offers',
        type: 'source_batch',
        scope: priceSources,
        fields: ['access.accessOffers', 'operations.hours', 'location.gate'],
        acceptance:
          'Use official operator detail or booking pages; store amount, currency, label, source URL, retrieved timestamp, and parser version.',
      },
      {
        id: 'airline-owned-hours-location',
        type: 'source_batch',
        scope: airlineSources,
        fields: ['operations.hours', 'location.gate', 'lounge.status', 'access.programs'],
        acceptance:
          'Airline-owned pages outrank alliance pages for owned lounge hours, gate/location, status, closures, and access policy.',
      },
    ].filter((slice) => slice.scope.length > 0),
  };
}

export function createMaxCoveragePlan({ goal, catalog, coverageGap, fieldCoverageReport, sourceRegistry }) {
  const records = catalog.records ?? [];
  const sourceFamilyIds = new Set((goal.sourceFamilies ?? []).flatMap((family) => family.members ?? [family.id]));
  const sourceBacklog = createSourceBacklog({
    records,
    sourceRegistry,
    fieldCoverageReport,
    sourceFamilyIds,
  });
  const airportBacklog = createAirportBacklog(records);
  const priceOfferWorklist = createPriceOfferWorklist({
    records,
    sourceRegistry,
    fieldCoverageReport,
    sourceBacklog,
  });

  return {
    generatedAt: catalog.generatedAt,
    goalId: goal.id,
    goalVersion: goal.version,
    status: coverageGap?.terminalPassed ? 'complete' : 'blocked',
    baseline: {
      totalRecords: coverageGap?.current?.totalRecords ?? records.length,
      approvedRecords: coverageGap?.current?.approvedRecords ?? 0,
      nonPriorityRecords: coverageGap?.current?.nonPriorityRecords ?? 0,
      reviewRecords: coverageGap?.current?.reviewRecords ?? 0,
      fieldCoverage: coverageGap?.current?.fieldCoverage ?? {},
    },
    targets: coverageGap?.targets ?? {},
    deltas: coverageGap?.deltas ?? {},
    waves: sourceWaves(goal),
    sourceScaleEvidence: sourceScaleEvidence(),
    officialPriceResearchEvidence: officialPriceResearchEvidence(),
    d1EvidenceContract: d1EvidenceContract(goal),
    terminalBurndown: terminalBurndown({ coverageGap, airportBacklog, sourceBacklog, priceOfferWorklist }),
    currentWorkOrder: currentWorkOrder({ coverageGap, airportBacklog, sourceBacklog, priceOfferWorklist }),
    airportEnrichmentBacklog: airportBacklog,
    sourceBacklog,
    priceOfferWorklist,
    sourceFamilyBacklog: sourceFamilyBacklog(goal, catalog),
    validation: {
      progress: goal.validation?.progressCommand ?? 'npm run validate:coverage',
      terminal: goal.validation?.terminalCommand ?? 'npm run goal:coverage',
      json: 'npm run validate:json',
      d1Push: coverageGap?.nextCloudflareIntake?.commands?.pushD1 ?? 'npm run db:catalog:push',
      d1SmokeQueries: goal.validation?.d1SmokeQueries ?? {},
    },
    reviewQueueSla: {
      staleOpenHighConfidenceDays: goal.reviewQueue?.staleOpenHighConfidenceDays ?? 14,
      highConfidenceThreshold: goal.reviewQueue?.highConfidenceThreshold ?? 0.75,
      maxStaleOpenReviewRecords: goal.terminalGoal?.maxStaleOpenReviewRecords ?? 0,
      terminalQuery: goal.reviewQueue?.terminalQuery ?? '',
    },
    guardrails: [
      'Official/public sources only.',
      'No licensed commercial global lounge feeds.',
      'No login-only, captcha, private API, or robots bypass.',
      'Airport pages enrich matched records before creating new physical lounges.',
      'Prices require explicit amount and currency from official booking or payment pages.',
      'Near-gate text is allowed only when published by the source.',
    ],
  };
}
