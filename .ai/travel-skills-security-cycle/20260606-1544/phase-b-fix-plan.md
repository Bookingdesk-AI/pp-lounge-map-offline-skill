# Phase B Fix Plan — 20260606-1544

Repo: /Users/kh/Coding/pp-lounge-map
Branch: cron/travel-skills-security-cycle-20260606-1544
Input evidence: .ai/travel-skills-security-cycle/20260606-1544/phase-a-security-review.md

## Classification
- Severity: Low: manifest and package exist; improvement increases operator evidence around exported bundle commands.
- Selected ladder item: C. Operator evidence improvement
- Bounded feature: Add publish-readiness evidence that the exported offline package README explicitly documents the manifest validation command and local MCP command, improving reviewer trust in packaged instructions.

## Non-goals / do-not-touch
- No destructive commands.
- No runtime refactor.
- No deploy or PR creation.
- Preserve offline-only trust boundary.

## Verification method
- Run the repo's offline skill validator.
- Re-run secret/boundary/path scan after edits.
- Verify frontmatter and referenced files.
