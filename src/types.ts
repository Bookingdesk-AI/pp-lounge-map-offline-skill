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
  fetchUrls?: string[];
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
    unknownAirportRecords?: number;
    recordsWithoutSources?: number;
    recordsWithoutQuality?: number;
    sourceIntakeRuntime?: string;
    cloudflareSourceRuntimePassed?: boolean;
    cloudflareSourceEvidence?: {
      sourceRunsRead: number;
      cloudflareSourceRuns: number;
      uniqueSources: number;
      fetched: number;
      cloudflareSnapshots: number;
      readyTasks: number;
      readyTasksWithCloudflareEvidence: number;
      readyTaskCoverageRatio: number;
      readyMemberGaps: number;
      readyMemberGapsWithCloudflareEvidence: number;
      readyMemberGapCoverageRatio: number;
      fullSourceIntakeReportRequired: boolean;
    };
  };
  deltas: {
    approvedRecordsRemaining: number;
    approvalsNeededForCurrentCatalogRatio: number;
    reviewRecordsToResolve: number;
    missingSourceFamilies: string[];
    sourceIntakeRuntimeRequired?: string | null;
  };
  nextCloudflareIntake?: {
    requiredTokenEnv: string;
    localScrawl: 'blocked';
    missingRuntime: boolean;
    fullReportRequired: boolean;
    readySourceIds: string[];
    credentialSourceIds: string[];
    rightsReviewSourceIds: string[];
    commands: {
      probe: string;
      evidence: string;
      report: string;
      promote: string;
      rebuild: string;
      pushD1: string;
      validate: string;
    };
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

export interface CloudflareSourceIntakePlan {
  generatedAt: string;
  coverageGoalId: string;
  sourceRunId: string | null;
  policy: {
    requiredRuntime: 'cloudflare';
    localScrawl: 'blocked';
    rawSnapshotsCommitted: false;
    proofEnv: string;
  };
  summary: {
    missingFamilies: number;
    memberGaps: number;
    tasks: number;
    readyTasks: number;
    blockedTasks: number;
    fetchedWithoutRecords: number;
  };
  tasks: CloudflareSourceIntakePlanItem[];
  memberGaps: Array<CloudflareSourceIntakePlanItem & {
    familyPresent: boolean;
    terminalFamilyBlocked: boolean;
  }>;
}

export interface CloudflareSourceIntakePlanItem {
    familyId: string;
    familyLabel: string;
    sourceId: string;
    publisher: string;
    adapter: SourceAdapterKind | 'missing';
    sourceStatus: SourceRunStatus | 'missing';
    runStatus: string;
    runRecords: number;
    cloudflareSnapshot: boolean;
    action: string;
    status: 'ready' | 'blocked';
    next: string;
    url: string;
    fetchUrls?: string[];
    rightsNote: string;
}

export interface CloudflareSourceRunEvidence {
  generatedAt: string;
  policy: {
    source: string;
    database: string;
    binding: string;
    localScrawl: 'blocked';
    rawSnapshotsCommitted: false;
    rawPageContentCommitted: false;
  };
  stats: {
    sourceRunsRead: number;
    cloudflareSourceRuns: number;
    uniqueSources: number;
    fetched: number;
    cloudflareSnapshots: number;
    readyTasks: number;
    readyTasksWithCloudflareEvidence: number;
    readyMemberGaps: number;
    readyMemberGapsWithCloudflareEvidence: number;
  };
  readyTaskEvidence: Array<{
    sourceId: string;
    present: boolean;
    status: string;
    cloudflareSnapshot: boolean;
  }>;
  readyMemberGapEvidence: Array<{
    sourceId: string;
    familyId: string;
    terminalFamilyBlocked: boolean;
    present: boolean;
    status: string;
    cloudflareSnapshot: boolean;
  }>;
  sources: Array<{
    sourceId: string;
    publisher: string;
    url: string;
    adapter: string;
    status: string;
    runId: string;
    generatedAt: string;
    cloudflareSnapshot: boolean;
    httpStatus: number | null;
    bytes: number;
    sha256: string | null;
    records?: number;
    airportCodeCount?: number;
    loungeLinkCount?: number;
  }>;
}

export interface NonPriorityValidationReport {
  generatedAt: string;
  policy: {
    approvalRule: string;
    reviewRule: string;
    lineReviewRule: string;
  };
  stats: {
    total: number;
    byStatus: Record<string, number>;
    byDecision: Record<string, number>;
    byReviewQueue: Record<string, number>;
    byConflict: Record<string, number>;
    bySourceDecision: Array<{
      sourceId: string;
      publisher: string;
      total: number;
      approved: number;
      review: number;
      publishable: number;
      manualReview: number;
    }>;
    unmatched: number;
  };
  rows: Array<{
    recordId: string;
    sourceId: string;
    publisher: string;
    name: string;
    airportCode: string;
    airportName: string;
    city: string;
    country: string;
    terminal: string;
    sourceUrl: string;
    validationStatus: string;
    reviewStatus: 'approved' | 'review';
    confidence: number;
    conflicts: string[];
    reviewAction: {
      queue: string;
      action: 'publish' | 'manual_review';
      reason: string;
    };
  }>;
}

export type SheetSnap = 'peek' | 'mid' | 'full';

export type MobileSheetMode = 'results' | 'filters' | 'details' | 'compare' | 'review' | 'intake';

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
