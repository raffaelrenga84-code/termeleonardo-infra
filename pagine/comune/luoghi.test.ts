/* ============================================================
   luoghi.test.ts — l'elenco ATAM, e le sue copie.

   L'ORIGINALE e' supabase/functions/richieste/luoghi.ts, che e' anche
   quello che RIFIUTA un luogo fuori elenco. Le pagine non possono
   importarlo: sono HTML puro, e un modulo Deno non si carica in un
   browser. Quindi la copia e' inevitabile — quello che non e' inevitabile
   e' che diverga.

   E divergeva gia': fino a oggi le copie erano TRE (luoghi.ts, il back
   office, il modulo transfer del sito, che aveva 189 <option> scritti a
   mano) e nessuna prova le confrontava. Una voce corretta in un posto solo
   costringe la reception a cercarla a mano fra 189, che e' esattamente il
   motivo per cui l'elenco era stato copiato parola per parola.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { LUOGHI_ATAM as ORIGINALE } from '../../supabase/functions/richieste/luoghi.ts';

const SORGENTE = Deno.readTextFileSync(new URL('luoghi.js', import.meta.url));

function copia(): string[] {
  const corpo = SORGENTE.replace('export const', 'const') + '\nreturn LUOGHI_ATAM;';
  return new Function(corpo)() as string[];
}

/* senza questa, le due prove sotto potrebbero confrontare due array vuoti */
Deno.test('la copia non e vuota', () => {
  assert(copia().length > 150, `solo ${copia().length} voci: la prova girerebbe a vuoto`);
});

Deno.test('la copia combacia voce per voce, ordine compreso', () => {
  assertEquals(copia(), [...ORIGINALE]);
});

/* I doppi spazi non sono un refuso: "Venezia  aeroporto" e "Terme  Euganee
   FS" li hanno anche sul modulo dei tassisti, e ripulirli romperebbe il
   confronto parola per parola. */
Deno.test('i doppi spazi sopravvivono alla copia', () => {
  const c = copia();
  assert(c.includes('Venezia  aeroporto'), 'il doppio spazio di Venezia e sparito');
  assert(c.includes('Terme  Euganee FS'), 'il doppio spazio di Terme Euganee e sparito');
});

Deno.test('nessuna pagina tiene piu una copia sua', () => {
  const back = Deno.readTextFileSync(new URL('../buoni/index.html', import.meta.url));
  const transfer = Deno.readTextFileSync(new URL('../richieste/transfer/index.html', import.meta.url));

  assert(!/const LUOGHI_ATAM\s*=\s*\[/.test(back),
    'pagine/buoni/index.html ha ancora una copia sua dell elenco');
  assert(!transfer.includes('<option value="Montegrotto"'),
    'pagine/richieste/transfer/index.html ha ancora i luoghi scritti a mano');

  for (const [nome, html] of [['buoni', back], ['transfer', transfer]] as const) {
    assert(html.includes('/comune/luoghi.js'), `la pagina ${nome} non importa il modulo comune`);
  }
});
