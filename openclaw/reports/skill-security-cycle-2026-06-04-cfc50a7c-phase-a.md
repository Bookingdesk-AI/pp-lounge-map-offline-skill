# Travel Skill Security Cycle - Phase A Pre-Review

- run: cfc50a7c-66f2-4b9f-94a5-c8fc42e8b645
- time_utc: 2026-06-04T09:36:00Z
- repo: /Users/kh/Coding/pp-lounge-map
- branch: codex/skill-security-cycle-20260402
- head_before: 3a54248ee388a19516a63f90530e1febd1a8310e
- upstream: origin/codex/skill-security-cycle-20260402
- push_target: https://github.com/Bookingdesk-AI/pp-lounge-map-offline-skill.git

## Architecture / Trust Boundary
- Skill packages: skills/pp-lounge-map-offline source and out/pp-lounge-map-offline-skill packaged mirror.
- Stable interfaces: SKILL.md frontmatter, references/mcp.md, references/safety.md, references/publishing.md, catalog asset, runtime scripts.
- Offline invariant: bundled snapshot and local transports only; catalog URLs are metadata, not fetch instructions.

## Pre-Scan Commands
```text

> pp-lounge-map@0.0.0 validate:publish:offline
> node scripts/validate-publish-ready-offline.mjs

publish-check: offline skill bundle passed; files=11, markdownLinks=3, requiredPaths=6, synchronizedFiles=5, catalogUrls=1754, packageEntrypoints=2, packageDependencies=2, packageReadmeCommands=2, runtimeMirrorFiles=5, assetBytes=2021679/5242880.
```


> pp-lounge-map@0.0.0 validate:publish:offline
> node scripts/validate-publish-ready-offline.mjs

publish-check: offline skill bundle passed; files=11, markdownLinks=3, requiredPaths=6, synchronizedFiles=5, catalogUrls=1754, packageEntrypoints=2, packageDependencies=2, packageReadmeCommands=2, runtimeMirrorFiles=5, assetBytes=2021679/5242880.
