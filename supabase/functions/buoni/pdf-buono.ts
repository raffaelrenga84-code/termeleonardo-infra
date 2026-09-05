/* ============================================================
   pdf-buono.ts — il buono regalo come UN foglio A4, disegnato sopra la
   carta intestata vera dell'hotel.

   IL PROBLEMA. Fino a ieri lo stesso buono usciva in tre rese diverse:
   l'anteprima del back office, il foglio di stampa di pagine/buoni/stampa
   e il buono dentro l'email. Tre HTML da tenere allineati a mano, tre
   risultati diversi a seconda del browser e del programma di posta, e
   nessuno dei tre sulla carta dell'hotel. La proprieta' (5 settembre 2026)
   ha chiesto una cosa sola: il buono su carta intestata, uguale sempre,
   da allegare all'email e da mostrare nelle pagine.

   COSA FA QUESTO MODULO. Prende la pagina della carta intestata
   (carta-intestata.ts, il PDF della proprieta' incorporato) e ci disegna
   sopra il buono, fra il marchio in alto (fino a y 780) e il pie' in basso
   (da y 57 in giu'): colonna da x 56 a x 539, da y 718 scendendo, mai sotto
   y 80. Niente HTML, niente browser: il foglio esce identico dal server.

   I TESTI NON SI RISCRIVONO QUI. Etichette, condizioni, «come prenotare» e
   l'elenco del Day Spa vengono da email-buono.ts: sono gli stessi che il
   cliente legge nell'email e che ha accettato prima di pagare. Una seconda
   copia qui vorrebbe dire, prima o poi, due buoni che dicono cose diverse.

   TUTTO PASSA DA codificabile(). I font standard del PDF scrivono solo
   WinAnsi: un emoji in una dedica farebbe lanciare pdf-lib e il cliente
   resterebbe senza buono. Meglio un buono senza l'emoji che nessun buono.
   ============================================================ */

import { degrees, PDFDocument, PDFFont, PDFImage, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import { cartaIntestata } from './carta-intestata.ts';
import { comprende, CONDIZIONI, dataLingua, ETI, percorsoPrenota, PRENOTA } from './email-buono.ts';
import { QrCode } from './qr.js';

export type BuonoPerPdf = {
  codice?: string | null; numero?: string | null; tipo?: string | null; voce_id?: string | null;
  descrizione?: string | null; lingua?: string | null; sottotitolo?: string | null;
  destinatario?: string | null; dedica?: string | null; acquirente?: string | null;
  scade_il?: string | null; scade_il_base?: string | null; prorogato?: boolean | null;
  stato?: string | null; valore?: number | null;
};

export type OpzioniPdf = { bozza?: boolean; foto?: Uint8Array | null };

/* ---------- la geometria del foglio ---------- */

/* la colonna del buono: gli stessi numeri della carta intestata, misurati
   sul PDF della proprieta' (vedi carta-intestata.ts) */
const SX = 56, DX = 539, LARGH = 483;
const Y_ALTO = 718;
/** sotto questa quota comincia il pie' della carta: il testo non ci arriva */
const Y_MINIMA = 80;

const colore = (esa: string) =>
  rgb(parseInt(esa.slice(1, 3), 16) / 255, parseInt(esa.slice(3, 5), 16) / 255, parseInt(esa.slice(5, 7), 16) / 255);

const VERDE = colore('#1B4D4A');
const ORO = colore('#C9A961');
const GRIGIO = colore('#8A938F');
const GRIGIO_SCURO = colore('#4A5C59');
const INCHIOSTRO = colore('#2A2E2B');
const CARTA = colore('#FBFAF7');
const RIGA = colore('#E6E2D8');
const BOZZA = colore('#8A6D1F');
const NERO_QR = colore('#1A1A1A');
/* il posto della fotografia quando la fotografia non c'e': un rettangolo
   verde chiarissimo, cosi' il foglio resta impaginato uguale */
const FOTO_ASSENTE = colore('#E4F0EA');
/* il filo dentro il riquadro del servizio e il codice finto della bozza */
const FILO = colore('#EFEBE0');
const CODICE_FINTO = colore('#C7C2B6');

/* ---------- la fotografia in cima ---------- */

export const FOTO_BANNER = 'https://arrivo-terme-leonardo.vercel.app/buoni/img/buono-terme.jpg';
export const FOTO_LARGHEZZA = 483, FOTO_ALTEZZA = 140;

let fotoInMemoria: Uint8Array | null = null;

/** La fotografia del buono, scaricata dal sito delle pagine e tenuta in
 * memoria per le chiamate successive. Non lancia mai e non aspetta piu' di
 * cinque secondi: se il sito non risponde il buono esce lo stesso, con il
 * riquadro al posto della foto. Un buono senza fotografia e' un buono; un
 * buono che non esce perche' un'immagine non si e' scaricata, no. */
export async function fotoBanner(): Promise<Uint8Array | null> {
  if (fotoInMemoria) return fotoInMemoria;
  const freno = new AbortController();
  const scadenza = setTimeout(() => freno.abort(), 5000);
  try {
    const r = await fetch(FOTO_BANNER, { signal: freno.signal });
    if (!r.ok) {
      console.warn('foto del buono non scaricata:', r.status);
      return null;
    }
    fotoInMemoria = new Uint8Array(await r.arrayBuffer());
    return fotoInMemoria;
  } catch (e) {
    console.warn('foto del buono non scaricata:', (e as Error).message);
    return null;
  } finally {
    clearTimeout(scadenza);
  }
}

/* ---------- i puri ---------- */

/** Va a capo per parole entro `larghezza`, misurando con `misura` (che sara'
 * `font.widthOfTextAtSize`). Una parola piu' larga della riga NON si taglia:
 * resta sola sulla sua riga e sborda — un codice o un indirizzo tagliato a
 * meta' sarebbe peggio di uno che sfora. Una stringa vuota da' una riga
 * vuota e non zero righe: chi conta l'ingombro moltiplica le righe per
 * l'interlinea e deve trovare il blocco che sulla pagina c'e' comunque. */
export function spezza(testo: string, misura: (s: string) => number, larghezza: number): string[] {
  const parole = String(testo ?? '').split(/\s+/).filter(Boolean);
  if (!parole.length) return [''];
  const righe: string[] = [];
  let riga = '';
  for (const p of parole) {
    const prova = riga ? riga + ' ' + p : p;
    if (riga && misura(prova) > larghezza) {
      righe.push(riga);
      riga = p;
    } else riga = prova;
  }
  righe.push(riga);
  return righe;
}

/** Tiene solo i caratteri che il font sa scrivere (`ammessi` sono i code
 * point WinAnsi di `font.getCharacterSet()`), dopo aver sostituito quelli
 * che hanno un equivalente sensato. `page.drawText` LANCIA su un carattere
 * fuori WinAnsi: una dedica con un cuoricino, un «→» copiato da un listino
 * o uno spazio unificatore incollato da Word basterebbero a far fallire
 * l'emissione del buono. L'a capo si tiene: e' il segno con cui i buoni a
 * piu' voci separano le righe. */
export function codificabile(testo: string, ammessi: Set<number>): string {
  const pulito = String(testo ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/ /g, ' ')
    .replace(/→/g, '-')
    .replace(/✓/g, 'v');
  let fuori = '';
  for (const ch of pulito) {
    if (ch === '\n' || ammessi.has(ch.codePointAt(0) as number)) fuori += ch;
  }
  return fuori;
}

/** Il nome con cui il foglio arriva sul computer di chi lo scarica o lo
 * riceve in allegato. Senza codice (bozza, o buono non ancora pagato) non
 * si nomina nessun codice: non esiste ancora. */
export function nomeFilePdf(b: { codice?: string | null }, bozza?: boolean): string {
  const c = String(b?.codice ?? '').trim().replace(/[^A-Za-z0-9-]/g, '');
  if (bozza || !c) return 'Buono-Regalo-BOZZA.pdf';
  return `Buono-Regalo-${c}.pdf`;
}

/* ---------- le etichette che esistono solo sul foglio ---------- */

/** Le quattro voci che l'email non ha (l'email non stampa le condizioni per
 * esteso e non ha ne' il numero di riferimento ne' il QR con la sua nota).
 * Tutto il resto — titolo, «con affetto da», codice, validita', proroga,
 * nota, condizioni, «come prenotare» — viene da email-buono.ts. */
export const ETI_PDF: Record<string, { condizioni: string; online: string; rif: string; qrNota: string }> = {
  it: { condizioni: 'CONDIZIONI', online: 'Oppure prenoti online su ', rif: 'Riferimento', qrNota: 'Mostri questo codice in reception' },
  de: { condizioni: 'BEDINGUNGEN', online: 'Oder buchen Sie online auf ', rif: 'Referenz', qrNota: 'Zeigen Sie diesen Code an der Rezeption' },
  en: { condizioni: 'TERMS', online: 'Or book online at ', rif: 'Reference', qrNota: 'Show this code at reception' },
  fr: { condizioni: 'CONDITIONS', online: 'Ou réservez en ligne sur ', rif: 'Référence', qrNota: 'Présentez ce code à la réception' },
};

/* L'avviso della bozza — «ANTEPRIMA, NON ANCORA VALIDO» — vive in
   pagine/buoni/buono.js, che gira nel browser: una funzione edge non puo'
   importare quel file (non viene pubblicato con la funzione), e
   email-buono.ts non lo tiene perche' l'email di un buono non pagato non
   parte mai. Terza copia obbligata, come CONDIZIONI in email-buono.ts:
   se cambia la' va cambiata anche qui. */
const ETI_BOZZA: Record<string, { anteprima: string; anteprimaNota: string }> = {
  it: { anteprima: 'ANTEPRIMA — NON ANCORA VALIDO', anteprimaNota: 'Il codice viene assegnato al momento del pagamento.' },
  de: { anteprima: 'VORSCHAU — NOCH NICHT GÜLTIG', anteprimaNota: 'Der Code wird bei Zahlungseingang vergeben.' },
  en: { anteprima: 'PREVIEW — NOT YET VALID', anteprimaNota: 'The code is assigned once payment is received.' },
  fr: { anteprima: 'APERÇU — PAS ENCORE VALABLE', anteprimaNota: 'Le code est attribué au moment du paiement.' },
};

const LINGUE = ['it', 'de', 'en', 'fr'];
const lingua = (l: unknown) => LINGUE.includes(String(l)) ? String(l) : 'it';

/* ---------- gli attrezzi del disegno ---------- */

type Attrezzi = {
  page: PDFPage;
  H: PDFFont; HB: PDFFont; T: PDFFont; TI: PDFFont; CB: PDFFont;
  /* i code point che i font sanno scrivere: i quattro font standard hanno
     lo stesso insieme WinAnsi, quindi si calcola una volta sola
     dall'Helvetica e vale per tutti */
  ammessi: Set<number>;
};

const ripulisci = (a: Attrezzi, testo: unknown) => codificabile(String(testo ?? ''), a.ammessi);

function scrivi(a: Attrezzi, testo: unknown, x: number, base: number, font: PDFFont, misura: number, tinta: ReturnType<typeof rgb>) {
  const t = ripulisci(a, testo).replace(/\n/g, ' ');
  if (!t) return;
  a.page.drawText(t, { x, y: base, size: misura, font, color: tinta });
}

/** Le righe di un testo, gia' ripulito e gia' spezzato sulla larghezza. */
function righe(a: Attrezzi, testo: unknown, font: PDFFont, misura: number, larghezza: number): string[] {
  return spezza(ripulisci(a, testo), (s) => font.widthOfTextAtSize(s, misura), larghezza);
}

/* pdf-lib non ha la spaziatura fra lettere: le etichette in maiuscoletto
   (BUONO REGALO, CODICE BUONO, COME PRENOTARE...) si disegnano carattere
   per carattere, avanzando a mano. */
function scriviSpaziato(a: Attrezzi, testo: unknown, x: number, base: number, font: PDFFont, misura: number, tinta: ReturnType<typeof rgb>, passo: number) {
  const t = ripulisci(a, testo);
  let cx = x;
  for (const ch of t) {
    if (ch !== ' ' && ch !== '\n') a.page.drawText(ch, { x: cx, y: base, size: misura, font, color: tinta });
    cx += font.widthOfTextAtSize(ch, misura) + passo;
  }
}

/* ---------- il riquadro del servizio ---------- */

type PezziRiquadro = {
  descrizione: string[]; sottotitolo: string; voci: string[][]; nota: string[];
  padding: number;
};

/** Percorre il riquadro una volta per misurarlo e una volta per disegnarlo:
 * lo stesso codice per tutte e due, cosi' lo sfondo non puo' finire piu'
 * corto del testo che contiene. Torna l'altezza consumata. */
function riquadro(a: Attrezzi, p: PezziRiquadro, alto: number, disegna: boolean): number {
  const x = SX + p.padding;
  let y = alto - p.padding;

  for (const r of p.descrizione) {
    if (disegna) scrivi(a, r, x, y - 15, a.T, 15, VERDE);
    y -= 19;
  }
  if (p.sottotitolo) {
    y -= 6;
    if (disegna) scriviSpaziato(a, p.sottotitolo, x, y - 8, a.H, 8, ORO, 2);
    y -= 8;
  }
  if (p.voci.length) {
    y -= 8;
    for (const voce of p.voci) {
      for (let i = 0; i < voce.length; i++) {
        if (disegna) {
          if (i === 0) scrivi(a, '· ', x, y - 9.5, a.H, 9.5, ORO);
          scrivi(a, voce[i], x + 8, y - 9.5, a.H, 9.5, GRIGIO_SCURO);
        }
        y -= 13.5;
      }
    }
  }
  y -= 8;
  if (disegna) {
    a.page.drawLine({ start: { x, y }, end: { x: SX + LARGH - 16, y }, thickness: 0.7, color: FILO });
  }
  y -= 8;
  for (const r of p.nota) {
    if (disegna) scrivi(a, r, x, y - 8, a.H, 8, GRIGIO);
    y -= 11;
  }
  return alto - y + p.padding;
}

/* ---------- il QR ---------- */

/** Il codice a barre quadrato che la reception legge col lettore, dentro un
 * quadrato di `lato` punti con l'angolo in alto a destra in (x + lato, alto).
 * La zona quieta di due moduli sta DENTRO il quadrato: senza margine bianco
 * intorno molti lettori non agganciano il codice. */
function disegnaQr(a: Attrezzi, codice: string, x: number, alto: number, lato: number) {
  const qr = QrCode.encodeText(codice, QrCode.Ecc.QUARTILE);
  const quiete = 2;
  const cella = lato / (qr.size + quiete * 2);
  for (let ry = 0; ry < qr.size; ry++) {
    for (let rx = 0; rx < qr.size; rx++) {
      if (!qr.getModule(rx, ry)) continue;
      /* nel PDF la y cresce verso l'alto: la riga 0 del QR e' quella in cima */
      a.page.drawRectangle({
        x: x + (quiete + rx) * cella,
        y: alto - (quiete + ry + 1) * cella,
        width: cella, height: cella, color: NERO_QR, borderWidth: 0,
      });
    }
  }
}

/* ---------- il foglio ---------- */

/** Disegna tutto il buono sulla pagina e torna la `y` dove il testo
 * finisce (dopo le condizioni): serve a `pdfBuono` per decidere se il
 * foglio va rifatto in modo compatto. */
function disegnaBuono(a: Attrezzi, b: BuonoPerPdf, opz: OpzioniPdf, compatto: boolean, foto: PDFImage | null): number {
  const L = lingua(b.lingua);
  const e = ETI[L];
  const bozza = !!opz.bozza;
  let y = Y_ALTO;

  /* 1. la fotografia (o il suo posto) */
  const hFoto = compatto ? 100 : FOTO_ALTEZZA;
  if (foto) {
    a.page.drawImage(foto, { x: SX, y: y - hFoto, width: FOTO_LARGHEZZA, height: hFoto });
  } else {
    a.page.drawRectangle({ x: SX, y: y - hFoto, width: FOTO_LARGHEZZA, height: hFoto, color: FOTO_ASSENTE, borderWidth: 0 });
  }
  y -= hFoto + 16;

  /* 2. l'occhiello: BUONO REGALO */
  scriviSpaziato(a, String(e.titolo).toUpperCase(), SX, y - 8.5, a.H, 8.5, ORO, 2.5);
  y -= 8.5 + 8;

  /* 3. il titolo: «Anna, hai ricevuto un dono speciale». Nell'email va a
     capo con <br />, qui no: la riga la decide la larghezza della colonna. */
  const dest = String(b.destinatario ?? '').trim();
  const titolo = String(dest ? e.haRicevuto(dest) : e.senzaNome).replace(/<br\s*\/?>/gi, ' ');
  const interTitolo = compatto ? 25 : 27;
  for (const r of righe(a, titolo, a.T, 22, LARGH)) {
    scrivi(a, r, SX, y - 22, a.T, 22, VERDE);
    y -= interTitolo;
  }

  /* 4. da chi arriva */
  const acquirente = String(b.acquirente ?? '').trim();
  if (acquirente) {
    y -= 10;
    scriviSpaziato(a, e.da, SX, y - 7.5, a.H, 7.5, GRIGIO, 2);
    y -= 7.5 + 5;
    scrivi(a, acquirente, SX, y - 13, a.TI, 13, VERDE);
    y -= 13;
  }

  /* 5. la dedica di chi regala */
  const dedica = String(b.dedica ?? '').trim();
  if (dedica) {
    y -= 8;
    for (const r of righe(a, dedica, a.TI, 11.5, LARGH)) {
      scrivi(a, r, SX, y - 11.5, a.TI, 11.5, GRIGIO_SCURO);
      y -= 15;
    }
  }

  /* 6. il riquadro del servizio: cosa si e' regalato */
  y -= 16;
  const padding = compatto ? 10 : 13;
  const largTesto = LARGH - padding - 16;
  /* le righe della descrizione arrivano gia' separate dagli a capo (i buoni
     a piu' voci ne hanno una per voce); si spezzano lo stesso sulla
     larghezza, perche' una voce lunga non deve uscire dal riquadro */
  const descrizione: string[] = [];
  for (const r of String(b.descrizione ?? '').split('\n')) {
    if (!r.trim()) continue;
    for (const riga of righe(a, r, a.T, 15, largTesto)) descrizione.push(riga);
  }
  const voci = comprende({ voce_id: b.voce_id, descrizione: String(b.descrizione ?? '') }, L)
    .map((v) => righe(a, v, a.H, 9.5, largTesto - 8));
  const pezzi: PezziRiquadro = {
    descrizione,
    sottotitolo: String(b.sottotitolo ?? '').trim(),
    voci,
    nota: righe(a, e.nota, a.H, 8, largTesto),
    padding,
  };
  const hRiquadro = riquadro(a, pezzi, 0, false);
  a.page.drawRectangle({ x: SX, y: y - hRiquadro, width: LARGH, height: hRiquadro, color: CARTA, borderWidth: 0 });
  a.page.drawRectangle({ x: SX, y: y - hRiquadro, width: 3, height: hRiquadro, color: ORO, borderWidth: 0 });
  riquadro(a, pezzi, y, true);
  y -= hRiquadro;

  /* 7. il codice, la validita' e il QR */
  y -= 14;
  a.page.drawLine({ start: { x: SX, y }, end: { x: DX, y }, thickness: 0.7, color: RIGA });
  y -= 12;
  const altoRiga = y;
  const latoQr = 84;
  const largSinistra = LARGH - latoQr - 16;

  let ys = altoRiga;
  scriviSpaziato(a, e.codice, SX, ys - 7.5, a.H, 7.5, GRIGIO, 2);
  ys -= 7.5 + 6;
  /* in bozza il codice non c'e' ancora: al suo posto dei trattini, cosi'
     nessuno prova a presentarsi in reception con un'anteprima */
  if (bozza) scriviSpaziato(a, '— — — — —', SX, ys - 17, a.CB, 17, CODICE_FINTO, 2);
  else scriviSpaziato(a, String(b.codice ?? ''), SX, ys - 17, a.CB, 17, VERDE, 2);
  ys -= 17 + 8;
  scrivi(a, e.valido(b.scade_il ? dataLingua(String(b.scade_il), L) : '—'), SX, ys - 10, a.H, 10, ORO);
  ys -= 10;
  /* la proroga si spiega solo quando c'e' stata davvero: un buono che scade
     a giugno non ha niente da spiegare */
  if (b.prorogato && b.scade_il_base) {
    ys -= 5;
    const spiega = e.prorogato(dataLingua(String(b.scade_il_base), L), dataLingua(String(b.scade_il ?? ''), L));
    for (const r of righe(a, spiega, a.H, 8.5, largSinistra)) {
      scrivi(a, r, SX, ys - 8.5, a.H, 8.5, GRIGIO);
      ys -= 11;
    }
  }

  let hDestra = 0;
  if (b.codice && !bozza) {
    disegnaQr(a, String(b.codice), DX - latoQr, altoRiga, latoQr);
    const centro = DX - latoQr / 2;
    let yq = altoRiga - latoQr - 7;
    const nota = righe(a, ETI_PDF[L].qrNota, a.H, 7, 100);
    for (const r of nota) {
      const larg = a.H.widthOfTextAtSize(ripulisci(a, r), 7);
      scrivi(a, r, centro - larg / 2, yq, a.H, 7, GRIGIO);
      yq -= 9;
    }
    hDestra = latoQr + 7 + 9 * nota.length;
  } else if (bozza) {
    /* al posto del QR, l'avviso: questo foglio non vale ancora niente */
    const eb = ETI_BOZZA[L] || ETI_BOZZA.it;
    let yb = altoRiga;
    for (const r of righe(a, eb.anteprima, a.H, 8, 150)) {
      scrivi(a, r, DX - a.H.widthOfTextAtSize(ripulisci(a, r), 8), yb - 8, a.H, 8, BOZZA);
      yb -= 11;
    }
    yb -= 4;
    for (const r of righe(a, eb.anteprimaNota, a.H, 7.5, 150)) {
      scrivi(a, r, DX - a.H.widthOfTextAtSize(ripulisci(a, r), 7.5), yb - 7.5, a.H, 7.5, GRIGIO);
      yb -= 10;
    }
    hDestra = altoRiga - yb;
  }
  y = altoRiga - Math.max(altoRiga - ys, hDestra);

  /* 8. come prenotare: chi compra dal sito non passa dalla reception, ed
     e' l'unica volta in cui glielo si dice */
  y -= 14;
  const p = PRENOTA[L] || PRENOTA.it;
  scriviSpaziato(a, p.titolo, SX, y - 7.5, a.H, 7.5, GRIGIO, 2);
  y -= 7.5 + 6;
  for (const r of righe(a, p.come, a.H, 10, LARGH)) {
    scrivi(a, r, SX, y - 10, a.H, 10, INCHIOSTRO);
    y -= 13;
  }
  const online = ripulisci(a, ETI_PDF[L].online);
  const dominio = 'hoteltermeleonardo.com' + percorsoPrenota(b);
  const lOnline = a.H.widthOfTextAtSize(online, 10);
  const lDominio = a.HB.widthOfTextAtSize(ripulisci(a, dominio), 10);
  if (lOnline + lDominio <= LARGH) {
    scrivi(a, online, SX, y - 10, a.H, 10, INCHIOSTRO);
    scrivi(a, dominio, SX + lOnline, y - 10, a.HB, 10, VERDE);
    y -= 13;
  } else {
    /* l'indirizzo non si spezza mai a meta': va tutto sulla riga dopo */
    scrivi(a, online, SX, y - 10, a.H, 10, INCHIOSTRO);
    y -= 13;
    scrivi(a, dominio, SX, y - 10, a.HB, 10, VERDE);
    y -= 13;
  }

  /* 9. le condizioni, per esteso: sono quelle che il cliente ha accettato
     prima di pagare, e sul foglio ci devono stare tutte */
  y -= 12;
  scriviSpaziato(a, ETI_PDF[L].condizioni, SX, y - 7.5, a.H, 7.5, GRIGIO, 2);
  y -= 7.5 + 5;
  const misCond = compatto ? 6.3 : 6.8;
  const interCond = compatto ? 8 : 8.6;
  for (const r of righe(a, CONDIZIONI[L] || CONDIZIONI.it, a.H, misCond, LARGH)) {
    scrivi(a, r, SX, y - misCond, a.H, misCond, GRIGIO);
    y -= interCond;
  }

  /* 10. il riferimento amministrativo, sempre appena sopra il pie': serve
     in reception e in amministrazione per ritrovare il buono, e non deve
     ballare a seconda di quanto e' lungo il resto del foglio */
  if (b.numero) {
    scrivi(a, `TERME LEONARDO · ${ETI_PDF[L].rif} ${b.numero}`, SX, 68, a.H, 7, GRIGIO);
  }

  /* 11. la filigrana della bozza, per ultima cosi' passa sopra tutto */
  if (bozza) {
    a.page.drawText(ripulisci(a, 'BOZZA · NON VALIDO'), {
      x: 110, y: 330, size: 54, font: a.HB, color: ORO, opacity: 0.16, rotate: degrees(30),
    });
  }

  return y;
}

/** Una copia fresca della carta intestata col buono disegnato sopra. */
async function creaFoglio(b: BuonoPerPdf, opz: OpzioniPdf, compatto: boolean) {
  const doc = await PDFDocument.load(cartaIntestata());
  const page = doc.getPage(0);
  const H = await doc.embedFont(StandardFonts.Helvetica);
  const a: Attrezzi = {
    page, H,
    HB: await doc.embedFont(StandardFonts.HelveticaBold),
    T: await doc.embedFont(StandardFonts.TimesRoman),
    TI: await doc.embedFont(StandardFonts.TimesRomanItalic),
    CB: await doc.embedFont(StandardFonts.CourierBold),
    ammessi: new Set<number>(H.getCharacterSet()),
  };
  const L = lingua(b.lingua);
  doc.setTitle(opz.bozza ? 'Buono Regalo — bozza' : `Buono Regalo ${String(b.codice ?? '')}`.trim());
  doc.setAuthor('Hotel Terme Leonardo');
  doc.setLanguage(L);
  /* la fotografia si incorpora qui, fuori dal disegno: e' l'unico pezzo
     asincrono e il disegno deve restare una funzione che si legge dall'alto
     in basso come il foglio */
  let foto: PDFImage | null = null;
  if (opz.foto && opz.foto.length) {
    try {
      foto = await doc.embedJpg(opz.foto);
    } catch (err) {
      console.warn('foto del buono non incorporata:', (err as Error).message);
    }
  }
  const y = disegnaBuono(a, b, opz, compatto, foto);
  return { doc, y, compatto };
}

/* Prima si prova il foglio largo; se il testo arriva troppo in basso (sotto
   la quota del pie') si rifa' tutto in modo compatto su una carta pulita —
   non si puo' "cancellare" quello che pdf-lib ha gia' disegnato. Il testo
   non si taglia MAI: se anche il compatto sfora, il foglio esce lo stesso
   con tutto quello che deve dire. */
async function foglio(b: BuonoPerPdf, opz: OpzioniPdf) {
  const largo = await creaFoglio(b, opz, false);
  if (largo.y >= Y_MINIMA) return largo;
  return await creaFoglio(b, opz, true);
}

/** Il foglio del buono, pronto da scaricare, da allegare o da mostrare. */
export async function pdfBuono(b: BuonoPerPdf, opz?: OpzioniPdf): Promise<Uint8Array> {
  const f = await foglio(b, opz || {});
  return await f.doc.save();
}

/** Lo stesso disegno, ma risponde dove finisce: per le prove di ingombro. */
export async function provaLayout(b: BuonoPerPdf, opz?: OpzioniPdf): Promise<{ yFinale: number; compatto: boolean }> {
  const f = await foglio(b, opz || {});
  return { yFinale: f.y, compatto: f.compatto };
}
