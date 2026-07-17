function decodeEntities(value) {
  return String(value ?? '')
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&ndash;|&#8211;/gi, '-')
    .replace(/&mdash;|&#8212;/gi, '-')
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
    .slice(0, 100);
}

function absoluteUrl(value, baseUrl) {
  try {
    const url = new URL(decodeEntities(value), baseUrl);
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

export function extractPlazaPremiumFindUrls(html, { baseUrl = 'https://www.plazapremiumlounge.com/en-uk' } = {}) {
  const urls = [];
  const seen = new Set();
  for (const match of String(html ?? '').matchAll(/href=["']([^"']*\/en-uk\/find\/[^"']+)["']/gi)) {
    const url = absoluteUrl(match[1], baseUrl);
    if (!url || seen.has(url)) {
      continue;
    }
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

function pageTitle(html) {
  return stripHtml(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
}

function airportCodeFromPage(html, url) {
  const titleCode = pageTitle(html).match(/\(([A-Z0-9]{3})\)/)?.[1];
  if (titleCode) {
    return titleCode;
  }
  try {
    return new URL(url).pathname.match(/-([a-z0-9]{3})(?:\/|$)/i)?.[1]?.toUpperCase() ?? '';
  } catch {
    return '';
  }
}

function airportNameFromLocation(location, code) {
  const withoutCode = clean(location).replace(new RegExp(`\\s*\\(${code}\\)\\s*$`, 'i'), '');
  const parts = withoutCode.split(',').map(clean).filter(Boolean);
  return parts.find((part) => /airport/i.test(part)) ?? `${code} Airport`;
}

function airportCodeFromLocation(location, fallbackCode) {
  const text = clean(location);
  if (/railway\s+station/i.test(text)) {
    return '';
  }
  const explicitCode = text.match(/\(([A-Z0-9]{3})\)\s*$/)?.[1];
  if (explicitCode) {
    return explicitCode;
  }
  const airportNameCodes = [
    [/london\s+heathrow\s+airport/i, 'LHR'],
    [/london\s+gatwick\s+airport/i, 'LGW'],
    [/london\s+stansted\s+airport/i, 'STN'],
    [/london\s+luton\s+airport/i, 'LTN'],
    [/london\s+city\s+airport/i, 'LCY'],
    [/john\s+f\.?\s+kennedy|jfk\s+international/i, 'JFK'],
    [/newark\s+liberty/i, 'EWR'],
    [/la\s*guardia|laguardia/i, 'LGA'],
    [/milan\s+malpensa/i, 'MXP'],
    [/milan\s+linate/i, 'LIN'],
    [/bergamo|orio\s+al\s+serio/i, 'BGY'],
    [/rome\s+fiumicino|leonardo\s+da\s+vinci/i, 'FCO'],
    [/rome\s+ciampino/i, 'CIA'],
    [/paris\s+charles\s+de\s+gaulle|paris\s+cdg/i, 'CDG'],
    [/paris\s+orly/i, 'ORY'],
    [/tokyo\s+haneda|haneda\s+airport/i, 'HND'],
    [/tokyo\s+narita|narita\s+international/i, 'NRT'],
    [/seoul\s+incheon|incheon\s+international/i, 'ICN'],
    [/gimpo\s+international/i, 'GMP'],
    [/bangkok\s+suvarnabhumi|suvarnabhumi/i, 'BKK'],
    [/don\s+mueang/i, 'DMK'],
    [/istanbul\s+airport/i, 'IST'],
    [/sabiha\s+gokcen|sabiha\s+gökçen/i, 'SAW'],
    [/dubai\s+international/i, 'DXB'],
    [/dubai\s+world\s+central|al\s+maktoum/i, 'DWC'],
  ];
  for (const [pattern, code] of airportNameCodes) {
    if (pattern.test(text)) {
      return code;
    }
  }
  if (/shanghai\s+pudong\s+international\s+airport/i.test(text)) {
    return 'PVG';
  }
  if (/shanghai\s+hongqiao\s+international\s+airport/i.test(text)) {
    return 'SHA';
  }
  return fallbackCode;
}

function terminalFromLocation(location) {
  return (
    clean(location).match(/\bTerminal\s+[A-Z0-9]+(?:\s*\/\s*[A-Z0-9]+)?\b/i)?.[0] ||
    clean(location).match(/\bConcourse\s+[A-Z0-9]+\b/i)?.[0] ||
    ''
  );
}

function concourseFromLocation(location) {
  return clean(location).match(/\bConcourse\s+[A-Z0-9]+\b/i)?.[0] || '';
}

function parsePrice(value) {
  const text = clean(value);
  const match = text.match(
    /\b(USD|GBP|EUR|CAD|AUD|HKD|SGD|MYR|AED|SAR|TWD|JPY|CNY|IDR|SEK|THB|INR|NZD|DKK|ZAR|BRL|MOP)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i,
  );
  if (!match) {
    return null;
  }
  const amount = Number(match[2].replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  return {
    amount,
    currencyCode: match[1].toUpperCase(),
  };
}

function parseTime(value) {
  const match = clean(value).match(/^(\d{1,2})(?::?(\d{2}))?\s*(am|pm)?$/i);
  if (!match) {
    return '';
  }

  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const suffix = match[3]?.toLowerCase();
  if (!suffix && hour === 24 && minute === 0) {
    return '24:00';
  }
  if (suffix === 'pm' && hour < 12) hour += 12;
  if (suffix === 'am' && hour === 12) hour = 0;
  if (!Number.isFinite(hour) || hour > 23 || minute > 59) {
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

const DAY_INDEX = new Map([
  ['monday', 1],
  ['tuesday', 2],
  ['wednesday', 3],
  ['thursday', 4],
  ['friday', 5],
  ['saturday', 6],
  ['sunday', 0],
]);

const ORDERED_DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function dayRange(firstDay, lastDay = firstDay) {
  const first = ORDERED_DAY_NAMES.indexOf(clean(firstDay).toLowerCase());
  const last = ORDERED_DAY_NAMES.indexOf(clean(lastDay).toLowerCase());
  if (first < 0 || last < first) {
    return [];
  }
  return ORDERED_DAY_NAMES.slice(first, last + 1).map((day) => DAY_INDEX.get(day));
}

function parseWeekdayHours(value) {
  const text = stripHtml(value);
  const time = '\\d{1,2}(?::?\\d{2})?\\s*(?:am|pm)?';
  const pattern = new RegExp(
    `\\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:\\s+(?:to|-)\\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday))?\\s*:?\\s*(${time})\\s*-\\s*(${time})`,
    'gi',
  );
  const byDay = new Map();

  for (const match of text.matchAll(pattern)) {
    const opening = parseTime(match[3]);
    const closing = parseTime(match[4]);
    if (!opening || !closing) {
      continue;
    }
    for (const day of dayRange(match[1], match[2] || match[1])) {
      byDay.set(day, { Day: day, OpeningHour: opening, ClosingHour: closing });
    }
  }

  return [1, 2, 3, 4, 5, 6, 0].map((day) => byDay.get(day)).filter(Boolean);
}

function parseOpenHours(value) {
  const text = stripHtml(value);
  if (/\b24\s*(?:hours?|hrs?)\b|\b24\s*\/\s*7\b/i.test(text)) {
    return [1, 2, 3, 4, 5, 6, 0].map((day) => ({ Day: day, OpenAllDay: true }));
  }

  const weekdayHours = parseWeekdayHours(text);
  if (weekdayHours.length > 0) {
    return weekdayHours;
  }

  const match = text.match(
    /\b(\d{1,2}(?::?\d{2})?\s*(?:am|pm)?)\s*-\s*(\d{1,2}(?::?\d{2})?\s*(?:am|pm)?)\s*(?:daily|every\s+day)?\b/i,
  );
  const opening = parseTime(match?.[1]);
  const closing = parseTime(match?.[2]);
  return opening && closing ? dailyHours(opening, closing) : [];
}

function rawHoursText(cardHtml) {
  const text = stripHtml(
    String(cardHtml ?? '').match(/<span[^>]*class=["'][^"']*\btime\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1],
  );
  if (/please\s+refer\s+to\s+lounge\s+details/i.test(text)) {
    return '';
  }
  return text;
}

function operationHoursText(value) {
  const match = String(value ?? '').match(
    /Operation\s*Time(?:&nbsp;|\s|<[^>]+>)*([\s\S]*?)(?=<\/p>|<div[^>]*class=["'][^"']*\baccordion-item\b|<h[1-6]\b|$)/i,
  );
  return stripHtml(match?.[1]);
}

function amenitiesFromCard(cardHtml) {
  const amenities = [];
  for (const match of String(cardHtml ?? '').matchAll(/<span[^>]*class=["'][^"']*\btag\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)) {
    const label = stripHtml(match[1]);
    if (label) {
      amenities.push(label);
    }
  }
  return [...new Set(amenities)];
}

function isExcludedServiceCard(name, location) {
  const text = `${clean(name)} ${clean(location)}`;
  return /\b(?:allways|meet\s*&?\s*greet|porter\s+services?|transit\s+services?|lounge\s+pass|experience\s+pass|access\s+plaza\s+premium\s+lounge\s+globally)\b/i.test(
    text,
  );
}

function cardBlocks(html) {
  const blocks = [];
  const detailRegex =
    /<div[^>]*class=["'][^"']*\blounge-details\b[^"']*["'][^>]*>([\s\S]*?)(?=<div[^>]*class=["'][^"']*\blounge-details\b|<\/section>|$)/gi;
  for (const detailMatch of String(html ?? '').matchAll(detailRegex)) {
    const blockHtml = detailMatch[0];
    const linkMatch = blockHtml.match(
      /<a\s+href=["']([^"']+)["'][^>]*class=["'][^"']*\blounge-title\b[^"']*["'][^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<\/a>/i,
    );
    const locationMatch = blockHtml.match(
      /<span[^>]*class=["'][^"']*\bflight-details\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
    );
    if (!linkMatch || !locationMatch) {
      continue;
    }
    blocks.push({
      href: linkMatch[1],
      name: stripHtml(linkMatch[2]),
      location: stripHtml(locationMatch[1]),
      html: blockHtml,
    });
  }
  if (blocks.length > 0) {
    return blocks;
  }

  const regex = /<a\s+href=["']([^"']+)["'][^>]*class=["'][^"']*\blounge-title\b[^"']*["'][^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<span[^>]*class=["'][^"']*\bflight-details\b[^"']*["'][^>]*>([\s\S]*?)<\/span>([\s\S]*?)(?=<a\s+href=["'][^"']+["'][^>]*class=["'][^"']*\blounge-title\b|<\/section>|$)/gi;
  for (const match of String(html ?? '').matchAll(regex)) {
    blocks.push({
      href: match[1],
      name: stripHtml(match[2]),
      location: stripHtml(match[3]),
      html: match[0] + match[4],
    });
  }
  return blocks;
}

function detailPageBlock(html) {
  const match = String(html ?? '').match(
    /<h2[^>]*class=["'][^"']*\btitle\b[^"']*["'][^>]*>\s*([\s\S]*?)<small[^>]*>([\s\S]*?)<\/small>[\s\S]*?<\/h2>/i,
  );
  if (!match) {
    return null;
  }
  return {
    href: '',
    name: stripHtml(match[1]),
    location: stripHtml(match[2]),
    html,
  };
}

function recordFromBlock(block, { code, sourceUrl }) {
  const airportCode = airportCodeFromLocation(block.location, code);
  if (!/^[A-Z0-9]{3}$/.test(airportCode) || !block.name || !block.location) {
    return null;
  }
  if (isExcludedServiceCard(block.name, block.location)) {
    return null;
  }

  const recordUrl = block.href ? absoluteUrl(block.href, sourceUrl) : sourceUrl;
  const terminal = terminalFromLocation(block.location);
  const amenities = amenitiesFromCard(block.html);
  const price = parsePrice(block.html);
  const publishedHoursText = operationHoursText(block.html) || rawHoursText(block.html);
  const openHours = parseOpenHours(publishedHoursText);
  const hoursText = openHours.length > 0 ? '' : publishedHoursText;

  return {
    sourceRecordId: `${airportCode}-${slugify(block.name)}-${slugify(terminal || block.location)}`,
    name: block.name,
    brand: /plaza premium/i.test(block.name) ? 'Plaza Premium Lounge' : block.name,
    operator: 'Plaza Premium Lounge',
    airportCode,
    airportName: airportNameFromLocation(block.location, airportCode),
    terminal,
    concourse: concourseFromLocation(block.location),
    near: block.location,
    amenities: Object.fromEntries(amenities.map((amenity) => [amenity, true])),
    openHours,
    hoursText,
    price,
    currencyCode: price?.currencyCode,
    sourceUrl: recordUrl,
    accessNotes: 'Published location, amenities, and booking price from the official Plaza Premium Lounge page.',
  };
}

export function parsePlazaPremiumStructuredRecords(html, { url = '' } = {}) {
  const code = airportCodeFromPage(html, url);
  const sourceUrl = absoluteUrl(url, url) || url;
  const blocks = cardBlocks(html);
  const detail = detailPageBlock(html);
  if (detail) {
    blocks.push(detail);
  }

  const records = blocks
    .map((block) => recordFromBlock(block, { code, sourceUrl }))
    .filter(Boolean);
  const byId = new Map(records.map((record) => [record.sourceRecordId, record]));
  return [...byId.values()].sort((first, second) =>
    `${first.airportCode}-${first.name}`.localeCompare(`${second.airportCode}-${second.name}`),
  );
}

export function mergePlazaPremiumDetailRecord(base, detail) {
  if (!base || !detail) {
    return base ?? detail ?? null;
  }
  return {
    ...base,
    ...detail,
    sourceRecordId: base.sourceRecordId,
    name: base.name || detail.name,
    airportCode: base.airportCode || detail.airportCode,
    airportName: base.airportName || detail.airportName,
    terminal: detail.terminal || base.terminal,
    concourse: detail.concourse || base.concourse,
    near: detail.near || base.near,
    amenities: {
      ...(base.amenities ?? {}),
      ...(detail.amenities ?? {}),
    },
    openHours: detail.openHours?.length ? detail.openHours : base.openHours,
    hoursText: detail.hoursText || base.hoursText,
    price: detail.price ?? base.price,
    currencyCode: detail.currencyCode || base.currencyCode,
    sourceUrl: base.sourceUrl || detail.sourceUrl,
  };
}
