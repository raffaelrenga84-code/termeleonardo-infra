/* logica.test.ts — collaudo delle due funzioni pure della pagina di
   prenotazione, senza rete e senza browser: la conversione centesimi/euro
   e la composizione del corpo per POST /richieste. Vedi logica.js. */
import { assertEquals, assertFalse } from 'jsr:@std/assert';
import { componiCorpo, euroDaCentesimi } from './logica.js';

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
