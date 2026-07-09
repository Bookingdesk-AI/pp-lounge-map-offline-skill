import crypto from 'node:crypto';
import fs from 'node:fs/promises';
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


async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(fullPath)));
    else files.push(fullPath);
  }
  return files;
}

async function collectIntegrityEvidence(skillDir) {
  const files = await walk(skillDir);
  const relativePaths = files
    .map((filePath) => path.relative(skillDir, filePath).split(path.sep).join('/'))
    .sort((left, right) => left.localeCompare(right));
  let markdownFilesChecked = 0;
  let markdownLinksChecked = 0;
  for (const filePath of files) {
    if (path.extname(filePath) !== '.md') continue;
    markdownFilesChecked += 1;
    const content = await fs.readFile(filePath, 'utf8');
    for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/gu)) {
      const target = match[1].trim();
      if (!target || target.startsWith('#') || /^[a-z][a-z0-9+.-]*:/iu.test(target)) continue;
      markdownLinksChecked += 1;
    }
  }
  return {
    skillDir: path.relative(projectRoot, skillDir),
    filesScanned: files.length,
    checkedFileInventoryDigest: crypto.createHash('sha256').update(relativePaths.join('\n')).digest('hex'),
    checkedFileInventorySample: relativePaths.slice(0, 10),
    markdownFilesChecked,
    markdownLinksChecked,
  };
}

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
      path.join('references', 'operator-trust-evidence.md'),
      path.join('references', 'publishing.md'),
    ],
    forbidHttpUrlsInMarkdown: true,
    docsThatMustReferenceRequiredReferences: ['SKILL.md', 'README.md'],
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
  const sourceIntegrity = await collectIntegrityEvidence(validationOptions.skillDir);
  const exportedSkillCandidates = [
    path.join(projectRoot, 'out', 'pp-lounge-map-offline-skill', 'skills', OFFLINE_SKILL_NAME),
    path.join(projectRoot, 'out', 'pp-lounge-map-offline-skill', 'skills', 'pp-lounge-map-offline'),
  ];
  let exportedIntegrity = null;
  for (const candidate of exportedSkillCandidates) {
    try {
      exportedIntegrity = await collectIntegrityEvidence(candidate);
      break;
    } catch {
      // Try the next historical offline export skill name before reporting absence.
    }
  }
  if (!exportedIntegrity) {
    exportedIntegrity = {
      skillDirCandidates: exportedSkillCandidates.map((candidate) => path.relative(projectRoot, candidate)),
      status: 'not-present',
    };
  }

  console.log(
    `publish-check: evidence ${JSON.stringify({
      skill: validationOptions.expectedName,
      skillDir: path.relative(projectRoot, validationOptions.skillDir),
      requiredReferences: validationOptions.requiredReferences,
      requiredAsset: validationOptions.assetRelativePath,
      maxAssetBytes: validationOptions.maxAssetBytes,
      markdownHttpUrlsForbidden: validationOptions.forbidHttpUrlsInMarkdown,
      docsThatMustReferenceRequiredReferences: validationOptions.docsThatMustReferenceRequiredReferences,
      sourceIntegrity,
      exportedIntegrity,
    })}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
