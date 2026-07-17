# Poke Recipe Runbook

## Goal

Create and publish the hosted Poke recipe for `lounge-guru` using the checked-in draft spec and the live MCP integration.

## Source of truth

- Recipe draft: `recipes/poke/lounge-guru.hosted.recipe.json`
- MCP endpoint: `https://lounge-guru-mcp.dev-4ee.workers.dev/mcp`
- Transport: `streamable-http`

Validate the draft before editing Kitchen:

```bash
npm run poke:validate
```

Print the bootstrap snippet at any time:

```bash
npm run poke:bootstrap
```

## Manual Kitchen flow

1. Log in to the Poke CLI:

```bash
npx poke@latest login
```

2. Add the hosted MCP integration to your Poke account:

```bash
npx poke@latest mcp add https://lounge-guru-mcp.dev-4ee.workers.dev/mcp -n "Lounge Guru"
```

3. Open Kitchen at [poke.com/kitchen](https://poke.com/kitchen).
4. Create a new recipe draft.
5. Copy values from `recipes/poke/lounge-guru.hosted.recipe.json` into the draft:
   - name
   - description
   - onboarding input context
   - prefilled first message
   - required integration
   - three traveler-facing automations
6. Test the draft in Sandbox.
7. Publish only after the Sandbox checklist passes.

## Kitchen field mapping

### Basics

- `name` -> recipe name
- `description` -> recipe description

### Onboarding

- `onboarding.inputContext` -> onboarding questions/context
- `onboarding.prefilledFirstText` -> prefilled first message

### Integrations

- `integrations.required[0].name` -> integration display name
- `integrations.required[0].url` -> MCP server URL
- `integrations.required[0].transport` -> MCP transport type

### Automations

For each automation entry:

- `name` -> automation name
- `schedule.description` / `schedule.cron` -> schedule setup in Kitchen
- `actionText` -> what Poke should do when it runs

## Sandbox checklist

Use the `publishNotes.sandboxChecklist` entries from the draft as the publish gate. At minimum verify:

- onboarding collects the intended traveler inputs
- first message produces an airport-specific lounge summary
- the integration is the live hosted MCP server
- automations stay traveler-facing and read-only

## After publish

1. Capture the recipe share link or partner slug.
2. Record it in your release notes or maintainer notes.
3. If the recipe needs changes later, update the repo draft first and publish a new Kitchen recipe draft, since published recipes are locked.
