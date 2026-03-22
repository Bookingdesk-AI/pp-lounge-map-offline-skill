import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getPokeRecipePath, parsePokeRecipe, POKE_MCP_ENDPOINT } from './lib/poke-recipe.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

async function main() {
  const recipePath = getPokeRecipePath(projectRoot);
  const raw = JSON.parse(await fs.readFile(recipePath, 'utf8'));
  const recipe = parsePokeRecipe(raw);
  const [integration] = recipe.integrations.required;

  if (integration.url !== POKE_MCP_ENDPOINT) {
    throw new Error(`Recipe integration URL mismatch: expected ${POKE_MCP_ENDPOINT}`);
  }

  console.log(`poke-recipe: validated ${path.relative(projectRoot, recipePath)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
