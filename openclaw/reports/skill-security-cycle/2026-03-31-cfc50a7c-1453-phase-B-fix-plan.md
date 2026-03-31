# Phase B — Fix Plan

## Findings classification
- No active secret leakage findings.
- No trust-boundary regressions detected.

## Planned hardening improvement (low)
- **Severity:** low (preventive hardening).
- **Change:** add a guardrail that local/offline diagnostic checks must target only local transports and must not use catalog `url` metadata as probe targets.
- **Why minimal/reversible:** one mirrored doc-policy line in source + packaged safety docs; one-commit rollback.
