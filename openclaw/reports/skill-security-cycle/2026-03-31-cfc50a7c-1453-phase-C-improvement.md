# Phase C — Improvement (bounded)

## Shipped improvement (1/1 for repo)
- Updated offline safety docs (source + packaged copy) to explicitly forbid using catalog `url` metadata as health-check/probe targets; diagnostics must stay on local transports/endpoints.

## Reversibility
- One mirrored policy line in two synchronized safety docs; revertable with one commit.
