function decodeEntities(value) {
  return String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, '-')
    .replace(/&mdash;|&#8212;/gi, '-')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/[–—]/g, '-');
}

function clean(value) {
  return decodeEntities(value).replace(/\s+/g, ' ').trim();
}

function stripHtml(value) {
  return clean(String(value ?? '').replace(/<[^>]+>/g, ' '));
}

function slugify(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90);
}

const AIRPORTS = new Map([
  ['Changi Airport', { code: 'SIN', name: 'Singapore Changi Airport' }],
  ['Suvarnabhumi Airport', { code: 'BKK', name: 'Suvarnabhumi Airport' }],
  ['Brisbane Airport', { code: 'BNE', name: 'Brisbane Airport' }],
  ['Hong Kong International Airport', { code: 'HKG', name: 'Hong Kong International Airport' }],
  ['London Heathrow Airport', { code: 'LHR', name: 'Heathrow Airport' }],
  ['Melbourne Airport', { code: 'MEL', name: 'Melbourne Airport' }],
  ['Perth Airport', { code: 'PER', name: 'Perth Airport' }],
  ['Incheon International Airport', { code: 'ICN', name: 'Incheon International Airport' }],
  ['Sydney Airport', { code: 'SYD', name: 'Sydney Airport' }],
  ['Taoyuan International Airport', { code: 'TPE', name: 'Taiwan Taoyuan International Airport' }],
]);

function airportForHeading(value) {
  const heading = clean(value);
  return AIRPORTS.get(heading) ?? null;
}

function parseTimeToken(value) {
  const token = clean(value).toLowerCase().replace(/\./g, '').replace(/\s+/g, '');
  const hhmm = token.match(/^(\d{2})(\d{2})$/);
  if (hhmm) {
    return `${hhmm[1]}:${hhmm[2]}`;
  }

  const meridiem = token.match(/^(\d{1,2})(?::?(\d{2}))?(am|pm)$/);
  if (!meridiem) {
    return '';
  }

  let hour = Number(meridiem[1]);
  const minute = Number(meridiem[2] ?? 0);
  if (meridiem[3] === 'pm' && hour < 12) {
    hour += 12;
  }
  if (meridiem[3] === 'am' && hour === 12) {
    hour = 0;
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function dailyHours(opening, closing) {
  return [1, 2, 3, 4, 5, 6, 0].map((day) => ({
    Day: day,
    OpeningHour: opening,
    ClosingHour: closing,
  }));
}

function parseHours(value) {
  const text = clean(value).toLowerCase();
  if (/\b24\s*hours?\b/.test(text)) {
    return dailyHours('00:00', '23:59');
  }

  const match = text.match(/(\d{1,2}(?::?\d{2})?\s*(?:am|pm)?|\d{4})\s*(?:-|to)\s*(\d{1,2}(?::?\d{2})?\s*(?:am|pm)?|\d{4})\s*(?:hours?)?/i);
  if (!match) {
    return [];
  }

  const opening = parseTimeToken(match[1]);
  const closing = parseTimeToken(match[2]);
  return opening && closing ? dailyHours(opening, closing) : [];
}

function normalizeTerminal(value) {
  const text = clean(value)
    .replace(/\bTerminal\s+Two\b/i, 'Terminal 2')
    .replace(/\bTerminal\s+Three\b/i, 'Terminal 3')
    .replace(/\bMain\s+Passenger\s+Terminal\s+1\b/i, 'Terminal 1');
  return (
    text.match(/\bTerminal\s+\d[A-Z]?\b/i)?.[0] ||
    text.match(/\bConcourse\s+[A-Z0-9]\b/i)?.[0] ||
    text.match(/\bInternational\s+Terminal\b/i)?.[0] ||
    text.match(/\bTerminal\s+[A-Z]\b/i)?.[0] ||
    ''
  );
}

function facilitiesFromCells(cells) {
  return cells
    .flatMap((cell) => [...cell.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((match) => stripHtml(match[1])))
    .filter(Boolean);
}

function tableRows(tableHtml) {
  const rows = {};
  for (const row of String(tableHtml ?? '').matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => match[1]);
    if (cells.length < 2) {
      continue;
    }
    const label = stripHtml(cells[0]).toLowerCase().replace(/\s+/g, ' ');
    const valueHtml = cells.slice(1).join(' ');
    const value = stripHtml(valueHtml);
    if (label.includes('location')) {
      rows.location = value;
    } else if (label.includes('opening') && label.includes('hours')) {
      rows.hours = value;
    } else if (label.includes('facilities')) {
      rows.facilities = facilitiesFromCells(cells.slice(1));
    }
  }
  return rows;
}

function accordionItems(html) {
  return [...String(html ?? '').matchAll(/<div class="cmp-accordion__item"[\s\S]*?(?=<div class="cmp-accordion__item"|<h6>First Class Check-in Reception|$)/gi)]
    .map((match) => match[0]);
}

export function parseSingaporeAirlinesLoungeRecords(html, { url = 'https://www.singaporeair.com/en_UK/us/flying-withus/before-the-flight/lounges/silverkris/' } = {}) {
  const records = [];

  for (const item of accordionItems(html)) {
    const airportHeading = stripHtml(item.match(/<h6[^>]*>\s*<span[^>]*class="font-size-16"[^>]*>([\s\S]*?)<\/span>\s*<\/h6>/i)?.[1]);
    const airport = airportForHeading(airportHeading);
    if (!airport) {
      continue;
    }

    const tables = [...item.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)].map((match) => match[1]);
    for (const [index, table] of tables.entries()) {
      const rows = tableRows(table);
      const facilities = rows.facilities ?? [];
      const openHours = parseHours(rows.hours);
      const terminal = normalizeTerminal(rows.location);
      if (!rows.location || openHours.length === 0) {
        continue;
      }

      const isPrivateRoom = /\bprivate room\b/i.test(rows.location);
      const name = isPrivateRoom ? 'Singapore Airlines The Private Room' : 'Singapore Airlines SilverKris Lounge';
      records.push({
        sourceRecordId: `singapore-airlines-${airport.code.toLowerCase()}-${slugify(name)}-${index + 1}`,
        name,
        brand: 'Singapore Airlines',
        operator: 'Singapore Airlines',
        airportCode: airport.code,
        airportName: airport.name,
        terminal: terminal || 'Unknown',
        near: rows.location,
        sourceUrl: url,
        programs: ['Singapore Airlines', 'Star Alliance Gold', 'Premium cabin'],
        openHours,
        amenities: {
          Lounge: true,
          FoodBeverageSnackBuffet: facilities.some((item) => /food|snack/i.test(item)),
          WiFi: facilities.some((item) => /wireless|wi-?fi|internet/i.test(item)),
          Shower: facilities.some((item) => /shower/i.test(item)),
          TV: facilities.some((item) => /\btv\b|television/i.test(item)),
          WheelchairAccess: facilities.some((item) => /wheelchair/i.test(item)),
          BusinessCenter: facilities.some((item) => /meeting|business/i.test(item)),
          RelaxationRoom: facilities.some((item) => /rest area|relax/i.test(item)),
        },
        accessNotes: 'Published by the official Singapore Airlines SilverKris lounge page.',
      });
    }
  }

  return records;
}
