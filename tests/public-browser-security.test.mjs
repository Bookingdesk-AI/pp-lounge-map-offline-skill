import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  REDACTED_VALUE,
  isSensitiveFieldName,
  redactSensitiveData,
  sanitizePublicUrl,
} from '../shared/security-redaction.js';

const catalog = JSON.parse(fs.readFileSync(new URL('../public/data/lounge-guru-catalog.json', import.meta.url), 'utf8'));
const payload = JSON.parse(fs.readFileSync(new URL('../public/data/lounge-map.json', import.meta.url), 'utf8'));

function collectSensitiveFields(value, trail = 'root', results = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectSensitiveFields(item, `${trail}[${index}]`, results));
    return results;
  }
  if (!value || typeof value !== 'object') {
    return results;
  }
  for (const [key, fieldValue] of Object.entries(value)) {
    if (isSensitiveFieldName(key)) {
      results.push(`${trail}.${key}`);
    }
    collectSensitiveFields(fieldValue, `${trail}.${key}`, results);
  }
  return results;
}

test('public map payload covers every canonical lounge without internal fields', () => {
  assert.equal(payload.records.length, catalog.records.length);
  assert.equal(payload.records.length, payload.meta.stats.totalCatalogRecords);
  assert.deepEqual(collectSensitiveFields(payload), []);
  assert.equal(Object.hasOwn(payload, 'sources'), false);
  assert.equal(Object.hasOwn(payload, 'deskTravelBrandImport'), false);

  for (const record of payload.records) {
    assert.equal(Object.hasOwn(record, 'notes'), false);
    assert.equal(Object.hasOwn(record, 'guestPolicy'), false);
    assert.equal(Object.hasOwn(record, 'accessOffers'), false);
    assert.equal(record.sources.length <= 1, true);
    assert.equal(Object.hasOwn(record.sources[0] ?? {}, 'rightsNote'), false);
    assert.equal(Object.hasOwn(record.sources[0] ?? {}, 'fieldCoverage'), false);
  }
});

test('public URL sanitizer removes credentials and unsafe schemes', () => {
  assert.equal(
    sanitizePublicUrl('https://example.com/lounge?airport=SEA&api_key=do-not-ship&session_token=private'),
    'https://example.com/lounge?airport=SEA',
  );
  assert.equal(sanitizePublicUrl('javascript:alert(1)'), '');
  assert.equal(sanitizePublicUrl('http://example.com/lounge'), '');
  assert.equal(sanitizePublicUrl('/data/brand-logos/example.svg'), '/data/brand-logos/example.svg');
});

test('worker response redaction masks GDS and credential fields recursively', () => {
  const redacted = redactSensitiveData({
    result: {
      pcc: 'do-not-ship',
      recordLocator: 'ABC123',
      sourceUrl: 'https://example.com/report?application_key=do-not-ship&airport=SEA',
    },
  });

  assert.equal(redacted.result.pcc, REDACTED_VALUE);
  assert.equal(redacted.result.recordLocator, REDACTED_VALUE);
  assert.equal(redacted.result.sourceUrl, 'https://example.com/report?airport=SEA');
  assert.doesNotMatch(JSON.stringify(redacted), /do-not-ship|ABC123/);
});
