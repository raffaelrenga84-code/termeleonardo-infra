/* ============================================================
   conto.test.ts — il prezzo di una riga e il totale del conto.
   Tutto in centesimi; l'euro si scrive solo per mostrarlo.
   ============================================================ */
import { assertEquals, assertThrows } from 'jsr:@std/assert';
import { euro, prezzoRiga, totaleCent } from './conto.ts';
const vino = { prezzo_cent: 2800, prezzo_libero: false };

Deno.test('prezzo di riga: listino, piu variante, oppure a mano solo con permesso', () => {
  assertEquals(prezzoRiga({ articolo: vino }, false), 2800);
  assertEquals(prezzoRiga({ articolo: vino, variante: { supplemento_cent: 300 } }, false), 3100);
  assertEquals(prezzoRiga({ articolo: vino, prezzo_manuale_cent: 2500 }, true), 2500);
  assertThrows(() => prezzoRiga({ articolo: vino, prezzo_manuale_cent: 2500 }, false), Error, 'prezzo a mano non permesso');
});

Deno.test('articolo a prezzo libero: l importo lo mette il cameriere, senza permessi', () => {
  const varie = { prezzo_cent: 0, prezzo_libero: true };
  assertEquals(prezzoRiga({ articolo: varie, prezzo_manuale_cent: 1250 }, false), 1250);
  assertThrows(() => prezzoRiga({ articolo: varie }, false), Error, 'prezzo richiesto');
});

Deno.test('totale: quantita per prezzo, le stornate non contano', () => {
  assertEquals(totaleCent([
    { quantita: 2, prezzo_cent: 2800, stato: 'partita' },
    { quantita: 1, prezzo_cent: 500, stato: 'stornata' },
    { quantita: 3, prezzo_cent: 350, stato: 'da_inviare' },
  ]), 6650);
  assertEquals(euro(6650), '66,50 €');
  assertEquals(euro(123456), '1.234,56 €', 'migliaia col punto');
});
