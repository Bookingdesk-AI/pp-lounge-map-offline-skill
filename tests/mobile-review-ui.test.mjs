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
  assert.match(appSource, /nextCloudflareIntake/);
  assert.match(appSource, /preflightStats/);
  assert.match(appSource, /LOUNGE_GURU_INTAKE_TOKEN|intakePreflight\.requiredTokenEnv/);
  assert.match(appSource, /report:export/);
  assert.match(appSource, /blockerRows/);
  assert.match(appSource, /approvedRecordsRemaining/);
  assert.match(appSource, /approvalsNeededForCurrentCatalogRatio/);
  assert.match(appSource, /reviewRecordsToResolve/);
  assert.match(appSource, /aria-label={`\$\{row\.label\} \$\{row\.value\}`}/);
  assert.match(appSource, /formatSourceRuntime/);
  assert.match(appSource, /return 'Legacy local'/);
  assert.match(appSource, /title={sourceRuntime}/);
  assert.match(appSource, /isPriorityPassRecord/);
  assert.match(appSource, /manual_review_required/);
  assert.match(appSource, /reviewRecordCandidates/);
  assert.match(appSource, /nonPriorityPassReviewTotal/);
  assert.match(appSource, /Non-PP/);
  assert.match(appSource, /\[\.\.\.reviewRecordCandidates\]\.sort\(reviewQueueSort\)\.slice\(0, 12\)/);
  assert.match(appSource, /record\.quality\.completeness}%/);
  assert.match(appSource, /aria-label={`\$\{record\.lounge\.name\} \$\{record\.airport\.iata\} \$\{record\.quality\.completeness\}% \$\{formatSourceConfidence\(primarySource\?\.confidence\)\}`}/);
  assert.match(appSource, /primarySource\?\.sourceId \?\? 'unknown'/);
  assert.match(appSource, /formatSourceConfidence\(primarySource\?\.confidence\)/);
  assert.match(appSource, /formatSourceDate\(primarySource\?\.retrievedAt\)/);
  assert.match(appSource, /review-lane-grid/);
  assert.match(appSource, /row\.gap\.status === 'ready' && !row\.evidence\?\.cloudflareSnapshot/);
  assert.match(appSource, /href={gap\.url}/);
  assert.match(appSource, /{gap\.sourceId}/);
  assert.doesNotMatch(appSource, /sourceGapRows\.slice/);
  assert.match(appSource, /reviewRecordTotal/);
  assert.match(appSource, /reviewRecords\.length} \/ {reviewRecordTotal}/);
});

test('mobile review tabs keep production touch targets', () => {
  assert.match(appCss, /\.mobile-review-tabs button\s*{[^}]*min-height:\s*44px;/s);
  assert.match(appCss, /\.mobile-review-tabs button:focus-visible\s*{/);
  assert.match(appCss, /\.review-blocker-grid\s*{/);
  assert.match(appCss, /\.review-lane-grid\s*{/);
  assert.match(appCss, /\.review-row\.is-preflight\s*{[^}]*margin-top:\s*0\.44rem;/s);
  assert.match(appCss, /\.review-row-badges\s*{[^}]*flex-wrap:\s*wrap;/s);
  assert.match(appCss, /\.review-row\s*{[^}]*text-decoration:\s*none;/s);
});
