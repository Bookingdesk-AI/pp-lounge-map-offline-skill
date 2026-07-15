import fs from 'node:fs/promises';
import path from 'node:path';

export const OFFLINE_SKILL_NAME = 'lounge-guru-offline';
export const OFFLINE_ASSET_MAX_BYTES = 5 * 1024 * 1024;

const RUNTIME_SOURCES = [
  ['mcp/contract.js', 'contract.mjs'],
  ['mcp/catalog-core.js', 'catalog-core.mjs'],
  ['mcp/server-core.js', 'server-core.mjs'],
];
const FIELD_COVERAGE_CODES = Object.freeze({
  'access.accessOffers': 'a',
  'airport.city': 'b',
  'airport.coordinates': 'c',
  'airport.country': 'd',
  'airport.iata': 'e',
  'airport.name': 'f',
  amenities: 'g',
  'location.gate': 'h',
  'location.terminal': 'i',
  'lounge.brand': 'j',
  'lounge.name': 'k',
  'operations.exceptions': 'l',
  'operations.hours': 'm',
  restrictions: 'n',
  'source.url': 'o',
});

function rewriteRuntimeImports(source) {
  return source.replace(/from '\.\/([^']+)\.js'/g, "from './$1.mjs'");
}

function slimSource(source) {
  const { rightsNote, ...rest } = source;
  void rightsNote;
  return rest;
}

function slimLoungeSource(source) {
  const { fieldCoverage, publisher, rightsNote, ...rest } = source;
  const fc = (fieldCoverage ?? []).map((field) => FIELD_COVERAGE_CODES[field] ?? field);
  void fieldCoverage;
  void publisher;
  void rightsNote;
  return fc.length > 0 ? { ...rest, fc } : rest;
}

function buildSourceRights(lounges) {
  return Object.fromEntries(
    lounges.flatMap((lounge) =>
      (lounge.sources ?? [])
        .filter((source) => source.sourceId && source.rightsNote)
        .map((source) => [source.sourceId, source.rightsNote]),
    ),
  );
}

export function getOfflineSkillPaths(projectRoot) {
  const skillDir = path.resolve(projectRoot, 'skills', OFFLINE_SKILL_NAME);
  return {
    skillDir,
    runtimeDir: path.resolve(skillDir, 'scripts', 'runtime'),
    assetPath: path.resolve(skillDir, 'assets', 'catalog.json'),
    sourceCatalogPath: path.resolve(projectRoot, 'mcp', 'data', 'catalog.json'),
    exportDir: path.resolve(projectRoot, 'out', 'pp-lounge-map-offline-skill'),
  };
}

export async function buildOfflineSkill(projectRoot) {
  const { runtimeDir, assetPath, sourceCatalogPath } = getOfflineSkillPaths(projectRoot);
  await fs.mkdir(runtimeDir, { recursive: true });
  await fs.mkdir(path.dirname(assetPath), { recursive: true });

  for (const [sourceRelativePath, targetName] of RUNTIME_SOURCES) {
    const sourcePath = path.resolve(projectRoot, sourceRelativePath);
    const targetPath = path.resolve(runtimeDir, targetName);
    const source = await fs.readFile(sourcePath, 'utf8');
    await fs.writeFile(targetPath, rewriteRuntimeImports(source), 'utf8');
  }

  const catalog = JSON.parse(await fs.readFile(sourceCatalogPath, 'utf8'));
  const slimCatalog = {
    generatedAt: catalog.generatedAt,
    sourceFile: 'offline-snapshot',
    schema: catalog.schema,
    stats: catalog.stats,
    filters: catalog.filters,
    quality: catalog.quality,
    sources: (catalog.sources ?? []).map(slimSource),
    sourceRights: buildSourceRights(catalog.lounges),
    lounges: catalog.lounges.map(({ searchText, canonical, slug, url, ...lounge }) => {
      void canonical;
      void slug;
      void url;
      return {
        ...lounge,
        sources: (lounge.sources ?? []).map(slimLoungeSource),
      };
    }),
  };
  const serialized = JSON.stringify(slimCatalog);
  const assetBytes = Buffer.byteLength(serialized);

  if (assetBytes > OFFLINE_ASSET_MAX_BYTES) {
    throw new Error(
      `Offline asset exceeds size budget: ${assetBytes} bytes > ${OFFLINE_ASSET_MAX_BYTES} bytes.`,
    );
  }

  await fs.writeFile(assetPath, serialized, 'utf8');

  return {
    assetBytes,
    runtimeFiles: RUNTIME_SOURCES.map(([, targetName]) => path.resolve(runtimeDir, targetName)),
    assetPath,
  };
}
