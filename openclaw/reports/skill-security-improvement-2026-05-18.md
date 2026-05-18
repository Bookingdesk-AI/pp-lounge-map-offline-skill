# Improvement (bounded) — 2026-05-18

Added a normalized scoped-scan command template for `skills/pp-lounge-map-offline` that:
- keeps true credential signatures enabled,
- excludes known documentation policy prose noise,
- outputs file+line metadata only.

Command template:
`rg -n --hidden --glob 'skills/pp-lounge-map-offline/**' --glob 'out/pp-lounge-map-offline-skill/**' --glob '!.git/**' --glob '!**/node_modules/**' -e '(AKIA[0-9A-Z]{16}|-----BEGIN (RSA|EC|OPENSSH|PGP|PRIVATE) KEY-----|xox[baprs]-|ghp_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{20,}|AIza[0-9A-Za-z\-_]{35}|sk-[A-Za-z0-9]{20,})'`
