/* ============================================================
   arrivo.test.ts — la pagina del check-in online.

   Non si esegue una pagina intera senza browser, ma alcune cose si possono
   provare cosi', e sono quelle che si rompono in silenzio:
   il copione dev'essere leggibile (un apice inverso chiuso male apre la
   pagina bianca), il luogo dev'essere un elenco e non una casella libera,
   la porta dev'essere quella nuova, e il cellulare non deve finire nel
   posto sbagliato del corpo.
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const SORGENTE = Deno.readTextFileSync(new URL('index.html', import.meta.url));

Deno.test('il copione si legge senza errori di sintassi', () => {
  const m = SORGENTE.match(/<script type="module">([\s\S]*)<\/script>/);
  assert(m, 'lo <script type="module"> non si trova');
  const corpo = m![1].split('\n').filter((r) => !/^\s*import\s/.test(r)).join('\n');
  assert(corpo.length > 5000, `corpo di sole ${corpo.length} lettere: la prova gira a vuoto`);
  new Function(corpo);
});

/* Era una casella di testo da 40 caratteri, e l'ospite ci scriveva
   "Venezia": nessuna delle sue varianti e' una voce ATAM, e la reception
   doveva cercarla a mano fra 189. */
Deno.test('il luogo del transfer e un elenco, non una casella libera', () => {
  assert(SORGENTE.includes('/comune/luoghi.js'), 'la pagina non importa i luoghi');
  assert(!/id="trScalo"[^>]*type="text"/.test(SORGENTE),
    'il luogo e ancora una casella di testo libera');
});

Deno.test('la pagina manda al nuovo indirizzo', () => {
  assert(SORGENTE.includes('a=invia-arrivo'), 'la pagina scrive ancora su prepara-arrivo');
});

/* Le attenzioni si mandano come chiavi: il testo tradotto in back office
   andrebbe letto da chi aveva davanti un'altra lingua. E' la stessa scelta
   gia' presa per il desiderio dei fanghi. */
Deno.test('le attenzioni partono come chiavi, non come testo tradotto', () => {
  assert(/'culla'\s*,\s*'seggiolone'\s*,\s*'parcheggio'\s*,\s*'cane'/.test(SORGENTE),
    'le chiavi delle attenzioni non si trovano nella pagina');
});

/* IL PUNTO IN CUI QUESTO COMPITO PUO' FALLIRE IN SILENZIO. Il validatore
   del transfer (supabase/functions/richieste/tipi.ts, validaTransfer) non
   legge "cell": un numero lasciato dentro transfer_dati sparisce senza
   errore, e la reception si ritrova un taxi da chiamare senza nessun
   numero — peggio di prima, perche' la vecchia email il numero lo
   stampava. index.ts (azione invia-arrivo) cerca il telefono in cima al
   corpo, esattamente come fa gia' il modulo transfer del sito. */
Deno.test('il cellulare per l autista finisce in telefono, non dentro transfer_dati', () => {
  assert(/telefono\s*:\s*v\(\s*['"]trCell['"]\s*\)/.test(SORGENTE),
    'il cellulare non parte come "telefono" in cima al corpo');
  assert(!/cell\s*:\s*v\(\s*['"]trCell['"]\s*\)/.test(SORGENTE),
    'il cellulare finisce ancora dentro transfer_dati.cell, dove il validatore lo ignora in silenzio');
});

/* La "verso" del transfer deve combaciare parola per parola con quello che
   accetta validaTransfer ('arrivo' o 'partenza', letterale): un'opzione con
   solo il testo tradotto ("L'arrivo", "Die Anreise"...) come valore
   manderebbe OGNI richiesta di transfer al rifiuto "indicare arrivo o
   partenza", in tutte e quattro le lingue. */
Deno.test('il tipo di transfer manda i valori del server, non il testo tradotto', () => {
  assert(/<select id="trTipo">[\s\S]{0,400}?\[\s*['"]arrivo['"]\s*,\s*['"]partenza['"]\s*\]/.test(SORGENTE),
    'le opzioni di trTipo non portano i valori letterali "arrivo"/"partenza"');
});

/* Lo stato "gia inviato" (409) non e' un errore rosso: e' normale, capita a
   chi ricarica la pagina. Deve esistere in tutte e quattro le lingue, o
   chi ricarica in tedesco o francese vede "undefined". */
Deno.test('lo stato "gia inviato" parla tutte e quattro le lingue', () => {
  assert((SORGENTE.match(/giaInviatoT\s*:/g) || []).length === 4,
    'il titolo dello stato "gia inviato" non e in tutte e quattro le lingue');
  assert((SORGENTE.match(/perCambiare\s*:/g) || []).length === 4,
    'l invito a scrivere per cambiare qualcosa non e in tutte e quattro le lingue');
});
