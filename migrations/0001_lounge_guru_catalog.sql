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

CREATE TABLE IF NOT EXISTS lounge_field_coverage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lounge_id TEXT NOT NULL,
  catalog_run_id TEXT NOT NULL,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  airport_iata TEXT NOT NULL,
  airport_name TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  source_id TEXT NOT NULL,
  publisher TEXT NOT NULL,
  source_url TEXT NOT NULL,
  retrieved_at TEXT NOT NULL,
  review_status TEXT NOT NULL,
  has_hours INTEGER NOT NULL CHECK (has_hours IN (0, 1)),
  has_gate INTEGER NOT NULL CHECK (has_gate IN (0, 1)),
  has_price INTEGER NOT NULL CHECK (has_price IN (0, 1)),
  hours_text TEXT NOT NULL,
  gate_text TEXT NOT NULL,
  price_offers_json TEXT NOT NULL,
  field_coverage_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
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

CREATE TABLE IF NOT EXISTS source_targets (
  id TEXT PRIMARY KEY,
  publisher TEXT NOT NULL,
  adapter TEXT NOT NULL,
  status TEXT NOT NULL,
  url TEXT NOT NULL,
  freshness_days INTEGER NOT NULL,
  required_for_terminal INTEGER NOT NULL CHECK (required_for_terminal IN (0, 1)),
  source_family_ids_json TEXT NOT NULL,
  rights_note TEXT NOT NULL,
  target_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS airport_authority (
  iata TEXT PRIMARY KEY,
  icao TEXT NOT NULL,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  country_code TEXT NOT NULL,
  timezone TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  source_id TEXT NOT NULL,
  source_airport_id TEXT NOT NULL,
  authority_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS source_fetch_runs (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  runtime TEXT NOT NULL,
  fetch_mode TEXT NOT NULL,
  status TEXT NOT NULL,
  url TEXT NOT NULL,
  final_url TEXT NOT NULL,
  http_status INTEGER,
  content_type TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  records INTEGER NOT NULL,
  airport_code_count INTEGER NOT NULL,
  lounge_link_count INTEGER NOT NULL,
  cloudflare_snapshot INTEGER NOT NULL CHECK (cloudflare_snapshot IN (0, 1)),
  reason TEXT NOT NULL,
  attempts_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES source_targets(id)
);

CREATE TABLE IF NOT EXISTS source_snapshots (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  snapshot_uri TEXT NOT NULL,
  url TEXT NOT NULL,
  final_url TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  retrieved_at TEXT NOT NULL,
  storage TEXT NOT NULL,
  raw_content_committed INTEGER NOT NULL CHECK (raw_content_committed IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES source_targets(id)
);

CREATE TABLE IF NOT EXISTS source_parse_runs (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  parser_version TEXT NOT NULL,
  status TEXT NOT NULL,
  extracted_records INTEGER NOT NULL,
  rejected_records INTEGER NOT NULL,
  airport_codes_json TEXT NOT NULL,
  lounge_links_json TEXT NOT NULL,
  structured_records_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES source_targets(id)
);

CREATE TABLE IF NOT EXISTS source_candidates (
  id TEXT PRIMARY KEY,
  catalog_run_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  canonical_lounge_id TEXT,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  airport_iata TEXT NOT NULL,
  airport_name TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  status TEXT NOT NULL,
  review_status TEXT NOT NULL,
  completeness INTEGER NOT NULL,
  confidence REAL NOT NULL,
  candidate_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (catalog_run_id) REFERENCES catalog_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (canonical_lounge_id) REFERENCES lounge_records(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS lounge_identity_links (
  id TEXT PRIMARY KEY,
  catalog_run_id TEXT NOT NULL,
  canonical_lounge_id TEXT NOT NULL,
  linked_lounge_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  match_reason TEXT NOT NULL,
  confidence REAL NOT NULL,
  conflict_count INTEGER NOT NULL,
  evidence_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (catalog_run_id) REFERENCES catalog_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (canonical_lounge_id) REFERENCES lounge_records(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS record_field_evidence (
  id TEXT PRIMARY KEY,
  catalog_run_id TEXT NOT NULL,
  lounge_id TEXT NOT NULL,
  field_group TEXT NOT NULL,
  field_name TEXT NOT NULL,
  field_path TEXT NOT NULL,
  has_value INTEGER NOT NULL CHECK (has_value IN (0, 1)),
  value_text TEXT NOT NULL,
  source_id TEXT NOT NULL,
  publisher TEXT NOT NULL,
  source_url TEXT NOT NULL,
  confidence REAL NOT NULL,
  retrieved_at TEXT NOT NULL,
  missing_reason TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (catalog_run_id) REFERENCES catalog_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (lounge_id) REFERENCES lounge_records(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS review_queue (
  id TEXT PRIMARY KEY,
  catalog_run_id TEXT NOT NULL,
  lounge_id TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  field_path TEXT NOT NULL,
  status TEXT NOT NULL,
  severity TEXT NOT NULL,
  source_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  resolved_at TEXT,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (catalog_run_id) REFERENCES catalog_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (lounge_id) REFERENCES lounge_records(id) ON DELETE CASCADE
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
CREATE INDEX IF NOT EXISTS idx_lounge_field_coverage_catalog_run_id ON lounge_field_coverage(catalog_run_id);
CREATE INDEX IF NOT EXISTS idx_lounge_field_coverage_airport_iata ON lounge_field_coverage(airport_iata);
CREATE INDEX IF NOT EXISTS idx_lounge_field_coverage_source_id ON lounge_field_coverage(source_id);
CREATE INDEX IF NOT EXISTS idx_lounge_field_coverage_fields ON lounge_field_coverage(has_hours, has_gate, has_price);
CREATE INDEX IF NOT EXISTS idx_airport_authority_country_city ON airport_authority(country, city);
CREATE INDEX IF NOT EXISTS idx_airport_authority_icao ON airport_authority(icao);
CREATE INDEX IF NOT EXISTS idx_source_fetch_runs_source_status ON source_fetch_runs(source_id, status);
CREATE INDEX IF NOT EXISTS idx_source_snapshots_source_run ON source_snapshots(source_id, run_id);
CREATE INDEX IF NOT EXISTS idx_source_parse_runs_source_status ON source_parse_runs(source_id, status);
CREATE INDEX IF NOT EXISTS idx_source_candidates_source_id ON source_candidates(source_id);
CREATE INDEX IF NOT EXISTS idx_source_candidates_airport_iata ON source_candidates(airport_iata);
CREATE INDEX IF NOT EXISTS idx_identity_links_canonical_lounge_id ON lounge_identity_links(canonical_lounge_id);
CREATE INDEX IF NOT EXISTS idx_record_field_evidence_lounge_id ON record_field_evidence(lounge_id);
CREATE INDEX IF NOT EXISTS idx_record_field_evidence_field_path ON record_field_evidence(field_path);
CREATE INDEX IF NOT EXISTS idx_review_queue_status ON review_queue(status);
CREATE INDEX IF NOT EXISTS idx_review_queue_lounge_id ON review_queue(lounge_id);
CREATE INDEX IF NOT EXISTS idx_validation_runs_goal_created ON coverage_validation_runs(coverage_goal_id, created_at DESC);
