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
  return clean(String(value ?? '').replace(/<[^>]+>/g, ' '));
}

function slugify(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

const AIRPORT_CODE_PATTERNS = [
  [/almaty international airport/i, 'ALA'],
  [/batumi international airport/i, 'BUS'],
  [/tbilisi international airport/i, 'TBS'],
  [/l\.?\s*f\.?\s*wade international airport/i, 'BDA'],
  [/arturo merino ben[ií]tez international airport/i, 'SCL'],
  [/john f\.?\s*kennedy international airport/i, 'JFK'],
  [/washington dulles international airport/i, 'IAD'],
  [/monastir habib bourguiba international airport/i, 'MIR'],
  [/enfidha-?hammamet international airport/i, 'NBE'],
  [/antananarivo international airport/i, 'TNR'],
  [/jomo kenyatta international airport/i, 'NBO'],
  [/paris cdg airport|charles de gaulle/i, 'CDG'],
  [/orly international airport/i, 'ORY'],
  [/rome leonardo da vinci fiumicino airport|fiumicino airport/i, 'FCO'],
  [/milan bergamo international airport/i, 'BGY'],
  [/sofia international airport|sofia vasil levski international airport/i, 'SOF'],
  [/riga international airport/i, 'RIX'],
  [/ohrid international airport/i, 'OHD'],
  [/skopje international airport/i, 'SKP'],
  [/zurich international airport/i, 'ZRH'],
  [/esenboga international airport/i, 'ESB'],
  [/adnan menderes international airport/i, 'ADB'],
  [/milas-?bodrum international airport/i, 'BJV'],
  [/muscat international airport/i, 'MCT'],
  [/duqm international airport/i, 'DQM'],
  [/madinah airport|prince mohammad bin abdulaziz international airport/i, 'MED'],
];

function canonicalUrl(html, fallbackUrl) {
  const match = String(html ?? '').match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  return clean(match?.[1]) || fallbackUrl;
}

function absoluteUrl(value) {
  return new URL(value, 'https://tavoperationservices.com').toString();
}

function sourceSlug(url) {
  try {
    return new URL(url).pathname.split('/').filter(Boolean).pop() ?? url;
  } catch {
    return url;
  }
}

export function parsePrimeclassIndexLinks(html) {
  const links = [];
  const regex = /<a class="lounge-list-item" href="([^"]+)">[\s\S]*?<span class="lounge-name">([\s\S]*?)<\/span>/gi;
  for (const match of String(html ?? '').matchAll(regex)) {
    const url = absoluteUrl(match[1]);
    const name = stripHtml(match[2]);
    if (!name || !url.includes('/services/lounges/')) {
      continue;
    }
    links.push({ url, name });
  }

  return [...new Map(links.map((link) => [link.url, link])).values()];
}

function pageTitle(html) {
  return (
    stripHtml(String(html ?? '').match(/<h1[^>]*class=["'][^"']*page-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1]) ||
    stripHtml(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])
  );
}

function summaryHtml(html) {
  return String(html ?? '').match(/<div class="page-summary">([\s\S]*?)<\/div>/i)?.[1] ?? '';
}

function summaryField(html, label) {
  const paragraphRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  const labelRegex = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`, 'i');
  for (const match of summaryHtml(html).matchAll(paragraphRegex)) {
    const text = stripHtml(match[1]);
    if (labelRegex.test(text)) {
      return clean(text.replace(labelRegex, ''));
    }
  }

  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match =
    summaryHtml(html).match(
      new RegExp(`<strong>\\s*${escaped}(?:\\s|&nbsp;)*:?(?:\\s|&nbsp;)*<\\/strong>\\s*([\\s\\S]*?)(?=<\\/p>)`, 'i'),
    ) ||
    summaryHtml(html).match(
      new RegExp(
        `<strong>\\s*${escaped}(?:\\s|&nbsp;)*:?(?:\\s|&nbsp;)*<\\/strong>\\s*([\\s\\S]*?)(?=<br\\s*\\/?>\\s*<br\\s*\\/?>|<strong>|$)`,
        'i',
      ),
    );
  return stripHtml(match?.[1]);
}

function airportCodeFromText(value) {
  const text = clean(value);
  return AIRPORT_CODE_PATTERNS.find(([pattern]) => pattern.test(text))?.[1] ?? '';
}

function airportNameFromText(value, fallbackName) {
  const text = clean(value);
  const match = text.match(
    /([A-Z][A-Za-z.'’ -]+?(?:International Airport|Intl Airport|Airport))(?:,| -|$)/,
  );
  return clean(match?.[1]) || clean(fallbackName);
}

function terminalFromText(value) {
  const text = clean(value);
  return (
    text.match(/\bTerminal\s+[A-Z0-9]+(?:\s*\/\s*[A-Z0-9]+)?\b/i)?.[0] ||
    text.match(/\bGeneral Aviation Terminal\b/i)?.[0] ||
    text.match(/\bDomestic\b/i)?.[0] ||
    text.match(/\bInternational\b/i)?.[0] ||
    ''
  );
}

function parseTime(value) {
  const match = clean(value).replace(/\.(?=\d{2}\b)/g, ':').match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) {
    return '';
  }
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const suffix = match[3]?.toLowerCase();
  if (suffix === 'pm' && hour < 12) hour += 12;
  if (suffix === 'am' && hour === 12) hour = 0;
  if (!Number.isFinite(hour) || hour > 23 || minute > 59) return '';
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function everyDayHours(opening, closing) {
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

function weekdayHours(value) {
  const text = clean(value)
    .replace(/\.(?=\d{2}\b)/g, ':')
    .replace(/&nbsp;/gi, ' ');
  const rows = [];
  const dayPattern = [...DAY_NAME_TO_INDEX.keys()].join('|');
  const regex = new RegExp(
    `\\b(${dayPattern})\\s*:?\\s*(\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?)\\s*(?:-|to)\\s*(\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?)`,
    'gi',
  );
  for (const match of text.matchAll(regex)) {
    const opening = parseTime(match[2]);
    const closing = parseTime(match[3]);
    const day = DAY_NAME_TO_INDEX.get(match[1].toLowerCase());
    if (opening && closing && day !== undefined) {
      rows.push({ Day: day, OpeningHour: opening, ClosingHour: closing });
    }
  }
  return rows;
}

function openHours(value) {
  const text = clean(value);
  if (/\b24\s*\/\s*7\b|\b7\s*\/\s*24\b|\b24h\s*7d\b|\bopen\s+7\s*\/\s*24\b|\b24 hours\b/i.test(text)) {
    return [1, 2, 3, 4, 5, 6, 0].map((day) => ({ Day: day, OpenAllDay: true }));
  }

  const weeklyRows = weekdayHours(text);
  if (weeklyRows.length > 0) {
    return weeklyRows;
  }

  const daily =
    text.match(
      /(?:daily|mondays?\s+to\s+sundays?)[:,\s]+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|to)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
    ) ||
    text.match(
      /(\d{1,2}(?::\d{2}|\.\d{2})?\s*(?:am|pm)?)\s*(?:-|to)\s*(\d{1,2}(?::\d{2}|\.\d{2})?\s*(?:am|pm)?)(?:\s+daily)?/i,
    );
  if (!daily) {
    return [];
  }
  const opening = parseTime(daily[1]);
  const closing = parseTime(daily[2]);
  return opening && closing ? everyDayHours(opening, closing) : [];
}

function brandFromName(name) {
  const text = clean(name);
  if (/Extime/i.test(text)) return 'Extime Lounge';
  if (/HelloSky/i.test(text)) return 'HelloSky Lounge';
  if (/Qatar Airways/i.test(text)) return 'Qatar Airways Premium Lounge';
  if (/Turkish Airlines/i.test(text)) return 'Turkish Airlines Lounge';
  if (/Condor/i.test(text)) return 'Condor Lounge';
  if (/Andes/i.test(text)) return 'Andes Lounge';
  return 'Primeclass Lounge';
}

function notesFromSummary(html) {
  return clean([summaryField(html, 'Note'), summaryField(html, 'Contact Information')].filter(Boolean).join(' '));
}

export function parsePrimeclassStructuredRecord(html, { url = '' } = {}) {
  const title = pageTitle(html);
  const location = summaryField(html, 'Location');
  const hoursText = summaryField(html, 'Opening Hours');
  const sourceUrl = canonicalUrl(html, url);
  const combined = [title, location, sourceUrl].join(' ');
  const airportCode = airportCodeFromText(combined);
  if (!title || !/^[A-Z0-9]{3}$/.test(airportCode)) {
    return null;
  }

  return {
    sourceRecordId: `${airportCode}-${slugify(sourceSlug(sourceUrl) || title)}`,
    name: title,
    brand: brandFromName(title),
    operator: 'TAV Operation Services',
    airportCode,
    airportName: airportNameFromText(location || title, `${airportCode} Airport`),
    terminal: terminalFromText([title, location].join(' ')),
    concourse: clean(location).match(/\bConcourse\s+[A-Z0-9]+\b/i)?.[0] ?? '',
    near: location,
    openHours: openHours(hoursText),
    hoursText,
    sourceUrl,
    amenities: { Lounge: true },
    accessNotes: notesFromSummary(html) || 'Official TAV Operation Services lounge detail page.',
  };
}
