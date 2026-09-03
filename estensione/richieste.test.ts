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
type Giorno = { g: number; m: number; a: number };
type Periodo = { arrivo: Giorno; partenza: Giorno; notti?: number };
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
    storage: {
      local: { get: () => Promise.resolve({}), set: nulla, remove: nulla },
      onChanged: { addListener: nulla },
    },
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
  const d = l.leggiDate(RICHIESTA_INGLESE) as Periodo | null;
  assert(d, 'leggiDate non riconosce «from 29 to 30 August»');
  assertEquals(d!.arrivo.g, 29);
  assertEquals(d!.partenza.g, 30);
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
    const d = l.leggiDate(testo) as Periodo | null;
    assert(d, `leggiDate non riconosce «${testo}»`);
    assertEquals(d!.arrivo.g, a, `arrivo sbagliato in «${testo}»`);
    assertEquals(d!.partenza.g, p, `partenza sbagliata in «${testo}»`);
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

Deno.test('2c — «3 guests (2 adults, 1 child)» fa tre persone, non quattro', () => {
  /* «guests» e' un totale, «adults» no. Prendendo il primo numero che
     capita si leggevano 3 adulti PIU' 1 bambino: quattro persone dove ce
     ne sono tre, ed e' il numero che moltiplica il prezzo.

     La richiesta di Una Pipic era scritta cosi' — «for three guests (2
     adults, 1 girl...)» — e non ha sbagliato solo perche' «three» e' una
     parola e non una cifra. Con «3 guests» sarebbe uscita sbagliata. */
  const l = lettori();
  const CASI = [
    'from 12 to 13 August, 3 guests (2 adults, 1 child)',
    'dal 12 al 13 agosto, 3 persone: 2 adulti e 1 bambino',
    'vom 12. bis 13. August, 3 Personen: 2 Erwachsene und 1 Kind',
  ] as const;
  for (const testo of CASI) {
    const r = l.parseLibera(testo, null);
    assert(r, `non letta: «${testo}»`);
    assertEquals(r!.adulti, 2, `adulti sbagliati in «${testo}»`);
    assertEquals(r!.bambini, 1, `bambini sbagliati in «${testo}»`);
  }
});

Deno.test('2d — un totale senza bambini resta quel totale', () => {
  const l = lettori();
  const r = l.parseLibera('from 12 to 13 August for 3 guests', null);
  assertEquals(r!.adulti, 3, 'senza bambini «3 guests» sono 3 adulti');
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

/* ============================================================
   5 — LE FORME CHE IL 3 SETTEMBRE 2026 SFUGGIVANO, in tedesco e in
   italiano. Dieci richieste per lingua, realistiche, fatte leggere al
   lettore vero: sei tedesche e cinque italiane uscivano senza date.
   Ogni prova qui sotto e' una di quelle forme.
   ============================================================ */
type Letta = { arrivo: Giorno; partenza: Giorno; notti?: number; nottiDedotte?: boolean };
const g = (x: Giorno) => `${x.a}-${String(x.m).padStart(2, '0')}-${String(x.g).padStart(2, '0')}`;

Deno.test('5a — le date etichettate: Anreise/Abreise, Arrivo/partenza, Arrival/departure, Arrivée/départ', () => {
  const l = lettori();
  const CASI = [
    ['Guten Tag, Anreise: 05.11.2026, Abreise: 12.11.2026, 2 Erwachsene', '2026-11-05', '2026-11-12'],
    ['Arrivo 05/11/2026 partenza 12/11/2026, 2 adulti', '2026-11-05', '2026-11-12'],
    ['Arrival: 05.11.2026 / Departure: 12.11.2026', '2026-11-05', '2026-11-12'],
    ['Arrivée le 05/11/2026, départ le 12/11/2026', '2026-11-05', '2026-11-12'],
    ['Anreise Sonntag 15.11.2026, Abreise Freitag 20.11.2026', '2026-11-15', '2026-11-20'],
    ['Check-in 24.12.2026, check-out 02.01.2027', '2026-12-24', '2027-01-02'],
  ] as const;
  for (const [testo, a, p] of CASI) {
    const d = l.leggiDate(testo) as Letta | null;
    assert(d, `leggiDate non riconosce «${testo}»`);
    assertEquals(g(d!.arrivo), a, `arrivo sbagliato in «${testo}»`);
    assertEquals(g(d!.partenza), p, `partenza sbagliata in «${testo}»`);
  }
});

Deno.test('5a-bis — etichettate coi mesi a parole e il giorno della settimana in mezzo', () => {
  const l = lettori();
  const d = l.leggiDate('Anreise Sonntag 15. November 2026, Abreise Freitag 20. November 2026') as Letta | null;
  assert(d, 'non letta');
  assertEquals(g(d!.arrivo), '2026-11-15');
  assertEquals(g(d!.partenza), '2026-11-20');
});

Deno.test('5b — le forme compatte tedesche e l apostrofo italiano', () => {
  const l = lettori();
  const CASI = [
    ['Zeitraum 12.-19.10.2026, 2 Personen', '2026-10-12', '2026-10-19'],
    ['wir möchten 12. bis 19. Oktober 2026 kommen', '2026-10-12', '2026-10-19'],
    ['vom 3. bis zum 10. Oktober 2026, Einzelzimmer', '2026-10-03', '2026-10-10'],
    ['vom 3. bis einschließlich 10. Oktober 2026', '2026-10-03', '2026-10-10'],
    ["dal 6 all'8 dicembre 2026 per due coppie", '2026-12-06', '2026-12-08'],
    ["dal 6 all' 8 dicembre 2026", '2026-12-06', '2026-12-08'],
  ] as const;
  for (const [testo, a, p] of CASI) {
    const d = l.leggiDate(testo) as Letta | null;
    assert(d, `leggiDate non riconosce «${testo}»`);
    assertEquals(g(d!.arrivo), a, `arrivo sbagliato in «${testo}»`);
    assertEquals(g(d!.partenza), p, `partenza sbagliata in «${testo}»`);
  }
});
