function clean(value) {
  return String(value ?? '').trim();
}

function normalized(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isHttpsUrl(value) {
  try {
    return new URL(clean(value)).protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateOfficialAirlineHoursEvidence(evidence) {
  const issues = [];
  const rows = Array.isArray(evidence?.records) ? evidence.records : [];
  const targetIds = new Set();

  if (evidence?.policy?.mode !== 'manual_review_official_public') {
    issues.push('policy mode must be manual_review_official_public');
  }
  if (rows.length === 0) {
    issues.push('records must not be empty');
  }

  for (const [index, row] of rows.entries()) {
    const prefix = `records[${index}]`;
    for (const field of [
      'targetRecordId',
      'airportCode',
      'expectedName',
      'expectedTerminal',
      'sourceId',
      'publisher',
      'sourceLoungeName',
      'url',
      'retrievedAt',
      'hours',
      'rightsNote',
    ]) {
      if (!clean(row?.[field])) {
        issues.push(`${prefix}.${field} is required`);
      }
    }
    if (targetIds.has(row.targetRecordId)) {
      issues.push(`${prefix}.targetRecordId duplicates ${row.targetRecordId}`);
    }
    targetIds.add(row.targetRecordId);
    if (!/^[A-Z0-9]{3}$/.test(clean(row.airportCode))) {
      issues.push(`${prefix}.airportCode must be a 3-character airport code`);
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(clean(row.sourceId))) {
      issues.push(`${prefix}.sourceId is invalid`);
    }
    if (!isHttpsUrl(row.url)) {
      issues.push(`${prefix}.url must use HTTPS`);
    }
    if (!Number.isFinite(Date.parse(row.retrievedAt))) {
      issues.push(`${prefix}.retrievedAt must be an ISO timestamp`);
    }
    if (!(Number(row.confidence) >= 0.9 && Number(row.confidence) <= 1)) {
      issues.push(`${prefix}.confidence must be between 0.9 and 1`);
    }
  }

  return issues;
}

export function assertOfficialAirlineHoursEvidence(evidence) {
  const issues = validateOfficialAirlineHoursEvidence(evidence);
  if (issues.length > 0) {
    throw new Error(`Official airline hours evidence is invalid:\n- ${issues.join('\n- ')}`);
  }
  return evidence.records;
}

export function applyOfficialAirlineHoursEvidence(records, evidence) {
  const rows = assertOfficialAirlineHoursEvidence(evidence);
  const recordsById = new Map(records.map((record) => [record.lounge.id, record]));
  const replacements = new Map();

  for (const row of rows) {
    const record = recordsById.get(row.targetRecordId);
    if (!record) {
      throw new Error(`Official airline hours target is missing: ${row.targetRecordId}`);
    }
    if (clean(record.airport.iata).toUpperCase() !== clean(row.airportCode).toUpperCase()) {
      throw new Error(`Official airline hours airport mismatch: ${row.targetRecordId}`);
    }
    if (normalized(record.lounge.name) !== normalized(row.expectedName)) {
      throw new Error(`Official airline hours lounge mismatch: ${row.targetRecordId}`);
    }
    if (normalized(record.location.terminal) !== normalized(row.expectedTerminal)) {
      throw new Error(`Official airline hours terminal mismatch: ${row.targetRecordId}`);
    }
    if (clean(record.operations.hours) && clean(record.operations.hours) !== clean(row.hours)) {
      throw new Error(`Official airline hours conflict: ${row.targetRecordId}`);
    }

    const fieldCoverage = ['operations.hours'];
    const existingGate = clean(record.location.gate);
    const evidenceGate = clean(row.gate);
    const existingExactGate = /^Gates?\s+[A-Z]?\d/i.test(existingGate);
    if (evidenceGate) {
      if (existingExactGate && normalized(existingGate) !== normalized(evidenceGate)) {
        throw new Error(`Official airline gate conflict: ${row.targetRecordId}`);
      }
      fieldCoverage.push('location.gate');
    }

    const evidenceSource = {
      sourceId: row.sourceId,
      publisher: row.publisher,
      url: row.url,
      retrievedAt: row.retrievedAt,
      fieldCoverage,
      confidence: row.confidence,
      rightsNote: row.rightsNote,
    };
    const sources = [...record.sources.filter((source) => source.sourceId !== row.sourceId), evidenceSource];

    replacements.set(row.targetRecordId, {
      ...record,
      location: {
        ...record.location,
        gate: evidenceGate || record.location.gate,
      },
      operations: {
        ...record.operations,
        hours: row.hours,
        lastVerifiedAt: row.retrievedAt,
      },
      notes: [
        ...new Set([
          ...(record.notes ?? []),
          `Official ${row.publisher} page supplied one-to-one operating-hours evidence for ${row.sourceLoungeName}.`,
        ]),
      ],
      sources,
    });
  }

  return records.map((record) => replacements.get(record.lounge.id) ?? record);
}
