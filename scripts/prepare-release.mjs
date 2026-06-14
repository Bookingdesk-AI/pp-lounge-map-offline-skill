import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveSourceWorkbookConfig } from './lib/source-workbook.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function run(cmd, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: projectRoot,
      env,
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command failed (${code}): ${cmd} ${args.join(' ')}`));
    });
  });
}

async function downloadWorkbook(bucket, objectKey, destinationPath) {
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await run('npx', [
    'wrangler',
    'r2',
    'object',
    'get',
    `${bucket}/${objectKey}`,
    '--file',
    destinationPath,
    '--remote',
  ]);

  const stat = await fs.stat(destinationPath);
  if (stat.size <= 0) {
    throw new Error(`Downloaded workbook is empty: ${destinationPath}`);
  }
}

async function verifyOutputExists(filePath) {
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`Expected release artifact is missing: ${filePath}`);
  }
}

async function main() {
  const { bucket, objectKey, sourcePath } = resolveSourceWorkbookConfig(projectRoot, process.env);
  const releaseEnv = {
    ...process.env,
    SOURCE_XLSX: sourcePath,
  };

  console.log(`Downloading source workbook from R2: ${bucket}/${objectKey}`);
  await downloadWorkbook(bucket, objectKey, sourcePath);

  const steps = [
    ['npm', ['run', 'build:data']],
    ['npm', ['run', 'build:canonical-data']],
    ['npm', ['run', 'build:mcp-data']],
    ['npm', ['run', 'build:offline-skill']],
    ['npm', ['test']],
    ['npm', ['run', 'validate:publish']],
    ['npm', ['run', 'validate:publish:offline']],
    ['npx', ['tsc', '-b']],
    ['npx', ['vite', 'build']],
  ];

  for (const [cmd, args] of steps) {
    await run(cmd, args, releaseEnv);
  }

  await verifyOutputExists(path.resolve(projectRoot, 'public', 'data', 'lounges.geojson'));
  await verifyOutputExists(path.resolve(projectRoot, 'public', 'data', 'meta.json'));
  await verifyOutputExists(path.resolve(projectRoot, 'mcp', 'data', 'catalog.json'));
  await verifyOutputExists(path.resolve(projectRoot, 'dist', 'index.html'));

  console.log('Release preparation completed successfully.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
