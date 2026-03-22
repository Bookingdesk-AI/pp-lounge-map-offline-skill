import { buildPokeBootstrapLines } from './lib/poke-recipe.mjs';

for (const line of buildPokeBootstrapLines()) {
  console.log(line);
}
