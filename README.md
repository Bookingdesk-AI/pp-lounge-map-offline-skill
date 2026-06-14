# Lounge Guru

Multi-source lounge data console with a public, read-only MCP server and publishable skill bundles.

## Product goal

See `docs/lounge-guru-product-goal.md` for the Lounge Guru north star, quality bar, workflow standard, and first milestones.

## Commands

- `npm run build:mcp-data` regenerates the compact MCP catalog from the public GeoJSON and metadata.
- `npm run build:canonical-data` regenerates canonical records, source registry, and quality reports.
- `npm run build:offline-skill` regenerates the portable offline skill asset and vendored stdio runtime.
- `npm run release:prepare` downloads the source workbook from private R2, rebuilds data assets, runs tests/validations, and builds the site.
- `npm run mcp:dev` starts the Cloudflare Worker MCP server locally.
- `npm run deploy:mcp` deploys the MCP Worker and its route bindings.
- `npm run deploy:web` deploys the static site to Cloudflare Pages.
- `npm run deploy` runs release prep, then deploys the Worker and the site.
- `npm run validate:publish` runs the public bundle safety audit.
- `npm run validate:publish:offline` runs the offline bundle safety audit.
- `npm run poke:validate` validates the hosted Poke recipe draft.
- `npm run poke:bootstrap` prints the exact Poke MCP bootstrap command and canonical endpoint.
- `npm run skill:validate` validates the skill bundle structure.
- `npm run skill:validate:offline` validates the offline skill bundle structure.
- `npm run skill:export` stages the public skill repo contents in `out/lounge-guru-skill/`.
- `npm run skill:export:offline` stages the portable offline skill repo in `out/lounge-guru-offline-skill/`.

## Production MCP endpoints

- Streamable HTTP: `https://loungeguru.desk.travel/mcp`
- Legacy SSE stream: `https://loungeguru.desk.travel/sse`
- Legacy SSE message POST: `https://loungeguru.desk.travel/messages`
- Health check: `https://loungeguru.desk.travel/healthz`

`/mcp` is the canonical endpoint and should be configured with `transport: "streamable-http"`.
`/sse` and `/messages` exist only for older clients that still require the deprecated SSE transport.

## Release inputs

Release prep expects the source workbook in a private Cloudflare R2 object.

- Bucket env var: `LOUNGE_GURU_SOURCE_BUCKET`
- Object env var: `LOUNGE_GURU_SOURCE_OBJECT`
- Local override: `SOURCE_XLSX`

The old `PP_LOUNGE_MAP_SOURCE_BUCKET` and `PP_LOUNGE_MAP_SOURCE_OBJECT` names remain supported.

If the R2 env vars are omitted, the release prep script falls back to:

- bucket: `lounge-guru-source`
- object: `latest/PP Lounge Data.xlsx`

See `docs/production-runbook.md` for the manual release flow, route verification, and rollback steps.

## Hosted Poke recipe

The hosted Poke recipe draft lives at `recipes/poke/lounge-guru.hosted.recipe.json`.

- Validate the draft with `npm run poke:validate`
- Print the integration bootstrap snippet with `npm run poke:bootstrap`
- Follow `docs/poke-recipe-runbook.md` to create, test, and publish the recipe in Poke Kitchen
