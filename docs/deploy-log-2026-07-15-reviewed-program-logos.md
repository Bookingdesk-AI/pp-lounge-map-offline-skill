# Reviewed Program Logos

Date: 2026-07-15

## Scope

- Replaced generated placeholder marks for reviewed lounge programs and card issuers with same-origin reviewed logo assets.
- Kept airline logos on the centralized Desk.Travel/all-routes library.
- Kept alliance logos on the all-routes artwork contract with same-origin fallbacks for resilience.

## Reviewed Assets

| Brand | Runtime asset | Source |
| --- | --- | --- |
| Priority Pass | `/data/brand-logos/priority-pass-reviewed.svg` | Wikimedia public SVG copy of Priority Pass logo |
| Chase Sapphire Lounge | `/data/brand-logos/chase-sapphire-lounge-reviewed.png` | Public Chase Sapphire Lounge artwork supplied for review |
| Centurion Lounge | `/data/brand-logos/centurion-lounge-reviewed.png` | Public Centurion Lounge artwork supplied for review |
| Capital One Travel | `/data/brand-logos/capital-one-travel-reviewed.svg` | Capital One Travel public page asset |
| LoungeKey | `/data/brand-logos/loungekey-reviewed.png` | LoungeKey public portal asset |
| Plaza Premium Lounge | `/data/brand-logos/plaza-premium-reviewed.png` | Plaza Premium public site asset |

## Contract

- Runtime does not hotlink these external assets.
- `scripts/lib/brand-registry.mjs` stores same-origin `logoUrl` plus `upstreamLogoUrl` provenance.
- `scripts/build-canonical-data.mjs` copies reviewed assets from `assets/brand-logos/reviewed` into `public/data/brand-logos`.
- `tests/brand-registry.test.mjs` pins asset routing, source URLs, and SHA-256 checksums.

## Verification

- `node --test tests/brand-registry.test.mjs tests/ui-smoke.test.mjs tests/mobile-detail-ui.test.mjs`
- `npm run validate:json`
- `npm run goal:coverage`
- Local UI smoke on `http://127.0.0.1:4195`:
  - Chase Sapphire Lounge: `chase-sapphire-lounge-reviewed.png`
  - Priority Pass: `priority-pass-reviewed.svg`
  - Plaza Premium Lounge: `plaza-premium-reviewed.png`
  - Capital One Travel: `capital-one-travel-reviewed.svg`
