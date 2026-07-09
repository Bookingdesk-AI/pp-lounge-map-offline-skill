import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const bundleRoot = path.resolve(path.dirname(__filename), '..');
const skillDir = path.join(bundleRoot, 'skills', 'pp-lounge-map-offline');
const expectedName = 'pp-lounge-map-offline';
const requiredReferences = ['references/mcp.md', 'references/safety.md', 'references/publishing.md', 'references/operator-trust-evidence.md'];
const requiredFiles = [
  'assets/catalog.json',
  'scripts/run-offline-mcp.mjs',
  'scripts/print-offline-mcp-config.mjs',
  'scripts/runtime/catalog-core.mjs',
  'scripts/runtime/contract.mjs',
  'scripts/runtime/server-core.mjs',
];
const docsThatMustReferenceRequiredReferences = ['SKILL.md', 'README.md'];
const issues = [];
const evidence = {
  skill: expectedName,
  filesScanned: 0,
  markdownFilesChecked: 0,
  markdownLinksChecked: 0,
  requiredReferencesChecked: requiredReferences.length,
  requiredFilesChecked: requiredFiles.length,
  requiredReferencePaths: [],
  requiredFilePaths: [],
  frontmatterKeysChecked: [],
  catalogRecordsChecked: 0,
  secretPatternsChecked: 0,
  secretOrPathFindingsRedacted: 0,
  secretPatternFindingsByLabel: {},
  unsafeUrlBoundaryChecks: 0,
  unsafeUrlBoundaryFindings: 0,
};

const secretPatterns = [
  { label: 'aws-access-key', pattern: /AKIA[0-9A-Z]{16}/u },
  { label: 'private-key', pattern: /-----BEGIN (?:RSA|EC|OPENSSH|PGP|PRIVATE) KEY-----/u },
  { label: 'slack-token', pattern: /xox[baprs]-/u },
  { label: 'github-token', pattern: /ghp_[A-Za-z0-9]{36,}/u },
  { label: 'github-pat', pattern: /github_pat_[A-Za-z0-9_]{20,}/u },
  { label: 'google-api-key', pattern: /AIza[0-9A-Za-z\-_]{35}/u },
  { label: 'openai-key', pattern: /sk-[A-Za-z0-9]{20,}/u },
  { label: 'assigned-secret-field', pattern: /\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*\S+/iu },
  { label: 'personal-absolute-path', pattern: /\/(?:Users|home)\/[A-Za-z0-9][A-Za-z0-9._-]+/u },
];
evidence.secretPatternsChecked = secretPatterns.length;
const textExtensions = new Set(['.md', '.yaml', '.yml', '.json', '.mjs']);


function inspectUrlBoundary(filePath, line, index) {
  const urlPattern = /https?:\/\/[^\s,;)"'<>`]+/giu;
  for (const [urlCandidate] of line.matchAll(urlPattern)) {
    const rawUrl = urlCandidate.replace(/[.,;:!?]+$/u, '');
    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch {
      evidence.unsafeUrlBoundaryFindings += 1;
      issues.push(`${path.relative(bundleRoot, filePath)}:${index + 1} contains an unparsable HTTP(S) URL; inspect without echoing URL content.`);
      continue;
    }
    const encodedControl = /%(?:00|0a|0d)/iu.test(rawUrl);
    const credentialBearing = Boolean(parsed.username || parsed.password);
    const tokenLikeParam = [...parsed.searchParams.keys()].some((key) => /(?:token|secret|password|api[_-]?key|auth|credential)/iu.test(key));
    if (encodedControl || credentialBearing || tokenLikeParam) {
      evidence.unsafeUrlBoundaryFindings += 1;
      issues.push(`${path.relative(bundleRoot, filePath)}:${index + 1} contains unsafe URL boundary evidence: ${[
        credentialBearing ? 'userinfo' : null,
        tokenLikeParam ? 'token-like-query' : null,
        encodedControl ? 'encoded-control' : null,
      ].filter(Boolean).join(', ')}; inspect without echoing URL content.`);
    }
  }
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(fullPath)));
    else files.push(fullPath);
  }
  return files;
}

function frontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/u);
  if (!match) return null;
  return Object.fromEntries(
    match[1]
      .split('\n')
      .map((line) => {
        const [key, ...rest] = line.split(':');
        return [key.trim(), rest.join(':').trim()];
      })
      .filter(([key]) => key),
  );
}

async function validateMarkdownLinks(filePath, text) {
  evidence.markdownFilesChecked += 1;
  const linkPattern = /\[[^\]]+\]\(([^)]+)\)/gu;
  for (const match of text.matchAll(linkPattern)) {
    const target = match[1].trim();
    if (!target || target.startsWith('#') || /^[a-z][a-z0-9+.-]*:/iu.test(target)) continue;
    evidence.markdownLinksChecked += 1;
    const [withoutQuery] = target.split(/[?#]/u);
    const resolved = path.resolve(path.dirname(filePath), withoutQuery);
    if (!resolved.startsWith(skillDir + path.sep)) {
      issues.push(`${path.relative(bundleRoot, filePath)} links outside skill bundle: ${target}`);
      continue;
    }
    try {
      await fs.stat(resolved);
    } catch {
      issues.push(`${path.relative(bundleRoot, filePath)} has missing relative link: ${target}`);
    }
  }
}

const skillPath = path.join(skillDir, 'SKILL.md');
const skillText = await fs.readFile(skillPath, 'utf8');
const fm = frontmatter(skillText);
if (!fm) issues.push('SKILL.md must include YAML frontmatter.');
else {
  evidence.frontmatterKeysChecked = Object.keys(fm).filter((key) => ['name', 'description', 'metadata'].includes(key));
  if (fm.name !== expectedName) issues.push(`SKILL.md name must be ${expectedName}.`);
  if (!fm.description) issues.push('SKILL.md description must be non-empty.');
}

for (const reference of requiredReferences) {
  try {
    await fs.stat(path.join(skillDir, reference));
    evidence.requiredReferencePaths.push(reference);
  } catch {
    issues.push(`Missing required offline reference: ${reference}`);
  }
  if (!skillText.includes(reference)) issues.push(`SKILL.md must reference ${reference}.`);
}

for (const doc of docsThatMustReferenceRequiredReferences) {
  let docText;
  try {
    docText = await fs.readFile(path.join(skillDir, doc), 'utf8');
  } catch {
    issues.push(`${doc} could not be read while checking required offline references.`);
    continue;
  }
  for (const reference of requiredReferences) {
    if (!docText.includes(reference)) issues.push(`${doc} must reference ${reference} so packaged offline guidance stays reviewable.`);
  }
}

for (const requiredFile of requiredFiles) {
  try {
    await fs.stat(path.join(skillDir, requiredFile));
    evidence.requiredFilePaths.push(requiredFile);
  } catch {
    issues.push(`Missing required offline file: ${requiredFile}`);
  }
}

try {
  const catalog = JSON.parse(await fs.readFile(path.join(skillDir, 'assets', 'catalog.json'), 'utf8'));
  const records = Array.isArray(catalog) ? catalog : Array.isArray(catalog.lounges) ? catalog.lounges : [];
  evidence.catalogRecordsChecked = records.length;
  if (records.length === 0) issues.push('assets/catalog.json must contain at least one bundled lounge record.');
} catch {
  issues.push('assets/catalog.json could not be parsed as JSON.');
}

for (const filePath of await walk(skillDir)) {
  evidence.filesScanned += 1;
  if (!textExtensions.has(path.extname(filePath))) continue;
  const relativePath = path.relative(skillDir, filePath);
  const text = await fs.readFile(filePath, 'utf8');
  if (path.extname(filePath) === '.md') await validateMarkdownLinks(filePath, text);
  if (relativePath === 'assets/catalog.json') continue;
  text.split('\n').forEach((line, index) => {
    evidence.unsafeUrlBoundaryChecks += 1;
    inspectUrlBoundary(filePath, line, index);
    const matchedLabels = secretPatterns
      .filter(({ pattern }) => pattern.test(line))
      .map(({ label }) => label);
    if (matchedLabels.length) {
      evidence.secretOrPathFindingsRedacted += matchedLabels.length;
      for (const label of matchedLabels) evidence.secretPatternFindingsByLabel[label] = (evidence.secretPatternFindingsByLabel[label] || 0) + 1;
      issues.push(`${path.relative(bundleRoot, filePath)}:${index + 1} contains redacted secret/path pattern(s): ${matchedLabels.join(', ')}; inspect without echoing match content.`);
    }
  });
}

if (issues.length) {
  for (const issue of issues) console.error(`offline-skill-security: ${issue}`);
  console.error('offline-skill-security: failure guidance: keep matched secret/path content redacted, repair missing references or catalog artifacts first, then rerun node scripts/validate-offline-skill-security.mjs from the packaged offline skill root.');
  console.error('offline-skill-security: remediation checklist: (1) restore missing SKILL/README/reference links, (2) keep runtime lookup local and read-only, (3) replace credential-like values with placeholders, (4) document package drift before publishing.');
  console.error(`offline-skill-security: evidence ${JSON.stringify(evidence)}`);
  process.exitCode = 1;
} else {
  console.log(`${expectedName}: offline skill security validation passed.`);
  console.log(`offline-skill-security: evidence ${JSON.stringify(evidence)}`);
}
