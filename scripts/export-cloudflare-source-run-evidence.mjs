import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

function withoutGeneratedAt(value) {
  return {
    ...value,
    generatedAt: null,
  };
}

export function evidenceMatchesExceptGeneratedAt(left, right) {
  return JSON.stringify(withoutGeneratedAt(left)) === JSON.stringify(withoutGeneratedAt(right));
}

async function readExistingEvidence(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function writeEvidenceIfChanged(filePath, evidence) {
  const existing = await readExistingEvidence(filePath);
  if (existing && evidenceMatchesExceptGeneratedAt(existing, evidence)) {
    return false;
  }

  await fs.writeFile(filePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  return true;
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

  const changed = await writeEvidenceIfChanged(outputPath, evidence);
  console.log(
    `cloudflare-source-run-evidence: ${evidence.stats.uniqueSources} sources, ` +
      `${evidence.stats.readyTasksWithCloudflareEvidence}/${evidence.stats.readyTasks} ready tasks, ` +
      `${changed ? 'updated' : 'unchanged'}`,
  );
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
