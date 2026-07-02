import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), '..');

const scopes = [
  {
    label: 'source',
    root: path.join(projectRoot, 'skills', 'lounge-guru-offline'),
    expectedSkill: 'lounge-guru-offline',
    required: ['SKILL.md', 'README.md', 'references/mcp.md', 'references/safety.md', 'references/publishing.md', 'references/operator-trust-evidence.md'],
  },
  {
    label: 'pp-export-mirror',
    root: path.join(projectRoot, 'out', 'pp-lounge-map-offline-skill', 'skills', 'pp-lounge-map-offline'),
    expectedSkill: 'pp-lounge-map-offline',
    required: ['SKILL.md', 'README.md', 'references/mcp.md', 'references/safety.md', 'references/publishing.md', 'references/operator-trust-evidence.md'],
  },
];

async function exists(filePath) {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const report = [];
  for (const scope of scopes) {
    const missing = [];
    for (const relativePath of scope.required) {
      if (!(await exists(path.join(scope.root, relativePath)))) missing.push(relativePath);
    }

    let frontmatterName = null;
    let operatorTrustEvidenceReferenced = false;
    const skillPath = path.join(scope.root, 'SKILL.md');
    if (await exists(skillPath)) {
      const text = await fs.readFile(skillPath, 'utf8');
      frontmatterName = text.match(/^---\n[\s\S]*?^name:\s*([^\n]+)$/mu)?.[1]?.trim() ?? null;
      operatorTrustEvidenceReferenced = text.includes('references/operator-trust-evidence.md');
    }

    report.push({
      scope: scope.label,
      path: path.relative(projectRoot, scope.root),
      expectedSkill: scope.expectedSkill,
      frontmatterName,
      requiredFiles: scope.required.length,
      missingRequiredFiles: missing,
      operatorTrustEvidenceReferenced,
      status: missing.length === 0 && frontmatterName === scope.expectedSkill && operatorTrustEvidenceReferenced ? 'ready' : 'needs-attention',
    });
  }

  console.log(JSON.stringify({ generatedBy: 'report-offline-skill-evidence', scopes: report }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
