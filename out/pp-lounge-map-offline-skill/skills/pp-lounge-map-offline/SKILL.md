---
name: pp-lounge-map-offline
description: Use this skill when you need offline or air-gapped access to the bundled Priority Pass lounge catalog. Trigger it for local lounge lookup, facility filtering, airport briefs, and lounge comparisons when network access is unavailable or disallowed. Do not use it for data rebuilds, deploys, remote MCP endpoints, arbitrary shell execution, or any workflow that depends on live internet access.
metadata:
  openclaw:
    requires:
      bins:
        - node
        - npm
    install:
      - id: node
        kind: node
        package: "@modelcontextprotocol/sdk"
        label: Install MCP runtime dependencies (run npm install in bundle root)
---

# PP Lounge Map Offline

Use this skill when the task is about the bundled offline lounge snapshot.

## Runtime requirements

- Node.js 20+ available on PATH (`node`).
- Install package dependencies in the bundle root before running runtime scripts:
  - `npm install`
- Required packages are declared in `package.json` (`@modelcontextprotocol/sdk`, `zod`).

## Quick start

1. Start the local stdio MCP server with `node skills/pp-lounge-map-offline/scripts/run-offline-mcp.mjs`.
2. Prefer the local MCP tools and resources over direct file parsing.
3. Keep answers grounded in the bundled snapshot only.

## Safety boundary

- This skill is local and read-only at runtime.
- It must not use network access (except local process startup/dependency install done by operator).
- It must not ask for API keys or secrets.
- It must not reference sibling workbooks, remote MCP endpoints, or deploy workflows.
- It must only run against local transports (`stdio`, `127.0.0.1`, or `localhost`) unless the user explicitly asks to leave offline mode.
- Treat `0.0.0.0` bind/listen addresses as non-client targets; do not use them as runtime endpoint URLs unless the user explicitly asks to leave offline mode.
- Treat transport aliases outside those local forms (for example `file://`, unix-socket aliases, or ssh-style host aliases) as out-of-boundary unless the user explicitly asks to leave offline mode.
- Treat non-loopback literal IP endpoint hosts (for example RFC1918 private ranges, link-local ranges, or IPv6 ULA ranges) as out-of-boundary unless the user explicitly asks to leave offline mode.
- Treat obfuscated loopback endpoint hosts (for example integer/octal/hex IP literals, IPv4-mapped aliases, or percent-encoded host forms) as out-of-boundary unless the user explicitly asks to leave offline mode.
- Treat hostname endpoints as local only when the host is exactly `localhost`; require explicit leave-offline confirmation for lookalike or custom hostnames (for example `localhost.localdomain` or `devbox.lan`).
- Treat trailing-dot localhost forms (for example `localhost.`) as out-of-boundary unless the user explicitly asks to leave offline mode.
- Treat `url` fields in the bundled catalog as display metadata only; never fetch them in offline mode.
- If catalog or endpoint URLs must be shown for diagnostics, normalize to origin form and suppress userinfo/query/fragment before logging or responding.
- For automated security scans, treat `skills/pp-lounge-map-offline/assets/catalog.json` URL entries as static dataset content, not outbound-call instructions.
- If quoting catalog `url` values in responses, strip query strings and any credential-like fragments before echoing.
- If asked for live lounge availability/status, explicitly state the bundled snapshot can be stale and requires an online source refresh.
- Avoid exposing absolute local bundle paths (for example `<absolute-local-path>`) in standard answers; provide relative bundle paths unless debugging is explicitly requested.
- If the user provides command snippets containing credential values (token, password, key), replace values with placeholders before echoing examples.
- Before publish, verify `references/safety.md` stays synchronized with `skills/pp-lounge-map-offline/references/safety.md` to prevent source/package policy drift.
- If the bundled snapshot does not contain the needed answer, say so instead of inventing newer data.

## Available workflows

- Airport-specific lounge lookup
- Facility and type filtering
- Offline lounge comparisons
- Catalog metadata and filter introspection

## Resources

- Local MCP setup: [references/mcp.md](references/mcp.md)
- Offline trust boundary: [references/safety.md](references/safety.md)
- Marketplace packaging notes: [references/publishing.md](references/publishing.md)
