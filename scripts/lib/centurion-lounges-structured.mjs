function clean(value) {
  return String(value ?? '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&pound;|&#163;/gi, '£')
    .replace(/&yen;|&#165;/gi, '¥')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(value) {
  return clean(
    String(value ?? '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  );
}

function parseClock(value) {
  const match = clean(value).match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
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
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function dailyHours(value) {
  const text = clean(value).replace(/\bto\b/gi, '-');
  const ranges = [...text.matchAll(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*(Sun-Fri|Mon-Fri|Sat|Sun)?/gi)];
  if (ranges.length > 1 && ranges.some((match) => match[3])) {
    const daysByLabel = {
      'sun-fri': [0, 1, 2, 3, 4, 5],
      'mon-fri': [1, 2, 3, 4, 5],
      sat: [6],
      sun: [0],
    };
    const rows = [];
    for (const match of ranges) {
      const opening = parseClock(match[1]);
      const closing = parseClock(match[2]);
      const days = daysByLabel[clean(match[3]).toLowerCase()] ?? [];
      for (const day of days) {
        if (opening && closing) {
          rows.push({ Day: day, OpeningHour: opening, ClosingHour: closing });
        }
      }
    }
    if (new Set(rows.map((row) => row.Day)).size === 7) {
      return rows;
    }
  }

  const match = text.match(/Hours:\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);
  if (!match) {
    return [];
  }
  const opening = parseClock(match[1]);
  const closing = parseClock(match[2]);
  return opening && closing
    ? [1, 2, 3, 4, 5, 6, 0].map((day) => ({ Day: day, OpeningHour: opening, ClosingHour: closing }))
    : [];
}

const AIRPORT_NAMES = new Map([
  ['ATL', 'Hartsfield-Jackson Atlanta International Airport'],
  ['HND', 'Tokyo International Airport'],
]);

const CENTURION_POLICY_REGION_BY_AIRPORT = new Map([
  ['LHR', 'london'],
  ['HKG', 'hong-kong'],
  ['HND', 'tokyo'],
]);

const CENTURION_US_AIRPORTS = new Set([
  'ATL',
  'CLT',
  'DCA',
  'DEN',
  'DFW',
  'IAH',
  'JFK',
  'LAS',
  'LAX',
  'LGA',
  'MIA',
  'PHL',
  'PHX',
  'SEA',
  'SFO',
  'SLC',
]);

function guestFee({ amount, currency, label, url }) {
  return {
    type: 'guest_fee',
    label,
    amount: Number(amount),
    currency,
    sourceUrl: url,
  };
}

export function parseCenturionGuestPolicy(
  html,
  { url = 'https://www.thecenturionlounge.com/info/access/' } = {},
) {
  const text = stripHtml(html);
  if (
    !/guest policies apply to all Centurion Lounges located in the United States, London, Hong Kong, and Tokyo/i.test(text) ||
    !/including Sidecar by The Centurion/i.test(text)
  ) {
    return null;
  }

  const values = {
    usAdult: text.match(/\$([0-9]+) fee for each guest 18 and over at U\.S\. Centurion Lounges/i)?.[1],
    usChild: text.match(/\$([0-9]+) for children aged 2-17 at U\.S\. Centurion Lounges/i)?.[1],
    londonAdult: text.match(/£\s*([0-9]+)(?:[,.]00)? per guest at the London Centurion Lounge/i)?.[1],
    londonChild: text.match(/£\s*([0-9]+)(?:[,.]00)? per child at the London Centurion Lounge/i)?.[1],
    hongKongAdult: text.match(/HKD\s*([0-9,]+) per guest at the Hong Kong Centurion Lounge/i)?.[1],
    hongKongChild: text.match(/HKD\s*([0-9,]+) per child at the Hong Kong Centurion Lounge/i)?.[1],
    tokyoAdult: text.match(/JPY\s*([0-9,]+) per guest at the Tokyo Centurion Lounge/i)?.[1],
    tokyoChild: text.match(/JPY\s*([0-9,]+) per child at the Tokyo Centurion Lounge/i)?.[1],
  };
  if (Object.values(values).some((value) => !value)) {
    return null;
  }

  const amount = (value) => Number(String(value).replace(/,/g, ''));
  return {
    sourceUrl: url,
    offersByRegion: {
      us: [
        guestFee({ amount: amount(values.usAdult), currency: 'USD', label: 'Adult guest fee (18+)', url }),
        guestFee({ amount: amount(values.usChild), currency: 'USD', label: 'Child guest fee (ages 2-17)', url }),
      ],
      london: [
        guestFee({ amount: amount(values.londonAdult), currency: 'GBP', label: 'Adult guest fee (18+)', url }),
        guestFee({ amount: amount(values.londonChild), currency: 'GBP', label: 'Child guest fee (ages 2-17)', url }),
      ],
      'hong-kong': [
        guestFee({ amount: amount(values.hongKongAdult), currency: 'HKD', label: 'Adult guest fee (18+)', url }),
        guestFee({ amount: amount(values.hongKongChild), currency: 'HKD', label: 'Child guest fee (ages 2-17)', url }),
      ],
      tokyo: [
        guestFee({ amount: amount(values.tokyoAdult), currency: 'JPY', label: 'Adult guest fee (18+)', url }),
        guestFee({ amount: amount(values.tokyoChild), currency: 'JPY', label: 'Child guest fee (ages 2-17)', url }),
      ],
    },
  };
}

export function applyCenturionGuestPolicy(records, policy) {
  if (!policy?.offersByRegion) {
    return records;
  }

  return records.map((record) => {
    const region = CENTURION_POLICY_REGION_BY_AIRPORT.get(record.airportCode) ??
      (CENTURION_US_AIRPORTS.has(record.airportCode) ? 'us' : '');
    const prices = policy.offersByRegion[region] ?? [];
    if (prices.length === 0) {
      return record;
    }
    return {
      ...record,
      prices,
      accessNotes: clean(
        `${record.accessNotes} Official Centurion access policy publishes accompanied guest fees subject to card eligibility and space availability.`,
      ),
    };
  });
}

export function parseCenturionLoungeRecord(html, { url = '' } = {}) {
  const locationSlug = new URL(url || 'https://thecenturionlounge.com/locations/sea/').pathname.match(/\/locations\/([^/]+)\//i)?.[1]?.toLowerCase() ?? '';
  const airportCode = locationSlug.match(/^([a-z0-9]{3})(?:-|$)/i)?.[1]?.toUpperCase() ?? '';
  const isSidecar = locationSlug.endsWith('-sidecar');
  const parsedTitle = stripHtml(String(html ?? '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
  const title = !parsedTitle || /^Search$/i.test(parsedTitle) ? AIRPORT_NAMES.get(airportCode) ?? '' : parsedTitle;
  const terminalBlock = String(html ?? '').match(/<div[^>]*>\s*Terminal\s*<\/div>[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i)?.[1] ?? '';
  const terminalText = stripHtml(terminalBlock);
  const pageText = stripHtml(html);
  const positionPattern = /(?:Central\s+Terminal|Terminal\s+(?:[A-Z0-9]+|TBIT)|Concourses?\s+[A-Z](?:\s*&\s*[A-Z])?)/i;
  const terminal =
    terminalText.match(positionPattern)?.[0] ??
    pageText.match(positionPattern)?.[0] ??
    '';
  const visitText = clean(pageText.match(/\bFind\s*&\s*Visit\b([\s\S]*?)\bHours:/i)?.[1]);
  const directions =
    stripHtml(String(html ?? '').match(/<div[^>]*class="[^"]*tw-prose[^"]*"[^>]*>\s*<p>([\s\S]*?)<\/p>/i)?.[1]) ||
    clean(visitText.match(/(?:^|\.\s+)([^.]*\bLounge is (?:now open, )?located[^.]*\.)/i)?.[1]) ||
    clean(visitText.match(/(?:^|\.\s+)([^.]*\bSidecar by The Centurion[^.]*\.)/i)?.[1]) ||
    clean(pageText.match(/\b[^.]*\bLounge is (?:now open, )?located[^.]*\./i)?.[0]) ||
    visitText;
  const hoursText =
    stripHtml(String(html ?? '').match(/<p[^>]*>\s*(Hours:[\s\S]*?)<\/p>/i)?.[1]) ||
    clean(pageText.match(/\bHours:\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)\s*-\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)/i)?.[0]);
  const openHours = dailyHours(hoursText);
  if (!airportCode || !title || !terminal || !directions || openHours.length === 0) {
    return null;
  }
  return {
    sourceRecordId: `centurion-${locationSlug || airportCode.toLowerCase()}`,
    name: isSidecar ? 'Sidecar by The Centurion Lounge' : 'The American Express Centurion Lounge',
    brand: 'The Centurion Lounge',
    operator: 'American Express',
    airportCode,
    airportName: title,
    terminal,
    near: directions,
    openHours,
    programs: ['American Express Platinum', 'The Centurion Lounge'],
    amenities: { Lounge: true },
    accessNotes: 'Official Centurion Lounge location, directions, and operating hours.',
    sourceUrl: url,
  };
}
