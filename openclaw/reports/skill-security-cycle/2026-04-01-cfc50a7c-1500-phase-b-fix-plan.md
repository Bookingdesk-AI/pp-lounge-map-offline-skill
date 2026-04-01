# Phase B — Fix Plan

Run: 2026-04-01-cfc50a7c-1500
Repo: /Users/kh/Coding/pp-lounge-map

## Findings Classification
1. Low — Safety docs enforce loopback-only transports but do not explicitly call out wildcard-DNS loopback aliases (`*.nip.io`, `*.sslip.io`, `*.xip.io`) as out-of-boundary.

## Minimal Reversible Fix Plan
- Add one bullet to `references/safety.md` in both source and packaged skill trees clarifying wildcard-DNS loopback aliases are non-local unless explicitly exiting offline mode.
- Scope is docs-only and reversible by removing one synchronized bullet from both files.
