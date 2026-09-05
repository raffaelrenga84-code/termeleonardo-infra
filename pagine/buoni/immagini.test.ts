/* ============================================================
   immagini.test.ts — le fotografie che finiscono nel buono regalo.

   IL DIFETTO CHE PRESIDIA. pdf-buono.ts scarica una fotografia dal sito
   delle pagine e la mette in cima al foglio; buono.js ne nomina altre sul
   buono che l'ospite stampa dal browser. Nessuno le guarda mai prima del
   cliente: le prove girano sul disegno e sull'HTML e non scaricano niente.
   Due modi di rompersi, tutti e due silenziosi:

   · il file non c'e' piu' — rinominato, spostato, mai copiato. Sul foglio
     resta il rettangolo verde chiaro al posto della fotografia (fotoBanner
     non lancia mai, apposta), e nessuno se ne accorge finche' non arriva
     a un cliente un buono pagato senza la sua immagine;

   · il file c'e' ma ha un'altra forma. Il foglio dichiara 483 x 140 punti
     (FOTO_LARGHEZZA / FOTO_ALTEZZA): la fotografia ci entra a copertura,
     quindi non esce mai schiacciata, ma se il ritaglio ha proporzioni
     lontane da quelle dichiarate se ne perde meta' sopra e sotto — la
     piscina resta fuori dal buono.

   PERCHE' IL 3 %. Il vincolo e' sul RITAGLIO, non sui pixel: 1449 x 420
   (3.45) e 1440 x 420 (3.4286) sono lo stesso taglio, e chi riprepara la
   fotografia non deve inseguire il centesimo. Sopra il 3 % invece si perde
   una striscia che si vede.

   PERCHE' NASCE. Il 21 agosto 2026, sostituendo la fotografia del Day Spa
   con la grotta, il secondo caso e' andato a un passo: l'originale della
   grotta e' VERTICALE, 3747x5621. Ce ne siamo accorti leggendo il markup,
   non per merito di una prova. Adesso c'e' la prova.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const QUI = new URL('.', import.meta.url);

/* le misure che il FOGLIO dichiara: da li' viene il vincolo, non da un
   numero scelto qui. Si legge il sorgente invece di importarlo perche'
   pdf-buono.ts tira dentro pdf-lib, che si risolve solo con il deno.json
   della funzione — queste prove girano dalla radice del repository. */
const PDF = Deno.readTextFileSync(
  new URL('../../supabase/functions/buoni/pdf-buono.ts', import.meta.url),
);
const BUONO = Deno.readTextFileSync(new URL('buono.js', import.meta.url));

/* il nome del file dall'indirizzo scritto in FOTO_BANNER: e' quello che il
   server scarica davvero, non un nome ricopiato qui */
function fotoDelFoglio(): string {
  const m = PDF.match(/export const FOTO_BANNER = '([^']+)'/);
  assert(m, 'FOTO_BANNER non si trova piu in pdf-buono.ts');
  return m[1].split('/').pop() as string;
}

function rapportoDichiarato(): number {
  const m = PDF.match(/export const FOTO_LARGHEZZA = (\d+), FOTO_ALTEZZA = (\d+)/);
  assert(m, 'le misure della fotografia non si trovano piu in pdf-buono.ts');
  return Number(m[1]) / Number(m[2]);
}

/* ogni file nominato accanto a BASE_IMG dal buono che si stampa dal browser */
function nominati(): string[] {
  const fuori = new Set<string>();
  for (const m of BUONO.matchAll(/\$\{BASE_IMG\}\/([A-Za-z0-9._-]+)/g)) fuori.add(m[1]);
  return [...fuori].sort();
}

/* larghezza e altezza di un JPEG, dal marcatore SOFn: si LEGGE il file,
   non si crede al nome */
function misure(b: Uint8Array): [number, number] {
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const k = b[i + 1];
    if (k >= 0xc0 && k <= 0xcf && k !== 0xc4 && k !== 0xc8 && k !== 0xcc) {
      return [(b[i + 7] << 8) | b[i + 8], (b[i + 5] << 8) | b[i + 6]];
    }
    i += 2 + ((b[i + 2] << 8) | b[i + 3]);
  }
  throw new Error('non e un JPEG leggibile');
}

Deno.test('la fotografia del foglio esiste, ed è ritagliata come il foglio la dichiara', () => {
  const nome = fotoDelFoglio();
  const percorso = new URL('img/' + nome, QUI);
  assert(
    Deno.statSync(percorso).isFile,
    `${nome}, nominata da FOTO_BANNER, non esiste in pagine/buoni/img/: il buono ` +
      'esce col rettangolo vuoto al posto della fotografia',
  );
  const [w, h] = misure(Deno.readFileSync(percorso));
  const atteso = rapportoDichiarato();
  const r = w / h;
  assert(
    Math.abs(r - atteso) / atteso <= 0.03,
    `${nome} è ${w}x${h} (rapporto ${r.toFixed(4)}, il foglio dichiara ${atteso.toFixed(4)}): ` +
      'a copertura se ne perde una striscia sopra e sotto',
  );
});

Deno.test('e non pesa quanto un originale da fotocamera', () => {
  /* la scarica il server a ogni ripartenza dell'istanza, e finisce dentro
     ogni PDF spedito in allegato: sopra i 400 KB si sta spedendo
     l'originale, e l'allegato diventa pesante per la posta */
  const nome = fotoDelFoglio();
  const kb = Deno.statSync(new URL('img/' + nome, QUI)).size / 1024;
  assert(kb < 400, `${nome} pesa ${Math.round(kb)} KB`);
});

Deno.test('ogni fotografia nominata dal buono esiste davvero', () => {
  const nomi = nominati();
  assert(nomi.length >= 3, `solo ${nomi.length} file nominati: la prova non guarda niente`);
  const mancanti: string[] = [];
  for (const n of nomi) {
    try {
      assert(Deno.statSync(new URL('img/' + n, QUI)).isFile);
    } catch {
      mancanti.push(n);
    }
  }
  assertEquals(
    mancanti,
    [],
    'file nominati dal buono che non esistono: chi lo apre trova il riquadro ' +
      'dell immagine rotta dentro un buono regalo pagato',
  );
});

Deno.test('e nemmeno quelle del buono che si stampa dal browser', () => {
  /* le scarica il browser di chi apre la pagina di stampa. Le tre stanno
     fra 48 e 78 KB: sopra i 150 si sta mandando l originale. */
  const grosse: string[] = [];
  for (const n of nominati()) {
    if (!n.endsWith('.jpg')) continue; /* i loghi vanno ad altezza libera */
    const kb = Deno.statSync(new URL('img/' + n, QUI)).size / 1024;
    if (kb > 150) grosse.push(`${n} ${Math.round(kb)} KB`);
  }
  assertEquals(grosse, [], 'fotografie troppo pesanti per una pagina');
});
