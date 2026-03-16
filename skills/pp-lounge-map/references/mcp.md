# MCP Setup

The public MCP endpoint is expected at:

```text
https://<your-domain>/mcp
```

Use the bundled helper to print a config snippet for a local client:

```bash
node skills/pp-lounge-map/scripts/print-mcp-config.mjs https://example.com/mcp
```

Public tools:

- `search_lounges`
- `get_lounge`
- `get_catalog_meta`

Public resources:

- `pp-lounge://meta`
- `pp-lounge://filters`
- `pp-lounge://lounge/{id}`

Public prompts:

- `airport-lounge-brief`
- `compare-airport-lounges`

The endpoint is anonymous and read-only in v1. It should never expose rebuild, deploy, file-write, or arbitrary fetch functionality.
