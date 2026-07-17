import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const catalog = JSON.parse(fs.readFileSync(new URL('../public/data/lounge-guru-catalog.json', import.meta.url), 'utf8'));

function rowsAt(airportCode, pattern) {
  return catalog.records.filter(
    (record) => record.airport.iata === airportCode && pattern.test(record.lounge.name),
  );
}

function source(record, sourceId) {
  return record.sources.find((candidate) => candidate.sourceId === sourceId);
}

test('Aspire authority consolidates terminal-qualified physical lounge duplicates', () => {
  const expectations = [
    ['LGW', /club aspire/i, 1],
    ['LGW', /no\.?\s*1.*(?:gatwick|north)|no\.?\s*1 lounges/i, 2],
    ['LHR', /club aspire/i, 1],
    ['LHR', /^my lounge$/i, 1],
    ['LHR', /no\.?\s*1/i, 2],
    ['LTN', /^my lounge$/i, 1],
    ['LTN', /no\.?\s*1 lounge/i, 1],
  ];

  for (const [airportCode, pattern, expected] of expectations) {
    assert.equal(rowsAt(airportCode, pattern).length, expected, `${airportCode} ${pattern} count`);
  }

  const clubAspireLhr = rowsAt('LHR', /club aspire/i)[0];
  assert.ok(source(clubAspireLhr, 'aspire-lounges'));
  assert.ok(source(clubAspireLhr, 'priority-pass'));
  assert.ok(source(clubAspireLhr, 'airport-official-pages'));
  assert.match(clubAspireLhr.operations.hours, /January - December/);
});

test('Aspire authority keeps Manchester gate products distinct and rejects umbrella offers', () => {
  const officialAspire = catalog.records.filter(
    (record) => record.airport.iata === 'MAN' && source(record, 'aspire-lounges'),
  );
  assert.equal(officialAspire.length, 3);

  const cGates = officialAspire.find((record) => /C Gates/i.test(record.lounge.name));
  const dGates = officialAspire.find((record) => /D Gates/i.test(record.lounge.name));
  const terminal3 = officialAspire.find((record) => /Terminal 3/i.test(record.lounge.name));
  assert.equal(cGates?.location.gate, 'C Gates');
  assert.equal(dGates?.location.gate, 'D Gates');
  assert.ok(terminal3);
  assert.equal(
    terminal3.accessOffers.some((offer) => /aspire-at-manchester-terminal-1/i.test(offer.url)),
    false,
  );
  assert.equal(
    terminal3.sources.some((candidate) => /aspire-at-manchester-terminal-1/i.test(candidate.url)),
    false,
  );
});

test('Aspire authority retains exact official offer URLs and seasonal hours', () => {
  const expectedUrls = new Map([
    ['LGW|Club Aspire Lounge', 'london-gatwick-airport-south-terminal-club-aspire'],
    ['LHR|Club Aspire Lounge', 'london-heathrow-airport-club-aspire-lounge-terminal-5'],
    ['LHR|My Lounge', 'london-heathrow-airport-my-lounge-terminal-3'],
  ]);

  for (const record of catalog.records) {
    const slug = expectedUrls.get(`${record.airport.iata}|${record.lounge.name}`);
    if (!slug) continue;
    const aspireSource = source(record, 'aspire-lounges');
    assert.ok(aspireSource?.url.includes(slug));
    assert.ok(record.accessOffers.some((offer) => offer.sourceId === 'aspire-lounges' && offer.url.includes(slug)));
    assert.match(record.operations.hours, /January - December/);
  }
});

test('Aspire duration offers stay on one physical lounge with explicit labels', () => {
  for (const [airportCode, namePattern] of [
    ['MEL', /Aspire Lounge/i],
    ['SYD', /The House by Aspire/i],
  ]) {
    const records = catalog.records.filter(
      (record) =>
        record.airport.iata === airportCode &&
        namePattern.test(record.lounge.name) &&
        source(record, 'aspire-lounges'),
    );
    assert.equal(records.length, 1);
    assert.equal(records[0].accessOffers.some((offer) => offer.label === '1-hour stay'), true);
    assert.equal(records[0].accessOffers.some((offer) => offer.label === '2-hour stay'), true);
    assert.equal(records[0].accessOffers.some((offer) => /1hr-/.test(offer.url)), true);
    assert.equal(records[0].accessOffers.some((offer) => /2hr-/.test(offer.url)), true);
  }

  assert.equal(catalog.records.some((record) => /\([12] Hour Stay\)/i.test(record.lounge.name)), false);
});
