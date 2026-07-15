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

function toTwentyFourHour(value) {
  const normalized = clean(value).replace(/\./g, '').replace(/\s+/g, '');
  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/i);
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
  if (!Number.isFinite(hour) || hour > 23 || !Number.isFinite(minute) || minute > 59) {
    return '';
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

const DAY_ALIASES = new Map([
  ['sun', 0],
  ['sunday', 0],
  ['mon', 1],
  ['monday', 1],
  ['tue', 2],
  ['tues', 2],
  ['tuesday', 2],
  ['wed', 3],
  ['wednesday', 3],
  ['thu', 4],
  ['thur', 4],
  ['thurs', 4],
  ['thursday', 4],
  ['fri', 5],
  ['friday', 5],
  ['sat', 6],
  ['saturday', 6],
]);

function expandDays(value) {
  const normalized = clean(value).toLowerCase();
  if (!normalized || normalized === 'daily' || normalized === 'everyday') {
    return [0, 1, 2, 3, 4, 5, 6];
  }

  const range = normalized.match(/^([a-z]+)\s*-\s*([a-z]+)$/i);
  if (range) {
    const start = DAY_ALIASES.get(range[1]);
    const end = DAY_ALIASES.get(range[2]);
    if (start === undefined || end === undefined) {
      return [];
    }
    const days = [];
    for (let day = start; ; day = (day + 1) % 7) {
      days.push(day);
      if (day === end) break;
    }
    return days;
  }

  return normalized
    .split(/\s*,\s*|\s+and\s+/i)
    .map((day) => DAY_ALIASES.get(day))
    .filter((day) => day !== undefined);
}

function parseOpenHours(value) {
  const text = clean(value);
  const match = text.match(
    /^([A-Za-z,\s-]+):\s*(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))\s*(?:to|-)\s*(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))$/i,
  );
  if (!match) {
    return [];
  }

  const opening = toTwentyFourHour(match[2]);
  const closing = toTwentyFourHour(match[3]);
  if (!opening || !closing) {
    return [];
  }

  return expandDays(match[1]).map((day) => ({
    Day: day,
    OpeningHour: opening,
    ClosingHour: closing,
  }));
}

function cardBlocks(html) {
  const blocks = [];
  const regex = /<li><div class="card">([\s\S]*?)(?=<li><div class="card">|<\/ul>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/li>\s*<\/ul>|$)/gi;
  for (const match of String(html ?? '').matchAll(regex)) {
    const block = match[1];
    if (/<span class="list-subheading">/i.test(block) && /<ul class="lounge-list">/i.test(block)) {
      blocks.push(block);
    }
  }
  return blocks;
}

function airportFromCard(block) {
  const subheading = stripHtml(block.match(/<span class="list-subheading">([\s\S]*?)<\/span>/i)?.[1]);
  const heading = stripHtml(block.match(/<span class="list-heading">([\s\S]*?)<\/span>/i)?.[1]);
  const code = (subheading.match(/\(([A-Z0-9]{3})\)/)?.[1] ?? '').toUpperCase();
  return {
    airportCode: code,
    airportName: clean(subheading.replace(/\s*\([A-Z0-9]{3}\)\s*$/, '')),
    airportCity: heading,
  };
}

function loungeRows(block) {
  const list = block.match(/<ul class="lounge-list">([\s\S]*?)<\/ul>/i)?.[1] ?? '';
  return [...list.matchAll(/<li><div class="d-flex">([\s\S]*?)<\/div><\/li>/gi)].map((match) => match[1]);
}

function fieldHtml(row, className) {
  return row.match(new RegExp(`<p class="${className}">([\\s\\S]*?)<\\/p>`, 'i'))?.[1] ?? '';
}

function hoursFromRow(row) {
  return [...fieldHtml(row, 'hours').matchAll(/<span>([\s\S]*?)<\/span>/gi)]
    .flatMap((match) => parseOpenHours(stripHtml(match[1])));
}

function splitNameAndLocation(value) {
  const text = clean(value);
  const parts = text.split(/\s*,\s*/);
  const name = clean(parts.shift());
  return {
    name,
    rest: clean(parts.join(', ')),
  };
}

function terminalFromText(value) {
  const text = clean(value);
  return (
    text.match(/\bTerminal\s+[A-Z0-9](?:\/[A-Z0-9])?/i)?.[0] ||
    text.match(/\bConcourse\s+[A-Z0-9](?:\/[A-Z0-9])?/i)?.[0] ||
    text.match(/\bInternational terminal\b/i)?.[0] ||
    text.match(/\bMain Terminal\b/i)?.[0] ||
    ''
  );
}

function amenitiesFromRow(row) {
  const classNames = [...row.matchAll(/\bclumAmentiesGrayImg(\d+)\b/g)].map((match) => match[1]);
  const amenities = { Lounge: true };
  const mapping = {
    1: 'FoodBeverageSnackBuffet',
    2: 'WiFi',
    3: 'TV',
    4: 'Shower',
    5: 'BusinessCenter',
    6: 'WheelchairAccess',
    7: 'Restroom',
  };

  for (const className of classNames) {
    const key = mapping[className];
    if (key) {
      amenities[key] = true;
    }
  }
  return amenities;
}

function brandFromName(name) {
  const cleanName = clean(name);
  if (/Delta Sky Club/i.test(cleanName)) return 'Delta Sky Club';
  if (/SkyTeam/i.test(cleanName)) return 'SkyTeam Lounge';
  if (/KLM/i.test(cleanName)) return 'KLM Crown Lounge';
  if (/Air France/i.test(cleanName)) return 'Air France Lounge';
  if (/Korean Air/i.test(cleanName)) return 'Korean Air Lounge';
  if (/Escape/i.test(cleanName)) return 'Escape Lounges';
  if (/Virgin Australia/i.test(cleanName)) return 'Virgin Australia Lounge';
  if (/WestJet/i.test(cleanName)) return 'WestJet Elevation Lounge';
  if (/China Airlines/i.test(cleanName)) return 'China Airlines Lounge';
  return cleanName;
}

export function parseDeltaSkyClubRecords(html, { url = '' } = {}) {
  const records = [];

  for (const card of cardBlocks(html)) {
    const airport = airportFromCard(card);
    if (!/^[A-Z0-9]{3}$/.test(airport.airportCode)) {
      continue;
    }

    for (const row of loungeRows(card)) {
      const location = stripHtml(fieldHtml(row, 'location'));
      const status = stripHtml(fieldHtml(row, 'status'));
      const { name, rest } = splitNameAndLocation(location);
      const terminal = terminalFromText(rest);
      const openHours = hoursFromRow(row);
      if (!name || !terminal || openHours.length === 0) {
        continue;
      }

      records.push({
        sourceRecordId: `delta-${airport.airportCode.toLowerCase()}-${slugify(name)}-${slugify(rest)}`,
        name,
        brand: brandFromName(name),
        operator: brandFromName(name),
        airportCode: airport.airportCode,
        airportName: airport.airportName,
        airportCity: airport.airportCity,
        terminal,
        near: rest,
        sourceUrl: url,
        programs: ['Delta Sky Club', 'SkyTeam Elite Plus', 'Premium cabin'],
        openHours,
        amenities: amenitiesFromRow(row),
        accessNotes: clean([status, 'Published by the official Delta Sky Club locations page.'].filter(Boolean).join(' ')),
      });
    }
  }

  return records;
}
