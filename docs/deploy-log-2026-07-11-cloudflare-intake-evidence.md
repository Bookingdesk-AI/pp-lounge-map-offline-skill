# Cloudflare Intake Evidence

Date: 2026-07-11

## Change

- Rotated the Worker `LOUNGE_GURU_INTAKE_TOKEN`.
- Redeployed `lounge-guru-mcp`.
- Ran Cloudflare-side intake probes for:
  - `visa-airport-companion`
  - `mastercard-travel-pass`
  - `dragonpass`
- Exported bounded D1-derived intake evidence.

## Verification

- `unset CLOUDFLARE_API_TOKEN; npx wrangler whoami`
- `unset CLOUDFLARE_API_TOKEN; npm run deploy:mcp`
- `LOUNGE_GURU_INTAKE_TOKEN=<redacted> node scripts/run-cloudflare-source-intake.mjs --source-ids=visa-airport-companion,mastercard-travel-pass,dragonpass`
- `LOUNGE_GURU_INTAKE_TOKEN=<redacted> npm run intake:cloudflare:report:export`
- `unset CLOUDFLARE_API_TOKEN; npm run intake:evidence`
- `npm run build:canonical-data`
- `npm run validate:json`
- `npm run validate:cloudflare-auth`

## Result

- Cloudflare source runs read: `7`
- Unique Cloudflare evidence sources: `3`
- Fetched sources: `3`
- Raw page content committed: `false`

## Blocker

- The exported report is not promotable to the canonical source report.
- Full catalog intake remains blocked because the report covers `3` sources, below the promotable thresholds.

## UI Evidence Surface

Date: 2026-07-11

### Change

- Added compact Cloudflare signal counts to Intake and mobile review.
- Added per-source airport/link counts without exposing raw page content.
- Kept production copy to labels only: `CF evidence`, `Signals`, `Airports`, `Links`, `HTTP`.

### Verification

- `npm run test -- tests/mobile-review-ui.test.mjs tests/ui-smoke.test.mjs tests/source-intake-worker.test.mjs tests/cloudflare-source-run-evidence.test.mjs`
- `npm run lint`
- `npx tsc -b`
- `npm run validate:json`
- `env -u CLOUDFLARE_API_TOKEN npm run validate:cloudflare-auth`
- `npx vite build`
- `npm run validate:coverage`

### Data State

- Catalog: `2644`
- Approved: `1795`
- Review: `849`
- Non-PP: `890`
- Source proof: `11/16`
- Cloudflare lanes: `ready 16`, `access 5`, `cred 3`, `rights 3`

### Blocker

- Terminal coverage remains blocked by approval count, approval ratio, incomplete source-family coverage, open review records, and non-promotable source intake runtime.

## Bounded Multi-URL Source Evidence

Date: 2026-07-11

### Change

- Aggregated bounded evidence across up to eight official URLs per source.
- Added official AA, United, and SkyTeam seed URLs for blocked index pages.
- Kept raw page bodies out of D1, git, and public reports.

### Verification

- `env -u CLOUDFLARE_API_TOKEN npx wrangler whoami`
- `env -u CLOUDFLARE_API_TOKEN npm run deploy:mcp`
- `LOUNGE_GURU_INTAKE_TOKEN=<redacted> LOUNGE_GURU_INTAKE_TIMEOUT_MS=240000 npm run intake:cloudflare -- --source-ids=collinson-international,citi-travel,visa-airport-companion,mastercard-travel-pass,dragonpass,star-alliance,skyteam,united,delta,american,aspire-lounges,marhaba,primeclass,no1-lounges,be-relax,openstreetmap`
- `LOUNGE_GURU_INTAKE_TOKEN=<redacted> LOUNGE_GURU_INTAKE_TIMEOUT_MS=240000 npm run intake:cloudflare:report:export`
- `LOUNGE_GURU_INTAKE_TOKEN=<redacted> npm run intake:evidence`
- `npm run build:canonical-data`

### Data State

- Cloudflare source runs: `76`
- Source proof: `11/16`
- Fetched sources: `11/16`
- Discovered airport codes: `12`
- Discovered lounge links: `43`
- Blocked from Cloudflare: `american`, `aspire-lounges`, `skyteam`, `star-alliance`, `united`

### Blocker

- The five blocked official sources still return `403` or `520` from Cloudflare.
- Terminal coverage remains blocked until source-family coverage is complete, review records are cleared, and a promotable full Cloudflare catalog report exists.

## Cloudflare Plan Source Alignment

Date: 2026-07-11

### Change

- Changed the review plan to use `cloudflare-source-intake-report.json`.
- Kept candidate generation on the legacy source report until a promotable Cloudflare catalog report exists.
- Regenerated `cloudflare-source-run-evidence.json` from D1 against the corrected plan.

### Verification

- `env -u CLOUDFLARE_API_TOKEN npm run intake:evidence`
- `npm run build:canonical-data`
- `npm run validate:coverage`

### Data State

- Source proof: `11/16`
- Terminal tasks: `3/3`
- Fetched sources: `11/16`

### Blocker

- Terminal coverage remains blocked by missing licensed global baseline, card-network catalog coverage, open review records, and the non-promotable source-intake runtime.

## Airline Fallback Probe

Date: 2026-07-11

### Change

- Added official United for Business as an early United fallback.
- Added official AA Flagship Lounge and regional American Airlines-owned Admirals Club pages as early AA fallbacks.
- Kept the same Cloudflare Worker source-intake boundary and eight-URL cap.

### Verification

- `npm run build:canonical-data`
- `npm run test -- tests/source-intake-report.test.mjs tests/source-intake-worker.test.mjs tests/worldwide-coverage-goal.test.mjs`
- `LOUNGE_GURU_INTAKE_TOKEN=<redacted> LOUNGE_GURU_INTAKE_TIMEOUT_MS=240000 node scripts/run-cloudflare-source-intake.mjs --base-url=https://lounge-guru-mcp.dev-4ee.workers.dev --source-ids=american,united`
- `LOUNGE_GURU_INTAKE_TOKEN=<redacted> LOUNGE_GURU_INTAKE_TIMEOUT_MS=240000 node scripts/run-cloudflare-source-intake.mjs --report --base-url=https://lounge-guru-mcp.dev-4ee.workers.dev --output=public/data/cloudflare-source-intake-report.json`
- `LOUNGE_GURU_INTAKE_TOKEN=<redacted> npm run intake:evidence`

### Data State

- Source proof: `14/16`
- Fetched sources: `14/16`
- Failed lanes: `american`, `united`
- AA result: `403` across official AA and American Airlines-owned regional pages.
- United result: `520` across official United and United for Business pages.

### Blocker

- Airline source proof remains blocked by official site edge responses from Cloudflare fetch.
- Terminal coverage remains blocked by catalog volume, approval ratio, incomplete source-family coverage, open review records, and the non-promotable full source-intake runtime.
