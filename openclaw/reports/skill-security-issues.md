
## PERSISTENT_BLOCKER - 2026-07-02 - pp-lounge-map offline source path missing

- Scope item: `skills/pp-lounge-map-offline/SKILL.md`.
- Status: missing in the active repo checkout while packaged `out/pp-lounge-map-offline-skill/skills/pp-lounge-map-offline/SKILL.md` exists and validates.
- Repeat evidence: source-path missing evidence appeared at least 4 times in existing `openclaw/reports` plus this run.
- Risk: reviewers cannot directly compare source skill guidance to packaged skill output from the expected source path.
- Suggested next action: restore or intentionally document the source-to-package mapping for `skills/pp-lounge-map-offline` before relying on packaged output alone.
