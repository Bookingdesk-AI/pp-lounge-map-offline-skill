import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const catalog = JSON.parse(fs.readFileSync(new URL('../public/data/lounge-guru-catalog.json', import.meta.url), 'utf8'));

function beRelaxDxbRows() {
  return catalog.records.filter(
    (record) =>
      record.airport.iata === 'DXB' &&
      record.sources.some((source) => source.sourceId === 'be-relax'),
  );
}

test('Be Relax authority keeps same-numbered gates in different DXB concourses distinct', () => {
  const rows = beRelaxDxbRows();
  const concourseA = rows.find(
    (record) => record.location.concourse === 'Concourse A' && record.location.gate === 'Gate 23',
  );
  const concourseB = rows.find(
    (record) => record.location.concourse === 'Concourse B' && record.location.gate === 'Gate 23',
  );

  assert.equal(rows.length, 7);
  assert.ok(concourseA);
  assert.ok(concourseB);
  assert.deepEqual(
    concourseA.sources.filter((source) => source.sourceId === 'be-relax').map((source) => source.url),
    ['https://berelax.com/find-us/dubai-international-airport/dubai-international-airport-terminal-3-concourse-a-gate-23'],
  );
  assert.deepEqual(
    concourseB.sources.filter((source) => source.sourceId === 'be-relax').map((source) => source.url),
    ['https://berelax.com/find-us/dubai-international-airport/dubai-international-airport-terminal-3-concourse-b-gate-23'],
  );
});
