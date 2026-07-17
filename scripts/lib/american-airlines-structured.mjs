function decodeEntities(value) {
  return String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&reg;/gi, '')
    .replace(/®/g, '')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, '-')
    .replace(/&mdash;|&#8212;/gi, '-')
    .replace(/[–—]/g, '-');
}

function clean(value) {
  return decodeEntities(value).replace(/\s+/g, ' ').trim();
}

function stripHtml(value) {
  return clean(
    String(value ?? '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  );
}

export function parseAdmiralsClubOneDayPass(html, { url = '' } = {}) {
  const text = stripHtml(html);
  const amount = Number(
    text.match(/\bOne-Day Pass\b[\s\S]{0,500}?\bfor\s+\$([0-9]+(?:\.[0-9]{1,2})?)/i)?.[1],
  );
  const eligibility = text.match(
    /Domestic and international Admirals Club[^.]*\(based on lounge capacity\)/i,
  )?.[0];
  const excludesClosed = /Excludes clubs that are currently closed/i.test(text);
  if (!Number.isFinite(amount) || amount <= 0 || !eligibility || !excludesClosed) {
    return null;
  }
  return {
    amount,
    currencyCode: 'USD',
    label: `USD ${amount} One-Day Pass`,
    sourceUrl: url,
    eligibility,
    excludesClosed: true,
  };
}

function slugify(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

function parseTime(value) {
  const normalized = clean(value).replace(/\./g, '').replace(/\s+/g, ' ');
  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (!match) {
    return '';
  }

  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const meridiem = match[3].toLowerCase();
  if (meridiem === 'pm' && hour < 12) {
    hour += 12;
  }
  if (meridiem === 'am' && hour === 12) {
    hour = 0;
  }
  if (!Number.isFinite(hour) || hour > 23 || !Number.isFinite(minute) || minute > 59) {
    return '';
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function dailyHours(opening, closing) {
  return [1, 2, 3, 4, 5, 6, 0].map((day) => ({
    Day: day,
    OpeningHour: opening,
    ClosingHour: closing,
  }));
}

function openHoursFromText(value) {
  const normalized = clean(value);
  const match = normalized.match(/(?:Daily:?\s*)?(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))/i);
  if (!match) {
    return [];
  }

  const opening = parseTime(match[1]);
  const closing = parseTime(match[2]);
  return opening && closing ? dailyHours(opening, closing) : [];
}

function airportFromPage(html) {
  const h1 = stripHtml(String(html ?? '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
  const match = h1.match(/\(([A-Z0-9]{3})\)/);
  return {
    airportCode: match?.[1] ?? '',
    airportName: clean(h1.replace(/\s*\([A-Z0-9]{3}\)\s*$/, '')),
  };
}

function terminalFromText(value) {
  const text = clean(value);
  return (
    text.match(/\bTerminal\s+[A-Z0-9](?:\/[A-Z0-9])?(?:\s*-\s*[^,]+)?/i)?.[0] ||
    text.match(/\bConcourse\s+[A-Z0-9](?:\/[A-Z0-9])?/i)?.[0] ||
    ''
  );
}

function amenitiesFromText(items) {
  const amenities = { Lounge: true };
  const text = items.join(' | ').toLowerCase();
  if (/wi-?fi/.test(text)) {
    amenities.WiFi = true;
  }
  if (/showers?/.test(text)) {
    amenities.Shower = true;
  }
  if (/food|snack|drink|bar/.test(text)) {
    amenities.FoodBeverageSnackBuffet = true;
  }
  if (/kids/.test(text)) {
    amenities.FamilyRoom = true;
  }
  if (/conference|business/.test(text)) {
    amenities.BusinessCenter = true;
  }
  return amenities;
}

function sectionBlocks(html) {
  const blocks = [];
  const regex = /<h2>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2>|<section class="section">|<\/section>|$)/gi;
  for (const match of String(html ?? '').matchAll(regex)) {
    const title = stripHtml(match[1]);
    if (!/(Admirals Club|premium lounges?|Flagship)/i.test(title)) {
      continue;
    }
    blocks.push({
      title,
      html: match[2],
    });
  }
  return blocks;
}

function fieldText(blockHtml, heading) {
  const match = String(blockHtml ?? '').match(
    new RegExp(`<h3>${heading}<\\/h3>\\s*<p>([\\s\\S]*?)<\\/p>`, 'i'),
  );
  return stripHtml(match?.[1]);
}

function amenityItems(blockHtml) {
  const amenityBlock = String(blockHtml ?? '').match(/<h3>Amenities<\/h3>\s*<ul[^>]*>([\s\S]*?)<\/ul>/i)?.[1] ?? '';
  return [...amenityBlock.matchAll(/<li>([\s\S]*?)<\/li>/gi)].map((match) => stripHtml(match[1])).filter(Boolean);
}

export function parseAmericanAirlinesClubRecords(html, { url = '' } = {}) {
  const { airportCode, airportName } = airportFromPage(html);
  if (!/^[A-Z0-9]{3}$/.test(airportCode)) {
    return [];
  }

  const records = [];
  for (const block of sectionBlocks(html)) {
    const location = fieldText(block.html, 'Location');
    const hoursText = fieldText(block.html, 'Hours');
    const amenities = amenityItems(block.html);
    const terminal = terminalFromText(block.title) || terminalFromText(location);
    const openHours = openHoursFromText(hoursText);
    if (!terminal || openHours.length === 0) {
      continue;
    }

    records.push({
      sourceRecordId: `american-${airportCode.toLowerCase()}-${slugify(block.title)}-${slugify(location)}`,
      name: block.title,
      brand: block.title.includes('premium') ? 'American Airlines premium lounges' : 'American Airlines Admirals Club',
      operator: 'American Airlines',
      airportCode,
      airportName,
      terminal,
      near: location,
      sourceUrl: url,
      programs: block.title.includes('premium') ? ['Flagship Lounge', 'Premium cabin'] : ['Admirals Club'],
      openHours,
      amenities: amenitiesFromText(amenities),
      accessNotes: 'Published by the official American Airlines airport club page.',
    });
  }

  return records;
}
