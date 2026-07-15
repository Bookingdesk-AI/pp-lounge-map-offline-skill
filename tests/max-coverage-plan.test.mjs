import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createMaxCoveragePlan } from '../scripts/lib/max-coverage-plan.mjs';

const catalog = JSON.parse(fs.readFileSync(new URL('../public/data/lounge-guru-catalog.json', import.meta.url), 'utf8'));
const goal = JSON.parse(fs.readFileSync(new URL('../public/data/worldwide-coverage-goal.json', import.meta.url), 'utf8'));
const coverageGap = JSON.parse(fs.readFileSync(new URL('../public/data/coverage-gap-report.json', import.meta.url), 'utf8'));
const fieldCoverageReport = JSON.parse(
  fs.readFileSync(new URL('../public/data/lounge-field-coverage-report.json', import.meta.url), 'utf8'),
);
const maxCoveragePlan = JSON.parse(fs.readFileSync(new URL('../public/data/max-coverage-plan.json', import.meta.url), 'utf8'));

test('max coverage plan reflects current terminal deltas', () => {
  assert.equal(maxCoveragePlan.goalId, goal.id);
  assert.equal(maxCoveragePlan.status, 'complete');
  assert.equal(maxCoveragePlan.baseline.totalRecords, coverageGap.current.totalRecords);
  assert.equal(maxCoveragePlan.baseline.nonPriorityRecords, coverageGap.current.nonPriorityRecords);
  assert.equal(maxCoveragePlan.deltas.approvedRecordsRemaining, coverageGap.deltas.approvedRecordsRemaining);
  assert.equal(maxCoveragePlan.deltas.gateCoverageRecordsRemaining, coverageGap.deltas.gateCoverageRecordsRemaining);
  assert.equal(maxCoveragePlan.validation.terminal, 'npm run goal:coverage');
  assert.match(maxCoveragePlan.validation.d1SmokeQueries.fieldCoverage, /lounge_field_coverage/);
  assert.match(maxCoveragePlan.validation.d1SmokeQueries.openReviewQueue, /review_queue/);
  assert.match(maxCoveragePlan.validation.d1SmokeQueries.provenance, /lounge_records/);
  assert.equal(maxCoveragePlan.reviewQueueSla.staleOpenHighConfidenceDays, 14);
  assert.equal(maxCoveragePlan.reviewQueueSla.maxStaleOpenReviewRecords, 0);
});

test('max coverage airport backlog ranks field-enrichment work from real records', () => {
  assert.ok(maxCoveragePlan.airportEnrichmentBacklog.length > 0);

  for (let index = 1; index < maxCoveragePlan.airportEnrichmentBacklog.length; index += 1) {
    assert.ok(
      maxCoveragePlan.airportEnrichmentBacklog[index - 1].missingFieldScore >=
        maxCoveragePlan.airportEnrichmentBacklog[index].missingFieldScore,
    );
  }

  const topAirport = maxCoveragePlan.airportEnrichmentBacklog[0];
  assert.match(topAirport.airportCode, /^[A-Z0-9]{3}$/);
  assert.ok(topAirport.totalRecords > 0);
  assert.ok(topAirport.missingGate > 0 || topAirport.missingHours > 0 || topAirport.missingPrice > 0);
  assert.match(topAirport.nextEvidenceRule, /field evidence/);
});

test('max coverage source backlog keeps official-source guardrails actionable', () => {
  const sourceIds = new Set(maxCoveragePlan.sourceBacklog.map((source) => source.sourceId));

  assert.ok(sourceIds.has('priority-pass'));
  assert.ok(sourceIds.has('oneworld'));
  assert.equal(sourceIds.has('desk-travel-brand-database'), false);
  assert.equal(sourceIds.has('holiday-extras-api'), false);
  assert.ok(maxCoveragePlan.waves.some((wave) => wave.id === 'airport-field-enrichment'));
  assert.ok(maxCoveragePlan.waves.some((wave) => wave.id === 'operator-network-expansion'));
  assert.ok(maxCoveragePlan.guardrails.includes('No licensed commercial global lounge feeds.'));
  assert.ok(maxCoveragePlan.guardrails.includes('Airport pages enrich matched records before creating new physical lounges.'));
});

test('max coverage plan records official source scale evidence', () => {
  const scaleBySource = new Map(maxCoveragePlan.sourceScaleEvidence.map((source) => [source.sourceId, source]));

  assert.match(scaleBySource.get('priority-pass')?.publishedScale ?? '', /1900\+/);
  assert.match(scaleBySource.get('american-express')?.publishedScale ?? '', /1550\+/);
  assert.match(scaleBySource.get('mastercard-travel-pass')?.publishedScale ?? '', /1600\+/);
  assert.match(scaleBySource.get('star-alliance')?.publishedScale ?? '', /1000\+/);
  assert.match(scaleBySource.get('oneworld')?.publishedScale ?? '', /nearly 700/);
  assert.match(scaleBySource.get('skyteam')?.publishedScale ?? '', /750\+/);
  assert.match(scaleBySource.get('airport-dimensions')?.officialUrl ?? '', /^https:\/\/www\.airportdimensions\.com\/locations/);
  assert.match(scaleBySource.get('plaza-premium')?.planningUse ?? '', /operator-owned/);
});

test('max coverage plan records official price research evidence', () => {
  const researchBySource = new Map(maxCoveragePlan.officialPriceResearchEvidence.map((source) => [source.sourceId, source]));

  for (const sourceId of ['plaza-premium', 'airport-dimensions', 'aspire-lounges', 'escape-lounges', 'no1-lounges']) {
    const source = researchBySource.get(sourceId);
    assert.ok(source, `${sourceId} research evidence missing`);
    assert.match(source.officialUrl, /^https:\/\//);
    assert.ok(source.evidenceFields.includes('access.accessOffers'));
    assert.match(source.researchUse, /official/i);
    assert.ok(source.firstBatchRule.length > 0);
  }

  assert.match(researchBySource.get('airport-dimensions')?.firstBatchRule ?? '', /airport-code-only/);
  assert.match(researchBySource.get('plaza-premium')?.firstBatchRule ?? '', /likely catalog matches/);
});

test('max coverage plan includes D1 proof contract and terminal burndown', () => {
  assert.equal(maxCoveragePlan.d1EvidenceContract.databaseName, 'lounge-guru-catalog');
  assert.equal(maxCoveragePlan.d1EvidenceContract.binding, 'LOUNGE_GURU_DB');
  assert.ok(maxCoveragePlan.d1EvidenceContract.proofTables.includes('record_field_evidence'));
  assert.ok(maxCoveragePlan.d1EvidenceContract.proofTables.includes('lounge_field_coverage'));
  assert.ok(maxCoveragePlan.d1EvidenceContract.proofTables.includes('coverage_validation_runs'));
  assert.match(maxCoveragePlan.d1EvidenceContract.rawSnapshotPolicy, /raw HTML\/JSON bodies stay out of git/);

  const burndownById = new Map(maxCoveragePlan.terminalBurndown.map((batch) => [batch.id, batch]));
  assert.equal(burndownById.get('close-approved-record-gap').remaining, coverageGap.deltas.approvedRecordsRemaining);
  assert.equal(burndownById.get('raise-hours-coverage').remaining, coverageGap.deltas.hoursCoverageRecordsRemaining);
  assert.equal(burndownById.get('raise-gate-coverage').remaining, coverageGap.deltas.gateCoverageRecordsRemaining);
  assert.equal(burndownById.get('raise-price-coverage').remaining, coverageGap.deltas.priceCoverageRecordsRemaining);
  assert.ok(burndownById.get('raise-gate-coverage').firstBatch.includes(maxCoveragePlan.airportEnrichmentBacklog[0].airportCode));
  assert.deepEqual(
    burndownById.get('raise-price-coverage').firstBatch,
    maxCoveragePlan.priceOfferWorklist.slice(0, 8).map((source) => source.sourceId),
  );
  assert.match(burndownById.get('raise-price-coverage').acceptance, /amount, currency/);
});

test('max coverage plan chooses current bounded work order from terminal blockers', () => {
  assert.equal(maxCoveragePlan.currentWorkOrder.mode, 'field_enrichment_first');
  assert.match(maxCoveragePlan.currentWorkOrder.reason, /Approved and non-Priority Pass count targets are met/);
  assert.deepEqual(maxCoveragePlan.currentWorkOrder.terminalBlockers, coverageGap.blockers);

  const slicesById = new Map(maxCoveragePlan.currentWorkOrder.slices.map((slice) => [slice.id, slice]));
  assert.deepEqual(
    slicesById.get('airport-authority-top-backlog')?.scope.slice(0, 3),
    maxCoveragePlan.airportEnrichmentBacklog.slice(0, 3).map((airport) => airport.airportCode),
  );
  assert.ok(slicesById.get('airport-authority-top-backlog')?.fields.includes('location.gate'));
  assert.deepEqual(
    slicesById.get('operator-price-offers')?.scope,
    maxCoveragePlan.priceOfferWorklist.slice(0, 8).map((source) => source.sourceId),
  );
  assert.match(slicesById.get('operator-price-offers')?.acceptance ?? '', /amount, currency/);
  assert.match(slicesById.get('airline-owned-hours-location')?.acceptance ?? '', /Airline-owned pages outrank alliance/);
});

test('max coverage plan prioritizes operator booking sources for price coverage', () => {
  assert.ok(maxCoveragePlan.priceOfferWorklist.length > 0);

  const priceSourceIds = new Set(maxCoveragePlan.priceOfferWorklist.map((source) => source.sourceId));
  assert.ok(priceSourceIds.has('plaza-premium'));
  assert.ok(priceSourceIds.has('primeclass'));
  assert.ok(priceSourceIds.has('airport-dimensions'));

  const plazaPremium = maxCoveragePlan.priceOfferWorklist.find((source) => source.sourceId === 'plaza-premium');
  assert.ok(plazaPremium.likelyCatalogMatches > 0);
  assert.ok(plazaPremium.likelyMissingPriceMatches > 0);
  assert.equal(plazaPremium.nextAction, 'match_existing_catalog_records_then_attach_price_evidence');
  assert.match(plazaPremium.acceptance, /Explicit amount, currency/);

  for (let index = 1; index < maxCoveragePlan.priceOfferWorklist.length; index += 1) {
    assert.ok(
      maxCoveragePlan.priceOfferWorklist[index - 1].priorityScore >= maxCoveragePlan.priceOfferWorklist[index].priorityScore,
    );
  }
});

test('max coverage plan generator is deterministic for the current catalog inputs', () => {
  const regenerated = createMaxCoveragePlan({
    goal,
    catalog,
    coverageGap,
    fieldCoverageReport,
    sourceRegistry: catalog.sources,
  });

  assert.deepEqual(regenerated, maxCoveragePlan);
});
