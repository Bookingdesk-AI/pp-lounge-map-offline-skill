import {
  createDeskTravelBrandImport,
  getBrandRegistry,
  resolveBrandAsset,
} from './brand-registry.mjs';
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
]);

const OFFICIAL_LOCATION_SOURCE_IDS = new Set([
  'airport-official-pages',
  'airport-dimensions',
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
  if (dedupeKey(first) !== dedupeKey(second) && !samePhysicalLoungeIdentity(first, second)) {
    return false;
  }
  if (!publishedGatesCompatible(first.location.gate, second.location.gate)) {
    return false;
  }
  if (!hasKnownTerminal(first) || !hasKnownTerminal(second)) {
    return true;
  }
  return normalizeTerminalText(first.location.terminal) === normalizeTerminalText(second.location.terminal);
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

function publishedGatesCompatible(first, second) {
  if (!hasValue(first) || !hasValue(second)) {
    return true;
  }
  if (clean(first).toLowerCase() === clean(second).toLowerCase()) {
    return true;
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
    const existing = bySourceId.get(source.sourceId);
    if (!existing) {
      bySourceId.set(source.sourceId, source);
      continue;
    }

    bySourceId.set(source.sourceId, {
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
  for (const match of text.matchAll(/\bConcourses?\s+([A-Z0-9](?:\s*(?:,|&|and)\s*[A-Z0-9])*)\b/gi)) {
    for (const token of match[1].split(/\s*(?:,|&|and)\s*/i)) {
      if (/^[A-Z0-9]$/i.test(token)) {
        tokens.add(token.toUpperCase());
      }
    }
  }
  return tokens;
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
  if (hasConflictingScope(first, second)) {
    return false;
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

function samePhysicalLoungeIdentity(first, second) {
  if (clean(first.airport.iata).toUpperCase() !== clean(second.airport.iata).toUpperCase()) {
    return false;
  }
  if (!publishedGatesCompatible(first.location.gate, second.location.gate)) {
    return false;
  }
  if (
    hasKnownTerminal(first) &&
    hasKnownTerminal(second) &&
    normalizeTerminalText(first.location.terminal) !== normalizeTerminalText(second.location.terminal)
  ) {
    return false;
  }
  return sameExactLoungeIdentity(first, second) || samePhysicalNameIdentity(first, second);
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

  return (officialByAirport.byAirport.get(airportCode) ?? []).filter(
    (candidate) =>
      candidate.lounge.id !== record.lounge.id &&
      enrichmentTerminalsCompatible(record.location.terminal, candidate.location.terminal) &&
      sameLoungeFamily(record, candidate),
  );
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

function officialLocationSources(record, field) {
  return record.sources.filter(
    (source) => OFFICIAL_LOCATION_SOURCE_IDS.has(source.sourceId) && source.fieldCoverage.includes(field),
  );
}

function sameNameBrandLoungeFamily(first, second) {
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

function officialLocationEvidenceCompatible(record, evidence) {
  if (enrichmentTerminalsCompatible(record.location.terminal, evidence.location.terminal)) {
    return 'terminal';
  }
  if (hasValue(record.location.terminal) && hasValue(evidence.location.terminal)) {
    return '';
  }
  return exactPublishedPositionMatch(record.location.gate, evidence.location.gate) ? 'position' : '';
}

function isExactGateEvidence(value) {
  return /^Gate\s+[A-Z]?\d+[A-Z]?$/i.test(clean(value));
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

  const gate = !hasValue(record.location.gate) ? singleDistinctValue(officialMatches, (match) => match.location.gate) : null;
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
      return (
        candidate.lounge.id !== record.lounge.id &&
        enrichmentTerminalsCompatible(record.location.terminal, candidate.location.terminal) &&
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

function enrichFromOfficialPricePages(records) {
  const evidenceRows = records.filter((record) => hasValue(officialPriceOffers(record)));
  const matches = [];

  for (const record of records) {
    for (const evidence of evidenceRows) {
      if (
        evidence.lounge.id !== record.lounge.id &&
        clean(evidence.airport.iata).toUpperCase() === clean(record.airport.iata).toUpperCase() &&
        priceEvidenceTerminalsCompatible(record.location.terminal, evidence.location.terminal) &&
        publishedGatesCompatible(record.location.gate, evidence.location.gate) &&
        (sameLoungeFamily(record, evidence) || sameExactLoungeIdentity(record, evidence))
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

    return {
      ...record,
      accessOffers,
      notes: cleanList([...record.notes, 'Official price page supplied paid access evidence.']),
      sources: mergeUniqueBySourceId([...record.sources, ...sources]),
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
        ((!hasValue(record.location.gate) &&
          hasValue(evidence.location.gate) &&
          officialLocationSources(evidence, 'location.gate').length > 0) ||
          (!hasValue(record.operations.hours) &&
            hasValue(evidence.operations.hours) &&
            officialLocationSources(evidence, 'operations.hours').length > 0))
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

    const gate = !hasValue(record.location.gate) && hasValue(evidence.location.gate) ? evidence.location.gate : null;
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

function mergeCanonicalRecords(first, second) {
  const base = recordDetailScore(first) >= recordDetailScore(second) ? first : second;
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
      status: base.lounge.status === 'active' || overlay.lounge.status === 'active' ? 'active' : base.lounge.status,
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
      gate: pickValue(base.location.gate, overlay.location.gate),
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

function dedupeCanonicalRecords(records) {
  const deduped = [];

  for (const record of records) {
    const existingIndex = deduped.findIndex((candidate) =>
      canMergeCanonicalRecords(candidate, record) && (isLowDetailSourceOverlap(candidate) || isLowDetailSourceOverlap(record)),
    );

    if (existingIndex === -1) {
      deduped.push(record);
      continue;
    }

    deduped[existingIndex] = mergeCanonicalRecords(deduped[existingIndex], record);
  }

  return deduped;
}

export function createCanonicalCatalog({ features, meta, additionalRecords = [] }) {
  const priorityPassGeneratedAt = meta.generatedAt ?? new Date().toISOString();
  const generatedAt = latestIsoDate(
    [priorityPassGeneratedAt, ...additionalRecords.flatMap((record) => (record.sources ?? []).map((source) => source.retrievedAt))],
    priorityPassGeneratedAt,
  );
  const rawRecords = [
    ...features.map((feature) => createCanonicalRecord(feature, { generatedAt: priorityPassGeneratedAt })),
    ...additionalRecords,
  ];
  const records = enrichFromOfficialLocationPages(
    enrichFromOfficialPricePages(
      enrichFromOfficialAlliancePages(
        enrichFromOfficialPartnerBookingPages(
          enrichFromOfficialOperatorPages(enrichFromOfficialAirportPages(dedupeCanonicalRecords(rawRecords))),
        ),
      ),
    ),
  );
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
