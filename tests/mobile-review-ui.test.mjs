import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const appCss = fs.readFileSync(new URL('../src/App.css', import.meta.url), 'utf8');

test('mobile review exposes compact section tabs with source proof workflow', () => {
  for (const tab of ['blockers', 'sources', 'cf', 'families', 'queue']) {
    assert.match(appSource, new RegExp(`id: '${tab}'`));
  }

  assert.match(appSource, /role="tablist"/);
  assert.match(appSource, /aria-label="Review sections"/);
  assert.match(appSource, /role="tab"/);
  assert.match(appSource, /aria-selected=/);
  assert.match(appSource, /Proof/);
  assert.match(appSource, /readyMemberGapsWithCloudflareEvidence/);
  assert.match(appSource, /sourceLaneStats/);
  assert.match(appSource, /review-lane-grid/);
  assert.match(appSource, /row\.gap\.status === 'ready' && !row\.evidence\?\.cloudflareSnapshot/);
  assert.match(appSource, /href={gap\.url}/);
  assert.match(appSource, /{gap\.sourceId}/);
  assert.doesNotMatch(appSource, /sourceGapRows\.slice/);
});

test('mobile review tabs keep production touch targets', () => {
  assert.match(appCss, /\.mobile-review-tabs button\s*{[^}]*min-height:\s*44px;/s);
  assert.match(appCss, /\.mobile-review-tabs button:focus-visible\s*{/);
  assert.match(appCss, /\.review-lane-grid\s*{/);
  assert.match(appCss, /\.review-row\s*{[^}]*text-decoration:\s*none;/s);
});
