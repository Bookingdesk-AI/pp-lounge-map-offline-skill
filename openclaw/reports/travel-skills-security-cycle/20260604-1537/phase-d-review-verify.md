# Phase D Review + Verify - pp-lounge-map-offline
utc=2026-06-04T22:49:50Z
## Post validator

> pp-lounge-map@0.0.0 validate:publish:offline
> node scripts/validate-publish-ready-offline.mjs

publish-check: offline skill bundle passed; files=11, markdownLinks=3, requiredPaths=6, synchronizedFiles=5, catalogUrls=1754, catalogPathSegments=8770, packageEntrypoints=2, packageDependencies=2, packageReadmeCommands=2, packageReadmeTrustBoundaryPhrases=7, runtimeMirrorFiles=5, assetBytes=2021679/5242880.
## Scoped secret/path scan metadata
## Frontmatter source/package
---
name: pp-lounge-map-offline
description: Use this skill when you need offline or air-gapped access to the bundled Priority Pass lounge catalog. Trigger it for local lounge lookup, facility filtering, airport briefs, and lounge comparisons when network access is unavailable or disallowed. Do not use it for data rebuilds, deploys, remote MCP endpoints, arbitrary shell execution, or any workflow that depends on live internet access.
metadata:
  openclaw:
---
name: pp-lounge-map-offline
description: Use this skill when you need offline or air-gapped access to the bundled Priority Pass lounge catalog. Trigger it for local lounge lookup, facility filtering, airport briefs, and lounge comparisons when network access is unavailable or disallowed. Do not use it for data rebuilds, deploys, remote MCP endpoints, arbitrary shell execution, or any workflow that depends on live internet access.
metadata:
  openclaw:
## Referenced files
ok source references/mcp.md
ok source references/safety.md
ok source references/publishing.md
ok source scripts/run-offline-mcp.mjs
ok source scripts/print-offline-mcp-config.mjs
ok source assets/catalog.json
ok package README.md
ok package package.json
ok package skills/pp-lounge-map-offline/SKILL.md
ok package skills/pp-lounge-map-offline/references/mcp.md
ok package skills/pp-lounge-map-offline/references/safety.md
ok package skills/pp-lounge-map-offline/references/publishing.md
ok package skills/pp-lounge-map-offline/scripts/run-offline-mcp.mjs
## Remote before proof commit
fdbf00dea154e5726a1007f371aba56f041dd51c	refs/heads/codex/skill-security-cycle-20260402
