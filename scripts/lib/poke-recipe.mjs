import path from 'node:path';
import { z } from 'zod';

export const POKE_KITCHEN_URL = 'https://poke.com/kitchen';
export const POKE_MCP_ENDPOINT = 'https://loungeguru.desk.travel/mcp';
export const POKE_INTEGRATION_NAME = 'Lounge Guru';
export const POKE_RECIPE_PATH = ['recipes', 'poke', 'lounge-guru.hosted.recipe.json'];

export function getPokeRecipePath(projectRoot) {
  return path.resolve(projectRoot, ...POKE_RECIPE_PATH);
}

const InputContextFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  prompt: z.string().min(1),
  required: z.boolean(),
  formatHint: z.string().min(1),
});

const IntegrationSchema = z.object({
  type: z.literal('mcp'),
  name: z.string().min(1),
  url: z.url(),
  transport: z.literal('streamable-http'),
  authentication: z.literal('none'),
  shareWithUsers: z.boolean(),
  notes: z.string().min(1),
});

const AutomationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  schedule: z.object({
    description: z.string().min(1),
    timezone: z.literal('user-local'),
    cron: z.string().min(1),
  }),
  actionText: z.string().min(1),
});

export const PokeRecipeSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  onboarding: z.object({
    inputContext: z.array(InputContextFieldSchema).min(1),
    prefilledFirstText: z.string().min(1),
  }),
  integrations: z.object({
    required: z.array(IntegrationSchema).length(1),
  }),
  automations: z.array(AutomationSchema).length(3),
  publishNotes: z.object({
    sandboxChecklist: z.array(z.string().min(1)).min(1),
    manualFlow: z.array(z.string().min(1)).min(1),
    postPublish: z.array(z.string().min(1)).min(1),
  }),
});

export function parsePokeRecipe(raw) {
  return PokeRecipeSchema.parse(raw);
}

export function buildPokeBootstrapLines() {
  return [
    `Kitchen: ${POKE_KITCHEN_URL}`,
    `Recipe draft: ${POKE_RECIPE_PATH.join('/')}`,
    `MCP endpoint: ${POKE_MCP_ENDPOINT}`,
    `Add integration: npx poke@latest mcp add ${POKE_MCP_ENDPOINT} -n "${POKE_INTEGRATION_NAME}"`,
  ];
}
