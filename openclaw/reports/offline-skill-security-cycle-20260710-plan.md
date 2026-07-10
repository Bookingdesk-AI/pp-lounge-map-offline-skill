# Offline Skill Security Cycle Fix Plan — 2026-07-10

## Severity classification

- Critical: none found in offline skill source/export pre-scan.
- High: none found in offline skill source/export pre-scan.
- Medium: exported-bundle integrity evidence can be more explicit when source and export checks are summarized in one validation output.
- Low: operator trust can improve through clearer publish-check evidence without changing runtime behavior.

## Selected bounded improvement

Improve offline publish-ready evidence so reviewers can quickly see source bundle integrity, exported bundle integrity, required references, required asset, and markdown URL policy in one redacted validation summary.

## Safety properties

- Additive validation/reporting only.
- No deletion or runtime behavior change.
- No credential values emitted; evidence remains path/count/digest based.
