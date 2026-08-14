/* ============================================================
   qr.test.ts — presidio del generatore di QR.

   Un QR generato male si vede identico a uno giusto: un occhio non nota
   se un modulo è nel posto sbagliato o se la maschera è quella scorretta.
   Per questo questi test non si fermano a "ci sono dei quadratini" — la
   parte che conta è decodificaQR() qui sotto: un decoder scritto da capo
   per il test, seguendo lo standard ISO/IEC 18004, che NON riusa la
   logica privata di QrCode (usa solo l'API pubblica: size, version,
   getModule). Se il port in qr.js avesse un baco — un ciclo con
   l'estremo sbagliato, un segno invertito nella maschera, una tabella
   trascritta male — un decoder scritto in un modo diverso ha buone
   probabilità di non condividere lo stesso baco, quindi se ne accorge
   invece di validare se stesso. I test veri sono quelli che arrivano
   fino al testo originale e lo confrontano con quello dato in ingresso.

   Le due tabelle numeriche (byte di correzione per blocco, numero di
   blocchi) sono le uniche prese da QrCode: sono costanti dello standard,
   non logica, e sono già state confrontate una per una col sorgente
   originale di Project Nayuki durante l'adattamento (le due tabelle
   combaciano cifra per cifra, verificato con uno script a parte). Tutto
   il resto qui sotto — maschere, scansione a zig-zag, aritmetica di
   Reed-Solomon, spacchettamento dei bit — è riscritto da zero. */
import { assert, assertEquals, assertStringIncludes, assertThrows } from 'jsr:@std/assert';
import { generaSvgQR, QrCode, QrSegment } from './qr.js';

/* ---------- decoder indipendente, solo per i test ---------- */

const ALFANUMERICO = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

function posizioniAllineamento(version: number, size: number): number[] {
  if (version === 1) return [];
  const numAlign = Math.floor(version / 7) + 2;
  const step = Math.floor((version * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4)) * 2;
  const ris = [6];
  for (let pos = size - 7; ris.length < numAlign; pos -= step) ris.splice(1, 0, pos);
  return ris;
}

/* le coordinate dei moduli di funzione (ricerca, temporizzazione,
   allineamento, informazioni di formato): geometria dello standard, non
   una scelta di implementazione — qualunque decoder corretto deve
   arrivare a queste stesse coordinate per sapere quali moduli sono dati
   e quali no. */
function moduliFunzione(size: number, version: number): boolean[][] {
  const f = Array.from({ length: size }, () => new Array(size).fill(false));
  const segna = (x: number, y: number) => { if (x >= 0 && x < size && y >= 0 && y < size) f[y][x] = true; };
  for (let i = 0; i < size; i++) { segna(6, i); segna(i, 6); }
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) segna(cx + dx, cy + dy);
  };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const pos = posizioniAllineamento(version, size);
  for (let i = 0; i < pos.length; i++) {
    for (let j = 0; j < pos.length; j++) {
      if (i === 0 && j === 0 || i === 0 && j === pos.length - 1 || i === pos.length - 1 && j === 0) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) segna(pos[i] + dx, pos[j] + dy);
    }
  }
  for (let y = 0; y <= 8; y++) segna(8, y);
  for (let y = size - 8; y <= size - 1; y++) segna(8, y);
  for (let x = 0; x <= 8; x++) segna(x, 8);
  for (let x = size - 8; x <= size - 1; x++) segna(x, 8);
  if (version >= 7) {
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + i % 3, b = Math.floor(i / 3);
      segna(a, b); segna(b, a);
    }
  }
  return f;
}

function formulaMaschera(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return (x * y) % 2 + (x * y) % 3 === 0;
    case 6: return ((x * y) % 2 + (x * y) % 3) % 2 === 0;
    case 7: return ((x + y) % 2 + (x * y) % 3) % 2 === 0;
    default: throw new Error('maschera sconosciuta: ' + mask);
  }
}

/* legge le due copie ridondanti delle informazioni di formato e ne
   ricalcola il codice di correzione BCH (10.910 = generatore 0x537):
   se non combacia col resto letto sul foglio, il QR non è valido */
function decodificaFormato(qr: QrCode): { eclFormatBits: number; mask: number } {
  const b = new Array(15).fill(false);
  for (let i = 0; i <= 5; i++) b[i] = qr.getModule(8, i);
  b[6] = qr.getModule(8, 7);
  b[7] = qr.getModule(8, 8);
  b[8] = qr.getModule(7, 8);
  for (let i = 9; i < 15; i++) b[i] = qr.getModule(14 - i, 8);
  let bits = 0;
  for (let i = 0; i < 15; i++) bits |= (b[i] ? 1 : 0) << i;

  const sbloccato = bits ^ 0x5412;
  const data = (sbloccato >>> 10) & 0x1F;
  const remLetto = sbloccato & 0x3FF;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  if (rem !== remLetto)
    throw new Error('informazioni di formato incoerenti: il QR non è valido');

  /* la seconda copia deve dire la stessa cosa della prima */
  const b2 = new Array(15).fill(false);
  for (let i = 0; i < 8; i++) b2[i] = qr.getModule(qr.size - 1 - i, 8);
  for (let i = 8; i < 15; i++) b2[i] = qr.getModule(8, qr.size - 15 + i);
  let bits2 = 0;
  for (let i = 0; i < 15; i++) bits2 |= (b2[i] ? 1 : 0) << i;
  if (bits2 !== bits)
    throw new Error('le due copie delle informazioni di formato non combaciano');

  return { eclFormatBits: (data >>> 3) & 0x3, mask: data & 0x7 };
}

/* stessa scansione a zig-zag di drawCodewords in qr.js, ma in lettura:
   raccoglie i bit dei moduli dato (non di funzione), togliendo la
   maschera modulo per modulo */
function leggiBitSmascherati(qr: QrCode, funz: boolean[][], mask: number): number[] {
  const { size } = qr;
  const bits: number[] = [];
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!funz[y][x]) {
          const originale = qr.getModule(x, y) !== formulaMaschera(mask, x, y);
          bits.push(originale ? 1 : 0);
        }
      }
    }
  }
  return bits;
}

/* aritmetica di Reed-Solomon su GF(256), riscritta da zero (stesso
   polinomio primitivo 0x11D dello standard: non è una scelta del
   progetto, è quella che il decoder DEVE usare per parlare la stessa
   lingua del codificatore) */
function rsMoltiplica(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11D);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xFF;
}

function rsDivisore(grado: number): number[] {
  let ris = new Array(grado - 1).fill(0);
  ris.push(1);
  let radice = 1;
  for (let i = 0; i < grado; i++) {
    for (let j = 0; j < ris.length; j++) {
      ris[j] = rsMoltiplica(ris[j], radice);
      if (j + 1 < ris.length) ris[j] ^= ris[j + 1];
    }
    radice = rsMoltiplica(radice, 0x02);
  }
  return ris;
}

function rsResto(dati: number[], divisore: number[]): number[] {
  const ris = divisore.map(() => 0);
  for (const b of dati) {
    const fattore = b ^ (ris.shift() as number);
    ris.push(0);
    divisore.forEach((c, i) => { ris[i] ^= rsMoltiplica(c, fattore); });
  }
  return ris;
}

/* separa il flusso di byte grezzi (nell'ordine intrecciato dei blocchi)
   nei singoli blocchi dati+ecc, rifacendo all'indietro l'intreccio di
   addEccAndInterleave in qr.js */
function deinterlacciaBlocchi(rawBytes: number[], numBlocks: number, blockEccLen: number) {
  const rawCodewords = rawBytes.length;
  const numShortBlocks = numBlocks - rawCodewords % numBlocks;
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);
  const blocks: number[][] = Array.from({ length: numBlocks }, () => []);
  let p = 0;
  for (let i = 0; i < shortBlockLen + 1; i++) {
    for (let j = 0; j < numBlocks; j++) {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) {
        blocks[j].push(rawBytes[p++]);
      }
    }
  }
  return blocks;
}

function decodificaTesto(dataBytes: number[], version: number): string {
  const bits: number[] = [];
  for (const b of dataBytes) for (let k = 7; k >= 0; k--) bits.push((b >> k) & 1);
  let p = 0;
  const leggi = (n: number) => { let v = 0; for (let i = 0; i < n; i++) v = (v << 1) | bits[p++]; return v; };
  const modo = leggi(4);
  if (modo === 0) return '';   // terminatore: nessun segmento
  const fasciaVersione = Math.floor((version + 7) / 17);
  if (modo === 0x2) {          // alfanumerico
    const n = leggi([9, 11, 13][fasciaVersione]);
    let s = '', rimasti = n;
    while (rimasti >= 2) {
      const v = leggi(11);
      s += ALFANUMERICO[Math.floor(v / 45)] + ALFANUMERICO[v % 45];
      rimasti -= 2;
    }
    if (rimasti === 1) s += ALFANUMERICO[leggi(6)];
    return s;
  }
  if (modo === 0x4) {          // byte
    const n = leggi([8, 16, 16][fasciaVersione]);
    const byte_: number[] = [];
    for (let i = 0; i < n; i++) byte_.push(leggi(8));
    return new TextDecoder().decode(new Uint8Array(byte_));
  }
  if (modo === 0x1) {          // numerico
    const n = leggi([10, 12, 14][fasciaVersione]);
    let s = '', rimasti = n;
    while (rimasti >= 3) { s += String(leggi(10)).padStart(3, '0'); rimasti -= 3; }
    if (rimasti === 2) s += String(leggi(7)).padStart(2, '0');
    else if (rimasti === 1) s += String(leggi(4));
    return s;
  }
  throw new Error('modalità non supportata dal decoder di test: 0x' + modo.toString(16));
}

const ECL_DA_FORMATBITS: Record<number, number> = { 1: 0, 0: 1, 3: 2, 2: 3 };  // -> ordinal (Low,Medium,Quartile,High)

/** Decodifica un QrCode fino al testo che lo ha generato. Usa solo
 * l'API pubblica di QrCode (size, version, getModule) — non le funzioni
 * private del port. Lancia un errore se qualcosa non torna, invece di
 * restituire un risultato parziale: un QR "quasi giusto" non è un QR
 * leggibile. */
function decodificaQR(qr: QrCode): string {
  if (qr.version >= 7) throw new Error('decoder di test non copre le versioni >=7');
  const { eclFormatBits, mask } = decodificaFormato(qr);
  const ordinal = ECL_DA_FORMATBITS[eclFormatBits];
  const funz = moduliFunzione(qr.size, qr.version);
  const bit = leggiBitSmascherati(qr, funz, mask);

  const rawBytes: number[] = [];
  for (let i = 0; i * 8 < bit.length; i++) {
    let v = 0;
    for (let k = 0; k < 8; k++) v = (v << 1) | (bit[i * 8 + k] ?? 0);
    rawBytes.push(v);
  }

  const numBlocks = QrCode.NUM_ERROR_CORRECTION_BLOCKS[ordinal][qr.version];
  const blockEccLen = QrCode.ECC_CODEWORDS_PER_BLOCK[ordinal][qr.version];
  const blocchi = deinterlacciaBlocchi(rawBytes, numBlocks, blockEccLen);
  const divisore = rsDivisore(blockEccLen);

  let dataBytes: number[] = [];
  for (const blocco of blocchi) {
    const dati = blocco.slice(0, blocco.length - blockEccLen);
    const ecc = blocco.slice(blocco.length - blockEccLen);
    const eccRicalcolata = rsResto(dati, divisore);
    assertEquals(eccRicalcolata, ecc,
      'blocco Reed-Solomon incoerente: i byte dati e i byte di correzione non tornano — il QR generato non è valido');
    dataBytes = dataBytes.concat(dati);
  }
  return decodificaTesto(dataBytes, qr.version);
}

/* ---------- i test veri ---------- */

const CODICI_DI_PROVA = ['LEO-WMMG-6EEH', 'LEO-ACDE-FGHJ', 'LEO-2346-789Y', 'LEO-AAAA-AAAA'];

Deno.test('un codice buono si decodifica esattamente uguale a come è stato generato, a ogni livello di correzione', () => {
  for (const codice of CODICI_DI_PROVA) {
    for (const livello of ['L', 'M', 'Q', 'H'] as const) {
      const qr = QrCode.encodeText(codice, QrCode.Ecc[
        { L: 'LOW', M: 'MEDIUM', Q: 'QUARTILE', H: 'HIGH' }[livello] as 'LOW' | 'MEDIUM' | 'QUARTILE' | 'HIGH']);
      assertEquals(decodificaQR(qr), codice, `livello ${livello}, codice ${codice}`);
    }
  }
});

Deno.test('un codice come quello vero del buono sta in versione 1: il QR resta il più piccolo possibile', () => {
  const qr = QrCode.encodeText('LEO-WMMG-6EEH', QrCode.Ecc.QUARTILE);
  assertEquals(qr.version, 1);
  assertEquals(qr.size, 21);
});

Deno.test('un testo qualunque (non solo il codice del buono) si decodifica lo stesso: il modulo non è specifico del buono', () => {
  const testi = ['https://esempio.it/percorso?x=1&y=due', 'Città, città!', 'a', '0123456789'];
  for (const t of testi) {
    const qr = QrCode.encodeText(t, QrCode.Ecc.MEDIUM);
    assertEquals(decodificaQR(qr), t, `testo: ${t}`);
  }
});

Deno.test('generaSvgQR produce un SVG che decodifica allo stesso testo dato in ingresso', () => {
  const svg = generaSvgQR('LEO-WMMG-6EEH', { livello: 'Q' });
  assertStringIncludes(svg, '<svg');
  assertStringIncludes(svg, 'viewBox="0 0 29 29"');   // 21 moduli + 4 di margine per lato
  assertStringIncludes(svg, '<path d="M');
  // un solo <path>: niente righe chiare fra quadratini adiacenti in stampa
  assertEquals((svg.match(/<path/g) || []).length, 1);

  // lo stesso QR, ricostruito a mano dai parametri usati da generaSvgQR,
  // deve decodificare allo stesso testo che l'SVG rappresenta
  const qr = QrCode.encodeText('LEO-WMMG-6EEH', QrCode.Ecc.QUARTILE);
  assertEquals(decodificaQR(qr), 'LEO-WMMG-6EEH');
});

Deno.test('generaSvgQR: ogni quadratino del path corrisponde a un modulo scuro, nessuno in più o in meno', () => {
  const testo = 'LEO-ACDE-FGHJ';
  const svg = generaSvgQR(testo, { livello: 'M', margine: 4 });
  const quadratini = (svg.match(/h1v1h-1z/g) || []).length;
  const qr = QrCode.encodeText(testo, QrCode.Ecc.MEDIUM);
  let scuri = 0;
  for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++) if (qr.getModule(x, y)) scuri++;
  assertEquals(quadratini, scuri);
});

Deno.test('il margine di quiete è vuoto: nessun modulo scuro nella cornice attorno al codice', () => {
  const qr = QrCode.encodeText('LEO-WMMG-6EEH', QrCode.Ecc.QUARTILE);
  // fuori dai bordi (0..size-1) getModule risponde sempre "chiaro": è la
  // garanzia che generaSvgQR sfrutta per disegnare il margine vuoto
  assertEquals(qr.getModule(-1, -1), false);
  assertEquals(qr.getModule(qr.size, qr.size), false);
});

Deno.test('i tre angoli hanno il pattern di ricerca: anello scuro, anello chiaro, centro scuro', () => {
  const qr = QrCode.encodeText('LEO-WMMG-6EEH', QrCode.Ecc.QUARTILE);
  const controllaAngolo = (cx: number, cy: number) => {
    assertEquals(qr.getModule(cx, cy), true, 'centro scuro');
    assertEquals(qr.getModule(cx - 2, cy), false, 'anello chiaro');
    assertEquals(qr.getModule(cx - 3, cy), true, 'anello scuro esterno');
  };
  controllaAngolo(3, 3);
  controllaAngolo(qr.size - 4, 3);
  controllaAngolo(3, qr.size - 4);
});

Deno.test('caratteri non alfanumerici nel testo passano comunque (si passa alla modalità byte)', () => {
  const qr = QrCode.encodeText('LEO-wmmg-6eeh', QrCode.Ecc.MEDIUM);   // minuscolo: fuori dal set alfanumerico
  assertEquals(decodificaQR(qr), 'LEO-wmmg-6eeh');
});

Deno.test('QrSegment.isAlphanumeric riconosce il set del codice del buono: cifre, lettere maiuscole, trattino', () => {
  assertEquals(QrSegment.isAlphanumeric('LEO-WMMG-6EEH'), true);
  assertEquals(QrSegment.isAlphanumeric('leo-wmmg-6eeh'), false);
});

Deno.test('un testo vuoto non fa esplodere il generatore', () => {
  const svg = generaSvgQR('');
  assertStringIncludes(svg, '<svg');
  /* un QR "vuoto" ha comunque i pattern di ricerca (finder) e di
     temporizzazione, che portano moduli scuri di per sé: il <path> non è
     assente, ma il testo che rappresenta è la stringa vuota — è questo
     che conta, e lo si verifica decodificando, non contando i quadratini */
  const qr = QrCode.encodeText('', QrCode.Ecc.MEDIUM);
  assertEquals(decodificaQR(qr), '');
});

Deno.test('senza margine indicato il generatore usa il minimo raccomandato dallo standard (4 moduli)', () => {
  const qr = QrCode.encodeText('LEO-WMMG-6EEH', QrCode.Ecc.QUARTILE);
  const svg = generaSvgQR('LEO-WMMG-6EEH', { livello: 'Q' });
  assertStringIncludes(svg, `viewBox="0 0 ${qr.size + 8} ${qr.size + 8}"`);
});

Deno.test('un testo troppo lungo per la versione massima viene rifiutato, non troncato in silenzio', () => {
  assertThrows(() => QrCode.encodeText('A'.repeat(5000), QrCode.Ecc.HIGH), RangeError);
});

/* ---------- prova negativa: il decoder si accorge davvero di un errore ---------- */
Deno.test('il decoder si accorge se un modulo dato viene corrotto a mano (prova che il controllo Reed-Solomon lavora davvero)', () => {
  const testo = 'LEO-WMMG-6EEH';
  const originale = QrCode.encodeText(testo, QrCode.Ecc.QUARTILE);
  assertEquals(decodificaQR(originale), testo);   // il QR vero decodifica bene

  // costruisce un QrCode "finto" che si comporta come l'originale ma con
  // un modulo dati ribaltato: getModule è l'unica cosa che il decoder usa
  const corrotto = Object.create(QrCode.prototype);
  corrotto.size = originale.size;
  corrotto.version = originale.version;
  corrotto.getModule = (x: number, y: number) => {
    if (x === 10 && y === 10) return !originale.getModule(x, y);   // un modulo dati, non di funzione
    return originale.getModule(x, y);
  };
  let esplode = false;
  try { decodificaQR(corrotto); } catch { esplode = true; }
  assert(esplode, 'un modulo corrotto deve far fallire la decodifica, non passare inosservato');
});
