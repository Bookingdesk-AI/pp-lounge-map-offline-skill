# Phase B — Fix Plan — Run cfc50a7c

Findings classification:
1. **Low** — no secret leakage detected in scoped files.
2. **Low (hardening)** — offline safety guidance can explicitly require URL-fragment sanitization before quoting catalog links in responses.

Minimal reversible fix plan:
- Add one safety bullet in `skills/pp-lounge-map-offline/references/safety.md` requiring redaction of query strings and credential-like URL fragments when quoting catalog URLs.
- Mirror the same text into `out/pp-lounge-map-offline-skill/skills/pp-lounge-map-offline/references/safety.md` to keep bundle parity.
- Keep change docs-only.
