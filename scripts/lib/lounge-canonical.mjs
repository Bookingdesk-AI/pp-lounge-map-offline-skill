import {
  createDeskTravelBrandImport,
  getBrandRegistry,
  resolveBrandAsset,
} from './brand-registry.mjs';
import { CANONICAL_SCHEMA_FIELDS, LOUNGE_GURU_SCHEMA_VERSION, cloneSourceRegistry } from './source-registry.mjs';

const COMPLETE_FIELD_WEIGHTS = [
  ['name', 10],
  ['airportCode', 10],
  ['airportName', 8],
  ['country', 8],
  ['city', 8],
  ['terminal', 7],
  ['openingHours', 10],
  ['location', 8],
  ['facilities', 12],
  ['conditions', 7],
  ['url', 7],
  ['coordinates', 5],
];

function clean(value) {
  return String(value ?? '').trim();
}

function cleanList(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(clean).filter(Boolean))];
}

function hasValue(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return clean(value) !== '' && clean(value) !== 'Unknown';
}

function inferBrand(name) {
  const normalized = clean(name);
  const lower = normalized.toLowerCase();
  const knownBrands = [
    ['Plaza Premium', 'Plaza Premium'],
    ['Primeclass', 'Primeclass'],
    ['Marhaba', 'Marhaba'],
    ['Be Relax', 'Be Relax'],
    ['Aspire', 'Aspire'],
    ['Escape', 'Escape Lounges'],
    ['Sapphire', 'Chase Sapphire Lounge'],
    ['Centurion', 'American Express Centurion Lounge'],
    ['Capital One', 'Capital One Lounge'],
    ['The Club', 'The Club'],
    ['United Club', 'United Club'],
    ['Polaris', 'United Polaris Lounge'],
    ['Sky Club', 'Delta Sky Club'],
    ['Admirals Club', 'American Airlines Admirals Club'],
    ['Maple Leaf', 'Air Canada Maple Leaf Lounge'],
  ];

  const match = knownBrands.find(([needle]) => lower.includes(needle.toLowerCase()));
  return match ? match[1] : normalized;
}

function inferOperator(name, sourceId = 'priority-pass') {
  const brand = inferBrand(name);
  if (brand === clean(name)) {
    return sourceId === 'priority-pass' ? 'Priority Pass partner' : brand;
  }
  return brand;
}

function inferCategory(type) {
  const normalized = clean(type).toUpperCase();
  if (normalized === 'EAT') {
    return 'dining';
  }
  if (normalized === 'REST') {
    return 'rest';
  }
  if (normalized === 'REFRESH') {
    return 'spa';
  }
  if (normalized === 'UNWIND') {
    return 'experience';
  }
  return 'lounge';
}

function inferPrograms(sourceId) {
  if (sourceId === 'priority-pass') {
    return ['Priority Pass'];
  }
  return [];
}

function inferAccessMethods(sourceId) {
  if (sourceId === 'priority-pass') {
    return ['membership'];
  }
  return ['review'];
}

function getCoordinates(record) {
  if (Array.isArray(record.geometry?.coordinates)) {
    const [lon, lat] = record.geometry.coordinates;
    return { lat: Number(lat), lon: Number(lon) };
  }

  return {
    lat: Number(record.lat),
    lon: Number(record.lon),
  };
}

function hasAirportNormalization(properties, coordinates) {
  return Boolean(
    clean(properties.airportCode) &&
      clean(properties.airportName) &&
      clean(properties.city) &&
      clean(properties.country) &&
      Number.isFinite(coordinates.lat) &&
      Number.isFinite(coordinates.lon),
  );
}

function latestIsoDate(values, fallback) {
  const latest = values
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .reduce((current, date) => (date.getTime() > current.getTime() ? date : current), new Date(0));

  return latest.getTime() > 0 ? latest.toISOString() : fallback;
}

function latestRetrievedAtForSource(records, sourceId, fallback) {
  return latestIsoDate(
    records.flatMap((record) =>
      (record.sources ?? [])
        .filter((source) => source.sourceId === sourceId)
        .map((source) => source.retrievedAt),
    ),
    fallback,
  );
}

function createOurAirportsSource(properties, coordinates, retrievedAt) {
  if (!hasAirportNormalization(properties, coordinates)) {
    return null;
  }

  return {
    sourceId: 'ourairports',
    publisher: 'OurAirports',
    url: 'https://ourairports.com/data/',
    retrievedAt,
    fieldCoverage: [
      'airport.iata',
      'airport.name',
      'airport.city',
      'airport.country',
      'airport.coordinates',
    ],
    confidence: 0.9,
    rightsNote: 'Open airport reference data; used for airport identity and coordinate normalization only.',
  };
}

function splitNotes(value) {
  return clean(value)
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^note:/i.test(line) || /^important note:/i.test(line));
}

export function calculateCompleteness(properties, coordinates = getCoordinates(properties)) {
  const total = COMPLETE_FIELD_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);
  let score = 0;

  for (const [field, weight] of COMPLETE_FIELD_WEIGHTS) {
    if (field === 'coordinates') {
      if (Number.isFinite(coordinates.lat) && Number.isFinite(coordinates.lon)) {
        score += weight;
      }
      continue;
    }

    if (hasValue(properties[field])) {
      score += weight;
    }
  }

  return Math.round((score / total) * 100);
}

export function calculateFreshness(retrievedAt, freshnessDays = 30, now = new Date()) {
  const retrievedDate = new Date(retrievedAt);
  if (Number.isNaN(retrievedDate.getTime())) {
    return 0;
  }

  const ageDays = Math.max(0, (now.getTime() - retrievedDate.getTime()) / 86_400_000);
  return Math.max(0, Math.min(100, Math.round(100 - (ageDays / freshnessDays) * 100)));
}

export function findQualityConflicts(properties) {
  const conflicts = [];
  if (!hasValue(properties.openingHours)) {
    conflicts.push('missing_hours');
  }
  if (!hasValue(properties.url)) {
    conflicts.push('missing_source_url');
  }
  if (!hasValue(properties.facilities)) {
    conflicts.push('missing_amenities');
  }
  if (clean(properties.terminal) === 'Unknown') {
    conflicts.push('unknown_terminal');
  }
  return conflicts;
}

export function createCanonicalRecord(feature, options = {}) {
  const properties = feature.properties ?? feature;
  const sourceId = options.sourceId ?? properties.sourceId ?? 'priority-pass';
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const coordinates = getCoordinates(feature);
  const inferredBrand = clean(properties.provider) || inferBrand(properties.name);
  const brandAsset = resolveBrandAsset(inferredBrand, properties.name, sourceId);
  const source = {
    sourceId,
    publisher: options.publisher ?? 'Priority Pass',
    url: clean(properties.url) || 'https://www.prioritypass.com/en-GB/airport-lounges',
    retrievedAt: generatedAt,
    fieldCoverage: [
      'lounge.name',
      'airport.iata',
      'airport.name',
      'location.terminal',
      'operations.hours',
      'amenities',
      'restrictions',
    ],
    confidence: sourceId === 'priority-pass' ? 0.86 : 0.7,
    rightsNote:
      options.rightsNote ??
      'Imported from the approved Priority Pass source workbook and linked official public record.',
  };

  const conflicts = findQualityConflicts(properties);
  const completeness = calculateCompleteness(properties, coordinates);
  const freshness = calculateFreshness(generatedAt, 30);
  const reviewStatus = conflicts.length > 0 || completeness < 60 ? 'review' : 'approved';
  const notes = splitNotes(properties.openingHours);
  const airportSource = createOurAirportsSource(properties, coordinates, generatedAt);

  return {
    lounge: {
      id: clean(properties.id),
      name: clean(properties.name),
      brand: inferredBrand,
      brandAsset,
      operator: inferOperator(properties.name, sourceId),
      category: inferCategory(properties.type),
      status: 'active',
      programs: cleanList(properties.programs).length > 0 ? cleanList(properties.programs) : inferPrograms(sourceId),
      accessMethods:
        cleanList(properties.accessMethods).length > 0
          ? cleanList(properties.accessMethods)
          : inferAccessMethods(sourceId),
    },
    airport: {
      iata: clean(properties.airportCode).toUpperCase(),
      icao: '',
      name: clean(properties.airportName),
      city: clean(properties.city),
      country: clean(properties.country),
      timezone: '',
      coordinates,
    },
    location: {
      terminal: clean(properties.terminal) || 'Unknown',
      concourse: '',
      gate: '',
      securitySide: '',
      directions: clean(properties.location),
    },
    operations: {
      hours: clean(properties.openingHours),
      exceptions: cleanList(properties.conditions).filter((condition) => /closed|restricted|renovation|season/i.test(condition)),
      plannedOpening: '',
      lastVerifiedAt: generatedAt,
    },
    amenities: cleanList(properties.facilities),
    restrictions: cleanList(properties.conditions),
    guestPolicy: cleanList(properties.conditions).find((condition) => /guest|children|cardholder/i.test(condition)) ?? '',
    notes,
    sources: airportSource ? [source, airportSource] : [source],
    quality: {
      completeness,
      freshness,
      conflicts,
      reviewStatus,
    },
  };
}

export function createSourceRegistryForCatalog(features, generatedAt, records = [], options = {}) {
  const registry = cloneSourceRegistry();
  const priorityPassGeneratedAt = options.priorityPassGeneratedAt ?? generatedAt;
  const deskTravelBrandDb = registry.find((source) => source.id === 'desk-travel-brand-database');
  if (deskTravelBrandDb) {
    deskTravelBrandDb.records = getBrandRegistry().length;
    deskTravelBrandDb.lastRunAt = generatedAt;
  }

  const priorityPass = registry.find((source) => source.id === 'priority-pass');
  if (priorityPass) {
    priorityPass.records = records.filter((record) =>
      record.sources.some((source) => source.sourceId === 'priority-pass'),
    ).length;
    priorityPass.lastRunAt = priorityPassGeneratedAt;
    priorityPass.issues = features.filter((feature) => findQualityConflicts(feature.properties ?? feature).length > 0).length;
  }

  for (const source of registry) {
    if (['desk-travel-brand-database', 'priority-pass', 'ourairports'].includes(source.id)) {
      continue;
    }
    const sourceRecords = records.filter((record) => record.sources.some((item) => item.sourceId === source.id));
    if (sourceRecords.length > 0) {
      source.records = sourceRecords.length;
      source.lastRunAt = latestRetrievedAtForSource(sourceRecords, source.id, generatedAt);
      source.issues = sourceRecords.filter((record) => record.quality.reviewStatus !== 'approved').length;
    }
  }

  const ourAirports = registry.find((source) => source.id === 'ourairports');
  if (ourAirports) {
    ourAirports.records = new Set(features.map((feature) => clean((feature.properties ?? feature).airportCode))).size;
    ourAirports.lastRunAt = latestRetrievedAtForSource(records, 'ourairports', priorityPassGeneratedAt);
  }

  return registry;
}

export function summarizeQuality(canonicalRecords) {
  const count = canonicalRecords.length || 1;
  const completeness = canonicalRecords.reduce((sum, record) => sum + record.quality.completeness, 0);
  const freshness = canonicalRecords.reduce((sum, record) => sum + record.quality.freshness, 0);
  const conflictCount = canonicalRecords.reduce((sum, record) => sum + record.quality.conflicts.length, 0);
  const reviewQueue = canonicalRecords.filter((record) => record.quality.reviewStatus !== 'approved').length;

  return {
    averageCompleteness: Math.round(completeness / count),
    averageFreshness: Math.round(freshness / count),
    conflictCount,
    reviewQueue,
  };
}

export function createSchemaMetadata() {
  return {
    version: LOUNGE_GURU_SCHEMA_VERSION,
    fields: CANONICAL_SCHEMA_FIELDS,
  };
}

function normalizeIdentityText(value) {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[-–—]\s*[a-z0-9]{3}$/i, '')
    .replace(/\bby the club\b/g, '')
    .replace(/\bwith etihad airways\b/g, '')
    .replace(/\bby airport dimensions\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeKey(record) {
  const airportCode = clean(record.airport.iata).toUpperCase();
  const brandId = clean(record.lounge.brandAsset?.id) || normalizeIdentityText(record.lounge.brand);
  const name = normalizeIdentityText(record.lounge.name);
  return `${airportCode}|${brandId}|${name}`;
}

function hasKnownTerminal(record) {
  return hasValue(record.location.terminal);
}

function isLowDetailSourceOverlap(record) {
  const sourceIds = new Set(record.sources.map((source) => source.sourceId));
  return (
    !sourceIds.has('priority-pass') ||
    record.quality.conflicts.includes('airport_code_only') ||
    record.quality.conflicts.includes('missing_hours') ||
    !hasKnownTerminal(record)
  );
}

function canMergeCanonicalRecords(first, second) {
  if (dedupeKey(first) !== dedupeKey(second)) {
    return false;
  }
  if (!hasKnownTerminal(first) || !hasKnownTerminal(second)) {
    return true;
  }
  return normalizeIdentityText(first.location.terminal) === normalizeIdentityText(second.location.terminal);
}

function recordDetailScore(record) {
  return [
    hasValue(record.operations.hours) ? 40 : 0,
    hasKnownTerminal(record) ? 24 : 0,
    hasValue(record.location.directions) ? 14 : 0,
    record.amenities.length > 0 ? 10 : 0,
    record.restrictions.length > 0 ? 8 : 0,
    record.sources.some((source) => source.sourceId === 'priority-pass') ? 4 : 0,
    record.quality.completeness,
  ].reduce((sum, value) => sum + value, 0);
}

function pickValue(first, second) {
  return hasValue(first) ? first : second;
}

function mergeUniqueBySourceId(sources) {
  const bySourceId = new Map();
  for (const source of sources) {
    const existing = bySourceId.get(source.sourceId);
    if (!existing || source.confidence > existing.confidence) {
      bySourceId.set(source.sourceId, source);
    }
  }

  const priority = new Map([
    ['chase-sapphire', 0],
    ['amex-global-lounge-collection', 0],
    ['capital-one', 0],
    ['united', 0],
    ['delta', 0],
    ['american', 0],
    ['air-canada', 0],
    ['oneworld', 0],
    ['priority-pass', 1],
    ['ourairports', 2],
  ]);

  return [...bySourceId.values()].sort(
    (first, second) =>
      (priority.get(first.sourceId) ?? 1) - (priority.get(second.sourceId) ?? 1) ||
      first.publisher.localeCompare(second.publisher),
  );
}

function mergeCanonicalRecords(first, second) {
  const base = recordDetailScore(first) >= recordDetailScore(second) ? first : second;
  const overlay = base === first ? second : first;
  const sources = mergeUniqueBySourceId([...base.sources, ...overlay.sources]);
  const brandSource = [base, overlay].find((record) =>
    record.sources.some((source) => !['priority-pass', 'ourairports'].includes(source.sourceId)),
  );
  const brandRecord = brandSource ?? base;

  return {
    ...base,
    lounge: {
      ...base.lounge,
      brand: brandRecord.lounge.brand,
      brandAsset: brandRecord.lounge.brandAsset ?? base.lounge.brandAsset,
      operator: pickValue(base.lounge.operator, overlay.lounge.operator),
      programs: cleanList([...base.lounge.programs, ...overlay.lounge.programs]),
      accessMethods: cleanList([...base.lounge.accessMethods, ...overlay.lounge.accessMethods]),
      status: base.lounge.status === 'active' || overlay.lounge.status === 'active' ? 'active' : base.lounge.status,
    },
    airport: {
      ...base.airport,
      icao: pickValue(base.airport.icao, overlay.airport.icao),
      timezone: pickValue(base.airport.timezone, overlay.airport.timezone),
      coordinates: Number.isFinite(base.airport.coordinates.lat) ? base.airport.coordinates : overlay.airport.coordinates,
    },
    location: {
      terminal: pickValue(base.location.terminal, overlay.location.terminal),
      concourse: pickValue(base.location.concourse, overlay.location.concourse),
      gate: pickValue(base.location.gate, overlay.location.gate),
      securitySide: pickValue(base.location.securitySide, overlay.location.securitySide),
      directions: pickValue(base.location.directions, overlay.location.directions),
    },
    operations: {
      hours: pickValue(base.operations.hours, overlay.operations.hours),
      exceptions: cleanList([...base.operations.exceptions, ...overlay.operations.exceptions]),
      plannedOpening: pickValue(base.operations.plannedOpening, overlay.operations.plannedOpening),
      lastVerifiedAt: latestIsoDate([base.operations.lastVerifiedAt, overlay.operations.lastVerifiedAt], base.operations.lastVerifiedAt),
    },
    amenities: cleanList([...base.amenities, ...overlay.amenities]),
    restrictions: cleanList([...base.restrictions, ...overlay.restrictions]),
    guestPolicy: pickValue(base.guestPolicy, overlay.guestPolicy),
    notes: cleanList([...base.notes, ...overlay.notes, 'Merged duplicate source evidence.']),
    sources,
    quality: recordDetailScore(base) >= recordDetailScore(overlay) ? base.quality : overlay.quality,
  };
}

function dedupeCanonicalRecords(records) {
  const deduped = [];

  for (const record of records) {
    const existingIndex = deduped.findIndex((candidate) =>
      canMergeCanonicalRecords(candidate, record) && (isLowDetailSourceOverlap(candidate) || isLowDetailSourceOverlap(record)),
    );

    if (existingIndex === -1) {
      deduped.push(record);
      continue;
    }

    deduped[existingIndex] = mergeCanonicalRecords(deduped[existingIndex], record);
  }

  return deduped;
}

export function createCanonicalCatalog({ features, meta, additionalRecords = [] }) {
  const priorityPassGeneratedAt = meta.generatedAt ?? new Date().toISOString();
  const generatedAt = latestIsoDate(
    [priorityPassGeneratedAt, ...additionalRecords.flatMap((record) => (record.sources ?? []).map((source) => source.retrievedAt))],
    priorityPassGeneratedAt,
  );
  const rawRecords = [
    ...features.map((feature) => createCanonicalRecord(feature, { generatedAt: priorityPassGeneratedAt })),
    ...additionalRecords,
  ];
  const records = dedupeCanonicalRecords(rawRecords);
  const sources = createSourceRegistryForCatalog(features, generatedAt, records, { priorityPassGeneratedAt });
  const brands = getBrandRegistry();
  const deskTravelBrandImport = createDeskTravelBrandImport({ generatedAt });
  const quality = summarizeQuality(records);

  return {
    generatedAt,
    sourceFile: meta.sourceFile,
    schema: createSchemaMetadata(),
    stats: {
      ...meta.stats,
      totalCatalogRecords: records.length,
      candidateRecords: additionalRecords.length,
      nonPriorityRecords: records.filter((record) =>
        record.sources.some((source) => !['priority-pass', 'ourairports'].includes(source.sourceId)),
      ).length,
      duplicateSourceRecords: rawRecords.length - records.length,
      totalSources: sources.length,
      reviewQueue: quality.reviewQueue,
      approvedRecords: records.length - quality.reviewQueue,
    },
    filters: {
      ...meta.filters,
      providers: [...new Set(records.map((record) => record.lounge.brand).filter(Boolean))].sort(),
      programs: [...new Set(records.flatMap((record) => record.lounge.programs).filter(Boolean))].sort(),
      reviewStatuses: [...new Set(records.map((record) => record.quality.reviewStatus))].sort(),
    },
    quality,
    sources,
    brands,
    deskTravelBrandImport,
    records,
  };
}
