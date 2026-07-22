# Social Preview Metadata and Logo Smoke

Date: 2026-07-22

## Scope

- Pointed canonical, Open Graph, and X Card metadata at `https://loungeguru.desk.travel/`.
- Replaced the stale preview artwork with a real 1200 x 630 Lounge Guru screenshot.
- Added image type, dimensions, locale, site name, and accessible image descriptions.
- Allowed large search-result image previews with `max-image-preview:large`.
- Hardened UI smoke checks so a logo passes only after the image finishes loading with nonzero pixels.

## References

- Open Graph protocol: <https://ogp.me/>
- X Cards: <https://developer.x.com/en/docs/x-for-websites/cards/guides/getting-started>
- Google meta descriptions: <https://developers.google.com/search/docs/appearance/snippet>
- Google robots meta tags: <https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag>

References checked on 2026-07-22.

## Verification

- `npm test`: 363 passed.
- `npm run lint -- --quiet`: passed.
- `npx tsc -b`: passed.
- `npx vite build`: passed.
- `npm run validate:browser-boundary`: passed with 3,080 public records.
- Production Cathay logo smoke passed on desktop and mobile against `https://loungeguru.desk.travel`.

## Deploy Target

- Product: Cloudflare Pages.
- Project: `loungeguru-desk-travel`.
- Production branch: `main`.
- Production URL: `https://loungeguru.desk.travel`.
- Trusted fallback: `https://loungeguru-desk-travel.pages.dev`.
- Worker and D1: unchanged.
