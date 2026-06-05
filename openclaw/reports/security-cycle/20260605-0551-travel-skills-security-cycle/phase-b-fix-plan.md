# Phase B - Fix Plan

- Run ID: 20260605-0551-travel-skills-security-cycle
- Repo: pp-lounge-map
- Branch: codex/skill-security-cycle-20260402
- Head before phase: c00f769dfea7f4323345c64612de903b2a514506
- Push target: https://github.com/Bookingdesk-AI/pp-lounge-map-offline-skill.git codex/skill-security-cycle-20260402

## Plan
- Selected ladder item: B. Referenced-file integrity improvement
- Specific bounded feature: Strengthen offline package manifest validation so reviewer-critical root files are explicitly declared in requiredFiles.
- Severity: Low operator-trust gap: validator reads README/package.json, but the manifest requiredFiles list does not currently have to name those reviewer entrypoints.

## Assumptions
- Existing skill docs and validator structure are the stable interfaces.
- This run should not modify unrelated app/runtime behavior.
- Exact-path staging only, because at least one scoped repo has pre-existing dirty work.

## Non-goals / do-not-touch scope
- No destructive commands.
- No PR creation, approval, or merge.
- No hosted endpoint calls or secret-bearing diagnostics.
- No broad refactors or unrelated dirty-file staging.

## Verification method
- Re-run the repo offline-skill validator after edits.
- Re-run bounded secret/path scans.
- Verify frontmatter and referenced files through the validator output and direct post-scan summary.
