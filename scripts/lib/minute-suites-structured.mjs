function decodeEntities(value) {
  return String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, '-')
    .replace(/&mdash;|&#8212;/gi, '-')
    .replace(/[–—]/g, '-');
}

function clean(value) {
  return decodeEntities(value).replace(/\s+/g, ' ').trim();
}

function stripHtml(value) {
  return clean(
    String(value ?? '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
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

function sourceSlug(url) {
  try {
    return new URL(url).pathname.split('/').filter(Boolean).pop()?.toLowerCase() ?? '';
  } catch {
    return '';
  }
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

function allDayHours() {
  return [1, 2, 3, 4, 5, 6, 0].map((day) => ({
    Day: day,
    OpenAllDay: true,
  }));
}

function pageHours(text) {
  if (/\bopen\s+24\s+hours?\b|\b24\s+hours?\s+a\s+day\b/i.test(text)) {
    return allDayHours();
  }

  const match = text.match(/\bOpen daily\s+(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i);
  if (!match) {
    return [];
  }

  const opening = clock(match[1]);
  const closing = clock(match[2]);
  return opening && closing ? dailyHours(opening, closing) : [];
}

const LOCATION_PAGES = new Map([
  [
    'concourse-c',
    {
      airportCode: 'BWI',
      airportName: 'Baltimore/Washington International Thurgood Marshall Airport',
      locations: [{ terminal: 'Concourse C', near: 'Near Gate C3' }],
    },
  ],
  [
    'baltimore-washington-airport',
    {
      airportCode: 'BWI',
      airportName: 'Baltimore/Washington International Thurgood Marshall Airport',
      locations: [{ terminal: 'Concourse C', near: 'Near Gate C3' }],
    },
  ],
  [
    'charlotte-airport',
    {
      airportCode: 'CLT',
      airportName: 'Charlotte Douglas International Airport',
      locations: [
        { terminal: 'Main Atrium', near: 'Near the Food Court / Central Hub' },
        { terminal: 'D/E Connector', concourse: 'Concourses D & E', near: 'Between Concourses D & E' },
      ],
    },
  ],
  [
    'dallas-fort-worth-airport',
    {
      airportCode: 'DFW',
      airportName: 'Dallas/Fort Worth International Airport',
      locations: [
        { terminal: 'Terminal A', near: 'Near Gate A39' },
        { terminal: 'Terminal D', near: 'Near Gate D23' },
      ],
    },
  ],
  [
    'jfk-airport',
    {
      airportCode: 'JFK',
      airportName: 'John F. Kennedy International Airport',
      locations: [
        { terminal: 'Terminal 4', near: 'Near Gate B39' },
        { terminal: 'Terminal 8', concourse: 'Concourse C', near: 'Near Gate C37' },
      ],
    },
  ],
  [
    'concourse-d',
    {
      airportCode: 'BNA',
      airportName: 'Nashville International Airport',
      locations: [{ terminal: 'Concourse D', near: 'Near Gate D3' }],
    },
  ],
  [
    'nashville-airport',
    {
      airportCode: 'BNA',
      airportName: 'Nashville International Airport',
      locations: [{ terminal: 'Concourse D', near: 'Near Gate D3' }],
    },
  ],
]);

function pageConfirmsLocation(text, location) {
  const terminal = clean(location.terminal).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const near = clean(location.near)
    .replace(/^Near\s+/i, '')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(terminal, 'i').test(text) && new RegExp(near, 'i').test(text);
}

export function parseMinuteSuitesStructuredRecords(html, { url = '' } = {}) {
  const slug = sourceSlug(url);
  const page = LOCATION_PAGES.get(slug);
  if (!page) {
    return [];
  }

  const text = stripHtml(html);
  const openHours = pageHours(text);
  if (openHours.length === 0) {
    return [];
  }

  const amenities = {
    Lounge: true,
    Rest: true,
    'Wi-Fi': /Wi-?Fi/i.test(text),
    TV: /\bTV\b|Smart TV/i.test(text),
    Workstation: /workspace|desk|workstation/i.test(text),
    Showers: /shower/i.test(text),
  };

  return page.locations
    .filter((location) => pageConfirmsLocation(text, location))
    .map((location) => ({
      sourceRecordId: `minute-suites-${page.airportCode.toLowerCase()}-${slugify(location.terminal)}-${slugify(location.near)}`,
      name: `Minute Suites ${page.airportCode} ${location.terminal}`,
      brand: 'Minute Suites',
      operator: 'Minute Suites',
      airportCode: page.airportCode,
      airportName: page.airportName,
      terminal: location.terminal,
      concourse: location.concourse ?? '',
      near: location.near,
      sourceUrl: url,
      programs: ['Minute Suites', 'Priority Pass'],
      openHours,
      price: {
        amount: 40,
        currencyCode: 'USD',
        url: 'https://minutesuites.com/priority-pass/',
      },
      amenities,
      accessNotes: 'Official Minute Suites location page with terminal, gate-area, suite amenities, and operating hours. Official Minute Suites Priority Pass page publishes additional hours from USD 40.',
    }));
}
