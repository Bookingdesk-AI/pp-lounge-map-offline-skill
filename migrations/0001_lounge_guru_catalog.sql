CREATE TABLE IF NOT EXISTS coverage_goals (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'complete', 'retired')),
  target_scope TEXT NOT NULL,
  target_approved_records INTEGER NOT NULL,
  target_approved_ratio REAL NOT NULL,
  target_source_family_ratio REAL NOT NULL,
  max_unknown_airport_records INTEGER NOT NULL,
  max_records_without_sources INTEGER NOT NULL,
  max_records_without_quality INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS catalog_runs (
  id TEXT PRIMARY KEY,
  generated_at TEXT NOT NULL,
  catalog_hash TEXT NOT NULL,
  total_records INTEGER NOT NULL,
  approved_records INTEGER NOT NULL,
  review_records INTEGER NOT NULL,
  candidate_records INTEGER NOT NULL,
  non_priority_records INTEGER NOT NULL,
  unique_airports INTEGER NOT NULL,
  unique_countries INTEGER NOT NULL,
  source_families_json TEXT NOT NULL,
  quality_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lounge_records (
  id TEXT PRIMARY KEY,
  catalog_run_id TEXT NOT NULL,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  operator TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL,
  airport_iata TEXT NOT NULL,
  airport_name TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  terminal TEXT NOT NULL,
  review_status TEXT NOT NULL,
  completeness INTEGER NOT NULL,
  freshness INTEGER NOT NULL,
  source_count INTEGER NOT NULL,
  programs_json TEXT NOT NULL,
  access_methods_json TEXT NOT NULL,
  conflicts_json TEXT NOT NULL,
  canonical_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (catalog_run_id) REFERENCES catalog_runs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lounge_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lounge_id TEXT NOT NULL,
  catalog_run_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  publisher TEXT NOT NULL,
  url TEXT NOT NULL,
  retrieved_at TEXT NOT NULL,
  confidence REAL NOT NULL,
  field_coverage_json TEXT NOT NULL,
  rights_note TEXT NOT NULL,
  FOREIGN KEY (lounge_id) REFERENCES lounge_records(id) ON DELETE CASCADE,
  FOREIGN KEY (catalog_run_id) REFERENCES catalog_runs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS source_runs (
  id TEXT PRIMARY KEY,
  generated_at TEXT NOT NULL,
  policy_json TEXT NOT NULL,
  stats_json TEXT NOT NULL,
  sources_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS coverage_validation_runs (
  id TEXT PRIMARY KEY,
  coverage_goal_id TEXT NOT NULL,
  catalog_run_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed')),
  summary_json TEXT NOT NULL,
  blockers_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (coverage_goal_id) REFERENCES coverage_goals(id),
  FOREIGN KEY (catalog_run_id) REFERENCES catalog_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_lounge_records_catalog_run_id ON lounge_records(catalog_run_id);
CREATE INDEX IF NOT EXISTS idx_lounge_records_airport_iata ON lounge_records(airport_iata);
CREATE INDEX IF NOT EXISTS idx_lounge_records_country_city ON lounge_records(country, city);
CREATE INDEX IF NOT EXISTS idx_lounge_records_review_status ON lounge_records(review_status);
CREATE INDEX IF NOT EXISTS idx_lounge_sources_source_id ON lounge_sources(source_id);
CREATE INDEX IF NOT EXISTS idx_validation_runs_goal_created ON coverage_validation_runs(coverage_goal_id, created_at DESC);
