import test from 'node:test';
import assert from 'node:assert/strict';
import { credentialPreflight } from '../scripts/lib/cloudflare-auth-preflight.mjs';

function fakeExecFromResults(results) {
  let index = 0;
  return () => {
    const result = results[index++] ?? results.at(-1);
    if (result === 'ok') {
      return 'ok';
    }

    const error = new Error('wrangler failed');
    error.stderr = result;
    throw error;
  };
}

test('credential preflight stays redacted without auth probing', () => {
  const preflight = credentialPreflight(
    { requiredTokenEnv: 'LOUNGE_GURU_INTAKE_TOKEN' },
    {
      env: {
        CLOUDFLARE_API_TOKEN: 'secret',
        LOUNGE_GURU_INTAKE_TOKEN: 'secret',
      },
      checkAuth: false,
      execFileSync: fakeExecFromResults(['ok']),
    },
  );

  assert.deepEqual(preflight, {
    intakeTokenEnv: 'LOUNGE_GURU_INTAKE_TOKEN',
    intakeTokenPresent: true,
    cloudflareApiTokenPresent: true,
    cloudflareAuthStatus: 'unchecked',
    cloudflareAuthCurrentEnv: 'unchecked',
    cloudflareAuthOauthFallback: 'unchecked',
    cloudflareAuthFailure: null,
    baseUrlEnvPresent: false,
    localScrawl: 'blocked',
  });
});

test('credential preflight detects invalid env token with OAuth fallback', () => {
  const preflight = credentialPreflight(
    { requiredTokenEnv: 'LOUNGE_GURU_INTAKE_TOKEN' },
    {
      env: {
        CLOUDFLARE_API_TOKEN: 'invalid',
      },
      checkAuth: true,
      execFileSync: fakeExecFromResults(['Invalid access token [code: 9109]', 'ok']),
    },
  );

  assert.equal(preflight.intakeTokenPresent, false);
  assert.equal(preflight.cloudflareApiTokenPresent, true);
  assert.equal(preflight.cloudflareAuthStatus, 'env_token_invalid_oauth_ok');
  assert.equal(preflight.cloudflareAuthCurrentEnv, 'failed');
  assert.equal(preflight.cloudflareAuthOauthFallback, 'ok');
  assert.equal(preflight.cloudflareAuthFailure, 'invalid_api_token');
  assert.equal(preflight.localScrawl, 'blocked');
});

test('credential preflight reports auth failure without raw output', () => {
  const preflight = credentialPreflight(
    { requiredTokenEnv: 'LOUNGE_GURU_INTAKE_TOKEN' },
    {
      env: {},
      checkAuth: true,
      execFileSync: fakeExecFromResults(['Please run wrangler login']),
    },
  );

  assert.equal(preflight.cloudflareApiTokenPresent, false);
  assert.equal(preflight.cloudflareAuthStatus, 'failed');
  assert.equal(preflight.cloudflareAuthCurrentEnv, 'failed');
  assert.equal(preflight.cloudflareAuthOauthFallback, 'not_checked');
  assert.equal(preflight.cloudflareAuthFailure, 'not_authenticated');
});
