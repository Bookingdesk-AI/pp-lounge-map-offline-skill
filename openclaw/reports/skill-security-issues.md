
## PERSISTENT_BLOCKER - 2026-07-02 - pp-lounge-map offline source path missing

- Scope item: `skills/pp-lounge-map-offline/SKILL.md`.
- Status: missing in the active repo checkout while packaged `out/pp-lounge-map-offline-skill/skills/pp-lounge-map-offline/SKILL.md` exists and validates.
- Repeat evidence: source-path missing evidence appeared at least 4 times in existing `openclaw/reports` plus this run.
- Risk: reviewers cannot directly compare source skill guidance to packaged skill output from the expected source path.
- Suggested next action: restore or intentionally document the source-to-package mapping for `skills/pp-lounge-map-offline` before relying on packaged output alone.

## 2026-07-04 Issue Cycle Update
- PERSISTENT_BLOCKER remains open: `skills/pp-lounge-map-offline/SKILL.md` is still absent in the active checkout while the packaged offline skill under `out/pp-lounge-map-offline-skill/skills/pp-lounge-map-offline/SKILL.md` validates.
- No new duplicate blocker opened in this run.
- Mitigation shipped this run: packaged validator evidence/failure guidance improved and pushed on `codex/lounge-guru-domain-preview`.

## 2026-07-10 Issue Cycle Update
- PERSISTENT_BLOCKER remains open: the historical expected source path `skills/pp-lounge-map-offline/SKILL.md` is still absent in this checkout.
- Current mitigation/evidence: `npm run validate:publish:offline` passed using `skills/lounge-guru-offline` as the source bundle and `out/pp-lounge-map-offline-skill/skills/pp-lounge-map-offline` as the exported bundle; both reported matching inventory digest `eba657c2d3560747bbd2593ea9ee35fc3ba696e972a8178165499b8d793a9487` and 6/6 required files present.
- No new duplicate blocker opened; next action remains to restore or intentionally document the source-to-package mapping for `skills/pp-lounge-map-offline`.
