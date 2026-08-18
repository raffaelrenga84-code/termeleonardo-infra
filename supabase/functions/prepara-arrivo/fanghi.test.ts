/* ============================================================
   fanghi.test.ts — il desiderio d'orario per i fanghi.

   E' UNA PREFERENZA, NON UN APPUNTAMENTO. Il ciclo fanghi ha sei turni al
   mattino, dalle 5:50 alle 10:30, e il turno lo assegna la Segreteria Cure
   DOPO la visita medica di ammissione. Qui si prende nota di cosa l'ospite
   preferirebbe, e basta.

   IL DIFETTO CHE PRESIDIA: il valore arriva dal browser, e il browser si
   aggira. Senza un elenco chiuso, in reception arriverebbe qualunque
   stringa qualcuno decida di mandare — e quella stringa finisce in
   un'email col nostro logo.
   ============================================================ */
import { assertEquals } from 'jsr:@std/assert';
import { desiderioValido, DESIDERI } from './fanghi.ts';

Deno.test('le tre scelte sono queste, e sono tre', () => {
  assertEquals(DESIDERI, ['presto', 'tardi', 'indifferente']);
});

Deno.test('una scelta prevista passa così com è', () => {
  for (const d of DESIDERI) assertEquals(desiderioValido(d), d);
});

/* Il valore arriva dal browser: qualunque cosa non sia una delle tre e'
   niente, non «un desiderio strano da mostrare comunque». */
Deno.test('tutto il resto diventa niente', () => {
  for (
    const v of [
      '', 'PRESTO', 'alle 6', 'presto ', '<b>presto</b>', 'mattina',
      null, undefined, 42, {}, ['presto'],
    ]
  ) {
    assertEquals(desiderioValido(v), null, `doveva sparire: ${JSON.stringify(v)}`);
  }
});

/* Nessuna delle tre parla di turni, orari precisi o prenotazioni: sono
   fasce, e restano fasce anche nel database. */
Deno.test('nessuna scelta contiene un orario preciso', () => {
  for (const d of DESIDERI) {
    assertEquals(/\d/.test(d), false, `${d} contiene una cifra: sembra un turno`);
  }
});
