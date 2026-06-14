export const BRAND_REGISTRY_VERSION = '2026-06-14';

export const BRAND_REGISTRY = [
  {
    id: 'desk-travel',
    name: 'Desk.Travel',
    category: 'aggregator',
    aliases: ['desk.travel', 'desk travel'],
    sourceIds: ['desk-travel-brand-database'],
    sourceUrl: 'https://desk.travel/',
    assetSource: 'desk_travel_database',
    deskTravelAssetKey: 'desk-travel:brand/desk-travel',
    logoText: 'DT',
    color: '#2456a6',
    background: '#eaf1fb',
    foreground: '#163f82',
    status: 'approved',
    rightsNote: 'Internal Desk.Travel brand asset registry owner mark.',
  },
  {
    id: 'priority-pass',
    name: 'Priority Pass',
    category: 'program',
    aliases: ['priority pass'],
    sourceIds: ['priority-pass'],
    sourceUrl: 'https://www.prioritypass.com/en-GB/airport-lounges',
    assetSource: 'desk_travel_database',
    deskTravelAssetKey: 'desk-travel:brand/priority-pass',
    logoText: 'PP',
    color: '#214f9f',
    background: '#eaf1fb',
    foreground: '#163f82',
    status: 'approved',
    rightsNote: 'Desk.Travel managed brand asset; source mapping uses official public program page.',
  },
  {
    id: 'chase-sapphire',
    name: 'Chase Sapphire',
    category: 'issuer',
    aliases: ['chase sapphire', 'sapphire lounge'],
    sourceIds: ['chase-sapphire'],
    sourceUrl: 'https://account.chase.com/sapphire-airport-lounge',
    assetSource: 'desk_travel_database',
    deskTravelAssetKey: 'desk-travel:brand/chase-sapphire',
    logoText: 'CS',
    color: '#0c3f78',
    background: '#e8f0fb',
    foreground: '#0c3f78',
    status: 'review',
    rightsNote: 'Desk.Travel managed brand asset; official public Chase page supplies source context.',
  },
  {
    id: 'american-express',
    name: 'American Express',
    category: 'issuer',
    aliases: ['american express', 'amex', 'centurion'],
    sourceIds: ['amex-global-lounge-collection'],
    sourceUrl: 'https://global.americanexpress.com/lounge-access/the-platinum-card',
    assetSource: 'desk_travel_database',
    deskTravelAssetKey: 'desk-travel:brand/american-express',
    logoText: 'AX',
    color: '#1f5f9f',
    background: '#e8f3fb',
    foreground: '#164b7a',
    status: 'review',
    rightsNote: 'Desk.Travel managed brand asset; official public Amex page supplies source context.',
  },
  {
    id: 'capital-one',
    name: 'Capital One',
    category: 'issuer',
    aliases: ['capital one'],
    sourceIds: ['capital-one'],
    sourceUrl: 'https://www.capitalone.com/learn-grow/more-than-money/capital-one-lounges-arriving-in-airports/',
    assetSource: 'desk_travel_database',
    deskTravelAssetKey: 'desk-travel:brand/capital-one',
    logoText: 'CO',
    color: '#244f7a',
    background: '#eaf2f8',
    foreground: '#1f405f',
    status: 'review',
    rightsNote: 'Desk.Travel managed brand asset; official public Capital One page supplies source context.',
  },
  {
    id: 'visa-airport-companion',
    name: 'Visa Airport Companion',
    category: 'card_network',
    aliases: ['visa airport companion', 'visa'],
    sourceIds: ['visa-airport-companion'],
    sourceUrl: 'https://www.visaairportcompanion.com/',
    assetSource: 'desk_travel_database',
    deskTravelAssetKey: 'desk-travel:brand/visa-airport-companion',
    logoText: 'VI',
    color: '#1f4a8a',
    background: '#edf3fb',
    foreground: '#173b70',
    status: 'candidate',
    rightsNote: 'Desk.Travel managed brand asset; official public Visa program page supplies source context.',
  },
  {
    id: 'mastercard-travel-pass',
    name: 'Mastercard Travel Pass',
    category: 'card_network',
    aliases: ['mastercard travel pass', 'mastercard airport experiences', 'loungekey'],
    sourceIds: ['mastercard-travel-pass'],
    sourceUrl: 'https://mastercardtravelpass.dragonpass.com/',
    assetSource: 'desk_travel_database',
    deskTravelAssetKey: 'desk-travel:brand/mastercard-travel-pass',
    logoText: 'MC',
    color: '#9b3f1d',
    background: '#fff0e7',
    foreground: '#7b3217',
    status: 'candidate',
    rightsNote: 'Desk.Travel managed brand asset; official public Mastercard/DragonPass page supplies source context.',
  },
  {
    id: 'citi',
    name: 'Citi',
    category: 'issuer',
    aliases: ['citi', 'citi strata'],
    sourceIds: ['citi-travel'],
    sourceUrl: 'https://www.cititravel.com/',
    assetSource: 'desk_travel_database',
    deskTravelAssetKey: 'desk-travel:brand/citi',
    logoText: 'CT',
    color: '#1d5790',
    background: '#eaf2fb',
    foreground: '#174774',
    status: 'candidate',
    rightsNote: 'Desk.Travel managed brand asset; official public Citi travel page supplies source context.',
  },
  {
    id: 'dragonpass',
    name: 'DragonPass',
    category: 'aggregator',
    aliases: ['dragonpass'],
    sourceIds: ['dragonpass'],
    sourceUrl: 'https://en.dragonpass.com.cn/',
    assetSource: 'desk_travel_database',
    deskTravelAssetKey: 'desk-travel:brand/dragonpass',
    logoText: 'DP',
    color: '#9d2f2f',
    background: '#fff0f0',
    foreground: '#822626',
    status: 'candidate',
    rightsNote: 'Desk.Travel managed brand asset; official public DragonPass page supplies source context.',
  },
  {
    id: 'united',
    name: 'United',
    category: 'airline',
    aliases: ['united', 'united club', 'united polaris'],
    sourceIds: ['united'],
    sourceUrl: 'https://www.united.com/en/us/fly/travel/airport/united-club-and-lounge-locations.html',
    assetSource: 'desk_travel_database',
    deskTravelAssetKey: 'desk-travel:brand/united',
    logoText: 'UA',
    color: '#214f9f',
    background: '#eaf1fb',
    foreground: '#163f82',
    status: 'review',
    rightsNote: 'Desk.Travel managed brand asset; official public United page supplies source context.',
  },
  {
    id: 'delta',
    name: 'Delta',
    category: 'airline',
    aliases: ['delta', 'sky club'],
    sourceIds: ['delta'],
    sourceUrl: 'https://www.delta.com/us/en/delta-sky-club/locations',
    assetSource: 'desk_travel_database',
    deskTravelAssetKey: 'desk-travel:brand/delta',
    logoText: 'DL',
    color: '#8c2633',
    background: '#fff0f2',
    foreground: '#75202b',
    status: 'review',
    rightsNote: 'Desk.Travel managed brand asset; official public Delta page supplies source context.',
  },
  {
    id: 'american-airlines',
    name: 'American Airlines',
    category: 'airline',
    aliases: ['american airlines', 'admirals club'],
    sourceIds: ['american'],
    sourceUrl: 'https://www.aa.com/i18n/travel-info/clubs/admirals-club-locations.jsp',
    assetSource: 'desk_travel_database',
    deskTravelAssetKey: 'desk-travel:brand/american-airlines',
    logoText: 'AA',
    color: '#2d5c87',
    background: '#eaf2f8',
    foreground: '#214967',
    status: 'review',
    rightsNote: 'Desk.Travel managed brand asset; official public American Airlines page supplies source context.',
  },
  {
    id: 'air-canada',
    name: 'Air Canada',
    category: 'airline',
    aliases: ['air canada', 'maple leaf'],
    sourceIds: ['air-canada'],
    sourceUrl: 'https://www.aircanada.com/ca/en/aco/home/fly/premium-services/maple-leaf-lounges.html',
    assetSource: 'desk_travel_database',
    deskTravelAssetKey: 'desk-travel:brand/air-canada',
    logoText: 'AC',
    color: '#3f4650',
    background: '#eef1f4',
    foreground: '#303741',
    status: 'review',
    rightsNote: 'Desk.Travel managed brand asset; official public Air Canada page supplies source context.',
  },
  {
    id: 'plaza-premium',
    name: 'Plaza Premium',
    category: 'operator',
    aliases: ['plaza premium'],
    sourceIds: ['plaza-premium'],
    sourceUrl: 'https://www.plazapremiumlounge.com/en-uk',
    assetSource: 'desk_travel_database',
    deskTravelAssetKey: 'desk-travel:brand/plaza-premium',
    logoText: 'PL',
    color: '#846229',
    background: '#f8f1e4',
    foreground: '#694d1f',
    status: 'review',
    rightsNote: 'Desk.Travel managed brand asset; official public Plaza Premium page supplies source context.',
  },
  {
    id: 'escape-lounges',
    name: 'Escape Lounges',
    category: 'operator',
    aliases: ['escape lounges', 'escape'],
    sourceIds: ['escape-lounges'],
    sourceUrl: 'https://escapelounges.com/',
    assetSource: 'desk_travel_database',
    deskTravelAssetKey: 'desk-travel:brand/escape-lounges',
    logoText: 'ES',
    color: '#487267',
    background: '#eaf4f1',
    foreground: '#365a51',
    status: 'review',
    rightsNote: 'Desk.Travel managed brand asset; official public Escape page supplies source context.',
  },
  {
    id: 'airport-dimensions',
    name: 'Airport Dimensions',
    category: 'operator',
    aliases: ['airport dimensions', 'the club'],
    sourceIds: ['airport-dimensions'],
    sourceUrl: 'https://www.airportdimensions.com/locations',
    assetSource: 'desk_travel_database',
    deskTravelAssetKey: 'desk-travel:brand/airport-dimensions',
    logoText: 'AD',
    color: '#5b6372',
    background: '#eef1f6',
    foreground: '#424a58',
    status: 'review',
    rightsNote: 'Desk.Travel managed brand asset; official public Airport Dimensions page supplies source context.',
  },
  {
    id: 'aspire',
    name: 'Aspire',
    category: 'operator',
    aliases: ['aspire'],
    sourceIds: ['priority-pass'],
    sourceUrl: 'https://www.prioritypass.com/en-GB/airport-lounges',
    assetSource: 'desk_travel_database',
    deskTravelAssetKey: 'desk-travel:brand/aspire',
    logoText: 'AS',
    color: '#4f6f8a',
    background: '#edf3f7',
    foreground: '#3e5870',
    status: 'approved',
    rightsNote: 'Desk.Travel managed brand asset; Priority Pass record supplies source context.',
  },
  {
    id: 'marhaba',
    name: 'Marhaba',
    category: 'operator',
    aliases: ['marhaba'],
    sourceIds: ['priority-pass'],
    sourceUrl: 'https://www.prioritypass.com/en-GB/airport-lounges',
    assetSource: 'desk_travel_database',
    deskTravelAssetKey: 'desk-travel:brand/marhaba',
    logoText: 'MH',
    color: '#7d6542',
    background: '#f7f1e8',
    foreground: '#604d33',
    status: 'approved',
    rightsNote: 'Desk.Travel managed brand asset; Priority Pass record supplies source context.',
  },
  {
    id: 'primeclass',
    name: 'Primeclass',
    category: 'operator',
    aliases: ['primeclass'],
    sourceIds: ['priority-pass'],
    sourceUrl: 'https://www.prioritypass.com/en-GB/airport-lounges',
    assetSource: 'desk_travel_database',
    deskTravelAssetKey: 'desk-travel:brand/primeclass',
    logoText: 'PC',
    color: '#6b5f7d',
    background: '#f0edf6',
    foreground: '#514760',
    status: 'approved',
    rightsNote: 'Desk.Travel managed brand asset; Priority Pass record supplies source context.',
  },
  {
    id: 'be-relax',
    name: 'Be Relax',
    category: 'operator',
    aliases: ['be relax'],
    sourceIds: ['priority-pass'],
    sourceUrl: 'https://www.prioritypass.com/en-GB/airport-lounges',
    assetSource: 'desk_travel_database',
    deskTravelAssetKey: 'desk-travel:brand/be-relax',
    logoText: 'BR',
    color: '#4c746e',
    background: '#eaf4f2',
    foreground: '#365952',
    status: 'approved',
    rightsNote: 'Desk.Travel managed brand asset; Priority Pass record supplies source context.',
  },
];

function normalize(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeEntry(entry) {
  return {
    ...entry,
    logoUrl: `/data/brand-logos/${entry.id}.svg`,
    aliases: [...new Set([entry.name, ...(entry.aliases ?? [])])],
  };
}

export function getBrandRegistry() {
  return BRAND_REGISTRY.map(normalizeEntry);
}

export function getBrandIdsForSource(sourceId) {
  return getBrandRegistry()
    .filter((brand) => brand.sourceIds.includes(sourceId))
    .map((brand) => brand.id);
}

export function resolveBrandAsset(...values) {
  const candidates = values.map(normalize).filter(Boolean);
  const match = getBrandRegistry().find((brand) => {
    const aliases = brand.aliases.map(normalize);
    return candidates.some((candidate) =>
      aliases.some((alias) => candidate === alias || candidate.includes(alias) || alias.includes(candidate)),
    );
  });

  return match ?? getBrandRegistry().find((brand) => brand.id === 'priority-pass');
}

export function createBrandLogoSvg(brand) {
  const normalized = normalizeEntry(brand);
  const title = normalized.name
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const text = normalized.logoText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" role="img" aria-labelledby="title">
  <title id="title">${title}</title>
  <rect width="96" height="96" rx="18" fill="${normalized.background}"/>
  <rect x="13" y="13" width="70" height="70" rx="13" fill="#ffffff" stroke="${normalized.color}" stroke-opacity="0.28" stroke-width="2"/>
  <text x="48" y="55" fill="${normalized.foreground}" font-family="IBM Plex Sans, Arial, sans-serif" font-size="25" font-weight="700" text-anchor="middle" letter-spacing="0">${text}</text>
</svg>
`;
}

export function createDeskTravelBrandImport({ generatedAt = new Date().toISOString() } = {}) {
  return {
    generatedAt,
    target: 'desk.travel.brand_assets',
    mode: 'upsert',
    version: BRAND_REGISTRY_VERSION,
    records: getBrandRegistry().map((brand) => ({
      id: brand.id,
      name: brand.name,
      category: brand.category,
      sourceIds: brand.sourceIds,
      sourceUrl: brand.sourceUrl,
      assetSource: brand.assetSource,
      deskTravelAssetKey: brand.deskTravelAssetKey,
      logoUrl: brand.logoUrl,
      logoText: brand.logoText,
      color: brand.color,
      background: brand.background,
      foreground: brand.foreground,
      status: brand.status,
      rightsNote: brand.rightsNote,
    })),
  };
}
