function cleanText(value) {
  return String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function pageTitle(html) {
  return cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
}

function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function currencyForPrice(symbol, url) {
  if (/£/.test(symbol)) {
    return 'GBP';
  }
  if (/A\$|AU\$/.test(symbol)) {
    return 'AUD';
  }
  if (new URL(url).pathname.startsWith('/us/')) {
    return 'USD';
  }
  return symbol.includes('$') ? 'USD' : '';
}

function parsePrice(text, url) {
  const match = text.match(/\bFrom\s+(A\$|AU\$|US\$|\$|£)\s*([0-9]+(?:\.[0-9]{2})?)\s+per\s+person\b/i);
  if (!match) {
    return null;
  }

  return {
    amount: Number(match[2]),
    currencyCode: currencyForPrice(match[1], url),
  };
}

function toTwentyFourHour(value) {
  const match = String(value ?? '').trim().match(/^(\d{1,2})(?:(?::|\.)(\d{2}))?\s*(am|pm)$/i);
  if (!match) {
    return '';
  }

  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const suffix = match[3].toLowerCase();
  if (suffix === 'pm' && hour < 12) {
    hour += 12;
  }
  if (suffix === 'am' && hour === 12) {
    hour = 0;
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

const DAY_GROUPS = [
  { pattern: /\bSun(?:day)?\b/i, days: [0] },
  { pattern: /\bMon(?:day)?\b/i, days: [1] },
  { pattern: /\bTue(?:s|sday)?\b/i, days: [2] },
  { pattern: /\bWed(?:nesday)?\b/i, days: [3] },
  { pattern: /\bThu(?:rs|rsday)?\b/i, days: [4] },
  { pattern: /\bFri(?:day)?\b/i, days: [5] },
  { pattern: /\bSat(?:urday)?\b/i, days: [6] },
];

function daysFromLabel(label) {
  const text = cleanText(label);
  if (/\bMon\s*(?:-|to)\s*Sun\b/i.test(text)) {
    return [1, 2, 3, 4, 5, 6, 0];
  }

  const days = [];
  for (const group of DAY_GROUPS) {
    if (group.pattern.test(text)) {
      days.push(...group.days);
    }
  }
  return [...new Set(days)];
}

function parseOpenHours(text) {
  const normalized = cleanText(text).replace(/&amp;/gi, '&');
  const entries = [];
  const pattern =
    /\b((?:Mon|Tues?|Wed|Thurs?|Fri|Sat|Sun)(?:(?:day|sday|rsday)?(?:\s*(?:-|to|,|&|and)\s*(?:Mon|Tues?|Wed|Thurs?|Fri|Sat|Sun)(?:day|sday|rsday)?)*)?)\s*\|\s*(\d{1,2}(?:(?::|\.)\d{2})?\s*(?:am|pm))\s*(?:-|to)\s*(\d{1,2}(?:(?::|\.)\d{2})?\s*(?:am|pm))/gi;
  let match;

  while ((match = pattern.exec(normalized)) !== null) {
    const opening = toTwentyFourHour(match[2]);
    const closing = toTwentyFourHour(match[3]);
    if (!opening || !closing) {
      continue;
    }

    for (const day of daysFromLabel(match[1])) {
      entries.push({
        Day: day,
        OpeningHour: opening,
        ClosingHour: closing,
      });
    }
  }

  if (entries.length === 0) {
    const dailyMatch =
      normalized.match(
        /\bOpen daily from\s+(\d{1,2}(?:(?::|\.)\d{2})?\s*(?:am|pm))\s*(?:-|to|until)\s*(\d{1,2}(?:(?::|\.)\d{2})?\s*(?:am|pm))/i,
      ) ||
      normalized.match(
        /\bis open from\s+(\d{1,2}(?:(?::|\.)\d{2})?\s*(?:am|pm))\s*(?:-|to|until)\s*(\d{1,2}(?:(?::|\.)\d{2})?\s*(?:am|pm))\s+every day\b/i,
      );
    const opening = toTwentyFourHour(dailyMatch?.[1]);
    const closing = toTwentyFourHour(dailyMatch?.[2]);
    if (opening && closing) {
      entries.push(
        ...[0, 1, 2, 3, 4, 5, 6].map((day) => ({
          Day: day,
          OpeningHour: opening,
          ClosingHour: closing,
        })),
      );
    }
  }

  return entries.sort((first, second) => first.Day - second.Day);
}

function parseGateNear(text) {
  const gateMatch = text.match(/\b(?:near|close to|by)\s+Gate\s+([A-Z]?\s*-?\s*\d+[A-Z]?)\b/i);
  if (gateMatch) {
    return `near Gate ${gateMatch[1].replace(/\s+/g, '').toUpperCase()}`;
  }

  const areaMatch = text.match(/\b(?:near|by)\s+([A-Z])\s+Gates\b/i);
  if (areaMatch) {
    return `near ${areaMatch[1].toUpperCase()} Gates`;
  }

  return '';
}

function parseTerminal(title, url) {
  const titleMatch = title.match(/\bTerminal\s+([A-Z0-9]+)\b/i);
  if (titleMatch) {
    return `Terminal ${titleMatch[1].toUpperCase()}`;
  }

  const pathMatch = new URL(url).pathname.match(/\/terminal-([a-z0-9]+)\/?$/i);
  if (pathMatch) {
    return `Terminal ${pathMatch[1].toUpperCase()}`;
  }

  return '';
}

function nameFromTitle(title, code) {
  if (/\bEssence\b/i.test(title)) {
    return `Essence by Escape Lounges - ${code}`;
  }

  if (/\bExecutive\b/i.test(title)) {
    return `The Executive by Escape Lounges - ${code}`;
  }

  return `Escape Lounge - ${code}`;
}

function canonicalPageUrl(value) {
  const url = new URL(value);
  url.hash = '';
  return url.toString();
}

export function parseEscapeLoungeStructuredRecord(html, { url, finalUrl } = {}) {
  const pageUrl = canonicalPageUrl(finalUrl || url);
  const title = pageTitle(html);
  const text = cleanText(html);
  const code = (title.match(/\(([A-Z0-9]{3})\)/)?.[1] ?? text.match(/\(([A-Z0-9]{3})\)/)?.[1] ?? '').toUpperCase();
  if (!/^[A-Z0-9]{3}$/.test(code)) {
    return null;
  }
  if (new RegExp(`\\(${code}\\)\\s+Lounges\\b`, 'i').test(title)) {
    return null;
  }

  const price = parsePrice(text, pageUrl);
  const openHours = parseOpenHours(text);
  const near = parseGateNear(text);
  const terminal = parseTerminal(title, pageUrl);

  return {
    sourceRecordId: `${code}-${slugify(title || pageUrl)}`,
    name: nameFromTitle(title, code),
    airportCode: code,
    airportName: title.replace(/\s*\([A-Z0-9]{3}\).*$/i, '').trim(),
    terminal,
    concourse: '',
    near,
    operator: 'Escape Lounges',
    openHours,
    price,
    currencyCode: price?.currencyCode,
    sourceUrl: pageUrl,
    accessNotes: 'Published pre-book price, hours, and location text from the official Escape Lounges page.',
  };
}
