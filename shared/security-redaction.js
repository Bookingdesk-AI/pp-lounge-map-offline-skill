const REDACTED = '[REDACTED]';

const SENSITIVE_KEY_NAMES = new Set([
  'accesstoken',
  'apikey',
  'applicationkey',
  'authorization',
  'authtoken',
  'bearertoken',
  'clientsecret',
  'cookie',
  'credential',
  'credentials',
  'epr',
  'gdscredential',
  'gdscredentials',
  'gdspassword',
  'gdssession',
  'gdstoken',
  'idtoken',
  'ipcc',
  'officeid',
  'password',
  'passwd',
  'pcc',
  'pnr',
  'privatekey',
  'pseudocity',
  'pseudocitycode',
  'pwd',
  'recordlocator',
  'refreshtoken',
  'secret',
  'sessionid',
  'sessiontoken',
  'setcookie',
  'sig',
  'signature',
  'signingkey',
]);

const SENSITIVE_QUERY_NAME = /(?:^|[_-])(?:api|app(?:lication)?|access|auth|bearer|client|id|refresh|session)?[_-]?(?:key|token|secret|signature|sig|password|passwd|pwd|credential|credentials)(?:$|[_-])/i;
const URL_KEY_NAME = /(?:url|uri|href|endpoint)$/i;

function normalizeKey(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function isSensitiveFieldName(value) {
  return SENSITIVE_KEY_NAMES.has(normalizeKey(value));
}

export function isSensitiveQueryName(value) {
  return SENSITIVE_QUERY_NAME.test(String(value ?? '')) || isSensitiveFieldName(value);
}

export function sanitizePublicUrl(value, options = {}) {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) {
    return '';
  }

  const allowRelative = options.allowRelative !== false;
  const allowedHosts = options.allowedHosts ? new Set(options.allowedHosts) : null;
  const isRelative = rawValue.startsWith('/') && !rawValue.startsWith('//') && !rawValue.includes('\\');
  let parsed;

  try {
    parsed = isRelative ? new URL(rawValue, 'https://loungeguru.invalid') : new URL(rawValue);
  } catch {
    return '';
  }

  if (isRelative) {
    if (!allowRelative || parsed.origin !== 'https://loungeguru.invalid') {
      return '';
    }
  } else {
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
      return '';
    }
    if (allowedHosts && !allowedHosts.has(parsed.hostname)) {
      return '';
    }
  }

  for (const key of [...parsed.searchParams.keys()]) {
    if (isSensitiveQueryName(key)) {
      parsed.searchParams.delete(key);
    }
  }
  if (/(?:token|secret|password|credential|signature|session|record[_-]?locator|pnr|pcc)/i.test(parsed.hash)) {
    parsed.hash = '';
  }

  return isRelative ? `${parsed.pathname}${parsed.search}${parsed.hash}` : parsed.toString();
}

export function redactSensitiveData(value, seen = new WeakSet()) {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item, seen));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  if (seen.has(value)) {
    return REDACTED;
  }

  seen.add(value);
  const result = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    if (isSensitiveFieldName(key)) {
      result[key] = REDACTED;
      continue;
    }
    if (typeof fieldValue === 'string' && (URL_KEY_NAME.test(key) || /^https?:\/\//i.test(fieldValue))) {
      result[key] = sanitizePublicUrl(fieldValue, { allowRelative: true });
      continue;
    }
    result[key] = redactSensitiveData(fieldValue, seen);
  }
  seen.delete(value);
  return result;
}

export const REDACTED_VALUE = REDACTED;
