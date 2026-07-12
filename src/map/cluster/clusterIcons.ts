import L from 'leaflet';

const TYPE_COLOR: Record<string, string> = {
  LOUNGE: '#2456a6',
  EAT: '#27755f',
  REST: '#6f5aa8',
  REFRESH: '#1f7c91',
  UNWIND: '#b85c18',
};

const PROGRAM_THEME_COLOR: Record<string, string> = {
  prioritypass: '#2456a6',
  chase: '#1f5fbf',
  chasesapphire: '#174a97',
  chasesapphirelounge: '#174a97',
  americanexpress: '#1c6f9c',
  amex: '#1c6f9c',
  capitalone: '#b8484f',
  visa: '#2f62b3',
  visaairportcompanion: '#2f62b3',
  mastercard: '#d2872c',
  mastercardtravelpass: '#d2872c',
  dragonpass: '#8a4f9f',
  loungekey: '#446f7f',
  plazapremium: '#b89232',
  airportdimensions: '#3f8278',
  theclub: '#3f8278',
  escapelounges: '#6f66a8',
  aircanada: '#596273',
  united: '#2e5d8c',
  delta: '#9b3345',
  american: '#536f8f',
};

const RAINBOW_THEME =
  'conic-gradient(#2456a6 0deg, #2f8278 58deg, #b89232 116deg, #b8484f 174deg, #7b5fa8 232deg, #2456a6 360deg)';

const markerIconCache = new Map<string, L.DivIcon>();
const clusterIconCache = new Map<string, L.DivIcon>();
const airportGroupIconCache = new Map<string, L.DivIcon>();

interface ClusterLike {
  getAllChildMarkers: () => L.Marker[];
}

type MarkerWithLoungeCount = L.Marker & {
  options: L.MarkerOptions & {
    loungeCount?: number;
  };
};

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

function markerLoungeCount(marker: L.Marker) {
  const count = (marker as MarkerWithLoungeCount).options.loungeCount;
  return typeof count === 'number' && Number.isFinite(count) && count > 0 ? count : 1;
}

function normalizeProgramName(program: string) {
  return program.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function fallbackProgramColor(program: string) {
  let hash = 0;
  for (const char of program) {
    hash = (hash * 31 + char.charCodeAt(0)) % 360;
  }

  return `hsl(${hash} 44% 42%)`;
}

function programColor(program: string) {
  const normalized = normalizeProgramName(program);
  return PROGRAM_THEME_COLOR[normalized] ?? fallbackProgramColor(program);
}

function uniquePrograms(programs: string[]) {
  return Array.from(new Set(programs.map((program) => program.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}

function markerFill(type: string, programs: string[]) {
  const normalizedPrograms = uniquePrograms(programs);

  if (normalizedPrograms.length === 0) {
    return TYPE_COLOR[type] ?? TYPE_COLOR.LOUNGE;
  }

  if (normalizedPrograms.length === 1) {
    return programColor(normalizedPrograms[0]);
  }

  if (normalizedPrograms.length > 6) {
    return RAINBOW_THEME;
  }

  const sliceSize = 360 / normalizedPrograms.length;
  const slices = normalizedPrograms.map((program, index) => {
    const start = Math.round(index * sliceSize);
    const end = Math.round((index + 1) * sliceSize);
    return `${programColor(program)} ${start}deg ${end}deg`;
  });

  return `conic-gradient(${slices.join(', ')})`;
}

export function markerIcon(type: string, active: boolean, programs: string[] = []): L.DivIcon {
  const normalizedPrograms = uniquePrograms(programs);
  const key = `${type}-${active ? 'active' : 'idle'}-${normalizedPrograms.join('|')}`;
  const cached = markerIconCache.get(key);
  if (cached) {
    return cached;
  }

  const fill = markerFill(type, normalizedPrograms);
  const icon = L.divIcon({
    className: 'marker-wrap',
    html: `<span class="marker-dot ${active ? 'is-active' : ''}" style="--dot-fill:${fill}"></span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

  markerIconCache.set(key, icon);
  return icon;
}

export function airportGroupIcon(type: string, active: boolean, count: number, programs: string[] = []): L.DivIcon {
  if (count <= 1) {
    return markerIcon(type, active, programs);
  }

  const normalizedPrograms = uniquePrograms(programs);
  const tier = clusterTier(count);
  const size = clusterSizeForTier(tier);
  const fill = markerFill(type, normalizedPrograms);
  const key = `airport:${tier}:${count}:${active ? 'active' : 'idle'}:${normalizedPrograms.join('|')}`;
  const cached = airportGroupIconCache.get(key);

  if (cached) {
    return cached;
  }

  const icon = L.divIcon({
    className: 'cluster-badge-wrap',
    html: `
      <span class="cluster-badge airport-group tier-${tier} ${active ? 'is-active' : ''}" style="--cluster-fill:${fill}">
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

  airportGroupIconCache.set(key, icon);
  return icon;
}

export function createClusterIcon(cluster: ClusterLike) {
  const childMarkers = cluster.getAllChildMarkers();
  const count = childMarkers.reduce((sum, marker) => sum + markerLoungeCount(marker), 0);
  const tier = clusterTier(count);
  const size = clusterSizeForTier(tier);
  const highlighted = childMarkers.some(hasHighlightedChild);
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
