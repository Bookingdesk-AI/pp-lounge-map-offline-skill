import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateSkillBundle } from './lib/publish-safety.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const skillDir = path.resolve(projectRoot, 'skills', 'pp-lounge-map');

async function main() {
  const issues = await validateSkillBundle({ projectRoot, skillDir });

  if (issues.length > 0) {
    for (const issue of issues) {
      console.error(`publish-check: ${issue}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('publish-check: public skill bundle passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
