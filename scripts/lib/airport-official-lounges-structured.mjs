function decodeEntities(value) {
  return String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, '-')
    .replace(/&mdash;|&#8212;/gi, '-')
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/[–—]/g, '-');
}

function clean(value) {
  return decodeEntities(value).replace(/\s+/g, ' ').trim();
}

function stripHtml(value) {
  return clean(String(value ?? '').replace(/<[^>]+>/g, ' '));
}

function htmlBlocks(value, regex) {
  return [...String(value ?? '').matchAll(regex)].map((match) => match[0]);
}

function slugify(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

function parseTime(value) {
  const normalized = clean(value).replace(/\./g, '').replace(/\s+/g, ' ');
  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
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
  if (!Number.isFinite(hour) || hour > 23 || !Number.isFinite(minute) || minute > 59) {
    return '';
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function parseClock(value) {
  const normalized = clean(value).replace(/\./g, '').replace(/\s+/g, ' ');
  const meridiemTime = parseTime(normalized);
  if (meridiemTime) {
    return meridiemTime;
  }

  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!match) {
    return '';
  }

  const hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
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

const DAY_NAME_TO_INDEX = new Map([
  ['sunday', 0],
  ['monday', 1],
  ['tuesday', 2],
  ['wednesday', 3],
  ['thursday', 4],
  ['friday', 5],
  ['saturday', 6],
]);

function dayIndexesFromText(value) {
  const text = clean(value).toLowerCase();
  if (/every\s*day|daily|monday\s*-\s*sunday|monday\s+to\s+sunday/i.test(text)) {
    return [1, 2, 3, 4, 5, 6, 0];
  }
  const days = [];
  for (const [name, index] of DAY_NAME_TO_INDEX) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(text)) {
      days.push(index);
    }
  }
  return days;
}

function hoursRowsFromText(value) {
  const text = clean(value)
    .replace(/\bto\b/gi, '-')
    .replace(/[–—]/g, '-');
  const rows = [];
  const regex = /([A-Za-z,\s-]+):?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/gi;
  for (const match of text.matchAll(regex)) {
    const opening = parseClock(match[2]);
    const closing = parseClock(match[3]);
    const days = dayIndexesFromText(match[1]);
    if (!opening || !closing || days.length === 0) {
      continue;
    }
    rows.push(...days.map((day) => ({ Day: day, OpeningHour: opening, ClosingHour: closing })));
  }
  return rows;
}

function allDayHours() {
  return [1, 2, 3, 4, 5, 6, 0].map((day) => ({
    Day: day,
    OpenAllDay: true,
  }));
}

function nextDataPayload(html) {
  const payload = String(html ?? '').match(/<script\s+id=["']__NEXT_DATA__["']\s+type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if (!payload) {
    return null;
  }
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

function airportCodeFromPanynjUrl(url) {
  const host = (() => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return clean(url).toLowerCase();
    }
  })();

  if (host.includes('jfkairport.com')) {
    return 'JFK';
  }
  if (host.includes('laguardiaairport.com')) {
    return 'LGA';
  }
  if (host.includes('newarkairport.com')) {
    return 'EWR';
  }
  return '';
}

function airportNameFromPanynjCode(code) {
  return {
    JFK: 'John F. Kennedy International Airport',
    LGA: 'LaGuardia Airport',
    EWR: 'Newark Liberty International Airport',
  }[code] ?? `${code} Airport`;
}

function openHoursFromText(value) {
  const normalized = clean(value)
    .replace(/\bnoon\b/gi, '12:00 pm')
    .replace(/\bmidnight\b/gi, '12:00 am');
  const match = normalized.match(/(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))/i);
  if (!match) {
    return [];
  }

  const opening = parseTime(match[1]);
  const closing = parseTime(match[2]);
  return opening && closing ? dailyHours(opening, closing) : [];
}

function openHoursFromPanynjFormattedHours(formattedHours = []) {
  const rows = Array.isArray(formattedHours) ? formattedHours : [];
  if (rows.some((row) => /24\s*hours?|open\s*all\s*day/i.test(clean(row.hours)))) {
    return allDayHours();
  }

  const parsed = rows.flatMap((row) => {
    const hours = openHoursFromText(clean(row.hours));
    if (hours.length === 0) {
      return [];
    }
    if (/daily|every\s*day/i.test(clean(row.days)) || rows.length === 1) {
      return hours;
    }
    return hours;
  });

  return parsed.length > 0 ? parsed : [];
}

function panynjAmenities(poi) {
  const text = [poi?.description, ...(poi?.displayKeywords ?? [])].map(clean).join(' ');
  return {
    Lounge: true,
    Food: /food|dining|buffet|snacks|meal|cuisine/i.test(text),
    Drinks: /drink|bar|beverage|coffee|cocktail|wine|beer/i.test(text),
    'Wi-Fi': /wi-?fi|work/i.test(text),
    Showers: /shower/i.test(text),
    Spa: /spa|massage|wellness/i.test(text),
  };
}

function panynjDetailUrl({ sourceUrl, poi }) {
  const url = new URL('/dine-shop-relax/lounge-and-rest/detail', sourceUrl);
  url.searchParams.set('poiId', clean(poi.id));
  url.searchParams.set('name', clean(poi.name));
  url.searchParams.set('structureName', clean(poi.structureName));
  url.searchParams.set('returnTo', '/dine-shop-relax/lounge-and-rest');
  return url.toString();
}

export function parsePanynjOfficialLoungeRecords({ pois = [], detailsById = {}, url = '' } = {}) {
  const airportCode = airportCodeFromPanynjUrl(url);
  if (!airportCode) {
    return [];
  }

  const records = [];
  for (const card of pois ?? []) {
    const detail = detailsById?.[card.id] ?? {};
    const poi = { ...card, ...detail };
    const name = clean(poi.name);
    const terminal = clean(poi.structureName);
    const openHours = openHoursFromPanynjFormattedHours(poi.formattedHours);
    if (!name || !terminal || openHours.length === 0 || !/relax\.lounge/i.test(clean(poi.category))) {
      continue;
    }

    const near = [clean(poi.floorName), clean(poi.nearbyLandmark)].filter(Boolean).join(', ');
    records.push({
      sourceRecordId: `airport-official-pages-${airportCode.toLowerCase()}-${slugify(name)}-${slugify(terminal)}-${slugify(near)}`,
      name,
      brand: name,
      operator: name,
      airportCode,
      airportName: airportNameFromPanynjCode(airportCode),
      terminal,
      near,
      sourceUrl: panynjDetailUrl({ sourceUrl: url, poi }),
      programs: ['Airport official page'],
      openHours,
      amenities: panynjAmenities(poi),
      accessNotes: clean(poi.description) || 'Published by the official airport lounge page.',
    });
  }

  return records.sort((first, second) => `${first.airportCode}-${first.name}`.localeCompare(`${second.airportCode}-${second.name}`));
}

function terminalFromText(value) {
  const text = clean(value);
  const terminal =
    text.match(/\bDianne\s+Feinstein\s+International\s+Terminal\s+[A-Z]\b/i)?.[0] ||
    text.match(/\bInternational\s+Terminal\s+[A-Z]\b/i)?.[0] ||
    text.match(/\bTerminal\s+[A-Z0-9](?:-[A-Z]+)?(?:\/[A-Z])?(?:\s+Connector)?\b/i)?.[0] ||
    '';
  return clean(terminal);
}

function gatwickSlug(url) {
  try {
    return new URL(url).pathname.match(/\/(lounge-[^/.]+)\.html$/i)?.[1]?.toLowerCase() ?? '';
  } catch {
    return clean(url).match(/\/(lounge-[^/.]+)\.html$/i)?.[1]?.toLowerCase() ?? '';
  }
}

const GATWICK_DETAIL_PAGES = new Map([
  ['lounge-no1', { name: 'No1 Lounges', brand: 'No1 Lounges', operator: 'No1 Lounges', terminals: ['North Terminal', 'South Terminal'] }],
  ['lounge-my-lounge', { name: 'My Lounge', brand: 'My Lounge', operator: 'No1 Lounges', terminals: ['North Terminal', 'South Terminal'] }],
  ['lounge-plaza-premium', { name: 'Plaza Premium Lounge', brand: 'Plaza Premium Lounge', operator: 'Plaza Premium', terminals: ['North Terminal'] }],
  ['lounge-plaza-express', { name: 'Plaza Express Lounge', brand: 'Plaza Premium Lounge', operator: 'Plaza Premium', terminals: ['North Terminal'] }],
  ['lounge-club-aspire', { name: 'Club Aspire Lounge', brand: 'Club Aspire', operator: 'Airport Dimensions', terminals: ['South Terminal'] }],
  ['lounge-clubrooms', { name: 'Clubrooms', brand: 'Clubrooms', operator: 'No1 Lounges', terminals: ['North Terminal', 'South Terminal'] }],
  ['lounge-arrive-refresh', { name: 'Arrive & Refresh', brand: 'Arrive & Refresh', operator: 'Sofitel', terminals: ['North Terminal'] }],
]);

function gatwickIconText(html, label) {
  const blocks = [...String(html ?? '').matchAll(/<div class="c-icon-wrapper[\s\S]*?<\/div>\s*<\/div>/gi)].map((match) => match[0]);
  const block = blocks.find((candidate) => stripHtml(candidate).toLowerCase().includes(label.toLowerCase()));
  return stripHtml(block ?? '');
}

function gatwickPrice(html) {
  const text = gatwickIconText(html, '£') || stripHtml(html);
  const adultPrice =
    text.match(/Adult\s*\([^)]*\)\s*(?:From\s*)?£\s*(\d+(?:\.\d+)?)/i)?.[1] ||
    text.match(/Prices?\s+from(?:\s+just)?\s*£\s*(\d+(?:\.\d+)?)/i)?.[1] ||
    text.match(/From\s+£\s*(\d+(?:\.\d+)?)/i)?.[1] ||
    text.match(/£\s*(\d+(?:\.\d+)?)/i)?.[1];
  const amount = Number(adultPrice);
  return Number.isFinite(amount) && amount > 0 ? { amount, currencyCode: 'GBP' } : null;
}

function gatwickHoursByTerminal(html) {
  const text = gatwickIconText(html, 'Opening times');
  const hours = new Map();
  const terminalRegex = /\b(North|South)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/gi;
  for (const match of text.matchAll(terminalRegex)) {
    const opening = parseClock(match[2]);
    const closing = parseClock(match[3]);
    if (opening && closing) {
      hours.set(`${match[1]} Terminal`, dailyHours(opening, closing));
    }
  }

  const daily = text.match(/\bDaily\s+(\d{1,2}(?::\d{2})?)\s*-\s*(\d{1,2}(?::\d{2})?)/i);
  if (daily) {
    const opening = parseClock(daily[1]);
    const closing = parseClock(daily[2]);
    if (opening && closing) {
      hours.set('Daily', dailyHours(opening, closing));
    }
  }

  return hours;
}

function gatwickDirectionsByTerminal(html) {
  const directions = new Map();
  const text = stripHtml(html);
  const directionRegex =
    /\b(North|South)\s+Terminal\s*[-–]\s*([\s\S]*?)(?=\b(?:North|South)\s+Terminal\s*[-–]|\b(?:Your entry|What(?:'|’)s included|What are the current|Who can use|How long|How do I|Useful links)|$)/gi;
  for (const match of text.matchAll(directionRegex)) {
    const terminal = `${match[1].replace(/\b\w/g, (letter) => letter.toUpperCase())} Terminal`;
    const candidate = clean(match[2]);
    if (
      candidate.length > 0 &&
      candidate.length <= 360 &&
      !/hidden alert|Select your|January|February|March|April|May|June|July|August|September|October|November|December|checkout/i.test(candidate) &&
      /security|signs|departure|arrivals|customs|Sofitel|lounge|pavilion|level/i.test(candidate)
    ) {
      directions.set(terminal, candidate);
    }
  }
  return directions;
}

function gatwickAmenities(html) {
  const text = stripHtml(html);
  return {
    Lounge: true,
    Food: /food|buffet|breakfast|snacks|menu/i.test(text),
    Drinks: /drink|bar|beer|wine|spirits|soft drinks/i.test(text),
    'Wi-Fi': /Wi-?Fi/i.test(text),
    Showers: /shower/i.test(text),
  };
}

function metaContent(html, name) {
  const escapedName = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return clean(
    String(html ?? '').match(new RegExp(`<meta\\s+[^>]*(?:name|property)=["']${escapedName}["'][^>]*content=["']([^"']+)["']`, 'i'))?.[1] ??
      String(html ?? '').match(new RegExp(`<meta\\s+[^>]*content=["']([^"']+)["'][^>]*(?:name|property)=["']${escapedName}["']`, 'i'))?.[1] ??
      '',
  );
}

function titleText(html) {
  return stripHtml(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
}

function heathrowName(html) {
  const title = metaContent(html, 'title') || titleText(html);
  return clean(title.replace(/\s*\|\s*Heathrow\s*$/i, '').replace(/\s*-\s*Terminal\s+\d+\s*$/i, ''));
}

function heathrowTerminal(url, html) {
  const pathTerminal = (() => {
    try {
      return new URL(url).pathname.match(/\/terminal-(\d+)\//i)?.[1] ?? '';
    } catch {
      return clean(url).match(/\/terminal-(\d+)\//i)?.[1] ?? '';
    }
  })();
  if (pathTerminal) {
    return `Terminal ${pathTerminal}`;
  }

  const title = metaContent(html, 'title') || titleText(html);
  return clean(title.match(/\bTerminal\s+\d+\b/i)?.[0] ?? '');
}

function heathrowPrice(html) {
  const text = stripHtml(html);
  const amount = Number(text.match(/Prices?\s+from\s+£\s*(\d+(?:\.\d+)?)/i)?.[1]);
  return Number.isFinite(amount) && amount > 0 ? { amount, currencyCode: 'GBP' } : null;
}

function heathrowOpenHours(html) {
  const text = stripHtml(html);
  const match = text.match(/\bMon\s*-\s*Sun\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\b/i);
  if (!match) {
    return [];
  }

  const opening = parseClock(match[1]);
  const closing = parseClock(match[2]);
  return opening && closing ? dailyHours(opening, closing) : [];
}

function heathrowAmenities(html) {
  const text = stripHtml(html);
  return {
    Lounge: true,
    Food: /food|snacks|menu|dishes|breakfast/i.test(text),
    Drinks: /bar|beer|wine|spirits|drinks/i.test(text),
    'Wi-Fi': /Wi-?Fi|wifi/i.test(text),
    Showers: /shower/i.test(text),
    Spa: /spa/i.test(text),
  };
}

export function parseHeathrowOfficialLoungeRecords(html, { url = '' } = {}) {
  const name = heathrowName(html);
  const terminal = heathrowTerminal(url, html);
  const openHours = heathrowOpenHours(html);
  if (!name || !terminal || openHours.length === 0) {
    return [];
  }

  const text = stripHtml(html);
  const price = heathrowPrice(html);
  const securitySide = /\bAfter Security\b/i.test(text) ? 'After Security' : '';
  const description = metaContent(html, 'description');

  return [
    {
      sourceRecordId: `airport-official-pages-lhr-${slugify(name)}-${slugify(terminal)}`,
      name,
      brand: name,
      operator: name,
      airportCode: 'LHR',
      airportName: 'London Heathrow Airport',
      terminal,
      securitySide,
      near: securitySide,
      sourceUrl: url,
      programs: ['Heathrow official booking'],
      openHours,
      price,
      currencyCode: price?.currencyCode,
      amenities: heathrowAmenities(html),
      accessNotes: description || 'Official Heathrow lounge page with terminal, security side, operating hours, and booking price.',
    },
  ];
}

function manchesterPage(url) {
  if (/\/escape-lounges\/?$/i.test(clean(url))) {
    return {
      name: 'Escape Lounge',
      brand: 'Escape Lounge',
      operator: 'Escape Lounges',
      terminals: ['Terminal 2', 'Terminal 3'],
      programs: ['Manchester Airport official booking', 'DragonPass', 'Priority Pass'],
    };
  }
  if (/\/1903-lounge\/?$/i.test(clean(url))) {
    return {
      name: '1903 Lounge',
      brand: '1903 Lounge',
      operator: 'Manchester Airport',
      terminals: ['Terminal 2', 'Terminal 3'],
      programs: ['Manchester Airport official booking'],
    };
  }
  return null;
}

function manchesterPrice(section) {
  const amount = Number(clean(section).match(/Pre-book\s+from\s+£\s*(\d+(?:\.\d+)?)/i)?.[1]);
  return Number.isFinite(amount) && amount > 0 ? { amount, currencyCode: 'GBP' } : null;
}

function manchesterAmenities(html) {
  const text = stripHtml(html);
  return {
    Lounge: true,
    Food: /food|dishes|chef|menu|breakfast/i.test(text),
    Drinks: /wines|beers|spirits|drinks|bar|fizz|champagne/i.test(text),
    'Wi-Fi': /Wi-?Fi/i.test(text),
    Showers: /shower/i.test(text),
  };
}

const DXB_DETAIL_PAGES = new Map([
  [
    'game-space-gaming-lounge',
    {
      name: 'Game Space - Gaming Lounge',
      brand: 'Game Space - Gaming Lounge',
      operator: 'Game Space',
      programs: ['Dubai Airports official page'],
    },
  ],
  [
    'ahlan-business-class-lounge',
    {
      name: 'Ahlan Business Class Lounge',
      brand: 'Ahlan Business Class Lounge',
      operator: 'Ahlan Lounges',
      programs: ['Dubai Airports official page', 'Priority Pass'],
    },
  ],
  [
    'plaza-premium-lounge',
    {
      name: 'Plaza Premium Lounge',
      brand: 'Plaza Premium Lounge',
      operator: 'Plaza Premium Lounge',
      programs: ['Dubai Airports official page', 'Priority Pass'],
    },
  ],
]);

function dxbSlug(url) {
  try {
    return new URL(url).pathname.split('/').filter(Boolean).pop() ?? '';
  } catch {
    return clean(url).split('/').filter(Boolean).pop() ?? '';
  }
}

function dxbLocationText(html) {
  const locationSection =
    String(html ?? '').match(/<h2[^>]*>\s*Location\s*<\/h2>([\s\S]*?)(?:<h2|<\/article|<section|<footer)/i)?.[1] ?? '';
  return stripHtml(locationSection);
}

function dxbMainText(html) {
  const value = String(html ?? '');
  const beforeLocation = value.split(/<h2[^>]*>\s*Location\s*<\/h2>/i)[0] ?? value;
  const afterTitle = beforeLocation.split(/<h1[^>]*>[\s\S]*?<\/h1>/i).pop() ?? beforeLocation;
  return stripHtml(afterTitle);
}

function dxbTerminalAndGate(locationText) {
  const text = clean(locationText);
  const terminal = clean(text.match(/\bTerminal\s+\d\b/i)?.[0]);
  const gateArea = clean(text.match(/\b([A-Z])\s*Gates?\b/i)?.[1]);
  if (!terminal || !gateArea) {
    return null;
  }

  return {
    terminal: `${terminal} Concourse ${gateArea.toUpperCase()}`,
    near: `${gateArea.toUpperCase()} Gates${/\bArrivals\b/i.test(text) ? ' - Arrivals' : ' - Departures'}`,
  };
}

function dxbAmenities(text) {
  return {
    Lounge: true,
    Gaming: /gaming|playstation|game/i.test(text),
    Food: /food|drinks|buffet|snacks/i.test(text),
    'Wi-Fi': /wi-?fi/i.test(text),
  };
}

export function parseDubaiAirportsOfficialLoungeRecords(html, { url = '' } = {}) {
  const page = DXB_DETAIL_PAGES.get(dxbSlug(url));
  if (!page) {
    return [];
  }

  const location = dxbTerminalAndGate(dxbLocationText(html));
  if (!location) {
    return [];
  }

  const text = dxbMainText(html);
  return [
    {
      sourceRecordId: `airport-official-pages-dxb-${slugify(page.name)}-${slugify(location.terminal)}`,
      name: page.name,
      brand: page.brand,
      operator: page.operator,
      airportCode: 'DXB',
      airportName: 'Dubai International Airport',
      terminal: location.terminal,
      securitySide: /Arrivals/i.test(location.near) ? 'Arrivals' : 'Departures',
      near: location.near,
      sourceUrl: url,
      programs: page.programs,
      openHours: /\bopen\s+24\/7\b|\bopen\s+24\s+hours\b/i.test(text) ? allDayHours() : [],
      amenities: dxbAmenities(text),
      accessNotes: 'Official Dubai Airports detail page with terminal and gate-area location.',
    },
  ];
}

export function parseManchesterOfficialLoungeRecords(html, { url = '' } = {}) {
  const page = manchesterPage(url);
  if (!page) {
    return [];
  }

  const text = stripHtml(html);
  const detailsStart = text.search(/\bThe details\b/i);
  if (detailsStart < 0) {
    return [];
  }

  const sections = text
    .slice(detailsStart)
    .split(/\bOpening times\b/i)
    .slice(1);
  const amenities = manchesterAmenities(html);
  const records = [];

  for (const [index, section] of sections.entries()) {
    const terminal = page.terminals[index];
    if (!terminal) {
      continue;
    }

    const hours = clean(section).match(/Open\s+daily:\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/i);
    if (!hours) {
      continue;
    }

    const opening = parseClock(hours[1]);
    const closing = parseClock(hours[2]);
    const price = manchesterPrice(section);
    const location =
      clean(section.match(/Lounge location\s+([\s\S]*?)\s+Get directions\s+Price/i)?.[1]) ||
      clean(section.match(/Lounge location\s+([\s\S]*?)\s+Price/i)?.[1]);
    if (!opening || !closing || !price || !location) {
      continue;
    }

    records.push({
      sourceRecordId: `airport-official-pages-man-${slugify(page.name)}-${slugify(terminal)}`,
      name: page.name,
      brand: page.brand,
      operator: page.operator,
      airportCode: 'MAN',
      airportName: 'Manchester Airport',
      terminal,
      securitySide: 'After Security',
      near: location,
      sourceUrl: url,
      programs: page.programs,
      openHours: dailyHours(opening, closing),
      price,
      currencyCode: price.currencyCode,
      amenities,
      accessNotes: 'Official Manchester Airport lounge page with terminal, location, operating hours, and booking price.',
    });
  }

  return records;
}

function sourceRecord({ sourceId, airportCode, airportName, name, terminal, near, hoursText, sourceUrl, programs = [] }) {
  const openHours = openHoursFromText(hoursText);
  if (!airportCode || !name || !terminal || openHours.length === 0) {
    return null;
  }

  return {
    sourceRecordId: `${sourceId}-${airportCode.toLowerCase()}-${slugify(name)}-${slugify(terminal)}-${slugify(near)}`,
    name,
    brand: name,
    operator: name,
    airportCode,
    airportName,
    terminal,
    near: clean(near),
    sourceUrl,
    programs,
    openHours,
    amenities: {
      Lounge: true,
    },
    accessNotes: 'Published by the official airport lounge page.',
  };
}

function bkkTime(value) {
  const match = clean(value).match(/^(\d{1,2})[.:](\d{2})$/);
  if (!match) {
    return '';
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || hour > 23 || !Number.isFinite(minute) || minute > 59) {
    return '';
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function bkkHours(value) {
  const text = clean(value);
  if (/\b24\s*hours?\b/i.test(text)) {
    return allDayHours();
  }
  const match = text.match(/\b(\d{1,2}[.:]\d{2})\s*[-–]\s*(\d{1,2}[.:]\d{2})\b/i);
  if (!match) {
    return [];
  }
  const opening = bkkTime(match[1]);
  const closing = bkkTime(match[2]);
  return opening && closing ? dailyHours(opening, closing) : [];
}

function bkkTerminal(location) {
  const text = clean(location);
  if (/\bTerminal\s+SAT-?1\b/i.test(text)) {
    return 'Terminal SAT-1';
  }
  const gateLetter = text.match(/\bGate\s+([A-Z])\s*-?\s*\d*/i)?.[1];
  if (gateLetter) {
    return `Concourse ${gateLetter.toUpperCase()}`;
  }
  const concourse = text.match(/\bConcourse\s+[A-Z0-9]+\b/i)?.[0];
  return clean(concourse || 'Terminal');
}

function bkkNear(location) {
  const text = clean(location);
  const gate =
    text.match(/\bopposite\s+Gate\s+([A-Z]\s*-?\s*\d+[A-Z]?)\b/i)?.[1] ||
    text.match(/\bDeparture\s+Gate\s+([A-Z]\s*-?\s*\d+[A-Z]?)\b/i)?.[1] ||
    text.match(/\bGate\s+([A-Z]\s*-?\s*\d+[A-Z]?)\b/i)?.[1] ||
    '';
  const normalizedGate = clean(gate).replace(/\s+/g, '').toUpperCase();
  const level = text.match(/\bLevel\s+\d+\b/i)?.[0] ?? '';
  const pieces = [
    text.match(/\bopposite\s+Gate\s+[A-Z]\s*-?\s*\d+[A-Z]?\b/i)?.[0] ??
      (normalizedGate ? `Gate ${normalizedGate}` : ''),
    level,
    text.replace(/\b(?:opposite\s+)?Gate\s+[A-Z]\s*-?\s*\d+[A-Z]?\b/gi, '').replace(/\bLevel\s+\d+\b/gi, ''),
  ];
  return clean(pieces.filter(Boolean).join(', ')).replace(/\s*,\s*,+/g, ',').replace(/\s+,\s*$/g, '').trim();
}

function bkkRecord({ name, location, openHours, sourceUrl, programs = [] }) {
  const cleanName = clean(name);
  const cleanLocation = clean(location);
  if (!cleanName || !cleanLocation) {
    return null;
  }

  return {
    sourceRecordId: `airport-official-pages-bkk-${slugify(cleanName)}-${slugify(cleanLocation)}`,
    name: cleanName,
    brand: cleanName,
    operator: cleanName,
    airportCode: 'BKK',
    airportName: 'Suvarnabhumi Airport',
    terminal: bkkTerminal(cleanLocation),
    near: bkkNear(cleanLocation),
    sourceUrl,
    programs: ['Suvarnabhumi official page', ...programs],
    openHours,
    amenities: {
      Lounge: true,
    },
    accessNotes: 'Official Suvarnabhumi Airport lounge page with published lounge location and available operating hours.',
  };
}

function bkkMiracleNameFromLocation(location) {
  const text = clean(location);
  if (/\bBusiness\s+Class\b/i.test(text) && !/\bFirst\s+Class\b/i.test(text)) {
    return 'Miracle Business Class Lounge';
  }
  if (/\bFirst\s+Class\b/i.test(text) && !/\bBusiness\s+Class\b/i.test(text)) {
    return 'Miracle First Class Lounge';
  }
  return 'Miracle Lounge';
}

function bkkSectionText(html) {
  const nextData = String(html ?? '').match(/<script\s+id=["']__NEXT_DATA__["']\s+type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
  let sourceHtml = html;
  if (nextData) {
    try {
      const payload = JSON.parse(nextData);
      sourceHtml =
        payload?.props?.pageProps?.contentDetail?.data?.webFetchContentDetail?.payload?.content_description ||
        sourceHtml;
    } catch {
      sourceHtml = html;
    }
  }

  const text = stripHtml(sourceHtml);
  const start = text.search(/\bMiracle\s+Lounge\b/i);
  const end = text.search(/\bFLIGHT\s+STATUS\b/i);
  if (start < 0) {
    return '';
  }
  return clean(text.slice(start, end > start ? end : undefined));
}

function bkkBetween(text, startPattern, endPattern) {
  const start = text.search(startPattern);
  if (start < 0) {
    return '';
  }
  const rest = text.slice(start);
  const end = rest.search(endPattern);
  return clean(rest.slice(0, end > 0 ? end : undefined));
}

function bkkSplitLocations(value) {
  const tokens = clean(value)
    .split(/\s+-\s*/)
    .map(clean)
    .filter(Boolean);
  const merged = [];
  for (const token of tokens) {
    if (/^(?:First|Business|First class)(?:\s+Class)?(?:\s*&\s*Business\s+Class)?$/i.test(token) && merged.length > 0) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} - ${token}`;
      continue;
    }
    if (/^East\b/i.test(token) && merged.length > 0) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} - ${token}`;
      continue;
    }
    merged.push(token);
  }
  return merged;
}

function pushBkkRecord(records, details) {
  const record = bkkRecord(details);
  if (record) {
    records.push(record);
  }
}

export function parseSuvarnabhumiOfficialLoungeRecords(html, { url = 'https://suvarnabhumi.airportthai.co.th/service/facility/detail/230' } = {}) {
  const text = bkkSectionText(html);
  if (!text) {
    return [];
  }

  const records = [];
  const international24 = bkkHours('open 24 hours');
  const domesticHours = bkkHours('05.00 - 22.00');
  const miracleSection = bkkBetween(text, /\bMiracle\s+Lounge\b/i, /\bThe\s+Coral\s+Lounge\b/i);
  const coralSection = bkkBetween(text, /\bThe\s+Coral\s+Lounge\b/i, /\bThe\s+SilverKris\s+Lounge\b/i);

  const miracleInternational =
    miracleSection.match(/\bInternational,\s+open\s+24\s+hours,\s+daily\s+-\s*([\s\S]*?)\s+Domestic,\s+open/i)?.[1] ?? '';
  for (const location of bkkSplitLocations(miracleInternational)) {
    pushBkkRecord(records, {
      name: bkkMiracleNameFromLocation(location),
      location,
      openHours: international24,
      sourceUrl: url,
    });
  }

  const miracleDomestic = miracleSection.match(/\bDomestic,\s+open\s+05\.00\s*[-–]\s*22\.00,\s+daily\s+-\s*([\s\S]*?)$/i)?.[1];
  if (miracleDomestic) {
    pushBkkRecord(records, {
      name: 'Miracle Lounge Domestic',
      location: miracleDomestic,
      openHours: domesticHours,
      sourceUrl: url,
    });
  }

  const coralInternational =
    coralSection.match(/\bInternational,\s+open\s+24\s+hours,\s+daily\s+-\s*([\s\S]*?)\s+Domestic,\s+open/i)?.[1] ?? '';
  for (const item of bkkSplitLocations(coralInternational)) {
    const parts = item.match(/^(The\s+Coral[\s\S]*?)(?:,\s+|\s+)(Departure\s+Gate\s+[A-Z0-9]+(?:\s+\(Cocoon\))?|Concourse\s+[A-Z])$/i);
    pushBkkRecord(records, {
      name: parts ? parts[1] : item,
      location: parts ? parts[2] : item,
      openHours: international24,
      sourceUrl: url,
    });
  }

  const coralDomestic = coralSection.match(/\bDomestic,\s+open\s+05\.00\s*[-–]\s*22\.00,\s+daily\s+-\s*([\s\S]*?)$/i)?.[1];
  if (coralDomestic) {
    const parts = coralDomestic.match(/^(The\s+Coral[\s\S]*?),\s*(Concourse\s+[A-Z])$/i);
    pushBkkRecord(records, {
      name: parts ? parts[1] : 'The Coral Domestic Departure Lounge',
      location: parts ? parts[2] : coralDomestic,
      openHours: domesticHours,
      sourceUrl: url,
    });
  }

  const singleRows = [
    ['The SilverKris Lounge', /\bThe\s+SilverKris\s+Lounge\s+International\s+-\s*(The\s+SilverKris\s+Lounge,\s*[\s\S]*?)\s+Japan\s+Airlines/i],
    ['Japan Airlines JAL Sakura Lounge', /\bJapan\s+Airlines\s+JAL\s+Sakura\s+Lounge\s+International\s+-\s*(Japan\s+Airlines\s+JAL\s+Sakura\s+Lounge,\s*[\s\S]*?)\s+EVA\s+AIR/i],
    ['EVA AIR Bangkok VIP Lounge', /\bEVA\s+AIR\s+Bangkok\s+VIP\s+Lounge\s+International\s+-\s*(EVA\s+AIR\s+Bangkok\s+VIP\s+Lounge,\s*[\s\S]*?)\s+Thai\s+Airways/i],
    ['China Airlines Dynasty Lounge', /\bChina\s+Airlines\s+Dynasty\s+Lounge\s+International\s+-\s*(China\s+Airlines\s+Dynasty\s+Lounge,\s*[\s\S]*?)\s+Emirates\s+Lounge/i],
    ['The Emirates Lounge', /\bEmirates\s+Lounge\s+International\s+-\s*(The\s+Emirates\s+Lounge,\s*[\s\S]*?)\s+Oman\s+Air/i],
    ['Oman Air First and Business Class Lounge', /\bOman\s+Air\s+First\s+and\s+Business\s+Class\s+Lounge\s+International\s+-\s*(Oman\s+Air\s+First\s+and\s+Business\s+Class\s+Lounge,\s*[\s\S]*?)\s+Bangkok\s+Airways/i],
    ['Turkish Airlines Lounge', /\bTurkish\s+Airlines\s+Lounge\s+International\s+-\s*(Turkish\s+Airlines\s+Lounge,\s*[\s\S]*?)\s+Qatar\s+Airways/i],
    ['Qatar Airways Bangkok Premium Lounge', /\bQatar\s+Airways\s+Bangkok\s+Premium\s+Lounge\s+International\s+-\s*(Qatar\s+Airways\s+Bangkok\s+Premium\s+Lounge,\s*[\s\S]*?)\s+Cathay\s+Pacific/i],
    ['Cathay Pacific First and Business Class Lounge', /\bCathay\s+Pacific\s+First\s+and\s+Business\s+Class\s+Lounge\s+International\s+-\s*(Cathay\s+Pacific\s+First\s+and\s+Business\s+Class\s+Lounge,\s*[\s\S]*?)\s+Air\s+France/i],
    ['Air France-KLM Sky Lounge', /\bAir\s+France-KLM\s+Sky\s+Lounge\s+International\s+-\s*(Air\s+Fance-KLM\s+Sky\s+Lounge,\s*[\s\S]*?)$/i],
  ];

  for (const [fallbackName, pattern] of singleRows) {
    const value = text.match(pattern)?.[1];
    if (!value) {
      continue;
    }
    const parts = value.match(/^([^,]+),\s*([\s\S]+)$/);
    pushBkkRecord(records, {
      name: parts ? parts[1].replace(/\bFance\b/i, 'France') : fallbackName,
      location: parts ? parts[2] : value,
      openHours: [],
      sourceUrl: url,
    });
  }

  const thaiSection = text.match(/\bThai\s+Airways\s+Lounge\s+International\s+-\s*([\s\S]*?)\s+China\s+Airlines/i)?.[1] ?? '';
  for (const item of bkkSplitLocations(thaiSection)) {
    const parts = item.match(/^(Royal\s+(?:First|Orchid|Silk)\s+Lounge),\s*([\s\S]+)$/i);
    pushBkkRecord(records, {
      name: parts ? parts[1] : item,
      location: parts ? parts[2] : item,
      openHours: [],
      sourceUrl: url,
    });
  }

  const bangkokAirwaysSection = text.match(/\bBangkok\s+Airways\s+Lounge\s+International\s+-\s*([\s\S]*?)\s+Turkish\s+Airlines/i)?.[1] ?? '';
  for (const item of bkkSplitLocations(bangkokAirwaysSection)) {
    const parts = item.match(/^(Boutique\s+Lounge|Blue\s+Ribbon\s+Lounge),\s*([\s\S]+)$/i);
    pushBkkRecord(records, {
      name: parts ? parts[1] : item,
      location: parts ? parts[2] : item,
      openHours: [],
      sourceUrl: url,
    });
  }

  const byId = new Map(records.map((record) => [record.sourceRecordId, record]));
  return [...byId.values()].sort((first, second) => `${first.name}-${first.near}`.localeCompare(`${second.name}-${second.near}`));
}

function hoursFromChangiLocation(location) {
  if (/24\s*hours?/i.test(clean(location.operatingTime)) || /24hr/i.test(clean(location.typeOfOperatingHours))) {
    return allDayHours();
  }

  const opening = clean(location.openingHour);
  const closing = clean(location.closedHour);
  if (/^\d{2}:\d{2}$/.test(opening) && /^\d{2}:\d{2}$/.test(closing)) {
    return dailyHours(opening, closing);
  }

  return [];
}

function changiName(item, location) {
  return clean(location.locationName) || clean(location.unitNumber) || clean(item.title);
}

function changiPrograms(item) {
  const tags = item.tags ?? {};
  return Object.values(tags)
    .map(clean)
    .filter(Boolean);
}

function changiNear(location) {
  const parts = [
    clean(location.area),
    clean(location.level) ? `Level ${clean(location.level)}` : '',
    clean(location.unitNumber),
    clean(location.map_poi) ? `Map ${clean(location.map_poi).replace(/^map\//i, '')}` : '',
  ];
  return parts.filter(Boolean).join(', ');
}

function changiDetailName(html) {
  return (
    stripHtml(String(html ?? '').match(/<h1[^>]*class=["'][^"']*\bcmp_directory-title\b[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1]) ||
    clean(metaContent(html, 'title').replace(/\s*\|\s*Changi Airport.*$/i, '')) ||
    clean(titleText(html).replace(/\s*\|\s*Changi Airport.*$/i, ''))
  );
}

function changiDetailDescription(html) {
  return (
    stripHtml(String(html ?? '').match(/<div[^>]*class=["'][^"']*\bcmp_directory-description\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]) ||
    metaContent(html, 'description')
  );
}

function changiDetailTerminal(value) {
  const text = clean(value);
  return text.match(/\bT\d\b/i)?.[0]?.toUpperCase() || clean(text.match(/\bTerminal\s+\d\b/i)?.[0]);
}

function changiDetailHours(sectionHtml) {
  const status = stripHtml(String(sectionHtml ?? '').match(/<div[^>]*class=["'][^"']*\bcmp_location_operatingStatus\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]);
  const time = stripHtml(String(sectionHtml ?? '').match(/<div[^>]*class=["'][^"']*\bcmp_location_operatingTime\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]);
  if (/open\s+24\s+hours?/i.test(`${status} ${time}`)) {
    return allDayHours();
  }
  const match = clean(`${status} ${time}`).match(/\b(\d{1,2}:?\d{2})\s*[-–]\s*(\d{1,2}:?\d{2})\b/);
  if (!match) {
    return [];
  }
  const opening = parseClock(match[1].replace(/^(\d{2})(\d{2})$/, '$1:$2'));
  const closing = parseClock(match[2].replace(/^(\d{2})(\d{2})$/, '$1:$2'));
  return opening && closing ? dailyHours(opening, closing) : [];
}

function changiDetailNear(sectionHtml) {
  const area = stripHtml(String(sectionHtml ?? '').match(/<span[^>]*class=["'][^"']*\bcmp_location_area\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]);
  const level = stripHtml(String(sectionHtml ?? '').match(/<span[^>]*class=["'][^"']*\bcmp_location_unit--level\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]);
  const unit = stripHtml(String(sectionHtml ?? '').match(/<span[^>]*class=["'][^"']*\bcmp_location_unit--unit\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]);
  const mapPoi = clean(String(sectionHtml ?? '').match(/\bdata-map-poi=["'][^"']*#map\/([^"']+)["']/i)?.[1] ?? '');
  return [area, level, unit, mapPoi ? `Map ${mapPoi}` : ''].filter(Boolean).join(', ');
}

function changiDetailPrice(html) {
  const text = stripHtml(html);
  const amount = Number(
    text.match(/\bAdult:\s*3\s*hours?\s*\(S\$\s*(\d+(?:\.\d+)?)\)/i)?.[1] ||
      text.match(/\bAdult:[\s\S]*?S\$\s*(\d+(?:\.\d+)?)/i)?.[1],
  );
  return Number.isFinite(amount) && amount > 0 ? { amount, currencyCode: 'SGD' } : null;
}

function changiDetailAmenities(html) {
  const text = stripHtml(html);
  return {
    Lounge: true,
    Food: /refreshments|food|beverage|dining|delicacies/i.test(text),
    Drinks: /beverage|drinks/i.test(text),
    Showers: /shower/i.test(text),
    'Wi-Fi': /Wi-?Fi|wifi/i.test(text),
  };
}

export function parseChangiOfficialDetailLoungeRecords(html, { url = '' } = {}) {
  const name = changiDetailName(html);
  if (!name || !/lounge/i.test(name)) {
    return [];
  }

  const records = [];
  const description = changiDetailDescription(html);
  const price = changiDetailPrice(html);
  const sections = [...String(html ?? '').matchAll(/<div[^>]*class=["'][^"']*\bcmp_directory-content\b[^"']*["'][^>]*data-value=["']T\d["'][\s\S]*?(?=<div[^>]*class=["'][^"']*\bcmp_directory-content\b[^"']*["'][^>]*data-value=["']T\d["']|<section|<footer|$)/gi)].map((match) => match[0]);

  for (const section of sections) {
    const terminal = changiDetailTerminal(section);
    const near = changiDetailNear(section);
    const openHours = changiDetailHours(section);
    if (!terminal || !near || openHours.length === 0) {
      continue;
    }

    records.push({
      sourceRecordId: `airport-official-pages-sin-${slugify(name)}-${slugify(terminal)}-${slugify(near)}`,
      name,
      brand: /plaza premium/i.test(name) ? 'Plaza Premium Lounge' : name,
      operator: /plaza premium/i.test(name) ? 'Plaza Premium Lounge' : name,
      airportCode: 'SIN',
      airportName: 'Singapore Changi Airport',
      terminal,
      securitySide: /Transit/i.test(near) ? 'Transit' : '',
      near,
      sourceUrl: url,
      programs: ['Changi Airport official page', /plaza premium/i.test(name) ? 'Plaza Premium Lounge' : ''].filter(Boolean),
      openHours,
      price,
      currencyCode: price?.currencyCode,
      amenities: changiDetailAmenities(html),
      accessNotes: description || 'Official Changi Airport lounge detail page with published location, hours, and available rate evidence.',
    });
  }

  return records;
}

export function parseChangiOfficialLoungeRecords(jsonText, { url = 'https://www.changiairport.com/en/at-changi/facilities-and-services-directory.html?category=airline-lounges%2Cpay-per-use-lounges' } = {}) {
  const payload = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText;
  const records = [];

  for (const item of payload?.data ?? []) {
    const tags = item.tags ?? {};
    if (!tags['airline-lounges'] && !tags['pay-per-use-lounges']) {
      continue;
    }

    for (const location of item.locations ?? []) {
      const name = changiName(item, location);
      const terminal = clean(location.terminal);
      const openHours = hoursFromChangiLocation(location);
      if (!name || !terminal || openHours.length === 0) {
        continue;
      }

      const near = changiNear(location);
      records.push({
        sourceRecordId: `airport-official-pages-sin-${slugify(name)}-${slugify(terminal)}-${slugify(near)}`,
        name,
        brand: clean(item.title) || name,
        operator: clean(item.title) || name,
        airportCode: 'SIN',
        airportName: 'Singapore Changi Airport',
        terminal,
        near,
        sourceUrl: url,
        programs: changiPrograms(item),
        openHours,
        amenities: {
          Lounge: true,
        },
        accessNotes: [
          clean(item.fullDescription),
          clean(item.shortDescription),
          clean(location.operatingHoursNotes),
          clean(location.maintanenceMessage),
        ].filter(Boolean).join(' '),
      });
    }
  }

  return records;
}

export function parseGatwickOfficialLoungeRecords(html, { url = 'https://www.gatwickairport.com/premium-services/lounge-airport.html' } = {}) {
  const slug = gatwickSlug(url);
  const page = GATWICK_DETAIL_PAGES.get(slug);
  if (!page) {
    return [];
  }

  const hoursByTerminal = gatwickHoursByTerminal(html);
  const directionsByTerminal = gatwickDirectionsByTerminal(html);
  const price = gatwickPrice(html);
  const amenities = gatwickAmenities(html);

  return page.terminals.map((terminal) => {
    const shortTerminal = terminal.replace(/\s+Terminal$/i, '');
    const openHours = hoursByTerminal.get(terminal) || hoursByTerminal.get(shortTerminal) || hoursByTerminal.get('Daily') || [];
    return {
      sourceRecordId: `airport-official-pages-lgw-${slugify(page.name)}-${slugify(terminal)}`,
      name: page.name,
      brand: page.brand,
      operator: page.operator,
      airportCode: 'LGW',
      airportName: 'London Gatwick Airport',
      terminal,
      near: directionsByTerminal.get(terminal) || 'Published on the official London Gatwick lounge page.',
      sourceUrl: url,
      programs: ['Gatwick official booking'],
      openHours,
      price,
      currencyCode: price?.currencyCode,
      amenities,
      accessNotes: 'Official London Gatwick lounge page with terminal, operating hours, directions, amenities, and booking price.',
    };
  });
}

export function parseSfoOfficialLoungeRecords(html, { url = 'https://www.flysfo.com/passengers/shop-dine-relax/lounges' } = {}) {
  const records = [];
  const blocks = [...String(html ?? '').matchAll(/<div class="lounge-list-card__right-content">([\s\S]*?)<div class="lounge-list-card__links">/g)]
    .map((match) => match[1]);

  for (const block of blocks) {
    const name = stripHtml(block.match(/<h2[^>]*class="[^"]*lounge-list-card__title[^"]*"[^>]*>([\s\S]*?)<\/h2>/i)?.[1]);
    const locationsHtml = block.match(/<div class="lounge-list-card__locations">([\s\S]*?)<\/div>/i)?.[1] ?? '';
    const locationParts = [...locationsHtml.matchAll(/<span[^>]+class="lounge-list-card__locations__text"[^>]*>([\s\S]*?)<\/span>/gi)]
      .map((match) => stripHtml(match[1]).replace(/,\s*$/, '').trim())
      .filter(Boolean);
    const hoursText =
      stripHtml(block.match(/<span class="office-hours__item-slots">([\s\S]*?)<\/span>/i)?.[1]) ||
      stripHtml(block.match(/Hours:\s*<\/span>\s*([^<]+(?:am|pm)[^<]+)/i)?.[1]);
    const terminal = terminalFromText(locationParts.join(' '));
    const near = locationParts.filter((part) => part !== terminal).join(', ');
    const alliance = stripHtml(block.match(/<div class="lounge-list-card__alliance">\s*<strong>Alliance:\s*<\/strong>([\s\S]*?)<\/div>/i)?.[1]);

    const record = sourceRecord({
      sourceId: 'airport-official-pages',
      airportCode: 'SFO',
      airportName: 'San Francisco International Airport',
      name,
      terminal,
      near,
      hoursText,
      sourceUrl: url,
      programs: [alliance].filter(Boolean),
    });
    if (record) {
      records.push(record);
    }
  }

  return records;
}

export function parsePhlOfficialLoungeRecords(html, { url = 'https://www.phl.org/at-phl/services-and-amenities/lounges-and-concierge-services' } = {}) {
  const records = [];
  const sections = [...String(html ?? '').matchAll(/<h2>((?:(?!<h2).)*?)<\/h2>\s*<ul>([\s\S]*?)<\/ul>/gi)];

  for (const section of sections) {
    const name = stripHtml(section[1]).replace(/\s*:$/, '').trim();
    const listItems = [...section[2].matchAll(/<li>([\s\S]*?)<\/li>/gi)].map((match) => match[1]);
    for (const itemHtml of listItems) {
      const terminal = terminalFromText(stripHtml(itemHtml.match(/<strong>([\s\S]*?)<\/strong>/i)?.[1]) || stripHtml(itemHtml));
      const text = stripHtml(itemHtml);
      const near = clean(text.replace(terminal, '').replace(/^\s*-\s*/, '').replace(/\bopen daily\b[\s\S]*$/i, ''));
      const hoursText = text.match(/open daily from\s+([\s\S]+)$/i)?.[1] ?? text;
      const record = sourceRecord({
        sourceId: 'airport-official-pages',
        airportCode: 'PHL',
        airportName: 'Philadelphia International Airport',
        name,
        terminal,
        near,
        hoursText,
        sourceUrl: url,
      });
      if (record) {
        records.push(record);
      }
    }
  }

  return records;
}

function dfwBodyFromContent(content = []) {
  return clean(
    content
      .map((block) => block?.fields?.body ?? '')
      .join('\n')
      .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
      .replace(/^#+\s*/gm, ' '),
  );
}

function dfwAmenities(body) {
  const text = clean(body);
  return {
    Lounge: true,
    Food: /cuisine|buffet|café|food|menu/i.test(text),
    Drinks: /bar|beer|cocktail|wine|liquor/i.test(text),
    'Wi-Fi': /wi-?fi/i.test(text),
    Showers: /shower/i.test(text),
    Workspaces: /work|desk|productivity/i.test(text),
  };
}

function dfwLocationFromText(body) {
  const text = clean(body);
  const terminal = text.match(/\bTerminal\s+([A-Z])\b/i)?.[0] ?? '';
  const gate =
    text.match(/\bnear\s+Gate\s+([A-Z]\s*-?\s*\d+[A-Z]?)\b/i)?.[1] ||
    text.match(/\bat\s+([A-Z]\s*-?\s*\d+[A-Z]?)\b/i)?.[1] ||
    text.match(/\bDFW\s+Airport\s+([A-Z]\s*-?\s*\d+[A-Z]?)\b/i)?.[1] ||
    '';
  return {
    terminal: clean(terminal),
    gate: gate ? `Gate ${clean(gate).replace(/\s+/g, '').toUpperCase()}` : '',
  };
}

function dfwPriceFromText(body) {
  const match = clean(body).match(/\bstandard\s+rate\s+of\s+\$([0-9]+(?:\.[0-9]{1,2})?)/i);
  if (!match) {
    return null;
  }
  const amount = Number(match[1]);
  return Number.isFinite(amount) && amount > 0 ? { amount, currencyCode: 'USD' } : null;
}

function dfwRecord({ name, body, terminal, gate, url }) {
  const cleanName = clean(name);
  if (!cleanName || !terminal || !gate) {
    return null;
  }
  return {
    sourceRecordId: `airport-official-pages-dfw-${slugify(cleanName)}-${slugify(terminal)}-${slugify(gate)}`,
    name: cleanName,
    brand: cleanName,
    operator: cleanName,
    airportCode: 'DFW',
    airportName: 'Dallas Fort Worth International Airport',
    terminal,
    gate,
    near: `${terminal}, ${gate}`,
    sourceUrl: url,
    programs: ['DFW Airport official page'],
    amenities: dfwAmenities(body),
    price: dfwPriceFromText(body),
    accessNotes: 'Official DFW Airport lounge page with published terminal and gate evidence.',
  };
}

function dfwAirlineRecords(body, url) {
  const records = [];
  const text = clean(body);
  const aaBlock = text.match(/American\s+Airlines\s+Admirals\s+Club([\s\S]*?)(?:British\s+Airways|$)/i)?.[1] ?? '';
  for (const match of aaBlock.matchAll(/Terminal\s+([A-Z])\s*,\s*([A-Z]\s*-?\s*\d+[A-Z]?)/gi)) {
    const terminal = `Terminal ${match[1].toUpperCase()}`;
    const gate = `Gate ${clean(match[2]).replace(/\s+/g, '').toUpperCase()}`;
    const record = dfwRecord({ name: 'American Airlines Admirals Club', body, terminal, gate, url });
    if (record) {
      records.push(record);
    }
  }

  const inlinePattern = /\b((?:British Airways|Delta Sky Club|Emirates|Korean Air|Lufthansa|QANTAS Business)\s+Lounge|Delta Sky Club)\s+at\s+Terminal\s+([A-Z])\s*,\s*([A-Z]\s*-?\s*\d+[A-Z]?)/gi;
  for (const match of text.matchAll(inlinePattern)) {
    const rawName = clean(match[1]);
    const name = rawName === 'QANTAS Business Lounge' ? 'Qantas Business Lounge' : rawName;
    const terminal = `Terminal ${match[2].toUpperCase()}`;
    const gate = `Gate ${clean(match[3]).replace(/\s+/g, '').toUpperCase()}`;
    const record = dfwRecord({ name, body, terminal, gate, url });
    if (record) {
      records.push(record);
    }
  }
  return records;
}

export function parseDfwOfficialLoungeRecords(html, { url = 'https://www.dfwairport.com/explore/lounges/' } = {}) {
  const payload = nextDataPayload(html);
  const tabSection = payload?.props?.pageProps?.page?.fields?.sections?.find((section) => section?.contentType === 'tab-section');
  const items = tabSection?.fields?.items ?? [];
  const records = [];
  for (const item of items) {
    const title = clean(item?.fields?.title);
    const body = dfwBodyFromContent(item?.fields?.content);
    if (!title || !body || title === 'USO Center') {
      continue;
    }
    if (title === 'Airline Lounges') {
      records.push(...dfwAirlineRecords(body, url));
      continue;
    }
    const location = dfwLocationFromText(body);
    const record = dfwRecord({
      name: title === 'The Centurion Lounge' ? 'American Express Centurion Lounge' : title,
      body,
      terminal: location.terminal,
      gate: location.gate,
      url,
    });
    if (record) {
      records.push(record);
    }
  }
  const byId = new Map(records.map((record) => [record.sourceRecordId, record]));
  return [...byId.values()].sort((first, second) => `${first.name}-${first.gate}`.localeCompare(`${second.name}-${second.gate}`));
}

const GRU_MARKERS = [
  ['Terminal 1 W LOUNGE', 'W Lounge', 'Terminal 1'],
  ['Terminal 2 PLAZA PREMIUM LOUNGE', 'Plaza Premium Lounge', 'Terminal 2'],
  ['PLAZA PREMIUM LOUNGE LANDSIDE', 'Plaza Premium Lounge Landside', 'Terminal 2'],
  ['DOMESTIC GOL PREMIUM LOUNGE', 'Domestic GOL Premium Lounge', 'Terminal 2'],
  ['INTERNATIONAL GOL PREMIUM LOUNGE', 'International GOL Premium Lounge', 'Terminal 2'],
  ['BRADESCO VIP LOUNGE', 'Bradesco VIP Lounge', 'Terminal 2'],
  ['URBAN COWORK AIRPORT', 'Urban Cowork Airport Lounge', 'Terminal 2'],
  ['ADVANTAGE VIP LOUNGE', 'Advantage VIP Lounge', 'Terminal 2'],
  ['W PREMIUM LOUNGE', 'W Premium Lounge', 'Terminal 2'],
  ['THE LOUNGE SÃO PAULO', 'The Lounge Sao Paulo', 'Terminal 2'],
  ['THE LOUNGE SKYTEAM', 'The Lounge SkyTeam', 'Terminal 2'],
  ['VIP LOUNGE INTER', 'VIP Lounge Inter', 'Terminal 2'],
  ['CASA BB', 'Casa BB', 'Terminal 3'],
  ['LATAM VIP LOUNGE', 'LATAM VIP Lounge', 'Terminal 3'],
  ['AMERICAN AIRLINES Admirals Club', 'American Airlines Admirals Club', 'Terminal 3'],
  ['MASTERCARD BLACK VIP LOUNGE', 'Mastercard Black VIP Lounge', 'Terminal 3'],
  ['BRADESCO CARTÕES LOUNGE', 'Bradesco Cartoes Lounge', 'Terminal 3'],
  ['VISA INFINITE LOUNGE', 'Visa Infinite Lounge', 'Terminal 3'],
  ['W PREMIUM LOUNGE 5TH AVENUE (AMEX)', 'W Premium Lounge 5th Avenue', 'Terminal 3'],
  ['NOMAD LOUNGE', 'Nomad Lounge', 'Terminal 3'],
  ['NUBANK ULTRAVIOLETA LOUNGE', 'Nubank Ultravioleta Lounge', 'Terminal 3'],
  ['VISA INFINITE PRIVILEGE LOUNGE', 'Visa Infinite Privilege Lounge', 'Terminal 3'],
];

function normalizeGruHtmlText(html) {
  return clean(String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#160;|&#8203;/g, ' ')
    .replace(/&#58;/g, ':'));
}

function gruBodyText(html) {
  const text = normalizeGruHtmlText(html);
  const start = text.indexOf('Terminal 1 W LOUNGE');
  if (start < 0) {
    return '';
  }
  const end = text.indexOf('Nossas redes:', start);
  return clean(text.slice(start, end > start ? end : undefined));
}

function gruSections(text) {
  const positions = [];
  for (const [marker, name, terminal] of GRU_MARKERS) {
    let index = text.indexOf(marker);
    while (index >= 0) {
      const after = text.slice(index);
      if (
        !(marker === 'W PREMIUM LOUNGE' && /^W PREMIUM LOUNGE\s+5TH\s+AVENUE/i.test(after)) &&
        !(marker === 'VISA INFINITE LOUNGE' && /^VISA INFINITE PRIVILEGE LOUNGE/i.test(after))
      ) {
        positions.push({ index, marker, name, terminal });
      }
      index = text.indexOf(marker, index + marker.length);
    }
  }

  return positions
    .sort((first, second) => first.index - second.index)
    .map((item, index, all) => ({
      ...item,
      text: clean(text.slice(item.index, all[index + 1]?.index ?? text.length)),
    }));
}

function gruClock(value) {
  const text = clean(value).toLowerCase().replace(/\s+/g, ' ');
  const match = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) {
    return '';
  }
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const suffix = match[3] ?? '';
  if (suffix === 'pm' && hour < 12) {
    hour += 12;
  }
  if (suffix === 'am' && hour === 12) {
    hour = 0;
  }
  if (!Number.isFinite(hour) || hour > 23 || !Number.isFinite(minute) || minute > 59) {
    return '';
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function gruHours(sectionText) {
  const text = clean(sectionText);
  if (/\b(?:open\s+)?24\s*(?:h|hours?|hrs)\b|\b24\s+hours\s+a\s+day\b/i.test(text)) {
    return allDayHours();
  }

  const dailyFrom = text.match(/\bDaily\s+from\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+to\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  const range =
    dailyFrom ||
    text.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+to\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*-\s*Daily\b/i) ||
    text.match(/\bOpening hours:\s*(\d{1,2}:\d{2})\s+to\s+(\d{1,2}:\d{2})\b/i);
  if (!range) {
    return [];
  }
  const opening = gruClock(range[1]);
  const closing = gruClock(range[2]);
  return opening && closing ? dailyHours(opening, closing) : [];
}

function gruPrice(sectionText) {
  const text = clean(sectionText);
  const brl =
    text.match(/\b(?:fee|cost|single payment)\s+is\s+R\$\s*([0-9]+(?:[.,][0-9]{2})?)/i)?.[1] ||
    text.match(/\bWalk-in access:[\s\S]*?R\$\s*([0-9]+(?:[.,][0-9]{2})?)/i)?.[1] ||
    text.match(/\bBRL\s*([0-9]+(?:[.,][0-9]{2})?)/i)?.[1] ||
    text.match(/\bR\$\s*([0-9]+(?:[.,][0-9]{2})?)\s*(?:per person|for|and|\/single)/i)?.[1];
  if (brl) {
    const amount = Number(brl.replace(',', '.'));
    return Number.isFinite(amount) && amount > 0 ? { amount, currencyCode: 'BRL' } : null;
  }

  const usd =
    text.match(/\bUS\$\s*([0-9]+(?:[.,][0-9]{2})?)/i)?.[1] ||
    text.match(/\$([0-9]+(?:[.,][0-9]{2})?)\s*USD\b/i)?.[1];
  if (usd) {
    const amount = Number(usd.replace(',', '.'));
    return Number.isFinite(amount) && amount > 0 ? { amount, currencyCode: 'USD' } : null;
  }
  return null;
}

function gruLocation(section) {
  const text = clean(section.text);
  const location =
    text.match(/\bW\s+Premium\s+Lounge\s+is\s+located\s+([^.]*(?:near\s+gates?\s+\d+[^.]*)\.)/i)?.[1] ||
    text.match(/\bW\s+Premium\s+Lounge\s+5th\s+Avenue\s+is\s+located\s+([^.]*(?:between)[^.]*)/i)?.[1] ||
    text.match(/\bNomad\s+Lounge\s+is\s+located\s+([^.]*(?:next to gate\s+\d+)[^.]*)/i)?.[1] ||
    text.match(/\blocated\s+in\s+([^.]*(?:Terminal\s+\d|next to gate\s+\d+|between)[^.]*)/i)?.[1] ||
    text.match(/\blocated\s+inside\s+([^.]*(?:near\s+Gate\s+\d+)[^.]*)/i)?.[1] ||
    text.match(/\bTerminal\s+\d\s*[–-]\s*([^.]*(?:area|Mezzanine|Check-in\s+[A-Z]|boarding area|departures area|next to gate\s+\d+|near to gate\s+\d+|Gate\s+\d+)[^.]*)/i)?.[0] ||
    text.match(/\blocated\s+outside\s+the\s+boarding\s+area\s+in\s+Guarulhos\s+Internacional\s+Airport/i)?.[0] ||
    section.terminal;
  return clean(location);
}

function gruTerminal(section) {
  const text = clean(section.text);
  const terminal = text.match(/\bTerminal\s+\d\b/i)?.[0];
  return clean(terminal || section.terminal);
}

function gruAmenities(sectionText) {
  return {
    Lounge: true,
    Food: /food|buffet|snacks|menu|breakfast|dining|beverage/i.test(sectionText),
    Drinks: /drinks|alcoholic|bar|beverages|wine|beer/i.test(sectionText),
    'Wi-Fi': /wi-?fi|wifi/i.test(sectionText),
    Showers: /shower/i.test(sectionText),
    Workstations: /workstations|business center|meeting|work room|cowork/i.test(sectionText),
  };
}

export function parseGruOfficialLoungeRecords(html, { url = 'https://www.gru.com.br/en/passenger/discover-gru/relax/vip-lounges' } = {}) {
  const text = gruBodyText(html);
  const records = [];
  for (const section of gruSections(text)) {
    const openHours = gruHours(section.text);
    const price = gruPrice(section.text);
    const location = gruLocation(section);
    if (!section.name || !section.terminal || openHours.length === 0) {
      continue;
    }

    records.push({
      sourceRecordId: `airport-official-pages-gru-${slugify(section.name)}-${slugify(location)}`,
      name: section.name,
      brand: section.name,
      operator: section.name,
      airportCode: 'GRU',
      airportName: 'São Paulo/Guarulhos International Airport',
      terminal: gruTerminal(section),
      near: location,
      sourceUrl: url,
      programs: ['GRU Airport official page'],
      openHours,
      price,
      currencyCode: price?.currencyCode,
      amenities: gruAmenities(section.text),
      accessNotes: 'Official GRU Airport lounge page with terminal, operating hours, access programs, and published walk-in prices where available.',
    });
  }

  return records.sort((first, second) => `${first.name}-${first.near}`.localeCompare(`${second.name}-${second.near}`));
}

function miaDecode(value) {
  return decodeEntities(value)
    .replace(/&reg;|&trade;|&#8480;/gi, '')
    .replace(/&rsquo;|&lsquo;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"');
}

function miaRowText(rowHtml) {
  return clean(
    miaDecode(rowHtml)
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' '),
  );
}

function miaName(text) {
  const before = text.split(/\s+(?:Alliance|Airline|Airlines|Operator|Admittance|Location|Reserved):\s+/i)[0] ?? text;
  return clean(before)
    .replace(/\s+Temporarily\s+Closed\b.*$/i, '')
    .replace(/\s+\((?:skytrain|2nd|3rd|4th|5th|7th|Operated)[^)]+\)$/i, '')
    .replace(/\s+\d+(?:st|nd|rd|th)\s+level.*$/i, '')
    .replace(/\s+D-?(\d+)\b/i, ' D-$1')
    .replace(/\s+D12\b/i, ' D12');
}

function miaTerminalFromLocation(location) {
  const text = clean(location);
  const terminal =
    text.match(/\b(?:North|Central|South)\s+Terminal\s+[A-Z]\s+Satellite\b/i)?.[0] ||
    text.match(/\b(?:North|Central|South)\s+Terminal\s+[A-Z]\b/i)?.[0] ||
    text.match(/\b(?:North|Central|South)\s+Terminal\b/i)?.[0] ||
    text.match(/\bConcourse\s+[A-Z]\b/i)?.[0] ||
    '';
  return clean(terminal);
}

function miaNearFromLocation(location) {
  const text = clean(location);
  const withoutTerminal = text
    .replace(/\b(?:North|Central|South)\s+Terminal\s+[A-Z]\s+Satellite\b/gi, '')
    .replace(/\b(?:North|Central|South)\s+Terminal\s+[A-Z]\b/gi, '')
    .replace(/\b(?:North|Central|South)\s+Terminal\b/gi, '')
    .replace(/\bConcourse\s+[A-Z]\b/gi, '');
  return clean(withoutTerminal.replace(/^[,\s-]+/, '').replace(/\s*,\s*,+/g, ',').replace(/\s*,\s*([.])/g, '$1')) || text;
}

function miaPrograms(text) {
  const programs = ['MIA official airport page'];
  if (/\boneworld\b/i.test(text)) {
    programs.push('oneworld');
  }
  if (/\bStar\s+Alliance\b/i.test(text)) {
    programs.push('Star Alliance');
  }
  if (/\bPriority\s+Pass\b/i.test(text)) {
    programs.push('Priority Pass');
  }
  if (/\bLounge\s+Key\b/i.test(text)) {
    programs.push('LoungeKey');
  }
  if (/\bDiners\s+Club\b/i.test(text)) {
    programs.push('Diners Club');
  }
  return [...new Set(programs)];
}

function miaHoursFromRange(openingText, closingText, days = [1, 2, 3, 4, 5, 6, 0]) {
  const opening = parseTime(openingText);
  const closing = parseTime(closingText);
  if (!opening || !closing) {
    return [];
  }
  return days.map((day) => ({
    Day: day,
    OpeningHour: opening,
    ClosingHour: closing,
  }));
}

function miaHours(text) {
  const hoursText = clean(text.match(/\bHours:\s*([\s\S]*?)(?:\s+Phone:|\s+Visit|\s+Guest\s+and\s+Access|$)/i)?.[1] ?? '');
  if (!hoursText) {
    return [];
  }
  if (/\b24\s+hours?\s+daily\b/i.test(hoursText)) {
    return allDayHours();
  }

  const daily = hoursText.match(
    /\bDaily,?\s*(\d{1,2}(?::\d{2})?\s*a\.?m\.?|\d{1,2}(?::\d{2})?\s*p\.?m\.?)\s*-\s*(\d{1,2}(?::\d{2})?\s*a\.?m\.?|\d{1,2}(?::\d{2})?\s*p\.?m\.?)/i,
  );
  if (daily) {
    return miaHoursFromRange(daily[1], daily[2]);
  }

  const records = [];
  const dayNumbers = {
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    sunday: 0,
  };
  const daySectionPattern =
    /\b((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:,\s*(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday))*?(?:\s+and\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday))?):\s*(\d{1,2}(?::\d{2})?\s*a\.?m\.?|\d{1,2}(?::\d{2})?\s*p\.?m\.?)\s*-\s*(\d{1,2}(?::\d{2})?\s*a\.?m\.?|\d{1,2}(?::\d{2})?\s*p\.?m\.?)/gi;
  let match;
  while ((match = daySectionPattern.exec(hoursText))) {
    const days = [...match[1].matchAll(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/gi)]
      .map((dayMatch) => dayNumbers[dayMatch[0].toLowerCase()])
      .filter((day) => day !== undefined);
    records.push(...miaHoursFromRange(match[2], match[3], days));
  }
  return records;
}

function miaPrice(text) {
  const amount = Number(clean(text).match(/\$\s*(\d+(?:\.\d+)?)/)?.[1]);
  return Number.isFinite(amount) && amount > 0 ? { amount, currencyCode: 'USD' } : null;
}

function miaAmenities(text) {
  return {
    Lounge: true,
    Food: /food|meal|snack|restaurant|buffet/i.test(text),
    Drinks: /beverage|drink|bar|wine|beer/i.test(text),
    'Wi-Fi': /wi-?fi|business|conference/i.test(text),
    Showers: /shower/i.test(text),
    Spa: /spa/i.test(text),
  };
}

export function parseMiamiOfficialLoungeRecords(html, { url = 'https://www.miami-airport.com/clubs-and-lounges.asp' } = {}) {
  const rows = [...String(html ?? '').matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((match) => match[0]);
  const records = [];

  for (const row of rows) {
    const text = miaRowText(row);
    if (!/\bLocation:\s+/i.test(text) || !/\bHours:\s+/i.test(text)) {
      continue;
    }
    if (/\b(?:Executive\s+Conference\s+Center|Consular\s+Lounge)\b/i.test(text)) {
      continue;
    }

    const name = miaName(text);
    const location = clean(text.match(/\bLocation:\s*([\s\S]*?)\s+Hours:/i)?.[1] ?? '');
    const terminal = miaTerminalFromLocation(location);
    const openHours = miaHours(text);
    if (!name || !terminal || openHours.length === 0) {
      continue;
    }

    const price = miaPrice(text);
    records.push({
      sourceRecordId: `airport-official-pages-mia-${slugify(name)}-${slugify(terminal)}-${slugify(location)}`,
      name,
      brand: name,
      operator: clean(text.match(/\bOperator:\s*([\s\S]*?)\s+Admittance:/i)?.[1] ?? '') || name,
      airportCode: 'MIA',
      airportName: 'Miami International Airport',
      terminal,
      securitySide: /post.security|after security|past security/i.test(location) ? 'After Security' : /pre.security/i.test(location) ? 'Before Security' : '',
      near: miaNearFromLocation(location),
      sourceUrl: url,
      programs: miaPrograms(text),
      openHours,
      price,
      currencyCode: price?.currencyCode,
      amenities: miaAmenities(text),
      accessNotes: clean(text.match(/\bAdmittance:\s*([\s\S]*?)\s+Location:/i)?.[1] ?? '') || 'Official Miami International Airport lounge page.',
    });
  }

  return records.sort((first, second) => `${first.terminal}-${first.name}`.localeCompare(`${second.terminal}-${second.name}`));
}

function seaText(value) {
  return clean(
    decodeEntities(value)
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&#039;|&apos;/gi, "'")
      .replace(/\s+/g, ' '),
  );
}

function seaRowName(rowHtml) {
  const firstCell = String(rowHtml ?? '').match(/<td[\s\S]*?<\/td>/i)?.[0] ?? '';
  return seaText(firstCell);
}

function seaListItems(rowHtml) {
  return [...String(rowHtml ?? '').matchAll(/<li\b[\s\S]*?<\/li>/gi)].map((match) => seaText(match[0]));
}

function seaRecordName(rowName, itemText) {
  const row = clean(rowName);
  const item = clean(itemText);
  if (/The Club/i.test(row)) {
    return 'The Club at SEA';
  }
  if (/United/i.test(row)) {
    return 'United Club';
  }
  if (/Centurion/i.test(row)) {
    return 'The American Express Centurion Lounge';
  }
  if (/Alaska/i.test(row)) {
    return 'Alaska Lounge';
  }
  if (/Delta/i.test(row)) {
    return clean(item.match(/\bDelta\s+(?:Sky\s+(?:Club|Lounge)|One\s+Lounge)\b/i)?.[0] ?? 'Delta Sky Club').replace(/Delta Sky Lounge/i, 'Delta Sky Club');
  }
  if (/British/i.test(row)) {
    return 'British Airways Terraces Lounge';
  }
  return row;
}

function seaNear(rowName, itemText) {
  const name = seaRecordName(rowName, itemText);
  let text = clean(itemText).replace(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i'), '');
  if (name === 'The Club at SEA') {
    text = text.replace(/^The\s+Club\s+at\s+at\s+SEA\s*/i, '').replace(/^The\s+Club\s+at\s+SEA\s*/i, '');
  }
  return clean(text);
}

function seaTerminal(near) {
  const text = clean(near);
  const gateLetter = text.match(/\bGate\s+([A-Z])\s*\d/i)?.[1]?.toUpperCase();
  if (gateLetter === 'S') {
    return 'S Concourse';
  }
  if (gateLetter === 'N') {
    return 'N Concourse';
  }
  if (gateLetter) {
    return `Concourse ${gateLetter}`;
  }
  const concourse = text.match(/\b[A-Z]\s+Concourse\b/i)?.[0];
  if (concourse) {
    return clean(concourse).replace(/^([a-z])\b/i, (value) => value.toUpperCase());
  }
  if (/Central\s+Terminal/i.test(text)) {
    return 'Central Terminal';
  }
  return '';
}

function seaHours(itemText) {
  const match = clean(itemText).match(/\bis\s+open\s+(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))\s+daily\b/i);
  return match ? miaHoursFromRange(match[1], match[2]) : [];
}

function seaPrograms(rowName, itemText) {
  const text = `${rowName} ${itemText}`;
  const programs = ['Port of Seattle official page'];
  if (/The Club/i.test(text)) {
    programs.push('The Club');
  }
  if (/United/i.test(text)) {
    programs.push('Star Alliance');
  }
  if (/Alaska|British|oneworld/i.test(text)) {
    programs.push('oneworld');
  }
  if (/Delta/i.test(text)) {
    programs.push('SkyTeam');
  }
  return [...new Set(programs)];
}

export function parseSeaOfficialLoungeRecords(html, { url = 'https://www.portseattle.org/services-amenities/airport-lounges' } = {}) {
  const rows = [...String(html ?? '').matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((match) => match[0]);
  const records = [];

  for (const row of rows) {
    const rowName = seaRowName(row);
    if (!/\b(?:Club|Lounge|Centurion)\b/i.test(rowName) || /\bUSO\b/i.test(rowName)) {
      continue;
    }

    for (const itemText of seaListItems(row)) {
      const name = seaRecordName(rowName, itemText);
      const near = seaNear(rowName, itemText);
      const terminal = seaTerminal(near);
      if (!name || !near || !terminal) {
        continue;
      }

      records.push({
        sourceRecordId: `airport-official-pages-sea-${slugify(name)}-${slugify(terminal)}-${slugify(near)}`,
        name,
        brand: name,
        operator: name,
        airportCode: 'SEA',
        airportName: 'Seattle-Tacoma International Airport',
        terminal,
        near,
        sourceUrl: url,
        programs: seaPrograms(rowName, itemText),
        openHours: seaHours(itemText),
        amenities: {
          Lounge: true,
        },
        accessNotes: 'Official Port of Seattle lounge page with published lounge location and available operating hours.',
      });
    }
  }

  return records.sort((first, second) => `${first.terminal}-${first.name}-${first.near}`.localeCompare(`${second.terminal}-${second.name}-${second.near}`));
}

function hkgAccordionItems(html) {
  return [...String(html ?? '').matchAll(/<li\s+class=["']accordionItem["'][\s\S]*?<\/li>/gi)].map((match) => match[0]);
}

function hkgName(itemHtml) {
  return stripHtml(String(itemHtml ?? '').match(/<span\s+class=["']accordionTitle["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? '')
    .replace(/\s*\((?:Temporarily\s+closed|closed)[^)]+\)\s*$/i, '')
    .trim();
}

function hkgAddress(itemHtml) {
  const match = String(itemHtml ?? '').match(/<dt[^>]*\bicon-marker-flightinfo\b[^>]*>[\s\S]*?<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i);
  return stripHtml(match?.[1] ?? '');
}

function hkgHours(itemHtml) {
  const hoursBlock = String(itemHtml ?? '').match(/<dt[^>]*\bicon-opening-hour\b[^>]*>[\s\S]*?<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i);
  const text = stripHtml(hoursBlock?.[1] ?? '');
  if (/24\s*hours?/i.test(text)) {
    return allDayHours();
  }

  const match = clean(text).match(/\b(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})\b/);
  if (!match) {
    return [];
  }

  const opening = parseClock(match[1]);
  const closing = parseClock(match[2]);
  return opening && closing ? dailyHours(opening, closing) : [];
}

function hkgTerminal(address) {
  const text = clean(address);
  if (/\bT1\s+Midfield\s+Concourse\b/i.test(text)) {
    return 'Terminal 1 Midfield Concourse';
  }
  const terminal = text.match(/\bTerminal\s+\d\b/i)?.[0];
  return clean(terminal || '');
}

function hkgPrograms(itemHtml, name, pageType) {
  const item = String(itemHtml ?? '');
  const airlines = [...item.matchAll(/aria-label=["']Airlines::([^"']+)["']/gi)]
    .map((match) => clean(match[1].replace(/\s*\([A-Z0-9]{2}\)\s*$/i, '')))
    .filter(Boolean);
  const programs = pageType === 'pay-in' ? ['HKIA pay-in lounge page'] : ['HKIA airline lounge page'];
  if (/Cathay|Qantas/i.test(`${name} ${airlines.join(' ')}`)) {
    programs.push('oneworld');
  }
  if (/SilverKris|Singapore|United|Turkish|Air Canada|Star Alliance/i.test(`${name} ${airlines.join(' ')}`)) {
    programs.push('Star Alliance');
  }
  if (/Centurion|American Express/i.test(name)) {
    programs.push('American Express');
  }
  return [...new Set([...programs, ...airlines])];
}

function hkgOperator(name, pageType) {
  if (/Cathay/i.test(name)) {
    return 'Cathay Pacific';
  }
  if (/SilverKris/i.test(name)) {
    return 'Singapore Airlines';
  }
  if (/United/i.test(name)) {
    return 'United Airlines';
  }
  if (/Emirates/i.test(name)) {
    return 'Emirates';
  }
  if (/Qantas/i.test(name)) {
    return 'Qantas';
  }
  if (/Club Autus/i.test(name)) {
    return 'Hong Kong Airlines';
  }
  if (/Centurion/i.test(name)) {
    return 'American Express';
  }
  if (/Plaza Premium/i.test(name)) {
    return 'Plaza Premium Lounge';
  }
  if (/Kyra/i.test(name)) {
    return 'Kyra Lounge';
  }
  return pageType === 'pay-in' ? name : name;
}

function hanedaTerminalFromMarker(marker) {
  const terminal = clean(marker).match(/\bTerminal\s+([123])\b/i)?.[1];
  return terminal ? `Terminal ${terminal}` : '';
}

function hanedaHours(text) {
  if (/\bOpening\s+Hours\s+24\s+hours\b/i.test(text)) {
    return allDayHours();
  }

  const match = clean(text).match(/\bOpening\s+Hours\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\b/i);
  if (!match) {
    return [];
  }

  const opening = parseClock(match[1]);
  const closing = parseClock(match[2]);
  return opening && closing ? dailyHours(opening, closing) : [];
}

function hanedaPrice(text) {
  const amount = Number(clean(text).match(/\bFees\s*\(Tax\s+incl\.\)\s*Adults:\s*([0-9,]+)\s*yen\b/i)?.[1]?.replace(/,/g, ''));
  return Number.isFinite(amount) && amount > 0 ? { amount, currencyCode: 'JPY' } : null;
}

function hanedaPrograms(name, block) {
  const programs = ['Haneda Airport official page'];
  const text = `${name} ${block}`;
  if (/Priority\s+Pass/i.test(text)) {
    programs.push('Priority Pass');
  }
  if (/Centurion|American\s+Express|AMEX/i.test(text)) {
    programs.push('American Express');
  }
  if (/Cards\s+Accepted/i.test(text)) {
    programs.push('Credit card lounge');
  }
  return [...new Set(programs)];
}

function hanedaAmenities(block) {
  return {
    Lounge: true,
    Food: /buffet|snacks|light snacks/i.test(block),
    Drinks: /drinks|soft drinks|alcohol|beverage/i.test(block),
    Showers: /shower/i.test(block),
    'Wi-Fi': /wi-?fi/i.test(block),
  };
}

function hanedaLocation(block) {
  const text = clean(block);
  return (
    clean(text.match(/\dF\s+(?:Domestic|International)\s+(?:Departure|Arrival)\s+(?:Gate\s+Area|Lobby)(?:\s*\([^)]*\))?/i)?.[0]) ||
    clean(text.match(/\dF\s+International\s+Departure\s+Gate\s+Area/i)?.[0]) ||
    clean(text.match(/\dF\s+Domestic\s+Departure\s+Lobby/i)?.[0]) ||
    ''
  );
}

export function parseHanedaOfficialLoungeRecords(html, { url = 'https://tokyo-haneda.com/en/service/facilities/lounge.html' } = {}) {
  if (!/tokyo-haneda\.com\/en\/service\/facilities\/lounge\.html/i.test(url)) {
    return [];
  }

  const text = stripHtml(html);
  const loungeNameRegex =
    /\b(?:POWER\s+LOUNGE\s+(?:SOUTH|NORTH|CENTRAL|PREMIUM)|Airport\s+Lounge\s+\(South\)|TIAT\s+LOUNGE|SKY\s+LOUNGE(?:\s+SOUTH)?|The\s+Centurion\s+Lounge\s+\(AMEX\))/g;
  const matches = [...text.matchAll(loungeNameRegex)].map((match) => ({
    name: clean(match[0]),
    index: match.index ?? 0,
  }));
  const records = [];

  for (const [index, match] of matches.entries()) {
    const nextIndex = matches[index + 1]?.index ?? text.length;
    const before = text.slice(0, match.index);
    const block = text.slice(match.index, nextIndex);
    const terminalMarker = [...before.matchAll(/Credit\s+Card\s+Lounges\s+T[123]\s+\(Terminal\s+[123]\)/gi)].at(-1)?.[0] ?? '';
    const terminal = hanedaTerminalFromMarker(terminalMarker);
    const openHours = hanedaHours(block);
    const near = hanedaLocation(block);
    if (!match.name || !terminal || openHours.length === 0 || !near) {
      continue;
    }

    const price = hanedaPrice(block);
    records.push({
      sourceRecordId: `airport-official-pages-hnd-${slugify(match.name)}-${slugify(terminal)}-${slugify(near)}`,
      name: match.name,
      brand: /Centurion/i.test(match.name) ? 'American Express Centurion Lounge' : match.name,
      operator: /Centurion/i.test(match.name) ? 'American Express' : 'Haneda Airport',
      airportCode: 'HND',
      airportName: 'Tokyo Haneda Airport',
      terminal,
      securitySide: /Gate\s+Area/i.test(near) ? 'Departures' : /Arrival/i.test(near) ? 'Arrivals' : '',
      near,
      sourceUrl: url,
      programs: hanedaPrograms(match.name, block),
      openHours,
      price,
      currencyCode: price?.currencyCode,
      amenities: hanedaAmenities(block),
      accessNotes: 'Official Haneda Airport card-lounge page with published hours, location, and fee evidence.',
    });
  }

  const byId = new Map(records.map((record) => [record.sourceRecordId, record]));
  return [...byId.values()].sort((first, second) => first.sourceRecordId.localeCompare(second.sourceRecordId));
}

export function parseHongKongAirportOfficialLoungeRecords(html, { url = '' } = {}) {
  const pageType = /pay-in-corporate-lounges/i.test(url) ? 'pay-in' : 'airline';
  const records = [];

  for (const item of hkgAccordionItems(html)) {
    const name = hkgName(item);
    const address = hkgAddress(item);
    const openHours = hkgHours(item);
    const terminal = hkgTerminal(address);
    if (!name || !address || !terminal || openHours.length === 0) {
      continue;
    }

    records.push({
      sourceRecordId: `airport-official-pages-hkg-${slugify(name)}-${slugify(terminal)}-${slugify(address)}`,
      name,
      brand: /Plaza Premium/i.test(name) ? 'Plaza Premium Lounge' : name,
      operator: hkgOperator(name, pageType),
      airportCode: 'HKG',
      airportName: 'Hong Kong International Airport',
      terminal,
      securitySide: /Departures/i.test(address) ? 'Departures' : '',
      near: address,
      sourceUrl: url,
      programs: hkgPrograms(item, name, pageType),
      openHours,
      amenities: {
        Lounge: true,
        Food: true,
        Drinks: true,
      },
      accessNotes:
        pageType === 'pay-in'
          ? 'Official Hong Kong International Airport pay-in lounge page with published location and operating hours.'
          : 'Official Hong Kong International Airport airline lounge page with published airline, location, and operating hours.',
    });
  }

  return records.sort((first, second) => `${first.name}-${first.near}`.localeCompare(`${second.name}-${second.near}`));
}

function melbourneNameFromUrl(url) {
  if (url.includes('/plaza-premium-lounge')) {
    return { name: 'Plaza Premium Lounge', brand: 'Plaza Premium Lounge', operator: 'Plaza Premium Lounge' };
  }
  if (url.includes('/marhaba-lounge')) {
    return { name: 'Marhaba Lounge', brand: 'Marhaba Lounge', operator: 'Marhaba' };
  }
  if (url.includes('/aspire-lounge')) {
    return { name: 'Aspire Lounge', brand: 'Aspire Lounge', operator: 'Aspire Lounges' };
  }
  return null;
}

function sectionHtmlAfterTitle(html, title) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(html ?? '').match(new RegExp(`<h2[^>]*>${escaped}<\\/h2>([\\s\\S]*?)(?=<div class="text-section|<section|$)`, 'i'));
  return match?.[1] ?? '';
}

function melbourneHours(html) {
  const section = [
    sectionHtmlAfterTitle(html, 'Where to find us &amp; trading hours'),
    sectionHtmlAfterTitle(html, 'Opening hours'),
    sectionHtmlAfterTitle(html, 'Trading hours'),
  ].find(Boolean);
  const rowHours = [];
  for (const row of htmlBlocks(section, /<tr>[\s\S]*?<\/tr>/gi)) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => stripHtml(match[1]));
    if (cells.length < 2) {
      continue;
    }
    const timeRange = clean(cells[1]).replace(/[–—]/g, '-');
    const opening = parseClock(timeRange.split('-')[0]);
    const closing = parseClock(timeRange.split('-')[1]);
    const days = dayIndexesFromText(cells[0]);
    if (opening && closing && days.length > 0) {
      rowHours.push(...days.map((day) => ({ Day: day, OpeningHour: opening, ClosingHour: closing })));
    }
  }
  return rowHours.length > 0 ? rowHours : hoursRowsFromText(stripHtml(section));
}

export function parseMelbourneOfficialLoungeRecords(html, { url = '' } = {}) {
  const page = melbourneNameFromUrl(url);
  if (!page) {
    return [];
  }
  const where = stripHtml(
    sectionHtmlAfterTitle(html, 'Where to find us &amp; trading hours') ||
      sectionHtmlAfterTitle(html, 'Where to find us'),
  );
  const openHours = melbourneHours(html);
  if (!where || openHours.length === 0) {
    return [];
  }

  const terminal = /Terminal\s*2/i.test(where) ? 'Terminal 2' : clean(where.match(/\bT2\b/i)?.[0] || 'T2');
  const amenitiesText = stripHtml(html);
  return [{
    sourceRecordId: `airport-official-pages-mel-${slugify(page.name)}-${slugify(terminal)}-${slugify(where)}`,
    name: page.name,
    brand: page.brand,
    operator: page.operator,
    airportCode: 'MEL',
    airportName: 'Melbourne Airport',
    terminal,
    near: where,
    securitySide: /after security/i.test(where) ? 'After Security' : '',
    sourceUrl: url,
    programs: ['Melbourne Airport official page'],
    openHours,
    amenities: {
      Lounge: true,
      Food: /food|dining|buffet|beverages|snacks/i.test(amenitiesText),
      Drinks: /drink|beverage|bar|wine|beer|coffee/i.test(amenitiesText),
      Shower: /shower/i.test(amenitiesText),
      'Wi-Fi': /wi-?fi/i.test(amenitiesText),
    },
    accessNotes: 'Official Melbourne Airport lounge page with published location and operating hours.',
  }];
}

function sydneyTerminalFromUrl(url) {
  if (/t3-facilities/i.test(url)) {
    return 'T3 Domestic';
  }
  if (/airline-lounges-t1/i.test(url)) {
    return 'T1 International';
  }
  return '';
}

function sydneyAccordionItems(html) {
  const items = [];
  const regex = /<div class="accordion-item"[^>]*id="([^"]+)"[\s\S]*?<div class="accordion-item-title">([\s\S]*?)<\/div>[\s\S]*?<div class="accordion-item-expanded-content rich-text-content">([\s\S]*?)(?=<div class="accordion-item"[^>]*id=|$)/gi;
  for (const match of String(html ?? '').matchAll(regex)) {
    items.push({
      id: clean(match[1]),
      title: stripHtml(match[2]),
      body: match[3],
    });
  }
  return items;
}

function sydneyHours(body) {
  const explicitRows = [];
  for (const row of htmlBlocks(body, /<div class="opening-time-range">[\s\S]*?<\/div>\s*<\/div>/gi)) {
    const day = stripHtml(row.match(/<div class="date-range">([\s\S]*?)<\/div>/i)?.[1]);
    const time = stripHtml(row.match(/<div class="time-range">([\s\S]*?)<\/div>/i)?.[1]);
    const timeRange = clean(time).replace(/[–—]/g, '-');
    const opening = parseClock(timeRange.split('-')[0]);
    const closing = parseClock(timeRange.split('-')[1]);
    const days = dayIndexesFromText(day);
    if (opening && closing && days.length > 0) {
      explicitRows.push(...days.map((dayIndex) => ({ Day: dayIndex, OpeningHour: opening, ClosingHour: closing })));
    }
  }
  const bodyText = stripHtml(body);
  const rows = hoursRowsFromText(bodyText);
  if (explicitRows.length > 0) {
    return explicitRows;
  }
  if (rows.length > 0) {
    return rows;
  }
  const match = clean(bodyText).match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
  if (match) {
    const opening = parseClock(match[1]);
    const closing = parseClock(match[2]);
    if (opening && closing) {
      return dailyHours(opening, closing);
    }
  }
  return openHoursFromText(bodyText);
}

function sydneyLocation(body) {
  const paragraphs = [...String(body ?? '').matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((match) => stripHtml(match[1]));
  return paragraphs.find((paragraph) => /\blocated\b/i.test(paragraph) && /\bgate|departures|customs|level\b/i.test(paragraph)) ?? '';
}

export function parseSydneyOfficialLoungeRecords(html, { url = '' } = {}) {
  const terminal = sydneyTerminalFromUrl(url);
  if (!terminal) {
    return [];
  }
  const records = [];
  for (const item of sydneyAccordionItems(html)) {
    if (!/lounge/i.test(item.title)) {
      continue;
    }
    const openHours = sydneyHours(item.body);
    const near = sydneyLocation(item.body);
    if (openHours.length === 0 || !near) {
      continue;
    }
    const name = item.title.replace(/\s*-\s*Walk ins accepted$/i, '');
    const bodyText = stripHtml(item.body);
    records.push({
      sourceRecordId: `airport-official-pages-syd-${slugify(name)}-${slugify(terminal)}-${slugify(near)}`,
      name,
      brand: name,
      operator: name,
      airportCode: 'SYD',
      airportName: 'Sydney Airport',
      terminal,
      near,
      securitySide: /after customs|after security/i.test(near) ? 'After Security' : '',
      sourceUrl: url,
      programs: ['Sydney Airport official page'],
      openHours,
      amenities: {
        Lounge: true,
        Food: /food|dining|buffet|meal|snack/i.test(bodyText),
        Drinks: /drink|beverage|bar|wine|beer|coffee/i.test(bodyText),
        'Wi-Fi': /wi-?fi/i.test(bodyText),
      },
      accessNotes: 'Official Sydney Airport lounge page with published location and operating hours.',
    });
  }
  return records.sort((first, second) => `${first.terminal}-${first.name}`.localeCompare(`${second.terminal}-${second.name}`));
}

function adrArticleTextBlocks(html) {
  const body = String(html ?? '').match(/<div\s+class=["']journal-content-article\b[^"']*["'][^>]*>([\s\S]*?)(?=<footer|$)/i)?.[1] ?? html;
  return [
    ...htmlBlocks(body, /<h1[\s\S]*?<\/h1>/gi),
    ...htmlBlocks(body, /<p[\s\S]*?<\/p>/gi),
    ...htmlBlocks(body, /<li[\s\S]*?<\/li>/gi),
    ...htmlBlocks(body, /<div\s+class=["']link\s+url["'][\s\S]*?<\/div>/gi),
  ]
    .map(stripHtml)
    .map((line) => line.replace(/\u00a0/g, ' '))
    .map(clean)
    .filter(Boolean);
}

function adrTerminalFromText(text, url) {
  const value = clean(text);
  const explicit = value.match(/\bTerminal\s*([123])\b/i)?.[1] || value.match(/\bT\s*([123])\b/i)?.[1];
  if (explicit) {
    return `Terminal ${explicit}`;
  }
  const fromUrl = clean(url).match(/\bt([123])\b/i)?.[1];
  return fromUrl ? `Terminal ${fromUrl}` : '';
}

function adrGateFromAddress(address) {
  const value = clean(address);
  const range = value.match(/\b(?:Boarding\s+Area|Area)\s+([A-Z])\s*-?\s*(\d{1,3})\s*-\s*(?:[A-Z]\s*)?(\d{1,3})\b/i);
  if (range) {
    return `Gates ${range[1].toUpperCase()}${range[2]}-${range[3]}`;
  }
  const exact = value.match(/\b(?:Gate|Gates)\s+([A-Z]?\s*-?\s*\d+[A-Z]?)\b/i);
  return exact ? `Gate ${exact[1].replace(/\s+/g, '').toUpperCase()}` : '';
}

function adrHoursFromText(value) {
  const text = clean(value)
    .replace(/\bA\.M\./gi, 'AM')
    .replace(/\bP\.M\./gi, 'PM')
    .replace(/\bto\b/gi, '-');
  const match = text.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i);
  if (!match) {
    return [];
  }
  const opening = parseClock(match[1]);
  const closing = parseClock(match[2]);
  return opening && closing ? dailyHours(opening, closing) : [];
}

function adrPriceFromText(value) {
  const text = clean(value);
  const eurBefore = text.match(/€\s*([0-9]+(?:[.,]\d+)?)/);
  const eurAfter = text.match(/([0-9]+(?:[.,]\d+)?)\s*€/);
  const usd = text.match(/([0-9]+(?:[.,]\d+)?)\s*USD\b/i) || text.match(/\bUSD\s*([0-9]+(?:[.,]\d+)?)/i);
  const amountText = eurBefore?.[1] ?? eurAfter?.[1] ?? usd?.[1] ?? '';
  const currencyCode = usd ? 'USD' : amountText ? 'EUR' : '';
  const amount = Number(amountText.replace(',', '.'));
  return Number.isFinite(amount) && amount > 0 && currencyCode ? { amount, currencyCode } : null;
}

function adrPrograms(name, text) {
  const programs = ['Fiumicino Airport official page'];
  if (/oneworld|British Airways/i.test(`${name} ${text}`)) {
    programs.push('oneworld');
  }
  if (/SkyTeam|ITA Airways/i.test(`${name} ${text}`)) {
    programs.push('SkyTeam');
  }
  if (/Priority Pass/i.test(text)) {
    programs.push('Priority Pass');
  }
  if (/LoungeKey/i.test(text)) {
    programs.push('LoungeKey');
  }
  if (/DragonPass/i.test(text)) {
    programs.push('DragonPass');
  }
  return [...new Set(programs)];
}

function prgSecondsToClock(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '';
  }
  const hour = Math.floor(seconds / 3600) % 24;
  const minute = Math.floor((seconds % 3600) / 60);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function prgTitleFromHtml(html) {
  const title = stripHtml(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  const h1 = stripHtml(String(html ?? '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '');
  return clean((title || h1).replace(/\s*\|\s*.*$/, ''));
}

function prgTerminalFromHtml(html, title) {
  const accordion = stripHtml(
    String(html ?? '').match(/accordion-item-title["'][^>]*>\s*([\s\S]*?)<\/div>/i)?.[1] ?? '',
  );
  const explicit = clean(`${accordion} ${title}`).match(/\bTerminal\s*([123])\b/i)?.[1];
  return explicit ? `Terminal ${explicit}` : '';
}

function prgSecuritySideFromHtml(html) {
  const value = stripHtml(String(html ?? '').match(/cast-terminalu[^>]*>\s*([\s\S]*?)<\/div>/i)?.[1] ?? '');
  if (/past\s+the\s+checkpoint/i.test(value)) {
    return 'After Security';
  }
  if (/public\s+area/i.test(value)) {
    return 'Before Security';
  }
  return clean(value);
}

function prgHoursFromHtml(html) {
  const dayIndexes = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };
  const rows = [];
  const rowRegex = /data-day=["']([^"']+)["'][\s\S]*?data-range-from=["'](\d+)["']\s+data-range-to=["'](\d+)["']/gi;
  for (const match of String(html ?? '').matchAll(rowRegex)) {
    const day = dayIndexes[clean(match[1]).toLowerCase()];
    const opening = prgSecondsToClock(match[2]);
    const closing = prgSecondsToClock(match[3]);
    if (day !== undefined && opening && closing) {
      rows.push({ Day: day, OpeningHour: opening, ClosingHour: closing });
    }
  }

  const uniqueByDay = new Map(rows.map((row) => [row.Day, row]));
  return [...uniqueByDay.values()].sort((first, second) => {
    const order = [1, 2, 3, 4, 5, 6, 0];
    return order.indexOf(first.Day) - order.indexOf(second.Day);
  });
}

function prgPriceFromHtml(html, name) {
  const text = clean(stripHtml(html));
  const normalizedName = clean(name);

  if (/ERSTE Premier Lounge/i.test(normalizedName)) {
    const match =
      text.match(/CZK\s*([0-9][0-9\s,.]*)\s*\/\s*1\s*person/i) ||
      text.match(/CZK\s*([0-9][0-9\s,.]*)\s*per\s+person/i);
    const amount = Number(match?.[1]?.replace(/[\s,]/g, '') ?? 0);
    return Number.isFinite(amount) && amount > 0 ? { amount, currencyCode: 'CZK' } : null;
  }

  if (/VIP Service Club CONTINENTAL/i.test(normalizedName)) {
    const match = text.match(/Price for VIP Service Club CONTINENTAL[\s\S]{0,240}?CZK\s*([0-9][0-9\s,.]*)\s*\/\s*1\s*person/i);
    const amount = Number(match?.[1]?.replace(/[\s,]/g, '') ?? 0);
    return Number.isFinite(amount) && amount > 0 ? { amount, currencyCode: 'CZK' } : null;
  }

  return null;
}

function prgPrograms(name, text) {
  const programs = ['Prague Airport official page'];
  if (/Priority Pass/i.test(text)) {
    programs.push('Priority Pass');
  }
  if (/Lounge\s*Key/i.test(text)) {
    programs.push('LoungeKey');
  }
  if (/DragonPass/i.test(text)) {
    programs.push('DragonPass');
  }
  if (/Visa/i.test(name)) {
    programs.push('Visa');
  }
  if (/Mastercard|ERSTE/i.test(`${name} ${text}`)) {
    programs.push('Mastercard');
  }
  return [...new Set(programs)];
}

function prgOperator(name) {
  if (/VIP Service/i.test(name)) return 'Prague Airport VIP Service';
  if (/VISA/i.test(name)) return 'Prague Airport';
  if (/ERSTE/i.test(name)) return 'Prague Airport';
  return name;
}

function hamadNameFromHtml(html) {
  const title = stripHtml(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  return clean(title.replace(/\s*\|\s*Hamad International Airport\s*$/i, ''));
}

function hamadFindingText(html) {
  const match = String(html ?? '').match(/<h3[^>]*>\s*Finding the Lounge\s*<\/h3>([\s\S]*?)(?:<hr|<h3|<\/article>)/i);
  return stripHtml(match?.[1] ?? '');
}

function hamadTerminalFromText(text) {
  return /arrival|immigration/i.test(text) ? 'Arrivals' : 'Passenger Terminal';
}

function hamadConcourseFromText(text) {
  const concourse = clean(text).match(/\bConcourse\s+([A-Z])\b/i)?.[1];
  return concourse ? `Concourse ${concourse.toUpperCase()}` : '';
}

function hamadGateFromText(text) {
  const gate = clean(text).match(/\b(?:Boarding\s+)?Gate\s+([A-Z]\s*-?\s*\d+[A-Z]?)\b/i)?.[1];
  return gate ? `Gate ${gate.replace(/\s+/g, '').toUpperCase()}` : '';
}

function hamadSecuritySide(text) {
  if (/after\s+immigration|after\s+passport|departure|concourse|boarding gate/i.test(text)) {
    return 'After Security';
  }
  if (/before\s+immigration|arrival/i.test(text)) {
    return 'Before Security';
  }
  return '';
}

function hamadPrograms(name, text) {
  const programs = ['Hamad International Airport official page'];
  if (/Qatar Airways|Privilege Club/i.test(`${name} ${text}`)) {
    programs.push('Qatar Airways Privilege Club');
  }
  if (/oneworld|Emerald|Sapphire/i.test(text)) {
    programs.push('oneworld');
  }
  if (/Al Maha/i.test(name)) {
    programs.push('Al Maha Services');
  }
  return [...new Set(programs)];
}

export function parseHamadOfficialLoungeRecords(
  html,
  { url = 'https://dohahamadairport.com/lounges' } = {},
) {
  const name = hamadNameFromHtml(html);
  const finding = hamadFindingText(html);
  if (!name || !finding || !/lounge|room/i.test(name)) {
    return [];
  }

  const text = clean(stripHtml(html));
  const concourse = hamadConcourseFromText(finding);
  const gate = hamadGateFromText(finding);
  return [
    {
      sourceRecordId: `airport-official-pages-doh-${slugify(name)}-${slugify(finding)}`,
      name,
      brand: name,
      operator: /Qatar|Al Mourjan|Al Safwa|Gold|Silver|Platinum/i.test(name) ? 'Qatar Airways' : 'Hamad International Airport',
      airportCode: 'DOH',
      airportName: 'Hamad International Airport',
      terminal: hamadTerminalFromText(`${name} ${finding}`),
      concourse,
      gate,
      near: finding,
      securitySide: hamadSecuritySide(`${name} ${finding}`),
      sourceUrl: url,
      programs: hamadPrograms(name, text),
      openHours: [],
      amenities: {
        Lounge: true,
        Food: /buffet|dining|food|menu/i.test(text),
        Drinks: /bar|beverage|drinks/i.test(text),
        'Wi-Fi': /wi-?fi/i.test(text),
        Showers: /shower/i.test(text),
        'Family room': /family/i.test(text),
        'Prayer room': /prayer/i.test(text),
      },
      accessNotes: 'Official Hamad International Airport lounge page with published location and access text where available.',
    },
  ];
}

export function parsePragueOfficialLoungeRecords(
  html,
  { url = 'https://www.prg.aero/en/lounges-and-vip-service' } = {},
) {
  const name = prgTitleFromHtml(html);
  if (!name || !/lounge|club\s+continental/i.test(name)) {
    return [];
  }

  const terminal = prgTerminalFromHtml(html, name);
  const securitySide = prgSecuritySideFromHtml(html);
  const openHours = prgHoursFromHtml(html);
  if (!terminal || openHours.length === 0) {
    return [];
  }

  const text = clean(stripHtml(html));
  const price = prgPriceFromHtml(html, name);
  return [
    {
      sourceRecordId: `airport-official-pages-prg-${slugify(name)}-${slugify(terminal)}-${slugify(securitySide)}`,
      name,
      brand: name,
      operator: prgOperator(name),
      airportCode: 'PRG',
      airportName: 'Vaclav Havel Airport Prague',
      terminal,
      near: securitySide,
      securitySide,
      sourceUrl: url,
      programs: prgPrograms(name, text),
      openHours,
      price,
      currencyCode: price?.currencyCode,
      amenities: {
        Lounge: true,
        Food: /refreshments|snacks|food|buffet/i.test(text),
        Drinks: /drinks|beverage|bar|coffee/i.test(text),
        'Wi-Fi': /wi-?fi|internet/i.test(text),
        Showers: /shower/i.test(text),
        TV: /tv|television/i.test(text),
      },
      accessNotes: 'Official Prague Airport lounge page with published terminal, security area, operating hours, and access terms where available.',
    },
  ];
}

function adrNameFromUrl(url, fallback) {
  const slug = clean(url).split('/').pop() ?? '';
  const names = {
    'emirates-lounge': 'Emirates Lounge',
    'british-airways-lounge': 'British Airways Lounge',
    'ita-airways-lounge': 'ITA Airways Lounge',
    'plaza-premium-lounge-t1': 'Plaza Premium Lounge',
    'plaza-premium-lounge-t3': 'Plaza Premium Lounge',
    'passenger-lounge1': 'Prima Vista Lounge',
    hellosky: 'Arrival Lounge & Air Rooms HelloSky',
    'plaza-premium-first-lounge-t1': 'Plaza Premium First Lounge',
  };
  return names[slug] ?? fallback;
}

function adrOperator(name) {
  if (/Emirates/i.test(name)) return 'Emirates';
  if (/British Airways/i.test(name)) return 'British Airways';
  if (/ITA Airways/i.test(name)) return 'ITA Airways';
  if (/Plaza Premium/i.test(name)) return 'Plaza Premium Lounge';
  if (/HelloSky/i.test(name)) return 'HelloSky';
  if (/Prima Vista/i.test(name)) return 'Aeroporti di Roma';
  return name;
}

function adrNewSectionFromAddressLine(line) {
  const match = clean(line).match(/^(?:(Address)|"([^"]+)"|([^:]{3,80}?))\s*:\s*(.+)$/i);
  if (!match) {
    return null;
  }
  const label = clean(match[1] ?? match[2] ?? match[3]);
  const address = clean(match[4]);
  if (/^(?:opening time|access fee|cost|services|booking|e-mail|email)$/i.test(label)) {
    return null;
  }
  if (!address || !/(boarding|terminal|landside|schengen|gate|airport)/i.test(address)) {
    return null;
  }
  const sectionName = match[2] && !/area|address/i.test(label) ? label : '';
  return { sectionName, address };
}

const AENA_AIRPORTS = new Map([
  ['a-coruna', { code: 'LCG', name: 'A Coruna Airport' }],
  ['alicante-elche', { code: 'ALC', name: 'Alicante-Elche Miguel Hernandez Airport' }],
  ['bilbao', { code: 'BIO', name: 'Bilbao Airport' }],
  ['fuerteventura', { code: 'FUE', name: 'Fuerteventura Airport' }],
  ['gran-canaria', { code: 'LPA', name: 'Gran Canaria Airport' }],
  ['ibiza', { code: 'IBZ', name: 'Ibiza Airport' }],
  ['josep-tarradellas-barcelona-el-prat', { code: 'BCN', name: 'Josep Tarradellas Barcelona-El Prat Airport' }],
  ['madrid-barajas-adolfo-suarez', { code: 'MAD', name: 'Adolfo Suarez Madrid-Barajas Airport' }],
  ['menorca', { code: 'MAH', name: 'Menorca Airport' }],
  ['palma-de-mallorca', { code: 'PMI', name: 'Palma de Mallorca Airport' }],
  ['santiago-rosalia-de-castro', { code: 'SCQ', name: 'Santiago-Rosalia de Castro Airport' }],
  ['sevilla', { code: 'SVQ', name: 'Sevilla Airport' }],
  ['tenerife-norte-ciudad-de-la-laguna', { code: 'TFN', name: 'Tenerife Norte-Ciudad de La Laguna Airport' }],
  ['tenerife-sur', { code: 'TFS', name: 'Tenerife Sur Airport' }],
  ['valencia', { code: 'VLC', name: 'Valencia Airport' }],
  ['vigo', { code: 'VGO', name: 'Vigo Airport' }],
]);

function aenaAirportFromUrl(url) {
  const pathname = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return clean(url);
    }
  })();
  for (const [slug, airport] of AENA_AIRPORTS) {
    if (pathname.includes(`/${slug}/`)) {
      return airport;
    }
  }
  return null;
}

function aenaText(value) {
  return clean(
    decodeEntities(value)
      .replace(/&aacute;/gi, 'á')
      .replace(/&eacute;/gi, 'é')
      .replace(/&iacute;/gi, 'í')
      .replace(/&oacute;/gi, 'ó')
      .replace(/&uacute;/gi, 'ú')
      .replace(/&ntilde;/gi, 'ñ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  );
}

function aenaTitle(html) {
  const title = clean(
    stripHtml(String(html ?? '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]) ||
      titleText(html).replace(/\s*\|\s*.*$/, ''),
  );
  return title.replace(/^Sala\s+(?!VIP\b)/i, 'Sala VIP ');
}

function aenaMainText(html, title) {
  const text = aenaText(html);
  const contentIndex = text.search(/\bRelájate\s+y\s+disfruta\b/i);
  const titleIndex = contentIndex >= 0 ? contentIndex : text.indexOf(title);
  const main = titleIndex >= 0 ? text.slice(titleIndex) : text;
  const end = main.search(/\bQué\s+te\s+ofrecemos\b|\bAcceso\s+a\s+Sala\s+VIP\b|\bNormas\s+de\s+uso\b/i);
  return clean(main.slice(0, end > 0 ? end : 1200));
}

function aenaTerminal(value) {
  const text = clean(value);
  const raw =
    text.match(/\bTerminal\s+T?\s*([0-9][A-Z]?)\b/i)?.[1] ||
    text.match(/\bterminal\s+T?\s*([0-9][A-Z]?)\b/i)?.[1] ||
    text.match(/\((?:T|Terminal\s*)([0-9][A-Z]?)\)/i)?.[1] ||
    text.match(/\bT([0-9][A-Z]?)\b/i)?.[1] ||
    '';
  if (raw) {
    return `Terminal ${raw.toUpperCase()}`;
  }
  return /\bterminal\b|\bzona\s+(?:pre\s+)?embarque\b|\b(?:planta\s+-?\d+|\d+ª?\s+planta)\b/i.test(text) ? 'Terminal' : '';
}

function aenaHoursText(value) {
  const text = clean(value);
  const weekdayWeekend = text.match(
    /\bDe\s+lunes\s+a\s+viernes:\s*de\s+(\d{1,2}:\d{2})\s+a\s+(\d{1,2}:\d{2})\.?\s*Sábado\s+y\s+domingo:\s*de\s+(\d{1,2}:\d{2})\s+a\s+(\d{1,2}:\d{2})/i,
  );
  if (weekdayWeekend) {
    const weekdayOpen = parseClock(weekdayWeekend[1]);
    const weekdayClose = parseClock(weekdayWeekend[2]);
    const weekendOpen = parseClock(weekdayWeekend[3]);
    const weekendClose = parseClock(weekdayWeekend[4]);
    if (weekdayOpen && weekdayClose && weekendOpen && weekendClose) {
      return `Mon-Fri ${weekdayOpen}-${weekdayClose}; Sat-Sun ${weekendOpen}-${weekendClose}`;
    }
  }

  if (/\bAbierta?\s+24\s+horas\b|\b24\s+horas\b/i.test(text)) {
    return 'Daily 24 hours';
  }

  const match =
    text.match(/\bDe\s+(\d{1,2}:\d{2})\s+a\s+(?:las\s+)?(\d{1,2}:\d{2})\b/i) ||
    text.match(/\bDe\s+(\d{1,2}:\d{2})\s+a\s+(último\s+vuelo|ultimo\s+vuelo)\b/i);
  if (!match) {
    return '';
  }
  const opening = parseClock(match[1]);
  const closing = parseClock(match[2]);
  if (opening && closing) {
    return `Daily ${opening}-${closing}`;
  }
  if (opening && /ultimo|último/i.test(match[2])) {
    return `${opening} to last flight`;
  }
  return clean(match[0]);
}

function aenaOpenHours(hoursText) {
  const text = clean(hoursText);
  if (/^Daily\s+24\s+hours$/i.test(text)) {
    return allDayHours();
  }
  const daily = text.match(/^Daily\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/);
  if (daily) {
    return dailyHours(daily[1], daily[2]);
  }
  const weekdayWeekend = text.match(/^Mon-Fri\s+(\d{2}:\d{2})-(\d{2}:\d{2});\s*Sat-Sun\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/);
  if (weekdayWeekend) {
    return [
      ...[1, 2, 3, 4, 5].map((day) => ({ Day: day, OpeningHour: weekdayWeekend[1], ClosingHour: weekdayWeekend[2] })),
      ...[6, 0].map((day) => ({ Day: day, OpeningHour: weekdayWeekend[3], ClosingHour: weekdayWeekend[4] })),
    ];
  }
  return [];
}

function aenaNear(value) {
  const text = clean(value);
  const level = text.match(/\bplanta\s+(-?\d+)\b/i)?.[1] || text.match(/\b(\d+)ª?\s+planta\b/i)?.[1];
  const gateArea = text.match(/\bzona\s+de\s+puertas?\s+de\s+embarque\s+([A-Z](?:\s*(?:,|y|e)\s*[A-Z])*)\b/i)?.[1];
  const genericGateArea = !gateArea && /\bzona\s+(?:de\s+embarque|pre\s+embarque)\b/i.test(text);
  const destinationZone =
    text.match(/\bZona\s+destinos?\s+No\s+Schengen\b/i)?.[0] ||
    text.match(/\bZona\s+destinos?\s+Schengen\b/i)?.[0] ||
    text.match(/\bZona\s+No\s+Schengen\b/i)?.[0] ||
    text.match(/\bZona\s+Schengen\b/i)?.[0] ||
    '';
  const gateLetters = clean(gateArea)
    .split(/\s*(?:,|\by\b)\s*/i)
    .map((part) => clean(part).toUpperCase())
    .filter((part) => /^[A-Z]$/.test(part));
  const zoneLabel = /No\s+Schengen/i.test(destinationZone)
    ? 'Non-Schengen Area'
    : /Schengen/i.test(destinationZone)
    ? 'Schengen Area'
    : '';
  const fallbackLocation =
    text.match(/\bEn\s+la\s+terminal[\s\S]*?(?=\bTerminal\s+T?\d|\bAeropuerto\b|\bDe\s+\d|$)/i)?.[0] ||
    text.match(/\bTerminal\s+T?\d[\s\S]*?(?=\bAeropuerto\b|\bDe\s+\d|$)/i)?.[0] ||
    '';
  const parts = [
    gateLetters.length > 0 ? `gates ${gateLetters.join(' and ')}` : '',
    genericGateArea ? 'Gate Area' : '',
    level ? `Level ${level}` : '',
    zoneLabel,
    fallbackLocation,
  ].filter(Boolean);
  return clean([...new Set(parts)].join(', '));
}

function aenaAmenities(html) {
  const text = aenaText(html);
  return {
    Lounge: true,
    Food: /Catering|Comida|Kosher|halal|sin gluten/i.test(text),
    Drinks: /Catering|bebidas|bar/i.test(text),
    'Wi-Fi': /Wi-?Fi/i.test(text),
    Showers: /Duchas/i.test(text),
    TV: /Televisión/i.test(text),
    Workspaces: /Zonas?\s+de\s+trabajo|Salas?\s+de\s+reuniones/i.test(text),
    'Disabled access': /PMR/i.test(text),
  };
}

export function parseAenaOfficialLoungeRecords(html, { url = '' } = {}) {
  const airport = aenaAirportFromUrl(url);
  const title = aenaTitle(html).replace(/\s*\([^)]*\)\s*$/i, '');
  if (!airport || !title || !/Sala\s+VIP/i.test(title)) {
    return [];
  }

  const main = aenaMainText(html, title);
  const terminal = aenaTerminal(`${title} ${main}`);
  const near = aenaNear(main);
  const hoursText = aenaHoursText(main);
  if (!terminal || !near || !hoursText) {
    return [];
  }

  return [
    {
      sourceRecordId: `airport-official-pages-${airport.code.toLowerCase()}-${slugify(title)}-${slugify(terminal)}-${slugify(near)}`,
      name: title,
      brand: title,
      operator: 'Aena',
      airportCode: airport.code,
      airportName: airport.name,
      terminal,
      near,
      securitySide: /Schengen|destinos/i.test(main) ? 'Departures' : '',
      sourceUrl: url,
      programs: ['Aena VIP lounge'],
      openHours: aenaOpenHours(hoursText),
      hoursText,
      amenities: aenaAmenities(html),
      accessNotes: 'Official Aena VIP lounge page with published terminal, location, services, and operating-hours text.',
    },
  ];
}

export function parseFiumicinoOfficialLoungeRecords(html, { url = 'https://www.adr.it/web/aeroporti-di-roma-en/lounge' } = {}) {
  const lines = adrArticleTextBlocks(html);
  const h1 = stripHtml(String(html ?? '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '');
  const pageName = adrNameFromUrl(url, h1);
  const records = [];
  let current = null;

  function commit() {
    if (!current?.address || current.openHours.length === 0) {
      return;
    }
    const name = clean(current.name || pageName);
    const terminal = adrTerminalFromText(current.address, url);
    const gate = adrGateFromAddress(current.address);
    const joined = clean(current.lines.join(' '));
    const price = current.price ?? adrPriceFromText(joined);
    records.push({
      sourceRecordId: `airport-official-pages-fco-${slugify(name)}-${slugify(current.address)}`,
      name,
      brand: name,
      operator: adrOperator(name),
      airportCode: 'FCO',
      airportName: 'Leonardo da Vinci-Fiumicino Airport',
      terminal,
      gate,
      near: current.address,
      securitySide: /landside|near terminals/i.test(current.address) ? 'Before Security' : 'After Security',
      sourceUrl: url,
      programs: adrPrograms(name, joined),
      openHours: current.openHours,
      price,
      currencyCode: price?.currencyCode,
      amenities: {
        Lounge: true,
        Food: /food|buffet|cuisine|beverage|bar/i.test(joined),
        Drinks: /bar|beverage|drink|wine|open bar/i.test(joined),
        'Wi-Fi': /wi-?fi/i.test(joined),
        Showers: /shower/i.test(joined),
        'Flight monitors': /flight information/i.test(joined),
        'Disabled access': /disabled access/i.test(joined),
      },
      accessNotes: 'Official Aeroporti di Roma lounge page with published location, operating hours, and access terms where available.',
    });
  }

  for (const line of lines) {
    if (/^Lounge$/i.test(line) || /cookie|privacy|navigation|search/i.test(line)) {
      continue;
    }
    const addressSection = adrNewSectionFromAddressLine(line);
    if (addressSection) {
      commit();
      current = {
        name: addressSection.sectionName || pageName,
        address: addressSection.address,
        openHours: [],
        price: null,
        lines: [line],
      };
      continue;
    }
    if (!current) {
      continue;
    }
    current.lines.push(line);
    if (/^Opening Time\s*:/i.test(line) || /^Opening time\s*:/i.test(line)) {
      current.openHours = adrHoursFromText(line);
    }
    if (/^(?:Access fee|Cost)\s*:/i.test(line)) {
      current.price = adrPriceFromText(line);
    }
  }
  commit();

  return records.sort((first, second) => `${first.name}-${first.near}`.localeCompare(`${second.name}-${second.near}`));
}

export function parseAirportOfficialLoungeRecords(html, options = {}) {
  const url = options.url ?? '';
  if (url.includes('dohahamadairport.com/lounge/')) {
    return parseHamadOfficialLoungeRecords(html, options);
  }
  if (url.includes('prg.aero/en/')) {
    return parsePragueOfficialLoungeRecords(html, options);
  }
  if (url.includes('adr.it/web/aeroporti-di-roma-en/')) {
    return parseFiumicinoOfficialLoungeRecords(html, options);
  }
  if (url.includes('aena.es/es/') && url.includes('/servicios-vip/salas-vip/')) {
    return parseAenaOfficialLoungeRecords(html, options);
  }
  if (url.includes('tokyo-haneda.com/en/service/facilities/lounge.html')) {
    return parseHanedaOfficialLoungeRecords(html, options);
  }
  if (url.includes('melbourneairport.com.au')) {
    return parseMelbourneOfficialLoungeRecords(html, options);
  }
  if (url.includes('sydneyairport.com.au')) {
    return parseSydneyOfficialLoungeRecords(html, options);
  }
  if (url.includes('hongkongairport.com')) {
    return parseHongKongAirportOfficialLoungeRecords(html, options);
  }
  if (url.includes('getfacilitieslistingcards')) {
    return parseChangiOfficialLoungeRecords(html, options);
  }
  if (url.includes('changiairport.com')) {
    return parseChangiOfficialDetailLoungeRecords(html, options);
  }
  if (url.includes('flysfo.com')) {
    return parseSfoOfficialLoungeRecords(html, options);
  }
  if (url.includes('phl.org')) {
    return parsePhlOfficialLoungeRecords(html, options);
  }
  if (url.includes('dfwairport.com')) {
    return parseDfwOfficialLoungeRecords(html, options);
  }
  if (url.includes('gatwickairport.com')) {
    return parseGatwickOfficialLoungeRecords(html, options);
  }
  if (url.includes('heathrow.com')) {
    return parseHeathrowOfficialLoungeRecords(html, options);
  }
  if (url.includes('manchesterairport.co.uk')) {
    return parseManchesterOfficialLoungeRecords(html, options);
  }
  if (url.includes('dubaiairports.ae')) {
    return parseDubaiAirportsOfficialLoungeRecords(html, options);
  }
  if (url.includes('suvarnabhumi.airportthai.co.th')) {
    return parseSuvarnabhumiOfficialLoungeRecords(html, options);
  }
  if (url.includes('gru.com.br')) {
    return parseGruOfficialLoungeRecords(html, options);
  }
  if (url.includes('miami-airport.com')) {
    return parseMiamiOfficialLoungeRecords(html, options);
  }
  if (url.includes('portseattle.org')) {
    return parseSeaOfficialLoungeRecords(html, options);
  }
  return [];
}
