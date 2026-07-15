import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const appCss = fs.readFileSync(new URL('../src/App.css', import.meta.url), 'utf8');

test('mobile details expose source and quality badges', () => {
  assert.match(appSource, /function sourceForFeature/);
  assert.match(appSource, /const selectedSource = sourceForFeature\(selectedFeature\)/);
  assert.match(appSource, /const selectedQuality = selectedFeature\.properties\.canonical\?\.quality/);
  assert.match(appSource, /selectedSource\?\.sourceId \?\? 'unknown'/);
  assert.match(appSource, /formatSourceConfidence\(selectedSource\?\.confidence\)/);
  assert.match(appSource, /formatSourceDate\(selectedSource\?\.retrievedAt\)/);
  assert.match(appSource, /selectedQuality\?\.completeness \?\? 0/);
  assert.match(appSource, /selectedQuality\?\.reviewStatus \?\? 'approved'/);
  assert.match(appSource, /function detailLoungeLocation/);
  assert.match(appSource, /function SourceTextLink/);
  assert.match(appSource, /className="detail-source-link"/);
  assert.match(appSource, /aria-label=\{`Open source: \$\{label\}`\}/);
  assert.match(appSource, /<summary>Source<\/summary>/);
  assert.doesNotMatch(appSource, /<p>Selected<\/p>/);
  assert.match(appCss, /\.mobile-selected-summary \.quality-row\s*{[^}]*margin-top:\s*0\.46rem;/s);
  assert.match(appCss, /\.mobile-selected-summary \.quality-row \.code\s*{[^}]*white-space:\s*nowrap;/s);
  assert.match(appCss, /\.detail-source-link\s*{/);
});

test('detail hours are grouped into concise daily ranges', () => {
  assert.match(appSource, /function groupDailyOpeningHours/);
  assert.match(appSource, /return \[`Daily \$\{ordered\[0\]\}`\]/);
  assert.match(appSource, /function formatClockTime/);
  assert.match(appSource, /return 'midnight'/);
});

test('read-only facility lists use facility emojis', () => {
  assert.match(appSource, /function joinFacilitiesWithEmoji/);
  assert.match(appSource, /\[/);
  for (const emoji of ['❄️', '🍷', '💳', '♿', '🥤', '📺', '📶']) {
    assert.ok(appSource.includes(emoji), `missing ${emoji}`);
  }
  assert.match(appSource, /joinFacilitiesWithEmoji\(selectedFeature\.properties\.facilities, 'Not listed'\)/);
  assert.match(appSource, /joinFacilitiesWithEmoji\(feature\.properties\.facilities, 'Not listed', 3\)/);
});

test('brand logos fill their allocated mark tiles', () => {
  assert.match(appCss, /\.brand-mark-tile\s*{[^}]*width:\s*48px;[^}]*height:\s*40px;/s);
  assert.match(appCss, /\.brand-mark-img\s*{[^}]*width:\s*100%;[^}]*height:\s*100%;/s);
  assert.match(appCss, /\.brand-icon-mark\s*{[^}]*width:\s*46px;[^}]*height:\s*46px;/s);
  assert.match(appCss, /\.brand-icon-mark-img\s*{[^}]*width:\s*100%;[^}]*height:\s*100%;/s);
  assert.match(appCss, /\.app-shell\.is-mobile \.brand-icon-mark\s*{[^}]*width:\s*46px;[^}]*height:\s*46px;/s);
  assert.match(appCss, /\.detail-meta-strip\s*{[^}]*justify-content:\s*flex-start;/s);
  assert.match(appCss, /\.program-family-mark\s*{[^}]*border:\s*1px solid var\(--line-soft\);/s);
  assert.match(appCss, /\.program-family-mark \.brand-mark\s*{[^}]*border:\s*0;/s);
});

test('desktop detail close suppresses same-query auto selection', () => {
  assert.match(appSource, /const \[autoSelectDismissedQuery, setAutoSelectDismissedQuery\]/);
  assert.match(appSource, /autoSelectDismissedQuery === query/);
  assert.match(appSource, /setAutoSelectDismissedQuery\(query \|\| null\)/);
  assert.match(appSource, /event\.stopPropagation\(\)/);
  assert.match(appSource, /onClose=\{closeSelectedFeature\}/);
});

test('mobile sheet actions preserve touch targets', () => {
  assert.match(appCss, /\.mobile-actions button strong\s*{[^}]*border-top:\s*1px solid var\(--line-soft\);/s);
  assert.match(appCss, /\.mobile-sheet \.primary-action\s*,\s*\n\s*\.mobile-sheet \.results-load-more\s*{[^}]*min-height:\s*44px;/s);
  assert.match(appCss, /\.mobile-type-strip \.quick-type-chip\s*,\s*\n\s*\.mobile-filter-wrap \.type-pill\s*,\s*\n\s*\.mobile-filter-wrap \.filter-chip\s*{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/s);
});
