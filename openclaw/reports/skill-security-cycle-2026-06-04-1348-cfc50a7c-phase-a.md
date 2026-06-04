# Skill Security Cycle Phase A — Security Review

- Run: cfc50a7c / 2026-06-04 13:48 UTC
- Repo: /Users/kh/Coding/pp-lounge-map
- Skill: skills/pp-lounge-map-offline
- Requested bundle path: out/pp-lounge-map-offline-skill
- Branch: codex/skill-security-cycle-20260402
- Push target: origin codex/skill-security-cycle-20260402

## Pre-scan snapshot

- Secret-ish scan over `skills/pp-lounge-map-offline`, `out/pp-lounge-map-offline-skill`, and `openclaw`: one report-only match in historical OpenClaw report text (`openclaw/reports/skill-security-cycle/2026-04-01-cfc50a7c-phase-A.md`) describing credential-pattern scan coverage, not an exposed secret.
- Offline-boundary/path scan: no unsafe absolute user paths, non-localhost HTTP endpoints, arbitrary proxy/tile-provider cues, or shell network fetch cues in scoped skill/bundle files.
- Frontmatter present in source `skills/pp-lounge-map-offline/SKILL.md`: yes.
- Referenced local files from source `SKILL.md`:
  - `references/mcp.md`: present
  - `references/safety.md`: present
  - `references/publishing.md`: present
- Requested out bundle `out/pp-lounge-map-offline-skill` exists but lacks `SKILL.md`; current exported files with `SKILL.md` appear under `out/pp-lounge-map-skill`.

## Architecture / boundary note

The offline skill is a packaged local lounge-catalog/MCP bundle. The stable trust boundary is offline/catalog-backed lookup only; data rebuilds, deploys, remote MCP endpoints, arbitrary shell execution, and live internet workflows are explicitly outside skill scope.

## Initial risk classification

- Severity: medium for packaging evidence ambiguity, low for secret leakage.
- Main residual risk: reviewers can inspect the source skill successfully but the requested offline bundle path does not currently expose the same `SKILL.md` proof surface.
