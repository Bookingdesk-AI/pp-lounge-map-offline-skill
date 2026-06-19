# Frontend UI Refresh

This update turns the lounge map into a compact internal operations console for finding, filtering, inspecting, and comparing lounge records across the global catalog.

## What Changed

- Replaced the traveler-facing visual tone with a light, data-dense enterprise interface.
- Removed hero, subtitle, intro, marketing, and helper copy from the app surface.
- Kept the first screen as the working app: search, filters, results, compare, map, and details.
- Added concise catalog status in the header: records, airports, countries, and data date.
- Bounded schedule and condition text so source workbook notes do not dominate result or detail views.
- Kept the source link available for full external record review.
- Preserved desktop workflow: left rail for results, filters, compare; map and detail overlay on the right.
- Preserved mobile workflow: bottom sheet with `Results`, `Filters`, `Details`, and `Compare`.
- Reordered filters so country and city lead the rail before brand, type, and facilities.
- Added a lounge brand filter with matching URL state and mobile sheet parity.
- Added country prefixes in geographic labels, with Taiwan rendered as `TW` instead of a flag emoji.
- Improved mobile results with direct search, sturdier touch targets, adaptive sheet actions, selected-lounge-first details, and first-class compare access.
- Updated map tiles, markers, clusters, and focus states to match the enterprise console palette.
- Added persistent design context in `.impeccable.md`.

## Copy Audit

Kept copy is limited to functional text:

- App title and catalog status.
- Control labels and filter values.
- Sort options.
- Buttons and links.
- Empty, loading, and error states.
- Map status.
- Data values from the lounge catalog.

Removed or suppressed copy:

- Landing-page language.
- Explanatory helper text.
- Traveler-facing comparison copy.
- Source workbook notes in schedule previews.
- Long legal/source condition text in compact views.

## Verification

- `npm run lint`
- `npx tsc -b`
- `npx vite build`
- `npm run test`
- Browser verification at desktop width.
- Browser verification at mobile width.
- Runtime copy scan for landing/helper copy.

## Deploy Note

This UI-only deploy can use the current checked-in public data and run `npm run deploy:web` after `npx vite build`.

The full `npm run deploy` path still starts with `npm run release:prepare`, which downloads and rebuilds the source workbook pipeline. The currently cached workbook only exposes `Sheet1`, while `scripts/build-lounge-data.mjs` expects `pp_lounges-2` and `airports (1)`. Do not use the full release-prep deploy path until the source workbook schema or data builder fallback is reconciled.
