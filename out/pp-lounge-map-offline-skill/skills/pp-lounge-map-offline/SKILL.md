---
name: pp-lounge-map-offline
description: Use this skill when you need offline or air-gapped access to the bundled Priority Pass lounge catalog. Trigger it for local lounge lookup, facility filtering, airport briefs, and lounge comparisons when network access is unavailable or disallowed. Do not use it for data rebuilds, deploys, remote MCP endpoints, arbitrary shell execution, or any workflow that depends on live internet access.
metadata:
  openclaw:
    requires:
      bins:
        - node
        - npm
    install:
      - id: node
        kind: node
        package: "@modelcontextprotocol/sdk"
        label: Install MCP runtime dependencies (run npm install in bundle root)
---

# PP Lounge Map Offline

Use this skill when the task is about the bundled offline lounge snapshot.

## Runtime requirements

- Node.js 20+ available on PATH (`node`).
- Install package dependencies in the bundle root before running runtime scripts:
  - `npm install`
- Required packages are declared in `package.json` (`@modelcontextprotocol/sdk`, `zod`).

## Quick start

1. Start the local stdio MCP server with `node skills/pp-lounge-map-offline/scripts/run-offline-mcp.mjs`.
2. Prefer the local MCP tools and resources over direct file parsing.
3. Keep answers grounded in the bundled snapshot only.

## Safety boundary

- This skill is local and read-only at runtime.
- It must not use network access (except local process startup/dependency install done by operator).
- It must not ask for API keys or secrets.
- It must not reference sibling workbooks, remote MCP endpoints, or deploy workflows.
- It must only run against local transports (`stdio`, `127.0.0.1`, `localhost`, or `::1`) unless the user explicitly asks to leave offline mode.
- Treat `0.0.0.0` bind/listen addresses as non-client targets; do not use them as runtime endpoint URLs unless the user explicitly asks to leave offline mode.
- Treat transport aliases outside those local forms (for example `file://`, unix-socket aliases, or ssh-style host aliases) as out-of-boundary unless the user explicitly asks to leave offline mode.
- Treat non-loopback literal IP endpoint hosts (for example RFC1918 private ranges, link-local ranges, or IPv6 ULA ranges) as out-of-boundary unless the user explicitly asks to leave offline mode.
- Treat obfuscated loopback endpoint hosts (for example integer/octal/hex IP literals, IPv4-mapped aliases, or percent-encoded host forms) as out-of-boundary unless the user explicitly asks to leave offline mode.
- Treat endpoint hosts with encoded host-label separators (for example `%2e` or `%252e` used in place of `.`) as hostname-obfuscation and out-of-boundary unless the user explicitly asks to leave offline mode.
- Treat endpoint hosts containing Unicode dot-equivalent host separators (for example `U+3002`, `U+FF0E`, or `U+FF61`) as hostname-obfuscation and out-of-boundary unless the user explicitly asks to leave offline mode.
- Treat shorthand loopback IPv4 host forms (for example `127.1` or `127.0.1`) as out-of-boundary unless the user explicitly asks to leave offline mode.
- Treat IPv6 loopback zone-index host forms (for example `[::1%lo0]`) as out-of-boundary unless the user explicitly asks to leave offline mode.
- Treat hostname endpoints as local only when the host is exactly `localhost`; require explicit leave-offline confirmation for lookalike or custom hostnames (for example `localhost.localdomain` or `devbox.lan`).
- Treat Unicode or IDNA/punycode hostname variants (for example homoglyph lookalikes of `localhost` or `xn--` host labels) as out-of-boundary unless the user explicitly asks to leave offline mode.
- Treat trailing-dot localhost forms (for example `localhost.`) as out-of-boundary unless the user explicitly asks to leave offline mode.
- Treat endpoint hosts containing empty DNS labels or repeated-dot separators (for example `.localhost`, `localhost..`, or `127..0.0.1`) as hostname-obfuscation and out-of-boundary unless the user explicitly asks to leave offline mode.
- Treat wildcard-DNS loopback aliases (for example `*.nip.io`, `*.sslip.io`, or `*.xip.io`) as non-local unless the user explicitly asks to leave offline mode.
- Treat endpoint URLs containing control characters or escaped whitespace/newline obfuscation as out-of-boundary unless the user explicitly asks to leave offline mode.
- Treat endpoint hosts containing non-ASCII Unicode whitespace code points (for example `U+00A0`, `U+1680`, `U+2000`-`U+200A`, or `U+3000`) as hostname-obfuscation and out-of-boundary unless the user explicitly asks to leave offline mode.
- Treat endpoint hosts containing bidirectional-control or zero-width Unicode code points (for example `U+200B`, `U+200C`, `U+200D`, `U+202A`-`U+202E`, or `U+2066`-`U+2069`) as hostname-obfuscation and out-of-boundary unless the user explicitly asks to leave offline mode.
- Treat endpoint URLs containing encoded NUL or encoded line-break bytes (for example `%00`, `%0d`, or `%0a`) as parser-obfuscation and out-of-boundary unless the user explicitly asks to leave offline mode.
- Treat scheme-relative endpoint URLs (for example `//host:port/path`) as out-of-boundary unless the user explicitly asks to leave offline mode.
- Require explicit local transport schemes (`stdio`, `http`, `https`) and loopback hosts; treat `ws`/`wss`/`data`/`blob`/scheme-less endpoint forms as out-of-boundary unless the user explicitly asks to leave offline mode.
- For `http`/`https` local endpoints, require the canonical MCP path `/mcp` after normalization; treat alternate or encoded path variants as out-of-boundary unless the user explicitly asks to leave offline mode.
- Treat loopback MCP endpoint ports outside the expected local default (`8788`) as trust-boundary sensitive; require explicit user confirmation before use to avoid hitting unrelated local services.
- If a local endpoint probe returns an HTTP redirect, do not follow it unless the normalized redirect target remains loopback and preserves the canonical `/mcp` boundary.
- Treat `url` fields in the bundled catalog as display metadata only; never fetch them in offline mode.
- If catalog or endpoint URLs must be shown for diagnostics, normalize to origin form and suppress userinfo/query/fragment before logging or responding.
- Treat endpoint URLs that include URL userinfo (for example `http://<credentials>@localhost/...`) as secret-bearing and out-of-boundary in offline mode; use redacted placeholders instead.
- Treat endpoint authorities with percent-encoded userinfo delimiters (for example `%40` or `%3A` before `@`) as obfuscated credential-bearing forms and out-of-boundary unless the user explicitly asks to leave offline mode.
- Treat endpoint authorities with repeated `@` delimiters as credential-obfuscation and out-of-boundary unless the user explicitly asks to leave offline mode.
- Treat endpoint authorities containing percent-encoded port delimiters (for example `%3A` or `%253A` after host labels) as authority-obfuscation and out-of-boundary unless the user explicitly asks to leave offline mode.
- Treat endpoint authorities containing percent-encoded semicolon delimiters (for example `%3B` or `%253B`) as parameter-smuggling obfuscation and out-of-boundary unless the user explicitly asks to leave offline mode.
- Treat endpoint authorities containing percent-encoded query or fragment delimiters (for example `%3F`, `%23`, `%253F`, or `%2523`) as delimiter-smuggling obfuscation and out-of-boundary unless the user explicitly asks to leave offline mode.
- Treat endpoint authorities containing percent-encoded slash or backslash delimiters (for example `%2F` or `%5C`) as authority-smuggling obfuscation and out-of-boundary unless the user explicitly asks to leave offline mode.
- Treat endpoint authorities containing percent-encoded IPv6 bracket delimiters (for example `%5B`, `%5D`, `%255B`, or `%255D`) as authority-obfuscation and out-of-boundary unless the user explicitly asks to leave offline mode.
- Treat endpoint authorities containing double-encoded authority delimiters (for example `%2540`, `%252F`, or `%255C`) as layered-obfuscation and out-of-boundary unless the user explicitly asks to leave offline mode.
- Treat endpoint authorities containing Unicode fullwidth authority delimiters (for example `＠`, `：`, `／`, `＼`, `？`, or `＃`) as delimiter-obfuscation and out-of-boundary unless the user explicitly asks to leave offline mode.
- Treat endpoint authorities containing Unicode compatibility characters whose NFKC/NFKD normalization can collapse into structural delimiters (`@`, `:`, `/`, `\`, `.`, `?`, `#`) as delimiter-obfuscation and out-of-boundary unless the user explicitly asks to leave offline mode.
- Treat endpoint URLs as out-of-boundary when one-pass or two-pass URL decoding introduces new authority delimiters (`@`, `:`, `/`, `\`) or changes host/scheme semantics unless the user explicitly asks to leave offline mode.
- Treat endpoint URLs as out-of-boundary when one-pass or two-pass URL decoding introduces query (`?`) or fragment (`#`) delimiters before the canonical local path boundary unless the user explicitly asks to leave offline mode.
- If mixed raw/encoded query and fragment delimiters (for example `%3F` with `%23`, or `?` with `%23`) could change delimiter precedence before the canonical local path boundary across decode passes, classify the diagnostic reason as `delimiter-precedence-ambiguity` and treat the endpoint as out-of-boundary unless the user explicitly asks to leave offline mode.
- Treat endpoint URL path segments that look token-like (for example JWT-style `x.y.z` blobs or long opaque IDs) as secret-bearing; redact those segments before logging or echoing diagnostics.
- Treat endpoint URLs containing encoded or mixed dot-segment traversal forms (for example `%2e`, `%2e%2e`, `/./`, or `/../`) as path-obfuscation and out-of-boundary unless the user explicitly asks to leave offline mode.
- If decode-pass ordering could place the same endpoint into multiple obfuscation categories, use a deterministic `decode-order-ambiguity` reason category and avoid disclosing pass-by-pass parser behavior.
- When rejecting endpoint obfuscation in diagnostics, report only the reason category (for example credential-obfuscation, authority-smuggling, parser-obfuscation, or path-obfuscation) and avoid echoing raw endpoint strings.
- For automated security scans, treat `skills/pp-lounge-map-offline/assets/catalog.json` URL entries as static dataset content, not outbound-call instructions.
- If quoting catalog `url` values in responses, strip query strings and any credential-like fragments before echoing.
- If asked for live lounge availability/status, explicitly state the bundled snapshot can be stale and requires an online source refresh.
- Avoid exposing absolute local bundle paths (for example `<absolute-local-path>`) in standard answers; provide relative bundle paths unless debugging is explicitly requested.
- If the user provides command snippets containing credential values (token, password, key), replace values with placeholders before echoing examples.
- Avoid broad environment/config dumps (`env`, `printenv`, full `.env` cat) in troubleshooting; request only scoped variable names and redact values with placeholders.
- Before publish, verify `references/safety.md` stays synchronized with `skills/pp-lounge-map-offline/references/safety.md` to prevent source/package policy drift.
- If the bundled snapshot does not contain the needed answer, say so instead of inventing newer data.

## Available workflows

- Airport-specific lounge lookup
- Facility and type filtering
- Offline lounge comparisons
- Catalog metadata and filter introspection

## Resources

- Local MCP setup: [references/mcp.md](references/mcp.md)
- Offline trust boundary: [references/safety.md](references/safety.md)
- Marketplace packaging notes: [references/publishing.md](references/publishing.md)
