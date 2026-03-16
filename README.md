# pp-lounge-map

Priority Pass lounge map with a public, read-only MCP server and a publishable skill bundle.

## Commands

- `npm run build:mcp-data` regenerates the compact MCP catalog from the public GeoJSON and metadata.
- `npm run mcp:dev` starts the Cloudflare Worker MCP server locally.
- `npm run validate:publish` runs the public bundle safety audit.
- `npm run skill:validate` validates the skill bundle structure.
- `npm run skill:export` stages the public skill repo contents in `out/pp-lounge-map-skill/`.
