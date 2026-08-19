/* ============================================================
   fanghi-copie.test.ts — le tre fasce dei fanghi, scritte in due posti.

   PERCHE' DUE. Le etichette («presto — dalle 5:50» e le altre due) stanno
   in supabase/functions/prepara-arrivo/fanghi.ts, dove servono all'email
   per la reception. La scheda «Arrivi» del back office deve dire le stesse
   parole, ma pagine/buoni/index.html e' HTML puro e non puo' importare un
   modulo Deno: la copia e' inevitabile.

   QUELLO CHE NON E' INEVITABILE e' che le due divergano. Se domani si
   cambia l'orario in un posto solo, l'email dice una cosa e la schermata
   un'altra, e a scoprirlo e' l'ospite. Questa prova le tiene insieme.

   E TIENE ANCHE IL TERZO CASO: una fascia aggiunta in fanghi.ts e non in
   pagina comparirebbe alla Segreteria Cure come stringa nuda.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { DESIDERI, IN_RECEPTION } from '../../supabase/functions/prepara-arrivo/fanghi.ts';

const SORGENTE = Deno.readTextFileSync(new URL('index.html', import.meta.url));

function inPagina(): Record<string, string> {
  const m = SORGENTE.match(/const DESIDERIO_IN_PAGINA = \{([^}]*)\}/);
  assert(m, 'DESIDERIO_IN_PAGINA non si trova in pagine/buoni/index.html: ' +
    'la pagina e cambiata, aggiornare questa prova');
  const fuori: Record<string, string> = {};
  for (const riga of m![1].split('\n')) {
    const v = riga.match(/([a-z]+):\s*'(.*)'/);
    if (v) fuori[v[1]] = v[2];
  }
  return fuori;
}

/* senza questa, tutte le altre girerebbero su un oggetto vuoto */
Deno.test('le fasce in pagina si trovano', () => {
  assertEquals(Object.keys(inPagina()).length, DESIDERI.length);
});

Deno.test('ogni fascia dice in pagina quello che dice nell email', () => {
  const p = inPagina();
  for (const d of DESIDERI) {
    assertEquals(p[d], IN_RECEPTION[d], `la fascia "${d}" dice due cose diverse`);
  }
});

Deno.test('una fascia aggiunta domani non resta senza parole in pagina', () => {
  for (const d of DESIDERI) {
    assert(d in inPagina(), `la fascia "${d}" esiste e la pagina non sa come chiamarla`);
  }
});
