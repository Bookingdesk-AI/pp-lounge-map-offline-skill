# Kitchen Upload Instructions — PP Lounge Map

## Basics
- Name: `PP Lounge Map`
- Description: `Traveler-focused Priority Pass lounge lookup recipe powered by the hosted pp-lounge-map MCP. Use it to search, compare, and summarize lounge options by airport, facility preference, and lounge type without requiring secrets or write access.`

## Onboarding
### inputContext entries
1. **primaryAirportCode**
   - label: `Primary airport code`
   - prompt: `Ask for the traveler's main airport as a 3-character IATA code, such as SIN or LAX.`
   - required: `true`
   - formatHint: `3-character IATA airport code`
2. **airportWatchlist**
   - label: `Airport watchlist`
   - prompt: `Ask for a saved watchlist of 2 to 5 airports the traveler wants regular lounge updates for.`
   - required: `true`
   - formatHint: `List of 2 to 5 IATA airport codes`
3. **preferredFacilities**
   - label: `Preferred facilities`
   - prompt: `Ask which facilities matter most, such as showers, food, Wi-Fi, or quiet areas.`
   - required: `true`
   - formatHint: `Short list of lounge facilities`
4. **loungeTypePreference**
   - label: `Lounge type preference`
   - prompt: `Ask whether the traveler prefers LOUNGE, EAT, REST, REFRESH, or UNWIND results by default.`
   - required: `false`
   - formatHint: `One of: LOUNGE, EAT, REST, REFRESH, UNWIND`

### prefilledFirstText
`Summarize the best Priority Pass lounge options for my primary airport and highlight my preferred facilities.`

## Integrations
### Required 1
- type: `mcp`
- name: `PP Lounge Map`
- url: `https://prioritypassmap.desk.travel/mcp`
- transport: `streamable-http`
- authentication: `none`
- shareWithUsers: `false`
- notes: `Public hosted read-only MCP integration for Priority Pass lounge search and comparisons.`

## Automations
### 1) Weekly home airport brief (weekly-home-airport-brief)
- schedule.description: `Every Monday at 8:00 AM in the user's local timezone.`
- schedule.timezone: `user-local`
- schedule.cron: `0 8 * * 1`
- actionText: `Summarize the best Priority Pass lounge options at the user's primary airport, prioritize the user's preferred facilities and lounge type preference, and call out the most relevant terminal tradeoffs.`
### 2) Weekly watchlist compare (weekly-watchlist-compare)
- schedule.description: `Every Thursday at 8:00 AM in the user's local timezone.`
- schedule.timezone: `user-local`
- schedule.cron: `0 8 * * 4`
- actionText: `Compare lounge options across the user's saved airport watchlist, focusing on which airports best match the user's preferred facilities and where the strongest tradeoffs appear.`
### 3) Weekend trip planning brief (weekend-trip-planning-brief)
- schedule.description: `Every Friday at 3:00 PM in the user's local timezone.`
- schedule.timezone: `user-local`
- schedule.cron: `0 15 * * 5`
- actionText: `Generate a concise planning brief for the top two saved airports in the user's watchlist, with emphasis on terminal differences, lounge type tradeoffs, and facilities that match the user's preferences.`

## Sandbox checks
1. Confirm onboarding asks for primary airport, airport watchlist, preferred facilities, and optional lounge type preference.
2. Confirm the prefilled first message triggers a useful airport-specific lounge summary.
3. Confirm the required integration points at the hosted MCP endpoint with streamable-http transport.
4. Confirm all three traveler-facing automations are present and use the intended schedules and action text.
5. Confirm sandbox chats stay read-only and grounded in catalog data only.

## CLI bootstrap
```bash
npx poke@latest login
npx poke@latest mcp add https://prioritypassmap.desk.travel/mcp -n "PP Lounge Map"
```
