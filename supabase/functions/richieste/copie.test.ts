/* ============================================================
   copie.test.ts — le regole scritte due volte perche' non si puo' altrimenti.

   Le funzioni Supabase si pubblicano UNA CARTELLA PER VOLTA
   (strumenti/pubblica.js manda solo i file di quella funzione), quindi
   richieste/ non puo' importare da prepara-arrivo/. Dove la copia e'
   inevitabile, questa prova la tiene ferma.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { DESIDERI } from '../prepara-arrivo/fanghi.ts';

const SORGENTE = Deno.readTextFileSync(new URL('tipi.ts', import.meta.url));

function desideriInTipi(): string[] {
  const m = SORGENTE.match(/const DESIDERI_FANGHI = \[([^\]]*)\]/);
  assert(m, 'DESIDERI_FANGHI non si trova in tipi.ts: aggiornare questa prova');
  return m![1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
}

Deno.test('le fasce dei fanghi si trovano', () => {
  assertEquals(desideriInTipi().length, DESIDERI.length);
});

Deno.test('le fasce dei fanghi combaciano', () => {
  assertEquals(desideriInTipi(), [...DESIDERI]);
});
