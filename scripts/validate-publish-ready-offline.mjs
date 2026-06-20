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
  const validationOptions = {
    projectRoot,
    skillDir,
    expectedName: OFFLINE_SKILL_NAME,
    maxAssetBytes: OFFLINE_ASSET_MAX_BYTES,
    assetRelativePath: path.join('assets', 'catalog.json'),
    requiredReferences: [
      path.join('references', 'mcp.md'),
      path.join('references', 'safety.md'),
      path.join('references', 'publishing.md'),
    ],
    forbidHttpUrlsInMarkdown: true,
  };
  const issues = await validateSkillBundleWithOptions(validationOptions);

  if (issues.length > 0) {
    for (const issue of issues) {
      console.error(`publish-check: ${issue}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('publish-check: offline skill bundle passed.');
  console.log(
    `publish-check: evidence ${JSON.stringify({
      skill: validationOptions.expectedName,
      skillDir: path.relative(projectRoot, validationOptions.skillDir),
      requiredReferences: validationOptions.requiredReferences,
      requiredAsset: validationOptions.assetRelativePath,
      maxAssetBytes: validationOptions.maxAssetBytes,
      markdownHttpUrlsForbidden: validationOptions.forbidHttpUrlsInMarkdown,
    })}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
