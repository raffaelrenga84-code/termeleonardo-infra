/* ============================================================
   qr.test.ts — presidio del QR lato server (il PNG per l'email).

   Due cose distinte da provare, e questo file le tiene separate:
   1. che la copia della libreria qui in qr.js sia rimasta IDENTICA a
      quella di pagine/comune/qr.js (altrimenti le due copie divergono in
      silenzio, e un baco corretto in una non arriva più nell'altra);
   2. che il PNG prodotto da generaPngQR sia un PNG vero e che, decodificato
      fino ai pixel, si legga esattamente come il testo dato in ingresso —
      non "ci sono dei quadratini", ma lo stesso standard di prova già
      applicato all'SVG in pagine/comune/qr.test.ts: qui si applica di
      nuovo, da zero, al raster.

   Il decoder di QR qui sotto (da decodificaFormato a decodificaQR) è la
   STESSA tecnica — riscritta qui apposta, non importata — di quella in
   pagine/comune/qr.test.ts: un decoder indipendente, che non riusa la
   logica privata del port, con lo stesso identico controllo Reed-Solomon
   che fa fallire il test se dati e correzione d'errore non tornano. Il
   lettore CRC-32/Adler-32/PNG qui sotto è scritto da zero con un'altra
   tecnica (bit a bit, non a tabella) apposta: un baco copiato uguale
   nell'implementazione e nel suo controllo non emergerebbe mai, un baco
   in una tecnica diversa sì. La prova più forte — la stessa immagine
   PNG aperta da una libreria indipendente vera (pngjs) e decodificata da
   un lettore di QR indipendente vero (jsQR), sui pixel reali — è stata
   fatta a mano nello scratchpad (non nel repo: niente dipendenze npm
   qui) e sta nel rapporto, non in questo file. */
import { assert, assertEquals, assertThrows } from 'jsr:@std/assert';
import { generaPngQR, QrCode } from './qr.js';

/* ---------- 1. le due copie della libreria non sono divise ---------- */

Deno.test('la libreria QR duplicata qui è identica, byte per byte, a pagine/comune/qr.js', async () => {
  const quiUrl = new URL('./qr.js', import.meta.url);
  const laUrl = new URL('../../../pagine/comune/qr.js', import.meta.url);
  const qui = await Deno.readTextFile(quiUrl);
  const la = await Deno.readTextFile(laUrl);

  const MARCATORE_INIZIO = 'QR Code generator library (TypeScript)';
  const MARCATORE_FINE = 'QrSegment.Mode = Mode;';
  function estraiLibreria(testo: string, percorso: string): string {
    const i = testo.indexOf(MARCATORE_INIZIO);
    /* la ricerca del marcatore di fine parte DA i in poi: il commento di
       testa di questo stesso file cita "QrSegment.Mode = Mode;" in prosa
       (per spiegare dove finisce la copia), e quella citazione precede
       sempre i — cercarla dall'inizio del file troverebbe quella, non la
       vera riga di codice più sotto, e il confronto risulterebbe vuoto */
    const j = testo.indexOf(MARCATORE_FINE, i);
    if (i < 0 || j < 0) throw new Error(`marcatori non trovati in ${percorso} — il confronto non può partire`);
    const iCommento = testo.lastIndexOf('/*', i);
    return testo.slice(iCommento, j + MARCATORE_FINE.length);
  }

  assertEquals(
    estraiLibreria(qui, './qr.js'),
    estraiLibreria(la, '../../../pagine/comune/qr.js'),
    'le due copie dell’algoritmo QR sono divise: vedi il commento in cima a qr.js per il perché ne esistono due',
  );
});

/* ---------- lettore PNG/zlib indipendente, solo per i test ----------
   Non riusa crc32/adler32/chunkPNG/deflateNonCompresso di qr.js (che fra
   l'altro non sono nemmeno esportate): li riscrive da zero, con un CRC-32
   bit-a-bit invece che a tabella, apposta perché una tecnica diversa non
   condivide lo stesso eventuale baco. */

function crc32Indipendente(bytes: number[]): number {
  let crc = 0xFFFFFFFF;
  for (const b of bytes) {
    crc ^= b;
    for (let k = 0; k < 8; k++) crc = (crc & 1) ? ((crc >>> 1) ^ 0xEDB88320) : (crc >>> 1);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function adler32Indipendente(bytes: number[]): number {
  let a = 1, b = 0;
  for (const x of bytes) { a = (a + x) % 65521; b = (b + a) % 65521; }
  return ((b << 16) | a) >>> 0;
}

interface ChunkPNG { tipo: string; dati: number[]; }

function leggiChunksPNG(png: Uint8Array): ChunkPNG[] {
  const firma = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  for (let i = 0; i < 8; i++) assertEquals(png[i], firma[i], `firma PNG sbagliata al byte ${i}`);
  const chunks: ChunkPNG[] = [];
  let p = 8;
  while (p < png.length) {
    const len = ((png[p] << 24) | (png[p + 1] << 16) | (png[p + 2] << 8) | png[p + 3]) >>> 0;
    const tipo = String.fromCharCode(png[p + 4], png[p + 5], png[p + 6], png[p + 7]);
    const dati = Array.from(png.slice(p + 8, p + 8 + len));
    const crcLetto = ((png[p + 8 + len] << 24) | (png[p + 9 + len] << 16) | (png[p + 10 + len] << 8) | png[p + 11 + len]) >>> 0;
    const crcCalcolato = crc32Indipendente([...Array.from(tipo, (c) => c.charCodeAt(0)), ...dati]);
    assertEquals(crcCalcolato, crcLetto, `CRC del chunk ${tipo} non combacia: il file non è un PNG valido`);
    chunks.push({ tipo, dati });
    p += 12 + len;
  }
  return chunks;
}

/* dal contenuto di IDAT (zlib: 2 byte header + blocchi deflate "stored" +
   4 byte Adler-32) ai byte grezzi (filtro + pixel impacchettati), passando
   per un controllo vero dell'Adler-32 — non un controllo "a occhio" */
function decodificaIDAT(idat: number[]): number[] {
  assertEquals(idat[0] & 0x0F, 8, 'metodo di compressione zlib non è deflate (CMF)');
  assertEquals(((idat[0] << 8) | idat[1]) % 31, 0, 'intestazione zlib non valida (controllo FCHECK)');
  let p = 2;
  const grezzo: number[] = [];
  for (;;) {
    const bfinal = idat[p] & 1;
    const btype = (idat[p] >> 1) & 3;
    assertEquals(btype, 0, 'blocco deflate non "stored": il decoder di test copre solo quello che generaPngQR produce');
    p += 1;
    const len = idat[p] | (idat[p + 1] << 8);
    const nlen = idat[p + 2] | (idat[p + 3] << 8);
    assertEquals((len ^ nlen) & 0xFFFF, 0xFFFF, 'LEN/NLEN incoerenti: il blocco deflate è corrotto');
    p += 4;
    for (let i = 0; i < len; i++) grezzo.push(idat[p + i]);
    p += len;
    if (bfinal) break;
  }
  const adlerLetto = ((idat[p] << 24) | (idat[p + 1] << 16) | (idat[p + 2] << 8) | idat[p + 3]) >>> 0;
  assertEquals(adler32Indipendente(grezzo), adlerLetto, 'Adler-32 non combacia: i dati IDAT sono corrotti');
  return grezzo;
}

/* dai byte grezzi (1 byte di filtro + pixel impacchettati 1 bit/pixel,
   MSB prima) a una matrice booleana pixel[y][x] (true = nero) */
function pixelDaGrezzo(grezzo: number[], larghezza: number, altezza: number): boolean[][] {
  const byteMisura = Math.ceil(larghezza / 8);
  const righe: boolean[][] = [];
  for (let y = 0; y < altezza; y++) {
    const inizio = y * (byteMisura + 1);
    assertEquals(grezzo[inizio], 0, 'filtro di riga inatteso: generaPngQR deve usare sempre "None" (0)');
    const riga: boolean[] = [];
    for (let x = 0; x < larghezza; x++) {
      const byte = grezzo[inizio + 1 + (x >> 3)];
      const bit = (byte >> (7 - (x & 7))) & 1;
      riga.push(bit === 0);   // 0 = nero
    }
    righe.push(riga);
  }
  return righe;
}

function decodificaPngQR(png: Uint8Array): { larghezza: number; altezza: number; bitDepth: number; colorType: number; pixel: boolean[][] } {
  const chunks = leggiChunksPNG(png);
  assertEquals(chunks.map((c) => c.tipo), ['IHDR', 'IDAT', 'IEND'], 'struttura dei chunk inattesa');
  const ihdr = chunks[0].dati;
  const larghezza = ((ihdr[0] << 24) | (ihdr[1] << 16) | (ihdr[2] << 8) | ihdr[3]) >>> 0;
  const altezza = ((ihdr[4] << 24) | (ihdr[5] << 16) | (ihdr[6] << 8) | ihdr[7]) >>> 0;
  const bitDepth = ihdr[8], colorType = ihdr[9];
  assertEquals(chunks[2].dati.length, 0, 'IEND non è vuoto');
  const grezzo = decodificaIDAT(chunks[1].dati);
  const pixel = pixelDaGrezzo(grezzo, larghezza, altezza);
  return { larghezza, altezza, bitDepth, colorType, pixel };
}

/* ---------- 2a. struttura PNG ---------- */

Deno.test('generaPngQR produce un file che comincia con la firma PNG, con chunk IHDR/IDAT/IEND dai CRC validi', () => {
  const png = generaPngQR('LEO-WMMG-6EEH');
  const esito = decodificaPngQR(png);
  assertEquals(esito.bitDepth, 1);
  assertEquals(esito.colorType, 0);   // scala di grigi, niente palette né alpha
});

Deno.test('le dimensioni IHDR combaciano con moduli, margine e scala richiesti', () => {
  const testo = 'LEO-WMMG-6EEH';
  const margine = 4, scala = 8;
  const png = generaPngQR(testo, { livello: 'Q', margine, scala });
  const esito = decodificaPngQR(png);
  const qr = QrCode.encodeText(testo, QrCode.Ecc.QUARTILE);
  const latoAtteso = (qr.size + margine * 2) * scala;
  assertEquals(esito.larghezza, latoAtteso);
  assertEquals(esito.altezza, latoAtteso);
});

Deno.test('senza opzioni, il margine è 4 moduli e la scala 8 pixel per modulo — stessi default di generaSvgQR dove ha senso', () => {
  const png = generaPngQR('LEO-WMMG-6EEH');
  const esito = decodificaPngQR(png);
  const qr = QrCode.encodeText('LEO-WMMG-6EEH', QrCode.Ecc.QUARTILE);   // default livello 'Q'
  assertEquals(esito.larghezza, (qr.size + 8) * 8);
});

/* ---------- 2b. i pixel combaciano coi moduli, modulo per modulo ---------- */

Deno.test('ogni modulo del QR è reso come un blocco di pixel dello stesso colore, senza sfasamenti', () => {
  const testo = 'LEO-ACDE-FGHJ';
  const margine = 4, scala = 8;
  const png = generaPngQR(testo, { livello: 'M', margine, scala });
  const esito = decodificaPngQR(png);
  const qr = QrCode.encodeText(testo, QrCode.Ecc.MEDIUM);
  const n = qr.size + margine * 2;
  for (let my = 0; my < n; my++) {
    for (let mx = 0; mx < n; mx++) {
      const atteso = qr.getModule(mx - margine, my - margine);
      // tutti gli scala*scala pixel del blocco devono avere lo stesso colore
      for (let dy = 0; dy < scala; dy++) {
        for (let dx = 0; dx < scala; dx++) {
          assertEquals(esito.pixel[my * scala + dy][mx * scala + dx], atteso,
            `pixel (${mx * scala + dx},${my * scala + dy}) del modulo (${mx},${my})`);
        }
      }
    }
  }
});

Deno.test('il margine di quiete esce tutto bianco nel PNG, come nell’SVG', () => {
  const png = generaPngQR('LEO-WMMG-6EEH', { margine: 4, scala: 8 });
  const esito = decodificaPngQR(png);
  // riga e colonna 0 sono dentro il margine per costruzione (margine=4, scala=8: 32 pixel di margine)
  for (let x = 0; x < esito.larghezza; x++) assert(esito.pixel[0][x] === false, `pixel (${x},0) dovrebbe essere bianco`);
  for (let y = 0; y < esito.altezza; y++) assert(esito.pixel[y][0] === false, `pixel (0,${y}) dovrebbe essere bianco`);
});

/* ---------- 2c. il testo si recupera per intero dai pixel del PNG ----------
   Stessa tecnica di decodifica indipendente di pagine/comune/qr.test.ts,
   riscritta qui: dalle informazioni di formato, alla maschera, allo
   smascheramento, al disintreccio dei blocchi, al controllo Reed-Solomon
   (che fa fallire il test se non torna), fino al testo. La sola differenza
   è la SORGENTE dei moduli: qui vengono dai pixel decodificati del PNG,
   non da QrCode.getModule direttamente — è il PNG a essere sotto esame,
   non l'algoritmo di codifica (già presidiato altrove). */

const ALFANUMERICO = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

function posizioniAllineamento(version: number, size: number): number[] {
  if (version === 1) return [];
  const numAlign = Math.floor(version / 7) + 2;
  const step = Math.floor((version * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4)) * 2;
  const ris = [6];
  for (let pos = size - 7; ris.length < numAlign; pos -= step) ris.splice(1, 0, pos);
  return ris;
}

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

function decodificaFormato(getModule: (x: number, y: number) => boolean, size: number): { eclFormatBits: number; mask: number } {
  const b = new Array(15).fill(false);
  for (let i = 0; i <= 5; i++) b[i] = getModule(8, i);
  b[6] = getModule(8, 7);
  b[7] = getModule(8, 8);
  b[8] = getModule(7, 8);
  for (let i = 9; i < 15; i++) b[i] = getModule(14 - i, 8);
  let bits = 0;
  for (let i = 0; i < 15; i++) bits |= (b[i] ? 1 : 0) << i;

  const sbloccato = bits ^ 0x5412;
  const data = (sbloccato >>> 10) & 0x1F;
  const remLetto = sbloccato & 0x3FF;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  if (rem !== remLetto) throw new Error('informazioni di formato incoerenti: il QR non è valido');

  const b2 = new Array(15).fill(false);
  for (let i = 0; i < 8; i++) b2[i] = getModule(size - 1 - i, 8);
  for (let i = 8; i < 15; i++) b2[i] = getModule(8, size - 15 + i);
  let bits2 = 0;
  for (let i = 0; i < 15; i++) bits2 |= (b2[i] ? 1 : 0) << i;
  if (bits2 !== bits) throw new Error('le due copie delle informazioni di formato non combaciano');

  return { eclFormatBits: (data >>> 3) & 0x3, mask: data & 0x7 };
}

function leggiBitSmascherati(getModule: (x: number, y: number) => boolean, size: number, funz: boolean[][], mask: number): number[] {
  const bits: number[] = [];
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!funz[y][x]) {
          const originale = getModule(x, y) !== formulaMaschera(mask, x, y);
          bits.push(originale ? 1 : 0);
        }
      }
    }
  }
  return bits;
}

function rsMoltiplica(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11D);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xFF;
}

function rsDivisore(grado: number): number[] {
  const ris = new Array(grado - 1).fill(0);
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

function deinterlacciaBlocchi(rawBytes: number[], numBlocks: number, blockEccLen: number) {
  const rawCodewords = rawBytes.length;
  const numShortBlocks = numBlocks - rawCodewords % numBlocks;
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);
  const blocks: number[][] = Array.from({ length: numBlocks }, () => []);
  let p = 0;
  for (let i = 0; i < shortBlockLen + 1; i++) {
    for (let j = 0; j < numBlocks; j++) {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) blocks[j].push(rawBytes[p++]);
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
  if (modo === 0) return '';
  const fasciaVersione = Math.floor((version + 7) / 17);
  if (modo === 0x2) {
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
  if (modo === 0x4) {
    const n = leggi([8, 16, 16][fasciaVersione]);
    const byte_: number[] = [];
    for (let i = 0; i < n; i++) byte_.push(leggi(8));
    return new TextDecoder().decode(new Uint8Array(byte_));
  }
  if (modo === 0x1) {
    const n = leggi([10, 12, 14][fasciaVersione]);
    let s = '', rimasti = n;
    while (rimasti >= 3) { s += String(leggi(10)).padStart(3, '0'); rimasti -= 3; }
    if (rimasti === 2) s += String(leggi(7)).padStart(2, '0');
    else if (rimasti === 1) s += String(leggi(4));
    return s;
  }
  throw new Error('modalità non supportata dal decoder di test: 0x' + modo.toString(16));
}

const ECL_DA_FORMATBITS: Record<number, number> = { 1: 0, 0: 1, 3: 2, 2: 3 };

/** Decodifica un QR fino al testo, leggendo SOLO i pixel di un'immagine PNG
 * generata da generaPngQR (via getModule, nelle coordinate del QR: 0,0 è il
 * primo modulo del QR, non il primo pixel del margine). */
function decodificaDaiPixelPNG(getModule: (x: number, y: number) => boolean, size: number, version: number): string {
  if (version >= 7) throw new Error('decoder di test non copre le versioni >=7');
  const { eclFormatBits, mask } = decodificaFormato(getModule, size);
  const ordinal = ECL_DA_FORMATBITS[eclFormatBits];
  const funz = moduliFunzione(size, version);
  const bit = leggiBitSmascherati(getModule, size, funz, mask);

  const rawBytes: number[] = [];
  for (let i = 0; i * 8 < bit.length; i++) {
    let v = 0;
    for (let k = 0; k < 8; k++) v = (v << 1) | (bit[i * 8 + k] ?? 0);
    rawBytes.push(v);
  }

  const numBlocks = QrCode.NUM_ERROR_CORRECTION_BLOCKS[ordinal][version];
  const blockEccLen = QrCode.ECC_CODEWORDS_PER_BLOCK[ordinal][version];
  const blocchi = deinterlacciaBlocchi(rawBytes, numBlocks, blockEccLen);
  const divisore = rsDivisore(blockEccLen);

  let dataBytes: number[] = [];
  for (const blocco of blocchi) {
    const dati = blocco.slice(0, blocco.length - blockEccLen);
    const ecc = blocco.slice(blocco.length - blockEccLen);
    const eccRicalcolata = rsResto(dati, divisore);
    assertEquals(eccRicalcolata, ecc,
      'blocco Reed-Solomon incoerente nei pixel del PNG: l’immagine non è un QR leggibile');
    dataBytes = dataBytes.concat(dati);
  }
  return decodificaTesto(dataBytes, version);
}

/* costruisce, da un'immagine PNG generata, un getModule(x,y) nelle
   coordinate DEL QR (non del pixel): fa la stessa cosa di
   qr.getModule(x,y) ma leggendo i pixel veri del raster, campionando il
   pixel centrale di ogni blocco scala×scala */
function getModuleDaPNG(esito: ReturnType<typeof decodificaPngQR>, margine: number, scala: number) {
  return (x: number, y: number): boolean => {
    const mx = x + margine, my = y + margine;
    const px = mx * scala + Math.floor(scala / 2);
    const py = my * scala + Math.floor(scala / 2);
    return esito.pixel[py][px];
  };
}

const CODICI_DI_PROVA = ['LEO-WMMG-6EEH', 'LEO-ACDE-FGHJ', 'LEO-2346-789Y', 'LEO-AAAA-AAAA'];

Deno.test('il testo si recupera per intero decodificando i PIXEL del PNG, a ogni livello di correzione', () => {
  const margine = 4, scala = 8;
  for (const codice of CODICI_DI_PROVA) {
    for (const livello of ['L', 'M', 'Q', 'H'] as const) {
      const png = generaPngQR(codice, { livello, margine, scala });
      const esito = decodificaPngQR(png);
      const qr = QrCode.encodeText(codice, QrCode.Ecc[
        { L: 'LOW', M: 'MEDIUM', Q: 'QUARTILE', H: 'HIGH' }[livello] as 'LOW' | 'MEDIUM' | 'QUARTILE' | 'HIGH']);
      const testo = decodificaDaiPixelPNG(getModuleDaPNG(esito, margine, scala), qr.size, qr.version);
      assertEquals(testo, codice, `livello ${livello}, codice ${codice}`);
    }
  }
});

Deno.test('un testo generico (non solo il codice del buono) si recupera lo stesso dai pixel', () => {
  const margine = 4, scala = 6;
  for (const testo of ['https://esempio.it/percorso?x=1&y=due', 'Città, città!', 'a', '0123456789']) {
    const png = generaPngQR(testo, { livello: 'M', margine, scala });
    const esito = decodificaPngQR(png);
    const qr = QrCode.encodeText(testo, QrCode.Ecc.MEDIUM);
    assertEquals(decodificaDaiPixelPNG(getModuleDaPNG(esito, margine, scala), qr.size, qr.version), testo);
  }
});

Deno.test('una scala più fine (2 px/modulo) e un margine diverso non cambiano il risultato della decodifica', () => {
  const testo = 'LEO-WMMG-6EEH';
  const margine = 2, scala = 2;
  const png = generaPngQR(testo, { livello: 'Q', margine, scala });
  const esito = decodificaPngQR(png);
  const qr = QrCode.encodeText(testo, QrCode.Ecc.QUARTILE);
  assertEquals(decodificaDaiPixelPNG(getModuleDaPNG(esito, margine, scala), qr.size, qr.version), testo);
});

/* ---------- 2d. blocchi deflate multipli (>65535 byte grezzi) ---------- */

Deno.test('con un raster grande abbastanza da superare un blocco deflate solo, IDAT usa più blocchi "stored" e il PNG resta leggibile', () => {
  // scala 30: (29*30=870)+1 filtro, byteMisura=109 -> grezzo = 110*870 = 95700 byte > 65535
  const testo = 'LEO-WMMG-6EEH';
  const margine = 4, scala = 30;
  const png = generaPngQR(testo, { livello: 'Q', margine, scala });
  const esito = decodificaPngQR(png);   // qui dentro l'Adler-32 e i CRC sono già ricontrollati sull'intero flusso multi-blocco
  const qr = QrCode.encodeText(testo, QrCode.Ecc.QUARTILE);
  assertEquals(esito.larghezza, (qr.size + margine * 2) * scala);
  assertEquals(decodificaDaiPixelPNG(getModuleDaPNG(esito, margine, scala), qr.size, qr.version), testo);
});

/* ---------- 2e. casi limite ---------- */

Deno.test('un testo vuoto non fa esplodere il generatore PNG', () => {
  const png = generaPngQR('');
  const esito = decodificaPngQR(png);
  const qr = QrCode.encodeText('', QrCode.Ecc.QUARTILE);
  assertEquals(decodificaDaiPixelPNG(getModuleDaPNG(esito, 4, 8), qr.size, qr.version), '');
});

Deno.test('un testo troppo lungo per la versione massima viene rifiutato, non genera un PNG a caso', () => {
  assertThrows(() => generaPngQR('A'.repeat(5000)), RangeError);
});

Deno.test('un livello sconosciuto ricade su QUARTILE, come default sensato per lo schermo di un telefono', () => {
  const png1 = generaPngQR('LEO-WMMG-6EEH', { livello: 'boh' as unknown as 'Q' });
  const png2 = generaPngQR('LEO-WMMG-6EEH', { livello: 'Q' });
  assertEquals(Array.from(png1), Array.from(png2));
});
