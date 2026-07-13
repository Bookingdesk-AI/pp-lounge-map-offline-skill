export const BRAND_REGISTRY_VERSION = '2026-06-14';

const ALL_ROUTES_AIRLINE_LOGOS = {
  airFrance: 'https://src.desk.travel/brand-logos/airlines-transparent/af/a2207f1e1e6089f19602ce21b442c82e2ac3232ecb66758c3f0b1f9d84511f5f.png',
  klm: 'https://src.desk.travel/brand-logos/airlines-transparent/kl/a0220679b77ebc1a9eb4dea1b5dbbc0f3aec7487fcc9a83e89f8e67f66f596d8.png',
  britishAirways: 'https://src.desk.travel/brand-logos/airlines-transparent/ba/46b341955ba41a1246b1fafa9cfaf2fc1330d365c5da49a1e3ff0160642c4f72.png',
  alaskaAirlines: 'https://src.desk.travel/brand-logos/airlines-transparent/as/ca87b5a37b83fdb8160788a9f5fb5520c51f97deea59bff3a7ab137bbc3626ee.png',
  turkishAirlines: 'https://src.desk.travel/brand-logos/airlines-transparent/tk/702869063e8f60647bd3522fc304df4d883a4e8e0aa4086119f52ee6d49efdc2.png',
  etihad: 'https://src.desk.travel/brand-logos/airlines-transparent/ey/b2bba6ed6cfc15e6175bbdf6f437bcbbefd58d53eb2b38986df4943d549945cd.png',
  virginAtlantic: 'https://src.desk.travel/brand-logos/airlines-transparent/vs/a91132439095f49245fac26e4955b55e1f2c0929d67467b4c0181ebfd693dd2b.png',
  americanAirlines: 'https://src.desk.travel/brand-logos/airlines-transparent/aa/4202b514fdd42c1095dcb893bd16561fff88f9fcec364ea125e42a7bb4fe37b7.png',
  airCanada: 'https://src.desk.travel/brand-logos/airlines-transparent/ac/e431417f48b0f69a08bec2b65c0dcc2690b81df3aa6361162d94f426bdbc5286.png',
  united: 'https://src.desk.travel/brand-logos/airlines-transparent/ua/35f4283c767d3b2cafcc96d84c8fb988985a42734d2fc9905573c0c5721f7663.png',
  delta: 'https://src.desk.travel/brand-logos/airlines-transparent/dl/59191feeac8d3d59f2cfafbe67fd71edf18c4294d345c80fa356856b930d5c66.png',
};

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
    logoUrl: ALL_ROUTES_AIRLINE_LOGOS.united,
    logoText: 'UA',
    color: '#214f9f',
    background: '#eaf1fb',
    foreground: '#163f82',
    status: 'review',
    rightsNote: 'Airline logo served from all-routes centralized Cloudflare brand asset registry; official public United page supplies source context.',
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
    logoUrl: ALL_ROUTES_AIRLINE_LOGOS.delta,
    logoText: 'DL',
    color: '#8c2633',
    background: '#fff0f2',
    foreground: '#75202b',
    status: 'review',
    rightsNote: 'Airline logo served from all-routes centralized Cloudflare brand asset registry; official public Delta page supplies source context.',
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
    logoUrl: ALL_ROUTES_AIRLINE_LOGOS.americanAirlines,
    logoText: 'AA',
    color: '#2d5c87',
    background: '#eaf2f8',
    foreground: '#214967',
    status: 'review',
    rightsNote: 'Airline logo served from all-routes centralized Cloudflare brand asset registry; official public American Airlines page supplies source context.',
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
    logoUrl: ALL_ROUTES_AIRLINE_LOGOS.airCanada,
    logoText: 'AC',
    color: '#3f4650',
    background: '#eef1f4',
    foreground: '#303741',
    status: 'review',
    rightsNote: 'Airline logo served from all-routes centralized Cloudflare brand asset registry; official public Air Canada page supplies source context.',
  },
  {
    id: 'air-france-klm',
    name: 'Air France KLM',
    category: 'airline',
    aliases: ['air france klm', 'air france - klm', 'air france-klm', 'air france lounge', 'klm lounge'],
    sourceIds: ['priority-pass'],
    sourceUrl: 'https://wwws.airfrance.us/information/prepare/salons',
    assetSource: 'desk_travel_database',
    deskTravelAssetKey: 'all-routes:brand/air-france-klm',
    logoUrl: ALL_ROUTES_AIRLINE_LOGOS.airFrance,
    logoText: 'AF',
    color: '#1f4c84',
    background: '#edf3fb',
    foreground: '#173b68',
    status: 'review',
    rightsNote: 'Airline logo served from all-routes centralized Cloudflare brand asset registry; official public Air France lounge page supplies source context.',
  },
  {
    id: 'british-airways',
    name: 'British Airways',
    category: 'airline',
    aliases: ['british airways', 'ba lounge'],
    sourceIds: ['oneworld'],
    sourceUrl: 'https://www.britishairways.com/content/information/airport-information/lounges',
    assetSource: 'desk_travel_database',
    deskTravelAssetKey: 'all-routes:brand/british-airways',
    logoUrl: ALL_ROUTES_AIRLINE_LOGOS.britishAirways,
    logoText: 'BA',
    color: '#2e5c99',
    background: '#edf3fb',
    foreground: '#243f6a',
    status: 'review',
    rightsNote: 'Airline logo served from all-routes centralized Cloudflare brand asset registry; official public British Airways lounge page supplies source context.',
  },
  {
    id: 'alaska-airlines',
    name: 'Alaska Airlines',
    category: 'airline',
    aliases: ['alaska airlines', 'alaska lounge'],
    sourceIds: ['oneworld'],
    sourceUrl: 'https://www.alaskaair.com/content/airports/lounges',
    assetSource: 'desk_travel_database',
    deskTravelAssetKey: 'all-routes:brand/alaska-airlines',
    logoUrl: ALL_ROUTES_AIRLINE_LOGOS.alaskaAirlines,
    logoText: 'AS',
    color: '#245a7e',
    background: '#edf5f8',
    foreground: '#19435f',
    status: 'review',
    rightsNote: 'Airline logo served from all-routes centralized Cloudflare brand asset registry; official public Alaska Lounge page supplies source context.',
  },
  {
    id: 'oneworld',
    name: 'oneworld',
    category: 'alliance',
    aliases: ['oneworld', 'one world'],
    sourceIds: ['oneworld'],
    sourceUrl: 'https://www.oneworld.com/airport-lounges',
    assetSource: 'desk_travel_database',
    deskTravelAssetKey: 'desk-travel:brand/oneworld',
    logoUrl: '/data/brand-logos/oneworld.svg',
    logoText: 'OW',
    color: '#1f5d8f',
    background: '#edf4fb',
    foreground: '#1b4f78',
    status: 'review',
    rightsNote: 'Desk.Travel managed alliance mark; official public oneworld lounge page supplies source context.',
  },
  {
    id: 'star-alliance',
    name: 'Star Alliance',
    category: 'alliance',
    aliases: ['star alliance', 'star alliance gold', 'star alliance silver'],
    sourceIds: ['star-alliance'],
    sourceUrl: 'https://www.staralliance.com/en/lounge-finder',
    assetSource: 'desk_travel_database',
    deskTravelAssetKey: 'desk-travel:brand/star-alliance',
    logoUrl: '/data/brand-logos/star-alliance.svg',
    logoText: 'SA',
    color: '#2e343b',
    background: '#f1f3f5',
    foreground: '#2e343b',
    status: 'review',
    rightsNote: 'Desk.Travel managed alliance mark; official public Star Alliance lounge finder supplies source context.',
  },
  {
    id: 'skyteam',
    name: 'SkyTeam',
    category: 'alliance',
    aliases: ['skyteam', 'sky team', 'skyteam elite plus'],
    sourceIds: ['skyteam'],
    sourceUrl: 'https://www.skyteam.com/en/lounges',
    assetSource: 'desk_travel_database',
    deskTravelAssetKey: 'desk-travel:brand/skyteam',
    logoUrl: '/data/brand-logos/skyteam.svg',
    logoText: 'ST',
    color: '#315a93',
    background: '#edf2fb',
    foreground: '#244c82',
    status: 'review',
    rightsNote: 'Desk.Travel managed alliance mark; official public SkyTeam lounge page supplies source context.',
  },
  {
    id: 'turkish-airlines',
    name: 'Turkish Airlines',
    category: 'airline',
    aliases: ['turkish airlines', 'turkish airlines lounge', 'turkish lounge'],
    sourceIds: ['priority-pass', 'oneworld'],
    sourceUrl: 'https://www.turkishairlines.com/en-int/flights/fly-different/turkish-airlines-lounge/',
    assetSource: 'desk_travel_database',
    deskTravelAssetKey: 'all-routes:brand/turkish-airlines',
    logoUrl: ALL_ROUTES_AIRLINE_LOGOS.turkishAirlines,
    logoText: 'TK',
    color: '#b0182b',
    background: '#fff0f2',
    foreground: '#821626',
    status: 'review',
    rightsNote: 'Airline logo served from all-routes centralized Cloudflare brand asset registry; official public Turkish Airlines lounge page supplies source context.',
  },
  {
    id: 'etihad',
    name: 'Etihad',
    category: 'airline',
    aliases: ['etihad', 'etihad lounge', 'the etihad lounge'],
    sourceIds: ['priority-pass'],
    sourceUrl: 'https://www.etihad.com/en/fly-etihad/lounges',
    assetSource: 'desk_travel_database',
    deskTravelAssetKey: 'all-routes:brand/etihad',
    logoUrl: ALL_ROUTES_AIRLINE_LOGOS.etihad,
    logoText: 'EY',
    color: '#806744',
    background: '#f7f1e7',
    foreground: '#5c4a31',
    status: 'review',
    rightsNote: 'Airline logo served from all-routes centralized Cloudflare brand asset registry; official public Etihad lounge page supplies source context.',
  },
  {
    id: 'virgin-atlantic',
    name: 'Virgin Atlantic',
    category: 'airline',
    aliases: ['virgin atlantic', 'virgin atlantic clubhouse', 'clubhouse'],
    sourceIds: ['priority-pass'],
    sourceUrl: 'https://flywith.virginatlantic.com/us/en/upper-class-cabin-and-seats/clubhouse-airport-lounge.html',
    assetSource: 'desk_travel_database',
    deskTravelAssetKey: 'all-routes:brand/virgin-atlantic',
    logoUrl: ALL_ROUTES_AIRLINE_LOGOS.virginAtlantic,
    logoText: 'VS',
    color: '#b52635',
    background: '#fff0f2',
    foreground: '#861b28',
    status: 'review',
    rightsNote: 'Airline logo served from all-routes centralized Cloudflare brand asset registry; official public Virgin Atlantic Clubhouse page supplies source context.',
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
  const logoUrl = entry.logoUrl ?? `/data/brand-logos/${entry.id}.svg`;
  const fallbackLogoUrl =
    entry.fallbackLogoUrl ?? (logoUrl.startsWith('https://src.desk.travel/') ? `/data/brand-logos/${entry.id}.svg` : undefined);

  return {
    ...entry,
    logoUrl,
    ...(fallbackLogoUrl ? { fallbackLogoUrl } : {}),
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
  const candidates = values
    .map((value, index) => ({ value: normalize(value), index }))
    .filter((candidate) => candidate.value);
  const sourceFallbackIndex = Math.max(0, values.length - 1);
  let bestMatch = null;

  for (const brand of getBrandRegistry()) {
    for (const alias of brand.aliases.map(normalize).filter(Boolean)) {
      for (const candidate of candidates) {
        let score = 0;
        if (candidate.value === alias) {
          score = 100;
        } else if (candidate.value.includes(alias)) {
          score = 80 + Math.min(alias.length, 40) / 100;
        } else if (alias.includes(candidate.value)) {
          score = 30 + Math.min(candidate.value.length, 40) / 100;
        }

        if (score === 0) {
          continue;
        }

        if (candidate.index === sourceFallbackIndex) {
          score -= 60;
        }

        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { brand, score };
        }
      }
    }
  }

  return bestMatch?.brand ?? getBrandRegistry().find((brand) => brand.id === 'priority-pass');
}

export function createBrandLogoSvg(brand) {
  const normalized = normalizeEntry(brand);
  if (normalized.id === 'oneworld') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" role="img" aria-labelledby="title">
  <title id="title">oneworld</title>
  <rect width="96" height="96" rx="16" fill="#edf4fb"/>
  <circle cx="48" cy="48" r="28" fill="#fff" stroke="#1f5d8f" stroke-width="4"/>
  <circle cx="48" cy="48" r="17" fill="none" stroke="#7eb3dc" stroke-width="2"/>
  <path d="M29 48h38M48 29c7 7 10 13 10 19s-3 12-10 19M48 29c-7 7-10 13-10 19s3 12 10 19" fill="none" stroke="#1f5d8f" stroke-width="2.5" stroke-linecap="round"/>
  <text x="48" y="84" fill="#1b4f78" font-family="IBM Plex Sans, Arial, sans-serif" font-size="14" font-weight="750" text-anchor="middle" letter-spacing="0">OW</text>
</svg>
`;
  }
  if (normalized.id === 'star-alliance') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" role="img" aria-labelledby="title">
  <title id="title">Star Alliance</title>
  <rect width="96" height="96" rx="16" fill="#f1f3f5"/>
  <path d="M48 18l6.7 20.5h21.6L58.8 51.2l6.7 20.6L48 59.1 30.5 71.8l6.7-20.6-17.5-12.7h21.6z" fill="#fff" stroke="#2e343b" stroke-width="4" stroke-linejoin="round"/>
  <path d="M48 27l4.5 13.8H67L55.3 49.3l4.5 13.8L48 54.6l-11.8 8.5 4.5-13.8L29 40.8h14.5z" fill="#2e343b"/>
  <text x="48" y="84" fill="#2e343b" font-family="IBM Plex Sans, Arial, sans-serif" font-size="14" font-weight="750" text-anchor="middle" letter-spacing="0">SA</text>
</svg>
`;
  }
  if (normalized.id === 'skyteam') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" role="img" aria-labelledby="title">
  <title id="title">SkyTeam</title>
  <rect width="96" height="96" rx="16" fill="#edf2fb"/>
  <path d="M22 55c16-22 34-31 52-28-11 5-19 14-24 27 8-6 17-8 27-6-11 8-23 14-36 18-7 2-14 3-21 3 7-3 13-8 18-14-5 1-11 1-16 0z" fill="#fff" stroke="#315a93" stroke-width="4" stroke-linejoin="round"/>
  <path d="M36 57c13-7 24-16 33-27-4 10-7 19-8 28" fill="none" stroke="#79a7d8" stroke-width="3" stroke-linecap="round"/>
  <text x="48" y="84" fill="#244c82" font-family="IBM Plex Sans, Arial, sans-serif" font-size="14" font-weight="750" text-anchor="middle" letter-spacing="0">ST</text>
</svg>
`;
  }

  const accent = normalized.color;
  const background = normalized.background;
  const foreground = normalized.foreground;
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
  <rect width="96" height="96" rx="16" fill="${background}"/>
  <path d="M21 22h54v52H21z" fill="#fff" fill-opacity="0.86"/>
  <path d="M21 22h54v10H21z" fill="${accent}" fill-opacity="0.15"/>
  <path d="M28 66h40" stroke="${accent}" stroke-opacity="0.42" stroke-width="3" stroke-linecap="square"/>
  <text x="48" y="57" fill="${foreground}" font-family="IBM Plex Sans, Arial, sans-serif" font-size="25" font-weight="750" text-anchor="middle" letter-spacing="0">${text}</text>
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
      fallbackLogoUrl: brand.fallbackLogoUrl,
      logoText: brand.logoText,
      color: brand.color,
      background: brand.background,
      foreground: brand.foreground,
      status: brand.status,
      rightsNote: brand.rightsNote,
    })),
  };
}
