INSERT OR REPLACE INTO coverage_goals (
  id,
  version,
  title,
  status,
  target_scope,
  target_approved_records,
  target_approved_ratio,
  target_source_family_ratio,
  max_unknown_airport_records,
  max_records_without_sources,
  max_records_without_quality,
  notes_json,
  updated_at
) VALUES (
  'lounge-guru-worldwide-coverage',
  '2026-07-16',
  'Worldwide lounge coverage in Cloudflare D1',
  'active',
  'all_known_official_public_airport_lounges_worldwide',
  3000,
  0.98,
  1.0,
  0,
  0,
  0,
  '{"terminalCommand":"npm run goal:coverage","progressCommand":"npm run validate:coverage","guardrail":"official/public Playwright source intake only; no licensed or commercial global lounge source; target counts deduped physical lounge records","maxCoverageTargets":{"minApprovedRecords":3000,"minNonPriorityRecords":1300,"minHoursCoverageRatio":0.99,"minGateCoverageRatio":0.6,"minPriceCoverageRatio":0.4,"maxStaleOpenReviewRecords":0},"reviewQueue":{"staleOpenHighConfidenceDays":14,"highConfidenceThreshold":0.75},"d1SmokeQueries":{"fieldCoverage":"SELECT COUNT(*) AS total, SUM(has_hours) AS hours, SUM(has_gate) AS gates, SUM(has_price) AS prices FROM lounge_field_coverage;","openReviewQueue":"SELECT COUNT(*) AS open_review_records FROM review_queue WHERE status = ''open'';","staleReviewQueue":"SELECT COUNT(*) AS stale_open_high_confidence FROM review_queue WHERE status = ''open'' AND severity = ''high'' AND datetime(opened_at) <= datetime(''now'', ''-14 days'');","provenance":"SELECT COUNT(*) AS records_missing_provenance FROM lounge_records WHERE source_count = 0 OR canonical_json IS NULL OR canonical_json = '''';"},"requiredFamilies":["collinson-networks","bank-issuer-programs","airline-alliance-lounges","airline-operated-lounges","operator-operated-lounges","open-enrichment"]}',
  CURRENT_TIMESTAMP
);
