import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { isSensitiveFieldName, isSensitiveQueryName } from '../shared/security-redaction.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distRoot = path.resolve(projectRoot, 'dist');
const publicPayloadPath = path.resolve(projectRoot, 'public', 'data', 'lounge-map.json');
const catalogPath = path.resolve(projectRoot, 'public', 'data', 'lounge-guru-catalog.json');
const allowedDistDataFile = /^data\/(?:lounge-map\.json|brand-logos\/[^/]+\.(?:png|svg))$/;
const forbiddenArtifactNames = [
  'airport-authority.json',
  'cloudflare-source-intake-plan.json',
  'cloudflare-source-run-evidence.json',
  'coverage-gap-report.json',
  'lounge-guru-catalog.json',
  'non-priority-lounge-candidates.json',
  'non-priority-validation-report.json',
  'source-intake-report.json',
  'source-registry.json',
];

async function listFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function validateUrl(value, trail, issues) {
  const rawValue = String(value ?? '');
  if (!rawValue) {
    return;
  }
  let parsed;
  try {
    parsed = rawValue.startsWith('/') ? new URL(rawValue, 'https://loungeguru.invalid') : new URL(rawValue);
  } catch {
    issues.push(`${trail}: invalid public URL`);
    return;
  }
  if (!rawValue.startsWith('/') && parsed.protocol !== 'https:') {
    issues.push(`${trail}: public URL must use HTTPS`);
  }
  for (const key of parsed.searchParams.keys()) {
    if (isSensitiveQueryName(key)) {
      issues.push(`${trail}: sensitive URL query parameter present`);
    }
  }
}

function validatePublicValue(value, trail, issues) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => validatePublicValue(item, `${trail}[${index}]`, issues));
    return;
  }
  if (!value || typeof value !== 'object') {
    return;
  }

  for (const [key, fieldValue] of Object.entries(value)) {
    const nextTrail = `${trail}.${key}`;
    if (isSensitiveFieldName(key)) {
      issues.push(`${nextTrail}: sensitive field must not be published`);
      continue;
    }
    if (typeof fieldValue === 'string' && /(?:url|uri|href|endpoint)$/i.test(key)) {
      validateUrl(fieldValue, nextTrail, issues);
    }
    validatePublicValue(fieldValue, nextTrail, issues);
  }
}

async function main() {
  const issues = [];
  const [payload, catalog] = await Promise.all(
    [publicPayloadPath, catalogPath].map(async (filePath) => JSON.parse(await fs.readFile(filePath, 'utf8'))),
  );

  if (payload.records?.length !== catalog.records?.length) {
    issues.push('lounge-map.json: record count differs from canonical catalog');
  }
  validatePublicValue(payload, 'lounge-map', issues);

  const serializedPayload = JSON.stringify(payload);
  const forbiddenTextPatterns = [
    /LOUNGE_GURU_INTAKE_TOKEN/i,
    /\bpseudo[ _-]?city(?:[ _-]?code)?\b/i,
    /\brecord[ _-]?locator\b/i,
    /\bgds[ _-]?(?:password|token|session|credential)\b/i,
  ];
  if (forbiddenTextPatterns.some((pattern) => pattern.test(serializedPayload))) {
    issues.push('lounge-map.json: GDS or intake credential metadata present');
  }

  const distFiles = await listFiles(distRoot);
  for (const filePath of distFiles) {
    const relativePath = path.relative(distRoot, filePath).split(path.sep).join('/');
    if (relativePath.startsWith('data/') && !allowedDistDataFile.test(relativePath)) {
      issues.push(`${relativePath}: file is not on the production data allowlist`);
    }
    if (relativePath.endsWith('.map')) {
      issues.push(`${relativePath}: source map must not be public`);
    }
    if (forbiddenArtifactNames.some((name) => relativePath.endsWith(name))) {
      issues.push(`${relativePath}: internal artifact must not be public`);
    }
  }

  if (issues.length > 0) {
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        publicRecords: payload.records.length,
        distFiles: distFiles.length,
        publicDataFiles: distFiles.filter((filePath) => path.relative(distRoot, filePath).startsWith('data/')).length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
