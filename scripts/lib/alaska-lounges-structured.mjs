function decodeEntities(value) {
  return String(value ?? '')
    .replace(/&nbsp;|&#160;/gi, ' ')
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

function stripHtml(value) {
  return clean(
    String(value ?? '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  );
}

function slugify(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

function parseClock(value) {
  const match = clean(value).match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (!match) {
    return '';
  }
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const meridiem = match[3].toLowerCase();
  if (meridiem === 'pm' && hour < 12) {
    hour += 12;
  }
  if (meridiem === 'am' && hour === 12) {
    hour = 0;
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function dailyHours(value) {
  const match = clean(value).match(/(?:Daily:\s*)?(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);
  if (!match) {
    return [];
  }
  const opening = parseClock(match[1]);
  const closing = parseClock(match[2]);
  if (!opening || !closing) {
    return [];
  }
  return [1, 2, 3, 4, 5, 6, 0].map((day) => ({
    Day: day,
    OpeningHour: opening,
    ClosingHour: closing,
  }));
}

function terminalFromLocation(value) {
  const text = clean(value);
  const terminal = text.match(/\bTerminal\s+[A-Z0-9]+\b/i)?.[0];
  if (terminal) {
    return terminal.replace(/\bterminal\b/i, 'Terminal');
  }
  const concourse = text.match(/\b(?:Concourse\s+[A-Z]|[A-Z]\s+Concourse)\b/i)?.[0];
  if (concourse) {
    const letter = concourse.match(/[A-Z]/i)?.[0]?.toUpperCase();
    return letter ? `Concourse ${letter}` : '';
  }
  if (/\bNorth Satellite\b/i.test(text)) {
    return 'N Concourse';
  }
  if (/\bSouth Hall\b/i.test(text)) {
    return 'South Hall';
  }
  return '';
}

function normalizedLocation(value) {
  return clean(value)
    .replace(/\bGate\s+([A-Z])-([0-9]+)/gi, 'Gate $1$2')
    .replace(/\bGates\s+([A-Z])(\d+)-(\d+)/gi, (_match, letter, first, second) =>
      `Gates ${letter.toUpperCase()}${first}-${letter.toUpperCase()}${second}`,
    );
}

function tableRows(html) {
  const table = String(html ?? '').match(/<table[\s\S]*?<th[\s\S]*?Lounge pass available\?[\s\S]*?<\/table>/i)?.[0] ?? '';
  return [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => match[1]);
}

export function parseAlaskaLoungePass(html, { url = 'https://www.alaskaair.com/content/airport-lounge/day-pass' } = {}) {
  const text = stripHtml(html);
  const amount = Number(text.match(/Single-entry Lounge passes are \$([0-9]+(?:\.[0-9]{1,2})?) USD per person/i)?.[1]);
  const capacityRestricted = /based on space available|capacity (?:may be managed|restrictions?)/i.test(text);
  const eligibleTravel = text.match(
    /same-day, ticketed air travel on Alaska or Hawaiian Airlines, a fellow one\s*world member airline, or one of our additional global partners/i,
  )?.[0];
  if (!Number.isFinite(amount) || amount <= 0 || !capacityRestricted || !eligibleTravel) {
    return null;
  }
  return {
    amount,
    currencyCode: 'USD',
    label: `USD ${amount} Single-Entry Lounge Pass`,
    sourceUrl: url,
    eligibility: eligibleTravel,
    capacityRestricted: true,
  };
}

export function parseAlaskaLoungeRecords(html, { url = 'https://www.alaskaair.com/content/airport-lounge/location-and-hours' } = {}) {
  const records = [];
  for (const row of tableRows(html)) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => stripHtml(match[1]));
    if (cells.length < 3) {
      continue;
    }
    const airportCode = cells[0].match(/\(([A-Z0-9]{3})\)/)?.[1] ?? '';
    const airportName = clean(cells[0].replace(/\s*\([A-Z0-9]{3}\)\s*$/, ''));
    const location = normalizedLocation(cells[1]);
    const terminal = terminalFromLocation(location);
    const openHours = dailyHours(cells[2]);
    if (!airportCode || !airportName || !location || !terminal || openHours.length === 0) {
      continue;
    }
    records.push({
      sourceRecordId: `alaska-${airportCode.toLowerCase()}-${slugify(terminal)}-${slugify(location)}`,
      name: 'Alaska Lounge',
      brand: 'Alaska Lounge',
      operator: 'Alaska Airlines',
      airportCode,
      airportName,
      terminal,
      near: location,
      openHours,
      programs: ['Alaska Lounge', 'oneworld'],
      amenities: { Lounge: true },
      loungePassAvailable: /^yes\b/i.test(cells[3] ?? ''),
      accessNotes: clean(`Official Alaska Lounge location and daily operating hours. Lounge pass available: ${cells[3] || 'Not stated'}.`),
      sourceUrl: url,
    });
  }
  return records;
}
