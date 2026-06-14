import { ResourceTemplate, McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import {
  AirportPromptArgsSchema,
  CatalogMetaOutputSchema,
  ComparePromptArgsSchema,
  GetLoungeInputSchema,
  GetLoungeOutputSchema,
  SearchLoungesInputSchema,
  SearchLoungesOutputSchema,
} from './contract.mjs';

export const ONLINE_SERVER_INFO = {
  name: 'lounge-guru',
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

function createPromptMessage(text) {
  return {
    role: 'user',
    content: {
      type: 'text',
      text,
    },
  };
}

export function createCatalogMcpServer({
  serverInfo = ONLINE_SERVER_INFO,
  store,
  onEvent = async () => {},
} = {}) {
  const server = new McpServer(serverInfo);

  server.registerTool(
    'search_lounges',
    {
      title: 'Search lounges',
      description:
        'Search the public Lounge Guru catalog using bounded plain-text filters and pagination.',
      inputSchema: SearchLoungesInputSchema,
      outputSchema: SearchLoungesOutputSchema,
    },
    async (input) => {
      try {
        const result = store.searchLounges(input);
        await onEvent('tool.search_lounges', {
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
        await onEvent('tool.search_lounges.rejected', {
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
      const lounge = store.getLoungeById(id);
      await onEvent('tool.get_lounge', {
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
      const meta = store.getCatalogMeta();
      await onEvent('tool.get_catalog_meta', {
        tool: 'get_catalog_meta',
      });

      return {
        structuredContent: meta,
        content: textContent(`Catalog generated at ${meta.generatedAt} with ${meta.stats.totalFeatures} public records.`),
      };
    },
  );

  const registerJsonResource = (name, uri, title, description, getPayload) => {
    server.registerResource(
      name,
      uri,
      {
        title,
        description,
      },
      async () => jsonResource(uri, getPayload()),
    );
  };

  registerJsonResource(
    'catalog-meta',
    'lounge-guru://meta',
    'Catalog metadata',
    'Public metadata and facet counts for the Lounge Guru catalog.',
    () => store.getCatalogMeta(),
  );

  registerJsonResource(
    'catalog-filters',
    'lounge-guru://filters',
    'Catalog filters',
    'Public facet lists, schema, sources, and stats used by the Lounge Guru catalog.',
    () => store.getFiltersResource(),
  );

  registerJsonResource(
    'catalog-meta-compat',
    'pp-lounge://meta',
    'Catalog metadata',
    'Compatibility metadata alias for existing pp-lounge-map clients.',
    () => store.getCatalogMeta(),
  );

  registerJsonResource(
    'catalog-filters-compat',
    'pp-lounge://filters',
    'Catalog filters',
    'Compatibility filter alias for existing pp-lounge-map clients.',
    () => store.getFiltersResource(),
  );

  server.registerResource(
    'lounge-detail',
    new ResourceTemplate('lounge-guru://lounge/{id}', {
      list: undefined,
    }),
    {
      title: 'Lounge detail',
      description: 'Public detail for a single lounge in the Lounge Guru catalog.',
    },
    async (uri, variables) => {
      const lounge = store.getLoungeById(String(variables.id ?? ''));
      if (!lounge) {
        return jsonResource(uri.toString(), {
          error: 'not_found',
        });
      }

      return jsonResource(uri.toString(), lounge);
    },
  );

  server.registerResource(
    'lounge-detail-compat',
    new ResourceTemplate('pp-lounge://lounge/{id}', {
      list: undefined,
    }),
    {
      title: 'Lounge detail',
      description: 'Compatibility detail alias for existing pp-lounge-map clients.',
    },
    async (uri, variables) => {
      const lounge = store.getLoungeById(String(variables.id ?? ''));
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
      const result = store.searchLounges({
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
            `Summarize the public Lounge Guru options at ${airportCode}. Use only the following catalog facts:\n${bulletList}`,
          ),
        ],
      };
    },
  );

  server.registerPrompt(
    'compare-airport-lounges',
    {
      title: 'Compare airport lounges',
      description: 'Compare lounges at a single airport using the public Lounge Guru catalog data.',
      argsSchema: ComparePromptArgsSchema,
    },
    async ({ airportCode, type }) => {
      const result = store.searchLounges({
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
            `Compare the public Lounge Guru options at ${airportCode}. Highlight tradeoffs in lounge type, terminal, and facilities. Use only these catalog facts:\n${bulletList}`,
          ),
        ],
      };
    },
  );

  return server;
}
