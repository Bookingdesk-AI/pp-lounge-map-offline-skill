import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import type {
  AppView,
  CanonicalLoungeRecord,
  CloudflareSourceIntakePlan,
  CloudflareSourceRunEvidence,
  CoverageGapReport,
  LoungeBrandAsset,
  LoungeFeature,
  LoungeFeatureCollection,
  LoungeFeatureProperties,
  LoungeMeta,
  LoungeSourceRegistryEntry,
  MobileSheetMode,
  MobileUIState,
  QuickFilterPreset,
  SheetSnap,
  SortOption,
} from './types';
import {
  LoungeClusterLayer,
  type MapInteractionStatus,
} from './map/cluster/LoungeClusterLayer';
import { coordinateKey } from './map/cluster/coordinateKey';
import './App.css';

const SORT_LABELS: Record<SortOption, string> = {
  best_match: 'Best',
  airport_code: 'Airport',
  country_city: 'Location',
  type: 'Type',
};

const WORLD_CENTER: [number, number] = [22.5, 11.5];
const WORLD_ZOOM = 2;
const MOBILE_MEDIA_QUERY = '(max-width: 980px)';
const SHEET_ORDER: SheetSnap[] = ['peek', 'mid', 'full'];
const COMPARE_LIMIT = 3;
const INTERNAL_VIEWS_ENABLED = import.meta.env.DEV;
const MOBILE_MODE_LABELS: Record<MobileSheetMode, string> = {
  results: 'Results',
  filters: 'Filters',
  details: 'Details',
  compare: 'Compare',
  review: 'Review',
  intake: 'Intake',
};

interface InitialUrlState {
  search: string;
  selectedTypes: string[];
  selectedCountry: string;
  selectedCity: string;
  selectedBrand: string;
  selectedFacilities: string[];
  selectedId: string | null;
  sheet: SheetSnap;
  mode: MobileSheetMode;
  sort: SortOption;
  view: AppView;
}

interface MobileFilterDraft {
  search: string;
  types: string[];
  country: string;
  city: string;
  brand: string;
  facilities: string[];
  sort: SortOption;
}

interface BrandFilterOption {
  value: string;
  label: string;
  count: number;
}

interface FilterSummaryChip {
  key: string;
  label: string;
  onRemove: () => void;
}

const COUNTRY_FLAG_CODE_OVERRIDES: Record<string, string> = {
  curacao: 'CW',
  'democratic republic of the congo': 'CD',
  'republic of the congo': 'CG',
  'south korea': 'KR',
  taiwan: 'TW',
  tanzania: 'TZ',
  turkey: 'TR',
  'united states of america': 'US',
};

const ISO_REGION_CODES = [
  'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ',
  'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS',
  'BT', 'BV', 'BW', 'BY', 'BZ', 'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN',
  'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE',
  'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE', 'GF',
  'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HM',
  'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM',
  'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC',
  'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK',
  'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA',
  'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG',
  'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW',
  'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS',
  'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO',
  'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI',
  'VN', 'VU', 'WF', 'WS', 'YE', 'YT', 'ZA', 'ZM', 'ZW',
];

let countryCodeByName: Map<string, string> | null = null;

function parseListParam(params: URLSearchParams, key: string) {
  return (params.get(key) ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeCountryKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getCountryCodeByName() {
  if (countryCodeByName) {
    return countryCodeByName;
  }

  countryCodeByName = new Map(
    Object.entries(COUNTRY_FLAG_CODE_OVERRIDES).map(([country, code]) => [normalizeCountryKey(country), code]),
  );

  if (typeof Intl.DisplayNames !== 'function') {
    return countryCodeByName;
  }

  const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });

  for (const code of ISO_REGION_CODES) {
    const countryName = displayNames.of(code);
    if (countryName) {
      countryCodeByName.set(normalizeCountryKey(countryName), code);
    }
  }

  return countryCodeByName;
}

function countryFlag(country: string) {
  if (normalizeCountryKey(country) === 'taiwan') {
    return 'TW';
  }

  const code = getCountryCodeByName().get(normalizeCountryKey(country));
  if (!code || !/^[A-Z]{2}$/.test(code)) {
    return '';
  }

  return String.fromCodePoint(
    ...code.split('').map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65),
  );
}

function formatCountryLabel(country: string) {
  const flag = countryFlag(country);
  return flag ? `${flag} ${country}` : country;
}

function normalizeSheet(value: string | null): SheetSnap {
  if (value === 'peek' || value === 'mid' || value === 'full') {
    return value;
  }
  return 'mid';
}

function normalizeMode(value: string | null): MobileSheetMode {
  if (value === 'results' || value === 'filters' || value === 'details' || value === 'compare' || value === 'review') {
    return value;
  }
  if (INTERNAL_VIEWS_ENABLED && value === 'intake') {
    return value;
  }
  return 'results';
}

function normalizeSort(value: string | null): SortOption {
  if (value === 'best_match' || value === 'airport_code' || value === 'country_city' || value === 'type') {
    return value;
  }
  return 'country_city';
}

function normalizeView(value: string | null): AppView {
  if (!INTERNAL_VIEWS_ENABLED) {
    return 'map';
  }

  if (value === 'map' || value === 'intake' || value === 'schema' || value === 'sources') {
    return value;
  }
  return 'map';
}

function quickPresetForType(type: string): QuickFilterPreset {
  switch (type) {
    case 'LOUNGE':
      return 'type_lounge';
    case 'EAT':
      return 'type_eat';
    case 'REST':
      return 'type_rest';
    case 'REFRESH':
      return 'type_refresh';
    case 'UNWIND':
      return 'type_unwind';
    default:
      return 'none';
  }
}

function readInitialUrlState(): InitialUrlState {
  const params = new URLSearchParams(window.location.search);
  const isInitialMobile = window.matchMedia(MOBILE_MEDIA_QUERY).matches;
  const hasSheet = params.has('sheet');

  return {
    search: (params.get('q') ?? '').trim(),
    selectedTypes: parseListParam(params, 'type'),
    selectedCountry: params.get('country') ?? 'ALL',
    selectedCity: params.get('city') ?? 'ALL',
    selectedBrand: params.get('brand') ?? 'ALL',
    selectedFacilities: parseListParam(params, 'facilities'),
    selectedId: params.get('selected'),
    sheet: hasSheet ? normalizeSheet(params.get('sheet')) : isInitialMobile ? 'peek' : 'mid',
    mode: normalizeMode(params.get('mode')),
    sort: normalizeSort(params.get('sort')),
    view: normalizeView(params.get('view')),
  };
}

function baseSortKey(feature: LoungeFeature) {
  const { country, city, airportCode, airportName, name } = feature.properties;
  return `${country}|${city}|${airportCode}|${airportName}|${name}`;
}

function getSearchScore(properties: LoungeFeatureProperties, rawQuery: string) {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return 0;
  }

  const airportCode = properties.airportCode.toLowerCase();
  const airportName = properties.airportName.toLowerCase();
  const name = properties.name.toLowerCase();
  const country = properties.country.toLowerCase();
  const city = properties.city.toLowerCase();
  const terminal = properties.terminal.toLowerCase();
  const location = properties.location.toLowerCase();
  const haystack = [airportCode, airportName, name, country, city, terminal, location].join(' ');

  if (!haystack.includes(query)) {
    return -1;
  }

  if (airportCode === query) {
    return 1200;
  }

  if (name === query) {
    return 1100;
  }

  if (airportName === query || city === query || country === query) {
    return 1025;
  }

  if (airportCode.startsWith(query)) {
    return 980;
  }

  if (name.startsWith(query)) {
    return 920;
  }

  if (airportName.startsWith(query) || city.startsWith(query)) {
    return 860;
  }

  if (name.includes(query)) {
    return 790;
  }

  if (airportName.includes(query)) {
    return 740;
  }

  if (city.includes(query) || country.includes(query)) {
    return 700;
  }

  if (terminal.includes(query) || location.includes(query)) {
    return 620;
  }

  return 500;
}

function matchesSearch(properties: LoungeFeatureProperties, query: string) {
  return getSearchScore(properties, query) >= 0;
}

function sortFeatures(features: LoungeFeature[], sort: SortOption, query: string) {
  return [...features].sort((first, second) => {
    if (sort === 'best_match' && query.trim()) {
      const scoreDelta = getSearchScore(second.properties, query) - getSearchScore(first.properties, query);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }
    }

    if (sort === 'airport_code') {
      const codeOrder = first.properties.airportCode.localeCompare(second.properties.airportCode);
      if (codeOrder !== 0) {
        return codeOrder;
      }
    }

    if (sort === 'type') {
      const typeOrder = first.properties.type.localeCompare(second.properties.type);
      if (typeOrder !== 0) {
        return typeOrder;
      }
    }

    return baseSortKey(first).localeCompare(baseSortKey(second));
  });
}

function joinOrFallback(values: string[], fallback: string, limit = values.length) {
  if (values.length === 0) {
    return fallback;
  }
  return values.slice(0, limit).join(' · ');
}

function compactList(values: string[], fallback: string, limit = values.length, maxItemLength = 160) {
  if (values.length === 0) {
    return fallback;
  }

  return values
    .slice(0, limit)
    .map((value) => {
      const compactValue = value.replace(/\s+/g, ' ').trim();
      return compactValue.length > maxItemLength
        ? `${compactValue.slice(0, maxItemLength).trim()}...`
        : compactValue;
    })
    .join(' · ');
}

function locationLabel(feature: LoungeFeature) {
  const cityOrCountry = feature.properties.city || feature.properties.country;
  const place = formatCountryLabel(feature.properties.country);
  const location = feature.properties.city ? `${countryFlag(feature.properties.country)} ${cityOrCountry}`.trim() : place;
  return feature.properties.terminal !== 'Unknown'
    ? `${location} · ${feature.properties.terminal}`
    : location;
}

function detailLocation(feature: LoungeFeature) {
  return `${feature.properties.airportCode} · ${feature.properties.airportName}`;
}

function getFeatureBrandAsset(feature: LoungeFeature) {
  return feature.properties.canonical?.lounge.brandAsset;
}

function getFeatureBrandName(feature: LoungeFeature) {
  return (
    getFeatureBrandAsset(feature)?.name ??
    feature.properties.canonical?.lounge.brand ??
    feature.properties.provider ??
    'Priority Pass'
  ).trim();
}

function BrandMark({
  asset,
  label,
  compact = false,
}: {
  asset?: LoungeBrandAsset;
  label: string;
  compact?: boolean;
}) {
  const markStyle = {
    '--brand-mark-bg': asset?.background ?? '#eef3f8',
    '--brand-mark-fg': asset?.foreground ?? '#405064',
    '--brand-mark-line': asset?.color ?? '#aebacc',
  } as CSSProperties;

  return (
      <span className={`brand-mark ${compact ? 'is-compact' : ''}`} style={markStyle}>
        <span className="brand-mark-tile" aria-hidden>
        {asset?.logoUrl ? (
          <img className="brand-mark-img" src={asset.logoUrl} alt="" loading="lazy" />
        ) : (
          (asset?.logoText ?? label.slice(0, 2).toUpperCase())
        )}
      </span>
      <span className="brand-mark-name">{label}</span>
    </span>
  );
}

function compactOpeningHours(value: string, fallback = 'Not listed', maxLines = 3, maxLength = 180) {
  const lines = value
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const scheduleLines: string[] = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    const isNote =
      lower.startsWith('note:') ||
      lower.startsWith('important note:') ||
      lower.startsWith('for cardholders') ||
      lower.includes('we advise cardholders');

    if (isNote) {
      break;
    }

    if (line.length > 180 && scheduleLines.length > 0) {
      break;
    }

    scheduleLines.push(line);
    if (scheduleLines.length >= maxLines) {
      break;
    }
  }

  const schedule = scheduleLines.join(' · ');
  if (!schedule) {
    return fallback;
  }

  return schedule.length > maxLength ? `${schedule.slice(0, maxLength).trim()}...` : schedule;
}

function TypePill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`type-pill ${active ? 'is-on' : ''}`} onClick={onClick} type="button">
      {label}
    </button>
  );
}

function FitBounds({
  features,
  selectedId,
}: {
  features: LoungeFeature[];
  selectedId: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedId || features.length === 0) {
      return;
    }

    if (features.length === 1) {
      const [lon, lat] = features[0].geometry.coordinates;
      map.flyTo([lat, lon], 8, { duration: 0.7 });
      return;
    }

    const bounds = L.latLngBounds(
      features.map((feature) => {
        const [lon, lat] = feature.geometry.coordinates;
        return [lat, lon] as [number, number];
      }),
    );

    map.fitBounds(bounds.pad(0.2), {
      animate: true,
      duration: 0.75,
    });
  }, [features, map, selectedId]);

  return null;
}

function FlyToSelection({
  selected,
}: {
  selected: LoungeFeature | undefined;
}) {
  const map = useMap();

  useEffect(() => {
    if (!selected) {
      return;
    }

    const [lon, lat] = selected.geometry.coordinates;
    map.flyTo([lat, lon], Math.max(map.getZoom(), 8), {
      duration: 0.65,
    });
  }, [map, selected]);

  return null;
}

function MapView({
  features,
  selectedId,
  hoveredId,
  onSelect,
  onInteractionStatusChange,
}: {
  features: LoungeFeature[];
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onInteractionStatusChange: (status: MapInteractionStatus) => void;
}) {
  const selectedFeature = useMemo(
    () => features.find((feature) => feature.properties.id === selectedId),
    [features, selectedId],
  );

  return (
    <MapContainer
      center={WORLD_CENTER}
      zoom={WORLD_ZOOM}
      minZoom={2}
      zoomControl={false}
      className="map-canvas"
      worldCopyJump
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
      />

      <LoungeClusterLayer
        features={features}
        selectedId={selectedId}
        hoveredId={hoveredId}
        onSelect={onSelect}
        onInteractionStatusChange={onInteractionStatusChange}
      />

      <FitBounds features={features} selectedId={selectedId} />
      <FlyToSelection selected={selectedFeature} />
    </MapContainer>
  );
}

function SortControl({
  value,
  onChange,
}: {
  value: SortOption;
  onChange: (sort: SortOption) => void;
}) {
  return (
    <label className="sort-control">
      <span>Sort</span>
      <select value={value} onChange={(event) => onChange(event.target.value as SortOption)}>
        {Object.entries(SORT_LABELS).map(([sort, label]) => (
          <option key={sort} value={sort}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterControls({
  types,
  typeCounts,
  selectedTypes,
  selectedCountry,
  selectedCity,
  selectedBrand,
  countries,
  cityOptions,
  brandOptions,
  selectedFacilities,
  facilityOptions,
  toggleType,
  toggleFacility,
  setSelectedCountry,
  setSelectedCity,
  setSelectedBrand,
}: {
  types: string[];
  typeCounts: Map<string, number>;
  selectedTypes: string[];
  selectedCountry: string;
  selectedCity: string;
  selectedBrand: string;
  countries: string[];
  cityOptions: string[];
  brandOptions: BrandFilterOption[];
  selectedFacilities: string[];
  facilityOptions: string[];
  toggleType: (type: string) => void;
  toggleFacility: (facility: string) => void;
  setSelectedCountry: (country: string) => void;
  setSelectedCity: (city: string) => void;
  setSelectedBrand: (brand: string) => void;
}) {
  return (
    <>
      <section className="control-group split">
        <label>
          <span className="control-label">Country</span>
          <select
            value={selectedCountry}
            onChange={(event) => {
              const nextCountry = event.target.value;
              setSelectedCountry(nextCountry);
              setSelectedCity('ALL');
            }}
          >
            <option value="ALL">All countries</option>
            {countries.map((country) => (
              <option key={country} value={country}>
                {formatCountryLabel(country)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="control-label">City</span>
          <select value={selectedCity} onChange={(event) => setSelectedCity(event.target.value)}>
            <option value="ALL">All cities</option>
            {cityOptions.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="control-group">
        <label>
          <span className="control-label">Brand</span>
          <select value={selectedBrand} onChange={(event) => setSelectedBrand(event.target.value)}>
            <option value="ALL">All brands</option>
            {brandOptions.map((brand) => (
              <option key={brand.value} value={brand.value}>
                {brand.label} ({brand.count})
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="control-group">
        <div className="control-label">Type</div>
        <div className="pill-grid">
          {types.map((type) => (
            <TypePill
              key={type}
              label={`${type} (${typeCounts.get(type) ?? 0})`}
              active={selectedTypes.includes(type)}
              onClick={() => toggleType(type)}
            />
          ))}
        </div>
      </section>

      <section className="control-group">
        <div className="control-label">Facilities</div>
        <div className="pill-grid small">
          {facilityOptions.map((facility) => (
            <TypePill
              key={facility}
              label={facility}
              active={selectedFacilities.includes(facility)}
              onClick={() => toggleFacility(facility)}
            />
          ))}
        </div>
      </section>
    </>
  );
}

function ActiveFilterSummary({
  chips,
  onClearAll,
}: {
  chips: FilterSummaryChip[];
  onClearAll: () => void;
}) {
  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="active-filters">
      <div className="active-filters-head">
        <p>Active filters</p>
        <button type="button" className="inline-link" onClick={onClearAll}>
          Clear all
        </button>
      </div>
      <div className="active-filter-list">
        {chips.map((chip) => (
          <button key={chip.key} type="button" className="filter-chip" onClick={chip.onRemove}>
            {chip.label}
            <span aria-hidden>×</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CompareTray({
  comparedFeatures,
  selectedId,
  onSelect,
  onRemove,
  compact = false,
}: {
  comparedFeatures: LoungeFeature[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  compact?: boolean;
}) {
  const showExpandedMetrics = comparedFeatures.length > 1 && !compact;

  return (
    <section
      className={`compare-tray ${compact ? 'is-compact' : ''} ${
        comparedFeatures.length === 0 ? 'is-empty' : ''
      }`}
    >
      <div className="section-title-row">
        <div>
          <h2>Compare</h2>
        </div>
        <span className="compare-count">{comparedFeatures.length} / {COMPARE_LIMIT}</span>
      </div>

      {comparedFeatures.length === 0 ? (
        <div className="compare-empty">No compare records</div>
      ) : (
        <>
          <div className="compare-card-grid">
            {comparedFeatures.map((feature) => {
              const active = selectedId === feature.properties.id;
              return (
                <article key={feature.properties.id} className={`compare-card ${active ? 'is-active' : ''}`}>
                  <div className="compare-card-head">
                    <span className="badge">{feature.properties.type}</span>
                    <span className="code">{feature.properties.airportCode}</span>
                  </div>
                  <button
                    type="button"
                    className="compare-select"
                    onClick={() => onSelect(feature.properties.id)}
                  >
                    <strong>{feature.properties.name}</strong>
                    <span>{locationLabel(feature)}</span>
                  </button>
                  <dl className="compare-metrics">
                    <div>
                      <dt>Hours</dt>
                        <dd>{compactOpeningHours(feature.properties.openingHours, 'Details', 2, 120)}</dd>
                    </div>
                    <div>
                      <dt>Facilities</dt>
                      <dd>{joinOrFallback(feature.properties.facilities, 'Not listed', showExpandedMetrics ? 4 : 2)}</dd>
                    </div>
                    {showExpandedMetrics ? (
                      <div>
                        <dt>Conditions</dt>
                        <dd>{compactList(feature.properties.conditions, 'Not listed', 2, 110)}</dd>
                      </div>
                    ) : null}
                  </dl>
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => onRemove(feature.properties.id)}
                  >
                    Remove
                  </button>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function ResultsEmptyState({
  search,
  selectedFilterCount,
  onClearSearch,
  onClearFilters,
}: {
  search: string;
  selectedFilterCount: number;
  onClearSearch: () => void;
  onClearFilters: () => void;
}) {
  return (
    <div className="results-empty">
      <p className="eyebrow">No matches</p>
      <h3>0 results</h3>
      <div className="results-empty-actions">
        {search.trim() ? (
          <button type="button" className="secondary-action" onClick={onClearSearch}>
            Clear search
          </button>
        ) : null}
        {selectedFilterCount > 0 ? (
          <button type="button" className="primary-action subtle" onClick={onClearFilters}>
            Clear filters
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ResultsList({
  features,
  selectedId,
  hoveredId,
  comparedIds,
  compareLimitReached,
  onHover,
  onSelect,
  onToggleCompare,
  onClearSearch,
  onClearFilters,
  search,
  selectedFilterCount,
  initialBatch,
  batchSize,
  listContextKey,
}: {
  features: LoungeFeature[];
  selectedId: string | null;
  hoveredId: string | null;
  comparedIds: Set<string>;
  compareLimitReached: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onToggleCompare: (id: string) => void;
  onClearSearch: () => void;
  onClearFilters: () => void;
  search: string;
  selectedFilterCount: number;
  initialBatch: number;
  batchSize: number;
  listContextKey: string;
}) {
  const listRef = useRef<HTMLElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerSupported =
    typeof window !== 'undefined' && typeof window.IntersectionObserver !== 'undefined';

  const [visibleCount, setVisibleCount] = useState(() =>
    Math.min(Math.max(initialBatch, 1), features.length),
  );

  const selectedIndex = selectedId
    ? features.findIndex((feature) => feature.properties.id === selectedId)
    : -1;
  const requiredVisibleCount = selectedIndex >= 0 ? selectedIndex + 1 : 0;
  const resolvedVisibleCount = Math.min(
    Math.max(visibleCount, requiredVisibleCount, 0),
    features.length,
  );
  const visibleFeatures = features.slice(0, resolvedVisibleCount);
  const canLoadMore = resolvedVisibleCount < features.length;

  const loadMore = useCallback(() => {
    setVisibleCount((current) => Math.min(features.length, current + Math.max(batchSize, 1)));
  }, [batchSize, features.length]);

  useEffect(() => {
    if (!observerSupported || !canLoadMore || !listRef.current || !sentinelRef.current) {
      return;
    }

    const rootElement = listRef.current.closest('.mobile-sheet-body');
    const observerRoot = rootElement instanceof HTMLElement ? rootElement : listRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries.some((entry) => entry.isIntersecting);
        if (isVisible) {
          loadMore();
        }
      },
      {
        root: observerRoot,
        rootMargin: '120px 0px 160px 0px',
        threshold: 0.01,
      },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [canLoadMore, loadMore, observerSupported]);

  if (features.length === 0) {
    return (
      <section className="results" ref={listRef} data-list-context={listContextKey}>
        <ResultsEmptyState
          search={search}
          selectedFilterCount={selectedFilterCount}
          onClearSearch={onClearSearch}
          onClearFilters={onClearFilters}
        />
      </section>
    );
  }

  return (
    <section className="results" ref={listRef} data-list-context={listContextKey}>
      {visibleFeatures.map((feature) => {
        const active = selectedId === feature.properties.id;
        const hovered = hoveredId === feature.properties.id;
        const compared = comparedIds.has(feature.properties.id);
        const compareDisabled = compareLimitReached && !compared;
        const brandAsset = getFeatureBrandAsset(feature);
        const brandName = getFeatureBrandName(feature);

        return (
          <article
            key={feature.properties.id}
            className={`result-card ${active ? 'is-active' : ''} ${hovered ? 'is-hovered' : ''}`}
            onMouseEnter={() => onHover(feature.properties.id)}
            onMouseLeave={() => onHover(null)}
          >
            <button
              type="button"
              className="result-card-main"
              onClick={() => onSelect(feature.properties.id)}
              onFocus={() => onHover(feature.properties.id)}
              onBlur={() => onHover(null)}
            >
              <header className="result-card-head">
                <BrandMark asset={brandAsset} label={brandName} compact />
                <span className="result-code-group">
                  <span className="badge">{feature.properties.type}</span>
                  <span className="code">{feature.properties.airportCode}</span>
                </span>
              </header>
              <h3>{feature.properties.name}</h3>
              <p>{feature.properties.airportName}</p>
              <div className="quality-row">
                <span>{feature.properties.canonical?.sources[0]?.publisher ?? 'Priority Pass'}</span>
                <span>{feature.properties.quality?.reviewStatus ?? feature.properties.canonical?.quality.reviewStatus ?? 'approved'}</span>
              </div>
              <div className="result-meta-row">
                <span>{locationLabel(feature)}</span>
                <span>{compactOpeningHours(feature.properties.openingHours, 'Details', 2, 110)}</span>
              </div>
              <small>{joinOrFallback(feature.properties.facilities, 'Not listed', 3)}</small>
            </button>
            <div className="result-card-actions">
              <button
                type="button"
                className={`compare-toggle ${compared ? 'is-on' : ''}`}
                onClick={() => onToggleCompare(feature.properties.id)}
                disabled={compareDisabled}
                aria-pressed={compared}
              >
                {compared ? 'In compare' : 'Compare'}
              </button>
            </div>
          </article>
        );
      })}

      {canLoadMore ? (
        <div className="results-tail">
          <p className="results-progress">
            Showing {resolvedVisibleCount} of {features.length}
          </p>
          <button type="button" className="results-load-more" onClick={loadMore}>
            Load more
          </button>
        </div>
      ) : null}

      <div className="results-sentinel" ref={sentinelRef} aria-hidden />
    </section>
  );
}

function SameSpotList({
  selectedFeature,
  sameSpotFeatures,
  onSelect,
}: {
  selectedFeature: LoungeFeature;
  sameSpotFeatures: LoungeFeature[];
  onSelect: (id: string) => void;
}) {
  if (sameSpotFeatures.length <= 1) {
    return null;
  }

  return (
    <div className="spot-group">
      <div className="spot-group-head">
        <p className="spot-group-title">
          {sameSpotFeatures.length} at {selectedFeature.properties.airportCode}
        </p>
      </div>
      <div className="spot-group-list">
        {sameSpotFeatures.map((spot) => (
          <button
            key={spot.properties.id}
            type="button"
            className={`spot-item ${selectedFeature.properties.id === spot.properties.id ? 'is-active' : ''}`}
            onClick={() => onSelect(spot.properties.id)}
          >
            <strong>{spot.properties.name}</strong>
            <span>
              {spot.properties.airportCode} · {locationLabel(spot)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DetailPanel({
  selectedFeature,
  sameSpotFeatures,
  comparedIds,
  compareLimitReached,
  onSelect,
  onToggleCompare,
  onClose,
}: {
  selectedFeature: LoungeFeature;
  sameSpotFeatures: LoungeFeature[];
  comparedIds: Set<string>;
  compareLimitReached: boolean;
  onSelect: (id: string) => void;
  onToggleCompare: (id: string) => void;
  onClose: () => void;
}) {
  const compared = comparedIds.has(selectedFeature.properties.id);
  const brandAsset = getFeatureBrandAsset(selectedFeature);
  const brandName = getFeatureBrandName(selectedFeature);

  return (
    <aside className="detail-panel detail-panel-overlay">
      <div className="detail-panel-head">
        <div>
          <p>Selected</p>
          <h3>{selectedFeature.properties.name}</h3>
          <span>{detailLocation(selectedFeature)}</span>
        </div>
        <button type="button" className="ghost-action" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="detail-panel-body">
        <div className="detail-meta-strip">
          <BrandMark asset={brandAsset} label={brandName} />
          <span className="badge">{selectedFeature.properties.type}</span>
          <span className="code">{locationLabel(selectedFeature)}</span>
          <QualityBadge
            label="Quality"
            score={selectedFeature.properties.quality?.completeness ?? selectedFeature.properties.canonical?.quality.completeness ?? 0}
          />
        </div>

        <div className="detail-actions">
          <button
            type="button"
            className={`primary-action ${compared ? 'subtle' : ''}`}
            onClick={() => onToggleCompare(selectedFeature.properties.id)}
            disabled={compareLimitReached && !compared}
          >
            {compared ? 'Remove from compare' : 'Add to compare'}
          </button>
          {selectedFeature.properties.url ? (
            <a className="ghost-link" href={selectedFeature.properties.url} target="_blank" rel="noreferrer">
              Source
            </a>
          ) : null}
        </div>

        <dl className="detail-grid">
          <div>
            <dt>Location</dt>
            <dd>{locationLabel(selectedFeature)}</dd>
          </div>
          <div>
            <dt>Opening hours</dt>
            <dd>{compactOpeningHours(selectedFeature.properties.openingHours, 'Not listed', 7, 260)}</dd>
          </div>
          <div>
            <dt>Conditions</dt>
            <dd>{compactList(selectedFeature.properties.conditions, 'Not listed', 3, 110)}</dd>
          </div>
          <div>
            <dt>Facilities</dt>
            <dd>{joinOrFallback(selectedFeature.properties.facilities, 'Not listed')}</dd>
          </div>
          <div>
            <dt>Programs</dt>
            <dd>{joinOrFallback(selectedFeature.properties.canonical?.lounge.programs ?? selectedFeature.properties.programs ?? [], 'Not listed')}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>{selectedFeature.properties.canonical?.sources[0]?.publisher ?? 'Priority Pass'}</dd>
          </div>
        </dl>

        <SameSpotList
          selectedFeature={selectedFeature}
          sameSpotFeatures={sameSpotFeatures}
          onSelect={onSelect}
        />
      </div>
    </aside>
  );
}

function MapLegend({
  interactionStatus,
  comparedCount,
}: {
  interactionStatus: MapInteractionStatus;
  comparedCount: number;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className={`map-legend ${expanded ? 'is-expanded' : 'is-collapsed'}`}>
      <button
        type="button"
        className="map-legend-toggle"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
      >
        <span className="eyebrow">Map</span>
        <span>{expanded ? 'Hide' : 'Show'}</span>
      </button>
      {expanded ? (
        <ul>
          <li>
            {interactionStatus === 'spiderfied'
              ? 'Spiderfied'
              : 'Clustered'}
          </li>
          <li>
            {comparedCount > 0
              ? `${comparedCount} compared`
              : '0 compared'}
          </li>
        </ul>
      ) : null}
    </div>
  );
}

function MobileQuickFilters({
  search,
  types,
  selectedTypes,
  visibleCount,
  selectedFilterCount,
  activeFilterChips,
  quickFilterState,
  onSearchChange,
  onQuickTypeToggle,
  onOpenFilters,
  onClearFilters,
}: {
  search: string;
  types: string[];
  selectedTypes: string[];
  visibleCount: number;
  selectedFilterCount: number;
  activeFilterChips: FilterSummaryChip[];
  quickFilterState: QuickFilterPreset;
  onSearchChange: (search: string) => void;
  onQuickTypeToggle: (type: string) => void;
  onOpenFilters: () => void;
  onClearFilters: () => void;
}) {
  return (
    <div className="mobile-quick-filters">
      <div className="mobile-results-summary">
        <p>{visibleCount} visible</p>
        <button type="button" className="ghost-link" onClick={onOpenFilters}>
          {selectedFilterCount > 0 ? `${selectedFilterCount} filters` : 'Filters'}
        </button>
      </div>

      <label className="mobile-results-search">
        <span>Search</span>
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Airport, city, lounge"
        />
      </label>

      <div className="mobile-type-strip">
        {types.map((type) => {
          const preset = quickPresetForType(type);
          const active = selectedTypes.includes(type);
          const emphasized = quickFilterState === preset;

          return (
            <button
              key={type}
              type="button"
              className={`quick-type-chip ${active ? 'is-on' : ''} ${emphasized ? 'is-emphasis' : ''}`}
              onClick={() => onQuickTypeToggle(type)}
            >
              {type}
            </button>
          );
        })}
      </div>

      <ActiveFilterSummary chips={activeFilterChips} onClearAll={onClearFilters} />
    </div>
  );
}

function MobileModeButton({
  mode,
  activeMode,
  count,
  disabled = false,
  onClick,
}: {
  mode: MobileSheetMode;
  activeMode: MobileSheetMode;
  count: string | number;
  disabled?: boolean;
  onClick: () => void;
}) {
  const label = MOBILE_MODE_LABELS[mode];

  return (
    <button
      type="button"
      className={activeMode === mode ? 'is-active' : ''}
      onClick={onClick}
      disabled={disabled}
      aria-label={`${label} ${count}`}
    >
      <span>{label}</span>
      <strong>{count}</strong>
    </button>
  );
}

function MobileDetailsView({
  selectedFeature,
  sameSpotFeatures,
  comparedIds,
  compareLimitReached,
  onSelect,
  onToggleCompare,
}: {
  selectedFeature: LoungeFeature | undefined;
  sameSpotFeatures: LoungeFeature[];
  comparedIds: Set<string>;
  compareLimitReached: boolean;
  onSelect: (id: string) => void;
  onToggleCompare: (id: string) => void;
}) {
  if (!selectedFeature) {
    return (
      <div className="mobile-empty-selected">
        <p className="eyebrow">Details</p>
        <h3>None selected</h3>
      </div>
    );
  }

  const compared = comparedIds.has(selectedFeature.properties.id);
  const brandAsset = getFeatureBrandAsset(selectedFeature);
  const brandName = getFeatureBrandName(selectedFeature);

  return (
    <div className="mobile-selected-view">
      <div className="mobile-selected-summary">
        <div className="mobile-selected-meta">
        <BrandMark asset={brandAsset} label={brandName} compact />
        <span className="badge">{selectedFeature.properties.type}</span>
        <span className="code">{selectedFeature.properties.airportCode}</span>
      </div>
      <h3>{selectedFeature.properties.name}</h3>
      <p>{selectedFeature.properties.airportName}</p>
      <small>{locationLabel(selectedFeature)}</small>
      <div className="quality-row">
        <span>{selectedFeature.properties.canonical?.sources[0]?.publisher ?? 'Priority Pass'}</span>
        <span>{selectedFeature.properties.canonical?.quality.reviewStatus ?? 'approved'}</span>
      </div>
    </div>

      <div className="detail-actions">
        <button
          type="button"
          className={`primary-action ${compared ? 'subtle' : ''}`}
          onClick={() => onToggleCompare(selectedFeature.properties.id)}
          disabled={compareLimitReached && !compared}
        >
          {compared ? 'Remove from compare' : 'Add to compare'}
        </button>
        {selectedFeature.properties.url ? (
          <a className="ghost-link" href={selectedFeature.properties.url} target="_blank" rel="noreferrer">
            Source
          </a>
        ) : null}
      </div>

      <details className="mobile-detail-accordion" open>
        <summary>Opening hours</summary>
        <p>{compactOpeningHours(selectedFeature.properties.openingHours, 'Not listed', 7, 260)}</p>
      </details>

      <details className="mobile-detail-accordion" open>
        <summary>Location</summary>
        <p>{locationLabel(selectedFeature)}</p>
      </details>

      <details className="mobile-detail-accordion">
        <summary>Conditions</summary>
        <p>{compactList(selectedFeature.properties.conditions, 'Not listed', 3, 110)}</p>
      </details>

      <details className="mobile-detail-accordion">
        <summary>Facilities</summary>
        <p>{joinOrFallback(selectedFeature.properties.facilities, 'Not listed')}</p>
      </details>

      <SameSpotList
        selectedFeature={selectedFeature}
        sameSpotFeatures={sameSpotFeatures}
        onSelect={onSelect}
      />
    </div>
  );
}

function formatBlockerLabel(blocker: string) {
  switch (blocker) {
    case 'approved_records_below_target':
    case 'approved_records_below_3800':
      return 'Approved count';
    case 'approved_ratio_below_target':
    case 'approved_ratio_below_0.98':
      return 'Approved ratio';
    case 'source_family_gaps_present':
    case 'source_family_coverage_incomplete':
      return 'Source families';
    case 'review_records_present':
      return 'Review records';
    case 'source_intake_runtime_not_cloudflare':
      return 'Cloudflare runtime';
    default:
      return blocker.replaceAll('_', ' ');
  }
}

function MobileReviewView({
  records,
  meta,
  coverageGap,
  cloudflareEvidence,
  intakePlan,
  onSelect,
}: {
  records: CanonicalLoungeRecord[];
  meta: LoungeMeta | null;
  coverageGap: CoverageGapReport | null;
  cloudflareEvidence: CloudflareSourceRunEvidence | null;
  intakePlan: CloudflareSourceIntakePlan | null;
  onSelect: (id: string) => void;
}) {
  const reviewRecords = records
    .filter((record) => record.quality.reviewStatus !== 'approved' || record.quality.conflicts.length > 0)
    .slice(0, 12);
  const missingFamilies = coverageGap?.sourceFamilies.filter((family) => !family.present) ?? [];
  const blockerLabels = coverageGap?.blockers.map(formatBlockerLabel) ?? [];
  const sourceRuntime = coverageGap?.current.sourceIntakeRuntime ?? 'unknown';
  const runtimePassed = coverageGap?.current.cloudflareSourceRuntimePassed === true;
  const readyEvidence = cloudflareEvidence
    ? `${cloudflareEvidence.stats.readyTasksWithCloudflareEvidence}/${cloudflareEvidence.stats.readyTasks}`
    : 'n/a';
  const cloudflareSources = cloudflareEvidence?.sources ?? [];

  return (
    <div className="mobile-review-view">
      <section className="mobile-review-metrics" aria-label="Review status">
        <div>
          <span>Review</span>
          <strong>{coverageGap?.current.reviewRecords ?? meta?.quality?.reviewQueue ?? reviewRecords.length}</strong>
        </div>
        <div>
          <span>Approved</span>
          <strong>{coverageGap ? `${Math.round(coverageGap.current.approvedRatio * 100)}%` : 'n/a'}</strong>
        </div>
        <div>
          <span>Families</span>
          <strong>
            {coverageGap
              ? `${coverageGap.sourceFamilies.length - missingFamilies.length}/${coverageGap.sourceFamilies.length}`
              : 'n/a'}
          </strong>
        </div>
        <div>
          <span>Runtime</span>
          <strong>{runtimePassed ? 'Cloudflare' : sourceRuntime}</strong>
        </div>
        <div>
          <span>CF ready</span>
          <strong>{readyEvidence}</strong>
        </div>
        <div>
          <span>Sources</span>
          <strong>{intakePlan?.summary.memberGaps ?? 'n/a'}</strong>
        </div>
      </section>

      <section className="mobile-review-panel">
        <div className="section-title-row">
          <h2>Blockers</h2>
          <span className="compare-count">{blockerLabels.length}</span>
        </div>
        {blockerLabels.length === 0 ? (
          <div className="compare-empty">No blockers</div>
        ) : (
          <div className="review-chip-list">
            {blockerLabels.map((label) => (
              <span key={label} className="filter-chip">
                {label}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="mobile-review-panel">
        <div className="section-title-row">
          <h2>CF sources</h2>
          <span className="compare-count">{cloudflareSources.length}</span>
        </div>
        {cloudflareSources.length === 0 ? (
          <div className="compare-empty">No CF sources</div>
        ) : (
          <div className="review-list">
            {cloudflareSources.map((source) => (
              <div key={source.sourceId} className="review-row">
                <span className="review-row-head">
                  <strong>{source.publisher}</strong>
                  <span className="code">{source.httpStatus ?? 'n/a'}</span>
                </span>
                <span>{source.sourceId}</span>
                <span>{source.cloudflareSnapshot ? source.status : 'missing'}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mobile-review-panel">
        <div className="section-title-row">
          <h2>Families</h2>
          <span className="compare-count">{missingFamilies.length}</span>
        </div>
        {missingFamilies.length === 0 ? (
          <div className="compare-empty">No gaps</div>
        ) : (
          <div className="review-list">
            {missingFamilies.map((family) => (
              <div key={family.id} className="review-row">
                <strong>{family.label}</strong>
                <span>{family.missingMembers.join(', ')}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mobile-review-panel">
        <div className="section-title-row">
          <h2>Queue</h2>
          <span className="compare-count">{reviewRecords.length}</span>
        </div>
        {reviewRecords.length === 0 ? (
          <div className="compare-empty">No review records</div>
        ) : (
          <div className="review-list">
            {reviewRecords.map((record) => (
              <button
                key={record.lounge.id}
                type="button"
                className="review-row is-action"
                onClick={() => onSelect(record.lounge.id)}
              >
                <span className="review-row-head">
                  <strong>{record.lounge.name}</strong>
                  <span className="code">{record.airport.iata}</span>
                </span>
                <span>{record.sources[0]?.publisher ?? 'Unknown'}</span>
                <span>{record.quality.conflicts.join(', ') || record.quality.reviewStatus}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SourceEvidenceStrip({ evidence }: { evidence: CloudflareSourceRunEvidence | null }) {
  const sources = evidence?.sources ?? [];

  if (sources.length === 0) {
    return null;
  }

  return (
    <section className="source-evidence-strip" aria-label="Cloudflare source evidence">
      <div className="section-title-row">
        <h2>CF sources</h2>
        <span className="compare-count">
          {evidence?.stats.readyTasksWithCloudflareEvidence ?? 0} / {evidence?.stats.readyTasks ?? 0}
        </span>
      </div>
      <div className="source-evidence-list">
        {sources.map((source) => (
          <span key={source.sourceId} className="source-evidence-chip">
            <strong>{source.publisher}</strong>
            <span>{source.httpStatus ?? 'n/a'}</span>
            <span>{source.cloudflareSnapshot ? source.status : 'missing'}</span>
          </span>
        ))}
      </div>
    </section>
  );
}

function qualityClass(score: number) {
  if (score >= 85) {
    return 'good';
  }
  if (score >= 65) {
    return 'warn';
  }
  return 'bad';
}

function QualityBadge({ label, score }: { label: string; score: number }) {
  return (
    <span className={`quality-badge is-${qualityClass(score)}`}>
      {label}: {score}
    </span>
  );
}

function ViewTabs({
  activeView,
  onChange,
}: {
  activeView: AppView;
  onChange: (view: AppView) => void;
}) {
  if (!INTERNAL_VIEWS_ENABLED) {
    return null;
  }

  const views: Array<{ id: AppView; label: string }> = [
    { id: 'map', label: 'Map' },
    { id: 'intake', label: 'Intake' },
    { id: 'schema', label: 'Schema' },
    { id: 'sources', label: 'Sources' },
  ];

  return (
    <nav className="view-tabs" aria-label="Views">
      {views.map((view) => (
        <button
          key={view.id}
          type="button"
          className={activeView === view.id ? 'is-active' : ''}
          onClick={() => onChange(view.id)}
        >
          {view.label}
        </button>
      ))}
    </nav>
  );
}

function IntakeView({
  records,
  sources,
  meta,
  coverageGap,
  intakePlan,
}: {
  records: CanonicalLoungeRecord[];
  sources: LoungeSourceRegistryEntry[];
  meta: LoungeMeta | null;
  coverageGap: CoverageGapReport | null;
  intakePlan: CloudflareSourceIntakePlan | null;
}) {
  const reviewRecords = records
    .filter((record) => record.quality.reviewStatus !== 'approved' || record.quality.conflicts.length > 0)
    .slice(0, 24);
  const activeSources = sources.filter((source) => source.status === 'active').length;
  const manualSources = sources.filter((source) => source.status === 'manual_review').length;
  const missingFamilies = coverageGap?.sourceFamilies.filter((family) => !family.present) ?? [];

  return (
    <main className="console-view">
      <section className="ops-strip" aria-label="Intake status">
        <div>
          <span>Runs</span>
          <strong>{activeSources}</strong>
        </div>
        <div>
          <span>Review</span>
          <strong>{meta?.quality?.reviewQueue ?? reviewRecords.length}</strong>
        </div>
        <div>
          <span>Conflicts</span>
          <strong>{meta?.quality?.conflictCount ?? 0}</strong>
        </div>
        <div>
          <span>Manual</span>
          <strong>{manualSources}</strong>
        </div>
        <div>
          <span>Families</span>
          <strong>
            {coverageGap
              ? `${coverageGap.sourceFamilies.length - missingFamilies.length}/${coverageGap.sourceFamilies.length}`
              : 'n/a'}
          </strong>
        </div>
        <div>
          <span>Approved gap</span>
          <strong>{coverageGap?.deltas.approvedRecordsRemaining ?? 0}</strong>
        </div>
        <div>
          <span>Plan</span>
          <strong>{intakePlan ? `${intakePlan.summary.readyTasks}/${intakePlan.summary.tasks}` : 'n/a'}</strong>
        </div>
      </section>

      {intakePlan ? (
        <section className="console-panel">
          <div className="panel-head">
            <h2>Intake plan</h2>
            <span className="compare-count">{intakePlan.summary.tasks}</span>
          </div>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Run</th>
                  <th>Action</th>
                  <th>State</th>
                  <th>Next</th>
                </tr>
              </thead>
              <tbody>
                {intakePlan.tasks.map((task) => (
                  <tr key={`${task.familyId}-${task.sourceId}`}>
                    <td>{task.publisher}</td>
                    <td>{task.runStatus}</td>
                    <td>{task.action}</td>
                    <td>{task.status}</td>
                    <td>{task.next}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {coverageGap ? (
        <section className="console-panel">
          <div className="panel-head">
            <h2>Coverage gaps</h2>
            <span className="compare-count">{missingFamilies.length}</span>
          </div>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Family</th>
                  <th>Mode</th>
                  <th>Missing</th>
                  <th>Next</th>
                </tr>
              </thead>
              <tbody>
                {missingFamilies.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No gaps</td>
                  </tr>
                ) : (
                  missingFamilies.map((family) => (
                    <tr key={family.id}>
                      <td>{family.label}</td>
                      <td>{family.mode}</td>
                      <td>{family.missingMembers.join(', ')}</td>
                      <td>{family.acquisition}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="console-panel">
        <div className="panel-head">
          <h2>Review queue</h2>
          <span className="compare-count">{reviewRecords.length}</span>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Lounge</th>
                <th>Airport</th>
                <th>Source</th>
                <th>Quality</th>
                <th>Issues</th>
              </tr>
            </thead>
            <tbody>
              {reviewRecords.length === 0 ? (
                <tr>
                  <td colSpan={5}>No issues</td>
                </tr>
              ) : (
                reviewRecords.map((record) => (
                  <tr key={record.lounge.id}>
                    <td>{record.lounge.name}</td>
                    <td>{record.airport.iata}</td>
                    <td>{record.sources[0]?.publisher ?? 'Unknown'}</td>
                    <td>
                      <QualityBadge label="C" score={record.quality.completeness} />
                    </td>
                    <td>{record.quality.conflicts.join(', ') || record.quality.reviewStatus}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function SchemaView({ meta, records }: { meta: LoungeMeta | null; records: CanonicalLoungeRecord[] }) {
  const fields = meta?.schema?.fields ?? [];
  const coverage = fields.map((field) => {
    const covered = records.filter((record) => {
      const group = field.group === 'record' ? record : record[field.group as keyof CanonicalLoungeRecord];
      if (!group || typeof group !== 'object') {
        return false;
      }
      const value = (group as unknown as Record<string, unknown>)[field.name];
      return Array.isArray(value) ? value.length > 0 : Boolean(value);
    }).length;
    return {
      ...field,
      coverage: records.length > 0 ? Math.round((covered / records.length) * 100) : 0,
    };
  });

  return (
    <main className="console-view">
      <section className="ops-strip" aria-label="Schema status">
        <div>
          <span>Version</span>
          <strong>{meta?.schema?.version ?? 'n/a'}</strong>
        </div>
        <div>
          <span>Fields</span>
          <strong>{fields.length}</strong>
        </div>
        <div>
          <span>Sources</span>
          <strong>{meta?.stats.totalSources ?? 0}</strong>
        </div>
        <div>
          <span>Records</span>
          <strong>{records.length}</strong>
        </div>
      </section>

      <section className="console-panel">
        <div className="panel-head">
          <h2>Field coverage</h2>
        </div>
        <div className="schema-grid">
          {coverage.map((field) => (
            <div key={`${field.group}.${field.name}`} className="schema-row">
              <span>{field.group}</span>
              <strong>{field.name}</strong>
              <small>{field.required ? 'Required' : 'Optional'}</small>
              <QualityBadge label="Coverage" score={field.coverage} />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function SourcesView({
  sources,
  brands,
}: {
  sources: LoungeSourceRegistryEntry[];
  brands: LoungeBrandAsset[];
}) {
  const brandsById = useMemo(() => new Map(brands.map((brand) => [brand.id, brand])), [brands]);
  const sourceBrandAsset = useCallback(
    (source: LoungeSourceRegistryEntry) => {
      if (source.id === 'desk-travel-brand-database') {
        return brandsById.get('desk-travel');
      }
      return source.brandIds?.map((brandId) => brandsById.get(brandId)).find(Boolean);
    },
    [brandsById],
  );

  return (
    <main className="console-view">
      <section className="console-panel">
        <div className="panel-head">
          <h2>Source registry</h2>
          <span className="compare-count">{sources.length}</span>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Publisher</th>
                <th>Brands</th>
                <th>Adapter</th>
                <th>Status</th>
                <th>Freshness</th>
                <th>Records</th>
                <th>Rights</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => (
                <tr key={source.id}>
                  <td>
                    <div className="source-publisher-cell">
                      <a className="source-brand-link" href={source.url} target="_blank" rel="noreferrer">
                        <BrandMark
                          asset={sourceBrandAsset(source)}
                          label={source.publisher}
                          compact
                        />
                      </a>
                    </div>
                  </td>
                  <td>{source.brandIds?.length ?? 0}</td>
                  <td>{source.adapter}</td>
                  <td>{source.status}</td>
                  <td>{source.freshnessDays}d</td>
                  <td>{source.records}</td>
                  <td>{source.rightsNote}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function App() {
  const initialUrlState = useMemo(() => readInitialUrlState(), []);

  const [features, setFeatures] = useState<LoungeFeature[]>([]);
  const [meta, setMeta] = useState<LoungeMeta | null>(null);
  const [canonicalRecords, setCanonicalRecords] = useState<CanonicalLoungeRecord[]>([]);
  const [sources, setSources] = useState<LoungeSourceRegistryEntry[]>([]);
  const [brands, setBrands] = useState<LoungeBrandAsset[]>([]);
  const [coverageGap, setCoverageGap] = useState<CoverageGapReport | null>(null);
  const [intakePlan, setIntakePlan] = useState<CloudflareSourceIntakePlan | null>(null);
  const [cloudflareEvidence, setCloudflareEvidence] = useState<CloudflareSourceRunEvidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<AppView>(initialUrlState.view);

  const [search, setSearch] = useState(initialUrlState.search);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(initialUrlState.selectedTypes);
  const [selectedCountry, setSelectedCountry] = useState(initialUrlState.selectedCountry);
  const [selectedCity, setSelectedCity] = useState(initialUrlState.selectedCity);
  const [selectedBrand, setSelectedBrand] = useState(initialUrlState.selectedBrand);
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>(initialUrlState.selectedFacilities);
  const [sort, setSort] = useState<SortOption>(
    initialUrlState.sort === 'country_city' && initialUrlState.search ? 'best_match' : initialUrlState.sort,
  );

  const [selectedId, setSelectedId] = useState<string | null>(initialUrlState.selectedId);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [mapInteractionStatus, setMapInteractionStatus] = useState<MapInteractionStatus>('clusters');
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_MEDIA_QUERY).matches);
  const [mobileUI, setMobileUI] = useState<MobileUIState>({
    sheetSnap: initialUrlState.sheet,
    sheetMode: initialUrlState.mode,
    quickFilterState: 'none',
  });
  const [mobileFilterDraft, setMobileFilterDraft] = useState<MobileFilterDraft>({
    search: initialUrlState.search,
    types: initialUrlState.selectedTypes,
    country: initialUrlState.selectedCountry,
    city: initialUrlState.selectedCity,
    brand: initialUrlState.selectedBrand,
    facilities: initialUrlState.selectedFacilities,
    sort,
  });

  const sheetDragState = useRef<{ startY: number; currentY: number } | null>(null);
  const mobileSheetBodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_MEDIA_QUERY);

    const listener = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
      if (!event.matches) {
        setMobileUI((current) => ({ ...current, sheetMode: 'results' }));
      }
    };

    setIsMobile(media.matches);
    media.addEventListener('change', listener);

    return () => {
      media.removeEventListener('change', listener);
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadData() {
      try {
        const [
          geoJsonResponse,
          metaResponse,
          canonicalResponse,
          sourceResponse,
          brandResponse,
          coverageGapResponse,
          intakePlanResponse,
          cloudflareEvidenceResponse,
        ] = await Promise.all([
          fetch('/data/lounges.geojson'),
          fetch('/data/meta.json'),
          fetch('/data/lounge-guru-catalog.json'),
          fetch('/data/source-registry.json'),
          fetch('/data/brand-registry.json'),
          fetch('/data/coverage-gap-report.json'),
          fetch('/data/cloudflare-source-intake-plan.json'),
          fetch('/data/cloudflare-source-run-evidence.json'),
        ]);

        if (!geoJsonResponse.ok || !metaResponse.ok) {
          throw new Error('Data files missing. Run npm run build:data first.');
        }

        const geoJson = (await geoJsonResponse.json()) as LoungeFeatureCollection;
        const nextMeta = (await metaResponse.json()) as LoungeMeta;
        const canonical = canonicalResponse.ok
          ? ((await canonicalResponse.json()) as {
              generatedAt?: string;
              records?: CanonicalLoungeRecord[];
              sources?: LoungeSourceRegistryEntry[];
              schema?: LoungeMeta['schema'];
              quality?: LoungeMeta['quality'];
              stats?: Partial<LoungeMeta['stats']>;
              filters?: Partial<LoungeMeta['filters']>;
              brands?: LoungeBrandAsset[];
            })
          : null;
        const sourceRegistry = sourceResponse.ok
          ? ((await sourceResponse.json()) as LoungeSourceRegistryEntry[])
          : canonical?.sources ?? nextMeta.sources ?? [];
        const brandRegistry = brandResponse.ok
          ? ((await brandResponse.json()) as LoungeBrandAsset[])
          : canonical?.brands ?? nextMeta.brands ?? [];
        const nextCoverageGap = coverageGapResponse.ok
          ? ((await coverageGapResponse.json()) as CoverageGapReport)
          : null;
        const nextIntakePlan = intakePlanResponse.ok
          ? ((await intakePlanResponse.json()) as CloudflareSourceIntakePlan)
          : null;
        const nextCloudflareEvidence = cloudflareEvidenceResponse.ok
          ? ((await cloudflareEvidenceResponse.json()) as CloudflareSourceRunEvidence)
          : null;
        const canonicalRecords = canonical?.records ?? [];
        const canonicalById = new Map(canonicalRecords.map((record) => [record.lounge.id, record]));
        const nextFeatures: LoungeFeature[] = (geoJson.features ?? []).map((feature) => {
          const canonicalRecord = canonicalById.get(feature.properties.id) ?? feature.properties.canonical;
          return {
            ...feature,
            properties: {
              ...feature.properties,
              canonical: canonicalRecord,
              provider: feature.properties.provider ?? canonicalRecord?.lounge.brand,
              programs: feature.properties.programs ?? canonicalRecord?.lounge.programs,
              accessMethods: feature.properties.accessMethods ?? canonicalRecord?.lounge.accessMethods,
              sources: feature.properties.sources ?? canonicalRecord?.sources,
              quality: feature.properties.quality ?? canonicalRecord?.quality,
            },
          };
        });
        const featureIds = new Set(nextFeatures.map((feature) => feature.properties.id));
        const candidateFeatures: LoungeFeature[] = canonicalRecords
          .filter((record) => !featureIds.has(record.lounge.id))
          .filter(
            (record) =>
              Number.isFinite(record.airport.coordinates.lat) && Number.isFinite(record.airport.coordinates.lon),
          )
          .map((record) => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [record.airport.coordinates.lon, record.airport.coordinates.lat],
            },
            properties: {
              id: record.lounge.id,
              airportCode: record.airport.iata,
              airportName: record.airport.name,
              country: record.airport.country,
              city: record.airport.city,
              type: record.lounge.category.toUpperCase(),
              terminal: record.location.terminal || 'Unknown',
              name: record.lounge.name,
              openingHours: record.operations.hours,
              conditions: record.restrictions,
              facilities: record.amenities,
              url: record.sources[0]?.url ?? '',
              location: record.location.directions,
              slug: record.lounge.id,
              provider: record.lounge.brand,
              programs: record.lounge.programs,
              accessMethods: record.lounge.accessMethods,
              sources: record.sources,
              quality: record.quality,
              canonical: record,
            },
          }));
        nextFeatures.push(...candidateFeatures);

        const mergedMeta: LoungeMeta = canonical
          ? {
              ...nextMeta,
              generatedAt: canonical.generatedAt ?? nextMeta.generatedAt,
              schema: canonical.schema ?? nextMeta.schema,
              quality: canonical.quality ?? nextMeta.quality,
              sources: sourceRegistry,
              stats: {
                ...nextMeta.stats,
                ...canonical.stats,
              },
              filters: {
                ...nextMeta.filters,
                ...canonical.filters,
              },
            }
          : {
              ...nextMeta,
              sources: sourceRegistry,
            };

        if (!alive) {
          return;
        }

        setFeatures(nextFeatures);
        setMeta(mergedMeta);
        setCanonicalRecords(canonicalRecords);
        setSources(sourceRegistry);
        setBrands(brandRegistry);
        setCoverageGap(nextCoverageGap);
        setIntakePlan(nextIntakePlan);
        setCloudflareEvidence(nextCloudflareEvidence);
        setLoading(false);
      } catch (loadError) {
        if (!alive) {
          return;
        }

        setLoading(false);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load data files.');
      }
    }

    void loadData();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    setSort((current) => {
      if (search.trim()) {
        return current === 'country_city' ? 'best_match' : current;
      }

      return current === 'best_match' ? 'country_city' : current;
    });
  }, [search]);

  const countries = meta?.filters.countries ?? [];
  const types = meta?.filters.types ?? [];
  const facilityOptions = meta?.filters.facilities ?? [];

  const brandOptions = useMemo<BrandFilterOption[]>(() => {
    const counts = new Map<string, number>();

    for (const feature of features) {
      const brandName = getFeatureBrandName(feature);
      if (brandName) {
        counts.set(brandName, (counts.get(brandName) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .map(([label, count]) => ({ value: label, label, count }))
      .sort((first, second) => first.label.localeCompare(second.label));
  }, [features]);

  const cityOptions = useMemo(() => {
    if (!meta) {
      return [];
    }

    if (selectedCountry === 'ALL') {
      return meta.filters.cities;
    }

    const cities = new Set(
      features
        .filter((feature) => feature.properties.country === selectedCountry)
        .map((feature) => feature.properties.city)
        .filter(Boolean),
    );

    return [...cities].sort((a, b) => a.localeCompare(b));
  }, [features, meta, selectedCountry]);

  const draftCityOptions = useMemo(() => {
    if (!meta) {
      return [];
    }

    if (mobileFilterDraft.country === 'ALL') {
      return meta.filters.cities;
    }

    const cities = new Set(
      features
        .filter((feature) => feature.properties.country === mobileFilterDraft.country)
        .map((feature) => feature.properties.city)
        .filter(Boolean),
    );

    return [...cities].sort((a, b) => a.localeCompare(b));
  }, [features, meta, mobileFilterDraft.country]);

  const query = search.trim().toLowerCase();

  const geoFilteredFeatures = useMemo(() => {
    return features.filter((feature) => {
      const properties = feature.properties;

      if (selectedCountry !== 'ALL' && properties.country !== selectedCountry) {
        return false;
      }

      if (selectedCity !== 'ALL' && properties.city !== selectedCity) {
        return false;
      }

      if (selectedBrand !== 'ALL' && getFeatureBrandName(feature) !== selectedBrand) {
        return false;
      }

      if (
        selectedFacilities.length > 0 &&
        !selectedFacilities.every((facility) => properties.facilities.includes(facility))
      ) {
        return false;
      }

      return matchesSearch(properties, query);
    });
  }, [features, query, selectedBrand, selectedCountry, selectedCity, selectedFacilities]);

  const filteredFeatures = useMemo(() => {
    const narrowed =
      selectedTypes.length > 0
        ? geoFilteredFeatures.filter((feature) => selectedTypes.includes(feature.properties.type))
        : geoFilteredFeatures;
    return sortFeatures(narrowed, sort, query);
  }, [geoFilteredFeatures, query, selectedTypes, sort]);

  const featuresById = useMemo(
    () => new Map(features.map((feature) => [feature.properties.id, feature])),
    [features],
  );

  const selectedFeature = useMemo(() => {
    return (
      filteredFeatures.find((feature) => feature.properties.id === selectedId) ||
      features.find((feature) => feature.properties.id === selectedId)
    );
  }, [features, filteredFeatures, selectedId]);

  const sameSpotFeatures = useMemo(() => {
    if (!selectedFeature) {
      return [];
    }

    const selectedCoordinate = coordinateKey(selectedFeature.geometry.coordinates);
    const sameCoordinate = filteredFeatures
      .filter((feature) => coordinateKey(feature.geometry.coordinates) === selectedCoordinate)
      .sort((first, second) => first.properties.name.localeCompare(second.properties.name));

    if (sameCoordinate.length > 1) {
      return sameCoordinate;
    }

    return filteredFeatures
      .filter((feature) => feature.properties.airportCode === selectedFeature.properties.airportCode)
      .sort((first, second) => first.properties.name.localeCompare(second.properties.name));
  }, [filteredFeatures, selectedFeature]);

  const comparedFeatures = useMemo(
    () =>
      compareIds
        .map((id) => featuresById.get(id))
        .filter((feature): feature is LoungeFeature => Boolean(feature)),
    [compareIds, featuresById],
  );

  const comparedIdSet = useMemo(() => new Set(compareIds), [compareIds]);
  const compareLimitReached = compareIds.length >= COMPARE_LIMIT;

  useEffect(() => {
    if (!selectedId) {
      return;
    }

    if (loading) {
      return;
    }

    const stillVisible = filteredFeatures.some((feature) => feature.properties.id === selectedId);
    if (!stillVisible) {
      setSelectedId(filteredFeatures[0]?.properties.id ?? null);
    }
  }, [filteredFeatures, loading, selectedId]);

  useEffect(() => {
    if (!query) {
      return;
    }

    const exactIata = filteredFeatures.find(
      (feature) => feature.properties.airportCode.toLowerCase() === query,
    );

    if (exactIata) {
      setSelectedId(exactIata.properties.id);
    }
  }, [query, filteredFeatures]);

  const filterSignature = useMemo(
    () =>
      [
        search.trim(),
        [...selectedTypes].sort().join(','),
        selectedCountry,
        selectedCity,
        selectedBrand,
        [...selectedFacilities].sort().join(','),
        sort,
      ].join('|'),
    [search, selectedTypes, selectedCountry, selectedCity, selectedBrand, selectedFacilities, sort],
  );

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const feature of geoFilteredFeatures) {
      const type = feature.properties.type;
      counts.set(type, (counts.get(type) || 0) + 1);
    }
    return counts;
  }, [geoFilteredFeatures]);

  useEffect(() => {
    const params = new URLSearchParams();

    const trimmedSearch = search.trim();
    if (trimmedSearch) {
      params.set('q', trimmedSearch);
    }

    if (selectedTypes.length > 0) {
      params.set('type', [...selectedTypes].sort().join(','));
    }

    if (selectedCountry !== 'ALL') {
      params.set('country', selectedCountry);
    }

    if (selectedCity !== 'ALL') {
      params.set('city', selectedCity);
    }

    if (selectedBrand !== 'ALL') {
      params.set('brand', selectedBrand);
    }

    if (selectedFacilities.length > 0) {
      params.set('facilities', [...selectedFacilities].sort().join(','));
    }

    if (selectedId) {
      params.set('selected', selectedId);
    }

    if (sort !== (trimmedSearch ? 'best_match' : 'country_city')) {
      params.set('sort', sort);
    }

    if (activeView !== 'map') {
      params.set('view', activeView);
    }

    params.set('sheet', mobileUI.sheetSnap);
    params.set('mode', mobileUI.sheetMode);

    const nextQuery = params.toString();
    const currentQuery = window.location.search.replace(/^\?/, '');
    if (currentQuery === nextQuery) {
      return;
    }

    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`;
    window.history.replaceState({}, '', nextUrl);
  }, [
    search,
    selectedTypes,
    selectedCountry,
    selectedCity,
    selectedBrand,
    selectedFacilities,
    selectedId,
    sort,
    activeView,
    mobileUI.sheetSnap,
    mobileUI.sheetMode,
  ]);

  const toggleType = useCallback((type: string) => {
    setSelectedTypes((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
    );
  }, []);

  const toggleQuickType = useCallback((type: string) => {
    setSelectedTypes((current) => {
      const currentlyActive = current.includes(type);
      const nextTypes = currentlyActive ? current.filter((item) => item !== type) : [...current, type];

      setMobileUI((mobileCurrent) => ({
        ...mobileCurrent,
        sheetMode: 'results',
        sheetSnap: 'mid',
        quickFilterState: currentlyActive ? 'none' : quickPresetForType(type),
      }));

      return nextTypes;
    });
  }, []);

  const toggleFacility = useCallback((facility: string) => {
    setSelectedFacilities((current) =>
      current.includes(facility)
        ? current.filter((item) => item !== facility)
        : [...current, facility],
    );
  }, []);

  const selectFeature = useCallback(
    (id: string) => {
      setSelectedId(id);

      if (isMobile) {
        setMobileUI((current) => ({
          ...current,
          sheetMode: 'details',
          sheetSnap: 'full',
        }));
      }
    },
    [isMobile],
  );

  const toggleCompare = useCallback((id: string) => {
    setCompareIds((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }

      if (current.length >= COMPARE_LIMIT) {
        return current;
      }

      return [...current, id];
    });
  }, []);

  const clearSearch = useCallback(() => {
    setSearch('');
  }, []);

  const clearAppliedFilters = useCallback(() => {
    setSearch('');
    setSelectedTypes([]);
    setSelectedCountry('ALL');
    setSelectedCity('ALL');
    setSelectedBrand('ALL');
    setSelectedFacilities([]);
    setSort('country_city');
  }, []);

  const shiftSheetSnap = useCallback((direction: 1 | -1) => {
    setMobileUI((current) => {
      const index = SHEET_ORDER.indexOf(current.sheetSnap);
      const nextIndex = Math.max(0, Math.min(SHEET_ORDER.length - 1, index + direction));
      return { ...current, sheetSnap: SHEET_ORDER[nextIndex] };
    });
  }, []);

  const openMobileFilters = useCallback(() => {
    setMobileFilterDraft({
      search,
      types: [...selectedTypes],
      country: selectedCountry,
      city: selectedCity,
      brand: selectedBrand,
      facilities: [...selectedFacilities],
      sort,
    });
    setMobileUI((current) => ({ ...current, sheetMode: 'filters', sheetSnap: 'full' }));
  }, [search, selectedTypes, selectedCountry, selectedCity, selectedBrand, selectedFacilities, sort]);

  const applyMobileFilters = useCallback(() => {
    setSearch(mobileFilterDraft.search);
    setSelectedTypes([...mobileFilterDraft.types]);
    setSelectedCountry(mobileFilterDraft.country);
    setSelectedCity(mobileFilterDraft.city);
    setSelectedBrand(mobileFilterDraft.brand);
    setSelectedFacilities([...mobileFilterDraft.facilities]);
    setSort(mobileFilterDraft.sort);
    setMobileUI((current) => ({
      ...current,
      sheetMode: 'results',
      sheetSnap: 'mid',
      quickFilterState: 'none',
    }));
  }, [mobileFilterDraft]);

  const resetMobileDraft = useCallback(() => {
    setMobileFilterDraft({
      search: '',
      types: [],
      country: 'ALL',
      city: 'ALL',
      brand: 'ALL',
      facilities: [],
      sort: 'country_city',
    });
  }, []);

  const handleSheetPointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    sheetDragState.current = { startY: event.clientY, currentY: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const handleSheetPointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!sheetDragState.current) {
      return;
    }
    sheetDragState.current.currentY = event.clientY;
  }, []);

  const finishSheetDrag = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = sheetDragState.current;
    sheetDragState.current = null;

    if (!drag) {
      return;
    }

    const delta = drag.currentY - drag.startY;
    if (Math.abs(delta) >= 24) {
      if (delta < 0) {
        shiftSheetSnap(1);
      } else {
        shiftSheetSnap(-1);
      }
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, [shiftSheetSnap]);

  const toggleDraftType = useCallback((type: string) => {
    setMobileFilterDraft((current) => ({
      ...current,
      types: current.types.includes(type)
        ? current.types.filter((item) => item !== type)
        : [...current.types, type],
    }));
  }, []);

  const toggleDraftFacility = useCallback((facility: string) => {
    setMobileFilterDraft((current) => ({
      ...current,
      facilities: current.facilities.includes(facility)
        ? current.facilities.filter((item) => item !== facility)
        : [...current.facilities, facility],
    }));
  }, []);

  useEffect(() => {
    if (!isMobile || mobileUI.sheetMode !== 'details') {
      return;
    }

    if (loading) {
      return;
    }

    if (!selectedFeature) {
      setMobileUI((current) => ({ ...current, sheetMode: 'results', sheetSnap: 'mid' }));
    }
  }, [isMobile, loading, mobileUI.sheetMode, selectedFeature]);

  useEffect(() => {
    if (!isMobile || !mobileSheetBodyRef.current) {
      return;
    }

    mobileSheetBodyRef.current.scrollTop = 0;
    mobileSheetBodyRef.current.scrollLeft = 0;
  }, [filterSignature, isMobile, mobileUI.sheetMode, selectedId]);

  const activeFilterChips = useMemo(() => {
    const chips: FilterSummaryChip[] = [];

    if (search.trim()) {
      chips.push({
        key: 'search',
        label: `Search: ${search.trim()}`,
        onRemove: () => setSearch(''),
      });
    }

    for (const type of selectedTypes) {
      chips.push({
        key: `type-${type}`,
        label: type,
        onRemove: () => toggleType(type),
      });
    }

    if (selectedCountry !== 'ALL') {
      chips.push({
        key: 'country',
        label: formatCountryLabel(selectedCountry),
        onRemove: () => {
          setSelectedCountry('ALL');
          setSelectedCity('ALL');
        },
      });
    }

    if (selectedCity !== 'ALL') {
      chips.push({
        key: 'city',
        label: selectedCity,
        onRemove: () => setSelectedCity('ALL'),
      });
    }

    if (selectedBrand !== 'ALL') {
      chips.push({
        key: 'brand',
        label: selectedBrand,
        onRemove: () => setSelectedBrand('ALL'),
      });
    }

    for (const facility of selectedFacilities) {
      chips.push({
        key: `facility-${facility}`,
        label: facility,
        onRemove: () => toggleFacility(facility),
      });
    }

    return chips;
  }, [search, selectedTypes, selectedCountry, selectedCity, selectedBrand, selectedFacilities, toggleType, toggleFacility]);

  if (loading) {
    return <div className="state-screen">Loading...</div>;
  }

  if (error) {
    return <div className="state-screen">{error}</div>;
  }

  const selectedFilterCount =
    selectedTypes.length +
    selectedFacilities.length +
    (selectedCountry !== 'ALL' ? 1 : 0) +
    (selectedCity !== 'ALL' ? 1 : 0) +
    (selectedBrand !== 'ALL' ? 1 : 0) +
    (search.trim() ? 1 : 0);
  const cloudflareReadyStatus = cloudflareEvidence
    ? `${cloudflareEvidence.stats.readyTasksWithCloudflareEvidence}/${cloudflareEvidence.stats.readyTasks} CF`
    : null;
  const mobileReviewCount = coverageGap?.current.reviewRecords ?? meta?.quality?.reviewQueue ?? 0;
  const mobileSheetStatus = [
    MOBILE_MODE_LABELS[mobileUI.sheetMode],
    `${filteredFeatures.length} visible`,
    selectedFilterCount > 0 ? `${selectedFilterCount} filters` : null,
    `${comparedFeatures.length}/${COMPARE_LIMIT} compare`,
  ].filter((item): item is string => Boolean(item));

  return (
    <div className={`app-shell ${isMobile ? `is-mobile sheet-${mobileUI.sheetSnap}` : ''}`}>
      <header className="topbar">
        <div className="brand-wrap">
          <h1>Lounge Guru</h1>
          <ViewTabs activeView={activeView} onChange={setActiveView} />
          <div className="system-stats" aria-label="Catalog status">
            <span>{meta?.stats.totalCatalogRecords ?? meta?.stats.totalFeatures ?? 0} records</span>
            <span>{meta?.stats.uniqueAirports ?? 0} airports</span>
            <span>{meta?.stats.uniqueCountries ?? 0} countries</span>
            <span>{meta?.quality?.reviewQueue ?? 0} review</span>
            {cloudflareReadyStatus ? <span>{cloudflareReadyStatus}</span> : null}
            <span>{meta ? new Date(meta.generatedAt).toISOString().slice(0, 10) : 'No date'}</span>
          </div>
        </div>

        <label className="search-wrap">
          <span>Search</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Airport, city, lounge"
          />
        </label>
      </header>

      {activeView === 'intake' ? (
        <IntakeView
          records={canonicalRecords}
          sources={sources}
          meta={meta}
          coverageGap={coverageGap}
          intakePlan={intakePlan}
        />
      ) : null}

      {activeView === 'schema' ? (
        <SchemaView meta={meta} records={canonicalRecords} />
      ) : null}

      {activeView === 'sources' ? (
        <SourcesView sources={sources} brands={brands} />
      ) : null}

      {activeView === 'map' ? (
      <main className="workspace">
        <section className="results-rail">
          <div className="panel-head">
            <div className="panel-title-stack">
              <h2>Results</h2>
              <p>{filteredFeatures.length} visible</p>
            </div>
            <div className="rail-toolbar">
              <span className="compare-count">{comparedFeatures.length} / {COMPARE_LIMIT}</span>
              <SortControl value={sort} onChange={setSort} />
            </div>
          </div>

          <div className="rail-controls">
            <ActiveFilterSummary chips={activeFilterChips} onClearAll={clearAppliedFilters} />
            <FilterControls
              types={types}
              typeCounts={typeCounts}
              selectedTypes={selectedTypes}
              selectedCountry={selectedCountry}
              selectedCity={selectedCity}
              selectedBrand={selectedBrand}
              countries={countries}
              cityOptions={cityOptions}
              brandOptions={brandOptions}
              selectedFacilities={selectedFacilities}
              facilityOptions={facilityOptions}
              toggleType={toggleType}
              toggleFacility={toggleFacility}
              setSelectedCountry={setSelectedCountry}
              setSelectedCity={setSelectedCity}
              setSelectedBrand={setSelectedBrand}
            />
          </div>

          <SourceEvidenceStrip evidence={cloudflareEvidence} />

          {comparedFeatures.length > 0 ? (
            <CompareTray
              comparedFeatures={comparedFeatures}
              selectedId={selectedId}
              onSelect={(id) => selectFeature(id)}
              onRemove={(id) => setCompareIds((current) => current.filter((item) => item !== id))}
            />
          ) : null}

          <ResultsList
            key={`results-desktop-${filterSignature}`}
            features={filteredFeatures}
            selectedId={selectedId}
            hoveredId={hoveredId}
            comparedIds={comparedIdSet}
            compareLimitReached={compareLimitReached}
            onHover={setHoveredId}
            onSelect={(id) => selectFeature(id)}
            onToggleCompare={toggleCompare}
            onClearSearch={clearSearch}
            onClearFilters={clearAppliedFilters}
            search={search}
            selectedFilterCount={selectedFilterCount}
            initialBatch={60}
            batchSize={60}
            listContextKey={`desktop|${filterSignature}`}
          />
        </section>

        <section className="map-stage">
          <div className="map-zone">
            <MapView
              features={filteredFeatures}
              selectedId={selectedId}
              hoveredId={hoveredId}
              onSelect={(id) => selectFeature(id)}
              onInteractionStatusChange={setMapInteractionStatus}
            />
          </div>

          <MapLegend interactionStatus={mapInteractionStatus} comparedCount={comparedFeatures.length} />

          {selectedFeature ? (
            <DetailPanel
              selectedFeature={selectedFeature}
              sameSpotFeatures={sameSpotFeatures}
              comparedIds={comparedIdSet}
              compareLimitReached={compareLimitReached}
              onSelect={(id) => selectFeature(id)}
              onToggleCompare={toggleCompare}
              onClose={() => setSelectedId(null)}
            />
          ) : null}

          {isMobile ? (
            <section className={`mobile-sheet sheet-${mobileUI.sheetSnap} mode-${mobileUI.sheetMode}`}>
              <button
                type="button"
                className="sheet-grab"
                onPointerDown={handleSheetPointerDown}
                onPointerMove={handleSheetPointerMove}
                onPointerUp={finishSheetDrag}
                onPointerCancel={finishSheetDrag}
                onLostPointerCapture={finishSheetDrag}
                aria-label="Drag sheet"
              >
                <span />
              </button>

              <div className="mobile-actions" role="toolbar" aria-label="Mobile map actions">
                <MobileModeButton
                  mode="results"
                  activeMode={mobileUI.sheetMode}
                  count={filteredFeatures.length}
                  onClick={() =>
                    setMobileUI((current) => ({ ...current, sheetMode: 'results', sheetSnap: 'mid' }))
                  }
                />
                <MobileModeButton
                  mode="filters"
                  activeMode={mobileUI.sheetMode}
                  count={selectedFilterCount}
                  onClick={openMobileFilters}
                />
                <MobileModeButton
                  mode="details"
                  activeMode={mobileUI.sheetMode}
                  count={selectedFeature?.properties.airportCode ?? '-'}
                  disabled={!selectedFeature}
                  onClick={() =>
                    setMobileUI((current) => ({ ...current, sheetMode: 'details', sheetSnap: 'full' }))
                  }
                />
                <MobileModeButton
                  mode="compare"
                  activeMode={mobileUI.sheetMode}
                  count={`${comparedFeatures.length}/${COMPARE_LIMIT}`}
                  onClick={() =>
                    setMobileUI((current) => ({ ...current, sheetMode: 'compare', sheetSnap: 'full' }))
                  }
                />
                <MobileModeButton
                  mode="review"
                  activeMode={mobileUI.sheetMode}
                  count={mobileReviewCount}
                  onClick={() =>
                    setMobileUI((current) => ({ ...current, sheetMode: 'review', sheetSnap: 'full' }))
                  }
                />
                {INTERNAL_VIEWS_ENABLED ? (
                  <MobileModeButton
                    mode="intake"
                    activeMode={mobileUI.sheetMode}
                    count="DEV"
                    onClick={() =>
                      setMobileUI((current) => ({ ...current, sheetMode: 'intake', sheetSnap: 'full' }))
                    }
                  />
                ) : null}
              </div>

              <div className="mobile-sheet-status" aria-label="Sheet status">
                {mobileSheetStatus.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>

              <div className="mobile-sheet-body" ref={mobileSheetBodyRef}>
                {mobileUI.sheetMode === 'results' ? (
                  <>
                    <MobileQuickFilters
                      search={search}
                      types={types}
                      selectedTypes={selectedTypes}
                      visibleCount={filteredFeatures.length}
                      selectedFilterCount={selectedFilterCount}
                      activeFilterChips={activeFilterChips}
                      quickFilterState={mobileUI.quickFilterState}
                      onSearchChange={setSearch}
                      onQuickTypeToggle={toggleQuickType}
                      onOpenFilters={openMobileFilters}
                      onClearFilters={clearAppliedFilters}
                    />
                    {comparedFeatures.length > 0 ? (
                      <CompareTray
                        compact
                        comparedFeatures={comparedFeatures}
                        selectedId={selectedId}
                        onSelect={(id) => selectFeature(id)}
                        onRemove={(id) => setCompareIds((current) => current.filter((item) => item !== id))}
                      />
                    ) : null}
                    <ResultsList
                      key={`results-mobile-${filterSignature}`}
                      features={filteredFeatures}
                      selectedId={selectedId}
                      hoveredId={hoveredId}
                      comparedIds={comparedIdSet}
                      compareLimitReached={compareLimitReached}
                      onHover={setHoveredId}
                      onSelect={(id) => selectFeature(id)}
                      onToggleCompare={toggleCompare}
                      onClearSearch={clearSearch}
                      onClearFilters={clearAppliedFilters}
                      search={search}
                      selectedFilterCount={selectedFilterCount}
                      initialBatch={24}
                      batchSize={24}
                      listContextKey={`mobile|${filterSignature}`}
                    />
                  </>
                ) : null}

                {mobileUI.sheetMode === 'filters' ? (
                  <div className="mobile-filter-wrap">
                    <label className="sort-control mobile-search-control">
                      <span>Search</span>
                      <input
                        type="search"
                        value={mobileFilterDraft.search}
                        onChange={(event) =>
                          setMobileFilterDraft((current) => ({ ...current, search: event.target.value }))
                        }
                        placeholder="Airport, city, lounge"
                      />
                    </label>

                    <div className="control-group">
                      <SortControl
                        value={mobileFilterDraft.sort}
                        onChange={(nextSort) =>
                          setMobileFilterDraft((current) => ({ ...current, sort: nextSort }))
                        }
                      />
                    </div>

                    <FilterControls
                      types={types}
                      typeCounts={typeCounts}
                      selectedTypes={mobileFilterDraft.types}
                      selectedCountry={mobileFilterDraft.country}
                      selectedCity={mobileFilterDraft.city}
                      selectedBrand={mobileFilterDraft.brand}
                      countries={countries}
                      cityOptions={draftCityOptions}
                      brandOptions={brandOptions}
                      selectedFacilities={mobileFilterDraft.facilities}
                      facilityOptions={facilityOptions}
                      toggleType={toggleDraftType}
                      toggleFacility={toggleDraftFacility}
                      setSelectedCountry={(country) =>
                        setMobileFilterDraft((current) => ({ ...current, country, city: 'ALL' }))
                      }
                      setSelectedCity={(city) =>
                        setMobileFilterDraft((current) => ({ ...current, city }))
                      }
                      setSelectedBrand={(brand) =>
                        setMobileFilterDraft((current) => ({ ...current, brand }))
                      }
                    />

                    <div className="mobile-filter-actions">
                      <button type="button" className="secondary-action" onClick={resetMobileDraft}>
                        Clear all
                      </button>
                      <button type="button" className="primary-action" onClick={applyMobileFilters}>
                        Apply filters
                      </button>
                    </div>
                  </div>
                ) : null}

                {mobileUI.sheetMode === 'details' ? (
                  <div className="mobile-detail-wrap">
                    <MobileDetailsView
                      selectedFeature={selectedFeature}
                      sameSpotFeatures={sameSpotFeatures}
                      comparedIds={comparedIdSet}
                      compareLimitReached={compareLimitReached}
                      onSelect={(id) => selectFeature(id)}
                      onToggleCompare={toggleCompare}
                    />
                    {comparedFeatures.length > 0 ? (
                      <CompareTray
                        compact
                        comparedFeatures={comparedFeatures}
                        selectedId={selectedId}
                        onSelect={(id) => selectFeature(id)}
                        onRemove={(id) => setCompareIds((current) => current.filter((item) => item !== id))}
                      />
                    ) : null}
                  </div>
                ) : null}

                {mobileUI.sheetMode === 'compare' ? (
                  <div className="mobile-compare-wrap">
                    <CompareTray
                      compact
                      comparedFeatures={comparedFeatures}
                      selectedId={selectedId}
                      onSelect={(id) => selectFeature(id)}
                      onRemove={(id) => setCompareIds((current) => current.filter((item) => item !== id))}
                    />
                  </div>
                ) : null}

                {mobileUI.sheetMode === 'review' ? (
                  <div className="mobile-review-wrap">
                    <MobileReviewView
                      records={canonicalRecords}
                      meta={meta}
                      coverageGap={coverageGap}
                      cloudflareEvidence={cloudflareEvidence}
                      intakePlan={intakePlan}
                      onSelect={(id) => selectFeature(id)}
                    />
                  </div>
                ) : null}

                {INTERNAL_VIEWS_ENABLED && mobileUI.sheetMode === 'intake' ? (
                  <div className="mobile-intake-wrap">
                    <IntakeView
                      records={canonicalRecords}
                      sources={sources}
                      meta={meta}
                      coverageGap={coverageGap}
                      intakePlan={intakePlan}
                    />
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}
        </section>
      </main>
      ) : null}
    </div>
  );
}

export default App;
