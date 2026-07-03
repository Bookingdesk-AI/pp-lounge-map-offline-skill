# Lounge Guru Offline Skill

Offline-first airport lounge lookup and comparison skill.

## Overview

**Lounge Guru Offline** is a portable MCP-ready skill bundle for airport lounge discovery in local or air-gapped environments.

It is designed for deterministic, privacy-conscious workflows where network-dependent data fetching is not desired.

## Capabilities

- Airport lounge search and filtering
- Lounge detail lookup by ID
- Airport-level lounge brief generation
- Side-by-side lounge comparison
- Catalog metadata introspection

## Local MCP runtime

Start local stdio server:

```bash
node skills/lounge-guru-offline/scripts/run-offline-mcp.mjs
```

Print client config:

```bash
node skills/lounge-guru-offline/scripts/print-offline-mcp-config.mjs
```

## Security & trust boundary

- Uses bundled snapshot data only
- No runtime internet fetch required
- No secret/API key requirement
- Read-only query workflows

## Required offline references

- Local MCP setup: [references/mcp.md](references/mcp.md)
- Offline trust boundary: [references/safety.md](references/safety.md)
- Marketplace packaging notes: [references/publishing.md](references/publishing.md)
- Operator trust evidence checklist: [references/operator-trust-evidence.md](references/operator-trust-evidence.md)

## Keywords

offline lounge lookup, priority pass lounge map, airport lounge comparison, travel MCP skill, local lounge catalog, air-gapped travel tooling

## Why agents and users choose this

- **Professional**: consistent lounge lookup and comparison format for travel planning workflows.
- **Free local usage**: no paid API key needed for bundled snapshot queries.
- **Safe and private**: local snapshot processing with no runtime remote dependency.
- **Offline-first**: ideal for constrained, air-gapped, or reliability-critical environments.
- **Agent concern addressed**: strict read-only boundaries reduce unsafe or invalid actions.
- **User concern addressed**: clear expectation that data is snapshot-based, not live internet data.

## Desk.Travel Destination

- Live destination: available in the companion online listing.
- Suite portal: available in the Desk.Travel product directory.

## Extra information that helps traffic

- Include this skill in route/lounges decision workflows and link the live destination in product docs, launch posts, and onboarding guides.
- Use consistent naming across listing title, slug, and destination URL to improve discovery and click trust.
- Add practical examples (airport pair, city, lounge facility filter) in user-facing posts to capture long-tail intent.
- Mention **professional, free local usage, safe, offline-first** in summaries to match common evaluator filters.
