import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';

import { cloneSourceRegistry } from './lib/source-registry.mjs';
import { parseAirCanadaLoungeRecords } from './lib/air-canada-structured.mjs';
import { parseAmericanAirlinesClubRecords } from './lib/american-airlines-structured.mjs';
import {
  parseAirportOfficialLoungeRecords,
  parsePanynjOfficialLoungeRecords,
} from './lib/airport-official-lounges-structured.mjs';
import { parseBeRelaxStructuredRecords } from './lib/be-relax-structured.mjs';
import { parseCapitalOneLoungeRecords } from './lib/capital-one-structured.mjs';
import { parseChaseSapphireLoungeRecords } from './lib/chase-sapphire-structured.mjs';
import { parseDeltaSkyClubRecords } from './lib/delta-sky-club-structured.mjs';
import { parseEscapeLoungeStructuredRecord } from './lib/escape-lounges-structured.mjs';
import { mergeGamewayDetailRecord, parseGamewayStructuredRecords } from './lib/gameway-structured.mjs';
import { parseMarhabaStructuredRecord, parseMarhabaStructuredRecords } from './lib/marhaba-structured.mjs';
import { parseMinuteSuitesStructuredRecords } from './lib/minute-suites-structured.mjs';
import { parseNo1StructuredRecords } from './lib/no1-lounges-structured.mjs';
import {
  extractPlazaPremiumFindUrls,
  parsePlazaPremiumStructuredRecords,
} from './lib/plaza-premium-structured.mjs';
import {
  parsePrimeclassIndexLinks,
  parsePrimeclassStructuredRecord,
} from './lib/primeclass-structured.mjs';
import {
  parseQatarAirwaysLoungeLinks,
  parseQatarAirwaysLoungeRecord,
} from './lib/qatar-airways-structured.mjs';
import {
  parseQantasLoungeLinks,
  parseQantasLoungeRecord,
} from './lib/qantas-structured.mjs';
import { parseSingaporeAirlinesLoungeRecords } from './lib/singapore-airlines-structured.mjs';
import { parseSleepoverStructuredRecord } from './lib/sleepover-structured.mjs';
import { mergeTheClubDetailRecord, parseTheClubStructuredRecords } from './lib/the-club-structured.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const cacheRoot = path.resolve(projectRoot, '.cache', 'source-snapshots');
const geoJsonPath = path.resolve(projectRoot, 'public', 'data', 'lounges.geojson');
const publicReportPath = path.resolve(projectRoot, 'public', 'data', 'source-intake-report.json');
const latestReportPath = path.resolve(cacheRoot, 'latest-report.json');
const timeoutMs = Number(process.env.SOURCE_FETCH_TIMEOUT_MS || 20000);
const delayMs = Number(process.env.SOURCE_FETCH_DELAY_MS || 1200);
const childPageLimit = Number(process.env.SOURCE_CHILD_PAGE_LIMIT || 25);
const repeatedFetchErrorLimit = Number(process.env.SOURCE_REPEATED_FETCH_ERROR_LIMIT || 3);
const playwrightNetworkIdleMs = Number(process.env.SOURCE_PLAYWRIGHT_NETWORKIDLE_MS ?? 5000);
const structuredDetailLimit = Number(process.env.SOURCE_STRUCTURED_DETAIL_LIMIT || 12);
const childCrawlSourceIds = new Set(
  String(process.env.SOURCE_CHILD_CRAWL_SOURCES || 'escape-lounges')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);
const requestedSourceIds = new Set(
  String(process.env.SOURCE_SOURCE_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);
const ourAirportsCsvUrl =
  process.env.OUR_AIRPORTS_CSV_URL ||
  'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv';
const oneworldAirportsUrl =
  'https://api.oneworld.com/wayfinding/v1/Airports?app_id=1&app_key=A3676D53BD00428BA198937061A835EE';
const oneworldLoungeUrl =
  'https://api.oneworld.com/lounge/v1/lounges/airport';
const oneworldLoungeQuery = 'app_id=2&app_key=A3676D53BD00428BA198937061A835DD';
const theClubLoungesUrl = 'https://www.theclubairportlounges.com/lounges';
const no1StructuredUrls = [
  'https://no1lounges.com/locations/london-heathrow/',
  'https://no1lounges.com/locations/london-gatwick/',
  'https://no1lounges.com/locations/london-luton/',
  'https://no1lounges.com/locations/birmingham/',
  'https://no1lounges.com/locations/jersey/',
  'https://no1lounges.com/partner-lounges/',
];
const beRelaxStructuredUrl = 'https://berelax.com/find-us/';
const gamewayLocationsUrl = 'https://gameway.gg/locations/';
const sleepoverStructuredUrls = [
  'https://www.airport-sleepover.com/en/terminals/dubai-terminal-1-concourse-d',
  'https://www.airport-sleepover.com/en/terminals/dubai-terminal-3-concourse-a',
  'https://www.airport-sleepover.com/en/terminals/dubai-terminal-3-concourse-b',
  'https://www.airport-sleepover.com/en/terminals/dubai-terminal-3-concourse-c',
  'https://www.airport-sleepover.com/en/terminals/doha-south',
  'https://www.airport-sleepover.com/en/terminals/doha-north',
  'https://www.airport-sleepover.com/en/terminals/doh-north-node-c40',
  'https://www.airport-sleepover.com/en/terminals/lima-international-terminal',
];
const minuteSuitesStructuredUrls = [
  'https://minutesuites.com/locations/atlanta-airport/',
  'https://minutesuites.com/locations/baltimore-washington-airport/',
  'https://minutesuites.com/locations/charlotte-airport/',
  'https://minutesuites.com/locations/dallas-fort-worth-airport/',
  'https://minutesuites.com/locations/houston-airport/',
  'https://minutesuites.com/locations/jfk-airport/',
  'https://minutesuites.com/locations/nashville-airport/',
  'https://minutesuites.com/locations/newark-airport/',
  'https://minutesuites.com/locations/philadelphia-airport/',
  'https://minutesuites.com/locations/salt-lake-city-airport/',
];
const qatarAirwaysStructuredUrls = [
  'https://www.qatarairways.com/en-us/lounges/al-safwa-lounge.html',
  'https://www.qatarairways.com/en-us/lounges/al-mourjan.html',
  'https://www.qatarairways.com/en-us/lounges/al-mourjan-garden.html',
  'https://www.qatarairways.com/en-us/lounges/platinum-and-gold-lounges.html',
  'https://www.qatarairways.com/en-us/lounges/silver-lounge.html',
  'https://www.qatarairways.com/en-us/lounges/first-and-business-class-arrival-lounges.html',
  'https://www.qatarairways.com/en-us/lounges/almaha-lounge.html',
  'https://www.qatarairways.com/en-us/lounges/mariner-lounge.html',
  'https://www.qatarairways.com/en-us/lounges/bangkok-premium-lounge.html',
  'https://www.qatarairways.com/en-us/lounges/beirut-premium-lounge.html',
  'https://www.qatarairways.com/en-us/lounges/singapore-premium-lounge.html',
  'https://www.qatarairways.com/en-us/lounges/london-heathrow.html',
];
const qantasStructuredIndexUrl = 'https://www.qantas.com/en-us/at-the-airport/lounges/locations';
const americanStructuredUrls = [
  'https://www.aa.com/i18n/travelInformation/airportAmenities/dfw-club.jsp',
  'https://www.aa.com/i18n/travelInformation/airportAmenities/lax-club.jsp',
  'https://www.aa.com/i18n/travelInformation/airportAmenities/jfk-club.jsp',
  'https://www.aa.com/i18n/travelInformation/airportAmenities/ord-club.jsp',
  'https://www.aa.com/i18n/travelInformation/airportAmenities/clt-club.jsp',
];
const defaultAirportOfficialLoungeUrls = [
  'https://www.jfkairport.com/dine-shop-relax/lounge-and-rest',
  'https://www.laguardiaairport.com/dine-shop-relax/lounge-and-rest',
  'https://www.newarkairport.com/dine-shop-relax/lounge-and-rest',
  'https://www.flysfo.com/passengers/shop-dine-relax/lounges',
  'https://www.phl.org/at-phl/services-and-amenities/lounges-and-concierge-services',
  'https://www.dfwairport.com/explore/lounges/',
  'https://www.changiairport.com/bin/changiairport/airport/getfacilitieslistingcards.all.all.airline-lounges_pay-per-use-lounges.0.15.en-SG.data',
  'https://www.changiairport.com/en/at-changi/facilities-and-services-directory/plaza-premium-lounge.html',
  'https://www.heathrow.com/at-the-airport/lounges-hotels-spas/terminal-2/no1-lounges',
  'https://www.heathrow.com/at-the-airport/lounges-hotels-spas/terminal-2/plaza-premium',
  'https://www.heathrow.com/at-the-airport/lounges-hotels-spas/terminal-3/no1-lounges',
  'https://www.heathrow.com/at-the-airport/lounges-hotels-spas/terminal-3/plaza-premium',
  'https://www.heathrow.com/at-the-airport/lounges-hotels-spas/terminal-4/plaza-premium',
  'https://www.heathrow.com/at-the-airport/lounges-hotels-spas/terminal-5/plaza-premium',
  'https://www.heathrow.com/at-the-airport/lounges-hotels-spas/terminal-5/club-aspire',
  'https://www.manchesterairport.co.uk/at-the-airport/airport-lounges/escape-lounges/',
  'https://www.manchesterairport.co.uk/at-the-airport/airport-lounges/1903-lounge/',
  'https://dubaiairports.ae/experiences/relax---refresh/details/game-space-gaming-lounge',
  'https://dubaiairports.ae/experiences/relax---refresh/details/ahlan-business-class-lounge',
  'https://dubaiairports.ae/experiences/relax---refresh/details/plaza-premium-lounge',
  'https://www.gatwickairport.com/premium-services/lounge-airport/lounge-no1.html',
  'https://www.gatwickairport.com/premium-services/lounge-airport/lounge-my-lounge.html',
  'https://www.gatwickairport.com/premium-services/lounge-airport/lounge-plaza-premium.html',
  'https://www.gatwickairport.com/premium-services/lounge-airport/lounge-plaza-express.html',
  'https://www.gatwickairport.com/premium-services/lounge-airport/lounge-club-aspire.html',
  'https://www.gatwickairport.com/premium-services/lounge-airport/lounge-clubrooms.html',
  'https://www.gatwickairport.com/premium-services/lounge-airport/lounge-arrive-refresh.html',
  'https://suvarnabhumi.airportthai.co.th/service/facility/detail/230',
  'https://www.gru.com.br/en/passenger/discover-gru/relax/vip-lounges',
  'https://www.miami-airport.com/clubs-and-lounges.asp',
  'https://www.portseattle.org/services-amenities/airport-lounges',
  'https://www.melbourneairport.com.au/plaza-premium-lounge',
  'https://www.melbourneairport.com.au/marhaba-lounge',
  'https://www.melbourneairport.com.au/aspire-lounge',
  'https://www.sydneyairport.com.au/info-sheet/airline-lounges-t1',
  'https://www.sydneyairport.com.au/info-sheet/t3-facilities-and-services',
  'https://www.hongkongairport.com/en/passenger-guide/airport-facilities-services/airline-lounges',
  'https://www.hongkongairport.com/en/passenger-guide/airport-facilities-services/pay-in-corporate-lounges',
  'https://tokyo-haneda.com/en/service/facilities/lounge.html',
  'https://www.adr.it/web/aeroporti-di-roma-en/emirates-lounge',
  'https://www.adr.it/web/aeroporti-di-roma-en/british-airways-lounge',
  'https://www.adr.it/web/aeroporti-di-roma-en/ita-airways-lounge',
  'https://www.adr.it/web/aeroporti-di-roma-en/plaza-premium-lounge-t1',
  'https://www.adr.it/web/aeroporti-di-roma-en/plaza-premium-lounge-t3',
  'https://www.adr.it/web/aeroporti-di-roma-en/passenger-lounge1',
  'https://www.adr.it/web/aeroporti-di-roma-en/hellosky',
  'https://www.adr.it/web/aeroporti-di-roma-en/plaza-premium-first-lounge-t1',
  'https://www.prg.aero/en/erste-premier-lounge-en',
  'https://www.prg.aero/en/erste-premier-lounge-t1',
  'https://www.prg.aero/en/visa-lounge',
  'https://www.prg.aero/en/vip-service-club-continental',
  'https://www.aena.es/es/madrid-barajas-adolfo-suarez/servicios-del-aeropuerto/servicios-vip/salas-vip/sala-vip-cibeles.html&p=1575033929773',
  'https://www.aena.es/es/madrid-barajas-adolfo-suarez/servicios-del-aeropuerto/servicios-vip/salas-vip/sala-vip-neptuno.html&p=1575033929773',
  'https://www.aena.es/es/madrid-barajas-adolfo-suarez/servicios-del-aeropuerto/servicios-vip/salas-vip/sala-vip-puerta-alcala.html&p=1575033633286',
  'https://www.aena.es/es/madrid-barajas-adolfo-suarez/servicios-del-aeropuerto/servicios-vip/salas-vip/sala-vip-puerta-del-sol.html&p=1575033633658',
  'https://www.aena.es/es/madrid-barajas-adolfo-suarez/servicios-del-aeropuerto/servicios-vip/salas-vip/sala-vip-plaza-mayor.html&p=1575033929773',
  'https://www.aena.es/es/madrid-barajas-adolfo-suarez/servicios-vip/salas-vip/sala-vip-retiro-t4.html&p=1575033633704',
  'https://www.aena.es/es/a-coruna/servicios-vip/salas-vip/sala-vip-aeropuerto-acoruna.html?p=1575037011690',
  'https://www.aena.es/es/alicante-elche/servicios-vip/salas-vip/sala-vip-costa-blanca.html?p=1575036771904',
  'https://www.aena.es/es/bilbao/servicios-vip/salas-vip/sala-vip-aeropuerto-bilbao.html?p=1575036765897',
  'https://www.aena.es/es/fuerteventura/servicios-vip/salas-vip/salas-vip-jable-fue.html?p=1575050524424',
  'https://www.aena.es/es/gran-canaria/servicios-vip/salas-vip/sala-vip-aeropuerto-gran-canaria.html?p=1575049385014',
  'https://www.aena.es/es/ibiza/servicios-vip/salas-vip/sala-vip-cap-des-falco.html?p=1575049401515',
  'https://www.aena.es/es/josep-tarradellas-barcelona-el-prat/servicios-vip/salas-vip/sala-vip-colomer.html?p=1575033154799',
  'https://www.aena.es/es/josep-tarradellas-barcelona-el-prat/servicios-vip/salas-vip/sala-vip-joan-miro.html?p=1575033154799',
  'https://www.aena.es/es/josep-tarradellas-barcelona-el-prat/servicios-vip/salas-vip/sala-vip-pau-casals.html?p=1575033154799',
  'https://www.aena.es/es/josep-tarradellas-barcelona-el-prat/servicios-vip/salas-vip/sala-vip-canudas.html?p=1575033154799',
  'https://www.aena.es/es/menorca/servicios-vip/salas-vip/sala-vip-tramuntana.html?p=1575050150549',
  'https://www.aena.es/es/palma-de-mallorca/servicios-vip/salas-vip/sala-vip-formentor.html?p=1575048305010',
  'https://www.aena.es/es/palma-de-mallorca/servicios-vip/salas-vip/sala-vip-mediterraneo.html?p=1575048305010',
  'https://www.aena.es/es/santiago-rosalia-de-castro/servicios-vip/salas-vip/sala-vip-santiago.html?p=1575037856492',
  'https://www.aena.es/es/sevilla/servicios-vip/salas-vip/sala-vip-azahar.html?p=1575050212219',
  'https://www.aena.es/es/tenerife-norte-ciudad-de-la-laguna/servicios-vip/salas-vip/sala-vip-nivaria.html?p=1575045391431',
  'https://www.aena.es/es/tenerife-sur/servicios-vip/salas-vip/sala-vip-montana-roja.html?p=1575050059304',
  'https://www.aena.es/es/valencia/servicios-vip/salas-vip/sala-joan-olivert.html?p=1575037608781',
  'https://www.aena.es/es/vigo/servicios-vip/salas-vip/sala-vip-aeropuerto-vigo.html?p=1575037750596',
  'https://dohahamadairport.com/lounge/al-maha-arrival-lounge-after-immigration',
  'https://dohahamadairport.com/lounge/al-maha-arrival-lounge-immigration',
  'https://dohahamadairport.com/lounge/al-maha-departure-lounge',
  'https://dohahamadairport.com/lounge/al-maha-lounge-north',
  'https://dohahamadairport.com/lounge/al-maha-lounge-south',
  'https://dohahamadairport.com/lounge/al-mourjan-business-lounge-garden',
  'https://dohahamadairport.com/lounge/al-mourjan-business-lounge-south',
  'https://dohahamadairport.com/lounge/al-safwa-first-lounge',
  'https://dohahamadairport.com/lounge/first-and-business-class-arrival-lounge-after-immigration',
  'https://dohahamadairport.com/lounge/first-and-business-class-arrival-lounge-after-immigration-0',
  'https://dohahamadairport.com/lounge/gold-lounge-south',
  'https://dohahamadairport.com/lounge/mariner-lounge',
  'https://dohahamadairport.com/lounge/platinum-and-gold-lounge-north',
  'https://dohahamadairport.com/lounge/platinum-lounge-south',
  'https://dohahamadairport.com/lounge/sensory-room-muzn-lounge',
  'https://dohahamadairport.com/lounge/silver-lounge-south',
];
const airportOfficialLoungeUrls = process.env.SOURCE_AIRPORT_OFFICIAL_URLS
  ? process.env.SOURCE_AIRPORT_OFFICIAL_URLS.split(',').map((url) => url.trim()).filter(Boolean)
  : defaultAirportOfficialLoungeUrls;
const requiredIntakeRuntime = 'playwright';
const intakeRuntime = process.env.LOUNGE_GURU_SOURCE_INTAKE_RUNTIME || '';
const sourceFetchDriver = process.env.SOURCE_FETCH_DRIVER || 'playwright';
const browserLikeUserAgent =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const intakeUserAgent = 'lounge-guru-source-intake/1.0 (+https://loungeguru.desk.travel)';
const userTriggeredAiUserAgent = 'ChatGPT-User';
const browserLikeSourceIds = new Set(['singapore-airlines', 'qatar-airways', 'qantas']);
const userTriggeredAiSourceIds = new Set(['plaza-premium']);
const httpProtocolFallbackSourceIds = new Set(['qantas']);
const chromeExecutableCandidates = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);
let playwrightBrowserPromise = null;

const LOUNGE_TERMS = [
  'lounge',
  'club',
  'sky club',
  'admirals',
  'maple leaf',
  'centurion',
  'sapphire',
  'plaza premium',
  'escape',
  'the club',
  'airport companion',
  'travel pass',
];

const AMBIGUOUS_AIRPORT_CODES = new Set([
  'ACE',
  'ADD',
  'AGE',
  'AIR',
  'AND',
  'ANY',
  'APP',
  'ARE',
  'ASK',
  'BAR',
  'BUT',
  'CAD',
  'CAF',
  'CAN',
  'CAR',
  'CAT',
  'COM',
  'DAY',
  'DOG',
  'DON',
  'EYE',
  'FLY',
  'FOR',
  'GBP',
  'GET',
  'GOL',
  'HOT',
  'HOW',
  'HUB',
  'INS',
  'INT',
  'JOS',
  'KEY',
  'MAP',
  'MAR',
  'MAY',
  'MIN',
  'NET',
  'NEW',
  'NOT',
  'NOW',
  'OFF',
  'OLD',
  'ONE',
  'OPT',
  'OUR',
  'OUT',
  'PET',
  'PRE',
  'REG',
  'SAN',
  'SEE',
  'SIT',
  'SKY',
  'SPA',
  'THE',
  'TRY',
  'USA',
  'USE',
  'VIP',
  'WEB',
  'WWW',
  'YOU',
]);

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function nowRunId() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function requireSourceIntakeRuntime() {
  if (intakeRuntime === requiredIntakeRuntime) {
    return;
  }

  throw new Error(
    'Source intake must run through the Playwright-approved runner. ' +
      'Set LOUNGE_GURU_SOURCE_INTAKE_RUNTIME=playwright and keep raw snapshots in .cache/source-snapshots.',
  );
}

function safeName(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function cleanText(value) {
  return String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function pageTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return cleanText(match?.[1] ?? '');
}

function extractJsonLdCount(html) {
  return [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>/gi)].length;
}

function extractLinks(html, baseUrl) {
  const links = new Set();
  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
    try {
      const url = new URL(match[1], baseUrl);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        links.add(url.toString());
      }
    } catch {
      // Ignore malformed links from vendor pages.
    }
  }
  return [...links];
}

function isLikelyLoungeLink(url) {
  const parsed = new URL(url);
  if (['twitter.com', 'www.linkedin.com', 'www.facebook.com'].includes(parsed.hostname)) {
    return false;
  }
  const lower = `${parsed.pathname}${parsed.search}`.toLowerCase();
  if (/\.(css|js|mjs|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|eot)(\?|$)/i.test(lower)) {
    return false;
  }
  return LOUNGE_TERMS.some((term) => lower.includes(term.replace(/\s+/g, '-')) || lower.includes(term));
}

function shouldCrawlChildLink(source, url) {
  if (childPageLimit <= 0) {
    return false;
  }
  if (!childCrawlSourceIds.has(source.id)) {
    return false;
  }

  const parsed = new URL(url);
  const seed = new URL(source.url);
  const host = parsed.hostname.replace(/^www\./, '');
  const seedHost = seed.hostname.replace(/^www\./, '');

  if (host === seedHost || host.endsWith(`.${seedHost}`)) {
    return true;
  }

  if (source.id === 'capital-one' && host === 'capitalonetravel.com') {
    return true;
  }

  return false;
}

function extractAirportCodes(text, knownAirportCodes) {
  const candidates = new Set();
  const codeRegex = /\b[A-Z]{3}\b/g;
  let match;

  while ((match = codeRegex.exec(text)) !== null) {
    const code = match[0];
    if (!knownAirportCodes.has(code) || AMBIGUOUS_AIRPORT_CODES.has(code)) {
      continue;
    }
    const start = Math.max(0, match.index - 180);
    const end = Math.min(text.length, match.index + 180);
    const context = text.slice(start, end).toLowerCase();
    if (LOUNGE_TERMS.some((term) => context.includes(term))) {
      candidates.add(code);
    }
  }

  return [...candidates].sort();
}

async function loadKnownAirportCodes() {
  const codes = new Set();

  try {
    const geoJson = JSON.parse(await fs.readFile(geoJsonPath, 'utf8'));
    for (const feature of geoJson.features ?? []) {
      const code = String(feature.properties?.airportCode ?? '').toUpperCase();
      if (/^[A-Z0-9]{3}$/.test(code)) {
        codes.add(code);
      }
    }
  } catch {
    // The source workbook build may not have run yet; fall through to OurAirports.
  }

  try {
    const response = await fetchHttpText(ourAirportsCsvUrl);
    if (response.ok) {
      const parsed = Papa.parse(response.text, {
        header: true,
        skipEmptyLines: true,
      });
      for (const row of parsed.data) {
        const code = String(row.iata_code ?? '').toUpperCase();
        if (/^[A-Z0-9]{3}$/.test(code)) {
          codes.add(code);
        }
      }
    }
  } catch {
    // Existing catalog codes are enough for a conservative fallback report.
  }

  return codes;
}

function robotAgentMatches(targetUserAgent, candidate) {
  const target = String(targetUserAgent ?? '').toLowerCase();
  const agent = String(candidate ?? '').toLowerCase();
  return agent === '*' || (agent && (target.includes(agent) || agent.includes(target)));
}

function parseRobots(robotsText, targetUserAgent = intakeUserAgent) {
  const groups = [];
  let currentAgents = [];
  let currentRules = [];

  const flush = () => {
    if (currentAgents.length > 0) {
      groups.push({ agents: currentAgents, rules: currentRules });
    }
    currentAgents = [];
    currentRules = [];
  };

  for (const rawLine of robotsText.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, '').trim();
    if (!line) {
      continue;
    }

    const [rawKey, ...rest] = line.split(':');
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(':').trim();

    if (key === 'user-agent') {
      if (currentRules.length > 0) {
        flush();
      }
      currentAgents.push(value);
      continue;
    }

    if ((key === 'allow' || key === 'disallow') && currentAgents.length > 0) {
      currentRules.push({ directive: key, path: value });
    }
  }

  flush();

  const matchedGroups = groups.filter((group) =>
    group.agents.some((agent) => robotAgentMatches(targetUserAgent, agent)),
  );
  if (matchedGroups.length === 0) {
    return { userAgent: targetUserAgent, rules: [] };
  }

  const bestSpecificity = Math.max(
    ...matchedGroups.flatMap((group) =>
      group.agents
        .filter((agent) => robotAgentMatches(targetUserAgent, agent))
        .map((agent) => (agent === '*' ? 0 : agent.length)),
    ),
  );
  const rules = matchedGroups
    .filter((group) =>
      group.agents.some((agent) => robotAgentMatches(targetUserAgent, agent) && (agent === '*' ? 0 : agent.length) === bestSpecificity),
    )
    .flatMap((group) => group.rules)
    .filter((rule) => rule.path);

  return { userAgent: targetUserAgent, rules };
}

function isDisallowedByRobots(url, robotsRules) {
  const { pathname } = new URL(url);
  const matches = (robotsRules ?? [])
    .filter((rule) => pathname.startsWith(rule.path))
    .sort((first, second) => second.path.length - first.path.length);
  return matches[0]?.directive === 'disallow';
}

function summarizeRobots(robots) {
  return {
    checked: Boolean(robots.checked),
    url: robots.url,
    status: robots.status,
    userAgent: robots.userAgent,
    disallowRuleCount: robots.rules?.filter((rule) => rule.directive === 'disallow').length ?? 0,
    allowRuleCount: robots.rules?.filter((rule) => rule.directive === 'allow').length ?? 0,
    error: robots.error,
  };
}

function sourceFetchUrls(source) {
  if (source.id === 'airport-official-pages') {
    return [source.url].filter(Boolean);
  }
  return [...new Set([source.url, ...(source.fetchUrls ?? [])].filter(Boolean))];
}

function isTransportFetchError(reason) {
  return /ERR_HTTP2_PROTOCOL_ERROR|ERR_CONNECTION|ERR_TIMED_OUT|Timeout|Operation timed out|aborted/i.test(
    String(reason ?? ''),
  );
}

function userAgentForSource(source) {
  if (userTriggeredAiSourceIds.has(source?.id)) {
    return userTriggeredAiUserAgent;
  }
  return browserLikeSourceIds.has(source?.id) ? browserLikeUserAgent : intakeUserAgent;
}

async function fetchText(url, source = null) {
  if (sourceFetchDriver === 'playwright') {
    try {
      return await fetchTextWithPlaywright(url, source);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (httpProtocolFallbackSourceIds.has(source?.id) && /ERR_HTTP2_PROTOCOL_ERROR/i.test(reason)) {
        return fetchHttpText(url, source);
      }
      throw error;
    }
  }

  return fetchHttpText(url, source);
}

async function fetchHttpText(url, source = null) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/json,text/plain;q=0.9,*/*;q=0.8',
        'User-Agent': userAgentForSource(source),
      },
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      finalUrl: response.url,
      contentType: response.headers.get('content-type') ?? '',
      text,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function firstExistingExecutable() {
  for (const candidate of chromeExecutableCandidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next installed browser.
    }
  }

  return null;
}

async function getPlaywrightBrowser() {
  if (!playwrightBrowserPromise) {
    playwrightBrowserPromise = (async () => {
      const { chromium } = await import('playwright');
      const executablePath = await firstExistingExecutable();
      return chromium.launch({
        headless: true,
        executablePath: executablePath ?? undefined,
      });
    })();
  }

  return playwrightBrowserPromise;
}

async function closePlaywrightBrowser() {
  if (!playwrightBrowserPromise) {
    return;
  }

  const browser = await playwrightBrowserPromise;
  playwrightBrowserPromise = null;
  await browser.close();
}

async function fetchTextWithPlaywright(url, source = null) {
  const browser = await getPlaywrightBrowser();
  const context = await browser.newContext({
    userAgent: userAgentForSource(source),
  });
  const page = await context.newPage();

  try {
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs,
    });

    if (!response) {
      throw new Error('no response');
    }

    if (playwrightNetworkIdleMs > 0) {
      await page.waitForLoadState('networkidle', { timeout: Math.min(timeoutMs, playwrightNetworkIdleMs) }).catch(() => {});
    }

    const headers = response.headers();
    const contentType = headers['content-type'] ?? '';
    const text = contentType.includes('text/html') ? await page.content() : await response.text();
    const status = response.status();

    return {
      ok: status >= 200 && status < 400,
      status,
      statusText: response.statusText(),
      finalUrl: page.url(),
      contentType,
      text,
    };
  } finally {
    await context.close();
  }
}

async function fetchTextWithDefaultBrowser(url) {
  const browser = await getPlaywrightBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs,
    });

    if (!response) {
      throw new Error('no response');
    }

    if (playwrightNetworkIdleMs > 0) {
      await page.waitForLoadState('networkidle', { timeout: Math.min(timeoutMs, playwrightNetworkIdleMs) }).catch(() => {});
    }

    const headers = response.headers();
    const contentType = headers['content-type'] ?? '';
    const text = contentType.includes('text/html') ? await page.content() : await response.text();
    const status = response.status();

    return {
      ok: status >= 200 && status < 400,
      status,
      statusText: response.statusText(),
      finalUrl: page.url(),
      contentType,
      text,
    };
  } finally {
    await context.close();
  }
}

async function fetchSourceSeed(source) {
  const attempts = [];
  let fallback = null;
  let repeatedTransportErrors = 0;

  for (const url of sourceFetchUrls(source)) {
    const robots = await fetchRobots(url, source);
    const attempt = {
      url,
      robots: summarizeRobots(robots),
    };

    if (robots.checked && isDisallowedByRobots(url, robots.rules)) {
      attempts.push({
        ...attempt,
        status: 'skipped',
        reason: 'robots_disallow',
      });
      continue;
    }

    try {
      const fetched = await fetchText(url, source);
      const completed = {
        ...attempt,
        status: fetched.ok ? 'fetched' : 'http_error',
        httpStatus: fetched.status,
        finalUrl: fetched.finalUrl,
        contentType: fetched.contentType,
        bytes: Buffer.byteLength(fetched.text),
      };
      attempts.push(completed);

      if (fetched.ok) {
        return { fetched, robots, sourceUrl: url, fetchAttempts: attempts };
      }

      fallback ??= { fetched, robots, sourceUrl: url };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      attempts.push({
        ...attempt,
        status: 'fetch_error',
        reason,
      });
      repeatedTransportErrors = isTransportFetchError(reason) ? repeatedTransportErrors + 1 : 0;
      if (!fallback && repeatedFetchErrorLimit > 0 && repeatedTransportErrors >= repeatedFetchErrorLimit) {
        attempts.push({
          url,
          robots: summarizeRobots(robots),
          status: 'skipped',
          reason: `repeated_transport_errors_${repeatedTransportErrors}`,
        });
        break;
      }
    }
  }

  if (fallback) {
    return { ...fallback, fetchAttempts: attempts };
  }

  return {
    error: attempts.findLast((attempt) => attempt.reason)?.reason ?? 'fetch failed',
    fetchAttempts: attempts,
  };
}

async function fetchJson(url) {
  const response = await fetchHttpText(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  return {
    finalUrl: response.finalUrl,
    json: JSON.parse(response.text),
    text: response.text,
  };
}

function compactOneworldLounge(lounge, airport) {
  return {
    sourceRecordId: String(lounge.Id ?? lounge.ExternalId ?? `${lounge.AirportCode}-${lounge.Name}-${lounge.Terminal}`),
    name: lounge.Name,
    airportCode: lounge.AirportCode,
    airportName: lounge.AirportName,
    airportCity: airport?.City ?? '',
    airportRegion: airport?.Region ?? '',
    airportCoordinates: {
      lat: Number(airport?.Latitude),
      lon: Number(airport?.Longitude),
    },
    terminal: lounge.Terminal,
    concourse: lounge.Concourse,
    near: lounge.Near,
    securitySide: lounge.LocationSecurity,
    operator: lounge.OwnedBy,
    accessClass: lounge.AccessClass,
    accessTier: lounge.AccessTier,
    accessConditions: lounge.AccessConditions,
    accessNotes: lounge.AccessNotes,
    openHours: lounge.OpenHours,
    airlines: (lounge.Airlines ?? []).map((airline) => ({
      code: airline.Code,
      name: airline.Name,
    })),
    amenities: Object.fromEntries(
      [
        'BusinessCenter',
        'TV',
        'FoodBeverageSnackBuffet',
        'Phone',
        'PreFlightDinner',
        'RelaxationRoom',
        'Shower',
        'SPA',
        'WheelchairAccess',
        'WiFi',
        'FoodBeverageHotBuffet',
        'AirConditioning',
        'Restroom',
        'RunwayViews',
        'FlighInformationScreen',
      ]
        .filter((key) => Object.hasOwn(lounge, key))
        .map((key) => [key, Boolean(lounge[key])]),
    ),
  };
}

async function fetchOneworldStructuredRecords(runDir) {
  const airportsResponse = await fetchJson(oneworldAirportsUrl);
  const airports = Array.isArray(airportsResponse.json) ? airportsResponse.json : [];
  const airportByCode = new Map(airports.map((airport) => [airport.Code, airport]));
  const records = [];
  const errors = [];
  let index = 0;

  async function worker() {
    for (;;) {
      const current = index;
      index += 1;
      if (current >= airports.length) {
        return;
      }
      const airport = airports[current];
      const code = airport.Code;
      try {
        const loungeResponse = await fetchJson(`${oneworldLoungeUrl}/${encodeURIComponent(code)}?${oneworldLoungeQuery}`);
        const lounges = Array.isArray(loungeResponse.json) ? loungeResponse.json : [];
        for (const lounge of lounges) {
          records.push(compactOneworldLounge(lounge, airportByCode.get(lounge.AirportCode) ?? airport));
        }
      } catch (error) {
        errors.push({
          airportCode: code,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  await Promise.all(Array.from({ length: 6 }, worker));

  const deduped = new Map();
  for (const record of records) {
    deduped.set(record.sourceRecordId, record);
  }

  const snapshot = {
    generatedAt: new Date().toISOString(),
    airports: airports.length,
    errors,
    records: [...deduped.values()].sort((first, second) =>
      `${first.airportCode}-${first.name}`.localeCompare(`${second.airportCode}-${second.name}`),
    ),
  };
  const snapshotPath = path.join(runDir, 'oneworld-structured-records.json');
  await fs.writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

  return {
    api: {
      airportsUrl: oneworldAirportsUrl,
      loungeUrlTemplate: `${oneworldLoungeUrl}/{airportCode}`,
      airportCount: airports.length,
      errorCount: errors.length,
      snapshotFile: path.relative(projectRoot, snapshotPath),
    },
    records: snapshot.records,
  };
}

async function fetchTheClubStructuredRecords(runDir) {
  const response = await fetchHttpText(theClubLoungesUrl);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const snapshotPath = path.join(runDir, 'airport-dimensions-the-club-lounges.html');
  await fs.writeFile(snapshotPath, response.text, 'utf8');
  const baseRecords = parseTheClubStructuredRecords(response.text);
  const pages = [];
  const records = [];

  for (const [index, record] of baseRecords.entries()) {
    if (!record.sourceUrl?.startsWith('https://www.theclubairportlounges.com/lounges/')) {
      records.push(record);
      continue;
    }

    try {
      const detailResponse = await fetchHttpText(record.sourceUrl);
      if (!detailResponse.ok) {
        pages.push({
          url: record.sourceUrl,
          status: 'http_error',
          httpStatus: detailResponse.status,
          finalUrl: detailResponse.finalUrl,
        });
        records.push(record);
        continue;
      }

      const detailSnapshotPath = path.join(runDir, `airport-dimensions-the-club-detail-${String(index + 1).padStart(2, '0')}.html`);
      await fs.writeFile(detailSnapshotPath, detailResponse.text, 'utf8');
      records.push(mergeTheClubDetailRecord(record, detailResponse.text));
      pages.push({
        url: record.sourceUrl,
        status: 'fetched',
        httpStatus: detailResponse.status,
        finalUrl: detailResponse.finalUrl,
        snapshotFile: path.relative(projectRoot, detailSnapshotPath),
      });
    } catch (error) {
      pages.push({
        url: record.sourceUrl,
        status: 'fetch_error',
        reason: error instanceof Error ? error.message : String(error),
      });
      records.push(record);
    }

    await sleep(delayMs);
  }

  return {
    api: {
      url: theClubLoungesUrl,
      loungeUrlTemplate: 'https://www.theclubairportlounges.com/lounges/{slug}',
      recordCount: records.length,
      snapshotFile: path.relative(projectRoot, snapshotPath),
      pageCount: pages.length,
      fetchedPages: pages.filter((page) => page.status === 'fetched').length,
      pages,
    },
    records,
  };
}

async function fetchNo1StructuredRecords(runDir, source) {
  const pages = [];
  const records = [];

  for (const [index, url] of no1StructuredUrls.entries()) {
    const response = await fetchText(url, source);
    if (!response.ok) {
      pages.push({
        url,
        status: 'http_error',
        httpStatus: response.status,
        finalUrl: response.finalUrl,
      });
      continue;
    }

    const snapshotPath = path.join(runDir, `no1-lounges-structured-${String(index + 1).padStart(2, '0')}.html`);
    await fs.writeFile(snapshotPath, response.text, 'utf8');
    const pageRecords = parseNo1StructuredRecords(response.text, {
      url: response.finalUrl || url,
    });
    records.push(...pageRecords);
    pages.push({
      url,
      status: 'fetched',
      httpStatus: response.status,
      finalUrl: response.finalUrl,
      recordCount: pageRecords.length,
      snapshotFile: path.relative(projectRoot, snapshotPath),
    });
    await sleep(delayMs);
  }

  const byId = new Map(records.map((record) => [record.sourceRecordId, record]));
  return {
    api: {
      urls: no1StructuredUrls,
      pageCount: pages.length,
      fetchedPages: pages.filter((page) => page.status === 'fetched').length,
      recordCount: byId.size,
      pages,
    },
    records: [...byId.values()].sort((first, second) =>
      `${first.airportCode}-${first.name}`.localeCompare(`${second.airportCode}-${second.name}`),
    ),
  };
}

async function fetchBeRelaxStructuredRecords(runDir, source) {
  const response = await fetchText(beRelaxStructuredUrl, source);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const snapshotPath = path.join(runDir, 'be-relax-find-us.html');
  await fs.writeFile(snapshotPath, response.text, 'utf8');
  const records = parseBeRelaxStructuredRecords(response.text);

  return {
    api: {
      url: response.finalUrl || beRelaxStructuredUrl,
      recordCount: records.length,
      snapshotFile: path.relative(projectRoot, snapshotPath),
      parser: 'be-relax-structured',
    },
    records,
  };
}

async function fetchGamewayStructuredRecords(runDir, source) {
  const response = await fetchText(gamewayLocationsUrl, source);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const snapshotPath = path.join(runDir, 'gameway-locations.html');
  await fs.writeFile(snapshotPath, response.text, 'utf8');
  const baseRecords = parseGamewayStructuredRecords(response.text, {
    url: response.finalUrl || gamewayLocationsUrl,
  });
  const pages = [];
  const records = [];

  for (const [index, record] of baseRecords.entries()) {
    if (!record.sourceUrl || !record.sourceUrl.startsWith('https://gameway.gg/location/')) {
      records.push(record);
      continue;
    }

    try {
      const detailResponse = await fetchText(record.sourceUrl, source);
      if (!detailResponse.ok) {
        pages.push({
          url: record.sourceUrl,
          status: 'http_error',
          httpStatus: detailResponse.status,
          finalUrl: detailResponse.finalUrl,
        });
        records.push(record);
        continue;
      }

      const detailSnapshotPath = path.join(runDir, `gameway-detail-${String(index + 1).padStart(2, '0')}.html`);
      await fs.writeFile(detailSnapshotPath, detailResponse.text, 'utf8');
      records.push(mergeGamewayDetailRecord(record, detailResponse.text));
      pages.push({
        url: record.sourceUrl,
        status: 'fetched',
        httpStatus: detailResponse.status,
        finalUrl: detailResponse.finalUrl,
        snapshotFile: path.relative(projectRoot, detailSnapshotPath),
      });
    } catch (error) {
      pages.push({
        url: record.sourceUrl,
        status: 'fetch_error',
        reason: error instanceof Error ? error.message : String(error),
      });
      records.push(record);
    }

    await sleep(delayMs);
  }

  const byId = new Map(records.map((record) => [record.sourceRecordId, record]));
  return {
    api: {
      url: gamewayLocationsUrl,
      recordCount: byId.size,
      pageCount: pages.length,
      fetchedPages: pages.filter((page) => page.status === 'fetched').length,
      snapshotFile: path.relative(projectRoot, snapshotPath),
      pages,
    },
    records: [...byId.values()].sort((first, second) =>
      `${first.airportCode}-${first.name}-${first.near}`.localeCompare(`${second.airportCode}-${second.name}-${second.near}`),
    ),
  };
}

async function fetchSleepoverStructuredRecords(runDir, source) {
  const pages = [];
  const records = [];

  for (const [index, url] of sleepoverStructuredUrls.entries()) {
    const response = await fetchText(url, source);
    if (!response.ok) {
      pages.push({
        url,
        status: 'http_error',
        httpStatus: response.status,
        finalUrl: response.finalUrl,
      });
      continue;
    }

    const snapshotPath = path.join(runDir, `sleepover-terminal-${String(index + 1).padStart(2, '0')}.html`);
    await fs.writeFile(snapshotPath, response.text, 'utf8');
    const record = parseSleepoverStructuredRecord(response.text, {
      url: response.finalUrl || url,
    });
    if (record) {
      records.push(record);
    }
    pages.push({
      url,
      status: 'fetched',
      httpStatus: response.status,
      finalUrl: response.finalUrl,
      recordCount: record ? 1 : 0,
      snapshotFile: path.relative(projectRoot, snapshotPath),
    });
    await sleep(delayMs);
  }

  const byId = new Map(records.map((record) => [record.sourceRecordId, record]));
  return {
    api: {
      urls: sleepoverStructuredUrls,
      pageCount: pages.length,
      fetchedPages: pages.filter((page) => page.status === 'fetched').length,
      recordCount: byId.size,
      pages,
    },
    records: [...byId.values()].sort((first, second) =>
      `${first.airportCode}-${first.name}`.localeCompare(`${second.airportCode}-${second.name}`),
    ),
  };
}

async function fetchPlazaPremiumStructuredRecords(runDir, source) {
  const pages = [];
  const records = [];
  const discoveredUrls = [];
  try {
    const response = await fetchText(source.url, source);
    const snapshotPath = path.join(runDir, `${safeName(source.id)}-structured-index.html`);
    await fs.writeFile(snapshotPath, response.text, 'utf8');
    discoveredUrls.push(
      ...extractPlazaPremiumFindUrls(response.text, {
        baseUrl: response.finalUrl || source.url,
      }),
    );
    pages.push({
      url: source.url,
      status: response.ok ? 'fetched' : 'http_error',
      httpStatus: response.status,
      finalUrl: response.finalUrl,
      contentType: response.contentType,
      bytes: Buffer.byteLength(response.text),
      sha256: sha256(response.text),
      title: pageTitle(response.text),
      recordCount: 0,
      discoveredFindUrls: discoveredUrls.length,
      snapshotFile: path.relative(projectRoot, snapshotPath),
    });
  } catch (error) {
    pages.push({
      url: source.url,
      status: 'fetch_error',
      reason: error instanceof Error ? error.message : String(error),
      recordCount: 0,
      discoveredFindUrls: 0,
    });
  }

  const urls = [...new Set([...(source.fetchUrls ?? []), ...discoveredUrls])].slice(0, structuredDetailLimit);

  for (const [index, url] of urls.entries()) {
    try {
      const response = await fetchText(url, source);
      const snapshotPath = path.join(
        runDir,
        `${safeName(source.id)}-structured-${String(index + 1).padStart(2, '0')}.html`,
      );
      await fs.writeFile(snapshotPath, response.text, 'utf8');
      const pageRecords = parsePlazaPremiumStructuredRecords(response.text, {
        url: response.finalUrl || url,
      });
      records.push(...pageRecords);
      pages.push({
        url,
        status: response.ok ? 'fetched' : 'http_error',
        httpStatus: response.status,
        finalUrl: response.finalUrl,
        contentType: response.contentType,
        bytes: Buffer.byteLength(response.text),
        sha256: sha256(response.text),
        title: pageTitle(response.text),
        recordCount: pageRecords.length,
        snapshotFile: path.relative(projectRoot, snapshotPath),
      });
    } catch (error) {
      pages.push({
        url,
        status: 'fetch_error',
        reason: error instanceof Error ? error.message : String(error),
        recordCount: 0,
      });
    }

    await sleep(delayMs);
  }

  const byId = new Map(records.map((record) => [record.sourceRecordId, record]));
  return {
    api: {
      urls,
      pageCount: pages.length,
      fetchedPages: pages.filter((page) => page.status === 'fetched').length,
      recordCount: byId.size,
      pages,
    },
    records: [...byId.values()].sort((first, second) =>
      `${first.airportCode}-${first.name}-${first.terminal}`.localeCompare(
        `${second.airportCode}-${second.name}-${second.terminal}`,
      ),
    ),
  };
}

async function fetchMinuteSuitesStructuredRecords(runDir, source) {
  const pages = [];
  const records = [];
  const crawlDelayMs = Math.max(delayMs, 10000);

  for (const [index, url] of minuteSuitesStructuredUrls.entries()) {
    const response = await fetchText(url, source);
    if (!response.ok) {
      pages.push({
        url,
        status: 'http_error',
        httpStatus: response.status,
        finalUrl: response.finalUrl,
      });
      continue;
    }

    const snapshotPath = path.join(runDir, `minute-suites-location-${String(index + 1).padStart(2, '0')}.html`);
    await fs.writeFile(snapshotPath, response.text, 'utf8');
    const pageRecords = parseMinuteSuitesStructuredRecords(response.text, {
      url: response.finalUrl || url,
    });
    records.push(...pageRecords);
    pages.push({
      url,
      status: 'fetched',
      httpStatus: response.status,
      finalUrl: response.finalUrl,
      recordCount: pageRecords.length,
      snapshotFile: path.relative(projectRoot, snapshotPath),
    });
    await sleep(crawlDelayMs);
  }

  const byId = new Map(records.map((record) => [record.sourceRecordId, record]));
  return {
    api: {
      urls: minuteSuitesStructuredUrls,
      crawlDelayMs,
      pageCount: pages.length,
      fetchedPages: pages.filter((page) => page.status === 'fetched').length,
      recordCount: byId.size,
      pages,
    },
    records: [...byId.values()].sort((first, second) =>
      `${first.airportCode}-${first.name}-${first.near}`.localeCompare(`${second.airportCode}-${second.name}-${second.near}`),
    ),
  };
}

async function fetchQatarAirwaysStructuredRecords(runDir, source, indexHtml = '', indexUrl = source.url) {
  const discoveredUrls = parseQatarAirwaysLoungeLinks(indexHtml, { baseUrl: indexUrl }).map((link) => link.url);
  const urls = [...new Set([...discoveredUrls, ...qatarAirwaysStructuredUrls])];
  const pages = [];
  const records = [];

  for (const [index, url] of urls.entries()) {
    let response;
    try {
      response = await fetchText(url, source);
    } catch (error) {
      pages.push({
        url,
        status: 'fetch_error',
        reason: error instanceof Error ? error.message : String(error),
      });
      await sleep(delayMs);
      continue;
    }

    if (!response.ok) {
      pages.push({
        url,
        status: 'http_error',
        httpStatus: response.status,
        finalUrl: response.finalUrl,
      });
      await sleep(delayMs);
      continue;
    }

    const snapshotPath = path.join(runDir, `qatar-airways-lounge-${String(index + 1).padStart(2, '0')}.html`);
    await fs.writeFile(snapshotPath, response.text, 'utf8');
    const record = parseQatarAirwaysLoungeRecord(response.text, {
      url: response.finalUrl || url,
    });
    if (record) {
      records.push(record);
    }
    pages.push({
      url,
      status: 'fetched',
      httpStatus: response.status,
      finalUrl: response.finalUrl,
      recordCount: record ? 1 : 0,
      snapshotFile: path.relative(projectRoot, snapshotPath),
    });
    await sleep(delayMs);
  }

  const byId = new Map(records.map((record) => [record.sourceRecordId, record]));
  return {
    api: {
      urls,
      discoveredUrls: discoveredUrls.length,
      pageCount: pages.length,
      fetchedPages: pages.filter((page) => page.status === 'fetched').length,
      recordCount: byId.size,
      pages,
      parser: 'qatar-airways-structured',
    },
    records: [...byId.values()].sort((first, second) =>
      `${first.airportCode}-${first.name}`.localeCompare(`${second.airportCode}-${second.name}`),
    ),
  };
}

async function fetchQantasStructuredRecords(runDir, source, indexHtml = '', indexUrl = source.url) {
  const indexLinks = parseQantasLoungeLinks(indexHtml, { baseUrl: indexUrl });
  const fallbackIndexResponse = indexLinks.length > 0 ? null : await fetchText(qantasStructuredIndexUrl, source);
  const links = fallbackIndexResponse?.ok
    ? parseQantasLoungeLinks(fallbackIndexResponse.text, { baseUrl: fallbackIndexResponse.finalUrl || qantasStructuredIndexUrl })
    : indexLinks;
  const detailLinks = structuredDetailLimit > 0 ? links.slice(0, structuredDetailLimit) : links;
  const pages = [];
  const records = [];

  for (const [index, link] of detailLinks.entries()) {
    try {
      const response = await fetchText(link.url, source);
      if (!response.ok) {
        pages.push({
          url: link.url,
          title: link.title,
          status: 'http_error',
          httpStatus: response.status,
          finalUrl: response.finalUrl,
        });
        await sleep(delayMs);
        continue;
      }

      const snapshotPath = path.join(runDir, `qantas-lounge-${String(index + 1).padStart(2, '0')}.html`);
      await fs.writeFile(snapshotPath, response.text, 'utf8');
      const record = parseQantasLoungeRecord(response.text, {
        url: response.finalUrl || link.url,
      });
      if (record) {
        records.push(record);
      }
      pages.push({
        url: link.url,
        title: link.title,
        status: 'fetched',
        httpStatus: response.status,
        finalUrl: response.finalUrl,
        recordCount: record ? 1 : 0,
        snapshotFile: path.relative(projectRoot, snapshotPath),
      });
    } catch (error) {
      pages.push({
        url: link.url,
        title: link.title,
        status: 'fetch_error',
        reason: error instanceof Error ? error.message : String(error),
      });
    }
    await sleep(delayMs);
  }

  const byId = new Map(records.map((record) => [record.sourceRecordId, record]));
  return {
    api: {
      url: indexUrl,
      fallbackIndexUrl: qantasStructuredIndexUrl,
      discoveredLinks: links.length,
      detailLimit: structuredDetailLimit,
      pageCount: pages.length,
      fetchedPages: pages.filter((page) => page.status === 'fetched').length,
      recordCount: byId.size,
      pages,
      parser: 'qantas-structured',
    },
    records: [...byId.values()].sort((first, second) =>
      `${first.airportCode}-${first.name}`.localeCompare(`${second.airportCode}-${second.name}`),
    ),
  };
}

async function fetchPrimeclassStructuredRecords(runDir, indexHtml, indexUrl, source) {
  const indexLinks = parsePrimeclassIndexLinks(indexHtml);
  const pages = [];
  const records = [];

  const limitedLinks = structuredDetailLimit > 0 ? indexLinks.slice(0, structuredDetailLimit) : indexLinks;
  for (const [index, link] of limitedLinks.entries()) {
    try {
      const response = await fetchText(link.url, source);
      if (!response.ok) {
        pages.push({
          url: link.url,
          status: 'http_error',
          httpStatus: response.status,
          finalUrl: response.finalUrl,
        });
        continue;
      }

      const snapshotPath = path.join(runDir, `primeclass-detail-${String(index + 1).padStart(2, '0')}.html`);
      await fs.writeFile(snapshotPath, response.text, 'utf8');
      const record = parsePrimeclassStructuredRecord(response.text, {
        url: response.finalUrl || link.url,
      });
      if (record) {
        records.push(record);
      }
      pages.push({
        url: link.url,
        status: 'fetched',
        httpStatus: response.status,
        finalUrl: response.finalUrl,
        recordCount: record ? 1 : 0,
        snapshotFile: path.relative(projectRoot, snapshotPath),
      });
    } catch (error) {
      pages.push({
        url: link.url,
        status: 'fetch_error',
        reason: error instanceof Error ? error.message : String(error),
      });
    }

    await sleep(delayMs);
  }

  const byId = new Map(records.map((record) => [record.sourceRecordId, record]));
  return {
    api: {
      url: indexUrl,
      discoveredLinks: indexLinks.length,
      detailLimit: structuredDetailLimit,
      recordCount: byId.size,
      pageCount: pages.length,
      fetchedPages: pages.filter((page) => page.status === 'fetched').length,
      pages,
    },
    records: [...byId.values()].sort((first, second) =>
      `${first.airportCode}-${first.name}`.localeCompare(`${second.airportCode}-${second.name}`),
    ),
  };
}

async function fetchAmericanStructuredRecords(runDir) {
  const pages = [];
  const records = [];

  for (const [index, url] of americanStructuredUrls.entries()) {
    const response = await fetchTextWithDefaultBrowser(url);
    if (!response.ok) {
      pages.push({
        url,
        status: 'http_error',
        httpStatus: response.status,
        finalUrl: response.finalUrl,
      });
      continue;
    }

    const snapshotPath = path.join(runDir, `american-club-${String(index + 1).padStart(2, '0')}.html`);
    await fs.writeFile(snapshotPath, response.text, 'utf8');
    const pageRecords = parseAmericanAirlinesClubRecords(response.text, {
      url: response.finalUrl || url,
    });
    records.push(...pageRecords);
    pages.push({
      url,
      status: 'fetched',
      httpStatus: response.status,
      finalUrl: response.finalUrl,
      recordCount: pageRecords.length,
      snapshotFile: path.relative(projectRoot, snapshotPath),
    });
    await sleep(delayMs);
  }

  const byId = new Map(records.map((record) => [record.sourceRecordId, record]));
  return {
    api: {
      urls: americanStructuredUrls,
      pageCount: pages.length,
      fetchedPages: pages.filter((page) => page.status === 'fetched').length,
      recordCount: byId.size,
      pages,
    },
    records: [...byId.values()].sort((first, second) =>
      `${first.airportCode}-${first.name}-${first.near}`.localeCompare(`${second.airportCode}-${second.name}-${second.near}`),
    ),
  };
}

function isPanynjAirportUrl(url) {
  return /\/\/(?:www\.)?(?:jfkairport|laguardiaairport|newarkairport)\.com\//i.test(String(url ?? ''));
}

function panynjAirportCode(url) {
  const host = (() => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return String(url ?? '').toLowerCase();
    }
  })();
  if (host.includes('jfkairport.com')) return 'JFK';
  if (host.includes('laguardiaairport.com')) return 'LGA';
  if (host.includes('newarkairport.com')) return 'EWR';
  return 'PANYNJ';
}

async function waitForGraphqlValue(getValue, timeout = timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = getValue();
    if (value) {
      return value;
    }
    await sleep(250);
  }
  return null;
}

async function fetchPanynjOfficialStructuredRecords(url, runDir, source, index) {
  const browser = await getPlaywrightBrowser();
  const context = await browser.newContext({
    userAgent: userAgentForSource(source),
  });
  const page = await context.newPage();
  const listUrl = `${url}${url.includes('?') ? '&' : '?'}filterGroups=Lounges`;
  const code = panynjAirportCode(url);
  const detailsById = {};
  let listPayload = null;

  page.on('response', async (response) => {
    if (!response.url().endsWith('/api/graphql') || response.status() !== 200) {
      return;
    }
    try {
      const payload = await response.json();
      if (payload?.data?.getRelaxPOIs?.results) {
        listPayload = payload.data.getRelaxPOIs;
      }
      if (payload?.data?.getPOI?.id) {
        detailsById[payload.data.getPOI.id] = payload.data.getPOI;
      }
    } catch {
      // Ignore non-JSON or already-consumed responses.
    }
  });

  try {
    await page.goto(listUrl, {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs,
    });
    await waitForGraphqlValue(() => listPayload, timeoutMs);
    const cards = (listPayload?.results ?? []).filter((card) => /relax\.lounge/i.test(String(card.category ?? '')));

    for (const card of cards) {
      const detailUrl = new URL('/dine-shop-relax/lounge-and-rest/detail', url);
      detailUrl.searchParams.set('poiId', String(card.id ?? ''));
      detailUrl.searchParams.set('name', String(card.name ?? ''));
      detailUrl.searchParams.set('structureName', String(card.structureName ?? ''));
      detailUrl.searchParams.set('returnTo', '/dine-shop-relax/lounge-and-rest');
      await page.goto(detailUrl.toString(), {
        waitUntil: 'domcontentloaded',
        timeout: timeoutMs,
      }).catch(() => {});
      await waitForGraphqlValue(() => detailsById[card.id], Math.min(timeoutMs, 8000));
      await sleep(150);
    }

    const snapshot = {
      url,
      listUrl,
      airportCode: code,
      list: listPayload,
      detailsById,
    };
    const snapshotPath = path.join(runDir, `airport-official-lounges-${String(index + 1).padStart(2, '0')}-panynj.json`);
    await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf8');
    const pageRecords = parsePanynjOfficialLoungeRecords({
      pois: cards,
      detailsById,
      url,
    });

    return {
      page: {
        url,
        status: listPayload ? 'fetched' : 'http_error',
        httpStatus: listPayload ? 200 : 0,
        finalUrl: page.url(),
        recordCount: pageRecords.length,
        snapshotFile: path.relative(projectRoot, snapshotPath),
      },
      records: pageRecords,
    };
  } finally {
    await context.close();
  }
}

async function fetchAirportOfficialStructuredRecords(runDir, source) {
  const pages = [];
  const records = [];

  for (const [index, url] of airportOfficialLoungeUrls.entries()) {
    if (isPanynjAirportUrl(url)) {
      try {
        const result = await fetchPanynjOfficialStructuredRecords(url, runDir, source, index);
        pages.push(result.page);
        records.push(...result.records);
      } catch (error) {
        pages.push({
          url,
          status: 'fetch_error',
          reason: error instanceof Error ? error.message : String(error),
          httpStatus: 0,
        });
      }
      await sleep(delayMs);
      continue;
    }

    try {
      const response = await fetchText(url, source);
      if (!response.ok) {
        pages.push({
          url,
          status: 'http_error',
          httpStatus: response.status,
          finalUrl: response.finalUrl,
        });
        await sleep(delayMs);
        continue;
      }

      const snapshotPath = path.join(runDir, `airport-official-lounges-${String(index + 1).padStart(2, '0')}.html`);
      await fs.writeFile(snapshotPath, response.text, 'utf8');
      const pageRecords = parseAirportOfficialLoungeRecords(response.text, {
        url: response.finalUrl || url,
      });
      records.push(...pageRecords);
      pages.push({
        url,
        status: 'fetched',
        httpStatus: response.status,
        finalUrl: response.finalUrl,
        recordCount: pageRecords.length,
        snapshotFile: path.relative(projectRoot, snapshotPath),
      });
    } catch (error) {
      pages.push({
        url,
        status: 'fetch_error',
        reason: error instanceof Error ? error.message : String(error),
        httpStatus: 0,
      });
    }
    await sleep(delayMs);
  }

  const byId = new Map(records.map((record) => [record.sourceRecordId, record]));
  return {
    api: {
      urls: airportOfficialLoungeUrls,
      pageCount: pages.length,
      fetchedPages: pages.filter((page) => page.status === 'fetched').length,
      recordCount: byId.size,
      pages,
    },
    records: [...byId.values()].sort((first, second) =>
      `${first.airportCode}-${first.name}-${first.near}`.localeCompare(`${second.airportCode}-${second.name}-${second.near}`),
    ),
  };
}

async function fetchRobots(url, source = null) {
  try {
    const origin = new URL(url).origin;
    const userAgent = userAgentForSource(source);
    const response = await fetchHttpText(`${origin}/robots.txt`, source);
    if (!response.ok) {
      return { checked: true, url: `${origin}/robots.txt`, userAgent, rules: [], status: response.status };
    }
    const parsed = parseRobots(response.text, userAgent);
    return {
      checked: true,
      url: `${origin}/robots.txt`,
      userAgent: parsed.userAgent,
      rules: parsed.rules,
      status: response.status,
    };
  } catch (error) {
    return {
      checked: false,
      url: null,
      userAgent: source ? userAgentForSource(source) : intakeUserAgent,
      rules: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function createReportStats(results, knownAirportCodes) {
  const fetched = results.filter((result) => result.status === 'fetched');
  return {
    totalSources: results.length,
    fetched: fetched.length,
    skipped: results.filter((result) => result.status === 'skipped').length,
    httpErrors: results.filter((result) => result.status === 'http_error').length,
    fetchErrors: results.filter((result) => result.status === 'fetch_error').length,
    childPagesFetched: results.reduce(
      (total, result) => total + (result.childPages ?? []).filter((page) => page.status === 'fetched').length,
      0,
    ),
    discoveredAirportCodes: new Set(results.flatMap((result) => result.airportCodes)).size,
    discoveredLoungeLinks: results.reduce((total, result) => total + result.loungeLinks.length, 0),
    knownAirportCodes: knownAirportCodes.size,
  };
}

async function mergeRequestedSourceResults(report, results, knownAirportCodes) {
  if (requestedSourceIds.size === 0) {
    return report;
  }

  let existing;
  try {
    existing = JSON.parse(await fs.readFile(publicReportPath, 'utf8'));
  } catch {
    return report;
  }

  const bySourceId = new Map((existing.sources ?? []).map((source) => [source.sourceId, source]));
  for (const result of results) {
    bySourceId.set(result.sourceId, result);
  }
  const registryOrder = cloneSourceRegistry().map((source) => source.id);
  const sources = [...bySourceId.values()].sort(
    (first, second) => registryOrder.indexOf(first.sourceId) - registryOrder.indexOf(second.sourceId),
  );

  return {
    ...existing,
    generatedAt: report.generatedAt,
    runId: report.runId,
    policy: report.policy,
    stats: createReportStats(sources, knownAirportCodes),
    sources,
  };
}

async function scrapeSource(source, runDir, knownAirportCodes) {
  if (source.adapter === 'licensed_api' || source.status === 'blocked') {
    return {
      sourceId: source.id,
      publisher: source.publisher,
      url: source.url,
      adapter: source.adapter,
      status: 'skipped',
      reason: source.adapter === 'licensed_api' ? 'licensed_api_not_fetched' : 'source_marked_blocked',
      records: 0,
      airportCodes: [],
      loungeLinks: [],
    };
  }

  const seed = await fetchSourceSeed(source);
    if (!seed.fetched) {
    if (source.id === 'american' || source.id === 'qatar-airways' || source.id === 'airport-official-pages') {
      try {
        const structuredApi = source.id === 'american'
          ? await fetchAmericanStructuredRecords(runDir)
          : source.id === 'qatar-airways'
            ? await fetchQatarAirwaysStructuredRecords(runDir, source)
            : await fetchAirportOfficialStructuredRecords(runDir, source);
        const airportCodes = new Set();
        for (const record of structuredApi.records) {
          if (/^[A-Z0-9]{3}$/.test(record.airportCode)) {
            airportCodes.add(record.airportCode);
          }
        }

        if (structuredApi.records.length > 0) {
          return {
            sourceId: source.id,
            publisher: source.publisher,
            url: source.url,
            sourceUrl: source.url,
            finalUrl: source.url,
            adapter: source.adapter,
            status: 'fetched',
            httpStatus: 200,
            contentType: 'text/html',
            bytes: 0,
            sha256: sha256(JSON.stringify(structuredApi.records)),
            title: source.publisher,
            airportCodes: [...airportCodes].sort(),
            loungeLinks: [],
            childPages: [],
            structuredApi: structuredApi.api,
            structuredRecords: structuredApi.records,
            records: structuredApi.records.length,
            snapshotFile: '',
            robots: { checked: false, rules: [] },
            fetchAttempts: seed.fetchAttempts,
          };
        }
      } catch {
        // Fall through to the original seed failure report.
      }
    }

    return {
      sourceId: source.id,
      publisher: source.publisher,
      url: source.url,
      adapter: source.adapter,
      status: 'fetch_error',
      reason: seed.error,
      fetchAttempts: seed.fetchAttempts,
      records: 0,
      airportCodes: [],
      loungeLinks: [],
    };
  }

  let sourceRobots = seed.robots;
  try {
    const { fetched, robots, sourceUrl, fetchAttempts } = seed;
    sourceRobots = robots;
    const extension = fetched.contentType.includes('json') ? 'json' : 'html';
    const snapshotPath = path.join(runDir, `${safeName(source.id)}.${extension}`);
    await fs.writeFile(snapshotPath, fetched.text, 'utf8');

    const text = cleanText(fetched.text);
    const links = extractLinks(fetched.text, fetched.finalUrl);
    const loungeLinks = links.filter(isLikelyLoungeLink).slice(0, 100);
    const childPages = [];
    const childStructuredRecords = [];
    const airportCodes = new Set(extractAirportCodes(text, knownAirportCodes));
    const childLinks = loungeLinks.filter((link) => shouldCrawlChildLink(source, link)).slice(0, childPageLimit);

    for (const [index, childLink] of childLinks.entries()) {
      const childRobots = await fetchRobots(childLink, source);
      if (childRobots.checked && isDisallowedByRobots(childLink, childRobots.rules)) {
        childPages.push({
          url: childLink,
          status: 'skipped',
          reason: 'robots_disallow',
          airportCodes: [],
          loungeLinks: [],
          robots: summarizeRobots(childRobots),
        });
        await sleep(delayMs);
        continue;
      }

      try {
        const childFetched = await fetchText(childLink, source);
        const childExtension = childFetched.contentType.includes('json') ? 'json' : 'html';
        const childSnapshotPath = path.join(runDir, `${safeName(source.id)}-${String(index + 1).padStart(2, '0')}.${childExtension}`);
        await fs.writeFile(childSnapshotPath, childFetched.text, 'utf8');
        const childText = cleanText(childFetched.text);
        const childAirportCodes = extractAirportCodes(childText, knownAirportCodes);
        const childStructuredRecord =
          source.id === 'escape-lounges'
            ? parseEscapeLoungeStructuredRecord(childFetched.text, {
                url: childLink,
                finalUrl: childFetched.finalUrl,
              })
            : source.id === 'marhaba'
              ? parseMarhabaStructuredRecord(childFetched.text, {
                  url: childFetched.finalUrl || childLink,
                })
            : null;
        const childStructuredRecordsForPage =
          source.id === 'plaza-premium'
            ? parsePlazaPremiumStructuredRecords(childFetched.text, {
                url: childFetched.finalUrl || childLink,
              })
            : source.id === 'marhaba'
              ? parseMarhabaStructuredRecords(childFetched.text, {
                  url: childFetched.finalUrl || childLink,
                })
            : childStructuredRecord
              ? [childStructuredRecord]
              : [];
        for (const code of childAirportCodes) {
          airportCodes.add(code);
        }
        for (const record of childStructuredRecordsForPage) {
          airportCodes.add(record.airportCode);
          childStructuredRecords.push(record);
        }
        childPages.push({
          url: childLink,
          finalUrl: childFetched.finalUrl,
          status: childFetched.ok ? 'fetched' : 'http_error',
          httpStatus: childFetched.status,
          contentType: childFetched.contentType,
          bytes: Buffer.byteLength(childFetched.text),
          sha256: sha256(childFetched.text),
          title: pageTitle(childFetched.text),
          airportCodes: childAirportCodes,
          loungeLinks: extractLinks(childFetched.text, childFetched.finalUrl).filter(isLikelyLoungeLink).slice(0, 25),
          snapshotFile: path.relative(projectRoot, childSnapshotPath),
          robots: summarizeRobots(childRobots),
        });
      } catch (error) {
        childPages.push({
          url: childLink,
          status: 'fetch_error',
          reason: error instanceof Error ? error.message : String(error),
          airportCodes: [],
          loungeLinks: [],
          robots: summarizeRobots(childRobots),
        });
      }

      await sleep(delayMs);
    }

    const childLoungeLinks = childPages.flatMap((page) => page.loungeLinks ?? []);
    const allLoungeLinks = [...new Set([...loungeLinks, ...childLoungeLinks])].slice(0, 200);
    let structuredApi = null;
    let structuredRecords = childStructuredRecords;

    if (source.id === 'oneworld') {
      structuredApi = await fetchOneworldStructuredRecords(runDir);
      structuredRecords = structuredApi.records;
      for (const record of structuredRecords) {
        if (/^[A-Z0-9]{3}$/.test(record.airportCode)) {
          airportCodes.add(record.airportCode);
        }
      }
    }

    if (source.id === 'airport-dimensions') {
      structuredApi = await fetchTheClubStructuredRecords(runDir);
      structuredRecords = structuredApi.records;
      for (const record of structuredRecords) {
        if (/^[A-Z0-9]{3}$/.test(record.airportCode)) {
          airportCodes.add(record.airportCode);
        }
      }
    }

    if (source.id === 'no1-lounges') {
      structuredApi = await fetchNo1StructuredRecords(runDir, source);
      structuredRecords = structuredApi.records;
      for (const record of structuredRecords) {
        if (/^[A-Z0-9]{3}$/.test(record.airportCode)) {
          airportCodes.add(record.airportCode);
        }
      }
    }

    if (source.id === 'plaza-premium') {
      structuredApi = await fetchPlazaPremiumStructuredRecords(runDir, source);
      structuredRecords = [...childStructuredRecords, ...structuredApi.records];
      for (const record of structuredRecords) {
        if (/^[A-Z0-9]{3}$/.test(record.airportCode)) {
          airportCodes.add(record.airportCode);
        }
      }
    }

    if (source.id === 'be-relax') {
      structuredApi = await fetchBeRelaxStructuredRecords(runDir, source);
      structuredRecords = structuredApi.records;
      airportCodes.clear();
      for (const record of structuredRecords) {
        if (/^[A-Z0-9]{3}$/.test(record.airportCode)) {
          airportCodes.add(record.airportCode);
        }
      }
    }

    if (source.id === 'gameway') {
      structuredApi = await fetchGamewayStructuredRecords(runDir, source);
      structuredRecords = structuredApi.records;
      for (const record of structuredRecords) {
        if (/^[A-Z0-9]{3}$/.test(record.airportCode)) {
          airportCodes.add(record.airportCode);
        }
      }
    }

    if (source.id === 'primeclass') {
      structuredApi = await fetchPrimeclassStructuredRecords(runDir, fetched.text, fetched.finalUrl || sourceUrl || source.url, source);
      structuredRecords = structuredApi.records;
      airportCodes.clear();
      for (const record of structuredRecords) {
        if (/^[A-Z0-9]{3}$/.test(record.airportCode)) {
          airportCodes.add(record.airportCode);
        }
      }
    }

    if (source.id === 'sleepover') {
      structuredApi = await fetchSleepoverStructuredRecords(runDir, source);
      structuredRecords = structuredApi.records;
      for (const record of structuredRecords) {
        if (/^[A-Z0-9]{3}$/.test(record.airportCode)) {
          airportCodes.add(record.airportCode);
        }
      }
    }

    if (source.id === 'minute-suites') {
      structuredApi = await fetchMinuteSuitesStructuredRecords(runDir, source);
      structuredRecords = structuredApi.records;
      for (const record of structuredRecords) {
        if (/^[A-Z0-9]{3}$/.test(record.airportCode)) {
          airportCodes.add(record.airportCode);
        }
      }
    }

    if (source.id === 'qatar-airways') {
      structuredApi = await fetchQatarAirwaysStructuredRecords(runDir, source, fetched.text, fetched.finalUrl || sourceUrl || source.url);
      structuredRecords = structuredApi.records;
      airportCodes.clear();
      for (const record of structuredRecords) {
        if (/^[A-Z0-9]{3}$/.test(record.airportCode)) {
          airportCodes.add(record.airportCode);
        }
      }
    }

    if (source.id === 'qantas') {
      structuredApi = await fetchQantasStructuredRecords(runDir, source, fetched.text, fetched.finalUrl || sourceUrl || source.url);
      structuredRecords = structuredApi.records;
      airportCodes.clear();
      for (const record of structuredRecords) {
        if (/^[A-Z0-9]{3}$/.test(record.airportCode)) {
          airportCodes.add(record.airportCode);
        }
      }
    }

    if (source.id === 'american') {
      structuredApi = await fetchAmericanStructuredRecords(runDir);
      structuredRecords = structuredApi.records;
      airportCodes.clear();
      for (const record of structuredRecords) {
        if (/^[A-Z0-9]{3}$/.test(record.airportCode)) {
          airportCodes.add(record.airportCode);
        }
      }
    }

    if (source.id === 'air-canada') {
      structuredRecords = parseAirCanadaLoungeRecords(fetched.text, {
        url: fetched.finalUrl || sourceUrl || source.url,
      });
      structuredApi = {
        api: {
          type: 'official_html',
          pages: [fetched.finalUrl || sourceUrl || source.url],
          parser: 'air-canada-maple-leaf-structured',
        },
        records: structuredRecords,
      };
      airportCodes.clear();
      for (const record of structuredRecords) {
        if (/^[A-Z0-9]{3}$/.test(record.airportCode)) {
          airportCodes.add(record.airportCode);
        }
      }
    }

    if (source.id === 'capital-one') {
      structuredRecords = parseCapitalOneLoungeRecords(fetched.text, {
        url: fetched.finalUrl || sourceUrl || source.url,
      });
      structuredApi = {
        api: {
          type: 'official_html',
          pages: [fetched.finalUrl || sourceUrl || source.url],
          parser: 'capital-one-lounges-structured',
        },
        records: structuredRecords,
      };
      airportCodes.clear();
      for (const record of structuredRecords) {
        if (/^[A-Z0-9]{3}$/.test(record.airportCode)) {
          airportCodes.add(record.airportCode);
        }
      }
    }

    if (source.id === 'chase-sapphire') {
      structuredRecords = parseChaseSapphireLoungeRecords(fetched.text, {
        url: fetched.finalUrl || sourceUrl || source.url,
      });
      structuredApi = {
        api: {
          type: 'official_html',
          pages: [fetched.finalUrl || sourceUrl || source.url],
          parser: 'chase-sapphire-lounges-structured',
        },
        records: structuredRecords,
      };
      airportCodes.clear();
      for (const record of structuredRecords) {
        if (/^[A-Z0-9]{3}$/.test(record.airportCode)) {
          airportCodes.add(record.airportCode);
        }
      }
    }

    if (source.id === 'delta') {
      structuredRecords = parseDeltaSkyClubRecords(fetched.text, {
        url: fetched.finalUrl || sourceUrl || source.url,
      });
      structuredApi = {
        api: {
          type: 'official_html',
          pages: [fetched.finalUrl || sourceUrl || source.url],
          parser: 'delta-sky-club-structured',
        },
        records: structuredRecords,
      };
      airportCodes.clear();
      for (const record of structuredRecords) {
        if (/^[A-Z0-9]{3}$/.test(record.airportCode)) {
          airportCodes.add(record.airportCode);
        }
      }
    }

    if (source.id === 'singapore-airlines') {
      structuredRecords = parseSingaporeAirlinesLoungeRecords(fetched.text, {
        url: fetched.finalUrl || sourceUrl || source.url,
      });
      structuredApi = {
        api: {
          type: 'official_html',
          pages: [fetched.finalUrl || sourceUrl || source.url],
          parser: 'singapore-airlines-silverkris-structured',
        },
        records: structuredRecords,
      };
      airportCodes.clear();
      for (const record of structuredRecords) {
        if (/^[A-Z0-9]{3}$/.test(record.airportCode)) {
          airportCodes.add(record.airportCode);
        }
      }
    }

    if (source.id === 'airport-official-pages') {
      structuredApi = await fetchAirportOfficialStructuredRecords(runDir, source);
      structuredRecords = structuredApi.records;
      airportCodes.clear();
      for (const record of structuredRecords) {
        if (/^[A-Z0-9]{3}$/.test(record.airportCode)) {
          airportCodes.add(record.airportCode);
        }
      }
    }

    const recordEstimate = Math.max(airportCodes.size, allLoungeLinks.length, structuredRecords.length);
    const structuredFallbackFetched = !fetched.ok && structuredRecords.length > 0;

    return {
      sourceId: source.id,
      publisher: source.publisher,
      url: source.url,
      sourceUrl,
      finalUrl: fetched.finalUrl,
      adapter: source.adapter,
      status: fetched.ok || structuredFallbackFetched ? 'fetched' : 'http_error',
      httpStatus: fetched.status,
      contentType: fetched.contentType,
      bytes: Buffer.byteLength(fetched.text),
      sha256: sha256(fetched.text),
      title: pageTitle(fetched.text),
      jsonLdBlocks: extractJsonLdCount(fetched.text),
      records: recordEstimate,
      airportCodes: [...airportCodes].sort(),
      loungeLinks: allLoungeLinks,
      structuredApi: structuredApi?.api,
      structuredRecords,
      childPages,
      fetchAttempts,
      snapshotFile: path.relative(projectRoot, snapshotPath),
      robots: summarizeRobots(sourceRobots),
    };
  } catch (error) {
    return {
      sourceId: source.id,
      publisher: source.publisher,
      url: source.url,
      adapter: source.adapter,
      status: 'fetch_error',
      reason: error instanceof Error ? error.message : String(error),
      fetchAttempts: seed.fetchAttempts,
      records: 0,
      airportCodes: [],
      loungeLinks: [],
      robots: summarizeRobots(sourceRobots),
    };
  }
}

async function main() {
  requireSourceIntakeRuntime();

  const runId = nowRunId();
  const runDir = path.join(cacheRoot, runId);
  await fs.mkdir(runDir, { recursive: true });

  const sources = cloneSourceRegistry().filter((source) => requestedSourceIds.size === 0 || requestedSourceIds.has(source.id));
  const knownAirportCodes = await loadKnownAirportCodes();
  const results = [];

  for (const [index, source] of sources.entries()) {
    console.error(`[${index + 1}/${sources.length}] ${source.id}`);
    const result = await scrapeSource(source, runDir, knownAirportCodes);
    console.error(`[${index + 1}/${sources.length}] ${source.id}: ${result.status}`);
    results.push(result);
    await sleep(delayMs);
  }

  const partialReport = {
    generatedAt: new Date().toISOString(),
    runId,
    policy: {
      fetchMode: 'single_public_source_url_per_registry_entry',
      childFetchMode: 'bounded_lounge_link_crawl',
      childPageLimit,
      childCrawlSources: [...childCrawlSourceIds].sort(),
      rawSnapshots: '.cache/source-snapshots',
      rawSnapshotsCommitted: false,
      guardrail: 'official/public sources only; no login, private API, captcha, or broad crawling',
      execution: {
        requiredRuntime: requiredIntakeRuntime,
        runtime: intakeRuntime,
        localScrawl: 'playwright_only',
        proofEnv: 'LOUNGE_GURU_SOURCE_INTAKE_RUNTIME=playwright',
        fetchDriver: sourceFetchDriver,
      },
      timeoutMs,
      delayMs,
    },
    stats: {
      ...createReportStats(results, knownAirportCodes),
    },
    sources: results,
  };
  const report = await mergeRequestedSourceResults(partialReport, results, knownAirportCodes);

  await fs.mkdir(path.dirname(publicReportPath), { recursive: true });
  await fs.writeFile(latestReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await fs.writeFile(publicReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(
    `Fetched ${report.stats.fetched}/${report.stats.totalSources} sources; ` +
      `${report.stats.discoveredAirportCodes} airport-code candidates; ` +
      `${report.stats.discoveredLoungeLinks} lounge-link candidates.`,
  );
  console.log(`Report: ${path.relative(projectRoot, publicReportPath)}`);
  console.log(`Raw snapshots: ${path.relative(projectRoot, runDir)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await closePlaywrightBrowser().catch(() => {});
});
