# Phase B Fix Plan — pp-lounge-map-offline

- Run: `20260605-1035-cfc50a7c`
- Repo: `/Users/kh/Coding/pp-lounge-map`
- Branch: `codex/skill-security-cycle-20260402`
- HEAD before phase: `772f464df40b47fc3aa36b4e14728c0b2d688614`

## Classification
- Severity: `Low`
- No destructive action selected.
- No PR approval or merge action selected.

## Selected bounded feature
- Referenced-file integrity improvement: require the packaged offline manifest to list the bundled catalog and print-config helper as reviewer-critical required files, and update the export script to generate that manifest.

## Rationale
- The files are packaged and validated elsewhere, but SKILL-PACKAGE.json requiredFiles is the reviewer-facing manifest. Listing the catalog snapshot and helper makes package review easier and catches accidental manifest drift.

## Change scope
- Edit scripts/export-public-offline-skill.mjs and scripts/validate-publish-ready-offline.mjs, regenerate out/pp-lounge-map-offline-skill/SKILL-PACKAGE.json, plus Phase C evidence.

## Verification plan
- Re-run the repo-local offline skill validator/publish validator after edits.
- Re-scan scoped skill/package files for secret-like metadata and offline-boundary drift.
- Verify SKILL frontmatter and referenced files remain present.
