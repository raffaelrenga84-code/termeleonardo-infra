/* ============================================================
   listino.test.ts — prezzi e fasce del Day Spa, l'unica copia.

   I prezzi sono quelli del sito il 3 settembre 2026: 35 feriale, 45
   prefestivo e festivo, 29 serale. Il tipo del giorno lo dice il
   calendario: sabato prefestivo, domenica e feste festivo, vigilie
   prefestivo. Pasqua si calcola, non si scrive a mano ogni anno.

   Si lancia con:  deno test supabase/functions/dayspa/ --allow-read
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import {
  eFesta, fasceDelGiorno, listinoPubblico, pasqua, prezzoCent, tipoDelGiorno, totaleCent, PERSONE_MAX, SOGLIA_ULTIMI,
} from './listino.ts';

Deno.test('un mercoledi e feriale, un sabato prefestivo, una domenica festivo', () => {
  assertEquals(tipoDelGiorno('2026-09-09'), 'feriale');
  assertEquals(tipoDelGiorno('2026-09-05'), 'prefestivo');
  assertEquals(tipoDelGiorno('2026-09-06'), 'festivo');
});

Deno.test('le feste nazionali sono festivo anche in settimana', () => {
  assertEquals(tipoDelGiorno('2026-12-08'), 'festivo');   // Immacolata, martedi
  assertEquals(tipoDelGiorno('2026-04-06'), 'festivo');   // Pasquetta 2026
  assertEquals(tipoDelGiorno('2026-06-02'), 'festivo');   // Repubblica
  assertEquals(tipoDelGiorno('2026-08-15'), 'festivo');
  assert(eFesta('2026-12-25') && !eFesta('2026-12-24'));
});

Deno.test('Pasqua si calcola: 2026 il 5 aprile, 2027 il 28 marzo', () => {
  assertEquals(pasqua(2026), '2026-04-05');
  assertEquals(pasqua(2027), '2027-03-28');
});

Deno.test('la vigilia di una festa in settimana e prefestivo', () => {
  assertEquals(tipoDelGiorno('2026-12-07'), 'prefestivo');  // lunedi prima dell Immacolata
  assertEquals(tipoDelGiorno('2026-12-24'), 'prefestivo');
});

Deno.test('il serale c e solo venerdi e sabato', () => {
  assertEquals(fasceDelGiorno('2026-09-04'), ['giornaliero', 'serale']);  // venerdi
  assertEquals(fasceDelGiorno('2026-09-05'), ['giornaliero', 'serale']);  // sabato
  assertEquals(fasceDelGiorno('2026-09-06'), ['giornaliero']);            // domenica
  assertEquals(fasceDelGiorno('2026-09-09'), ['giornaliero']);
});

Deno.test('i prezzi sono quelli del sito, in centesimi', () => {
  assertEquals(prezzoCent('feriale', 'giornaliero'), 3500);
  assertEquals(prezzoCent('prefestivo', 'giornaliero'), 4500);
  assertEquals(prezzoCent('festivo', 'giornaliero'), 4500);
  assertEquals(prezzoCent('feriale', 'serale'), 2900);
  assertEquals(prezzoCent('festivo', 'serale'), 2900);
});

Deno.test('il totale e prezzo per persone, e sopra il massimo si rifiuta', () => {
  assertEquals(totaleCent('feriale', 'giornaliero', 2), 7000);
  assertEquals(PERSONE_MAX, 8);
  assertEquals(SOGLIA_ULTIMI, 5);
  let errore = '';
  try { totaleCent('feriale', 'giornaliero', 9); } catch (e) { errore = String(e); }
  assert(/persone/.test(errore), 'nove persone dovevano essere rifiutate');
});

Deno.test('il listino pubblico porta fasce, orari, prezzi e massimo persone, e niente altro', () => {
  const l = listinoPubblico();
  assertEquals(Object.keys(l).sort(), ['fasce', 'orari', 'personeMax', 'prezzi']);
  assertEquals(l.prezzi.giornaliero.feriale, 3500);
});
