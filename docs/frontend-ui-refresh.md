# Frontend UI Refresh

This branch refreshes the lounge map frontend around a traveler-first comparison workflow while keeping the existing data model and Leaflet map.

## What Changed

- Reworked desktop from a persistent three-column layout into a comparison-focused left rail plus map stage.
- Simplified mobile into `Results`, `Filters`, and `Details`.
- Stabilized the mobile map stage so the map no longer overflows the viewport and full-sheet panels stay below the header/search area.
- Fixed mobile deep links so `selected`, `sheet`, and `mode` URL params hydrate into the intended lounge/details view.
- Hardened the mobile sheet grab handle for touch drag gestures and restored desktop filter-label contrast.
- Added result sorting with `Best match`, `Airport code`, `Country / city`, and `Type`.
- Added a compare queue capped at 3 lounges.
- Added explicit no-results recovery actions.
- Replaced clickable result containers with semantic buttons for better keyboard access.
- Reduced decorative chrome so the result list gets more usable vertical space.

## Map Interaction Updates

- Preserved the original same-airport cluster burst behavior: clicking a cluster whose markers share one airport/coordinate opens a radial burst instead of only zooming.
- Extended that behavior so same-coordinate lounges remain individually visible when clustering disables at close zoom.
- Added a collapsible map guide panel.

## Verification

- `npm test`
- `npx tsc -b`
- `npx vite build`

## Known Caveat

The repo-wide `npm run build` command still depends on the workbook/data pipeline and currently fails before the frontend build when sheet `pp_lounges-2` is unavailable. The web app itself builds successfully with `npx vite build`.
