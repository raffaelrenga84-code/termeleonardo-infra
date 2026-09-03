/* testi.test.ts — i testi della pagina Day Spa: ogni chiave in tutte e
   quattro le lingue, e la riga «non rimborsabile» che dice davvero quello. */
import { assert, assertEquals } from 'jsr:@std/assert';
import { T } from './testi.js';

const TT = T as Record<string, Record<string, unknown>>;

Deno.test('le quattro lingue hanno le stesse chiavi', () => {
  const chiavi = Object.keys(TT.it).sort();
  assert(chiavi.length >= 30, `poche chiavi: ${chiavi.length}`);
  for (const l of ['de', 'en', 'fr']) assertEquals(Object.keys(TT[l]).sort(), chiavi, `chiavi diverse in ${l}`);
});

Deno.test('la riga non rimborsabile e le parole degli stati ci sono, nella lingua giusta', () => {
  assert(/non (è )?rimborsabile/i.test(String(TT.it.nonRimborsabile)));
  assert(/nicht erstattungs/i.test(String(TT.de.nonRimborsabile)));
  assert(/non-refundable|not refundable/i.test(String(TT.en.nonRimborsabile)));
  assert(/non remboursable/i.test(String(TT.fr.nonRimborsabile)));
  for (const l of ['it', 'de', 'en', 'fr']) {
    const s = TT[l].stati as Record<string, string>;
    for (const k of ['chiuso', 'non-in-vendita', 'esaurito', 'ultimi', 'disponibile']) assert(s[k], `${l}: manca lo stato ${k}`);
    const f = TT[l].fasce as Record<string, string>;
    assert(f.giornaliero && f.serale, `${l}: mancano le fasce`);
  }
});
