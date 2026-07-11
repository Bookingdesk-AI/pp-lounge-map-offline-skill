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

test('mobile result search expands the sheet before showing suggestions', () => {
  assert.match(appSource, /onSearchFocus\?: \(\) => void/);
  assert.match(appSource, /function MobileQuickFilters/);
  assert.match(appSource, /onSearchFocus: \(\) => void/);
  assert.match(appSource, /const expandMobileSearch = useCallback/);
  assert.match(appSource, /current\.sheetMode === 'results' && current\.sheetSnap !== 'full'/);
  assert.match(appSource, /onSearchFocus=\{expandMobileSearch\}/);
});
