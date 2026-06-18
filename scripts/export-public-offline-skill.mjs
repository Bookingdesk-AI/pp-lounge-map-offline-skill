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

  const exportedSkillName = 'pp-lounge-map-offline';
  const exportedSkillDir = path.resolve(exportDir, 'skills', exportedSkillName);
  await copyDir(skillDir, exportedSkillDir);
  const exportedSkillPath = path.resolve(exportedSkillDir, 'SKILL.md');
  const exportedSkillText = await fs.readFile(exportedSkillPath, 'utf8');
  await fs.writeFile(
    exportedSkillPath,
    exportedSkillText
      .replace('name: lounge-guru-offline', `name: ${exportedSkillName}`)
      .replaceAll(OFFLINE_SKILL_NAME, exportedSkillName)
      .replaceAll('Lounge Guru', 'PP Lounge Map'),
    'utf8',
  );

  await fs.copyFile(path.resolve(projectRoot, 'LICENSE'), path.resolve(exportDir, 'LICENSE'));
  await fs.writeFile(
    path.resolve(exportDir, 'README.md'),
    `# pp-lounge-map-offline-skill\n\nPortable offline skill bundle for PP Lounge Map airport lounge lookup.\n\n## Runtime\n\n1. Install package dependencies once.\n2. Start the local stdio MCP server with \`node skills/pp-lounge-map-offline/scripts/run-offline-mcp.mjs\`.\n3. Point your MCP client at that command.\n\n## Trust boundary\n\nThis artifact is local-only at runtime. It uses the bundled catalog snapshot and does not require network access to answer lounge queries.\n`,
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
          mcp: `node skills/pp-lounge-map-offline/scripts/run-offline-mcp.mjs`,
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
