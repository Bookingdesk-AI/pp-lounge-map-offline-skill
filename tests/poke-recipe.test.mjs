import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';

import {
  getPokeRecipePath,
  parsePokeRecipe,
  POKE_INTEGRATION_NAME,
  POKE_MCP_ENDPOINT,
} from '../scripts/lib/poke-recipe.mjs';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

test('hosted poke recipe draft validates and points at the live MCP endpoint', async () => {
  const recipePath = getPokeRecipePath(projectRoot);
  const raw = JSON.parse(await fs.readFile(recipePath, 'utf8'));
  const recipe = parsePokeRecipe(raw);

  assert.equal(recipe.name, POKE_INTEGRATION_NAME);
  assert.equal(recipe.integrations.required[0].url, POKE_MCP_ENDPOINT);
  assert.equal(recipe.integrations.required[0].transport, 'streamable-http');
  assert.equal(recipe.integrations.required[0].authentication, 'none');
  assert.equal(recipe.automations.length, 3);
});

test('poke bootstrap helper prints the canonical MCP add command', async () => {
  const scriptPath = path.resolve(projectRoot, 'scripts', 'print-poke-bootstrap.mjs');
  const { stdout, stderr } = await execFileAsync(process.execPath, [scriptPath], {
    cwd: projectRoot,
  });

  assert.equal(stderr, '');
  assert.match(stdout, new RegExp(POKE_MCP_ENDPOINT.replaceAll('.', '\\.')));
  assert.match(
    stdout,
    /npx poke@latest mcp add https:\/\/prioritypassmap\.desk\.travel\/mcp -n "PP Lounge Map"/,
  );
});
