/* ============================================================
   conto.test.ts — il conto camera come lo manda Fidra, ridotto a quello
   che il totem mostra (modulo puro conto.ts).

   «Procedi con la seconda strada», poi il consenso di hldv, sola lettura
   (la proprieta', 3 settembre 2026, notte). La forma della risposta e'
   quella che il totem di hldv legge nel suo codice: room, chunks (gruppi
   di righe con quantita, descrizione, totale), total, caparra,
   outstanding, appointments (scheduled_at, type, operator_name,
   completed), locale. Non avendola vista dal vivo, il riassunto e'
   difensivo: campi mancanti = vuoti, mai un errore.
   ============================================================ */
import { assertEquals } from 'jsr:@std/assert';
import { importo, riassuntoConto } from './conto.ts';

const FIDRA = {
  room: '204',
  locale: 'de',
  chunks: [
    [{ quantita: 1, descrizione: 'Pernottamento', totale: 180 }, { quantita: 2, descrizione: 'Cena', totale: 70 }],
    [{ quantita: 1, descrizione: 'Ingresso Day Spa', totale: '35.00' }],
  ],
  total: '285.00',
  caparra: 100,
  outstanding: '185.00',
  appointments: [
    { scheduled_at: '2026-09-04 09:30:00', type: 'Visita medica  Iniziale', operator_name: 'Dott. Rossi', completed: false },
  ],
};

Deno.test('riassuntoConto: camera, lingua, righe appiattite, totali e appuntamenti', () => {
  const c = riassuntoConto(FIDRA);
  assertEquals(c.camera, '204');
  assertEquals(c.lingua, 'de');
  assertEquals(c.righe.length, 3);
  assertEquals(c.righe[0], { quantita: '1', descrizione: 'Pernottamento', totale: '180,00' });
  assertEquals(c.righe[2].totale, '35,00', 'gli importi arrivano anche come testo con il punto');
  assertEquals(c.lordo, '285,00');
  assertEquals(c.acconto, '100,00');
  assertEquals(c.daPagare, '185,00');
  assertEquals(c.appuntamenti, [{ quando: '04/09 09:30', tipo: 'Visita medica  Iniziale', operatore: 'Dott. Rossi', fatto: false }]);
});

Deno.test('riassuntoConto: con campi mancanti resta un conto vuoto, non un errore', () => {
  const c = riassuntoConto({});
  assertEquals(c.camera, '');
  assertEquals(c.lingua, 'it');
  assertEquals(c.righe, []);
  assertEquals(c.lordo, '');
  assertEquals(c.appuntamenti, []);
  assertEquals(riassuntoConto(null).righe, []);
});

Deno.test('riassuntoConto: la lingua e solo una delle quattro del totem', () => {
  assertEquals(riassuntoConto({ locale: 'en' }).lingua, 'en');
  assertEquals(riassuntoConto({ locale: 'fr' }).lingua, 'fr');
  assertEquals(riassuntoConto({ locale: 'ru' }).lingua, 'it');
});

Deno.test('importo: numero o testo, con punto o virgola, sempre due decimali con la virgola', () => {
  assertEquals(importo(180), '180,00');
  assertEquals(importo('35.5'), '35,50');
  assertEquals(importo('1.234,50'), '1.234,50', 'un testo gia formattato che non e un numero resta com e');
  assertEquals(importo(''), '');
  assertEquals(importo(undefined), '');
});

Deno.test('importo: i totali di Fidra arrivano come «2,393.50» all inglese, e devono uscire «2.393,50»', () => {
  /* visto dal vivo il 4 settembre 2026 con la tessera 1466: lordo «2,393.50» */
  assertEquals(importo('2,393.50'), '2.393,50');
  assertEquals(importo('2.393,50'), '2.393,50', 'anche scritto all italiana');
  assertEquals(importo(2393.5), '2.393,50', 'numero: migliaia col punto');
  assertEquals(importo('915,00'), '915,00');
  assertEquals(importo('1,250'), '1.250,00', 'virgola e tre cifre: sono migliaia');
});

Deno.test('appuntamenti: la data esce leggibile, ora di Roma', () => {
  const c = riassuntoConto({ appointments: [{ scheduled_at: '2026-09-03T11:30:00.000000Z', type: 'Visita', operator_name: 'Dr. X', completed: true }] });
  assertEquals(c.appuntamenti[0].quando, '03/09 13:30');
});
