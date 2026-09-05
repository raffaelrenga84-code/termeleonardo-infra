import { assert, assertEquals } from 'jsr:@std/assert';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import {
  type BuonoPerPdf, codificabile, ETI_BOZZA, ETI_PDF, misuraCopertura, nomeFilePdf,
  pdfBuono, provaLayout, spezza,
} from './pdf-buono.ts';

/* l'insieme dei caratteri che i font standard sanno scrivere (WinAnsi):
   si prende dal font vero e non da una lista scritta a mano, cosi' la
   prova di codificabile misura il vincolo che il PDF ha davvero */
const docFinto = await PDFDocument.create();
const fontFinto = await docFinto.embedFont(StandardFonts.Helvetica);
const AMMESSI = new Set<number>(fontFinto.getCharacterSet());

/* ---------- spezza ---------- */

Deno.test('spezza va a capo per parole, entro la larghezza', () => {
  /* misura finta: un carattere = un punto, cosi' i conti si leggono */
  assertEquals(spezza('una parola lunghissimaaaaa fine', (s) => s.length, 10),
    ['una parola', 'lunghissimaaaaa', 'fine']);
});

Deno.test('spezza: una parola piu\' larga della riga resta sola sulla sua riga, non si taglia', () => {
  assertEquals(spezza('lunghissimaaaaa', (s) => s.length, 10), ['lunghissimaaaaa']);
});

Deno.test('spezza di una stringa vuota da\' una riga vuota, non zero righe', () => {
  /* chi disegna moltiplica le righe per l'interlinea: zero righe farebbe
     saltare l'ingombro di un blocco che sulla pagina esiste comunque */
  assertEquals(spezza('', (s) => s.length, 10), ['']);
});

/* ---------- codificabile ---------- */

Deno.test('codificabile tiene gli accenti, l\'euro, le virgolette curve e i trattini lunghi', () => {
  const dentro = 'àèéìòù€’“”…–—·ßœ';
  assertEquals(codificabile(dentro, AMMESSI), dentro);
});

Deno.test('codificabile toglie i caratteri che il font non sa scrivere (un emoji)', () => {
  /* pdf-lib lancia se drawText riceve un carattere fuori WinAnsi: meglio
     un buono senza l'emoji che nessun buono */
  assertEquals(codificabile('Buon compleanno 🌿 Anna', AMMESSI), 'Buon compleanno  Anna');
});

Deno.test('codificabile trasforma <br /> e <br> in un a capo vero', () => {
  /* i testi arrivano dall\'email, che va a capo con <br /> */
  assertEquals(codificabile('primo<br />secondo<br>terzo', AMMESSI), 'primo\nsecondo\nterzo');
});

Deno.test('codificabile sostituisce spazio unificatore, freccia e spunta invece di buttarli via', () => {
  assertEquals(codificabile('50 min → ok ✓', AMMESSI), '50 min - ok v');
});

/* ---------- misuraCopertura ---------- */

Deno.test('la fotografia del buono copre il riquadro senza schiacciarsi: sborda sopra e sotto', () => {
  /* il file e' 1449 × 420 px (rapporto 3.45), il riquadro 483 × 120: larga
     giusta, l'immagine viene alta 140 e ne restano fuori 10 sopra e 10 sotto */
  assertEquals(misuraCopertura(483, 120, 1449, 420), { w: 483, h: 140, dx: 0, dy: -10 });
});

Deno.test('una fotografia quadrata copre lo stesso: si ingrandisce sulla larghezza e si taglia', () => {
  assertEquals(misuraCopertura(483, 120, 100, 100), { w: 483, h: 483, dx: 0, dy: -181.5 });
});

Deno.test('una fotografia piu\' larga del riquadro si taglia ai lati, non lascia bianchi', () => {
  /* 1000 × 100 (rapporto 10) in un riquadro 483 × 120: qui comanda l'altezza */
  assertEquals(misuraCopertura(483, 120, 1000, 100), { w: 1200, h: 120, dx: -358.5, dy: 0 });
});

Deno.test('un\'immagine senza misure riempie il riquadro invece di dividere per zero', () => {
  assertEquals(misuraCopertura(483, 120, 0, 0), { w: 483, h: 120, dx: 0, dy: 0 });
});

/* ---------- nomeFilePdf ---------- */

Deno.test('nomeFilePdf usa il codice del buono', () => {
  assertEquals(nomeFilePdf({ codice: 'LEO-ACDE-FGHJ' }), 'Buono-Regalo-LEO-ACDE-FGHJ.pdf');
});

Deno.test('nomeFilePdf di una bozza non nomina nessun codice', () => {
  assertEquals(nomeFilePdf({ codice: 'LEO-ACDE-FGHJ' }, true), 'Buono-Regalo-BOZZA.pdf');
  assertEquals(nomeFilePdf({}), 'Buono-Regalo-BOZZA.pdf');
});

/* ---------- ETI_PDF ---------- */

Deno.test('ETI_PDF ha tutte e quattro le lingue con tutte e quattro le voci', () => {
  for (const l of ['it', 'de', 'en', 'fr']) {
    const e = ETI_PDF[l];
    assert(e, `manca la lingua ${l}`);
    for (const k of ['condizioni', 'online', 'rif', 'qrNota']) {
      assert(typeof (e as Record<string, string>)[k] === 'string' && (e as Record<string, string>)[k].length > 0,
        `${l}.${k} manca o e' vuota`);
    }
  }
});

/* ============================================================
   il foglio vero
   ============================================================ */

/* il buono piu' comune che l'hotel emette: un Day Spa feriale, comprato
   per qualcuno, in italiano */
const BUONO_DAYSPA: BuonoPerPdf = {
  codice: 'LEO-ACDE-FGHJ', numero: 'BR-2026-0042', tipo: 'servizio', voce_id: 'dayspa_feriale',
  descrizione: '1 × Ingresso Day Spa feriale', lingua: 'it', sottotitolo: null,
  destinatario: 'Anna Bianchi', dedica: null, acquirente: 'Marco Rossi',
  scade_il: '2027-09-05', scade_il_base: null, prorogato: false, stato: 'pagato',
};

/* il caso peggiore che la reception puo' davvero produrre: tedesco (la
   lingua con le parole piu' lunghe e le condizioni piu' lunghe), due voci,
   sottotitolo, una dedica di ventidue righe di macchina da scrivere, nomi
   lunghi da tutte e due le parti e la proroga da spiegare */
const BUONO_PEGGIORE: BuonoPerPdf = {
  codice: 'LEO-ACDE-FGHJ', numero: 'BR-2026-0042', tipo: 'servizio', voce_id: 'dayspa_feriale',
  descrizione: '1 × Ingresso Day Spa feriale\n1 × Massaggio rilassante (50 min)',
  lingua: 'de', sottotitolo: 'Ein Wellnesstag zu zweit im Winter 2027',
  destinatario: 'Maria Magdalena von Hohenberg-Schmid Jr.',
  dedica: 'Liebe Maria, wir wuenschen dir einen wunderschoenen Tag voller Ruhe und Entspannung in den Thermen. Geniesse jeden Augenblick, du hast es dir wirklich verdient. Alles Gute zum Geburtstag von deiner ganzen Familie! Bis bald!',
  acquirente: 'Johann Sebastian Mueller-Lippstadt sen.',
  scade_il: '2027-03-15', scade_il_base: '2027-01-10', prorogato: true, stato: 'pagato',
};

const FOTO_VERA = Deno.readFileSync(new URL('../../../pagine/buoni/img/buono-terme.jpg', import.meta.url));

for (const L of ['it', 'de', 'en', 'fr']) {
  Deno.test(`il foglio in ${L} e' un PDF A4 di una pagina sola, intestato al codice`, async () => {
    const byte = await pdfBuono({ ...BUONO_DAYSPA, lingua: L }, { foto: null });
    assertEquals(new TextDecoder().decode(byte.slice(0, 5)), '%PDF-');
    const doc = await PDFDocument.load(byte);
    assertEquals(doc.getPageCount(), 1);
    const p = doc.getPage(0);
    /* la carta intestata della proprieta' e' A4 esatta: se il foglio
       cambiasse misura la stampante lo riscalerebbe e il marchio uscirebbe
       storto */
    assert(Math.abs(p.getWidth() - 595.32) < 0.1, `larghezza ${p.getWidth()}`);
    assert(Math.abs(p.getHeight() - 841.92) < 0.1, `altezza ${p.getHeight()}`);
    assert(String(doc.getTitle()).includes('LEO-ACDE-FGHJ'), `titolo: ${doc.getTitle()}`);
  });
}

Deno.test('la bozza esce lo stesso, e si annuncia come bozza gia' + ' nel titolo del file', async () => {
  /* il buono non ancora pagato non ha un codice: il foglio deve uscire
     comunque, perche' e' l'anteprima che il cliente vede prima di pagare */
  const byte = await pdfBuono({ ...BUONO_DAYSPA, codice: null, numero: null }, { bozza: true, foto: null });
  const doc = await PDFDocument.load(byte);
  assertEquals(doc.getPageCount(), 1);
  assert(String(doc.getTitle()).toLowerCase().includes('bozza'), `titolo: ${doc.getTitle()}`);
});

Deno.test('con la fotografia vera il foglio esce lo stesso', async () => {
  const byte = await pdfBuono(BUONO_DAYSPA, { foto: FOTO_VERA });
  const doc = await PDFDocument.load(byte);
  assertEquals(doc.getPageCount(), 1);
});

Deno.test('la fotografia non sposta niente: il testo finisce alla stessa quota con o senza', async () => {
  /* entra a copertura e sborda fuori dal riquadro, ma quello che sborda e'
     tagliato: l'impaginazione non deve accorgersene */
  const senza = await provaLayout(BUONO_DAYSPA, { foto: null });
  const con = await provaLayout(BUONO_DAYSPA, { foto: FOTO_VERA });
  assertEquals(con, senza);
});

/** Il flusso di disegno che questo modulo scrive sulla pagina, decompresso.
 * Serve alla prova qui sotto: e' l'unico modo, senza un lettore di PDF, di
 * vedere gli operatori veri che finiscono nel foglio. */
async function flussoDelDisegno(byte: Uint8Array): Promise<string> {
  const testo = new TextDecoder('latin1').decode(byte);
  let da = 0;
  while (true) {
    const i = testo.indexOf('stream', da);
    if (i < 0) break;
    if (testo.slice(i - 3, i) === 'end') { da = i + 6; continue; }
    let inizio = i + 6;
    while (testo[inizio] === '\r' || testo[inizio] === '\n') inizio++;
    let fine = testo.indexOf('endstream', inizio);
    if (fine < 0) break;
    da = fine + 9;
    while (fine > inizio && (testo[fine - 1] === '\r' || testo[fine - 1] === '\n')) fine--;
    try {
      const s = new Blob([byte.slice(inizio, fine)]).stream().pipeThrough(new DecompressionStream('deflate'));
      const dentro = await new Response(s).text();
      if (dentro.startsWith('q\n') && dentro.includes(' re\nW\nn\n')) return dentro;
    } catch { /* i flussi delle immagini e dei font non sono testo */ }
  }
  throw new Error('nel PDF non si trova il flusso di disegno del buono');
}

Deno.test('il ritaglio della fotografia si apre e si richiude, o mangerebbe tutto il foglio', async () => {
  /* la fotografia sborda dal riquadro apposta (copertura) e si taglia col
     ritaglio del PDF. Se il ritaglio restasse aperto — un popGraphicsState
     dimenticato — tutto quello che viene dopo sarebbe invisibile fuori dal
     riquadro della foto: il buono uscirebbe bianco e nessun'altra prova se
     ne accorgerebbe, perche' i byte del PDF sarebbero validi lo stesso. */
  const flusso = await flussoDelDisegno(await pdfBuono(BUONO_DAYSPA, { foto: FOTO_VERA }));
  const righe = flusso.split('\n');
  /* il riquadro della fotografia nel foglio largo: x 56, y 718 − 120, 483 × 120 */
  assertEquals(righe.slice(0, 4), ['q', '56 598 483 120 re', 'W', 'n']);
  assertEquals(
    righe.filter((r) => r === 'q').length,
    righe.filter((r) => r === 'Q').length,
    'q e Q sbilanciati: il ritaglio resta aperto',
  );
});

Deno.test('una lingua che non conosciamo ricade sull\'italiano, non lascia il foglio vuoto', async () => {
  const byte = await pdfBuono({ ...BUONO_DAYSPA, lingua: 'es' }, { foto: null });
  const doc = await PDFDocument.load(byte);
  assertEquals(doc.getPageCount(), 1);
  assertEquals(doc.getTitle(), 'Buono Regalo LEO-ACDE-FGHJ');
});

Deno.test('un buono senza destinatario, senza dedica e senza scadenza non fa saltare il disegno', async () => {
  const byte = await pdfBuono({ codice: 'LEO-ACDE-FGHJ', descrizione: 'Massaggio rilassante' }, { foto: null });
  assertEquals(new TextDecoder().decode(byte.slice(0, 5)), '%PDF-');
});

Deno.test('un emoji nella dedica non fa fallire l\'emissione del buono', async () => {
  /* pdf-lib lancia sui caratteri fuori WinAnsi: se codificabile non
     filtrasse, una dedica copiata da WhatsApp lascerebbe il cliente
     senza buono */
  const byte = await pdfBuono({ ...BUONO_DAYSPA, dedica: 'Buon compleanno 🌿🎁 Anna! → con affetto' }, { foto: null });
  assertEquals(new TextDecoder().decode(byte.slice(0, 5)), '%PDF-');
});

/* ---------- l'ingombro ---------- */

/* Le due prove che sorvegliano le misure del foglio (Misure, LARGO e
   STRETTO in pdf-buono.ts). La prima stesura le aveva sbagliate: il buono
   comune finiva tre punti sotto il limite e usciva stretto per niente, e il
   caso peggiore andava a sbattere sul pie' della carta. Chi cambia un
   numero del disegno rilanci queste: dicono dove il testo finisce davvero,
   non se «sembra giusto». */

Deno.test('il buono piu\' comune sta nel foglio largo, senza doverlo stringere', async () => {
  const esito = await provaLayout(BUONO_DAYSPA, { foto: null });
  assertEquals(esito.compatto, false);
  assert(esito.yFinale >= 80, `il testo finisce a y ${esito.yFinale}, sotto la quota 80 del pie'`);
});

Deno.test('il caso peggiore stringe il foglio e ci sta comunque, sopra la quota del pie\'', async () => {
  const esito = await provaLayout(BUONO_PEGGIORE, { foto: null });
  assertEquals(esito.compatto, true);
  assert(esito.yFinale >= 80, `il testo finisce a y ${esito.yFinale}, sotto la quota 80 del pie'`);
  const byte = await pdfBuono(BUONO_PEGGIORE, { foto: null });
  assertEquals(new TextDecoder().decode(byte.slice(0, 5)), '%PDF-');
});

Deno.test('il caso peggiore ci sta in tutte e quattro le lingue, non solo in tedesco', async () => {
  /* il tedesco ha le parole piu' lunghe, ma le condizioni francesi sono
     lunghe quasi uguali: un foglio che va bene in una lingua sola non va bene */
  for (const L of ['it', 'de', 'en', 'fr']) {
    const esito = await provaLayout({ ...BUONO_PEGGIORE, lingua: L }, { foto: null });
    assert(esito.yFinale >= 80, `${L}: il testo finisce a y ${esito.yFinale}`);
  }
});

/* ---------- la copia dell'avviso di bozza ---------- */

/* ETI_BOZZA e' una copia: l'originale sta in pagine/buoni/buono.js, che gira
   nel browser e che una edge function non puo' importare. Questa prova legge
   il sorgente di quel file e confronta parola per parola, come buono.test.ts
   fa con le due copie di CONDIZIONI: se qualcuno cambia l'avviso di li',
   il buono in PDF non puo' restare indietro in silenzio. Si legge il file
   invece di importarlo apposta: il modulo delle pagine non deve nemmeno
   sfiorare l'albero di quello che si pubblica come funzione. */
Deno.test('ETI_BOZZA e\' identica all\'avviso di anteprima di pagine/buoni/buono.js', () => {
  const sorgente = Deno.readTextFileSync(new URL('../../../pagine/buoni/buono.js', import.meta.url));
  const da = sorgente.indexOf('export const ETI = {');
  const a = sorgente.indexOf('export const MESI_L');
  assert(da >= 0 && a > da, 'in buono.js non si trova piu\' il blocco ETI: prova da aggiornare');
  const blocco = sorgente.slice(da, a);
  const LINGUE = ['it', 'de', 'en', 'fr'];

  const voce = (l: string, chiave: string) => {
    const inizio = blocco.indexOf(`\n  ${l}:{`);
    assert(inizio >= 0, `in buono.js manca il blocco della lingua ${l}`);
    const dopo = LINGUE.slice(LINGUE.indexOf(l) + 1)
      .map((x) => blocco.indexOf(`\n  ${x}:{`)).filter((i) => i > inizio);
    const pezzo = blocco.slice(inizio, dopo.length ? dopo[0] : blocco.length);
    const trovato = new RegExp(`${chiave}:'([^']*)'`).exec(pezzo);
    assert(trovato, `in buono.js manca ${l}.${chiave}`);
    /* buono.js scrive gli accenti come \\uXXXX: JSON.parse li rimette a posto */
    return JSON.parse(`"${trovato[1]}"`);
  };

  for (const l of LINGUE) {
    assertEquals(ETI_BOZZA[l].anteprima, voce(l, 'anteprima'), `anteprima ${l}`);
    assertEquals(ETI_BOZZA[l].anteprimaNota, voce(l, 'anteprimaNota'), `anteprimaNota ${l}`);
  }
});

/* ---------- i due fogli da guardare ---------- */

Deno.test('due esempi da guardare, per chi rivede il disegno', async () => {
  const dove = (nome: string) => new URL('../../../.superpowers/sdd/2026-09-05-buono-pdf/' + nome, import.meta.url);
  Deno.writeFileSync(dove('esempio-it.pdf'), await pdfBuono(BUONO_DAYSPA, { foto: FOTO_VERA }));
  Deno.writeFileSync(dove('esempio-de.pdf'), await pdfBuono(BUONO_PEGGIORE, { foto: FOTO_VERA }));
});
