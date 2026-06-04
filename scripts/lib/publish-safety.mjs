import fs from "node:fs/promises";
import path from "node:path";

const TEXT_FILE_EXTENSIONS = new Set([
  ".md",
  ".mjs",
  ".json",
  ".yaml",
  ".yml",
  "",
]);
const OFFLINE_PUBLISH_REMEDIATION =
  "Remediation: restore the missing source file or regenerate/sync the offline package with `npm run build:offline-skill` and `npm run skill:export:offline`, then rerun `npm run validate:publish:offline`.";

const FORBIDDEN_CONTENT_PATTERNS = [
  {
    pattern: /curl\s+[^|\n]+?\|\s*(sh|bash)/i,
    message: "Remote shell pipe detected.",
  },
  {
    pattern: /wget\s+[^|\n]+?\|\s*(sh|bash)/i,
    message: "Remote shell pipe detected.",
  },
  {
    pattern: /bash\s+<\(/i,
    message: "Process substitution shell install detected.",
  },
  {
    pattern: /\bOPENAI_API_KEY\b/,
    message: "API key instructions are not allowed in the public bundle.",
  },
];

async function validateRequiredRelativePaths({
  skillDir,
  issues,
  label = "bundle",
  evidence,
}) {
  for (const relativePath of arguments[0].requiredRelativePaths ?? []) {
    if (evidence) evidence.requiredPathsChecked += 1;
    try {
      await fs.stat(path.join(skillDir, relativePath));
    } catch {
      issues.push(
        `Missing required ${label} file: ${relativePath}. ${OFFLINE_PUBLISH_REMEDIATION}`,
      );
    }
  }
}

async function validateMarkdownLinks({
  skillDir,
  filePath,
  content,
  issues,
  evidence,
}) {
  const linkPattern = /\[[^\]]+\]\(([^)]+)\)/gu;
  for (const match of content.matchAll(linkPattern)) {
    const target = match[1].trim();
    if (
      !target ||
      target.startsWith("#") ||
      /^[a-z][a-z0-9+.-]*:/iu.test(target)
    )
      continue;
    if (evidence) evidence.markdownLinksChecked += 1;
    const [withoutQuery] = target.split(/[?#]/u);
    const resolved = path.resolve(path.dirname(filePath), withoutQuery);
    const relativeFile = path.relative(skillDir, filePath);
    if (!resolved.startsWith(skillDir + path.sep)) {
      issues.push(
        `Markdown link escapes skill bundle in ${relativeFile}: ${target}`,
      );
      continue;
    }
    try {
      await fs.stat(resolved);
    } catch {
      issues.push(`Broken markdown link in ${relativeFile}: ${target}`);
    }
  }
}

async function validateSynchronizedFiles({
  skillDir,
  mirrorSkillDir,
  synchronizedRelativePaths,
  issues,
  evidence,
}) {
  if (!mirrorSkillDir) return;
  try {
    await fs.stat(mirrorSkillDir);
  } catch {
    issues.push(
      `Packaged mirror is missing. ${OFFLINE_PUBLISH_REMEDIATION}`,
    );
    return;
  }

  for (const relativePath of synchronizedRelativePaths) {
    if (evidence) evidence.synchronizedFilesChecked += 1;
    try {
      const source = await fs.readFile(
        path.join(skillDir, relativePath),
        "utf8",
      );
      const mirror = await fs.readFile(
        path.join(mirrorSkillDir, relativePath),
        "utf8",
      );
      if (source !== mirror) {
        issues.push(
          `Packaged mirror drift detected for ${relativePath}. ${OFFLINE_PUBLISH_REMEDIATION}`,
        );
      }
    } catch {
      issues.push(
        `Packaged mirror sync check could not read ${relativePath}. ${OFFLINE_PUBLISH_REMEDIATION}`,
      );
    }
  }
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

function isHumanReadableSlug(segment) {
  const words = segment.split("-").filter((part) => /^[a-z][a-z0-9]{1,}$/u.test(part));
  return words.length >= 3;
}

function isTokenLikePathSegment(segment) {
  if (!segment) return false;
  let decoded;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    return true;
  }
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(decoded)) {
    return true;
  }
  if (
    decoded.length >= 48 &&
    /^[A-Za-z0-9_-]+$/u.test(decoded) &&
    !isHumanReadableSlug(decoded) &&
    /[A-Za-z]/u.test(decoded) &&
    /[0-9_-]/u.test(decoded)
  ) {
    return true;
  }
  return false;
}

export async function validateSkillBundle({ projectRoot, skillDir }) {
  return validateSkillBundleWithOptions({
    projectRoot,
    skillDir,
  });
}

export async function validateSkillBundleWithOptions({
  projectRoot,
  skillDir,
  expectedName,
  maxAssetBytes,
  assetRelativePath,
  validateCatalogDisplayUrls = false,
  forbidHttpUrlsInMarkdown = false,
  validateRelativeMarkdownLinks = false,
  requiredRelativePaths = [],
  mirrorSkillDir,
  synchronizedRelativePaths = [],
}) {
  const issues = [];
  const evidence = {
    filesScanned: 0,
    markdownLinksChecked: 0,
    requiredPathsChecked: 0,
    synchronizedFilesChecked: 0,
    maxAssetBytes,
    assetBytes: null,
    catalogUrlsChecked: 0,
    catalogTokenLikePathSegmentsChecked: 0,
  };
  const files = await walk(skillDir);
  const homeDir = process.env.HOME || "";

  if (!files.some((filePath) => path.basename(filePath) === "SKILL.md")) {
    issues.push(`Missing SKILL.md in ${skillDir}.`);
  }

  for (const filePath of files) {
    const relativePath = path.relative(skillDir, filePath);
    const extname = path.extname(filePath);

    if (!TEXT_FILE_EXTENSIONS.has(extname)) {
      issues.push(
        `Unexpected file extension in public bundle: ${relativePath}`,
      );
      continue;
    }

    const content = await fs.readFile(filePath, "utf8");
    evidence.filesScanned += 1;
    if (
      content.includes(projectRoot) ||
      (homeDir && content.includes(homeDir))
    ) {
      issues.push(`Local path leak detected in ${relativePath}.`);
    }

    if (content.includes("../pps") || content.includes("PP Lounge Data_")) {
      issues.push(`Private source reference detected in ${relativePath}.`);
    }

    for (const check of FORBIDDEN_CONTENT_PATTERNS) {
      if (check.pattern.test(content)) {
        issues.push(`${check.message} (${relativePath})`);
      }
    }

    if (
      forbidHttpUrlsInMarkdown &&
      path.extname(filePath) === ".md" &&
      /https?:\/\//u.test(content)
    ) {
      issues.push(
        `Remote URL detected in offline documentation: ${relativePath}`,
      );
    }

    if (validateRelativeMarkdownLinks && path.extname(filePath) === ".md") {
      await validateMarkdownLinks({
        skillDir,
        filePath,
        content,
        issues,
        evidence,
      });
    }
  }

  await validateRequiredRelativePaths({
    skillDir,
    requiredRelativePaths,
    issues,
    evidence,
  });
  await validateSynchronizedFiles({
    skillDir,
    mirrorSkillDir,
    synchronizedRelativePaths,
    issues,
    evidence,
  });

  const skillFile = path.join(skillDir, "SKILL.md");
  try {
    const skillText = await fs.readFile(skillFile, "utf8");
    if (!/^---\n[\s\S]+?\n---/u.test(skillText)) {
      issues.push("SKILL.md must include YAML frontmatter.");
    }
    if (
      expectedName &&
      !new RegExp(`name:\\s*${expectedName}`, "u").test(skillText)
    ) {
      issues.push(`SKILL.md must declare the ${expectedName} name.`);
    }
    if (!/description:/u.test(skillText)) {
      issues.push("SKILL.md must declare a description.");
    }
  } catch {
    issues.push("SKILL.md could not be read.");
  }

  if (assetRelativePath && maxAssetBytes) {
    try {
      const assetPath = path.join(skillDir, assetRelativePath);
      const stat = await fs.stat(assetPath);
      evidence.assetBytes = stat.size;
      if (stat.size > maxAssetBytes) {
        issues.push(
          `Asset ${assetRelativePath} exceeds size budget: ${stat.size} bytes > ${maxAssetBytes} bytes.`,
        );
      }
    } catch {
      issues.push(`Expected asset missing: ${assetRelativePath}`);
    }
  }

  if (validateCatalogDisplayUrls && assetRelativePath) {
    const assetPath = path.join(skillDir, assetRelativePath);
    try {
      const catalog = JSON.parse(await fs.readFile(assetPath, "utf8"));
      const lounges = Array.isArray(catalog.lounges) ? catalog.lounges : [];
      for (const [index, lounge] of lounges.entries()) {
        if (!lounge || typeof lounge.url !== "string" || lounge.url.length === 0) {
          continue;
        }
        evidence.catalogUrlsChecked += 1;
        let url;
        try {
          url = new URL(lounge.url);
        } catch {
          issues.push(`Catalog lounge ${index} has an unparsable display URL.`);
          continue;
        }
        if (url.protocol !== "https:") {
          issues.push(`Catalog lounge ${index} display URL must use https.`);
        }
        if (url.username || url.password || url.search || url.hash) {
          issues.push(
            `Catalog lounge ${index} display URL must not include userinfo, query, or fragment.`,
          );
        }
        for (const segment of url.pathname.split("/")) {
          if (!segment) continue;
          evidence.catalogTokenLikePathSegmentsChecked += 1;
          if (isTokenLikePathSegment(segment)) {
            issues.push(
              `Catalog lounge ${index} display URL contains a token-like path segment; redact before packaging offline metadata.`,
            );
          }
        }
      }
    } catch (error) {
      issues.push(`Catalog URL validation could not read ${assetRelativePath}: ${error.message}`);
    }
  }

  Object.defineProperty(issues, "evidence", {
    value: evidence,
    enumerable: false,
  });

  return issues;
}

