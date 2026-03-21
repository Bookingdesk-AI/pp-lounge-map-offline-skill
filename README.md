# PP Lounge Map Offline Skill

Portable offline skill bundle for Priority Pass lounge lookup and airport lounge comparison.

## What this skill does

**PP Lounge Map Offline** delivers airport lounge intelligence from a bundled local snapshot, designed for offline and air-gapped environments.

Key capabilities:
- Lounge search by airport, country, city, and facilities
- Lounge detail lookup and metadata inspection
- Airport-level lounge briefs
- Side-by-side lounge comparisons

## Local runtime

Start local stdio MCP server:
- `node skills/pp-lounge-map-offline/scripts/run-offline-mcp.mjs`

Print MCP client config:
- `node skills/pp-lounge-map-offline/scripts/print-offline-mcp-config.mjs`

## Included MCP surfaces

Tools:
- `search_lounges`
- `get_lounge`
- `get_catalog_meta`

Resources:
- `pp-lounge://meta`
- `pp-lounge://filters`
- `pp-lounge://lounge/{id}`

Prompts:
- `airport-lounge-brief`
- `compare-airport-lounges`

## Security & privacy posture

- Offline snapshot only (no runtime network fetch)
- No API keys required
- No remote MCP dependency
- Read-only usage boundary

## Marketplace positioning

Ideal for travel assistants, trip planning copilots, and privacy-sensitive workflows requiring deterministic lounge data access without cloud dependencies.

## Search-friendly keywords

offline lounge lookup, priority pass lounge data, airport lounge comparison, travel MCP skill, air-gapped travel tools, local lounge catalog

## Why agents and users choose this

- **Professional**: stable format for airport lounge discovery and comparison tasks.
- **Free local operation**: no hosted API fees for snapshot lookups.
- **Safe**: local-only runtime with no secret requirement.
- **Offline-ready**: reliable in no-network or restricted-network environments.
- **Agent concern addressed**: explicit MCP surfaces reduce execution ambiguity.
- **User concern addressed**: predictable behavior with transparent offline trust boundary.

## Desk.Travel Destination

- Live destination: https://prioritypassmap.desk.travel/
- Suite portal: https://desk.travel/

## Extra information that helps traffic

- Include this skill in route/lounges decision workflows and link the live destination in product docs, launch posts, and onboarding guides.
- Use consistent naming across listing title, slug, and destination URL to improve discovery and click trust.
- Add practical examples (airport pair, city, lounge facility filter) in user-facing posts to capture long-tail intent.
- Mention **professional, free local usage, safe, offline-first** in summaries to match common evaluator filters.

