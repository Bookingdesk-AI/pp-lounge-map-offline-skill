import { cloneSourceRegistry } from './source-registry.mjs';
import { resolveBrandAsset } from './brand-registry.mjs';
import { createAirportAuthorityLookup } from './airport-authority.mjs';

function clean(value) {
  return String(value ?? '').trim();
}

function slugify(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function unique(values) {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function titleArea(value) {
  return clean(value)
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function hasValue(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return clean(value) !== '' && clean(value) !== 'Unknown';
}

function gateNumberFromWords(value) {
  const normalized = clean(value).toLowerCase().replace(/_/g, '-');
  if (/^[0-9]{1,3}[a-z]?$/i.test(normalized)) {
    return normalized.toUpperCase();
  }

  const ones = new Map([
    ['one', 1],
    ['two', 2],
    ['three', 3],
    ['four', 4],
    ['five', 5],
    ['six', 6],
    ['seven', 7],
    ['eight', 8],
    ['nine', 9],
  ]);
  const teens = new Map([
    ['ten', 10],
    ['eleven', 11],
    ['twelve', 12],
    ['thirteen', 13],
    ['fourteen', 14],
    ['fifteen', 15],
    ['sixteen', 16],
    ['seventeen', 17],
    ['eighteen', 18],
    ['nineteen', 19],
  ]);
  const tens = new Map([
    ['twenty', 20],
    ['thirty', 30],
    ['forty', 40],
    ['fifty', 50],
    ['sixty', 60],
    ['seventy', 70],
    ['eighty', 80],
    ['ninety', 90],
  ]);
  const parts = normalized.split('-').filter(Boolean);
  if (parts.length === 1) {
    return String(ones.get(parts[0]) ?? teens.get(parts[0]) ?? tens.get(parts[0]) ?? '');
  }
  if (parts.length === 2 && tens.has(parts[0]) && ones.has(parts[1])) {
    return String(tens.get(parts[0]) + ones.get(parts[1]));
  }
  return '';
}

function sourceById() {
  return new Map(cloneSourceRegistry().map((source) => [source.id, source]));
}

function normalizedHost(value) {
  try {
    return new URL(clean(value)).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function structuredRecordRedirectedOutsideOperator(source, record) {
  if (source.sourceId !== 'airport-dimensions' || !record.sourceUrl) {
    return false;
  }

  const page = (source.structuredApi?.pages ?? []).find(
    (candidate) => clean(candidate.url).replace(/^https?:\/\/www\./i, 'https://') === clean(record.sourceUrl).replace(/^https?:\/\/www\./i, 'https://'),
  );
  if (!page?.finalUrl) {
    return false;
  }

  const sourceHost = normalizedHost(record.sourceUrl);
  const finalHost = normalizedHost(page.finalUrl);
  return sourceHost === 'theclubairportlounges.com' && finalHost !== sourceHost;
}

function codesFromLinks(sourceId, links) {
  const candidates = [];
  const airportSlugMaps = {
    marhaba: {
      'al-maktoum-airport': 'DWC',
      'clark-international-airport': 'CRK',
      'dallas-departure': 'DFW',
      'dubai-international-airport': 'DXB',
      'geneva-airport': 'GVA',
      'helsinki-vantaa-international-airport': 'HEL',
      'hong-kong-airport': 'HKG',
      'istanbul-airport': 'IST',
      'jakarta-international-airport': 'CGK',
      'karachi-terminal-m': 'KHI',
      'king-fahd-international-airport': 'DMM',
      'kuala-lumpur-international-airport': 'KUL',
      'london-heathrow-airport': 'LHR',
      'macau-international-airport': 'MFM',
      'manila-terminal-1': 'MNL',
      'melbourne-airport': 'MEL',
      'riogaleao-tom-jobim-international-airport': 'GIG',
      'rome-terminal-3': 'FCO',
      'sharjah-international-airport': 'SHJ',
      'singapore-international-airport': 'SIN',
      'taiwan-taoyuan-international-airport': 'TPE',
      'toronto-pearson-international-airport': 'YYZ',
      'vancouver-international-airport': 'YVR',
      'zanzibar-airport': 'ZNZ',
      'zurich-airport': 'ZRH',
    },
    'no1-lounges': {
      birmingham: 'BHX',
      jersey: 'JER',
      'london-gatwick': 'LGW',
      'london-heathrow': 'LHR',
      'london-luton': 'LTN',
    },
    'aspire-lounges': {
      birmingham: 'BHX',
      jersey: 'JER',
      'london-gatwick': 'LGW',
      'london-heathrow': 'LHR',
      'london-luton': 'LTN',
    },
    skyteam: {
      dubai: 'DXB',
      frankfurt: 'FRA',
      sydney: 'SYD',
      vancouver: 'YVR',
    },
  };

  for (const link of links ?? []) {
    let url;
    try {
      url = new URL(link);
    } catch {
      continue;
    }

    if (sourceId === 'chase-sapphire') {
      const match = url.pathname.match(/\/sapphire-cards\/lounges\/([a-z]{3})(?:-|\/|$)/i);
      if (match) {
        candidates.push({ code: match[1].toUpperCase(), url: url.toString() });
      }
      continue;
    }

    if (sourceId === 'amex-global-lounge-collection') {
      const match = url.pathname.match(/\/travel\/lounges\/the-platinum-card\/([A-Z]{3})\/?$/i);
      if (match) {
        candidates.push({ code: match[1].toUpperCase(), url: url.toString() });
      }
      continue;
    }

    if (sourceId === 'capital-one') {
      const airportId = url.searchParams.get('airportId');
      if (/^[A-Z0-9]{3}$/.test(airportId ?? '')) {
        candidates.push({ code: airportId.toUpperCase(), url: url.toString() });
      }
      continue;
    }

    const slugMap = airportSlugMaps[sourceId];
    if (slugMap) {
      const pathname = url.pathname.toLowerCase();
      for (const [slug, code] of Object.entries(slugMap)) {
        if (pathname.includes(`/${slug}`) || pathname.includes(`/${slug}.html`)) {
          candidates.push({ code, url: url.toString() });
        }
      }
    }
  }

  return candidates;
}

function codesFromAirportMentions(source) {
  if (source.sourceId === 'escape-lounges') {
    return (source.childPages ?? [])
      .filter((page) => page.status === 'fetched')
      .flatMap((page) =>
        (page.airportCodes ?? [])
          .filter((code) => page.title?.includes(`(${code})`))
          .map((code) => ({
            code: clean(code).toUpperCase(),
            url: page.finalUrl || page.url,
          })),
      );
  }

  if (!['air-canada', 'american', 'airport-dimensions', 'be-relax'].includes(source.sourceId)) {
    return [];
  }
  return (source.airportCodes ?? []).map((code) => ({
    code: clean(code).toUpperCase(),
    url: source.finalUrl || source.url,
  }));
}

function candidateLabel(sourceId, airportCode) {
  const labels = {
    'chase-sapphire': 'Chase Sapphire Lounge',
    'amex-global-lounge-collection': 'American Express lounge access',
    'capital-one': 'Capital One Lounge',
    'air-canada': 'Air Canada Maple Leaf Lounge',
    'singapore-airlines': 'Singapore Airlines SilverKris Lounge',
    'qatar-airways': 'Qatar Airways Lounge',
    qantas: 'Qantas Lounge',
    american: 'American Airlines lounge access',
    'airport-dimensions': 'Airport Dimensions / The Club',
    'escape-lounges': 'Escape Lounge',
    'oneworld': 'oneworld lounge access',
    skyteam: 'SkyTeam lounge access',
    'no1-lounges': 'No1 Lounge',
    'aspire-lounges': 'Aspire Lounge',
    'marhaba': 'Marhaba Lounge',
    'be-relax': 'Be Relax',
    gameway: 'Gameway',
    sleepover: 'Sleepover',
    'minute-suites': 'Minute Suites',
  };
  return `${labels[sourceId] ?? sourceId} - ${airportCode}`;
}

function programsForSource(sourceId) {
  const programs = {
    'chase-sapphire': ['Chase Sapphire Reserve'],
    'amex-global-lounge-collection': ['American Express Platinum'],
    'capital-one': ['Capital One Venture X'],
    'air-canada': ['Air Canada Maple Leaf Lounge'],
    'singapore-airlines': ['Singapore Airlines', 'Star Alliance Gold', 'Premium cabin'],
    'qatar-airways': ['Qatar Airways', 'oneworld Emerald', 'oneworld Sapphire', 'Premium cabin'],
    qantas: ['Qantas', 'oneworld Emerald', 'oneworld Sapphire', 'Premium cabin'],
    delta: ['Delta Sky Club', 'SkyTeam Elite Plus', 'Premium cabin'],
    american: ['Admirals Club', 'Flagship Lounge'],
    'alaska-airlines': ['Alaska Lounge'],
    'airport-dimensions': ['The Club', 'Priority Pass'],
    'escape-lounges': ['Escape Lounges'],
    oneworld: ['oneworld Emerald', 'oneworld Sapphire', 'Premium cabin'],
    skyteam: ['SkyTeam Elite Plus', 'Premium cabin'],
    'no1-lounges': ['No1 Lounges'],
    'aspire-lounges': ['Aspire Lounges'],
    marhaba: ['Marhaba'],
    primeclass: ['Primeclass'],
    'be-relax': ['Be Relax'],
    gameway: ['Gameway'],
    sleepover: ['Sleepover'],
    'minute-suites': ['Minute Suites', 'Priority Pass'],
    'airport-official-pages': ['Official airport lounge page'],
  };
  return programs[sourceId] ?? [];
}

function accessMethodsForSource(sourceId) {
  const methods = {
    'chase-sapphire': ['cardholder'],
    'amex-global-lounge-collection': ['cardholder'],
    'capital-one': ['cardholder'],
    'air-canada': ['airline status', 'premium cabin'],
    'singapore-airlines': ['airline status', 'premium cabin'],
    'qatar-airways': ['airline status', 'alliance status', 'premium cabin'],
    qantas: ['airline status', 'alliance status', 'premium cabin', 'membership'],
    delta: ['airline status', 'premium cabin', 'membership'],
    american: ['airline status', 'premium cabin', 'membership'],
    'alaska-airlines': ['paid access', 'airline status', 'membership'],
    'airport-dimensions': ['membership', 'partner access'],
    'escape-lounges': ['cardholder', 'paid access'],
    oneworld: ['alliance status', 'premium cabin'],
    skyteam: ['alliance status', 'premium cabin'],
    'no1-lounges': ['paid access', 'partner access'],
    'aspire-lounges': ['paid access', 'partner access'],
    marhaba: ['paid access'],
    primeclass: ['paid access', 'partner access'],
    'be-relax': ['paid access', 'partner access'],
    gameway: ['paid access'],
    sleepover: ['paid access'],
    'minute-suites': ['paid access', 'membership'],
    'airport-official-pages': ['airport published access'],
  };
  return methods[sourceId] ?? ['manual review'];
}

function confidenceForSource(sourceId, fromLink) {
  if (fromLink && ['chase-sapphire', 'capital-one'].includes(sourceId)) {
    return 0.62;
  }
  if (fromLink && sourceId === 'amex-global-lounge-collection') {
    return 0.55;
  }
  return 0.48;
}

function completenessForSource(sourceId, fromLink) {
  if (fromLink && ['chase-sapphire', 'capital-one'].includes(sourceId)) {
    return 54;
  }
  if (fromLink && sourceId === 'amex-global-lounge-collection') {
    return 48;
  }
  return 42;
}

function conflictsForSource(sourceId, fromLink) {
  const conflicts = ['manual_review_required', 'missing_hours', 'unknown_terminal', 'missing_amenities'];
  if (!fromLink) {
    conflicts.push('airport_code_only');
  }
  if (sourceId === 'amex-global-lounge-collection') {
    conflicts.push('program_page_not_operator_record');
  }
  return conflicts;
}

function makeCandidateRecord({ source, registryEntry, airport, code, url, retrievedAt, fromLink }) {
  const name = candidateLabel(source.sourceId, code);
  const brandAsset = resolveBrandAsset(registryEntry.publisher, name, source.sourceId);

  return {
    lounge: {
      id: `candidate-${source.sourceId}-${code.toLowerCase()}-${slugify(registryEntry.publisher)}`,
      name,
      brand: registryEntry.publisher,
      brandAsset,
      operator: registryEntry.publisher,
      category: 'lounge',
      status: 'candidate',
      programs: programsForSource(source.sourceId),
      accessMethods: accessMethodsForSource(source.sourceId),
    },
    airport: {
      iata: code,
      icao: '',
      name: airport.name,
      city: airport.city,
      country: airport.country,
      timezone: '',
      coordinates: airport.coordinates,
    },
    location: {
      terminal: 'Unknown',
      concourse: '',
      gate: '',
      securitySide: '',
      directions: '',
    },
    operations: {
      hours: '',
      exceptions: [],
      plannedOpening: '',
      lastVerifiedAt: retrievedAt,
    },
    accessOffers: [],
    amenities: [],
    restrictions: [],
    guestPolicy: '',
    notes: ['Candidate imported from official public source intake.'],
    sources: [
      {
        sourceId: source.sourceId,
        publisher: registryEntry.publisher,
        url,
        retrievedAt,
        fieldCoverage: fromLink
          ? ['lounge.brand', 'airport.iata', 'source.url']
          : ['lounge.brand', 'airport.iata'],
        confidence: confidenceForSource(source.sourceId, fromLink),
        rightsNote: registryEntry.rightsNote,
      },
    ],
    quality: {
      completeness: completenessForSource(source.sourceId, fromLink),
      freshness: 100,
      conflicts: conflictsForSource(source.sourceId, fromLink),
      reviewStatus: 'review',
    },
  };
}

function cleanHours(openHours, fallbackText = '') {
  if (!Array.isArray(openHours) || openHours.length === 0) {
    return clean(fallbackText);
  }

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return openHours
    .map((slot) => {
      const day = dayLabels[Number(slot.Day)] ?? String(slot.Day ?? '');
      if (slot.OpenAllDay) {
        return `${day} 24 hours`;
      }
      if (slot.CloseAllDay) {
        return `${day} closed`;
      }
      if (!slot.OpeningHour || !slot.ClosingHour) {
        return '';
      }
      return `${day} ${slot.OpeningHour}-${slot.ClosingHour}`;
    })
    .filter(Boolean)
    .join('; ');
}

function amenitiesFromStructuredRecord(record) {
  const labels = {
    BusinessCenter: 'Business center',
    TV: 'TV',
    FoodBeverageSnackBuffet: 'Snacks',
    Phone: 'Phone',
    PreFlightDinner: 'Pre-flight dining',
    RelaxationRoom: 'Relaxation room',
    Shower: 'Shower',
    SPA: 'Spa',
    WheelchairAccess: 'Wheelchair access',
    WiFi: 'Wi-Fi',
    FoodBeverageHotBuffet: 'Hot buffet',
    AirConditioning: 'Air conditioning',
    Restroom: 'Restroom',
    RunwayViews: 'Runway views',
    FlighInformationScreen: 'Flight information screens',
  };

  return Object.entries(record.amenities ?? {})
    .filter(([, available]) => available)
    .map(([key]) => labels[key] ?? key);
}

function coordinatesFromStructuredRecord(record, fallbackAirport) {
  const lat = Number(record.airportCoordinates?.lat);
  const lon = Number(record.airportCoordinates?.lon);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return { lat, lon };
  }
  return fallbackAirport?.coordinates;
}

function closestGateFromStructuredRecord(record) {
  const explicitGate = clean(record.gate);
  if (explicitGate) {
    return explicitGate;
  }

  const text = clean([record.near, record.location, record.directions, record.concourse, record.terminal].filter(Boolean).join(' ')).replace(
    /\b(gates?)\s+N[°º]\s*/gi,
    '$1 ',
  );
  const gateToken = '[A-Z]?\\s*-?\\s*\\d+[A-Z]?';
  const letterGateToken = '[A-Z]\\s*-?\\s*\\d+[A-Z]?';
  const gateSequence = `${gateToken}(?:\\s*(?:-|to|and|&)\\s*(?:gates?\\s*)?${gateToken})*`;
  const match =
    text.match(new RegExp(`\\bbetween\\s+gates?\\s+(${gateSequence})\\b`, 'i')) ||
    text.match(
      new RegExp(
        `\\b(?:near|opposite|across\\s+from|above|beside|next\\s+to|adjacent\\s+to|before|after|at|by|towards?)\\s+(?:the\\s+)?gates?\\s+(${gateSequence})\\b`,
        'i',
      ),
    ) ||
    text.match(new RegExp(`\\bgates?\\s+(${gateSequence})\\b`, 'i')) ||
    text.match(new RegExp(`\\b(?:near|opposite|across\\s+from|above|beside|next\\s+to|adjacent\\s+to|before|after|at|by)\\s+(${letterGateToken})\\b`, 'i')) ||
    text.match(new RegExp(`\\b(?:boarding\\s+)?gates?\\s*(?:number|no\\.?\\s*)?(${gateSequence})\\b`, 'i')) ||
    text.match(new RegExp(`\\b(${gateToken})\\s+boarding\\s+gate\\b`, 'i'));
  if (!match) {
    return '';
  }

  const gate = match[1]
    .replace(/\bgates?\s+/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s*&\s*/g, ' & ')
    .replace(/\s+to\s+/gi, '-')
    .replace(/\s+and\s+/gi, ' & ')
    .trim();
  const hasMultipleGates = gate.includes('&') || /\d[A-Z]?\s*-\s*[A-Z]?-?\d/i.test(gate);
  return gate ? `${hasMultipleGates ? 'Gates' : 'Gate'} ${gate}` : '';
}

function normalizeGateLetters(value) {
  const letters = clean(value)
    .toUpperCase()
    .replace(/\b(?:GATES?|BOARDING|THE)\b/g, '')
    .replace(/\s*-\s*/g, '')
    .replace(/\s*&\s*/g, ' & ')
    .replace(/\s+AND\s+/g, ' & ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!/^[A-Z](?:\s*(?:,|&)\s*[A-Z])*$/.test(letters)) {
    return '';
  }

  return letters;
}

function formatGateArea(letters, forcePlural = false) {
  const normalized = normalizeGateLetters(letters);
  if (!normalized) {
    return '';
  }

  const plural = forcePlural || /[,/&]/.test(normalized);
  return plural ? `${normalized} Gates` : `Gate ${normalized}`;
}

function formatExactGate(value) {
  const gate = clean(value)
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s*&\s*/g, ' & ')
    .replace(/\s+and\s+/gi, ' & ')
    .trim()
    .toUpperCase();

  if (!/^[A-Z]?\d+[A-Z]?$/.test(gate)) {
    return '';
  }

  return `Gate ${gate}`;
}

function formatNamedArea(prefix, value) {
  const area = clean(value)
    .replace(/\s+/g, ' ')
    .replace(/\s*&\s*/g, ' & ')
    .replace(/\s+and\s+/gi, ' & ')
    .trim()
    .toUpperCase();

  if (!/^[A-Z0-9](?:[\w\s&/-]*[A-Z0-9])?$/.test(area)) {
    return '';
  }

  const displayArea = ['Satellite', 'Node'].includes(prefix)
    ? area.replace(/\b(NORTH|SOUTH|EAST|WEST)\b/g, (word) => `${word[0]}${word.slice(1).toLowerCase()}`)
    : area;

  return `${prefix} ${displayArea}`;
}

function formatReversedNamedArea(prefix, value) {
  const area = clean(value)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());

  if (!/^[A-Z0-9](?:[\w\s/-]*[\w0-9])?$/.test(area)) {
    return '';
  }

  return `${area} ${prefix}`;
}

function closestGateAreaFromStructuredRecord(record) {
  const text = clean([record.near, record.location, record.directions, record.concourse, record.terminal].filter(Boolean).join(' '));
  if (!text) {
    return '';
  }

  if (/\bS\s+Gate\s+Lounge\s+Level\b/i.test(text)) {
    return 'S Gate Lounge Level';
  }

  const patterns = [
    {
      pattern: /\bbetween\s+([A-Z]?\d+[A-Z]?)\s*(?:&|and)\s*([A-Z]?\d+[A-Z]?)\b/i,
      format: (match) => {
        const first = formatExactGate(match[1]).replace(/^Gate\s+/, '');
        const second = formatExactGate(match[2]).replace(/^Gate\s+/, '');
        return first && second ? `Gates ${first} & ${second}` : '';
      },
    },
    {
      pattern: /\b(?:adjacent\s+to|near|opposite)\s+([A-Z]?\d+[A-Z]?)\s+gates\b/i,
      format: (match) => formatNamedArea('Gate Area', match[1]),
    },
    {
      pattern: /\b(?:adjacent\s+to|near|opposite|left\s+to|right\s+to)\s+(?:the\s+)?(?:boarding\s+)?(?:departure\s+)?gates?\b/i,
      format: () => 'Gate Area',
    },
    {
      pattern: /\bgate\s+area\s+([A-Z](?:\s*(?:&|and|\/|-)\s*[A-Z])?|[A-Z]?\d+[A-Z]?)\b/i,
      format: (match) => formatNamedArea('Gate Area', match[1]),
    },
    {
      pattern: /\bboarding\s+area\s+([A-Z](?:\s*(?:&|and|\/|-)\s*[A-Z])?|[A-Z]?\d+[A-Z]?)\b/i,
      format: (match) => formatNamedArea('Boarding Area', match[1]),
    },
    {
      pattern: /\b(?:towards?|near|at|between)\s+(?:contact\s+)?pier\s+(?!level\b|floor\b)([A-Z0-9](?:\s*(?:&|and|-)\s*[A-Z0-9])?)\b/i,
      format: (match) => formatNamedArea(/contact\s+pier/i.test(match[0]) ? 'Contact Pier' : 'Pier', match[1]),
    },
    {
      pattern: /\b(?:in|inside|within|at|near|the)\s+(?:the\s+)?(contact|south|north|east|west)\s+pier\b/i,
      format: (match) => formatReversedNamedArea('Pier', match[1]),
    },
    {
      pattern: /\b(?:contact\s+)?pier\s+(?!level\b|floor\b)([A-Z0-9](?:\s*(?:&|and|-)\s*[A-Z0-9])?)\b/i,
      format: (match) => formatNamedArea(/contact\s+pier/i.test(match[0]) ? 'Contact Pier' : 'Pier', match[1]),
    },
    {
      pattern: /\b(?:international\s+)?pier\s+(?!level\b|floor\b)([A-Z0-9](?:\s*(?:&|and|-)\s*[A-Z0-9])?)\b/i,
      format: (match) => formatNamedArea('Pier', match[1]),
    },
    {
      pattern: /\bsatellite\s+(north|south|east|west|\d+)\b/i,
      format: (match) => formatNamedArea('Satellite', match[1]),
    },
    {
      pattern: /\b(north|south|east|west)\s+satellite\b/i,
      format: (match) => formatNamedArea('Satellite', match[1]),
    },
    {
      pattern: /\b(north|south|east|west)\s+(concourse|wing)\b/i,
      format: (match) => formatReversedNamedArea(titleArea(match[2]), match[1]),
    },
    {
      pattern: /\bsatellite\s+([A-Z]|terminal|building)\b/i,
      format: (match) => formatNamedArea('Satellite', match[1]),
    },
    {
      pattern: /\b(international|domestic|contact|schengen|south|north|east|west)\s+pier\b/i,
      format: (match) => formatReversedNamedArea('Pier', match[1]),
    },
    {
      pattern: /\b([A-Z])\s+pier\b/i,
      format: (match) => formatNamedArea('Pier', match[1]),
    },
    {
      pattern: /\b(north|south)\s+node\b/i,
      format: (match) => formatNamedArea('Node', match[1]),
    },
    {
      pattern: /\bbetween\s+([A-Z])\s*(?:&|and|,)\s*([A-Z])\s+gates\b/i,
      format: (match) => formatGateArea(`${match[1]} & ${match[2]}`, true),
    },
    {
      pattern: /\bnear\s+(?:the\s+)?([A-Z])\s*-?\s*gates\b/i,
      format: (match) => formatGateArea(match[1], true),
    },
    {
      pattern: /\bby\s+([A-Z])\s+gates\b/i,
      format: (match) => formatGateArea(match[1], true),
    },
    {
      pattern: /\btowards?\s+gates?\s+([A-Z](?:\s*,\s*[A-Z])*(?:\s*(?:&|and)\s*[A-Z])?)\b/i,
      format: (match) => formatGateArea(match[1], /[,/&]|\band\b/i.test(match[1])),
    },
    {
      pattern: /\b([A-Z])\s+boarding\s+gates\b/i,
      format: (match) => formatGateArea(match[1], true),
    },
    {
      pattern: /\bboarding\s+gate\s+([A-Z])\b/i,
      format: (match) => formatGateArea(match[1]),
    },
    {
      pattern: /\bgate\s+([A-Z])\b/i,
      format: (match) => formatGateArea(match[1]),
    },
    {
      pattern: /\bgates\s+([A-Z](?:\s*,\s*[A-Z])*(?:\s*(?:&|and)\s*[A-Z])?)\b/i,
      format: (match) => formatGateArea(match[1], true),
    },
    {
      pattern: /\b([A-Z])\s*-?\s*gates\b/i,
      format: (match) => formatGateArea(match[1], true),
    },
  ];

  for (const { pattern, format } of patterns) {
    const match = text.match(pattern);
    const gateArea = match ? format(match) : '';
    if (gateArea) {
      return gateArea;
    }
  }

  return '';
}

function closestOfficialPositionFromStructuredRecord(record) {
  const text = clean([record.name, record.near, record.location, record.directions, record.concourse, record.terminal].filter(Boolean).join(' '));
  const locationText = clean([record.near, record.location, record.directions, record.concourse, record.terminal].filter(Boolean).join(' '));
  if (!text) {
    return '';
  }

  const urlGate = closestGateFromOfficialUrl(record);
  if (urlGate) {
    return urlGate;
  }

  const mapUnit = text.match(/\bMap\s+(?:shop|facilities|dine)\/(?:[^,\s/_]+[\/_])?([0-9][A-Z0-9/-]*)\b/i)?.[1];
  if (mapUnit && !/transit/i.test(mapUnit)) {
    return `Unit ${mapUnit.toUpperCase()}`;
  }

  const namedUnit = text.match(/\b(?:Unit|Shop)\s+([0-9][A-Z0-9/-]*)\b/i)?.[1];
  if (namedUnit) {
    return `Unit ${namedUnit.toUpperCase()}`;
  }

  const namedZone = text.match(/\bZone\s+([A-Z][0-9]?)\b/i)?.[1];
  if (namedZone) {
    return `Zone ${namedZone.toUpperCase()}`;
  }

  const namedWing = text.match(/\b(North|South|East|West)\s+Wing\b/i)?.[1];
  if (namedWing) {
    return `${namedWing[0].toUpperCase()}${namedWing.slice(1).toLowerCase()} Wing`;
  }

  const namedLevel = text.match(/\b(Mezzanine|Lounge|Departures?|Arrivals?)\s+Level\b/i)?.[1];
  if (namedLevel) {
    return `${namedLevel[0].toUpperCase()}${namedLevel.slice(1).toLowerCase()} Level`;
  }

  if (/\bConcourse\s+Level\b/i.test(text)) {
    return 'Concourse Level';
  }

  if (/\bLounge\s+Lobby\b/i.test(text)) {
    return 'Lounge Lobby';
  }

  if (/\bLounge\s+Pavilion\b/i.test(text)) {
    return 'Lounge Pavilion';
  }

  if (/\bAirline\s+Lounges\b/i.test(text)) {
    return 'Airline Lounges';
  }

  const namedSatellite = text.match(/\bSatellite\s+([A-Z0-9]+)(?:\s+Building)?\b/i)?.[1];
  if (namedSatellite) {
    return `Satellite ${namedSatellite.toUpperCase()}`;
  }

  if (/\bVIP\s+Terminal\b/i.test(text)) {
    return 'VIP Terminal';
  }

  if (/\bVIP\s+Area\b/i.test(text)) {
    return 'VIP Area';
  }

  if (/\bSeparate\s+Building\b/i.test(text)) {
    return 'Separate Building';
  }

  if (/\bAir\s+Shuttle\s+Lobby\b/i.test(text)) {
    return 'Air Shuttle Lobby';
  }

  if (/\bPremium\s+Lounges\b/i.test(text)) {
    return 'Premium Lounges';
  }

  if (/\bSecurity\s+Checkpoint\s+Exit\b/i.test(text)) {
    return 'Security Checkpoint Exit';
  }

  const namedModule = text.match(/\bModule\s+([A-Z0-9]+)\b/i)?.[1];
  if (namedModule) {
    return `Module ${namedModule.toUpperCase()}`;
  }

  const namedTransfer = text.match(/\bTransfer\s+([A-Z0-9]+)\b/i)?.[1];
  if (namedTransfer) {
    return `Transfer ${namedTransfer.toUpperCase()}`;
  }

  const namedLobby = text.match(/\b([A-Z][A-Za-z-]+(?:\s+[A-Z][A-Za-z-]+)*)\s+Lobby\b/)?.[1];
  if (namedLobby && !/\b(?:Domestic|International|Main|Terminal|Airport|Lounge)\b/i.test(namedLobby)) {
    return `${namedLobby.replace(/^[A-Z]{3}(?:-[A-Z]{3})?\s+/, '')} Lobby`;
  }

  const aboveRestaurant = text.match(/\bAbove\s+([^,|.]+restaurant)\b/i)?.[1];
  if (aboveRestaurant) {
    return titleArea(aboveRestaurant);
  }

  if (/\bMezzan\s*ine\b/i.test(text) || /\bMezzanine\s+Floor\b/i.test(text)) {
    return 'Mezzanine Level';
  }

  if (/\bGround\s+Level\b/i.test(text)) {
    return 'Ground Level';
  }

  if (/\bGate\s+Level\b/i.test(text)) {
    return 'Gate Level';
  }

  if (/\bArrival\s+Floor\b/i.test(text)) {
    return 'Arrivals Level';
  }

  const ordinalLevel = text.match(/\b(Second|Third|Fourth|Upper|Lower)\s+(?:Floor|Level)\b/i)?.[1];
  if (ordinalLevel) {
    return `${ordinalLevel[0].toUpperCase()}${ordinalLevel.slice(1).toLowerCase()} Level`;
  }

  const spelledLevel = text.match(/\bLevel\s+(One|Two|Three|Four|Five|Six|Seven|Eight|Nine)\b/i)?.[1];
  if (spelledLevel) {
    const levelMap = {
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
    };
    return `Level ${levelMap[spelledLevel.toLowerCase()]}`;
  }

  if (/\bFirst\s+(?:Floor|Level)\b/i.test(text)) {
    return 'Level 1';
  }

  const numericLevel = text.match(/\b(?:on|at|located\s+on|located\s+at)?\s*(?:the\s+)?(\d+)[-\s]?(?:st|nd|rd|th)\s+(?:Floor|Level)\b/i)?.[1];
  if (numericLevel) {
    return `Level ${numericLevel}`;
  }

  const numericFloor = text.match(/\b(\d+)\s*(?:floor|fl\.)\b/i)?.[1];
  if (numericFloor) {
    return `Level ${numericFloor}`;
  }

  const numberedHall = text.match(/\bHall\s+([0-9][A-Z]?)\b/i)?.[1];
  if (numberedHall) {
    return `Hall ${numberedHall.toUpperCase()}`;
  }

  const reversedNumericLevel = text.match(/\b(?:Floor|Level)\s+(\d+)(?:st|nd|rd|th)?\b/i)?.[1];
  if (reversedNumericLevel) {
    return `Level ${reversedNumericLevel}`;
  }

  const slashFloor = text.match(/\b(\d+)\s*\/\s*F\b/i)?.[1];
  if (slashFloor) {
    return `Level ${slashFloor}`;
  }

  const levelNumber = text.match(/\bLevel\s+(\d+)\b/i)?.[1];
  if (levelNumber) {
    return `Level ${levelNumber}`;
  }

  const alphaNumericLevel = text.match(/\bLevel\s+(-?\d+|[A-Z]\d+)\b/i)?.[1];
  if (alphaNumericLevel) {
    return `Level ${alphaNumericLevel.toUpperCase()}`;
  }

  const prefixConnector = text.match(/\bConnector\s+([A-Z](?:\s*(?:\/|-|&|and)\s*[A-Z])*)\b/i)?.[1] ?? '';
  const suffixConnector = prefixConnector
    ? ''
    : text.match(/\b([A-Z](?:\s*(?:\/|-|&|and)\s*[A-Z])*)\s+Connector\b/i)?.[1] ?? '';
  if (suffixConnector || prefixConnector) {
    const normalizedConnector = (suffixConnector || prefixConnector)
      .toUpperCase()
      .replace(/\s*\/\s*/g, '/')
      .replace(/\s*-\s*/g, '-')
      .replace(/\s*&\s*/g, ' & ')
      .replace(/\s+AND\s+/g, ' & ')
      .replace(/\s+/g, ' ')
      .trim();
    return suffixConnector ? `${normalizedConnector} Connector` : `Connector ${normalizedConnector}`;
  }

  if (/\bSky\s+Way\b/i.test(text)) {
    return 'Sky Way';
  }

  if (/\bConnector\s+Building\b/i.test(text)) {
    return 'Connector Building';
  }

  const betweenTerminals = text.match(
    /\bBetween\s+Terminals?\s+([0-9][A-Z]?)\s*(?:&|and|,|-|to)\s*([0-9][A-Z]?)\b/i,
  );
  if (betweenTerminals) {
    return `Terminals ${betweenTerminals[1].toUpperCase()} & ${betweenTerminals[2].toUpperCase()}`;
  }

  const concourse =
    text.match(/\bConcourses?\s+([A-Z][0-9]?(?:\s*(?:\/|-|&|and)\s*[A-Z][0-9]?)*)\b/i)?.[1] ||
    text.match(/\b([A-Z])\s+Concourse\b/i)?.[1] ||
    '';
  if (concourse) {
    const normalizedConcourse = concourse
      .toUpperCase()
      .replace(/\s*\/\s*/g, '/')
      .replace(/\s*-\s*/g, '-')
      .replace(/\s*&\s*/g, ' & ')
      .replace(/\s+AND\s+/g, ' & ')
      .replace(/\s+/g, ' ')
      .trim();
    const prefix = /[/&-]/.test(normalizedConcourse) ? 'Concourses' : 'Concourse';
    return `${prefix} ${normalizedConcourse}`;
  }

  const directionalConcourse = locationText.match(/\b(Eastern|Western|Northern|Southern)\s+Concourse\b/i)?.[1];
  if (directionalConcourse) {
    return `${directionalConcourse[0].toUpperCase()}${directionalConcourse.slice(1).toLowerCase()} Concourse`;
  }

  if (/\bGround\s+Floor\b/i.test(text)) {
    return 'Ground Level';
  }

  if (/\bMain\s+Lobby\b/i.test(text)) {
    return 'Main Lobby';
  }

  if (/\bMain\s+Departures?\s+Area\b/i.test(text)) {
    return 'Main Departures Area';
  }

  if (/\bInternational\s+Departures?\s+Area\b/i.test(text)) {
    return 'International Departures Area';
  }

  if (/\bDomestic\s+Departures?\s+Area\b/i.test(text)) {
    return 'Domestic Departures Area';
  }

  const tsaEntrance = locationText.match(/\b(North|South|East|West)\s+TSA\s+Entrance\b/i)?.[1];
  if (tsaEntrance) {
    return `${tsaEntrance[0].toUpperCase()}${tsaEntrance.slice(1).toLowerCase()} TSA Entrance`;
  }

  if (/\bNational\s+Hall\b/i.test(locationText)) {
    return 'National Hall';
  }

  if (/\bTSA\s+PreCheck\s+(?:and|&)\s+Clear\s+Security\s+Checkpoints?\b/i.test(locationText)) {
    return 'TSA PreCheck & Clear Security Checkpoints';
  }

  if (/\bSecurity\s+Checkpoints?\b/i.test(locationText)) {
    return 'Security Checkpoint';
  }

  if (/\bRailway\s*,?\s+Departures?\b/i.test(locationText)) {
    return 'Railway Departure';
  }

  if (/\bUS\s+Departures?\b/i.test(locationText)) {
    return 'US Departures';
  }

  if (/\bDepartures?\s+Hall\b/i.test(text)) {
    return 'Departure Hall';
  }

  if (/\bDepartures?\s+Areas?\b/i.test(text) || /\bDepartire\s+Area\b/i.test(text)) {
    return 'Departures Area';
  }

  if (/\b(?:Domestic|International|Restricted)?\s*Boarding\s+Area\b/i.test(text)) {
    return 'Boarding Area';
  }

  if (/\bCheck-?in\s*(?:&|and)\s*Arrivals?\b/i.test(text)) {
    return 'Check-in & Arrivals';
  }

  if (/\bArrivals?\s+Hall\b/i.test(text)) {
    return 'Arrivals Hall';
  }

  if (/\bArrivals?\s+Areas?\b/i.test(text)) {
    return 'Arrivals Area';
  }

  if (/\bArrivals?\s+Terminal\b/i.test(locationText)) {
    return 'Arrivals Terminal';
  }

  if (/\bCentral\s+Area\b/i.test(text)) {
    return 'Central Area';
  }

  if (/\bArea\s+Regional\b/i.test(text)) {
    return 'Regional Area';
  }

  if (/\bInternational\s+Area\b/i.test(text)) {
    return 'International Area';
  }

  if (/\bDomestic\s+Area\b/i.test(text)) {
    return 'Domestic Area';
  }

  if (/\bSouth\s+Dam\b/i.test(text)) {
    return 'South Dam';
  }

  if (/\bRestricted\s+Area\b/i.test(text)) {
    return 'Restricted Area';
  }

  if (/\b(?:Non-)?Schengen\s+Pier\b/i.test(text)) {
    return text.match(/\bNon-Schengen\s+Pier\b/i) ? 'Non-Schengen Pier' : 'Schengen Pier';
  }

  if (/\b(?:International\s+&\s+)?Non-Schengen\s+(?:Area|Zone)s?\b/i.test(text) || /\bNon-Schengen\b/i.test(text)) {
    return /\bZone\b/i.test(text) ? 'Non-Schengen Zone' : 'Non-Schengen Area';
  }

  if (/\bSchengen\s+(?:Area|Zone)s?\b/i.test(text) || /\bSchengen\b/i.test(text)) {
    return /\bZone\b/i.test(text) ? 'Schengen Zone' : 'Schengen Area';
  }

  if (
    /\b(?:Duty\s*Free|Duty-free)\s+(?:Area|Shop|Shops|Lounges?)\b/i.test(text) ||
    /\b(?:Near|After|Next\s+to)\s+Duty\s*Free\b/i.test(text) ||
    /\bDuty\s*Free\s*,/i.test(text) ||
    /\bDuty\s*Free\b/i.test(text)
  ) {
    return 'Duty Free Area';
  }

  if (/\bFood\s*Court\b/i.test(text)) {
    return 'Food Court';
  }

  if (/\bFood\s+Hall\b/i.test(text)) {
    return 'Food Hall';
  }

  const checkIn = text.match(/\bCheck-?in\s+([A-Z0-9]+)\b/i)?.[1];
  if (checkIn && !new Set(['MAP', 'UNKNOWN', 'VIEW']).has(checkIn.toUpperCase())) {
    return `Check-in ${checkIn.toUpperCase()}`;
  }

  if (/\b(?:next\s+to|near|at|beside|opposite)?\s*(?:the\s+)?check-?in\b/i.test(text)) {
    return 'Check-in Area';
  }

  if (/\b(?:boarding|departure)\s+gates?\s+area\b/i.test(text) || /\bopposite\s+departure\s+gates?\b/i.test(text)) {
    return 'Gate Area';
  }

  if (/\bLandside\s+Area\b/i.test(locationText)) {
    return 'Landside Area';
  }

  if (/^Landside(?:\s*,|$)/i.test(locationText)) {
    return 'Landside Area';
  }

  if (/\bOutside\s+the\s+Terminal\b/i.test(locationText)) {
    return 'Outside Terminal';
  }

  if (/\bInternational\s+Departures?\b/i.test(text)) {
    return 'International Departures';
  }

  if (/\bDomestic\s+Departures?\b/i.test(text)) {
    return 'Domestic Departures';
  }

  if (/\bTransborder\s+Departures?\b/i.test(text)) {
    return 'Transborder Departures';
  }

  if (/^Departures?(?:\s*,|$)/i.test(locationText)) {
    return 'Departures Area';
  }

  if (/^Arrivals?(?:\s*,|$)/i.test(locationText)) {
    return 'Arrivals Area';
  }

  const loungeLetter = text.match(/\bLounge\s+([A-Z])\b/i)?.[1];
  if (loungeLetter) {
    return `Lounge ${loungeLetter.toUpperCase()}`;
  }

  if (/\bAirside\s+Atrium\b/i.test(text)) {
    return 'Airside Atrium';
  }

  if (/\bPassport\s+Control\b/i.test(text)) {
    return 'Passport Control';
  }

  if (/\bImmigration\b/i.test(text)) {
    return 'Immigration';
  }

  const airsideMatch = text.match(/\bAirside\s+(\d+)\b/i)?.[1];
  if (airsideMatch) {
    return `Airside ${airsideMatch}`;
  }

  return '';
}

function closestGateFromOfficialUrl(record) {
  if (!record.sourceUrl) {
    return '';
  }

  let slug = '';
  try {
    const url = new URL(record.sourceUrl);
    slug = decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) ?? '').toLowerCase();
  } catch {
    return '';
  }

  const nearGate = slug.match(/\bnear-gate-([a-z0-9-]+)$/i)?.[1];
  if (nearGate) {
    return formatExactGate(gateNumberFromWords(nearGate));
  }

  const loungeGate = slug.match(/^(.+)-gate-([a-z0-9-]+)$/i);
  if (!loungeGate) {
    return '';
  }

  const recordNameSlug = slugify(record.name);
  const slugName = loungeGate[1];
  if (!recordNameSlug || slugName !== recordNameSlug) {
    return '';
  }

  return formatExactGate(gateNumberFromWords(loungeGate[2]));
}

function priceAmount(value) {
  const amount = Number(String(value ?? '').replace(/[^0-9.]+/g, ''));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function pushAccessOffer(offers, { amount, currency, source, url, retrievedAt, label = '', type = 'paid_entry' }) {
  const normalizedAmount = priceAmount(amount);
  const normalizedCurrency = clean(currency).toUpperCase();
  if (!normalizedAmount || !/^[A-Z]{3}$/.test(normalizedCurrency)) {
    return;
  }

  const sourceUrl = url || source.structuredApi?.loungeUrlTemplate || source.finalUrl || source.url;
  const normalizedLabel = clean(label) || `${normalizedCurrency} ${normalizedAmount.toFixed(2).replace(/\.00$/, '')}`;
  const offer = {
    type: clean(type) || 'paid_entry',
    label: normalizedLabel,
    amount: normalizedAmount,
    currency: normalizedCurrency,
    sourceId: source.sourceId,
    url: sourceUrl,
    retrievedAt,
  };
  const key = `${offer.type}|${offer.currency}|${offer.amount}|${offer.sourceId}|${offer.url}`;
  if (!offers.some((existing) => `${existing.type}|${existing.currency}|${existing.amount}|${existing.sourceId}|${existing.url}` === key)) {
    offers.push(offer);
  }
}

function variantPriceEntries(shopifyProductData) {
  const variants = shopifyProductData?.variants;
  const variantItems = Array.isArray(variants)
    ? variants
    : Array.isArray(variants?.edges)
    ? variants.edges.map((edge) => edge?.node)
    : [];
  const prices = [];

  for (const rawVariant of variantItems) {
    const variant = rawVariant?.node ?? rawVariant;
    if (!variant || typeof variant !== 'object') {
      continue;
    }
    const fallbackCurrency = variant.currencyCode ?? variant.currency ?? shopifyProductData.currencyCode ?? shopifyProductData.currency;

    for (const price of [variant.price, variant.priceV2].filter(Boolean)) {
      if (typeof price === 'number' || typeof price === 'string') {
        prices.push({ amount: price, currencyCode: fallbackCurrency, url: variant.url });
      } else {
        prices.push({ ...price, url: price.url ?? variant.url });
      }
    }

    const presentmentPrices = variant.presentmentPrices;
    const presentmentItems = Array.isArray(presentmentPrices)
      ? presentmentPrices
      : Array.isArray(presentmentPrices?.edges)
      ? presentmentPrices.edges.map((edge) => edge?.node)
      : [];

    for (const presentment of presentmentItems) {
      const price = presentment?.price ?? presentment;
      if (price && typeof price === 'object') {
        prices.push({ ...price, url: price.url ?? presentment?.url ?? variant.url });
      }
    }
  }

  return prices;
}

function accessOffersFromStructuredRecord({ record, source, retrievedAt }) {
  const offers = [];
  const directPrices = [
    record.price,
    record.pricing,
    record.shopifyProductData?.price,
    record.shopifyProductData?.prices,
    ...variantPriceEntries(record.shopifyProductData),
    record.prices,
  ]
    .filter(Boolean)
    .flatMap((price) => (Array.isArray(price) ? price : [price]));

  for (const price of directPrices) {
    if (typeof price === 'number' || typeof price === 'string') {
      pushAccessOffer(offers, {
        amount: price,
        currency: record.currency || record.currencyCode,
        source,
        url: record.sourceUrl,
        retrievedAt,
      });
      continue;
    }

    if (price.amount || price.currency || price.currencyCode) {
      pushAccessOffer(offers, {
        amount: price.amount ?? price.value,
        currency: price.currencyCode ?? price.currency,
        source,
        url: price.url || price.sourceUrl || record.sourceUrl,
        retrievedAt,
        label: price.label,
        type: price.type,
      });
    }

    for (const value of Object.values(price)) {
      if (value && typeof value === 'object') {
        pushAccessOffer(offers, {
          amount: value.amount ?? value.value,
          currency: value.currencyCode ?? value.currency,
          source,
          url: value.url || value.sourceUrl || price.url || price.sourceUrl || record.sourceUrl,
          retrievedAt,
          type: value.type || price.type,
        });
      }
    }
  }

  return offers.map((offer) => ({
    ...offer,
    url: offer.url?.replace('{airportCode}', clean(record.airportCode).toUpperCase()),
  }));
}

function makeStructuredCandidateRecord({ source, registryEntry, record, airport, retrievedAt }) {
  const code = clean(record.airportCode).toUpperCase();
  const coordinates = coordinatesFromStructuredRecord(record, airport);
  const sourceRecordId = slugify(record.sourceRecordId || `${code}-${record.name}`);
  const name = clean(record.name) || candidateLabel(source.sourceId, code);
  const brand = clean(record.brand) || registryEntry.publisher;
  const brandAsset = resolveBrandAsset(brand, name, source.sourceId);
  const terminal = clean(record.terminal) || 'Unknown';
  const closestGate =
    closestGateFromStructuredRecord(record) ||
    closestGateAreaFromStructuredRecord(record) ||
    closestOfficialPositionFromStructuredRecord(record);
  const locationParts = unique([record.concourse, record.near, record.securitySide]);
  const accessPrograms = unique([...programsForSource(source.sourceId), ...(record.programs ?? []), record.accessTier, record.accessClass]);
  const restrictions = unique([record.accessConditions, record.accessNotes]);
  const exceptions = unique(record.exceptions ?? []);
  const amenities = amenitiesFromStructuredRecord(record);
  const hours = cleanHours(record.openHours, record.hoursText);
  const plannedOpening = clean(record.plannedOpening);
  const accessOffers = accessOffersFromStructuredRecord({ record, source, retrievedAt });
  const conflicts = ['manual_review_required'];
  const sourceHasAmenityBooleans = Object.keys(record.amenities ?? {}).length > 0;
  const primarySourceUrl = record.sourceUrl
    ? record.sourceUrl
    : source.structuredApi?.loungeUrlTemplate
    ? `${source.structuredApi.loungeUrlTemplate.replace('{airportCode}', code)}`
    : source.finalUrl || source.url;
  const primarySourceCoversOffers = accessOffers.some((offer) => !clean(offer.url) || clean(offer.url) === clean(primarySourceUrl));
  const offerSourceUrls = unique(
    accessOffers.map((offer) => clean(offer.url)).filter((url) => url && url !== clean(primarySourceUrl)),
  );

  if (!hours && !plannedOpening) {
    conflicts.push('missing_hours');
  }
  if (terminal === 'Unknown') {
    conflicts.push('unknown_terminal');
  }
  if (!sourceHasAmenityBooleans) {
    conflicts.push('missing_amenities');
  }
  const canApprove = conflicts.length === 1;

  return {
    lounge: {
      id: `candidate-${source.sourceId}-${code.toLowerCase()}-${sourceRecordId}`,
      name,
      brand,
      brandAsset,
      operator: clean(record.operator) || registryEntry.publisher,
      category: 'lounge',
      status: clean(record.status) || 'candidate',
      programs: accessPrograms,
      accessMethods: accessMethodsForSource(source.sourceId),
    },
    airport: {
      iata: code,
      icao: '',
      name: clean(record.airportName) || airport?.name || code,
      city: airport?.city || clean(record.airportCity),
      country: airport?.country || '',
      timezone: '',
      coordinates,
    },
    location: {
      terminal,
      concourse: clean(record.concourse),
      gate: closestGate,
      securitySide: clean(record.securitySide),
      directions: locationParts.join(', '),
    },
    operations: {
      hours,
      exceptions,
      plannedOpening,
      lastVerifiedAt: retrievedAt,
    },
    accessOffers,
    amenities,
    restrictions,
    guestPolicy: restrictions.find((restriction) => /guest|eligible|access/i.test(restriction)) ?? '',
    notes: ['Candidate imported from official public source intake.'],
    sources: [
      {
        sourceId: source.sourceId,
        publisher: registryEntry.publisher,
        url: primarySourceUrl,
        retrievedAt,
        fieldCoverage: [
          'lounge.name',
          'airport.iata',
          'airport.name',
          ...(terminal !== 'Unknown' ? ['location.terminal'] : []),
          ...(closestGate ? ['location.gate'] : []),
          ...(hours ? ['operations.hours'] : []),
          ...(plannedOpening ? ['operations.plannedOpening'] : []),
          ...(exceptions.length > 0 ? ['operations.exceptions'] : []),
          ...(primarySourceCoversOffers ? ['access.accessOffers'] : []),
          'amenities',
          'restrictions',
        ],
        confidence: canApprove ? 0.82 : 0.68,
        rightsNote: registryEntry.rightsNote,
      },
      ...offerSourceUrls.map((url) => ({
        sourceId: source.sourceId,
        publisher: registryEntry.publisher,
        url,
        retrievedAt,
        fieldCoverage: ['access.accessOffers'],
        confidence: canApprove ? 0.82 : 0.68,
        rightsNote: registryEntry.rightsNote,
      })),
    ],
    quality: {
      completeness: canApprove ? 86 : 68,
      freshness: 100,
      conflicts: canApprove ? [] : conflicts,
      reviewStatus: canApprove ? 'approved' : 'review',
    },
  };
}

export function createNonPriorityCandidateRecords({ report, features, generatedAt, airportAuthority }) {
  const registry = sourceById();
  const airportLookup = createAirportAuthorityLookup({
    features,
    authority: airportAuthority?.airports ?? airportAuthority ?? [],
  });
  const records = [];

  for (const source of report?.sources ?? []) {
    if (source.sourceId === 'priority-pass' || source.status !== 'fetched') {
      continue;
    }

    const registryEntry = registry.get(source.sourceId);
    if (!registryEntry) {
      continue;
    }

    const structuredAirportCodes = new Set();
    const sourceRetrievedAt = source.retrievedAt ?? report.generatedAt ?? generatedAt;

    for (const structuredRecord of source.structuredRecords ?? []) {
      if (structuredRecordRedirectedOutsideOperator(source, structuredRecord)) {
        continue;
      }
      const code = clean(structuredRecord.airportCode).toUpperCase();
      const fallbackAirport = airportLookup.get(code);
      const coordinates = coordinatesFromStructuredRecord(structuredRecord, fallbackAirport);
      if (!/^[A-Z0-9]{3}$/.test(code) || !coordinates) {
        continue;
      }
      structuredAirportCodes.add(code);
      const recordRetrievedAt = structuredRecord.retrievedAt ?? sourceRetrievedAt;
      records.push(
        makeStructuredCandidateRecord({
          source,
          registryEntry,
          record: structuredRecord,
          airport: fallbackAirport,
          retrievedAt: recordRetrievedAt,
        }),
      );
    }

    const linkCandidates = codesFromLinks(source.sourceId, source.loungeLinks ?? []);
    const mentionCandidates = codesFromAirportMentions(source);
    const byCode = new Map();

    for (const candidate of [...linkCandidates, ...mentionCandidates]) {
      if (!/^[A-Z0-9]{3}$/.test(candidate.code) || !airportLookup.has(candidate.code)) {
        continue;
      }
      if (structuredAirportCodes.has(candidate.code)) {
        continue;
      }
      const current = byCode.get(candidate.code);
      if (!current || (!current.fromLink && linkCandidates.some((item) => item.code === candidate.code))) {
        byCode.set(candidate.code, {
          ...candidate,
          fromLink: linkCandidates.some((item) => item.code === candidate.code),
        });
      }
    }

    for (const candidate of [...byCode.values()].sort((first, second) => first.code.localeCompare(second.code))) {
      records.push(
        makeCandidateRecord({
          source,
          registryEntry,
          airport: airportLookup.get(candidate.code),
          code: candidate.code,
          url: candidate.url || source.finalUrl || source.url,
          retrievedAt: sourceRetrievedAt,
          fromLink: candidate.fromLink,
        }),
      );
    }
  }

  return unique(records.map((record) => record.lounge.id)).map((id) =>
    records.find((record) => record.lounge.id === id),
  );
}

function makeStructuredLookup(report) {
  const lookup = new Map();
  for (const source of report?.sources ?? []) {
    for (const record of source.structuredRecords ?? []) {
      const key = `${source.sourceId}|${clean(record.airportCode).toUpperCase()}|${clean(record.name).toLowerCase()}`;
      lookup.set(key, record);
    }
  }
  return lookup;
}

function makeSourceEvidenceLookup(report) {
  const lookup = new Map();
  for (const source of report?.sources ?? []) {
    const codes = new Set(source.airportCodes ?? []);
    for (const candidate of codesFromLinks(source.sourceId, source.loungeLinks ?? [])) {
      codes.add(candidate.code);
    }
    for (const page of source.childPages ?? []) {
      for (const code of page.airportCodes ?? []) {
        codes.add(clean(code).toUpperCase());
      }
    }
    lookup.set(source.sourceId, {
      status: source.status,
      airportCodes: codes,
      hasStructuredRecords: (source.structuredRecords ?? []).length > 0,
    });
  }
  return lookup;
}

function increment(summary, key, count = 1) {
  const normalizedKey = clean(key) || 'unknown';
  summary[normalizedKey] = (summary[normalizedKey] ?? 0) + count;
  return summary;
}

function buildReviewAction({ row, checks }) {
  if (row.reviewStatus === 'approved') {
    return {
      queue: 'publishable',
      action: 'publish',
      reason: 'official_structured_payload_complete',
    };
  }

  const missing = [];
  if (!checks.structuredPayloadMatch) {
    missing.push('structured_payload');
  }
  if (!checks.hasHours) {
    missing.push('hours');
  }
  if (!checks.hasTerminal) {
    missing.push('terminal');
  }
  if (!checks.hasSourceUrl) {
    missing.push('source_url');
  }
  if (!checks.airportEvidenceMatch) {
    missing.push('airport_evidence');
  }
  if (!checks.hasCountry) {
    missing.push('country');
  }

  return {
    queue: row.validationStatus === 'airport_code_evidence_only' ? 'official_airport_code_review' : 'source_evidence_review',
    action: 'manual_review',
    reason: missing.length > 0 ? `missing_${missing.join('_')}` : 'manual_review_required',
  };
}

function summarizeValidationRows(rows) {
  const byStatus = {};
  const byDecision = {};
  const bySourceDecision = {};
  const byReviewQueue = {};
  const byConflict = {};

  for (const row of rows) {
    increment(byStatus, row.validationStatus);
    increment(byDecision, row.reviewStatus);
    increment(byReviewQueue, row.reviewAction.queue);

    const sourceSummary = bySourceDecision[row.sourceId] ?? {
      sourceId: row.sourceId,
      publisher: row.publisher,
      total: 0,
      approved: 0,
      review: 0,
      publishable: 0,
      manualReview: 0,
    };
    sourceSummary.total += 1;
    sourceSummary[row.reviewStatus] = (sourceSummary[row.reviewStatus] ?? 0) + 1;
    if (row.reviewAction.action === 'publish') {
      sourceSummary.publishable += 1;
    }
    if (row.reviewAction.action === 'manual_review') {
      sourceSummary.manualReview += 1;
    }
    bySourceDecision[row.sourceId] = sourceSummary;

    for (const conflict of row.conflicts) {
      increment(byConflict, conflict);
    }
  }

  return {
    byStatus,
    byDecision,
    byReviewQueue,
    byConflict,
    bySourceDecision: Object.values(bySourceDecision).sort((first, second) =>
      first.sourceId.localeCompare(second.sourceId),
    ),
  };
}

export function createNonPriorityValidationReport({ records, report, generatedAt }) {
  const nonPriorityRecords = records.filter((record) => record.sources[0]?.sourceId !== 'priority-pass');
  const structuredLookup = makeStructuredLookup(report);
  const sourceEvidenceLookup = makeSourceEvidenceLookup(report);
  const rows = nonPriorityRecords.map((record) => {
    const primarySource = record.sources[0];
    const sourceId = primarySource.sourceId;
    const airportCode = clean(record.airport.iata).toUpperCase();
    const structuredKey = `${sourceId}|${airportCode}|${clean(record.lounge.name).toLowerCase()}`;
    const structuredRecord = structuredLookup.get(structuredKey);
    const sourceEvidence = sourceEvidenceLookup.get(sourceId);
    const checks = {
      officialSourceFetched: sourceEvidence?.status === 'fetched',
      structuredPayloadMatch: Boolean(structuredRecord),
      airportEvidenceMatch: Boolean(sourceEvidence?.airportCodes.has(airportCode)),
      nameMatch: structuredRecord ? clean(structuredRecord.name) === clean(record.lounge.name) : false,
      terminalMatch: structuredRecord ? clean(structuredRecord.terminal || 'Unknown') === clean(record.location.terminal) : false,
      hasHours: hasValue(record.operations.hours),
      hasTerminal: hasValue(record.location.terminal),
      hasCoordinates:
        Number.isFinite(Number(record.airport.coordinates?.lat)) &&
        Number.isFinite(Number(record.airport.coordinates?.lon)),
      hasCountry: hasValue(record.airport.country),
      hasSourceUrl: primarySource.url.startsWith('https://'),
    };
    const validationStatus = checks.structuredPayloadMatch
      ? 'verified_official_structured_payload'
      : checks.airportEvidenceMatch
        ? 'airport_code_evidence_only'
        : 'unmatched_source_evidence';

    const row = {
      recordId: record.lounge.id,
      sourceId,
      publisher: primarySource.publisher,
      name: record.lounge.name,
      airportCode,
      airportName: record.airport.name,
      city: record.airport.city,
      country: record.airport.country,
      terminal: record.location.terminal,
      sourceUrl: primarySource.url,
      validationStatus,
      reviewStatus: record.quality.reviewStatus,
      confidence: primarySource.confidence,
      conflicts: record.quality.conflicts,
      checks,
    };
    return {
      ...row,
      reviewAction: buildReviewAction({ row, checks }),
    };
  });
  const summary = summarizeValidationRows(rows);

  return {
    generatedAt,
    policy: {
      approvalRule:
        'Only exact official structured payload matches with hours, terminal, coordinates, and source URL can be approved.',
      reviewRule: 'Airport-code-only, link-only, missing-hour, missing-terminal, or unmatched records remain review-only.',
      lineReviewRule:
        'Every non-Priority Pass candidate must have a reviewAction before catalog promotion.',
    },
    stats: {
      total: rows.length,
      byStatus: summary.byStatus,
      byDecision: summary.byDecision,
      byReviewQueue: summary.byReviewQueue,
      byConflict: summary.byConflict,
      bySourceDecision: summary.bySourceDecision,
      unmatched: rows.filter((row) => row.validationStatus === 'unmatched_source_evidence').length,
    },
    rows,
  };
}
