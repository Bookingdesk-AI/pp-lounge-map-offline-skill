# Phase B Fix Plan — Travel Skills Security Cycle

Timestamp: 2026-07-02 18:50 America/Los_Angeles / 2026-07-03 01:50 UTC
Repo: /Users/kh/Coding/pp-lounge-map
Skill: out/pp-lounge-map-offline-skill/skills/pp-lounge-map-offline

## Severity classification

- Critical: none found.
- High: none found.
- Medium: packaged README omits links to required offline references, causing the existing validator to fail and reducing operator reviewability.
- Low: none selected.

## Selected bounded improvement

Feature ladder item B — Referenced-file integrity improvement.

Add a concise `Required offline references` section to the packaged README linking:

- `references/mcp.md`
- `references/safety.md`
- `references/publishing.md`

## Why this is safe

- Documentation-only change.
- Uses files already bundled in the offline package.
- Aligns README with existing validator expectations and `SKILL.md` resources.

## Deferred items

A source `skills/pp-lounge-map-offline` tree was not present in this checkout during this run; the bounded fix targets the packaged offline skill under `out/pp-lounge-map-offline-skill`, which is the present scoped artifact validated by npm.
