import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseUiSmokeArgs } from '../scripts/smoke-ui.mjs';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('UI smoke parses default live target and selected record', () => {
  const options = parseUiSmokeArgs([], {});

  assert.equal(options.baseUrl, 'https://loungeguru.desk.travel');
  assert.equal(options.selectedId, 'BOS-bos19-chase-sapphire-lounge-by-the-club-357');
  assert.equal(options.expectedLogo, 'chase-sapphire.svg');
  assert.equal(options.expectedLogoExplicit, false);
  assert.equal(options.timeoutMs, 20_000);
  assert.equal(options.checkReviewQueue, false);
});

test('UI smoke accepts local preview options', () => {
  const options = parseUiSmokeArgs([
    '--base-url=http://127.0.0.1:4302/path',
    '--selected=test-record',
    '--expected-logo=priority-pass.svg',
    '--chrome-bin=/tmp/chrome',
    '--timeout-ms=7000',
    '--check-review-queue',
  ]);

  assert.equal(options.baseUrl, 'http://127.0.0.1:4302');
  assert.equal(options.selectedId, 'test-record');
  assert.equal(options.expectedLogo, 'priority-pass.svg');
  assert.equal(options.expectedLogoExplicit, true);
  assert.equal(options.chromeBin, '/tmp/chrome');
  assert.equal(options.timeoutMs, 7000);
  assert.equal(options.checkReviewQueue, true);
});

test('UI smoke accepts review queue env flag', () => {
  const options = parseUiSmokeArgs([], { LOUNGE_GURU_UI_SMOKE_CHECK_REVIEW_QUEUE: '1' });

  assert.equal(options.checkReviewQueue, true);
});

test('UI smoke rejects unsafe or incomplete options', () => {
  assert.throws(() => parseUiSmokeArgs(['--base-url=file:///tmp/index.html']), /HTTP or HTTPS/);
  assert.throws(() => parseUiSmokeArgs(['--selected=']), /selected id/);
  assert.throws(() => parseUiSmokeArgs(['--timeout-ms=1000']), /at least 5000ms/);
  assert.throws(() => parseUiSmokeArgs(['--unknown']), /Unknown argument/);
});

test('package exposes UI smoke command', () => {
  assert.equal(packageJson.scripts['smoke:ui'], 'node scripts/smoke-ui.mjs');
});
