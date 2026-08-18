/* ============================================================
   preavviso-coerenza.test.ts — le due copie delle 48 ore.

   Il preavviso e' scritto due volte: qui in richieste/preavviso.ts, che e'
   dove il SERVER rifiuta, e in pagine/comune/date.js, che serve alla pagina
   per non far scegliere all'ospite una data che verrebbe respinta dopo aver
   compilato tutto.

   Due copie perche' `strumenti/pubblica.js` manda alla Management API solo i
   file della cartella della funzione: quel modulo non puo' importare da
   pagine/, ne' viceversa.

   IL DIFETTO CHE PRESIDIA. Se il giorno che il preavviso cambia si tocca una
   copia sola, il calendario della pagina lascia scegliere un giorno che il
   server respinge — e l'ospite lo scopre DOPO aver compilato tutto, che e'
   esattamente il difetto che il preavviso lato pagina esiste per evitare.
   ============================================================ */
import { assertEquals } from 'jsr:@std/assert';
import { PREAVVISO_GIORNI, primoGiornoUtile } from './preavviso.ts';
import {
  PREAVVISO_GIORNI_TRATTAMENTI, primoGiornoUtileTrattamenti,
} from '../../../pagine/comune/date.js';

Deno.test('il numero di giorni e lo stesso nelle due copie', () => {
  assertEquals(PREAVVISO_GIORNI, PREAVVISO_GIORNI_TRATTAMENTI);
});

/* Non basta il numero: i due calcoli devono dare lo stesso GIORNO, compresi
   i salti di mese, di anno e il 29 febbraio — dove un conto a mano sbaglia
   sempre. Il server conta in UTC, la pagina in ora locale: si confronta a
   mezzogiorno, dove i due non possono divergere. */
Deno.test('i due calcoli danno lo stesso primo giorno utile', () => {
  for (
    const giorno of [
      '2026-08-18', '2026-08-30', '2026-08-31', '2026-12-30', '2026-12-31',
      '2028-02-27', '2028-02-28', '2028-02-29', '2027-03-01',
    ]
  ) {
    const serverIso = primoGiornoUtile(new Date(giorno + 'T12:00:00Z'));
    const paginaIso = primoGiornoUtileTrattamenti(new Date(giorno + 'T12:00:00'));
    assertEquals(paginaIso, serverIso, `partendo dal ${giorno}`);
  }
});
