# PP Lounge Map Offline Skill

Offline-first airport lounge lookup and comparison skill.

## Overview

**PP Lounge Map Offline** is a portable MCP-ready skill bundle for Priority Pass lounge discovery in local or air-gapped environments.

It is designed for deterministic, privacy-conscious workflows where network-dependent data fetching is not desired.

## Capabilities

- Airport lounge search and filtering
- Lounge detail lookup by ID
- Airport-level lounge brief generation
- Side-by-side lounge comparison
- Catalog metadata introspection

## Local MCP runtime

Start local stdio server:

```bash
node skills/pp-lounge-map-offline/scripts/run-offline-mcp.mjs
```

Print client config:

```bash
node skills/pp-lounge-map-offline/scripts/print-offline-mcp-config.mjs
```

## Security & trust boundary

- Uses bundled snapshot data only
- No runtime internet fetch required
- No secret/API key requirement
- Read-only query workflows

## Keywords

offline lounge lookup, priority pass lounge map, airport lounge comparison, travel MCP skill, local lounge catalog, air-gapped travel tooling
