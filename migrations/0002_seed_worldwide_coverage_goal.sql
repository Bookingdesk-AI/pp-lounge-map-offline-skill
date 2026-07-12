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
  '2026-07-11',
  'Worldwide lounge coverage in Cloudflare D1',
  'active',
  'all_known_official_public_airport_lounges_worldwide',
  2500,
  0.98,
  1.0,
  0,
  0,
  0,
  '{"terminalCommand":"npm run goal:coverage","progressCommand":"npm run validate:coverage","guardrail":"official/public Playwright source intake only; no licensed or commercial global lounge source; target counts deduped physical lounge records","requiredFamilies":["collinson-networks","bank-issuer-programs","airline-alliance-lounges","airline-operated-lounges","operator-operated-lounges","open-enrichment"]}',
  CURRENT_TIMESTAMP
);
