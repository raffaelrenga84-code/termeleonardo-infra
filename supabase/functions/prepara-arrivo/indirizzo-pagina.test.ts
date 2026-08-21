/* ============================================================
   indirizzo-pagina.test.ts — il link «Prepara il suo arrivo» porta a una
   pagina che esiste.

   IL DIFETTO CHE PRESIDIA, trovato il 20 agosto 2026 aprendo il link in
   un browser vero. `https://www.hoteltermeleonardo.com/arrivo?t=…`
   rispondeva **200 con la home dell'hotel**: il sito riscrive /prenota,
   /buoni e /comune/* verso questo progetto, ma non /arrivo — e la nostra
   pagina viveva alla RADICE del progetto, dove nessuna riscrittura
   poteva pescarla. L'ospite che avesse premuto il pulsante sarebbe
   atterrato sulla home, senza modulo e senza un errore che glielo
   dicesse.

   Il pulsante non era ancora nelle conferme, quindi nessuno ci e'
   finito sopra. La pagina si e' spostata sotto `pagine/arrivo/`, come
   /prenota e /buoni, e il predefinito di BASE_PAGINA — che puntava a
   `arrivo.termeleonardo.com`, un dominio che NON RISOLVE PIU' — ora
   punta dove la pagina sta davvero.

   COSA RESTA FUORI DA QUI. La riscrittura `/arrivo` sul sito e il valore
   di BASE_PAGINA in produzione non stanno in questo deposito: questa
   prova tiene ferme le due cose che ci stanno — che il predefinito e la
   cartella della pagina siano lo stesso posto, e che il link si componga
   come la pagina si aspetta.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const SORGENTE = Deno.readTextFileSync(new URL('index.ts', import.meta.url));

/** Il valore predefinito di BASE_PAGINA, letto dal sorgente. */
function basePredefinita(): string {
  const m = SORGENTE.match(/BASE_PAGINA\s*=\s*Deno\.env\.get\('BASE_PAGINA'\)\s*\?\?\s*'([^']+)'/);
  assert(m, 'il predefinito di BASE_PAGINA non si trova: la funzione e cambiata');
  return m![1];
}

Deno.test('il link si compone come /qualcosa/?t=token', () => {
  /* la barra prima di `?t=` non e' un dettaglio: senza, `…/arrivo?t=x`
     e' un file di nome «arrivo», con, e' la cartella e il suo index */
  assert(
    SORGENTE.includes('${BASE_PAGINA}/?t=${t}'),
    'il link non si compone piu come `${BASE_PAGINA}/?t=`: se la forma cambia, ' +
      'cambia anche cosa deve contenere BASE_PAGINA — vanno cambiati insieme',
  );
});

Deno.test('il predefinito punta a una pagina che esiste in questo deposito', () => {
  const base = basePredefinita();
  const percorso = new URL(base).pathname.replace(/^\/|\/$/g, '');
  assert(
    percorso.length > 0,
    `il predefinito «${base}» punta alla radice di un dominio: la pagina d'arrivo ` +
      "vive sotto pagine/arrivo/, e un link alla radice del sito porta alla home dell'hotel",
  );
  const pagina = new URL(`../../../pagine/${percorso}/index.html`, import.meta.url);
  let esiste = true;
  try {
    Deno.statSync(pagina);
  } catch {
    esiste = false;
  }
  assert(
    esiste,
    `il predefinito punta a /${percorso}, ma pagine/${percorso}/index.html non esiste: ` +
      "il link porterebbe a una pagina che questo deposito non pubblica",
  );
});

Deno.test('e quella pagina e davvero il check-in, non un altra', () => {
  const base = basePredefinita();
  const percorso = new URL(base).pathname.replace(/^\/|\/$/g, '');
  const html = Deno.readTextFileSync(
    new URL(`../../../pagine/${percorso}/index.html`, import.meta.url),
  );
  assert(
    /Prepara il suo arrivo/i.test(html),
    `pagine/${percorso}/index.html non e la pagina d'arrivo`,
  );
});

Deno.test('il dominio del predefinito e uno di quelli dell hotel', () => {
  const host = new URL(basePredefinita()).host;
  assertEquals(
    /(^|\.)(hoteltermeleonardo|termeleonardo)\.com$/.test(host),
    true,
    `il predefinito punta a «${host}», che non e un dominio dell'hotel`,
  );
});
