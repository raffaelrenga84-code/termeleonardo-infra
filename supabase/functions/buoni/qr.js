/* ============================================================
   qr.js — lo stesso generatore di QR di pagine/comune/qr.js, in una copia
   separata per il lato server.

   PERCHÉ UNA COPIA E NON UN IMPORT. La funzione `buoni` gira su Supabase
   Edge Functions: il comando di deploy standard (`supabase functions
   deploy`) non segue in modo affidabile un import relativo che esce dalla
   cartella della funzione (`../../../pagine/...`) — funziona in locale con
   `deno test`/`deno run`, ma più di un progetto l'ha visto fallire proprio
   in fase di deploy (la cartella `supabase/functions/_shared/` esiste
   apposta per condividere codice FRA funzioni, non con il resto del
   repository). pagine/ e supabase/functions/ sono già due mondi separati
   in questo progetto — email-buono.ts duplica già ETI, CONDIZIONI e
   COMPRENDE invece di importarli da pagine/buoni/buono.js, con lo stesso
   ragionamento (vedi i commenti lì) — qui si segue la stessa strada, non
   se ne inventa una nuova.

   COSA RESTA IDENTICO E COSA NO. Le classi QrCode e QrSegment qui sotto —
   l'algoritmo vero, Reed-Solomon compresa — sono la stessa, IDENTICA copia
   di pagine/comune/qr.js: stesso codice, carattere per carattere, dalla
   licenza MIT fino a `QrSegment.Mode = Mode;`. Presidiato da qr.test.ts
   qui accanto, che confronta le due copie byte per byte: un baco corretto
   in una sola smetterebbe di essere vero fra le due, e il test se ne
   accorgerebbe. Da lì in poi i due file divergono di proposito: pagine/
   comune/qr.js genera SVG (per il foglio stampato, dove un vettoriale
   nitido conta), questo file genera PNG (per l'email, dove l'SVG non
   arriva mai — vedi il commento sopra il test sul logo in
   email-buono.test.ts: stessa ragione, stesso rimedio).

   IL PNG SENZA LIBRERIE. generaPngQR() più in basso scrive un PNG a mano:
   un solo chunk IDAT, blocchi deflate "stored" (non compressi, ma
   comunque validi per lo standard — RFC 1951 §3.2.4 li prevede apposta
   come uno dei tre tipi di blocco), 1 bit per pixel in scala di grigi (il
   QR è già bicolore, un secondo bit per pixel sarebbe solo peso senza
   motivo). Zero Huffman da implementare, zero dipendenze esterne: per
   un'immagine di poche migliaia di byte come questa il file pesa qualche
   byte in più di quanto peserebbe con una compressione vera, ma la
   generazione resta un ciclo di copia — veloce quanto serve per stare
   dentro il caricamento di un'email.

   COSA GENERA QUESTO FILE, E COSA NON CONTROLLA. generaPngQR() disegna il
   QR di QUALUNQUE testo gli venga passato: non guarda il database, non sa
   se un codice esiste o è valido. È una scelta voluta — vedi il commento
   sopra `azione === 'qr'` in index.ts per il perché — non un pezzo
   mancante.
   ============================================================ */

/*
 * QR Code generator library (TypeScript)
 *
 * Copyright (c) Project Nayuki. (MIT License)
 * https://www.nayuki.io/page/qr-code-generator-library
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 * - The above copyright notice and this permission notice shall be included in
 *   all copies or substantial portions of the Software.
 * - The Software is provided "as is", without warranty of any kind, express or
 *   implied, including but not limited to the warranties of merchantability,
 *   fitness for a particular purpose and noninfringement. In no event shall the
 *   authors or copyright holders be liable for any claim, damages or other
 *   liability, whether in an action of contract, tort or otherwise, arising from,
 *   out of or in connection with the Software or the use or other dealings in the
 *   Software.
 */

/*---- QR Code symbol class ----*/

/*
 * A QR Code symbol, which is a type of two-dimension barcode.
 * Invented by Denso Wave and described in the ISO/IEC 18004 standard.
 * Instances of this class represent an immutable square grid of dark and light cells.
 * The class provides static factory functions to create a QR Code from text or binary data.
 * The class covers the QR Code Model 2 specification, supporting all versions (sizes)
 * from 1 to 40, all 4 error correction levels, and 4 character encoding modes.
 */
export class QrCode {

  /*-- Static factory functions (high level) --*/

  // Returns a QR Code representing the given Unicode text string at the given error correction level.
  static encodeText(text, ecl) {
    const segs = QrSegment.makeSegments(text);
    return QrCode.encodeSegments(segs, ecl);
  }

  // Returns a QR Code representing the given binary data at the given error correction level.
  static encodeBinary(data, ecl) {
    const seg = QrSegment.makeBytes(data);
    return QrCode.encodeSegments([seg], ecl);
  }

  /*-- Static factory functions (mid level) --*/

  // Returns a QR Code representing the given segments with the given encoding parameters.
  static encodeSegments(segs, ecl, minVersion = 1, maxVersion = 40, mask = -1, boostEcl = true) {
    if (!(QrCode.MIN_VERSION <= minVersion && minVersion <= maxVersion && maxVersion <= QrCode.MAX_VERSION)
        || mask < -1 || mask > 7)
      throw new RangeError('Invalid value');

    // Find the minimal version number to use
    let version;
    let dataUsedBits;
    for (version = minVersion; ; version++) {
      const dataCapacityBits = QrCode.getNumDataCodewords(version, ecl) * 8;
      const usedBits = QrSegment.getTotalBits(segs, version);
      if (usedBits <= dataCapacityBits) {
        dataUsedBits = usedBits;
        break;
      }
      if (version >= maxVersion)
        throw new RangeError('Data too long');
    }

    // Increase the error correction level while the data still fits in the current version number
    for (const newEcl of [QrCode.Ecc.MEDIUM, QrCode.Ecc.QUARTILE, QrCode.Ecc.HIGH]) {
      if (boostEcl && dataUsedBits <= QrCode.getNumDataCodewords(version, newEcl) * 8)
        ecl = newEcl;
    }

    // Concatenate all segments to create the data bit string
    let bb = [];
    for (const seg of segs) {
      appendBits(seg.mode.modeBits, 4, bb);
      appendBits(seg.numChars, seg.mode.numCharCountBits(version), bb);
      for (const b of seg.getData())
        bb.push(b);
    }
    assert(bb.length === dataUsedBits);

    // Add terminator and pad up to a byte if applicable
    const dataCapacityBits = QrCode.getNumDataCodewords(version, ecl) * 8;
    assert(bb.length <= dataCapacityBits);
    appendBits(0, Math.min(4, dataCapacityBits - bb.length), bb);
    appendBits(0, (8 - bb.length % 8) % 8, bb);
    assert(bb.length % 8 === 0);

    // Pad with alternating bytes until data capacity is reached
    for (let padByte = 0xEC; bb.length < dataCapacityBits; padByte ^= 0xEC ^ 0x11)
      appendBits(padByte, 8, bb);

    // Pack bits into bytes in big endian
    let dataCodewords = [];
    while (dataCodewords.length * 8 < bb.length)
      dataCodewords.push(0);
    bb.forEach((b, i) => dataCodewords[i >>> 3] |= b << (7 - (i & 7)));

    // Create the QR Code object
    return new QrCode(version, ecl, dataCodewords, mask);
  }

  /*-- Constructor (low level) --*/

  // Creates a new QR Code with the given version number, error correction level,
  // data codeword bytes, and mask number. Low-level API; most users should use
  // encodeText() / encodeSegments() instead.
  constructor(version, errorCorrectionLevel, dataCodewords, msk) {
    if (version < QrCode.MIN_VERSION || version > QrCode.MAX_VERSION)
      throw new RangeError('Version value out of range');
    if (msk < -1 || msk > 7)
      throw new RangeError('Mask value out of range');

    this.version = version;
    this.errorCorrectionLevel = errorCorrectionLevel;
    this.size = version * 4 + 17;

    // Initialize both grids to be size*size arrays of Boolean false
    this.modules = [];
    this.isFunction = [];
    let row = [];
    for (let i = 0; i < this.size; i++) row.push(false);
    for (let i = 0; i < this.size; i++) {
      this.modules.push(row.slice());     // Initially all light
      this.isFunction.push(row.slice());
    }

    // Compute ECC, draw modules
    this.drawFunctionPatterns();
    const allCodewords = this.addEccAndInterleave(dataCodewords);
    this.drawCodewords(allCodewords);

    // Do masking
    if (msk === -1) {  // Automatically choose best mask
      let minPenalty = 1000000000;
      for (let i = 0; i < 8; i++) {
        this.applyMask(i);
        this.drawFormatBits(i);
        const penalty = this.getPenaltyScore();
        if (penalty < minPenalty) {
          msk = i;
          minPenalty = penalty;
        }
        this.applyMask(i);  // Undoes the mask due to XOR
      }
    }
    assert(0 <= msk && msk <= 7);
    this.mask = msk;
    this.applyMask(msk);        // Apply the final choice of mask
    this.drawFormatBits(msk);   // Overwrite old format bits

    this.isFunction = [];
  }

  /*-- Accessor methods --*/

  // Returns the color of the module (pixel) at the given coordinates, which is false
  // for light or true for dark. Out-of-bounds coordinates return false (light).
  getModule(x, y) {
    return 0 <= x && x < this.size && 0 <= y && y < this.size && this.modules[y][x];
  }

  /*-- Private helper methods for constructor: Drawing function modules --*/

  drawFunctionPatterns() {
    // Draw horizontal and vertical timing patterns
    for (let i = 0; i < this.size; i++) {
      this.setFunctionModule(6, i, i % 2 === 0);
      this.setFunctionModule(i, 6, i % 2 === 0);
    }

    // Draw 3 finder patterns (all corners except bottom right; overwrites some timing modules)
    this.drawFinderPattern(3, 3);
    this.drawFinderPattern(this.size - 4, 3);
    this.drawFinderPattern(3, this.size - 4);

    // Draw numerous alignment patterns
    const alignPatPos = this.getAlignmentPatternPositions();
    const numAlign = alignPatPos.length;
    for (let i = 0; i < numAlign; i++) {
      for (let j = 0; j < numAlign; j++) {
        // Don't draw on the three finder corners
        if (!(i === 0 && j === 0 || i === 0 && j === numAlign - 1 || i === numAlign - 1 && j === 0))
          this.drawAlignmentPattern(alignPatPos[i], alignPatPos[j]);
      }
    }

    // Draw configuration data
    this.drawFormatBits(0);  // Dummy mask value; overwritten later in the constructor
    this.drawVersion();
  }

  // Draws two copies of the format bits (with its own error correction code)
  // based on the given mask and this object's error correction level field.
  drawFormatBits(mask) {
    const data = this.errorCorrectionLevel.formatBits << 3 | mask;
    let rem = data;
    for (let i = 0; i < 10; i++)
      rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = (data << 10 | rem) ^ 0x5412;
    assert(bits >>> 15 === 0);

    // Draw first copy
    for (let i = 0; i <= 5; i++)
      this.setFunctionModule(8, i, getBit(bits, i));
    this.setFunctionModule(8, 7, getBit(bits, 6));
    this.setFunctionModule(8, 8, getBit(bits, 7));
    this.setFunctionModule(7, 8, getBit(bits, 8));
    for (let i = 9; i < 15; i++)
      this.setFunctionModule(14 - i, 8, getBit(bits, i));

    // Draw second copy
    for (let i = 0; i < 8; i++)
      this.setFunctionModule(this.size - 1 - i, 8, getBit(bits, i));
    for (let i = 8; i < 15; i++)
      this.setFunctionModule(8, this.size - 15 + i, getBit(bits, i));
    this.setFunctionModule(8, this.size - 8, true);  // Always dark
  }

  // Draws two copies of the version bits, iff 7 <= version <= 40.
  drawVersion() {
    if (this.version < 7)
      return;
    let rem = this.version;
    for (let i = 0; i < 12; i++)
      rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    const bits = this.version << 12 | rem;
    assert(bits >>> 18 === 0);

    for (let i = 0; i < 18; i++) {
      const color = getBit(bits, i);
      const a = this.size - 11 + i % 3;
      const b = Math.floor(i / 3);
      this.setFunctionModule(a, b, color);
      this.setFunctionModule(b, a, color);
    }
  }

  // Draws a 9*9 finder pattern including the border separator, centered at (x, y).
  drawFinderPattern(x, y) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = x + dx;
        const yy = y + dy;
        if (0 <= xx && xx < this.size && 0 <= yy && yy < this.size)
          this.setFunctionModule(xx, yy, dist !== 2 && dist !== 4);
      }
    }
  }

  // Draws a 5*5 alignment pattern, centered at (x, y). All modules must be in bounds.
  drawAlignmentPattern(x, y) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++)
        this.setFunctionModule(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }

  // Sets the color of a module and marks it as a function module.
  setFunctionModule(x, y, isDark) {
    this.modules[y][x] = isDark;
    this.isFunction[y][x] = true;
  }

  /*-- Private helper methods for constructor: Codewords and masking --*/

  // Returns a new byte string representing the given data with the appropriate error correction
  // codewords appended, based on this object's version and error correction level.
  addEccAndInterleave(data) {
    const ver = this.version;
    const ecl = this.errorCorrectionLevel;
    if (data.length !== QrCode.getNumDataCodewords(ver, ecl))
      throw new RangeError('Invalid argument');

    const numBlocks = QrCode.NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver];
    const blockEccLen = QrCode.ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver];
    const rawCodewords = Math.floor(QrCode.getNumRawDataModules(ver) / 8);
    const numShortBlocks = numBlocks - rawCodewords % numBlocks;
    const shortBlockLen = Math.floor(rawCodewords / numBlocks);

    let blocks = [];
    const rsDiv = QrCode.reedSolomonComputeDivisor(blockEccLen);
    for (let i = 0, k = 0; i < numBlocks; i++) {
      let dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
      k += dat.length;
      const ecc = QrCode.reedSolomonComputeRemainder(dat, rsDiv);
      if (i < numShortBlocks)
        dat.push(0);
      blocks.push(dat.concat(ecc));
    }

    // Interleave (not concatenate) the bytes from every block into a single sequence
    let result = [];
    for (let i = 0; i < blocks[0].length; i++) {
      blocks.forEach((block, j) => {
        if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks)
          result.push(block[i]);
      });
    }
    assert(result.length === rawCodewords);
    return result;
  }

  // Draws the given sequence of 8-bit codewords onto the entire data area of this QR Code.
  drawCodewords(data) {
    if (data.length !== Math.floor(QrCode.getNumRawDataModules(this.version) / 8))
      throw new RangeError('Invalid argument');
    let i = 0;
    for (let right = this.size - 1; right >= 1; right -= 2) {
      if (right === 6)
        right = 5;
      for (let vert = 0; vert < this.size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? this.size - 1 - vert : vert;
          if (!this.isFunction[y][x] && i < data.length * 8) {
            this.modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7));
            i++;
          }
        }
      }
    }
    assert(i === data.length * 8);
  }

  // XORs the codeword modules in this QR Code with the given mask pattern.
  applyMask(mask) {
    if (mask < 0 || mask > 7)
      throw new RangeError('Mask value out of range');
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        let invert;
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break;
          case 1: invert = y % 2 === 0; break;
          case 2: invert = x % 3 === 0; break;
          case 3: invert = (x + y) % 3 === 0; break;
          case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: invert = x * y % 2 + x * y % 3 === 0; break;
          case 6: invert = (x * y % 2 + x * y % 3) % 2 === 0; break;
          case 7: invert = ((x + y) % 2 + x * y % 3) % 2 === 0; break;
          default: throw new Error('Unreachable');
        }
        if (!this.isFunction[y][x] && invert)
          this.modules[y][x] = !this.modules[y][x];
      }
    }
  }

  // Calculates and returns the penalty score based on the current state of the modules.
  getPenaltyScore() {
    let result = 0;

    // Adjacent modules in row having same color, and finder-like patterns
    for (let y = 0; y < this.size; y++) {
      let runColor = false;
      let runX = 0;
      let runHistory = [0, 0, 0, 0, 0, 0, 0];
      for (let x = 0; x < this.size; x++) {
        if (this.modules[y][x] === runColor) {
          runX++;
          if (runX === 5)
            result += QrCode.PENALTY_N1;
          else if (runX > 5)
            result++;
        } else {
          this.finderPenaltyAddHistory(runX, runHistory);
          if (!runColor)
            result += this.finderPenaltyCountPatterns(runHistory) * QrCode.PENALTY_N3;
          runColor = this.modules[y][x];
          runX = 1;
        }
      }
      result += this.finderPenaltyTerminateAndCount(runColor, runX, runHistory) * QrCode.PENALTY_N3;
    }
    // Adjacent modules in column having same color, and finder-like patterns
    for (let x = 0; x < this.size; x++) {
      let runColor = false;
      let runY = 0;
      let runHistory = [0, 0, 0, 0, 0, 0, 0];
      for (let y = 0; y < this.size; y++) {
        if (this.modules[y][x] === runColor) {
          runY++;
          if (runY === 5)
            result += QrCode.PENALTY_N1;
          else if (runY > 5)
            result++;
        } else {
          this.finderPenaltyAddHistory(runY, runHistory);
          if (!runColor)
            result += this.finderPenaltyCountPatterns(runHistory) * QrCode.PENALTY_N3;
          runColor = this.modules[y][x];
          runY = 1;
        }
      }
      result += this.finderPenaltyTerminateAndCount(runColor, runY, runHistory) * QrCode.PENALTY_N3;
    }

    // 2*2 blocks of modules having same color
    for (let y = 0; y < this.size - 1; y++) {
      for (let x = 0; x < this.size - 1; x++) {
        const color = this.modules[y][x];
        if (color === this.modules[y][x + 1] &&
            color === this.modules[y + 1][x] &&
            color === this.modules[y + 1][x + 1])
          result += QrCode.PENALTY_N2;
      }
    }

    // Balance of dark and light modules
    let dark = 0;
    for (const row of this.modules)
      dark = row.reduce((sum, color) => sum + (color ? 1 : 0), dark);
    const total = this.size * this.size;
    const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    assert(0 <= k && k <= 9);
    result += k * QrCode.PENALTY_N4;
    assert(0 <= result && result <= 2568888);
    return result;
  }

  /*-- Private helper methods --*/

  // Returns an ascending list of positions of alignment patterns for this version number.
  getAlignmentPatternPositions() {
    if (this.version === 1)
      return [];
    else {
      const numAlign = Math.floor(this.version / 7) + 2;
      const step = Math.floor((this.version * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4)) * 2;
      let result = [6];
      for (let pos = this.size - 7; result.length < numAlign; pos -= step)
        result.splice(1, 0, pos);
      return result;
    }
  }

  // Returns the number of data bits that can be stored in a QR Code of the given version.
  static getNumRawDataModules(ver) {
    if (ver < QrCode.MIN_VERSION || ver > QrCode.MAX_VERSION)
      throw new RangeError('Version number out of range');
    let result = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      const numAlign = Math.floor(ver / 7) + 2;
      result -= (25 * numAlign - 10) * numAlign - 55;
      if (ver >= 7)
        result -= 36;
    }
    assert(208 <= result && result <= 29648);
    return result;
  }

  // Returns the number of 8-bit data codewords for the given version and ECC level.
  static getNumDataCodewords(ver, ecl) {
    return Math.floor(QrCode.getNumRawDataModules(ver) / 8) -
      QrCode.ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver] *
      QrCode.NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver];
  }

  // Returns a Reed-Solomon ECC generator polynomial for the given degree.
  static reedSolomonComputeDivisor(degree) {
    if (degree < 1 || degree > 255)
      throw new RangeError('Degree out of range');
    let result = [];
    for (let i = 0; i < degree - 1; i++)
      result.push(0);
    result.push(1);

    let root = 1;
    for (let i = 0; i < degree; i++) {
      for (let j = 0; j < result.length; j++) {
        result[j] = QrCode.reedSolomonMultiply(result[j], root);
        if (j + 1 < result.length)
          result[j] ^= result[j + 1];
      }
      root = QrCode.reedSolomonMultiply(root, 0x02);
    }
    return result;
  }

  // Returns the Reed-Solomon error correction codeword for the given data and divisor polynomials.
  static reedSolomonComputeRemainder(data, divisor) {
    let result = divisor.map(_ => 0);
    for (const b of data) {
      const factor = b ^ result.shift();
      result.push(0);
      divisor.forEach((coef, i) => result[i] ^= QrCode.reedSolomonMultiply(coef, factor));
    }
    return result;
  }

  // Returns the product of the two given field elements modulo GF(2^8/0x11D).
  static reedSolomonMultiply(x, y) {
    if (x >>> 8 !== 0 || y >>> 8 !== 0)
      throw new RangeError('Byte out of range');
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11D);
      z ^= ((y >>> i) & 1) * x;
    }
    assert(z >>> 8 === 0);
    return z;
  }

  // Can only be called immediately after a light run is added. Helper for getPenaltyScore().
  finderPenaltyCountPatterns(runHistory) {
    const n = runHistory[1];
    assert(n <= this.size * 3);
    const core = n > 0 && runHistory[2] === n && runHistory[3] === n * 3 && runHistory[4] === n && runHistory[5] === n;
    return (core && runHistory[0] >= n * 4 && runHistory[6] >= n ? 1 : 0)
         + (core && runHistory[6] >= n * 4 && runHistory[0] >= n ? 1 : 0);
  }

  // Must be called at the end of a line of modules. Helper for getPenaltyScore().
  finderPenaltyTerminateAndCount(currentRunColor, currentRunLength, runHistory) {
    if (currentRunColor) {
      this.finderPenaltyAddHistory(currentRunLength, runHistory);
      currentRunLength = 0;
    }
    currentRunLength += this.size;
    this.finderPenaltyAddHistory(currentRunLength, runHistory);
    return this.finderPenaltyCountPatterns(runHistory);
  }

  // Pushes the given value to the front and drops the last value. Helper for getPenaltyScore().
  finderPenaltyAddHistory(currentRunLength, runHistory) {
    if (runHistory[0] === 0)
      currentRunLength += this.size;
    runHistory.pop();
    runHistory.unshift(currentRunLength);
  }
}

/*-- Constants and tables --*/

QrCode.MIN_VERSION = 1;
QrCode.MAX_VERSION = 40;

QrCode.PENALTY_N1 = 3;
QrCode.PENALTY_N2 = 3;
QrCode.PENALTY_N3 = 40;
QrCode.PENALTY_N4 = 10;

QrCode.ECC_CODEWORDS_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],  // Low
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],  // Medium
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],  // Quartile
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],  // High
];

QrCode.NUM_ERROR_CORRECTION_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],  // Low
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],  // Medium
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],  // Quartile
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],  // High
];

// Appends the given number of low-order bits of the given value to the given buffer.
function appendBits(val, len, bb) {
  if (len < 0 || len > 31 || val >>> len !== 0)
    throw new RangeError('Value out of range');
  for (let i = len - 1; i >= 0; i--)
    bb.push((val >>> i) & 1);
}

// Returns true iff the i'th bit of x is set to 1.
function getBit(x, i) {
  return ((x >>> i) & 1) !== 0;
}

// Throws an exception if the given condition is false.
function assert(cond) {
  if (!cond)
    throw new Error('Assertion error');
}

/*---- Public helper class: error correction level ----*/

class Ecc {
  constructor(ordinal, formatBits) {
    this.ordinal = ordinal;
    this.formatBits = formatBits;
  }
}
Ecc.LOW = new Ecc(0, 1);       // ~7% erroneous codewords tolerated
Ecc.MEDIUM = new Ecc(1, 0);    // ~15%
Ecc.QUARTILE = new Ecc(2, 3);  // ~25%
Ecc.HIGH = new Ecc(3, 2);      // ~30%
QrCode.Ecc = Ecc;

/*---- Data segment class ----*/

/*
 * A segment of character/binary/control data in a QR Code symbol. Instances are immutable.
 */
export class QrSegment {

  /*-- Static factory functions (mid level) --*/

  // Returns a segment representing the given binary data encoded in byte mode.
  static makeBytes(data) {
    let bb = [];
    for (const b of data)
      appendBits(b, 8, bb);
    return new QrSegment(QrSegment.Mode.BYTE, data.length, bb);
  }

  // Returns a segment representing the given string of decimal digits encoded in numeric mode.
  static makeNumeric(digits) {
    if (!QrSegment.isNumeric(digits))
      throw new RangeError('String contains non-numeric characters');
    let bb = [];
    for (let i = 0; i < digits.length;) {
      const n = Math.min(digits.length - i, 3);
      appendBits(parseInt(digits.substring(i, i + n), 10), n * 3 + 1, bb);
      i += n;
    }
    return new QrSegment(QrSegment.Mode.NUMERIC, digits.length, bb);
  }

  // Returns a segment representing the given text string encoded in alphanumeric mode.
  // Allowed characters: 0-9, A-Z (uppercase only), space, $ % * + - . / :
  static makeAlphanumeric(text) {
    if (!QrSegment.isAlphanumeric(text))
      throw new RangeError('String contains unencodable characters in alphanumeric mode');
    let bb = [];
    let i;
    for (i = 0; i + 2 <= text.length; i += 2) {
      let temp = QrSegment.ALPHANUMERIC_CHARSET.indexOf(text.charAt(i)) * 45;
      temp += QrSegment.ALPHANUMERIC_CHARSET.indexOf(text.charAt(i + 1));
      appendBits(temp, 11, bb);
    }
    if (i < text.length)
      appendBits(QrSegment.ALPHANUMERIC_CHARSET.indexOf(text.charAt(i)), 6, bb);
    return new QrSegment(QrSegment.Mode.ALPHANUMERIC, text.length, bb);
  }

  // Returns a new mutable list of zero or more segments to represent the given Unicode text string.
  static makeSegments(text) {
    if (text === '')
      return [];
    else if (QrSegment.isNumeric(text))
      return [QrSegment.makeNumeric(text)];
    else if (QrSegment.isAlphanumeric(text))
      return [QrSegment.makeAlphanumeric(text)];
    else
      return [QrSegment.makeBytes(QrSegment.toUtf8ByteArray(text))];
  }

  // Returns a segment representing an Extended Channel Interpretation (ECI) designator.
  static makeEci(assignVal) {
    let bb = [];
    if (assignVal < 0)
      throw new RangeError('ECI assignment value out of range');
    else if (assignVal < (1 << 7))
      appendBits(assignVal, 8, bb);
    else if (assignVal < (1 << 14)) {
      appendBits(0b10, 2, bb);
      appendBits(assignVal, 14, bb);
    } else if (assignVal < 1000000) {
      appendBits(0b110, 3, bb);
      appendBits(assignVal, 21, bb);
    } else
      throw new RangeError('ECI assignment value out of range');
    return new QrSegment(QrSegment.Mode.ECI, 0, bb);
  }

  // Tests whether the given string can be encoded as a segment in numeric mode.
  static isNumeric(text) {
    return QrSegment.NUMERIC_REGEX.test(text);
  }

  // Tests whether the given string can be encoded as a segment in alphanumeric mode.
  static isAlphanumeric(text) {
    return QrSegment.ALPHANUMERIC_REGEX.test(text);
  }

  /*-- Constructor (low level) --*/

  // Creates a new QR Code segment. The bit buffer is cloned and stored.
  constructor(mode, numChars, bitData) {
    if (numChars < 0)
      throw new RangeError('Invalid argument');
    this.mode = mode;
    this.numChars = numChars;
    this.bitData = bitData.slice();
  }

  /*-- Methods --*/

  // Returns a new copy of the data bits of this segment.
  getData() {
    return this.bitData.slice();
  }

  // Calculates and returns the number of bits needed to encode the given segments at the given version.
  static getTotalBits(segs, version) {
    let result = 0;
    for (const seg of segs) {
      const ccbits = seg.mode.numCharCountBits(version);
      if (seg.numChars >= (1 << ccbits))
        return Infinity;
      result += 4 + ccbits + seg.bitData.length;
    }
    return result;
  }

  // Returns a new array of bytes representing the given string encoded in UTF-8.
  static toUtf8ByteArray(str) {
    str = encodeURI(str);
    let result = [];
    for (let i = 0; i < str.length; i++) {
      if (str.charAt(i) !== '%')
        result.push(str.charCodeAt(i));
      else {
        result.push(parseInt(str.substring(i + 1, i + 3), 16));
        i += 2;
      }
    }
    return result;
  }
}

// Describes precisely all strings that are encodable in numeric mode.
QrSegment.NUMERIC_REGEX = /^[0-9]*$/;
// Describes precisely all strings that are encodable in alphanumeric mode.
QrSegment.ALPHANUMERIC_REGEX = /^[A-Z0-9 $%*+.\/:-]*$/;
// The set of all legal characters in alphanumeric mode, index = value.
QrSegment.ALPHANUMERIC_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

/*---- Public helper class: segment mode ----*/

class Mode {
  constructor(modeBits, numBitsCharCount) {
    this.modeBits = modeBits;
    this.numBitsCharCount = numBitsCharCount;
  }
  // Returns the bit width of the character count field for a segment in this mode
  // at the given version number.
  numCharCountBits(ver) {
    return this.numBitsCharCount[Math.floor((ver + 7) / 17)];
  }
}
Mode.NUMERIC = new Mode(0x1, [10, 12, 14]);
Mode.ALPHANUMERIC = new Mode(0x2, [9, 11, 13]);
Mode.BYTE = new Mode(0x4, [8, 16, 16]);
Mode.KANJI = new Mode(0x8, [8, 10, 12]);
Mode.ECI = new Mode(0x7, [0, 0, 0]);
QrSegment.Mode = Mode;

const LIVELLI_ECC = { L: QrCode.Ecc.LOW, M: QrCode.Ecc.MEDIUM, Q: QrCode.Ecc.QUARTILE, H: QrCode.Ecc.HIGH };

/* ============================================================
   Da qui in poi NON fa parte della libreria di Nayuki: è la parte scritta
   per questo progetto, il raster PNG per l'email. Vedi il commento in
   cima al file per il perché di un PNG scritto a mano, senza librerie.
   ============================================================ */

/* ---------- CRC-32 e Adler-32: le due somme di controllo che il formato
   PNG (per ogni chunk) e lo zlib dentro IDAT (per il flusso deflate)
   richiedono. Tabella precalcolata standard, polinomio 0xEDB88320— lo
   stesso di zip/gzip/Ethernet, non una scelta del progetto. ---------- */
const TAVOLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = TAVOLA_CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function adler32(bytes) {
  const MOD = 65521;
  let a = 1, b = 0;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]) % MOD;
    b = (b + a) % MOD;
  }
  return ((b << 16) | a) >>> 0;
}

function comeUint32BE(v) {
  return [(v >>> 24) & 0xFF, (v >>> 16) & 0xFF, (v >>> 8) & 0xFF, v & 0xFF];
}

/* un chunk PNG: lunghezza(4) + tipo(4) + dati + CRC(4) — il CRC si calcola
   su tipo+dati, non sulla lunghezza (che non è "contenuto" del chunk) */
function chunkPNG(tipo, dati) {
  const tipoByte = Array.from(tipo, (c) => c.charCodeAt(0));
  const corpo = tipoByte.concat(Array.from(dati));
  return comeUint32BE(dati.length).concat(corpo, comeUint32BE(crc32(corpo)));
}

/* un flusso deflate (RFC 1951) fatto solo di blocchi "stored": copia i
   byte così come sono, nessuna compressione vera. Per un'immagine di
   poche migliaia di byte come un QR il file cresce un poco rispetto a una
   compressione reale, ma la generazione resta un ciclo di copia — non un
   algoritmo di ricerca di corrispondenze — ed è comunque un flusso
   deflate valido: RFC 1951 §3.2.4 lo prevede esplicitamente come uno dei
   tre tipi di blocco, non è una scorciatoia fuori standard. */
function deflateNonCompresso(dati) {
  const MAX_BLOCCO = 65535;
  const out = [];
  let i = 0;
  if (dati.length === 0) { out.push(1, 0, 0, 0xFF, 0xFF); return out; }
  while (i < dati.length) {
    const fine = Math.min(i + MAX_BLOCCO, dati.length);
    const ultimo = fine === dati.length;
    const len = fine - i;
    out.push(ultimo ? 1 : 0);           // BFINAL nel bit 0, BTYPE=00 (stored) nei bit 1-2
    out.push(len & 0xFF, (len >>> 8) & 0xFF);
    const nlen = (~len) & 0xFFFF;
    out.push(nlen & 0xFF, (nlen >>> 8) & 0xFF);
    for (let k = i; k < fine; k++) out.push(dati[k]);
    i = fine;
  }
  return out;
}

/* zlib (RFC 1950): 2 byte di intestazione + il flusso deflate + 4 byte di
   Adler-32 sui dati ORIGINALI (non compressi, come vuole lo standard).
   0x78 0x01: metodo deflate, finestra 32K, livello "più veloce" — coerente
   coi blocchi stored, anche se qui FLEVEL non cambia il contenuto. */
function zlibDaBytes(dati) {
  const corpo = deflateNonCompresso(dati);
  return [0x78, 0x01].concat(corpo, comeUint32BE(adler32(dati)));
}

const FIRMA_PNG = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

/** Genera un QR come immagine PNG (un Uint8Array di byte pronto per una
 * risposta HTTP con content-type image/png), dato un testo.
 *
 * opzioni.livello: stesso significato di generaSvgQR in pagine/comune/qr.js
 *   ('L'|'M'|'Q'|'H', default qui 'Q' — pensato per lo schermo di un
 *   telefono in mano all'ospite al banco, non sempre nitido o ben
 *   illuminato quanto un foglio stampato).
 * opzioni.margine: quiete in moduli, come in generaSvgQR (default 4, il
 *   minimo raccomandato da ISO/IEC 18004).
 * opzioni.scala: pixel per modulo (default 8). L'immagine esce già alla
 *   sua dimensione finale in pixel: niente ridimensionamento lato server
 *   né affidamento a quello del client, che con un'interpolazione
 *   qualunque rischierebbe di sporcare proprio i bordi netti che un
 *   lettore usa per agganciare i pattern di ricerca.
 */
export function generaPngQR(testo, opzioni = {}) {
  const { livello = 'Q', margine = 4, scala = 8 } = opzioni;
  const ecc = LIVELLI_ECC[livello] || QrCode.Ecc.QUARTILE;
  const qr = QrCode.encodeText(String(testo ?? ''), ecc);
  const n = qr.size + margine * 2;
  const lato = n * scala;

  /* raster 1 bit per pixel, scala di grigi (colorType 0): 0 = nero,
     1 = bianco. Una riga grezza = 1 byte di filtro (0, "nessun filtro":
     senza una compressione vera un filtro non farebbe risparmiare nulla,
     vedi deflateNonCompresso) + i pixel impacchettati 8 per byte, MSB
     prima, l'ultimo byte di riga imbottito di zeri in coda se lato non è
     multiplo di 8 — esattamente come vuole lo standard PNG per bitDepth 1.
     L'array parte già a zero (nero): si scrive un bit solo per i pixel
     bianchi. */
  const byteMisura = Math.ceil(lato / 8);
  const grezzo = new Uint8Array((byteMisura + 1) * lato);
  for (let y = 0; y < lato; y++) {
    const inizioRiga = y * (byteMisura + 1);
    const modY = Math.floor(y / scala) - margine;
    for (let x = 0; x < lato; x++) {
      const modX = Math.floor(x / scala) - margine;
      if (!qr.getModule(modX, modY)) {   // modulo chiaro (o margine): pixel bianco
        grezzo[inizioRiga + 1 + (x >>> 3)] |= (0x80 >>> (x & 7));
      }
    }
  }

  const ihdr = comeUint32BE(lato).concat(comeUint32BE(lato), [1, 0, 0, 0, 0]);
  const idat = zlibDaBytes(grezzo);

  return new Uint8Array([
    ...FIRMA_PNG,
    ...chunkPNG('IHDR', ihdr),
    ...chunkPNG('IDAT', idat),
    ...chunkPNG('IEND', []),
  ]);
}
