# Worldwide Coverage Goal

Goal: official/public airport lounge coverage in Cloudflare D1 with provenance, quality state, and review history.

## Target

- Database: `lounge-guru-catalog`
- Binding: `LOUNGE_GURU_DB`
- Contract: `public/data/worldwide-coverage-goal.json`
- Intake runtime: `playwright`

## Scope

Included:

- Official public lounge, issuer, airline, alliance, operator, and open airport sources.
- Approved Priority Pass workbook as one source lane.
- Playwright-rendered source snapshots with raw pages kept in `.cache/source-snapshots`.

Excluded:

- Licensed/commercial global lounge providers.
- Login-only, private API, captcha, or account-bypass sources.
- Raw page bodies in git, public JSON, D1 catalog rows, or MCP payloads.

## Terminal Gate

```bash
npm run validate:coverage
npm run validate:json
npm run goal:coverage
```

Terminal criteria:

- Approved records: `>= 2,600`
- Approved ratio: `>= 98%`
- Required source family coverage: `100%`
- Review records: `0`
- Unknown airport records: `0`
- Records without source provenance: `0`
- Records without quality state: `0`
- D1 schema tables present
- Source intake runtime: `playwright`
- Ready source-lane proof: `100%`

## Current Gate

```text
Catalog: 2640 records, 2640 approved, 0 review
Non-PP: 886 records, candidates 886
Approved ratio: 100.00%
Source families: 100.00%
Source intake: playwright
Source proof: 14/16
Terminal goal: blocked (cloudflare_source_proof_incomplete)
```

Current source proof:

```text
Playwright intake: 20/32 sources fetched
Ready source-lane proof: 14/16
Blocked source lanes: united, american
Airport-code candidates: 517
Lounge-link candidates: 310
Licensed/commercial sources: skipped
```

Approval policy: `public/data/catalog-approval-policy.json`.

## Required Source Families

- Collinson networks: Priority Pass, LoungeKey, Collinson
- Bank issuer programs: Amex, Chase Sapphire, Capital One, Citi
- Airline alliance finders: Star Alliance, oneworld, SkyTeam
- Airline-operated lounges
- Operator-operated lounges: Plaza Premium, Escape, Airport Dimensions, Aspire, Marhaba, Primeclass, No1, Be Relax
- Open enrichment: OurAirports, OpenStreetMap, Nominatim

Card-network program pages remain tracked as source evidence, but they are not terminal inventory families because the public pages do not expose complete lounge inventories.

## Intake

Run bounded Cloudflare source intake:

```bash
LOUNGE_GURU_INTAKE_TOKEN=<redacted> LOUNGE_GURU_INTAKE_TIMEOUT_MS=240000 npm run intake:cloudflare
```

Current source-proof repair run:

```bash
LOUNGE_GURU_INTAKE_TOKEN=<redacted> LOUNGE_GURU_INTAKE_TIMEOUT_MS=240000 npm run intake:cloudflare -- --source-ids=united,american
```

Then rebuild:

```bash
npm run build:canonical-data
npm run build:mcp-data
npm run build:offline-skill
npm run validate:coverage
```

## Publish

Publish only reviewed records:

```bash
npm run db:catalog:push
npm run validate:coverage
npm run smoke:production
```

Do not approve a non-PP record unless airport identity, terminal/location, hours or opening state, access program, and source provenance match the cited official/public source.
