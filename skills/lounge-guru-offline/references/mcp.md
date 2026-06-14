# Offline MCP Setup

This skill uses a local stdio MCP server backed by the bundled catalog snapshot.

Start it with:

```bash
node skills/lounge-guru-offline/scripts/run-offline-mcp.mjs
```

Print a ready-to-paste config snippet with:

```bash
node skills/lounge-guru-offline/scripts/print-offline-mcp-config.mjs
```

Local tools:

- `search_lounges`
- `get_lounge`
- `get_catalog_meta`

Local resources:

- `lounge-guru://meta`
- `lounge-guru://filters`
- `lounge-guru://lounge/{id}`
- `pp-lounge://meta` (compatibility)
- `pp-lounge://filters` (compatibility)
- `pp-lounge://lounge/{id}` (compatibility)

Local prompts:

- `airport-lounge-brief`
- `compare-airport-lounges`

The offline server uses only the bundled snapshot and does not fetch data at runtime.
