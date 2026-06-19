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
  '2026-06-18',
  'Worldwide lounge coverage in Cloudflare D1',
  'active',
  'all_known_public_and_licensed_airport_lounges_worldwide',
  3800,
  0.98,
  1.0,
  0,
  0,
  0,
  '{"terminalCommand":"npm run goal:coverage","progressCommand":"npm run validate:coverage","guardrail":"official/public source intake plus licensed providers only","requiredFamilies":["licensed-global-baseline","collinson-networks","bank-issuer-programs","card-network-programs","airline-alliance-lounges","airline-operated-lounges","operator-operated-lounges","open-enrichment"]}',
  CURRENT_TIMESTAMP
);
