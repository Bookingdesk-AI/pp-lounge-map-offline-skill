# Travel Skills Security Cycle - Phase B Fix Plan

Run: 2026-06-09 08:40 PT / cron cfc50a7c
Repo: pp-lounge-map
Branch: cron/travel-skills-security-cycle-20260609-0840

## Goal

Ship one bounded operator-trust improvement for `skills/pp-lounge-map-offline` and the packaged offline bundle after the Phase A scan passed.

## Assumptions

- The offline skill and package should remain local-only and read-only at runtime.
- Source/package sync and manifest checks already pass; the next value is better actionable guidance when package required files or mirror files drift.
- Validator failure text is a safe additive surface that does not change runtime behavior.

## Non-Goals / Do-Not-Touch

- No app/runtime behavior changes.
- No deploy or live data refresh.
- No deletion of packaged assets.

## Selected Feature

Feature ladder D/C: failure guidance + operator evidence improvement.

Improve offline publish validator issue text for missing required package files and packaged runtime mirror drift so a reviewer gets the likely remediation command/context instead of a terse failure.

## Verification Method

- Run `npm run validate:publish:offline`.
- Run source and packaged skill secret scans.
- Confirm git diff is limited to validator/report evidence.
