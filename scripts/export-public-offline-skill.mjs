import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildOfflineSkill,
  getOfflineSkillPaths,
  OFFLINE_SKILL_NAME,
} from './lib/offline-skill-build.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

async function copyDir(source, destination) {
  await fs.mkdir(destination, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      await copyDir(sourcePath, destinationPath);
      continue;
    }

    await fs.copyFile(sourcePath, destinationPath);
  }
}

async function main() {
  await buildOfflineSkill(projectRoot);
  const { skillDir, exportDir } = getOfflineSkillPaths(projectRoot);

  await fs.rm(exportDir, { recursive: true, force: true });
  await copyDir(skillDir, path.resolve(exportDir, 'skills', OFFLINE_SKILL_NAME));
  await fs.copyFile(path.resolve(projectRoot, 'LICENSE'), path.resolve(exportDir, 'LICENSE'));
  await fs.writeFile(
    path.resolve(exportDir, 'README.md'),
    `# ${OFFLINE_SKILL_NAME}\n\nPortable offline skill bundle for Priority Pass lounge lookup.\n\n## Runtime\n\n1. Install package dependencies once.\n2. Start the local stdio MCP server with \`node skills/${OFFLINE_SKILL_NAME}/scripts/run-offline-mcp.mjs\`.\n3. Point your MCP client at that command.\n\n## Integrity checkpoints\n\nBefore publishing or mirroring this bundle, verify these packaged paths exist:\n\n- \`skills/${OFFLINE_SKILL_NAME}/SKILL.md\`\n- \`skills/${OFFLINE_SKILL_NAME}/references/mcp.md\`\n- \`skills/${OFFLINE_SKILL_NAME}/references/safety.md\`\n- \`skills/${OFFLINE_SKILL_NAME}/references/publishing.md\`\n- \`skills/${OFFLINE_SKILL_NAME}/scripts/run-offline-mcp.mjs\`\n\nRun \`npm run validate:publish:offline\` from the source repo before shipping; it checks frontmatter, markdown references, synchronized source/package docs, runtime mirror files, and package entrypoints.\n\n## Trust boundary\n\nThis artifact is local-only at runtime. It uses the bundled catalog snapshot and does not require network access to answer lounge queries.\n\nIt has no OAuth flows, no sensitive credential collection, and no purchase/payment execution. Catalog \`url\` fields are display metadata only; do not fetch them while operating the offline bundle.\n`,
    'utf8',
  );
  await fs.writeFile(
    path.resolve(exportDir, 'package.json'),
    `${JSON.stringify(
      {
        name: 'pp-lounge-map-offline-skill',
        private: true,
        type: 'module',
        version: '1.0.0',
        scripts: {
          mcp: `node skills/${OFFLINE_SKILL_NAME}/scripts/run-offline-mcp.mjs`,
        },
        dependencies: {
          '@modelcontextprotocol/sdk': '^1.27.1',
          zod: '^4.3.6',
        },
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  console.log(`Exported offline skill bundle to ${path.relative(projectRoot, exportDir)}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
