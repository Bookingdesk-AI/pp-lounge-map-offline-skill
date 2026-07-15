function decodeEntities(value) {
  return String(value ?? '')
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#038;/g, '&')
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

function firstClassText(html, className) {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return stripHtml(
    String(html ?? '').match(new RegExp(`<div[^>]+class=["'][^"']*\\b${escaped}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/div>`, 'i'))?.[1],
  );
}

function terminalFromParts(terminal, near) {
  const explicit = clean(terminal);
  if (explicit && explicit !== '&nbsp;') {
    return /^terminal\b/i.test(explicit) ? explicit : `Terminal ${explicit}`;
  }
  return (
    clean(near).match(/\bConcourse\s+[A-Z0-9]+\b/i)?.[0] ||
    clean(near).match(/\bTerminal\s+[A-Z0-9]+\b/i)?.[0] ||
    ''
  );
}

function parseTime(value) {
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

function openHoursFromText(value) {
  const match = clean(value).match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);
  if (!match) {
    return [];
  }
  const opening = parseTime(match[1]);
  const closing = parseTime(match[2]);
  return opening && closing ? dailyHours(opening, closing) : [];
}

function summaryBlocks(html) {
  return [...String(html ?? '').matchAll(/<div\s+class=["']location["'][^>]*data-location-id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi)]
    .map((match) => ({
      id: clean(match[1]),
      html: match[0],
    }));
}

function detailBlocks(html) {
  return [...String(html ?? '').matchAll(/<div\s+class=["']location["']>\s*<div[^>]+class=["'][^"']*\blocation--details\b[^"']*["'][^>]*>([\s\S]*?<\/a>)\s*<\/div>/gi)]
    .map((match) => match[1]);
}

function locationLinks(html, baseUrl) {
  return [
    ...new Set(
      [...String(html ?? '').matchAll(/href=["']([^"']*\/location\/[^"']+)["']/gi)]
        .map((match) => absoluteUrl(match[1], baseUrl))
        .filter(Boolean),
    ),
  ];
}

const LINK_HINTS = [
  ['iad', 'IAD', 'between-gates-8-and-10'],
  ['pit', 'PIT', 'concourse-a-near-gate-a1'],
  ['dtw-airport-2-2', 'DTW', 'near-a17'],
  ['dtw-airport-9-2', 'DTW', 'between-gates-a63-and-a65'],
  ['jfk-airport-terminal-5', 'JFK', 'near-gate-7'],
  ['jfk-airport-terminal-8', 'JFK', 'near-gate-8'],
  ['chicago-midway', 'MDW', 'near-gate-1'],
  ['hou', 'HOU', 'near-gate-1'],
  ['laxt3', 'LAX', 'near-gate-30b'],
  ['laxt6', 'LAX', 'near-gate-65b'],
  ['clt', 'CLT', 'near-gate-36'],
  ['dfw-airport-terminal-b', 'DFW', 'near-gate-42'],
  ['dfw-airport-terminal-e', 'DFW', 'near-gate-16'],
];

function linkForSummary(summary, links) {
  const nearSlug = slugify(summary.near);
  const code = summary.airportCode;
  const hint = LINK_HINTS.find(([, hintCode, hintNear]) => hintCode === code && hintNear === nearSlug);
  if (!hint) {
    return '';
  }
  return links.find((link) => {
    try {
      return new URL(link).pathname.includes(`/location/${hint[0]}/`);
    } catch {
      return false;
    }
  }) ?? '';
}

function summaryRecord(block) {
  const airportName = firstClassText(block.html, 'location--left--airport');
  const code = firstClassText(block.html, 'location--left--location').toUpperCase();
  const hoursText = firstClassText(block.html, 'location--left--time');
  const terminalRaw = firstClassText(block.html, 'location--right--terminal');
  const near = firstClassText(block.html, 'location--right--location');
  if (!/^[A-Z0-9]{3}$/.test(code) || !airportName || !near) {
    return null;
  }
  const terminal = terminalFromParts(terminalRaw, near);
  return {
    key: `${code}|${slugify(near)}`,
    id: block.id,
    name: terminal ? `Gameway ${code} ${terminal}` : `Gameway ${code}`,
    brand: 'Gameway',
    operator: 'Gameway',
    airportCode: code,
    airportName,
    terminal,
    concourse: clean(near).match(/\bConcourse\s+[A-Z0-9]+\b/i)?.[0] || '',
    near,
    openHours: openHoursFromText(hoursText),
    accessNotes: 'Published terminal, gate, and hours from the official Gameway locations page.',
  };
}

function detailRecord(block, baseUrl) {
  const airportName = firstClassText(block, 'location--details--title');
  const code = firstClassText(block, 'location--details--airport').toUpperCase();
  const terminalRaw = firstClassText(block, 'location--details--terminal');
  const near = firstClassText(block, 'location--details--location').replace(/\bCOMING SOON\b/i, '').trim();
  const href = String(block).match(/<a\s+href=["']([^"']+)["'][^>]*class=["'][^"']*\blocation--details--button\b/i)?.[1];
  if (!/^[A-Z0-9]{3}$/.test(code) || !airportName || !near) {
    return null;
  }
  const terminal = terminalFromParts(terminalRaw, near);
  return {
    key: `${code}|${slugify(near)}`,
    airportCode: code,
    airportName,
    terminal,
    concourse: clean(near).match(/\bConcourse\s+[A-Z0-9]+\b/i)?.[0] || '',
    near,
    sourceUrl: absoluteUrl(href, baseUrl),
  };
}

function parsePriceFromDetail(html) {
  const prices = [];
  const regex = /<div[^>]+class=["'][^"']*\bprogress-bar--price\b[^"']*["'][^>]*>\s*\$([0-9]+)\s*(?:<sup>\.([0-9]{1,2})<\/sup>)?\s*<\/div>\s*<div[^>]+class=["'][^"']*\bprogress-bar--duration\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
  for (const match of String(html ?? '').matchAll(regex)) {
    const amount = Number(`${match[1]}.${match[2] ?? '00'}`);
    const duration = stripHtml(match[3]);
    if (Number.isFinite(amount) && amount > 0) {
      prices.push({
        amount,
        currencyCode: 'USD',
        duration,
      });
    }
  }
  return prices;
}

function parseAmenitiesFromDetail(html) {
  const amenities = [];
  for (const match of String(html ?? '').matchAll(/<div[^>]+class=["'][^"']*\btext-mobile-body\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi)) {
    const label = stripHtml(match[1]).toLowerCase();
    if (label.includes('headphone')) {
      amenities.push('Headsets');
    } else if (label.includes('gaming')) {
      amenities.push('Gaming stations');
    } else if (label.includes('clean')) {
      amenities.push('Cleaning protocols');
    } else if (label.includes('luggage')) {
      amenities.push('Luggage storage');
    } else if (label.includes('snack')) {
      amenities.push('Snacks');
    } else if (label.includes('drink')) {
      amenities.push('Drinks');
    }
  }
  return Object.fromEntries([...new Set(amenities)].map((amenity) => [amenity, true]));
}

export function parseGamewayStructuredRecords(html, { url = '' } = {}) {
  const summaries = summaryBlocks(html).map(summaryRecord).filter(Boolean);
  const details = new Map(detailBlocks(html).map((block) => detailRecord(block, url)).filter(Boolean).map((record) => [record.key, record]));
  const links = locationLinks(html, url);

  return summaries.map((summary, index) => {
    const detail = details.get(summary.key);
    const sourceUrl = detail?.sourceUrl || linkForSummary(summary, links) || links[index] || url;
    return {
      ...summary,
      sourceRecordId: `${summary.airportCode}-${slugify(summary.near)}-${summary.id || slugify(sourceUrl)}`,
      sourceUrl,
      terminal: summary.terminal || detail?.terminal || '',
      concourse: summary.concourse || detail?.concourse || '',
      amenities: {},
    };
  });
}

export function mergeGamewayDetailRecord(record, detailHtml) {
  const prices = parsePriceFromDetail(detailHtml);
  const amenities = parseAmenitiesFromDetail(detailHtml);
  return {
    ...record,
    price: prices[0] ? { amount: prices[0].amount, currencyCode: prices[0].currencyCode } : record.price,
    prices,
    amenities: Object.keys(amenities).length > 0 ? amenities : record.amenities,
    accessNotes: prices.length > 0
      ? 'Published terminal, gate, hours, amenities, and rate tiers from official Gameway pages.'
      : record.accessNotes,
  };
}
