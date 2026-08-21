/* ============================================================
   buono.test.ts — che cosa succede alla caparra quando c'è un buono.

   LA REGOLA, decisa dalla proprietà il 21 agosto 2026: il buono COPRE la
   caparra; se vale meno, la caparra si riduce di quel tanto.

   E SI DICE COSÌ E BASTA: «il buono copre la caparra». NON «non le sarà
   chiesto nulla» — la proprietà ha corretto proprio questa frase, e
   aveva ragione: restano la tassa di soggiorno e gli extra. Una frase
   che promette troppo si paga al banco.

   IL DIFETTO CHE LA CURA POTEVA INTRODURRE, ed è di quelli che si
   scoprono in cassa: il valore del buono arriva dall'API in EURO, la
   caparra vive in CENTESIMI. Sbagliare la conversione qui vuol dire
   sbagliare di CENTO VOLTE su una cifra che l'ospite legge e su cui
   conta.
   ============================================================ */
import { assertEquals } from 'jsr:@std/assert';
import { caparraDopoBuono, valoreInCentesimi } from './buono.js';

Deno.test('il valore arriva in euro e diventa centesimi', () => {
  assertEquals(valoreInCentesimi(200), 20000);
  assertEquals(valoreInCentesimi(49.9), 4990);
  assertEquals(valoreInCentesimi('150'), 15000);
});

Deno.test('e un valore che non si legge non diventa un numero', () => {
  for (const v of [null, undefined, 0, -50, '', 'duecento', {}]) {
    assertEquals(valoreInCentesimi(v as number), null, `valore «${v}»`);
  }
});

Deno.test('un buono piu grande della caparra la copre', () => {
  assertEquals(caparraDopoBuono(15000, 20000), { copre: true, resta: 0 });
});

Deno.test('e uno uguale pure', () => {
  assertEquals(caparraDopoBuono(15000, 15000), { copre: true, resta: 0 });
});

Deno.test('uno piu piccolo la riduce, non la copre', () => {
  /* il caso che la proprieta' non aveva considerato, e che senza una
     regola avrebbe fatto dire «il buono copre la caparra» a chi poi si
     sarebbe sentito chiedere cento euro */
  assertEquals(caparraDopoBuono(15000, 5000), { copre: false, resta: 10000 });
});

Deno.test('senza buono la caparra resta intera', () => {
  assertEquals(caparraDopoBuono(15000, null as unknown as number), { copre: false, resta: 15000 });
  assertEquals(caparraDopoBuono(15000, 0), { copre: false, resta: 15000 });
});

Deno.test('un dato guasto non fa sconti', () => {
  /* uno sconto nato da un dato che non si capisce e' uno sconto che
     nessuno ha deciso */
  for (const b of [-100, 1.5, 'centomila', {}, undefined]) {
    assertEquals(caparraDopoBuono(15000, b as number).resta, 15000, `buono «${b}»`);
  }
});

Deno.test('e la pagina dice la frase giusta, non quella che promette troppo', () => {
  const pagina = Deno.readTextFileSync(new URL('index.html', import.meta.url));
  /* la frase corretta dalla proprieta': niente «non le sara chiesto
     nulla», che sarebbe falso perche restano tassa ed extra */
  const proibite = /non le sar[àa] chiesto nulla|nothing will be charged|nichts berechnet/i;
  assertEquals(proibite.test(pagina), false, 'e tornata la frase che promette troppo');
  for (const chiave of ['caparraCoperta', 'caparraRidotta', 'buonoValido', 'buonoNonValido']) {
    assertEquals(
      pagina.includes(chiave + ':'),
      true,
      `manca il testo ${chiave}`,
    );
  }
});

Deno.test('e il codice arriva fino alla richiesta', () => {
  const pagina = Deno.readTextFileSync(new URL('index.html', import.meta.url));
  assertEquals(pagina.includes("buono: BUONO ? BUONO.codice : ''"), true, 'il codice non viaggia piu');
  assertEquals(pagina.includes('function verificaBuono()'), true, 'sparita la verifica');
  /* un guasto nella verifica NON blocca l invio: perdere una prenotazione
     per un guasto nostro e il danno peggiore */
  assertEquals(pagina.includes("BUONO_KO = 'buonoNonLetto'"), true, 'il guasto non ha piu un suo messaggio');
});
