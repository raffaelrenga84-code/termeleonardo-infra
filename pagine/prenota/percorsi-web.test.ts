/* ============================================================
   percorsi-web.test.ts — il presidio di C2.

   IL DIFETTO. `pagine/prenota/index.html` caricava la sua logica con
   `import { ... } from './logica.js'` dentro uno <script type="module">.
   Un modulo si risolve contro l'INDIRIZZO CHE SI VEDE NELLA BARRA, non
   contro il file servito. Su www.hoteltermeleonardo.com/it/prenota — che
   e' una riscrittura di vercel.json verso /prenota/, e la barra resta
   /it/prenota, senza barra finale — `./logica.js` diventa /it/logica.js,
   che nessuna riscrittura copre: 404, oppure l'index.html della SPA
   servito con content-type text/html, che un modulo rifiuta. In entrambi i
   casi il modulo non carica, testata() e disegna() non partono mai, e
   l'ospite vede il logo e una pagina bianca.

   PERCHE' UN TEST E NON SOLO LA CORREZIONE. La correzione (percorso
   assoluto) vale per le due pagine di oggi. Questo test vale per la
   prossima che qualcuno dividera' in due file: e' l'unico modo perche' il
   difetto non si ripresenti da solo. `pagine/buoni/index.html` aveva lo
   stesso import relativo e si salvava per caso, solo perche' e' servito
   sotto /buoni/, che la riscrittura copre — un caso fortunato, non una
   regola.

   LA REGOLA. Ogni risorsa di una pagina statica si indica con un percorso
   assoluto dalla radice del sito (/prenota/logica.js, /buoni/img/logo.svg):
   quei percorsi sono coperti dalle riscritture /prenota/:percorso* e
   /buoni/:percorso* di vercel.json, e valgono identici sui due domini —
   arrivo-terme-leonardo.vercel.app e www.hoteltermeleonardo.com — comunque
   sia scritto l'indirizzo che l'ospite ha nella barra.
   ============================================================ */
import { assertEquals } from 'jsr:@std/assert';

const PAGINE = new URL('../', import.meta.url);

function pagine(dir: URL, trovate: URL[] = []): URL[] {
  for (const voce of Deno.readDirSync(dir)) {
    const sotto = new URL(voce.name + (voce.isDirectory ? '/' : ''), dir);
    if (voce.isDirectory) pagine(sotto, trovate);
    else if (voce.name.endsWith('.html')) trovate.push(sotto);
  }
  return trovate;
}

const nome = (u: URL) => decodeURIComponent(u.pathname).split('/pagine/')[1] ?? u.pathname;

/* un percorso va bene se parte dalla radice del sito o e' un indirizzo
   intero: sono i due casi che non dipendono da come e' scritta la barra */
const assoluto = (p: string) => p.startsWith('/') || /^https?:\/\//.test(p) || p.startsWith('data:');

Deno.test('nessuna pagina carica un modulo con un percorso relativo', () => {
  const colpevoli: string[] = [];
  for (const f of pagine(PAGINE)) {
    const testo = Deno.readTextFileSync(f);
    /* le due forme con cui un modulo tira dentro un altro file */
    const statico = testo.matchAll(/^\s*import\b[^;\n]*?\bfrom\s*['"]([^'"]+)['"]/gm);
    const dinamico = testo.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
    for (const m of [...statico, ...dinamico]) {
      if (!assoluto(m[1])) colpevoli.push(`${nome(f)} → ${m[1]}`);
    }
  }
  assertEquals(colpevoli, [],
    'un modulo relativo si risolve contro la barra degli indirizzi, non contro il file: ' +
    'su /it/prenota diventa /it/logica.js e la pagina resta bianca. Usa /prenota/logica.js.');
});

/* Non basta cercare i percorsi che cominciano per '.': `src="img/logo.svg"`
   e' relativo esattamente quanto `src="./img/logo.svg"` e cade nella stessa
   trappola. Si guarda quindi il contrario — che ogni riferimento sia di una
   forma che NON dipende dalla barra degli indirizzi. */
const ALTRO_SCHEMA = /^(?:#|mailto:|tel:|javascript:|\?)/;

Deno.test('nessuna pagina chiede immagini o fogli di stile con un percorso relativo', () => {
  const colpevoli: string[] = [];
  for (const f of pagine(PAGINE)) {
    const testo = Deno.readTextFileSync(f);
    for (const m of testo.matchAll(/\b(?:src|href)\s*=\s*"([^"]*)"/g)) {
      const p = m[1].trim();
      /* i valori composti a runtime (`${...}`) li decide il codice, non
         l'autore della pagina: qui non c'e' niente da controllare */
      if (!p || p.includes('${') || ALTRO_SCHEMA.test(p) || assoluto(p)) continue;
      colpevoli.push(`${nome(f)} → ${p}`);
    }
  }
  assertEquals(colpevoli, [],
    'stessa trappola dei moduli: dalla radice del sito, non relativi — ' +
    'anche senza il "./" davanti');
});

/* il presidio deve guardare qualcosa: se la ricerca dei file si rompe, i due
   test qui sopra passerebbero su un elenco vuoto senza dire niente */
Deno.test('il presidio guarda davvero tutte le pagine statiche', () => {
  const trovate = pagine(PAGINE).map(nome).sort();
  assertEquals(trovate.includes('prenota/index.html'), true);
  assertEquals(trovate.includes('buoni/index.html'), true);
  assertEquals(trovate.includes('buoni/regala/index.html'), true);
  assertEquals(trovate.includes('richieste/index.html'), true);
  assertEquals(trovate.includes('richieste/transfer/index.html'), true);
});
