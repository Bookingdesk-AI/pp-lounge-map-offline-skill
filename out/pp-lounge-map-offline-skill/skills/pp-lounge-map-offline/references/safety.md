# Offline Safety

This offline skill is intentionally narrow.

It may:

- query the bundled lounge snapshot through local MCP
- summarize or compare returned lounge records
- read bundled catalog metadata and filter lists

It must not:

- call remote MCP endpoints
- use non-loopback transports for MCP access (allow only `stdio`, `127.0.0.1`, or `localhost` unless the user explicitly exits offline mode)
- treat wildcard-DNS loopback aliases (for example `*.nip.io`, `*.sslip.io`, `*.xip.io`) as non-local unless the user explicitly exits offline mode
- bind helper scripts/services to non-loopback hosts (for example `0.0.0.0`) unless the user explicitly approves leaving offline trust boundaries
- fetch network resources
- ask for secrets
- trigger deploys or data rebuilds
- treat bundled `url` fields as network fetch instructions
- use catalog `url` fields as health-check/probe targets (diagnostics must stay on local transports/endpoints)
- quote catalog `url` values with credential-like fragments or query strings unredacted
- treat endpoint URL userinfo (including percent-encoded userinfo delimiters such as `%40`/`%3A` before `@`) as secret-bearing/out-of-boundary and redact it in offline responses
- treat non-HTTP(S) catalog URL schemes (for example `javascript:` or `data:`) as executable content; they are invalid metadata in offline mode
- claim that the bundled snapshot is live data

If a request needs fresher data than the bundled snapshot provides, say that the offline bundle is stale rather than guessing.

Packaging hygiene:
- Keep this safety file synchronized with `out/pp-lounge-map-offline-skill/skills/pp-lounge-map-offline/references/safety.md` before publishing to avoid safety-policy drift between source and packaged bundles.

Self-check command:
- Before publish, run a scoped secret/path scan and report metadata only (path + line), never raw secret-like substrings:

```bash
rg -n --hidden -S '(AKIA[0-9A-Z]{16}|-----BEGIN (RSA|EC|OPENSSH|PGP|PRIVATE) KEY-----|xox[baprs]-|ghp_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{20,}|AIza[0-9A-Za-z\-_]{35}|sk-[A-Za-z0-9]{20,}|(?i)(api[_-]?key|secret|token|password)\s*[:=]\s*[^ ]+|/Users/[A-Za-z0-9._-]+)' skills/pp-lounge-map-offline out/pp-lounge-map-offline-skill/skills/pp-lounge-map-offline
```
