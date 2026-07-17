import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const catalog = JSON.parse(fs.readFileSync(new URL('../public/data/lounge-guru-catalog.json', import.meta.url), 'utf8'));

function recordAt(airportCode) {
  return catalog.records.find(
    (record) =>
      record.airport.iata === airportCode &&
      record.sources.some((source) => source.sourceId === 'qantas') &&
      record.sources.some((source) => source.sourceId === 'oneworld'),
  );
}

test('Qantas authority keeps official hours when alliance position evidence conflicts', () => {
  const expectations = [
    ['DRW', 'Gate 1'],
    ['KTA', 'Ground Level'],
    ['ROK', 'Ground Level'],
  ];

  for (const [airportCode, alliancePosition] of expectations) {
    const record = recordAt(airportCode);
    const qantasSource = record?.sources.find((source) => source.sourceId === 'qantas');

    assert.ok(record, `${airportCode} should retain one merged Qantas identity`);
    assert.equal(record.location.gate, alliancePosition);
    assert.match(record.operations.hours, /One hour (?:before|prior to) each Qantas operated service/i);
    assert.ok(qantasSource?.fieldCoverage.includes('operations.hours'));
    assert.equal(qantasSource?.fieldCoverage.includes('location.gate'), false);
  }
});

test('Qantas authority promotes only approved airport-scoped alliance identities', () => {
  const expectations = [
    ['ADL', 'candidate-oneworld-adl-1094', /One hour before each Qantas operated service until 9\.15pm/],
    ['BNE', 'candidate-oneworld-bne-1372', /Mon 05:15-23:30/],
    ['HNL', 'candidate-oneworld-hnl-1130', /Mon 08:00-11:30; Tue 08:00-13:00/],
    ['YVR', 'candidate-oneworld-yvr-907', /Four hours prior to Qantas operated departure/],
  ];

  for (const [airportCode, loungeId, hours] of expectations) {
    const record = catalog.records.find((candidate) => candidate.lounge.id === loungeId);
    assert.ok(record, `${airportCode} approved Qantas identity should remain canonical`);
    assert.match(record.operations.hours, hours);
    assert.ok(record.sources.find((source) => source.sourceId === 'qantas')?.fieldCoverage.includes('operations.hours'));
  }

  const adlInternational = catalog.records.find((record) => record.lounge.id === 'candidate-oneworld-adl-1095');
  const laxFirst = catalog.records.find((record) => record.lounge.id === 'candidate-oneworld-lax-1131');
  assert.equal(adlInternational?.operations.hours, '');
  assert.equal(adlInternational?.sources.some((source) => source.sourceId === 'qantas'), false);
  assert.equal(laxFirst?.operations.hours, '');
  assert.equal(laxFirst?.lounge.status, 'temporarily_closed');
  assert.equal(laxFirst?.sources.some((source) => source.sourceId === 'qantas'), true);
  assert.match(laxFirst?.operations.exceptions[0] ?? '', /temporarily closed/i);
});

test('approved official cross-source aliases retain hours provenance', () => {
  const csx = catalog.records.find((record) => record.lounge.id === 'CSX-csx12-no-18-first-and-business-class-vip-lounge-99');
  const sub = catalog.records.find((record) => record.lounge.id === 'candidate-oneworld-sub-1896');

  assert.match(csx?.operations.hours ?? '', /Tuesday: 21:00 - 00:00/);
  assert.ok(csx?.sources.find((source) => source.sourceId === 'priority-pass')?.fieldCoverage.includes('operations.hours'));
  assert.ok(csx?.sources.some((source) => source.sourceId === 'oneworld'));
  assert.match(sub?.operations.hours ?? '', /Mon 24 hours/);
  assert.ok(sub?.sources.find((source) => source.sourceId === 'plaza-premium')?.fieldCoverage.includes('operations.hours'));
  assert.equal(catalog.records.some((record) => record.lounge.id === 'candidate-oneworld-csx-910'), false);
  assert.equal(
    catalog.records.some(
      (record) => record.lounge.id === 'candidate-plaza-premium-sub-sub-prayana-lounge-surabaya-by-ias-hospitality-terminal-2',
    ),
    false,
  );
});
