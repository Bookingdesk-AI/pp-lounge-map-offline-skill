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
```

Gap report: `public/data/coverage-gap-report.json`.
Cloudflare intake plan: `public/data/cloudflare-source-intake-plan.json`.

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

After intake, publish only through the Cloudflare D1 snapshot path:

```bash
npm run db:catalog:push
```

## Current Meaning

Current data can fail the terminal gate and still be structurally valid. Candidate records remain `review` until location, hours, access policy, source conflicts, and airport identity are resolved.
