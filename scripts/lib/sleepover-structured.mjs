function decodeEntities(value) {
  return String(value ?? '')
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\\u0026/g, '&')
    .replace(/&ndash;|&#8211;/gi, '-')
    .replace(/&mdash;|&#8212;/gi, '-')
    .replace(/[–—]/g, '-');
}

function clean(value) {
  return decodeEntities(value).replace(/\s+/g, ' ').trim();
}

function stripHtml(value) {
  return clean(String(value ?? '').replace(/<[^>]+>/g, ' '));
}

function slugify(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

function canonicalUrl(html, fallbackUrl) {
  const match = String(html ?? '').match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  return clean(match?.[1]) || fallbackUrl;
}

function metaContent(html, nameOrProperty) {
  const escaped = nameOrProperty.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return clean(
    String(html ?? '').match(new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']*)["']`, 'i'))?.[1],
  );
}

function pageTitle(html) {
  return stripHtml(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
}

function sourceSlug(url) {
  try {
    return new URL(url).pathname.split('/').pop()?.toLowerCase() ?? '';
  } catch {
    return '';
  }
}

const AIRPORT_BY_SLUG = new Map([
  ['dubai-terminal-1-concourse-d', 'DXB'],
  ['dubai-terminal-3-concourse-a', 'DXB'],
  ['dubai-terminal-3-concourse-b', 'DXB'],
  ['dubai-terminal-3-concourse-c', 'DXB'],
  ['doha-south', 'DOH'],
  ['doha-north', 'DOH'],
  ['doh-north-node-c40', 'DOH'],
  ['lima-international-terminal', 'LIM'],
]);

function airportCode(html, url) {
  const text = `${pageTitle(html)} ${metaContent(html, 'description')} ${metaContent(html, 'keywords')}`;
  return clean(text).match(/\b(DXB|DOH|LIM)\b/i)?.[1]?.toUpperCase() || AIRPORT_BY_SLUG.get(sourceSlug(url)) || '';
}

function airportName(code) {
  return {
    DXB: 'Dubai International Airport',
    DOH: 'Hamad International Airport',
    LIM: 'Jorge Chavez International Airport',
  }[code] ?? `${code} Airport`;
}

function terminalAndNear(html, url) {
  const slug = sourceSlug(url);
  const title = pageTitle(html);
  const description = metaContent(html, 'description');
  const keywords = metaContent(html, 'keywords');
  const text = clean(`${title} ${description} ${keywords}`);

  if (slug === 'dubai-terminal-1-concourse-d') {
    return { terminal: 'Terminal 1', concourse: 'Concourse D', near: 'D-Gates' };
  }
  if (slug === 'dubai-terminal-3-concourse-a') {
    return { terminal: 'Terminal 3', concourse: 'Concourse A', near: 'A-Gates' };
  }
  if (slug === 'dubai-terminal-3-concourse-b') {
    return { terminal: 'Terminal 3', concourse: 'Concourse B', near: 'B-Gates' };
  }
  if (slug === 'dubai-terminal-3-concourse-c') {
    return { terminal: 'Terminal 3', concourse: 'Concourse C', near: 'C-Gates' };
  }
  if (slug === 'doha-north') {
    return { terminal: 'North Node', concourse: '', near: 'Gate C30' };
  }
  if (slug === 'doh-north-node-c40') {
    return { terminal: 'North Node', concourse: '', near: 'Gate C40' };
  }
  if (slug === 'doha-south') {
    return { terminal: 'South Node', concourse: '', near: 'South Node' };
  }
  if (slug === 'lima-international-terminal') {
    return { terminal: 'International & Domestic Terminal', concourse: '', near: 'Arrivals area' };
  }

  return {
    terminal: clean(text.match(/\bTerminal\s+[A-Z0-9]+/i)?.[0]),
    concourse: clean(text.match(/\bConcourse\s+[A-Z0-9]+\b/i)?.[0]),
    near: clean(text.match(/\b(?:Gate|Gates)\s+[A-Z0-9]+(?:\s*(?:and|&|-)\s*[A-Z0-9]+)?/i)?.[0]),
  };
}

function price(html) {
  const match = clean(html).match(/BOOK FROM \$([0-9]+(?:\.[0-9]{1,2})?)/i);
  if (!match) {
    return null;
  }
  const amount = Number(match[1]);
  return Number.isFinite(amount) && amount > 0 ? { amount, currencyCode: 'USD' } : null;
}

function openHours(html) {
  if (!/\bopen\s+24\s+hours\b/i.test(stripHtml(html))) {
    return [];
  }
  return [1, 2, 3, 4, 5, 6, 0].map((day) => ({
    Day: day,
    OpenAllDay: true,
  }));
}

function amenities(html) {
  const text = stripHtml(html).toLowerCase();
  const entries = [
    ['Sleeping pods', /\bsleeping pods?\b|\bsleep pods?\b/],
    ['Private rooms', /\bprivate rooms?\b|\brooms\b/],
    ['Cabins', /\bcabins?\b/],
    ['Showers', /\bshowers?\b/],
    ['Online booking', /\bbook online\b|\bbook from\b/],
  ];
  return Object.fromEntries(entries.filter(([, pattern]) => pattern.test(text)).map(([label]) => [label, true]));
}

function displayName(code, terminal, near) {
  const suffix = [terminal, near].filter(Boolean).join(' ');
  return suffix ? `Sleepover ${code} ${suffix}` : `Sleepover ${code}`;
}

export function parseSleepoverStructuredRecord(html, { url = '' } = {}) {
  const sourceUrl = canonicalUrl(html, url);
  const code = airportCode(html, sourceUrl);
  if (!/^[A-Z0-9]{3}$/.test(code)) {
    return null;
  }
  const location = terminalAndNear(html, sourceUrl);
  const terminal = clean(location.terminal);
  const near = clean(location.near);

  return {
    sourceRecordId: `${code}-${slugify(sourceSlug(sourceUrl) || `${terminal}-${near}`)}`,
    name: displayName(code, terminal, near),
    brand: 'Sleepover',
    operator: 'Sleepover',
    airportCode: code,
    airportName: airportName(code),
    terminal,
    concourse: clean(location.concourse),
    near,
    openHours: openHours(html),
    price: price(html),
    currencyCode: price(html)?.currencyCode,
    amenities: amenities(html),
    sourceUrl,
    accessNotes: 'Published terminal, gate/area, 24-hour access, amenities, and booking-from price from the official Sleepover page.',
  };
}
