/* ============================================================
   etichetta.test.ts — la mappa di etichette del back office non deve
   rispondere a chiavi che non ha.

   PERCHE' UN TEST CHE LEGGE L'HTML. La funzione `etichetta` vive dentro il
   <script type="module"> di pagine/buoni/index.html, insieme al resto del
   back office: non e' un modulo importabile, e spostarla fuori vorrebbe dire
   aggiungere un import fra cartelle a una pagina che oggi non ne ha —
   proprio la manovra che in questo progetto ha gia' fatto uscire pagine
   bianche in produzione due volte.

   Allora si prende dalla sorgente e la si esegue. Il test resta legato al
   file vero: se qualcuno riscrive `etichetta` in modo sbagliato, o la
   cancella, questo fallisce. Se la rinomina, fallisce e dice perche'.
   ============================================================ */

import { assertEquals, assertStringIncludes } from 'jsr:@std/assert';

const HTML = await Deno.readTextFile(new URL('./index.html', import.meta.url));

/* si estrae il corpo della funzione dal file vero, non una copia */
const sorgente = HTML.match(/function etichetta\(mappa, chiave\) \{[\s\S]*?\n\}/);
if (!sorgente) {
  throw new Error(
    'funzione `etichetta` non trovata in pagine/buoni/index.html: ' +
    'se e stata rinominata o spostata, questo test va aggiornato — non cancellato',
  );
}

const etichetta = new Function(
  `${sorgente[0]}; return etichetta;`,
)() as (mappa: Record<string, string>, chiave: unknown) => string;

const STATI = { nuova: 'da guardare', vista: 'vista', risposta: 'risposta data', chiusa: 'chiusa' };

Deno.test('una chiave presente da la sua etichetta', () => {
  assertEquals(etichetta(STATI, 'nuova'), 'da guardare');
  assertEquals(etichetta(STATI, 'chiusa'), 'chiusa');
});

Deno.test('una chiave assente torna com era, cosi lo staff vede almeno il valore grezzo', () => {
  assertEquals(etichetta(STATI, 'sconosciuto'), 'sconosciuto');
});

Deno.test('le chiavi ereditate da Object non sono etichette', () => {
  /* Il difetto che questo test esiste per fermare: `MAPPA[chiave] || chiave`
     sembra difendersi, ma a `toString` un oggetto risponde con una funzione
     — truthy — e in tabella comparirebbe il sorgente di quella funzione al
     posto dello stato della richiesta. */
  for (const finta of ['toString', 'constructor', 'hasOwnProperty', 'valueOf',
    'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString']) {
    assertEquals(etichetta(STATI, finta), finta, `«${finta}» ha prodotto un'etichetta`);
  }
});

Deno.test('__proto__ non e un etichetta e non fa esplodere niente', () => {
  assertEquals(etichetta(STATI, '__proto__'), '__proto__');
});

Deno.test('senza chiave si mostra una cella vuota, non la parola undefined', () => {
  assertEquals(etichetta(STATI, undefined), '');
  assertEquals(etichetta(STATI, null), '');
  assertEquals(etichetta(STATI, ''), '');
});

Deno.test('la pagina usa davvero etichetta(), e non e rimasta nessuna lettura diretta', () => {
  /* Senza questo, `etichetta` potrebbe restare corretta e inutilizzata:
     basterebbe che qualcuno rimettesse `STATI_RICHIESTA[r.stato] || r.stato`
     da qualche parte e il difetto tornerebbe con i test tutti verdi. */
  assertEquals(/STATI_RICHIESTA\[/.test(HTML), false, 'lettura diretta di STATI_RICHIESTA');
  assertEquals(/LINGUA_NOME\[/.test(HTML), false, 'lettura diretta di LINGUA_NOME');
  assertStringIncludes(HTML, 'etichetta(STATI_RICHIESTA, r.stato)');
  assertStringIncludes(HTML, 'etichetta(LINGUA_NOME, r.lingua)');
});
