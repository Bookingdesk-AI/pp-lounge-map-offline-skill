import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const appCss = fs.readFileSync(new URL('../src/App.css', import.meta.url), 'utf8');
const viteConfig = fs.readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
const redirects = fs.readFileSync(new URL('../public/_redirects', import.meta.url), 'utf8');
const clusterLayerSource = fs.readFileSync(
  new URL('../src/map/cluster/LoungeClusterLayer.tsx', import.meta.url),
  'utf8',
);
const clusterIconsSource = fs.readFileSync(new URL('../src/map/cluster/clusterIcons.ts', import.meta.url), 'utf8');

test('desktop rail uses command search with structured filters in one panel', () => {
  assert.match(appSource, /function AutocompleteFilter/);
  assert.match(appSource, /<section className="filter-primary-row">/);
  assert.match(appSource, /className="rail-command-search"/);
  assert.match(appSource, /Search airport, city, brand/);
  assert.match(appSource, /function SearchCommandCombobox/);
  assert.match(appSource, /ALL_ROUTES_AIRPORTS_ENDPOINT = '\/api\/all-routes\/airports'/);
  assert.match(appSource, /fetch\(`\$\{ALL_ROUTES_AIRPORTS_ENDPOINT\}\?\$\{params\.toString\(\)\}`/);
  assert.match(appSource, /formatAirportSuggestionLabel/);
  assert.match(appSource, /role="combobox"/);
  assert.match(appSource, /aria-autocomplete="list"/);
  assert.match(appSource, /className="autocomplete-menu"/);
  assert.doesNotMatch(appSource, /<datalist/);
  assert.match(appSource, /className="filter-panel-trigger"/);
  assert.match(appSource, /aria-haspopup="dialog"/);
  assert.match(appSource, /className="filter-popover-panel"/);
  assert.match(appSource, /role="dialog"/);
  assert.match(appSource, /<span>Filters<\/span>/);
  assert.match(appSource, /<div className="control-label">Location<\/div>/);
  assert.match(appSource, /label="Country"/);
  assert.match(appSource, /label="City"/);
  assert.match(appSource, /label="Brand"/);
  assert.match(appSource, /<div className="control-label">Type<\/div>/);
  assert.match(appSource, /<div className="control-label">Facilities<\/div>/);
  assert.doesNotMatch(appSource, /sourceEvidence=/);
  assert.doesNotMatch(appSource, /SourceEvidenceStrip/);
  assert.doesNotMatch(appSource, /<span>CF sources<\/span>/);
  assert.doesNotMatch(appSource, /Advanced/);
  assert.match(appCss, /\.filter-primary-row\s*{/);
  assert.match(appCss, /\.rail-command-search,\n\.autocomplete-filter\s*{/);
  assert.match(appCss, /\.filter-panel-trigger\s*{/);
  assert.match(appCss, /\.filter-popover-panel\s*{/);
  assert.match(appCss, /\.autocomplete-menu\s*{/);
  assert.match(appCss, /\.filter-panel-fields\s*{/);
  assert.match(appCss, /\.pill-grid\.is-panel\s*{/);
  assert.doesNotMatch(appCss, /source-evidence-strip/);
  assert.match(viteConfig, /all-routes-web\.pages\.dev/);
  assert.match(viteConfig, /\/api\/all-routes\/airports/);
  assert.match(viteConfig, /\/api\/airports/);
  assert.match(redirects, /\/api\/all-routes\/airports https:\/\/all-routes-web\.pages\.dev\/api\/airports 200/);
});

test('map markers use pass colors, pie slices, larger dots, and longer spider spokes', () => {
  assert.match(clusterLayerSource, /spiderfyDistanceMultiplier=\{1\.55\}/);
  assert.match(clusterLayerSource, /spiderLegPolylineOptions=\{\{/);
  assert.match(clusterLayerSource, /feature\.properties\.canonical\?\.lounge\.programs/);
  assert.match(clusterLayerSource, /markerIcon\(/);
  assert.match(clusterIconsSource, /PROGRAM_THEME_COLOR/);
  assert.match(clusterIconsSource, /prioritypass:\s*'#2456a6'/);
  assert.match(clusterIconsSource, /RAINBOW_THEME/);
  assert.match(clusterIconsSource, /conic-gradient/);
  assert.match(clusterIconsSource, /normalizedPrograms\.length > 6/);
  assert.match(clusterIconsSource, /iconSize:\s*\[30, 30\]/);
  assert.match(appCss, /\.marker-dot\s*{[^}]*width:\s*22px;[^}]*height:\s*22px;/s);
  assert.match(appCss, /\.leaflet-cluster-spider-leg\s*{[^}]*stroke-width:\s*2\.4px;/s);
});
