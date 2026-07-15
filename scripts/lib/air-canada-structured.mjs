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
  return clean(String(value ?? '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' '));
}

function slugify(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

function extractChaseSection(html) {
  const start = String(html ?? '').search(/Chase Sapphire Reserve\/Reserve for Business/i);
  if (start < 0) {
    return '';
  }
  const remainder = String(html ?? '').slice(start);
  const end = remainder.search(/Please note:/i);
  return end >= 0 ? remainder.slice(0, end) : remainder;
}

function markedLines(sectionHtml) {
  return sectionHtml
    .replace(/<p>\s*<strong>([\s\S]*?)<\/strong>\s*<\/p>/gi, '\nREGION: $1\n')
    .replace(/<li>/gi, '\nITEM: ')
    .replace(/<\/li>/gi, '\n')
    .split(/\n/)
    .map(stripHtml)
    .filter(Boolean);
}

function regionCurrency(region, airportCode) {
  const code = clean(airportCode).toUpperCase();
  if (region === 'Canada') return 'CAD';
  if (region === 'United States') return 'USD';
  if (code === 'LHR') return 'GBP';
  if (region === 'Europe') return 'EUR';
  return '';
}

function terminalFromText(value) {
  return clean(value).match(/\bTerminal\s+[A-Z0-9]\b/i)?.[0] ?? '';
}

function concourseFromText(value) {
  return clean(value).match(/\b(?:Eastern|Western|Northern|Southern|North|South|East|West)\s+Concourse\b/i)?.[0] ?? '';
}

function normalizeName(value) {
  const text = clean(value)
    .replace(/\s*\(TEMPORARILY CLOSED\)\s*/gi, '')
    .replace(/\s*\(excludes Air Canada Signature Suite\)\s*/gi, '')
    .replace(/\s+and\s+Air Canada (?:Caf[eé]|Maple Leaf Lounge Express)\b.*$/i, '')
    .trim();
  if (/Aspire Air Canada Caf[eé]/i.test(text)) return 'Aspire Air Canada Café';
  if (/Air Canada Caf[eé]/i.test(text)) return 'Air Canada Café';
  if (/Air Canada Maple Leaf Lounge/i.test(text)) return 'Air Canada Maple Leaf Lounge';
  return text;
}

function recordForLine({ line, region, parentAirport, sourceUrl }) {
  const item = clean(line.replace(/^ITEM:\s*/i, ''));
  const direct = item.match(/^(.+?)\s+\(([A-Z0-9]{3})\)\s*(?:-\s*(.+))?$/);
  if (direct) {
    const airportCode = direct[2].toUpperCase();
    const detail = clean(direct[3]);
    if (!detail) {
      return {
        parentAirport: {
          city: clean(direct[1]),
          code: airportCode,
          region,
        },
      };
    }
    const terminal = terminalFromText(detail);
    const concourse = concourseFromText(detail);
    if (!terminal) {
      return {};
    }
    return {
      record: {
        sourceRecordId: `air-canada-${airportCode.toLowerCase()}-${slugify(detail)}`,
        name: normalizeName(detail),
        brand: /Caf[eé]/i.test(detail) ? 'Air Canada Café' : 'Air Canada Maple Leaf Lounge',
        operator: 'Air Canada',
        airportCode,
        airportCity: clean(direct[1]),
        terminal,
        concourse,
        near: clean([terminal, concourse].filter(Boolean).join(' ')),
        sourceUrl,
        status: /temporarily closed/i.test(detail) ? 'temporarily_closed' : 'active',
        programs: ['Air Canada', 'Star Alliance Gold', 'Premium cabin', 'Chase Sapphire Reserve'],
        accessNotes: 'Official Air Canada Chase Sapphire Reserve participating location and additional guest fee evidence.',
        prices: [{ amount: 59, currency: regionCurrency(region, airportCode) }],
        amenities: { Lounge: true },
      },
    };
  }

  if (!parentAirport) {
    return {};
  }

  const nested = item.match(/^(.+?)\s*-\s*(.+)$/);
  if (!nested) {
    return {};
  }
  const terminal = clean(nested[1])
    .replace(/^U\.S\.\s+departures$/i, 'Transborder departures')
    .replace(/\bdepartures\b/i, 'departures');
  const detail = clean(nested[2]);
  return {
    record: {
      sourceRecordId: `air-canada-${parentAirport.code.toLowerCase()}-${slugify(terminal)}-${slugify(detail)}`,
      name: normalizeName(detail),
      brand: /Caf[eé]/i.test(detail) ? 'Air Canada Café' : 'Air Canada Maple Leaf Lounge',
      operator: 'Air Canada',
      airportCode: parentAirport.code,
      airportCity: parentAirport.city,
      terminal,
      near: terminal,
      sourceUrl,
      status: 'active',
      programs: ['Air Canada', 'Star Alliance Gold', 'Premium cabin', 'Chase Sapphire Reserve'],
      accessNotes: 'Official Air Canada Chase Sapphire Reserve participating location and additional guest fee evidence.',
      prices: [{ amount: 59, currency: regionCurrency(parentAirport.region, parentAirport.code) }],
      amenities: { Lounge: true },
    },
  };
}

export function parseAirCanadaLoungeRecords(html, { url = '' } = {}) {
  const section = extractChaseSection(html);
  if (!section) {
    return [];
  }

  const records = [];
  let region = '';
  let parentAirport = null;

  for (const line of markedLines(section)) {
    const regionMatch = line.match(/^REGION:\s*(United States|Europe|Canada)\b/i);
    if (regionMatch) {
      region = clean(regionMatch[1]);
      parentAirport = null;
      continue;
    }

    if (!/^ITEM:/i.test(line)) {
      continue;
    }

    const parsed = recordForLine({
      line,
      region,
      parentAirport,
      sourceUrl: url,
    });
    if (parsed.parentAirport) {
      parentAirport = parsed.parentAirport;
      continue;
    }
    if (!parsed.record?.airportCode || !parsed.record?.name) {
      continue;
    }
    if (!parsed.record.prices?.[0]?.currency) {
      continue;
    }
    records.push(parsed.record);
  }

  return records;
}
