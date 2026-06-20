# Travel Skill Fix Plan - 2026-06-20

Scope: `out/pp-lounge-map-offline-skill/skills/pp-lounge-map-offline`.

## Severity classification

- Critical: none found.
- High: none found.
- Medium: requested source path `skills/pp-lounge-map-offline` is absent in this checkout, which can cause reviewers to validate the wrong path or fail before checking the packaged skill.
- Low: packaged skill lacks a local integrity validator script in the exported bundle.

## Selected bounded improvement

Add an exported bundle validation script and npm script that checks the packaged SKILL frontmatter, required references, runtime scripts, catalog artifact, markdown links, and secret/path leakage evidence.

## Safety notes

- Additive validation feature only.
- No destructive commands.
- Existing unrelated working-tree changes remain untouched.
