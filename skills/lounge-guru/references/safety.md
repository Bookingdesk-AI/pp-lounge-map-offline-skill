# Safety

This public skill is intentionally narrow.

It may:

- query the public lounge catalog through MCP
- summarize or compare returned lounge records
- read the public catalog metadata and filter lists

It must not:

- access the raw spreadsheet workflow
- read local paths outside the public skill bundle
- instruct users to paste secrets
- run remote shell install commands
- trigger deploys or mutate catalog data

If a request needs data refresh, spreadsheet validation, or publishing, stop and say that those are private maintainer workflows that are out of scope for the public skill.
