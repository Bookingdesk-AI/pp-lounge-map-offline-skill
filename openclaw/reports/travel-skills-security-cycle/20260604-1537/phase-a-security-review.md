# Phase A Security Review - pp-lounge-map-offline
utc=2026-06-04T22:43:34Z
## Validator

> pp-lounge-map@0.0.0 validate:publish:offline
> node scripts/validate-publish-ready-offline.mjs

publish-check: offline skill bundle passed; files=11, markdownLinks=3, requiredPaths=6, synchronizedFiles=5, catalogUrls=1754, catalogPathSegments=8770, packageEntrypoints=2, packageDependencies=2, packageReadmeCommands=2, runtimeMirrorFiles=5, assetBytes=2021679/5242880.
## Scoped secret/path scan (metadata only)
## Frontmatter source
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
## Frontmatter packaged
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
## Git
?? openclaw/reports/travel-skills-security-cycle/
