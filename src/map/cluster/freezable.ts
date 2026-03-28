import L from 'leaflet';
import 'leaflet.markercluster.freezable';

export type FreezeAtZoom = number | 'max' | 'maxKeepSpiderfy' | false;

export type FreezableMarkerClusterGroup = L.MarkerClusterGroup & {
  freezeAtZoom: (frozenZoom?: number | string | boolean) => FreezableMarkerClusterGroup;
  unfreeze: () => FreezableMarkerClusterGroup;
  disableClusteringKeepSpiderfy: () => FreezableMarkerClusterGroup;
  enableClustering: () => FreezableMarkerClusterGroup;
  refreshClusters: () => FreezableMarkerClusterGroup;
};

export function asFreezableGroup(
  group: L.MarkerClusterGroup | null,
): FreezableMarkerClusterGroup | null {
  return group as FreezableMarkerClusterGroup | null;
}
