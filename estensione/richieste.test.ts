/* ============================================================
   richieste.test.ts — che cosa il lettore capisce di una richiesta
   scritta a mano da un ospite.

   IL CASO CHE L'HA FATTA NASCERE, 24 agosto 2026. Una richiesta in
   inglese, chiarissima:

     «availability for one night, from 29 to 30 August, for three
      guests (2 adults, 1 girl, 15 year old). We will also be
      traveling with a small 10 kg dog... dinner at the hotel on the
      evening of 29 August and breakfast on the morning of 30 August.»

   L'anteprima ha scritto: «Persone: non lette». Del cane e della mezza
   pensione, niente.

   QUATTRO DIFETTI DISTINTI, e il primo e' di struttura:

   1. trovaRichiestaLibera sceglie gli elementi con un suo filtro sulle
      date che conosce «dal 12 al 13», «12-13», «vom 12. bis», e basta.
      parseLibera invece sa leggere anche «from 29 to 30 August» e «du 3
      au 5 juillet». Il filtro e' PIU' STRETTO del lettore che alimenta:
      il corpo di una richiesta inglese non diventa mai candidato, e
      passa solo qualche elemento piu' grande che contiene l'oggetto del
      messaggio — con le date dentro e il resto fuori. E' lo stesso
      difetto della v2.7.10: il ciclo accettava piu' cose della funzione
      che disegnava il pulsante. Due grammatiche per la stessa cosa
      divergono sempre: qui ne resta una sola, leggiDate().

   2. i bambini si leggono solo in italiano e tedesco: «1 girl», «1
      child», «un enfant» non li vedeva nessuno. E l'eta' scritta come
      «15 year old» nemmeno.

   3. cena piu' colazione fa mezza pensione, e non lo deduceva.

   4. il cane non lo leggeva affatto — in nessuna lingua.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const SORGENTE = Deno.readTextFileSync(new URL('outlook-inject.js', import.meta.url));

type Richiesta = Record<string, unknown> | null;
type Lettori = {
  parseLibera: (testo: string, mittente?: unknown) => Richiesta;
  leggiDate: (testo: string) => Record<string, unknown> | null;
};

/* outlook-inject.js e' una IIFE che al caricamento tocca window, chrome e
   i timer. Si carica con dei sostituti minimi e si prende il gancio che
   il file espone gia' in fondo (__leonardoInject). */
function lettori(): Lettori {
  const nulla = () => {};
  const finto: Record<string, unknown> = {};
  const win: Record<string, unknown> = {
    addEventListener: nulla,
    getSelection: () => null,
    open: nulla,
    HTMLInputElement: { prototype: {} },
  };
  win.top = win;
  const doc: Record<string, unknown> = {
    addEventListener: nulla,
    querySelectorAll: () => [],
    querySelector: () => null,
    getElementById: () => null,
    createElement: () => ({ style: {}, setAttribute: nulla, appendChild: nulla, classList: { add: nulla } }),
    body: { appendChild: nulla },
    documentElement: {},
  };
  const chrome = {
    storage: { local: { get: () => Promise.resolve({}), set: nulla, remove: nulla } },
    runtime: { sendMessage: nulla, onMessage: { addListener: nulla } },
    tabs: { create: nulla },
  };
  const fabbrica = new Function(
    'window', 'document', 'self', 'chrome', 'location', 'navigator',
    'setInterval', 'setTimeout', 'MutationObserver',
    SORGENTE + '\nreturn self.__leonardoInject;',
  );
  return fabbrica(
    win, doc, finto, chrome,
    { hostname: 'outlook.office.com', href: 'https://outlook.office.com/' },
    { userAgent: 'test' },
    nulla, nulla, function () { return { observe: nulla, disconnect: nulla }; },
  ) as Lettori;
}

/* la richiesta vera, ricopiata dalla scheda del 24 agosto 2026 */
const RICHIESTA_INGLESE = `Dear Hotel Terme Leonardo,

I would like to inquire about availability for one night, from 29 to 30 August, for three guests (2 adults, 1 girl, 15 year old).

We will also be traveling with a small 10 kg, non-shedding dog. Could you please confirm that he would be permitted and let us know if there is an additional pet fee?

We would also like to have dinner at the hotel on the evening of 29 August and breakfast on the morning of 30 August.

Please let us know what room and dining options are available, along with the total rate.

Thank you very much.

Best regards,

Una Pipic Leonard
+33.6.52.73.38.11`;

Deno.test('il lettore si carica: senza, nessuna richiesta viene letta', () => {
  const l = lettori();
  assert(typeof l.parseLibera === 'function', 'parseLibera non e esposta');
  assert(typeof l.leggiDate === 'function', 'leggiDate non e esposta: il filtro e il lettore hanno due grammatiche');
});

Deno.test('1 — il corpo di una richiesta inglese e riconoscibile da solo', () => {
  /* IL DIFETTO DI STRUTTURA. Se leggiDate non riconosce il corpo, il
     corpo non diventa mai candidato e vince un elemento piu' grande che
     contiene solo l'oggetto del messaggio: date lette, tutto il resto no. */
  const l = lettori();
  const d = l.leggiDate(RICHIESTA_INGLESE);
  assert(d, 'leggiDate non riconosce «from 29 to 30 August»');
  assertEquals(d!.giornoArrivo, 29);
  assertEquals(d!.giornoPartenza, 30);
});

Deno.test('1b — leggiDate copre tutte le forme che parseLibera sa leggere', () => {
  const l = lettori();
  const FORME = [
    ['dal 12 al 13 agosto 2026', 12, 13],
    ['12-13 agosto 2026', 12, 13],
    ['vom 12. bis 13. August 2026', 12, 13],
    ['from 29 to 30 August', 29, 30],
    ['from the 4th to the 6th of April', 4, 6],
    ['du 3 au 5 juillet', 3, 5],
  ] as const;
  for (const [testo, a, p] of FORME) {
    const d = l.leggiDate(testo);
    assert(d, `leggiDate non riconosce «${testo}»`);
    assertEquals(d!.giornoArrivo, a, `arrivo sbagliato in «${testo}»`);
    assertEquals(d!.giornoPartenza, p, `partenza sbagliata in «${testo}»`);
  }
});

Deno.test('2 — «2 adults, 1 girl, 15 year old» fa due adulti e una bambina di 15', () => {
  const l = lettori();
  const r = l.parseLibera(RICHIESTA_INGLESE, null);
  assert(r, 'la richiesta non e stata letta affatto');
  assertEquals(r!.adulti, 2, 'gli adulti');
  assertEquals(r!.bambini, 1, 'i bambini: «1 girl» non veniva letto');
  assertEquals(String(r!.etaBambini ?? ''), '15', 'l eta: «15 year old» non veniva letta');
});

Deno.test('2b — i bambini si leggono nelle quattro lingue', () => {
  const l = lettori();
  const CASI = [
    ['dal 12 al 13 agosto, 2 adulti e 1 bambino di 8 anni', 1],
    ['vom 12. bis 13. August, 2 Erwachsene und 2 Kinder', 2],
    ['from 12 to 13 August, 2 adults and 1 child', 1],
    ['from 12 to 13 August, 2 adults, 2 children', 2],
    ['du 12 au 13 août, 2 adultes et 1 enfant', 1],
  ] as const;
  for (const [testo, n] of CASI) {
    const r = l.parseLibera(testo, null);
    assert(r, `non letta: «${testo}»`);
    assertEquals(r!.bambini, n, `bambini sbagliati in «${testo}»`);
  }
});

Deno.test('3 — cena piu colazione fa mezza pensione, e lo dichiara', () => {
  const l = lettori();
  const r = l.parseLibera(RICHIESTA_INGLESE, null);
  assertEquals(r!.trattamento, 'Mezza Pensione');
  assert(r!.trattamentoDedotto, 'non dichiara che e una deduzione: cena+colazione non e la parola «mezza pensione»');
});

Deno.test('3b — la sola colazione resta Bed & Breakfast', () => {
  const l = lettori();
  const r = l.parseLibera('from 12 to 13 August, 2 adults. We would like breakfast only.', null);
  assertEquals(r!.trattamento, 'Bed & Breakfast');
});

Deno.test('4 — il cane si legge, nelle quattro lingue', () => {
  const l = lettori();
  assert(l.parseLibera(RICHIESTA_INGLESE, null)!.cane, 'il cane della richiesta vera non e stato letto');
  const CASI = [
    'dal 12 al 13 agosto, veniamo con il nostro cane di piccola taglia',
    'vom 12. bis 13. August, wir reisen mit unserem Hund',
    'from 12 to 13 August, traveling with a small dog',
    'du 12 au 13 août, nous voyageons avec notre chien',
  ];
  for (const testo of CASI) {
    assert(l.parseLibera(testo, null)!.cane, `cane non letto in «${testo}»`);
  }
});

Deno.test('4b — non si inventa un cane che non c e', () => {
  const l = lettori();
  const senza = [
    'dal 12 al 13 agosto, 2 adulti, camera matrimoniale',
    /* «cane» dentro un'altra parola non conta */
    'from 12 to 13 August, we saw your hotel on a webcam and liked it',
  ];
  for (const testo of senza) {
    const r = l.parseLibera(testo, null);
    assert(!r!.cane, `cane inventato in «${testo}»`);
  }
});
