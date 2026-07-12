import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSourceIntakeBatchResponse,
  createSourceIntakeProbeResponse,
  createSourceIntakeReportResponse,
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
  const fetchedHeaders = [];
  const response = await createSourceIntakeProbeResponse(
    new Request('https://loungeguru.desk.travel/admin/source-intake/probe?sourceId=loungekey', {
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
      fetchImpl: async (url, init = {}) => {
        fetchedHeaders.push(init.headers ?? {});
        fetchedUrls.push(url);
        if (String(url).endsWith('/robots.txt')) {
          return textResponse('User-agent: *\n');
        }
        return textResponse(
          '<html><title>LoungeKey</title><body>John F Kennedy International Airport (JFK)<a href="/airport-lounges/jfk">JFK lounge</a><a href="/news/jfk-lounge-award">News</a></body></html>',
        );
      },
    },
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.sourceId, 'loungekey');
  assert.equal(body.cloudflareRuntime, true);
  assert.equal(body.cloudflareSnapshot, true);
  assert.equal(body.stats.fetched, 1);
  assert.ok(fetchedUrls.includes('https://www.loungekey.com/robots.txt'));
  assert.ok(fetchedUrls.includes('https://www.loungekey.com/'));
  assert.ok(fetchedHeaders.some((headers) => /Mozilla\/5\.0/.test(headers?.['user-agent'] ?? '')));
  assert.ok(fetchedHeaders.every((headers) => headers?.['accept-language'] === 'en-US,en;q=0.9'));
  assert.ok(fetchedHeaders.every((headers) => headers?.['cache-control'] === 'no-cache'));
  assert.equal(d1.calls.length, 1);

  const [, , policyJson, statsJson, sourcesJson] = d1.calls[0].params;
  const policy = JSON.parse(policyJson);
  const stats = JSON.parse(statsJson);
  const sources = JSON.parse(sourcesJson);

  assert.equal(policy.execution.runtime, 'cloudflare');
  assert.equal(policy.execution.localScrawl, 'blocked');
  assert.equal(stats.totalSources, 1);
  assert.equal(sources[0].sourceId, 'loungekey');
  assert.equal(sources[0].cloudflareSnapshot, true);
  assert.equal(sources[0].records, 1);
  assert.deepEqual(sources[0].airportCodes, ['JFK']);
  assert.deepEqual(sources[0].loungeLinks, ['https://www.loungekey.com/airport-lounges/jfk']);
  assert.ok(sources[0].sha256);
  assert.ok(!Object.hasOwn(sources[0], 'text'));
  assert.ok(!Object.hasOwn(sources[0], 'html'));
});

test('Cloudflare source intake probe supports ready airline HTML lanes', async () => {
  const d1 = createD1Mock();
  const response = await createSourceIntakeProbeResponse(
    new Request('https://loungeguru.desk.travel/admin/source-intake/probe?sourceId=delta', {
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
        return textResponse('<html><title>Delta Sky Club</title></html>');
      },
    },
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.sourceId, 'delta');
  assert.equal(body.cloudflareSnapshot, true);
  assert.equal(d1.calls.length, 1);
});

test('Cloudflare source intake probe aggregates bounded official source URLs', async () => {
  const d1 = createD1Mock();
  const fetchedUrls = [];
  const response = await createSourceIntakeProbeResponse(
    new Request('https://loungeguru.desk.travel/admin/source-intake/probe?sourceId=american', {
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
        const textUrl = String(url);
        fetchedUrls.push(textUrl);
        if (textUrl.endsWith('/robots.txt')) {
          return textResponse('User-agent: *\n');
        }
        const airportCode = textUrl.match(/airportAmenities\/([a-z]{3})-club\.jsp/)?.[1]?.toUpperCase() ?? 'DFW';
        return textResponse(
          `<html><body>${airportCode} Airport (${airportCode})<a href="/i18n/travelInformation/airportAmenities/${airportCode.toLowerCase()}-club.jsp">Club</a></body></html>`,
        );
      },
    },
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.sourceId, 'american');
  assert.equal(body.stats.fetched, 1);
  assert.ok(fetchedUrls.includes('https://www.aa.com/robots.txt'));
  assert.ok(fetchedUrls.includes('https://www.aa.com/i18n/travel-info/clubs/flagship-lounge.jsp'));
  assert.ok(
    fetchedUrls.includes('https://www.american-airlines.co.kr/i18n/travel-info/clubs/admirals-club-locations.jsp'),
  );
  assert.ok(fetchedUrls.includes('https://www.aa.com/i18n/travelInformation/airportAmenities/dfw-club.jsp'));
  assert.ok(fetchedUrls.includes('https://www.aa.com/i18n/travelInformation/airportAmenities/clt-club.jsp'));

  const [, , , , sourcesJson] = d1.calls[0].params;
  const sources = JSON.parse(sourcesJson);
  assert.deepEqual(sources[0].airportCodes, ['CLT', 'DFW', 'JFK', 'LAX', 'ORD']);
  assert.equal(sources[0].loungeLinks.length, 6);
  assert.equal(sources[0].records, 6);
  assert.ok(!Object.hasOwn(sources[0], 'text'));
  assert.ok(!Object.hasOwn(sources[0], 'html'));
});

test('Cloudflare source intake batch probes ready public lanes only', async () => {
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
  assert.equal(body.totalTasks, 15);
  assert.equal(body.fetched, 15);
  assert.equal(d1.calls.length, 15);
  assert.deepEqual(
    body.results.map((result) => result.sourceId).sort(),
    [
      'american',
      'aspire-lounges',
      'be-relax',
      'citi-travel',
      'collinson-international',
      'delta',
      'loungekey',
      'marhaba',
      'no1-lounges',
      'openstreetmap',
      'plaza-premium',
      'primeclass',
      'skyteam',
      'star-alliance',
      'united',
    ],
  );
  assert.equal(body.results.some((result) => result.sourceId === 'loungereview-api'), false);
  assert.equal(body.results.some((result) => result.sourceId === 'visa-airport-companion'), false);
});

test('Cloudflare source intake status returns compact D1 evidence', async () => {
  const d1 = createD1Mock();
  const env = {
    LOUNGE_GURU_INTAKE_TOKEN: 'secret',
    LOUNGE_GURU_DB: d1,
  };
  await createSourceIntakeBatchResponse(
    new Request('https://loungeguru.desk.travel/admin/source-intake/probe-batch?sourceIds=loungekey', {
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
        return textResponse('<html><title>LoungeKey</title></html>');
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
  assert.equal(body.stats.readyTasks, 15);
  assert.equal(body.stats.readyTasksWithCloudflareEvidence, 1);
  assert.deepEqual(body.sources.map((source) => source.sourceId), ['loungekey']);
  assert.ok(body.sources[0].sha256);
  assert.ok(!Object.hasOwn(body.sources[0], 'text'));
  assert.ok(!Object.hasOwn(body.sources[0], 'html'));
});

test('Cloudflare source intake report returns D1-derived source report without raw content', async () => {
  const d1 = createD1Mock();
  const env = {
    LOUNGE_GURU_INTAKE_TOKEN: 'secret',
    LOUNGE_GURU_DB: d1,
  };
  await createSourceIntakeBatchResponse(
    new Request('https://loungeguru.desk.travel/admin/source-intake/probe-batch', {
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
        return textResponse(
          `<html><title>${url}</title><body>Los Angeles International Airport (LAX)<a href="/airport-lounges/lax">LAX lounge</a>raw body is not exported</body></html>`,
        );
      },
    },
  );

  const response = await createSourceIntakeReportResponse(
    new Request('https://loungeguru.desk.travel/admin/source-intake/report', {
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
  assert.match(body.runId, /^cloudflare-report-/);
  assert.equal(body.policy.fetchMode, 'cloudflare_d1_source_runs_report');
  assert.equal(body.policy.execution.runtime, 'cloudflare');
  assert.equal(body.policy.execution.localScrawl, 'blocked');
  assert.equal(body.policy.rawPageContentCommitted, false);
  assert.equal(body.stats.totalSources, 15);
  assert.equal(body.stats.fetched, 15);
  assert.equal(body.stats.readyTasks, 15);
  assert.equal(body.stats.readyTasksWithCloudflareEvidence, 15);
  assert.equal(body.stats.discoveredAirportCodes, 15);
  assert.ok(body.stats.discoveredLoungeLinks >= 15);
  assert.equal(body.terminalImpact.fullCatalogIntakeReport, false);
  assert.equal(body.terminalImpact.coverageGateStillRequiresFullCloudflareReport, true);
  assert.deepEqual(
    body.sources.map((source) => source.sourceId).sort(),
    [
      'american',
      'aspire-lounges',
      'be-relax',
      'citi-travel',
      'collinson-international',
      'delta',
      'loungekey',
      'marhaba',
      'no1-lounges',
      'openstreetmap',
      'plaza-premium',
      'primeclass',
      'skyteam',
      'star-alliance',
      'united',
    ],
  );

  for (const source of body.sources) {
    assert.ok(source.runId.startsWith('cloudflare-probe-'));
    assert.ok(source.retrievedAt);
    assert.ok(source.url.startsWith('https://'));
    assert.deepEqual(source.airportCodes, ['LAX']);
    assert.ok(source.loungeLinks.length >= 1);
    assert.ok(source.loungeLinks.every((link) => link.startsWith('https://')));
    assert.ok(source.sha256);
    assert.ok(!Object.hasOwn(source, 'text'));
    assert.ok(!Object.hasOwn(source, 'html'));
    for (const attempt of source.fetchAttempts) {
      assert.ok(!Object.hasOwn(attempt, 'text'));
      assert.ok(!Object.hasOwn(attempt, 'html'));
    }
  }
});
