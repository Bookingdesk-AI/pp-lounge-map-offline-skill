# Cloudflare Intake Command

Date: 2026-07-11

## Change

- Replaced the chained `intake:cloudflare` npm command with a Node flow wrapper.
- Preserved `--source-ids` arguments for the Worker probe request.
- Added OAuth retry for D1 evidence export when a stale local API token is present.

## Verification

- `npm run test -- tests/cloudflare-intake-cli.test.mjs tests/cloudflare-source-run-evidence.test.mjs`
- `npm run intake:cloudflare -- --dry-run --source-ids=dragonpass`
- `npm run intake:evidence`
- `npm run validate:json`
- `npm run lint`
- `npx tsc -b`
- `npx vite build`
- `unset CLOUDFLARE_API_TOKEN; npm run validate:cloudflare-auth`

## Result

- Dry-run target: `https://loungeguru.desk.travel/admin/source-intake/probe-batch`
- Dry-run source IDs: `dragonpass`
- Evidence export: `3/3` ready tasks, unchanged
- Local scrawl: `blocked`

## Blocker

- Full source promotion remains blocked until a promotable full-catalog Cloudflare intake report exists.
