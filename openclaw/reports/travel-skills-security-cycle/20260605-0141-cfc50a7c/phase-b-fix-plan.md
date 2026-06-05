# Phase B Fix Plan - pp-lounge-map-offline

Run: cfc50a7c / 2026-06-05 01:41 PT
Repo: /Users/kh/Coding/pp-lounge-map
Branch: codex/skill-security-cycle-20260402
Push target: origin codex/skill-security-cycle-20260402 (https://github.com/Bookingdesk-AI/pp-lounge-map-offline-skill.git)

## Finding classification
- Severity: low operator-trust / validation-hardening gap.
- Secret leakage: no confirmed credential/private-key exposure from Phase A.
- Offline boundary: no confirmed drift from local/offline skill boundaries.

## Selected bounded improvement
- Feature ladder: B. Referenced-file integrity improvement
- Change: Add an exported package manifest/pointer file and validator checks declaring the nested skill path, MCP command, validation command, and required packaged skill files to reduce wrapper-root ambiguity.

## Non-goals / do-not-touch scope
- Do not remove or refactor unrelated app/runtime code.
- Do not stage pre-existing unrelated workspace changes.
- Do not create, approve, or merge a PR in this run.

## Verification plan
Run npm run validate:publish:offline; confirm manifest checks pass; re-scan source + packaged skill docs/config for high-confidence secret/path hits.

## Phase guard
This phase is plan-only and committed before implementation so Phase C can proceed with commit+push proof.
