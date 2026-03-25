import type { PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import type {
  ClusterClickMode,
  LoungeFeature,
  LoungeFeatureCollection,
  LoungeFeatureProperties,
  LoungeMeta,
  MobileSheetMode,
  MobileUIState,
  QuickFilterPreset,
  SheetSnap,
  SortOption,
  SpotGroupState,
} from './types';
import './App.css';

const TYPE_COLOR: Record<string, string> = {
  LOUNGE: '#c9a45d',
  EAT: '#87b7aa',
  REST: '#8fa4cb',
  REFRESH: '#85adc9',
  UNWIND: '#b993af',
};

const SORT_LABELS: Record<SortOption, string> = {
  best_match: 'Best match',
  airport_code: 'Airport code',
  country_city: 'Country / city',
  type: 'Type',
};

const WORLD_CENTER: [number, number] = [22.5, 11.5];
const WORLD_ZOOM = 2;
const MOBILE_MEDIA_QUERY = '(max-width: 980px)';
const SHEET_ORDER: SheetSnap[] = ['peek', 'mid', 'full'];
const COMPARE_LIMIT = 3;
const CLUSTER_DISABLE_ZOOM = 10;

const markerIconCache = new Map<string, L.DivIcon>();

interface InitialUrlState {
  search: string;
  selectedTypes: string[];
  selectedCountry: string;
  selectedCity: string;
  selectedFacilities: string[];
  selectedId: string | null;
  sheet: SheetSnap;
  mode: MobileSheetMode;
  sort: SortOption;
}

interface MobileFilterDraft {
  search: string;
  types: string[];
  country: string;
  city: string;
  facilities: string[];
  sort: SortOption;
}

interface ClusterLayerLike {
  getAllChildMarkers: () => L.Marker[];
  getBounds: () => L.LatLngBounds;
}

interface FilterSummaryChip {
  key: string;
  label: string;
  onRemove: () => void;
}

function parseListParam(params: URLSearchParams, key: string) {
  return (params.get(key) ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeSheet(value: string | null): SheetSnap {
  if (value === 'peek' || value === 'mid' || value === 'full') {
    return value;
  }
  return 'mid';
}

function normalizeMode(value: string | null): MobileSheetMode {
  if (value === 'results' || value === 'filters' || value === 'details') {
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
    selectedFacilities: parseListParam(params, 'facilities'),
    selectedId: params.get('selected'),
    sheet: hasSheet ? normalizeSheet(params.get('sheet')) : isInitialMobile ? 'peek' : 'mid',
    mode: normalizeMode(params.get('mode')),
    sort: normalizeSort(params.get('sort')),
  };
}

function coordinateKey(coordinates: [number, number]) {
  const [lon, lat] = coordinates;
  return `${lat.toFixed(5)}:${lon.toFixed(5)}`;
}

function coordinateKeyFromLatLng(latLng: L.LatLng) {
  return `${latLng.lat.toFixed(5)}:${latLng.lng.toFixed(5)}`;
}

function markerIcon(type: string, active: boolean): L.DivIcon {
  const key = `${type}-${active ? 'active' : 'idle'}`;
  const cached = markerIconCache.get(key);
  if (cached) {
    return cached;
  }

  const color = TYPE_COLOR[type] ?? TYPE_COLOR.LOUNGE;
  const icon = L.divIcon({
    className: 'marker-wrap',
    html: `<span class="marker-dot ${active ? 'is-active' : ''}" style="--dot:${color}"></span>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

  markerIconCache.set(key, icon);
  return icon;
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

function toOffsetPosition(
  coordinates: [number, number],
  index: number,
  total: number,
  zoom: number,
  seed: string,
): [number, number] {
  const [lon, lat] = coordinates;
  if (total <= 1) {
    return [lat, lon];
  }

  const ringSize = 8;
  const ring = Math.floor(index / ringSize);
  const indexInRing = index % ringSize;
  const itemsInRing = Math.min(total - ring * ringSize, ringSize);

  const seedValue = [...seed].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const seedAngle = (seedValue % 360) * (Math.PI / 180);
  const angle = seedAngle + (indexInRing / Math.max(itemsInRing, 1)) * Math.PI * 2;

  const baseRadiusMeters = Math.max(42, (52000 / 2 ** Math.max(zoom, 2)) * (1 + ring * 0.65));
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLon = 111320 * Math.max(Math.cos((lat * Math.PI) / 180), 0.15);

  const latOffset = (Math.sin(angle) * baseRadiusMeters) / metersPerDegreeLat;
  const lonOffset = (Math.cos(angle) * baseRadiusMeters) / metersPerDegreeLon;

  return [lat + latOffset, lon + lonOffset];
}

function joinOrFallback(values: string[], fallback: string, limit = values.length) {
  if (values.length === 0) {
    return fallback;
  }
  return values.slice(0, limit).join(' · ');
}

function locationLabel(feature: LoungeFeature) {
  const cityOrCountry = feature.properties.city || feature.properties.country;
  return feature.properties.terminal !== 'Unknown'
    ? `${cityOrCountry} · ${feature.properties.terminal}`
    : cityOrCountry;
}

function detailLocation(feature: LoungeFeature) {
  return `${feature.properties.airportCode} · ${feature.properties.airportName}`;
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
  activeSpotGroup,
}: {
  features: LoungeFeature[];
  selectedId: string | null;
  activeSpotGroup: SpotGroupState | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedId || activeSpotGroup || features.length === 0) {
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
  }, [activeSpotGroup, features, map, selectedId]);

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

function ClusteredMarkers({
  features,
  selectedId,
  hoveredId,
  activeSpotGroup,
  onSelect,
  onOpenSpotGroup,
  onDismissSpotGroup,
  onClusterMode,
}: {
  features: LoungeFeature[];
  selectedId: string | null;
  hoveredId: string | null;
  activeSpotGroup: SpotGroupState | null;
  onSelect: (id: string) => void;
  onOpenSpotGroup: (next: SpotGroupState) => void;
  onDismissSpotGroup: () => void;
  onClusterMode: (mode: ClusterClickMode) => void;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useMapEvents({
    zoomend: () => {
      setZoom(map.getZoom());
    },
  });

  const featuresById = useMemo(
    () => new Map(features.map((feature) => [feature.properties.id, feature])),
    [features],
  );

  const featuresBySpot = useMemo(() => {
    const grouped = new Map<string, LoungeFeature[]>();
    for (const feature of features) {
      const key = coordinateKey(feature.geometry.coordinates);
      const current = grouped.get(key) ?? [];
      current.push(feature);
      grouped.set(key, current);
    }

    for (const [, entries] of grouped) {
      entries.sort((a, b) => a.properties.name.localeCompare(b.properties.name));
    }

    return grouped;
  }, [features]);

  const activeSpotIds = useMemo(() => new Set(activeSpotGroup?.loungeIds ?? []), [activeSpotGroup]);

  const explodedSpotIds = useMemo(() => {
    if (activeSpotGroup || zoom < CLUSTER_DISABLE_ZOOM) {
      return new Set<string>();
    }

    const ids = new Set<string>();
    for (const [, groupedFeatures] of featuresBySpot) {
      if (groupedFeatures.length <= 1) {
        continue;
      }

      for (const feature of groupedFeatures) {
        ids.add(feature.properties.id);
      }
    }

    return ids;
  }, [activeSpotGroup, featuresBySpot, zoom]);

  const clusteredFeatures = useMemo(
    () =>
      features.filter(
        (feature) =>
          !activeSpotIds.has(feature.properties.id) && !explodedSpotIds.has(feature.properties.id),
      ),
    [features, activeSpotIds, explodedSpotIds],
  );

  const activeSpotFeatures = useMemo(() => {
    if (!activeSpotGroup) {
      return [];
    }

    return activeSpotGroup.loungeIds
      .map((id) => featuresById.get(id))
      .filter((feature): feature is LoungeFeature => Boolean(feature));
  }, [activeSpotGroup, featuresById]);

  const explodedSpotFeatures = useMemo(() => {
    if (activeSpotGroup || zoom < CLUSTER_DISABLE_ZOOM) {
      return [];
    }

    const exploded: Array<{ key: string; items: LoungeFeature[] }> = [];
    for (const [key, groupedFeatures] of featuresBySpot) {
      if (groupedFeatures.length > 1) {
        exploded.push({ key, items: groupedFeatures });
      }
    }
    return exploded;
  }, [activeSpotGroup, featuresBySpot, zoom]);

  const handleClusterClick = useCallback(
    (rawEvent: unknown) => {
      const event = rawEvent as L.LeafletEvent & { layer?: ClusterLayerLike };
      const cluster = event.layer;
      if (!cluster) {
        return;
      }

      const childMarkers = cluster.getAllChildMarkers();
      if (childMarkers.length === 0) {
        return;
      }

      const coordinateKeys = new Set(
        childMarkers.map((marker: L.Marker) => coordinateKeyFromLatLng(marker.getLatLng())),
      );

      if (coordinateKeys.size === 1) {
        const onlyKey = childMarkers.length > 0 ? coordinateKeyFromLatLng(childMarkers[0].getLatLng()) : '';
        const spotFeatures = featuresBySpot.get(onlyKey) ?? [];
        const airportCodes = new Set(spotFeatures.map((feature) => feature.properties.airportCode));

        if (spotFeatures.length > 1 && airportCodes.size === 1) {
          const anchorLatLng = childMarkers[0].getLatLng();
          onClusterMode('spot_stack');
          onOpenSpotGroup({
            key: onlyKey,
            airportCode: spotFeatures[0].properties.airportCode,
            anchor: [anchorLatLng.lng, anchorLatLng.lat],
            loungeIds: spotFeatures.map((feature) => feature.properties.id),
            openedAt: new Date().toISOString(),
          });

          map.flyTo([anchorLatLng.lat, anchorLatLng.lng], Math.max(map.getZoom(), 8), {
            duration: 0.45,
          });

          return;
        }
      }

      onClusterMode('zoom');
      onDismissSpotGroup();
      map.fitBounds(cluster.getBounds(), {
        animate: true,
        duration: 0.45,
        padding: [38, 38],
        maxZoom: Math.min(12, map.getMaxZoom()),
      });
    },
    [featuresBySpot, map, onClusterMode, onDismissSpotGroup, onOpenSpotGroup],
  );

  return (
    <>
      <MarkerClusterGroup
        chunkedLoading
        showCoverageOnHover={false}
        maxClusterRadius={50}
        spiderfyOnMaxZoom={false}
        zoomToBoundsOnClick={false}
        disableClusteringAtZoom={CLUSTER_DISABLE_ZOOM}
        eventHandlers={{
          clusterclick: handleClusterClick,
        }}
      >
        {clusteredFeatures.map((feature) => {
          const id = feature.properties.id;
          const [lon, lat] = feature.geometry.coordinates;
          const active = id === selectedId || id === hoveredId;

          return (
            <Marker
              key={id}
              position={[lat, lon]}
              icon={markerIcon(feature.properties.type, active)}
              eventHandlers={{
                click: () => onSelect(id),
              }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                <div className="map-tooltip">
                  <strong>{feature.properties.name}</strong>
                  <span>
                    {feature.properties.airportCode} · {feature.properties.city || feature.properties.country}
                  </span>
                </div>
              </Tooltip>
            </Marker>
          );
        })}
      </MarkerClusterGroup>

      {activeSpotFeatures.map((feature, index) => {
        const id = feature.properties.id;
        const position = toOffsetPosition(
          feature.geometry.coordinates,
          index,
          activeSpotFeatures.length,
          zoom,
          activeSpotGroup?.key ?? '',
        );
        const active = id === selectedId || id === hoveredId;

        return (
          <Marker
            key={`stack-${id}`}
            position={position}
            icon={markerIcon(feature.properties.type, active)}
            zIndexOffset={1600}
            eventHandlers={{
              click: () => onSelect(id),
            }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              <div className="map-tooltip">
                <strong>{feature.properties.name}</strong>
                <span>
                  {feature.properties.airportCode} · {feature.properties.city || feature.properties.country}
                </span>
              </div>
            </Tooltip>
          </Marker>
        );
      })}

      {explodedSpotFeatures.flatMap(({ key, items }) =>
        items.map((feature, index) => {
          const id = feature.properties.id;
          const position = toOffsetPosition(
            feature.geometry.coordinates,
            index,
            items.length,
            zoom,
            key,
          );
          const active = id === selectedId || id === hoveredId;

          return (
            <Marker
              key={`exploded-${id}`}
              position={position}
              icon={markerIcon(feature.properties.type, active)}
              zIndexOffset={1500}
              eventHandlers={{
                click: () => onSelect(id),
              }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                <div className="map-tooltip">
                  <strong>{feature.properties.name}</strong>
                  <span>
                    {feature.properties.airportCode} · {feature.properties.city || feature.properties.country}
                  </span>
                </div>
              </Tooltip>
            </Marker>
          );
        }),
      )}
    </>
  );
}

function MapView({
  features,
  selectedId,
  hoveredId,
  activeSpotGroup,
  onSelect,
  onOpenSpotGroup,
  onDismissSpotGroup,
  onClusterMode,
}: {
  features: LoungeFeature[];
  selectedId: string | null;
  hoveredId: string | null;
  activeSpotGroup: SpotGroupState | null;
  onSelect: (id: string) => void;
  onOpenSpotGroup: (next: SpotGroupState) => void;
  onDismissSpotGroup: () => void;
  onClusterMode: (mode: ClusterClickMode) => void;
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
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
      />

      <ClusteredMarkers
        features={features}
        selectedId={selectedId}
        hoveredId={hoveredId}
        activeSpotGroup={activeSpotGroup}
        onSelect={onSelect}
        onOpenSpotGroup={onOpenSpotGroup}
        onDismissSpotGroup={onDismissSpotGroup}
        onClusterMode={onClusterMode}
      />

      <FitBounds features={features} selectedId={selectedId} activeSpotGroup={activeSpotGroup} />
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
  countries,
  cityOptions,
  selectedFacilities,
  facilityOptions,
  toggleType,
  toggleFacility,
  setSelectedCountry,
  setSelectedCity,
}: {
  types: string[];
  typeCounts: Map<string, number>;
  selectedTypes: string[];
  selectedCountry: string;
  selectedCity: string;
  countries: string[];
  cityOptions: string[];
  selectedFacilities: string[];
  facilityOptions: string[];
  toggleType: (type: string) => void;
  toggleFacility: (facility: string) => void;
  setSelectedCountry: (country: string) => void;
  setSelectedCity: (city: string) => void;
}) {
  return (
    <>
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
                {country}
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
    return (
      <div className="active-filters is-empty">
        <p>No active filters</p>
      </div>
    );
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
          <p className="eyebrow">Compare</p>
          <h2>Shortlist up to {COMPARE_LIMIT} lounges</h2>
        </div>
        <span className="compare-count">{comparedFeatures.length} / {COMPARE_LIMIT}</span>
      </div>

      {comparedFeatures.length === 0 ? (
        <p className="support-copy">Save lounges to compare hours, facilities, and access.</p>
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
                      <dd>{feature.properties.openingHours || 'See details'}</dd>
                    </div>
                    <div>
                      <dt>Facilities</dt>
                      <dd>{joinOrFallback(feature.properties.facilities, 'Not listed', showExpandedMetrics ? 4 : 2)}</dd>
                    </div>
                    {showExpandedMetrics ? (
                      <div>
                        <dt>Conditions</dt>
                        <dd>{joinOrFallback(feature.properties.conditions, 'Not listed', 3)}</dd>
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
      <h3>Nothing matches the current criteria.</h3>
      <p>
        {search.trim()
          ? `Try broadening "${search.trim()}" or remove a few filters to see nearby lounge options.`
          : 'Try removing a few filters to reopen the broader lounge catalog.'}
      </p>
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

  useEffect(() => {
    setVisibleCount(Math.min(Math.max(initialBatch, 1), features.length));
  }, [features.length, initialBatch, listContextKey]);

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
              <header>
                <span className="badge">{feature.properties.type}</span>
                <span className="code">{feature.properties.airportCode}</span>
              </header>
              <h3>{feature.properties.name}</h3>
              <p>{feature.properties.airportName}</p>
              <div className="result-meta-row">
                <span>{locationLabel(feature)}</span>
                <span>{feature.properties.openingHours || 'See details'}</span>
              </div>
              <small>{joinOrFallback(feature.properties.facilities, 'Facilities not listed', 3)}</small>
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
  activeSpotGroup,
  onSelect,
  onDismissSpotGroup,
}: {
  selectedFeature: LoungeFeature;
  sameSpotFeatures: LoungeFeature[];
  activeSpotGroup: SpotGroupState | null;
  onSelect: (id: string) => void;
  onDismissSpotGroup: () => void;
}) {
  if (sameSpotFeatures.length <= 1) {
    return null;
  }

  return (
    <div className="spot-group">
      <div className="spot-group-head">
        <p className="spot-group-title">
          {sameSpotFeatures.length} lounges at {selectedFeature.properties.airportCode}
        </p>
        {activeSpotGroup ? (
          <button type="button" className="secondary-action compact" onClick={onDismissSpotGroup}>
            Close stack
          </button>
        ) : null}
      </div>
      <p className="support-copy">
        Same-airport clusters expand into a stack so you can compare lounges without losing map position.
      </p>
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
              {spot.properties.airportCode} · {spot.properties.city || spot.properties.country}
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
  activeSpotGroup,
  comparedIds,
  compareLimitReached,
  onSelect,
  onDismissSpotGroup,
  onToggleCompare,
  onClose,
}: {
  selectedFeature: LoungeFeature;
  sameSpotFeatures: LoungeFeature[];
  activeSpotGroup: SpotGroupState | null;
  comparedIds: Set<string>;
  compareLimitReached: boolean;
  onSelect: (id: string) => void;
  onDismissSpotGroup: () => void;
  onToggleCompare: (id: string) => void;
  onClose: () => void;
}) {
  const compared = comparedIds.has(selectedFeature.properties.id);

  return (
    <aside className="detail-panel detail-panel-overlay">
      <div className="detail-panel-head">
        <div>
          <p>Selected lounge</p>
          <h3>{selectedFeature.properties.name}</h3>
          <span>{detailLocation(selectedFeature)}</span>
        </div>
        <button type="button" className="ghost-action" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="detail-panel-body">
        <div className="detail-meta-strip">
          <span className="badge">{selectedFeature.properties.type}</span>
          <span className="code">{locationLabel(selectedFeature)}</span>
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
              View Priority Pass details
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
            <dd>{selectedFeature.properties.openingHours || 'See Priority Pass details for schedule.'}</dd>
          </div>
          <div>
            <dt>Conditions</dt>
            <dd>{joinOrFallback(selectedFeature.properties.conditions, 'Not listed')}</dd>
          </div>
          <div>
            <dt>Facilities</dt>
            <dd>{joinOrFallback(selectedFeature.properties.facilities, 'Not listed')}</dd>
          </div>
        </dl>

        <SameSpotList
          selectedFeature={selectedFeature}
          sameSpotFeatures={sameSpotFeatures}
          activeSpotGroup={activeSpotGroup}
          onSelect={onSelect}
          onDismissSpotGroup={onDismissSpotGroup}
        />
      </div>
    </aside>
  );
}

function MapLegend({
  clusterClickMode,
  comparedCount,
}: {
  clusterClickMode: ClusterClickMode;
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
        <span className="eyebrow">Map guide</span>
        <span>{expanded ? 'Hide' : 'Show'}</span>
      </button>
      {expanded ? (
        <ul>
          <li>Click a cluster to zoom. Matching lounges at one airport expand into a stack.</li>
          <li>
            {clusterClickMode === 'spot_stack'
              ? 'Stack view is active for the selected airport.'
              : 'Cluster zoom mode is active.'}
          </li>
          <li>
            {comparedCount > 0
              ? `${comparedCount} lounge${comparedCount === 1 ? '' : 's'} saved for compare.`
              : 'Use Compare to shortlist up to three lounges.'}
          </li>
        </ul>
      ) : null}
    </div>
  );
}

function MobileQuickFilters({
  types,
  selectedTypes,
  selectedCountry,
  selectedCity,
  visibleCount,
  selectedFilterCount,
  quickFilterState,
  onQuickTypeToggle,
  onOpenFilters,
}: {
  types: string[];
  selectedTypes: string[];
  selectedCountry: string;
  selectedCity: string;
  visibleCount: number;
  selectedFilterCount: number;
  quickFilterState: QuickFilterPreset;
  onQuickTypeToggle: (type: string) => void;
  onOpenFilters: () => void;
}) {
  return (
    <div className="mobile-quick-filters">
      <div className="mobile-results-summary">
        <p>{visibleCount} lounges visible</p>
        <button type="button" className="ghost-link" onClick={onOpenFilters}>
          {selectedFilterCount > 0 ? `${selectedFilterCount} filters active` : 'Open filters'}
        </button>
      </div>

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

      <div className="mobile-filter-meta">
        <span className="meta-chip">Country: {selectedCountry === 'ALL' ? 'All' : selectedCountry}</span>
        <span className="meta-chip">City: {selectedCity === 'ALL' ? 'All' : selectedCity}</span>
      </div>
    </div>
  );
}

function MobileDetailsView({
  selectedFeature,
  sameSpotFeatures,
  activeSpotGroup,
  comparedIds,
  compareLimitReached,
  onSelect,
  onDismissSpotGroup,
  onToggleCompare,
}: {
  selectedFeature: LoungeFeature | undefined;
  sameSpotFeatures: LoungeFeature[];
  activeSpotGroup: SpotGroupState | null;
  comparedIds: Set<string>;
  compareLimitReached: boolean;
  onSelect: (id: string) => void;
  onDismissSpotGroup: () => void;
  onToggleCompare: (id: string) => void;
}) {
  if (!selectedFeature) {
    return (
      <div className="mobile-empty-selected">
        <p className="eyebrow">Details</p>
        <h3>No lounge selected</h3>
        <p>Pick a result or map marker to open lounge details and compare options.</p>
      </div>
    );
  }

  const compared = comparedIds.has(selectedFeature.properties.id);

  return (
    <div className="mobile-selected-view">
      <div className="mobile-selected-summary">
        <div className="mobile-selected-meta">
          <span className="badge">{selectedFeature.properties.type}</span>
          <span className="code">{selectedFeature.properties.airportCode}</span>
        </div>
        <h3>{selectedFeature.properties.name}</h3>
        <p>{selectedFeature.properties.airportName}</p>
        <small>{locationLabel(selectedFeature)}</small>
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
            View Priority Pass details
          </a>
        ) : null}
      </div>

      <details className="mobile-detail-accordion" open>
        <summary>Opening hours</summary>
        <p>{selectedFeature.properties.openingHours || 'See lounge page for schedule.'}</p>
      </details>

      <details className="mobile-detail-accordion" open>
        <summary>Location</summary>
        <p>{locationLabel(selectedFeature)}</p>
      </details>

      <details className="mobile-detail-accordion">
        <summary>Conditions</summary>
        <p>{joinOrFallback(selectedFeature.properties.conditions, 'Not listed')}</p>
      </details>

      <details className="mobile-detail-accordion">
        <summary>Facilities</summary>
        <p>{joinOrFallback(selectedFeature.properties.facilities, 'Not listed')}</p>
      </details>

      <SameSpotList
        selectedFeature={selectedFeature}
        sameSpotFeatures={sameSpotFeatures}
        activeSpotGroup={activeSpotGroup}
        onSelect={onSelect}
        onDismissSpotGroup={onDismissSpotGroup}
      />
    </div>
  );
}

function App() {
  const initialUrlState = useMemo(() => readInitialUrlState(), []);

  const [features, setFeatures] = useState<LoungeFeature[]>([]);
  const [meta, setMeta] = useState<LoungeMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState(initialUrlState.search);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(initialUrlState.selectedTypes);
  const [selectedCountry, setSelectedCountry] = useState(initialUrlState.selectedCountry);
  const [selectedCity, setSelectedCity] = useState(initialUrlState.selectedCity);
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>(initialUrlState.selectedFacilities);
  const [sort, setSort] = useState<SortOption>(
    initialUrlState.sort === 'country_city' && initialUrlState.search ? 'best_match' : initialUrlState.sort,
  );

  const [selectedId, setSelectedId] = useState<string | null>(initialUrlState.selectedId);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeSpotGroup, setActiveSpotGroup] = useState<SpotGroupState | null>(null);
  const [clusterClickMode, setClusterClickMode] = useState<ClusterClickMode>('zoom');
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
    facilities: initialUrlState.selectedFacilities,
    sort,
  });

  const sheetDragState = useRef<{ startY: number; currentY: number } | null>(null);
  const filterSignatureRef = useRef('');

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
        const [geoJsonResponse, metaResponse] = await Promise.all([
          fetch('/data/lounges.geojson'),
          fetch('/data/meta.json'),
        ]);

        if (!geoJsonResponse.ok || !metaResponse.ok) {
          throw new Error('Data files missing. Run npm run build:data first.');
        }

        const geoJson = (await geoJsonResponse.json()) as LoungeFeatureCollection;
        const nextMeta = (await metaResponse.json()) as LoungeMeta;

        if (!alive) {
          return;
        }

        setFeatures(geoJson.features ?? []);
        setMeta(nextMeta);
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

      if (
        selectedFacilities.length > 0 &&
        !selectedFacilities.every((facility) => properties.facilities.includes(facility))
      ) {
        return false;
      }

      return matchesSearch(properties, query);
    });
  }, [features, query, selectedCountry, selectedCity, selectedFacilities]);

  const filteredFeatures = useMemo(() => {
    const narrowed =
      selectedTypes.length > 0
        ? geoFilteredFeatures.filter((feature) => selectedTypes.includes(feature.properties.type))
        : geoFilteredFeatures;
    return sortFeatures(narrowed, sort, query);
  }, [geoFilteredFeatures, query, selectedTypes, sort]);

  const featuresBySpot = useMemo(() => {
    const grouped = new Map<string, LoungeFeature[]>();
    for (const feature of filteredFeatures) {
      const key = coordinateKey(feature.geometry.coordinates);
      const current = grouped.get(key) ?? [];
      current.push(feature);
      grouped.set(key, current);
    }

    for (const [, entries] of grouped) {
      entries.sort((a, b) => a.properties.name.localeCompare(b.properties.name));
    }

    return grouped;
  }, [filteredFeatures]);

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
    if (activeSpotGroup) {
      return activeSpotGroup.loungeIds
        .map((id) => featuresById.get(id))
        .filter((feature): feature is LoungeFeature => Boolean(feature));
    }

    if (!selectedFeature) {
      return [];
    }

    return featuresBySpot.get(coordinateKey(selectedFeature.geometry.coordinates)) ?? [selectedFeature];
  }, [activeSpotGroup, featuresById, featuresBySpot, selectedFeature]);

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

    const stillVisible = filteredFeatures.some((feature) => feature.properties.id === selectedId);
    if (!stillVisible) {
      setSelectedId(filteredFeatures[0]?.properties.id ?? null);
      setActiveSpotGroup(null);
    }
  }, [filteredFeatures, selectedId]);

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

  useEffect(() => {
    if (!activeSpotGroup) {
      return;
    }

    const stillVisible = activeSpotGroup.loungeIds.some((id) =>
      filteredFeatures.some((feature) => feature.properties.id === id),
    );

    if (!stillVisible) {
      setActiveSpotGroup(null);
    }
  }, [activeSpotGroup, filteredFeatures]);

  const filterSignature = useMemo(
    () =>
      [
        search.trim(),
        [...selectedTypes].sort().join(','),
        selectedCountry,
        selectedCity,
        [...selectedFacilities].sort().join(','),
        sort,
      ].join('|'),
    [search, selectedTypes, selectedCountry, selectedCity, selectedFacilities, sort],
  );

  useEffect(() => {
    if (!filterSignatureRef.current) {
      filterSignatureRef.current = filterSignature;
      return;
    }

    if (filterSignatureRef.current !== filterSignature) {
      setActiveSpotGroup(null);
      filterSignatureRef.current = filterSignature;
    }
  }, [filterSignature]);

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

    if (selectedFacilities.length > 0) {
      params.set('facilities', [...selectedFacilities].sort().join(','));
    }

    if (selectedId) {
      params.set('selected', selectedId);
    }

    if (sort !== (trimmedSearch ? 'best_match' : 'country_city')) {
      params.set('sort', sort);
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
    selectedFacilities,
    selectedId,
    sort,
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
    (id: string, options?: { preserveSpotGroup?: boolean }) => {
      setSelectedId(id);
      if (!options?.preserveSpotGroup) {
        setActiveSpotGroup(null);
      }

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

  const openSpotGroup = useCallback(
    (next: SpotGroupState) => {
      setActiveSpotGroup(next);
      setSelectedId((current) => (current && next.loungeIds.includes(current) ? current : next.loungeIds[0] ?? null));

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

  const dismissSpotGroup = useCallback(() => {
    setActiveSpotGroup(null);
  }, []);

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
    setSelectedFacilities([]);
    setSort('country_city');
    setActiveSpotGroup(null);
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
      facilities: [...selectedFacilities],
      sort,
    });
    setMobileUI((current) => ({ ...current, sheetMode: 'filters', sheetSnap: 'full' }));
  }, [search, selectedTypes, selectedCountry, selectedCity, selectedFacilities, sort]);

  const applyMobileFilters = useCallback(() => {
    setSearch(mobileFilterDraft.search);
    setSelectedTypes([...mobileFilterDraft.types]);
    setSelectedCountry(mobileFilterDraft.country);
    setSelectedCity(mobileFilterDraft.city);
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

  const handleSheetPointerUp = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
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

    event.currentTarget.releasePointerCapture(event.pointerId);
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

    if (!selectedFeature) {
      setMobileUI((current) => ({ ...current, sheetMode: 'results', sheetSnap: 'mid' }));
    }
  }, [isMobile, mobileUI.sheetMode, selectedFeature]);

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
        label: selectedCountry,
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

    for (const facility of selectedFacilities) {
      chips.push({
        key: `facility-${facility}`,
        label: facility,
        onRemove: () => toggleFacility(facility),
      });
    }

    return chips;
  }, [search, selectedTypes, selectedCountry, selectedCity, selectedFacilities, toggleType, toggleFacility]);

  if (loading) {
    return <div className="state-screen">Loading lounge map data...</div>;
  }

  if (error) {
    return <div className="state-screen">{error}</div>;
  }

  const selectedFilterCount =
    selectedTypes.length +
    selectedFacilities.length +
    (selectedCountry !== 'ALL' ? 1 : 0) +
    (selectedCity !== 'ALL' ? 1 : 0) +
    (search.trim() ? 1 : 0);

  return (
    <div className={`app-shell ${isMobile ? `is-mobile sheet-${mobileUI.sheetSnap}` : ''}`}>
      <header className="topbar">
        <div className="brand-wrap">
          <p className="kicker">Priority Pass</p>
          <h1>Global Lounge Atlas</h1>
          <p className="subtitle">
            Compare {meta?.stats.totalFeatures ?? 0} lounges across {meta?.stats.uniqueCountries ?? 0} countries.
          </p>
        </div>

        <label className="search-wrap">
          <span>Search airport, city, or lounge</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Example: AUA, New York, Plaza Premium"
          />
        </label>
      </header>

      <main className="workspace">
        <section className="results-rail">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Explore</p>
              <h2>Traveler comparison</h2>
            </div>
            <div className="panel-head-meta">
              <p>{filteredFeatures.length} visible</p>
              <SortControl value={sort} onChange={setSort} />
            </div>
          </div>

          <ActiveFilterSummary chips={activeFilterChips} onClearAll={clearAppliedFilters} />

          <CompareTray
            comparedFeatures={comparedFeatures}
            selectedId={selectedId}
            onSelect={(id) => selectFeature(id)}
            onRemove={(id) => setCompareIds((current) => current.filter((item) => item !== id))}
          />

          <div className="panel-cluster">
            <FilterControls
              types={types}
              typeCounts={typeCounts}
              selectedTypes={selectedTypes}
              selectedCountry={selectedCountry}
              selectedCity={selectedCity}
              countries={countries}
              cityOptions={cityOptions}
              selectedFacilities={selectedFacilities}
              facilityOptions={facilityOptions}
              toggleType={toggleType}
              toggleFacility={toggleFacility}
              setSelectedCountry={setSelectedCountry}
              setSelectedCity={setSelectedCity}
            />
          </div>

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
              activeSpotGroup={activeSpotGroup}
              onSelect={(id) => selectFeature(id)}
              onOpenSpotGroup={openSpotGroup}
              onDismissSpotGroup={dismissSpotGroup}
              onClusterMode={setClusterClickMode}
            />
          </div>

          <MapLegend clusterClickMode={clusterClickMode} comparedCount={comparedFeatures.length} />

          {selectedFeature ? (
            <DetailPanel
              selectedFeature={selectedFeature}
              sameSpotFeatures={sameSpotFeatures}
              activeSpotGroup={activeSpotGroup}
              comparedIds={comparedIdSet}
              compareLimitReached={compareLimitReached}
              onSelect={(id) => selectFeature(id)}
              onDismissSpotGroup={dismissSpotGroup}
              onToggleCompare={toggleCompare}
              onClose={() => setSelectedId(null)}
            />
          ) : null}
        </section>
      </main>

      {isMobile ? (
        <section className={`mobile-sheet sheet-${mobileUI.sheetSnap} mode-${mobileUI.sheetMode}`}>
          <button
            type="button"
            className="sheet-grab"
            onPointerDown={handleSheetPointerDown}
            onPointerMove={handleSheetPointerMove}
            onPointerUp={handleSheetPointerUp}
            aria-label="Drag sheet"
          >
            <span />
            <small>Swipe for more</small>
          </button>

          <div className="mobile-actions" role="toolbar" aria-label="Mobile map actions">
            <button
              type="button"
              className={mobileUI.sheetMode === 'results' ? 'is-active' : ''}
              onClick={() => setMobileUI((current) => ({ ...current, sheetMode: 'results', sheetSnap: 'mid' }))}
            >
              Results
            </button>
            <button
              type="button"
              className={mobileUI.sheetMode === 'filters' ? 'is-active' : ''}
              onClick={openMobileFilters}
            >
              Filters
            </button>
            <button
              type="button"
              className={mobileUI.sheetMode === 'details' ? 'is-active' : ''}
              disabled={!selectedFeature}
              onClick={() => setMobileUI((current) => ({ ...current, sheetMode: 'details', sheetSnap: 'full' }))}
            >
              Details
            </button>
          </div>

          <div className="mobile-sheet-body">
            {mobileUI.sheetMode === 'results' ? (
              <>
                <MobileQuickFilters
                  types={types}
                  selectedTypes={selectedTypes}
                  selectedCountry={selectedCountry}
                  selectedCity={selectedCity}
                  visibleCount={filteredFeatures.length}
                  selectedFilterCount={selectedFilterCount}
                  quickFilterState={mobileUI.quickFilterState}
                  onQuickTypeToggle={toggleQuickType}
                  onOpenFilters={openMobileFilters}
                />
                <CompareTray
                  compact
                  comparedFeatures={comparedFeatures}
                  selectedId={selectedId}
                  onSelect={(id) => selectFeature(id)}
                  onRemove={(id) => setCompareIds((current) => current.filter((item) => item !== id))}
                />
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
                  countries={countries}
                  cityOptions={draftCityOptions}
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
                <CompareTray
                  compact
                  comparedFeatures={comparedFeatures}
                  selectedId={selectedId}
                  onSelect={(id) => selectFeature(id)}
                  onRemove={(id) => setCompareIds((current) => current.filter((item) => item !== id))}
                />
                <MobileDetailsView
                  selectedFeature={selectedFeature}
                  sameSpotFeatures={sameSpotFeatures}
                  activeSpotGroup={activeSpotGroup}
                  comparedIds={comparedIdSet}
                  compareLimitReached={compareLimitReached}
                  onSelect={(id) => selectFeature(id)}
                  onDismissSpotGroup={dismissSpotGroup}
                  onToggleCompare={toggleCompare}
                />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default App;
