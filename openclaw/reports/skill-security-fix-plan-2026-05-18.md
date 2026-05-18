# Skill Security Fix Plan — 2026-05-18

Severity classification:
- Low: secret-pattern regex hits were policy/guardrail prose, not exposed credentials.
- Low: absolute-path examples appear as placeholders in safety guidance (intentional educational examples).
- Medium: recurring scan noise can hide real regressions over time.

Minimal reversible fix plan:
1) Keep current trust-boundary language (localhost/offline/no hosted secrets) intact.
2) Add one repo-local scan wrapper that excludes known doc-pattern noise while still catching true secret signatures.
3) Re-run scoped scan after change and store report metadata only.
