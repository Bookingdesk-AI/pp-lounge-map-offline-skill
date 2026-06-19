export type SourceAdapterKind = 'official_html' | 'official_page' | 'csv_file' | 'manual_review' | 'licensed_api';

export type SourceRunStatus = 'active' | 'manual_review' | 'candidate' | 'blocked';

export interface LoungeSourceRegistryEntry {
  id: string;
  publisher: string;
  coverage: string;
  adapter: SourceAdapterKind;
  status: SourceRunStatus;
  freshnessDays: number;
  url: string;
  rightsNote: string;
  lastRunAt: string | null;
  records: number;
  issues: number;
  brandIds?: string[];
}

export interface LoungeBrandAsset {
  id: string;
  name: string;
  category: 'program' | 'issuer' | 'airline' | 'operator' | 'card_network' | 'aggregator';
  aliases?: string[];
  sourceIds: string[];
  sourceUrl: string;
  assetSource: 'desk_travel_database' | 'official_public_source' | 'generated_fallback';
  deskTravelAssetKey: string;
  logoUrl: string;
  logoText: string;
  color: string;
  background: string;
  foreground: string;
  status: 'approved' | 'review' | 'candidate';
  rightsNote: string;
}

export interface LoungeSourceEvidence {
  sourceId: string;
  publisher: string;
  url: string;
  retrievedAt: string;
  fieldCoverage: string[];
  confidence: number;
  rightsNote: string;
}

export interface LoungeQuality {
  completeness: number;
  freshness: number;
  conflicts: string[];
  reviewStatus: 'approved' | 'review' | 'blocked';
}

export interface CanonicalLounge {
  id: string;
  name: string;
  brand: string;
  brandAsset?: LoungeBrandAsset;
  operator: string;
  category: string;
  status: string;
  programs: string[];
  accessMethods: string[];
}

export interface CanonicalAirport {
  iata: string;
  icao: string;
  name: string;
  city: string;
  country: string;
  timezone: string;
  coordinates: {
    lat: number;
    lon: number;
  };
}

export interface CanonicalLocation {
  terminal: string;
  concourse: string;
  gate: string;
  securitySide: string;
  directions: string;
}

export interface CanonicalOperations {
  hours: string;
  exceptions: string[];
  plannedOpening: string;
  lastVerifiedAt: string;
}

export interface CanonicalLoungeRecord {
  lounge: CanonicalLounge;
  airport: CanonicalAirport;
  location: CanonicalLocation;
  operations: CanonicalOperations;
  amenities: string[];
  restrictions: string[];
  guestPolicy: string;
  notes: string[];
  sources: LoungeSourceEvidence[];
  quality: LoungeQuality;
}

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
  provider?: string;
  programs?: string[];
  accessMethods?: string[];
  sources?: LoungeSourceEvidence[];
  quality?: LoungeQuality;
  canonical?: CanonicalLoungeRecord;
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
    totalSources?: number;
    totalCatalogRecords?: number;
    candidateRecords?: number;
    nonPriorityRecords?: number;
    reviewQueue?: number;
    approvedRecords?: number;
  };
  filters: {
    types: string[];
    countries: string[];
    cities: string[];
    facilities: string[];
    providers?: string[];
    programs?: string[];
    reviewStatuses?: string[];
  };
  schema?: {
    version: string;
    fields: Array<{
      group: string;
      name: string;
      required: boolean;
    }>;
  };
  sources?: LoungeSourceRegistryEntry[];
  brands?: LoungeBrandAsset[];
  quality?: {
    averageCompleteness: number;
    averageFreshness: number;
    conflictCount: number;
    reviewQueue: number;
  };
  issues: Array<{
    row: number;
    reason: string;
    airportCode: string;
  }>;
}

export interface CoverageGapReport {
  generatedAt: string;
  goalId: string;
  terminalPassed: boolean;
  blockers: string[];
  current: {
    totalRecords: number;
    approvedRecords: number;
    reviewRecords: number;
    approvedRatio: number;
    sourceFamilyCoverageRatio: number;
  };
  deltas: {
    approvedRecordsRemaining: number;
    approvalsNeededForCurrentCatalogRatio: number;
    reviewRecordsToResolve: number;
    missingSourceFamilies: string[];
  };
  sourceFamilies: Array<{
    id: string;
    label: string;
    mode: string;
    acquisition: string;
    present: boolean;
    presentMembers: string[];
    missingMembers: string[];
  }>;
}

export type SheetSnap = 'peek' | 'mid' | 'full';

export type MobileSheetMode = 'results' | 'filters' | 'details' | 'intake';

export type AppView = 'map' | 'intake' | 'schema' | 'sources';

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
