# 2026-06-28 Mobile Production Closeout

## Scope

- Verified production mobile map workflow after the compact sheet redesign.
- Rebuilt and redeployed the current Pages bundle for review.
- Added compact source IDs to mobile Review queue rows.
- Added compact source confidence and retrieval-date badges to mobile Review queue rows.
- Added Cloudflare intake preflight commands to the coverage gap report.
- Added compact Cloudflare intake preflight status to mobile Review Sources.
- Added compact source and quality badges to mobile Details.
- Added Cloudflare token, lane, and report command lines to coverage validation output.
- Added mobile copy actions for Cloudflare probe, report, and promote commands.
- Preserved unrelated dirty script changes outside this closeout.

## Verification

- `npm run lint`
- `npx tsc -b`
- `npm run test` (`71/71`)
- `npm run validate:json`
- `npm run validate:coverage` (`Source proof: 3/16`)
- `npx vite build`
- Live mobile viewport check at `390x844`
- Live tablet viewport check at `768x1024`
- Live desktop viewport check at `1440x900`
- Local mobile Review check at `390x844`: `Proof 3/16`
- Local mobile Review queue check: airport, completeness, and source ID badges
- Local mobile Review queue check: source confidence and retrieval-date badges
- Coverage report check: Cloudflare token, probe, report, promote, rebuild, D1 push, and validation commands
- Local mobile Sources check: token, ready, credential, rights, and report state
- Local mobile Details check: source ID, confidence, retrieved date, completeness, and review status
- Coverage validation check: terminal output names token, lane counts, and report command
- Local mobile Sources check: probe, report, and promote command actions

## Deploy

- Pages project: `uscf-pps-worker`
- Production URL: `https://loungeguru.desk.travel`
- Preview URL: `https://f56373a6.uscf-pps-worker.pages.dev`
- Production smoke: `2644` records, admin report guarded by `403`
- Preview smoke: `2644` records, admin report uses static fallback
- App proof commit: `d7e84cc`

## Known Data Blockers

- Approved records below terminal target.
- Approved ratio below terminal target.
- Source family coverage incomplete.
- Review records still present.
- Source intake runtime still reports the legacy pre-Cloudflare guardrail marker.
