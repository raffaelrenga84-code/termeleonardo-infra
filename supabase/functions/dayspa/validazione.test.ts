/* ============================================================
   validazione.test.ts — cosa entra in una prenotazione, e cosa no.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { validaPrenotazione } from './validazione.ts';

const buono = {
  giorno: '2026-09-12', fascia: 'giornaliero', adulti: 2, bambini: 1,
  nome: 'Maria Rossi', email: 'maria@esempio.it', telefono: '333 1234567', lingua: 'it',
};
const OGGI = '2026-09-10';

Deno.test('una prenotazione buona passa, con persone = adulti + bambini', () => {
  const v = validaPrenotazione(buono, OGGI);
  assertEquals(v.errore, undefined);
  assertEquals(v.dati?.persone, 3);
  assertEquals(v.dati?.fascia, 'giornaliero');
  assertEquals(v.dati?.buono, undefined);
});

Deno.test('oggi si puo, ieri no, una data impossibile no', () => {
  assertEquals(validaPrenotazione({ ...buono, giorno: OGGI }, OGGI).errore, undefined);
  assert(validaPrenotazione({ ...buono, giorno: '2026-09-09' }, OGGI).errore);
  assert(validaPrenotazione({ ...buono, giorno: '9999-99-99' }, OGGI).errore);
  assert(validaPrenotazione({ ...buono, giorno: '2026-02-30' }, OGGI).errore, 'il 30 febbraio non esiste');
});

Deno.test('il serale di un mercoledi non esiste', () => {
  assert(/serale/.test(validaPrenotazione({ ...buono, giorno: '2026-09-16', fascia: 'serale' }, OGGI).errore ?? ''));
  assertEquals(validaPrenotazione({ ...buono, giorno: '2026-09-11', fascia: 'serale' }, OGGI).errore, undefined, 'venerdi si');
});

Deno.test('almeno un adulto, al massimo otto persone', () => {
  assert(validaPrenotazione({ ...buono, adulti: 0, bambini: 2 }, OGGI).errore);
  assert(validaPrenotazione({ ...buono, adulti: 5, bambini: 4 }, OGGI).errore);
  assertEquals(validaPrenotazione({ ...buono, adulti: 5, bambini: 3 }, OGGI).errore, undefined);
  assertEquals(validaPrenotazione({ ...buono, adulti: '2', bambini: '' }, OGGI).dati?.persone, 2, 'dai campi del modulo arrivano stringhe');
});

Deno.test('nome ed email servono; la lingua sconosciuta diventa italiano; il buono si normalizza', () => {
  assert(validaPrenotazione({ ...buono, nome: ' ' }, OGGI).errore);
  assert(validaPrenotazione({ ...buono, email: 'senza-chiocciola' }, OGGI).errore);
  assertEquals(validaPrenotazione({ ...buono, lingua: 'xx' }, OGGI).dati?.lingua, 'it');
  assertEquals(validaPrenotazione({ ...buono, buono: ' ab-12 ' }, OGGI).dati?.buono, 'AB-12');
});

Deno.test('un corpo che non e un oggetto e un errore, non un crollo', () => {
  assert(validaPrenotazione(null, OGGI).errore);
  assert(validaPrenotazione('ciao', OGGI).errore);
  assert(validaPrenotazione({}, OGGI).errore);
});
