/* ============================================================
   listino-copie.test.ts — il presidio sulle tre copie del listino.

   IL DIFETTO CHE PRESIDIA. Il listino vive in tre copie: `LISTINO` in
   supabase/functions/buoni/acquista.ts (l'unica fonte: e' quella che decide
   quanto si paga), `CATALOGO` in pagine/buoni/regala/index.html (quello che
   il cliente vede prima di pagare) e `CATALOGO` in pagine/buoni/index.html
   (quello che la reception vede quando compila un buono a mano).

   Finche' si mostrava un prezzo di listino solo, una divergenza si notava a
   occhio. Da quando un buono porta fino a due voci con quantita' fino a
   quattro, il pulsante dice `somma di prezzo_pagina x quantita'` mentre a
   Stripe va `somma di prezzo_server x quantita'`: se un prezzo cambia in un
   posto solo, il pulsante dice "Paga con carta — 160 €" e la carta viene
   addebitata di 180, IN SILENZIO. La risposta del server contiene solo
   numero e indirizzo di pagamento — niente che la pagina possa confrontare —
   e in caso di errore la pagina mostra comunque il messaggio generico. Non
   c'e' nessun punto, dopo questo test, in cui la differenza verrebbe fuori
   prima dell'estratto conto del cliente.

   PERCHE' QUI E NON IN buono.test.ts. Li' `daListino()` costruisce
   l'ingresso di riepilogoVoci dal LISTINO del server: presidia la formula
   (che la pagina componga la descrizione e il totale come li comporra' il
   server), non i dati. I due presidi sono complementari e nessuno dei due
   copre l'altro: la formula puo' essere giusta su numeri sbagliati.

   COME. Lo schema e' quello di pagine/prenota/percorsi-web.test.ts: si
   scandiscono i file .html sotto pagine/ da dentro il test, invece di
   elencare a mano i due percorsi. Cosi' una terza pagina che domani si
   portasse dietro la sua copia del catalogo entra nel presidio da sola,
   il giorno in cui viene scritta e non il giorno in cui qualcuno se ne
   ricorda.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { LISTINO } from '../../supabase/functions/buoni/acquista.ts';

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

/* Il vecchio identificativo del Day Spa serale: il server lo accetta ancora
   perche' una pagina rimasta in cache potrebbe mandarlo, ma nessuna pagina
   lo offre piu'. E' la sola differenza voluta fra le tre copie, ed e'
   dichiarata qui — non ignorata in silenzio: il test qui sotto verifica
   anche che punti allo stesso prodotto di dayspa_sera, cosi' se un domani
   il serale cambiasse prezzo e il vecchio identificativo restasse indietro,
   chi arriva dalla cache pagherebbe la cifra sbagliata e si vedrebbe qui. */
/* Vuoto dal 15 agosto 2026: `dayspa_pom` — il vecchio identificativo del
   serale, che il server accettava per le pagine rimaste in cache — e'
   stato tolto dal listino. Tenerlo vuoto e' il punto: una differenza
   nuova fra le tre copie va scritta qui col motivo, non lasciata
   passare. */
const SOLO_SERVER: Record<string, string> = {};

/* i commenti dentro il blocco non sono dati: si tolgono prima di leggerlo */
const senzaCommenti = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');

/* le pagine scrivono gli stessi nomi con escape diversi: regala/ scrive
   la lineetta e le vocali accentate come sequenze \uXXXX dove il back
   office mette il carattere vero. Il confronto si fa quindi sul testo
   decodificato, non sui byte del sorgente.
   JSON.parse fa la decodifica vera (\uXXXX, \\, \n) invece di una tabella
   scritta a mano; l'unica differenza fra una stringa fra apici singoli e
   una JSON e' l'apice, che qui si normalizza. */
const testoJS = (s: string): string =>
  JSON.parse('"' + s.replace(/\\'/g, "'").replace(/"/g, '\\"') + '"');

/* ['id','nome',prezzo] — la forma con cui le due pagine scrivono una voce */
const VOCE = /\[\s*'((?:[^'\\]|\\.)*)'\s*,\s*'((?:[^'\\]|\\.)*)'\s*,\s*(\d+(?:\.\d+)?)\s*\]/g;

/* il catalogo di una pagina, o null se quella pagina non ne ha uno */
function catalogo(testo: string): Map<string, [string, number]> | null {
  const blocco = testo.match(/const CATALOGO\s*=\s*(\[[\s\S]*?\n\];)/);
  if (!blocco) return null;
  const voci = new Map<string, [string, number]>();
  for (const m of senzaCommenti(blocco[1]).matchAll(VOCE)) {
    voci.set(testoJS(m[1]), [testoJS(m[2]), Number(m[3])]);
  }
  return voci;
}

/* una riga per voce: e' quello che assertEquals mette sotto gli occhi
   quando qualcosa diverge, e si legge senza dover aprire i tre file */
const righe = (voci: Map<string, [string, number]>) =>
  [...voci.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([id, [n, prezzo]]) => `${id} | ${n} | ${prezzo}`);

const dalServer = new Map<string, [string, number]>(
  Object.entries(LISTINO).filter(([id]) => !(id in SOLO_SERVER)),
);

/* le pagine che si portano dietro una copia del listino */
const cataloghi = (): [string, Map<string, [string, number]>][] =>
  pagine(PAGINE)
    .map((f) => [nome(f), catalogo(Deno.readTextFileSync(f))] as const)
    .filter((c): c is [string, Map<string, [string, number]>] => c[1] !== null)
    .map(([n, c]) => [n, c]);

Deno.test('ogni catalogo di pagina dice gli stessi id, gli stessi nomi e gli stessi prezzi del LISTINO del server', () => {
  for (const [pagina, voci] of cataloghi()) {
    assertEquals(
      righe(voci),
      righe(dalServer),
      `${pagina} e acquista.ts non dicono la stessa cosa. La pagina somma i ` +
        `prezzi che ha scritti dentro e li mostra sul pulsante, il server ne ` +
        `somma altri e li manda a Stripe: il cliente vedrebbe una cifra e ne ` +
        `pagherebbe un'altra, senza che niente glielo dica.`,
    );
  }
});

Deno.test('il vecchio identificativo tenuto solo sul server punta allo stesso prodotto di quello nuovo', () => {
  for (const [vecchio, nuovo] of Object.entries(SOLO_SERVER)) {
    assertEquals(LISTINO[vecchio], LISTINO[nuovo], `${vecchio} deve valere quanto ${nuovo}`);
  }
});

/* il presidio deve guardare qualcosa: se la ricerca dei file o la lettura
   del blocco si rompe, il test qui sopra passerebbe su un elenco vuoto
   senza dire niente — e' la stessa cautela di percorsi-web.test.ts */
Deno.test('il presidio guarda davvero le due pagine che hanno una copia del listino', () => {
  const trovate = cataloghi();
  assertEquals(trovate.map(([n]) => n).sort(), ['buoni/index.html', 'buoni/regala/index.html']);
  for (const [pagina, voci] of trovate) {
    assert(voci.size > 20, `${pagina}: lette solo ${voci.size} voci, la lettura del catalogo non funziona`);
  }
});
