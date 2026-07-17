import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCoverageGapReport } from './lib/coverage-gap-report.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const goalPath = path.resolve(projectRoot, 'public', 'data', 'worldwide-coverage-goal.json');
const catalogPath = path.resolve(projectRoot, 'public', 'data', 'lounge-guru-catalog.json');
const sourceReportPath = path.resolve(projectRoot, 'public', 'data', 'source-intake-report.json');
const cloudflareSourceReportPath = path.resolve(projectRoot, 'public', 'data', 'cloudflare-source-intake-report.json');
const sourceRunEvidencePath = path.resolve(projectRoot, 'public', 'data', 'cloudflare-source-run-evidence.json');
const nonPriorityCandidatesPath = path.resolve(projectRoot, 'public', 'data', 'non-priority-lounge-candidates.json');
const airportAuthorityPath = path.resolve(projectRoot, 'public', 'data', 'airport-authority.json');
const migrationPath = path.resolve(projectRoot, 'migrations', '0001_lounge_guru_catalog.sql');
const outputPath = path.resolve(projectRoot, '.cache', 'd1', 'lounge-guru-current-snapshot.sql');
const schemaSourcesOutputPath = path.resolve(projectRoot, '.cache', 'd1', 'lounge-guru-current-snapshot-schema-sources.sql');
const catalogOutputPath = path.resolve(projectRoot, '.cache', 'd1', 'lounge-guru-current-snapshot-catalog.sql');
const candidatesOutputPath = path.resolve(projectRoot, '.cache', 'd1', 'lounge-guru-current-snapshot-candidates.sql');
const fieldsOutputPath = path.resolve(projectRoot, '.cache', 'd1', 'lounge-guru-current-snapshot-fields.sql');
const validationOutputPath = path.resolve(projectRoot, '.cache', 'd1', 'lounge-guru-current-snapshot-validation.sql');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sql(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return 'NULL';
    }
    return String(value);
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}

function json(value) {
  return JSON.stringify(value ?? null);
}

function hasText(value) {
  return String(value ?? '').trim() !== '';
}

function stableId(parts) {
  return sha256(parts.map((part) => String(part ?? '')).join('|')).slice(0, 32);
}

function boundedArray(value, maxItems) {
  const array = Array.isArray(value) ? value : [];
  if (array.length <= maxItems) {
    return array;
  }

  return [
    ...array.slice(0, maxItems),
    {
      truncated: true,
      omitted: array.length - maxItems,
      total: array.length,
    },
  ];
}

function batchInsert(table, columns, tuples, chunkSize = 100) {
  const statements = [];
  for (let index = 0; index < tuples.length; index += chunkSize) {
    const chunk = tuples.slice(index, index + chunkSize);
    statements.push(`INSERT INTO ${table} (
  ${columns.join(', ')}
) VALUES
${chunk.join(',\n')};`);
  }
  return statements;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function readOptionalJson(filePath, fallback) {
  try {
    return await readJson(filePath);
  } catch {
    return fallback;
  }
}

async function writeFileAtomic(filePath, contents) {
  const directory = path.dirname(filePath);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${crypto.randomBytes(6).toString('hex')}.tmp`,
  );

  try {
    await fs.writeFile(temporaryPath, contents, 'utf8');
    await fs.rename(temporaryPath, filePath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
}

function summarize(catalog, goal, migrationSql, sourceReport, cloudflareSourceReport, sourceRunEvidence) {
  const gapReport = createCoverageGapReport({
    goal,
    catalog,
    sourceRegistry: catalog.sources ?? [],
    migrationSql,
    sourceIntakeReport: sourceReport,
    cloudflareSourceIntakeReport: cloudflareSourceReport,
    sourceRunEvidence,
  });
  const records = catalog.records ?? [];
  const approvedRecords = records.filter((record) => record.quality?.reviewStatus === 'approved').length;
  const reviewRecords = records.length - approvedRecords;
  const recordsWithoutSources = records.filter((record) => !Array.isArray(record.sources) || record.sources.length === 0).length;
  const recordsWithoutQuality = records.filter((record) => !record.quality).length;
  const unknownAirportRecords = records.filter((record) => {
    const airport = record.airport ?? {};
    return !airport.iata || !airport.name || !Number.isFinite(Number(airport.coordinates?.lat)) || !Number.isFinite(Number(airport.coordinates?.lon));
  }).length;
  const sourceIds = new Set(records.flatMap((record) => record.sources.map((source) => source.sourceId)));
  const requiredFamilies = goal.sourceFamilies.filter((family) => family.requiredForTerminal);
  const sourceFamilies = requiredFamilies.map((family) => {
    const present = family.members?.length > 0
      ? family.members.some((sourceId) => sourceIds.has(sourceId))
      : sourceIds.has(family.id);
    return { id: family.id, mode: family.mode, present };
  });
  const sourceFamilyCoverageRatio =
    sourceFamilies.length > 0 ? sourceFamilies.filter((family) => family.present).length / sourceFamilies.length : 0;
  const blockers = [];
  const approvedRatio = records.length > 0 ? approvedRecords / records.length : 0;

  for (const blocker of gapReport.blockers ?? []) {
    blockers.push(blocker);
  }
  if (approvedRecords < goal.terminalGoal.minApprovedRecords) {
    blockers.push(`approved_records_below_${goal.terminalGoal.minApprovedRecords}`);
  }
  if ((catalog.stats?.nonPriorityRecords ?? 0) < (goal.terminalGoal.minNonPriorityRecords ?? 0)) {
    blockers.push(`non_priority_records_below_${goal.terminalGoal.minNonPriorityRecords}`);
  }
  if (approvedRatio < goal.terminalGoal.minApprovedRatio) {
    blockers.push(`approved_ratio_below_${goal.terminalGoal.minApprovedRatio}`);
  }
  if (sourceFamilyCoverageRatio < goal.terminalGoal.minSourceFamilyCoverageRatio) {
    blockers.push('source_family_coverage_incomplete');
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
  if (gapReport.deltas.sourceIntakeRuntimeRequired && !gapReport.current.cloudflareSourceRuntimePassed) {
    blockers.push(
      gapReport.deltas.sourceIntakeRuntimeRequired === 'playwright'
        ? 'source_intake_runtime_not_playwright'
        : 'source_intake_runtime_not_cloudflare',
    );
  }
  if (gapReport.blockers.includes('cloudflare_source_proof_incomplete')) {
    blockers.push('cloudflare_source_proof_incomplete');
  }

  return {
    totalRecords: records.length,
    approvedRecords,
    reviewRecords,
    candidateRecords: catalog.stats?.candidateRecords ?? 0,
    nonPriorityRecords: catalog.stats?.nonPriorityRecords ?? 0,
    uniqueAirports: catalog.stats?.uniqueAirports ?? 0,
    uniqueCountries: catalog.stats?.uniqueCountries ?? 0,
    unknownAirportRecords,
    recordsWithoutSources,
    recordsWithoutQuality,
    sourceIntakeRuntime: gapReport.current.sourceIntakeRuntime,
    cloudflareSourceRuntimePassed: gapReport.current.cloudflareSourceRuntimePassed,
    cloudflareSourceEvidence: gapReport.current.cloudflareSourceEvidence,
    sourceFamilies,
    missingSourceFamilies: gapReport.deltas.missingSourceFamilies,
    gapReport,
    approvedRatio: Number(approvedRatio.toFixed(4)),
    sourceFamilyCoverageRatio: Number(sourceFamilyCoverageRatio.toFixed(4)),
    terminalPassed: blockers.length === 0,
    blockers: [...new Set(blockers)],
  };
}

function upsertCoverageGoal(goal) {
  return `INSERT OR REPLACE INTO coverage_goals (
  id, version, title, status, target_scope, target_approved_records,
  target_approved_ratio, target_source_family_ratio, max_unknown_airport_records,
  max_records_without_sources, max_records_without_quality, notes_json, updated_at
) VALUES (
  ${sql(goal.id)}, ${sql(goal.version)}, ${sql(goal.title)}, ${sql(goal.status)}, ${sql(goal.targetScope)},
  ${Number(goal.terminalGoal.minApprovedRecords)}, ${Number(goal.terminalGoal.minApprovedRatio)},
  ${Number(goal.terminalGoal.minSourceFamilyCoverageRatio)}, ${Number(goal.terminalGoal.maxUnknownAirportRecords)},
  ${Number(goal.terminalGoal.maxRecordsWithoutSources)}, ${Number(goal.terminalGoal.maxRecordsWithoutQuality)},
  ${sql(json({
    terminalCommand: goal.validation?.terminalCommand,
    progressCommand: goal.validation?.progressCommand,
    strictExitCode: goal.validation?.strictExitCode,
    sourceFamilies: goal.sourceFamilies,
    guardrails: goal.guardrails,
    benchmark: goal.benchmark,
    maxCoverageTargets: goal.terminalGoal,
    minReadyMemberGapCoverageRatio: goal.terminalGoal.minReadyMemberGapCoverageRatio,
  }))},
  CURRENT_TIMESTAMP
);`;
}

function insertCatalogRun(runId, catalog, goal, summary, catalogHash) {
  return `INSERT INTO catalog_runs (
  id, generated_at, catalog_hash, total_records, approved_records, review_records,
  candidate_records, non_priority_records, unique_airports, unique_countries,
  source_families_json, quality_json
) VALUES (
  ${sql(runId)}, ${sql(catalog.generatedAt)}, ${sql(catalogHash)}, ${summary.totalRecords},
  ${summary.approvedRecords}, ${summary.reviewRecords}, ${summary.candidateRecords},
  ${summary.nonPriorityRecords}, ${summary.uniqueAirports}, ${summary.uniqueCountries},
  ${sql(json(summary.sourceFamilies))}, ${sql(json({
    ...catalog.quality,
    approvedRatio: summary.approvedRatio,
    sourceFamilyCoverageRatio: summary.sourceFamilyCoverageRatio,
    goalId: goal.id,
  }))}
);`;
}

function insertLoungeRecord(runId, record) {
  return `INSERT INTO lounge_records (
  id, catalog_run_id, name, brand, operator, category, status, airport_iata,
  airport_name, city, country, latitude, longitude, terminal, review_status,
  completeness, freshness, source_count, programs_json, access_methods_json,
  conflicts_json, canonical_json
) VALUES (
  ${sql(record.lounge.id)}, ${sql(runId)}, ${sql(record.lounge.name)}, ${sql(record.lounge.brand)},
  ${sql(record.lounge.operator)}, ${sql(record.lounge.category)}, ${sql(record.lounge.status)},
  ${sql(record.airport.iata)}, ${sql(record.airport.name)}, ${sql(record.airport.city)}, ${sql(record.airport.country)},
  ${Number(record.airport.coordinates.lat)}, ${Number(record.airport.coordinates.lon)}, ${sql(record.location.terminal || 'Unknown')},
  ${sql(record.quality.reviewStatus)}, ${Number(record.quality.completeness)}, ${Number(record.quality.freshness)},
  ${record.sources.length}, ${sql(json(record.lounge.programs))}, ${sql(json(record.lounge.accessMethods))},
  ${sql(json(record.quality.conflicts))}, ${sql(json(record))}
);`;
}

function insertLoungeSources(runId, record) {
  return record.sources.map((source) => `INSERT INTO lounge_sources (
  lounge_id, catalog_run_id, source_id, publisher, url, retrieved_at, confidence,
  field_coverage_json, rights_note
) VALUES (
  ${sql(record.lounge.id)}, ${sql(runId)}, ${sql(source.sourceId)}, ${sql(source.publisher)},
  ${sql(source.url)}, ${sql(source.retrievedAt)}, ${Number(source.confidence)},
  ${sql(json(source.fieldCoverage))}, ${sql(source.rightsNote)}
);`);
}

function sourceFamilyIds(goal, sourceId) {
  return goal.sourceFamilies
    .filter((family) => (family.members ?? [family.id]).includes(sourceId))
    .map((family) => family.id);
}

function insertSourceTarget(goal, source) {
  const familyIds = sourceFamilyIds(goal, source.id);
  const requiredForTerminal = goal.sourceFamilies.some(
    (family) => family.requiredForTerminal && (family.members ?? [family.id]).includes(source.id),
  );

  return `INSERT OR REPLACE INTO source_targets (
  id, publisher, adapter, status, url, freshness_days, required_for_terminal,
  source_family_ids_json, rights_note, target_json, updated_at
) VALUES (
  ${sql(source.id)}, ${sql(source.publisher)}, ${sql(source.adapter)}, ${sql(source.status)},
  ${sql(source.url)}, ${Number(source.freshnessDays ?? 0)}, ${requiredForTerminal ? 1 : 0},
  ${sql(json(familyIds))}, ${sql(source.rightsNote ?? '')}, ${sql(json(source))}, CURRENT_TIMESTAMP
);`;
}

function insertAirportAuthorityRow(airport) {
  return `(
  ${sql(airport.iata)}, ${sql(airport.icao ?? '')}, ${sql(airport.name)}, ${sql(airport.city ?? '')},
  ${sql(airport.country ?? '')}, ${sql(airport.countryCode ?? '')}, ${sql(airport.timezone ?? '')},
  ${Number(airport.coordinates?.lat)}, ${Number(airport.coordinates?.lon)}, ${sql(airport.sourceId ?? 'all-routes')},
  ${sql(airport.sourceAirportId ?? airport.iata)}, ${sql(json(airport))}, CURRENT_TIMESTAMP
)`;
}

function normalizedRunSources(sourceReport, sourceRunEvidence) {
  const localRunId = sourceReport.runId ?? 'source-intake-report';
  const localGeneratedAt = sourceReport.generatedAt ?? '';
  const localRuntime = sourceReport.policy?.execution?.runtime ?? 'playwright';
  const localFetchMode = sourceReport.policy?.fetchMode ?? 'source_intake_report';
  const localSources = (sourceReport.sources ?? []).map((source) => ({
    ...source,
    runId: source.runId ?? localRunId,
    generatedAt: source.generatedAt ?? localGeneratedAt,
    runtime: localRuntime,
    fetchMode: localFetchMode,
    cloudflareSnapshot: false,
  }));
  const cloudflareSources = (sourceRunEvidence.sources ?? []).map((source) => ({
    ...source,
    runtime: 'cloudflare',
    fetchMode: source.fetchMode ?? 'cloudflare_source_run_evidence',
    cloudflareSnapshot: Boolean(source.cloudflareSnapshot),
  }));

  return [...localSources, ...cloudflareSources];
}

function insertSourceFetchRun(source) {
  const runId = source.runId ?? 'unknown-run';
  const rowId = stableId(['source_fetch_runs', runId, source.sourceId, source.runtime, source.status, source.sha256]);
  const airportCodes = source.airportCodes ?? [];
  const loungeLinks = source.loungeLinks ?? [];

  return `INSERT INTO source_fetch_runs (
  id, source_id, run_id, generated_at, runtime, fetch_mode, status, url, final_url,
  http_status, content_type, bytes, sha256, records, airport_code_count,
  lounge_link_count, cloudflare_snapshot, reason, attempts_json
) VALUES (
  ${sql(rowId)}, ${sql(source.sourceId)}, ${sql(runId)}, ${sql(source.generatedAt ?? '')},
  ${sql(source.runtime ?? '')}, ${sql(source.fetchMode ?? '')}, ${sql(source.status ?? 'unknown')},
  ${sql(source.sourceUrl ?? source.url ?? '')}, ${sql(source.finalUrl ?? '')}, ${source.httpStatus ? Number(source.httpStatus) : 'NULL'},
  ${sql(source.contentType ?? '')}, ${Number(source.bytes ?? 0)}, ${sql(source.sha256 ?? '')},
  ${Number(source.records ?? 0)}, ${Number(source.airportCodeCount ?? airportCodes.length ?? 0)},
  ${Number(source.loungeLinkCount ?? loungeLinks.length ?? 0)}, ${source.cloudflareSnapshot ? 1 : 0},
  ${sql(source.reason ?? '')}, ${sql(json(source.fetchAttempts ?? []))}
);`;
}

function insertSourceSnapshot(source) {
  if (!hasText(source.sha256)) {
    return null;
  }

  const runId = source.runId ?? 'unknown-run';
  const rowId = stableId(['source_snapshots', runId, source.sourceId, source.sha256]);
  const storage = source.cloudflareSnapshot ? 'cloudflare_d1_source_run' : 'local_snapshot_reference';
  const snapshotUri = source.snapshotFile ?? `${storage}:${runId}:${source.sourceId}`;

  return `INSERT INTO source_snapshots (
  id, source_id, run_id, snapshot_uri, url, final_url, sha256, bytes,
  retrieved_at, storage, raw_content_committed
) VALUES (
  ${sql(rowId)}, ${sql(source.sourceId)}, ${sql(runId)}, ${sql(snapshotUri)},
  ${sql(source.sourceUrl ?? source.url ?? '')}, ${sql(source.finalUrl ?? '')}, ${sql(source.sha256)},
  ${Number(source.bytes ?? 0)}, ${sql(source.generatedAt ?? '')}, ${sql(storage)}, 0
);`;
}

function insertSourceParseRun(source) {
  const runId = source.runId ?? 'unknown-run';
  const rowId = stableId(['source_parse_runs', runId, source.sourceId, source.sha256, source.records]);

  return `INSERT INTO source_parse_runs (
  id, source_id, run_id, generated_at, parser_version, status, extracted_records,
  rejected_records, airport_codes_json, lounge_links_json, structured_records_json
) VALUES (
  ${sql(rowId)}, ${sql(source.sourceId)}, ${sql(runId)}, ${sql(source.generatedAt ?? '')},
  ${sql('source-intake-2026-07')}, ${sql(source.status ?? 'unknown')}, ${Number(source.records ?? 0)},
  0, ${sql(json(boundedArray(source.airportCodes, 100)))}, ${sql(json(boundedArray(source.loungeLinks, 100)))},
  ${sql(json(boundedArray(source.structuredRecords, 10)))}
);`;
}

function hasExplicitPriceOffer(offers) {
  return offers.some((offer) => Number.isFinite(Number(offer.amount)) && hasText(offer.currency));
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

function insertLoungeFieldCoverage(runId, record) {
  const primarySource = record.sources[0] ?? {};
  const accessOffers = Array.isArray(record.accessOffers) ? record.accessOffers : [];
  const priceOffers = accessOffers.filter(
    (offer) => Number.isFinite(Number(offer.amount)) && hasText(offer.currency) && hasSourceForAccessOffer(record, offer),
  );
  const hasHours = hasText(record.operations.hours) && hasSourceFieldCoverage(record, 'operations.hours');
  const hasGate = hasText(record.location.gate) && hasSourceFieldCoverage(record, 'location.gate');
  const hasPrice = hasExplicitPriceOffer(priceOffers);

  return `INSERT INTO lounge_field_coverage (
  lounge_id, catalog_run_id, name, brand, airport_iata, airport_name, city, country,
  source_id, publisher, source_url, retrieved_at, review_status, has_hours, has_gate,
  has_price, hours_text, gate_text, price_offers_json, field_coverage_json
) VALUES (
  ${sql(record.lounge.id)}, ${sql(runId)}, ${sql(record.lounge.name)}, ${sql(record.lounge.brand)},
  ${sql(record.airport.iata)}, ${sql(record.airport.name)}, ${sql(record.airport.city)}, ${sql(record.airport.country)},
  ${sql(primarySource.sourceId ?? 'unknown')}, ${sql(primarySource.publisher ?? 'Unknown')},
  ${sql(primarySource.url ?? '')}, ${sql(primarySource.retrievedAt ?? '')}, ${sql(record.quality.reviewStatus)},
  ${hasHours ? 1 : 0}, ${hasGate ? 1 : 0},
  ${hasPrice ? 1 : 0}, ${sql(hasHours ? record.operations.hours : '')},
  ${sql(hasGate ? record.location.gate : '')}, ${sql(json(priceOffers))}, ${sql(json(primarySource.fieldCoverage ?? []))}
);`;
}

function insertSourceCandidate(runId, candidate, catalogRecordIds) {
  const primarySource = candidate.sources?.[0] ?? {};
  const canonicalLoungeId = catalogRecordIds.has(candidate.lounge.id) ? candidate.lounge.id : null;

  return `(
  ${sql(candidate.lounge.id)}, ${sql(runId)}, ${sql(primarySource.sourceId ?? 'unknown')},
  ${sql(canonicalLoungeId)}, ${sql(candidate.lounge.name)}, ${sql(candidate.lounge.brand)},
  ${sql(candidate.airport.iata)}, ${sql(candidate.airport.name)}, ${sql(candidate.airport.city)},
  ${sql(candidate.airport.country)}, ${sql(candidate.lounge.status)}, ${sql(candidate.quality?.reviewStatus ?? 'review')},
  ${Number(candidate.quality?.completeness ?? 0)}, ${Number(primarySource.confidence ?? 0)},
  ${sql(json(candidate))}
)`;
}

function insertIdentityLinks(runId, record) {
  const sources = record.sources?.length > 0 ? record.sources : [{ sourceId: 'unknown', confidence: 0 }];

  return sources.map((source) => `(
  ${sql(stableId(['lounge_identity_links', runId, record.lounge.id, source.sourceId, source.url]))},
  ${sql(runId)}, ${sql(record.lounge.id)}, ${sql(record.lounge.id)}, ${sql(source.sourceId ?? 'unknown')},
  ${sql(sources.length > 1 ? 'merged_source_overlay' : 'canonical_identity')},
  ${Number(source.confidence ?? 0)}, ${Number(record.quality?.conflicts?.length ?? 0)},
  ${sql(json({
    airportIata: record.airport.iata,
    terminal: record.location.terminal,
    name: record.lounge.name,
    sourceUrl: source.url,
    fieldCoverage: source.fieldCoverage ?? [],
  }))}
)`);
}

function compactValue(value, fieldPath = '') {
  if (fieldPath === 'lounge.brandAsset' && value && typeof value === 'object') {
    return [value.id, value.name].filter(Boolean).join(' · ');
  }
  if (fieldPath === 'airport.coordinates' && value && typeof value === 'object') {
    return [value.lat, value.lon].filter((part) => Number.isFinite(Number(part))).join(',');
  }
  if (fieldPath === 'record.quality' && value && typeof value === 'object') {
    return [
      value.reviewStatus,
      Number.isFinite(Number(value.completeness)) ? `completeness:${value.completeness}` : '',
      Array.isArray(value.conflicts) && value.conflicts.length > 0 ? `conflicts:${value.conflicts.length}` : '',
    ].filter(Boolean).join(' · ');
  }
  if (Array.isArray(value)) {
    if (value.some((item) => item && typeof item === 'object')) {
      return JSON.stringify(value);
    }
    return value.filter(Boolean).join(' · ');
  }
  if (value && typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value ?? '').trim();
}

function valueAtPath(record, fieldPath) {
  switch (fieldPath) {
    case 'access.accessOffers':
      return (record.accessOffers ?? []).filter((offer) => Number.isFinite(Number(offer.amount)) && hasText(offer.currency));
    case 'record.amenities':
      return record.amenities ?? [];
    case 'record.restrictions':
      return record.restrictions ?? [];
    case 'record.guestPolicy':
      return record.guestPolicy ?? '';
    case 'record.notes':
      return record.notes ?? [];
    case 'record.sources':
      return (record.sources ?? []).map((source) => source.sourceId).filter(Boolean);
    case 'record.quality':
      return record.quality
        ? {
            completeness: record.quality.completeness,
            freshness: record.quality.freshness,
            reviewStatus: record.quality.reviewStatus,
            conflicts: record.quality.conflicts ?? [],
          }
        : null;
    default:
      break;
  }

  const [group, field] = fieldPath.split('.');
  return record?.[group]?.[field];
}

function createFieldEvidenceSpecs(catalog) {
  return (catalog.schema?.fields ?? [])
    .map((field) => {
      const group = String(field.group ?? '').trim();
      const name = String(field.name ?? '').trim();
      if (!group || !name) {
        return null;
      }
      return {
        group,
        name,
        path: `${group}.${name}`,
        required: Boolean(field.required),
        value: (record) => valueAtPath(record, `${group}.${name}`),
      };
    })
    .filter(Boolean);
}

function sourceForField(record, fieldPath) {
  const aliases = new Set([
    fieldPath,
    fieldPath.replace(/^record\./, ''),
    fieldPath === 'access.accessOffers' ? 'accessOffers' : '',
  ].filter(Boolean));
  return (
    (record.sources ?? []).find((source) => (source.fieldCoverage ?? []).some((field) => aliases.has(field))) ??
    record.sources?.[0] ??
    {}
  );
}

function insertRecordFieldEvidence(runId, record, fieldEvidenceSpecs) {
  return fieldEvidenceSpecs.map((field) => {
    const source = sourceForField(record, field.path);
    const value = compactValue(field.value(record), field.path);
    const hasValue = hasText(value);

    return `(
  ${sql(stableId(['record_field_evidence', runId, record.lounge.id, field.path]))},
  ${sql(runId)}, ${sql(record.lounge.id)}, ${sql(field.group)}, ${sql(field.name)}, ${sql(field.path)},
  ${hasValue ? 1 : 0}, ${sql(value)}, ${sql(source.sourceId ?? 'unknown')}, ${sql(source.publisher ?? 'Unknown')},
  ${sql(source.url ?? '')}, ${Number(source.confidence ?? 0)}, ${sql(source.retrievedAt ?? '')},
  ${sql(hasValue ? '' : 'official_source_not_published')},
  ${sql(json({ required: field.required, sourceCoversField: (source.fieldCoverage ?? []).includes(field.path) }))}
)`;
  });
}

function insertReviewQueue(runId, record) {
  const issues = [];
  for (const conflict of record.quality?.conflicts ?? []) {
    issues.push({
      issueType: 'source_conflict',
      fieldPath: conflict.fieldPath ?? 'record.quality.conflicts',
      status: 'open',
      severity: 'high',
      reason: conflict.reason ?? 'source conflict requires review',
      payload: conflict,
    });
  }
  if (record.quality?.reviewStatus !== 'approved') {
    issues.push({
      issueType: 'approval_required',
      fieldPath: 'quality.reviewStatus',
      status: 'open',
      severity: 'medium',
      reason: 'candidate is not approved',
      payload: { reviewStatus: record.quality?.reviewStatus },
    });
  }

  return issues.map((issue) => {
    const source = record.sources?.[0] ?? {};
    return `INSERT INTO review_queue (
  id, catalog_run_id, lounge_id, issue_type, field_path, status, severity,
  source_id, reason, opened_at, resolved_at, payload_json
) VALUES (
  ${sql(stableId(['review_queue', runId, record.lounge.id, issue.issueType, issue.fieldPath]))},
  ${sql(runId)}, ${sql(record.lounge.id)}, ${sql(issue.issueType)}, ${sql(issue.fieldPath)},
  ${sql(issue.status)}, ${sql(issue.severity)}, ${sql(source.sourceId ?? 'unknown')},
  ${sql(issue.reason)}, ${sql(record.operations?.lastVerifiedAt || source.retrievedAt || '')},
  NULL, ${sql(json(issue.payload))}
);`;
  });
}

function insertValidationRun(goal, runId, summary) {
  const validationId = `${goal.id}-${runId}`;
  return `INSERT INTO coverage_validation_runs (
  id, coverage_goal_id, catalog_run_id, status, summary_json, blockers_json
) VALUES (
  ${sql(validationId)}, ${sql(goal.id)}, ${sql(runId)}, ${sql(summary.terminalPassed ? 'passed' : 'failed')},
  ${sql(json(summary))}, ${sql(json(summary.blockers))}
);`;
}

async function main() {
  const [
    goal,
    catalog,
    sourceReport,
    cloudflareSourceReport,
    sourceRunEvidence,
    nonPriorityCandidates,
    airportAuthority,
    migrationSql,
  ] = await Promise.all([
    readJson(goalPath),
    readJson(catalogPath),
    readJson(sourceReportPath),
    readJson(cloudflareSourceReportPath),
    readJson(sourceRunEvidencePath),
    readJson(nonPriorityCandidatesPath),
    readOptionalJson(airportAuthorityPath, { airports: [] }),
    fs.readFile(migrationPath, 'utf8'),
  ]);
  const catalogHash = sha256(JSON.stringify(catalog));
  const runId = `catalog-${catalogHash.slice(0, 16)}`;
  const summary = summarize(catalog, goal, migrationSql, sourceReport, cloudflareSourceReport, sourceRunEvidence);
  const fieldCoverageStats = catalog.records.reduce(
    (stats, record) => {
      const accessOffers = Array.isArray(record.accessOffers) ? record.accessOffers : [];
      stats.hours += hasText(record.operations.hours) ? 1 : 0;
      stats.gates += hasText(record.location.gate) ? 1 : 0;
      stats.prices += hasExplicitPriceOffer(accessOffers) ? 1 : 0;
      return stats;
    },
    { hours: 0, gates: 0, prices: 0 },
  );
  const normalizedSources = normalizedRunSources(sourceReport, sourceRunEvidence);
  const airportAuthorityRows = (airportAuthority.airports ?? []).map(insertAirportAuthorityRow);
  const catalogRecordIds = new Set(catalog.records.map((record) => record.lounge.id));
  const sourceCandidateRows = nonPriorityCandidates.map((candidate) => insertSourceCandidate(runId, candidate, catalogRecordIds));
  const identityLinkRows = catalog.records.flatMap((record) => insertIdentityLinks(runId, record));
  const fieldEvidenceSpecs = createFieldEvidenceSpecs(catalog);
  const recordFieldEvidenceRows = catalog.records.flatMap((record) => insertRecordFieldEvidence(runId, record, fieldEvidenceSpecs));
  const schemaSourcesStatements = [
    migrationSql.trim(),
    upsertCoverageGoal(goal),
    'DELETE FROM source_parse_runs;',
    'DELETE FROM source_snapshots;',
    'DELETE FROM source_fetch_runs;',
    'DELETE FROM source_targets;',
    'DELETE FROM airport_authority;',
    ...catalog.sources.map((source) => insertSourceTarget(goal, source)),
    ...batchInsert('airport_authority', [
      'iata',
      'icao',
      'name',
      'city',
      'country',
      'country_code',
      'timezone',
      'latitude',
      'longitude',
      'source_id',
      'source_airport_id',
      'authority_json',
      'updated_at',
    ], airportAuthorityRows),
    ...normalizedSources.flatMap((source) => [
      insertSourceFetchRun(source),
      insertSourceSnapshot(source),
      insertSourceParseRun(source),
    ].filter(Boolean)),
  ];
  const catalogStatements = [
    'DELETE FROM coverage_validation_runs;',
    'DELETE FROM review_queue;',
    'DELETE FROM record_field_evidence;',
    'DELETE FROM lounge_identity_links;',
    'DELETE FROM source_candidates;',
    'DELETE FROM lounge_field_coverage;',
    'DELETE FROM lounge_sources;',
    'DELETE FROM lounge_records;',
    'DELETE FROM catalog_runs;',
    insertCatalogRun(runId, catalog, goal, summary, catalogHash),
    ...catalog.records.flatMap((record) => [
      insertLoungeRecord(runId, record),
      ...insertLoungeSources(runId, record),
      insertLoungeFieldCoverage(runId, record),
      ...insertReviewQueue(runId, record),
    ]),
  ];
  const candidatesStatements = [
    ...batchInsert('source_candidates', [
      'id',
      'catalog_run_id',
      'source_id',
      'canonical_lounge_id',
      'name',
      'brand',
      'airport_iata',
      'airport_name',
      'city',
      'country',
      'status',
      'review_status',
      'completeness',
      'confidence',
      'candidate_json',
    ], sourceCandidateRows, 20),
    ...batchInsert('lounge_identity_links', [
      'id',
      'catalog_run_id',
      'canonical_lounge_id',
      'linked_lounge_id',
      'source_id',
      'match_reason',
      'confidence',
      'conflict_count',
      'evidence_json',
    ], identityLinkRows),
  ];
  const fieldsStatements = [
    ...batchInsert('record_field_evidence', [
      'id',
      'catalog_run_id',
      'lounge_id',
      'field_group',
      'field_name',
      'field_path',
      'has_value',
      'value_text',
      'source_id',
      'publisher',
      'source_url',
      'confidence',
      'retrieved_at',
      'missing_reason',
      'evidence_json',
    ], recordFieldEvidenceRows),
  ];
  const validationStatements = [
    insertValidationRun(goal, runId, summary),
  ];
  const statements = [
    ...schemaSourcesStatements,
    ...catalogStatements,
    ...candidatesStatements,
    ...fieldsStatements,
    ...validationStatements,
  ];

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await Promise.all([
    writeFileAtomic(outputPath, `${statements.join('\n')}\n`),
    writeFileAtomic(schemaSourcesOutputPath, `${schemaSourcesStatements.join('\n')}\n`),
    writeFileAtomic(catalogOutputPath, `${catalogStatements.join('\n')}\n`),
    writeFileAtomic(candidatesOutputPath, `${candidatesStatements.join('\n')}\n`),
    writeFileAtomic(fieldsOutputPath, `${fieldsStatements.join('\n')}\n`),
    writeFileAtomic(validationOutputPath, `${validationStatements.join('\n')}\n`),
  ]);
  console.log(JSON.stringify({
    outputPath: path.relative(projectRoot, outputPath),
    splitOutputPaths: [
      path.relative(projectRoot, schemaSourcesOutputPath),
      path.relative(projectRoot, catalogOutputPath),
      path.relative(projectRoot, candidatesOutputPath),
      path.relative(projectRoot, fieldsOutputPath),
      path.relative(projectRoot, validationOutputPath),
    ],
    runId,
    catalogHash,
    totalRecords: summary.totalRecords,
    approvedRecords: summary.approvedRecords,
    reviewRecords: summary.reviewRecords,
    sourceRows: catalog.records.reduce((total, record) => total + record.sources.length, 0),
    sourceTargets: catalog.sources.length,
    airportAuthorityRows: airportAuthorityRows.length,
    sourceFetchRuns: normalizedSources.length,
    sourceCandidates: nonPriorityCandidates.length,
    identityLinks: identityLinkRows.length,
    recordFieldEvidenceRows: recordFieldEvidenceRows.length,
    reviewQueueRows: catalog.records.reduce((total, record) => total + insertReviewQueue(runId, record).length, 0),
    fieldCoverageRows: catalog.records.length,
    fieldCoverage: {
      ...fieldCoverageStats,
      missingHours: summary.totalRecords - fieldCoverageStats.hours,
      missingGates: summary.totalRecords - fieldCoverageStats.gates,
      missingPrices: summary.totalRecords - fieldCoverageStats.prices,
    },
    terminalPassed: summary.terminalPassed,
    blockers: summary.blockers,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
