# Production Runbook

## Release prep

1. Ensure Cloudflare auth is available to `wrangler`.
2. Confirm the source workbook exists in the private R2 bucket and object configured by:
   - `PP_LOUNGE_MAP_SOURCE_BUCKET`
   - `PP_LOUNGE_MAP_SOURCE_OBJECT`
3. Run `npm run release:prepare`.

This step downloads the workbook into the repo-local `.cache/` directory, rebuilds the public data artifacts, runs tests and publish validation, and builds `dist/`.

## Production deploy

1. Run `npm run deploy:mcp`.
2. Run `npm run deploy:web`.

If you want one command, run `npm run deploy`.

## Route verification

Verify the site shell still works:

```bash
curl -I https://prioritypassmap.desk.travel/
```

Verify health:

```bash
curl -i https://prioritypassmap.desk.travel/healthz
```

Verify the canonical MCP route is no longer serving HTML:

```bash
curl -i \
  -H 'accept: application/json, text/event-stream' \
  -H 'content-type: application/json' \
  https://prioritypassmap.desk.travel/mcp
```

Verify legacy SSE transport:

```bash
curl -i -H 'accept: text/event-stream' https://prioritypassmap.desk.travel/sse
```

The response should advertise an `event: endpoint` pointing at `/messages?sessionId=...`.

## Rollback

1. Re-deploy the previous Worker version with `wrangler rollback` or the previous known-good git SHA.
2. Re-deploy the previous Pages build from the Pages dashboard or by re-running `npm run deploy:web` from the previous commit.
3. Re-run the route verification commands above.
