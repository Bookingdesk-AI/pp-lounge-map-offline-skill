import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateSkillBundle } from '../scripts/lib/publish-safety.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const skillDir = path.resolve(projectRoot, 'skills', 'pp-lounge-map');

test('public skill bundle passes the safety validator', async () => {
  const issues = await validateSkillBundle({ projectRoot, skillDir });
  assert.deepEqual(issues, []);
});
