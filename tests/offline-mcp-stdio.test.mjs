import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const serverScript = path.resolve(
  projectRoot,
  'skills',
  'pp-lounge-map-offline',
  'scripts',
  'run-offline-mcp.mjs',
);

test('offline stdio MCP server exposes the expected tools, resources, and prompts', async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverScript],
    cwd: projectRoot,
    stderr: 'pipe',
  });
  const stderrChunks = [];
  transport.stderr?.on('data', (chunk) => {
    stderrChunks.push(String(chunk));
  });

  const client = new Client({
    name: 'pp-lounge-map-offline-test',
    version: '1.0.0',
  });

  try {
    await client.connect(transport);

    const tools = await client.listTools();
    assert.deepEqual(
      tools.tools.map((tool) => tool.name).sort(),
      ['get_catalog_meta', 'get_lounge', 'search_lounges'],
    );

    const resources = await client.listResources();
    assert.deepEqual(
      resources.resources.map((resource) => resource.uri).sort(),
      ['pp-lounge://filters', 'pp-lounge://meta'],
    );

    const prompts = await client.listPrompts();
    assert.deepEqual(
      prompts.prompts.map((prompt) => prompt.name).sort(),
      ['airport-lounge-brief', 'compare-airport-lounges'],
    );

    const search = await client.callTool({
      name: 'search_lounges',
      arguments: {
        airportCode: 'SIN',
        limit: 2,
      },
    });
    assert.notEqual(search.isError, true);
    assert.equal(search.structuredContent.results.length, 2);

    const loungeId = search.structuredContent.results[0].id;
    const lounge = await client.callTool({
      name: 'get_lounge',
      arguments: {
        id: loungeId,
      },
    });
    assert.notEqual(lounge.isError, true);
    assert.equal(lounge.structuredContent.lounge.id, loungeId);

    const meta = await client.readResource({
      uri: 'pp-lounge://meta',
    });
    assert.equal(meta.contents[0].uri, 'pp-lounge://meta');

    const prompt = await client.getPrompt({
      name: 'airport-lounge-brief',
      arguments: {
        airportCode: 'SIN',
      },
    });
    assert.ok(prompt.messages[0].content.text.includes('SIN'));
  } finally {
    await client.close();
  }

  assert.equal(stderrChunks.join('').trim(), '');
});
