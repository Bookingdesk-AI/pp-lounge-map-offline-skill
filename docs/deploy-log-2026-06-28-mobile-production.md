# 2026-06-28 Mobile Production Closeout

## Scope

- Verified production mobile map workflow after the compact sheet redesign.
- Rebuilt and redeployed the current Pages bundle for review.
- Preserved unrelated dirty script changes outside this closeout.

## Verification

- `npm run lint`
- `npx tsc -b`
- `npm run test` (`67/67`)
- `npm run validate:json`
- `npm run validate:coverage` (`Source proof: 3/16`)
- `npx vite build`
- Live mobile viewport check at `390x844`
- Live tablet viewport check at `768x1024`
- Live desktop viewport check at `1440x900`
- Local mobile Review check at `390x844`: `Proof 3/16`

## Deploy

- Pages project: `uscf-pps-worker`
- Production URL: `https://loungeguru.desk.travel`
- Preview URL: `https://131a6cb3.uscf-pps-worker.pages.dev`
- Production smoke: `2644` records, admin report guarded by `403`
- Preview smoke: `2644` records, admin report uses static fallback
- Source proof commit: `d50eda7`

## Known Data Blockers

- Approved records below terminal target.
- Approved ratio below terminal target.
- Source family coverage incomplete.
- Review records still present.
- Source intake runtime still reports the legacy pre-Cloudflare guardrail marker.
