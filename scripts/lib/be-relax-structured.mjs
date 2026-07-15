function decodeEntities(value) {
  return String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, '-')
    .replace(/&mdash;|&#8212;/gi, '-')
    .replace(/[–—]/g, '-');
}

function clean(value) {
  return decodeEntities(value).replace(/\s+/g, ' ').trim();
}

function slugify(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

function nextData(html) {
  const match = String(html ?? '').match(
    /<script\s+id=["']__NEXT_DATA__["']\s+type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!match) {
    return null;
  }

  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

const DAY_INDEX = new Map([
  ['Sun', 0],
  ['Mon', 1],
  ['Tue', 2],
  ['Wed', 3],
  ['Thu', 4],
  ['Fri', 5],
  ['Sat', 6],
]);

function clock(value) {
  const normalized = clean(value)
    .replace(/\./g, '')
    .replace(/\bpmm\b/gi, 'pm')
    .replace(/\bamm\b/gi, 'am');
  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) {
    return '';
  }

  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const meridiem = match[3]?.toLowerCase();
  if (meridiem === 'pm' && hour < 12) {
    hour += 12;
  }
  if (meridiem === 'am' && hour === 12) {
    hour = 0;
  }
  if (!Number.isFinite(hour) || hour > 24 || !Number.isFinite(minute) || minute > 59) {
    return '';
  }
  if (hour === 24 && minute !== 0) {
    return '';
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function allDayHours() {
  return [1, 2, 3, 4, 5, 6, 0].map((day) => ({ Day: day, OpenAllDay: true }));
}

function hoursFromTimeRows(rows) {
  const parsed = [];
  for (const row of rows ?? []) {
    const day = DAY_INDEX.get(clean(row.day));
    const times = Array.isArray(row.time) ? row.time.map(clock).filter(Boolean) : [];
    if (day === undefined || times.length < 2) {
      continue;
    }
    const opening = times[0];
    const closing = times[times.length - 1];
    if (opening === '00:00' && closing === '24:00') {
      parsed.push({ Day: day, OpenAllDay: true });
      continue;
    }
    parsed.push({ Day: day, OpeningHour: opening, ClosingHour: closing === '24:00' ? '00:00' : closing });
  }
  return parsed.length === 7 ? parsed.sort((first, second) => first.Day - second.Day) : [];
}

function hoursFromBooktime(value) {
  const text = clean(value)
    .replace(/\bto\b/gi, '-')
    .replace(/\bpmm\b/gi, 'pm')
    .replace(/\bamm\b/gi, 'am');
  if (/^7\/7\s+/i.test(text)) {
    const match = text.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    const opening = clock(match?.[1]);
    const closing = clock(match?.[2]);
    return opening && closing
      ? [1, 2, 3, 4, 5, 6, 0].map((day) => ({ Day: day, OpeningHour: opening, ClosingHour: closing }))
      : [];
  }

  const rows = [];
  const regex = /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/gi;
  for (const match of text.matchAll(regex)) {
    const day = DAY_INDEX.get(match[1]);
    const opening = clock(match[2]);
    const closing = clock(match[3]);
    if (day !== undefined && opening && closing) {
      rows.push({ Day: day, OpeningHour: opening, ClosingHour: closing });
    }
  }

  if (rows.length === 7 && rows.every((row) => row.OpeningHour === '00:00' && row.ClosingHour === '12:00')) {
    return allDayHours();
  }
  return rows.length === 7 ? rows.sort((first, second) => first.Day - second.Day) : [];
}

function openHours(row) {
  const fromTimeRows = hoursFromTimeRows(row.time);
  return fromTimeRows.length > 0 ? fromTimeRows : hoursFromBooktime(row.booktime);
}

function normalizedAirportCode(row) {
  const rawCode = clean(row.shortTitle).toUpperCase();
  const airportName = clean(row.skyCat?.name || row.title || row.fullName);
  const link = clean(row.link);
  if (rawCode === 'CLA' && /Charlotte Douglas/i.test(airportName) && /charlotte-douglas/i.test(link)) {
    return 'CLT';
  }
  return /^[A-Z0-9]{3}$/.test(rawCode) ? rawCode : '';
}

function terminalFromText(value) {
  const text = clean(value);
  return (
    text.match(/\bTerminal\s+International\s+Tom\s+Bradley\b/i)?.[0] ||
    text.match(/\bTerminal\s+[A-Z0-9]+(?:\s+West)?\b/i)?.[0] ||
    text.match(/\bMcNamara\s+Terminal\b/i)?.[0] ||
    text.match(/\bConcourse\s+[A-Z](?:\/[A-Z])?\b/i)?.[0] ||
    text.match(/\bConnector\s+[A-Z](?:\/[A-Z])?\b/i)?.[0] ||
    ''
  );
}

function concourseFromText(value) {
  return clean(value).match(/\bConcourse\s+[A-Z](?:\/[A-Z])?\b/i)?.[0] ?? '';
}

function sourceUrl(row) {
  const link = clean(row.link);
  return link ? new URL(link, 'https://berelax.com').toString() : 'https://berelax.com/find-us/';
}

function airportCoordinates(row) {
  const lat = Number(row.locations?.lat);
  const lon = Number(row.locations?.lng);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : undefined;
}

function beRelaxRows(html) {
  const data = nextData(html);
  return (data?.props?.pageProps?.hydrationData?.airports ?? []).flatMap((group) =>
    Array.isArray(group.list) ? group.list : [],
  );
}

export function parseBeRelaxStructuredRecords(html) {
  const records = [];
  for (const row of beRelaxRows(html)) {
    const airportCode = normalizedAirportCode(row);
    const nameText = clean(row.fullName);
    const locationText = clean(row.text);
    const hours = openHours(row);
    if (!airportCode || !nameText || !locationText || hours.length === 0) {
      continue;
    }

    const terminal = terminalFromText(locationText) || terminalFromText(nameText) || 'Unknown';
    const concourse = concourseFromText(locationText);
    const url = sourceUrl(row);
    records.push({
      sourceRecordId: `be-relax-${airportCode.toLowerCase()}-${slugify(row.slug || nameText)}`,
      name: `Be Relax Spa ${airportCode} ${locationText}`,
      brand: 'Be Relax',
      operator: 'Be Relax',
      airportCode,
      airportName: clean(row.skyCat?.name) || clean(row.title) || `${airportCode} Airport`,
      airportCountry: clean(row.country),
      airportCoordinates: airportCoordinates(row),
      terminal,
      concourse,
      near: locationText,
      sourceUrl: url,
      programs: ['Be Relax'],
      openHours: hours,
      amenities: {
        Lounge: true,
        SPA: true,
        RelaxationRoom: true,
      },
      accessNotes: 'Official Be Relax location page with terminal or gate-area text and operating hours.',
    });
  }

  const byId = new Map(records.map((record) => [record.sourceRecordId, record]));
  return [...byId.values()].sort((first, second) =>
    `${first.airportCode}-${first.name}`.localeCompare(`${second.airportCode}-${second.name}`),
  );
}
