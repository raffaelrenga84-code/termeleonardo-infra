/* ============================================================
   scheda-transfer.test.ts — l'ordine della scheda transfer nel back office.

   «Apri in ATAM lo posizionerei sotto ogni richiesta: andata e poi
   pulsante, ritorno e poi pulsante, e poi conferma al cliente. Metti un
   po' di ordine» (la proprieta', 2 settembre 2026). Prima la tabella
   dell'andata stava in fondo, il ritorno aveva un pulsante senza tabella e
   in mezzo c'era il modulo della conferma.

   Prove sul sorgente: la scheda si disegna dentro una pagina con troppi
   fili per eseguirla fuori dal browser. Tengono fermo l'ORDINE, che e'
   quello che si e' chiesto, e che il ritorno abbia la sua tabella.
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const SORGENTE = Deno.readTextFileSync(new URL('index.html', import.meta.url));

Deno.test('prima i tassisti — andata, poi ritorno — e poi la conferma all ospite', () => {
  const tassisti = SORGENTE.indexOf('<h2 style="font-size:18px;">Per il modulo dei tassisti</h2>');
  const conferma = SORGENTE.indexOf('<h2 style="font-size:18px;">Conferma all’ospite</h2>');
  assert(tassisti > 0 && conferma > 0, 'manca uno dei due blocchi');
  assert(tassisti < conferma, 'il modulo dei tassisti sta ancora sotto la conferma all ospite');
  const andata = SORGENTE.indexOf('id="bApriAtam"');
  const ritorno = SORGENTE.indexOf('id="bApriAtamRitorno"');
  assert(andata > tassisti, 'il pulsante dell andata non sta nel blocco dei tassisti');
  assert(ritorno > andata, 'il pulsante del ritorno non viene dopo quello dell andata');
  assert(ritorno < conferma, 'il pulsante del ritorno sta sotto la conferma all ospite');
});

Deno.test('il ritorno ha la sua tabella, dalle stesse voci del modulo compilato', () => {
  assert(/vociATAM\(r, dataIT\)\.map\(rigaAtam\)/.test(SORGENTE), 'l andata non usa la riga condivisa');
  assert(/vociATAMRitorno\(r, dataIT\)\.map\(rigaAtam\)/.test(SORGENTE), 'il ritorno non ha la tabella');
  assert(/\$\{vociATAMRitorno\(r, dataIT\) \? `/.test(SORGENTE),
    'il blocco del ritorno comparirebbe anche senza ritorno: un blocco vuoto e un blocco che si prenota per sbaglio');
  assert(/import \{[^}]*vociATAMRitorno[^}]*\} from '\/comune\/atam\.js'/.test(SORGENTE),
    'la pagina non importa vociATAMRitorno');
});

Deno.test('ogni pulsante ATAM apre in una scheda nuova senza passare il referer', () => {
  for (const id of ['bApriAtam', 'bApriAtamRitorno']) {
    const m = SORGENTE.match(new RegExp('id="' + id + '"[^>]*>'));
    assert(m && /target="_blank"/.test(m[0]) && /rel="noopener noreferrer"/.test(m[0]), id);
  }
});
