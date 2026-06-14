import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const skillSourceDir = path.resolve(projectRoot, 'skills', 'lounge-guru');
const outDir = path.resolve(projectRoot, 'out', 'lounge-guru-skill');

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
  await fs.rm(outDir, { recursive: true, force: true });
  await copyDir(skillSourceDir, outDir);
  await fs.copyFile(path.resolve(projectRoot, 'LICENSE'), path.resolve(outDir, 'LICENSE'));
  await fs.writeFile(
    path.resolve(outDir, 'README.md'),
    `# lounge-guru skill\n\nThis repo is the public skill bundle mirror used for marketplace publishing.\n\n## Install\n\n- skills.sh: \`npx skills add <owner>/<repo>\`\n- ClawHub: publish the same bundle directory with semver.\n\n## Trust boundary\n\nThis bundle is read-only and is designed to work with the public \`lounge-guru\` MCP endpoint. It does not contain rebuild, deploy, spreadsheet, or secret-handling workflows.\n`,
    'utf8',
  );

  console.log(`Exported public skill bundle to ${path.relative(projectRoot, outDir)}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
