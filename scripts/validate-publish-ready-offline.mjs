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
  await validateOfflinePackageEntrypoint({ exportDir, issues, evidence });

  if (issues.length > 0) {
    for (const issue of issues) {
      console.error(`publish-check: ${issue}`);
    }
    process.exitCode = 1;
    return;
  }

  if (evidence) {
    console.log(
      `publish-check: offline skill bundle passed; files=${evidence.filesScanned}, markdownLinks=${evidence.markdownLinksChecked}, requiredPaths=${evidence.requiredPathsChecked}, synchronizedFiles=${evidence.synchronizedFilesChecked}, catalogUrls=${evidence.catalogUrlsChecked}, packageEntrypoints=${evidence.packageEntrypointsChecked ?? 0}, packageDependencies=${evidence.packageDependenciesChecked ?? 0}, assetBytes=${evidence.assetBytes ?? "n/a"}/${evidence.maxAssetBytes ?? "n/a"}.`,
    );
  } else {
    console.log("publish-check: offline skill bundle passed.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
