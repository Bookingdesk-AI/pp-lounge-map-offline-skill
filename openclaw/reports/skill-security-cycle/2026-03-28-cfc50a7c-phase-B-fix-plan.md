# Phase B — Fix Plan — Run cfc50a7c

Finding classification:
- LOW: README trust-boundary wording can be tightened to explicitly state catalog `url` fields are metadata-only and non-fetchable in offline mode.

Minimal reversible fix plan:
1. Add one short safety bullet to both bundled and source READMEs:
   - catalog URLs are metadata only
   - do not fetch them in offline mode
   - redact query/credential-like fragments if quoted
2. Keep change docs-only and mirror source/bundle wording.
3. Re-scan to confirm trust-boundary statements remain consistent with SKILL guardrails.
