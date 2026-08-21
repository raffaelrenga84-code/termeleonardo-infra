/* Test del lettore delle richieste in testo libero di outlook-inject.js.
   La mail inglese e' quella vera di Oskars Mickevics, 20 agosto 2026.
   Esegui:  node test-inject.js                                          */
const { JSDOM } = require('jsdom');
const fs = require('fs');

const dom = new JSDOM('<body><div role="main"></div></body>',
  { pretendToBeVisual: true, runScripts: 'outside-only' });
const win = dom.window;
win.setInterval = () => 0;
win.setTimeout = (f) => 0;
const nulla = () => {};
const ascoltatore = { addListener: nulla, removeListener: nulla };
win.chrome = {
  storage: { local: { get: nulla, set: nulla, remove: nulla }, onChanged: ascoltatore },
  runtime: { sendMessage: nulla, onMessage: ascoltatore, getManifest: () => ({ version: 'test' }),
             id: 'test', lastError: null },
  tabs: { query: nulla }
};
win.eval(fs.readFileSync(__dirname + '/outlook-inject.js', 'utf8'));
const I = win.__leonardoInject;

let falliti = 0;
const ok = (nome, cond, extra) => {
  console.log((cond ? '  \x1b[32mOK\x1b[0m  ' : '  \x1b[31mKO\x1b[0m  ') + nome +
              (!cond && extra !== undefined ? '   → ' + JSON.stringify(extra) : ''));
  if (!cond) falliti++;
};

const OSKARS = `Hello,

Organisers of Buddist event convention shared your contacts, i would like to know what could be
the price for one room 1 adult, from 25.09- 3.10?

Thank you
Oskars`;

console.log('\n— la mail inglese di Oskars Mickevics —');
ok('«price» e «room» bastano a riconoscere la richiesta',
   I.PAROLE_RICHIESTA.test(OSKARS));
const r = I.parseLibera(OSKARS, { nome: 'Oskars Mickevics', email: 'oskarsmickevics@gmail.com' });
ok('legge l\'arrivo 25 settembre', r.arrivo && r.arrivo.g === 25 && r.arrivo.m === 9, r.arrivo);
ok('legge la partenza 3 ottobre', r.partenza && r.partenza.g === 3 && r.partenza.m === 10, r.partenza);
ok('conta 8 notti a cavallo del mese', r.notti === 8, r.notti);
ok('«1 adult» in inglese viene letto', r.adulti === 1, r.adulti);
ok('nome e cognome dal mittente',
   r.nome === 'Oskars' && r.cognome === 'Mickevics', [r.nome, r.cognome]);

console.log('\n— le parole che prima mancavano —');
for (const [frase, atteso] of [
  ['what is the price for a double room?', true],
  ['do you have any rooms available in September', true],
  ['could you send me a quote for 3 nights', true],
  ['quel est le tarif pour une chambre double', true],
  ['nous cherchons un s\u00e9jour de 4 nuits', true],
  ['pouvez-vous m\'envoyer un devis', true],
  ['Was kostet eine \u00dcbernachtung?', true],
  ['Grazie mille per la bella accoglienza, a presto!', false],
  ['Allego la fattura di agosto per la contabilit\u00e0', false]
]) {
  ok(`${atteso ? 'riconosce' : 'ignora'}: «${frase.slice(0, 44)}»`,
     I.PAROLE_RICHIESTA.test(frase) === atteso);
}

console.log('\n— periodi scritti tutto in cifre —');
const casi = [
  ['dal 25/09 al 3/10 per 2 persone, camera doppia', 25, 9, 3, 10, 8],
  ['vom 25.09.-03.10.2026 Doppelzimmer', 25, 9, 3, 10, 8],
  ['from 12.10 to 15.10, one room', 12, 10, 15, 10, 3],
  ['prenotazione dal 30/12/2026 al 2/1/2027', 30, 12, 2, 1, 3]
];
for (const [testo, g1, m1, g2, m2, notti] of casi) {
  const p = I.parseLibera(testo, null);
  ok(`«${testo.slice(0, 34)}…»`,
     p.arrivo && p.arrivo.g === g1 && p.arrivo.m === m1 &&
     p.partenza && p.partenza.g === g2 && p.partenza.m === m2 && p.notti === notti,
     [p.arrivo, p.partenza, p.notti]);
}
const capodanno = I.parseLibera('prenotazione dal 30/12/2026 al 2/1/2027', null);
ok('a capodanno l\'anno della partenza avanza',
   capodanno.partenza && capodanno.partenza.a === 2027, capodanno.partenza);

console.log('\n— quello che funzionava prima continua a funzionare —');
const vecchi = [
  ['dal 12 al 15 agosto 2026, 2 persone', 12, 8, 15, 8],
  ['vom 27. Oktober bis 31. Oktober 2026', 27, 10, 31, 10],
  ['from the 3rd to the 7th of May 2027', 3, 5, 7, 5],
  ['du 4 au 9 juin 2027', 4, 6, 9, 6]
];
for (const [testo, g1, m1, g2, m2] of vecchi) {
  const p = I.parseLibera(testo, null);
  ok(`«${testo.slice(0, 34)}…»`,
     p.arrivo && p.arrivo.g === g1 && p.arrivo.m === m1 &&
     p.partenza && p.partenza.g === g2 && p.partenza.m === m2,
     [p.arrivo, p.partenza]);
}
const dus = I.parseLibera('una doppia uso singola dal 12 al 15 agosto 2026', null);
ok('la doppia uso singola resta 1 persona, non 2', dus.adulti === 1, dus.adulti);

console.log(falliti === 0
  ? '\n\x1b[32mTutti i test passati.\x1b[0m\n'
  : `\n\x1b[31m${falliti} test falliti.\x1b[0m\n`);
process.exit(falliti === 0 ? 0 : 1);
