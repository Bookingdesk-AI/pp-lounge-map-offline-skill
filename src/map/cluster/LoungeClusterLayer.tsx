import type { RefObject } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import type { LoungeFeature } from '../../types';
import { createClusterIcon, markerIcon } from './clusterIcons';
import { asFreezableGroup } from './freezable';

const CLUSTER_FREEZE_ZOOM = 10;
const CLUSTER_MAX_RADIUS = 50;

export type MapInteractionStatus = 'clusters' | 'spiderfied';

function ClusterInteractionController({
  clusterRef,
  onInteractionStatusChange,
}: {
  clusterRef: RefObject<L.MarkerClusterGroup | null>;
  onInteractionStatusChange: (status: MapInteractionStatus) => void;
}) {
  const map = useMap();
  const freezeModeRef = useRef<'frozen' | 'live'>('live');

  const syncFreezeState = useCallback(() => {
    const group = asFreezableGroup(clusterRef.current);
    if (!group) {
      return;
    }

    if (map.getZoom() >= CLUSTER_FREEZE_ZOOM) {
      if (freezeModeRef.current !== 'frozen') {
        group.freezeAtZoom('maxKeepSpiderfy');
        freezeModeRef.current = 'frozen';
      }
    } else if (freezeModeRef.current !== 'live') {
      group.unfreeze();
      freezeModeRef.current = 'live';
    }

    onInteractionStatusChange('clusters');
  }, [clusterRef, map, onInteractionStatusChange]);

  useMapEvents({
    zoomstart: () => {
      onInteractionStatusChange('clusters');
    },
    zoomend: syncFreezeState,
  });

  useEffect(() => {
    syncFreezeState();
  }, [syncFreezeState]);

  return null;
}

export const LoungeClusterLayer = memo(function LoungeClusterLayer({
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
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const iconCreateFunction = useMemo(() => createClusterIcon, []);

  useEffect(() => {
    const group = asFreezableGroup(clusterRef.current);
    if (!group) {
      return;
    }

    group.refreshClusters();
  }, [features, hoveredId, selectedId]);

  useEffect(() => {
    const group = asFreezableGroup(clusterRef.current);
    if (!group) {
      return;
    }
  }, []);

  return (
    <>
      <ClusterInteractionController
        clusterRef={clusterRef}
        onInteractionStatusChange={onInteractionStatusChange}
      />

      <MarkerClusterGroup
        ref={clusterRef}
        chunkedLoading
        showCoverageOnHover={false}
        maxClusterRadius={CLUSTER_MAX_RADIUS}
        zoomToBoundsOnClick
        spiderfyOnMaxZoom
        spiderfyDistanceMultiplier={1.15}
        iconCreateFunction={iconCreateFunction}
        spiderLegPolylineOptions={{
          weight: 2,
          color: 'rgba(36, 86, 166, 0.72)',
          opacity: 0.72,
        }}
      >
        {features.map((feature) => {
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
    </>
  );
});

LoungeClusterLayer.displayName = 'LoungeClusterLayer';
