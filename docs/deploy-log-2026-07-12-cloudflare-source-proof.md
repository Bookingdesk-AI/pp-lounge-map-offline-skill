# Cloudflare Source Proof Repair

Date: 2026-07-12

## Change

- Rotated `LOUNGE_GURU_INTAKE_TOKEN` through Wrangler OAuth without printing the token.
- Ran Cloudflare-only source intake for `loungekey`, `plaza-premium`, `united`, and `american`.
- Rebuilt canonical public reports from the latest Cloudflare D1 source-run evidence.
- Updated coverage reporting so robots-skipped lanes route to rights review instead of repeat fetch repair.

## Result

- Source proof is `11/13`.
- Missing proof lanes: `united`, `american`.
- Fetch-repair lanes: `united`, `american`.
- Rights-review lanes: `nominatim`.

## Source Evidence

- `united`: Cloudflare fetch returned HTTP `520` across official United URLs.
- `american`: Cloudflare fetch returned HTTP `403` across official American Airlines URLs.

## Verification

- `npm run test -- tests/worldwide-coverage-goal.test.mjs tests/cloudflare-source-run-evidence.test.mjs tests/source-intake-worker.test.mjs`
- `npm run validate:json`
- `npm run validate:coverage`
- `npm run lint`
- `npx tsc -b`
- `npx vite build`

## Current Block

Terminal coverage remains blocked by `cloudflare_source_proof_incomplete`.
