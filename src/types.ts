export interface LoungeFeatureProperties {
  id: string;
  airportCode: string;
  airportName: string;
  country: string;
  city: string;
  type: string;
  terminal: string;
  name: string;
  openingHours: string;
  conditions: string[];
  facilities: string[];
  url: string;
  location: string;
  slug: string;
}

export interface LoungeFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: LoungeFeatureProperties;
}

export interface LoungeFeatureCollection {
  type: 'FeatureCollection';
  features: LoungeFeature[];
}

export interface LoungeMeta {
  generatedAt: string;
  sourceFile: string;
  stats: {
    totalInputRows: number;
    totalFeatures: number;
    droppedRows: number;
    uniqueAirports: number;
    uniqueCountries: number;
    uniqueCities: number;
  };
  filters: {
    types: string[];
    countries: string[];
    cities: string[];
    facilities: string[];
  };
  issues: Array<{
    row: number;
    reason: string;
    airportCode: string;
  }>;
}

export interface SpotGroupState {
  key: string;
  airportCode: string;
  anchor: [number, number];
  loungeIds: string[];
  openedAt: string;
}

export type ClusterClickMode = 'zoom' | 'spot_stack';

export type SheetSnap = 'peek' | 'mid' | 'full';

export type MobileSheetMode = 'results' | 'filters' | 'details';

export type SortOption = 'best_match' | 'airport_code' | 'country_city' | 'type';

export type QuickFilterPreset =
  | 'none'
  | 'type_lounge'
  | 'type_eat'
  | 'type_rest'
  | 'type_refresh'
  | 'type_unwind';

export interface MobileUIState {
  sheetSnap: SheetSnap;
  sheetMode: MobileSheetMode;
  quickFilterState: QuickFilterPreset;
}
