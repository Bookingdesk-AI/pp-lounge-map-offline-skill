function clean(value) {
  return String(value ?? '').trim();
}

function decodeEntities(value) {
  return String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;|&#39;|&apos;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, '-')
    .replace(/&mdash;|&#8212;/gi, '-')
    .replace(/[–—]/g, '-');
}

function stripHtml(value) {
  return decodeEntities(
    String(value ?? '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

function decodeFlightText(html) {
  return String(html ?? '')
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\u0026/g, '&');
}

function parseAssignments(html) {
  const decoded = decodeFlightText(html);
  const assignments = new Map();

  for (const match of decoded.matchAll(/(?:^|\n)([0-9a-f]+):(\{[^\n]*\}|\[[^\n]*\])/g)) {
    try {
      assignments.set(match[1], JSON.parse(match[2]));
    } catch {
      // React Flight rows may be split across chunks; only keep complete JSON rows.
    }
  }

  return assignments;
}

function resolveRefs(value, assignments, depth = 0) {
  if (depth > 12) {
    return value;
  }
  if (typeof value === 'string' && /^\$[0-9a-f]+$/.test(value)) {
    return resolveRefs(assignments.get(value.slice(1)), assignments, depth + 1);
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveRefs(item, assignments, depth + 1));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveRefs(item, assignments, depth + 1)]));
  }
  return value;
}

function richTextValue(node) {
  if (!node) {
    return '';
  }
  if (typeof node.value === 'string') {
    return node.value;
  }
  if (Array.isArray(node.content)) {
    return node.content.map(richTextValue).filter(Boolean).join(' ');
  }
  if (node.json) {
    return richTextValue(node.json);
  }
  return '';
}

function decimalHourToClock(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '';
  }
  const hour = Math.floor(numeric);
  const minutes = Math.round((numeric - hour) * 60);
  return `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function parseOpeningRange(value) {
  const text = Array.isArray(value) ? clean(value[0]) : clean(value);
  const match = text.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
  if (!match) {
    return null;
  }
  const opening = decimalHourToClock(match[1]);
  const closing = decimalHourToClock(match[2]);
  return opening && closing ? { opening, closing } : null;
}

function openHoursFromClub(club) {
  const fields = [
    ['mondayOpeningHours', 1],
    ['tuesdayOpeningHours', 2],
    ['wednesdayOpeningHours', 3],
    ['thursdayOpeningHours', 4],
    ['fridayOpeningHours', 5],
    ['saturdayOpeningHours', 6],
    ['sundayOpeningHours', 0],
  ];

  return fields
    .map(([field, day]) => {
      const range = parseOpeningRange(club[field]);
      if (!range) {
        return null;
      }
      return {
        Day: day,
        OpeningHour: range.opening,
        ClosingHour: range.closing,
      };
    })
    .filter(Boolean);
}

function terminalFromDescription(description) {
  const text = clean(description);
  const terminal = text.match(/\bTerminal\s+[A-Z0-9]+(?:\s*\/\s*[A-Z0-9]+)?/i)?.[0];
  if (terminal) {
    return terminal;
  }
  if (/main terminal/i.test(text)) {
    return 'Main Terminal';
  }
  return '';
}

function concourseFromDescription(description) {
  return clean(description).match(/\bConcourse\s+[A-Z0-9]+/i)?.[0] ?? '';
}

function detailLocationText(html) {
  const text = stripHtml(html);
  const match = text.match(/\bLocated\b\s+(.+?)\s+Address:/i);
  return clean(match?.[1] ?? '');
}

export function mergeTheClubDetailRecord(record, detailHtml) {
  const location = detailLocationText(detailHtml);
  if (!location) {
    return record;
  }

  return {
    ...record,
    near: location,
    accessNotes: `${record.accessNotes} Official detail page publishes the lounge location sentence.`,
  };
}

export function parseTheClubStructuredRecords(html) {
  const assignments = parseAssignments(html);
  const records = [];

  for (const raw of assignments.values()) {
    if (raw?.__typename !== 'Club') {
      continue;
    }
    const club = resolveRefs(raw, assignments);
    const title = clean(club.title);
    const code = title.match(/^([A-Z0-9]{3})\s*\|/)?.[1];
    if (!code) {
      continue;
    }

    const productTitle = clean(club.shopifyProductData?.title);
    const name = productTitle || `The Club ${code}`;
    const sourceUrl = `https://www.theclubairportlounges.com/lounges/${clean(club.slug)}`;
    const addressText = richTextValue(club.address);
    const airportName = clean(addressText.split(',')[0]);
    const terminal = terminalFromDescription(club.description) || terminalFromDescription(addressText) || clean(club.description);

    records.push({
      sourceRecordId: `${code}-${slugify(club.slug || name)}`,
      name,
      airportCode: code,
      airportName,
      terminal,
      concourse: concourseFromDescription(club.description) || concourseFromDescription(addressText),
      near: clean(club.description),
      operator: 'Airport Dimensions / The Club',
      openHours: openHoursFromClub(club),
      shopifyProductData: club.shopifyProductData,
      sourceUrl,
      accessNotes: 'Published Club Pass price and hours from the official The Club locations page.',
    });
  }

  const byId = new Map(records.map((record) => [record.sourceRecordId, record]));
  return [...byId.values()].sort((first, second) => `${first.airportCode}-${first.name}`.localeCompare(`${second.airportCode}-${second.name}`));
}
