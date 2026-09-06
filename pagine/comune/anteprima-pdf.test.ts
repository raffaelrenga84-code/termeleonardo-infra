/* ============================================================
   anteprima-pdf.test.ts — il PDF disegnato dalla pagina, su ogni telefono.

   Su Android Chrome un <iframe> con un PDF non mostra niente: la prima
   pagina si disegna su un canvas con pdf.js, e l'iframe resta il ripiego
   (6 settembre 2026). Il modulo vive nel DOM: prove sul testo, e sulle
   scelte che contano — versione fissata, worker, nitidezza, ripiego.
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const S = Deno.readTextFileSync(new URL('./anteprima-pdf.js', import.meta.url));

Deno.test('pdf.js arriva da cdnjs a versione fissata, col suo worker', () => {
  assert(S.includes("const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/';"), 'versione fissata: un aggiornamento non arriva a sorpresa');
  assert(S.includes("import(CDN + 'pdf.min.mjs')") && S.includes("lib.GlobalWorkerOptions.workerSrc = CDN + 'pdf.worker.min.mjs';"), 'modulo e worker dallo stesso posto');
  assert(S.includes('libreria = null; throw e;'), 'se il caricamento fallisce si riprova la volta dopo, non si resta con una promessa rotta');
});

Deno.test('la prima pagina si disegna larga quanto il contenitore, nitida sui telefoni', () => {
  assert(S.includes('doc.getPage(1)'), 'la prima pagina');
  assert(S.includes("const larghezza = Math.max(200, contenitore.clientWidth || 600);"), 'larga quanto il contenitore');
  assert(S.includes('const dpr = Math.min(3, window.devicePixelRatio || 1);') && S.includes('pagina.getViewport({ scale: scala * dpr })'), 'nitida: i pixel del telefono, con un tetto');
  assert(S.includes("canvas.className = 'pdfFrame pdfTela';"), 'la stessa classe di stile dell iframe, piu la sua');
  assert(S.includes("canvas.setAttribute('role', 'img');"), 'e per chi legge con lo screen reader e un immagine col suo nome');
});

Deno.test('se pdf.js non arriva si torna all iframe di prima, e lo si dice a chi chiama', () => {
  assert(S.includes('export function iframeDiRipiego(contenitore, url, titolo)'), 'il ripiego e una funzione sua');
  assert(S.includes('} catch (e) {') && S.includes('iframeDiRipiego(contenitore, url, titolo);') && S.includes('return false;'), 'nel catch, con false');
  assert(S.includes('return true;'), 'true quando il canvas c e');
});

Deno.test('non dipende da niente del progetto: lo importano tre pagine diverse', () => {
  assert(!/from ['"]\.\.?\//.test(S), 'nessun import relativo');
  assert(S.includes('export async function anteprimaPdf(contenitore, url, titolo)'));
});
