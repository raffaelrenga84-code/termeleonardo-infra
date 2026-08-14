/* logica.test.ts — collaudo delle due funzioni pure della pagina di
   prenotazione, senza rete e senza browser: la conversione centesimi/euro
   e la composizione del corpo per POST /richieste. Vedi logica.js. */
import { assertEquals, assertFalse } from 'jsr:@std/assert';
import { componiCorpo, euroDaCentesimi, linguaScelta } from './logica.js';

Deno.test('31000 centesimi sono 310,00 euro, non 310 e non 31000', () => {
  assertEquals(euroDaCentesimi(31000), '310,00');
});

Deno.test('la caparra tipica, 7500 centesimi a persona', () => {
  assertEquals(euroDaCentesimi(7500), '75,00');
});

Deno.test('zero centesimi sono 0,00 euro', () => {
  assertEquals(euroDaCentesimi(0), '0,00');
});

Deno.test('un centesimo dispari arrotonda a due decimali', () => {
  assertEquals(euroDaCentesimi(4999), '49,99');
});

Deno.test('un valore assente o guasto non manda "NaN" a schermo', () => {
  assertEquals(euroDaCentesimi(null), '0,00');
  assertEquals(euroDaCentesimi(undefined), '0,00');
  assertEquals(euroDaCentesimi('abc'), '0,00');
  assertEquals(euroDaCentesimi(NaN), '0,00');
});

const SCELTA = {
  camera_id: 5,
  nome: 'Doppia',
  descrizione: '',
  max_adulti: 2,
  tariffa_id: 41,
  variante_id: 12,
  tariffa: 'BAR',
  trattamento: 'Bed & Breakfast',
  prezzo_cent: 31000,
};

Deno.test('il corpo della richiesta ha tipo soggiorno e privacy accettata', () => {
  const corpo = componiCorpo({
    scelta: SCELTA, nome: 'Anna Bianchi', email: 'anna@example.com', telefono: '333 1234567',
    checkIn: '2026-09-16', checkOut: '2026-09-17', adulti: 2, bambini: 1,
    note: 'Vista sui Colli se possibile', lingua: 'it',
  });
  assertEquals(corpo.tipo, 'soggiorno');
  assertEquals(corpo.privacy_presa_atto, true);
  assertEquals(corpo.check_in, '2026-09-16');
  assertEquals(corpo.check_out, '2026-09-17');
});

Deno.test('gli ospiti sono adulti piu\' bambini, la colonna camera e\' il nome non il numero', () => {
  const corpo = componiCorpo({
    scelta: SCELTA, nome: 'Anna Bianchi', email: 'anna@example.com', telefono: '',
    checkIn: '2026-09-16', checkOut: '2026-09-17', adulti: 2, bambini: 1,
    note: '', lingua: 'it',
  });
  assertEquals(corpo.ospiti, 3);
  assertEquals(corpo.tipo_camera, 'Doppia');
  assertEquals(corpo.pacchetto, 'BAR');
});

Deno.test('il jsonb dati porta i fatti per la macchina, prezzo compreso in centesimi', () => {
  const corpo = componiCorpo({
    scelta: SCELTA, nome: 'Anna Bianchi', email: 'anna@example.com', telefono: '',
    checkIn: '2026-09-16', checkOut: '2026-09-17', adulti: 2, bambini: 0,
    note: '', lingua: 'de',
  });
  assertEquals(corpo.dati.camera_id, 5);
  assertEquals(corpo.dati.variante_id, 12);
  assertEquals(corpo.dati.tariffa, 'BAR');
  assertEquals(corpo.dati.trattamento, 'Bed & Breakfast');
  assertEquals(corpo.dati.prezzo_cent, 31000);
  assertEquals(corpo.lingua, 'de');
});

Deno.test('bambini assenti non fanno crollare il conteggio ospiti', () => {
  const corpo = componiCorpo({
    scelta: SCELTA, nome: 'Anna Bianchi', email: 'anna@example.com', telefono: '',
    checkIn: '2026-09-16', checkOut: '2026-09-17', adulti: 2, bambini: undefined,
    note: '', lingua: 'it',
  });
  assertEquals(corpo.ospiti, 2);
});

Deno.test('nessun campo del corpo contiene un numero di camera: regola della casa', () => {
  const corpo = componiCorpo({
    scelta: SCELTA, nome: 'Anna Bianchi', email: 'anna@example.com', telefono: '',
    checkIn: '2026-09-16', checkOut: '2026-09-17', adulti: 2, bambini: 0,
    note: '', lingua: 'it',
  });
  assertFalse('numero_camera' in corpo);
  assertFalse('numero_camera' in corpo.dati);
  assertFalse('stanza' in corpo.dati);
});

/* ================= C1: quello che l'ospite ha visto non si perde =================
   La caparra mostrata e' 7500 x ADULTI, ma non veniva salvata e il numero di
   adulti non era ricostruibile: su 2 adulti + 2 bambini la pagina promette
   150 EUR e la reception, leggendo "4 ospiti", ne chiede 300. */
Deno.test('il jsonb porta adulti, bambini e la caparra promessa all ospite', () => {
  const corpo = componiCorpo({
    scelta: SCELTA, nome: 'Anna Bianchi', email: 'anna@example.com', telefono: '',
    checkIn: '2026-09-16', checkOut: '2026-09-17', adulti: 2, bambini: 2,
    caparraCent: 15000, note: '', lingua: 'it',
  });
  assertEquals(corpo.ospiti, 4);
  assertEquals(corpo.dati.adulti, 2);
  assertEquals(corpo.dati.bambini, 2);
  assertEquals(corpo.dati.caparra_cent, 15000);
});

Deno.test('la caparra salvata e quella mostrata, non una ricalcolata sugli ospiti', () => {
  const corpo = componiCorpo({
    scelta: SCELTA, nome: 'Anna Bianchi', email: 'anna@example.com', telefono: '',
    checkIn: '2026-09-16', checkOut: '2026-09-17', adulti: 2, bambini: 2,
    caparraCent: 15000, note: '', lingua: 'it',
  });
  /* 4 ospiti x 7500 farebbero 30000: e' proprio l'errore da evitare */
  assertEquals(corpo.dati.caparra_cent, 15000);
});

Deno.test('senza bambini il jsonb resta coerente', () => {
  const corpo = componiCorpo({
    scelta: SCELTA, nome: 'Anna Bianchi', email: 'anna@example.com', telefono: '',
    checkIn: '2026-09-16', checkOut: '2026-09-17', adulti: 2, bambini: 0,
    caparraCent: 15000, note: '', lingua: 'it',
  });
  assertEquals(corpo.dati.adulti, 2);
  assertEquals(corpo.dati.bambini, 0);
  assertEquals(corpo.ospiti, 2);
});

/* ================= C2: la lingua =================
   La lingua decide QUALI CONDIZIONI DI CANCELLAZIONE l'ospite legge, quindi
   non e' un dettaglio estetico. Su un indirizzo tradotto (/de/buchen) la
   pagina leggeva solo `?l=`, che li' non c'e': decideva il browser. Un ospite
   con browser inglese che apriva l'indirizzo tedesco leggeva le condizioni in
   inglese. */
Deno.test('l indirizzo tradotto decide la lingua, non il browser', () => {
  assertEquals(linguaScelta('/de/buchen', '', 'en-US'), 'de');
  assertEquals(linguaScelta('/it/prenota', '', 'en-US'), 'it');
  assertEquals(linguaScelta('/fr/reserver', '', 'en-US'), 'fr');
  assertEquals(linguaScelta('/en/book', '', 'it-IT'), 'en');
});

Deno.test('il selettore vince sull indirizzo: chi chiede il tedesco lo ottiene', () => {
  assertEquals(linguaScelta('/it/prenota', '?l=de', 'it-IT'), 'de');
  assertEquals(linguaScelta('/de/buchen', '?l=it', 'de-DE'), 'it');
});

/* se mai due `l` arrivassero insieme nell'indirizzo, vince l'ultima: quella
   che l'ospite ha appena espresso, non un valore di partenza */
Deno.test('una l ripetuta non riporta la pagina alla lingua di partenza', () => {
  assertEquals(linguaScelta('/it/prenota', '?l=it&l=de', 'it-IT'), 'de');
});

Deno.test('senza lingua nell indirizzo decide il browser, e in ultimo l inglese', () => {
  assertEquals(linguaScelta('/prenota/', '', 'de-DE'), 'de');
  assertEquals(linguaScelta('/prenota/', '', 'it-IT'), 'it');
  assertEquals(linguaScelta('/prenota/', '', 'es-ES'), 'en');
  assertEquals(linguaScelta('/prenota/', '', ''), 'en');
});

Deno.test('una lingua inventata non passa', () => {
  assertEquals(linguaScelta('/prenota/', '?l=xx', 'it-IT'), 'it');
  assertEquals(linguaScelta('/xx/prenota', '', 'it-IT'), 'it');
});
