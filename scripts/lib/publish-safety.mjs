import fs from 'node:fs/promises';
import path from 'node:path';

const TEXT_FILE_EXTENSIONS = new Set(['.md', '.mjs', '.json', '.yaml', '.yml', '']);
const FORBIDDEN_CONTENT_PATTERNS = [
  {
    pattern: /curl\s+[^|\n]+?\|\s*(sh|bash)/i,
    message: 'Remote shell pipe detected.',
  },
  {
    pattern: /wget\s+[^|\n]+?\|\s*(sh|bash)/i,
    message: 'Remote shell pipe detected.',
  },
  {
    pattern: /bash\s+<\(/i,
    message: 'Process substitution shell install detected.',
  },
  {
    pattern: /\bOPENAI_API_KEY\b/,
    message: 'API key instructions are not allowed in the public bundle.',
  },
];

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
  forbidHttpUrlsInMarkdown = false,
}) {
  const issues = [];
  const files = await walk(skillDir);
  const homeDir = process.env.HOME || '';

  if (!files.some((filePath) => path.basename(filePath) === 'SKILL.md')) {
    issues.push(`Missing SKILL.md in ${skillDir}.`);
  }

  for (const filePath of files) {
    const relativePath = path.relative(skillDir, filePath);
    const extname = path.extname(filePath);

    if (!TEXT_FILE_EXTENSIONS.has(extname)) {
      issues.push(`Unexpected file extension in public bundle: ${relativePath}`);
      continue;
    }

    const content = await fs.readFile(filePath, 'utf8');
    if (content.includes(projectRoot) || (homeDir && content.includes(homeDir))) {
      issues.push(`Local path leak detected in ${relativePath}.`);
    }

    if (content.includes('../pps') || content.includes('PP Lounge Data_')) {
      issues.push(`Private source reference detected in ${relativePath}.`);
    }

    for (const check of FORBIDDEN_CONTENT_PATTERNS) {
      if (check.pattern.test(content)) {
        issues.push(`${check.message} (${relativePath})`);
      }
    }

    if (forbidHttpUrlsInMarkdown && path.extname(filePath) === '.md' && /https?:\/\//u.test(content)) {
      issues.push(`Remote URL detected in offline documentation: ${relativePath}`);
    }
  }

  const skillFile = path.join(skillDir, 'SKILL.md');
  try {
    const skillText = await fs.readFile(skillFile, 'utf8');
    if (!/^---\n[\s\S]+?\n---/u.test(skillText)) {
      issues.push('SKILL.md must include YAML frontmatter.');
    }
    if (expectedName && !new RegExp(`name:\\s*${expectedName}`, 'u').test(skillText)) {
      issues.push(`SKILL.md must declare the ${expectedName} name.`);
    }
    if (!/description:/u.test(skillText)) {
      issues.push('SKILL.md must declare a description.');
    }
  } catch {
    issues.push('SKILL.md could not be read.');
  }

  if (assetRelativePath && maxAssetBytes) {
    try {
      const assetPath = path.join(skillDir, assetRelativePath);
      const stat = await fs.stat(assetPath);
      if (stat.size > maxAssetBytes) {
        issues.push(
          `Asset ${assetRelativePath} exceeds size budget: ${stat.size} bytes > ${maxAssetBytes} bytes.`,
        );
      }
    } catch {
      issues.push(`Expected asset missing: ${assetRelativePath}`);
    }
  }

  return issues;
}
