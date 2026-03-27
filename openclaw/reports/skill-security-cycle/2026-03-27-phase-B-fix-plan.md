# Phase B — Fix Plan (2026-03-27)

Repo: `/Users/kh/Coding/pp-lounge-map`

## Findings classification
1. `/Users/...` policy examples in SKILL files (source + packaged) → **Low** (false positive)
2. Large metadata URL volume in bundled catalog (`assets/catalog.json`) → **Low** (expected data, not transport config)

## Minimal reversible fix plan
- Keep policy examples and catalog data unchanged.
- **One bounded hardening improvement (Phase C):** add explicit redaction guidance for echoed catalog URLs (strip query strings and credential-like fragments) in both source and packaged SKILL docs.

## Rollback safety
- Small docs-only edit in two mirrored SKILL files; revert via one commit if needed.
