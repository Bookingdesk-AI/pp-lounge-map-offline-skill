# Skill Security Cycle Phase B — Fix Plan

- Run: cfc50a7c / 2026-06-04 13:48 UTC
- Repo: /Users/kh/Coding/pp-lounge-map
- Skill: skills/pp-lounge-map-offline
- Requested bundle: out/pp-lounge-map-offline-skill

## Selected feature

Feature B — referenced-file / package integrity improvement.

## Plan

Ship one bounded package-evidence improvement that makes the offline export root self-describing and easier to verify when reviewers inspect `out/pp-lounge-map-offline-skill`. Prefer clearer package README/front-door guidance over changing runtime behavior. Verify with the existing offline publish gate and post-scan.

## Non-goals

- No catalog rebuild beyond the normal offline export script.
- No remote/deploy workflow changes.
- No runtime server refactor.
