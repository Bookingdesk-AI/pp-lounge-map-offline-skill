import { memo, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { Marker, Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import type { LoungeFeature } from '../../types';
import { airportGroupIcon, createClusterIcon, markerIcon } from './clusterIcons';
import { asFreezableGroup } from './freezable';

const CLUSTER_MAX_RADIUS = 50;

interface AirportMarkerGroup {
  key: string;
  airportCode: string;
  airportName: string;
  city: string;
  country: string;
  position: [number, number];
  features: LoungeFeature[];
  programs: string[];
  representativeType: string;
}

type MarkerOptionsWithLoungeCount = L.MarkerOptions & {
  loungeCount: number;
};

interface BurstMarker {
  feature: LoungeFeature;
  position: [number, number];
}

function airportKey(feature: LoungeFeature) {
  const canonicalIata = feature.properties.canonical?.airport.iata;
  const code = canonicalIata || feature.properties.airportCode;

  if (code && code !== 'Unknown') {
    return `iata:${code}`;
  }

  const [lon, lat] = feature.geometry.coordinates;
  return `coord:${lat.toFixed(5)}:${lon.toFixed(5)}`;
}

function airportPosition(feature: LoungeFeature): [number, number] {
  const coordinates = feature.properties.canonical?.airport.coordinates;

  if (
    coordinates &&
    Number.isFinite(coordinates.lat) &&
    Number.isFinite(coordinates.lon)
  ) {
    return [coordinates.lat, coordinates.lon];
  }

  const [lon, lat] = feature.geometry.coordinates;
  return [lat, lon];
}

function featurePrograms(feature: LoungeFeature) {
  return feature.properties.canonical?.lounge.programs ?? feature.properties.programs ?? [];
}

function buildAirportMarkerGroups(features: LoungeFeature[]): AirportMarkerGroup[] {
  const groups = new Map<string, AirportMarkerGroup>();

  for (const feature of features) {
    const key = airportKey(feature);
    const existing = groups.get(key);

    if (existing) {
      existing.features.push(feature);
      existing.programs.push(...featurePrograms(feature));
      continue;
    }

    groups.set(key, {
      key,
      airportCode: feature.properties.airportCode,
      airportName: feature.properties.airportName,
      city: feature.properties.city,
      country: feature.properties.country,
      position: airportPosition(feature),
      features: [feature],
      programs: [...featurePrograms(feature)],
      representativeType: feature.properties.type,
    });
  }

  return Array.from(groups.values());
}

function burstRadius(count: number, mapSize: L.Point) {
  const maxRadius = mapSize.x <= 640 ? 54 : 72;
  return Math.min(maxRadius, Math.max(38, 30 + count * 2.2));
}

function buildBurstMarkers(map: L.Map, airportGroup: AirportMarkerGroup): BurstMarker[] {
  const center = L.latLng(airportGroup.position[0], airportGroup.position[1]);
  const centerPoint = map.latLngToLayerPoint(center);
  const count = airportGroup.features.length;
  const radius = burstRadius(count, map.getSize());

  return airportGroup.features.map((feature, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count;
    const point = L.point(
      centerPoint.x + Math.cos(angle) * radius,
      centerPoint.y + Math.sin(angle) * radius,
    );
    const latLng = map.layerPointToLatLng(point);

    return {
      feature,
      position: [latLng.lat, latLng.lng],
    };
  });
}

function SelectedAirportBurst({
  airportGroup,
  selectedId,
  hoveredId,
  onSelect,
}: {
  airportGroup: AirportMarkerGroup | undefined;
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
}) {
  const map = useMap();
  const [mapRevision, setMapRevision] = useState(0);

  useMapEvents({
    moveend: () => setMapRevision((current) => current + 1),
    resize: () => setMapRevision((current) => current + 1),
    zoomend: () => setMapRevision((current) => current + 1),
  });

  const burstMarkers = useMemo(() => {
    void mapRevision;

    if (!airportGroup || airportGroup.features.length <= 1) {
      return [];
    }

    return buildBurstMarkers(map, airportGroup);
  }, [airportGroup, map, mapRevision]);

  if (!airportGroup || burstMarkers.length <= 1) {
    return null;
  }

  return (
    <>
      {burstMarkers.map(({ feature, position }) => {
        const id = feature.properties.id;
        const active = id === selectedId || id === hoveredId;

        return (
          <Polyline
            key={`${id}-spoke`}
            positions={[airportGroup.position, position]}
            pathOptions={{
              className: 'airport-burst-spoke',
              color: active ? 'rgba(184, 92, 24, 0.74)' : 'rgba(36, 86, 166, 0.48)',
              opacity: active ? 0.86 : 0.6,
              weight: active ? 2.6 : 2,
            }}
          />
        );
      })}

      {burstMarkers.map(({ feature, position }) => {
        const id = feature.properties.id;
        const active = id === selectedId || id === hoveredId;

        return (
          <Marker
            key={`${id}-burst`}
            position={position}
            icon={markerIcon(feature.properties.type, active, featurePrograms(feature))}
            zIndexOffset={active ? 1200 : 1100}
            eventHandlers={{
              click: () => onSelect(id),
            }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              <div className="map-tooltip">
                <strong>{feature.properties.name}</strong>
                <span>
                  {feature.properties.airportCode} · {feature.properties.terminal}
                </span>
              </div>
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}

export const LoungeClusterLayer = memo(function LoungeClusterLayer({
  features,
  selectedId,
  hoveredId,
  onSelect,
}: {
  features: LoungeFeature[];
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
}) {
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const iconCreateFunction = useMemo(() => createClusterIcon, []);
  const airportGroups = useMemo(() => buildAirportMarkerGroups(features), [features]);
  const selectedAirportGroup = useMemo(
    () => airportGroups.find((airportGroup) =>
      airportGroup.features.some((feature) => feature.properties.id === selectedId),
    ),
    [airportGroups, selectedId],
  );

  useEffect(() => {
    const group = asFreezableGroup(clusterRef.current);
    if (!group) {
      return;
    }

    group.refreshClusters();
  }, [airportGroups, hoveredId, selectedId]);

  useEffect(() => {
    const group = asFreezableGroup(clusterRef.current);
    if (!group) {
      return;
    }
  }, []);

  return (
    <>
      <MarkerClusterGroup
        ref={clusterRef}
        chunkedLoading
        showCoverageOnHover={false}
        maxClusterRadius={CLUSTER_MAX_RADIUS}
        zoomToBoundsOnClick
        spiderfyOnMaxZoom={false}
        iconCreateFunction={iconCreateFunction}
        spiderLegPolylineOptions={{
          weight: 2.4,
          color: 'rgba(36, 86, 166, 0.68)',
          opacity: 0.78,
        }}
      >
        {airportGroups.map((airportGroup) => {
          const active = airportGroup.features.some(
            (feature) => feature.properties.id === selectedId || feature.properties.id === hoveredId,
          );
          const representative = airportGroup.features.find((feature) => feature.properties.id === selectedId) ??
            airportGroup.features[0];
          const [lat, lon] = airportGroup.position;
          const markerOptions = {
            loungeCount: airportGroup.features.length,
          } as MarkerOptionsWithLoungeCount;

          return (
            <Marker
              key={airportGroup.key}
              position={[lat, lon]}
              icon={
                airportGroup.features.length > 1
                  ? airportGroupIcon(
                    airportGroup.representativeType,
                    active,
                    airportGroup.features.length,
                    airportGroup.programs,
                  )
                  : markerIcon(airportGroup.representativeType, active, airportGroup.programs)
              }
              {...markerOptions}
              eventHandlers={{
                click: () => onSelect(representative.properties.id),
              }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                <div className="map-tooltip">
                  <strong>
                    {airportGroup.features.length > 1
                      ? `${airportGroup.airportCode} · ${airportGroup.city || airportGroup.country}`
                      : representative.properties.name}
                  </strong>
                  <span>
                    {airportGroup.features.length > 1
                      ? `${airportGroup.features.length} lounges`
                      : `${airportGroup.airportCode} · ${airportGroup.city || airportGroup.country}`}
                  </span>
                </div>
              </Tooltip>
            </Marker>
          );
        })}
      </MarkerClusterGroup>
      <SelectedAirportBurst
        airportGroup={selectedAirportGroup}
        selectedId={selectedId}
        hoveredId={hoveredId}
        onSelect={onSelect}
      />
    </>
  );
});

LoungeClusterLayer.displayName = 'LoungeClusterLayer';
