import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('search inputs expose mobile keyboard hints', () => {
  const searchInputCount = (appSource.match(/type="search"/g) ?? []).length;
  const inputModeCount = (appSource.match(/inputMode="search"/g) ?? []).length;
  const enterKeyHintCount = (appSource.match(/enterKeyHint="search"/g) ?? []).length;

  assert.equal(searchInputCount, 3);
  assert.equal(inputModeCount, searchInputCount);
  assert.equal(enterKeyHintCount, searchInputCount);
});
