# Production Runbook

## Release prep

1. Ensure Cloudflare auth is available to `wrangler`.
2. Confirm the source workbook exists in the private R2 bucket and object configured by:
   - `LOUNGE_GURU_SOURCE_BUCKET`
   - `LOUNGE_GURU_SOURCE_OBJECT`
   - Legacy fallbacks: `PP_LOUNGE_MAP_SOURCE_BUCKET`, `PP_LOUNGE_MAP_SOURCE_OBJECT`
3. Run `npm run release:prepare`.
4. Run `npm run validate:json`.

This step downloads the workbook into the repo-local `.cache/` directory, rebuilds the public data artifacts, runs tests and publish validation, and builds `dist/`.

## Production deploy

1. Run `npm run deploy:mcp`.
2. Run `npm run deploy:web`.
3. Run `npm run smoke:production`.

If you want one command, run `npm run deploy`.

## Route verification

Run the production smoke:

```bash
npm run smoke:production
```

It checks the site shell, catalog JSON, admin guard, `/healthz`, `/mcp`, `/sse`, desktop UI, mobile UI, and review queue.

For diagnosis, verify health:

```bash
curl -i https://lounge-guru-mcp.dev-4ee.workers.dev/healthz
```

Verify the canonical MCP route is no longer serving HTML:

```bash
curl -i \
  -H 'accept: application/json, text/event-stream' \
  -H 'content-type: application/json' \
  https://lounge-guru-mcp.dev-4ee.workers.dev/mcp
```

Verify legacy SSE transport:

```bash
curl -i -H 'accept: text/event-stream' https://lounge-guru-mcp.dev-4ee.workers.dev/sse
```

The response should advertise an `event: endpoint` pointing at `/messages?sessionId=...`.

## Rollback

1. Re-deploy the previous Worker version with `wrangler rollback` or the previous known-good git SHA.
2. Re-deploy the previous Pages build from the Pages dashboard or by re-running `npm run deploy:web` from the previous commit.
3. Re-run `npm run smoke:production`.
