/* ============================================================
   anteprima-pdf.js — il PDF del buono disegnato dalla pagina, non dal
   visore del browser.

   PERCHE' ESISTE. Il buono e' un PDF (pdf-buono.ts) e le pagine lo
   mostravano in un <iframe>. Funziona su un PC; su Android Chrome non
   esiste un visore PDF dentro la pagina (un riquadro grigio, o un
   download), su iPhone Safari si vede solo la prima pagina senza poter
   scorrere, e uno screenshot senza finestra mostra un rettangolo nero
   (6 settembre 2026, guardando la pagina d'acquisto come la vede un
   cliente). Un cliente che compra un buono deve vederlo, su qualunque
   telefono.

   COME. pdf.js di Mozilla, caricato da cdnjs (versione fissata), disegna la
   prima pagina su un <canvas> largo quanto il contenitore, nitido sui
   telefoni (devicePixelRatio). Se la libreria non arriva (rete, blocchi),
   si torna all'iframe di prima: meglio un visore imperfetto che niente.

   Puro quanto basta: niente dipendenze del progetto; la usano
   pagine/buoni/regala, pagine/buoni/stampa e il back office.
   ============================================================ */
'use strict';

const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/';
let libreria = null;

async function pdfjs() {
  if (!libreria) {
    libreria = import(CDN + 'pdf.min.mjs').then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = CDN + 'pdf.worker.min.mjs';
      return lib;
    }).catch((e) => { libreria = null; throw e; });
  }
  return libreria;
}

/** L'iframe di prima: il ripiego quando pdf.js non c'e'. */
export function iframeDiRipiego(contenitore, url, titolo) {
  contenitore.innerHTML = `<iframe class="pdfFrame" src="${url}" title="${String(titolo || 'PDF').replace(/"/g, '&quot;')}"></iframe>`;
}

/** Disegna la prima pagina del PDF (un URL, anche blob:) nel contenitore.
 *  Risolve true se ha disegnato col canvas, false se e' ricorsa all'iframe. */
export async function anteprimaPdf(contenitore, url, titolo) {
  if (!contenitore) return false;
  try {
    const [lib, r] = await Promise.all([pdfjs(), fetch(url)]);
    if (!r.ok) throw new Error('pdf ' + r.status);
    const dati = new Uint8Array(await r.arrayBuffer());
    const doc = await lib.getDocument({ data: dati }).promise;
    const pagina = await doc.getPage(1);
    const base = pagina.getViewport({ scale: 1 });
    const larghezza = Math.max(200, contenitore.clientWidth || 600);
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const scala = larghezza / base.width;
    const vista = pagina.getViewport({ scale: scala * dpr });
    const canvas = document.createElement('canvas');
    canvas.className = 'pdfFrame pdfTela';
    canvas.width = Math.round(vista.width);
    canvas.height = Math.round(vista.height);
    canvas.style.width = larghezza + 'px';
    canvas.style.height = Math.round(larghezza * base.height / base.width) + 'px';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', String(titolo || 'PDF'));
    await pagina.render({ canvasContext: canvas.getContext('2d'), viewport: vista }).promise;
    contenitore.innerHTML = '';
    contenitore.appendChild(canvas);
    return true;
  } catch (e) {
    iframeDiRipiego(contenitore, url, titolo);
    return false;
  }
}
