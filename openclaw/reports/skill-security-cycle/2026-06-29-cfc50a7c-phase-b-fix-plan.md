# Phase B Fix Plan — 2026-06-29 cfc50a7c

Scope: `skills/pp-lounge-map-offline` and `out/pp-lounge-map-offline-skill`.

Severity classification:
- Critical/high: none found in source skill or public offline bundle review.
- Medium: required reference files can exist but drift out of shipped docs unless the publish check verifies documentation references.
- Low: no destructive cleanup needed.

Chosen bounded feature:
- Referenced-file integrity improvement: require shipped docs to mention each required offline reference and emit that policy in publish evidence.
