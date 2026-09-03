/* ============================================================
   calendario-pagina.test.ts — Prenota usa il calendario a due tocchi.

   I due campi nativi del telefono spariscono dalla vista ma restano nel
   modulo, nascosti, con gli stessi id e i valori ISO: tutto quello che c'e'
   sotto (ricerca, chiusura, riepilogo, le altre prove) legge gli stessi
   campi. Un campo solo apre il calendario; alla conferma la pagina scrive
   i valori e lancia `change`, cosi' gli avvisi di oggi e il collegamento
   arrivo/partenza continuano a sentire. Prove sul sorgente: il DOM in Deno
   non c'e'.
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const PAGINA = Deno.readTextFileSync(new URL('index.html', import.meta.url));

Deno.test('Prenota usa il calendario: campi nascosti con gli stessi id, un campo unico che apre, la conferma che scrive e avvisa', () => {
  assert(/from '\/comune\/calendario\.js'/.test(PAGINA), 'la pagina non importa il calendario');
  assert(/<input type="hidden" id="fArrivo" name="arrivo" value="\$\{esc\(r\.arrivo\)\}" \/>/.test(PAGINA), 'fArrivo non e piu un campo nascosto con il valore ISO');
  assert(/<input type="hidden" id="fPartenza" name="partenza" value="\$\{esc\(r\.partenza\)\}" \/>/.test(PAGINA), 'fPartenza non e piu un campo nascosto con il valore ISO');
  assert(!/<input type="date"/.test(PAGINA), 'ci sono ancora campi data nativi');
  assert(/id="bDate"/.test(PAGINA) && /id="calendarioBox"/.test(PAGINA), 'manca il campo unico o il contenitore');
  assert(/apriCalendario\(\{/.test(PAGINA), 'il campo non apre il calendario');
  assert(/chiusure: STAGIONE \? \[STAGIONE\] : \[\]/.test(PAGINA), 'i giorni chiusi non vengono dalla stagione letta');
  assert(/new Event\('change', \{ bubbles: true \}\)/.test(PAGINA), 'la conferma non avvisa chi ascolta i campi');
  assert(/riassunto\(\{ arrivo: r\.arrivo, partenza: r\.partenza \}, LNG\)/.test(PAGINA), 'il campo non mostra le date gia scelte (dall indirizzo o da una ricerca precedente)');
});
