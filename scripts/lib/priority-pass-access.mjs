function clean(value) {
  return String(value ?? '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
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

export function parsePriorityPassStandardAccessPolicy(
  html,
  { url = 'https://www.prioritypass.com/en-GB/join-prioritypass' } = {},
) {
  const text = stripHtml(html);
  if (!/Airport Lounge Membership Plans/i.test(text) || !/Access to lounges is subject to space availability/i.test(text)) {
    return null;
  }

  const standardBlock = text.match(/\bSTANDARD\b([\s\S]{0,1600}?)\bSTANDARD PLUS\b/i)?.[1] ?? '';
  const memberFee = standardBlock.match(/US\$\s*([0-9]+(?:\.[0-9]+)?)\s+Member visit fee/i)?.[1];
  const guestFee = standardBlock.match(/US\$\s*([0-9]+(?:\.[0-9]+)?)\s+Guest visit fee/i)?.[1];
  if (!memberFee || !guestFee) {
    return null;
  }

  return {
    id: 'priority-pass-standard-access',
    product: 'priority-pass-lounge-access',
    sourceUrl: url,
    offers: [
      {
        type: 'member_visit_fee',
        label: 'Standard plan member visit',
        amount: Number(memberFee),
        currency: 'USD',
        sourceUrl: url,
      },
      {
        type: 'guest_fee',
        label: 'Standard plan guest visit',
        amount: Number(guestFee),
        currency: 'USD',
        sourceUrl: url,
      },
    ],
    restrictions: [
      'Direct Priority Pass Standard membership required.',
      'Access is subject to lounge space availability.',
    ],
    confidence: 0.99,
    rightsNote: 'Official public Priority Pass membership plan page.',
  };
}
