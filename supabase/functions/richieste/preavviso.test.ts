/* ============================================================
   preavviso.test.ts — le 48 ore sui trattamenti.

   Deciso dalla proprietà il 18 agosto 2026, e vale per TUTTE le richieste
   di trattamenti, non solo per quelle fatte con un buono.

   IL DIFETTO CHE PRESIDIA, e non è il preavviso in sé: è che questa regola
   NON deve finire in `validaDati()`. `?a=conferma` rivalida i dati con
   quella funzione, e una regola messa là impedirebbe alla RECEPTION di
   confermare una richiesta per domani — un gesto legittimo e quotidiano.
   La regola riguarda quello che un OSPITE può chiedere dal sito.

   `oggi` si passa da fuori: una regola legata a new Date() farebbe fallire
   queste prove da sole col passare del tempo.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import {
  pocoPreavviso, PREAVVISO_GIORNI, preavvisoSufficiente, primoGiornoUtile, TIPI_CON_PREAVVISO,
} from './preavviso.ts';

const OGGI = new Date('2026-08-18T10:00:00Z');

Deno.test('il preavviso e di due giorni', () => {
  assertEquals(PREAVVISO_GIORNI, 2);
  assertEquals(primoGiornoUtile(OGGI), '2026-08-20');
});

Deno.test('oggi e domani sono troppo presto, dopodomani va bene', () => {
  assertEquals(preavvisoSufficiente('2026-08-18', OGGI), false, 'oggi');
  assertEquals(preavvisoSufficiente('2026-08-19', OGGI), false, 'domani');
  assert(preavvisoSufficiente('2026-08-20', OGGI), 'dopodomani');
  assert(preavvisoSufficiente('2026-09-30', OGGI), 'fra un mese');
});

/* Il passato non e' un problema di preavviso — lo respinge dataServizio in
   tipi.ts — ma non deve nemmeno passare da qui. */
Deno.test('una data nel passato non ha preavviso', () => {
  assertEquals(preavvisoSufficiente('2026-08-01', OGGI), false);
});

Deno.test('una data che non si legge non passa', () => {
  for (const v of ['', 'domani', '2026-02-31', '18/08/2026', null, undefined]) {
    assertEquals(preavvisoSufficiente(v, OGGI), false, `doveva essere respinta: ${v}`);
  }
});

/* Il salto del mese e dell'anno: sono i due punti dove un calcolo a mano
   sbaglia sempre. */
Deno.test('il preavviso attraversa il fine mese e il capodanno', () => {
  assertEquals(primoGiornoUtile(new Date('2026-08-30T10:00:00Z')), '2026-09-01');
  assertEquals(primoGiornoUtile(new Date('2026-12-31T10:00:00Z')), '2027-01-02');
  /* anno bisestile: il 2028 ha il 29 febbraio */
  assertEquals(primoGiornoUtile(new Date('2028-02-28T10:00:00Z')), '2028-03-01');
});

/* ---------- a chi si applica ---------- */

Deno.test('vale sui trattamenti, e AVVISA senza rifiutare', () => {
  assertEquals(TIPI_CON_PREAVVISO, ['trattamenti']);
  assert(pocoPreavviso('trattamenti', { giorno: '2026-08-19' }, OGGI), 'domani: poco preavviso');
  assertEquals(pocoPreavviso('trattamenti', { giorno: '2026-08-20' }, OGGI), false, 'dopodomani: va bene');
});

/* Il Day Spa no: un ingresso alle piscine si chiede anche per domani, e la
   disponibilita' la dice gia' il ponte. Gli altri tipi nemmeno. */
Deno.test('non vale sugli altri tipi, Day Spa compreso', () => {
  for (const tipo of ['dayspa', 'transfer', 'greenfee', 'maestro', 'soggiorno']) {
    assertEquals(
      pocoPreavviso(tipo, { giorno: '2026-08-19', quando: '2026-08-19', data: '2026-08-19' }, OGGI),
      false,
      `${tipo} non doveva avere un preavviso`,
    );
  }
});
