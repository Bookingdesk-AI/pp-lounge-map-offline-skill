# Worldwide Coverage Goal

Goal: all known airport lounges worldwide in Cloudflare D1 with source provenance, quality state, and review history.

## Target

- Database: `lounge-guru-catalog`
- Binding: `LOUNGE_GURU_DB`
- Migration: `migrations/0001_lounge_guru_catalog.sql`
- Contract: `public/data/worldwide-coverage-goal.json`

## Terminal Gate

Run:

```bash
npm run goal:coverage
```

This exits non-zero until the terminal goal passes.

Progress check:

```bash
npm run validate:coverage
npm run validate:json
npm run intake:evidence
```

Gap report: `public/data/coverage-gap-report.json`.
Cloudflare intake plan: `public/data/cloudflare-source-intake-plan.json`.
Cloudflare source-run evidence: `public/data/cloudflare-source-run-evidence.json`.

## Terminal Criteria

- Approved records: `>= 3,800`
- Approved ratio: `>= 98%`
- Required source family coverage: `100%`
- Review records: `0`
- Unknown airport records: `0`
- Records without source provenance: `0`
- Records without quality state: `0`
- D1 schema tables present
- Source intake runtime: `cloudflare`

## Required Source Families

- Licensed global baseline: LoungeReview API, Holiday Extras API
- Collinson networks: Priority Pass, LoungeKey, Collinson
- Bank issuer programs: Amex, Chase Sapphire, Capital One, Citi
- Card network programs: Visa Airport Companion, Mastercard Airport Lounge Programs, Mastercard Travel Pass, DragonPass
- Airline alliance finders: Star Alliance, oneworld, SkyTeam
- Airline-operated lounges
- Operator-operated lounges: Plaza Premium, Escape, Airport Dimensions, Aspire, Marhaba, Primeclass, No1, Be Relax
- Open enrichment: OurAirports, OpenStreetMap, Nominatim

## Coverage Meaning

The current non-Priority Pass count is not the world count. It is the number of non-PP records that have been imported into the review queue. Worldwide coverage requires:

- global baseline inventory from a licensed/commercial provider
- official network, alliance, airline, issuer, card, and operator source evidence
- dedupe across overlapping programs
- source provenance for every field
- reviewed approval before publish

## D1 Commands

Apply schema:

```bash
npx wrangler d1 migrations apply lounge-guru-catalog --remote
```

Smoke schema:

```bash
npx wrangler d1 execute lounge-guru-catalog --remote --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

## Source Intake Boundary

`npm run scrape:sources` is blocked for local workstations. Source intake that fetches public pages must run only from the Cloudflare-approved runner with:

```bash
LOUNGE_GURU_SOURCE_INTAKE_RUNTIME=cloudflare npm run scrape:sources
```

Terminal coverage remains blocked while `public/data/source-intake-report.json` reports a legacy local runtime.

Cloudflare probe path:

```bash
curl -X POST 'https://loungeguru.desk.travel/admin/source-intake/probe?sourceId=mastercard-travel-pass' \
  -H 'x-lounge-guru-intake-token: <secret>'
```

The probe writes a bounded `source_runs` row from the Worker runtime. It stores status, hashes, headers, and provenance only; raw page bodies stay out of D1 and git.

Run all ready official-page tasks from Cloudflare:

```bash
curl -X POST 'https://loungeguru.desk.travel/admin/source-intake/probe-batch' \
  -H 'x-lounge-guru-intake-token: <secret>'
```

Review compact D1 source-run status:

```bash
curl 'https://loungeguru.desk.travel/admin/source-intake/status' \
  -H 'x-lounge-guru-intake-token: <secret>'
```

Review the D1-derived source report:

```bash
npm run intake:cloudflare:report
```

Export the report for review after an authorized Worker run:

```bash
npm run intake:cloudflare:report:export
```

Export public evidence from remote D1 without fetching source pages locally:

```bash
npm run intake:evidence
```

This writes `public/data/cloudflare-source-run-evidence.json` from D1 `source_runs`. It records only source IDs, run IDs, HTTP status, byte counts, hashes, robots status, and ready-task coverage.

After intake, publish only through the Cloudflare D1 snapshot path:

```bash
npm run db:catalog:push
```

## Cloudflare Probe Evidence

Verified Worker-runtime probe rows in remote D1:

- `visa-airport-companion`: runtime `cloudflare`, status `fetched`, Cloudflare snapshot `true`.
- `mastercard-travel-pass`: runtime `cloudflare`, status `fetched`, Cloudflare snapshot `true`.
- `dragonpass`: runtime `cloudflare`, status `fetched`, Cloudflare snapshot `true`.

These rows prove the guarded Worker intake path can fetch and persist source-run evidence from Cloudflare. They do not complete the terminal gate until the public source-intake and coverage reports are rebuilt from Cloudflare D1 evidence.

## Current Meaning

Current data can fail the terminal gate and still be structurally valid. Candidate records remain `review` until location, hours, access policy, source conflicts, and airport identity are resolved.
