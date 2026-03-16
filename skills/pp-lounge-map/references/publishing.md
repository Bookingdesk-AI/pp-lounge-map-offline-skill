# Publishing Notes

This bundle is designed to be published safely in public marketplaces.

Before publishing:

1. Run `npm run validate:publish`.
2. Run `npm run skill:validate`.
3. Run `npm run skill:export`.
4. Review the staged bundle in `out/pp-lounge-map-skill/`.

Recommended publishing flow:

- ClawHub: publish the `skills/pp-lounge-map/` bundle with a semver tag.
- skills.sh: mirror the exported bundle into a dedicated public repo so installers review only the audited public artifact.

Do not publish the full app repo as the marketplace-visible skill artifact.
