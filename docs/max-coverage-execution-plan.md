# Lounge Guru Max Coverage Plan

Updated: 2026-07-14

Objective: make Cloudflare D1 the canonical worldwide Lounge Guru catalog, with maximum official/public lounge coverage, field-level evidence, deterministic dedupe, and zero review debt.

## Current Baseline

Source of truth for this section: `public/data/coverage-gap-report.json`, `public/data/max-coverage-plan.json`, and `public/data/lounge-guru-catalog.json`.

| Metric | Current | Terminal target | Gap |
| --- | ---: | ---: | ---: |
| Approved records | 3,445 | >= 3,000 | 0 |
| Non-Priority Pass records | 2,021 | >= 1,300 | 0 |
| Review records | 0 | 0 | 0 |
| Unknown airport records | 0 | 0 | 0 |
| Records without sources | 0 | 0 | 0 |
| Records without field evidence | 0 | 0 | 0 |
| Hours coverage | 3,336 / 3,445 = 96.84% | >= 97% | 6 fields |
| Gate / near-gate coverage | 1,561 / 3,445 = 45.31% | >= 45% | 0 |
| Price coverage | 948 / 3,445 = 27.52% | >= 25% | 0 |
| Source-family coverage | 100% | 100% | 0 |
| Cloudflare source evidence | 16 / 16 fetched sources | 100% | 0 |

Terminal status: blocked only by `hours_coverage_below_target`.

Immediate target: add or merge six official hours fields, then pass `npm run goal:coverage`.

## Max Coverage Definition

Max coverage does not mean importing every web mention of a lounge. A record is publishable only when it is one of these:

- approved as a deduped physical lounge with airport identity, source evidence, field evidence, and quality state;
- merged into a stronger physical lounge identity;
- rejected with a reason;
- blocked with source evidence, rights evidence, robots evidence, HTTP evidence, or challenge evidence.

No source lane is considered done until it has a run record, snapshot hash or approved source file pointer, parser version, candidate counts, promotion counts, blockers, and field coverage deltas.

## Boundaries

Accepted:

- Official lounge operator pages.
- Official airline and alliance lounge pages.
- Official airport authority pages.
- Official issuer, card, bank, and lounge-pass pages for access evidence.
- Approved Priority Pass source lane.
- OurAirports and approved centralized all-routes airport data for airport normalization.
- Nominatim only as a rate-limited fallback, not autocomplete or systematic POI intake.

Rejected:

- Login-only data.
- CAPTCHA or bot-challenge bypass.
- Private API replay.
- Commercial or licensed global lounge feeds without approved terms.
- Blogs, snippets, screenshots, and unverifiable secondary pages.
- Inferred gate, price, or hours data.

## D1 Canonical Contract

Canonical database: Cloudflare D1 `lounge-guru-catalog`.

Required tables or equivalent views:

| Area | Tables |
| --- | --- |
| Source registry | `source_targets`, `source_fetch_runs`, `source_snapshots`, `source_parse_runs` |
| Candidate intake | `source_candidates`, `candidate_field_values`, `candidate_blockers` |
| Canonical identity | `lounges`, `lounge_identity_links`, `lounge_airports`, `lounge_locations` |
| Provenance | `record_field_evidence`, `source_documents`, `source_rights_notes` |
| Quality | `lounge_field_coverage`, `metadata_conflicts`, `review_queue`, `coverage_validation_runs` |
| Published artifacts | `catalog_publication_runs`, `catalog_exports` |

Generated files remain build artifacts:

- `public/data/lounge-guru-catalog.json`
- `mcp/data/catalog.json`
- `skills/lounge-guru-offline/assets/catalog.json`
- `public/data/coverage-gap-report.json`
- `public/data/max-coverage-plan.json`

Raw snapshots stay out of git. D1 stores source IDs, content hashes, parser versions, field evidence, and R2/local snapshot pointers.

## Field Authority

Use the strongest source per field:

1. Lounge operator detail or booking page.
2. Airline owner/operator page.
3. Official airport authority page.
4. Alliance finder.
5. Issuer, bank, card, or lounge-pass page.
6. Open airport normalization source.

Issuer and pass pages can prove access. They cannot overwrite stronger operator, airline, or airport location fields.

## Source Lanes

| Lane | Use |
| --- | --- |
| Priority Pass | Broad baseline, duplicate detection, access evidence |
| Plaza Premium | Operator hours, location, amenities, paid access |
| Airport Dimensions / The Club | Operator hours, location, amenities, paid access |
| Escape, Aspire, No1, Marhaba, Primeclass | Operator details, paid access, gate text |
| Amex Global Lounge Collection | Centurion, Escape partner, Plaza Premium, Delta/Lufthansa access evidence |
| Chase Sapphire, Capital One, Citi | Bank-operated or bank-access lounge evidence |
| Mastercard Travel Pass, LoungeKey, Visa Airport Companion, DragonPass | Public program/access evidence only unless terms approve more |
| United, Delta, American, Air Canada | Airline-owned lounge inventory, hours, status, access rules |
| Qantas, Qatar, Singapore Airlines | Airline-owned and partner lounge details |
| Star Alliance, oneworld, SkyTeam | Program-family discovery and tier evidence |
| Airport authority pages | Exact gate, near-gate, terminal, opening hours, closures |
| all-routes / OurAirports | Airport identity, city, country, timezone, coordinates |

## Execution Plan

### Phase 0: Close Current Terminal Blocker

Goal: make the existing catalog pass strict validation.

Actions:

1. Rebuild current reports: `npm run build:canonical-data`.
2. Inspect missing hours by physical lounge identity, not source-candidate count.
3. Exclude non-physical access-pass products from Plaza Premium and similar operator pages.
4. Merge official candidates into stronger existing records when the same physical lounge is proven by airport, terminal, normalized name, and compatible gate/location.
5. Add official hours evidence only from operator, airline, airport, or approved source data.
6. Rebuild canonical, MCP, and offline artifacts.
7. Run terminal validation.

Acceptance:

- `npm run validate:json`
- `npm run validate:coverage`
- `npm run goal:coverage`
- `env -u CLOUDFLARE_API_TOKEN -u CF_API_TOKEN npm run db:catalog:smoke`

### Phase 1: Make D1 The Operating Source Of Truth

Goal: stop treating repository JSON as canonical state.

Actions:

1. Apply the D1 schema for source runs, candidates, identity links, field evidence, and coverage validations.
2. Push the current approved catalog into D1 only after strict goal validation passes.
3. Export public JSON, MCP catalog, and offline bundle from D1 snapshots.
4. Add a D1 parity test: D1 export hash must match generated public catalog hash for the same publication run.
5. Add smoke endpoints for catalog count, source count, quality counts, and latest validation run.

Acceptance:

- D1 has 3,445 or more approved records.
- D1 has zero review records.
- D1 has zero unknown-airport records.
- D1 latest validation row matches `coverage-gap-report.json`.
- Public JSON is reproducible from the D1 publication run.

### Phase 2: Expand Official Coverage Breadth

Goal: exhaust official/public source lanes before adding lower-confidence sources.

Work order:

1. Airport authority top backlog: `PVG`, `LHR`, `BKK`, `SIN`, `JFK`, `DOH`, `PKX`, `ICN`, `BOM`, `BLR`.
2. Operator price/detail backlog: `plaza-premium`, `primeclass`, `aspire-lounges`, `airport-dimensions`, `be-relax`, `marhaba`, `no1-lounges`, `escape-lounges`.
3. Airline-owned backlog: `united`, `delta`, `american`, `air-canada`, `qantas`, `qatar-airways`, `singapore-airlines`.
4. Alliance backlog: `star-alliance`, `oneworld`, `skyteam`.
5. Bank and pass backlog: `amex-global-lounge-collection`, `chase-sapphire`, `capital-one`, `mastercard-travel-pass`, `visa-airport-companion`, `dragonpass`, `loungekey`.

Acceptance per lane:

- source registry entry exists;
- fetch run exists;
- snapshot hash or approved file pointer exists;
- parser fixture exists;
- candidates are normalized;
- every promoted field has evidence;
- conflicts are either resolved or queued;
- blockers are written, not hidden.

### Phase 3: Raise Quality Targets

Goal: move from terminal v1 coverage to production-grade depth.

Targets after Phase 0:

| Metric | Current | Next quality target |
| --- | ---: | ---: |
| Hours coverage | 96.84% | 99% |
| Gate / near-gate coverage | 45.31% | 60% |
| Price coverage | 27.52% | 40% |
| Official source families | 100% | 100% maintained |
| Review queue | 0 | 0 maintained |

Rules:

- Do not trade quality ratios down for raw record count.
- New records must carry at least source, airport identity, location text, and one task-critical field.
- If a large source adds weak records, publish only after it also improves or preserves coverage ratios.
- Airport map proximity can support review, but cannot create a gate field by itself.

### Phase 4: Coverage Review Workflow

Goal: make review deterministic and fast.

Review queue columns:

- candidate ID;
- canonical lounge ID;
- source ID;
- airport;
- normalized name;
- terminal/gate match state;
- source field values;
- conflicting canonical values;
- proposed action: merge, create, reject, block;
- reviewer;
- reviewed at.

Auto-approve only when:

- same airport;
- compatible terminal/security side;
- exact or family-normalized lounge name;
- no stronger-source conflict;
- every promoted field has evidence;
- no duplicate physical lounge would be created.

Manual review when:

- same airport and similar name but terminal differs;
- alliance page names a partner lounge but operator source names another brand;
- source has generic city/airport page without lounge-level detail;
- price offer is product-level instead of lounge-level;
- source includes spa, restaurant, suite, or access-pass products.

### Phase 5: UI And API Presentation

Goal: expose coverage confidence without dev-only noise.

User-facing catalog fields:

- lounge name with airline, lounge brand, or credit-card logo;
- airport, terminal, gate/near-gate;
- hours in compact local format;
- access programs grouped by family and tier;
- price/access offers when official amount and currency exist;
- facilities with compact icons;
- source links;
- confidence and last verified.

Internal-only surfaces:

- source proof counts;
- fetch status;
- parser status;
- conflict details;
- D1 publication hashes;
- validation run details.

Production guardrail: dev proof panels render only in explicit dev mode.

## Terminal Commands

Use this loop for every bounded coverage run:

```bash
npm run build:canonical-data
jq '.current, .deltas, .blockers, .nextCloudflareIntake' public/data/coverage-gap-report.json
jq '.terminalBurndown, .airportEnrichmentBacklog[0:10], .priceOfferWorklist[0:10], .sourceBacklog[0:12]' public/data/max-coverage-plan.json
npm run build:mcp-data
npm run build:offline-skill
npm run validate:json
npm run validate:coverage
npm run goal:coverage
env -u CLOUDFLARE_API_TOKEN -u CF_API_TOKEN npm run db:catalog:smoke
```

D1 publish rule:

- publish only after strict local validation passes;
- intermediate D1 refreshes must be explicitly labeled as intermediate;
- do not bypass Cloudflare, source rights, CAPTCHA, login, or robots blockers.

## Definition Of Done

Max coverage v1 is done when:

- `npm run goal:coverage` passes;
- D1 contains the canonical approved catalog;
- public JSON, MCP catalog, and offline bundle are reproducible from the D1 publication run;
- all official source lanes are either fetched, skipped by policy, blocked with evidence, or queued with a concrete next run;
- review queue is zero;
- unknown airports are zero;
- records without field evidence are zero;
- production UI hides dev-only proof panels.

Max coverage remains an ongoing crawl-and-review program after v1. The monthly maintenance gate is: rerun source probes, refresh official snapshots, diff field changes, resolve conflicts, publish a new D1 catalog run, and smoke `loungeguru.desk.travel`.
