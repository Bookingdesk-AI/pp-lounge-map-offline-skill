import { execFileSync as defaultExecFileSync } from 'node:child_process';

function classifyWranglerError(output) {
  if (/Invalid access token|code:\s*9109/i.test(output)) {
    return 'invalid_api_token';
  }

  if (/not authenticated|not logged in|login/i.test(output)) {
    return 'not_authenticated';
  }

  return 'unknown';
}

function runWranglerWhoami({ env, execFileSync = defaultExecFileSync }) {
  try {
    execFileSync('npx', ['wrangler', 'whoami'], {
      encoding: 'utf8',
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
    });
    return { ok: true, failure: null };
  } catch (error) {
    const stderr = typeof error?.stderr === 'string' ? error.stderr : '';
    const stdout = typeof error?.stdout === 'string' ? error.stdout : '';
    return {
      ok: false,
      failure: classifyWranglerError(`${stdout}\n${stderr}`),
    };
  }
}

export function checkCloudflareAuth({ env = process.env, execFileSync = defaultExecFileSync } = {}) {
  const current = runWranglerWhoami({ env, execFileSync });

  if (current.ok) {
    return {
      status: 'ok',
      currentEnv: 'ok',
      oauthFallback: 'not_needed',
      failure: null,
    };
  }

  if (!env.CLOUDFLARE_API_TOKEN) {
    return {
      status: 'failed',
      currentEnv: 'failed',
      oauthFallback: 'not_checked',
      failure: current.failure,
    };
  }

  const oauthEnv = { ...env };
  delete oauthEnv.CLOUDFLARE_API_TOKEN;
  const oauth = runWranglerWhoami({ env: oauthEnv, execFileSync });

  if (oauth.ok) {
    return {
      status: 'env_token_invalid_oauth_ok',
      currentEnv: 'failed',
      oauthFallback: 'ok',
      failure: current.failure,
    };
  }

  return {
    status: 'failed',
    currentEnv: 'failed',
    oauthFallback: 'failed',
    failure: current.failure,
  };
}

export function credentialPreflight(
  nextCloudflareIntake,
  {
    env = process.env,
    checkAuth = false,
    execFileSync = defaultExecFileSync,
  } = {},
) {
  const requiredIntakeTokenEnv = nextCloudflareIntake?.requiredTokenEnv ?? 'LOUNGE_GURU_INTAKE_TOKEN';
  const auth = checkAuth ? checkCloudflareAuth({ env, execFileSync }) : null;

  return {
    intakeTokenEnv: requiredIntakeTokenEnv,
    intakeTokenPresent: Boolean(env[requiredIntakeTokenEnv]),
    cloudflareApiTokenPresent: Boolean(env.CLOUDFLARE_API_TOKEN),
    cloudflareAuthStatus: auth?.status ?? 'unchecked',
    cloudflareAuthCurrentEnv: auth?.currentEnv ?? 'unchecked',
    cloudflareAuthOauthFallback: auth?.oauthFallback ?? 'unchecked',
    cloudflareAuthFailure: auth?.failure ?? null,
    baseUrlEnvPresent: Boolean(env.LOUNGE_GURU_INTAKE_BASE_URL),
    localScrawl: nextCloudflareIntake?.localScrawl ?? 'blocked',
  };
}
