function decodeEntities(value) {
  return String(value ?? '')
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&ndash;|&#8211;/gi, '-')
    .replace(/&mdash;|&#8212;/gi, '-')
    .replace(/[–—]/g, '-')
    .replace(/&rsquo;|&#8217;/gi, "'")
    .replace(/&#39;/g, "'");
}

function clean(value) {
  return decodeEntities(value).replace(/\s+/g, ' ').trim();
}

function stripHtml(value) {
  return clean(
    String(value ?? '')
      .replace(/<!--[\s\S]*?-->/g, ' ')
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

const AIRPORT_BY_SLUG = new Map([
  ['al-maktoum-airport-lounge', 'DWC'],
  ['clark-international-airport-lounge', 'CRK'],
  ['dallas-departure-lounge', 'DFW'],
  ['dubai-international-airport-lounges', 'DXB'],
  ['geneva-airport-lounge', 'GVA'],
  ['helsinki-vantaa-international-airport-lounge', 'HEL'],
  ['hong-kong-airport-lounge', 'HKG'],
  ['istanbul-airport-lounge', 'IST'],
  ['jakarta-international-airport-lounge', 'CGK'],
  ['karachi-terminal-m-lounge', 'KHI'],
  ['king-fahd-international-airport-lounge', 'DMM'],
  ['kuala-lumpur-international-airport-lounge', 'KUL'],
  ['london-heathrow-airport-lounge', 'LHR'],
  ['macau-international-airport-lounge', 'MFM'],
  ['manila-terminal-1-lounge', 'MNL'],
  ['melbourne-airport-lounge', 'MEL'],
  ['riogaleao-tom-jobim-international-airport-lounge', 'GIG'],
  ['rome-terminal-3-lounge', 'FCO'],
  ['sharjah-international-airport-lounge', 'SHJ'],
  ['singapore-international-airport-lounge', 'SIN'],
  ['taiwan-taoyuan-international-airport', 'TPE'],
  ['toronto-pearson-international-airport-lounge', 'YYZ'],
  ['vancouver-international-airport-lounge', 'YVR'],
  ['zanzibar-airport-lounge', 'ZNZ'],
  ['zurich-airport', 'ZRH'],
]);

function metaContent(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(html ?? '').match(new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i'));
  return clean(match?.[1]);
}

function canonicalUrl(html, fallbackUrl) {
  const match = String(html ?? '').match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  return clean(match?.[1]) || fallbackUrl;
}

function productName(html) {
  return (
    clean(String(html ?? '').match(/<h1[^>]*class=["'][^"']*b-pdp_info-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1]) ||
    clean(String(html ?? '').match(/"name":"([^"]+)"/)?.[1]) ||
    clean(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])
  );
}

function sourceSlug(url) {
  try {
    return new URL(url).pathname.split('/').pop()?.replace(/\.html$/i, '').toLowerCase() ?? '';
  } catch {
    return '';
  }
}

function airportCode(html, url) {
  const currentAirport = clean(String(html ?? '').match(/&quot;currentAirport&quot;:&quot;([A-Z0-9]{3})&quot;/)?.[1]);
  if (currentAirport) {
    return currentAirport;
  }
  const explicitTitle = productName(html).match(/\(([A-Z0-9]{3})\)/)?.[1];
  if (explicitTitle) {
    return explicitTitle;
  }
  return AIRPORT_BY_SLUG.get(sourceSlug(url)) ?? '';
}

function componentOptions(html, componentName) {
  const escapedName = componentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = String(html ?? '').matchAll(
    new RegExp(`data-component=["']${escapedName}["'][^>]*data-component-options=["']([^"']+)["']`, 'g'),
  );
  for (const match of matches) {
    try {
      return JSON.parse(decodeEntities(match[1]));
    } catch {
      // Try the next matching component.
    }
  }
  return null;
}

function terminal(html, description) {
  const display = clean(componentOptions(html, 'product/Lounges')?.variationAttributesDisplayValues?.terminal);
  if (display && display !== 'null') {
    return display;
  }
  const terminals = [
    ...new Set([...clean(description).matchAll(/\bTerminal\s+[A-Z0-9]+(?:\s*\/\s*[A-Z0-9]+)?\b/gi)].map((match) => clean(match[0]))),
  ];
  if (terminals.length === 1) {
    return terminals[0];
  }
  if (terminals.length > 1) {
    return '';
  }
  return clean(description).match(/\bConcourse\s+[A-Z0-9]+\b/i)?.[0] || '';
}

function descriptionText(html) {
  const match = String(html ?? '').match(/<div[^>]+class=["'][^"']*b-pdp_info-description[^"']*["'][^>]*>([\s\S]*?)<div[^>]+class=["'][^"']*b-pdp_info-cta/i);
  return stripHtml(match?.[1] ?? '');
}

function parseTime(value) {
  const match = clean(value).match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
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

function widestDailyHours(ranges) {
  const parsed = ranges
    .map(([opening, closing]) => [parseTime(opening), parseTime(closing)])
    .filter(([opening, closing]) => opening && closing);
  if (parsed.length === 0) {
    return [];
  }
  const openings = parsed.map(([opening]) => opening).sort();
  const closings = parsed.map(([, closing]) => closing).sort();
  return dailyHours(openings[0], closings.at(-1));
}

const DAY_NUMBERS = new Map([
  ['sunday', 0],
  ['monday', 1],
  ['tuesday', 2],
  ['wednesday', 3],
  ['thursday', 4],
  ['friday', 5],
  ['saturday', 6],
]);

function daysFromGroup(value) {
  return clean(value)
    .split(/\s*,\s*|\s+and\s+/i)
    .map((day) => DAY_NUMBERS.get(day.toLowerCase()))
    .filter((day) => day !== undefined);
}

function openHours(description) {
  const text = clean(description);
  if (/\b24\s*hours\b|\bopen\s*24\/7\b|\b24\/7\b/i.test(text) || /\b00:00\s*(?:-|to|until)\s*24:00\b/i.test(text)) {
    return [1, 2, 3, 4, 5, 6, 0].map((day) => ({
      Day: day,
      OpenAllDay: true,
    }));
  }

  const daily =
    text.match(/Opening hours:\s*(\d{1,2}(?::\d{2})?)\s*-\s*(\d{1,2}(?::\d{2})?)\s*daily/i) ||
    text.match(/Open daily from\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+until\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  if (daily) {
    const opening = parseTime(daily[1]);
    const closing = parseTime(daily[2]);
    return opening && closing ? dailyHours(opening, closing) : [];
  }

  const explicitOpeningHours = [
    ...text.matchAll(
      /Opening hours:\s*(?:Daily:\s*)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|to|until)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)(?:\s*daily)?/gi,
    ),
  ];
  if (explicitOpeningHours.length === 1) {
    const opening = parseTime(explicitOpeningHours[0][1]);
    const closing = parseTime(explicitOpeningHours[0][2]);
    return opening && closing ? dailyHours(opening, closing) : [];
  }

  const byDay = [];
  const dayPattern = [...DAY_NUMBERS.keys()].join('|');
  const groupPattern = new RegExp(
    `((?:${dayPattern})(?:\\s*,\\s*(?:${dayPattern}))*(?:\\s+and\\s+(?:${dayPattern}))?)\\s*:\\s*(\\d{1,2}:\\d{2})\\s*-\\s*(\\d{1,2}:\\d{2})`,
    'gi',
  );
  for (const match of text.matchAll(groupPattern)) {
    const opening = parseTime(match[2]);
    const closing = parseTime(match[3]);
    if (!opening || !closing) {
      continue;
    }
    for (const day of daysFromGroup(match[1])) {
      byDay.push({
        Day: day,
        OpeningHour: opening,
        ClosingHour: closing,
      });
    }
  }
  if (byDay.length > 0) {
    return byDay.sort((first, second) => first.Day - second.Day);
  }

  const serviceRanges = [
    ...text.matchAll(
      /(?:\b\d+\s*-\s*Hour\s+service:\s*)?(?:Monday\s+to\s+Sunday:\s*)?(\d{1,2}:\d{2})\s*(?:-|to|until)\s*(\d{1,2}:\d{2})/gi,
    ),
  ].map((match) => [match[1], match[2]]);
  if (serviceRanges.length > 1) {
    return widestDailyHours(serviceRanges);
  }

  return [];
}

function price(html) {
  const amount = Number(metaContent(html, 'og:product:price:amount'));
  const currencyCode = metaContent(html, 'og:product:price:currency').toUpperCase();
  if (!Number.isFinite(amount) || amount <= 0 || !/^[A-Z]{3}$/.test(currencyCode)) {
    return null;
  }
  return { amount, currencyCode };
}

function brandFromName(name) {
  return /plaza premium/i.test(name) ? 'Plaza Premium Lounge' : 'Marhaba';
}

function locationFromDescription(description) {
  const text = clean(description);
  return (
    clean(text.match(/\bLocated\s+(?:at|in)\s+([^.]*(?:Gate|Terminal|Concourse|Area|Level|Departures|Arrivals)[^.]*)\./i)?.[1]) ||
    clean(text.match(/\b(?:the\s+)?lounge\s+is\s+located\s+([^.]*)\./i)?.[1]) ||
    text
  );
}

function operationExceptions(html, description) {
  const promotionBanners = [
    ...String(html ?? '').matchAll(/<div[^>]+class=["'][^"']*header-banner-promotion[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi),
  ].map((match) => stripHtml(match[1]));
  const descriptionExceptions = [
    ...clean(description).matchAll(
      /(?:[^.]*\b(?:closed|closure|renovation|temporarily unavailable|remain open)\b[^.]*\.)/gi,
    ),
  ].map((match) => clean(match[0]));
  return [...new Set([...promotionBanners, ...descriptionExceptions].filter(Boolean))];
}

function terminalLocation(description, terminal) {
  const text = clean(description);
  const escaped = terminal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = text.match(new RegExp(`Lounge\\s+in\\s+${escaped}\\s+is\\s+located\\s+in\\s+([^.]*)`, 'i'));
  const location = clean(match?.[1]);
  if (!location) {
    return terminal;
  }
  return location.toLowerCase().startsWith(terminal.toLowerCase()) ? location : `${terminal}, ${location}`;
}

function areaVariantName(baseName, area) {
  const cleanArea = clean(area);
  if (!cleanArea) {
    return baseName;
  }
  if (/terminal\s+\d/i.test(cleanArea)) {
    return `${baseName} ${cleanArea}`;
  }
  if (/main\s+lobby/i.test(cleanArea)) {
    return 'Marhaba Lounge Main Lobby';
  }
  if (/east\s+wing/i.test(cleanArea)) {
    return 'Marhaba Lounge East Wing';
  }
  return `${baseName} ${cleanArea}`;
}

function areaHoursVariants(base, description) {
  const text = clean(description);
  const variants = [];
  for (const match of text.matchAll(
    /Opening hours(?:\s+for\s+(Terminal\s+\d))?:\s*(\d{1,2}:\d{2})\s*(?:-|to|until)\s*(\d{1,2}:\d{2})(?:\s*\(([^)]+)\))?/gi,
  )) {
    const area = clean(match[1] || match[4]);
    if (!area) {
      continue;
    }
    const opening = parseTime(match[2]);
    const closing = parseTime(match[3]);
    if (!opening || !closing) {
      continue;
    }
    const terminal = /^Terminal\s+\d$/i.test(area) ? area : base.terminal;
    const near = /^Terminal\s+\d$/i.test(area) ? terminalLocation(description, area) : area;
    const name = areaVariantName(base.name, area);
    variants.push({
      ...base,
      sourceRecordId: `${base.sourceRecordId}-${slugify(area)}`,
      name,
      terminal,
      near,
      openHours: dailyHours(opening, closing),
    });
  }
  return variants;
}

function closedTerminalAreas(description, exceptions) {
  const text = clean([description, ...(exceptions ?? [])].join(' '));
  const closed = new Set();
  for (const match of text.matchAll(/\bConcourse\s+([A-Z0-9]+)\s+Lounge\s+is\s+closed\b/gi)) {
    closed.add(`concourse ${match[1].toLowerCase()}`);
  }
  for (const match of text.matchAll(/\b(Terminal\s+\d(?:,\s*Concourse\s+[A-Z0-9]+)?)\s+Lounge\s+is\s+closed\b/gi)) {
    closed.add(normalizeAreaKey(match[1]));
  }
  return closed;
}

function normalizeAreaKey(value) {
  return clean(value)
    .toLowerCase()
    .replace(/\s*,\s*/g, ' ')
    .replace(/\s+/g, ' ');
}

function terminalAllDayAreas(description, exceptions) {
  const text = clean(description);
  const closed = closedTerminalAreas(description, exceptions);
  const areas = [];

  for (const match of text.matchAll(/\b(Terminal\s+\d)\s*:\s*24\s*hours\b/gi)) {
    const terminal = clean(match[1]);
    const key = normalizeAreaKey(terminal);
    if (!closed.has(key)) {
      areas.push({ terminal, near: terminal });
    }
  }

  for (const match of text.matchAll(/\b(Terminal\s+\d),\s*Concourse\s+([A-Z0-9,\s&and]+?)\s*:\s*24\s*hours\b/gi)) {
    const terminal = clean(match[1]);
    const concourseParts = clean(match[2])
      .replace(/\band\b/gi, ',')
      .replace(/&/g, ',')
      .split(',')
      .map((part) => clean(part))
      .filter(Boolean);
    for (const part of concourseParts) {
      const concourse = /^Concourse\b/i.test(part) ? clean(part) : `Concourse ${part}`;
      const near = `${terminal}, ${concourse}`;
      if (!closed.has(normalizeAreaKey(near)) && !closed.has(normalizeAreaKey(concourse))) {
        areas.push({ terminal: `${terminal} ${concourse}`, near });
      }
    }
  }

  const byKey = new Map();
  for (const area of areas) {
    const key = normalizeAreaKey(area.terminal);
    if (!byKey.has(key)) {
      byKey.set(key, area);
    }
  }
  return [...byKey.values()];
}

function allDayTerminalVariants(base, description) {
  const areas = terminalAllDayAreas(description, base.exceptions);
  if (areas.length <= 1) {
    return [];
  }

  return areas.map((area) => ({
    ...base,
    sourceRecordId: `${base.sourceRecordId}-${slugify(area.terminal)}`,
    name: areaVariantName(base.name, area.terminal),
    terminal: area.terminal,
    concourse: clean(area.terminal.match(/\bConcourse\s+[A-Z0-9]+\b/i)?.[0]),
    near: area.near,
    openHours: [1, 2, 3, 4, 5, 6, 0].map((day) => ({
      Day: day,
      OpenAllDay: true,
    })),
  }));
}

function parseMarhabaStructuredRecordBase(html, { url = '' } = {}) {
  const name = productName(html);
  const code = airportCode(html, url);
  if (!name || !/^[A-Z0-9]{3}$/.test(code)) {
    return null;
  }

  const description = descriptionText(html);
  const sourceUrl = canonicalUrl(html, url);
  const brand = brandFromName(name);

  return {
    sourceRecordId: `${code}-${slugify(sourceSlug(sourceUrl) || name)}`,
    name,
    brand,
    operator: brand,
    airportCode: code,
    airportName: `${code} Airport`,
    terminal: terminal(html, description),
    concourse: clean(description).match(/\bConcourse\s+[A-Z0-9]+\b/i)?.[0] ?? '',
    near: locationFromDescription(description),
    openHours: openHours(description),
    exceptions: operationExceptions(html, description),
    price: price(html),
    sourceUrl,
    accessNotes: 'Official Marhaba product page with published lounge access price.',
  };
}

export function parseMarhabaStructuredRecords(html, { url = '' } = {}) {
  const base = parseMarhabaStructuredRecordBase(html, { url });
  if (!base) {
    return [];
  }

  const description = descriptionText(html);
  const variants = areaHoursVariants(base, description);
  const allDayVariants = allDayTerminalVariants(base, description);
  if (allDayVariants.length > 1) {
    return allDayVariants;
  }
  return variants.length > 1 ? variants : [base];
}

export function parseMarhabaStructuredRecord(html, { url = '' } = {}) {
  return parseMarhabaStructuredRecords(html, { url })[0] ?? null;
}
