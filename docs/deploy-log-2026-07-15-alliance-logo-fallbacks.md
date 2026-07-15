# Alliance Logo Fallbacks

Date: 2026-07-15

## Change

- Fixed alliance result-card marks falling back to `OW` and `SA` initials.
- Kept upstream all-routes alliance logo URLs as provenance metadata.
- Rendered alliance marks from same-origin copies of the exact all-routes artwork.
- Added checksum tests for `oneworld`, `Star Alliance`, and `SkyTeam` logo files.
- Updated the public logo validator to allow reviewed PNG logo assets.

## Root Cause

- `all-routes.desk.travel` and `src.desk.travel` alliance logo requests returned Cloudflare `403` challenges with cross-origin response blocking.
- Browser image loading left the remote `<img>` blocked before React could reliably advance to a fallback.

## Verification

- `node --test tests/brand-registry.test.mjs tests/mobile-detail-ui.test.mjs`
- `npm run validate:json`
- `npm run lint`
- `npx tsc -b`
- `npx vite build`
- `npm run test`
- Local browser check: `oneworld` and `Star Alliance` cards rendered `/data/brand-logos/*-all-routes.*` images with nonzero dimensions and no initials.
