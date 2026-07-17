# Worldwide Coverage Goal

Goal: maximum official/public airport lounge coverage in Cloudflare D1 with field-level provenance, quality state, and review history.

## Target

- Database: `lounge-guru-catalog`
- Binding: `LOUNGE_GURU_DB`
- Contract: `public/data/worldwide-coverage-goal.json`
- Generated execution plan: `public/data/max-coverage-plan.json`
- Human execution plan: `docs/max-coverage-execution-plan.md`
- Intake runtime: `playwright` through the approved source runner or Cloudflare Worker intake

## Scope

Included:

- Official public lounge, issuer, airline, alliance, operator, and open airport sources.
- Approved Priority Pass workbook as one source lane.
- Playwright-rendered source snapshots with raw pages kept out of git.
- Cloudflare Worker source intake for live official-source probes.

Excluded:

- Licensed/commercial global lounge providers.
- Login-only, private API, captcha, or account-bypass sources.
- Raw page bodies in git, public JSON, D1 catalog rows, or MCP payloads.
- Fabricated gates, inferred prices, or unverifiable hours.

## Terminal Gate

```bash
npm run validate:coverage
npm run validate:json
npm run goal:coverage
```

Terminal criteria:

- Approved deduped physical lounge records: `>= 3,000`
- Approved non-Priority Pass records: `>= 1,300`
- Approved ratio: `>= 98%`
- Hours coverage: `>= 99%`
- Gate or decision-useful location coverage: `>= 60%`
- Price/access offer coverage: `>= 40%` when official booking/payment pages publish amount and currency
- Required source family coverage: `100%`
- Review records: `0`
- Unknown airport records: `0`
- Records without source provenance: `0`
- Records without quality state: `0`
- Records without field-level evidence: `0`
- D1 schema tables present
- Source intake runtime: `playwright`
- Ready source-lane proof: `100%`

## Current Local Gate

```text
Catalog: 3197 records, 3197 approved, 0 review
Non-PP: 1872 records
Approved ratio: 100.00%
Hours: 3127 / 3197 = 97.81%
Gate: 1977 / 3197 = 61.84%
Price: 904 / 3197 = 28.28%
Source families: 100.00%
Source intake: playwright
Source proof: 16 fetched Cloudflare snapshots; 5/5 ready member gaps covered
Terminal goal: blocked by hours and prices
```

Current deltas:

```text
Approved records remaining: 0
Non-PP records remaining: 0
Hours fields remaining: 42
Gate fields remaining: 0
Price fields remaining: 375
Open review records: 0
```

Approval policy: `public/data/catalog-approval-policy.json`.

## Required Source Families

- Collinson networks: Priority Pass, LoungeKey, Collinson
- Bank issuer programs: Amex, Chase Sapphire, Capital One, Citi
- Airline alliance finders: Star Alliance, oneworld, SkyTeam
- Airline-operated lounges
- Operator-operated lounges: Plaza Premium, Escape, Airport Dimensions, Aspire, Marhaba, Primeclass, No1, Be Relax
- Open enrichment: OurAirports, OpenStreetMap, Nominatim

Card-network program pages remain tracked as source/access evidence, but they are not terminal inventory families unless public pages expose physical lounge inventory with stable provenance.

## Coverage Waves

Wave 1: field enrichment.

- Count coverage is now terminal; weak new records should not be added until field ratios move.
- Burn down missing hours, gate/near-gate, and price evidence on existing approved records.
- First airports: LHR, JFK, SIN, DFW, BKK, DOH, LGW, GRU, PVG, and SYD.

Wave 2: high-yield non-PP inventory.

- Refresh oneworld, Star Alliance, and SkyTeam as broad discovery lanes.
- Keep alliance rows as access/program evidence until operator, airline, or airport pages confirm physical lounge identity.
- Dedupe by airport, normalized lounge name, operator, terminal, and security side.

Wave 3: airline-owned lounges.

- United, Delta, American, Air Canada, Lufthansa Group, British Airways, Qatar, Emirates, Qantas, Cathay Pacific, Singapore Airlines, Turkish Airlines, ANA, JAL, Korean Air, Air France/KLM, LATAM, Alaska, Virgin Atlantic, and Etihad.
- Prioritize official pages that publish hours, temporary closures, access rules, and terminal/location.

Wave 4: operator networks.

- Plaza Premium, Airport Dimensions/The Club, Escape, Aspire, Marhaba, Primeclass, No1, Be Relax, Gameway, Minute Suites, XpresSpa, Sleep 'n Fly, and YotelAir.
- Prioritize detail pages and booking pages because they are the highest-yield source for prices, hours, and exact location text.

Wave 5: airport official pages.

- Rank airports by missing gate/hour count and lounge volume.
- Use official airport services, terminal, map, and shopping/dining pages to fill gate or near-gate fields.
- Store near-gate text only when the source publishes it; never infer from maps or neighboring tenants.

Wave 6: price/access offers.

- Import only official booking/payment pages with explicit amount and currency.
- Store amount, currency, terms label, source URL, retrieved timestamp, and parser version.
- Do not use blogs, screenshots, cached search snippets, or inferred day-pass prices.

## Max Coverage Plan

Definition: D1 is complete enough for production when every official/public source lane is either parsed into approved records or explicitly blocked with source-run evidence, and every approved lounge has source, field evidence, airport authority, and quality state.

The generated plan ranks source and airport work from the current catalog gaps. Regenerate it with `npm run build:canonical-data` before starting a coverage wave.

Execution order:

1. Gate extraction from current evidence.
   - Extract only explicit gate or near-gate text already present in official fields.
   - Sources: Priority Pass names/slugs/location text, oneworld directions, airport authority pages, and operator detail pages.
   - Do not infer exact gates from terminal, concourse, map proximity, or neighboring venues.

2. Alliance expansion.
   - Re-run oneworld, Star Alliance, and SkyTeam as discovery lanes.
   - Treat alliance rows as access/program evidence until an airline, operator, or airport page confirms the physical lounge identity.
   - Merge Star Alliance Gold, oneworld Emerald/Sapphire, and SkyTeam Elite Plus as program families with tiers, not separate lounge brands.

3. Operator network expansion.
   - Parse Plaza Premium, Airport Dimensions/The Club, Escape, Aspire, Marhaba, Primeclass, No1, Be Relax, Gameway, Minute Suites, XpresSpa, Sleep 'n Fly, and YotelAir.
   - Prefer operator detail pages for hours, location, access price, amenities, and restrictions.
   - Keep robots or rights-blocked lanes in evidence, not in approved inventory.

4. Airline-owned expansion.
   - Add official lanes for United, Delta, American, Air Canada, Lufthansa Group, British Airways, Qatar, Emirates, Qantas, Cathay Pacific, Singapore Airlines, Turkish Airlines, ANA, JAL, Korean Air, Air France/KLM, LATAM, Alaska, Virgin Atlantic, and Etihad.
   - Airline pages can override alliance fields for owned lounge status, hours, terminal, closure, and access rules.

5. Airport authority enrichment.
   - Rank airports by lounge count and missing gate/hour fields.
   - Reconcile the top 250 airports first, then the top 500.
   - Store exact gate only when the airport/operator publishes a gate. Store near-gate area when the source says "near", "by", "opposite", "between", or equivalent wording.

6. Price and access offers.
   - Store price only from official booking or payment pages with amount and currency.
   - Add offer type, duration, currency, amount, terms label, source URL, retrieved timestamp, and parser version.
   - Keep card eligibility, guest allowance, and pass access separate from paid price.

## Max Coverage Gates

These gates sit above the terminal count targets:

- Required source lanes attempted: `100%`
- Blocked source lanes with rights/robots/http evidence: `100%`
- New non-PP approvals manually reviewed: `100%`
- Top 250 airport duplicate clusters resolved: `100%`
- Top 500 airport authority reconciliation complete: `100%`
- Records without source provenance: `0`
- Records without field-level evidence: `0`
- Unknown airport records: `0`
- Stale high-confidence review records: `0`

Source priority:

1. Official lounge operator.
2. Airline owner/operator.
3. Official airport authority.
4. Alliance finder.
5. Issuer/card/pass program.
6. Open airport normalization.

## Field Evidence Order

Use the strongest source available per field:

1. Official lounge operator.
2. Airline owner/operator.
3. Official airport page.
4. Alliance finder.
5. Issuer/card/pass program.
6. Open airport normalization.

Issuer/card/pass data can prove access programs, but should not overwrite a stronger operator or airline location field.

## Intake

Run bounded Cloudflare source intake when `LOUNGE_GURU_INTAKE_TOKEN` is available locally:

```bash
LOUNGE_GURU_INTAKE_TOKEN=<redacted> LOUNGE_GURU_INTAKE_TIMEOUT_MS=240000 npm run intake:cloudflare
```

Next high-yield source run:

```bash
LOUNGE_GURU_INTAKE_TOKEN=<redacted> LOUNGE_GURU_INTAKE_TIMEOUT_MS=240000 npm run intake:cloudflare -- --source-ids=loungekey,collinson-international,citi-travel,star-alliance,united,plaza-premium,openstreetmap
```

Current source blockers:

- Plaza Premium parser support exists for official airport/detail pages, but the public site robots policy is an allowlist and the current seed URL is blocked for unknown crawlers. Do not bypass it. Promote Plaza only through an allowed user-triggered/Cloudflare source run or manual-review evidence.
- Gameway official source intake is live: 13 structured records, 13 detail pages fetched, 11 records with hours, and 13 records with official rate tiers.
- Sleepover official source intake is live: 8 structured terminal records, 8 pages fetched, 8 records with 24-hour operations, and 8 records with official booking-from prices.
- Delta official Sky Club locations page is live: 93 structured records, 92 approved candidate records after dedupe/merge, 86 catalog records with official hours, and 48 with gate or near-gate evidence.
- Primeclass currently needs the Playwright/curl-tolerant source runtime because plain Node fetch fails on malformed response headers.
- Airport official lounge pages are live for SFO, PHL, SIN, LGW, LHR, JFK, LGA, EWR, DXB, MAN, BKK, GRU, MIA, and SEA: 158 official structured records, 29 official pages fetched, with published terminal, hours, gate-area/direction evidence where available, official Gatwick GBP booking-from prices, official Heathrow Terminal 2/3/4/5 GBP booking-from prices, official GRU BRL/USD access prices, official MIA USD day-pass evidence where published, and official SEA gate/near-gate evidence.
- Suvarnabhumi official airport lounge page is live: 31 structured BKK records, 16 with published operating hours, and 10 with explicit gate or gate-area evidence.
- GRU official airport lounge page is live: 22 structured GRU records, 22 with published operating hours, 12 with official paid-access prices, and 3 with explicit gate or near-gate evidence.
- American Airlines official airport club pages are live for DFW, LAX, JFK, ORD, and CLT: 13 official structured records, 5 official pages fetched, 13 catalog records after dedupe/merge, with published gate and hours evidence.

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

Remote D1 smoke after the next catalog push must prove the current generated gate:

```sql
SELECT total_records, approved_records, review_records, non_priority_records
FROM catalog_runs
ORDER BY created_at DESC
LIMIT 1;
-- current published run: 3197, 3197, 0, 1869

SELECT COUNT(*) AS total, SUM(has_hours) AS hours, SUM(has_gate) AS gates, SUM(has_price) AS prices
FROM lounge_field_coverage;
-- current published run: 3197, 3127, 1977, 904
```
