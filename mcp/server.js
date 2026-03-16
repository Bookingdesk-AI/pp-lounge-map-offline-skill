import { ResourceTemplate, McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createMcpHandler } from 'agents/mcp';

import {
  AirportPromptArgsSchema,
  CatalogMetaOutputSchema,
  ComparePromptArgsSchema,
  GetLoungeInputSchema,
  GetLoungeOutputSchema,
  SearchLoungesInputSchema,
  SearchLoungesOutputSchema,
} from './contract.js';
import { getCatalogMeta, getFiltersResource, getLoungeById, searchLounges } from './catalog.js';
import { enforceRateLimit } from './rate-limit.js';

const SERVER_INFO = {
  name: 'pp-lounge-map',
  version: '1.0.0',
};

function jsonResource(uri, payload) {
  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: `${JSON.stringify(payload, null, 2)}\n`,
      },
    ],
  };
}

function textContent(text) {
  return [{ type: 'text', text }];
}

function firstHeaderValue(value) {
  if (!value) {
    return 'unknown';
  }

  return value.split(',')[0]?.trim() || 'unknown';
}

async function sha256Hex(value) {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function logEvent(request, event, details = {}) {
  const ip = firstHeaderValue(request.headers.get('cf-connecting-ip'));
  const userAgent = request.headers.get('user-agent')?.slice(0, 160) || 'unknown';
  const query = typeof details.query === 'string' ? details.query : null;
  const safeDetails = {
    ...details,
    query: undefined,
    queryHash: query ? await sha256Hex(query) : undefined,
    queryLength: query?.length ?? 0,
  };

  console.log(
    JSON.stringify({
      service: 'pp-lounge-map-mcp',
      event,
      timestamp: new Date().toISOString(),
      method: request.method,
      path: new URL(request.url).pathname,
      ipHash: await sha256Hex(ip),
      userAgentHash: await sha256Hex(userAgent),
      country: request.headers.get('cf-ipcountry') || 'unknown',
      ...safeDetails,
    }),
  );
}

function createPromptMessage(text) {
  return {
    role: 'user',
    content: {
      type: 'text',
      text,
    },
  };
}

function createServer(request) {
  const server = new McpServer(SERVER_INFO);

  server.registerTool(
    'search_lounges',
    {
      title: 'Search lounges',
      description:
        'Search the public pp-lounge-map catalog using bounded plain-text filters and pagination.',
      inputSchema: SearchLoungesInputSchema,
      outputSchema: SearchLoungesOutputSchema,
    },
    async (input) => {
      try {
        const result = searchLounges(input);
        await logEvent(request, 'tool.search_lounges', {
          tool: 'search_lounges',
          query: input.query,
          airportCode: input.airportCode ?? null,
          totalMatches: result.totalMatches,
          returned: result.results.length,
        });

        return {
          structuredContent: result,
          content: textContent(
            result.totalMatches === 0
              ? 'No lounges matched the current filters.'
              : `Found ${result.totalMatches} lounges and returned ${result.results.length} result(s).`,
          ),
        };
      } catch (error) {
        await logEvent(request, 'tool.search_lounges.rejected', {
          tool: 'search_lounges',
          query: input.query,
          reason: error instanceof Error ? error.message : 'invalid_input',
        });

        return {
          isError: true,
          content: textContent(error instanceof Error ? error.message : 'Search request was rejected.'),
        };
      }
    },
  );

  server.registerTool(
    'get_lounge',
    {
      title: 'Get lounge detail',
      description: 'Return the full public detail for a single lounge by its stable id.',
      inputSchema: GetLoungeInputSchema,
      outputSchema: GetLoungeOutputSchema,
    },
    async ({ id }) => {
      const lounge = getLoungeById(id);
      await logEvent(request, 'tool.get_lounge', {
        tool: 'get_lounge',
        loungeId: id,
        found: Boolean(lounge),
      });

      if (!lounge) {
        return {
          isError: true,
          content: textContent(`No lounge was found for id "${id}".`),
        };
      }

      return {
        structuredContent: { lounge },
        content: textContent(`${lounge.name} at ${lounge.airportCode} (${lounge.city}, ${lounge.country}).`),
      };
    },
  );

  server.registerTool(
    'get_catalog_meta',
    {
      title: 'Get catalog metadata',
      description: 'Return public generation time, filter facets, and record counts for the catalog.',
      outputSchema: CatalogMetaOutputSchema,
    },
    async () => {
      const meta = getCatalogMeta();
      await logEvent(request, 'tool.get_catalog_meta', {
        tool: 'get_catalog_meta',
      });

      return {
        structuredContent: meta,
        content: textContent(`Catalog generated at ${meta.generatedAt} with ${meta.stats.totalFeatures} public records.`),
      };
    },
  );

  server.registerResource(
    'catalog-meta',
    'pp-lounge://meta',
    {
      title: 'Catalog metadata',
      description: 'Public metadata and facet counts for the pp-lounge-map catalog.',
    },
    async () => jsonResource('pp-lounge://meta', getCatalogMeta()),
  );

  server.registerResource(
    'catalog-filters',
    'pp-lounge://filters',
    {
      title: 'Catalog filters',
      description: 'Public facet lists and stats used by the pp-lounge-map catalog.',
    },
    async () => jsonResource('pp-lounge://filters', getFiltersResource()),
  );

  server.registerResource(
    'lounge-detail',
    new ResourceTemplate('pp-lounge://lounge/{id}', {
      list: undefined,
    }),
    {
      title: 'Lounge detail',
      description: 'Public detail for a single lounge in the pp-lounge-map catalog.',
    },
    async (uri, variables) => {
      const lounge = getLoungeById(String(variables.id ?? ''));
      if (!lounge) {
        return jsonResource(uri.toString(), {
          error: 'not_found',
        });
      }

      return jsonResource(uri.toString(), lounge);
    },
  );

  server.registerPrompt(
    'airport-lounge-brief',
    {
      title: 'Airport lounge brief',
      description: 'Create a concise airport-specific lounge summary from the public catalog.',
      argsSchema: AirportPromptArgsSchema,
    },
    async ({ airportCode }) => {
      const result = searchLounges({
        airportCode,
        limit: 10,
      });

      const bulletList =
        result.results.length === 0
          ? `No public lounge records are currently available for ${airportCode}.`
          : result.results
              .map(
                (lounge) =>
                  `- ${lounge.name} (${lounge.type}) in ${lounge.terminal}; key facilities: ${lounge.facilities.slice(0, 4).join(', ') || 'not listed'}`,
              )
              .join('\n');

      return {
        description: `Public lounge brief for ${airportCode}`,
        messages: [
          createPromptMessage(
            `Summarize the public Priority Pass lounge options at ${airportCode}. Use only the following catalog facts:\n${bulletList}`,
          ),
        ],
      };
    },
  );

  server.registerPrompt(
    'compare-airport-lounges',
    {
      title: 'Compare airport lounges',
      description: 'Compare lounges at a single airport using the public catalog data.',
      argsSchema: ComparePromptArgsSchema,
    },
    async ({ airportCode, type }) => {
      const result = searchLounges({
        airportCode,
        types: type ? [type] : undefined,
        limit: 10,
      });

      const bulletList =
        result.results.length === 0
          ? `No public lounge records are currently available for ${airportCode}.`
          : result.results
              .map(
                (lounge) =>
                  `- ${lounge.name}: terminal ${lounge.terminal}, facilities ${lounge.facilities.slice(0, 5).join(', ') || 'not listed'}`,
              )
              .join('\n');

      return {
        description: `Compare public lounge options at ${airportCode}`,
        messages: [
          createPromptMessage(
            `Compare the public lounge options at ${airportCode}. Highlight tradeoffs in lounge type, terminal, and facilities. Use only these catalog facts:\n${bulletList}`,
          ),
        ],
      };
    },
  );

  return server;
}

function appendHeaders(response, headers) {
  const next = new Response(response.body, response);
  for (const [name, value] of Object.entries(headers)) {
    if (value) {
      next.headers.set(name, value);
    }
  }
  return next;
}

export function createHealthResponse() {
  const meta = getCatalogMeta();
  return Response.json({
    ok: true,
    service: SERVER_INFO.name,
    version: SERVER_INFO.version,
    generatedAt: meta.generatedAt,
    totalFeatures: meta.stats.totalFeatures,
  });
}

export async function handleMcpRequest(request, env, ctx) {
  const limitResult = await enforceRateLimit(env, request);
  if (!limitResult.ok) {
    await logEvent(request, 'rate_limited', {
      status: limitResult.status ?? 429,
    });
    return new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: limitResult.status ?? 429,
      headers: {
        'content-type': 'application/json',
        ...limitResult.headers,
      },
    });
  }

  const handler = createMcpHandler(createServer(request), {
    route: '/mcp',
    enableJsonResponse: true,
    sessionIdGenerator: undefined,
  });
  const response = await handler(request, env, ctx);
  return appendHeaders(response, limitResult.headers);
}
