import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createCloudflareSourceRunEvidence } from './lib/cloudflare-source-run-evidence.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const defaultOutputPath = path.resolve(projectRoot, 'public', 'data', 'cloudflare-source-run-evidence.json');
const intakePlanPath = path.resolve(projectRoot, 'public', 'data', 'cloudflare-source-intake-plan.json');
const query = [
  'SELECT id, generated_at, policy_json, stats_json, sources_json',
  'FROM source_runs',
  "WHERE id LIKE 'cloudflare-probe-%'",
  'ORDER BY generated_at DESC',
  'LIMIT 100',
].join(' ');

function argValue(args, name) {
  const prefix = `${name}=`;
  const match = args.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function withoutApiToken(env) {
  const { CLOUDFLARE_API_TOKEN: _apiToken, ...rest } = env;
  return rest;
}

function errorText(error) {
  return [
    error?.message,
    error?.stdout,
    error?.stderr,
    ...(Array.isArray(error?.output) ? error.output : []),
  ]
    .filter(Boolean)
    .join('\n');
}

export function shouldRetryWithoutApiToken(error, env = process.env) {
  if (!env.CLOUDFLARE_API_TOKEN) {
    return false;
  }

  return /Authentication error|Invalid access token/i.test(errorText(error));
}

function executeWranglerD1(env = process.env) {
  return execFileSync(
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
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
}

async function readD1Result({ args = process.argv.slice(2), env = process.env, log = console.log } = {}) {
  const input = argValue(args, '--input');
  if (input) {
    return JSON.parse(await fs.readFile(path.resolve(projectRoot, input), 'utf8'));
  }

  let stdout;
  try {
    stdout = executeWranglerD1(env);
  } catch (error) {
    if (!shouldRetryWithoutApiToken(error, env)) {
      throw error;
    }
    log('cloudflare-source-run-evidence: API token auth failed; retrying with OAuth');
    stdout = executeWranglerD1(withoutApiToken(env));
  }
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

export async function exportCloudflareSourceRunEvidence({
  args = process.argv.slice(2),
  env = process.env,
  output = defaultOutputPath,
  log = console.log,
} = {}) {
  const [d1Result, sourceIntakePlan] = await Promise.all([
    readD1Result({ args, env, log }),
    fs.readFile(intakePlanPath, 'utf8').then(JSON.parse),
  ]);
  const evidence = createCloudflareSourceRunEvidence({
    d1Result,
    sourceIntakePlan,
  });

  const changed = await writeEvidenceIfChanged(output, evidence);
  log(
    `cloudflare-source-run-evidence: ${evidence.stats.uniqueSources} sources, ` +
      `${evidence.stats.readyTasksWithCloudflareEvidence}/${evidence.stats.readyTasks} ready tasks, ` +
      `${changed ? 'updated' : 'unchanged'}`,
  );
  return { evidence, changed, outputPath: output };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  exportCloudflareSourceRunEvidence().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
