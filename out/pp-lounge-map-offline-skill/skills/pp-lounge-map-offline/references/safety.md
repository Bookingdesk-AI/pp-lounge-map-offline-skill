# Offline Safety

This offline skill is intentionally narrow.

It may:

- query the bundled lounge snapshot through local MCP
- summarize or compare returned lounge records
- read bundled catalog metadata and filter lists

It must not:

- call remote MCP endpoints
- use non-loopback transports for MCP access (allow only `stdio`, `127.0.0.1`, or `localhost` unless the user explicitly exits offline mode)
- fetch network resources
- ask for secrets
- trigger deploys or data rebuilds
- treat bundled `url` fields as network fetch instructions
- quote catalog `url` values with credential-like fragments or query strings unredacted
- claim that the bundled snapshot is live data

If a request needs fresher data than the bundled snapshot provides, say that the offline bundle is stale rather than guessing.

Packaging hygiene:
- Keep this safety file synchronized with `out/pp-lounge-map-offline-skill/skills/pp-lounge-map-offline/references/safety.md` before publishing to avoid safety-policy drift between source and packaged bundles.
