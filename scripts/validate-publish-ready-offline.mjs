import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getOfflineSkillPaths,
  OFFLINE_ASSET_MAX_BYTES,
  OFFLINE_SKILL_NAME,
} from './lib/offline-skill-build.mjs';
import { validateSkillBundleWithOptions } from './lib/publish-safety.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

async function main() {
  const { skillDir } = getOfflineSkillPaths(projectRoot);
  const issues = await validateSkillBundleWithOptions({
    projectRoot,
    skillDir,
    expectedName: OFFLINE_SKILL_NAME,
    maxAssetBytes: OFFLINE_ASSET_MAX_BYTES,
    assetRelativePath: path.join('assets', 'catalog.json'),
    forbidHttpUrlsInMarkdown: true,
  });

  if (issues.length > 0) {
    for (const issue of issues) {
      console.error(`publish-check: ${issue}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('publish-check: offline skill bundle passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
