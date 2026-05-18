# Skill Security Fix Plan (2026-05-17)

## Findings
- Severity: medium
- Finding: SKILL.md source references a packaged-path file (`out/pp-lounge-map-offline-skill/.../references/safety.md`) that is absent in this repo state, causing reference-verification drift risk.

## Planned minimal fix
- Replace the hardcoded packaged path mention with a bounded pre-publish step: if packaged bundle exists, verify mirrored safety file; otherwise skip without failure.
