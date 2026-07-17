# Lounge Guru Browser Security Review

Date: July 17, 2026

## Executive Summary

Production previously copied about 40 MB of internal data into the public build and loaded nine JSON files on every visit. The new production boundary ships one sanitized lounge payload, approved display assets, self-hosted fonts, and security headers. The React layout and CSS layout rules were not changed.

Measured production impact:

- Browser data requests: 9 to 1.
- Initial JSON transfer: 3,256,766 bytes to 516,048 bytes in local Vite preview, an 84.2% reduction.
- Production artifact: about 42 MB to 6.3 MB, an 85% reduction.
- Public lounge coverage: 3,065 of 3,065 canonical records.
- Google Fonts requests: removed.
- Public source maps: none.

## High Severity

### SEC-001: Internal catalog and intake artifacts were publicly deployable

Status: Fixed.

Location: `vite.config.ts:12-50`, `scripts/validate-browser-boundary.mjs:13-24`, `scripts/validate-browser-boundary.mjs:106-118`.

Evidence: Vite previously copied all of `public/`, including the canonical catalog, source reports, validation queues, coverage plans, and airport authority data. The build now disables automatic public-directory copying and uses an explicit production allowlist.

Impact: Any visitor could download internal source evidence, review state, operational metadata, and data that the map did not need.

Fix: The production build now includes only `lounge-map.json`, approved logo assets, fonts, icons, social preview assets, redirects, and headers. A build gate rejects internal files and source maps in `dist`.

### SEC-002: A credential-like query parameter existed in a generated source report

Status: Fixed. Credential value intentionally omitted.

Location: `shared/security-redaction.js:3-42`, `shared/security-redaction.js:57-97`, `scripts/scrape-source-snapshots.mjs:3170-3175`, `scripts/promote-cloudflare-source-intake-report.mjs:122-133`.

Evidence: The bounded audit found a third-party application-key query parameter in `public/data/source-intake-report.json`.

Impact: A generated report could disclose a credential-like value through repository access, local development serving, or an incorrectly configured deployment.

Fix: The current report was sanitized. Source-snapshot and Cloudflare-promotion writers now remove credential query parameters and redact GDS/security fields before persistence. The report is also excluded from production builds.

## Medium Severity

### SEC-003: Production loaded admin data despite hiding admin views

Status: Fixed.

Location: `src/App.tsx:3829-3857`, `scripts/build-public-map-data.mjs:14-138`.

Evidence: Production previously requested GeoJSON, metadata, the full canonical catalog, source and brand registries, coverage gaps, intake plans, Cloudflare evidence, and non-Priority Pass validation.

Impact: Excessive transfer, parsing, memory use, and exposure of operational data.

Fix: Production now loads only `/data/lounge-map.json`. Development retains the existing admin-file workflow. The payload is field-whitelisted and contains no notes, guest policies, access-offer internals, rights notes, field-coverage arrays, raw evidence, D1 state, commands, or hashes.

### SEC-004: Intake responses and D1 evidence lacked generic redaction

Status: Fixed.

Location: `mcp/source-intake.js:77-86`, `mcp/source-intake.js:510-524`, `shared/security-redaction.js:99-125`.

Evidence: Intake response objects and persisted source-run objects were serialized directly.

Impact: A future adapter could accidentally echo a token, PCC, PNR, record locator, session identifier, credential, or signed URL.

Fix: Worker JSON responses and source-run persistence now pass through recursive key redaction and URL-query sanitization. Responses also use `no-store` and `nosniff`.

### SEC-005: Browser security headers were not defined in the static application

Status: Fixed.

Location: `public/_headers:1-24`.

Evidence: No repository-controlled CSP, clickjacking policy, MIME protection, referrer policy, permissions policy, or cache partitioning was present for the Pages build.

Impact: Reduced browser defense in depth and uncontrolled caching of mutable catalog data.

Fix: Added CSP, frame blocking, `nosniff`, `no-referrer`, permissions restrictions, opener/resource policies, immutable asset caching, short catalog caching, and no-store HTML. HSTS was intentionally not added.

## Low Severity

### SEC-006: Typography required a third-party request

Status: Fixed.

Location: `src/index.css:1-89`, `public/fonts/`.

Evidence: CSS imported IBM Plex from Google Fonts on every uncached visit.

Impact: Additional third-party request, availability dependency, and origin disclosure.

Fix: The same IBM Plex Sans and Mono assets are now self-hosted with their license. Font families, weights, layout, and visual design remain unchanged.

### SEC-007: Centralized airline logo host is currently Cloudflare-challenged

Status: Open operational issue; no sensitive data exposure observed.

Evidence: The local browser audit received Cloudflare challenge/CORP failures from `src.desk.travel` for some centralized airline logos. Existing text/local fallbacks prevent application failure.

Impact: Failed image requests and missing airline marks when the centralized host challenges the browser.

Required operational fix: Correct the `src.desk.travel` Cloudflare allow/skip rule for `/brand-logos/` or expose the same centralized assets through a same-origin Desk.Travel asset route. The new production `Referrer-Policy: no-referrer` prevents Lounge Guru URL disclosure on these requests.

## Verification

- `npm run lint`: passed.
- `npx tsc -b`: passed.
- Focused security, intake Worker, and deploy-smoke tests: 17 passed.
- `npx vite build`: passed.
- `npm run validate:browser-boundary`: passed with 3,065 public records and no disallowed production data files.
- Wrangler Worker dry-run bundle: passed.
- Desktop production preview: one lounge payload request; no admin JSON requests.
- Mobile production preview: layout and workflows retained.
- Full suite: 333 passed, 8 failed in pre-existing dirty coverage/catalog fixtures. Failures cover stale airport counts, duplicate Chase source provenance, stale MCP metadata, D1 snapshot expectations, and source-intake coverage/location expectations; they are outside this browser-security change.
