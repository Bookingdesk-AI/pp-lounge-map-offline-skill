# Phase C — Improve (bounded)

- Applied 1/1 allowed improvement for this repo.
- Files changed:
  - `skills/pp-lounge-map-offline/SKILL.md`
  - `out/pp-lounge-map-offline-skill/skills/pp-lounge-map-offline/SKILL.md`
- Improvement: added explicit transport-alias rejection (`file://`, unix-socket aliases, ssh-style aliases) unless user explicitly asks to leave offline mode.
- Reversibility: documentation-only synchronized bullet addition; no runtime code path changes.
