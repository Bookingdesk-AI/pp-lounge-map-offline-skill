import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('public data JSON contracts validate', () => {
  const output = execFileSync(process.execPath, ['scripts/validate-public-json.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  });

  assert.match(output, /public-json-check: validated \d+ public data files\./);
});
