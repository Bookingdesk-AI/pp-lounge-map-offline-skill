# Phase B — Fix Plan

## Finding PPL-LOW-02
- Severity: low
- Type: hardening gap (transport alias rejection not explicit)
- Evidence: source/packaged SKILL files enforce local transports, but they do not explicitly reject alias transports like `file://`, unix-socket aliases, or ssh-style host aliases.

## Minimal reversible fix
- Add one matching guardrail bullet to both source and packaged SKILL docs rejecting non-local transport aliases unless the user explicitly asks to leave offline mode.
- Reversible scope: documentation-only bullet addition kept source/package synchronized.
