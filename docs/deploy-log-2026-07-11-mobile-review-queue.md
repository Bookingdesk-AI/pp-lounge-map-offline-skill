# Mobile Review Queue

Date: 2026-07-11

## Change

- Added a compact mobile Review queue row limit.
- Added a touch-safe `More` action for additional manual review rows.
- Extended UI smoke to require the mobile queue reveal action.

## Verification

- `npm run test -- tests/mobile-review-ui.test.mjs tests/ui-smoke.test.mjs`
- `npm run lint`
- `npx tsc -b`
- `npm run validate:json`
- `npm run validate:cloudflare-auth`
- `npx vite build`
- `git diff --check`
- `npm run smoke:ui -- --base-url=http://127.0.0.1:4192 --check-review-queue`

## Data State

- Catalog: `2644`
- Approved: `1795`
- Review: `849`
- Non-PP: `890`
- Source proof: `3/16`

## Blocker

- `LOUNGE_GURU_INTAKE_TOKEN` is missing.
- Cloudflare OAuth works when stale `CLOUDFLARE_API_TOKEN` is unset.
- Full Cloudflare-side intake and promotion remain blocked until the intake token is present.
