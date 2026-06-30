# Operator trust evidence checklist

Use this checklist before publishing or updating the offline lounge skill package.

## Trust boundary

- Runtime lookup is local and read-only against the bundled catalog snapshot.
- Network access is not part of normal runtime behavior; dependency installation is an operator setup step, not live data retrieval.
- Only `stdio`, `127.0.0.1`, and `localhost` transports are in-boundary unless the user explicitly asks to leave offline mode.

## Secret handling

- Do not ask for API keys, cookies, membership credentials, or hosted MCP tokens.
- Do not include sibling workbook paths, source intake credentials, deploy instructions, or remote MCP endpoints in offline answers.
- Report scan findings as counts and file/line locations only; avoid echoing token-like values.

## Referenced-file integrity

- Confirm `references/mcp.md`, `references/safety.md`, and `references/publishing.md` exist in the packaged skill.
- Confirm the bundled `assets/catalog.json` is present before describing lookup availability.
- Treat missing references or missing catalog assets as publication blockers.

## Failure guidance

If a check fails, stop publication and name the blocker: missing catalog, missing reference, out-of-boundary transport, secret-like evidence, or package drift between source and exported offline skill.
