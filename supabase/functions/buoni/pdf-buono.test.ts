import { assert, assertEquals } from 'jsr:@std/assert';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { type BuonoPerPdf, codificabile, ETI_PDF, nomeFilePdf, pdfBuono, provaLayout, spezza } from './pdf-buono.ts';

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

/* ---------- i due fogli da guardare ---------- */

Deno.test('due esempi da guardare, per chi rivede il disegno', async () => {
  const dove = (nome: string) => new URL('../../../.superpowers/sdd/2026-09-05-buono-pdf/' + nome, import.meta.url);
  Deno.writeFileSync(dove('esempio-it.pdf'), await pdfBuono(BUONO_DAYSPA, { foto: FOTO_VERA }));
  Deno.writeFileSync(dove('esempio-de.pdf'), await pdfBuono(BUONO_PEGGIORE, { foto: FOTO_VERA }));
});
