/* ============================================================
   Da HTML ai campi che contano per un motore di ricerca.

   NON E' UN PARSER. Si leggono una manciata di tag dell'intestazione e si
   contano le parole del corpo: per questo bastano le espressioni regolari,
   e una dipendenza in piu' per fare la stessa cosa non si aggiunge.
   Dove le regex sarebbero fragili davvero — l'ordine degli attributi — c'e'
   attributi(), che li legge tutti invece di indovinarne la posizione.
   ============================================================ */
export type Campi = {
  titolo: string;
  descrizione: string;
  lang: string;
  h1: string[];
  canonical: string;
  hreflang: string[];
  /* Quanti di quegli hreflang portano un indirizzo relativo. Google vuole
     l'indirizzo completo, protocollo compreso: se e' relativo ignora il
     blocco intero, e una mappa delle lingue costruita bene non produce
     nessun effetto. Contarli e' l'unico modo perche' il rapporto non dia
     un via libera falso dicendo soltanto «hreflang: 5». */
  hreflangRelativi: number;
  robots: string;
  parole: number;
  immagini: number;
  senzaAlt: number;
};

/* Solo le entita' che compaiono davvero nei testi che leggiamo. Una che non
   si conosce si lascia com'e': meglio un `&agrave;` visibile nel rapporto
   che un carattere indovinato. */
const ENTITA: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export function decodifica(s: string): string {
  return String(s ?? '').replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (tutto: string, corpo: string) => {
      if (corpo[0] === '#') {
        const n = corpo[1] === 'x' || corpo[1] === 'X'
          ? parseInt(corpo.slice(2), 16)
          : parseInt(corpo.slice(1), 10);
        return Number.isFinite(n) && n > 0 ? String.fromCodePoint(n) : tutto;
      }
      const v = ENTITA[corpo.toLowerCase()];
      return v === undefined ? tutto : v;
    },
  );
}

const pulisci = (s: string): string => decodifica(s).replace(/\s+/g, ' ').trim();

/* Il titolo si legge com'e', gli spazi in mezzo compresi: il titolo vero di
   /it/cure-termali ne ha due di fila, ed e' un difetto da segnalare.
   Normalizzarlo qui renderebbe il controllo sul doppio spazio incapace di
   scattare — un controllo che non puo' scattare e' peggio che non averlo,
   perche' fa credere che sia stato guardato. Le andate a capo diventano
   spazi: quelle spezzerebbero la tabella del rapporto. */
const pulisciTitolo = (s: string): string =>
  decodifica(s).replace(/[\r\n\t]+/g, ' ').replace(/^ +| +$/g, '');

export function attributi(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s">]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag)) !== null) {
    out[m[1].toLowerCase()] = pulisci(m[3] ?? m[4] ?? m[5] ?? '');
  }
  return out;
}

const tagsDi = (html: string, nome: string): string[] =>
  [...html.matchAll(new RegExp(`<${nome}\\b[^>]*>`, 'gi'))].map((m) => m[0]);

export function leggiPagina(html: string): Campi {
  const testo = String(html ?? '');

  const mTitolo = testo.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const titolo = mTitolo ? pulisciTitolo(mTitolo[1]) : '';

  const mHtml = testo.match(/<html\b[^>]*>/i);
  const lang = mHtml ? (attributi(mHtml[0]).lang ?? '') : '';

  let descrizione = '';
  let robots = '';
  for (const t of tagsDi(testo, 'meta')) {
    const a = attributi(t);
    const nome = (a.name ?? '').toLowerCase();
    if (nome === 'description') descrizione = a.content ?? '';
    if (nome === 'robots') robots = a.content ?? '';
  }

  let canonical = '';
  const hreflang: string[] = [];
  let hreflangRelativi = 0;
  for (const t of tagsDi(testo, 'link')) {
    const a = attributi(t);
    const rel = (a.rel ?? '').toLowerCase();
    if (rel === 'canonical') canonical = a.href ?? '';
    if (rel === 'alternate' && a.hreflang) {
      hreflang.push(a.hreflang);
      if (!/^https?:\/\//i.test(a.href ?? '')) hreflangRelativi++;
    }
  }

  const h1 = [...testo.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
    .map((m) => pulisci(m[1].replace(/<[^>]+>/g, ' ')));

  const immagini = tagsDi(testo, 'img');
  const senzaAlt = immagini.filter((t) => !('alt' in attributi(t))).length;

  const corpo = testo
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  const parole = pulisci(corpo)
    .split(' ')
    .filter((p) => /[\p{L}\p{N}]/u.test(p)).length;

  return {
    titolo,
    descrizione,
    lang,
    h1,
    canonical,
    hreflang,
    hreflangRelativi,
    robots,
    parole,
    immagini: immagini.length,
    senzaAlt,
  };
}
