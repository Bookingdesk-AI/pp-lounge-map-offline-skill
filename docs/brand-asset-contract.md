# Brand Asset Contract

## Scope

Lounge Guru can publish brand marks for airline, issuer, card-network, program, and lounge-operator rows only through `desk.travel.brand_assets`.

## Storage

- Metadata: Cloudflare D1 table `desk.travel.brand_assets`
- Objects: Cloudflare R2
- Public origin: `https://src.desk.travel`
- Local fallback: `/data/brand-logos/{brandId}.svg`

## Required Fields

- `assetId`
- `brandId`
- `displayName`
- `category`
- `assetKind`
- `format`
- `storageKey`
- `publicUrl`
- `sourceUrl`
- `sourcePublisher`
- `rightsStatus`
- `rightsNote`
- `sha256`
- `reviewStatus`
- `retrievedAt`
- `reviewedAt`

## Source Classes

- `desk_travel_owned`: auto approve
- `official_public_brand_source`: manual review
- `approved_open_icon_repository`: manual review
- `generated_fallback_tile`: auto approve

Blocked:

- hotlinked search result
- unknown-rights SVG
- private or authenticated asset
- licensed commercial lounge inventory logo

## Workflow

1. Find source
2. Capture snapshot
3. Normalize SVG or PNG
4. Compute SHA-256
5. Store R2 object
6. Upsert D1 metadata
7. Review rights
8. Publish registry
9. Render smoke

## Display

- Result row: logo before lounge name
- Detail panel: mark before brand label
- Missing asset: generated Lounge Guru SVG tile
- Row image `alt`: empty; visible text carries the brand name

## Production Gate

- `publicUrl` is `https://src.desk.travel/*` or local fallback
- Uploaded binary assets have `sha256`
- `rightsStatus` is not `blocked`
- `reviewStatus` is `approved`
- Desktop and mobile row smoke passes
