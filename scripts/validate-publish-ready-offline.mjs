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

  if (issues.length > 0) {
    for (const issue of issues) {
      console.error(`publish-check: ${issue}`);
    }
    process.exitCode = 1;
    return;
  }

  if (evidence) {
    console.log(
      `publish-check: offline skill bundle passed; files=${evidence.filesScanned}, markdownLinks=${evidence.markdownLinksChecked}, requiredPaths=${evidence.requiredPathsChecked}, synchronizedFiles=${evidence.synchronizedFilesChecked}, catalogUrls=${evidence.catalogUrlsChecked}, assetBytes=${evidence.assetBytes ?? "n/a"}/${evidence.maxAssetBytes ?? "n/a"}.`,
    );
  } else {
    console.log("publish-check: offline skill bundle passed.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
