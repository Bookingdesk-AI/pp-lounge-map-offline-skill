function decodeEntities(value) {
  return String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&reg;|®/g, '')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&ndash;|&#8211;/gi, '-')
    .replace(/&mdash;|&#8212;/gi, '-')
    .replace(/\\u003c/gi, '<')
    .replace(/\\u003d/gi, '=')
    .replace(/\\u003e/gi, '>')
    .replace(/[–—]/g, '-');
}

function clean(value) {
  return decodeEntities(value).replace(/\s+/g, ' ').trim();
}

function stripHtml(value) {
  return clean(String(value ?? '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' '));
}

function slugify(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

function unique(values) {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function normalizeUrl(value, baseUrl) {
  try {
    return new URL(decodeEntities(value), baseUrl).toString();
  } catch {
    return '';
  }
}

export function parseQantasLoungeLinks(html, { baseUrl = 'https://www.qantas.com/en-us/at-the-airport/lounges/locations' } = {}) {
  const links = new Map();
  const patterns = [
    /href=["']([^"']*(?:airport-lounge-locations|all-qantas-airport-lounges)[^"']*\.html)["'][^>]*>([\s\S]*?)<\/a>/gi,
    /"link"\s*:\s*"([^"]*(?:airport-lounge-locations|all-qantas-airport-lounges)[^"]*\.html)"\s*,\s*"active"\s*:\s*true\s*,\s*"title"\s*:\s*"([^"]+)"/gi,
  ];

  for (const pattern of patterns) {
    for (const match of String(html ?? '').matchAll(pattern)) {
      const url = normalizeUrl(match[1], baseUrl);
      const title = stripHtml(match[2]);
      if (!url || !/\/(?:airport-lounge-locations|all-qantas-airport-lounges)\//i.test(url)) {
        continue;
      }
      links.set(url, {
        url,
        title,
      });
    }
  }

  return [...links.values()].sort((first, second) => first.url.localeCompare(second.url));
}

function qantasPropsBlocks(html) {
  return [...String(html ?? '').matchAll(/<script[^>]+type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter((text) => /"(?:loungeData|tableData)"\s*:/i.test(text));
}

function parseJsonBlock(text) {
  try {
    return JSON.parse(text);
  } catch {
    try {
      return JSON.parse(decodeEntities(text));
    } catch {
      return null;
    }
  }
}

function titleName(value) {
  const title = clean(value);
  const parts = title.split(/\s+-\s+/);
  return clean(parts.length > 1 ? parts.slice(1).join(' - ') : title);
}

function terminalFromData(data) {
  const title = clean(data.loungeTitle);
  const location = stripHtml(data.location);
  const titleTerminal = title.match(/\((T\d[A-Z]?)\)/i)?.[1];
  if (titleTerminal) {
    return `Terminal ${titleTerminal.slice(1)}`;
  }
  return (
    location.match(/\bTerminal\s+\d[A-Z]?\b/i)?.[0] ||
    location.match(/\bT\d[A-Z]?\b/i)?.[0]?.replace(/^T/i, 'Terminal ') ||
    ''
  );
}

function toTwentyFourHour(value) {
  const normalized = clean(value).replace(/\s+/g, '').toLowerCase();
  if (normalized === 'midnight') {
    return '00:00';
  }

  const match = normalized.match(/^(\d{1,2})(?:(?::|\.)(\d{2}))?(am|pm)$/i);
  if (!match) {
    return '';
  }

  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const suffix = match[3].toLowerCase();
  if (suffix === 'pm' && hour < 12) hour += 12;
  if (suffix === 'am' && hour === 12) hour = 0;
  if (!Number.isFinite(hour) || hour > 23 || !Number.isFinite(minute) || minute > 59) {
    return '';
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

const QANTAS_DAY_NUMBERS = new Map([
  ['monday', 1],
  ['tuesday', 2],
  ['wednesday', 3],
  ['thursday', 4],
  ['friday', 5],
  ['saturday', 6],
  ['sunday', 0],
]);

function parseNamedDayHours(value) {
  const dayName = '(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)';
  const time = '(?:midnight|\\d{1,2}(?:(?::|\\.)\\d{2})?\\s*(?:a\\.?m\\.?|p\\.?m\\.?))';
  const pattern = new RegExp(
    `(${dayName}(?:(?:,\\s*|\\s+and\\s+|,\\s+and\\s+)${dayName})*)\\s*:\\s*(${time})\\s*(?:to|-|until)\\s*(${time})`,
    'gi',
  );
  const byDay = new Map();

  const rangePattern = new RegExp(
    `(${dayName})\\s*(?:-|to)\\s*(${dayName})\\s*:\\s*(${time})\\s*(?:to|-|until)\\s*(${time})`,
    'gi',
  );
  const orderedDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  for (const match of clean(value).matchAll(rangePattern)) {
    const opening = toTwentyFourHour(match[3]);
    const closing = toTwentyFourHour(match[4]);
    const firstIndex = orderedDays.indexOf(match[1].toLowerCase());
    const lastIndex = orderedDays.indexOf(match[2].toLowerCase());
    if (!opening || !closing || firstIndex < 0 || lastIndex < firstIndex) {
      continue;
    }
    for (const dayNameValue of orderedDays.slice(firstIndex, lastIndex + 1)) {
      const day = QANTAS_DAY_NUMBERS.get(dayNameValue);
      byDay.set(day, { Day: day, OpeningHour: opening, ClosingHour: closing });
    }
  }

  for (const match of clean(value).matchAll(pattern)) {
    const opening = toTwentyFourHour(match[2]);
    const closing = toTwentyFourHour(match[3]);
    if (!opening || !closing) {
      continue;
    }
    for (const dayMatch of match[1].matchAll(new RegExp(dayName, 'gi'))) {
      const day = QANTAS_DAY_NUMBERS.get(dayMatch[0].toLowerCase());
      if (day !== undefined) {
        byDay.set(day, {
          Day: day,
          OpeningHour: opening,
          ClosingHour: closing,
        });
      }
    }
  }

  return [1, 2, 3, 4, 5, 6, 0].map((day) => byDay.get(day)).filter(Boolean);
}

function parseOpenHours(value) {
  const text = clean(value);
  if (/\b24\s*hours?\b/i.test(text)) {
    return dailyHours('00:00', '23:59');
  }

  const namedDayHours = parseNamedDayHours(text);
  if (namedDayHours.length > 0) {
    return namedDayHours;
  }

  const match = text.match(
    /(\d{1,2}(?:(?::|\.)\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))\s*(?:to|-|until)\s*(midnight|\d{1,2}(?:(?::|\.)\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))/i,
  );
  if (!match) {
    return [];
  }

  const opening = toTwentyFourHour(match[1]);
  const closing = toTwentyFourHour(match[2]);
  return opening && closing ? dailyHours(opening, closing) : [];
}

function isHoursLikeText(value, parsedHours) {
  const text = clean(value);
  return (
    parsedHours.length > 0 ||
    /\b24\s*hours?\b/i.test(text) ||
    /\b(?:\d+|one|two|three|four|ninety|90)\s+(?:hours?|minutes?)\s+(?:prior|before)\b/i.test(text) ||
    /\b\d{1,2}(?:(?::|\.)\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)\b/i.test(text) ||
    /\bopening hours?\b/i.test(text)
  );
}

function amenitiesFromData(data) {
  const facilities = unique([...(data.commonFeatures ?? []), ...(data.businessFeatures ?? [])]);
  const text = facilities.join(' ');
  return {
    Lounge: true,
    FoodBeverageSnackBuffet: /\b(?:dining|food|snack|refreshments|beverages|barista|coffee|bar service)\b/i.test(text),
    WiFi: /\bwi-?fi|wireless internet|internet access\b/i.test(text),
    Shower: /\bshowers?\b/i.test(text),
    BusinessCenter: /\b(?:business|meeting|workstations?|conference)\b/i.test(text),
    RelaxationRoom: /\b(?:family zone|quiet|refresh|lounge)\b/i.test(text),
    WheelchairAccess: /\b(?:accessible|wheelchair)\b/i.test(text),
    TV: /\btelevision|tv\b/i.test(text),
  };
}

const QANTAS_STANDALONE_AIRPORTS = new Map([
  ['los-angeles-international-first-lounge.html', 'LAX'],
  ['perth-international-lounge.html', 'PER'],
  ['the-qantas-london-lounge.html', 'LHR'],
]);

function standaloneAirportCode(url) {
  const pathname = (() => {
    try {
      return new URL(url).pathname.toLowerCase();
    } catch {
      return '';
    }
  })();
  return [...QANTAS_STANDALONE_AIRPORTS].find(([suffix]) => pathname.endsWith(suffix))?.[1] ?? '';
}

function standalonePageName(html) {
  return (
    stripHtml(String(html ?? '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]) ||
    stripHtml(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]).replace(/\s*\|\s*Qantas\s*$/i, '')
  );
}

function tableLocationAndHours(html) {
  for (const block of qantasPropsBlocks(html)) {
    const tableData = parseJsonBlock(block)?.tableData;
    if (!tableData || !/\bLocation\b/i.test(tableData) || !/\bHours|opening hours\b/i.test(tableData)) {
      continue;
    }
    const rows = [...String(tableData).matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    for (const row of rows.slice(1)) {
      const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => stripHtml(match[1]));
      if (cells.length >= 2 && cells[0] && cells[1]) {
        return { location: cells[0], hours: cells[1] };
      }
    }
  }
  return null;
}

function parseStandaloneQantasLoungeRecord(html, url) {
  const airportCode = standaloneAirportCode(url);
  const name = standalonePageName(html);
  const table = tableLocationAndHours(html);
  if (!airportCode || !name || !table) {
    return null;
  }

  const temporarilyClosed = /\btemporarily closed\b/i.test(table.hours);
  const multipleDailyWindows = /\b(?:and|&)\s+\d{1,2}(?:(?::|\.)\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)\b/i.test(table.hours);
  const openHours = temporarilyClosed || multipleDailyWindows ? [] : parseOpenHours(table.hours);
  const terminal =
    table.location.match(/\bTerminal\s+\d[A-Z]?\b/i)?.[0] ||
    table.location.match(/\bT\d[A-Z]?\b/i)?.[0]?.replace(/^T/i, 'Terminal ') ||
    'Unknown';

  return {
    sourceRecordId: `qantas-${airportCode.toLowerCase()}-${slugify(name)}`,
    name,
    brand: 'Qantas',
    operator: 'Qantas',
    airportCode,
    airportName: '',
    terminal,
    near: table.location,
    sourceUrl: url,
    programs: ['Qantas', 'oneworld Emerald', 'oneworld Sapphire', 'Premium cabin'],
    status: temporarilyClosed ? 'temporarily_closed' : '',
    openHours,
    hoursText: temporarilyClosed || openHours.length > 0 ? '' : table.hours,
    exceptions: temporarilyClosed ? [table.hours] : [],
    amenities: amenitiesFromData({}),
    accessNotes: table.hours,
  };
}

export function parseQantasLoungeRecord(html, { url = '' } = {}) {
  const blocks = qantasPropsBlocks(html);
  for (const block of blocks) {
    const parsed = parseJsonBlock(block);
    const data = parsed?.loungeData;
    if (!data?.loungeTitle || !data?.loungePathInfo?.portCode) {
      continue;
    }

    const airportCode = clean(data.loungePathInfo.portCode).toUpperCase();
    if (!/^[A-Z0-9]{3}$/.test(airportCode)) {
      continue;
    }

    const lat = Number(data.latitude);
    const lon = Number(data.longitude);
    const name = titleName(data.loungeTitle);
    const operator = clean(data.operator) || 'Qantas';
    const location = stripHtml(data.location);
    const openingHoursText = stripHtml(data.openingHours);
    const temporarilyClosed = /\btemporarily closed\b/i.test(openingHoursText);
    const openHours = temporarilyClosed ? [] : parseOpenHours(data.openingHours);
    const operationalNotice = !temporarilyClosed && Boolean(openingHoursText) && !isHoursLikeText(openingHoursText, openHours);
    const facilities = unique([...(data.commonFeatures ?? []), ...(data.businessFeatures ?? [])]);

    return {
      sourceRecordId: `qantas-${airportCode.toLowerCase()}-${slugify(name)}`,
      name,
      brand: /qantas/i.test(operator) ? 'Qantas' : operator,
      operator,
      airportCode,
      airportName: '',
      airportCoordinates: Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : undefined,
      terminal: terminalFromData(data) || 'Unknown',
      near: location,
      sourceUrl: url,
      programs: ['Qantas', 'oneworld Emerald', 'oneworld Sapphire', 'Premium cabin'],
      status: temporarilyClosed ? 'temporarily_closed' : '',
      openHours,
      hoursText: temporarilyClosed || operationalNotice ? '' : openingHoursText,
      exceptions: temporarilyClosed || operationalNotice ? [openingHoursText] : [],
      amenities: amenitiesFromData(data),
      accessNotes: clean([data.openingHours, ...facilities].join('; ')),
    };
  }

  return parseStandaloneQantasLoungeRecord(html, url);
}
