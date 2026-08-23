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

/* Il modulo esporta due elenchi (LUOGHI_ATAM e PIU_RICHIESTI): si
   sostituiscono TUTTI gli `export const`, non solo il primo, o il secondo
   resterebbe con una sintassi che `new Function` non accetta fuori da un
   modulo. */
function modulo(): {
  LUOGHI_ATAM: string[];
  PIU_RICHIESTI: string[];
  ICONA_META: Record<string, string>;
} {
  const corpo = SORGENTE.replace(/export const/g, 'const') +
    '\nreturn { LUOGHI_ATAM, PIU_RICHIESTI, ICONA_META };';
  return new Function(corpo)();
}

function copia(): string[] {
  return modulo().LUOGHI_ATAM;
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

/* PIU_RICHIESTI e' una curatela, non le prime N voci di LUOGHI_ATAM:
   senza questa prova, un domani in cui qualcuno la "sistema" tagliandola
   dall'inizio dell'elenco passerebbe inosservato.

   DUE DAL 23 AGOSTO 2026, chieste dalla proprieta': l'aeroporto di Venezia
   e la stazione di Padova, «gli altri metterli in Un'altra destinazione,
   per rendere la schermata piu' leggera». Le altre dieci non sono sparite:
   la tendina completa e' LUOGHI_ATAM meno queste, quindi ci sono entrate
   da sole. */
Deno.test('i piu richiesti sono due, e non sono le prime due dell elenco', () => {
  const { LUOGHI_ATAM, PIU_RICHIESTI } = modulo();
  assertEquals(PIU_RICHIESTI.length, 2,
    `PIU_RICHIESTI ha ${PIU_RICHIESTI.length} voci, non due`);
  assertEquals(
    PIU_RICHIESTI.join(' | ') === LUOGHI_ATAM.slice(0, 2).join(' | '),
    false,
    'i piu richiesti sono diventati le prime due voci di LUOGHI_ATAM: ' +
      'quelle sono Montegrotto e Padova citta, che sono a due passi dall hotel ' +
      'e non sono punti di arrivo per un ospite',
  );
});

Deno.test('e quello che esce dai piu richiesti resta nella tendina', () => {
  /* e la ragione per cui accorciare l elenco non perde niente: la tendina
     completa e LUOGHI_ATAM meno i piu richiesti, non una lista scritta a
     parte che qualcuno deve ricordarsi di aggiornare */
  const { LUOGHI_ATAM, PIU_RICHIESTI } = modulo();
  for (const uscita of ['Treviso Aeroporto', 'Venezia porto', 'Mestre fs']) {
    assert(LUOGHI_ATAM.includes(uscita), `"${uscita}" non e piu in LUOGHI_ATAM`);
    assert(!PIU_RICHIESTI.includes(uscita), `"${uscita}" e tornata fra le pastiglie`);
  }
});

Deno.test('e ognuna delle due ha la sua icona', () => {
  /* la chiave e il valore ESATTO di ATAM, doppi spazi compresi: e quello
     che il modulo ha in mano quando disegna la pastiglia */
  const { PIU_RICHIESTI, ICONA_META } = modulo();
  for (const meta of PIU_RICHIESTI) {
    assert(ICONA_META[meta], `"${meta}" non ha un icona: uscirebbe nuda fra due che ce l hanno`);
  }
  assertEquals(Object.keys(ICONA_META).length, PIU_RICHIESTI.length,
    'ci sono icone per mete che non stanno fra le pastiglie: non le vedra nessuno');
});

Deno.test('ogni voce dei piu richiesti esiste in LUOGHI_ATAM, parola per parola', () => {
  const { LUOGHI_ATAM: tutte, PIU_RICHIESTI } = modulo();
  for (const l of PIU_RICHIESTI) {
    assert(tutte.includes(l), `"${l}" non e in LUOGHI_ATAM: si e disallineata, forse i tassisti l hanno rinominata`);
  }
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
