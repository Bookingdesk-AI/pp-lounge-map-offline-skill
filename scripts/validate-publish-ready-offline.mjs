import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  getOfflineSkillPaths,
  OFFLINE_ASSET_MAX_BYTES,
  OFFLINE_SKILL_NAME,
} from "./lib/offline-skill-build.mjs";
import { validateSkillBundleWithOptions } from "./lib/publish-safety.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

async function validateOfflinePackageManifest({ exportDir, issues, evidence }) {
  evidence.packageManifestFieldsChecked = 0;
  evidence.packageManifestRequiredFilesChecked = 0;

  const manifestPath = path.join(exportDir, "SKILL-PACKAGE.json");
  let manifest;
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    evidence.packageManifestFieldsChecked += 1;
  } catch (error) {
    issues.push(`Offline package manifest could not be read: ${error.message}`);
    return null;
  }

  const expectedFields = {
    name: OFFLINE_SKILL_NAME,
    skillPath: path.join("skills", OFFLINE_SKILL_NAME, "SKILL.md"),
    packageRootType: "wrapper",
    mcpCommand: `node skills/${OFFLINE_SKILL_NAME}/scripts/run-offline-mcp.mjs`,
    validationCommand: "npm run validate:publish:offline",
  };

  for (const [field, expectedValue] of Object.entries(expectedFields)) {
    evidence.packageManifestFieldsChecked += 1;
    if (manifest?.[field] !== expectedValue) {
      issues.push(`Offline package manifest must declare ${field}: ${expectedValue}`);
    }
  }

  const requiredFiles = Array.isArray(manifest?.requiredFiles) ? manifest.requiredFiles : [];
  evidence.packageManifestFieldsChecked += 1;
  if (requiredFiles.length === 0) {
    issues.push("Offline package manifest must declare requiredFiles for reviewer path integrity.");
  }

  for (const relativePath of requiredFiles) {
    evidence.packageManifestRequiredFilesChecked += 1;
    const resolvedPath = path.resolve(exportDir, relativePath);
    if (!resolvedPath.startsWith(exportDir + path.sep)) {
      issues.push(`Offline package manifest requiredFiles entry escapes package root: ${relativePath}`);
      continue;
    }
    try {
      await fs.stat(resolvedPath);
    } catch {
      issues.push(`Offline package manifest required file is missing: ${relativePath}`);
    }
  }

  return manifest;
}

async function validateOfflinePackageEntrypoint({ exportDir, issues, evidence }) {
  evidence.packageEntrypointsChecked = 0;
  evidence.packageDependenciesChecked = 0;

  const packagePath = path.join(exportDir, "package.json");
  let packageJson;
  try {
    packageJson = JSON.parse(await fs.readFile(packagePath, "utf8"));
    evidence.packageEntrypointsChecked += 1;
  } catch (error) {
    issues.push(`Offline package entrypoint metadata could not be read: ${error.message}`);
    return;
  }

  const mcpScript = packageJson?.scripts?.mcp;
  if (typeof mcpScript !== "string" || mcpScript.length === 0) {
    issues.push("Offline package package.json must expose a non-empty scripts.mcp entrypoint.");
    return;
  }

  if (!mcpScript.startsWith("node ") || /[;&|`$<>]/u.test(mcpScript)) {
    issues.push("Offline package scripts.mcp must be a simple node command without shell metacharacters.");
    return;
  }

  const scriptRelativePath = mcpScript.slice("node ".length).trim();
  const scriptPath = path.resolve(exportDir, scriptRelativePath);
  if (!scriptPath.startsWith(exportDir + path.sep)) {
    issues.push("Offline package scripts.mcp must reference a script inside the exported package.");
  } else {
    try {
      await fs.stat(scriptPath);
      evidence.packageEntrypointsChecked += 1;
    } catch {
      issues.push(`Offline package scripts.mcp references a missing file: ${scriptRelativePath}`);
    }
  }

  for (const dependencyName of ["@modelcontextprotocol/sdk", "zod"]) {
    evidence.packageDependenciesChecked += 1;
    if (!packageJson?.dependencies?.[dependencyName]) {
      issues.push(`Offline package package.json must declare dependency: ${dependencyName}`);
    }
  }
}

async function validateOfflinePackageReadmeTrustBoundary({ exportDir, issues, evidence }) {
  evidence.packageReadmeTrustBoundaryPhrasesChecked = 0;

  const readmePath = path.join(exportDir, "README.md");
  let readmeText;
  try {
    readmeText = await fs.readFile(readmePath, "utf8");
  } catch (error) {
    issues.push(`Offline package README trust-boundary evidence could not be checked: ${error.message}`);
    return;
  }

  const requiredPhrases = [
    "local-only at runtime",
    "bundled catalog snapshot",
    "does not require network access",
    "no OAuth flows",
    "no sensitive credential collection",
    "no purchase/payment execution",
    "display metadata only",
  ];

  for (const phrase of requiredPhrases) {
    evidence.packageReadmeTrustBoundaryPhrasesChecked += 1;
    if (!readmeText.includes(phrase)) {
      issues.push(`Offline package README must keep trust-boundary phrase: ${phrase}`);
    }
  }
}

async function validateOfflinePackageReadmeEntrypoint({ exportDir, issues, evidence }) {
  evidence.packageReadmeCommandsChecked = 0;

  const packagePath = path.join(exportDir, "package.json");
  const readmePath = path.join(exportDir, "README.md");
  let packageJson;
  let readmeText;
  try {
    packageJson = JSON.parse(await fs.readFile(packagePath, "utf8"));
    readmeText = await fs.readFile(readmePath, "utf8");
  } catch (error) {
    issues.push(`Offline package README command integrity could not be checked: ${error.message}`);
    return;
  }

  const mcpScript = packageJson?.scripts?.mcp;
  if (typeof mcpScript !== "string" || mcpScript.length === 0) {
    issues.push("Offline package README command integrity requires a non-empty package.json scripts.mcp entrypoint.");
    return;
  }

  evidence.packageReadmeCommandsChecked += 1;
  if (!readmeText.includes(mcpScript)) {
    issues.push("Offline package README must document the exact package.json scripts.mcp command.");
  }

  const scriptRelativePath = mcpScript.startsWith("node ")
    ? mcpScript.slice("node ".length).trim()
    : mcpScript.trim();
  evidence.packageReadmeCommandsChecked += 1;
  if (!readmeText.includes(scriptRelativePath)) {
    issues.push("Offline package README must reference the packaged local MCP script path.");
  }
}

async function validatePackagedRuntimeMirror({ skillDir, exportDir, issues, evidence }) {
  const runtimeRelativePaths = [
    "scripts/run-offline-mcp.mjs",
    "scripts/print-offline-mcp-config.mjs",
    "scripts/runtime/catalog-core.mjs",
    "scripts/runtime/contract.mjs",
    "scripts/runtime/server-core.mjs",
  ];
  evidence.runtimeMirrorFilesChecked = 0;

  for (const relativePath of runtimeRelativePaths) {
    const sourcePath = path.join(skillDir, relativePath);
    const mirrorPath = path.join(exportDir, "skills", OFFLINE_SKILL_NAME, relativePath);
    evidence.runtimeMirrorFilesChecked += 1;
    try {
      const source = await fs.readFile(sourcePath, "utf8");
      const mirror = await fs.readFile(mirrorPath, "utf8");
      if (source !== mirror) {
        issues.push(`Packaged runtime mirror drift detected for ${relativePath}.`);
      }
    } catch (error) {
      issues.push(`Packaged runtime mirror check could not read ${relativePath}: ${error.message}`);
    }
  }
}

async function main() {
  const { skillDir, exportDir } = getOfflineSkillPaths(projectRoot);
  const issues = await validateSkillBundleWithOptions({
    projectRoot,
    skillDir,
    expectedName: OFFLINE_SKILL_NAME,
    maxAssetBytes: OFFLINE_ASSET_MAX_BYTES,
    assetRelativePath: path.join("assets", "catalog.json"),
    validateCatalogDisplayUrls: true,
    forbidHttpUrlsInMarkdown: true,
    validateRelativeMarkdownLinks: true,
    requiredRelativePaths: [
      "references/mcp.md",
      "references/safety.md",
      "references/publishing.md",
      "scripts/run-offline-mcp.mjs",
      "scripts/print-offline-mcp-config.mjs",
      path.join("assets", "catalog.json"),
    ],
    mirrorSkillDir: path.join(exportDir, "skills", OFFLINE_SKILL_NAME),
    synchronizedRelativePaths: [
      "SKILL.md",
      "README.md",
      "references/mcp.md",
      "references/safety.md",
      "references/publishing.md",
    ],
  });

  const evidence = issues.evidence;
  await validateOfflinePackageManifest({ exportDir, issues, evidence });
  await validateOfflinePackageEntrypoint({ exportDir, issues, evidence });
  await validateOfflinePackageReadmeEntrypoint({ exportDir, issues, evidence });
  await validateOfflinePackageReadmeTrustBoundary({ exportDir, issues, evidence });
  await validatePackagedRuntimeMirror({ skillDir, exportDir, issues, evidence });

  if (issues.length > 0) {
    for (const issue of issues) {
      console.error(`publish-check: ${issue}`);
    }
    process.exitCode = 1;
    return;
  }

  if (evidence) {
    console.log(
      `publish-check: offline skill bundle passed; files=${evidence.filesScanned}, markdownLinks=${evidence.markdownLinksChecked}, requiredPaths=${evidence.requiredPathsChecked}, synchronizedFiles=${evidence.synchronizedFilesChecked}, catalogUrls=${evidence.catalogUrlsChecked}, catalogPathSegments=${evidence.catalogTokenLikePathSegmentsChecked ?? 0}, packageManifestFields=${evidence.packageManifestFieldsChecked ?? 0}, packageManifestRequiredFiles=${evidence.packageManifestRequiredFilesChecked ?? 0}, packageEntrypoints=${evidence.packageEntrypointsChecked ?? 0}, packageDependencies=${evidence.packageDependenciesChecked ?? 0}, packageReadmeCommands=${evidence.packageReadmeCommandsChecked ?? 0}, packageReadmeTrustBoundaryPhrases=${evidence.packageReadmeTrustBoundaryPhrasesChecked ?? 0}, runtimeMirrorFiles=${evidence.runtimeMirrorFilesChecked ?? 0}, assetBytes=${evidence.assetBytes ?? "n/a"}/${evidence.maxAssetBytes ?? "n/a"}.`,
    );
  } else {
    console.log("publish-check: offline skill bundle passed.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
