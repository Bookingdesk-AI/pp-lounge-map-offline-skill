import {
  createDeskTravelBrandImport,
  getBrandRegistry,
  resolveBrandAsset,
} from './brand-registry.mjs';
import { applyOfficialAirlineHoursEvidence } from './official-airline-hours-evidence.mjs';
import { CANONICAL_SCHEMA_FIELDS, LOUNGE_GURU_SCHEMA_VERSION, cloneSourceRegistry } from './source-registry.mjs';

const COMPLETE_FIELD_WEIGHTS = [
  ['name', 10],
  ['airportCode', 10],
  ['airportName', 8],
  ['country', 8],
  ['city', 8],
  ['terminal', 7],
  ['openingHours', 10],
  ['location', 8],
  ['facilities', 12],
  ['conditions', 7],
  ['url', 7],
  ['coordinates', 5],
];

const OFFICIAL_PRICE_SOURCE_IDS = new Set([
  'airport-official-pages',
  'airport-dimensions',
  'aspire-lounges',
  'escape-lounges',
  'no1-lounges',
  'marhaba',
  'minute-suites',
  'gameway',
  'sleepover',
  'primeclass',
  'plaza-premium',
  'capital-one',
  'chase-sapphire',
  'air-canada',
  'american',
  'alaska-airlines',
]);

const OFFICIAL_LOCATION_SOURCE_IDS = new Set([
  'airport-official-pages',
  'airport-dimensions',
  'aspire-lounges',
  'escape-lounges',
  'no1-lounges',
  'marhaba',
  'minute-suites',
  'gameway',
  'sleepover',
  'primeclass',
  'be-relax',
  'capital-one',
  'american',
  'delta',
  'air-canada',
  'alaska-airlines',
  'amex-global-lounge-collection',
  'qantas',
  'qatar-airways',
  'singapore-airlines',
]);

const RECOGNIZED_LOUNGE_FAMILIES = [
  'plaza premium',
  'the club',
  'clubrooms',
  'club aspire',
  'aspire',
  'escape lounge',
  'no1 lounge',
  'marhaba',
  'primeclass',
  'be relax',
  'gameway',
  'minute suites',
  'sleepover',
  'capital one',
  'chase sapphire',
  'centurion',
  'maple leaf',
  'air canada',
  'admirals club',
  'alaska lounge',
  'british airways',
  'cathay pacific',
  'delta sky club',
  'emirates lounge',
  'jal sakura',
  'japan airlines sakura',
  'latam vip',
  'oman air',
  'qantas',
  'qatar airways',
  'silverkris',
  'singapore airlines',
  'skyteam',
  'turkish airlines',
];

function clean(value) {
  return String(value ?? '').trim();
}

function cleanList(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(clean).filter(Boolean))];
}

function hasValue(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return clean(value) !== '' && clean(value) !== 'Unknown';
}

function inferBrand(name) {
  const normalized = clean(name);
  const lower = normalized.toLowerCase();
  const knownBrands = [
    ['Plaza Premium', 'Plaza Premium'],
    ['Primeclass', 'Primeclass'],
    ['Marhaba', 'Marhaba'],
    ['Be Relax', 'Be Relax'],
    ['Aspire', 'Aspire'],
    ['Escape', 'Escape Lounges'],
    ['Sapphire', 'Chase Sapphire Lounge'],
    ['Centurion', 'American Express Centurion Lounge'],
    ['Capital One', 'Capital One Lounge'],
    ['The Club', 'The Club'],
    ['United Club', 'United Club'],
    ['Polaris', 'United Polaris Lounge'],
    ['Sky Club', 'Delta Sky Club'],
    ['Admirals Club', 'American Airlines Admirals Club'],
    ['Maple Leaf', 'Air Canada Maple Leaf Lounge'],
    ['Alaska Lounge', 'Alaska Lounge'],
    ['British Airways', 'British Airways Lounge'],
    ['Cathay Pacific', 'Cathay Pacific Lounge'],
    ['Emirates', 'Emirates Lounge'],
    ['JAL Sakura', 'Japan Airlines Sakura Lounge'],
    ['Oman Air', 'Oman Air Lounge'],
    ['Qantas', 'Qantas Lounge'],
    ['Qatar Airways', 'Qatar Airways Lounge'],
    ['SilverKris', 'Singapore Airlines SilverKris Lounge'],
    ['SkyTeam', 'SkyTeam Lounge'],
    ['Turkish Airlines', 'Turkish Airlines Lounge'],
  ];

  const match = knownBrands.find(([needle]) => lower.includes(needle.toLowerCase()));
  return match ? match[1] : normalized;
}

function inferOperator(name, sourceId = 'priority-pass') {
  const brand = inferBrand(name);
  if (brand === clean(name)) {
    return sourceId === 'priority-pass' ? 'Priority Pass partner' : brand;
  }
  return brand;
}

function inferCategory(type) {
  const normalized = clean(type).toUpperCase();
  if (normalized === 'EAT') {
    return 'dining';
  }
  if (normalized === 'REST') {
    return 'rest';
  }
  if (normalized === 'REFRESH') {
    return 'spa';
  }
  if (normalized === 'UNWIND') {
    return 'experience';
  }
  return 'lounge';
}

function inferPrograms(sourceId) {
  if (sourceId === 'priority-pass') {
    return ['Priority Pass'];
  }
  return [];
}

function inferAccessMethods(sourceId) {
  if (sourceId === 'priority-pass') {
    return ['membership'];
  }
  return ['review'];
}

function getCoordinates(record) {
  if (Array.isArray(record.geometry?.coordinates)) {
    const [lon, lat] = record.geometry.coordinates;
    return { lat: Number(lat), lon: Number(lon) };
  }

  return {
    lat: Number(record.lat),
    lon: Number(record.lon),
  };
}

function hasAirportNormalization(properties, coordinates) {
  return Boolean(
    clean(properties.airportCode) &&
      clean(properties.airportName) &&
      clean(properties.city) &&
      clean(properties.country) &&
      Number.isFinite(coordinates.lat) &&
      Number.isFinite(coordinates.lon),
  );
}

function latestIsoDate(values, fallback) {
  const latest = values
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .reduce((current, date) => (date.getTime() > current.getTime() ? date : current), new Date(0));

  return latest.getTime() > 0 ? latest.toISOString() : fallback;
}

function latestRetrievedAtForSource(records, sourceId, fallback) {
  return latestIsoDate(
    records.flatMap((record) =>
      (record.sources ?? [])
        .filter((source) => source.sourceId === sourceId)
        .map((source) => source.retrievedAt),
    ),
    fallback,
  );
}

function createOurAirportsSource(properties, coordinates, retrievedAt) {
  if (!hasAirportNormalization(properties, coordinates)) {
    return null;
  }

  return {
    sourceId: 'ourairports',
    publisher: 'OurAirports',
    url: 'https://ourairports.com/data/',
    retrievedAt,
    fieldCoverage: [
      'airport.iata',
      'airport.name',
      'airport.city',
      'airport.country',
      'airport.coordinates',
    ],
    confidence: 0.9,
    rightsNote: 'Open airport reference data; used for airport identity and coordinate normalization only.',
  };
}

function splitNotes(value) {
  return clean(value)
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^note:/i.test(line) || /^important note:/i.test(line));
}

function currencyCodeFromToken(value) {
  const token = clean(value).toUpperCase();
  const map = {
    A: 'AUD',
    AU: 'AUD',
    A$: 'AUD',
    AUD: 'AUD',
    AED: 'AED',
    BD: 'BHD',
    BHD: 'BHD',
    BRL: 'BRL',
    CAD: 'CAD',
    CA: 'CAD',
    CA$: 'CAD',
    CHF: 'CHF',
    CNY: 'CNY',
    CZK: 'CZK',
    DKK: 'DKK',
    EUR: 'EUR',
    GBP: 'GBP',
    HK: 'HKD',
    HKD: 'HKD',
    IDR: 'IDR',
    INR: 'INR',
    ISK: 'ISK',
    JPY: 'JPY',
    KRW: 'KRW',
    MYR: 'MYR',
    NOK: 'NOK',
    NZD: 'NZD',
    PLN: 'PLN',
    SEK: 'SEK',
    SGD: 'SGD',
    THB: 'THB',
    TRY: 'TRY',
    US: 'USD',
    USD: 'USD',
    ZAR: 'ZAR',
  };
  return map[token.replace(/\$/g, '')] ?? '';
}

function pushAccessOffer(offers, { amount, currency, sourceId, url, retrievedAt, label = '' }) {
  const normalizedAmount = Number(String(amount ?? '').replace(/[^0-9.]+/g, ''));
  const normalizedCurrency = currencyCodeFromToken(currency);
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0 || !normalizedCurrency) {
    return;
  }

  const offer = {
    type: 'access_credit',
    label: clean(label) || `${normalizedCurrency} ${normalizedAmount.toFixed(2).replace(/\.00$/, '')} credit`,
    amount: normalizedAmount,
    currency: normalizedCurrency,
    sourceId,
    url,
    retrievedAt,
  };
  const key = `${offer.type}|${offer.currency}|${offer.amount}|${offer.sourceId}|${offer.url}`;
  if (!offers.some((existing) => `${existing.type}|${existing.currency}|${existing.amount}|${existing.sourceId}|${existing.url}` === key)) {
    offers.push(offer);
  }
}

function accessOffersFromConditions(properties, { sourceId, url, retrievedAt }) {
  const offers = [];
  const text = [
    ...(Array.isArray(properties.conditions) ? cleanList(properties.conditions) : [clean(properties.conditions)]),
    clean(properties.openingHours),
  ]
    .map((value) => clean(value).replace(/\b(?:for example|e\.g\.)\b.*$/i, '').trim())
    .filter(Boolean)
    .join(' ');
  if (!text) {
    return offers;
  }

  const currencyPattern =
    'AUD|A\\$|AED|BD|BHD|BRL|CA\\$|CAD|CHF|CNY|CZK|DKK|EUR|GBP|HKD|IDR|INR|ISK|JPY|KRW|MYR|NOK|NZD|PLN|SEK|SGD|THB|TRY|US|USD|ZAR';
  const amountPattern = String.raw`([0-9][0-9,]*(?:\.[0-9]{1,2})?)`;
  const contextualPatterns = [
    new RegExp(
      String.raw`\b(?:receive|deducted?|valid|value|worth|off\s+the\s+bill|offer\s+value|treatment|option)\b[^.]{0,120}?\b(${currencyPattern})\$?\s*${amountPattern}\b`,
      'gi',
    ),
    new RegExp(
      String.raw`\b(${currencyPattern})\$?\s*${amountPattern}\s*(?:off\s+(?:the\s+)?bill|deduction|credit|value|worth|reduction)\b`,
      'gi',
    ),
    new RegExp(
      String.raw`\b(${currencyPattern})\$?\s*${amountPattern}\b[^.]{0,80}?\b(?:off\s+(?:the\s+)?(?:bill|total)|deduction|credit|value|worth|reduction)\b`,
      'gi',
    ),
    new RegExp(
      String.raw`\b(?:discounted|preferential|exclusive|additional|upgrade|published)?\s*(?:rate|fee|charge)\s+of\s+(${currencyPattern})\$?\s*${amountPattern}\b`,
      'gi',
    ),
    new RegExp(
      String.raw`\b(?:at|for|with)\s+(?:a\s+)?(?:discounted|preferential|exclusive|additional|upgrade)?\s*(?:rate|fee|charge)\s+of\s+(${currencyPattern})\$?\s*${amountPattern}\b`,
      'gi',
    ),
    /\b(?:receive|deducted?|valid|value|worth|off\s+the\s+bill|offer\s+value|treatment)\b[^.]{0,100}?([€£])\s*([0-9]+(?:\.[0-9]{1,2})?)\b/gi,
    /([€£])\s*([0-9]+(?:\.[0-9]{1,2})?)\s+(?:off\s+(?:the(?:ir)?\s+)?bill|deduction|credit|value|reduction)\b/gi,
  ];

  for (const pattern of contextualPatterns) {
    for (const match of text.matchAll(pattern)) {
      const currency = match[1] === '€' ? 'EUR' : match[1] === '£' ? 'GBP' : match[1];
      pushAccessOffer(offers, {
        amount: match[2],
        currency,
        sourceId,
        url,
        retrievedAt,
      });
    }
  }

  return offers;
}

function normalizeGateValue(value) {
  const gate = clean(value)
    .replace(/\bgates?\b/gi, '')
    .replace(/\bboarding\b/gi, '')
    .replace(/\bnumber\b/gi, '')
    .replace(/\bno\.?\b/gi, '')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s*&\s*/g, ' & ')
    .replace(/\s+and\s+/gi, ' & ')
    .replace(/\s+to\s+/gi, '-')
    .replace(/\s*[-–—]\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

  if (!gate) {
    return '';
  }

  const hasExactGate = /(?:[A-Z]\s*-?\s*)?\d/.test(gate);
  const hasGateArea = /^[A-Z](?:\/[A-Z])+$/i.test(gate);
  if (!hasExactGate && !hasGateArea) {
    return '';
  }

  const plural = gate.includes('/') || gate.includes('&') || /\d[A-Z]?\s*-\s*(?:[A-Z]\s*)?\d/i.test(gate);
  return `${plural ? 'Gates' : 'Gate'} ${gate}`;
}

function titleArea(value) {
  return clean(value)
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function normalizeNamedPosition(prefix, value, reverse = false) {
  const area = clean(value);
  if (!area || !/^[A-Z0-9][\w\s/-]*$/i.test(area)) {
    return '';
  }

  const normalizedArea = titleArea(area).replace(/\bT(\d)\b/i, 'T$1');
  return reverse ? `${normalizedArea} ${prefix}` : `${prefix} ${normalizedArea}`;
}

function extractNamedPositionEvidence(properties) {
  const text = clean([properties.name, properties.terminal, properties.location].filter(Boolean).join(' '));
  if (!text) {
    return '';
  }

  const patterns = [
    {
      pattern: /\b(north|south|east|west)\s+satellite\b/i,
      format: (match) => normalizeNamedPosition('Satellite', match[1]),
    },
    {
      pattern: /\bsatellite\s+(terminal|\d+|[A-Z]|north|south|east|west|building)\b/i,
      format: (match) => normalizeNamedPosition('Satellite', match[1]),
    },
    {
      pattern: /\bterminal\s+\d+\s*\(\s*satellite\s*\)/i,
      format: () => 'Satellite',
    },
    {
      pattern: /\b(international|domestic|contact|schengen|south|north|east|west)\s+pier\b/i,
      format: (match) => normalizeNamedPosition('Pier', match[1], true),
    },
    {
      pattern: /\bpier\s+(sul|norte|north|south|east|west)\b/i,
      format: (match) => normalizeNamedPosition('Pier', match[1]),
    },
    {
      pattern: /\bpier\s+([A-Z0-9])\b/i,
      format: (match) => normalizeNamedPosition('Pier', match[1]),
    },
    {
      pattern: /\b([A-Z])[-\s]+pier\b/i,
      format: (match) => normalizeNamedPosition('Pier', match[1]),
    },
    {
      pattern: /\b([A-Z])\s+pier\b/i,
      format: (match) => normalizeNamedPosition('Pier', match[1]),
    },
    {
      pattern: /\b(north|south|east|west)\s+node\b/i,
      format: (match) => normalizeNamedPosition('Node', match[1]),
    },
    {
      pattern: /\bzone\s+([A-Z][0-9]?)\b/i,
      format: (match) => normalizeNamedPosition('Zone', match[1]),
    },
    {
      pattern: /\bconcourses?\s+([A-Z0-9](?:\s*(?:\/|-|&|and)\s*[A-Z0-9])*)\b/i,
      format: (match) => normalizeNamedPosition(/[/&-]|\band\b/i.test(match[1]) ? 'Concourses' : 'Concourse', match[1]),
    },
    {
      pattern: /\bterminal\s+(\d+)\s+concourse\b/i,
      format: (match) => `Terminal ${match[1]} Concourse`,
    },
    {
      pattern: /\b([A-Z])\s+concourse\b/i,
      format: (match) => normalizeNamedPosition('Concourse', match[1]),
    },
    {
      pattern: /\bdepartures?\s+hall\s+([A-Z0-9]+)\b/i,
      format: (match) => normalizeNamedPosition('Departure Hall', match[1]),
    },
    {
      pattern: /\bhall\s+([A-Z0-9]+)\b/i,
      format: (match) => normalizeNamedPosition('Hall', match[1]),
    },
    {
      pattern: /\bmain\s+departures?\s+area\b/i,
      format: () => 'Main Departures Area',
    },
    {
      pattern: /\b(?:opposite|near|by|beside|at)\s+(?:the\s+)?([A-Z][A-Za-z0-9&.' -]{2,40}?)\s+check-?in\s+counter\b/i,
      format: (match) => normalizeNamedPosition('Check-in', match[1]),
    },
    {
      pattern: /\bmezzanine\s+level\b/i,
      format: () => 'Mezzanine Level',
    },
    {
      pattern: /\bupper\s+floor\b/i,
      format: () => 'Upper Floor',
    },
    {
      pattern: /\binternational\s+departures?\b/i,
      format: () => 'International Departures',
    },
    {
      pattern: /\bdomestic\s+departures?\b/i,
      format: () => 'Domestic Departures',
    },
    {
      pattern: /\bdeparture\s+transit\s+area\b/i,
      format: () => 'Departure Transit Area',
    },
    {
      pattern: /\bdeparture\s+lounge\b/i,
      format: () => 'Departure Lounge',
    },
    {
      pattern: /\b(?:International\s+&\s+)?Non-Schengen\s+(?:Area|Zone)s?\b/i,
      format: (match) => (/\bZone\b/i.test(match[0]) ? 'Non-Schengen Zone' : 'Non-Schengen Area'),
    },
    {
      pattern: /\bNon-Schengen\b[^,.;]{0,40}\bZone\b|\bZone\b[^,.;]{0,40}\bNon-Schengen\b/i,
      format: () => 'Non-Schengen Zone',
    },
    {
      pattern: /\bNon-Schengen\b/i,
      format: () => 'Non-Schengen Area',
    },
    {
      pattern: /\bSchengen\s+(?:Area|Zone)s?\b/i,
      format: (match) => (/\bZone\b/i.test(match[0]) ? 'Schengen Zone' : 'Schengen Area'),
    },
    {
      pattern: /\bSchengen\b/i,
      format: () => 'Schengen Area',
    },
    {
      pattern: /\bVIP\s+Area\s+([A-Z]?\d+[A-Z]?)\b/i,
      format: (match) => normalizeNamedPosition('VIP Area', match[1]),
    },
    {
      pattern: /\b(?:first|1st)\s+floor\b/i,
      format: () => 'Level 1',
    },
    {
      pattern: /\b(?:second|2nd)\s+floor\b/i,
      format: () => 'Level 2',
    },
    {
      pattern: /\b(?:third|3rd)\s+floor\b/i,
      format: () => 'Level 3',
    },
    {
      pattern: /\blevel\s+([1-9]\d?)\b/i,
      format: (match) => `Level ${match[1]}`,
    },
    {
      pattern: /\bfloor\s+([1-9]\d?)\b/i,
      format: (match) => `Level ${match[1]}`,
    },
    {
      pattern: /\b(?:duty\s*free|duty-free)\s+(?:area|shops?|lounges?)\b/i,
      format: () => 'Duty Free Area',
    },
    {
      pattern: /\bfood\s*court\b/i,
      format: () => 'Food Court',
    },
    {
      pattern: /\b(north|south|east|west)\s+wing\b/i,
      format: (match) => normalizeNamedPosition('Wing', match[1], true),
    },
    {
      pattern: /\bmain\s+lobby\b/i,
      format: () => 'Main Lobby',
    },
    {
      pattern: /\blandside\b/i,
      format: () => 'Landside Area',
    },
  ];

  for (const { pattern, format } of patterns) {
    const match = text.match(pattern);
    const position = match ? format(match) : '';
    if (position) {
      return position;
    }
  }

  return '';
}

export function extractGateEvidence(properties) {
  const name = clean(properties.name);
  const location = clean(properties.location);
  const openingHours = clean(properties.openingHours);
  const candidates = [
    ...[...name.matchAll(/\(([^)]*\bgates?\b[^)]*)\)/gi)].map((match) => match[1]),
    name,
    location,
    openingHours,
  ].filter(Boolean);

  const gateTokenPattern = String.raw`(?:[A-Z]?\s*-?\s*\d+[A-Z]?|[A-Z](?:\s*\/\s*[A-Z])+)`;
  const gateValuePattern = String.raw`(${gateTokenPattern}(?:\s*(?:-|to|and|&|\/)\s*(?:gates?\s*)?(?:[A-Z]?\s*-?\s*\d+[A-Z]?|[A-Z]))*)`;
  const prefixedGatePattern = new RegExp(String.raw`\b(?:by|near|opposite|at|beside|between|towards?|located\s+at|located\s+near)?\s*(?:boarding\s+)?gates?\s*(?:number|no\.?)?\s*${gateValuePattern}\b`, 'i');
  const suffixedGatePattern = new RegExp(String.raw`\b${gateValuePattern}\s*(?:boarding\s+)?gates?\b`, 'i');

  for (const candidate of candidates) {
    const prefixed = candidate.match(prefixedGatePattern);
    const gate = normalizeGateValue(prefixed?.[1] ?? '');
    if (gate) {
      return gate;
    }

    const suffixed = candidate.match(suffixedGatePattern);
    const suffixedGate = normalizeGateValue(suffixed?.[1] ?? '');
    if (suffixedGate) {
      return suffixedGate;
    }
  }

  return extractNamedPositionEvidence(properties);
}

export function calculateCompleteness(properties, coordinates = getCoordinates(properties)) {
  const total = COMPLETE_FIELD_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);
  let score = 0;

  for (const [field, weight] of COMPLETE_FIELD_WEIGHTS) {
    if (field === 'coordinates') {
      if (Number.isFinite(coordinates.lat) && Number.isFinite(coordinates.lon)) {
        score += weight;
      }
      continue;
    }

    if (hasValue(properties[field])) {
      score += weight;
    }
  }

  return Math.round((score / total) * 100);
}

export function calculateFreshness(retrievedAt, freshnessDays = 30, now = new Date()) {
  const retrievedDate = new Date(retrievedAt);
  if (Number.isNaN(retrievedDate.getTime())) {
    return 0;
  }

  const ageDays = Math.max(0, (now.getTime() - retrievedDate.getTime()) / 86_400_000);
  return Math.max(0, Math.min(100, Math.round(100 - (ageDays / freshnessDays) * 100)));
}

export function findQualityConflicts(properties) {
  const conflicts = [];
  if (!hasValue(properties.openingHours)) {
    conflicts.push('missing_hours');
  }
  if (!hasValue(properties.url)) {
    conflicts.push('missing_source_url');
  }
  if (!hasValue(properties.facilities)) {
    conflicts.push('missing_amenities');
  }
  if (clean(properties.terminal) === 'Unknown') {
    conflicts.push('unknown_terminal');
  }
  return conflicts;
}

export function createCanonicalRecord(feature, options = {}) {
  const properties = feature.properties ?? feature;
  const sourceId = options.sourceId ?? properties.sourceId ?? 'priority-pass';
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const sourceRetrievedAt = clean(properties.sourceRetrievedAt) || generatedAt;
  const coordinates = getCoordinates(feature);
  const inferredBrand = clean(properties.provider) || inferBrand(properties.name);
  const brandAsset = resolveBrandAsset(inferredBrand, properties.name, sourceId);
  const source = {
    sourceId,
    publisher: options.publisher ?? 'Priority Pass',
    url: clean(properties.url) || 'https://www.prioritypass.com/en-GB/airport-lounges',
    retrievedAt: sourceRetrievedAt,
    fieldCoverage: [
      'lounge.name',
      'airport.iata',
      'airport.name',
      'location.terminal',
      'operations.hours',
      'amenities',
      'restrictions',
    ],
    confidence: sourceId === 'priority-pass' ? 0.86 : 0.7,
    rightsNote:
      options.rightsNote ??
      'Imported from the approved Priority Pass source workbook and linked official public record.',
  };

  const conflicts = findQualityConflicts(properties);
  const completeness = calculateCompleteness(properties, coordinates);
  const freshness = calculateFreshness(generatedAt, 30);
  const reviewStatus = conflicts.length > 0 || completeness < 60 ? 'review' : 'approved';
  const notes = splitNotes(properties.openingHours);
  const airportSource = createOurAirportsSource(properties, coordinates, generatedAt);
  const gate = extractGateEvidence(properties);
  const accessOffers = accessOffersFromConditions(properties, {
    sourceId,
    url: source.url,
    retrievedAt: sourceRetrievedAt,
  });
  if (gate) {
    source.fieldCoverage.push('location.gate');
  }
  if (accessOffers.length > 0) {
    source.fieldCoverage.push('access.accessOffers');
  }

  return {
    lounge: {
      id: clean(properties.id),
      name: clean(properties.name),
      brand: inferredBrand,
      brandAsset,
      operator: inferOperator(properties.name, sourceId),
      category: inferCategory(properties.type),
      status: 'active',
      programs: cleanList(properties.programs).length > 0 ? cleanList(properties.programs) : inferPrograms(sourceId),
      accessMethods:
        cleanList(properties.accessMethods).length > 0
          ? cleanList(properties.accessMethods)
          : inferAccessMethods(sourceId),
    },
    airport: {
      iata: clean(properties.airportCode).toUpperCase(),
      icao: '',
      name: clean(properties.airportName),
      city: clean(properties.city),
      country: clean(properties.country),
      timezone: '',
      coordinates,
    },
    location: {
      terminal: clean(properties.terminal) || 'Unknown',
      concourse: '',
      gate,
      securitySide: '',
      directions: clean(properties.location),
    },
    operations: {
      hours: clean(properties.openingHours),
      exceptions: cleanList(properties.conditions).filter((condition) => /closed|restricted|renovation|season/i.test(condition)),
      plannedOpening: '',
      lastVerifiedAt: generatedAt,
    },
    accessOffers,
    amenities: cleanList(properties.facilities),
    restrictions: cleanList(properties.conditions),
    guestPolicy: cleanList(properties.conditions).find((condition) => /guest|children|cardholder/i.test(condition)) ?? '',
    notes,
    sources: airportSource ? [source, airportSource] : [source],
    quality: {
      completeness,
      freshness,
      conflicts,
      reviewStatus,
    },
  };
}

export function createSourceRegistryForCatalog(features, generatedAt, records = [], options = {}) {
  const registry = cloneSourceRegistry();
  const priorityPassGeneratedAt = options.priorityPassGeneratedAt ?? generatedAt;
  const deskTravelBrandDb = registry.find((source) => source.id === 'desk-travel-brand-database');
  if (deskTravelBrandDb) {
    deskTravelBrandDb.records = getBrandRegistry().length;
    deskTravelBrandDb.lastRunAt = generatedAt;
  }

  const priorityPass = registry.find((source) => source.id === 'priority-pass');
  if (priorityPass) {
    priorityPass.records = records.filter((record) =>
      record.sources.some((source) => source.sourceId === 'priority-pass'),
    ).length;
    priorityPass.lastRunAt = priorityPassGeneratedAt;
    priorityPass.issues = features.filter((feature) => findQualityConflicts(feature.properties ?? feature).length > 0).length;
  }

  for (const source of registry) {
    if (['desk-travel-brand-database', 'priority-pass', 'ourairports'].includes(source.id)) {
      continue;
    }
    const sourceRecords = records.filter((record) => record.sources.some((item) => item.sourceId === source.id));
    if (sourceRecords.length > 0) {
      source.records = sourceRecords.length;
      source.lastRunAt = latestRetrievedAtForSource(sourceRecords, source.id, generatedAt);
      source.issues = sourceRecords.filter((record) => record.quality.reviewStatus !== 'approved').length;
    }
  }

  const ourAirports = registry.find((source) => source.id === 'ourairports');
  if (ourAirports) {
    ourAirports.records = new Set(features.map((feature) => clean((feature.properties ?? feature).airportCode))).size;
    ourAirports.lastRunAt = latestRetrievedAtForSource(records, 'ourairports', priorityPassGeneratedAt);
  }

  return registry;
}

export function summarizeQuality(canonicalRecords) {
  const count = canonicalRecords.length || 1;
  const completeness = canonicalRecords.reduce((sum, record) => sum + record.quality.completeness, 0);
  const freshness = canonicalRecords.reduce((sum, record) => sum + record.quality.freshness, 0);
  const conflictCount = canonicalRecords.reduce((sum, record) => sum + record.quality.conflicts.length, 0);
  const reviewQueue = canonicalRecords.filter((record) => record.quality.reviewStatus !== 'approved').length;

  return {
    averageCompleteness: Math.round(completeness / count),
    averageFreshness: Math.round(freshness / count),
    conflictCount,
    reviewQueue,
  };
}

export function createSchemaMetadata() {
  return {
    version: LOUNGE_GURU_SCHEMA_VERSION,
    fields: CANONICAL_SCHEMA_FIELDS,
  };
}

function normalizeIdentityText(value) {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[-–—]\s*[a-z0-9]{3}$/i, '')
    .replace(/\bescape lounges?\b/g, 'escape lounge')
    .replace(/\bgameway\s+[a-z0-9]{3}\b/g, 'gameway')
    .replace(/\bby the club\b/g, '')
    .replace(/\bwith etihad airways\b/g, '')
    .replace(/\bby airport dimensions\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeKey(record) {
  const airportCode = clean(record.airport.iata).toUpperCase();
  const brandId = clean(record.lounge.brandAsset?.id) || normalizeIdentityText(record.lounge.brand);
  const name = normalizeIdentityText(record.lounge.name);
  return `${airportCode}|${brandId}|${name}`;
}

function hasKnownTerminal(record) {
  return hasValue(record.location.terminal);
}

function normalizeTerminalText(value) {
  return normalizeIdentityText(value).replace(/^terminal\s+/, '');
}

function isLowDetailSourceOverlap(record) {
  const sourceIds = new Set(record.sources.map((source) => source.sourceId));
  return (
    !sourceIds.has('priority-pass') ||
    record.quality.conflicts.includes('airport_code_only') ||
    record.quality.conflicts.includes('missing_hours') ||
    !hasKnownTerminal(record)
  );
}

function canMergeCanonicalRecords(first, second) {
  const qantasAllianceConflict = isQantasAllianceLocationConflictDuplicate(first, second);
  const publishedFamilyMatch = samePublishedGateFamilyIdentity(first, second);
  if (
    dedupeKey(first) !== dedupeKey(second) &&
    !samePhysicalLoungeIdentity(first, second) &&
    !qantasAllianceConflict
  ) {
    return false;
  }
  if (
    !publishedGatesCompatible(first.location.gate, second.location.gate) &&
    !publishedFamilyMatch &&
    !qantasAllianceConflict
  ) {
    return false;
  }
  if (!publishedConcoursesCompatible(first, second) && !qantasAllianceConflict) {
    return false;
  }
  if (
    terminalPositionScopesConflict(first.location.terminal, second.location.gate) ||
    terminalPositionScopesConflict(second.location.terminal, first.location.gate)
  ) {
    return false;
  }
  if (!hasKnownTerminal(first) || !hasKnownTerminal(second)) {
    return true;
  }
  if (normalizeTerminalText(first.location.terminal) === normalizeTerminalText(second.location.terminal)) {
    return true;
  }
  if (sameNumberedLoungeIdentity(first, second) && priceEvidenceTerminalsCompatible(first.location.terminal, second.location.terminal)) {
    return true;
  }
  return sameQatarOperatedLoungeIdentity(first, second) && qatarOperatedLocationCompatible(first, second);
}

function gateIdentityTokens(value) {
  return new Set([...clean(value).toUpperCase().matchAll(/\b[A-Z]?\d+[A-Z]?\b/g)].map((match) => match[0]));
}

function isGeneralPositionEvidence(value) {
  const text = clean(value);
  if (!text) {
    return false;
  }
  if (/^Gates?\s+[A-Z]?\d+[A-Z]?(?:\s*(?:&|-)\s*[A-Z]?\d+[A-Z]?)*$/i.test(text)) {
    return false;
  }
  return /\b(?:level|mezzanine|lounge|concourse|connector|pier|satellite|terminal|area)\b/i.test(text);
}

function directionalPositionTokens(value) {
  return new Set([...normalizeIdentityText(value).matchAll(/\b(?:east|west|north|south)\b/g)].map((match) => match[0]));
}

function namedPositionTypeTokens(value) {
  return new Set(
    [...normalizeIdentityText(value).matchAll(/\b(?:concourse|wing|pier|satellite|node)\b/g)].map((match) => match[0]),
  );
}

function scopePositionTokens(value) {
  return new Set([...normalizeIdentityText(value).matchAll(/\b(?:domestic|international|transborder)\b/g)].map((match) => match[0]));
}

function recordSourcePathTails(record) {
  return record.sources.map((source) => {
    try {
      return new URL(source.url).pathname.split('/').filter(Boolean).pop() ?? '';
    } catch {
      return '';
    }
  });
}

function publishedMovementTokens(record) {
  const text = normalizeIdentityText(
    [
      record.lounge.name,
      record.location.terminal,
      record.location.gate,
      record.location.directions,
      ...recordSourcePathTails(record),
    ].join(' '),
  ).replace(/\binternational airport\b/g, 'airport');
  const tokens = new Set();
  if (/\barrivals?\b|\bintarr\b/.test(text)) tokens.add('arrival');
  if (/\bdepartures?\b|\bintdep\b|\bdomdep\b|\bafter (?:security|passport)\b|\bboarding\b/.test(text)) {
    tokens.add('departure');
  }
  return tokens;
}

function priceEvidenceMovementCompatible(first, second) {
  return !hasConflictingTokenSet(publishedMovementTokens(first), publishedMovementTokens(second));
}

function terminalPositionScopesConflict(terminal, position) {
  return hasConflictingTokenSet(scopePositionTokens(terminal), scopePositionTokens(position));
}

function publishedGateZoneTokens(value) {
  return new Set([...clean(value).matchAll(/\b([A-Z])\s+Gates?\b/gi)].map((match) => match[1].toUpperCase()));
}

function publishedGatesCompatible(first, second) {
  if (!hasValue(first) || !hasValue(second)) {
    return true;
  }
  if (clean(first).toLowerCase() === clean(second).toLowerCase()) {
    return true;
  }
  if (hasConflictingTokenSet(scopePositionTokens(first), scopePositionTokens(second))) {
    return false;
  }
  if (hasConflictingTokenSet(directionalPositionTokens(first), directionalPositionTokens(second))) {
    return false;
  }
  if (hasConflictingTokenSet(namedPositionTypeTokens(first), namedPositionTypeTokens(second))) {
    return false;
  }
  if (hasConflictingTokenSet(publishedGateZoneTokens(first), publishedGateZoneTokens(second))) {
    return false;
  }
  if (isGeneralPositionEvidence(first) || isGeneralPositionEvidence(second)) {
    return true;
  }

  const firstTokens = gateIdentityTokens(first);
  const secondTokens = gateIdentityTokens(second);
  if (firstTokens.size === 0 || secondTokens.size === 0) {
    return true;
  }
  return [...firstTokens].some((token) => secondTokens.has(token));
}

function publishedGateNumberTokens(value) {
  return new Set([...clean(value).matchAll(/\b(?:[A-Z])?(\d+)[A-Z]?\b/gi)].map((match) => match[1]));
}

function publishedGatePrefixTokens(value) {
  return new Set([...clean(value).matchAll(/\b(?:Gates?\s+)?([A-Z])\d+[A-Z]?\b/gi)].map((match) => match[1].toUpperCase()));
}

function exactTerminalGateNumbersCompatible(first, second) {
  if (!enrichmentTerminalsCompatible(first.location.terminal, second.location.terminal)) {
    return false;
  }

  const firstNumbers = publishedGateNumberTokens(first.location.gate);
  const secondNumbers = publishedGateNumberTokens(second.location.gate);
  if (firstNumbers.size === 0 || secondNumbers.size === 0 || ![...firstNumbers].some((number) => secondNumbers.has(number))) {
    return false;
  }

  const firstPrefixes = publishedGatePrefixTokens(first.location.gate);
  const secondPrefixes = publishedGatePrefixTokens(second.location.gate);
  return !hasConflictingTokenSet(firstPrefixes, secondPrefixes);
}

function recordDetailScore(record) {
  return [
    hasValue(record.operations.hours) ? 40 : 0,
    hasKnownTerminal(record) ? 24 : 0,
    hasValue(record.location.directions) ? 14 : 0,
    record.amenities.length > 0 ? 10 : 0,
    record.restrictions.length > 0 ? 8 : 0,
    record.sources.some((source) => source.sourceId === 'priority-pass') ? 4 : 0,
    record.quality.completeness,
  ].reduce((sum, value) => sum + value, 0);
}

function pickValue(first, second) {
  return hasValue(first) ? first : second;
}

function mergeUniqueBySourceId(sources) {
  const bySourceId = new Map();
  for (const source of sources) {
    const key = `${source.sourceId}|${clean(source.url)}`;
    const existing = bySourceId.get(key);
    if (!existing) {
      bySourceId.set(key, source);
      continue;
    }

    bySourceId.set(key, {
      ...existing,
      ...source,
      fieldCoverage: cleanList([...(existing.fieldCoverage ?? []), ...(source.fieldCoverage ?? [])]),
      confidence: Math.max(Number(existing.confidence ?? 0), Number(source.confidence ?? 0)),
      retrievedAt: latestIsoDate([existing.retrievedAt, source.retrievedAt], existing.retrievedAt),
    });
  }

  const priority = new Map([
    ['chase-sapphire', 0],
    ['amex-global-lounge-collection', 0],
    ['capital-one', 0],
    ['united', 0],
    ['delta', 0],
    ['american', 0],
    ['air-canada', 0],
    ['oneworld', 0],
    ['priority-pass', 1],
    ['ourairports', 2],
  ]);

  return [...bySourceId.values()].sort(
    (first, second) =>
      (priority.get(first.sourceId) ?? 1) - (priority.get(second.sourceId) ?? 1) ||
      first.publisher.localeCompare(second.publisher),
  );
}

function sourceWithFieldCoverage(source, fields) {
  if (!source) {
    return null;
  }
  const alwaysKeep = new Set(['lounge.name', 'airport.iata', 'airport.name', 'location.terminal']);
  const allowed = new Set([...alwaysKeep, ...fields]);
  return {
    ...source,
    fieldCoverage: (source.fieldCoverage ?? []).filter((field) => allowed.has(field)),
  };
}

function mergeAccessOffers(offers) {
  const byKey = new Map();
  for (const offer of offers ?? []) {
    const key = [
      clean(offer.type),
      clean(offer.currency),
      offer.amount ?? '',
      clean(offer.label),
      clean(offer.sourceId),
      clean(offer.url),
    ].join('|');
    if (!byKey.has(key)) {
      byKey.set(key, offer);
    }
  }
  return [...byKey.values()];
}

function hasSourceFieldCoverage(record, field) {
  return (record.sources ?? []).some((source) => (source.fieldCoverage ?? []).includes(field));
}

function hasSourceForAccessOffer(record, offer) {
  const offerSourceId = clean(offer?.sourceId);
  const offerUrl = clean(offer?.url);
  return (record.sources ?? []).some((source) => {
    if (source.sourceId !== offerSourceId || !(source.fieldCoverage ?? []).includes('access.accessOffers')) {
      return false;
    }
    const sourceUrl = clean(source.url);
    return !offerUrl || !sourceUrl || sourceUrl === offerUrl;
  });
}

function pruneUnprovenPromotedFields(record) {
  const accessOffers = (record.accessOffers ?? []).filter((offer) => hasSourceForAccessOffer(record, offer));
  const removedAccessOffer = accessOffers.length !== (record.accessOffers ?? []).length;
  const removeHours = hasValue(record.operations?.hours) && !hasSourceFieldCoverage(record, 'operations.hours');
  const removeGate = hasValue(record.location?.gate) && !hasSourceFieldCoverage(record, 'location.gate');

  if (!removeHours && !removeGate && !removedAccessOffer) {
    return record;
  }

  return {
    ...record,
    location: {
      ...record.location,
      gate: removeGate ? '' : record.location.gate,
    },
    operations: {
      ...record.operations,
      hours: removeHours ? '' : record.operations.hours,
    },
    accessOffers,
    notes: cleanList([...record.notes, 'Removed promoted field values without matching source provenance.']),
  };
}

function normalizeTerminalForEnrichment(value) {
  return normalizeIdentityText(value)
    .replace(/\\?u0026/g, ' and ')
    .replace(/\bt\s*([0-9])\b/g, 'terminal $1')
    .replace(/^terminal\s+/, '')
    .replace(/\b(?:international|departure|departures|main)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasDomesticScope(value) {
  return /\bdomestic\b/i.test(clean(value));
}

function terminalNumberTokens(value) {
  return new Set([...clean(value).matchAll(/\b[0-9]+\b/g)].map((match) => match[0]));
}

function terminalLetterTokens(value) {
  const tokens = new Set([...clean(value).matchAll(/\bTerminal\s+([A-Z])\b/gi)].map((match) => match[1].toUpperCase()));
  const normalized = normalizeTerminalForEnrichment(value).toUpperCase();
  if (/^[A-Z]$/.test(normalized)) {
    tokens.add(normalized);
  }
  return tokens;
}

function concourseTokens(value) {
  const tokens = new Set();
  const text = clean(value);
  for (const match of text.matchAll(/\bConcourses?\s+([A-Z0-9](?:\s*(?:,|\/|-|&|and)\s*[A-Z0-9])*)\b/gi)) {
    for (const token of match[1].split(/\s*(?:,|\/|-|&|and)\s*/i)) {
      if (/^[A-Z0-9]$/i.test(token)) {
        tokens.add(token.toUpperCase());
      }
    }
  }
  return tokens;
}

function publishedConcoursesCompatible(first, second) {
  const firstConcourses = concourseTokens(
    [first.location.terminal, first.location.concourse, first.location.gate, first.location.directions].join(' '),
  );
  const secondConcourses = concourseTokens(
    [second.location.terminal, second.location.concourse, second.location.gate, second.location.directions].join(' '),
  );
  return !hasConflictingTokenSet(firstConcourses, secondConcourses);
}

function enrichmentTerminalsCompatible(first, second) {
  if (!hasValue(first) || !hasValue(second)) {
    return false;
  }
  const firstTerminal = normalizeTerminalForEnrichment(first);
  const secondTerminal = normalizeTerminalForEnrichment(second);
  if (!firstTerminal || !secondTerminal) {
    return false;
  }
  if (hasDomesticScope(first) !== hasDomesticScope(second) && (hasDomesticScope(first) || hasDomesticScope(second))) {
    return false;
  }
  const firstConcourses = concourseTokens(firstTerminal);
  const secondConcourses = concourseTokens(secondTerminal);
  if (
    firstConcourses.size > 0 &&
    secondConcourses.size > 0 &&
    ![...firstConcourses].some((concourse) => secondConcourses.has(concourse))
  ) {
    return false;
  }
  const firstNumbers = terminalNumberTokens(firstTerminal);
  const secondNumbers = terminalNumberTokens(secondTerminal);
  if (firstNumbers.size > 0 && secondNumbers.size > 0) {
    return [...firstNumbers].some((number) => secondNumbers.has(number));
  }
  return firstTerminal === secondTerminal || firstTerminal.includes(secondTerminal) || secondTerminal.includes(firstTerminal);
}

function hasInternationalScope(value) {
  return /\binternational\b/i.test(clean(value));
}

function hasConflictingScope(first, second) {
  const firstDomestic = hasDomesticScope(first);
  const secondDomestic = hasDomesticScope(second);
  if ((firstDomestic || secondDomestic) && firstDomestic !== secondDomestic) {
    return true;
  }

  const firstInternational = hasInternationalScope(first);
  const secondInternational = hasInternationalScope(second);
  return (firstInternational || secondInternational) && firstInternational !== secondInternational && (firstDomestic || secondDomestic);
}

function hasConflictingTokenSet(firstTokens, secondTokens) {
  return (
    firstTokens.size > 0 &&
    secondTokens.size > 0 &&
    ![...firstTokens].some((token) => secondTokens.has(token))
  );
}

function isGenericTerminalForPriceEvidence(value) {
  const terminal = normalizeTerminalForEnrichment(value);
  if (!terminal || /^(?:unknown|terminal|main terminal|main departures area|departures area|airport|terminal with)$/i.test(terminal)) {
    return true;
  }
  return terminal.length < 4 && terminalNumberTokens(terminal).size === 0 && terminalLetterTokens(value).size === 0;
}

function isGenericTerminalForAllianceEvidence(value) {
  const text = clean(value);
  const terminal = normalizeTerminalForEnrichment(text);
  return (
    !terminal ||
    /^(?:unknown|terminal|main terminal|main|international|passenger terminal|hia)$/i.test(text) ||
    terminal === 'terminal'
  );
}

function allianceEvidenceTerminalsCompatible(first, second) {
  if (enrichmentTerminalsCompatible(first, second)) {
    return true;
  }
  if (hasConflictingScope(first, second)) {
    return false;
  }
  if (!isGenericTerminalForAllianceEvidence(first) && !isGenericTerminalForAllianceEvidence(second)) {
    return false;
  }

  const firstTerminal = normalizeTerminalForEnrichment(first);
  const secondTerminal = normalizeTerminalForEnrichment(second);
  return (
    !hasConflictingTokenSet(terminalNumberTokens(firstTerminal), terminalNumberTokens(secondTerminal)) &&
    !hasConflictingTokenSet(terminalLetterTokens(first), terminalLetterTokens(second)) &&
    !hasConflictingTokenSet(concourseTokens(firstTerminal), concourseTokens(secondTerminal))
  );
}

function priceEvidenceTerminalsCompatible(first, second) {
  if (enrichmentTerminalsCompatible(first, second)) {
    return true;
  }

  const firstTerminal = normalizeTerminalForEnrichment(first);
  const secondTerminal = normalizeTerminalForEnrichment(second);
  if (
    hasConflictingTokenSet(terminalNumberTokens(firstTerminal), terminalNumberTokens(secondTerminal)) ||
    hasConflictingTokenSet(terminalLetterTokens(first), terminalLetterTokens(second)) ||
    hasConflictingTokenSet(concourseTokens(firstTerminal), concourseTokens(secondTerminal))
  ) {
    return false;
  }

  const firstNumbers = terminalNumberTokens(firstTerminal);
  const secondNumbers = terminalNumberTokens(secondTerminal);
  const sameNumberedTerminal =
    firstNumbers.size > 0 && secondNumbers.size > 0 && [...firstNumbers].some((number) => secondNumbers.has(number));
  if (sameNumberedTerminal && !hasInternationalScope(first) && !hasInternationalScope(second)) {
    return true;
  }

  if (hasConflictingScope(first, second)) {
    return false;
  }

  return isGenericTerminalForPriceEvidence(first) || isGenericTerminalForPriceEvidence(second);
}

function singleDistinctValue(records, getter, serializer = (value) => clean(value)) {
  const byValue = new Map();
  for (const record of records) {
    const value = getter(record);
    if (!hasValue(value)) {
      continue;
    }
    const key = serializer(value);
    if (key && !byValue.has(key)) {
      byValue.set(key, value);
    }
  }
  return byValue.size === 1 ? [...byValue.values()][0] : null;
}

function recognizedFamiliesForRecord(record, { includeBrandAsset = true, includeOperator = false } = {}) {
  const text = normalizeIdentityText(
    [
      record.lounge.name,
      record.lounge.brand,
      includeBrandAsset ? record.lounge.brandAsset?.id : '',
      includeOperator ? record.lounge.operator : '',
    ].join(' '),
  );
  const compactText = text.replace(/\s+/g, '');
  return new Set(
    RECOGNIZED_LOUNGE_FAMILIES.filter((family) => {
      const compactFamily = family.replace(/\s+/g, '');
      return text.includes(family) || compactText.includes(compactFamily);
    }),
  );
}

function isJapanAirlinesSakuraRecord(record) {
  const text = normalizeIdentityText([record.lounge.name, record.lounge.brand, record.lounge.operator].join(' '));
  return text.includes('japan airlines') && text.includes('sakura');
}

function sameLoungeFamily(first, second) {
  if (isJapanAirlinesSakuraRecord(first) && isJapanAirlinesSakuraRecord(second)) {
    return true;
  }

  const firstProductFamilies = recognizedFamiliesForRecord(first);
  const secondProductFamilies = recognizedFamiliesForRecord(second);
  if (firstProductFamilies.size > 0 || secondProductFamilies.size > 0) {
    return [...firstProductFamilies].some((family) => secondProductFamilies.has(family));
  }

  const firstFamilies = recognizedFamiliesForRecord(first, { includeOperator: true });
  const secondFamilies = recognizedFamiliesForRecord(second, { includeOperator: true });
  return [...firstFamilies].some((family) => secondFamilies.has(family));
}

function samePublishedGateFamilyIdentity(first, second) {
  const firstFamilies = recognizedFamiliesForRecord(first, { includeBrandAsset: false, includeOperator: true });
  const secondFamilies = recognizedFamiliesForRecord(second, { includeBrandAsset: false, includeOperator: true });
  return (
    firstFamilies.has('admirals club') &&
    secondFamilies.has('admirals club') &&
    exactTerminalGateNumbersCompatible(first, second)
  );
}

function samePriceEvidenceLoungeFamily(first, second) {
  if (sameExactLoungeIdentity(first, second) || samePhysicalNameIdentity(first, second)) {
    return true;
  }

  const firstAspireProduct = aspireProductIdentity(first);
  const secondAspireProduct = aspireProductIdentity(second);
  if ((firstAspireProduct || secondAspireProduct) && firstAspireProduct !== secondAspireProduct) {
    return false;
  }

  const genericNetworkFamilies = new Set(['plaza premium', 'aspire', 'no1 lounge']);
  const firstFamilies = recognizedFamiliesForRecord(first, { includeBrandAsset: false, includeOperator: true });
  const secondFamilies = recognizedFamiliesForRecord(second, { includeBrandAsset: false, includeOperator: true });
  return [...firstFamilies].some((family) => !genericNetworkFamilies.has(family) && secondFamilies.has(family));
}

function sameExactLoungeIdentity(first, second) {
  const firstName = normalizeIdentityText(first.lounge.name);
  const secondName = normalizeIdentityText(second.lounge.name);
  return firstName.length >= 6 && firstName === secondName;
}

function physicalNameVariants(value) {
  const base = normalizeIdentityText(value);
  const withoutTerminal = base.replace(/\bterminal\s+[a-z0-9].*$/i, '').trim();
  const withoutLeadingArticle = withoutTerminal.replace(/^the\s+/, '').trim();
  const withoutTrailingLounge = withoutLeadingArticle.replace(/\blounges?\b$/i, '').trim();
  return cleanList([base, withoutTerminal, withoutLeadingArticle, withoutTrailingLounge]).filter((variant) => variant.length >= 6);
}

function samePhysicalNameIdentity(first, second) {
  const firstVariants = new Set(physicalNameVariants(first.lounge.name));
  return physicalNameVariants(second.lounge.name).some((variant) => firstVariants.has(variant));
}

function numberedLoungeTokens(value) {
  const text = normalizeIdentityText(value);
  const tokens = new Set();
  const patterns = [
    /\b(?:no|number)\s*([0-9]{1,3})\b/gi,
    /\blounge\s*(?:no|number)?\s*([0-9]{1,3})\b/gi,
    /\b([0-9]{1,3})\s+(?:vip\s+)?lounge\b/gi,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      tokens.add(String(Number(match[1])));
    }
  }
  return tokens;
}

function numberedLoungeFamilies(value) {
  const text = normalizeIdentityText(value);
  return new Set(
    [
      ['vip lounge', /\bvip\b.*\blounge\b|\blounge\b.*\bvip\b/i],
      ['china eastern', /\bchina eastern\b/i],
      ['china southern', /\bchina southern\b/i],
      ['juneyao', /\bjuneyao\b/i],
      ['air china', /\bair china\b/i],
    ]
      .filter(([, pattern]) => pattern.test(text))
      .map(([family]) => family),
  );
}

function sameNumberedLoungeIdentity(first, second) {
  const firstTokens = numberedLoungeTokens(first.lounge.name);
  const secondTokens = numberedLoungeTokens(second.lounge.name);
  if (firstTokens.size === 0 || ![...firstTokens].some((token) => secondTokens.has(token))) {
    return false;
  }

  const firstFamilies = numberedLoungeFamilies(first.lounge.name);
  const secondFamilies = numberedLoungeFamilies(second.lounge.name);
  return firstFamilies.size > 0 && [...firstFamilies].some((family) => secondFamilies.has(family));
}

function samePhysicalLoungeIdentity(first, second) {
  if (clean(first.airport.iata).toUpperCase() !== clean(second.airport.iata).toUpperCase()) {
    return false;
  }
  if (!publishedConcoursesCompatible(first, second)) {
    return false;
  }
  const publishedFamilyMatch = samePublishedGateFamilyIdentity(first, second);
  if (!publishedGatesCompatible(first.location.gate, second.location.gate) && !publishedFamilyMatch) {
    return false;
  }
  if (
    hasKnownTerminal(first) &&
    hasKnownTerminal(second) &&
    normalizeTerminalText(first.location.terminal) !== normalizeTerminalText(second.location.terminal) &&
    !(sameNumberedLoungeIdentity(first, second) && priceEvidenceTerminalsCompatible(first.location.terminal, second.location.terminal)) &&
    !(sameQatarOperatedLoungeIdentity(first, second) && qatarOperatedLocationCompatible(first, second))
  ) {
    return false;
  }
  return (
    sameExactLoungeIdentity(first, second) ||
    samePhysicalNameIdentity(first, second) ||
    sameNumberedLoungeIdentity(first, second) ||
    sameQatarOperatedLoungeIdentity(first, second) ||
    publishedFamilyMatch
  );
}

function evidenceFamiliesForSource(sourceId) {
  const sourceFamilies = {
    'airport-dimensions': ['the club', 'clubrooms'],
    'escape-lounges': ['escape lounge'],
    'no1-lounges': ['no1 lounge', 'aspire'],
    marhaba: ['marhaba'],
    'minute-suites': ['minute suites'],
    gameway: ['gameway'],
    sleepover: ['sleepover'],
    'be-relax': ['be relax'],
  };
  return sourceFamilies[sourceId] ?? [];
}

function partnerBookingFamiliesForSource(sourceId) {
  const sourceFamilies = {
    marhaba: ['plaza premium'],
    'no1-lounges': ['the club'],
  };
  return sourceFamilies[sourceId] ?? [];
}

function hasAnyLoungeFamily(record, families) {
  const text = normalizeIdentityText(
    [record.lounge.name, record.lounge.brand, record.lounge.operator, record.lounge.brandAsset?.id].join(' '),
  );
  return families.some((family) => text.includes(family));
}

function identityAliasesForAirportMatch(value) {
  const base = normalizeIdentityText(value);
  const aliases = [base];
  const targetedAliases = [
    [/\bblossom\b.*\bsats\b.*\bplaza premium\b.*\blounge\b/i, 'blossom lounge'],
    [/\bqatar airways premium lounge singapore changi airport\b/i, 'qatar airways premium lounge'],
    [/\bchelsea lounge\b/i, 'chelsea lounge'],
  ];
  for (const [pattern, alias] of targetedAliases) {
    if (pattern.test(base)) {
      aliases.push(alias);
    }
  }
  const suffixStripped = base
    .replace(/\s+(?:the\s+)?(?:east|west|north|south|pier|portus|domus|domestic|international)\b.*$/i, '')
    .replace(/\s+\b(?:guarulhos)\b$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (suffixStripped && suffixStripped.length >= 8) {
    aliases.push(suffixStripped);
  }
  return cleanList(aliases);
}

function exactIdentityTerminalsCompatible(first, second) {
  if (enrichmentTerminalsCompatible(first, second)) {
    return true;
  }
  if (isGenericTerminalForPriceEvidence(first) || isGenericTerminalForPriceEvidence(second)) {
    return true;
  }
  const firstNumbers = terminalNumberTokens(normalizeTerminalForEnrichment(first));
  const secondNumbers = terminalNumberTokens(normalizeTerminalForEnrichment(second));
  return firstNumbers.size > 0 && secondNumbers.size > 0 && [...firstNumbers].some((number) => secondNumbers.has(number));
}

function officialAirportMatchesForRecord(record, officialByAirport) {
  const airportCode = clean(record.airport.iata).toUpperCase();
  const exactMatches = identityAliasesForAirportMatch(record.lounge.name)
    .flatMap((identity) => officialByAirport.byIdentity.get(`${airportCode}|${identity}`) ?? [])
    .filter(
      (candidate, index, matches) =>
        candidate.lounge.id !== record.lounge.id &&
        matches.findIndex((match) => match.lounge.id === candidate.lounge.id) === index &&
        exactIdentityTerminalsCompatible(record.location.terminal, candidate.location.terminal),
    );
  if (exactMatches.length > 0) {
    return exactMatches;
  }

  return (officialByAirport.byAirport.get(airportCode) ?? []).filter((candidate) => {
    if (
      candidate.lounge.id === record.lounge.id ||
      !enrichmentTerminalsCompatible(record.location.terminal, candidate.location.terminal) ||
      !sameLoungeFamily(record, candidate)
    ) {
      return false;
    }

    const genericQatarFamilyMatch =
      airportCode === 'DOH' &&
      hasAnyLoungeFamily(record, ['qatar airways']) &&
      hasAnyLoungeFamily(candidate, ['qatar airways']) &&
      !sameExactLoungeIdentity(record, candidate) &&
      !samePhysicalNameIdentity(record, candidate) &&
      !sameQatarOperatedLoungeIdentity(record, candidate);
    return !genericQatarFamilyMatch;
  });
}

function officialOperatorSource(record) {
  return record.sources.find((source) => evidenceFamiliesForSource(source.sourceId).length > 0) ?? null;
}

function officialPartnerBookingSource(record) {
  return record.sources.find((source) => partnerBookingFamiliesForSource(source.sourceId).length > 0) ?? null;
}

function officialAirportSource(record) {
  return record.sources.find((source) => source.sourceId === 'airport-official-pages') ?? null;
}

function officialAllianceSource(record) {
  return record.sources.find((source) => source.sourceId === 'oneworld') ?? null;
}

function officialDeltaSource(record) {
  return record.sources.find((source) => source.sourceId === 'delta') ?? null;
}

function officialPriceSources(record) {
  const offerSourceIds = new Set((record.accessOffers ?? []).map((offer) => offer.sourceId));
  return record.sources.filter(
    (source) =>
      offerSourceIds.has(source.sourceId) &&
      OFFICIAL_PRICE_SOURCE_IDS.has(source.sourceId) &&
      source.fieldCoverage.includes('access.accessOffers'),
  );
}

function officialPriceOffers(record) {
  const sourceIds = new Set(officialPriceSources(record).map((source) => source.sourceId));
  return (record.accessOffers ?? []).filter((offer) => sourceIds.has(offer.sourceId));
}

function officialPriceOffersForSource(record, sourceId) {
  const source = record.sources.find(
    (candidate) =>
      candidate.sourceId === sourceId &&
      OFFICIAL_PRICE_SOURCE_IDS.has(candidate.sourceId) &&
      candidate.fieldCoverage.includes('access.accessOffers'),
  );
  if (!source) {
    return [];
  }
  return (record.accessOffers ?? []).filter((offer) => offer.sourceId === sourceId);
}

function isActiveAdmiralsClub(record) {
  const name = normalizeIdentityText(record.lounge.name);
  return (
    /\badmirals club\b/.test(name) &&
    !/\b(?:provisions|partner|temporarily closed|closed)\b/.test(name) &&
    record.lounge.status !== 'temporarily_closed'
  );
}

function enrichAdmiralsClubOneDayPass(records) {
  const evidence = records
    .flatMap((record) =>
      officialPriceOffersForSource(record, 'american').map((offer) => ({
        offer,
        source: record.sources.find(
          (source) =>
            source.sourceId === 'american' &&
            source.url === offer.url &&
            source.fieldCoverage.includes('access.accessOffers'),
        ),
      })),
    )
    .filter(({ offer, source }) => /\bOne-Day Pass\b/i.test(offer.label) && source);
  const uniqueEvidence = new Map(
    evidence.map(({ offer, source }) => [
      `${offer.currency}|${offer.amount}|${offer.url}`,
      { offer, source },
    ]),
  );
  if (uniqueEvidence.size !== 1) {
    return records;
  }

  const [{ offer, source }] = [...uniqueEvidence.values()];
  return records.map((record) => {
    if (!isActiveAdmiralsClub(record)) {
      return record;
    }
    return {
      ...record,
      accessOffers: mergeAccessOffers([...(record.accessOffers ?? []), offer]),
      notes: cleanList([
        ...record.notes,
        'Official American Airlines One-Day Pass evidence applies to active Admirals Club locations, capacity permitting.',
      ]),
      sources: mergeUniqueBySourceId([...record.sources, source]),
    };
  });
}

function enrichDeltaSkyClubAccessPolicy(records, accessPolicies) {
  const policies = (accessPolicies ?? []).filter(
    (policy) =>
      policy.product === 'delta-sky-club' &&
      policy.source?.sourceId === 'amex-global-lounge-collection' &&
      policy.offers?.length > 0,
  );
  if (policies.length !== 1) {
    return records;
  }

  const [policy] = policies;
  const policySource = policy.source;
  const offers = policy.offers.map((offer) => ({
    type: offer.type,
    label: offer.label,
    amount: offer.amount,
    currency: offer.currency,
    sourceId: policySource.sourceId,
    url: offer.sourceUrl || policySource.url,
    retrievedAt: policySource.retrievedAt,
  }));

  return records.map((record) => {
    const isDeltaSkyClub =
      hasSource(record, 'delta') &&
      normalizeIdentityText(record.lounge.name) === 'delta sky club' &&
      record.lounge.status !== 'temporarily_closed';
    if (!isDeltaSkyClub) {
      return record;
    }

    return {
      ...record,
      accessOffers: mergeAccessOffers([...(record.accessOffers ?? []), ...offers]),
      restrictions: cleanList([...(record.restrictions ?? []), ...(policy.restrictions ?? [])]),
      notes: cleanList([
        ...record.notes,
        'Official American Express benefit terms supplied eligibility-scoped Delta Sky Club visit pricing.',
      ]),
      sources: mergeUniqueBySourceId([...record.sources, policySource]),
    };
  });
}

function enrichPriorityPassAccessPolicy(records, accessPolicies) {
  const policies = (accessPolicies ?? []).filter(
    (policy) =>
      policy.product === 'priority-pass-lounge-access' &&
      policy.source?.sourceId === 'priority-pass' &&
      policy.offers?.length > 0,
  );
  if (policies.length !== 1) {
    return records;
  }

  const [policy] = policies;
  const policySource = policy.source;
  const offers = policy.offers.map((offer) => ({
    type: offer.type,
    label: offer.label,
    amount: offer.amount,
    currency: offer.currency,
    sourceId: policySource.sourceId,
    url: offer.sourceUrl || policySource.url,
    retrievedAt: policySource.retrievedAt,
  }));

  return records.map((record) => {
    const eligible =
      hasSource(record, 'priority-pass') &&
      record.lounge.category === 'lounge' &&
      record.lounge.status === 'active';
    if (!eligible) {
      return record;
    }

    return {
      ...record,
      accessOffers: mergeAccessOffers([...(record.accessOffers ?? []), ...offers]),
      restrictions: cleanList([...(record.restrictions ?? []), ...(policy.restrictions ?? [])]),
      notes: cleanList([
        ...record.notes,
        'Official Priority Pass Standard plan terms supplied eligibility-scoped lounge visit pricing.',
      ]),
      sources: mergeUniqueBySourceId([...record.sources, policySource]),
    };
  });
}

function hasSource(record, sourceId) {
  return record.sources.some((source) => source.sourceId === sourceId);
}

function officialLocationSources(record, field) {
  return record.sources.filter(
    (source) => OFFICIAL_LOCATION_SOURCE_IDS.has(source.sourceId) && source.fieldCoverage.includes(field),
  );
}

function sameNameBrandLoungeFamily(first, second) {
  const firstAspireProduct = aspireProductIdentity(first);
  const secondAspireProduct = aspireProductIdentity(second);
  if ((firstAspireProduct || secondAspireProduct) && firstAspireProduct !== secondAspireProduct) {
    return false;
  }
  const firstFamilies = recognizedFamiliesForRecord(first, { includeBrandAsset: false });
  const secondFamilies = recognizedFamiliesForRecord(second, { includeBrandAsset: false });
  return firstFamilies.size > 0 && [...firstFamilies].some((family) => secondFamilies.has(family));
}

function exactPublishedPositionMatch(first, second) {
  const firstGate = normalizeIdentityText(first);
  const secondGate = normalizeIdentityText(second);
  if (!firstGate || !secondGate || firstGate !== secondGate) {
    return false;
  }
  return /\b(?:gate|gates|level|concourse|lounge|check in|mezzanine|ground)\b/i.test(firstGate);
}

function exactPublishedLocationTextMatch(first, second) {
  const firstGate = normalizeIdentityText(first);
  const secondGate = normalizeIdentityText(second);
  if (!firstGate || !secondGate || firstGate !== secondGate) {
    return false;
  }
  return /\b(?:gate|gates|unit|level|concourse|lounge|check in|mezzanine|ground)\b/i.test(firstGate);
}

function officialLocationEvidenceCompatible(record, evidence) {
  if (!publishedGatesCompatible(record.location.gate, evidence.location.gate)) {
    return '';
  }
  if (enrichmentTerminalsCompatible(record.location.terminal, evidence.location.terminal)) {
    return 'terminal';
  }
  if (hasValue(record.location.terminal) && hasValue(evidence.location.terminal)) {
    return '';
  }
  return exactPublishedPositionMatch(record.location.gate, evidence.location.gate) ? 'position' : '';
}

function exactDeltaLocationTerminalsCompatible(record, evidence) {
  if (enrichmentTerminalsCompatible(record.location.terminal, evidence.location.terminal)) {
    return true;
  }
  if (!hasValue(record.location.terminal) || !hasValue(evidence.location.terminal)) {
    return false;
  }
  if (hasConflictingScope(record.location.terminal, evidence.location.terminal)) {
    return false;
  }

  const recordTerminal = normalizeTerminalForEnrichment(record.location.terminal);
  const evidenceTerminal = normalizeTerminalForEnrichment(evidence.location.terminal);
  if (
    hasConflictingTokenSet(terminalNumberTokens(recordTerminal), terminalNumberTokens(evidenceTerminal)) ||
    hasConflictingTokenSet(terminalLetterTokens(record.location.terminal), terminalLetterTokens(evidence.location.terminal)) ||
    hasConflictingTokenSet(concourseTokens(recordTerminal), concourseTokens(evidenceTerminal))
  ) {
    return false;
  }

  return isGenericTerminalForPriceEvidence(record.location.terminal) || isGenericTerminalForPriceEvidence(evidence.location.terminal);
}

function isExactGateEvidence(value) {
  return /^Gates?\s+[A-Z]?\d+[A-Z]?(?:\s*(?:&|-|to|and)\s*[A-Z]?\d+[A-Z]?)*$/i.test(clean(value));
}

function enrichRecordFromOfficialAirportPage(record, officialMatches) {
  if (officialMatches.length === 0) {
    return record;
  }

  const officialGate = singleDistinctValue(officialMatches, (match) => match.location.gate);
  const gate =
    !hasValue(record.location.gate) ||
    (officialGate && isExactGateEvidence(officialGate) && !isExactGateEvidence(record.location.gate))
      ? officialGate
      : null;
  const hours = !hasValue(record.operations.hours)
    ? singleDistinctValue(officialMatches, (match) => match.operations.hours, (value) => JSON.stringify(value))
    : null;
  const officialAccessOffers = singleDistinctValue(
    officialMatches,
    (match) => match.accessOffers,
    (value) => JSON.stringify(value),
  );
  const accessOffers = hasValue(officialAccessOffers)
    ? mergeAccessOffers([...(record.accessOffers ?? []), ...officialAccessOffers])
    : null;

  if (!gate && !hours && !accessOffers) {
    return record;
  }

  const evidenceSource = officialMatches.map(officialAirportSource).find(Boolean);
  const usedFields = [
    ...(gate ? ['location.gate'] : []),
    ...(hours ? ['operations.hours'] : []),
    ...(accessOffers ? ['access.accessOffers'] : []),
  ];
  const filteredEvidenceSource = sourceWithFieldCoverage(evidenceSource, usedFields);
  return {
    ...record,
    location: {
      ...record.location,
      gate: gate ?? record.location.gate,
    },
    operations: {
      ...record.operations,
      hours: hours ?? record.operations.hours,
      lastVerifiedAt: latestIsoDate(
        [record.operations.lastVerifiedAt, evidenceSource?.retrievedAt],
        record.operations.lastVerifiedAt,
      ),
    },
    accessOffers: accessOffers ?? record.accessOffers,
    notes: cleanList([...record.notes, 'Official airport page supplied missing field evidence.']),
    sources: filteredEvidenceSource ? mergeUniqueBySourceId([...record.sources, filteredEvidenceSource]) : record.sources,
  };
}

function enrichRecordFromOfficialOperatorPage(record, officialMatches) {
  if (
    officialMatches.length === 0 ||
    record.sources.some((source) => evidenceFamiliesForSource(source.sourceId).length > 0)
  ) {
    return record;
  }

  const officialGate = singleDistinctValue(officialMatches, (match) => match.location.gate);
  const gate = shouldPromotePosition(record.location.gate, officialGate) ? officialGate : null;
  const hours = !hasValue(record.operations.hours)
    ? singleDistinctValue(officialMatches, (match) => match.operations.hours, (value) => JSON.stringify(value))
    : null;
  const officialAccessOffers = singleDistinctValue(
    officialMatches,
    (match) => match.accessOffers,
    (value) => JSON.stringify(value),
  );
  const accessOffers = hasValue(officialAccessOffers)
    ? mergeAccessOffers([...(record.accessOffers ?? []), ...officialAccessOffers])
    : null;

  if (!gate && !hours && !accessOffers) {
    return record;
  }

  const evidenceSource = officialMatches.map(officialOperatorSource).find(Boolean);
  return {
    ...record,
    location: {
      ...record.location,
      gate: gate ?? record.location.gate,
    },
    operations: {
      ...record.operations,
      hours: hours ?? record.operations.hours,
      lastVerifiedAt: latestIsoDate(
        [record.operations.lastVerifiedAt, evidenceSource?.retrievedAt],
        record.operations.lastVerifiedAt,
      ),
    },
    accessOffers: accessOffers ?? record.accessOffers,
    notes: cleanList([...record.notes, 'Official operator page supplied missing field evidence.']),
    sources: evidenceSource ? mergeUniqueBySourceId([...record.sources, evidenceSource]) : record.sources,
  };
}

function enrichFromOfficialAirportPages(records) {
  const officialByAirport = {
    byIdentity: new Map(),
    byAirport: new Map(),
  };
  for (const record of records) {
    if (!record.sources.some((source) => source.sourceId === 'airport-official-pages')) {
      continue;
    }
    const airportCode = clean(record.airport.iata).toUpperCase();
    for (const identity of identityAliasesForAirportMatch(record.lounge.name)) {
      const key = `${airportCode}|${identity}`;
      const rows = officialByAirport.byIdentity.get(key) ?? [];
      rows.push(record);
      officialByAirport.byIdentity.set(key, rows);
    }

    const airportRows = officialByAirport.byAirport.get(airportCode) ?? [];
    airportRows.push(record);
    officialByAirport.byAirport.set(airportCode, airportRows);
  }

  return records.map((record) => {
    const officialMatches = officialAirportMatchesForRecord(record, officialByAirport);
    return enrichRecordFromOfficialAirportPage(record, officialMatches);
  });
}

function enrichFromOfficialOperatorPages(records) {
  const operatorByAirport = new Map();
  for (const record of records) {
    const source = officialOperatorSource(record);
    if (!source) {
      continue;
    }
    const airportCode = clean(record.airport.iata).toUpperCase();
    const rows = operatorByAirport.get(airportCode) ?? [];
    rows.push(record);
    operatorByAirport.set(airportCode, rows);
  }

  return records.map((record) => {
    const airportCode = clean(record.airport.iata).toUpperCase();
    const matches = (operatorByAirport.get(airportCode) ?? []).filter((candidate) => {
      const source = officialOperatorSource(candidate);
      const families = evidenceFamiliesForSource(source?.sourceId);
      const recordNameGates = new Set(
        [...normalizeIdentityText(record.lounge.name).matchAll(/\b([a-z]\d{1,3}[a-z]?)\b/g)].map((match) => match[1]),
      );
      const candidatePositionGates = new Set(
        [...normalizeIdentityText([candidate.lounge.name, candidate.location.gate].join(' ')).matchAll(/\b([a-z]\d{1,3}[a-z]?)\b/g)]
          .map((match) => match[1]),
      );
      const explicitNameGateMatches =
        recordNameGates.size === 0 || [...recordNameGates].some((gate) => candidatePositionGates.has(gate));
      return (
        candidate.lounge.id !== record.lounge.id &&
        enrichmentTerminalsCompatible(record.location.terminal, candidate.location.terminal) &&
        explicitNameGateMatches &&
        hasAnyLoungeFamily(record, families) &&
        hasAnyLoungeFamily(candidate, families)
      );
    });
    return enrichRecordFromOfficialOperatorPage(record, matches);
  });
}

function enrichFromOfficialPartnerBookingPages(records) {
  const evidenceRows = records.filter(
    (record) => hasValue(record.accessOffers) && officialPartnerBookingSource(record),
  );
  const matches = [];

  for (const record of records) {
    if (hasValue(record.accessOffers) || officialPartnerBookingSource(record)) {
      continue;
    }

    for (const evidence of evidenceRows) {
      const source = officialPartnerBookingSource(evidence);
      const families = partnerBookingFamiliesForSource(source?.sourceId);
      if (
        evidence.lounge.id !== record.lounge.id &&
        clean(evidence.airport.iata).toUpperCase() === clean(record.airport.iata).toUpperCase() &&
        enrichmentTerminalsCompatible(record.location.terminal, evidence.location.terminal) &&
        hasAnyLoungeFamily(record, families) &&
        hasAnyLoungeFamily(evidence, families)
      ) {
        matches.push({ record, evidence });
      }
    }
  }

  const matchesByRecord = new Map();
  const matchesByEvidence = new Map();
  for (const match of matches) {
    matchesByRecord.set(match.record.lounge.id, [...(matchesByRecord.get(match.record.lounge.id) ?? []), match]);
    matchesByEvidence.set(match.evidence.lounge.id, [...(matchesByEvidence.get(match.evidence.lounge.id) ?? []), match]);
  }

  return records.map((record) => {
    const recordMatches = matchesByRecord.get(record.lounge.id) ?? [];
    if (recordMatches.length !== 1) {
      return record;
    }

    const [{ evidence }] = recordMatches;
    if ((matchesByEvidence.get(evidence.lounge.id) ?? []).length !== 1) {
      return record;
    }

    const source = officialPartnerBookingSource(evidence);
    if (!source || !hasValue(evidence.accessOffers)) {
      return record;
    }

    return {
      ...record,
      accessOffers: evidence.accessOffers,
      notes: cleanList([...record.notes, 'Official partner booking page supplied paid access evidence.']),
      sources: mergeUniqueBySourceId([...record.sources, source]),
    };
  });
}

function enrichFromOfficialAlliancePages(records) {
  const evidenceRows = records.filter((record) => {
    const source = officialAllianceSource(record);
    return (
      source &&
      (hasValue(record.location.gate) ||
        (hasValue(record.operations.hours) && source.fieldCoverage.includes('operations.hours')))
    );
  });
  const matches = [];

  for (const record of records) {
    const recordHasAllianceSource = record.sources.some((source) => source.sourceId === 'oneworld');
    if (hasValue(record.location.gate) && hasValue(record.operations.hours)) {
      continue;
    }

    for (const evidence of evidenceRows) {
      const source = officialAllianceSource(evidence);
      if (
        source &&
        evidence.lounge.id !== record.lounge.id &&
        clean(evidence.airport.iata).toUpperCase() === clean(record.airport.iata).toUpperCase() &&
        allianceEvidenceTerminalsCompatible(record.location.terminal, evidence.location.terminal) &&
        (recordHasAllianceSource
          ? sameExactLoungeIdentity(record, evidence)
          : sameLoungeFamily(record, evidence) || sameExactLoungeIdentity(record, evidence)) &&
        ((!hasValue(record.location.gate) && hasValue(evidence.location.gate)) ||
          (!hasValue(record.operations.hours) &&
            hasValue(evidence.operations.hours) &&
            source.fieldCoverage.includes('operations.hours')))
      ) {
        matches.push({ record, evidence });
      }
    }
  }

  const matchesByRecord = new Map();
  const matchesByEvidence = new Map();
  for (const match of matches) {
    matchesByRecord.set(match.record.lounge.id, [...(matchesByRecord.get(match.record.lounge.id) ?? []), match]);
    matchesByEvidence.set(match.evidence.lounge.id, [...(matchesByEvidence.get(match.evidence.lounge.id) ?? []), match]);
  }

  return records.map((record) => {
    const recordMatches = matchesByRecord.get(record.lounge.id) ?? [];
    if (recordMatches.length !== 1) {
      return record;
    }

    const [{ evidence }] = recordMatches;
    if ((matchesByEvidence.get(evidence.lounge.id) ?? []).length !== 1) {
      return record;
    }

    const source = officialAllianceSource(evidence);
    if (!source) {
      return record;
    }

    const gate = !hasValue(record.location.gate) && hasValue(evidence.location.gate) ? evidence.location.gate : null;
    const hours =
      !hasValue(record.operations.hours) &&
      hasValue(evidence.operations.hours) &&
      source.fieldCoverage.includes('operations.hours')
        ? evidence.operations.hours
        : null;

    if (!gate && !hours) {
      return record;
    }

    return {
      ...record,
      location: {
        ...record.location,
        gate: gate ?? record.location.gate,
      },
      operations: {
        ...record.operations,
        hours: hours ?? record.operations.hours,
        lastVerifiedAt: latestIsoDate(
          [record.operations.lastVerifiedAt, source.retrievedAt],
          record.operations.lastVerifiedAt,
        ),
      },
      notes: cleanList([...record.notes, 'Official alliance page supplied missing field evidence.']),
      sources: mergeUniqueBySourceId([...record.sources, source]),
    };
  });
}

function sameAirportConcourse(record, evidence) {
  const recordConcourses = concourseTokens([record.location.concourse, record.location.directions].join(' '));
  const evidenceConcourses = concourseTokens([evidence.location.concourse, evidence.location.directions].join(' '));
  return (
    recordConcourses.size > 0 &&
    evidenceConcourses.size > 0 &&
    [...recordConcourses].some((concourse) => evidenceConcourses.has(concourse))
  );
}

function sameQatarOperatedLoungeIdentity(record, evidence) {
  if (clean(record.airport.iata).toUpperCase() !== 'DOH') {
    return false;
  }
  const stripQatarPrefix = (value) => normalizeIdentityText(value).replace(/^qatar airways\s+/, '').trim();
  const recordName = stripQatarPrefix(record.lounge.name);
  const evidenceName = stripQatarPrefix(evidence.lounge.name);
  return recordName.length >= 6 && recordName === evidenceName;
}

function conflictingPublishedLevels(first, second) {
  const firstLevel = normalizeIdentityText(first).match(/\blevel\s+([0-9]+)\b/)?.[1] ?? '';
  const secondLevel = normalizeIdentityText(second).match(/\blevel\s+([0-9]+)\b/)?.[1] ?? '';
  return Boolean(firstLevel && secondLevel && firstLevel !== secondLevel);
}

function verticalPositionToken(value) {
  const text = normalizeIdentityText(value);
  if (/\bground (?:level|floor)\b/.test(text)) {
    return 'ground';
  }
  if (/\bmezzanine (?:level|floor)?\b/.test(text)) {
    return 'mezzanine';
  }
  const level = text.match(/\blevel ([0-9]+)\b/)?.[1] ?? '';
  return level ? `level:${level}` : '';
}

function conflictingPublishedVerticalPositions(first, second) {
  const firstPosition = verticalPositionToken(first);
  const secondPosition = verticalPositionToken(second);
  return Boolean(firstPosition && secondPosition && firstPosition !== secondPosition);
}

function qatarOperatedLocationCompatible(first, second) {
  if (!allianceEvidenceTerminalsCompatible(first.location.terminal, second.location.terminal)) {
    return false;
  }
  if (conflictingPublishedLevels(first.location.gate, second.location.gate)) {
    return false;
  }
  return publishedGatesCompatible(first.location.gate, second.location.gate);
}

function officialPublishedHoursSource(record) {
  const sourceIds = new Set([
    'oneworld',
    'american',
    'delta',
    'air-canada',
    'alaska-airlines',
    'amex-global-lounge-collection',
    'qantas',
    'qatar-airways',
    'singapore-airlines',
  ]);
  return record.sources.find(
    (source) => sourceIds.has(source.sourceId) && source.fieldCoverage.includes('operations.hours'),
  ) ?? null;
}

function officialAirlinePublishedHoursSource(record) {
  const sourceIds = new Set([
    'american',
    'delta',
    'air-canada',
    'alaska-airlines',
    'qantas',
    'qatar-airways',
    'singapore-airlines',
  ]);
  return record.sources.find(
    (source) => sourceIds.has(source.sourceId) && source.fieldCoverage.includes('operations.hours'),
  ) ?? null;
}

function isQantasAllianceLocationConflictDuplicate(first, second) {
  const firstHasQantas = hasSource(first, 'qantas');
  const secondHasQantas = hasSource(second, 'qantas');
  const firstHasOneworld = hasSource(first, 'oneworld');
  const secondHasOneworld = hasSource(second, 'oneworld');
  return (
    clean(first.airport.iata).toUpperCase() === clean(second.airport.iata).toUpperCase() &&
    sameExactLoungeIdentity(first, second) &&
    ((firstHasQantas && secondHasOneworld) || (secondHasQantas && firstHasOneworld)) &&
    !publishedGatesCompatible(first.location.gate, second.location.gate)
  );
}

function crossSourcePublishedHoursSource(record) {
  const airlineSource = officialPublishedHoursSource(record);
  if (airlineSource) {
    return airlineSource;
  }
  const airportSource = officialAirportSource(record);
  return airportSource?.fieldCoverage.includes('operations.hours') ? airportSource : null;
}

function sameApprovedCrossSourceHoursIdentity(first, second) {
  if (sameExactLoungeIdentity(first, second)) {
    return true;
  }

  const names = new Set([normalizeIdentityText(first.lounge.name), normalizeIdentityText(second.lounge.name)]);
  const namesMatch = (firstName, secondName) => names.has(firstName) && names.has(secondName);
  const qantasRegionalMatch =
    names.has('qantas regional lounge') &&
    [...names].some((name) => name !== 'qantas regional lounge' && /^[a-z0-9 ]+ regional lounge$/.test(name));

  return (
    qantasRegionalMatch ||
    namesMatch('the qantas club domestic', 'qantas club lounge') ||
    namesMatch('british airways lounge', 'british airways terraces lounge')
  );
}

function mergeApprovedCrossSourceAliasRecords(records) {
  const definitions = [
    {
      airportCode: 'CSX',
      preferredSourceId: 'priority-pass',
      preferredName: 'no 18 first and business class vip lounge',
      evidenceSourceId: 'oneworld',
      evidenceName: 'no 18 first class lounge',
    },
    {
      airportCode: 'SUB',
      preferredSourceId: 'oneworld',
      preferredName: 'prayana executive lounge',
      evidenceSourceId: 'plaza-premium',
      evidenceName: 'prayana lounge surabaya by ias hospitality',
    },
  ];
  const replacements = new Map();
  const consumed = new Set();

  for (const definition of definitions) {
    const preferred = records.filter(
      (record) =>
        clean(record.airport.iata).toUpperCase() === definition.airportCode &&
        hasSource(record, definition.preferredSourceId) &&
        normalizeIdentityText(record.lounge.name) === definition.preferredName,
    );
    const evidence = records.filter(
      (record) =>
        clean(record.airport.iata).toUpperCase() === definition.airportCode &&
        hasSource(record, definition.evidenceSourceId) &&
        normalizeIdentityText(record.lounge.name) === definition.evidenceName,
    );
    if (
      preferred.length !== 1 ||
      evidence.length !== 1 ||
      !exactIdentityTerminalsCompatible(preferred[0].location.terminal, evidence[0].location.terminal)
    ) {
      continue;
    }

    const combined = mergeCanonicalRecords(preferred[0], evidence[0]);
    replacements.set(preferred[0].lounge.id, {
      ...combined,
      lounge: {
        ...combined.lounge,
        id: preferred[0].lounge.id,
        name: preferred[0].lounge.name,
      },
      location: {
        ...combined.location,
        gate: pickMoreSpecificPosition(preferred[0].location.gate, combined.location.gate),
      },
      notes: cleanList([...combined.notes, 'Merged approved one-to-one cross-source lounge identity.']),
    });
    consumed.add(evidence[0].lounge.id);
  }

  return records
    .filter((record) => !consumed.has(record.lounge.id))
    .map((record) => replacements.get(record.lounge.id) ?? record);
}

function exactPositionHoursTerminalsCompatible(first, second) {
  if (allianceEvidenceTerminalsCompatible(first.location.terminal, second.location.terminal)) {
    return true;
  }
  if (!exactPublishedPositionMatch(first.location.gate, second.location.gate)) {
    return false;
  }
  const firstNumbers = terminalNumberTokens(normalizeTerminalForEnrichment(first.location.terminal));
  const secondNumbers = terminalNumberTokens(normalizeTerminalForEnrichment(second.location.terminal));
  const terminalNumbersConflict = hasConflictingTokenSet(firstNumbers, secondNumbers);
  const terminalLettersConflict = hasConflictingTokenSet(
    terminalLetterTokens(first.location.terminal),
    terminalLetterTokens(second.location.terminal),
  );
  if (terminalNumbersConflict || terminalLettersConflict) {
    return false;
  }

  const sameNumberedTerminal =
    firstNumbers.size > 0 && secondNumbers.size > 0 && [...firstNumbers].some((number) => secondNumbers.has(number));
  const genericTerminal =
    isGenericTerminalForAllianceEvidence(first.location.terminal) ||
    isGenericTerminalForAllianceEvidence(second.location.terminal);
  if (sameNumberedTerminal || genericTerminal) {
    return true;
  }

  return !hasConflictingScope(first.location.terminal, second.location.terminal);
}

function enrichFromCrossSourceExactPublishedHours(records) {
  const evidenceRows = records.filter(
    (record) => hasValue(record.operations.hours) && crossSourcePublishedHoursSource(record),
  );
  const matches = [];

  for (const record of records) {
    if (
      hasValue(record.operations.hours) ||
      (!hasSource(record, 'oneworld') && !hasSource(record, 'airport-official-pages'))
    ) {
      continue;
    }

    for (const evidence of evidenceRows) {
      const evidenceSource = crossSourcePublishedHoursSource(evidence);
      if (
        evidence.lounge.id !== record.lounge.id &&
        evidenceSource &&
        !hasSource(record, evidenceSource.sourceId) &&
        clean(evidence.airport.iata).toUpperCase() === clean(record.airport.iata).toUpperCase() &&
        sameApprovedCrossSourceHoursIdentity(record, evidence) &&
        exactPublishedPositionMatch(record.location.gate, evidence.location.gate) &&
        exactPositionHoursTerminalsCompatible(record, evidence)
      ) {
        matches.push({ record, evidence, evidenceSource });
      }
    }
  }

  const matchesByRecord = new Map();
  const matchesByEvidence = new Map();
  for (const match of matches) {
    matchesByRecord.set(match.record.lounge.id, [...(matchesByRecord.get(match.record.lounge.id) ?? []), match]);
    matchesByEvidence.set(match.evidence.lounge.id, [...(matchesByEvidence.get(match.evidence.lounge.id) ?? []), match]);
  }

  return records.map((record) => {
    const recordMatches = matchesByRecord.get(record.lounge.id) ?? [];
    if (recordMatches.length !== 1) {
      return record;
    }

    const [{ evidence, evidenceSource }] = recordMatches;
    if ((matchesByEvidence.get(evidence.lounge.id) ?? []).length !== 1) {
      return record;
    }

    const hoursSource = sourceWithFieldCoverage(evidenceSource, ['operations.hours']);
    if (!hoursSource) {
      return record;
    }

    return {
      ...record,
      operations: {
        ...record.operations,
        hours: evidence.operations.hours,
        lastVerifiedAt: latestIsoDate(
          [record.operations.lastVerifiedAt, hoursSource.retrievedAt],
          record.operations.lastVerifiedAt,
        ),
      },
      notes: cleanList([...record.notes, 'Official cross-source page supplied exact-position hours evidence.']),
      sources: mergeUniqueBySourceId([...record.sources, hoursSource]),
    };
  });
}

function exactPublishedHoursIdentity(first, second) {
  if (sameExactLoungeIdentity(first, second) || sameQatarOperatedLoungeIdentity(first, second)) {
    return true;
  }

  const stripLeadingOwner = (value) =>
    normalizeIdentityText(value)
      .replace(/^the\s+/, '')
      .replace(/^(?:singapore airlines|air canada|alaska airlines|american airlines|delta|qantas|qatar airways)\s+/, '')
      .trim();
  const firstName = stripLeadingOwner(first.lounge.name);
  const secondName = stripLeadingOwner(second.lounge.name);
  return firstName.length >= 6 && firstName === secondName;
}

function exactAirlineOwnedHoursIdentity(first, second) {
  if (exactPublishedHoursIdentity(first, second)) {
    return true;
  }

  const normalizeOwnedName = (value) =>
    normalizeIdentityText(value)
      .replace(/^the\s+/, '')
      .replace(/^(?:singapore airlines|air canada|alaska airlines|american airlines|delta|qantas|qatar airways)\s+/, '')
      .replace(/\s+lounges?$/, '')
      .trim();
  const firstName = normalizeOwnedName(first.lounge.name);
  const secondName = normalizeOwnedName(second.lounge.name);
  return firstName.length >= 6 && firstName === secondName;
}

function qantasAllianceLoungeTier(value) {
  const name = normalizeIdentityText(value);
  if (/\bregional lounge\b/.test(name)) {
    return 'regional';
  }
  if (/\bqantas club\b/.test(name)) {
    return 'club';
  }
  if (/\bfirst\b/.test(name)) {
    return 'first';
  }
  if (/\bdomestic\b/.test(name) && /\bbusiness\b/.test(name)) {
    return 'domestic-business';
  }
  if (/\binternational\b/.test(name) && /\bbusiness\b/.test(name)) {
    return 'international-business';
  }
  return '';
}

function sameQantasAllianceLoungeIdentity(first, second) {
  const airportCode = clean(first.airport.iata).toUpperCase();
  const names = new Set([normalizeIdentityText(first.lounge.name), normalizeIdentityText(second.lounge.name)]);
  if (airportCode === 'ADL' && names.has('the qantas club')) {
    return names.has('the qantas club domestic');
  }
  const approvedAirportAliases = new Map([
    ['BNE', ['international lounge', 'brisbane international premium lounge']],
    ['HNL', ['honolulu', 'qantas international business']],
    ['LHR', ['london international lounge', 'the qantas london lounge']],
    ['SCL', ['latam vip lounge partner', 'latam vip lounge']],
    ['YVR', ['cathay pacific lounge partner', 'cathay pacific lounge']],
  ]);
  const approvedNames = approvedAirportAliases.get(airportCode);
  if (approvedNames?.every((name) => names.has(name))) {
    return true;
  }

  if (
    sameExactLoungeIdentity(first, second) ||
    exactAirlineOwnedHoursIdentity(first, second) ||
    sameApprovedCrossSourceHoursIdentity(first, second)
  ) {
    return true;
  }

  const firstTier = qantasAllianceLoungeTier(first.lounge.name);
  const secondTier = qantasAllianceLoungeTier(second.lounge.name);
  return Boolean(firstTier && firstTier === secondTier);
}

function crossSourceAirlineHoursLocationsCompatible(first, second) {
  if (
    hasConflictingTokenSet(
      scopePositionTokens(first.location.terminal),
      scopePositionTokens(second.location.terminal),
    ) ||
    hasConflictingTokenSet(
      terminalNumberTokens(normalizeTerminalForEnrichment(first.location.terminal)),
      terminalNumberTokens(normalizeTerminalForEnrichment(second.location.terminal)),
    ) ||
    hasConflictingTokenSet(terminalLetterTokens(first.location.terminal), terminalLetterTokens(second.location.terminal)) ||
    hasConflictingTokenSet(
      concourseTokens(normalizeTerminalForEnrichment(first.location.terminal)),
      concourseTokens(normalizeTerminalForEnrichment(second.location.terminal)),
    ) ||
    conflictingPublishedLevels(first.location.gate, second.location.gate) ||
    conflictingPublishedVerticalPositions(first.location.gate, second.location.gate)
  ) {
    return false;
  }
  return publishedGatesCompatible(first.location.gate, second.location.gate);
}

function withoutConflictingQantasPosition(record) {
  return {
    ...record,
    location: {
      ...record.location,
      gate: '',
    },
    sources: record.sources.map((source) =>
      source.sourceId === 'qantas'
        ? {
            ...source,
            fieldCoverage: source.fieldCoverage.filter((field) => field !== 'location.gate'),
          }
        : source,
    ),
  };
}

function mergeBijectiveQantasAllianceRecords(records) {
  const qantasRows = records.filter((record) => hasSource(record, 'qantas') && !hasSource(record, 'oneworld'));
  const oneworldRows = records.filter((record) => hasSource(record, 'oneworld') && !hasSource(record, 'qantas'));
  const matches = [];

  for (const qantas of qantasRows) {
    for (const oneworld of oneworldRows) {
      if (
        clean(qantas.airport.iata).toUpperCase() === clean(oneworld.airport.iata).toUpperCase() &&
        sameQantasAllianceLoungeIdentity(qantas, oneworld)
      ) {
        matches.push({ qantas, oneworld });
      }
    }
  }

  const matchesByQantas = new Map();
  const matchesByOneworld = new Map();
  for (const match of matches) {
    matchesByQantas.set(match.qantas.lounge.id, [...(matchesByQantas.get(match.qantas.lounge.id) ?? []), match]);
    matchesByOneworld.set(match.oneworld.lounge.id, [...(matchesByOneworld.get(match.oneworld.lounge.id) ?? []), match]);
  }

  const approvedByQantas = new Map();
  const consumedOneworld = new Set();
  for (const [qantasId, qantasMatches] of matchesByQantas) {
    if (qantasMatches.length !== 1) {
      continue;
    }
    const [match] = qantasMatches;
    if ((matchesByOneworld.get(match.oneworld.lounge.id) ?? []).length !== 1) {
      continue;
    }
    approvedByQantas.set(qantasId, match);
    consumedOneworld.add(match.oneworld.lounge.id);
  }

  const merged = [];
  for (const record of records) {
    if (consumedOneworld.has(record.lounge.id)) {
      continue;
    }
    const match = approvedByQantas.get(record.lounge.id);
    if (!match) {
      merged.push(record);
      continue;
    }

    const locationsCompatible = crossSourceAirlineHoursLocationsCompatible(match.qantas, match.oneworld);
    const qantasEvidence = locationsCompatible
      ? match.qantas
      : withoutConflictingQantasPosition(match.qantas);
    const combined = mergeCanonicalRecords(match.oneworld, qantasEvidence);
    merged.push({
      ...combined,
      lounge: {
        ...combined.lounge,
        id: match.oneworld.lounge.id,
        name: match.oneworld.lounge.name,
      },
      notes: cleanList([
        ...combined.notes,
        locationsCompatible
          ? 'Merged bijective Qantas and oneworld lounge evidence.'
          : 'Merged Qantas identity and hours evidence without conflicting position fields.',
      ]),
    });
  }

  return merged;
}

function normalizedGateCodes(value) {
  return [...clean(value).toUpperCase().matchAll(/\b([A-Z])\s*-?\s*(\d+)([A-Z]?)\b/g)].map((match) => ({
    prefix: match[1],
    number: Number(match[2]),
    suffix: match[3],
  }));
}

function normalizedGateRanges(value) {
  return [...clean(value).toUpperCase().matchAll(/\b([A-Z])\s*-?\s*(\d+)\s*-\s*(?:\1\s*)?(\d+)\b/g)].map(
    (match) => ({ prefix: match[1], start: Number(match[2]), end: Number(match[3]) }),
  );
}

function alaskaGateEvidenceCompatible(first, second) {
  if (!hasValue(first) || !hasValue(second)) {
    return true;
  }
  const firstCodes = normalizedGateCodes(first);
  const secondCodes = normalizedGateCodes(second);
  if (firstCodes.length === 0 || secondCodes.length === 0) {
    return publishedGatesCompatible(first, second);
  }
  if (
    firstCodes.some((left) =>
      secondCodes.some((right) => left.prefix === right.prefix && left.number === right.number),
    )
  ) {
    return true;
  }
  const firstRanges = normalizedGateRanges(first);
  const secondRanges = normalizedGateRanges(second);
  return (
    firstRanges.some((range) =>
      secondCodes.some(
        (code) => code.prefix === range.prefix && code.number >= range.start && code.number <= range.end,
      ),
    ) ||
    secondRanges.some((range) =>
      firstCodes.some(
        (code) => code.prefix === range.prefix && code.number >= range.start && code.number <= range.end,
      ),
    )
  );
}

function normalizedAlaskaTerminal(value) {
  return normalizeIdentityText(value)
    .replace(/harvey milk/g, '')
    .replace(/north satellite/g, 'n concourse')
    .replace(/\bmezzanine level\b/g, '')
    .replace(/\bmain terminal\b/g, 'terminal')
    .replace(/\s+/g, ' ')
    .trim();
}

function alaskaLocationCompatible(authority, evidence) {
  if (!alaskaGateEvidenceCompatible(authority.location.gate, evidence.location.gate)) {
    return false;
  }
  const authorityTerminal = normalizedAlaskaTerminal(authority.location.terminal);
  const evidenceTerminal = normalizedAlaskaTerminal(evidence.location.terminal);
  if (
    authorityTerminal === evidenceTerminal ||
    authorityTerminal.includes(evidenceTerminal) ||
    evidenceTerminal.includes(authorityTerminal)
  ) {
    return true;
  }
  const authorityNumbers = terminalNumberTokens(authorityTerminal);
  const evidenceNumbers = terminalNumberTokens(evidenceTerminal);
  if (
    authorityNumbers.size > 0 &&
    evidenceNumbers.size > 0 &&
    [...authorityNumbers].some((number) => evidenceNumbers.has(number))
  ) {
    return true;
  }
  const authorityGate = normalizeIdentityText(authority.location.gate);
  const evidenceGate = normalizeIdentityText(evidence.location.gate);
  return (
    authorityGate === evidenceTerminal ||
    evidenceGate === authorityTerminal ||
    normalizedGateCodes(authority.location.gate).some((left) =>
      normalizedGateCodes(evidence.location.gate).some(
        (right) => left.prefix === right.prefix && left.number === right.number,
      ),
    )
  );
}

function existingRecordPreference(record) {
  if (hasSource(record, 'airport-official-pages')) return 0;
  if (hasSource(record, 'oneworld')) return 1;
  if (hasSource(record, 'priority-pass')) return 2;
  return 3;
}

function aenaIdentityKey(value) {
  return normalizeIdentityText(clean(value).normalize('NFD').replace(/\p{Diacritic}/gu, ''))
    .replace(/\b(?:aena|sala|vip|lounges?|airport|aeropuerto)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isAenaAuthorityRecord(record) {
  return (
    hasSource(record, 'airport-official-pages') &&
    /\baena\b/i.test([record.lounge.operator, ...(record.lounge.programs ?? [])].join(' '))
  );
}

function aenaNamesCompatible(authority, evidence, authorityCount) {
  const authorityKey = aenaIdentityKey(authority.lounge.name);
  const evidenceKey = aenaIdentityKey(evidence.lounge.name);
  if (authorityKey && evidenceKey) {
    const authorityTokens = new Set(authorityKey.split(' '));
    const evidenceTokens = new Set(evidenceKey.split(' '));
    const shared = [...authorityTokens].filter((token) => evidenceTokens.has(token) && token.length >= 4);
    return authorityKey === evidenceKey || shared.length > 0;
  }

  return (
    authorityCount === 1 &&
    /\baena\b/i.test([evidence.lounge.operator, evidence.lounge.name].join(' ')) &&
    exactPublishedLocationTextMatch(authority.location.gate, evidence.location.gate)
  );
}

function aenaLocationCompatible(authority, evidence) {
  return (
    priceEvidenceTerminalsCompatible(authority.location.terminal, evidence.location.terminal) &&
    publishedGatesCompatible(authority.location.gate, evidence.location.gate)
  );
}

function aenaAnchorPreference(record) {
  if (hasSource(record, 'priority-pass')) return 0;
  if (hasSource(record, 'airport-official-pages')) return 1;
  if (hasSource(record, 'oneworld')) return 2;
  return 3;
}

function isQatarAggregateRecord(record) {
  if (!hasSource(record, 'qatar-airways')) {
    return false;
  }

  const name = normalizeIdentityText(record.lounge.name);
  return new Set([
    'al maha lounges',
    'first and business class arrival lounges',
    'platinum and gold lounges',
  ]).has(name);
}

function qatarOperatedIdentityKey(record) {
  const airportCode = clean(record.airport.iata).toUpperCase();
  const sourceText = [
    record.lounge.name,
    record.lounge.brand,
    record.lounge.operator,
    ...(record.lounge.programs ?? []),
  ].join(' ');
  if (!hasSource(record, 'qatar-airways') && !/\b(?:qatar airways|al mourjan|al safwa)\b/i.test(sourceText)) {
    return '';
  }

  const name = normalizeIdentityText(record.lounge.name)
    .replace(/^qatar airways\s+/, '')
    .replace(/\b(?:bangkok|singapore changi airport|singapore|london heathrow|london|beirut)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (/\bfrequent flyer lounge\b/.test(name)) {
    return `${airportCode}|frequent flyer lounge`;
  }
  if (/\bpremium lounge\b/.test(name)) {
    return `${airportCode}|premium lounge`;
  }
  if (/\bal mourjan\b.*\bgarden\b/.test(name)) {
    return `${airportCode}|al mourjan business lounge garden`;
  }
  if (/\bal mourjan\b.*\bsouth\b/.test(name)) {
    return `${airportCode}|al mourjan business lounge south`;
  }
  if (/\bal safwa\b.*\bfirst\b/.test(name)) {
    return `${airportCode}|al safwa first lounge`;
  }
  if (/\bsilver lounge\b/.test(name)) {
    return `${airportCode}|silver lounge south`;
  }
  return '';
}

function qatarRecordPreference(record) {
  if (hasSource(record, 'qatar-airways')) return 0;
  if (hasSource(record, 'airport-official-pages')) return 1;
  if (hasSource(record, 'oneworld')) return 2;
  return 3;
}

function qatarLocationPreference(record) {
  if (hasSource(record, 'airport-official-pages')) return 0;
  if (hasSource(record, 'qatar-airways')) return 1;
  if (hasSource(record, 'oneworld')) return 2;
  return 3;
}

function mergeQatarAuthorityRecords(records) {
  const aggregateIds = new Set(records.filter(isQatarAggregateRecord).map((record) => record.lounge.id));
  const groups = new Map();

  for (const record of records) {
    if (aggregateIds.has(record.lounge.id)) {
      continue;
    }
    const key = qatarOperatedIdentityKey(record);
    if (!key) {
      continue;
    }
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }

  const mergedByAnchor = new Map();
  const consumed = new Set(aggregateIds);
  for (const group of groups.values()) {
    if (group.length < 2 || !group.some((record) => hasSource(record, 'qatar-airways'))) {
      continue;
    }

    const anchor = [...group].sort(
      (first, second) => qatarRecordPreference(first) - qatarRecordPreference(second),
    )[0];
    const nameAuthority = [...group].sort(
      (first, second) =>
        clean(second.lounge.name).length - clean(first.lounge.name).length ||
        qatarRecordPreference(first) - qatarRecordPreference(second),
    )[0];
    const locationAuthority = [...group].sort(
      (first, second) => qatarLocationPreference(first) - qatarLocationPreference(second),
    )[0];
    const combined = group.reduce((current, record) => mergeCanonicalRecords(current, record));
    mergedByAnchor.set(anchor.lounge.id, {
      ...combined,
      lounge: {
        ...combined.lounge,
        id: anchor.lounge.id,
        name: nameAuthority.lounge.name,
        brand: anchor.lounge.brand,
        operator: anchor.lounge.operator,
      },
      location: {
        ...combined.location,
        terminal: hasValue(locationAuthority.location.terminal)
          ? locationAuthority.location.terminal
          : combined.location.terminal,
        concourse: hasValue(locationAuthority.location.concourse)
          ? locationAuthority.location.concourse
          : combined.location.concourse,
        gate: hasValue(locationAuthority.location.gate)
          ? locationAuthority.location.gate
          : combined.location.gate,
        securitySide: hasValue(locationAuthority.location.securitySide)
          ? locationAuthority.location.securitySide
          : combined.location.securitySide,
        directions: hasValue(locationAuthority.location.directions)
          ? locationAuthority.location.directions
          : combined.location.directions,
      },
      notes: cleanList([
        ...combined.notes,
        'Merged Qatar Airways lounge evidence by airport and unique operated-lounge identity.',
      ]),
    });
    for (const record of group) {
      if (record.lounge.id !== anchor.lounge.id) {
        consumed.add(record.lounge.id);
      }
    }
  }

  const merged = [];
  for (const record of records) {
    if (consumed.has(record.lounge.id)) {
      continue;
    }
    merged.push(mergedByAnchor.get(record.lounge.id) ?? record);
  }
  return merged;
}

function mergeAenaAuthorityRecords(records) {
  const authorityRows = records.filter(isAenaAuthorityRecord);
  const authoritiesByAirport = new Map();
  for (const authority of authorityRows) {
    const airportCode = clean(authority.airport.iata).toUpperCase();
    authoritiesByAirport.set(airportCode, [...(authoritiesByAirport.get(airportCode) ?? []), authority]);
  }

  const matchesByAuthority = new Map();
  const consumed = new Set();
  for (const evidence of records) {
    if (
      isAenaAuthorityRecord(evidence) ||
      (!hasSource(evidence, 'oneworld') && !hasSource(evidence, 'priority-pass'))
    ) {
      continue;
    }
    const airportCode = clean(evidence.airport.iata).toUpperCase();
    const airportAuthorities = authoritiesByAirport.get(airportCode) ?? [];
    const matches = airportAuthorities.filter(
      (authority) =>
        aenaNamesCompatible(authority, evidence, airportAuthorities.length) &&
        aenaLocationCompatible(authority, evidence),
    );
    if (matches.length !== 1) {
      continue;
    }
    const authority = matches[0];
    matchesByAuthority.set(authority.lounge.id, [
      ...(matchesByAuthority.get(authority.lounge.id) ?? []),
      evidence,
    ]);
    consumed.add(evidence.lounge.id);
  }

  const merged = [];
  for (const record of records) {
    if (consumed.has(record.lounge.id)) {
      continue;
    }
    if (!isAenaAuthorityRecord(record)) {
      merged.push(record);
      continue;
    }
    const evidenceRows = matchesByAuthority.get(record.lounge.id) ?? [];
    if (evidenceRows.length === 0) {
      merged.push(record);
      continue;
    }
    const anchor = [record, ...evidenceRows].sort(
      (first, second) => aenaAnchorPreference(first) - aenaAnchorPreference(second),
    )[0];
    const combined = evidenceRows.reduce(
      (current, evidence) => mergeCanonicalRecords(current, evidence),
      record,
    );
    merged.push({
      ...combined,
      lounge: {
        ...combined.lounge,
        id: anchor.lounge.id,
        name: record.lounge.name,
        brand: record.lounge.brand,
        operator: record.lounge.operator,
      },
      location: {
        ...combined.location,
        terminal: record.location.terminal || combined.location.terminal,
        concourse: record.location.concourse || combined.location.concourse,
        gate: record.location.gate || combined.location.gate,
        securitySide: record.location.securitySide || combined.location.securitySide,
        directions: record.location.directions || combined.location.directions,
      },
      operations: {
        ...combined.operations,
        hours: record.operations.hours || combined.operations.hours,
        exceptions: cleanList([...(record.operations.exceptions ?? []), ...(combined.operations.exceptions ?? [])]),
        plannedOpening: record.operations.plannedOpening || combined.operations.plannedOpening,
        lastVerifiedAt: latestIsoDate(
          [record.operations.lastVerifiedAt, combined.operations.lastVerifiedAt],
          combined.operations.lastVerifiedAt,
        ),
      },
      notes: cleanList([...combined.notes, 'Merged Aena lounge evidence by unique airport identity and published position.']),
    });
  }
  return merged;
}

function mergeAlaskaAuthorityRecords(records) {
  const authorityRows = records.filter((record) => hasSource(record, 'alaska-airlines'));
  const matchesByAuthority = new Map();

  for (const evidence of records) {
    if (hasSource(evidence, 'alaska-airlines')) {
      continue;
    }
    const matches = authorityRows.filter(
      (authority) =>
        clean(authority.airport.iata).toUpperCase() === clean(evidence.airport.iata).toUpperCase() &&
        sameExactLoungeIdentity(authority, evidence) &&
        alaskaLocationCompatible(authority, evidence),
    );
    if (matches.length !== 1) {
      continue;
    }
    const authority = matches[0];
    matchesByAuthority.set(authority.lounge.id, [...(matchesByAuthority.get(authority.lounge.id) ?? []), evidence]);
  }

  const consumed = new Set([...matchesByAuthority.values()].flat().map((record) => record.lounge.id));
  const merged = [];
  for (const record of records) {
    if (consumed.has(record.lounge.id)) {
      continue;
    }
    if (!hasSource(record, 'alaska-airlines')) {
      merged.push(record);
      continue;
    }
    const evidenceRows = matchesByAuthority.get(record.lounge.id) ?? [];
    if (evidenceRows.length === 0) {
      merged.push(record);
      continue;
    }
    const anchor = [...evidenceRows].sort(
      (first, second) => existingRecordPreference(first) - existingRecordPreference(second),
    )[0];
    const combined = [record, ...evidenceRows].reduce((current, evidence) => mergeCanonicalRecords(current, evidence));
    merged.push({
      ...combined,
      lounge: {
        ...combined.lounge,
        id: anchor.lounge.id,
        name: anchor.lounge.name,
      },
      notes: cleanList([...combined.notes, 'Merged Alaska-owned lounge evidence by published airport position.']),
    });
  }
  return merged;
}

function mergeCenturionAuthorityRecords(records) {
  const centurionIdentityKey = (record) => {
    const text = normalizeIdentityText(
      [record.lounge.name, record.lounge.brand, record.lounge.operator].join(' '),
    );
    if (!hasSource(record, 'amex-global-lounge-collection') && !/\bcenturion\b/.test(text)) {
      return '';
    }
    const airportCode = clean(record.airport.iata).toUpperCase();
    return `${airportCode}|${/\bsidecar\b/.test(text) ? 'sidecar' : 'centurion-lounge'}`;
  };
  const groups = new Map();
  for (const record of records) {
    const key = centurionIdentityKey(record);
    if (key) {
      groups.set(key, [...(groups.get(key) ?? []), record]);
    }
  }

  const consumed = new Set();
  const replacements = new Map();
  for (const group of groups.values()) {
    const authorityRows = group.filter((record) => hasSource(record, 'amex-global-lounge-collection'));
    if (authorityRows.length !== 1 || group.length < 2) {
      continue;
    }
    const authority = authorityRows[0];
    const existingRows = group.filter((record) => record.lounge.id !== authority.lounge.id);
    const anchor = [...existingRows].sort(
      (first, second) => existingRecordPreference(first) - existingRecordPreference(second),
    )[0] ?? authority;
    const combined = group.reduce((current, record) => mergeCanonicalRecords(current, record));
    replacements.set(anchor.lounge.id, {
      ...combined,
      lounge: {
        ...combined.lounge,
        id: anchor.lounge.id,
        name: authority.lounge.name,
        brand: authority.lounge.brand,
        operator: authority.lounge.operator,
      },
      location: {
        ...combined.location,
        terminal: authority.location.terminal || combined.location.terminal,
        concourse: authority.location.concourse || combined.location.concourse,
        gate: authority.location.gate || combined.location.gate,
        securitySide: authority.location.securitySide || combined.location.securitySide,
        directions: authority.location.directions || combined.location.directions,
      },
      operations: {
        ...combined.operations,
        hours: authority.operations.hours || combined.operations.hours,
        lastVerifiedAt: latestIsoDate(
          [authority.operations.lastVerifiedAt, combined.operations.lastVerifiedAt],
          combined.operations.lastVerifiedAt,
        ),
      },
      notes: cleanList([
        ...combined.notes,
        'Merged Centurion Lounge evidence by airport-scoped operator authority.',
      ]),
    });
    for (const record of group) {
      if (record.lounge.id !== anchor.lounge.id) {
        consumed.add(record.lounge.id);
      }
    }
  }

  return records
    .filter((record) => !consumed.has(record.lounge.id))
    .map((record) => replacements.get(record.lounge.id) ?? record);
}

function aspireProductIdentity(record) {
  const text = normalizeIdentityText(
    [record.lounge.name, record.lounge.brand, record.lounge.operator].join(' '),
  );
  if (/\bluxe\b.*\baspire\b/.test(text)) return 'luxe-by-aspire';
  if (/\bsuite\b.*\baspire\b/.test(text)) return 'suite-by-aspire';
  if (/\bnorthern lights\b/.test(text)) return 'northern-lights';
  if (/\bupperdeck\b|\bupper deck\b/.test(text)) return 'upperdeck';
  if (/\bclub aspire\b/.test(text)) return 'club-aspire';
  if (/\bclubrooms\b/.test(text)) return 'clubrooms';
  if (/\bmy lounge\b/.test(text)) return 'my-lounge';
  if (/\bno\s*1\b/.test(text)) return 'no1-lounge';
  if (/\baspire\b/.test(text)) return 'aspire-lounge';
  return '';
}

function aspirePositionText(record) {
  return clean(
    [
      record.lounge.name,
      record.location.terminal,
      record.location.gate,
      ...record.sources.map((source) => source.url),
    ].join(' '),
  );
}

function aspireTerminalTokens(record) {
  const tokens = new Set(terminalNumberTokens(normalizeTerminalForEnrichment(record.location.terminal)));
  for (const match of aspirePositionText(record).matchAll(/\b(?:terminal|t)[-\s]*([0-9])(?:\s*[/&]\s*([0-9]))?/gi)) {
    tokens.add(match[1]);
    if (match[2]) tokens.add(match[2]);
  }
  return tokens;
}

function aspireDirectionTokens(record) {
  return new Set(
    [...normalizeIdentityText(aspirePositionText(record)).matchAll(/\b(?:north|south)\b/g)].map((match) => match[0]),
  );
}

function aspireGateZoneTokens(record) {
  const tokens = new Set();
  for (const match of aspirePositionText(record).matchAll(/\b([A-Z])\s+Gates?\b/gi)) {
    tokens.add(match[1].toUpperCase());
  }
  for (const source of record.sources) {
    for (const match of clean(source.url).matchAll(/-([a-z])-gates(?:\/|$)/gi)) {
      tokens.add(match[1].toUpperCase());
    }
  }
  return tokens;
}

function tokenSetsEqual(first, second) {
  return first.size === second.size && [...first].every((token) => second.has(token));
}

function aspirePositionsConflict(first, second) {
  const firstTerminals = aspireTerminalTokens(first);
  const secondTerminals = aspireTerminalTokens(second);
  if (firstTerminals.size > 0 && secondTerminals.size > 0 && !tokenSetsEqual(firstTerminals, secondTerminals)) {
    return true;
  }

  const firstDirections = aspireDirectionTokens(first);
  const secondDirections = aspireDirectionTokens(second);
  if (hasConflictingTokenSet(firstDirections, secondDirections)) {
    return true;
  }

  const firstGateZones = aspireGateZoneTokens(first);
  const secondGateZones = aspireGateZoneTokens(second);
  if (hasConflictingTokenSet(firstGateZones, secondGateZones)) {
    return true;
  }

  return !publishedGatesCompatible(first.location.gate, second.location.gate);
}

function aspireAuthorityMatch(authority, evidence) {
  const sameNamedProduct = sameExactLoungeIdentity(authority, evidence) || samePhysicalNameIdentity(authority, evidence);
  const sameOperatorProduct =
    aspireProductIdentity(authority) && aspireProductIdentity(authority) === aspireProductIdentity(evidence);
  return (
    clean(authority.airport.iata).toUpperCase() === clean(evidence.airport.iata).toUpperCase() &&
    (sameNamedProduct || sameOperatorProduct) &&
    !aspirePositionsConflict(authority, evidence)
  );
}

function isAspireBookingUmbrella(record) {
  return aspireGateZoneTokens(record).size === 0 && !isExactGateEvidence(record.location.gate);
}

function aspireAnchorPreference(record) {
  if (hasSource(record, 'priority-pass')) return 0;
  if (hasSource(record, 'airport-official-pages')) return 1;
  if (hasSource(record, 'oneworld')) return 2;
  if (hasSource(record, 'no1-lounges')) return 3;
  return 4;
}

function compositeTerminalSupersededByAuthority(record, authorities) {
  const recordTerminals = aspireTerminalTokens(record);
  if (recordTerminals.size < 2 || !isAspireBookingUmbrella(record)) {
    return false;
  }
  const overlapping = authorities.filter((authority) => {
    if (
      clean(authority.airport.iata).toUpperCase() !== clean(record.airport.iata).toUpperCase() ||
      aspireProductIdentity(authority) !== aspireProductIdentity(record)
    ) {
      return false;
    }
    const authorityTerminals = aspireTerminalTokens(authority);
    return authorityTerminals.size === 1 && [...authorityTerminals].some((token) => recordTerminals.has(token));
  });
  return overlapping.length === 1;
}

function mergeAspireAuthorityRecords(records) {
  const authorities = records.filter((record) => hasSource(record, 'aspire-lounges'));
  if (authorities.length === 0) {
    return records;
  }

  const matchesByAuthority = new Map();
  const discarded = new Set();
  for (const evidence of records) {
    if (hasSource(evidence, 'aspire-lounges') || !aspireProductIdentity(evidence)) {
      continue;
    }
    const matches = authorities.filter((authority) => aspireAuthorityMatch(authority, evidence));
    if (matches.length === 1) {
      const authority = matches[0];
      matchesByAuthority.set(authority.lounge.id, [...(matchesByAuthority.get(authority.lounge.id) ?? []), evidence]);
      continue;
    }
    if ((matches.length > 1 && isAspireBookingUmbrella(evidence)) || compositeTerminalSupersededByAuthority(evidence, authorities)) {
      discarded.add(evidence.lounge.id);
    }
  }

  const consumed = new Set(discarded);
  const replacements = new Map();
  for (const authority of authorities) {
    const evidenceRows = matchesByAuthority.get(authority.lounge.id) ?? [];
    if (evidenceRows.length === 0) {
      continue;
    }
    const group = [authority, ...evidenceRows];
    const hasPositionConflict = group.some((record, index) =>
      group.slice(index + 1).some((candidate) => aspirePositionsConflict(record, candidate)),
    );
    if (hasPositionConflict) {
      continue;
    }

    const anchor = [...evidenceRows].sort(
      (first, second) => aspireAnchorPreference(first) - aspireAnchorPreference(second),
    )[0] ?? authority;
    const combined = group.reduce((current, record) => mergeCanonicalRecords(current, record));
    replacements.set(anchor.lounge.id, {
      ...combined,
      lounge: {
        ...combined.lounge,
        id: anchor.lounge.id,
        name: anchor.lounge.name,
        brand: authority.lounge.brand,
        operator: authority.lounge.operator,
      },
      location: {
        ...combined.location,
        terminal: hasValue(authority.location.terminal) ? authority.location.terminal : combined.location.terminal,
        gate: pickMoreSpecificPosition(authority.location.gate, combined.location.gate),
      },
      operations: {
        ...combined.operations,
        hours: authority.operations.hours || combined.operations.hours,
        lastVerifiedAt: latestIsoDate(
          [authority.operations.lastVerifiedAt, combined.operations.lastVerifiedAt],
          combined.operations.lastVerifiedAt,
        ),
      },
      notes: cleanList([...combined.notes, 'Merged Aspire operator evidence by physical lounge identity and position.']),
    });
    for (const record of group) {
      if (record.lounge.id !== anchor.lounge.id) {
        consumed.add(record.lounge.id);
      }
    }
  }

  return records
    .filter((record) => !consumed.has(record.lounge.id))
    .map((record) => replacements.get(record.lounge.id) ?? record);
}

function mergeNo1AuthorityRecords(records) {
  const authorities = records.filter((record) => hasSource(record, 'no1-lounges'));
  if (authorities.length === 0) {
    return records;
  }

  const matchesByAuthority = new Map();
  for (const evidence of records) {
    if (hasSource(evidence, 'no1-lounges') || !aspireProductIdentity(evidence)) {
      continue;
    }
    const matches = authorities.filter((authority) => aspireAuthorityMatch(authority, evidence));
    if (matches.length !== 1) {
      continue;
    }
    const authority = matches[0];
    matchesByAuthority.set(authority.lounge.id, [...(matchesByAuthority.get(authority.lounge.id) ?? []), evidence]);
  }

  const consumed = new Set();
  const replacements = new Map();
  for (const authority of authorities) {
    const evidenceRows = matchesByAuthority.get(authority.lounge.id) ?? [];
    if (evidenceRows.length === 0) {
      continue;
    }
    const group = [authority, ...evidenceRows];
    if (
      group.some((record, index) =>
        group.slice(index + 1).some((candidate) => aspirePositionsConflict(record, candidate)),
      )
    ) {
      continue;
    }

    const anchor = [...evidenceRows].sort(
      (first, second) => aspireAnchorPreference(first) - aspireAnchorPreference(second),
    )[0] ?? authority;
    const combined = group.reduce((current, record) => mergeCanonicalRecords(current, record));
    replacements.set(anchor.lounge.id, {
      ...combined,
      lounge: {
        ...combined.lounge,
        id: anchor.lounge.id,
        name: anchor.lounge.name,
        brand: authority.lounge.brand,
        operator: authority.lounge.operator,
      },
      location: {
        ...combined.location,
        terminal: hasValue(authority.location.terminal) ? authority.location.terminal : combined.location.terminal,
        gate: pickMoreSpecificPosition(authority.location.gate, combined.location.gate),
      },
      operations: {
        ...combined.operations,
        hours: authority.operations.hours || combined.operations.hours,
        lastVerifiedAt: latestIsoDate(
          [authority.operations.lastVerifiedAt, combined.operations.lastVerifiedAt],
          combined.operations.lastVerifiedAt,
        ),
      },
      notes: cleanList([...combined.notes, 'Merged No1 operator evidence by physical lounge identity and position.']),
    });
    for (const record of group) {
      if (record.lounge.id !== anchor.lounge.id) {
        consumed.add(record.lounge.id);
      }
    }
  }

  return records
    .filter((record) => !consumed.has(record.lounge.id))
    .map((record) => replacements.get(record.lounge.id) ?? record);
}

function theClubProductIdentity(record) {
  const text = normalizeIdentityText(
    [record.lounge.name, record.lounge.brand, record.lounge.operator].join(' '),
  );
  if (/\bchase sapphire\b/.test(text)) return '';
  if (/\bkyra\b.*\btaste of priceless\b/.test(text)) return 'kyra-taste-of-priceless';
  if (/\bkyra\b/.test(text)) return 'kyra-lounge';
  if (/\bthe lounge boston\b/.test(text)) return 'the-lounge-boston';
  if (/\bthe club\b/.test(text)) return 'the-club';
  return '';
}

function theClubPositionText(record) {
  return clean(
    [
      record.lounge.name,
      record.location.terminal,
      record.location.concourse,
      record.location.gate,
      record.location.directions,
      ...recordSourcePathTails(record),
    ].join(' '),
  );
}

function theClubZoneTokens(record) {
  const primaryText = normalizeIdentityText(
    [
      record.lounge.name,
      record.location.terminal,
      record.location.concourse,
      record.location.gate,
      ...recordSourcePathTails(record),
    ].join(' '),
  );
  const tokens = new Set();
  for (const match of primaryText.matchAll(/\bconcourse\s+([a-z])\b|\b([a-z])\s+concourse\b|\bterminal\s+([a-z])\b/g)) {
    tokens.add((match[1] ?? match[2] ?? match[3]).toUpperCase());
  }
  for (const token of publishedGatePrefixTokens(record.location.gate)) {
    tokens.add(token);
  }
  if (/\b(?:south satellite|satellite south|s gate lounge)\b/.test(primaryText)) {
    tokens.add('S');
  }
  if (tokens.size === 0) {
    const directions = normalizeIdentityText(record.location.directions);
    for (const match of directions.matchAll(/\bconcourse\s+([a-z])\b|\b([a-z])\s+concourse\b/g)) {
      tokens.add((match[1] ?? match[2]).toUpperCase());
    }
    if (/\b(?:south satellite|satellite south|s gate lounge)\b/.test(directions)) {
      tokens.add('S');
    }
  }
  return tokens;
}

function theClubScopeTokens(record) {
  return scopePositionTokens(
    [
      record.lounge.name,
      record.location.terminal,
      record.location.concourse,
      record.location.gate,
      ...recordSourcePathTails(record),
    ].join(' '),
  );
}

function theClubExactGateCodeTokens(record) {
  return new Set(
    [...clean(theClubPositionText(record)).toUpperCase().matchAll(/\b([A-Z]\d{1,3}[A-Z]?)\b/g)].map(
      (match) => match[1],
    ),
  );
}

function theClubGateRangeContains(rangeValue, gateValue) {
  const range = clean(rangeValue).match(/\bGates?\s+([A-Z]?)(\d+)\s*[-–]\s*([A-Z]?)(\d+)\b/i);
  const gate = clean(gateValue).match(/\bGate\s+([A-Z]?)(\d+)\b/i);
  if (!range || !gate) {
    return false;
  }
  const rangePrefix = (range[1] || range[3]).toUpperCase();
  const gatePrefix = gate[1].toUpperCase();
  if (rangePrefix && gatePrefix && rangePrefix !== gatePrefix) {
    return false;
  }
  const start = Number(range[2]);
  const end = Number(range[4]);
  const value = Number(gate[2]);
  return Number.isFinite(value) && value >= Math.min(start, end) && value <= Math.max(start, end);
}

function theClubPublishedGatesCompatible(first, second) {
  return (
    publishedGatesCompatible(first, second) ||
    theClubGateRangeContains(first, second) ||
    theClubGateRangeContains(second, first)
  );
}

function theClubLocationsCompatible(authority, evidence, authorityCount, { allowZoneGateConflict = false } = {}) {
  const authorityExactGates = theClubExactGateCodeTokens(authority);
  const evidenceExactGates = theClubExactGateCodeTokens(evidence);
  const exactGateCodeMatch =
    authorityExactGates.size > 0 && [...authorityExactGates].some((gate) => evidenceExactGates.has(gate));
  const exactGateCodeConflict =
    authorityExactGates.size > 0 && evidenceExactGates.size > 0 && !exactGateCodeMatch;
  const publishedGateCompatibility = theClubPublishedGatesCompatible(
    authority.location.gate,
    evidence.location.gate,
  );
  if (
    hasConflictingTokenSet(publishedMovementTokens(authority), publishedMovementTokens(evidence)) ||
    hasConflictingTokenSet(theClubScopeTokens(authority), theClubScopeTokens(evidence)) ||
    (!allowZoneGateConflict && exactGateCodeConflict) ||
    (!allowZoneGateConflict && !publishedGateCompatibility && !exactGateCodeMatch)
  ) {
    return false;
  }

  const authorityZones = theClubZoneTokens(authority);
  const evidenceZones = theClubZoneTokens(evidence);
  if (hasConflictingTokenSet(authorityZones, evidenceZones)) {
    return false;
  }

  const zoneMatch = authorityZones.size > 0 && [...authorityZones].some((zone) => evidenceZones.has(zone));
  const exactPositionMatch = exactPublishedLocationTextMatch(authority.location.gate, evidence.location.gate);
  const rangeMatch =
    theClubGateRangeContains(authority.location.gate, evidence.location.gate) ||
    theClubGateRangeContains(evidence.location.gate, authority.location.gate);
  const authorityScopes = theClubScopeTokens(authority);
  const evidenceScopes = theClubScopeTokens(evidence);
  const scopeMatch = authorityScopes.size > 0 && [...authorityScopes].some((scope) => evidenceScopes.has(scope));
  const terminalsCompatible = priceEvidenceTerminalsCompatible(
    authority.location.terminal,
    evidence.location.terminal,
  );

  if (authorityCount > 1) {
    return zoneMatch || exactGateCodeMatch || exactPositionMatch || rangeMatch || scopeMatch || enrichmentTerminalsCompatible(
      authority.location.terminal,
      evidence.location.terminal,
    );
  }
  return terminalsCompatible || zoneMatch || exactGateCodeMatch || exactPositionMatch || rangeMatch || scopeMatch;
}

function theClubAnchorPreference(record) {
  if (hasSource(record, 'priority-pass')) return 0;
  if (hasSource(record, 'airport-official-pages')) return 1;
  if (hasSource(record, 'oneworld')) return 2;
  if (hasSource(record, 'no1-lounges')) return 3;
  return 4;
}

function theClubPreferredTerminal(authority, combined) {
  const authorityTerminal = authority.location.terminal;
  const combinedTerminal = combined.location.terminal;
  if (!hasValue(authorityTerminal)) return combinedTerminal;
  if (!hasValue(combinedTerminal)) return authorityTerminal;
  if (isGenericTerminalForPriceEvidence(authorityTerminal) && !isGenericTerminalForPriceEvidence(combinedTerminal)) {
    return combinedTerminal;
  }
  const authorityZones = theClubZoneTokens(authority);
  const combinedZones = theClubZoneTokens(combined);
  const sameZone = authorityZones.size > 0 && [...authorityZones].some((zone) => combinedZones.has(zone));
  return sameZone && clean(combinedTerminal).length > clean(authorityTerminal).length
    ? combinedTerminal
    : authorityTerminal;
}

function mergeTheClubAuthorityRecords(records) {
  const authorities = records.filter((record) => hasSource(record, 'airport-dimensions') && theClubProductIdentity(record));
  if (authorities.length === 0) {
    return records;
  }

  const matchesByAuthority = new Map();
  for (const evidence of records) {
    const productIdentity = theClubProductIdentity(evidence);
    if (hasSource(evidence, 'airport-dimensions') || !productIdentity) {
      continue;
    }
    const airportAuthorities = authorities.filter(
      (authority) =>
        clean(authority.airport.iata).toUpperCase() === clean(evidence.airport.iata).toUpperCase() &&
        theClubProductIdentity(authority) === productIdentity,
    );
    const strictMatches = airportAuthorities.filter((authority) =>
      theClubLocationsCompatible(authority, evidence, airportAuthorities.length),
    );
    const matches = strictMatches.length > 0
      ? strictMatches
      : airportAuthorities.filter((authority) =>
          theClubLocationsCompatible(authority, evidence, airportAuthorities.length, { allowZoneGateConflict: true }),
        );
    if (matches.length !== 1) {
      continue;
    }
    const authority = matches[0];
    matchesByAuthority.set(authority.lounge.id, [...(matchesByAuthority.get(authority.lounge.id) ?? []), evidence]);
  }

  const consumed = new Set();
  const replacements = new Map();
  for (const authority of authorities) {
    const evidenceRows = matchesByAuthority.get(authority.lounge.id) ?? [];
    if (evidenceRows.length === 0) {
      continue;
    }
    const group = [authority, ...evidenceRows];
    const anchor = [...evidenceRows].sort(
      (first, second) =>
        theClubAnchorPreference(first) - theClubAnchorPreference(second) ||
        recordDetailScore(second) - recordDetailScore(first) ||
        first.lounge.id.localeCompare(second.lounge.id),
    )[0] ?? authority;
    const combined = group.reduce((current, record) => mergeCanonicalRecords(current, record));
    replacements.set(anchor.lounge.id, {
      ...combined,
      lounge: {
        ...combined.lounge,
        id: anchor.lounge.id,
        name: authority.lounge.name,
        brand: authority.lounge.brand,
        operator: authority.lounge.operator,
      },
      location: {
        ...combined.location,
        terminal: theClubPreferredTerminal(authority, combined),
        concourse: authority.location.concourse || combined.location.concourse,
        gate: authority.location.gate || combined.location.gate,
        securitySide: authority.location.securitySide || combined.location.securitySide,
        directions: authority.location.directions || combined.location.directions,
      },
      operations: {
        ...combined.operations,
        hours: authority.operations.hours || combined.operations.hours,
        lastVerifiedAt: latestIsoDate(
          [authority.operations.lastVerifiedAt, combined.operations.lastVerifiedAt],
          combined.operations.lastVerifiedAt,
        ),
      },
      notes: cleanList([
        ...combined.notes,
        'Merged Airport Dimensions operator evidence by exact physical lounge identity and published position.',
      ]),
    });
    for (const record of group) {
      if (record.lounge.id !== anchor.lounge.id) {
        consumed.add(record.lounge.id);
      }
    }
  }

  return records
    .filter((record) => !consumed.has(record.lounge.id))
    .map((record) => replacements.get(record.lounge.id) ?? record);
}

function primeclassProductIdentity(record) {
  const text = normalizeIdentityText(
    [record.lounge.name, record.lounge.brand, record.lounge.operator].join(' '),
  );
  const namedProducts = [
    ['turkish-airlines', /\bturkish airlines\b/],
    ['qatar-airways', /\bqatar airways\b/],
    ['extime', /\bextime\b/],
    ['hellosky', /\bhellosky\b/],
    ['desierto', /\bdesierto\b/],
    ['isla-de-pascua', /\bisla de pascua\b/],
    ['metropolis', /\bmetropolis\b/],
    ['patagonia', /\bpatagonia\b/],
    ['comfort', /\bcomfort\b/],
    ['lagos', /\blagos\b/],
    ['condor', /\bcondor\b/],
    ['andes', /\bandes\b/],
  ];
  for (const [identity, pattern] of namedProducts) {
    if (pattern.test(text)) return identity;
  }
  return /\bprimeclass\b/.test(text) ? 'primeclass' : '';
}

function primeclassPositionText(record) {
  return normalizeIdentityText(
    [
      record.lounge.name,
      record.location.terminal,
      record.location.gate,
      record.location.directions,
      ...recordSourcePathTails(record),
    ].join(' '),
  ).replace(/\binternational airport\b/g, 'airport');
}

function primeclassMovementTokens(record) {
  return publishedMovementTokens(record);
}

function primeclassScopeTokens(record) {
  return scopePositionTokens(primeclassPositionText(record));
}

function isPrimeclassVipProduct(record) {
  return /\bvip\b|\bcip\b|\bgeneral aviation\b/.test(primeclassPositionText(record));
}

function primeclassLocationsCompatible(authority, evidence, { authorityCount = 1 } = {}) {
  if (
    hasConflictingTokenSet(primeclassMovementTokens(authority), primeclassMovementTokens(evidence)) ||
    hasConflictingTokenSet(primeclassScopeTokens(authority), primeclassScopeTokens(evidence)) ||
    (authorityCount > 1 && isPrimeclassVipProduct(authority) !== isPrimeclassVipProduct(evidence))
  ) {
    return false;
  }

  const authorityTerminal = normalizeTerminalForEnrichment(authority.location.terminal);
  const evidenceTerminal = normalizeTerminalForEnrichment(evidence.location.terminal);
  return (
    !hasConflictingTokenSet(terminalNumberTokens(authorityTerminal), terminalNumberTokens(evidenceTerminal)) &&
    !hasConflictingTokenSet(terminalLetterTokens(authority.location.terminal), terminalLetterTokens(evidence.location.terminal)) &&
    !hasConflictingTokenSet(concourseTokens(authorityTerminal), concourseTokens(evidenceTerminal))
  );
}

function primeclassAnchorPreference(record) {
  if (hasSource(record, 'priority-pass')) return 0;
  if (hasSource(record, 'airport-official-pages')) return 1;
  if (hasSource(record, 'oneworld')) return 2;
  if (hasSource(record, 'plaza-premium')) return 3;
  return 4;
}

function mergePrimeclassAuthorityRecords(records) {
  const authorities = records.filter((record) => hasSource(record, 'primeclass'));
  if (authorities.length === 0) {
    return records;
  }

  const matchesByAuthority = new Map();
  for (const evidence of records) {
    const productIdentity = primeclassProductIdentity(evidence);
    if (hasSource(evidence, 'primeclass') || !productIdentity) {
      continue;
    }
    const airportAuthorities = authorities.filter(
      (authority) =>
        clean(authority.airport.iata).toUpperCase() === clean(evidence.airport.iata).toUpperCase() &&
        primeclassProductIdentity(authority) === productIdentity,
    );
    const matches = airportAuthorities.filter((authority) =>
      primeclassLocationsCompatible(authority, evidence, { authorityCount: airportAuthorities.length }),
    );
    if (matches.length !== 1) {
      continue;
    }
    const authority = matches[0];
    matchesByAuthority.set(authority.lounge.id, [...(matchesByAuthority.get(authority.lounge.id) ?? []), evidence]);
  }

  const consumed = new Set();
  const replacements = new Map();
  for (const authority of authorities) {
    const evidenceRows = matchesByAuthority.get(authority.lounge.id) ?? [];
    if (evidenceRows.length === 0) {
      continue;
    }
    const group = [authority, ...evidenceRows];
    const anchor = [...evidenceRows].sort(
      (first, second) => primeclassAnchorPreference(first) - primeclassAnchorPreference(second),
    )[0] ?? authority;
    const combined = group.reduce((current, record) => mergeCanonicalRecords(current, record));
    replacements.set(anchor.lounge.id, {
      ...combined,
      lounge: {
        ...combined.lounge,
        id: anchor.lounge.id,
        name: anchor.lounge.name,
        brand: authority.lounge.brand,
        operator: authority.lounge.operator,
      },
      location: {
        ...combined.location,
        terminal: authority.location.terminal || combined.location.terminal,
        concourse: authority.location.concourse || combined.location.concourse,
        gate: authority.location.gate || combined.location.gate,
        securitySide: authority.location.securitySide || combined.location.securitySide,
        directions: authority.location.directions || combined.location.directions,
      },
      operations: {
        ...combined.operations,
        hours: authority.operations.hours || combined.operations.hours,
        lastVerifiedAt: latestIsoDate(
          [authority.operations.lastVerifiedAt, combined.operations.lastVerifiedAt],
          combined.operations.lastVerifiedAt,
        ),
      },
      notes: cleanList([
        ...combined.notes,
        'Merged Primeclass operator evidence by physical lounge identity and published travel scope.',
      ]),
    });
    for (const record of group) {
      if (record.lounge.id !== anchor.lounge.id) {
        consumed.add(record.lounge.id);
      }
    }
  }

  return records
    .filter((record) => !consumed.has(record.lounge.id))
    .map((record) => replacements.get(record.lounge.id) ?? record);
}

function enrichFromCrossSourceAirlineExactIdentityHours(records) {
  const evidenceRows = records.filter((record) => {
    const source = officialAirlinePublishedHoursSource(record);
    return source && hasValue(record.operations.hours);
  });
  const matches = [];

  for (const record of records) {
    if (
      hasValue(record.operations.hours) ||
      (!hasSource(record, 'oneworld') && !hasSource(record, 'airport-official-pages'))
    ) {
      continue;
    }

    for (const evidence of evidenceRows) {
      const evidenceSource = officialAirlinePublishedHoursSource(evidence);
      if (
        evidence.lounge.id !== record.lounge.id &&
        evidenceSource &&
        !hasSource(record, evidenceSource.sourceId) &&
        clean(evidence.airport.iata).toUpperCase() === clean(record.airport.iata).toUpperCase() &&
        exactAirlineOwnedHoursIdentity(record, evidence) &&
        crossSourceAirlineHoursLocationsCompatible(record, evidence)
      ) {
        matches.push({ record, evidence, evidenceSource });
      }
    }
  }

  const matchesByRecord = new Map();
  const matchesByEvidence = new Map();
  for (const match of matches) {
    matchesByRecord.set(match.record.lounge.id, [...(matchesByRecord.get(match.record.lounge.id) ?? []), match]);
    matchesByEvidence.set(match.evidence.lounge.id, [...(matchesByEvidence.get(match.evidence.lounge.id) ?? []), match]);
  }

  return records.map((record) => {
    const recordMatches = matchesByRecord.get(record.lounge.id) ?? [];
    if (recordMatches.length !== 1) {
      return record;
    }

    const [{ evidence, evidenceSource }] = recordMatches;
    if ((matchesByEvidence.get(evidence.lounge.id) ?? []).length !== 1) {
      return record;
    }

    const hoursSource = sourceWithFieldCoverage(evidenceSource, ['operations.hours']);
    if (!hoursSource) {
      return record;
    }

    return {
      ...record,
      operations: {
        ...record.operations,
        hours: evidence.operations.hours,
        lastVerifiedAt: latestIsoDate(
          [record.operations.lastVerifiedAt, hoursSource.retrievedAt],
          record.operations.lastVerifiedAt,
        ),
      },
      notes: cleanList([...record.notes, 'Official airline page supplied one-to-one exact-identity hours evidence.']),
      sources: mergeUniqueBySourceId([...record.sources, hoursSource]),
    };
  });
}

function enrichAirportOfficialRecordsFromExactPublishedHours(records) {
  const evidenceRows = records.filter((record) => {
    const source = officialPublishedHoursSource(record);
    return source && hasValue(record.operations.hours);
  });
  const matches = [];

  for (const record of records) {
    if (!officialAirportSource(record) || hasValue(record.operations.hours)) {
      continue;
    }

    for (const evidence of evidenceRows) {
      if (
        evidence.lounge.id !== record.lounge.id &&
        clean(evidence.airport.iata).toUpperCase() === clean(record.airport.iata).toUpperCase() &&
        exactPublishedHoursIdentity(record, evidence) &&
        sameAirportConcourse(record, evidence) &&
        exactPublishedPositionMatch(record.location.gate, evidence.location.gate)
      ) {
        matches.push({ record, evidence });
      }
    }
  }

  const matchesByRecord = new Map();
  const matchesByEvidence = new Map();
  for (const match of matches) {
    matchesByRecord.set(match.record.lounge.id, [...(matchesByRecord.get(match.record.lounge.id) ?? []), match]);
    matchesByEvidence.set(match.evidence.lounge.id, [...(matchesByEvidence.get(match.evidence.lounge.id) ?? []), match]);
  }

  return records.map((record) => {
    const recordMatches = matchesByRecord.get(record.lounge.id) ?? [];
    if (recordMatches.length !== 1) {
      return record;
    }

    const [{ evidence }] = recordMatches;
    if ((matchesByEvidence.get(evidence.lounge.id) ?? []).length !== 1) {
      return record;
    }

    const source = officialPublishedHoursSource(evidence);
    const hoursSource = sourceWithFieldCoverage(source, ['operations.hours']);
    if (!hoursSource) {
      return record;
    }

    return {
      ...record,
      operations: {
        ...record.operations,
        hours: evidence.operations.hours,
        lastVerifiedAt: latestIsoDate(
          [record.operations.lastVerifiedAt, hoursSource.retrievedAt],
          record.operations.lastVerifiedAt,
        ),
      },
      notes: cleanList([...record.notes, 'Official airline or alliance page supplied exact-position hours evidence.']),
      sources: mergeUniqueBySourceId([...record.sources, hoursSource]),
    };
  });
}

function sameSourceHoursSource(record, sourceId) {
  const source = record.sources.find(
    (candidate) => candidate.sourceId === sourceId && candidate.fieldCoverage.includes('operations.hours'),
  );
  return sourceWithFieldCoverage(source, ['operations.hours']);
}

function hasConflictingPublishedPositionNumbers(first, second) {
  return hasConflictingTokenSet(gateIdentityTokens(first), gateIdentityTokens(second));
}

function enrichFromSameSourceExactIdentityHours(records) {
  const sourceIds = ['oneworld', 'delta', 'air-canada', 'qatar-airways', 'singapore-airlines', 'american', 'qantas'];
  const matches = [];

  for (const sourceId of sourceIds) {
    const evidenceRows = records.filter((record) => hasValue(record.operations.hours) && sameSourceHoursSource(record, sourceId));
    for (const record of records) {
      if (hasValue(record.operations.hours) || !hasSource(record, sourceId)) {
        continue;
      }

      for (const evidence of evidenceRows) {
        if (
          evidence.lounge.id !== record.lounge.id &&
          clean(evidence.airport.iata).toUpperCase() === clean(record.airport.iata).toUpperCase() &&
          sameExactLoungeIdentity(record, evidence) &&
          allianceEvidenceTerminalsCompatible(record.location.terminal, evidence.location.terminal) &&
          !hasConflictingPublishedPositionNumbers(record.location.gate, evidence.location.gate)
        ) {
          matches.push({ record, evidence, sourceId });
        }
      }
    }
  }

  const matchesByRecord = new Map();
  const matchesByEvidence = new Map();
  for (const match of matches) {
    matchesByRecord.set(match.record.lounge.id, [...(matchesByRecord.get(match.record.lounge.id) ?? []), match]);
    matchesByEvidence.set(match.evidence.lounge.id, [...(matchesByEvidence.get(match.evidence.lounge.id) ?? []), match]);
  }

  return records.map((record) => {
    const recordMatches = matchesByRecord.get(record.lounge.id) ?? [];
    if (recordMatches.length !== 1) {
      return record;
    }

    const [{ evidence, sourceId }] = recordMatches;
    if ((matchesByEvidence.get(evidence.lounge.id) ?? []).length !== 1) {
      return record;
    }

    const hoursSource = sameSourceHoursSource(evidence, sourceId);
    if (!hoursSource) {
      return record;
    }

    return {
      ...record,
      operations: {
        ...record.operations,
        hours: evidence.operations.hours,
        lastVerifiedAt: latestIsoDate(
          [record.operations.lastVerifiedAt, hoursSource.retrievedAt],
          record.operations.lastVerifiedAt,
        ),
      },
      notes: cleanList([...record.notes, 'Official same-source page supplied exact-identity hours evidence.']),
      sources: mergeUniqueBySourceId([...record.sources, hoursSource]),
    };
  });
}

function enrichFromOfficialPricePages(records) {
  const evidenceRows = records.filter((record) => hasValue(officialPriceOffers(record)));
  const matches = [];

  for (const record of records) {
    for (const evidence of evidenceRows) {
      if (
        evidence.lounge.id !== record.lounge.id &&
        clean(evidence.airport.iata).toUpperCase() === clean(record.airport.iata).toUpperCase() &&
        !(hasSource(record, 'priority-pass') && hasSource(evidence, 'priority-pass')) &&
        priceEvidenceMovementCompatible(record, evidence) &&
        priceEvidenceTerminalsCompatible(record.location.terminal, evidence.location.terminal) &&
        publishedGatesCompatible(record.location.gate, evidence.location.gate) &&
        samePriceEvidenceLoungeFamily(record, evidence)
      ) {
        matches.push({ record, evidence });
      }
    }
  }

  const matchesByRecord = new Map();
  const matchesByEvidence = new Map();
  for (const match of matches) {
    matchesByRecord.set(match.record.lounge.id, [...(matchesByRecord.get(match.record.lounge.id) ?? []), match]);
    matchesByEvidence.set(match.evidence.lounge.id, [...(matchesByEvidence.get(match.evidence.lounge.id) ?? []), match]);
  }

  return records.map((record) => {
    const recordMatches = matchesByRecord.get(record.lounge.id) ?? [];
    if (recordMatches.length !== 1) {
      return record;
    }

    const [{ evidence }] = recordMatches;
    if ((matchesByEvidence.get(evidence.lounge.id) ?? []).length !== 1) {
      return record;
    }

    const sources = officialPriceSources(evidence);
    const evidenceAccessOffers = officialPriceOffers(evidence);
    if (sources.length === 0 || !hasValue(evidenceAccessOffers)) {
      return record;
    }
    const accessOffers = mergeAccessOffers([...(record.accessOffers ?? []), ...evidenceAccessOffers]);
    const gate =
      !hasValue(record.location.gate) &&
      hasValue(evidence.location.gate) &&
      sources.some((source) => source.fieldCoverage.includes('location.gate'))
        ? evidence.location.gate
        : null;
    const usedFields = ['access.accessOffers', ...(gate ? ['location.gate'] : [])];
    const filteredSources = sources.map((source) => sourceWithFieldCoverage(source, usedFields)).filter(Boolean);

    return {
      ...record,
      location: {
        ...record.location,
        gate: gate ?? record.location.gate,
      },
      accessOffers,
      notes: cleanList([
        ...record.notes,
        gate
          ? 'Official price page supplied paid access and missing location evidence.'
          : 'Official price page supplied paid access evidence.',
      ]),
      sources: mergeUniqueBySourceId([...record.sources, ...filteredSources]),
    };
  });
}

function enrichFromPlazaPremiumPricePages(records) {
  const sourceId = 'plaza-premium';
  const evidenceRows = records.filter((record) => hasValue(officialPriceOffersForSource(record, sourceId)));
  const matches = [];

  for (const record of records) {
    if (hasValue(record.accessOffers)) {
      continue;
    }

    for (const evidence of evidenceRows) {
      const sameStrictPublishedPosition = exactPublishedLocationTextMatch(record.location.gate, evidence.location.gate);
      const sameStrictIdentity =
        sameExactLoungeIdentity(record, evidence) ||
        (sameStrictPublishedPosition && samePhysicalNameIdentity(record, evidence));
      if (
        evidence.lounge.id !== record.lounge.id &&
        clean(evidence.airport.iata).toUpperCase() === clean(record.airport.iata).toUpperCase() &&
        !(hasSource(record, 'priority-pass') && hasSource(evidence, 'priority-pass')) &&
        priceEvidenceMovementCompatible(record, evidence) &&
        priceEvidenceTerminalsCompatible(record.location.terminal, evidence.location.terminal) &&
        ((publishedGatesCompatible(record.location.gate, evidence.location.gate) && sameExactLoungeIdentity(record, evidence)) ||
          (sameStrictPublishedPosition && sameStrictIdentity))
      ) {
        matches.push({ record, evidence });
      }
    }
  }

  const matchesByRecord = new Map();
  const matchesByEvidence = new Map();
  for (const match of matches) {
    matchesByRecord.set(match.record.lounge.id, [...(matchesByRecord.get(match.record.lounge.id) ?? []), match]);
    matchesByEvidence.set(match.evidence.lounge.id, [...(matchesByEvidence.get(match.evidence.lounge.id) ?? []), match]);
  }

  return records.map((record) => {
    const recordMatches = matchesByRecord.get(record.lounge.id) ?? [];
    if (recordMatches.length !== 1) {
      return record;
    }

    const [{ evidence }] = recordMatches;
    if ((matchesByEvidence.get(evidence.lounge.id) ?? []).length !== 1) {
      return record;
    }

    const evidenceSource = evidence.sources.find(
      (source) => source.sourceId === sourceId && source.fieldCoverage.includes('access.accessOffers'),
    );
    const evidenceAccessOffers = officialPriceOffersForSource(evidence, sourceId);
    if (!evidenceSource || evidenceAccessOffers.length !== 1) {
      return record;
    }

    return {
      ...record,
      accessOffers: mergeAccessOffers([...(record.accessOffers ?? []), ...evidenceAccessOffers]),
      notes: cleanList([...record.notes, 'Official Plaza Premium page supplied one-to-one paid access evidence.']),
      sources: mergeUniqueBySourceId([...record.sources, sourceWithFieldCoverage(evidenceSource, ['access.accessOffers'])]),
    };
  });
}

function enrichAirportDetailFromPlazaPremiumPricePages(records) {
  const sourceId = 'plaza-premium';
  const evidenceRows = records.filter((record) => officialPriceOffersForSource(record, sourceId).length === 1);

  return records.map((record) => {
    const airportSource = officialAirportSource(record);
    if (
      hasValue(record.accessOffers) ||
      !airportSource?.fieldCoverage.includes('location.gate') ||
      !hasValue(record.location.gate)
    ) {
      return record;
    }

    const matches = evidenceRows.filter(
      (evidence) =>
        evidence.lounge.id !== record.lounge.id &&
        clean(evidence.airport.iata).toUpperCase() === clean(record.airport.iata).toUpperCase() &&
        !(hasSource(record, 'priority-pass') && hasSource(evidence, 'priority-pass')) &&
        priceEvidenceMovementCompatible(record, evidence) &&
        priceEvidenceTerminalsCompatible(record.location.terminal, evidence.location.terminal) &&
        publishedGatesCompatible(record.location.gate, evidence.location.gate) &&
        sameExactLoungeIdentity(record, evidence),
    );
    const offersByIdentity = new Map();
    for (const evidence of matches) {
      const offer = officialPriceOffersForSource(evidence, sourceId)[0];
      if (!offer) {
        continue;
      }
      const key = [offer.url, offer.amount, offer.currency].map(clean).join('|');
      if (key && !offersByIdentity.has(key)) {
        offersByIdentity.set(key, { evidence, offer });
      }
    }
    if (offersByIdentity.size !== 1) {
      return record;
    }

    const [{ evidence, offer }] = [...offersByIdentity.values()];
    const evidenceSource = evidence.sources.find(
      (source) => source.sourceId === sourceId && source.fieldCoverage.includes('access.accessOffers'),
    );
    if (!evidenceSource) {
      return record;
    }

    return {
      ...record,
      accessOffers: mergeAccessOffers([...(record.accessOffers ?? []), offer]),
      notes: cleanList([...record.notes, 'Official Plaza Premium page supplied exact-identity airport-detail price evidence.']),
      sources: mergeUniqueBySourceId([...record.sources, sourceWithFieldCoverage(evidenceSource, ['access.accessOffers'])]),
    };
  });
}

function enrichFromPlazaPremiumExactPositionPricePages(records) {
  const sourceId = 'plaza-premium';
  const evidenceRows = records.filter((record) => hasValue(officialPriceOffersForSource(record, sourceId)));
  const matches = [];

  for (const record of records) {
    if (hasValue(record.accessOffers)) {
      continue;
    }

    for (const evidence of evidenceRows) {
      const sameStrictPublishedPosition = exactPublishedLocationTextMatch(record.location.gate, evidence.location.gate);
      const sameStrictIdentity =
        sameExactLoungeIdentity(record, evidence) ||
        samePhysicalNameIdentity(record, evidence) ||
        (sameStrictPublishedPosition &&
          hasAnyLoungeFamily(record, ['plaza premium']) &&
          hasAnyLoungeFamily(evidence, ['plaza premium']));
      if (
        evidence.lounge.id !== record.lounge.id &&
        clean(evidence.airport.iata).toUpperCase() === clean(record.airport.iata).toUpperCase() &&
        !(hasSource(record, 'priority-pass') && hasSource(evidence, 'priority-pass')) &&
        priceEvidenceMovementCompatible(record, evidence) &&
        priceEvidenceTerminalsCompatible(record.location.terminal, evidence.location.terminal) &&
        sameStrictPublishedPosition &&
        sameStrictIdentity
      ) {
        matches.push({ record, evidence });
      }
    }
  }

  const matchesByRecord = new Map();
  const matchesByEvidence = new Map();
  for (const match of matches) {
    matchesByRecord.set(match.record.lounge.id, [...(matchesByRecord.get(match.record.lounge.id) ?? []), match]);
    matchesByEvidence.set(match.evidence.lounge.id, [...(matchesByEvidence.get(match.evidence.lounge.id) ?? []), match]);
  }

  return records.map((record) => {
    const recordMatches = matchesByRecord.get(record.lounge.id) ?? [];
    if (recordMatches.length !== 1) {
      return record;
    }

    const [{ evidence }] = recordMatches;
    if ((matchesByEvidence.get(evidence.lounge.id) ?? []).length !== 1) {
      return record;
    }

    const evidenceSource = evidence.sources.find(
      (source) => source.sourceId === sourceId && source.fieldCoverage.includes('access.accessOffers'),
    );
    const evidenceAccessOffers = officialPriceOffersForSource(evidence, sourceId);
    if (!evidenceSource || evidenceAccessOffers.length !== 1) {
      return record;
    }

    return {
      ...record,
      accessOffers: mergeAccessOffers([...(record.accessOffers ?? []), ...evidenceAccessOffers]),
      notes: cleanList([...record.notes, 'Official Plaza Premium exact-position page supplied paid access evidence.']),
      sources: mergeUniqueBySourceId([...record.sources, sourceWithFieldCoverage(evidenceSource, ['access.accessOffers'])]),
    };
  });
}

function singleOfferPriceMatch(record, evidence, sourceId) {
  if (sourceId === 'no1-lounges') {
    return (
      sameExactLoungeIdentity(record, evidence) &&
      (priceEvidenceTerminalsCompatible(record.location.terminal, evidence.location.terminal) ||
        (!hasValue(evidence.location.gate) && /\bairport\b/i.test(clean(evidence.location.terminal))))
    );
  }

  if (sourceId === 'marhaba') {
    const samePublishedPosition =
      hasValue(record.location.gate) &&
      hasValue(evidence.location.gate) &&
      publishedGatesCompatible(record.location.gate, evidence.location.gate);
    return (
      samePublishedPosition &&
      hasAnyLoungeFamily(record, ['marhaba']) &&
      hasAnyLoungeFamily(evidence, ['marhaba']) &&
      (sameExactLoungeIdentity(record, evidence) || samePhysicalNameIdentity(record, evidence))
    );
  }

  return false;
}

function enrichFromSingleOfferOfficialPricePages(records) {
  const sourceIds = ['no1-lounges', 'marhaba'];
  const evidenceRows = records.filter((record) =>
    sourceIds.some((sourceId) => officialPriceOffersForSource(record, sourceId).length === 1),
  );
  const matches = [];

  for (const record of records) {
    if (hasValue(record.accessOffers)) {
      continue;
    }

    for (const evidence of evidenceRows) {
      const sourceId = sourceIds.find((candidate) => officialPriceOffersForSource(evidence, candidate).length === 1);
      if (
        sourceId &&
        evidence.lounge.id !== record.lounge.id &&
        clean(evidence.airport.iata).toUpperCase() === clean(record.airport.iata).toUpperCase() &&
        singleOfferPriceMatch(record, evidence, sourceId)
      ) {
        matches.push({ record, evidence, sourceId });
      }
    }
  }

  const matchesByRecord = new Map();
  const matchesByEvidence = new Map();
  for (const match of matches) {
    matchesByRecord.set(match.record.lounge.id, [...(matchesByRecord.get(match.record.lounge.id) ?? []), match]);
    matchesByEvidence.set(match.evidence.lounge.id, [...(matchesByEvidence.get(match.evidence.lounge.id) ?? []), match]);
  }

  return records.map((record) => {
    const recordMatches = matchesByRecord.get(record.lounge.id) ?? [];
    if (recordMatches.length !== 1) {
      return record;
    }

    const [{ evidence, sourceId }] = recordMatches;
    if ((matchesByEvidence.get(evidence.lounge.id) ?? []).length !== 1) {
      return record;
    }

    const evidenceSource = evidence.sources.find(
      (source) => source.sourceId === sourceId && source.fieldCoverage.includes('access.accessOffers'),
    );
    const evidenceAccessOffers = officialPriceOffersForSource(evidence, sourceId);
    if (!evidenceSource || evidenceAccessOffers.length !== 1) {
      return record;
    }

    return {
      ...record,
      accessOffers: mergeAccessOffers([...(record.accessOffers ?? []), ...evidenceAccessOffers]),
      notes: cleanList([...record.notes, 'Official operator page supplied one-to-one paid access evidence.']),
      sources: mergeUniqueBySourceId([...record.sources, sourceWithFieldCoverage(evidenceSource, ['access.accessOffers'])]),
    };
  });
}

function enrichFromOfficialLocationPages(records) {
  const evidenceRows = records.filter(
    (record) =>
      (hasValue(record.location.gate) && officialLocationSources(record, 'location.gate').length > 0) ||
      (hasValue(record.operations.hours) && officialLocationSources(record, 'operations.hours').length > 0),
  );
  const matches = [];

  for (const record of records) {
    if (hasValue(record.location.gate) && hasValue(record.operations.hours)) {
      continue;
    }

    for (const evidence of evidenceRows) {
      const compatibility = officialLocationEvidenceCompatible(record, evidence);
      if (
        evidence.lounge.id !== record.lounge.id &&
        clean(evidence.airport.iata).toUpperCase() === clean(record.airport.iata).toUpperCase() &&
        compatibility &&
        sameNameBrandLoungeFamily(record, evidence) &&
        (shouldPromotePosition(record.location.gate, evidence.location.gate) &&
          officialLocationSources(evidence, 'location.gate').length > 0) ||
          (!hasValue(record.operations.hours) &&
            hasValue(evidence.operations.hours) &&
            officialLocationSources(evidence, 'operations.hours').length > 0)
      ) {
        matches.push({ record, evidence, compatibility });
      }
    }
  }

  const matchesByRecord = new Map();
  const matchesByEvidence = new Map();
  const terminalCompatibleRecordIds = new Set(matches.filter((match) => match.compatibility === 'terminal').map((match) => match.record.lounge.id));
  const selectedMatches = matches.filter(
    (match) => match.compatibility === 'terminal' || !terminalCompatibleRecordIds.has(match.record.lounge.id),
  );
  for (const match of selectedMatches) {
    matchesByRecord.set(match.record.lounge.id, [...(matchesByRecord.get(match.record.lounge.id) ?? []), match]);
    matchesByEvidence.set(match.evidence.lounge.id, [...(matchesByEvidence.get(match.evidence.lounge.id) ?? []), match]);
  }

  return records.map((record) => {
    const recordMatches = matchesByRecord.get(record.lounge.id) ?? [];
    if (recordMatches.length !== 1) {
      return record;
    }

    const [{ evidence }] = recordMatches;
    if ((matchesByEvidence.get(evidence.lounge.id) ?? []).length !== 1) {
      return record;
    }

    const gate = shouldPromotePosition(record.location.gate, evidence.location.gate) ? evidence.location.gate : null;
    const hours =
      !hasValue(record.operations.hours) && hasValue(evidence.operations.hours) ? evidence.operations.hours : null;
    const sources = [
      ...(gate
        ? officialLocationSources(evidence, 'location.gate')
            .map((source) => sourceWithFieldCoverage(source, ['location.gate']))
            .filter(Boolean)
        : []),
      ...(hours
        ? officialLocationSources(evidence, 'operations.hours')
            .map((source) => sourceWithFieldCoverage(source, ['operations.hours']))
            .filter(Boolean)
        : []),
    ];

    if ((!gate && !hours) || sources.length === 0) {
      return record;
    }

    return {
      ...record,
      location: {
        ...record.location,
        gate: gate ?? record.location.gate,
      },
      operations: {
        ...record.operations,
        hours: hours ?? record.operations.hours,
        lastVerifiedAt: latestIsoDate(
          [record.operations.lastVerifiedAt, ...sources.map((source) => source.retrievedAt)],
          record.operations.lastVerifiedAt,
        ),
      },
      notes: cleanList([...record.notes, 'Official location page supplied missing field evidence.']),
      sources: mergeUniqueBySourceId([...record.sources, ...sources]),
    };
  });
}

function enrichFromDeltaExactLocationPages(records) {
  const evidenceRows = records.filter(
    (record) =>
      hasValue(record.location.gate) &&
      officialDeltaSource(record)?.fieldCoverage.includes('location.gate'),
  );
  const matches = [];

  for (const record of records) {
    if (officialDeltaSource(record)) {
      continue;
    }

    for (const evidence of evidenceRows) {
      if (
        evidence.lounge.id !== record.lounge.id &&
        clean(evidence.airport.iata).toUpperCase() === clean(record.airport.iata).toUpperCase() &&
        sameExactLoungeIdentity(record, evidence) &&
        exactDeltaLocationTerminalsCompatible(record, evidence) &&
        (!hasValue(record.location.gate) || exactPublishedPositionMatch(record.location.gate, evidence.location.gate))
      ) {
        matches.push({ record, evidence });
      }
    }
  }

  const matchesByRecord = new Map();
  const matchesByEvidence = new Map();
  for (const match of matches) {
    matchesByRecord.set(match.record.lounge.id, [...(matchesByRecord.get(match.record.lounge.id) ?? []), match]);
    matchesByEvidence.set(match.evidence.lounge.id, [...(matchesByEvidence.get(match.evidence.lounge.id) ?? []), match]);
  }

  return records.map((record) => {
    const recordMatches = matchesByRecord.get(record.lounge.id) ?? [];
    if (recordMatches.length !== 1) {
      return record;
    }

    const [{ evidence }] = recordMatches;
    if ((matchesByEvidence.get(evidence.lounge.id) ?? []).length !== 1) {
      return record;
    }

    const source = sourceWithFieldCoverage(officialDeltaSource(evidence), ['location.gate']);
    if (!source) {
      return record;
    }

    return {
      ...record,
      location: {
        ...record.location,
        gate: record.location.gate || evidence.location.gate,
      },
      operations: {
        ...record.operations,
        lastVerifiedAt: latestIsoDate([record.operations.lastVerifiedAt, source.retrievedAt], record.operations.lastVerifiedAt),
      },
      notes: cleanList([...record.notes, 'Official Delta page supplied exact-name location evidence.']),
      sources: mergeUniqueBySourceId([...record.sources, source]),
    };
  });
}

function mergeCanonicalRecords(first, second) {
  const qantasAuthority = isQantasAllianceLocationConflictDuplicate(first, second)
    ? [first, second].find((record) => hasSource(record, 'qantas'))
    : null;
  const base = qantasAuthority ?? (recordDetailScore(first) >= recordDetailScore(second) ? first : second);
  const overlay = base === first ? second : first;
  const sources = mergeUniqueBySourceId([...base.sources, ...overlay.sources]);
  const brandSource = [base, overlay].find((record) =>
    record.sources.some((source) => !['priority-pass', 'ourairports'].includes(source.sourceId)),
  );
  const brandRecord = brandSource ?? base;

  return {
    ...base,
    lounge: {
      ...base.lounge,
      brand: brandRecord.lounge.brand,
      brandAsset: brandRecord.lounge.brandAsset ?? base.lounge.brandAsset,
      operator: pickValue(base.lounge.operator, overlay.lounge.operator),
      programs: cleanList([...base.lounge.programs, ...overlay.lounge.programs]),
      accessMethods: cleanList([...base.lounge.accessMethods, ...overlay.lounge.accessMethods]),
      status:
        base.lounge.status === 'temporarily_closed' || overlay.lounge.status === 'temporarily_closed'
          ? 'temporarily_closed'
          : base.lounge.status === 'active' || overlay.lounge.status === 'active'
          ? 'active'
          : base.lounge.status === 'planned' || overlay.lounge.status === 'planned'
          ? 'planned'
          : base.lounge.status,
    },
    airport: {
      ...base.airport,
      icao: pickValue(base.airport.icao, overlay.airport.icao),
      timezone: pickValue(base.airport.timezone, overlay.airport.timezone),
      coordinates: Number.isFinite(base.airport.coordinates.lat) ? base.airport.coordinates : overlay.airport.coordinates,
    },
    location: {
      terminal: pickValue(base.location.terminal, overlay.location.terminal),
      concourse: pickValue(base.location.concourse, overlay.location.concourse),
      gate: pickMoreSpecificPosition(base.location.gate, overlay.location.gate),
      securitySide: pickValue(base.location.securitySide, overlay.location.securitySide),
      directions: pickValue(base.location.directions, overlay.location.directions),
    },
    operations: {
      hours: pickValue(base.operations.hours, overlay.operations.hours),
      exceptions: cleanList([...base.operations.exceptions, ...overlay.operations.exceptions]),
      plannedOpening: pickValue(base.operations.plannedOpening, overlay.operations.plannedOpening),
      lastVerifiedAt: latestIsoDate([base.operations.lastVerifiedAt, overlay.operations.lastVerifiedAt], base.operations.lastVerifiedAt),
    },
    accessOffers: mergeAccessOffers([...(base.accessOffers ?? []), ...(overlay.accessOffers ?? [])]),
    amenities: cleanList([...base.amenities, ...overlay.amenities]),
    restrictions: cleanList([...base.restrictions, ...overlay.restrictions]),
    guestPolicy: pickValue(base.guestPolicy, overlay.guestPolicy),
    notes: cleanList([...base.notes, ...overlay.notes, 'Merged duplicate source evidence.']),
    sources,
    quality: recordDetailScore(base) >= recordDetailScore(overlay) ? base.quality : overlay.quality,
  };
}

function positionSpecificityScore(value) {
  const text = clean(value);
  if (!text) {
    return 0;
  }
  if (isExactGateEvidence(text)) {
    return 100;
  }
  if (/\bGates?\s+Area\b/i.test(text)) {
    return 80;
  }
  if (/\b(?:Unit|Concourse|Pier|Satellite|Connector|Wing|Lounge|Level|Mezzanine|Ground|Check-in|Food|Duty Free|Passport Control|Immigration)\b/i.test(text)) {
    return 70;
  }
  if (/\b(?:Departures?|Arrivals?)\s+(?:Hall|Area|Level)\b/i.test(text)) {
    return 55;
  }
  if (/\b(?:Domestic|International|Transborder)\s+Departures?\b/i.test(text)) {
    return 45;
  }
  if (/\bArea\b/i.test(text)) {
    return 35;
  }
  return 20;
}

function pickMoreSpecificPosition(first, second) {
  if (!hasValue(first)) {
    return second;
  }
  if (!hasValue(second)) {
    return first;
  }
  const firstScore = positionSpecificityScore(first);
  const secondScore = positionSpecificityScore(second);
  return secondScore > firstScore ? second : first;
}

function shouldPromotePosition(current, candidate) {
  return hasValue(candidate) && (!hasValue(current) || positionSpecificityScore(candidate) > positionSpecificityScore(current));
}

function dedupeLocationMatchScore(candidate, incoming) {
  const candidateGate = normalizeIdentityText(candidate.location.gate);
  const incomingGate = normalizeIdentityText(incoming.location.gate);
  const candidateLocation = normalizeIdentityText(
    [candidate.location.gate, candidate.location.concourse, candidate.location.directions].join(' '),
  );
  const incomingLocation = normalizeIdentityText(
    [incoming.location.gate, incoming.location.concourse, incoming.location.directions].join(' '),
  );
  let score = 0;

  if (candidateGate && incomingGate && candidateGate === incomingGate) {
    score += 100;
  } else {
    if (candidateGate && incomingLocation.includes(candidateGate)) {
      score += 80;
    }
    if (incomingGate && candidateLocation.includes(incomingGate)) {
      score += 80;
    }
  }

  const positionWords = ['east wing', 'west wing', 'north wing', 'south wing', 'east concourse', 'west concourse'];
  for (const word of positionWords) {
    if (candidateLocation.includes(word) && incomingLocation.includes(word)) {
      score += 60;
    }
  }
  if (normalizeTerminalText(candidate.location.terminal) === normalizeTerminalText(incoming.location.terminal)) {
    score += 20;
  }
  if (sameExactLoungeIdentity(candidate, incoming)) {
    score += 10;
  }

  return score;
}

function dedupeCanonicalRecords(records) {
  const deduped = [];

  for (const record of records) {
    const matchingIndexes = deduped
      .map((candidate, index) => ({ candidate, index }))
      .filter(
        ({ candidate }) =>
          canMergeCanonicalRecords(candidate, record) &&
          (isLowDetailSourceOverlap(candidate) || isLowDetailSourceOverlap(record)),
      );

    if (matchingIndexes.length === 0) {
      deduped.push(record);
      continue;
    }

    const rankedMatches = matchingIndexes
      .map((match) => ({ ...match, score: dedupeLocationMatchScore(match.candidate, record) }))
      .sort((first, second) => second.score - first.score || first.index - second.index);
    const existingIndex = rankedMatches[0].index;

    deduped[existingIndex] = mergeCanonicalRecords(deduped[existingIndex], record);
  }

  return deduped;
}

export function createCanonicalCatalog({
  features,
  meta,
  additionalRecords = [],
  accessPolicies = [],
  officialAirlineHoursEvidence = null,
}) {
  const priorityPassGeneratedAt = meta.generatedAt ?? new Date().toISOString();
  const generatedAt = latestIsoDate(
    [
      priorityPassGeneratedAt,
      ...features.map((feature) => (feature.properties ?? feature).sourceRetrievedAt),
      ...additionalRecords.flatMap((record) => (record.sources ?? []).map((source) => source.retrievedAt)),
      ...accessPolicies.map((policy) => policy.source?.retrievedAt),
      ...(officialAirlineHoursEvidence?.records ?? []).map((record) => record.retrievedAt),
    ],
    priorityPassGeneratedAt,
  );
  const rawRecords = [
    ...features.map((feature) => createCanonicalRecord(feature, { generatedAt: priorityPassGeneratedAt })),
    ...additionalRecords,
  ];
  const enrichedRecords = enrichPriorityPassAccessPolicy(enrichDeltaSkyClubAccessPolicy(enrichFromDeltaExactLocationPages(
    enrichFromPlazaPremiumExactPositionPricePages(
              enrichFromOfficialLocationPages(
                enrichAdmiralsClubOneDayPass(
                  enrichFromSingleOfferOfficialPricePages(
                    enrichAirportDetailFromPlazaPremiumPricePages(
            enrichFromPlazaPremiumPricePages(
              enrichFromOfficialPricePages(
                enrichFromCrossSourceExactPublishedHours(
                  enrichFromCrossSourceAirlineExactIdentityHours(
                    enrichFromSameSourceExactIdentityHours(
                      enrichAirportOfficialRecordsFromExactPublishedHours(
                        enrichFromOfficialAlliancePages(
                          enrichFromOfficialPartnerBookingPages(
                            enrichFromOfficialOperatorPages(
                              enrichFromOfficialAirportPages(
                                dedupeCanonicalRecords(
                                  mergePrimeclassAuthorityRecords(
                                    mergeNo1AuthorityRecords(
                                      mergeTheClubAuthorityRecords(
                                        mergeAspireAuthorityRecords(
                                        mergeCenturionAuthorityRecords(
                                        mergeAlaskaAuthorityRecords(
                                          mergeQatarAuthorityRecords(
                                            mergeAenaAuthorityRecords(
                                              mergeBijectiveQantasAllianceRecords(
                                                mergeApprovedCrossSourceAliasRecords(rawRecords),
                                              ),
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                  ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  ), accessPolicies), accessPolicies);
  const evidenceEnrichedRecords = officialAirlineHoursEvidence
    ? applyOfficialAirlineHoursEvidence(enrichedRecords, officialAirlineHoursEvidence)
    : enrichedRecords;
  const records = evidenceEnrichedRecords.map(pruneUnprovenPromotedFields);
  const sources = createSourceRegistryForCatalog(features, generatedAt, records, { priorityPassGeneratedAt });
  const brands = getBrandRegistry();
  const deskTravelBrandImport = createDeskTravelBrandImport({ generatedAt });
  const quality = summarizeQuality(records);

  return {
    generatedAt,
    sourceFile: meta.sourceFile,
    schema: createSchemaMetadata(),
    stats: {
      ...meta.stats,
      totalCatalogRecords: records.length,
      candidateRecords: additionalRecords.length,
      nonPriorityRecords: records.filter((record) =>
        record.sources.some((source) => !['priority-pass', 'ourairports'].includes(source.sourceId)),
      ).length,
      duplicateSourceRecords: rawRecords.length - records.length,
      totalSources: sources.length,
      reviewQueue: quality.reviewQueue,
      approvedRecords: records.length - quality.reviewQueue,
    },
    filters: {
      ...meta.filters,
      providers: [...new Set(records.map((record) => record.lounge.brand).filter(Boolean))].sort(),
      programs: [...new Set(records.flatMap((record) => record.lounge.programs).filter(Boolean))].sort(),
      reviewStatuses: [...new Set(records.map((record) => record.quality.reviewStatus))].sort(),
    },
    quality,
    sources,
    brands,
    deskTravelBrandImport,
    records,
  };
}
