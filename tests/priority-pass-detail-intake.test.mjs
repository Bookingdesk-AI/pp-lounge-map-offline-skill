import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isLikelyPriorityPassAccessOfferRecord,
  normalizeLocationBlock,
  parseHoursHeading,
  mergePriorityPassDetailBlockers,
  selectPriorityPassDetailTargets,
} from '../scripts/scrape-priority-pass-detail-evidence.mjs';

test('Priority Pass detail intake targets likely public value conditions only', () => {
  assert.equal(isLikelyPriorityPassAccessOfferRecord('TGI Fridays'), true);
  assert.equal(isLikelyPriorityPassAccessOfferRecord('Siesta Box Brasilia'), true);
  assert.equal(isLikelyPriorityPassAccessOfferRecord('International VIP Lounge'), false);
});

test('Priority Pass detail parser preserves rendered hours and location facts', () => {
  assert.equal(parseHoursHeading('Hours: 05:00 - 21:30'), '05:00 - 21:30');
  assert.equal(
    normalizeLocationBlock('Location\nAirside - Level 4, Departures, next to the Terminal Transfer area.'),
    'Airside - Level 4, Departures, next to the Terminal Transfer area.',
  );
});

test('Priority Pass detail targets stay bounded to missing official records', () => {
  const features = [
    { properties: { id: 'missing-gate', airportCode: 'LHR', url: 'https://www.prioritypass.com/en-GB/lounges/example' } },
    { properties: { id: 'missing-value', airportCode: 'AUH', url: 'https://www.prioritypass.com/en-GB/lounges/value' } },
    { properties: { id: 'complete', airportCode: 'LHR', url: 'https://www.prioritypass.com/en-GB/lounges/complete' } },
    { properties: { id: 'wrong-host', airportCode: 'LHR', url: 'https://example.com/lounge' } },
  ];
  const catalog = {
    records: [
      { lounge: { id: 'missing-gate' }, location: { gate: '' }, operations: { hours: '05:00 - 21:30' } },
      { lounge: { id: 'missing-value', name: 'TGI Fridays' }, location: { gate: 'Pier C' }, operations: { hours: '24 hours daily' }, accessOffers: [] },
      { lounge: { id: 'complete' }, location: { gate: 'Gate 1' }, operations: { hours: '05:00 - 21:30' } },
      { lounge: { id: 'wrong-host' }, location: { gate: '' }, operations: { hours: '' } },
    ],
  };

  assert.deepEqual(
    selectPriorityPassDetailTargets({ features, catalog, existingRecords: [], limit: 10 }).map((target) => ({
      id: target.id,
      missingFields: target.missingFields,
    })),
    [
      { id: 'missing-value', missingFields: ['conditions'] },
      { id: 'missing-gate', missingFields: ['location'] },
    ],
  );
  assert.deepEqual(
    selectPriorityPassDetailTargets({
      features,
      catalog,
      existingRecords: [
        { recordId: 'missing-gate', location: 'Near Gate 1' },
        { recordId: 'missing-value', conditions: ['No explicit amount is published.'] },
      ],
      limit: 10,
    }),
    [],
  );
  assert.deepEqual(
    selectPriorityPassDetailTargets({
      features,
      catalog,
      existingRecords: [
        { recordId: 'missing-gate', location: 'Near Gate 1' },
        { recordId: 'missing-value', conditions: ['No explicit amount is published.'] },
      ],
      limit: 10,
      refresh: true,
    }).map((target) => target.id),
    ['missing-value', 'missing-gate'],
  );
});

test('Priority Pass blocker history survives retries and resolves active blockers', () => {
  const firstRun = mergePriorityPassDetailBlockers({
    blockers: [{ recordId: 'AOG-1', url: 'https://www.prioritypass.com/aog', reason: 'missing_detail_fields' }],
    attemptedRecordIds: ['AOG-1'],
    fetchedRecordIds: [],
    runAt: '2026-07-16T01:00:00.000Z',
  });
  assert.equal(firstRun.activeBlockers.length, 1);
  assert.equal(firstRun.blockerHistory[0].attempts, 1);

  const secondRun = mergePriorityPassDetailBlockers({
    existingBlockers: firstRun.activeBlockers,
    existingHistory: firstRun.blockerHistory,
    blockers: [{ recordId: 'AOG-1', url: 'https://www.prioritypass.com/aog', reason: 'missing_detail_fields' }],
    attemptedRecordIds: ['AOG-1'],
    fetchedRecordIds: [],
    runAt: '2026-07-16T02:00:00.000Z',
  });
  assert.equal(secondRun.activeBlockers[0].attempts, 2);
  assert.equal(secondRun.blockerHistory[0].attempts, 2);

  const resolvedRun = mergePriorityPassDetailBlockers({
    existingBlockers: secondRun.activeBlockers,
    existingHistory: secondRun.blockerHistory,
    blockers: [],
    attemptedRecordIds: ['AOG-1'],
    fetchedRecordIds: ['AOG-1'],
    runAt: '2026-07-16T03:00:00.000Z',
  });
  assert.equal(resolvedRun.activeBlockers.length, 0);
  assert.equal(resolvedRun.blockerHistory[0].resolvedAt, '2026-07-16T03:00:00.000Z');
});
