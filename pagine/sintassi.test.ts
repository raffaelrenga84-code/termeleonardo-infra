/* ============================================================
   sintassi.test.ts — il copione di ogni pagina si compila, IMPORT COMPRESI.

   IL GUASTO CHE PRESIDIA, ed e' successo davvero. Il 3 settembre 2026 la
   pagina Prenota e' rimasta bianca in produzione per ore: solo il logo,
   nessun modulo, nessun errore visibile. Il browser diceva
   «Identifier 'nottiFra' has already been declared»: una modifica aveva
   aggiunto `nottiFra` fra gli import da /comune/date.js, e piu' sotto la
   pagina aveva ancora la sua copia locale `const nottiFra = ...`. Due
   dichiarazioni dello stesso nome nello stesso modulo: JavaScript non
   esegue NIENTE, nemmeno la prima riga.

   PERCHE' LE ALTRE PROVE ERANO VERDI. Tutte quelle che controllano la
   sintassi tolgono prima gli import (non si possono dare a `new Function`),
   e cosi' il nome importato spariva dal conto: restava una sola
   dichiarazione, e il copione compilava. Questa prova invece TRADUCE ogni
   import in una dichiarazione con gli stessi nomi — `import { a, b as c }`
   diventa `const { a, c } = {}` — e solo dopo compila. Un doppione fra un
   import e una const, o fra due import, diventa rosso qui.

   Vale per ogni pagina con un <script type="module"> sotto pagine/: non
   serve elencarle, e una pagina nuova e' coperta dal primo giorno.
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const RADICE = new URL('./', import.meta.url);

/* tutte le pagine HTML sotto pagine/, ricorsivamente. Si tengono gli URL
   e non i percorsi: su Windows `pathname` comincia con «/C:/» e Deno non
   lo apre */
function pagine(dir: URL = RADICE, out: URL[] = []): URL[] {
  for (const e of Deno.readDirSync(dir)) {
    if (e.name === 'node_modules') continue;
    const p = new URL(e.name + (e.isDirectory ? '/' : ''), dir);
    if (e.isDirectory) pagine(p, out);
    else if (/\.html$/.test(e.name)) out.push(p);
  }
  return out;
}
const nomeDi = (u: URL) => decodeURIComponent(u.pathname.slice(RADICE.pathname.length));

/** i nomi che un import dichiara: default, namespace, e quelli fra graffe
    (col nome DOPO «as», che e' quello visibile nel modulo) */
function nomiDi(clausola: string): string[] {
  const nomi: string[] = [];
  const graffe = clausola.match(/\{([^}]*)\}/);
  if (graffe) {
    for (const voce of graffe[1].split(',')) {
      const v = voce.trim();
      if (!v) continue;
      const as = v.match(/\bas\s+(\w+)$/);
      nomi.push(as ? as[1] : v);
    }
  }
  const fuori = clausola.replace(/\{[^}]*\}/, '').trim();
  for (const parte of fuori.split(',')) {
    const p = parte.trim();
    if (!p) continue;
    const ns = p.match(/^\*\s+as\s+(\w+)$/);
    nomi.push(ns ? ns[1] : p);
  }
  return nomi.filter((n) => /^\w+$/.test(n));
}

/** il copione di un <script type="module">, con gli import tradotti in
    dichiarazioni e gli export tolti, pronto per `new Function` */
export function compilabile(modulo: string): string {
  return modulo
    .replace(/^\s*import\s+([^'"]+?)\s+from\s+['"][^'"]+['"];?/gm, (_t, clausola) => {
      const nomi = nomiDi(clausola);
      return nomi.length ? `const { ${nomi.join(', ')} } = {};` : '';
    })
    .replace(/^\s*import\s+['"][^'"]+['"];?/gm, '')
    .replace(/^\s*export\s+(default\s+)?/gm, '');
}

function compila(copione: string): string | null {
  try {
    /* dentro una funzione async: le pagine usano `await` in cima al modulo */
    new Function(`"use strict"; return (async () => {\n${copione}\n});`);
    return null;
  } catch (e) {
    return String(e);
  }
}

Deno.test('la traduzione degli import tiene i nomi, anche con «as»', () => {
  const c = compilabile(`import { a, b as c } from '/x.js';\nimport d from '/y.js';\nimport * as e from '/z.js';\nconst f = 1;`);
  assert(/const \{ a, c \} = \{\};/.test(c), c);
  assert(/const \{ d \} = \{\};/.test(c), c);
  assert(/const \{ e \} = \{\};/.test(c), c);
});

Deno.test('e un doppione fra import e const viene visto: e il guasto di Prenota del 3 settembre', () => {
  const e = compila(compilabile(`import { nottiFra } from '/comune/date.js';\nconst nottiFra = (a, p) => 1;`));
  assert(e && /already been declared/.test(e), `doveva essere rosso: ${e}`);
});

Deno.test('ci sono pagine con un modulo da compilare', () => {
  const con = pagine().filter((p) => /<script type="module">/.test(Deno.readTextFileSync(p)));
  assert(con.length >= 5, `trovate ${con.length} pagine con modulo`);
});

for (const p of pagine()) {
  const html = Deno.readTextFileSync(p);
  const moduli = [...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)];
  if (!moduli.length) continue;
  const nome = nomeDi(p);
  Deno.test(`${nome}: il copione si compila, import compresi`, () => {
    for (const m of moduli) {
      const errore = compila(compilabile(m[1]));
      assert(errore === null, `${nome}: ${errore}`);
    }
  });
}
