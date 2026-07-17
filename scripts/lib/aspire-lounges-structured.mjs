function decodeEntities(value) {
  return String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&pound;/gi, '£')
    .replace(/&euro;/gi, '€')
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

function absoluteUrl(value, baseUrl) {
  try {
    return new URL(decodeEntities(value), baseUrl).toString();
  } catch {
    return '';
  }
}

export function parseAspireAirportLinks(html, { url = '' } = {}) {
  const links = new Set();
  for (const match of String(html ?? '').matchAll(/href=["']([^"']*\/airports\/[^"'#?]+\/?)["']/gi)) {
    const link = absoluteUrl(match[1], url);
    if (link && new URL(link).hostname.endsWith('aspirelounges.com')) {
      links.add(link);
    }
  }
  return [...links];
}

function loungeCardMatches(html) {
  const matches = [
    ...String(html ?? '').matchAll(
      /<h2\b[^>]*>\s*<a\b[^>]*href=["']([^"']*\/airport-lounges\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h2>/gi,
    ),
  ];
  return matches.map((match, index) => ({
    href: match[1],
    name: stripHtml(match[2]),
    html: String(html ?? '').slice(match.index, matches[index + 1]?.index ?? String(html ?? '').length),
  }));
}

function parseHours(cardHtml) {
  const schedules = [];
  const tables = [...cardHtml.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)];

  for (const table of tables) {
    const rows = [];
    for (const row of table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => stripHtml(cell[1]));
      const slots = [...(cells[1] ?? '').matchAll(/\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/g)].map((match) =>
        match[0].replace(/\s+/g, ''),
      );
      if (cells[0] && slots.length > 0) {
        rows.push(`${cells[0].slice(0, 3)} ${slots.join(',')}`);
      }
    }
    if (rows.length === 0) {
      continue;
    }

    const prefix = cardHtml.slice(0, table.index);
    const seasonMatches = [...prefix.matchAll(/activeSeason\s*==\s*`([^`]+)`/gi)];
    const defaultSeasonMatches = [...prefix.matchAll(/activeSeason:\s*`([^`]+)`/gi)];
    const season = clean(seasonMatches.at(-1)?.[1] ?? defaultSeasonMatches.at(-1)?.[1]);
    schedules.push(`${season ? `${season}: ` : ''}${rows.join('; ')}`);
  }

  return [...new Set(schedules)].join(' | ');
}

function parsePrice(cardHtml, sourceUrl, pageCurrency) {
  const text = stripHtml(cardHtml);
  const match = text.match(/Prices From\s*([£€$])\s*([\d,.]+)\s*per person/i);
  if (!match) {
    return null;
  }
  const currency = match[1] === '$' ? clean(pageCurrency).toUpperCase() : { '£': 'GBP', '€': 'EUR' }[match[1]];
  const amount = Number(match[2].replace(/,/g, ''));
  if (!/^[A-Z]{3}$/.test(currency) || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  return {
    amount,
    currency,
    label: 'Prices from per person',
    sourceUrl,
  };
}

function terminalAndGate(value) {
  const text = clean(value);
  const rawTerminal =
    text.match(/\b(?:North|South)\s+Terminal\b/i)?.[0] ?? text.match(/\bTerminal\s+[A-Z0-9]+\b/i)?.[0] ?? '';
  const terminal = rawTerminal.replace(/\b(?:north|south|terminal)\b/gi, (word) =>
    `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}`,
  );
  const numberedGate = text.match(/\bGate\s+[A-Z0-9]+\b/i)?.[0] ?? '';
  const gateZone = text.match(/\b([A-Z])\s+Gates\b/i)?.[1];
  const gate = numberedGate || (gateZone ? `${gateZone.toUpperCase()} Gates` : '');
  return { terminal, gate };
}

function productIdentity(name) {
  const text = clean(name);
  if (/luxe by aspire/i.test(text)) {
    return { brand: 'Luxe by Aspire', operator: 'Aspire Lounges' };
  }
  if (/suite by aspire/i.test(text)) {
    return { brand: 'Suite by Aspire', operator: 'Aspire Lounges' };
  }
  if (/\bmy lounge\b/i.test(text)) {
    return { brand: 'My Lounge', operator: 'No1 Lounges' };
  }
  if (/\bno\.?\s*1\b/i.test(text)) {
    return { brand: 'No1 Lounges', operator: 'No1 Lounges' };
  }
  if (/\bclub aspire\b/i.test(text)) {
    return { brand: 'Club Aspire', operator: 'Aspire Lounges' };
  }
  return { brand: 'Aspire Lounge', operator: 'Aspire Lounges' };
}

function collapseStayOfferVariants(records) {
  const variantsByBase = new Map();
  const variantIds = new Set();

  for (const record of records) {
    const match = record.name.match(/^(.*?)\s*\((\d+)\s*Hour Stay\)\s*$/i);
    if (!match || !record.price) {
      continue;
    }
    const key = `${record.airportCode}|${clean(match[1]).toLowerCase()}`;
    variantsByBase.set(key, [
      ...(variantsByBase.get(key) ?? []),
      {
        ...record.price,
        label: `${Number(match[2])}-hour stay`,
      },
    ]);
    variantIds.add(record.sourceRecordId);
  }

  return records
    .filter((record) => !variantIds.has(record.sourceRecordId))
    .map((record) => {
      const key = `${record.airportCode}|${clean(record.name).toLowerCase()}`;
      const variants = variantsByBase.get(key) ?? [];
      if (variants.length === 0) {
        return record;
      }
      const prices = [record.price, ...variants].filter(Boolean);
      const { price: _price, ...base } = record;
      return {
        ...base,
        prices,
      };
    });
}

export function parseAspireAirportRecords(html, { url = '' } = {}) {
  const heading = stripHtml(String(html ?? '').match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
  const airportCode = heading.match(/\(([A-Z0-9]{3})\)/)?.[1] ?? '';
  const airportCity = clean(heading.replace(/\s*\([A-Z0-9]{3}\)\s*$/, '').replace(/\s+Airport\s*$/i, ''));
  if (!airportCode) {
    return [];
  }
  const pageCurrency = clean(String(html ?? '').match(/display_currency:\s*["']([A-Z]{3})["']/i)?.[1]);

  const records = loungeCardMatches(html)
    .map((card) => {
      const sourceUrl = absoluteUrl(card.href, url);
      const position = terminalAndGate(`${card.name} ${decodeURIComponent(card.href).replace(/[-_/]+/g, ' ')}`);
      const identity = productIdentity(card.name);
      const price = parsePrice(card.html, sourceUrl, pageCurrency);
      const hoursText = parseHours(card.html);
      return {
        sourceRecordId: `aspire-${airportCode.toLowerCase()}-${slugify(card.name)}`,
        name: card.name,
        brand: identity.brand,
        operator: identity.operator,
        airportCode,
        airportCity,
        terminal: position.terminal || 'Unknown',
        near: clean([position.terminal, position.gate].filter(Boolean).join(', ')),
        hoursText,
        sourceUrl,
        status: 'active',
        programs: ['Aspire Lounges', 'Paid access'],
        accessNotes: 'Official Aspire airport page publishes lounge-level hours and pre-book pricing.',
        ...(price ? { price } : {}),
        amenities: { Lounge: true },
      };
    })
    .filter((record) => record.sourceUrl && (record.hoursText || record.price));

  return collapseStayOfferVariants(records);
}
