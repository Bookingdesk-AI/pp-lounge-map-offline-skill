import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createCloudflareSourceRunEvidence } from './lib/cloudflare-source-run-evidence.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outputPath = path.resolve(projectRoot, 'public', 'data', 'cloudflare-source-run-evidence.json');
const intakePlanPath = path.resolve(projectRoot, 'public', 'data', 'cloudflare-source-intake-plan.json');
const query = [
  'SELECT id, generated_at, policy_json, stats_json, sources_json',
  'FROM source_runs',
  "WHERE id LIKE 'cloudflare-probe-%'",
  'ORDER BY generated_at DESC',
  'LIMIT 100',
].join(' ');

function argValue(name) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

async function readD1Result() {
  const input = argValue('--input');
  if (input) {
    return JSON.parse(await fs.readFile(path.resolve(projectRoot, input), 'utf8'));
  }

  const stdout = execFileSync(
    'npx',
    [
      'wrangler',
      'd1',
      'execute',
      'lounge-guru-catalog',
      '--remote',
      '--config',
      'wrangler.mcp.toml',
      '--json',
      '--command',
      query,
    ],
    {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  return JSON.parse(stdout);
}

async function main() {
  const [d1Result, sourceIntakePlan] = await Promise.all([
    readD1Result(),
    fs.readFile(intakePlanPath, 'utf8').then(JSON.parse),
  ]);
  const evidence = createCloudflareSourceRunEvidence({
    d1Result,
    sourceIntakePlan,
  });

  await fs.writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  console.log(
    `cloudflare-source-run-evidence: ${evidence.stats.uniqueSources} sources, ` +
      `${evidence.stats.readyTasksWithCloudflareEvidence}/${evidence.stats.readyTasks} ready tasks`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
