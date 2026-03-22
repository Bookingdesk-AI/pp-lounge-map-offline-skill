import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildOfflineSkill } from './lib/offline-skill-build.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

buildOfflineSkill(projectRoot)
  .then(({ assetBytes }) => {
    console.log(`Built offline skill runtime and asset (${assetBytes} bytes).`);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
