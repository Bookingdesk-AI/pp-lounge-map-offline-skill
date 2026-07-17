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

function stripHtmlLines(value) {
  return decodeEntities(
    String(value ?? '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:p|div|h[1-6]|li)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .split(/\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
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

function tabLabels(html) {
  const labels = new Map();
  const tabPattern = /<([a-z0-9]+)\b([^>]*\brole=["']tab["'][^>]*)>([\s\S]*?)<\/\1>/gi;
  for (const match of String(html ?? '').matchAll(tabPattern)) {
    const id = match[2].match(/\bid=["']([^"']+)["']/i)?.[1];
    if (id) {
      labels.set(id, stripHtml(match[3]));
    }
  }
  return labels;
}

function panelSlices(html) {
  const text = String(html ?? '');
  const starts = [...text.matchAll(/<section\b[^>]*\brole=["']tabpanel["'][^>]*>/gi)];
  return starts.map((match, index) => text.slice(match.index, starts[index + 1]?.index ?? text.length));
}

function detailTerminal(label, location) {
  const mode = clean(label);
  if (/^transborder$/i.test(mode)) return 'Transborder departures';
  if (/^caf[eé]|domestic caf[eé]s?$/i.test(mode)) return 'Domestic departures';
  if (/^international$/i.test(mode)) return 'International departures';
  if (/^domestic$/i.test(mode)) return 'Domestic departures';

  const explicitTerminal = terminalFromText(location);
  if (explicitTerminal) {
    return explicitTerminal;
  }

  const text = clean(`${label} ${location}`);
  if (/transborder|u\.s\./i.test(text)) return 'Transborder departures';
  if (/caf[eé]/i.test(text) && /domestic/i.test(text)) return 'Domestic departures';
  if (/international/i.test(text)) return 'International departures';
  if (/domestic/i.test(text)) return 'Domestic departures';
  return clean(location);
}

function terminalFamily(value) {
  const text = clean(value);
  if (/transborder|u\.s\./i.test(text)) return 'transborder';
  if (/international/i.test(text)) return 'international';
  if (/domestic/i.test(text)) return 'domestic';
  return terminalFromText(text).toLowerCase();
}

export function parseAirCanadaLoungeDetailRecords(
  html,
  { airportCode = '', airportCity = '', url = '' } = {},
) {
  const code = clean(airportCode).toUpperCase();
  if (!/^[A-Z0-9]{3}$/.test(code)) {
    return [];
  }

  const renderedHtml = String(html ?? '').replace(/<!--[\s\S]*?-->/g, '');
  const labels = tabLabels(renderedHtml);
  const records = [];

  for (const panel of panelSlices(renderedHtml)) {
    const labelledBy = panel.match(/\baria-labelledby=["']([^"']+)["']/i)?.[1] ?? '';
    const label = labels.get(labelledBy) ?? '';
    const headings = [...panel.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map((match) => stripHtml(match[1]));
    const location = headings[1] ?? '';
    const hoursSection = panel.match(/<section\b[^>]*class=["'][^"']*\bhours\b[^"']*["'][^>]*>([\s\S]*?)<\/section>/i)?.[1];
    const hoursText = stripHtmlLines(hoursSection).replace(/^Hours of operation:\s*/i, '').trim();
    if (!location || !hoursText) {
      continue;
    }

    const name = /caf[eé]/i.test(`${label} ${panel}`) ? 'Air Canada Café' : 'Air Canada Maple Leaf Lounge';
    const terminal = detailTerminal(label, location);
    records.push({
      sourceRecordId: `air-canada-${code.toLowerCase()}-${slugify(label || terminal)}-details`,
      name,
      brand: name,
      operator: 'Air Canada',
      airportCode: code,
      airportCity: clean(airportCity),
      terminal,
      near: location,
      hoursText,
      sourceUrl: url,
      status: 'active',
    });
  }

  return records;
}

export function mergeAirCanadaLoungeDetailRecords(records, details) {
  return records.map((record) => {
    const detail = details.find(
      (candidate) =>
        candidate.airportCode === record.airportCode &&
        candidate.name === record.name &&
        terminalFamily(candidate.terminal) === terminalFamily(record.terminal),
    );
    if (!detail) {
      return record;
    }

    const priceSourceUrl = record.sourceUrl;
    return {
      ...record,
      near: detail.near || record.near,
      hoursText: detail.hoursText,
      sourceUrl: detail.sourceUrl || record.sourceUrl,
      prices: (record.prices ?? []).map((price) => ({
        ...price,
        label: price.label || 'Additional guest fee',
        sourceUrl: price.sourceUrl || priceSourceUrl,
      })),
    };
  });
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
        prices: [
          {
            amount: 59,
            currency: regionCurrency(region, airportCode),
            label: 'Additional guest fee',
            sourceUrl,
          },
        ],
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
      prices: [
        {
          amount: 59,
          currency: regionCurrency(parentAirport.region, parentAirport.code),
          label: 'Additional guest fee',
          sourceUrl,
        },
      ],
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
