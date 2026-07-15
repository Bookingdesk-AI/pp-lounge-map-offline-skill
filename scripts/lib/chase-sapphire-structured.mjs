function decodeEntities(value) {
  return String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&ndash;|&#8211;/gi, '-')
    .replace(/&mdash;|&#8212;/gi, '-')
    .replace(/&#x27;|&#39;/gi, "'")
    .replace(/[–—]/g, '-');
}

function stripHtml(value) {
  return decodeEntities(String(value ?? '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function slugify(value) {
  return stripHtml(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

function parseNextData(html) {
  const match = String(html ?? '').match(/<script id=["']__NEXT_DATA__["'] type=["']application\/json["']>([\s\S]*?)<\/script>/i);
  if (!match) {
    return null;
  }
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function collectLocationCards(value, cards = []) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectLocationCards(item, cards);
    }
    return cards;
  }

  if (!value || typeof value !== 'object') {
    return cards;
  }

  const values = value.values;
  if (values?.bodyCopy && /\([A-Z0-9]{3}\)/.test(values.bodyCopy)) {
    cards.push({
      title: stripHtml(values.title),
      body: stripHtml(values.bodyCopy),
      url: values.links?.[0]?.url ?? '',
    });
  }

  for (const child of Object.values(value)) {
    collectLocationCards(child, cards);
  }
  return cards;
}

function parseTime(value) {
  const match = stripHtml(value)
    .toLowerCase()
    .match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?$/);
  if (!match) {
    return '';
  }
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  if (match[3] === 'p' && hour < 12) hour += 12;
  if (match[3] === 'a' && hour === 12) hour = 0;
  if (!Number.isFinite(hour) || hour > 23 || minute > 59) {
    return '';
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function dailyHoursFromText(text) {
  const match = stripHtml(text).match(
    /\b(\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?)\s*-\s*(\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?)\s+daily\b/i,
  );
  const opening = parseTime(match?.[1]);
  const closing = parseTime(match?.[2]);
  if (!opening || !closing) {
    return [];
  }
  return [1, 2, 3, 4, 5, 6, 0].map((day) => ({
    Day: day,
    OpeningHour: opening,
    ClosingHour: closing,
  }));
}

function nameFromCard(card) {
  const body = card.body;
  if (/The Etihad Lounge/i.test(card.title)) {
    return 'The Etihad Lounge';
  }
  if (/Sapphire Lounge by The Club with Etihad Airways/i.test(body)) {
    return 'Chase Sapphire Lounge by The Club with Etihad Airways';
  }
  return 'Chase Sapphire Lounge by The Club';
}

function terminalFromText(text) {
  return (
    stripHtml(text).match(/\bTerminal\s+[A-Z0-9](?:\/[A-Z0-9])?(?:\s+Connector)?\b/i)?.[0] ||
    stripHtml(text).match(/\bConcourse\s+[A-Z0-9]\b/i)?.[0] ||
    ''
  );
}

function sourceUrlFromCard(card, baseUrl) {
  if (!card.url) {
    return baseUrl;
  }
  try {
    return new URL(card.url, baseUrl).toString();
  } catch {
    return baseUrl;
  }
}

export function parseChaseSapphireLoungeRecords(html, { url = '' } = {}) {
  const data = parseNextData(html);
  if (!data) {
    return [];
  }

  const baseUrl = url || 'https://www.chase.com/sapphire-cards/lounges';
  const records = [];
  for (const card of collectLocationCards(data)) {
    const code = card.body.match(/\(([A-Z0-9]{3})\)/)?.[1] ?? '';
    const openHours = dailyHoursFromText(card.body);
    if (!/^[A-Z0-9]{3}$/.test(code) || openHours.length === 0 || /coming soon/i.test(card.body)) {
      continue;
    }

    const name = nameFromCard(card);
    const terminal = terminalFromText(card.body);
    records.push({
      sourceRecordId: `${code}-${slugify(name)}-${slugify(terminal || card.title)}`,
      name,
      brand: name === 'The Etihad Lounge' ? 'The Etihad Lounge' : 'Chase Sapphire Lounge by The Club',
      operator: name === 'The Etihad Lounge' ? 'The Etihad Lounge' : 'Chase Sapphire Lounge by The Club',
      airportCode: code,
      airportName: card.body.match(/(^| )([^.;|]+Airport)\s+\([A-Z0-9]{3}\)/i)?.[2] ?? `${code} Airport`,
      terminal,
      near: card.body,
      amenities: {
        WiFi: true,
        FoodBeverageSnackBuffet: true,
      },
      openHours,
      programs: ['Chase Sapphire Reserve'],
      accessNotes: 'Official Chase Sapphire lounge location, access, and published hours evidence.',
      sourceUrl: sourceUrlFromCard(card, baseUrl),
    });
  }

  const byId = new Map(records.map((record) => [record.sourceRecordId, record]));
  return [...byId.values()].sort((first, second) =>
    `${first.airportCode}-${first.name}`.localeCompare(`${second.airportCode}-${second.name}`),
  );
}
