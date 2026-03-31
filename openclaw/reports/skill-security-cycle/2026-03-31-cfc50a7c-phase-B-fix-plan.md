# Phase B — Fix Plan

## Findings and severity
1. Bundled dataset (`assets/catalog.json`) contains many public non-loopback URLs.
   - Severity: **low**
   - Rationale: static catalog metadata, not executable network instructions.

## Minimal reversible fix plan
- Add one explicit guardrail bullet in source+packaged `SKILL.md` clarifying `0.0.0.0` is not a client endpoint for offline runtime unless user explicitly overrides trust boundary.
