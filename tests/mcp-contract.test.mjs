import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AirportPromptArgsSchema,
  ComparePromptArgsSchema,
  GetLoungeInputSchema,
  MAX_FACILITY_FILTERS,
  MAX_PAGE_SIZE,
  MAX_PROGRAM_FILTERS,
  MAX_PROVIDER_FILTERS,
  MAX_QUERY_LENGTH,
  MAX_TYPE_FILTERS,
  SearchLoungesInputSchema,
} from '../mcp/contract.js';

function assertRejected(schema, value) {
  const result = schema.safeParse(value);
  assert.equal(result.success, false);
  return result.error.issues;
}

test('MCP search input trims and normalizes bounded public filters', () => {
  const parsed = SearchLoungesInputSchema.parse({
    query: '  lounge  ',
    airportCode: ' sfo ',
    country: ' United States ',
    city: ' San Francisco ',
    types: [' LOUNGE '],
    facilities: [' Wi-Fi '],
    providers: [' Example Airport '],
    programs: [' Example Pass '],
    reviewStatus: 'approved',
    limit: MAX_PAGE_SIZE,
    cursor: ' 2 ',
  });

  assert.deepEqual(parsed, {
    query: 'lounge',
    airportCode: 'SFO',
    country: 'United States',
    city: 'San Francisco',
    types: ['LOUNGE'],
    facilities: ['Wi-Fi'],
    providers: ['Example Airport'],
    programs: ['Example Pass'],
    reviewStatus: 'approved',
    limit: MAX_PAGE_SIZE,
    cursor: '2',
  });
});

test('MCP search input rejects control characters and structural metacharacters', () => {
  for (const query of ['line\nbreak', 'lounge<script>', 'lounge`query', 'lounge\\query', '{lounge}']) {
    const issues = assertRejected(SearchLoungesInputSchema, { query });
    assert.ok(issues.some((issue) => issue.message === 'Use plain text only.'));
  }

  assertRejected(SearchLoungesInputSchema, {
    query: 'x'.repeat(MAX_QUERY_LENGTH + 1),
  });
});

test('MCP search input rejects oversized, malformed, and unknown fields', () => {
  const invalidInputs = [
    { airportCode: 'SF' },
    { cursor: '1x' },
    { limit: MAX_PAGE_SIZE + 1 },
    { types: Array.from({ length: MAX_TYPE_FILTERS + 1 }, (_, index) => `TYPE-${index}`) },
    {
      facilities: Array.from(
        { length: MAX_FACILITY_FILTERS + 1 },
        (_, index) => `Facility ${index}`,
      ),
    },
    {
      providers: Array.from(
        { length: MAX_PROVIDER_FILTERS + 1 },
        (_, index) => `Provider ${index}`,
      ),
    },
    {
      programs: Array.from(
        { length: MAX_PROGRAM_FILTERS + 1 },
        (_, index) => `Program ${index}`,
      ),
    },
    { unexpected: true },
  ];

  for (const input of invalidInputs) {
    assertRejected(SearchLoungesInputSchema, input);
  }
});

test('MCP detail and prompt arguments keep stable identifiers bounded', () => {
  assert.deepEqual(GetLoungeInputSchema.parse({ id: '  lounge-id  ' }), {
    id: 'lounge-id',
  });
  assertRejected(GetLoungeInputSchema, {
    id: '',
  });
  assertRejected(GetLoungeInputSchema, {
    id: 'x'.repeat(121),
  });
  assertRejected(GetLoungeInputSchema, {
    id: 'lounge-id',
    unexpected: true,
  });

  assert.equal(AirportPromptArgsSchema.airportCode.parse(' sfo '), 'SFO');
  assertRejected(AirportPromptArgsSchema.airportCode, 'SFOO');
  assert.equal(ComparePromptArgsSchema.type.parse(' LOUNGE '), 'LOUNGE');
  assertRejected(ComparePromptArgsSchema.type, 'x'.repeat(25));
});
