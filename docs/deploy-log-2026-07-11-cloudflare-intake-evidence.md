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
