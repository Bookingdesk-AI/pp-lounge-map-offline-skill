function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function stripHtml(value) {
  return clean(
    String(value ?? '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/gi, '"'),
  );
}

function slugify(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

const LOCATION_AIRPORTS = new Map([
  ['birmingham', 'BHX'],
  ['jersey', 'JER'],
  ['london-gatwick', 'LGW'],
  ['london-heathrow', 'LHR'],
  ['london-luton', 'LTN'],
]);

const NAME_AIRPORTS = [
  [/\bBirmingham\b/i, 'BHX'],
  [/\bJersey\b/i, 'JER'],
  [/\bGatwick\b/i, 'LGW'],
  [/\bHeathrow\b/i, 'LHR'],
  [/\bLuton\b/i, 'LTN'],
  [/\bNewcastle\b/i, 'NCL'],
  [/\bManchester\b/i, 'MAN'],
  [/\bEdinburgh\b/i, 'EDI'],
  [/\bBelfast(?: City)?\b/i, 'BHD'],
  [/\bLiverpool\b/i, 'LPL'],
  [/\bNew Orleans\b|\bMSY\b/i, 'MSY'],
  [/\bLas Vegas\b|\bLAS\b/i, 'LAS'],
  [/\bAtlanta\b|\bATL\b/i, 'ATL'],
  [/\bOrlando\b|\bMCO\b/i, 'MCO'],
];

function absoluteUrl(value) {
  const text = clean(value);
  if (!text) {
    return '';
  }
  return new URL(text, 'https://no1lounges.com').toString();
}

function nextData(html) {
  const match = String(html ?? '').match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) {
    return null;
  }

  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function airportCodeFromPageUrl(url) {
  let pathname = '';
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = clean(url);
  }
  const locationSlug = pathname.match(/\/locations\/([^/]+)\//i)?.[1];
  return LOCATION_AIRPORTS.get(locationSlug) ?? '';
}

function airportCodeFromText(value) {
  const text = clean(value);
  const explicit = text.match(/\b([A-Z]{3})\b/);
  if (explicit) {
    return explicit[1];
  }
  return NAME_AIRPORTS.find(([pattern]) => pattern.test(text))?.[1] ?? '';
}

function brandFromName(name) {
  const text = clean(name);
  if (/\bClubrooms\b/i.test(text)) {
    return 'Clubrooms';
  }
  if (/\bMy Lounge\b/i.test(text)) {
    return 'My Lounge';
  }
  if (/\bClub Aspire\b/i.test(text)) {
    return 'Club Aspire';
  }
  if (/\bAspire\b/i.test(text)) {
    return 'Aspire Lounges';
  }
  if (/\bThe Club\b/i.test(text)) {
    return 'The Club';
  }
  return 'No1 Lounges';
}

function terminalFromText(value) {
  const text = clean(value);
  const terminal =
    text.match(/\bTerminal\s+[A-Z0-9]+(?:\s*\/\s*[A-Z0-9]+)?\b/i)?.[0] ||
    text.match(/\bT[0-9](?:\s*\/\s*[0-9])?\b/i)?.[0] ||
    '';
  if (!terminal) {
    return '';
  }
  return terminal.replace(/^T(\d)/i, 'Terminal $1').replace(/\s+/g, ' ');
}

function concourseFromText(value) {
  return clean(value).match(/\bConcourse\s+[A-Z0-9]+\b/i)?.[0] ?? '';
}

function parsePrice(value) {
  const text = clean(value);
  const match = text.match(/(?:£|GBP\s*)\s*(\d+(?:\.\d+)?)/i);
  if (!match) {
    return null;
  }
  return {
    amount: Number(match[1]),
    currencyCode: 'GBP',
  };
}

function clock(value) {
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

function openHours(value) {
  const text = clean(value).replace(/\bOpen daily from:?\s*/i, '');
  const match = text.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|-)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  if (!match) {
    return [];
  }
  const opening = clock(match[1]);
  const closing = clock(match[2]);
  if (!opening || !closing) {
    return [];
  }
  return [1, 2, 3, 4, 5, 6, 0].map((day) => ({
    Day: day,
    OpeningHour: opening,
    ClosingHour: closing,
  }));
}

function hoursText(value) {
  const text = clean(value);
  if (!text) {
    return '';
  }

  const completeHours = openHours(text);
  if (completeHours.length > 0) {
    return '';
  }

  const openingOnly = text.match(/\bOpen daily from:?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  if (!openingOnly) {
    return '';
  }

  const opening = clock(openingOnly[1]);
  return opening ? `Open daily from ${opening}` : `Open daily from ${clean(openingOnly[1])}`;
}

function loungeCardsFromPage(page) {
  const cards = [];
  for (const component of page?.components ?? []) {
    for (const location of component.locations ?? []) {
      for (const lounge of location.lounges ?? []) {
        cards.push({ locationLabel: clean(location.label), lounge });
      }
    }
  }
  return cards;
}

export function parseNo1StructuredRecords(html, { url = '' } = {}) {
  const data = nextData(html);
  const page = data?.props?.pageProps?.page;
  const pageAirportCode = airportCodeFromPageUrl(url);
  const records = [];

  for (const { locationLabel, lounge } of loungeCardsFromPage(page)) {
    const name = clean(lounge.loungeName);
    if (!name) {
      continue;
    }

    const description = stripHtml(lounge.description);
    const sourceUrl = absoluteUrl(lounge.url);
    const airportCode =
      pageAirportCode ||
      airportCodeFromText([name, locationLabel, description, sourceUrl].filter(Boolean).join(' '));
    if (!airportCode) {
      continue;
    }

    const brand = brandFromName(name);
    const terminal = terminalFromText([name, locationLabel, description].join(' ')) || clean(locationLabel);
    const concourse = concourseFromText(description);
    const hours = openHours(lounge.openingTimesInformation);
    const officialHoursText = hoursText(lounge.openingTimesInformation);
    const price = parsePrice(lounge.priceInformation);

    records.push({
      sourceRecordId: `${airportCode}-${slugify(sourceUrl || name)}`,
      name,
      brand,
      operator: brand,
      airportCode,
      airportName: `${airportCode} Airport`,
      terminal,
      concourse,
      near: description,
      openHours: hours,
      hoursText: officialHoursText,
      price,
      sourceUrl,
      accessNotes: clean(lounge.priceInformation),
    });
  }

  const byId = new Map(records.map((record) => [record.sourceRecordId, record]));
  return [...byId.values()].sort((first, second) => `${first.airportCode}-${first.name}`.localeCompare(`${second.airportCode}-${second.name}`));
}
