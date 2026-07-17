function clean(value) {
  return String(value ?? '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
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

export function parseAmexDeltaSkyClubAccessPolicy(
  html,
  { url = 'https://global.americanexpress.com/card-benefits/detail/delta-sky-club-access/delta-reserve-business' } = {},
) {
  const text = stripHtml(html);
  if (
    !/Delta Sky Club Access/i.test(text) ||
    !/Benefit valid only at Delta Sky Club\. Partner lounges are not included\./i.test(text) ||
    !/Once all 15 Visits have been used/i.test(text)
  ) {
    return null;
  }

  const additionalVisit = text.match(
    /purchase additional Delta Sky Club Visits at a per-Visit rate of \$([0-9]+(?:\.[0-9]+)?) per person/i,
  )?.[1];
  const guestVisit = text.match(
    /bring either up to two \(2\) guests, or their immediate family[^.]*?at a per-Visit rate of \$([0-9]+(?:\.[0-9]+)?) per person/i,
  )?.[1];
  if (!additionalVisit || !guestVisit || Number(additionalVisit) !== Number(guestVisit)) {
    return null;
  }

  return {
    id: 'amex-delta-sky-club-access',
    product: 'delta-sky-club',
    sourceUrl: url,
    offers: [
      {
        type: 'guest_fee',
        label: 'Eligible guest or additional visit',
        amount: Number(guestVisit),
        currency: 'USD',
        sourceUrl: url,
      },
    ],
    restrictions: [
      'Delta SkyMiles Reserve Business American Express eligibility required.',
      'Same-day eligible Delta travel required.',
      'Partner lounges are excluded.',
    ],
    confidence: 0.98,
    rightsNote: 'Official public American Express Delta Sky Club benefit terms.',
  };
}
