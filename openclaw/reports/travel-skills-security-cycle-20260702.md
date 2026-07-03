# Travel Skills Security Cycle - 2026-07-02

## Phase A: Security Review

Branch: codex/lounge-guru-domain-preview

Pre-scan scope:
- Offline skill files and references.
- Secret-like literals: AWS, Google API, GitHub tokens, Slack tokens, private keys, token/api key/secret assignments.
- Unsafe local path disclosure marker: /Users/.
- Offline boundary drift marker: http(s) URLs outside expected loopback/reference documentation context.

Initial findings:
- circulus-map: hosted URLs appear in reference/documentation context; loopback MCP endpoint documented; no secret-like token assignment observed in skill scan output.
- all-routes: hosted URLs appear in README reference context; no secret-like token assignment observed in skill scan output.
- pp-lounge-map: source path skills/pp-lounge-map-offline/SKILL.md is missing; packaged out/pp-lounge-map-offline-skill exists and must remain the verification target until source path is restored.

Phase guard note: this file records Phase A evidence so the phase can be committed and pushed before Phase B begins.

## Phase B: Fix Plan

Planned bounded improvements:
- circulus-map: referenced-file integrity improvement by making the offline security review reference part of the required validation set.
- all-routes: operator evidence improvement by making validation output explicitly report hosted documentation URL counts and allowed documentation-only posture.
- pp-lounge-map: referenced-file integrity improvement in the packaged offline skill by requiring the operator trust evidence checklist file referenced by SKILL.md.

Severity classification:
- No high-severity secret leakage was observed in the scoped pre-scan evidence.
- pp-lounge-map missing source path `skills/pp-lounge-map-offline/SKILL.md` is a medium operator-trust blocker for source/package traceability; package validation can continue against `out/pp-lounge-map-offline-skill`.
- Planned changes are low-risk, additive validator/reporting hardening.

Phase guard note: Phase B plan is committed and pushed before any Phase C mutations.
