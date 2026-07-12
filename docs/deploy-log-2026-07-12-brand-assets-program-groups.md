# Brand Assets And Program Groups

Date: 2026-07-12

## Change

- Added Desk.Travel-managed SVG assets for `oneworld`, `Star Alliance`, and `SkyTeam`.
- Grouped alliance and cabin access strings as one program family with tier tags.
- Preserved airline/operator brand priority over broad alliance source branding.
- Kept airport marker grouping with selected-airport burst points.
- Rebuilt canonical public data and brand import artifacts.

## Data

- Catalog records: `2579`
- Approved records: `2579`
- Review records: `0`
- Non-PP records: `878`
- Source proof: `11/13`

## Verification

- `npm run test`
- `npm run lint`
- `npx tsc -b`
- `npx vite build`
- `npm run validate:json`
- `npm run validate:coverage`
- `npm run smoke:ui -- --base-url=http://127.0.0.1:4193 --selected=candidate-oneworld-cvg-1728 --timeout-ms=30000`
- Desktop render check: `1365x860`, no overflow, no forbidden copy, `oneworld.svg` visible.
- Mobile render check: `390x844`, no overflow, no forbidden copy, `oneworld.svg` visible.

## Current Block

- Terminal worldwide coverage remains blocked by `cloudflare_source_proof_incomplete`.
- Missing source proof lanes: `united`, `american`.
