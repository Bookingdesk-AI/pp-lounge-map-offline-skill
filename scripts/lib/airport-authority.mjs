function clean(value) {
  return String(value ?? '').trim();
}

function countryCodeToName(code) {
  const normalized = clean(code).toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    return clean(code);
  }

  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(normalized) ?? normalized;
  } catch {
    return normalized;
  }
}

export function normalizeAirportAuthorityItem(item, sourceId = 'all-routes') {
  const iata = clean(item.iata ?? item.id).toUpperCase();
  const icao = clean(item.icao).toUpperCase();
  const lat = Number(item.lat ?? item.latitude ?? item.coordinates?.lat);
  const lon = Number(item.lon ?? item.longitude ?? item.coordinates?.lon);

  if (!/^[A-Z0-9]{3}$/.test(iata) || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  return {
    iata,
    icao,
    name: clean(item.name) || iata,
    city: clean(item.city),
    country: countryCodeToName(item.country),
    countryCode: clean(item.country).toUpperCase(),
    timezone: clean(item.timezone),
    coordinates: { lat, lon },
    sourceId,
    sourceAirportId: clean(item.id) || iata,
  };
}

export function createAirportAuthorityLookup({ features = [], authority = [] } = {}) {
  const lookup = new Map();

  for (const item of authority ?? []) {
    const airport = normalizeAirportAuthorityItem(item, item.sourceId ?? 'all-routes');
    if (!airport) {
      continue;
    }
    lookup.set(airport.iata, airport);
  }

  for (const feature of features ?? []) {
    const properties = feature.properties ?? {};
    const code = clean(properties.airportCode).toUpperCase();
    const [lon, lat] = feature.geometry?.coordinates ?? [];
    if (!/^[A-Z0-9]{3}$/.test(code) || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
      continue;
    }

    const existing = lookup.get(code);
    lookup.set(code, {
      iata: code,
      icao: existing?.icao ?? '',
      name: clean(properties.airportName) || existing?.name || code,
      city: clean(properties.city) || existing?.city || '',
      country: clean(properties.country) || existing?.country || '',
      countryCode: existing?.countryCode ?? '',
      timezone: existing?.timezone ?? '',
      coordinates: {
        lat: Number(lat),
        lon: Number(lon),
      },
      sourceId: existing ? `${existing.sourceId}+priority-pass` : 'priority-pass',
      sourceAirportId: existing?.sourceAirportId ?? code,
    });
  }

  return lookup;
}

export function createAirportAuthorityReport({ generatedAt, sourceUrl, items }) {
  const airports = [...items]
    .map((item) => normalizeAirportAuthorityItem(item, 'all-routes'))
    .filter(Boolean)
    .sort((first, second) => first.iata.localeCompare(second.iata));

  return {
    generatedAt,
    source: {
      id: 'all-routes-airport-authority',
      publisher: 'All Routes / OurAirports',
      url: sourceUrl,
      rightsNote: 'Centralized Desk.Travel airport authority backed by all-routes and OurAirports; used for airport identity normalization only.',
    },
    stats: {
      airports: airports.length,
      withIcao: airports.filter((airport) => airport.icao).length,
      withTimezone: airports.filter((airport) => airport.timezone).length,
      countries: new Set(airports.map((airport) => airport.countryCode || airport.country).filter(Boolean)).size,
    },
    airports,
  };
}
