/* ============================================================
   pagina.test.ts — la bacheca all'ingresso, letta dal sorgente.

   Deve aprirsi sui browser vecchi delle TV senza traduzioni: niente
   moduli, frecce, const/let, fetch, «?.», «??», accenti gravi.
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const P = Deno.readTextFileSync(new URL('./index.html', import.meta.url));
const copione = (P.match(/<script>([\s\S]*?)<\/script>/) ?? ['', ''])[1];

Deno.test('niente che una TV vecchia non capisca', () => {
  assert(copione.length > 1000, 'il copione c e');
  assert(!P.includes('type="module"'), 'niente moduli');
  for (const no of ['=>', 'const ', 'let ', 'async ', 'fetch(', '?.', '??', '`', 'location.origin']) assert(!copione.includes(no), `niente «${no}»`);
  assert(copione.includes('new XMLHttpRequest()') && copione.includes('?a=bacheca&locale='), 'chiede la bacheca al server con XMLHttpRequest');
});

Deno.test('riservata ai motori, dal PC parla col PC, si aggiorna ogni minuto', () => {
  assert(/<meta name="robots" content="noindex, nofollow"/.test(P));
  assert(copione.includes("location.protocol === 'http:'") && copione.includes('location.host') && copione.includes('supabase.co/functions/v1/pos'), 'PC o cloud');
  assert(copione.includes('setInterval(carica, 60000)'), 'ogni minuto');
  assert(copione.includes('Oggi niente in bacheca') && copione.includes('La bacheca non risponde'), 'dice quando e vuota e quando non risponde');
});
