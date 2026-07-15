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
    .filter((text) => /"loungeData"\s*:/i.test(text));
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

function parseOpenHours(value) {
  const text = clean(value);
  if (/\b24\s*hours?\b/i.test(text)) {
    return dailyHours('00:00', '23:59');
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
      openHours: parseOpenHours(data.openingHours),
      hoursText: stripHtml(data.openingHours),
      amenities: amenitiesFromData(data),
      accessNotes: clean([data.openingHours, ...facilities].join('; ')),
    };
  }

  return null;
}
