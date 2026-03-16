---
name: pp-lounge-map
description: Use this skill when you need to search, compare, or summarize Priority Pass lounge data from the published pp-lounge-map catalog through the public read-only MCP server. Trigger it for airport lounge lookups, facility-based filtering, airport briefs, and lounge comparisons. Do not use it for rebuilding data, editing spreadsheets, deploying infrastructure, or running arbitrary shell or network commands.
license: MIT
---

# PP Lounge Map

Use this skill when the task is about the public lounge catalog.

## Quick start

1. Connect the host to the `pp-lounge-map` MCP endpoint at `https://<your-domain>/mcp`.
2. Prefer MCP tools and resources over shell access.
3. Keep responses grounded in returned catalog data only.

## Safety boundary

- This skill is public and read-only.
- Do not ask for API keys or secrets.
- Do not read or reference sibling workbooks, local filesystem paths, or deploy workflows.
- Do not suggest remote shell installers.
- If the MCP endpoint is unavailable, explain that the public catalog connection is missing instead of improvising with private source files.

## Available workflows

- Airport-specific lounge lookup
- Facility and type filtering
- Brief comparisons between lounges at one airport
- Catalog freshness and filter introspection

## Resources

- MCP setup and examples: [references/mcp.md](references/mcp.md)
- Trust model and public boundary: [references/safety.md](references/safety.md)
- Marketplace publishing notes: [references/publishing.md](references/publishing.md)
