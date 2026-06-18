# Offline Travel Security Cycle — 2026-06-18

## Phase A — Security Review Snapshot

Scope: `skills/lounge-guru-offline` and exported offline bundle area.

Pre-scan checks performed:
- Listed bundled skill files and exported offline bundle files.
- Searched for common secret/token/private-key/password markers.
- Searched for online/offline trust-boundary drift markers including non-local URLs and remote-fetch terms.
- Inspected `SKILL.md`, `README.md`, safety reference, build script, and publish validation script.

Findings:
- No credential-like assignments or private-key markers found in bundled skill docs/scripts.
- Local/read-only/no-network boundary is documented in `SKILL.md`, README, and safety reference.
- The requested source path `skills/pp-lounge-map-offline` is not present in this repo; current source skill is `skills/lounge-guru-offline`, and export naming is controlled by build/export scripts.
- Existing publish validation checks frontmatter, local-path/private-source leaks, forbidden shell/API-key patterns, remote URLs in offline markdown, and asset size.

## Phase B — Fix Plan

Severity: low / defense-in-depth.

Selected bounded improvement:
- Extend offline publish validation to require that `SKILL.md` references the local MCP setup, safety boundary, and publishing guidance files, and that those files exist.

Reasoning:
- The offline skill already includes these references, but making them a release gate improves referenced-file integrity and reviewer trust in exported packages.

## Phase D — Review + Verify

Post-change verification:
- `npm run validate:publish:offline` passed with `publish-check: offline skill bundle passed.`
- Post-change scan found no credential-like values in the offline skill or modified validation files.
- The publish validation gate now requires `SKILL.md` to reference local MCP setup, safety boundary, and publishing guidance, and verifies each referenced file exists.

Changed files:
- `scripts/lib/publish-safety.mjs`
- `scripts/validate-publish-ready-offline.mjs`
