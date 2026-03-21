# pp-lounge-map

Priority Pass lounge map with a public, read-only MCP server and a publishable skill bundle.

## Commands

- `npm run build:mcp-data` regenerates the compact MCP catalog from the public GeoJSON and metadata.
- `npm run build:offline-skill` regenerates the portable offline skill asset and vendored stdio runtime.
- `npm run mcp:dev` starts the Cloudflare Worker MCP server locally.
- `npm run validate:publish` runs the public bundle safety audit.
- `npm run validate:publish:offline` runs the offline bundle safety audit.
- `npm run skill:validate` validates the skill bundle structure.
- `npm run skill:validate:offline` validates the offline skill bundle structure.
- `npm run skill:export` stages the public skill repo contents in `out/pp-lounge-map-skill/`.
- `npm run skill:export:offline` stages the portable offline skill repo in `out/pp-lounge-map-offline-skill/`.
