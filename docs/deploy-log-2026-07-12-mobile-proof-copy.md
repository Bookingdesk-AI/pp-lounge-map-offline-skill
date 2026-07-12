# Mobile Review Copy Cleanup

Date: 2026-07-12

## Change

- Removed `Proof` counters from the mobile review metrics.
- Replaced the source-lane `No proof` label with `Missing`.
- Kept Cloudflare source evidence and source-gap workflows available in the review sheet.

## Verification

- `npm run test -- tests/mobile-review-ui.test.mjs tests/desktop-map-ui.test.mjs tests/ui-smoke.test.mjs tests/worldwide-coverage-goal.test.mjs`
- `npm run lint`
- `npx tsc -b`
- `npx vite build`
- `npm run validate:coverage`

## Current Block

- Terminal coverage remains blocked by `cloudflare_source_proof_incomplete`.
- Missing source proof lanes: `united`, `american`.
- Local `LOUNGE_GURU_INTAKE_TOKEN` was not present, so Cloudflare-only intake repair was not run.
