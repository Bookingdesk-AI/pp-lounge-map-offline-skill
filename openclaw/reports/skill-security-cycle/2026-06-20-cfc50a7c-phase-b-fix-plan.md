# Phase B Fix Plan - Offline Travel Skill

Run: cfc50a7c-66f2-4b9f-94a5-c8fc42e8b645

## Severity
Low: no active leak found; reduces packaging drift risk.

## Selected bounded improvement
Referenced-file integrity improvement: extend publish safety validation so required references must be mentioned by both SKILL.md and README.md for the offline bundle.

## Why this item
- It is additive and reversible.
- It does not touch runtime behavior or hosted/deploy surfaces.
- It improves either trust-boundary verification, referenced-file integrity, reviewer evidence, or failure guidance per the feature ladder.

## Guardrails
- Limit to one small implementation change in this repo.
- Do not edit pre-existing unrelated worktree changes.
- Verify with the repo's offline skill validation gate and post-edit scan.
