function decodeEntities(value) {
  return String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&reg;|®/g, '')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&ndash;|&#8211;/gi, '-')
    .replace(/&mdash;|&#8212;/gi, '-')
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

const PAGE_HINTS = [
  {
    slug: 'al-safwa',
    airportCode: 'DOH',
    airportName: 'Hamad International Airport',
    name: 'Qatar Airways Al Safwa First Lounge',
  },
  {
    slug: 'al-mourjan-garden',
    airportCode: 'DOH',
    airportName: 'Hamad International Airport',
    name: 'Qatar Airways Al Mourjan Business Lounge - The Garden',
  },
  {
    slug: 'al-mourjan',
    airportCode: 'DOH',
    airportName: 'Hamad International Airport',
    name: 'Qatar Airways Al Mourjan Business Lounge',
  },
  {
    slug: 'platinum-and-gold-lounges',
    airportCode: 'DOH',
    airportName: 'Hamad International Airport',
    name: 'Qatar Airways Platinum and Gold Lounge',
  },
  {
    slug: 'silver-lounge',
    airportCode: 'DOH',
    airportName: 'Hamad International Airport',
    name: 'Qatar Airways Silver Lounge',
  },
  {
    slug: 'first-and-business-class-arrival-lounges',
    airportCode: 'DOH',
    airportName: 'Hamad International Airport',
    name: 'Qatar Airways First and Business Class Arrival Lounge',
  },
  {
    slug: 'almaha-lounge',
    airportCode: 'DOH',
    airportName: 'Hamad International Airport',
    name: 'Al Maha Lounge',
  },
  {
    slug: 'mariner-lounge',
    airportCode: 'DOH',
    airportName: 'Hamad International Airport',
    name: 'Qatar Airways Mariner Lounge',
  },
  {
    slug: 'bangkok-premium-lounge',
    airportCode: 'BKK',
    airportName: 'Suvarnabhumi Airport',
    name: 'Qatar Airways Premium Lounge Bangkok',
  },
  {
    slug: 'beirut-premium-lounge',
    airportCode: 'BEY',
    airportName: 'Beirut-Rafic Hariri International Airport',
    name: 'Qatar Airways Premium Lounge Beirut',
  },
  {
    slug: 'singapore-premium-lounge',
    airportCode: 'SIN',
    airportName: 'Singapore Changi Airport',
    name: 'Qatar Airways Premium Lounge Singapore',
  },
  {
    slug: 'london-heathrow',
    airportCode: 'LHR',
    airportName: 'Heathrow Airport',
    name: 'Qatar Airways Premium Lounge London Heathrow',
  },
];

function hintForUrl(url) {
  const pathname = clean(url).toLowerCase();
  return PAGE_HINTS.find((hint) => pathname.includes(`/${hint.slug}`)) ?? null;
}

function titleFromHtml(html) {
  const heading =
    stripHtml(String(html ?? '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]) ||
    stripHtml(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  return clean(heading.replace(/\s*\|\s*Qatar Airways.*$/i, ''));
}

function terminalFromText(text) {
  return (
    text.match(/\bTerminal\s+[A-Z0-9](?:\/[A-Z0-9])?\b/i)?.[0] ||
    text.match(/\bConcourse\s+[A-Z0-9](?:\/[A-Z0-9])?\b/i)?.[0] ||
    text.match(/\bNorth\s+Node\b/i)?.[0] ||
    text.match(/\bSouth\s+Node\b/i)?.[0] ||
    text.match(/\bOrchard\b/i)?.[0] ||
    ''
  );
}

function nearFromText(text) {
  const located = clean(text).match(/\bLocated\b[^.!?]*(?:[.!?]|$)/i)?.[0];
  if (located) {
    return clean(located);
  }

  const sentences = clean(text)
    .split(/(?<=[.!?])\s+/)
    .map(clean)
    .filter(Boolean);
  return (
    sentences.find((sentence) => /\b(?:located|location|near|opposite|next to|concourse|terminal|node|orchard)\b/i.test(sentence)) ??
    ''
  );
}

function toTwentyFourHour(value) {
  const normalized = clean(value).replace(/\./g, '').replace(/\s+/g, '');
  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/i);
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

function parseHours(text) {
  const value = clean(text);
  if (/\b24\s*hours?\b/i.test(value)) {
    return dailyHours('00:00', '23:59');
  }

  const match = value.match(
    /(?:open(?:ing)?\s*hours?:?\s*)?(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))\s*(?:to|-)\s*(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))/i,
  );
  if (!match) {
    return [];
  }

  const opening = toTwentyFourHour(match[1]);
  const closing = toTwentyFourHour(match[2]);
  return opening && closing ? dailyHours(opening, closing) : [];
}

function amenitiesFromText(text) {
  const value = clean(text);
  return {
    Lounge: true,
    FoodBeverageSnackBuffet: /\b(?:dining|restaurant|buffet|food|snack|beverage|bar)\b/i.test(value),
    WiFi: /\bwi-?fi|wireless internet\b/i.test(value),
    Shower: /\bshowers?\b/i.test(value),
    BusinessCenter: /\b(?:business centre|business center|meeting rooms?|workstations?)\b/i.test(value),
    RelaxationRoom: /\b(?:quiet area|relax|nap|family room)\b/i.test(value),
    WheelchairAccess: /\b(?:accessible|wheelchair)\b/i.test(value),
    TV: /\btelevision|tv\b/i.test(value),
  };
}

function sourceRecordId(record) {
  return `qatar-airways-${record.airportCode.toLowerCase()}-${slugify(record.name)}`;
}

export function parseQatarAirwaysLoungeRecord(html, { url = '' } = {}) {
  const hint = hintForUrl(url);
  const text = stripHtml(html);
  const title = titleFromHtml(html);
  const airportCode =
    hint?.airportCode ||
    (text.match(/\(([A-Z0-9]{3})\)/)?.[1] ?? '').toUpperCase();
  if (!/^[A-Z0-9]{3}$/.test(airportCode)) {
    return null;
  }

  const name = clean(title && /lounge/i.test(title) ? title : hint?.name) || hint?.name || `Qatar Airways Lounge - ${airportCode}`;
  const terminal = terminalFromText(text);
  const near = nearFromText(text);

  const record = {
    name,
    brand: 'Qatar Airways',
    operator: 'Qatar Airways',
    airportCode,
    airportName: hint?.airportName ?? '',
    terminal: terminal || 'Unknown',
    near,
    sourceUrl: url,
    programs: ['Qatar Airways', 'oneworld Emerald', 'oneworld Sapphire', 'Premium cabin'],
    openHours: parseHours(text),
    amenities: amenitiesFromText(text),
    accessNotes: 'Published by the official Qatar Airways lounge page.',
  };

  return {
    sourceRecordId: sourceRecordId(record),
    ...record,
  };
}

export function parseQatarAirwaysLoungeLinks(html, { baseUrl = 'https://www.qatarairways.com/en-us/lounges.html' } = {}) {
  const links = new Map();
  for (const match of String(html ?? '').matchAll(/href=["']([^"']*\/lounges\/[^"']+\.html[^"']*)["']/gi)) {
    const href = decodeEntities(match[1]);
    let url;
    try {
      url = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }
    if (hintForUrl(url)) {
      links.set(url, {
        url,
        hint: hintForUrl(url),
      });
    }
  }
  return [...links.values()];
}
