import L from 'leaflet';

const TYPE_COLOR: Record<string, string> = {
  LOUNGE: '#c9a45d',
  EAT: '#87b7aa',
  REST: '#8fa4cb',
  REFRESH: '#85adc9',
  UNWIND: '#b993af',
};

const markerIconCache = new Map<string, L.DivIcon>();
const clusterIconCache = new Map<string, L.DivIcon>();

interface ClusterLike {
  getAllChildMarkers: () => L.Marker[];
  getChildCount: () => number;
}

function clusterTier(count: number) {
  if (count >= 24) {
    return 'large';
  }

  if (count >= 8) {
    return 'medium';
  }

  return 'small';
}

function clusterSizeForTier(tier: 'small' | 'medium' | 'large') {
  switch (tier) {
    case 'large':
      return 66;
    case 'medium':
      return 58;
    default:
      return 50;
  }
}

function hasHighlightedChild(marker: L.Marker) {
  const icon = marker.options.icon as L.DivIcon | undefined;
  return typeof icon?.options.html === 'string' && icon.options.html.includes('is-active');
}

export function markerIcon(type: string, active: boolean): L.DivIcon {
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

export function createClusterIcon(cluster: ClusterLike) {
  const count = cluster.getChildCount();
  const tier = clusterTier(count);
  const size = clusterSizeForTier(tier);
  const highlighted = cluster.getAllChildMarkers().some(hasHighlightedChild);
  const cacheKey = `${tier}:${count}:${highlighted ? 'active' : 'idle'}`;
  const cached = clusterIconCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const icon = L.divIcon({
    className: 'cluster-badge-wrap',
    html: `
      <span class="cluster-badge tier-${tier} ${highlighted ? 'is-active' : ''}">
        <span class="cluster-badge-ring"></span>
        <span class="cluster-badge-core">
          <strong>${count}</strong>
          <small>${count === 1 ? 'lounge' : 'lounges'}</small>
        </span>
      </span>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

  clusterIconCache.set(cacheKey, icon);
  return icon;
}
