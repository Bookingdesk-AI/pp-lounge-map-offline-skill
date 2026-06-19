import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSourceIntakeBatchResponse,
  createSourceIntakeProbeResponse,
  createSourceIntakeStatusResponse,
} from '../mcp/source-intake.js';

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

function textResponse(body, init = {}) {
  return new Response(body, {
    status: init.status ?? 200,
    headers: {
      'content-type': init.contentType ?? 'text/html; charset=utf-8',
    },
  });
}

function createD1Mock() {
  const calls = [];
  const rows = [];
  return {
    calls,
    rows,
    prepare(sql) {
      return {
        bind(...params) {
          calls.push({ sql, params });
          if (sql.includes('INSERT INTO source_runs')) {
            const [id, generatedAt, policyJson, statsJson, sourcesJson] = params;
            rows.push({
              id,
              generated_at: generatedAt,
              policy_json: policyJson,
              stats_json: statsJson,
              sources_json: sourcesJson,
            });
          }
          return {
            async run() {
              return { success: true };
            },
          };
        },
        async all() {
          return { results: rows };
        },
      };
    },
  };
}

test('Cloudflare source intake probe requires token auth', async () => {
  const response = await createSourceIntakeProbeResponse(
    new Request('https://loungeguru.desk.travel/admin/source-intake/probe', { method: 'POST' }),
    {
      LOUNGE_GURU_INTAKE_TOKEN: 'secret',
      LOUNGE_GURU_DB: createD1Mock(),
    },
    {
      fetchImpl: async () => jsonResponse({}),
    },
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: 'forbidden' });
});

test('Cloudflare source intake probe writes bounded source run evidence', async () => {
  const d1 = createD1Mock();
  const fetchedUrls = [];
  const response = await createSourceIntakeProbeResponse(
    new Request('https://loungeguru.desk.travel/admin/source-intake/probe?sourceId=mastercard-travel-pass', {
      method: 'POST',
      headers: {
        'x-lounge-guru-intake-token': 'secret',
      },
    }),
    {
      LOUNGE_GURU_INTAKE_TOKEN: 'secret',
      LOUNGE_GURU_DB: d1,
    },
    {
      fetchImpl: async (url) => {
        fetchedUrls.push(url);
        if (String(url).endsWith('/robots.txt')) {
          return textResponse('User-agent: *\n');
        }
        return textResponse('<html><title>Mastercard Travel Pass</title><body>Airport lounge program</body></html>');
      },
    },
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.sourceId, 'mastercard-travel-pass');
  assert.equal(body.cloudflareRuntime, true);
  assert.equal(body.cloudflareSnapshot, true);
  assert.equal(body.stats.fetched, 1);
  assert.ok(fetchedUrls.includes('https://mastercardtravelpass.dragonpass.com/robots.txt'));
  assert.ok(fetchedUrls.includes('https://mastercardtravelpass.dragonpass.com/'));
  assert.equal(d1.calls.length, 1);

  const [, , policyJson, statsJson, sourcesJson] = d1.calls[0].params;
  const policy = JSON.parse(policyJson);
  const stats = JSON.parse(statsJson);
  const sources = JSON.parse(sourcesJson);

  assert.equal(policy.execution.runtime, 'cloudflare');
  assert.equal(policy.execution.localScrawl, 'blocked');
  assert.equal(stats.totalSources, 1);
  assert.equal(sources[0].sourceId, 'mastercard-travel-pass');
  assert.equal(sources[0].cloudflareSnapshot, true);
  assert.ok(sources[0].sha256);
  assert.ok(!Object.hasOwn(sources[0], 'text'));
  assert.ok(!Object.hasOwn(sources[0], 'html'));
});

test('Cloudflare source intake batch probes ready official-page tasks only', async () => {
  const d1 = createD1Mock();
  const response = await createSourceIntakeBatchResponse(
    new Request('https://loungeguru.desk.travel/admin/source-intake/probe-batch', {
      method: 'POST',
      headers: {
        'x-lounge-guru-intake-token': 'secret',
      },
    }),
    {
      LOUNGE_GURU_INTAKE_TOKEN: 'secret',
      LOUNGE_GURU_DB: d1,
    },
    {
      fetchImpl: async (url) => {
        if (String(url).endsWith('/robots.txt')) {
          return textResponse('User-agent: *\n');
        }
        return textResponse(`<html><title>${url}</title></html>`);
      },
    },
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.mode, 'batch');
  assert.equal(body.totalTasks, 3);
  assert.equal(body.fetched, 3);
  assert.equal(d1.calls.length, 3);
  assert.deepEqual(
    body.results.map((result) => result.sourceId).sort(),
    ['dragonpass', 'mastercard-travel-pass', 'visa-airport-companion'],
  );
});

test('Cloudflare source intake status returns compact D1 evidence', async () => {
  const d1 = createD1Mock();
  const env = {
    LOUNGE_GURU_INTAKE_TOKEN: 'secret',
    LOUNGE_GURU_DB: d1,
  };
  await createSourceIntakeBatchResponse(
    new Request('https://loungeguru.desk.travel/admin/source-intake/probe-batch?sourceIds=visa-airport-companion', {
      method: 'POST',
      headers: {
        'x-lounge-guru-intake-token': 'secret',
      },
    }),
    env,
    {
      fetchImpl: async (url) => {
        if (String(url).endsWith('/robots.txt')) {
          return textResponse('User-agent: *\n');
        }
        return textResponse('<html><title>Visa Airport Companion</title></html>');
      },
    },
  );

  const response = await createSourceIntakeStatusResponse(
    new Request('https://loungeguru.desk.travel/admin/source-intake/status', {
      method: 'GET',
      headers: {
        'x-lounge-guru-intake-token': 'secret',
      },
    }),
    env,
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.policy.localScrawl, 'blocked');
  assert.equal(body.policy.rawPageContentCommitted, false);
  assert.equal(body.stats.readyTasks, 3);
  assert.equal(body.stats.readyTasksWithCloudflareEvidence, 1);
  assert.deepEqual(body.sources.map((source) => source.sourceId), ['visa-airport-companion']);
  assert.ok(body.sources[0].sha256);
  assert.ok(!Object.hasOwn(body.sources[0], 'text'));
  assert.ok(!Object.hasOwn(body.sources[0], 'html'));
});
