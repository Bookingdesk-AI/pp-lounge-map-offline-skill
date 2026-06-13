# Phase B Fix Plan — pp-lounge-map

- Run: `2026-06-13-cfc50a7c-1406`
- Repo: `/Users/kh/Coding/pp-lounge-map`
- Phase: B / FIX PLAN
- Scope: `skills/pp-lounge-map-offline + out/pp-lounge-map-offline-skill`

## Security Classification

- Severity: Low / operator-trust hardening.
- Secret leakage: no confirmed secret values from Phase A metadata-only scan.
- Offline-boundary drift: no high-severity runtime drift confirmed; existing hits are primarily policy text, hosted-reference labels, or static dataset URLs.
- Unsafe paths: no mutation planned around absolute local paths; normal answers should keep repo-relative paths.

## Selected Feature

- Ladder item: B. Referenced-file integrity improvement
- Bounded improvement: Add/refresh packaged-source sync evidence so reviewers can verify source and packaged SKILL reference guidance stay aligned.

## Non-Goals / Do Not Touch

- Do not modify unrelated application/runtime code.
- Do not delete files or rewrite existing generated artifacts outside the named skill/report paths.
- Do not auto-create, approve, or merge PRs.
- Do not stage pre-existing unrelated working-tree changes.

## Verification Plan

- Re-run secret/path metadata scan after edits.
- Verify SKILL frontmatter has non-empty `name` and `description`.
- Verify markdown reference links in changed skill docs resolve to local files where applicable.
- Commit and push Phase C before Phase D review/verification begins.
