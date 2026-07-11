import { pathToFileURL } from 'node:url';

import { exportCloudflareSourceRunEvidence } from './export-cloudflare-source-run-evidence.mjs';
import { parseArgs, runCloudflareSourceIntake } from './run-cloudflare-source-intake.mjs';

export async function runCloudflareSourceIntakeFlow({
  args = process.argv.slice(2),
  env = process.env,
  fetchImpl = fetch,
  log = console.log,
  exportEvidence = exportCloudflareSourceRunEvidence,
} = {}) {
  const options = parseArgs(args, env);
  const summary = await runCloudflareSourceIntake({ args, env, fetchImpl, log });

  if (options.mode === 'batch' && !options.dryRun) {
    const evidence = await exportEvidence({ env, log });
    return { ...summary, evidence };
  }

  return summary;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  runCloudflareSourceIntakeFlow().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
