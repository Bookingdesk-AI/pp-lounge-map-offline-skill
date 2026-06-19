# Lounge Guru Product Goal

Lounge Guru is the canonical airport lounge intelligence console for `desk.travel`.

The product should reach ExpertFlyer-grade utility for lounges: precise inventory, source evidence, change monitoring, fast search, and workflows that let operators trust the answer during real travel decisions.

## Benchmark

Comparable travel tools set the bar:

- ExpertFlyer: deep flight inventory, seat maps, seat alerts, and availability monitoring.
- point.me: award search across loyalty programs with booking-oriented result review.
- AwardFares: award availability, alerts, timeline views, and fast comparison.
- LoungeBuddy-style products: traveler-friendly lounge discovery, photos, access hints, and airport context.

Lounge Guru should not copy their visual style. It should copy the operational standard: structured data, fast answers, alerts, and confidence.

## Users

- Travel operations users checking lounge access for itineraries.
- Data stewards reviewing source freshness, conflicts, and field coverage.
- Product/internal users validating program, bank, airline, and operator coverage.

## Core Questions

- Which lounges can this traveler access?
- Where is the lounge?
- Is it open for this itinerary?
- What card, program, airline, cabin, or alliance grants access?
- What restrictions apply?
- What changed since last verification?
- Which source should we trust?
- Which records need review?

## Information Standard

Every claim must be source-grounded.

- Canonical lounge record with source-level provenance per field.
- Official/public source policy by default.
- Manual overrides must show owner, reason, date, and source conflict.
- Each record needs completeness, freshness, conflict count, and review status.
- Airport identity must normalize against OurAirports before fallback geocoding.
- Nominatim is fallback only and must remain rate-limited and cached.

Priority sources:

- Priority Pass
- American Express Global Lounge Collection
- Chase Sapphire Lounge
- Capital One Lounges
- United Club and Polaris Lounges
- Delta Sky Club
- American Airlines Admirals Club
- Air Canada Maple Leaf Lounges
- Plaza Premium Lounge
- Escape Lounges
- Airport Dimensions / The Club
- OurAirports

## Feature Standard

Map:

- Search by airport, city, country, lounge, brand, operator, program.
- Filter by access method, bank/card, airline, terminal, security side, status, quality.
- Compare up to three records.
- Detail panel shows location, hours, access, amenities, restrictions, sources, confidence, last verified.

Intake:

- Source runs, parse errors, changed fields, stale records, conflicts.
- Approve, reject, defer, assign review.
- Show diff from last approved value.

Schema:

- Canonical fields and coverage.
- Provider confidence.
- Missing-field heatmap.
- Required-field failures.

Sources:

- Registry, adapter, freshness target, last run, rights note.
- Source health, blocked status, manual-review count.
- Brand/logo coverage.

Monitoring:

- Hours changed.
- Lounge opened or closed.
- Access policy changed.
- Terminal/security-side changed.
- Source stale.
- Conflict introduced.

## Workflow Standard

Desktop:

- Left rail: search, filters, result density, compare tray.
- Center: map/table hybrid.
- Right panel: task-critical details.
- Intake and schema views use dense tables, diffs, badges, and bulk actions.

Mobile:

- Full parity through sheets: Results, Filters, Details, Compare, Review.
- No hover-only controls.
- Touch targets meet 44px minimum.
- Sheet state remains stable while filtering, selecting, and comparing.

## Aesthetic Standard

Tone: restrained, precise, operational.

Use:

- Light-neutral surfaces.
- Compact typography.
- Source and quality badges.
- Real brand logos where they clarify source or access.
- Strong focus states and table density.

Avoid:

- Hero sections.
- Marketing copy.
- Intro paragraphs.
- Redundant helper text.
- Decorative cards.
- Nested cards.
- Gradient or atmospheric travel styling.
- Hidden mobile functionality.

## Copy Standard

Use labels, values, statuses, errors, and actions.

Examples:

- `Open`
- `Stale`
- `Conflict`
- `Verified Jun 14`
- `Source mismatch`
- `Approve`
- `Compare`
- `Retry fetch`

Avoid:

- `Welcome`
- `Discover`
- `Unlock`
- `Seamless`
- `All-in-one`
- Generic helper sentences.

## Quality Gates

- Data: provenance required, schema validation, dedupe, airport normalization, conflict scoring.
- MCP: renamed resources, aliases, filters for provider/program/quality.
- UI: desktop and mobile parity, source badges, quality badges, intake review states.
- Copy: no marketing/helper copy on production surfaces.
- Build: `npm run lint`, `npx tsc -b`, `npx vite build`, `npm run test`.

## First Milestones

1. Goal contract: publish a machine-readable product goal and test it.
2. Source health: show stale/manual/blocked source counts in `Sources`.
3. Intake diff: expose field-level conflict rows.
4. Access filters: add bank/card/airline/program filters.
5. Mobile parity: shipped Compare and Review sheet modes.
6. Monitoring: emit source-change alerts from intake snapshots.
