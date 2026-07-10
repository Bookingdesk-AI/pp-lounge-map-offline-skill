# Phase B Fix Plan — pp-lounge-map-offline

Run: cfc50a7c-66f2-4b9f-94a5-c8fc42e8b645
Time: 2026-07-10 16:42 UTC
Skill package: `out/pp-lounge-map-offline-skill`

## Severity classification

- Critical: none.
- High: none.
- Medium: none.
- Low: validator evidence can be clearer for scheme-relative endpoint drift (`//host/path`) because the current URL scan focuses on explicit HTTP(S) URLs.
- Evidence note: source path `skills/pp-lounge-map-offline` is absent in this checkout; bounded work targets the packaged offline skill under `out/pp-lounge-map-offline-skill`.

## Selected bounded improvement

Feature ladder item A: secret/boundary validation improvement.

Add validator detection and redacted reporting for scheme-relative URL-like references so offline skill reviews catch ambiguous endpoint drift before publish/update.

## Non-goals

- No runtime behavior changes.
- No deletion or refactor of skill docs.
- No network calls or hosted endpoint checks.
