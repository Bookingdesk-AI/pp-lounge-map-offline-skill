# pp-lounge-map-offline

Portable offline skill bundle for Priority Pass lounge lookup.

## Runtime

1. Install package dependencies once.
2. Start the local stdio MCP server with `node skills/pp-lounge-map-offline/scripts/run-offline-mcp.mjs`.
3. Point your MCP client at that command.

## Integrity checkpoints

Before publishing or mirroring this bundle, verify these packaged paths exist:

- `skills/pp-lounge-map-offline/SKILL.md`
- `skills/pp-lounge-map-offline/references/mcp.md`
- `skills/pp-lounge-map-offline/references/safety.md`
- `skills/pp-lounge-map-offline/references/publishing.md`
- `skills/pp-lounge-map-offline/scripts/run-offline-mcp.mjs`

Run `npm run validate:publish:offline` from the source repo before shipping; it checks frontmatter, markdown references, synchronized source/package docs, runtime mirror files, and package entrypoints.

## Reviewer command evidence

- package.json `scripts.mcp`: `node skills/pp-lounge-map-offline/scripts/run-offline-mcp.mjs`
- SKILL-PACKAGE.json `mcpCommand`: `node skills/pp-lounge-map-offline/scripts/run-offline-mcp.mjs`
- SKILL-PACKAGE.json `validationCommand`: `npm run validate:publish:offline`
- Run validation from the source repo before publishing the exported bundle.

## Trust boundary

This artifact is local-only at runtime. It uses the bundled catalog snapshot and does not require network access to answer lounge queries.

It has no OAuth flows, no sensitive credential collection, and no purchase/payment execution. Catalog `url` fields are display metadata only; do not fetch them while operating the offline bundle.
