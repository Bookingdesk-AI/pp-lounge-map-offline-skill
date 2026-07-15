export const BRAND_REGISTRY_VERSION = '2026-06-14';

const ALL_ROUTES_AIRLINE_LOGOS = {
  airFrance: 'https://src.desk.travel/brand-logos/airlines/af/cbeb6be04f34804fab3ef70f693e327a89e585f5d5cac71d46d440b025f64b45.png',
  klm: 'https://src.desk.travel/brand-logos/airlines/kl/9705f0a54ada349772d4273c5410ddfc4169368d0200ee12405aaa1f95e42239.png',
  britishAirways: 'https://src.desk.travel/brand-logos/airlines/ba/dc888a2fd20ec9a13b1b351b80ba6a15fc5ee594be3aa7989eff853b9c223c0c.png',
  alaskaAirlines: 'https://src.desk.travel/brand-logos/airlines/as/d56df15f3de2cc403df2cd362dd2aa493fe9b1ebc0bba7df7287c35c3bbebd90.png',
  turkishAirlines: 'https://src.desk.travel/brand-logos/airlines/tk/d918bc77b041b60237f344baec32c0079315f80ee7aaab9502223aed6ab0267f.png',
  etihad: 'https://src.desk.travel/brand-logos/airlines/ey/c4a5a0c77c7912407527681a323eae8a33dd5d42cb2769f58eeb95ec496de318.png',
  virginAtlantic: 'https://src.desk.travel/brand-logos/airlines/vs/dfa73a5ce0af91e4549d01ce9e744bd206c12304ba24b3116005fd160b84d002.png',
  americanAirlines: 'https://src.desk.travel/brand-logos/airlines/aa/c3439801cc68a08ffc86a37114a0c0ad6dfb107013efb1118f07c63916da3fb0.png',
  airCanada: 'https://src.desk.travel/brand-logos/airlines/ac/948862caca0e382379b723f702a61af52127e077e0f945e66010ffb61215a4aa.png',
  united: 'https://src.desk.travel/brand-logos/airlines/ua/cb08c08144d7cf0a87a88705e8605f9e15ff834cdca073f084a4e4a909fc874a.png',
  delta: 'https://src.desk.travel/brand-logos/airlines/dl/1334164f829a738ea8d1155e6e16d90916eb2a40c690d303e3a23f945f47dd24.png',
  singaporeAirlines: 'https://src.desk.travel/brand-logos/airlines/sq/dfc1c24153712b5206ddbb6604836162388ffc9e72ee5d318259730da920daf8.png',
  qatarAirways: 'https://src.desk.travel/brand-logos/airlines/qr/5a8f23f6e472cb2e0f716fda8e8ee975843cd971068c2cb69d0183d001424471.png',
  qantas: 'https://src.desk.travel/brand-logos/airlines/qf/10278afc63bc5ad3192ecfae966fa2072c1a5a0f0f4be38b27fdf818bd20a9ea.png',
  cathayPacific: 'https://src.desk.travel/brand-logos/airlines/cx/3c044030aff698c5b677d274079a55a6018d44d7ca263cc8b38101bbd39a5f8b.png',
  japanAirlines: 'https://src.desk.travel/brand-logos/airlines/jl/21ea30a4c17b00f302c74c26cf46ad0189255fc732cee5c44e5b0117071c8127.png',
  malaysiaAirlines: 'https://src.desk.travel/brand-logos/airlines/mh/d781700b96073790a7cb3a62f08cc8e552b0eeb81e939cebc9518ff6ad37fd06.png',
  finnair: 'https://src.desk.travel/brand-logos/airlines/ay/c87849b263dad1a267beb2440d18790f6bad23839f96f95cf21c8044c100f391.png',
  iberia: 'https://src.desk.travel/brand-logos/airlines/ib/6c6066e240cf46738f01c71943eaa0b4e1fdb05edf42f78ac7a7eb5c7074d4b5.png',
  royalJordanian: 'https://src.desk.travel/brand-logos/airlines/rj/29076f7bee3036adc0a5f1f20d6df4582a0817a107c3fc90036c6151ea128702.png',
  fijiAirways: 'https://src.desk.travel/brand-logos/airlines/fj/06b7da5f63439998a9c73c9bd992b281d1ed952859885b552c363b3ba6083bd1.png',
  omanAir: 'https://src.desk.travel/brand-logos/airlines/wy/d3eca4c49a93bcb6b0f6f046ab08640b9a4f03f520e5a28e54e62548c3552b08.png',
  latamAirlines: 'https://src.desk.travel/brand-logos/airlines/la/5383a8a5b07c90d0efba617139a787728cfa453e840631a4335d909d3c7f2dd2.png',
  royalAirMaroc: 'https://src.desk.travel/brand-logos/airlines/at/4da3e7274ed7e94f1f5625e58a11b1febd2a5cef8c295e45fceb2f923e7caa04.png',
  sriLankan: 'https://src.desk.travel/brand-logos/airlines/ul/5ee336aca3b476d4b517340eda611163cb65a88bb8e553fbd0a1491ace532e2b.png',
};

const ALL_ROUTES_AIRLINE_LOGO_BACKUPS = {
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
  singaporeAirlines: 'https://src.desk.travel/brand-logos/airlines-transparent/sq/64e86a3a01ed310445daec5d4b51350350513b65a4cf1705277bd2724887d403.png',
  qatarAirways: 'https://src.desk.travel/brand-logos/airlines-transparent/qr/bb207913044d70cce632574255bacef97abbb243b1380453e0c189715f4c32be.png',
  qantas: 'https://src.desk.travel/brand-logos/airlines-transparent/qf/7668c520fe78b8dba00927e04958b4ca10e45395c72ac7191e92b518fed08d90.png',
  cathayPacific: 'https://src.desk.travel/brand-logos/airlines-transparent/cx/b0b9bd787e58c061ed660471eb152f8025339b49ddbb400e8a77d32b42a6dd5e.png',
  japanAirlines: 'https://src.desk.travel/brand-logos/airlines-transparent/jl/22566cc64cf902f0a4b75ae1f3e9d71dc5aff51b3c06664634041d05d60029a8.png',
  malaysiaAirlines: 'https://src.desk.travel/brand-logos/airlines-transparent/mh/bebea71eed2c768ea02b0ebd4e4f76ee85cb5f3b86b10bd0387cc5538ee51008.png',
  finnair: 'https://src.desk.travel/brand-logos/airlines-transparent/ay/cb1c2bd5508658dc0170f0af57e82d22755aa2256fd256846c9a879b947a2bb0.png',
  iberia: 'https://src.desk.travel/brand-logos/airlines-transparent/ib/460df199cf74f871d1b22a584c0997d66159485bb626852053871d4fe6f6f93c.png',
  royalJordanian: 'https://src.desk.travel/brand-logos/airlines-transparent/rj/ac4574cc63b2d10992e0f8fe2b299ba1c8f1b13f2bcff7658243d0a8fcefd052.png',
  fijiAirways: 'https://src.desk.travel/brand-logos/airlines-transparent/fj/9a2be86f2d8689c5efa34cc0dfab7b440af3d40a106651896496db7ef3944216.png',
  omanAir: 'https://src.desk.travel/brand-logos/airlines-transparent/wy/12672ee2508d241f07ec033924ed8d4642bf1e98270614f67b078c4ff45e5183.png',
  latamAirlines: 'https://src.desk.travel/brand-logos/airlines-transparent/la/79dae2db7f5379aeadb7a969b9977b3d45c99e00a0fb0c732e40e63002cb3461.png',
  royalAirMaroc: 'https://src.desk.travel/brand-logos/airlines-transparent/at/c400d34c83aca3ff0df7d071ea54091e0653e118cc7d0e15014795ddaf33b3c4.png',
  sriLankan: 'https://src.desk.travel/brand-logos/airlines-transparent/ul/f3a7ef34cd21477127d080a8baa95d5eb5e8905a25a5ac7604800774ee927077.png',
};

const ALL_ROUTES_ALLIANCE_UPSTREAM_LOGOS = {
  oneworld: 'https://all-routes.desk.travel/brand-logos/alliances/oneworld.svg',
  starAlliance: 'https://all-routes.desk.travel/brand-logos/alliances/star-alliance.svg',
  skyteam: 'https://all-routes.desk.travel/brand-logos/alliances/skyteam.png',
};

const ALL_ROUTES_ALLIANCE_LOGOS = {
  oneworld: '/data/brand-logos/oneworld-all-routes.svg',
  starAlliance: '/data/brand-logos/star-alliance-all-routes.svg',
  skyteam: '/data/brand-logos/skyteam-all-routes.png',
};

const REVIEWED_BRAND_LOGOS = {
  priorityPass: {
    logoUrl: '/data/brand-logos/priority-pass-reviewed.svg',
    upstreamLogoUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/77/Priority_Pass_logo.svg',
  },
  chaseSapphire: {
    logoUrl: '/data/brand-logos/chase-sapphire-lounge-reviewed.png',
    upstreamLogoUrl:
      'https://runway-media-production.global.ssl.fastly.net/us/originals/2021/08/SapphireLoungeTheClub-Logo-FullColor-Digital-Large.jpg',
  },
  centurionLounge: {
    logoUrl: '/data/brand-logos/centurion-lounge-reviewed.png',
    upstreamLogoUrl:
      'https://cdn.prod.website-files.com/64146bf94f70d00b60750876/654172fed0b1988b98ff1c18_35-352052_american-express-centurion-lounge-logo-hd-png-download%20(4).png',
  },
  capitalOneTravel: {
    logoUrl: '/data/brand-logos/capital-one-travel-reviewed.svg',
    upstreamLogoUrl:
      'https://images.contentstack.io/v3/assets/blt1788ad84f88b68a8/bltfb0a779302eedf93/61660dc8a8d4d0113d89bb04/COT_logo.svg',
  },
  loungeKey: {
    logoUrl: '/data/brand-logos/loungekey-reviewed.png',
    upstreamLogoUrl: 'https://portal.loungekey.com/media/1020/lounge-kye-logo.png',
  },
  plazaPremium: {
    logoUrl: '/data/brand-logos/plaza-premium-reviewed.png',
    upstreamLogoUrl:
      'https://www.plazapremiumlounge.com/getContentAsset/7142b141-fd02-452d-919e-4a47a788a792/341dd76e-3aed-4a04-aa89-d958c5c0d319/PPL_logo.png?language=en-uk',
  },
};

const ONEWORLD_MEMBER_AIRLINE_BRANDS = [
  {
    id: 'cathay-pacific',
    name: 'Cathay Pacific',
    aliases: ['cathay pacific', 'cathay pacific lounge', 'the bridge', 'the deck', 'the pier', 'the wing'],
    sourceUrl: 'https://www.cathaypacific.com/cx/en_US/flying-with-us/airport-lounges.html',
    assetKey: 'cathayPacific',
    logoText: 'CX',
    color: '#245f57',
    background: '#eaf5f2',
    foreground: '#17483f',
  },
  {
    id: 'japan-airlines',
    name: 'Japan Airlines',
    aliases: ['japan airlines', 'jal', 'jal sakura', 'sakura lounge', 'japan airlines sakura lounge'],
    sourceUrl: 'https://www.jal.co.jp/ar/en/inter/service/lounge/',
    assetKey: 'japanAirlines',
    logoText: 'JL',
    color: '#b51620',
    background: '#fff0f0',
    foreground: '#8d1219',
  },
  {
    id: 'malaysia-airlines',
    name: 'Malaysia Airlines',
    aliases: ['malaysia airlines', 'malaysia airlines golden lounge', 'golden lounge'],
    sourceUrl: 'https://www.malaysiaairlines.com/us/en/experience/at-the-airport/airport-lounges.html',
    assetKey: 'malaysiaAirlines',
    logoText: 'MH',
    color: '#1d5685',
    background: '#edf3fb',
    foreground: '#1b4568',
  },
  {
    id: 'finnair',
    name: 'Finnair',
    aliases: ['finnair', 'finnair lounge', 'finnair business lounge', 'finnair platinum wing'],
    sourceUrl: 'https://www.finnair.com/us-en/at-the-airport/lounges',
    assetKey: 'finnair',
    logoText: 'AY',
    color: '#25456e',
    background: '#edf2f8',
    foreground: '#1e3658',
  },
  {
    id: 'iberia',
    name: 'Iberia',
    aliases: ['iberia', 'iberia airlines', 'iberia lounge', 'iberia premium lounge', 'premium lounge dalí', 'premium lounge velazquez'],
    sourceUrl: 'https://www.iberia.com/us/vip-lounges/',
    assetKey: 'iberia',
    logoText: 'IB',
    color: '#b33a22',
    background: '#fff2ed',
    foreground: '#8d2c19',
  },
  {
    id: 'royal-jordanian',
    name: 'Royal Jordanian',
    aliases: ['royal jordanian', 'royal jordanian crown lounge', 'crown lounge'],
    sourceUrl: 'https://www.rj.com/en/info-and-tips/flying-with-us/crown-lounge',
    assetKey: 'royalJordanian',
    logoText: 'RJ',
    color: '#654332',
    background: '#f5efeb',
    foreground: '#4e3326',
  },
  {
    id: 'fiji-airways',
    name: 'Fiji Airways',
    aliases: ['fiji airways', 'fiji airways premier lounge', 'premier lounge'],
    sourceUrl: 'https://www.fijiairways.com/en-us/experience/airport-lounges',
    assetKey: 'fijiAirways',
    logoText: 'FJ',
    color: '#4b4f53',
    background: '#f1f3f4',
    foreground: '#35393d',
  },
  {
    id: 'oman-air',
    name: 'Oman Air',
    aliases: ['oman air', 'oman air lounge', 'oman air business class', 'oman air first and business class lounge', 'al khareef lounge by oman air'],
    sourceUrl: 'https://www.omanair.com/us/en/experience/airport-lounges',
    assetKey: 'omanAir',
    logoText: 'WY',
    color: '#2d6960',
    background: '#eaf5f2',
    foreground: '#214d47',
  },
  {
    id: 'latam-airlines',
    name: 'LATAM Airlines',
    aliases: ['latam', 'latam airlines', 'latam lounge', 'latam vip lounge', 'latam premium lounge', 'latam signature lounge'],
    sourceUrl: 'https://www.latamairlines.com/us/en/experience/airport/lounges',
    assetKey: 'latamAirlines',
    logoText: 'LA',
    color: '#312f78',
    background: '#f0f0fb',
    foreground: '#29265f',
  },
  {
    id: 'royal-air-maroc',
    name: 'Royal Air Maroc',
    aliases: ['royal air maroc', 'royal air maroc lounge', 'ram lounge'],
    sourceUrl: 'https://www.royalairmaroc.com/us-en/airport/airport-lounges',
    assetKey: 'royalAirMaroc',
    logoText: 'AT',
    color: '#9f242d',
    background: '#fff0f1',
    foreground: '#7d1b22',
  },
  {
    id: 'srilankan-airlines',
    name: 'SriLankan Airlines',
    aliases: ['srilankan', 'sri lankan', 'srilankan airlines', 'sri lankan airlines', 'srilankan lounge', 'serendib lounge'],
    sourceUrl: 'https://www.srilankan.com/en_uk/flying-with-us/lounges',
    assetKey: 'sriLankan',
    logoText: 'UL',
    color: '#27558a',
    background: '#edf3fb',
    foreground: '#1d416c',
  },
].map((brand) => ({
  id: brand.id,
  name: brand.name,
  category: 'airline',
  aliases: brand.aliases,
  sourceIds: ['oneworld'],
  sourceUrl: brand.sourceUrl,
  assetSource: 'desk_travel_database',
  deskTravelAssetKey: `all-routes:brand/${brand.id}`,
  logoUrl: ALL_ROUTES_AIRLINE_LOGOS[brand.assetKey],
  fallbackLogoUrl: ALL_ROUTES_AIRLINE_LOGO_BACKUPS[brand.assetKey],
  logoText: brand.logoText,
  color: brand.color,
  background: brand.background,
  foreground: brand.foreground,
  status: 'review',
  rightsNote: `Airline logo served from all-routes centralized Cloudflare brand asset registry; official public ${brand.name} lounge page supplies source context.`,
}));

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
    logoUrl: REVIEWED_BRAND_LOGOS.priorityPass.logoUrl,
    upstreamLogoUrl: REVIEWED_BRAND_LOGOS.priorityPass.upstreamLogoUrl,
    logoText: 'PP',
    color: '#214f9f',
    background: '#eaf1fb',
    foreground: '#163f82',
    status: 'approved',
    rightsNote: 'Desk.Travel reviewed public Priority Pass logo asset stored same-origin; source mapping uses official public program page.',
  },
  {
    id: 'chase-sapphire',
    name: 'Chase Sapphire',
    category: 'issuer',
    aliases: ['chase sapphire'],
    sourceIds: ['chase-sapphire'],
    sourceUrl: 'https://account.chase.com/sapphire-airport-lounge',
    assetSource: 'desk_travel_database',
    deskTravelAssetKey: 'desk-travel:brand/chase-sapphire',
    logoUrl: REVIEWED_BRAND_LOGOS.chaseSapphire.logoUrl,
    upstreamLogoUrl: REVIEWED_BRAND_LOGOS.chaseSapphire.upstreamLogoUrl,
    logoText: 'CS',
    color: '#0c3f78',
    background: '#e8f0fb',
    foreground: '#0c3f78',
    status: 'review',
    rightsNote: 'Desk.Travel reviewed public Chase Sapphire Lounge logo asset stored same-origin; official public Chase page supplies source context.',
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
    logoUrl: REVIEWED_BRAND_LOGOS.centurionLounge.logoUrl,
    upstreamLogoUrl: REVIEWED_BRAND_LOGOS.centurionLounge.upstreamLogoUrl,
    logoText: 'AX',
    color: '#1f5f9f',
    background: '#e8f3fb',
    foreground: '#164b7a',
    status: 'review',
    rightsNote: 'Desk.Travel reviewed public Centurion Lounge logo asset stored same-origin; official public Amex page supplies source context.',
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
    logoUrl: REVIEWED_BRAND_LOGOS.capitalOneTravel.logoUrl,
    upstreamLogoUrl: REVIEWED_BRAND_LOGOS.capitalOneTravel.upstreamLogoUrl,
    logoText: 'CO',
    color: '#244f7a',
    background: '#eaf2f8',
    foreground: '#1f405f',
    status: 'review',
    rightsNote: 'Desk.Travel reviewed public Capital One Travel logo asset stored same-origin; official public Capital One lounge page supplies source context.',
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
    logoUrl: REVIEWED_BRAND_LOGOS.loungeKey.logoUrl,
    upstreamLogoUrl: REVIEWED_BRAND_LOGOS.loungeKey.upstreamLogoUrl,
    logoText: 'MC',
    color: '#9b3f1d',
    background: '#fff0e7',
    foreground: '#7b3217',
    status: 'candidate',
    rightsNote: 'Desk.Travel reviewed public LoungeKey logo asset stored same-origin; official public Mastercard/DragonPass page supplies source context.',
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
    fallbackLogoUrl: ALL_ROUTES_AIRLINE_LOGO_BACKUPS.united,
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
    fallbackLogoUrl: ALL_ROUTES_AIRLINE_LOGO_BACKUPS.delta,
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
    fallbackLogoUrl: ALL_ROUTES_AIRLINE_LOGO_BACKUPS.americanAirlines,
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
    fallbackLogoUrl: ALL_ROUTES_AIRLINE_LOGO_BACKUPS.airCanada,
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
    fallbackLogoUrl: ALL_ROUTES_AIRLINE_LOGO_BACKUPS.airFrance,
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
    fallbackLogoUrl: ALL_ROUTES_AIRLINE_LOGO_BACKUPS.britishAirways,
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
    fallbackLogoUrl: ALL_ROUTES_AIRLINE_LOGO_BACKUPS.alaskaAirlines,
    logoText: 'AS',
    color: '#245a7e',
    background: '#edf5f8',
    foreground: '#19435f',
    status: 'review',
    rightsNote: 'Airline logo served from all-routes centralized Cloudflare brand asset registry; official public Alaska Lounge page supplies source context.',
  },
  {
    id: 'singapore-airlines',
    name: 'Singapore Airlines',
    category: 'airline',
    aliases: ['singapore airlines', 'silverkris', 'silverkris lounge', 'krisflyer gold lounge'],
    sourceIds: ['singapore-airlines'],
    sourceUrl: 'https://www.singaporeair.com/en_UK/sg/flying-withus/before-the-flight/lounges/silverkris/',
    assetSource: 'desk_travel_database',
    deskTravelAssetKey: 'all-routes:brand/singapore-airlines',
    logoUrl: ALL_ROUTES_AIRLINE_LOGOS.singaporeAirlines,
    fallbackLogoUrl: ALL_ROUTES_AIRLINE_LOGO_BACKUPS.singaporeAirlines,
    logoText: 'SQ',
    color: '#24446f',
    background: '#edf2f8',
    foreground: '#1f375f',
    status: 'review',
    rightsNote: 'Airline logo served from all-routes centralized Cloudflare brand asset registry; official public Singapore Airlines lounge page supplies source context.',
  },
  {
    id: 'qatar-airways',
    name: 'Qatar Airways',
    category: 'airline',
    aliases: ['qatar airways', 'al safwa', 'al mourjan', 'qatar premium lounge'],
    sourceIds: ['qatar-airways'],
    sourceUrl: 'https://www.qatarairways.com/en-us/lounges.html',
    assetSource: 'desk_travel_database',
    deskTravelAssetKey: 'all-routes:brand/qatar-airways',
    logoUrl: ALL_ROUTES_AIRLINE_LOGOS.qatarAirways,
    fallbackLogoUrl: ALL_ROUTES_AIRLINE_LOGO_BACKUPS.qatarAirways,
    logoText: 'QR',
    color: '#662046',
    background: '#f7edf2',
    foreground: '#662046',
    status: 'candidate',
    rightsNote: 'Airline logo served from all-routes centralized Cloudflare brand asset registry; official public Qatar Airways lounge pages supply source context.',
  },
  {
    id: 'qantas',
    name: 'Qantas',
    category: 'airline',
    aliases: [
      'qantas',
      'qantas club',
      'qantas lounge',
      'qantas business lounge',
      'qantas first lounge',
      'qantas domestic business',
      'qantas international business',
      'qantas international first',
      'qantas regional lounge',
      'qantas hong kong international lounge',
      'the qantas london lounge',
      'the qantas singapore lounge',
    ],
    sourceIds: ['qantas'],
    sourceUrl: 'https://www.qantas.com/en-us/at-the-airport/lounges/locations',
    assetSource: 'desk_travel_database',
    deskTravelAssetKey: 'all-routes:brand/qantas',
    logoUrl: ALL_ROUTES_AIRLINE_LOGOS.qantas,
    fallbackLogoUrl: ALL_ROUTES_AIRLINE_LOGO_BACKUPS.qantas,
    logoText: 'QF',
    color: '#a81e22',
    background: '#fff0f0',
    foreground: '#8f171b',
    status: 'candidate',
    rightsNote: 'Airline logo served from all-routes centralized Cloudflare brand asset registry; official public Qantas lounge pages supply source context.',
  },
  ...ONEWORLD_MEMBER_AIRLINE_BRANDS,
  {
    id: 'oneworld',
    name: 'oneworld',
    category: 'alliance',
    aliases: ['oneworld', 'one world'],
    sourceIds: ['oneworld'],
    sourceUrl: 'https://www.oneworld.com/airport-lounges',
    assetSource: 'desk_travel_database',
    deskTravelAssetKey: 'all-routes:brand/oneworld',
    logoUrl: ALL_ROUTES_ALLIANCE_LOGOS.oneworld,
    upstreamLogoUrl: ALL_ROUTES_ALLIANCE_UPSTREAM_LOGOS.oneworld,
    logoText: 'OW',
    color: '#1f5d8f',
    background: '#edf4fb',
    foreground: '#1b4f78',
    status: 'review',
    rightsNote: 'Alliance logo served from all-routes centralized Cloudflare brand asset registry; official public oneworld lounge page supplies source context.',
  },
  {
    id: 'star-alliance',
    name: 'Star Alliance',
    category: 'alliance',
    aliases: ['star alliance', 'star alliance gold', 'star alliance silver'],
    sourceIds: ['star-alliance'],
    sourceUrl: 'https://www.staralliance.com/en/lounge-finder',
    assetSource: 'desk_travel_database',
    deskTravelAssetKey: 'all-routes:brand/star-alliance',
    logoUrl: ALL_ROUTES_ALLIANCE_LOGOS.starAlliance,
    upstreamLogoUrl: ALL_ROUTES_ALLIANCE_UPSTREAM_LOGOS.starAlliance,
    logoText: 'SA',
    color: '#2e343b',
    background: '#f1f3f5',
    foreground: '#2e343b',
    status: 'review',
    rightsNote: 'Alliance logo served from all-routes centralized Cloudflare brand asset registry; official public Star Alliance lounge finder supplies source context.',
  },
  {
    id: 'skyteam',
    name: 'SkyTeam',
    category: 'alliance',
    aliases: ['skyteam', 'sky team', 'skyteam elite plus'],
    sourceIds: ['skyteam'],
    sourceUrl: 'https://www.skyteam.com/en/lounges',
    assetSource: 'desk_travel_database',
    deskTravelAssetKey: 'all-routes:brand/skyteam',
    logoUrl: ALL_ROUTES_ALLIANCE_LOGOS.skyteam,
    upstreamLogoUrl: ALL_ROUTES_ALLIANCE_UPSTREAM_LOGOS.skyteam,
    logoText: 'ST',
    color: '#315a93',
    background: '#edf2fb',
    foreground: '#244c82',
    status: 'review',
    rightsNote: 'Alliance logo served from all-routes centralized Cloudflare brand asset registry; official public SkyTeam lounge page supplies source context.',
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
    fallbackLogoUrl: ALL_ROUTES_AIRLINE_LOGO_BACKUPS.turkishAirlines,
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
    fallbackLogoUrl: ALL_ROUTES_AIRLINE_LOGO_BACKUPS.etihad,
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
    fallbackLogoUrl: ALL_ROUTES_AIRLINE_LOGO_BACKUPS.virginAtlantic,
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
    logoUrl: REVIEWED_BRAND_LOGOS.plazaPremium.logoUrl,
    upstreamLogoUrl: REVIEWED_BRAND_LOGOS.plazaPremium.upstreamLogoUrl,
    logoText: 'PL',
    color: '#846229',
    background: '#f8f1e4',
    foreground: '#694d1f',
    status: 'review',
    rightsNote: 'Desk.Travel reviewed official Plaza Premium Lounge logo asset stored same-origin; official public Plaza Premium page supplies source context.',
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
  const fallbackLogoUrl = entry.fallbackLogoUrl;

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
      upstreamLogoUrl: brand.upstreamLogoUrl,
      logoText: brand.logoText,
      color: brand.color,
      background: brand.background,
      foreground: brand.foreground,
      status: brand.status,
      rightsNote: brand.rightsNote,
    })),
  };
}
