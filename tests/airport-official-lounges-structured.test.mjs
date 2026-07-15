import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseAenaOfficialLoungeRecords,
  parseChangiOfficialLoungeRecords,
  parseChangiOfficialDetailLoungeRecords,
  parseDfwOfficialLoungeRecords,
  parseDubaiAirportsOfficialLoungeRecords,
  parseFiumicinoOfficialLoungeRecords,
  parseGatwickOfficialLoungeRecords,
  parseGruOfficialLoungeRecords,
  parseHanedaOfficialLoungeRecords,
  parseHamadOfficialLoungeRecords,
  parseHeathrowOfficialLoungeRecords,
  parseHongKongAirportOfficialLoungeRecords,
  parseManchesterOfficialLoungeRecords,
  parseMelbourneOfficialLoungeRecords,
  parseMiamiOfficialLoungeRecords,
  parsePanynjOfficialLoungeRecords,
  parsePhlOfficialLoungeRecords,
  parsePragueOfficialLoungeRecords,
  parseSeaOfficialLoungeRecords,
  parseSfoOfficialLoungeRecords,
  parseSydneyOfficialLoungeRecords,
  parseSuvarnabhumiOfficialLoungeRecords,
} from '../scripts/lib/airport-official-lounges-structured.mjs';

test('Aena official parser keeps published last-flight hours as text', () => {
  const records = parseAenaOfficialLoungeRecords(`
    <title>Sala VIP Joan Miró | Aeropuerto JT Barcelona-El Prat | Aena</title>
    <h1>Sala VIP Joan Miró (T1)</h1>
    <p>Reservada para viajeros con destino a países No Schengen.</p>
    <p>En la terminal T1, planta 2, zona de puertas de embarque D y E.</p>
    <p>Terminal T1. Planta 3. Zona destinos No Schengen</p>
    <p>Aeropuerto De 5:00 a último vuelo</p>
    <h2>Qué te ofrecemos</h2>
    <ul><li>Wi-Fi</li><li>Catering</li><li>Duchas</li><li>Zonas de trabajo</li></ul>
  `, { url: 'https://www.aena.es/es/josep-tarradellas-barcelona-el-prat/servicios-vip/salas-vip/sala-vip-joan-miro.html?p=1575033154799' });

  assert.equal(records.length, 1);
  assert.equal(records[0].airportCode, 'BCN');
  assert.equal(records[0].name, 'Sala VIP Joan Miró');
  assert.equal(records[0].terminal, 'Terminal 1');
  assert.equal(records[0].near, 'gates D and E, Level 2, Non-Schengen Area, En la terminal T1, planta 2, zona de puertas de embarque D y E.');
  assert.equal(records[0].hoursText, '05:00 to last flight');
  assert.deepEqual(records[0].openHours, []);
  assert.equal(records[0].amenities.Showers, true);
  assert.equal(records[0].amenities.Workspaces, true);
});

test('DOH official parser extracts published gate evidence without inventing hours', () => {
  const records = parseHamadOfficialLoungeRecords(`
    <title>Gold Lounge - South | Hamad International Airport</title>
    <h3>About the Lounge</h3>
    <p>This lounge is for Qatar Airways Privilege Club Gold members and their <strong>one</strong>world Sapphire counterparts. The lounge features all-day buffet dining, a bar, and shower facilities.</p>
    <hr>
    <h3>Finding the Lounge</h3>
    <p>Level 1, Duty Free Plaza South, Concourse A of Hamad International Airport.</p>
    <p>Beside Boarding Gate A1 and is located on the upper level.</p>
    <hr>
    <h3>Access (Who can enter)</h3>
    <ul><li>A Qatar Airways Privilege Club member.</li></ul>
  `, { url: 'https://dohahamadairport.com/lounge/gold-lounge-south' });

  assert.equal(records.length, 1);
  assert.equal(records[0].airportCode, 'DOH');
  assert.equal(records[0].name, 'Gold Lounge - South');
  assert.equal(records[0].terminal, 'Passenger Terminal');
  assert.equal(records[0].concourse, 'Concourse A');
  assert.equal(records[0].gate, 'Gate A1');
  assert.equal(records[0].securitySide, 'After Security');
  assert.equal(records[0].openHours.length, 0);
  assert.ok(records[0].programs.includes('Qatar Airways Privilege Club'));
  assert.ok(records[0].programs.includes('oneworld'));
  assert.equal(records[0].amenities.Showers, true);
});

test('PRG official parser extracts lounge terminal, hours, programs, and scoped price', () => {
  const records = parsePragueOfficialLoungeRecords(`
    <title>ERSTE Premier Lounge - Terminal 1</title>
    <div class="accordion-item-title"> Terminal 1</div>
    <div class="cast-terminalu cast-148"> Past the checkpoint</div>
    <div class="row g-3" data-day="monday"><span data-range-from="19800" data-range-to="79200">5:30 AM - 10:00 PM</span></div>
    <div class="row g-3" data-day="tuesday"><span data-range-from="19800" data-range-to="79200">5:30 AM - 10:00 PM</span></div>
    <div class="row g-3" data-day="wednesday"><span data-range-from="19800" data-range-to="79200">5:30 AM - 10:00 PM</span></div>
    <div class="row g-3" data-day="thursday"><span data-range-from="19800" data-range-to="79200">5:30 AM - 10:00 PM</span></div>
    <div class="row g-3" data-day="friday"><span data-range-from="19800" data-range-to="79200">5:30 AM - 10:00 PM</span></div>
    <div class="row g-3" data-day="saturday"><span data-range-from="19800" data-range-to="79200">5:30 AM - 10:00 PM</span></div>
    <div class="row g-3" data-day="sunday"><span data-range-from="19800" data-range-to="79200">5:30 AM - 10:00 PM</span></div>
    <p><strong>CZK&nbsp; 1,030 / 1&nbsp;person</strong></p>
    <h3>Lounge Key, Priority Pass, Lounge Pass, DragonPass and others</h3>
  `, { url: 'https://www.prg.aero/en/erste-premier-lounge-t1' });

  assert.equal(records.length, 1);
  assert.equal(records[0].airportCode, 'PRG');
  assert.equal(records[0].name, 'ERSTE Premier Lounge - Terminal 1');
  assert.equal(records[0].terminal, 'Terminal 1');
  assert.equal(records[0].securitySide, 'After Security');
  assert.equal(records[0].openHours.length, 7);
  assert.equal(records[0].openHours[0].OpeningHour, '05:30');
  assert.equal(records[0].openHours[0].ClosingHour, '22:00');
  assert.deepEqual(records[0].price, { amount: 1030, currencyCode: 'CZK' });
  assert.ok(records[0].programs.includes('Priority Pass'));
  assert.ok(records[0].programs.includes('DragonPass'));
});

test('PRG official parser does not import unrelated package prices as lounge prices', () => {
  const records = parsePragueOfficialLoungeRecords(`
    <title>VISA Lounge</title>
    <div class="accordion-item-title"> Terminal 2</div>
    <div class="cast-terminalu cast-147"> Public Area</div>
    <div class="row g-3" data-day="monday"><span data-range-from="18000" data-range-to="79200">5:00 AM - 10:00 PM</span></div>
    <div class="row g-3" data-day="tuesday"><span data-range-from="18000" data-range-to="79200">5:00 AM - 10:00 PM</span></div>
    <div class="row g-3" data-day="wednesday"><span data-range-from="18000" data-range-to="79200">5:00 AM - 10:00 PM</span></div>
    <div class="row g-3" data-day="thursday"><span data-range-from="18000" data-range-to="79200">5:00 AM - 10:00 PM</span></div>
    <div class="row g-3" data-day="friday"><span data-range-from="18000" data-range-to="79200">5:00 AM - 10:00 PM</span></div>
    <div class="row g-3" data-day="saturday"><span data-range-from="18000" data-range-to="79200">5:00 AM - 10:00 PM</span></div>
    <div class="row g-3" data-day="sunday"><span data-range-from="18000" data-range-to="79200">5:00 AM - 10:00 PM</span></div>
    <h3>Private Check-in Service</h3>
    <p><strong>Prices from CZK 2,340 per Person</strong></p>
    <h3>Meet and Assist</h3>
    <p><strong>Prices from CZK 2,160 per Person</strong></p>
  `, { url: 'https://www.prg.aero/en/visa-lounge' });

  assert.equal(records.length, 1);
  assert.equal(records[0].name, 'VISA Lounge');
  assert.equal(records[0].securitySide, 'Before Security');
  assert.equal(records[0].price, null);
  assert.ok(records[0].programs.includes('Visa'));
});

test('FCO official parser extracts ADR detail page location, hours, and price', () => {
  const records = parseFiumicinoOfficialLoungeRecords(`
    <div class="journal-content-article">
      <h1>Plaza Premium Lounge&nbsp;</h1>
      <p><strong>Address:</strong> Boarding Area A Schengen - Superior level</p>
      <p><strong>Opening time:</strong> 04:30 A.M. - 09:30 P.M.</p>
      <p><strong>Access fee: </strong>Special Offer from € 29</p>
      <p><strong>Services: </strong>Bar; Charging Station; Flight Information; Buffet; Shower Facilities; Wi-Fi.</p>
    </div>
  `, { url: 'https://www.adr.it/web/aeroporti-di-roma-en/plaza-premium-lounge-t1' });

  assert.equal(records.length, 1);
  assert.equal(records[0].airportCode, 'FCO');
  assert.equal(records[0].name, 'Plaza Premium Lounge');
  assert.equal(records[0].terminal, 'Terminal 1');
  assert.equal(records[0].near, 'Boarding Area A Schengen - Superior level');
  assert.equal(records[0].openHours[0].OpeningHour, '04:30');
  assert.equal(records[0].openHours[0].ClosingHour, '21:30');
  assert.deepEqual(records[0].price, { amount: 29, currencyCode: 'EUR' });
  assert.equal(records[0].amenities.Showers, true);
});

test('FCO official parser splits airline lounge sections with gate ranges', () => {
  const records = parseFiumicinoOfficialLoungeRecords(`
    <div class="journal-content-article">
      <h1>ITA Airways Lounge</h1>
      <p><span><strong>"Piazza di Spagna":</strong> Boarding Area E11-E24</span></p>
      <p><span><strong>Opening Time:</strong> 06:00 - 23:00</span></p>
      <p><span><strong>Access fee</strong>: Ticket ITA (from 49€ online. From 59€ at the Airport.)</span></p>
      <p><span><strong>Services</strong>: WiFi, bar, toilet with showers.</span></p>
      <p><span><strong>"Hangar Lounge": </strong> Boarding Area A31-59 (upper floor)</span></p>
      <p><span><strong>Opening Time:</strong> 06:00 - 23:00</span></p>
      <p><span><strong>Access fee</strong>: Ticket ITA (from 49€ online.)</span></p>
    </div>
  `, { url: 'https://www.adr.it/web/aeroporti-di-roma-en/ita-airways-lounge' });

  assert.equal(records.length, 2);
  assert.equal(records[0].name, 'Hangar Lounge');
  assert.equal(records[0].gate, 'Gates A31-59');
  assert.deepEqual(records[0].programs, ['Fiumicino Airport official page']);
  assert.equal(records[1].name, 'Piazza di Spagna');
  assert.equal(records[1].gate, 'Gates E11-24');
  assert.deepEqual(records[1].price, { amount: 49, currencyCode: 'EUR' });
});

test('DFW official parser extracts embedded lounge gate and price evidence', () => {
  const payload = {
    props: {
      pageProps: {
        page: {
          fields: {
            sections: [
              {
                contentType: 'tab-section',
                fields: {
                  items: [
                    {
                      fields: {
                        title: 'Capital One Lounge',
                        content: [
                          {
                            fields: {
                              body:
                                'All other travelers are welcome at the standard rate of $65. The lounge is located inside security in Terminal D near Gate D22.',
                            },
                          },
                        ],
                      },
                    },
                    {
                      fields: {
                        title: 'Airline Lounges',
                        content: [
                          {
                            fields: {
                              body:
                                '- American Airlines Admirals Club\\n  - Terminal A, A24\\n  - Terminal B, B3\\n\\n- Delta Sky Club at Terminal E, E10',
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    },
  };
  const records = parseDfwOfficialLoungeRecords(
    `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(payload)}</script>`,
    { url: 'https://www.dfwairport.com/explore/lounges/' },
  );

  const capitalOne = records.find((record) => record.name === 'Capital One Lounge');
  assert.equal(capitalOne?.airportCode, 'DFW');
  assert.equal(capitalOne?.terminal, 'Terminal D');
  assert.equal(capitalOne?.gate, 'Gate D22');
  assert.deepEqual(capitalOne?.price, { amount: 65, currencyCode: 'USD' });
  assert.ok(records.some((record) => record.name === 'American Airlines Admirals Club' && record.gate === 'Gate A24'));
  assert.ok(records.some((record) => record.name === 'Delta Sky Club' && record.gate === 'Gate E10'));
});

test('SFO official lounge parser extracts terminal, near-gate text, and hours', () => {
  const records = parseSfoOfficialLoungeRecords(`
    <div class="lounge-list-card__right-content">
      <h2 class="lounge-list-card__title h4"> Air France - KLM Lounge</h2>
      <div class="lounge-list-card__alliance"> <strong>Alliance: </strong>SkyTeam</div>
      <div class="lounge-list-card__locations">
        <strong>Locations: </strong>
        <span class="lounge-list-card__locations__text">Dianne Feinstein International Terminal A,</span>
        <span class="lounge-list-card__locations__text">near Gate A1, </span>
        <span class="lounge-list-card__locations__text">Level 3, </span>
        <span class="lounge-list-card__locations__text">Post-Security</span>
      </div>
      <div class="lounge-list-card__hours">
        <span class="office-hours__item-slots">9:30 am-12:45 am</span>
      </div>
      <div class="lounge-list-card__links">
    </div>
  `, { url: 'https://www.flysfo.com/passengers/shop-dine-relax/lounges' });

  assert.equal(records.length, 1);
  assert.equal(records[0].airportCode, 'SFO');
  assert.equal(records[0].name, 'Air France - KLM Lounge');
  assert.equal(records[0].terminal, 'Dianne Feinstein International Terminal A');
  assert.equal(records[0].near, 'near Gate A1, Level 3, Post-Security');
  assert.equal(records[0].openHours[0].OpeningHour, '09:30');
  assert.equal(records[0].openHours[0].ClosingHour, '00:45');
  assert.deepEqual(records[0].programs, ['SkyTeam']);
  assert.equal(records[0].amenities.Lounge, true);
});

test('PHL official lounge parser extracts multi-location official list items', () => {
  const records = parsePhlOfficialLoungeRecords(`
    <h2><a href="https://www.aa.com/">American Airlines Flagship Lounge and Admirals Club</a>:</h2>
    <ul>
      <li><strong>Terminal&nbsp;A-West</strong> - Flagship Lounge and Admirials Club, between gates A15 and A16, open daily from 4:30 am - 10:30 pm</li>
      <li><strong>Terminal&nbsp;B/C Connector</strong>&nbsp;- third floor, open daily from 4:30 am - 9 pm</li>
    </ul>
    <h2><a href="https://thecenturionlounge.com/locations/phl/">American Express Centurion Lounge</a></h2>
    <ul>
      <li><strong>Terminal A-West</strong> - near gate A14, open daily from 5:30 am - 9pm</li>
    </ul>
  `, { url: 'https://www.phl.org/at-phl/services-and-amenities/lounges-and-concierge-services' });

  assert.equal(records.length, 3);
  assert.equal(records[0].airportCode, 'PHL');
  assert.equal(records[0].name, 'American Airlines Flagship Lounge and Admirals Club');
  assert.equal(records[0].terminal, 'Terminal A-West');
  assert.equal(records[0].near, 'Flagship Lounge and Admirials Club, between gates A15 and A16,');
  assert.equal(records[0].openHours[0].OpeningHour, '04:30');
  assert.equal(records[0].openHours[0].ClosingHour, '22:30');
  assert.equal(records[2].name, 'American Express Centurion Lounge');
  assert.equal(records[2].near, 'near gate A14,');
  assert.equal(records[2].openHours[0].ClosingHour, '21:00');
});

test('Changi official facility API extracts lounge locations with strict hours', () => {
  const records = parseChangiOfficialLoungeRecords({
    data: [
      {
        id: 'sats-premier-lounge',
        title: 'SATS Premier Lounge',
        tags: { amenities: 'Amenities', 'airline-lounges': 'Airline Lounges' },
        fullDescription: 'Take a restful break at SATS Premier Lounge before your flight.',
        locations: [
          {
            terminal: 'T1',
            area: 'Transit',
            level: '3 ',
            map_poi: 'map/facilities/T1L3_03-07/08',
            typeOfOperatingHours: 'Everyday 24hr',
            operatingTime: '24 Hours',
          },
        ],
      },
      {
        id: 'british-airways-lounge',
        title: 'British Airways Lounge',
        tags: { amenities: 'Amenities', 'airline-lounges': 'Airline Lounges' },
        locations: [
          {
            terminal: 'T1',
            area: 'Transit',
            level: '3 ',
            map_poi: 'map/facilities/T1L3_03-06',
            typeOfOperatingHours: 'Everyday',
            openingHour: '15:00',
            closedHour: '23:00',
          },
        ],
      },
      {
        id: 'cathay-pacific-lounge',
        title: 'Cathay Pacific Lounge',
        tags: { amenities: 'Amenities', 'airline-lounges': 'Airline Lounges' },
        locations: [
          {
            terminal: 'T4',
            area: 'Transit',
            level: '2M ',
            typeOfOperatingHours: 'Customise',
            customizedOperatingHour: 'Daily<br/>Open 3 hours before first CX flight departure, until last departure',
          },
        ],
      },
    ],
  });

  assert.equal(records.length, 2);
  assert.equal(records[0].airportCode, 'SIN');
  assert.equal(records[0].name, 'SATS Premier Lounge');
  assert.equal(records[0].terminal, 'T1');
  assert.equal(records[0].near, 'Transit, Level 3, Map facilities/T1L3_03-07/08');
  assert.equal(records[0].openHours[0].OpenAllDay, true);
  assert.deepEqual(records[0].programs, ['Amenities', 'Airline Lounges']);
  assert.equal(records[1].name, 'British Airways Lounge');
  assert.equal(records[1].openHours[0].OpeningHour, '15:00');
  assert.equal(records[1].openHours[0].ClosingHour, '23:00');
});

test('Changi official detail parser extracts Plaza Premium price and 24-hour location', () => {
  const records = parseChangiOfficialDetailLoungeRecords(`
    <head>
      <meta name="title" content="Plaza Premium Lounge | Changi Airport Terminal 1"/>
      <meta name="description" content="Unwind at Plaza Premium Lounge with pay-per-use access."/>
    </head>
    <main>
      <h1 class="cmp_directory-title"> Plaza Premium Lounge </h1>
      <div class="cmp_directory-description"> Freshen up and unwind before you fly at the Plaza Premium Lounge. </div>
      <div class="cmp_directory-content" data-value="T1" data-props-area="Transit">
        <div class="cmp_location_address">
          <span class="cmp_location_area"> T1 Transit</span>
          <span class="cmp_location_unit">
            <span class="cmp_location_unit--level">Level3 </span>
          </span>
        </div>
        <div class="cmp_location_operatingStatus"> Open 24 hours </div>
        <div class="cmp_location_operatingDays"> Daily </div>
        <a href="#" class="view-on-map-btn" data-map-poi="https://www.changiairport.com/en/at-changi/map.html#map/shop/T1L3/03-03">View On Map</a>
      </div>
      <span class="cmp-accordion__title">Lounge Rates </span>
      <div class="cmp-text">
        <p><b>Lounge use</b></p>
        <ul><li>Adult: 3 hours (S$55), 5 hours (S$97), 10 hours (S$195)</li></ul>
        <p>*Prices are in Singapore Dollars and subject to prevailing local taxes and service charges.</p>
      </div>
    </main>
  `, { url: 'https://www.changiairport.com/en/at-changi/facilities-and-services-directory/plaza-premium-lounge.html' });

  assert.equal(records.length, 1);
  assert.equal(records[0].airportCode, 'SIN');
  assert.equal(records[0].name, 'Plaza Premium Lounge');
  assert.equal(records[0].terminal, 'T1');
  assert.equal(records[0].near, 'T1 Transit, Level3, Map shop/T1L3/03-03');
  assert.equal(records[0].openHours[0].OpenAllDay, true);
  assert.deepEqual(records[0].price, { amount: 55, currencyCode: 'SGD' });
  assert.equal(records[0].amenities.Lounge, true);
});

test('Melbourne official parser extracts lounge gate areas and daily hours', () => {
  const records = parseMelbourneOfficialLoungeRecords(`
    <h2 class="text-section-title">Where to find us &amp; trading hours</h2>
    <div class="rich-text-area">
      <p>International Departures, Terminal 2, after security – Near Gate 9, Airline Lounge Area</p>
      <table><tbody><tr><td>Monday-Sunday</td><td>08:30 – 23:00</td></tr></tbody></table>
    </div>
    <h3>Fine foods &amp; beverages</h3>
    <p>Includes drinks and Wi-Fi.</p>
  `, { url: 'https://www.melbourneairport.com.au/plaza-premium-lounge' });

  assert.equal(records.length, 1);
  assert.equal(records[0].airportCode, 'MEL');
  assert.equal(records[0].name, 'Plaza Premium Lounge');
  assert.equal(records[0].terminal, 'Terminal 2');
  assert.match(records[0].near, /Near Gate 9/);
  assert.equal(records[0].openHours.length, 7);
  assert.equal(records[0].openHours[0].OpeningHour, '08:30');
  assert.equal(records[0].openHours[0].ClosingHour, '23:00');
  assert.equal(records[0].amenities.Food, true);
  assert.equal(records[0].amenities.Drinks, true);
});

test('Sydney official parser extracts T1 airline lounge gate and hours', () => {
  const records = parseSydneyOfficialLoungeRecords(`
    <div class="accordion-item" id="airline-lounges-t1-air-new-zealand-lounge-t1">
      <div class="accordion-item-title">Air New Zealand Lounge</div>
      <div class="accordion-item-expanded-content rich-text-content">
        <p>The Air New Zealand Lounge is located after Customs near gate 59 at T1 International terminal.</p>
        <h2>Opening hours</h2>
        <p>The Air New Zealand Lounge is open 06:00 - 21:00 daily.</p>
      </div>
    </div>
  `, { url: 'https://www.sydneyairport.com.au/info-sheet/airline-lounges-t1' });

  assert.equal(records.length, 1);
  assert.equal(records[0].airportCode, 'SYD');
  assert.equal(records[0].terminal, 'T1 International');
  assert.match(records[0].near, /near gate 59/i);
  assert.equal(records[0].openHours[0].OpeningHour, '06:00');
  assert.equal(records[0].openHours[0].ClosingHour, '21:00');
});

test('Gatwick official detail parser splits multi-terminal lounges with prices and hours', () => {
  const records = parseGatwickOfficialLoungeRecords(`
    <div class="c-icon-wrapper">
      <div class="c-icon-content__title"><p>Opening times</p></div>
      <div class="c-icon-content__subtitle"><p>North 05:00 - 18:00</p><p>South 06:00 - 21:00</p></div>
    </div></div>
    <div class="c-icon-wrapper">
      <div class="c-icon-content__subtitle"><p>Prices from just £44</p></div>
    </div></div>
    <p><strong>North Terminal</strong> - After security, follow signs to Airport Lounges. Take the stairs or lift to level 1.</p>
    <p><strong>South Terminal </strong>- After security, follow signs to Airport Lounges from the mezzanine level.</p>
    <p>Complimentary food, drinks and unlimited Wi-Fi.</p>
  `, { url: 'https://www.gatwickairport.com/premium-services/lounge-airport/lounge-clubrooms.html' });

  assert.equal(records.length, 2);
  assert.equal(records[0].airportCode, 'LGW');
  assert.equal(records[0].name, 'Clubrooms');
  assert.equal(records[0].terminal, 'North Terminal');
  assert.equal(records[0].openHours[0].OpeningHour, '05:00');
  assert.equal(records[0].openHours[0].ClosingHour, '18:00');
  assert.deepEqual(records[0].price, { amount: 44, currencyCode: 'GBP' });
  assert.match(records[0].near, /level 1/i);
  assert.equal(records[1].terminal, 'South Terminal');
  assert.equal(records[1].openHours[0].OpeningHour, '06:00');
  assert.equal(records[1].openHours[0].ClosingHour, '21:00');
  assert.equal(records[1].amenities['Wi-Fi'], true);
});

test('Gatwick official detail parser extracts daily hours for single-terminal lounges', () => {
  const records = parseGatwickOfficialLoungeRecords(`
    <div class="c-icon-wrapper">
      <div class="c-icon-content__title"><p>Opening times</p></div>
      <div class="c-icon-content__subtitle"><p>Daily 04:00 - 20:00</p><p>Last entry at 19:00</p></div>
    </div></div>
    <div class="c-icon-wrapper">
      <div class="c-icon-content__subtitle"><p>Adult (12+) £40</p><p>Child (2-11) £28</p></div>
    </div></div>
    <p><strong>North Terminal </strong>- After security, turn left into the main departure lounge, then follow signs to the Lounge Pavilion and take the lift to level four.</p>
    <p>Complimentary buffet menu and drinks.</p>
  `, { url: 'https://www.gatwickairport.com/premium-services/lounge-airport/lounge-plaza-premium.html' });

  assert.equal(records.length, 1);
  assert.equal(records[0].name, 'Plaza Premium Lounge');
  assert.equal(records[0].operator, 'Plaza Premium');
  assert.equal(records[0].terminal, 'North Terminal');
  assert.equal(records[0].openHours[0].OpeningHour, '04:00');
  assert.equal(records[0].openHours[0].ClosingHour, '20:00');
  assert.deepEqual(records[0].price, { amount: 40, currencyCode: 'GBP' });
  assert.match(records[0].near, /level four/i);
  assert.equal(records[0].amenities.Food, true);
  assert.equal(records[0].amenities.Drinks, true);
});

test('Heathrow official detail parser extracts terminal, security side, hours, and price', () => {
  const records = parseHeathrowOfficialLoungeRecords(`
    <title>No.1 Lounges - Terminal 2 | Heathrow</title>
    <meta name="title" content="No.1 Lounges - Terminal 2"/>
    <meta name="description" content="Relax before your flight in the peaceful No1 Lounge in Terminal 2."/>
    <main>
      <h1>No1 Lounge - Terminal 2</h1>
      <p>Operates in Terminal 2</p>
      <p>After Security</p>
      <p>View on Map</p>
      <p>Mon - Sun 05:00 - 21:00</p>
      <p>Prices from £44 per person</p>
      <p>Complimentary food and fully tended bar. A wide choice of drinks.</p>
    </main>
  `, { url: 'https://www.heathrow.com/at-the-airport/lounges-hotels-spas/terminal-2/no1-lounges' });

  assert.equal(records.length, 1);
  assert.equal(records[0].airportCode, 'LHR');
  assert.equal(records[0].airportName, 'London Heathrow Airport');
  assert.equal(records[0].name, 'No.1 Lounges');
  assert.equal(records[0].terminal, 'Terminal 2');
  assert.equal(records[0].securitySide, 'After Security');
  assert.equal(records[0].near, 'After Security');
  assert.equal(records[0].openHours[0].OpeningHour, '05:00');
  assert.equal(records[0].openHours[0].ClosingHour, '21:00');
  assert.deepEqual(records[0].price, { amount: 44, currencyCode: 'GBP' });
  assert.equal(records[0].amenities.Food, true);
  assert.equal(records[0].amenities.Drinks, true);
  assert.deepEqual(records[0].programs, ['Heathrow official booking']);
});

test('Heathrow official detail parser preserves decimal GBP booking prices', () => {
  const records = parseHeathrowOfficialLoungeRecords(`
    <title>Club Aspire - Terminal 5 | Heathrow</title>
    <meta name="title" content="Club Aspire - Terminal 5"/>
    <meta name="description" content="Relax before your flight in the Terminal 5 Club Aspire lounge."/>
    <main>
      <p>Operates in Terminal 5</p>
      <p>After Security</p>
      <p>Mon - Sun 05:00 - 21:00</p>
      <p>Prices from £39.99 per person</p>
    </main>
  `, { url: 'https://www.heathrow.com/at-the-airport/lounges-hotels-spas/terminal-5/club-aspire' });

  assert.equal(records.length, 1);
  assert.equal(records[0].name, 'Club Aspire');
  assert.equal(records[0].terminal, 'Terminal 5');
  assert.deepEqual(records[0].price, { amount: 39.99, currencyCode: 'GBP' });
});

test('Manchester official Escape parser extracts terminal sections with hours and prices', () => {
  const records = parseManchesterOfficialLoungeRecords(`
    <title>Escape Lounges at Manchester Airport</title>
    <main>
      <p>The details T2 T3</p>
      <p>Opening times Open daily: 03:00 - 20:30</p>
      <p>Lounge location Proceed through security and then head through Duty Free. The lounge is located on the mezzanine level, follow signs for Escape Lounge.</p>
      <p>Get directions</p>
      <p>Price Pre-book from £42.99 per person Walk-up from £55 per person</p>
      <p>Opening times Open daily: 04:00 - 20:15</p>
      <p>Lounge location After you've passed through security, follow the signs for Premium Lounges. Continue straight and then turn right towards the Escape Lounge.</p>
      <p>Get directions</p>
      <p>Price Pre-book from £32.99 per person Walk-up from £49 per person</p>
      <p>Freshly prepared hot and cold food. Selection of wines, beers and spirits. Complimentary Wi-Fi.</p>
    </main>
  `, { url: 'https://www.manchesterairport.co.uk/at-the-airport/airport-lounges/escape-lounges/' });

  assert.equal(records.length, 2);
  assert.equal(records[0].airportCode, 'MAN');
  assert.equal(records[0].name, 'Escape Lounge');
  assert.equal(records[0].terminal, 'Terminal 2');
  assert.equal(records[0].securitySide, 'After Security');
  assert.equal(records[0].openHours[0].OpeningHour, '03:00');
  assert.equal(records[0].openHours[0].ClosingHour, '20:30');
  assert.deepEqual(records[0].price, { amount: 42.99, currencyCode: 'GBP' });
  assert.match(records[0].near, /mezzanine level/i);
  assert.equal(records[1].terminal, 'Terminal 3');
  assert.equal(records[1].openHours[0].OpeningHour, '04:00');
  assert.deepEqual(records[1].price, { amount: 32.99, currencyCode: 'GBP' });
  assert.equal(records[0].amenities.Food, true);
  assert.equal(records[0].amenities.Drinks, true);
  assert.equal(records[0].amenities['Wi-Fi'], true);
});

test('Manchester official 1903 parser skips terminal sections without explicit hours', () => {
  const records = parseManchesterOfficialLoungeRecords(`
    <title>1903 Lounge at Manchester Airport</title>
    <main>
      <p>The details T2 T3</p>
      <p>Opening times Open daily: 04:00 - 20:45</p>
      <p>Lounge location Proceed through the security checks and the Duty Free shopping area. Follow signs for Escape Lounge. The lounge entrance is located to the right of the Bridgewater Tap pub.</p>
      <p>Get directions</p>
      <p>Price Pre-book from £54.99 per person Walk-up from £65 per person</p>
      <p>Opening times These are subject to change. Please check your reservation for more details.</p>
      <p>Lounge location Follow the signs for Premium Lounges.</p>
      <p>Get directions</p>
      <p>Price Currently open for Etihad passengers, or by airline invitation.</p>
    </main>
  `, { url: 'https://www.manchesterairport.co.uk/at-the-airport/airport-lounges/1903-lounge/' });

  assert.equal(records.length, 1);
  assert.equal(records[0].name, '1903 Lounge');
  assert.equal(records[0].terminal, 'Terminal 2');
  assert.equal(records[0].openHours[0].OpeningHour, '04:00');
  assert.equal(records[0].openHours[0].ClosingHour, '20:45');
  assert.deepEqual(records[0].price, { amount: 54.99, currencyCode: 'GBP' });
  assert.match(records[0].near, /Bridgewater Tap/i);
});

test('Dubai Airports parser extracts official gate area and 24-hour operations when published', () => {
  const records = parseDubaiAirportsOfficialLoungeRecords(`
    <h1>Game Space Gaming Lounge</h1>
    <p>Game Space is open 24/7, so the fun will never stop at DXB.</p>
    <article id="dsrfLocation">
      <h2>Location</h2>
      <h3>Terminal 3</h3>
      <a>B Gates - Departures</a>
    </article>
  `, { url: 'https://dubaiairports.ae/experiences/relax---refresh/details/game-space-gaming-lounge' });

  assert.equal(records.length, 1);
  assert.equal(records[0].airportCode, 'DXB');
  assert.equal(records[0].name, 'Game Space - Gaming Lounge');
  assert.equal(records[0].terminal, 'Terminal 3 Concourse B');
  assert.equal(records[0].near, 'B Gates - Departures');
  assert.equal(records[0].openHours.length, 7);
  assert.equal(records[0].openHours[0].OpenAllDay, true);
  assert.equal(records[0].amenities.Gaming, true);
});

test('Dubai Airports parser does not fabricate hours from location-only pages', () => {
  const records = parseDubaiAirportsOfficialLoungeRecords(`
    <h1>Plaza Premium Lounge</h1>
    <p>Plaza Premium Lounge offers you a premium experience.</p>
    <article id="dsrfLocation">
      <h2>Location</h2>
      <h3>Terminal 3</h3>
      <a>A Gates - Departures</a>
    </article>
  `, { url: 'https://dubaiairports.ae/experiences/relax---refresh/details/plaza-premium-lounge' });

  assert.equal(records.length, 1);
  assert.equal(records[0].name, 'Plaza Premium Lounge');
  assert.equal(records[0].terminal, 'Terminal 3 Concourse A');
  assert.equal(records[0].near, 'A Gates - Departures');
  assert.equal(records[0].openHours.length, 0);
});

test('Suvarnabhumi official parser extracts lounge gate evidence and published hours', () => {
  const records = parseSuvarnabhumiOfficialLoungeRecords(`
    <main>
      Miracle Lounge
      International, open 24 hours, daily
      - Concourse D Level 3 opposite Gate D5 - Business Class
      - Concourse G Level 3 opposite Gate G2- Business Class
      Domestic, open 05.00 - 22.00, daily
      - Concourse D Level 2
      The Coral Lounge
      International, open 24 hours, daily
      - The Coral Cosmo Lounge, Departure Gate C1
      - The Coral First Class Lounge, Departure Gate D1
      Domestic, open 05.00 - 22.00, daily
      - The Coral Domestic Departure Lounge, Concourse A
      The SilverKris Lounge
      International
      - The SilverKris Lounge, Floor 3, Concourse D, opposite Gate D7
      Thai Airways Lounge
      International
      - Royal First Lounge, Concourse D, Level 3
      Air France-KLM Sky Lounge
      International
      - Air Fance-KLM Sky Lounge, Concourse F, Gate F3, Level 3
      FLIGHT STATUS
    </main>
  `);

  assert.equal(records[0].airportCode, 'BKK');
  assert.ok(records.some((record) => record.name === 'Miracle Business Class Lounge' && record.near.includes('Gate D5')));
  assert.ok(records.some((record) => record.near.includes('Gate D5')));
  assert.ok(records.some((record) => record.near.includes('Gate G2')));
  assert.ok(records.some((record) => record.name === 'The Coral Cosmo Lounge' && record.near.includes('Gate C1')));
  assert.ok(records.some((record) => record.name === 'Air France-KLM Sky Lounge' && record.near.includes('Gate F3')));
  assert.equal(records.find((record) => record.name === 'Miracle Lounge Domestic')?.openHours[0].OpeningHour, '05:00');
  assert.equal(records.find((record) => record.name === 'Air France-KLM Sky Lounge')?.openHours.length, 0);
});

test('GRU official parser extracts prices, hours, and near-gate text', () => {
  const records = parseGruOfficialLoungeRecords(`
    <main>
      Terminal 1 W LOUNGE Terminal 1 - Mezzanine Open 24h - Daily. The fee is R$200.00 and includes food, drinks, Wi-Fi and shower service.
      Terminal 2 PLAZA PREMIUM LOUNGE Terminal 2 - Domestic departures area 5 am to 11 pm - Daily Entrance for adults is BRL 240.00 for 3 hours of lounge access and BRL 159,00 for 1 hour of lounge access.
      W PREMIUM LOUNGE Terminal 3 - International departures area 24h - Daily. The fee is R$ 320.00 for a 3-hour stay. W Premium Lounge is located in the international departures area of Terminal 3 at Guarulhos Airport, near gates 323 and 324.
      NUBANK ULTRAVIOLETA LOUNGE Terminal 3 - International boarding area, near to gate 329 Daily from 6 am to 11 pm Payment Values: $32 USD to be paid in Brazilian real at the lounge reception.
      VISA INFINITE PRIVILEGE LOUNGE Terminal 3 - Internacional boarding area Open 24 hours - Daily
      GRU AIRPORT
    </main>
  `);

  const t1W = records.find((record) => record.name === 'W Lounge');
  const plaza = records.find((record) => record.name === 'Plaza Premium Lounge');
  const wT3 = records.find((record) => record.name === 'W Premium Lounge');
  const nubank = records.find((record) => record.name === 'Nubank Ultravioleta Lounge');

  assert.equal(records.length, 5);
  assert.equal(t1W?.terminal, 'Terminal 1');
  assert.equal(t1W?.openHours[0].OpenAllDay, true);
  assert.deepEqual(t1W?.price, { amount: 200, currencyCode: 'BRL' });
  assert.match(plaza?.openHours[0].OpeningHour ?? '', /05:00/);
  assert.deepEqual(plaza?.price, { amount: 240, currencyCode: 'BRL' });
  assert.match(wT3?.near ?? '', /near gates 323 and 324/i);
  assert.equal(wT3?.terminal, 'Terminal 3');
  assert.deepEqual(wT3?.price, { amount: 320, currencyCode: 'BRL' });
  assert.equal(nubank?.openHours[0].ClosingHour, '23:00');
  assert.deepEqual(nubank?.price, { amount: 32, currencyCode: 'USD' });
});

test('MIA official parser extracts lounge rows with gates, hours, and day-pass price', () => {
  const records = parseMiamiOfficialLoungeRecords(`
    <table><tbody>
      <tr>
        <td><img alt="American Airlines" /></td>
        <td>
          <p><strong>American Airlines - Admirals Club D-15</strong><br />(skytrain station #1)</p>
          <p>Alliance: oneworld</p>
          <p>Location: After Security Checkpoint, North Terminal D, third floor, above Gate D15</p>
          <p>Hours: Daily, 5:00 a.m. - 11:00 p.m.</p>
        </td>
      </tr>
      <tr>
        <td><img alt="Club America F" /></td>
        <td>
          <p><strong>Club America F <span>Temporarily Closed</span><br /></strong>3rd level</p>
          <p>Operator: Gideon Toal Management Services LLC.</p>
          <p>Admittance: Visitors may purchase a one-day pass for $50, subject to availability and capacity.</p>
          <p>Location: Concourse F, Level 3, after security checkpoint</p>
          <p>Hours: Daily, 7:30 a.m. - 10 p.m.</p>
        </td>
      </tr>
      <tr>
        <td><img alt="Avianca and TAP Portugal Lounge" /></td>
        <td>
          <p><strong>Avianca and TAP Portugal Lounge</strong></p>
          <p>Admittance: Priority Pass accepted.</p>
          <p>Location: South Terminal J, post security, across from Gate J6.</p>
          <p>Hours: 24 hours daily.</p>
        </td>
      </tr>
    </tbody></table>
  `);

  const admirals = records.find((record) => record.name === 'American Airlines - Admirals Club D-15');
  const clubAmerica = records.find((record) => record.name === 'Club America F');
  const avianca = records.find((record) => record.name === 'Avianca and TAP Portugal Lounge');

  assert.equal(records.length, 3);
  assert.equal(admirals?.airportCode, 'MIA');
  assert.equal(admirals?.terminal, 'North Terminal D');
  assert.match(admirals?.near ?? '', /Gate D15/i);
  assert.equal(admirals?.openHours[0].OpeningHour, '05:00');
  assert.equal(admirals?.openHours[0].ClosingHour, '23:00');
  assert.ok(admirals?.programs.includes('oneworld'));
  assert.equal(clubAmerica?.operator, 'Gideon Toal Management Services LLC.');
  assert.equal(clubAmerica?.terminal, 'Concourse F');
  assert.deepEqual(clubAmerica?.price, { amount: 50, currencyCode: 'USD' });
  assert.equal(avianca?.terminal, 'South Terminal J');
  assert.equal(avianca?.openHours[0].OpenAllDay, true);
  assert.ok(avianca?.programs.includes('Priority Pass'));
});

test('SEA official parser extracts lounge table gate locations and published hours only', () => {
  const records = parseSeaOfficialLoungeRecords(`
    <table><tbody>
      <tr>
        <td><strong>The Club at SEA</strong></td>
        <td><ul>
          <li><a><strong>The Club at at SEA</strong></a><strong>&nbsp;near Gate A12</strong> is open <span>5 a.m. - 12:30 a.m. daily</span></li>
          <li><a><strong>The Club at SEA</strong></a><strong>&nbsp;on the Mezzanine level above Gate S10 </strong>is open <span>6 a.m. - 1:30 a.m. daily</span></li>
        </ul></td>
      </tr>
      <tr>
        <td><a><strong>Alaska Lounge</strong></a></td>
        <td><ul>
          <li><strong>Alaska Lounge near Gate C16A</strong></li>
          <li><strong>Alaska Lounge on the Mezzanine level above&nbsp;Gate N15</strong></li>
        </ul></td>
      </tr>
    </tbody></table>
  `);

  const clubA = records.find((record) => record.name === 'The Club at SEA' && record.terminal === 'Concourse A');
  const clubS = records.find((record) => record.name === 'The Club at SEA' && record.terminal === 'S Concourse');
  const alaskaC = records.find((record) => record.name === 'Alaska Lounge' && record.terminal === 'Concourse C');

  assert.equal(records.length, 4);
  assert.equal(clubA?.near, 'near Gate A12 is open 5 a.m. - 12:30 a.m. daily');
  assert.equal(clubA?.openHours[0].OpeningHour, '05:00');
  assert.equal(clubA?.openHours[0].ClosingHour, '00:30');
  assert.equal(clubS?.openHours[0].OpeningHour, '06:00');
  assert.equal(clubS?.openHours[0].ClosingHour, '01:30');
  assert.equal(alaskaC?.near, 'near Gate C16A');
  assert.equal(alaskaC?.openHours.length, 0);
  assert.ok(alaskaC?.programs.includes('oneworld'));
});

test('Hong Kong official airline lounge parser extracts gates, airlines, and fixed hours', () => {
  const records = parseHongKongAirportOfficialLoungeRecords(`
    <ul class="accordionList">
      <li class="accordionItem"><a href="javascript:;" aria-label="Click to see more about Cathay Pacific Lounge - The Deck"><span class="accordionTitle">Cathay Pacific Lounge - The Deck</span></a><div class="accordionContent">
        <div class="accordionInner"><dl>
          <dt>Airlines:</dt>
          <dd aria-label="Airlines::Cathay Pacific (CX)">Cathay Pacific (CX)<br></dd>
          <dt class="icon-marker-flightinfo" title="Address"></dt>
          <dd><a href="#" data-external-id="CXLounge_TheDeck">Near Gate 6, Departures Level (L7), Terminal 1</a></dd>
          <dt class="icon-opening-hour" title="Opening Hours"></dt>
          <dd>05:30 - 00:30</dd>
        </dl></div>
      </div></li>
      <li class="accordionItem"><a href="javascript:;" aria-label="Click to see more about Cathay Pacific Lounge - The Bridge"><span class="accordionTitle">Cathay Pacific Lounge - The Bridge</span></a><div class="accordionContent">
        <div class="accordionInner"><dl>
          <dt>Airlines:</dt>
          <dd aria-label="Airlines::Cathay Pacific (CX)">Cathay Pacific (CX)<br></dd>
          <dt class="icon-marker-flightinfo" title="Address"></dt>
          <dd><a href="#" data-external-id="CXLounge_TheBridge">Near Gate 35, Departures Level (L6), Terminal 1</a></dd>
          <dt class="icon-opening-hour" title="Opening Hours"></dt>
          <dd>05:30 - Last flight</dd>
        </dl></div>
      </div></li>
      <li class="accordionItem"><a href="javascript:;" aria-label="Click to see more about Club Autus"><span class="accordionTitle">Club Autus</span></a><div class="accordionContent">
        <div class="accordionInner"><dl>
          <dt>Airlines:</dt>
          <dd aria-label="Airlines::Hong Kong Airlines (HX)">Hong Kong Airlines (HX)<br></dd>
          <dt class="icon-marker-flightinfo" title="Address"></dt>
          <dd><a href="#" data-external-id="RNL_AL_00025">Near Gates 201-230, Departures Level (L7), T1 Midfield Concourse</a></dd>
          <dt class="icon-opening-hour" title="Opening Hours"></dt>
          <dd>06:30 - 02:30</dd>
        </dl></div>
      </div></li>
    </ul>
  `, { url: 'https://www.hongkongairport.com/en/passenger-guide/airport-facilities-services/airline-lounges' });

  assert.equal(records.length, 2);
  assert.equal(records[0].airportCode, 'HKG');
  assert.equal(records[0].name, 'Cathay Pacific Lounge - The Deck');
  assert.equal(records[0].operator, 'Cathay Pacific');
  assert.equal(records[0].terminal, 'Terminal 1');
  assert.equal(records[0].near, 'Near Gate 6, Departures Level (L7), Terminal 1');
  assert.equal(records[0].openHours[0].OpeningHour, '05:30');
  assert.equal(records[0].openHours[0].ClosingHour, '00:30');
  assert.deepEqual(records[0].programs, ['HKIA airline lounge page', 'oneworld', 'Cathay Pacific']);
  assert.equal(records[1].name, 'Club Autus');
  assert.equal(records[1].terminal, 'Terminal 1 Midfield Concourse');
  assert.match(records[1].near, /Gates 201-230/);
});

test('Hong Kong official pay-in parser extracts Plaza, Kyra, Centurion, and 24-hour rows', () => {
  const records = parseHongKongAirportOfficialLoungeRecords(`
    <ul class="accordionList">
      <li class="accordionItem"><a href="javascript:;" aria-label="Click to see more about Kyra Lounge"><span class="accordionTitle">Kyra Lounge</span></a><div class="accordionContent">
        <div class="accordionInner"><dl class="iconList">
          <dt class="icon-marker-flightinfo" title="Address"></dt>
          <dd><a href="#" data-external-id="RNL_PPL_00008">Near Gate 23, Departures Level (L6), Terminal 1</a></dd>
          <dt class="icon-opening-hour" title="Opening Hours"></dt>
          <dd>05:30 - 23:30</dd>
        </dl></div>
      </div></li>
      <li class="accordionItem"><a href="javascript:;" aria-label="Click to see more about Plaza Premium Lounge (West Hall)"><span class="accordionTitle">Plaza Premium Lounge (West Hall)</span></a><div class="accordionContent">
        <div class="accordionInner"><dl class="iconList">
          <dt class="icon-marker-flightinfo" title="Address"></dt>
          <dd><a href="#" data-external-id="PlazaPremiumLounge_West">Near Gate 60, Departures Level (L7), Terminal 1</a></dd>
          <dt class="icon-opening-hour" title="Opening Hours"></dt>
          <dd>24 hours</dd>
        </dl></div>
      </div></li>
      <li class="accordionItem"><a href="javascript:;" aria-label="Click to see more about The Centurion® Lounge"><span class="accordionTitle">The Centurion® Lounge</span></a><div class="accordionContent">
        <div class="accordionInner"><dl>
          <dt class="icon-marker-flightinfo" title="Address"></dt>
          <dd><a href="#" data-external-id="RNL_PPL_00005">Near Gate 60, Departures Level (L7), Terminal 1</a></dd>
          <dt class="icon-opening-hour" title="Opening Hours"></dt>
          <dd>06:00 - 00:00</dd>
        </dl></div>
      </div></li>
    </ul>
  `, { url: 'https://www.hongkongairport.com/en/passenger-guide/airport-facilities-services/pay-in-corporate-lounges' });

  assert.equal(records.length, 3);
  assert.equal(records[0].name, 'Kyra Lounge');
  assert.equal(records[0].operator, 'Kyra Lounge');
  assert.deepEqual(records[0].programs, ['HKIA pay-in lounge page']);
  assert.equal(records[1].brand, 'Plaza Premium Lounge');
  assert.equal(records[1].operator, 'Plaza Premium Lounge');
  assert.equal(records[1].openHours[0].OpenAllDay, true);
  assert.equal(records[2].operator, 'American Express');
  assert.deepEqual(records[2].programs, ['HKIA pay-in lounge page', 'American Express']);
});

test('Haneda official card lounge parser extracts hours, location, and JPY fees', () => {
  const records = parseHanedaOfficialLoungeRecords(`
    <main>
      <h2>Credit Card Lounges T1 (Terminal 1)</h2>
      <h3>POWER LOUNGE SOUTH</h3>
      <p>Opening Hours 6:00-21:00</p>
      <p>Location 2F Domestic Departure Gate Area (South)</p>
      <p>Fees (Tax incl.) Adults: 1,320 yen</p>
      <p>Cards Accepted Visa Mastercard JCB</p>
      <h2>Credit Card Lounges T3 (Terminal 3)</h2>
      <h3>SKY LOUNGE</h3>
      <p>Opening Hours 24 hours</p>
      <p>Location 4F International Departure Gate Area</p>
      <p>Fees (Tax incl.) Adults: 1,320 yen</p>
      <p>Priority Pass</p>
      <h3>The Centurion Lounge (AMEX)</h3>
      <p>Opening Hours 8:00-22:00</p>
      <p>Location 4F International Departure Gate Area</p>
      <p>Fees (Tax incl.) Adults: 1,320 yen</p>
    </main>
  `, { url: 'https://tokyo-haneda.com/en/service/facilities/lounge.html' });

  assert.equal(records.length, 3);
  assert.equal(records[0].airportCode, 'HND');
  assert.equal(records[0].currencyCode, 'JPY');
  assert.equal(records[0].price.amount, 1320);
  assert.ok(records.some((record) => record.name === 'SKY LOUNGE' && record.openHours[0].OpenAllDay));
  assert.ok(records.some((record) => record.name === 'The Centurion Lounge (AMEX)' && record.programs.includes('American Express')));
  assert.ok(records.every((record) => record.near.includes('Gate Area')));
});

test('PANYNJ official parser extracts lounge card detail hours and gate evidence', () => {
  const records = parsePanynjOfficialLoungeRecords({
    url: 'https://www.jfkairport.com/dine-shop-relax/lounge-and-rest',
    pois: [
      {
        id: '4005122',
        name: 'Aer Lingus Lounge',
        description: 'Guests can enjoy comfortable seating, complimentary food and beverages.',
        category: 'relax.lounge',
        structureName: 'Terminal 7',
        floorName: 'Level 3',
        nearbyLandmark: 'Gate 1',
      },
    ],
    detailsById: {
      4005122: {
        id: '4005122',
        name: 'Aer Lingus Lounge',
        description: 'Guests can enjoy comfortable seating, complimentary food and beverages.',
        category: 'relax.lounge',
        formattedHours: [{ days: 'Daily', hours: '2:00 PM - 9:00 PM' }],
        structureName: 'Terminal 7',
        floorName: 'Level 3',
        nearbyLandmark: 'Gate 1',
        displayKeywords: ['relax', 'lounge'],
      },
    },
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].airportCode, 'JFK');
  assert.equal(records[0].airportName, 'John F. Kennedy International Airport');
  assert.equal(records[0].terminal, 'Terminal 7');
  assert.equal(records[0].near, 'Level 3, Gate 1');
  assert.equal(records[0].openHours[0].OpeningHour, '14:00');
  assert.equal(records[0].openHours[0].ClosingHour, '21:00');
  assert.equal(records[0].amenities.Food, true);
  assert.match(records[0].sourceUrl, /poiId=4005122/);
});

test('PANYNJ official parser skips lounge cards without official hours', () => {
  const records = parsePanynjOfficialLoungeRecords({
    url: 'https://www.newarkairport.com/dine-shop-relax/lounge-and-rest',
    pois: [
      {
        id: '1',
        name: 'No Hours Lounge',
        category: 'relax.lounge',
        structureName: 'Terminal A',
        floorName: 'Level 2',
        nearbyLandmark: 'Gate A1',
      },
    ],
    detailsById: {},
  });

  assert.equal(records.length, 0);
});
