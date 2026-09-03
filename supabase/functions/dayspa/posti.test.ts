/* ============================================================
   posti.test.ts — la parola detta all'ospite, e i venti minuti.

   Da qui non esce mai il numero dei posti: solo uno stato. «ultimi» sotto
   la soglia, mai il numero. Il codice del QR non ha caratteri che si
   confondono a voce al telefono (0/O, 1/I).
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { codicePrenotazione, eScaduta, numeroPrenotazione, scadenza, statoPosti, MINUTI_PAGAMENTO } from './posti.ts';

Deno.test('stato dei posti', () => {
  assertEquals(statoPosti(null, true), 'chiuso');
  assertEquals(statoPosti(null, false), 'non-in-vendita');
  assertEquals(statoPosti({ posti: 40, venduti: 40 }, false), 'esaurito');
  assertEquals(statoPosti({ posti: 40, venduti: 36 }, false), 'ultimi');
  assertEquals(statoPosti({ posti: 40, venduti: 35 }, false), 'ultimi');
  assertEquals(statoPosti({ posti: 40, venduti: 34 }, false), 'disponibile');
  assertEquals(statoPosti({ posti: 40, venduti: 10 }, true), 'chiuso', 'chiuso vince su tutto');
  assertEquals(statoPosti({ posti: 0, venduti: 0 }, false), 'esaurito', 'zero posti caricati e esaurito');
});

Deno.test('la scadenza e venti minuti dopo, e si legge con lo stesso orologio', () => {
  const adesso = new Date('2026-09-10T10:00:00Z');
  assertEquals(MINUTI_PAGAMENTO, 20);
  assertEquals(scadenza(adesso), '2026-09-10T10:20:00.000Z');
  assert(!eScaduta(scadenza(adesso), new Date('2026-09-10T10:19:59Z')));
  assert(eScaduta(scadenza(adesso), new Date('2026-09-10T10:20:01Z')));
});

Deno.test('il numero e DS-anno-progressivo a quattro cifre', () => {
  assertEquals(numeroPrenotazione(2026, 1), 'DS-2026-0001');
  assertEquals(numeroPrenotazione(2026, 12345), 'DS-2026-12345');
});

Deno.test('il codice ha dieci caratteri senza 0, O, 1, I', () => {
  const c = codicePrenotazione(Math.random);
  assertEquals(c.length, 10);
  assert(/^[A-HJ-NP-Z2-9]{10}$/.test(c), c);
  /* con un casuale fisso il codice e' deterministico: si puo' provare */
  assertEquals(codicePrenotazione(() => 0), 'AAAAAAAAAA');
  assertEquals(codicePrenotazione(() => 0.999), '9999999999');
});
