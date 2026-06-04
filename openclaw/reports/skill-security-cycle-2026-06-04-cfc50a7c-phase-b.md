# Travel Skill Security Cycle - Phase B Fix Plan

- run: cfc50a7c-66f2-4b9f-94a5-c8fc42e8b645
- repo: /Users/kh/Coding/pp-lounge-map
- branch: codex/skill-security-cycle-20260402
- base_commit: 8a3a8bc1d2cf148dddfb0b5a3679123ad0edb85f
- push_target: https://github.com/Bookingdesk-AI/pp-lounge-map-offline-skill.git

## Severity Classification
- Critical/high: none found in pre-scan.
- Medium: none found.
- Low/secret-boundary validation gap: docs describe token-like URL path redaction, while catalog display URL validation currently checks protocol/userinfo/query/hash but not opaque token-like path segments.

## Selected Feature
- Ladder A: Secret/boundary validation improvement.
- Extend catalog display URL validation to reject JWT-style or long opaque token-like path segments before release.

## Non-goals
- No catalog rebuild.
- No runtime MCP behavior changes.
- No broad bundle/export restructuring.

## Verification Plan
- Re-run 
> pp-lounge-map@0.0.0 validate:publish:offline
> node scripts/validate-publish-ready-offline.mjs

publish-check: offline skill bundle passed; files=11, markdownLinks=3, requiredPaths=6, synchronizedFiles=5, catalogUrls=1754, packageEntrypoints=2, packageDependencies=2, packageReadmeCommands=2, runtimeMirrorFiles=5, assetBytes=2021679/5242880..
- Confirm output includes the expanded catalog URL evidence and existing source/mirror synchronization checks.

## Phase C Implementation Result
- Shipped secret/boundary validation improvement: catalog display URL validation now rejects JWT-style or long opaque token-like path segments while preserving human-readable slugs.
- Verification: `npm run validate:publish:offline` passed with `catalogPathSegments=8770`.
