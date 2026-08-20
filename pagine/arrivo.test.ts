/* ============================================================
   arrivo.test.ts — la pagina del check-in online.

   Non si esegue una pagina intera senza browser, ma alcune cose si possono
   provare cosi', e sono quelle che si rompono in silenzio:
   il copione dev'essere leggibile (un apice inverso chiuso male apre la
   pagina bianca), il luogo dev'essere un elenco e non una casella libera,
   la porta dev'essere quella nuova, e il cellulare non deve finire nel
   posto sbagliato del corpo.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

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
   doveva cercarla a mano fra 189. GIRO DI CORREZIONE 1: la prova originale
   passava anche solo cambiando <input type="text"> in <select> — restava
   verde con "trScalo" ancora vivo sotto un altro tag. Ora il campo non deve
   comparire affatto, col nome vecchio ne' col nuovo. */
Deno.test('il luogo del transfer e un elenco, non una casella libera', () => {
  assert(SORGENTE.includes('/comune/luoghi.js'), 'la pagina non importa i luoghi');
  assert(!SORGENTE.includes('trScalo'), 'il campo "trScalo" e ancora nel sorgente, sotto qualche forma');
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

/* GIRO DI CORREZIONE 1: la prova originale accettava un trTipi di
   qualunque lunghezza. Il mapping e' posizionale — ['arrivo','partenza'][i]
   — quindi una terza voce aggiunta domani a trTipi uscirebbe con
   value="undefined": esattamente il difetto appena corretto sopra, di
   nuovo, e stavolta senza una prova rossa ad avvisare. */
Deno.test('il tipo di transfer ha sempre due voci, mai una lunghezza qualunque', () => {
  const liste = [...SORGENTE.matchAll(/trTipi\s*:\s*\[([^\]]*)\]/g)];
  assertEquals(liste.length, 4, `trovate ${liste.length} liste trTipi, servono 4 (una per lingua)`);
  for (const m of liste) {
    const voci = m[1].split(',').filter((s) => s.trim().length > 0);
    assertEquals(voci.length, 2,
      `trTipi con ${voci.length} voci invece di 2: il mapping su ['arrivo','partenza'] uscirebbe "undefined"`);
  }
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

/* GIRO DI CORREZIONE 1: le etichette da sole non provano che il ramo
   esista. Chi cancella `if (r.status === 409) { giaInviato(...) }` e lascia
   le chiavi del dizionario intatte vedeva questa suite restare tutta
   verde, con il 409 finito silenziosamente nel riquadro d'errore rosso
   come un rifiuto qualunque. */
Deno.test('lo stato "gia inviato" e un ramo vero, non solo etichette rimaste in giro', () => {
  assert(/status\s*===\s*409[\s\S]{0,80}?giaInviato\(/.test(SORGENTE),
    'il 409 non chiama piu giaInviato(): lo stato "gia inviato" esiste solo nel dizionario, non nel codice');
});

/* La forma del corpo e' l'interfaccia di questo compito (vedi il brief):
   il token dentro il corpo — non nell'indirizzo — e transfer_dati/
   fattura_dati ANNIDATI, non stesi allo stesso livello degli altri campi.
   pezziDaArrivo() (supabase/functions/richieste/arrivo-invio.ts) legge
   proprio questa forma; un corpo stese sparirebbe dentro validaDati come
   un oggetto vuoto, e la sezione svanirebbe senza errore. */
Deno.test('il corpo ha il token dentro di se e transfer_dati/fattura_dati annidati', () => {
  const m = SORGENTE.match(/const corpo = \{[\s\S]*?\n  \};/);
  assert(m, 'non si trova la costruzione del corpo in invia()');
  const corpo = m[0];
  assert(/token\s*:\s*TOKEN/.test(corpo), 'il token non e dentro il corpo');
  assert(/transfer_dati\s*:\s*tr\s*\?\s*\{/.test(corpo), 'transfer_dati non e un oggetto annidato');
  assert(/fattura_dati\s*:\s*fatt\s*\?\s*\{/.test(corpo), 'fattura_dati non e un oggetto annidato');
});

/* GIRO DI CORREZIONE 1, punto 1. Senza mandare "collettivo" il validatore
   lo risolve a false: ogni transfer nasce "auto privata" e quel dettaglio
   finisce cosi' com'e' nell'email di conferma, senza che l'ospite abbia
   mai visto l'alternativa (spesso piu' economica) della navetta condivisa. */
Deno.test('la scelta fra auto privata e navetta condivisa parte con la richiesta', () => {
  const m = SORGENTE.match(/transfer_dati:\s*tr\s*\?\s*\{([\s\S]*?)\}\s*:\s*null/);
  assert(m, 'non si trova transfer_dati nel corpo');
  assert(/collettivo\s*:/.test(m[1]), 'transfer_dati non manda "collettivo": ogni transfer nasce privato, senza che sia stato chiesto');
  assert((SORGENTE.match(/trServizio\s*:/g) || []).length === 4,
    'l etichetta del servizio (privata/condivisa) non e in tutte e quattro le lingue');
});

/* GIRO DI CORREZIONE 1, punto 2. Il ritorno torna, ma con le sue date: il
   validatore accetta "ritorno:true" senza giorno ne' ora (per compatibilita'
   con le righe vecchie), ed e' esattamente il difetto che quei due campi
   esistono per uccidere — la reception saprebbe CHE serve il ritorno e non
   QUANDO, e dovrebbe telefonare. */
Deno.test('il ritorno porta sempre giorno e ora, mai un booleano muto', () => {
  const m = SORGENTE.match(/transfer_dati:\s*tr\s*\?\s*\{([\s\S]*?)\}\s*:\s*null/);
  assert(m, 'non si trova transfer_dati nel corpo');
  assert(/ritorno_quando\s*:\s*ritorno\s*\?\s*v\(\s*['"]trRitornoQuando['"]\s*\)\s*:\s*null/.test(m[1]),
    'ritorno_quando non e condizionato al ritorno: rischia di partire vuoto');
  assert(/ritorno_ora\s*:\s*ritorno\s*\?\s*v\(\s*['"]trRitornoOra['"]\s*\)\s*:\s*null/.test(m[1]),
    'ritorno_ora non e condizionato al ritorno: rischia di partire vuoto');
  /* la scorciatoia vietata: mandare "true" senza controllare che le due date
     ci siano davvero, prima ancora di chiamare il server */
  assert(/if\s*\(\s*ritorno\s*&&\s*\(!v\(\s*['"]trRitornoQuando['"]\s*\)\s*\|\|\s*!v\(\s*['"]trRitornoOra['"]\s*\)\s*\)\s*\)/.test(SORGENTE),
    'manca il controllo che blocca l invio se manca giorno o ora del ritorno');
  assert((SORGENTE.match(/trRitornoQuando\s*:/g) || []).length === 4,
    'l etichetta del giorno di ritorno non e in tutte e quattro le lingue');
  assert((SORGENTE.match(/trRitornoOra\s*:/g) || []).length === 4,
    'l etichetta dell ora di ritorno non e in tutte e quattro le lingue');
});

/* GIRO DI CORREZIONE 1, punto 6. Il server risponde {ok:true, numeri:[...]}
   sull'invio riuscito: se la schermata di ringraziamento li ignora,
   l'ospite li scopre solo ricaricando la pagina e finendo nel 409. */
Deno.test('i numeri della richiesta si vedono anche al primo invio, non solo ricaricando', () => {
  assert(/stato\(\s*t\.grazieT[\s\S]{0,200}?d\.numeri/.test(SORGENTE),
    'la schermata di ringraziamento non mostra d.numeri');
});

/* GIRO DI CORREZIONE 1, punto 5. 404 (link non valido) e 410 (scaduto) sono
   gli stessi casi del caricamento: la pagina ha gia' le schermate tradotte,
   non serve mostrarli come un rifiuto in italiano nel riquadro rosso. */
Deno.test('link non valido e soggiorno scaduto restano schermate tradotte, non un errore muto', () => {
  assert(/status\s*===\s*404[\s\S]{0,80}?nonValidoT/.test(SORGENTE),
    'il 404 sull invio non porta piu alla schermata "link non valido"');
  assert(/status\s*===\s*410[\s\S]{0,80}?scadutoT/.test(SORGENTE),
    'il 410 sull invio non porta piu alla schermata "soggiorno scaduto"');
});
