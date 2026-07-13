import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const appCss = fs.readFileSync(new URL('../src/App.css', import.meta.url), 'utf8');

test('mobile details expose source and quality badges', () => {
  assert.match(appSource, /const selectedSource = selectedFeature\.properties\.canonical\?\.sources\[0\]/);
  assert.match(appSource, /const selectedQuality = selectedFeature\.properties\.canonical\?\.quality/);
  assert.match(appSource, /selectedSource\?\.sourceId \?\? 'unknown'/);
  assert.match(appSource, /formatSourceConfidence\(selectedSource\?\.confidence\)/);
  assert.match(appSource, /formatSourceDate\(selectedSource\?\.retrievedAt\)/);
  assert.match(appSource, /selectedQuality\?\.completeness \?\? 0/);
  assert.match(appSource, /selectedQuality\?\.reviewStatus \?\? 'approved'/);
  assert.match(appCss, /\.mobile-selected-summary \.quality-row\s*{[^}]*margin-top:\s*0\.46rem;/s);
  assert.match(appCss, /\.mobile-selected-summary \.quality-row \.code\s*{[^}]*white-space:\s*nowrap;/s);
});

test('mobile sheet actions preserve touch targets', () => {
  assert.match(appCss, /\.mobile-actions button strong\s*{[^}]*border-top:\s*1px solid var\(--line-soft\);/s);
  assert.match(appCss, /\.mobile-sheet \.primary-action\s*,\s*\n\s*\.mobile-sheet \.results-load-more\s*{[^}]*min-height:\s*44px;/s);
  assert.match(appCss, /\.mobile-type-strip \.quick-type-chip\s*,\s*\n\s*\.mobile-filter-wrap \.type-pill\s*,\s*\n\s*\.mobile-filter-wrap \.filter-chip\s*{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/s);
});
