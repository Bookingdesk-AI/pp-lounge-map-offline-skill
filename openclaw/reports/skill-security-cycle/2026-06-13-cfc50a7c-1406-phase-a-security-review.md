# Phase A Security Review — pp-lounge-map

- Run: `2026-06-13-cfc50a7c-1406`
- Repo: `/Users/kh/Coding/pp-lounge-map`
- Phase: A / SECURITY REVIEW
- Severity policy: fail closed for real credentials; classify offline-boundary drift separately from static reference docs.

## Scope `skills/pp-lounge-map-offline`
- Files scanned: 11
- Credential-pattern metadata hits: 0
- Offline-boundary/path metadata hits: 11
  - Metadata only: skills/pp-lounge-map-offline/README.md:39, skills/pp-lounge-map-offline/README.md:41, skills/pp-lounge-map-offline/SKILL.md:39, skills/pp-lounge-map-offline/SKILL.md:68, skills/pp-lounge-map-offline/SKILL.md:86, skills/pp-lounge-map-offline/SKILL.md:99, skills/pp-lounge-map-offline/SKILL.md:100, skills/pp-lounge-map-offline/references/safety.md:19, skills/pp-lounge-map-offline/references/safety.md:24, skills/pp-lounge-map-offline/references/safety.md:34, skills/pp-lounge-map-offline/references/safety.md:37

## Scope `out/pp-lounge-map-offline-skill/skills/pp-lounge-map-offline`
- Files scanned: 11
- Credential-pattern metadata hits: 0
- Offline-boundary/path metadata hits: 11
  - Metadata only: out/pp-lounge-map-offline-skill/skills/pp-lounge-map-offline/README.md:39, out/pp-lounge-map-offline-skill/skills/pp-lounge-map-offline/README.md:41, out/pp-lounge-map-offline-skill/skills/pp-lounge-map-offline/SKILL.md:39, out/pp-lounge-map-offline-skill/skills/pp-lounge-map-offline/SKILL.md:68, out/pp-lounge-map-offline-skill/skills/pp-lounge-map-offline/SKILL.md:86, out/pp-lounge-map-offline-skill/skills/pp-lounge-map-offline/SKILL.md:99, out/pp-lounge-map-offline-skill/skills/pp-lounge-map-offline/SKILL.md:100, out/pp-lounge-map-offline-skill/skills/pp-lounge-map-offline/references/safety.md:19, out/pp-lounge-map-offline-skill/skills/pp-lounge-map-offline/references/safety.md:24, out/pp-lounge-map-offline-skill/skills/pp-lounge-map-offline/references/safety.md:34, out/pp-lounge-map-offline-skill/skills/pp-lounge-map-offline/references/safety.md:37

## Initial Classification
- No real secret value is printed in this report; only file/line metadata is retained.
- Boundary hits in SKILL docs are expected where they describe loopback allowlists, hosted references, or redaction rules; post-phase verification will re-check after bounded improvements.
- Unrelated pre-existing working-tree changes, if any, are intentionally out of scope for this security cycle.

