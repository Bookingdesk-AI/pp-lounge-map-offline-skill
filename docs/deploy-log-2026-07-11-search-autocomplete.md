# 2026-07-11 Search And Filter Closeout

## Scope

- Added all-routes airport autocomplete to the main search command.
- Added same-origin `/api/all-routes/airports` proxy for local Vite and Cloudflare Pages.
- Replaced native country, city, and brand selects with compact combobox controls.
- Scoped city suggestions after country selection.
- Moved type and facility filters into the filter panel.
- Removed dev-only source proof from production map filters.
- Removed the map legend/status card from production.
- Enlarged lounge markers and spider spokes.
- Added program-color marker fills, pie slices, and rainbow overflow.
- Preserved the unrelated dirty generated file under `out/`.

## Verification

- `npm run test` (`73/73`)
- `npx tsc -b`
- `npx eslint src/App.tsx src/map/cluster/LoungeClusterLayer.tsx tests/desktop-map-ui.test.mjs tests/mobile-search-ui.test.mjs vite.config.ts`
- `npx vite build`
- `git diff --check`
- Production-copy audit for forbidden UI strings
- all-routes source smoke: `HGH` returns `Hangzhou Xiaoshan International Airport` with `x-data-source: upstream`
- local proxy smoke: `/api/all-routes/airports?query=HGH&limit=5`

## Deploy

- Pages project: `uscf-pps-worker`
- Deploy command: `npm run deploy:web`
- Production URL: `https://loungeguru.desk.travel`
- Deploy status: blocked
- Blocker: `npx wrangler whoami` failed with `Invalid access token [code: 9109]`

Refresh Wrangler auth or set a valid `CLOUDFLARE_API_TOKEN`, then rerun `npm run deploy:web`.
