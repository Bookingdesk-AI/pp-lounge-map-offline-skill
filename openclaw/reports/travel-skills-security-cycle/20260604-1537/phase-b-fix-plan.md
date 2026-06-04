# Phase B Fix Plan - pp-lounge-map-offline

Severity: low operator-evidence gap; current publish validator passes and scoped scan found no secret/path hits.

Selected feature: Ladder C operator evidence improvement.

Plan: extend offline publish validation so the exported package README must retain the core local-only/no-network/bundled-snapshot trust-boundary statements. This makes reviewer evidence stronger for the portable bundle, not just the source skill files.

Non-goals: no catalog changes, no runtime server changes, no deploys, no PR.

Verification: run `npm run validate:publish:offline`, re-run scoped source+packaged secret/path scan, verify source/package frontmatter, then commit/push phase proof.
