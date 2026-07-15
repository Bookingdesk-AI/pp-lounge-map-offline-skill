# Centralized Brand Logos

Date: 2026-07-15

## Change

- Switched airline logo primaries to the all-routes centralized `src.desk.travel/brand-logos/airlines/*` library.
- Switched airline backups to centralized transparent `src.desk.travel/brand-logos/airlines-transparent/*` assets.
- Switched alliance logo primaries to `all-routes.desk.travel/brand-logos/alliances/*`.
- Switched alliance backups to centralized `src.desk.travel/brand-logos/alliances/*` R2 assets.
- Removed generated local airline and alliance SVG tiles from the production fallback path.
- Rebuilt canonical catalog, MCP catalog, brand import, quality report, and offline skill assets.

## Data

- Catalog records: `3227`
- Approved records: `3227`
- Review records: `0`
- Non-PP records: `1869`
- Source proof: `5/5`
- Field coverage: hours `97.06%`, gate `46.20%`, price `27.21%`

## Verification

- `npm run build:canonical-data`
- `npm run build:mcp-data`
- `npm run build:offline-skill`
- `node --test tests/brand-registry.test.mjs tests/mobile-detail-ui.test.mjs`
- `npm run validate:json`
- `npm run goal:coverage`
- `npm run lint`
- `npx tsc -b`
- `npx vite build`
- `npm run test`

## Deploy Target

- D1: `lounge-guru-catalog`
- Worker: `lounge-guru-mcp`
- Pages: `uscf-pps-worker`
- Production URL: `https://loungeguru.desk.travel`
