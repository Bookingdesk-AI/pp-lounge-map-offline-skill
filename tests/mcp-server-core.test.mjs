import test from 'node:test';
import assert from 'node:assert/strict';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import * as catalogStore from '../mcp/catalog.js';
import { createCatalogMcpServer } from '../mcp/server-core.js';

const sampleSource = {
  sourceId: 'official-example',
  publisher: 'Example Airport',
  url: 'https://example.com/lounge',
  retrievedAt: '2026-07-20T00:00:00.000Z',
  fieldCoverage: ['lounge.name', 'airport.iata'],
  confidence: 1,
  rightsNote: 'Public official source.',
};

const sampleQuality = {
  completeness: 100,
  freshness: 100,
  conflicts: [],
  reviewStatus: 'approved',
};

const sampleSummary = {
  id: 'example-sfo-lounge',
  airportCode: 'SFO',
  airportName: 'San Francisco International Airport',
  country: 'United States',
  city: 'San Francisco',
  type: 'LOUNGE',
  terminal: 'Terminal 1',
  name: 'Example Lounge',
  facilities: ['Wi-Fi', 'Showers'],
  location: 'Gate A1',
  lat: 37.6213,
  lon: -122.379,
  provider: 'Example Airport',
  programs: ['Example Pass'],
  accessMethods: ['Day pass'],
  sources: [sampleSource],
  quality: sampleQuality,
};

const sampleDetail = {
  ...sampleSummary,
  openingHours: 'Daily 06:00-22:00',
  conditions: ['Valid boarding pass required'],
  url: sampleSource.url,
  slug: 'example-lounge',
  canonical: {
    lounge: {
      name: sampleSummary.name,
    },
  },
};

const sampleMeta = {
  generatedAt: '2026-07-20T00:00:00.000Z',
  sourceFile: 'example.xlsx',
  stats: {
    totalInputRows: 1,
    totalFeatures: 1,
    totalCatalogRecords: 1,
    droppedRows: 0,
    uniqueAirports: 1,
    uniqueCountries: 1,
    uniqueCities: 1,
    totalSources: 1,
    reviewQueue: 0,
    approvedRecords: 1,
  },
  filters: {
    types: ['LOUNGE'],
    countries: ['United States'],
    cities: ['San Francisco'],
    facilities: ['Showers', 'Wi-Fi'],
    providers: ['Example Airport'],
    programs: ['Example Pass'],
    reviewStatuses: ['approved'],
  },
  schema: {
    version: '1.0.0',
    fields: [],
  },
  quality: {
    averageCompleteness: 100,
    averageFreshness: 100,
    conflictCount: 0,
    reviewQueue: 0,
  },
};

function createStore() {
  return {
    getCatalogMeta() {
      return sampleMeta;
    },
    getFiltersResource() {
      return {
        stats: sampleMeta.stats,
        filters: sampleMeta.filters,
        schema: sampleMeta.schema,
        quality: sampleMeta.quality,
        sources: [sampleSource],
      };
    },
    getLoungeById(id) {
      return id === sampleDetail.id ? sampleDetail : null;
    },
    searchLounges(input) {
      if (input.country === 'Atlantis') {
        throw new Error('Unsupported country filter: Atlantis.');
      }

      if (input.airportCode === 'ZZZ') {
        return {
          totalMatches: 0,
          nextCursor: null,
          results: [],
        };
      }

      return {
        totalMatches: 1,
        nextCursor: null,
        results: [sampleSummary],
      };
    },
  };
}

async function withMcpClient(store, onEvent, run) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createCatalogMcpServer({
    store,
    onEvent,
  });
  const client = new Client({
    name: 'lounge-guru-server-core-test',
    version: '1.0.0',
  });

  await server.connect(serverTransport);
  try {
    await client.connect(clientTransport);
    return await run(client);
  } finally {
    await Promise.allSettled([client.close(), server.close()]);
  }
}

test('online MCP server exposes tools, compatibility resources, prompts, and audit events', async () => {
  const events = [];

  await withMcpClient(
    createStore(),
    async (event, details) => {
      events.push({ event, details });
    },
    async (client) => {
      const tools = await client.listTools();
      assert.deepEqual(
        tools.tools.map((tool) => tool.name).sort(),
        ['get_catalog_meta', 'get_lounge', 'search_lounges'],
      );
      const metaTool = tools.tools.find((tool) => tool.name === 'get_catalog_meta');
      assert.ok(metaTool);
      const statsProperties = metaTool.outputSchema.properties.stats.properties;
      for (const field of [
        'totalCatalogRecords',
        'candidateRecords',
        'nonPriorityRecords',
        'duplicateSourceRecords',
      ]) {
        assert.ok(statsProperties[field], `Missing advertised catalog stat: ${field}`);
      }
      assert.ok(metaTool.outputSchema.properties.quality.properties.approvalPolicy);

      const resources = await client.listResources();
      assert.deepEqual(
        resources.resources.map((resource) => resource.uri).sort(),
        ['lounge-guru://filters', 'lounge-guru://meta', 'pp-lounge://filters', 'pp-lounge://meta'],
      );

      const templates = await client.listResourceTemplates();
      assert.deepEqual(
        templates.resourceTemplates.map((resource) => resource.uriTemplate).sort(),
        ['lounge-guru://lounge/{id}', 'pp-lounge://lounge/{id}'],
      );

      const prompts = await client.listPrompts();
      assert.deepEqual(
        prompts.prompts.map((prompt) => prompt.name).sort(),
        ['airport-lounge-brief', 'compare-airport-lounges'],
      );

      const search = await client.callTool({
        name: 'search_lounges',
        arguments: {
          query: 'Example',
          airportCode: 'SFO',
          limit: 1,
        },
      });
      assert.notEqual(search.isError, true);
      assert.equal(search.structuredContent.totalMatches, 1);
      assert.equal(search.structuredContent.results[0].id, sampleSummary.id);
      assert.match(search.content[0].text, /Found 1 lounges/u);

      const detail = await client.callTool({
        name: 'get_lounge',
        arguments: {
          id: sampleDetail.id,
        },
      });
      assert.notEqual(detail.isError, true);
      assert.equal(detail.structuredContent.lounge.id, sampleDetail.id);

      const meta = await client.callTool({
        name: 'get_catalog_meta',
        arguments: {},
      });
      assert.notEqual(meta.isError, true);
      assert.equal(meta.structuredContent.generatedAt, sampleMeta.generatedAt);
      assert.match(meta.content[0].text, /with 1 public records/u);

      for (const scheme of ['lounge-guru', 'pp-lounge']) {
        const resource = await client.readResource({
          uri: `${scheme}://lounge/${sampleDetail.id}`,
        });
        const payload = JSON.parse(resource.contents[0].text);
        assert.equal(payload.id, sampleDetail.id);
      }

      const airportPrompt = await client.getPrompt({
        name: 'airport-lounge-brief',
        arguments: {
          airportCode: 'SFO',
        },
      });
      assert.match(airportPrompt.messages[0].content.text, /Example Lounge/u);

      const comparePrompt = await client.getPrompt({
        name: 'compare-airport-lounges',
        arguments: {
          airportCode: 'SFO',
          type: 'LOUNGE',
        },
      });
      assert.match(comparePrompt.messages[0].content.text, /terminal Terminal 1/u);
    },
  );

  assert.deepEqual(
    events.map(({ event }) => event),
    ['tool.search_lounges', 'tool.get_lounge', 'tool.get_catalog_meta'],
  );
  assert.deepEqual(events[0].details, {
    tool: 'search_lounges',
    query: 'Example',
    airportCode: 'SFO',
    totalMatches: 1,
    returned: 1,
  });
});

test('online MCP server returns bounded errors and not-found resources', async () => {
  const events = [];

  await withMcpClient(
    createStore(),
    async (event, details) => {
      events.push({ event, details });
    },
    async (client) => {
      const rejected = await client.callTool({
        name: 'search_lounges',
        arguments: {
          country: 'Atlantis',
        },
      });
      assert.equal(rejected.isError, true);
      assert.equal(rejected.content[0].text, 'Unsupported country filter: Atlantis.');

      const empty = await client.callTool({
        name: 'search_lounges',
        arguments: {
          airportCode: 'ZZZ',
        },
      });
      assert.notEqual(empty.isError, true);
      assert.equal(empty.structuredContent.totalMatches, 0);
      assert.equal(empty.content[0].text, 'No lounges matched the current filters.');

      const missing = await client.callTool({
        name: 'get_lounge',
        arguments: {
          id: 'missing-lounge',
        },
      });
      assert.equal(missing.isError, true);
      assert.match(missing.content[0].text, /No lounge was found/u);

      for (const scheme of ['lounge-guru', 'pp-lounge']) {
        const resource = await client.readResource({
          uri: `${scheme}://lounge/missing-lounge`,
        });
        assert.deepEqual(JSON.parse(resource.contents[0].text), {
          error: 'not_found',
        });
      }

      const prompt = await client.getPrompt({
        name: 'airport-lounge-brief',
        arguments: {
          airportCode: 'ZZZ',
        },
      });
      assert.match(prompt.messages[0].content.text, /No public lounge records/u);
    },
  );

  assert.deepEqual(
    events.map(({ event }) => event),
    ['tool.search_lounges.rejected', 'tool.search_lounges', 'tool.get_lounge'],
  );
  assert.equal(events[0].details.reason, 'Unsupported country filter: Atlantis.');
  assert.equal(events[2].details.found, false);
});

test('online metadata tool accepts the current catalog stats and quality contract', async () => {
  await withMcpClient(catalogStore, async () => {}, async (client) => {
    const result = await client.callTool({
      name: 'get_catalog_meta',
      arguments: {},
    });

    assert.notEqual(result.isError, true);
    assert.equal(
      result.structuredContent.stats.totalCatalogRecords,
      catalogStore.getAllLounges().length,
    );
    assert.ok(result.structuredContent.stats.nonPriorityRecords > 0);
    assert.deepEqual(
      result.structuredContent.quality.approvalPolicy,
      catalogStore.getCatalogMeta().quality.approvalPolicy,
    );
  });
});
