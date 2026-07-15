import test from 'node:test';
import assert from 'node:assert/strict';

import { createNonPriorityCandidateRecords } from '../scripts/lib/source-candidates.mjs';
import {
  parsePrimeclassIndexLinks,
  parsePrimeclassStructuredRecord,
} from '../scripts/lib/primeclass-structured.mjs';

test('Primeclass index parser extracts official lounge detail links', () => {
  const links = parsePrimeclassIndexLinks(`
    <a class="lounge-list-item" href="/en-EN/services/lounges/primeclass-lounge-terminal-2-sofia-international-airport">
      <img alt="Primeclass Lounge - Terminal 2 - Sofia International Airport">
      <span class="lounge-name">Primeclass Lounge - Terminal 2 - Sofia International Airport</span>
    </a>
  `);

  assert.equal(links.length, 1);
  assert.equal(links[0].name, 'Primeclass Lounge - Terminal 2 - Sofia International Airport');
  assert.equal(
    links[0].url,
    'https://tavoperationservices.com/en-EN/services/lounges/primeclass-lounge-terminal-2-sofia-international-airport',
  );
});

test('Primeclass detail parser extracts airport, terminal, location, and 24 hour operations', () => {
  const record = parsePrimeclassStructuredRecord(`
    <link rel="canonical" href="https://tavoperationservices.com/en-EN/services/lounges/primeclass-lounge-terminal-2-sofia-international-airport">
    <h1 class="page-title">Primeclass Lounge - Terminal 2 - Sofia International Airport</h1>
    <div class="page-summary">
      <p><strong>Location: </strong>Sofia Vasil Levski International Airport, Terminal 2, After Security Control, Schengen area, located on Level 2.</p>
      <p><strong>Opening Hours: </strong>Mondays to Sundays, 24/7</p>
      <p><strong>Note: </strong>Duration of stay is limited to 3 hours.</p>
    </div>
    </div></div></div>
  `, {
    url: 'https://tavoperationservices.com/en-EN/services/lounges/primeclass-lounge-terminal-2-sofia-international-airport',
  });

  assert.equal(record.airportCode, 'SOF');
  assert.equal(record.name, 'Primeclass Lounge - Terminal 2 - Sofia International Airport');
  assert.equal(record.brand, 'Primeclass Lounge');
  assert.equal(record.terminal, 'Terminal 2');
  assert.match(record.near, /Schengen area/);
  assert.equal(record.openHours.length, 7);
  assert.equal(record.openHours[0].OpenAllDay, true);
  assert.match(record.accessNotes, /3 hours/);
});

test('Primeclass parser does not treat VIP as an airport code', () => {
  const record = parsePrimeclassStructuredRecord(`
    <h1 class="page-title">Primeclass VIP Lounge - Almaty International Airport - General Aviation Terminal</h1>
    <div class="page-summary">
      <p><strong>Location: </strong>Almaty International Airport, General Aviation Terminal.</p>
      <p><strong>Opening Hours: </strong>Mondays to Sundays, 24/7</p>
    </div>
    </div></div></div>
  `, {
    url: 'https://tavoperationservices.com/en-EN/services/lounges/primeclass-vip-lounge-almaty-international-airport-south-terminal',
  });

  assert.equal(record.airportCode, 'ALA');
});

test('Primeclass parser extracts bare official 24/7 hours', () => {
  const record = parsePrimeclassStructuredRecord(`
    <h1 class="page-title">Primeclass Lounge - Adnan Menderes International Airport - Domestic</h1>
    <div class="page-summary">
      <p><strong>Location: </strong>Domestic Terminal, After 2nd Security Control.</p>
      <p><strong>Opening Hours:&nbsp;</strong> 24/7</p>
    </div>
    </div></div></div>
  `, {
    url: 'https://tavoperationservices.com/en-EN/services/lounges/adnan-menderes-international-airport-primeclass-lounge',
  });

  assert.equal(record.airportCode, 'ADB');
  assert.equal(record.openHours.length, 7);
  assert.equal(record.openHours.every((row) => row.OpenAllDay), true);
});

test('Primeclass parser extracts time ranges when daily appears after the range', () => {
  const record = parsePrimeclassStructuredRecord(`
    <h1 class="page-title">Primeclass Lounge - Zurich International Airport</h1>
    <div class="page-summary">
      <p><strong>Location: </strong>Terminal E, near to Gate E46, Non-Schengen area.</p>
      <p><strong>Opening Hours:&nbsp;</strong> 06:00 - 22:30 daily</p>
    </div>
    </div></div></div>
  `, {
    url: 'https://tavoperationservices.com/en-EN/services/lounges/zurich-international-airport-primeclass-lounge',
  });

  assert.equal(record.airportCode, 'ZRH');
  assert.equal(record.openHours.length, 7);
  assert.deepEqual(record.openHours.find((row) => row.Day === 1), {
    Day: 1,
    OpeningHour: '06:00',
    ClosingHour: '22:30',
  });
});

test('Primeclass parser extracts bare summary fields from current TAV detail markup', () => {
  const record = parsePrimeclassStructuredRecord(`
    <h1 class="page-title">Extime Lounge - Terminal 4 - Orly International Airport</h1>
    <div class="page-summary">
      <strong>Location: </strong>&nbsp;&nbsp;Terminal 4 ,&nbsp;After security and passport controls.<br />
      <br />
      <strong>Opening Hours:</strong>&nbsp;&nbsp;06:00 - 22:00&nbsp;<br />
      <br />
      <strong>Note:&nbsp;</strong>Duration of stay is&nbsp;limited to 3 hours.<br />
      <br />
      Infants under 4 years are admitted free.
    </div>
  `, {
    url: 'https://tavoperationservices.com/en-EN/services/lounges/extime-lounge-terminal-4-orly-international-airport',
  });

  assert.equal(record.airportCode, 'ORY');
  assert.equal(record.terminal, 'Terminal 4');
  assert.equal(record.near, 'Terminal 4 , After security and passport controls.');
  assert.equal(record.hoursText, '06:00 - 22:00');
  assert.deepEqual(record.openHours.find((row) => row.Day === 1), {
    Day: 1,
    OpeningHour: '06:00',
    ClosingHour: '22:00',
  });
  assert.match(record.accessNotes, /3 hours/);
});

test('Primeclass parser extracts official weekday rows', () => {
  const record = parsePrimeclassStructuredRecord(`
    <h1 class="page-title">Primeclass Lounge - Terminal 1 John F. Kennedy International Airport</h1>
    <div class="page-summary">
      <p><strong>Location: </strong>Terminal 1, After Security Control, located next to Gate 8&amp;9.</p>
      <p><strong>Opening Hours: </strong>Monday : 11:00 - 21:00 Tuesday : 11:00 - 01:30 Wednesday : 11:00 - 21:00 Thursday : 09:00 - 01:30 Friday : 11:00 - 21:00 Saturday : 09:00 - 01:30 Sunday : 11:00 - 21:00</p>
    </div>
    </div></div></div>
  `, {
    url: 'https://tavoperationservices.com/en-EN/services/lounges/john-f-kennedy-international-airport-primeclass-lounge',
  });

  assert.equal(record.airportCode, 'JFK');
  assert.equal(record.openHours.length, 7);
  assert.deepEqual(record.openHours.find((row) => row.Day === 1), {
    Day: 1,
    OpeningHour: '11:00',
    ClosingHour: '21:00',
  });
  assert.deepEqual(record.openHours.find((row) => row.Day === 6), {
    Day: 6,
    OpeningHour: '09:00',
    ClosingHour: '01:30',
  });
});

test('Primeclass parser extracts official 7/24 and dot-clock formats', () => {
  const med = parsePrimeclassStructuredRecord(`
    <h1 class="page-title">Primeclass Lounge - Madinah Airport</h1>
    <div class="page-summary">
      <p><strong>Location: </strong>International Terminal, after passport control.</p>
      <p><strong>Opening Hours:&nbsp;</strong> Open 7/24</p>
    </div>
    </div></div></div>
  `, {
    url: 'https://tavoperationservices.com/en-EN/services/lounges/primeclass-lounge-madinah-airport',
  });
  const fco = parsePrimeclassStructuredRecord(`
    <h1 class="page-title">Primeclass Lounge Rome Leonardo da Vinci Fiumicino Airport</h1>
    <div class="page-summary">
      <p><strong>Location: </strong>Located at Terminal 1 Mezzanine Floor</p>
      <p><strong>Opening Hours: </strong>5.30 - 22:00</p>
    </div>
    </div></div></div>
  `, {
    url: 'https://tavoperationservices.com/en-EN/services/lounges/primeclass-lounge-rome-leonardo-da-vinci-fiumicino-airport',
  });

  assert.equal(med.airportCode, 'MED');
  assert.equal(med.openHours.length, 7);
  assert.equal(med.openHours.every((row) => row.OpenAllDay), true);
  assert.equal(fco.airportCode, 'FCO');
  assert.deepEqual(fco.openHours.find((row) => row.Day === 1), {
    Day: 1,
    OpeningHour: '05:30',
    ClosingHour: '22:00',
  });
});

test('Primeclass parser preserves official schedule-dependent hours text', () => {
  const record = parsePrimeclassStructuredRecord(`
    <h1 class="page-title">Primeclass Lounge - Muscat International Airport</h1>
    <div class="page-summary">
      <p><strong>Location: </strong>Main Terminal, After Security and Passport Control, located on the 5th level.</p>
      <p><strong>Opening Hours: </strong>May vary according to flight schedule.</p>
      <p><strong>Note:&nbsp;</strong>Duration of stay is limited to 3 hours.</p>
    </div>
    </div></div></div>
  `, {
    url: 'https://tavoperationservices.com/en-EN/services/lounges/muscat-international-airport-primeclass-lounge',
  });

  assert.equal(record.airportCode, 'MCT');
  assert.deepEqual(record.openHours, []);
  assert.equal(record.hoursText, 'May vary according to flight schedule.');
});

test('Primeclass source record IDs use distinct detail page slugs', () => {
  const first = parsePrimeclassStructuredRecord(`
    <link rel="canonical" href="https://tavoperationservices.com/en-EN/services/lounges/vip-lounge-almaty-international-airport-international-arrival">
    <h1 class="page-title">Extime VIP Lounge - Almaty International Airport - International - Arrival</h1>
    <div class="page-summary">
      <p><strong>Location: </strong>Located at Terminal 2.</p>
      <p><strong>Opening Hours:&nbsp;</strong> 24/7</p>
    </div>
    </div></div></div>
  `);
  const second = parsePrimeclassStructuredRecord(`
    <link rel="canonical" href="https://tavoperationservices.com/en-EN/services/lounges/vip-lounge-almaty-international-airport-international-departure">
    <h1 class="page-title">Extime VIP Lounge - Almaty International Airport - International - Departure</h1>
    <div class="page-summary">
      <p><strong>Location: </strong>Located at Terminal 2.</p>
      <p><strong>Opening Hours:&nbsp;</strong> 24/7</p>
    </div>
    </div></div></div>
  `);

  assert.notEqual(first.sourceRecordId, second.sourceRecordId);
  assert.match(first.sourceRecordId, /international-arrival$/);
  assert.match(second.sourceRecordId, /international-departure$/);
});

function primeclassCandidate(structuredRecord) {
  return createNonPriorityCandidateRecords({
    generatedAt: '2026-07-14T00:00:00.000Z',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [10.4386, 36.0758] },
        properties: {
          airportCode: structuredRecord.airportCode,
          airportName: structuredRecord.airportName || `${structuredRecord.airportCode} Airport`,
          city: 'Test City',
          country: 'Test Country',
        },
      },
    ],
    report: {
      generatedAt: '2026-07-14T00:00:00.000Z',
      sources: [
        {
          sourceId: 'primeclass',
          status: 'fetched',
          finalUrl: 'https://tavoperationservices.com/en-EN/services/lounges',
          structuredRecords: [structuredRecord],
        },
      ],
    },
  })[0];
}

test('Primeclass candidate conversion treats N° gate text as an exact gate number', () => {
  const record = primeclassCandidate({
    sourceRecordId: 'NBE-primeclass',
    name: 'Primeclass Lounge - Enfidha-Hammamet International Airport',
    airportCode: 'NBE',
    airportName: 'Enfidha-Hammamet International Airport',
    terminal: 'International',
    near: 'International Departure Boarding Area, after immigration, next to boarding gate N°19B.',
    openHours: [{ Day: 1, OpeningHour: '06:00', ClosingHour: '22:00' }],
    sourceUrl: 'https://tavoperationservices.com/en-EN/services/lounges/enfidhahammamet-international-airport-primeclass-lounge',
    amenities: { Lounge: true },
  });

  assert.equal(record.location.gate, 'Gate 19B');
});

test('Primeclass candidate conversion keeps source-stated floor levels as near-position evidence', () => {
  const record = primeclassCandidate({
    sourceRecordId: 'SOF-primeclass',
    name: 'Primeclass Lounge - Terminal 2 - Sofia International Airport',
    airportCode: 'SOF',
    airportName: 'Sofia International Airport',
    terminal: 'Terminal 2',
    near: 'Terminal 2, After Security Control, Schengen area, located on Level 2.',
    openHours: [{ Day: 1, OpeningHour: '06:00', ClosingHour: '22:00' }],
    sourceUrl: 'https://tavoperationservices.com/en-EN/services/lounges/primeclass-lounge-terminal-2-sofia-international-airport',
    amenities: { Lounge: true },
  });

  assert.equal(record.location.gate, 'Level 2');
  assert.ok(record.sources[0].fieldCoverage.includes('location.gate'));
});
