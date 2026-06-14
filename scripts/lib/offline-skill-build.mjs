import fs from 'node:fs/promises';
import path from 'node:path';

export const OFFLINE_SKILL_NAME = 'lounge-guru-offline';
export const OFFLINE_ASSET_MAX_BYTES = 5 * 1024 * 1024;

const RUNTIME_SOURCES = [
  ['mcp/contract.js', 'contract.mjs'],
  ['mcp/catalog-core.js', 'catalog-core.mjs'],
  ['mcp/server-core.js', 'server-core.mjs'],
];

function rewriteRuntimeImports(source) {
  return source.replace(/from '\.\/([^']+)\.js'/g, "from './$1.mjs'");
}

export function getOfflineSkillPaths(projectRoot) {
  const skillDir = path.resolve(projectRoot, 'skills', OFFLINE_SKILL_NAME);
  return {
    skillDir,
    runtimeDir: path.resolve(skillDir, 'scripts', 'runtime'),
    assetPath: path.resolve(skillDir, 'assets', 'catalog.json'),
    sourceCatalogPath: path.resolve(projectRoot, 'mcp', 'data', 'catalog.json'),
    exportDir: path.resolve(projectRoot, 'out', 'lounge-guru-offline-skill'),
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
    sources: catalog.sources,
    lounges: catalog.lounges.map(({ searchText, canonical, ...lounge }) => {
      void canonical;
      return lounge;
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
