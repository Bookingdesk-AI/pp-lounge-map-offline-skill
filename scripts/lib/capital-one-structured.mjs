function decodeEntities(value) {
  return String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&reg;|®/g, '')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&ndash;|&#8211;/gi, '-')
    .replace(/&mdash;|&#8212;/gi, '-')
    .replace(/[–—]/g, '-')
    .replace(/\u202f|\u00a0/g, ' ');
}

function clean(value) {
  return decodeEntities(value).replace(/\s+/g, ' ').trim();
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

function slugify(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

function terminalFromLocation(value) {
  const text = clean(value);
  const terminal =
    text.match(/\bTerminal\s+[A-Z0-9]\b/i)?.[0] ??
    text.match(/\bMain Terminal\b/i)?.[0] ??
    text.match(/\bConcourse\s+[A-Z]\b/i)?.[0] ??
    '';
  return clean(terminal);
}

function statusFromLocation(locationText) {
  return /scheduled\s+for\s+arrival/i.test(locationText) ? 'planned' : 'active';
}

const SECTION_PATTERNS = [
  {
    heading: 'Which airports have a Capital One Lounge?',
    stop: 'Which airports have a Capital One Landing?',
    brand: 'Capital One Lounge',
    name: 'Capital One Lounge',
    amenities: { Lounge: true, FoodBeverageHotBuffet: true, WiFi: true },
  },
  {
    heading: 'Which airports have a Capital One Landing?',
    stop: 'Capital One Lounge amenities',
    brand: 'Capital One Landing',
    name: 'Capital One Landing',
    amenities: { Restaurant: true, Lounge: true },
  },
];

function extractSection(text, heading, stop) {
  const start = text.search(new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  if (start < 0) {
    return '';
  }
  const remainder = text.slice(start + heading.length);
  const end = remainder.search(new RegExp(stop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  return end >= 0 ? remainder.slice(0, end) : remainder;
}

function recordsFromSection(sectionText, section, sourceUrl) {
  const records = [];
  const markerPattern =
    /\b(Dallas-Fort Worth|Denver|Washington Dulles|Las Vegas|New York City|Charlotte|Washington,\s*D\.C\.)\s*\((DFW|DEN|IAD|LAS|JFK|CLT|DCA|LGA)\)\s*:/g;
  const markers = [];
  let match;
  while ((match = markerPattern.exec(sectionText))) {
    markers.push({
      index: match.index,
      detailStart: markerPattern.lastIndex,
      city: clean(match[1]),
      airportCode: clean(match[2]).toUpperCase(),
    });
  }

  for (let index = 0; index < markers.length; index += 1) {
    const marker = markers[index];
    const next = markers[index + 1];
    const detail = clean(sectionText.slice(marker.detailStart, next?.index ?? sectionText.length));
    const status = statusFromLocation(detail);
    if (status !== 'active') {
      continue;
    }
    const [locationText, hoursTextRaw] = detail.split(/\bOpen\b/i);
    const location = clean(locationText).replace(/\.$/, '');
    const hoursText = hoursTextRaw ? `Open ${clean(hoursTextRaw).replace(/\.$/, '')}.` : '';
    const terminal = terminalFromLocation(location);
    if (!terminal || !hoursText) {
      continue;
    }

    records.push({
      sourceRecordId: `capital-one-${marker.airportCode.toLowerCase()}-${slugify(section.name)}`,
      name: section.name,
      brand: section.brand,
      operator: 'Capital One',
      airportCode: marker.airportCode,
      airportCity: marker.city,
      terminal,
      near: location,
      directions: location,
      hoursText,
      sourceUrl,
      status,
      programs: ['Capital One Venture X', 'Capital One Venture X Business'],
      accessNotes: 'Official Capital One Lounge and Landing location and hours evidence.',
      amenities: section.amenities,
    });
  }
  return records;
}

export function parseCapitalOneLoungeRecords(html, { url = '' } = {}) {
  const text = stripHtml(html);
  const records = [];
  for (const section of SECTION_PATTERNS) {
    records.push(...recordsFromSection(extractSection(text, section.heading, section.stop), section, url));
  }
  return records;
}
