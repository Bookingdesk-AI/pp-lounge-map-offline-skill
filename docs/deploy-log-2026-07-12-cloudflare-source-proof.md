# Cloudflare Source Proof Repair

Date: 2026-07-12

## Change

- Rotated `LOUNGE_GURU_INTAKE_TOKEN` through Wrangler OAuth without printing the token.
- Ran Cloudflare-only source intake for `loungekey`, `plaza-premium`, `united`, and `american`.
- Rebuilt canonical public reports from the latest Cloudflare D1 source-run evidence.
- Updated coverage reporting so robots-skipped lanes route to rights review instead of repeat fetch repair.

## Result

- Source proof is `11/15`.
- Missing proof lanes: `loungekey`, `united`, `american`, `plaza-premium`.
- Fetch-repair lanes: `united`, `american`.
- Rights-review lanes: `loungekey`, `plaza-premium`, `nominatim`.

## Source Evidence

- `loungekey`: skipped by robots policy.
- `plaza-premium`: skipped by robots policy.
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
