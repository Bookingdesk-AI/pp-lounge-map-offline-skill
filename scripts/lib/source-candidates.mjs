import { cloneSourceRegistry } from './source-registry.mjs';
import { resolveBrandAsset } from './brand-registry.mjs';

function clean(value) {
  return String(value ?? '').trim();
}

function slugify(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function unique(values) {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function hasValue(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return clean(value) !== '' && clean(value) !== 'Unknown';
}

function sourceById() {
  return new Map(cloneSourceRegistry().map((source) => [source.id, source]));
}

function makeAirportLookup(features) {
  const lookup = new Map();
  for (const feature of features ?? []) {
    const properties = feature.properties ?? {};
    const code = clean(properties.airportCode).toUpperCase();
    const [lon, lat] = feature.geometry?.coordinates ?? [];
    if (!/^[A-Z0-9]{3}$/.test(code) || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
      continue;
    }
    if (!lookup.has(code)) {
      lookup.set(code, {
        iata: code,
        name: clean(properties.airportName),
        city: clean(properties.city),
        country: clean(properties.country),
        coordinates: {
          lat: Number(lat),
          lon: Number(lon),
        },
      });
    }
  }
  return lookup;
}

function codesFromLinks(sourceId, links) {
  const candidates = [];

  for (const link of links ?? []) {
    let url;
    try {
      url = new URL(link);
    } catch {
      continue;
    }

    if (sourceId === 'chase-sapphire') {
      const match = url.pathname.match(/\/sapphire-cards\/lounges\/([a-z]{3})(?:-|\/|$)/i);
      if (match) {
        candidates.push({ code: match[1].toUpperCase(), url: url.toString() });
      }
      continue;
    }

    if (sourceId === 'amex-global-lounge-collection') {
      const match = url.pathname.match(/\/travel\/lounges\/the-platinum-card\/([A-Z]{3})\/?$/i);
      if (match) {
        candidates.push({ code: match[1].toUpperCase(), url: url.toString() });
      }
      continue;
    }

    if (sourceId === 'capital-one') {
      const airportId = url.searchParams.get('airportId');
      if (/^[A-Z0-9]{3}$/.test(airportId ?? '')) {
        candidates.push({ code: airportId.toUpperCase(), url: url.toString() });
      }
    }
  }

  return candidates;
}

function codesFromAirportMentions(source) {
  if (source.sourceId === 'escape-lounges') {
    return (source.childPages ?? [])
      .filter((page) => page.status === 'fetched')
      .flatMap((page) =>
        (page.airportCodes ?? [])
          .filter((code) => page.title?.includes(`(${code})`))
          .map((code) => ({
            code: clean(code).toUpperCase(),
            url: page.finalUrl || page.url,
          })),
      );
  }

  if (!['air-canada', 'airport-dimensions'].includes(source.sourceId)) {
    return [];
  }
  return (source.airportCodes ?? []).map((code) => ({
    code: clean(code).toUpperCase(),
    url: source.finalUrl || source.url,
  }));
}

function candidateLabel(sourceId, airportCode) {
  const labels = {
    'chase-sapphire': 'Chase Sapphire Lounge',
    'amex-global-lounge-collection': 'American Express lounge access',
    'capital-one': 'Capital One Lounge',
    'air-canada': 'Air Canada Maple Leaf Lounge',
    'airport-dimensions': 'Airport Dimensions / The Club',
    'escape-lounges': 'Escape Lounge',
    'oneworld': 'oneworld lounge access',
    'no1-lounges': 'No1 Lounge',
    'marhaba': 'Marhaba Lounge',
  };
  return `${labels[sourceId] ?? sourceId} - ${airportCode}`;
}

function programsForSource(sourceId) {
  const programs = {
    'chase-sapphire': ['Chase Sapphire Reserve'],
    'amex-global-lounge-collection': ['American Express Platinum'],
    'capital-one': ['Capital One Venture X'],
    'air-canada': ['Air Canada Maple Leaf Lounge'],
    'airport-dimensions': ['The Club', 'Priority Pass'],
    'escape-lounges': ['Escape Lounges'],
    oneworld: ['oneworld Emerald', 'oneworld Sapphire', 'Premium cabin'],
    'no1-lounges': ['No1 Lounges'],
    marhaba: ['Marhaba'],
  };
  return programs[sourceId] ?? [];
}

function accessMethodsForSource(sourceId) {
  const methods = {
    'chase-sapphire': ['cardholder'],
    'amex-global-lounge-collection': ['cardholder'],
    'capital-one': ['cardholder'],
    'air-canada': ['airline status', 'premium cabin'],
    'airport-dimensions': ['membership', 'partner access'],
    'escape-lounges': ['cardholder', 'paid access'],
    oneworld: ['alliance status', 'premium cabin'],
    'no1-lounges': ['paid access', 'partner access'],
    marhaba: ['paid access'],
  };
  return methods[sourceId] ?? ['manual review'];
}

function confidenceForSource(sourceId, fromLink) {
  if (fromLink && ['chase-sapphire', 'capital-one'].includes(sourceId)) {
    return 0.62;
  }
  if (fromLink && sourceId === 'amex-global-lounge-collection') {
    return 0.55;
  }
  return 0.48;
}

function completenessForSource(sourceId, fromLink) {
  if (fromLink && ['chase-sapphire', 'capital-one'].includes(sourceId)) {
    return 54;
  }
  if (fromLink && sourceId === 'amex-global-lounge-collection') {
    return 48;
  }
  return 42;
}

function conflictsForSource(sourceId, fromLink) {
  const conflicts = ['manual_review_required', 'missing_hours', 'unknown_terminal', 'missing_amenities'];
  if (!fromLink) {
    conflicts.push('airport_code_only');
  }
  if (sourceId === 'amex-global-lounge-collection') {
    conflicts.push('program_page_not_operator_record');
  }
  return conflicts;
}

function makeCandidateRecord({ source, registryEntry, airport, code, url, retrievedAt, fromLink }) {
  const name = candidateLabel(source.sourceId, code);
  const brandAsset = resolveBrandAsset(registryEntry.publisher, name, source.sourceId);

  return {
    lounge: {
      id: `candidate-${source.sourceId}-${code.toLowerCase()}-${slugify(registryEntry.publisher)}`,
      name,
      brand: registryEntry.publisher,
      brandAsset,
      operator: registryEntry.publisher,
      category: 'lounge',
      status: 'candidate',
      programs: programsForSource(source.sourceId),
      accessMethods: accessMethodsForSource(source.sourceId),
    },
    airport: {
      iata: code,
      icao: '',
      name: airport.name,
      city: airport.city,
      country: airport.country,
      timezone: '',
      coordinates: airport.coordinates,
    },
    location: {
      terminal: 'Unknown',
      concourse: '',
      gate: '',
      securitySide: '',
      directions: '',
    },
    operations: {
      hours: '',
      exceptions: [],
      plannedOpening: '',
      lastVerifiedAt: retrievedAt,
    },
    amenities: [],
    restrictions: [],
    guestPolicy: '',
    notes: ['Candidate imported from official public source intake.'],
    sources: [
      {
        sourceId: source.sourceId,
        publisher: registryEntry.publisher,
        url,
        retrievedAt,
        fieldCoverage: fromLink
          ? ['lounge.brand', 'airport.iata', 'source.url']
          : ['lounge.brand', 'airport.iata'],
        confidence: confidenceForSource(source.sourceId, fromLink),
        rightsNote: registryEntry.rightsNote,
      },
    ],
    quality: {
      completeness: completenessForSource(source.sourceId, fromLink),
      freshness: 100,
      conflicts: conflictsForSource(source.sourceId, fromLink),
      reviewStatus: 'review',
    },
  };
}

function cleanHours(openHours) {
  if (!Array.isArray(openHours) || openHours.length === 0) {
    return '';
  }

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return openHours
    .map((slot) => {
      const day = dayLabels[Number(slot.Day)] ?? String(slot.Day ?? '');
      if (slot.OpenAllDay) {
        return `${day} 24 hours`;
      }
      if (slot.CloseAllDay) {
        return `${day} closed`;
      }
      if (!slot.OpeningHour || !slot.ClosingHour) {
        return '';
      }
      return `${day} ${slot.OpeningHour}-${slot.ClosingHour}`;
    })
    .filter(Boolean)
    .join('; ');
}

function amenitiesFromStructuredRecord(record) {
  const labels = {
    BusinessCenter: 'Business center',
    TV: 'TV',
    FoodBeverageSnackBuffet: 'Snacks',
    Phone: 'Phone',
    PreFlightDinner: 'Pre-flight dining',
    RelaxationRoom: 'Relaxation room',
    Shower: 'Shower',
    SPA: 'Spa',
    WheelchairAccess: 'Wheelchair access',
    WiFi: 'Wi-Fi',
    FoodBeverageHotBuffet: 'Hot buffet',
    AirConditioning: 'Air conditioning',
    Restroom: 'Restroom',
    RunwayViews: 'Runway views',
    FlighInformationScreen: 'Flight information screens',
  };

  return Object.entries(record.amenities ?? {})
    .filter(([, available]) => available)
    .map(([key]) => labels[key] ?? key);
}

function coordinatesFromStructuredRecord(record, fallbackAirport) {
  const lat = Number(record.airportCoordinates?.lat);
  const lon = Number(record.airportCoordinates?.lon);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return { lat, lon };
  }
  return fallbackAirport?.coordinates;
}

function makeStructuredCandidateRecord({ source, registryEntry, record, airport, retrievedAt }) {
  const code = clean(record.airportCode).toUpperCase();
  const coordinates = coordinatesFromStructuredRecord(record, airport);
  const sourceRecordId = slugify(record.sourceRecordId || `${code}-${record.name}`);
  const name = clean(record.name) || candidateLabel(source.sourceId, code);
  const brandAsset = resolveBrandAsset(registryEntry.publisher, name, source.sourceId);
  const terminal = clean(record.terminal) || 'Unknown';
  const locationParts = unique([record.concourse, record.near, record.securitySide]);
  const accessPrograms = unique([...programsForSource(source.sourceId), record.accessTier, record.accessClass]);
  const restrictions = unique([record.accessConditions, record.accessNotes]);
  const amenities = amenitiesFromStructuredRecord(record);
  const hours = cleanHours(record.openHours);
  const conflicts = ['manual_review_required'];
  const sourceHasAmenityBooleans = Object.keys(record.amenities ?? {}).length > 0;

  if (!hours) {
    conflicts.push('missing_hours');
  }
  if (terminal === 'Unknown') {
    conflicts.push('unknown_terminal');
  }
  if (!sourceHasAmenityBooleans) {
    conflicts.push('missing_amenities');
  }
  const canApprove = conflicts.length === 1;

  return {
    lounge: {
      id: `candidate-${source.sourceId}-${code.toLowerCase()}-${sourceRecordId}`,
      name,
      brand: registryEntry.publisher,
      brandAsset,
      operator: clean(record.operator) || registryEntry.publisher,
      category: 'lounge',
      status: 'candidate',
      programs: accessPrograms,
      accessMethods: accessMethodsForSource(source.sourceId),
    },
    airport: {
      iata: code,
      icao: '',
      name: clean(record.airportName) || airport?.name || code,
      city: airport?.city || clean(record.airportCity),
      country: airport?.country || '',
      timezone: '',
      coordinates,
    },
    location: {
      terminal,
      concourse: clean(record.concourse),
      gate: '',
      securitySide: clean(record.securitySide),
      directions: locationParts.join(', '),
    },
    operations: {
      hours,
      exceptions: [],
      plannedOpening: '',
      lastVerifiedAt: retrievedAt,
    },
    amenities,
    restrictions,
    guestPolicy: restrictions.find((restriction) => /guest|eligible|access/i.test(restriction)) ?? '',
    notes: ['Candidate imported from official public source intake.'],
    sources: [
      {
        sourceId: source.sourceId,
        publisher: registryEntry.publisher,
        url: source.structuredApi?.loungeUrlTemplate
          ? `${source.structuredApi.loungeUrlTemplate.replace('{airportCode}', code)}`
          : source.finalUrl || source.url,
        retrievedAt,
        fieldCoverage: [
          'lounge.name',
          'airport.iata',
          'airport.name',
          'location.terminal',
          'operations.hours',
          'amenities',
          'restrictions',
        ],
        confidence: canApprove ? 0.82 : 0.68,
        rightsNote: registryEntry.rightsNote,
      },
    ],
    quality: {
      completeness: canApprove ? 86 : 68,
      freshness: 100,
      conflicts: canApprove ? [] : conflicts,
      reviewStatus: canApprove ? 'approved' : 'review',
    },
  };
}

export function createNonPriorityCandidateRecords({ report, features, generatedAt }) {
  const registry = sourceById();
  const airportLookup = makeAirportLookup(features);
  const records = [];

  for (const source of report?.sources ?? []) {
    if (source.sourceId === 'priority-pass' || source.status !== 'fetched') {
      continue;
    }

    const registryEntry = registry.get(source.sourceId);
    if (!registryEntry) {
      continue;
    }

    for (const structuredRecord of source.structuredRecords ?? []) {
      const code = clean(structuredRecord.airportCode).toUpperCase();
      const fallbackAirport = airportLookup.get(code);
      const coordinates = coordinatesFromStructuredRecord(structuredRecord, fallbackAirport);
      if (!/^[A-Z0-9]{3}$/.test(code) || !coordinates) {
        continue;
      }
      records.push(
        makeStructuredCandidateRecord({
          source,
          registryEntry,
          record: structuredRecord,
          airport: fallbackAirport,
          retrievedAt: report.generatedAt ?? generatedAt,
        }),
      );
    }

    const linkCandidates = codesFromLinks(source.sourceId, source.loungeLinks ?? []);
    const mentionCandidates = codesFromAirportMentions(source);
    const byCode = new Map();

    for (const candidate of [...linkCandidates, ...mentionCandidates]) {
      if (!/^[A-Z0-9]{3}$/.test(candidate.code) || !airportLookup.has(candidate.code)) {
        continue;
      }
      const current = byCode.get(candidate.code);
      if (!current || (!current.fromLink && linkCandidates.some((item) => item.code === candidate.code))) {
        byCode.set(candidate.code, {
          ...candidate,
          fromLink: linkCandidates.some((item) => item.code === candidate.code),
        });
      }
    }

    for (const candidate of [...byCode.values()].sort((first, second) => first.code.localeCompare(second.code))) {
      records.push(
        makeCandidateRecord({
          source,
          registryEntry,
          airport: airportLookup.get(candidate.code),
          code: candidate.code,
          url: candidate.url || source.finalUrl || source.url,
          retrievedAt: report.generatedAt ?? generatedAt,
          fromLink: candidate.fromLink,
        }),
      );
    }
  }

  return unique(records.map((record) => record.lounge.id)).map((id) =>
    records.find((record) => record.lounge.id === id),
  );
}

function makeStructuredLookup(report) {
  const lookup = new Map();
  for (const source of report?.sources ?? []) {
    for (const record of source.structuredRecords ?? []) {
      const key = `${source.sourceId}|${clean(record.airportCode).toUpperCase()}|${clean(record.name).toLowerCase()}`;
      lookup.set(key, record);
    }
  }
  return lookup;
}

function makeSourceEvidenceLookup(report) {
  const lookup = new Map();
  for (const source of report?.sources ?? []) {
    const codes = new Set(source.airportCodes ?? []);
    for (const candidate of codesFromLinks(source.sourceId, source.loungeLinks ?? [])) {
      codes.add(candidate.code);
    }
    for (const page of source.childPages ?? []) {
      for (const code of page.airportCodes ?? []) {
        codes.add(clean(code).toUpperCase());
      }
    }
    lookup.set(source.sourceId, {
      status: source.status,
      airportCodes: codes,
      hasStructuredRecords: (source.structuredRecords ?? []).length > 0,
    });
  }
  return lookup;
}

function increment(summary, key, count = 1) {
  const normalizedKey = clean(key) || 'unknown';
  summary[normalizedKey] = (summary[normalizedKey] ?? 0) + count;
  return summary;
}

function buildReviewAction({ row, checks }) {
  if (row.reviewStatus === 'approved') {
    return {
      queue: 'publishable',
      action: 'publish',
      reason: 'official_structured_payload_complete',
    };
  }

  const missing = [];
  if (!checks.structuredPayloadMatch) {
    missing.push('structured_payload');
  }
  if (!checks.hasHours) {
    missing.push('hours');
  }
  if (!checks.hasTerminal) {
    missing.push('terminal');
  }
  if (!checks.hasSourceUrl) {
    missing.push('source_url');
  }
  if (!checks.airportEvidenceMatch) {
    missing.push('airport_evidence');
  }
  if (!checks.hasCountry) {
    missing.push('country');
  }

  return {
    queue: row.validationStatus === 'airport_code_evidence_only' ? 'official_airport_code_review' : 'source_evidence_review',
    action: 'manual_review',
    reason: missing.length > 0 ? `missing_${missing.join('_')}` : 'manual_review_required',
  };
}

function summarizeValidationRows(rows) {
  const byStatus = {};
  const byDecision = {};
  const bySourceDecision = {};
  const byReviewQueue = {};
  const byConflict = {};

  for (const row of rows) {
    increment(byStatus, row.validationStatus);
    increment(byDecision, row.reviewStatus);
    increment(byReviewQueue, row.reviewAction.queue);

    const sourceSummary = bySourceDecision[row.sourceId] ?? {
      sourceId: row.sourceId,
      publisher: row.publisher,
      total: 0,
      approved: 0,
      review: 0,
      publishable: 0,
      manualReview: 0,
    };
    sourceSummary.total += 1;
    sourceSummary[row.reviewStatus] = (sourceSummary[row.reviewStatus] ?? 0) + 1;
    if (row.reviewAction.action === 'publish') {
      sourceSummary.publishable += 1;
    }
    if (row.reviewAction.action === 'manual_review') {
      sourceSummary.manualReview += 1;
    }
    bySourceDecision[row.sourceId] = sourceSummary;

    for (const conflict of row.conflicts) {
      increment(byConflict, conflict);
    }
  }

  return {
    byStatus,
    byDecision,
    byReviewQueue,
    byConflict,
    bySourceDecision: Object.values(bySourceDecision).sort((first, second) =>
      first.sourceId.localeCompare(second.sourceId),
    ),
  };
}

export function createNonPriorityValidationReport({ records, report, generatedAt }) {
  const nonPriorityRecords = records.filter((record) => record.sources[0]?.sourceId !== 'priority-pass');
  const structuredLookup = makeStructuredLookup(report);
  const sourceEvidenceLookup = makeSourceEvidenceLookup(report);
  const rows = nonPriorityRecords.map((record) => {
    const primarySource = record.sources[0];
    const sourceId = primarySource.sourceId;
    const airportCode = clean(record.airport.iata).toUpperCase();
    const structuredKey = `${sourceId}|${airportCode}|${clean(record.lounge.name).toLowerCase()}`;
    const structuredRecord = structuredLookup.get(structuredKey);
    const sourceEvidence = sourceEvidenceLookup.get(sourceId);
    const checks = {
      officialSourceFetched: sourceEvidence?.status === 'fetched',
      structuredPayloadMatch: Boolean(structuredRecord),
      airportEvidenceMatch: Boolean(sourceEvidence?.airportCodes.has(airportCode)),
      nameMatch: structuredRecord ? clean(structuredRecord.name) === clean(record.lounge.name) : false,
      terminalMatch: structuredRecord ? clean(structuredRecord.terminal || 'Unknown') === clean(record.location.terminal) : false,
      hasHours: hasValue(record.operations.hours),
      hasTerminal: hasValue(record.location.terminal),
      hasCoordinates:
        Number.isFinite(Number(record.airport.coordinates?.lat)) &&
        Number.isFinite(Number(record.airport.coordinates?.lon)),
      hasCountry: hasValue(record.airport.country),
      hasSourceUrl: primarySource.url.startsWith('https://'),
    };
    const validationStatus = checks.structuredPayloadMatch
      ? 'verified_official_structured_payload'
      : checks.airportEvidenceMatch
        ? 'airport_code_evidence_only'
        : 'unmatched_source_evidence';

    const row = {
      recordId: record.lounge.id,
      sourceId,
      publisher: primarySource.publisher,
      name: record.lounge.name,
      airportCode,
      airportName: record.airport.name,
      city: record.airport.city,
      country: record.airport.country,
      terminal: record.location.terminal,
      sourceUrl: primarySource.url,
      validationStatus,
      reviewStatus: record.quality.reviewStatus,
      confidence: primarySource.confidence,
      conflicts: record.quality.conflicts,
      checks,
    };
    return {
      ...row,
      reviewAction: buildReviewAction({ row, checks }),
    };
  });
  const summary = summarizeValidationRows(rows);

  return {
    generatedAt,
    policy: {
      approvalRule:
        'Only exact official structured payload matches with hours, terminal, coordinates, and source URL can be approved.',
      reviewRule: 'Airport-code-only, link-only, missing-hour, missing-terminal, or unmatched records remain review-only.',
      lineReviewRule:
        'Every non-Priority Pass candidate must have a reviewAction before catalog promotion.',
    },
    stats: {
      total: rows.length,
      byStatus: summary.byStatus,
      byDecision: summary.byDecision,
      byReviewQueue: summary.byReviewQueue,
      byConflict: summary.byConflict,
      bySourceDecision: summary.bySourceDecision,
      unmatched: rows.filter((row) => row.validationStatus === 'unmatched_source_evidence').length,
    },
    rows,
  };
}
