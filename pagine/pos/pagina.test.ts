/* ============================================================
   pagina.test.ts — la pagina del cameriere, letta dal sorgente.

   Tre schermate (sala, tavolo, ordine), un accesso col PIN, le azioni
   del contratto, la scelta del server e la coda offline dai moduli puri.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const P = Deno.readTextFileSync(new URL('./index.html', import.meta.url));
const m = (P.match(/<script type="module">([\s\S]*?)<\/script>/) ?? ['', ''])[1];

Deno.test('riservata, installabile, moduli con percorso assoluto', () => {
  assert(/<meta name="robots" content="noindex, nofollow"/.test(P));
  assert(P.includes('href="/pos/manifest.webmanifest"') && m.includes("serviceWorker.register('/pos/sw.js'"));
  assert(m.includes("from '/pos/stato.js'") && m.includes("from '/pos/server.js'"));
  const man = JSON.parse(Deno.readTextFileSync(new URL('./manifest.webmanifest', import.meta.url))) as Record<string, unknown>;
  /* sul sito l indirizzo e /pos senza barra (Vercel la toglie): l app
     installata deve coprire anche quello, quindi scope alla radice */
  assertEquals(man.start_url, '/pos');
  assertEquals(man.scope, '/');
  assertEquals(man.display, 'fullscreen');
  const sw = Deno.readTextFileSync(new URL('./sw.js', import.meta.url));
  assert(sw.includes("'/pos'") && !sw.includes("'/pos/'"), 'in cache va /pos: /pos/ sul sito e un rimando, e un rimando dalla cache non apre la pagina');
  assert(m.includes("scope: '/pos'"), 'il service worker copre /pos, non solo /pos/');
});

Deno.test('la sala: elenco in mano, piantina sul PC, e la barra delle zone non scorre via', () => {
  /* la piantina di Fidra e larga come una sala: dentro un telefono
     stretto i tavoli si sovrappongono (4 settembre 2026) */
  assert(m.includes("VISTA_SALA") && m.includes("localStorage.getItem('posVistaSala') || 'elenco'"), 'si parte sempre dall elenco, ordinato');
  assert(m.includes("localStorage.setItem('posVistaSala'"), 'la scelta resta sul dispositivo');
  assert(m.includes('id="cambiaVista"') && m.includes('elencoTavoli'), 'si passa da una all altra');
  assert(P.includes('.zone{') && /\.zone\{[^}]*position:sticky/.test(P), 'le zone restano in cima');
  assert(m.includes('numeroTavolo('), 'nell elenco i tavoli vanno in ordine di numero');
});

Deno.test('le tre schermate e i gesti della spec', () => {
  for (const f of ['function schermataSala(', 'function schermataTavolo(', 'function schermataOrdine(', 'function accesso(']) assert(m.includes(f), f);
  assert(m.includes("'x-pos-sessione'") && m.includes("'x-pos-dispositivo'"));
  for (const a of ['accesso', 'menu', 'sala', 'conto', 'righe', 'invia', 'vai', 'storna', 'chiudi']) assert(m.includes(`'${a}'`), `azione ${a}`);
  assert(m.includes('Vai coi') || m.includes('Vai con'), 'il pulsante dice cosa parte');
  assert(m.includes('preferiti') && m.includes('ultimi') && m.includes('cerca'), 'preferiti, ultimi del tavolo, ricerca');
  assert(m.includes('toccoLungo('), 'tocco lungo sulla riga');
  assert(m.includes('USCITA_DOPO_MS'), 'uscita automatica dopo inattivita');
  assert(m.includes("get('d')"), 'il token del palmare si puo dare una volta dall indirizzo (?d=)');
  assert(m.includes('id="dispositivoCodice"') && m.includes("localStorage.setItem('posDispositivo'"), 'o si scrive sul palmare stesso, nella schermata «non registrato»');
  /* col codice sbagliato si resterebbe chiusi fuori: dalla schermata
     dell accesso si deve poter rimettere (4 settembre 2026) */
  assert(m.includes("localStorage.removeItem('posDispositivo')"), 'e si puo cambiare se non va piu bene');
});

Deno.test('si entra col solo PIN di quattro cifre, e alla quarta cifra si parte da soli', () => {
  /* «falli identificare solo con un PIN di 4 cifre» (la proprieta', 6 settembre 2026) */
  assert(m.includes('const entra = async'));
  assert(m.includes("body: JSON.stringify({ pin })"), 'al server va il PIN e basta');
  assert(m.includes('if (pin.length === 4) entra();'), 'alla quarta cifra si entra senza premere invio');
  assert(m.includes('if (pin.length >= 4) return;'), 'una quinta cifra non entra');
  assert(!m.includes('vCodice') && !m.includes('Il suo codice'), 'il codice non si chiede piu sul palmare');
});

Deno.test('l indirizzo del PC nelle impostazioni si sistema da solo, e da https non si tiene', () => {
  /* scritto senza http:// ogni chiamata sbagliava strada; da una pagina
     https il browser blocca l http verso il PC (6 settembre 2026) */
  assert(m.includes("if (s && !/^https?:\\/\\//i.test(s)) s = 'http://' + s;"));
  assert(m.includes("location.protocol === 'https:' && /^http:\\/\\//i.test(s)") && m.includes("s = ''; }"), 'da https si resta sul cloud e lo si dice');
});

Deno.test('il palmare non decide prezzi: manda articolo, quantita, variante, nota, portata e al massimo un prezzo manuale', () => {
  const inizio = m.indexOf('const invia = async');
  assert(inizio > 0, 'la funzione invia');
  const righe = m.slice(inizio, inizio + 900);
  assert(righe.includes('prezzo_manuale_cent') && !righe.includes('prezzo_listino_cent'), 'il listino lo sa il server');
});

Deno.test('niente stampanti fiscali, niente chiave hotel nella pagina', () => {
  assert(!/8989|8990|x-hotel-key|HOTEL_KEY|192\.168\.0\.5[12]/.test(P));
});

Deno.test('al tavolo si paga separatamente: una riga passa a un altro conto, o a uno nuovo aperto li per li', () => {
  assert(m.includes("a=sposta") || m.includes("scrivi('sposta'"), 'l azione');
  assert(m.includes('data-sposta') && m.includes('+ Conto nuovo'), 'i conti del tavolo e quello nuovo');
  assert(m.includes('fratelli'), 'gli altri conti arrivano col conto');
  const pan = m.slice(m.indexOf('const pannelloRiga ='), m.indexOf('const invia ='));
  assert(pan.includes('data-sposta'), 'si sposta dal pannello della riga');
});

Deno.test('quantita e prezzi si battono sul tastierino, non in una finestrella di sistema', () => {
  assert(m.includes('function chiediNumero('), 'il tastierino');
  assert(m.includes("chiediNumero('Quante?'") && m.includes('id="quantitaAltra"'), 'per le quantita oltre quattro');
  assert(m.includes("chiediNumero(`${a.nome}: prezzo in euro`, { decimale: true })"), 'e per il prezzo libero');
  assert(!m.includes('prompt(`${a.nome}: importo in euro`)'), 'niente prompt di sistema per il prezzo');
  assert(m.includes("'# prezzo libero'") || m.includes('# prezzo libero'), 'il cancelletto segna gli articoli a prezzo libero');
  assert(m.includes('border-left:7px solid'), 'il colore della categoria si vede sull articolo');
});

Deno.test('le categorie tutte insieme in un riquadro per una, in ordine, non in fila di lato', () => {
  /* «sul pos le categorie sono queste non quel casino che hai messo tu»
     (la proprieta', 4 settembre 2026): sul POS di prima stanno in una
     griglia alfabetica, tutte in vista */
  assert(m.includes('const categorieRadice = ()'), 'l ordine lo decide una funzione sola');
  assert(m.includes("String(a.nome).localeCompare(String(b.nome), 'it')"), 'a parita di posizione, l alfabeto');
  assert(m.includes('class="categorieGriglia"') && m.includes('class="catVoce '), 'la griglia');
  assert(/\.categorieGriglia\{display:grid/.test(P), 'e in CSS e una griglia, non una fila che scorre');
  assert(m.includes('const dentroUna = !!categoria || cerca.length >= 3;'), 'la griglia si vede al primo piano');
  assert(m.includes("<button data-cat=\"\">‹ Categorie</button>"), 'e da dentro si torna indietro');
  assert(m.includes('quantiIn(c)') && m.includes('ancora vuota'), 'una categoria senza articoli lo dice');
});

Deno.test('un conto si chiama col nome di chi paga, e se e vuoto si toglie', () => {
  /* «non posso eliminare gli esterni o scrivere nome» (4 settembre 2026) */
  assert(m.includes('const pannelloConto = (c) =>'), 'il pannello del conto');
  assert(m.includes('id="pcNome"') && m.includes('maxlength="40"'), 'il nome si scrive');
  assert(m.includes("scrivi('conto-cambia', { conto: c.id, nome:"), 'e si salva');
  assert(m.includes("scrivi('conto-elimina', { conto: c.id })"), 'e il conto vuoto si elimina');
  assert(m.includes("c.totale_cent ? '<p class=\"mini\">Il conto ha delle righe"), 'con delle righe dentro non si elimina: si storna o si chiude');
  assert(m.includes('const titoloConto = (c) =>'), 'come si chiama un conto lo dice una funzione sola');
  assert(m.includes('esc(c.titolo || titoloConto(c))'), 'e in elenco si legge quello');
});

Deno.test('prezzo e disponibilita dal POS, col tocco lungo su un articolo', () => {
  /* «non posso modificare i prezzi» (4 settembre 2026): in sala non si va
     in back office col vassoio in mano */
  assert(m.includes('const pannelloArticolo = (a) =>'), 'il pannello dell articolo');
  assert(m.includes("const puoDisponibilita = !!CAMERIERE && CAMERIERE.ruolo !== 'cameriere'"), 'lo segna il capo sala');
  assert(m.includes("const puoListino = !!CAMERIERE && CAMERIERE.ruolo === 'amministrazione'"), 'il prezzo solo l amministrazione');
  assert(m.includes("chiama('articolo-cambia', { method: 'POST', body: JSON.stringify(corpo), cloud: true })"), 'e va al cloud, dove vive il menu');
  assert(m.includes('const base = opz.cloud ? CLOUD : await server.base();'), 'il cloud si puo chiedere apposta');
  assert(m.includes("if (b.dataset.lungo) { b.removeAttribute('data-lungo'); return; }"), 'dopo il tocco lungo il dito che si alza non ordina');
  assert(!m.includes("${a.esaurito ? 'disabled' : ''}"), 'un articolo esaurito si tocca lo stesso: e da li che si rimette');
});

Deno.test('conto in camera: si passa la tessera, o si scrive la camera', () => {
  assert(m.includes('const pannelloCamera = () =>'), 'il pannello');
  assert(m.includes('id="nuovoCamera"'), 'il pulsante al tavolo');
  assert(m.includes("chiama('tessera', { qs: `&codice=${encodeURIComponent(cifre)}`, cloud: true })"), 'la tessera la legge il cloud');
  assert(m.includes("if (ev.key === 'Enter')"), 'il lettore del palmare scrive e manda invio');
  assert(m.includes("tessera: s.daTessera ? s.tessera : null"), 'se la camera viene cambiata a mano, la tessera non la certifica piu');
  assert(m.includes("tipo: 'camera'"), 'e il conto nasce di tipo camera');
});

Deno.test('la chiusura non e piu una finestrella di sistema, e in camera avvisa', () => {
  assert(!m.includes("prompt('Come paga?"), 'niente prompt');
  assert(m.includes('data-modo="contanti"') && m.includes('data-modo="carta"'), 'contanti e carta');
  assert(m.includes("const inCamera = conto.tipo === 'camera' && String(conto.camera || '').trim();"), 'in camera solo se il conto e di una camera');
  assert(m.includes('data-modo="camera"') && m.includes('la reception lo riporta sul conto camera in Fidra'), 'e si dice cosa succede');
  assert(m.includes('Chiudo ${euro(totale)} sulla camera ${conto.camera} senza firma?'), 'chiudere senza firma si conferma con l importo davanti');
});

Deno.test('l ospite firma l addebito sul palmare, nella sua lingua', () => {
  assert(m.includes('const firmaOspite = (totale) =>'), 'la schermata della firma');
  assert(m.includes('const FIRMA_TESTI = {') && ['it:', 'en:', 'de:', 'fr:'].every((l) => m.includes(l)), 'quattro lingue');
  assert(m.includes("lingua: s.daTessera ? s.lingua : null"), 'la lingua la dice Fidra con la tessera');
  assert(m.includes("if (modo === 'camera') { via(); return firmaOspite(totale); }"), 'in camera si passa dalla firma');
  assert(m.includes("toDataURL('image/png')") && m.includes('pointerdown') && m.includes('pointermove'), 'si firma col dito');
  assert(m.includes('if (tratti < 5)'), 'un tocco solo non e una firma');
  assert(m.includes('id="fmSenza"'), 'e se l ospite se n e andato si chiude senza');
  assert(m.includes('firma: null') || m.includes('chiudiCon(null)'), 'senza firma il conto si chiude lo stesso');
  const f = m.slice(m.indexOf('const firmaOspite ='), m.indexOf('/* La chiusura:'));
  assert(f.includes('conto.camera') && f.includes('euro(totale)'), 'l ospite vede camera e importo prima di firmare');
});

Deno.test('senza motivo non si cambia un prezzo e non si storna', () => {
  /* «se uno applica una variazione di prezzo deve scrivere la motivazione
     altrimenti non deve permettere la modifica; la stessa cosa anche in
     caso di storno» (la proprieta', 4 settembre 2026) */
  assert(m.includes('id="pMotivoPrezzo"'), 'il campo sulla riga');
  assert(m.includes('const cambiaPrezzo = !a.prezzo_libero && campi.prezzo_manuale_cent != null && campi.prezzo_manuale_cent !== listino;'), 'solo se il prezzo cambia davvero');
  /* «se c'e' una nota gia' non serve che il cameriere deve aggiungere la
     spiegazione» (la proprieta', 4 settembre 2026) */
  assert(m.includes("const spiegato = campi.motivo_prezzo.length >= 3 || (campi.nota || '').trim().length >= 3;"), 'la nota gia scritta vale come motivo');
  assert(m.includes('if (cambiaPrezzo && !spiegato)'), 'e allora il motivo e obbligatorio');
  assert(m.includes('motivo_prezzo: r.motivo_prezzo'), 'e viaggia col la riga fino al server');
  assert(m.includes("if (CAMERIERE.storno_con_motivo && motivo.length < 3)") && m.includes('Scriva il motivo dello storno'), 'lo storno lo pretende, da chi ha la spunta');
  assert(m.includes('id="paMotivo"') && m.includes('Scriva perché cambia il prezzo'), 'e anche il prezzo di listino');
});

Deno.test('il ristorante puo far preparare al Bistrot, e si sceglie sulla riga', () => {
  /* «deve poter stampare direttamente al bistro, cosi' gli portano le
     bevande dal bistro al ristorante senza dover chiamare
     telefonicamente» (la proprieta', 4 settembre 2026) */
  assert(m.includes('Dove si prepara'), 'la scelta nel pannello della riga');
  assert(m.includes('(MENU.locali || []).length > 1'), 'compare solo se i locali sono piu d uno');
  assert(m.includes("{ id: '', nome: 'Qui' }"), 'e il solito e «qui»');
  assert(m.includes('locale_stampa: dove || null'), 'la scelta resta sulla riga');
  assert(m.includes('locale_stampa: r.locale_stampa, segue_min:'), 'e arriva al server con la riga');
});

Deno.test('sul palmare niente si schiaccia e la tastiera non copre il campo', () => {
  /* le tre foto del Sunmi (la proprieta', 4 settembre 2026): la pianta
     coi tavoli accavallati, la pagina scorsa di lato, il motivo dello
     storno scritto alla cieca sotto la tastiera */
  assert(P.includes('interactive-widget=resizes-content'), 'la tastiera restringe la pagina invece di coprirla');
  assert(P.includes('overflow:auto;overflow-x:hidden;'), 'la pagina non scorre mai di lato');
  assert(P.includes('.cercaRiga input{flex:1;min-width:0;'), 'la casella di ricerca si stringe: era lei a sbordare');
  assert(m.includes("from '/pos/pianta.js'") && m.includes('misuraPianta({ tavoli, larghezza: app.clientWidth - 20'), 'la pianta si misura dai tavoli');
  assert(P.includes('.piantaScorri{overflow:auto;') && m.includes('<div class="piantaScorri"><div class="piantina"'), 'e se sborda scorre dentro di se');
  assert(P.includes('.piantina .campo{position:absolute;inset:34px;}') && m.includes('<div class="campo">'), 'mezzo cerchio di margine: il tavolo al 100% si vede intero');
  assert(P.includes('position:sticky;bottom:0;background:#fff;'), 'i bottoni del pannello restano in vista');
  assert(m.includes("document.addEventListener('focusin'") && m.includes("scrollIntoView({ block: 'center'"), 'il campo che si scrive si porta in vista');
  const sw = Deno.readTextFileSync(new URL('./sw.js', import.meta.url));
  assert(sw.includes("'/pos/pianta.js'") && sw.includes("'pos-v2'"), 'il modulo nuovo sta in cache, e la cache cambia nome');
});

Deno.test('scorrendo in giu fra gli articoli, portata e ricerca si nascondono; la griglia resta dov era', () => {
  /* «menu sopra fallo scomparire se scrollo in giu per lasciare piu spazio
     per vedere le categorie» (la proprieta', 4 settembre 2026) */
  assert(P.includes('.ordine.compatta .portate,.ordine.compatta .cercaRiga,.ordine.compatta .conti{display:none;}'), 'in CSS spariscono');
  assert(m.includes('let compatta = false;') && m.includes('<div class="ordine ${compatta ? \'compatta\' : \'\'}${cercaFocus ? \' ricerca\' : \'\'}">'), 'e lo stato sopravvive al ridisegno');
  assert(m.includes('g.onscroll = () => {') && m.includes('window.innerWidth >= 900 || cerca'), 'solo sul palmare, e non mentre si cerca');
  assert(m.includes('const scorso = g0 ? g0.scrollTop : 0;') && m.includes('g.scrollTop = scorso;'), 'a ogni tocco la griglia non torna in cima');
  assert(m.includes('<span class="eti">Portata</span>'), 'la riga in cima dice cosa e: la portata, non un filtro');
});

Deno.test('tutto il tavolo si sposta su un altro, dalla schermata del tavolo', () => {
  /* «spostare un tavolo intero su un altro» (la proprieta', 4 settembre 2026) */
  assert(m.includes('const pannelloSpostaTavolo = async () =>'), 'il pannello');
  assert(m.includes('id="spostaTavolo"') && m.includes("scrivi('tavolo-sposta', { da: t.id, a: verso.id })"), 'il bottone e l azione');
  assert(m.includes("' · occupato'") && m.includes('unisco i conti lì?'), 'un tavolo occupato si sceglie, ma lo chiede');
  assert(m.includes('x.id !== t.id'), 'non si propone il tavolo stesso');
});

Deno.test('il conto si paga a pezzi: in parti uguali, un importo a scelta, e i contanti dicono il resto', () => {
  /* «dividere il conto fra persone al tavolo», «dare resto» (4-5 settembre 2026) */
  assert(m.includes("scrivi('paga', { conto: conto.id, modo, importo_cent: cifra, ricevuto_cent: ricevuto })"), 'ogni pezzo e un pagamento');
  assert(m.includes('data-parti=') && m.includes("`in ${n}`"), 'in parti uguali');
  assert(m.includes('id="pzAltro"') && m.includes("chiediNumero('Importo da pagare adesso (euro)'"), 'o un importo a scelta');
  assert(m.includes('Contanti ricevuti (dovuti') && m.includes('Resto da dare:'), 'i contanti: quanto ha dato, e il resto');
  assert(m.includes('if (j.chiuso) { via(); return dopoChiuso(); }'), 'quando i pezzi coprono il totale il conto e chiuso: si resta sul tavolo se ha altri conti, se no in sala');
  assert(m.includes("j.pagamenti || []"), 'quanto e gia pagato lo dice il server');
  assert(m.includes('inCamera && !pagato()'), 'in camera va tutto il conto, non un pezzo');
});

Deno.test('happy hour sul palmare: il menu chiede il locale, si rinfresca, e la fascia si vede', () => {
  assert(m.includes("MENU = await chiama('menu', { qs: `&locale=${encodeURIComponent(LOCALE_ID)}` });"), 'il menu sa di che locale e');
  assert(m.includes('MENU_LETTO_IL = Date.now()') && m.includes('10 * 60 * 1000'), 'e si rilegge dopo dieci minuti: la fascia puo essere cambiata');
  assert(m.includes('MENU.fascia ?') && m.includes('fino alle'), 'la fascia in corso si legge in cima');
  assert(m.includes("a.in_fascia ? ' ★' : ''"), 'e i prezzi toccati hanno la stellina');
});

Deno.test('servita dal PC del Bistrot (http://IP:8080/pos) la pagina sa da sola chi e il server locale', () => {
  /* «una cosa che basta che copio e incollo e funziona» (la proprieta', 5
     settembre 2026): niente certificati sui palmari, niente indirizzi da
     scrivere a mano */
  assert(m.includes("const DAL_PC = location.protocol === 'http:'"), 'si riconosce dall indirizzo');
  assert(m.includes('const SERVER_LOCALE = DAL_PC ? location.origin :'), 'e il server locale e l origine della pagina');
  assert(m.includes('if (!crypto.randomUUID) {') && m.includes('crypto.getRandomValues(new Uint8Array(16))'), 'fuori da https randomUUID manca: si rifa');
});

Deno.test('sul palmare: categorie sempre a portata, riepilogo chiuso, in camera anche pagando un esterno, tessera con la fotocamera', () => {
  /* le richieste della proprieta' del 5 settembre 2026 */
  assert(/\.categorie\{[^}]*position:sticky/.test(P), 'il tasto «‹ Categorie» resta in vista');
  assert(P.includes('.comanda.chiusa{max-height:96px;}') && m.includes("comandaAperta ? 'aperta' : 'chiusa'"), 'il riepilogo parte chiuso');
  assert(m.includes("$('totaleRiga').onclick = () => { comandaAperta = !comandaAperta; disegna(); };"), 'e si apre toccando Totale');
  assert(m.includes('id="pzInCamera"') && m.includes('const pannelloCameraConto = (totale) =>'), 'in camera dal pannello del conto');
  assert(m.includes("scrivi('conto-cambia', {") && m.includes('conto = j.conto;') && m.includes('via(); firmaOspite(totale);'), 'il conto cambia tipo e poi firma');
  assert(m.includes("'BarcodeDetector' in window") && m.includes('function scansiona()') && m.includes("facingMode: 'environment'"), 'la fotocamera legge il codice');
  assert(m.includes('window.isSecureContext &&'), 'solo in https: in http Chrome non da la fotocamera');
  assert(m.includes("bottoneFotocamera('pkCodice')") && m.includes("bottoneFotocamera('pcCodice')"), 'in tutti e due i pannelli della tessera');
  assert(m.includes("campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))"), 'e il codice letto entra come dal lettore');
});

Deno.test('all accesso c e un campo solo, il PIN, sempre attivo', () => {
  /* «non riesco a selezionare il PIN per inserirlo» (5 settembre 2026): ora
     il campo e' uno e si scrive subito li' */
  assert(P.includes('.accesso .campo.attivo{'), 'il campo attivo si vede');
  assert(m.includes('<div class="campo attivo" id="vPin">'), 'il PIN e sempre il campo attivo');
  assert(m.includes('Il suo PIN di quattro cifre'), 'e la riga in alto lo dice');
});

Deno.test('le quantita si chiamano 1× 2× 3× 4×, e Safari non colora i bottoni di blu', () => {
  /* «questi campi cosa servono? 1234?» (la proprieta', dall iPhone, 5 set 2026) */
  assert(m.includes("'attivo' : ''}\">${n}×</button>"), 'con la × si capisce che e una quantita');
  assert(P.includes('button{font:inherit;cursor:pointer;color:inherit;}'), 'i bottoni ereditano il colore: niente blu di Safari');
});

Deno.test('tessera o camera: un campo solo, tre cifre sono la camera, di piu e una tessera', () => {
  /* «un unico campo sia per il numero di camera che per il numero di
     tessera... le camere sono solo di tre cifre» (la proprieta', 5 set 2026) */
  assert(m.includes('const CAMERA_CIFRE_MAX = 3;') && m.includes('function leggiTesseraOCamera(velo, idCampo, esito)'), 'la regola sta in un posto solo');
  assert(m.includes('if (cifre.length <= CAMERA_CIFRE_MAX) { stato.camera = cifre;'), 'tre cifre: la camera');
  assert(m.includes("leggiTesseraOCamera(velo, 'pkCodice', esito)") && m.includes("leggiTesseraOCamera(velo, 'pcCodice', esito)"), 'dal tavolo e al momento di pagare');
  assert(!m.includes('id="pkCamera"') && !m.includes('id="pcCamera"'), 'il secondo campo non c e piu');
  assert(m.includes('tessera: s.daTessera ? s.tessera : null'), 'la tessera viaggia solo se letta davvero');
});

Deno.test('i conti del tavolo stanno nella schermata dell ordine: si passa dall uno all altro, e se ne apre uno nuovo da li', () => {
  /* «aprire piu conti dalla stessa schermata senza dover uscire» (la
     proprieta', 5 settembre 2026); le quantita 1× 2× restano quelle */
  assert(m.includes('const BOZZE = new Map();') && m.includes('let ordine = BOZZE.get(conto.id) || creaOrdine();'), 'le righe non inviate restano in memoria per conto');
  assert(m.includes("const salvaBozza = () => { if (daInviare(ordine).length) BOZZE.set(conto.id, ordine); };"), 'e si salvano quando si lascia il conto');
  assert(m.includes('<div class="conti"><span class="eti">Conti</span>') && m.includes('<button data-conto="nuovo">+ Esterno</button><button data-conto="nuovo-camera">+ Camera</button>'), 'la riga dei conti con + Esterno e + Camera');
  assert(m.includes('const contiDelTavolo = () =>') && m.includes("String(a.id).localeCompare(String(b.id))"), 'numerati in un ordine che non balla');
  assert(m.includes("if (id === 'nuovo') {") && m.includes("scrivi('conto', { tavolo: conto.tavolo, tipo: 'esterno', coperti: 1 })"), 'il conto nuovo nasce da qui');
  assert(m.includes("schermataOrdine(j.conto, j.righe, j.fratelli || []);"), 'e si riapre la schermata sul conto scelto');
  assert(m.includes("${n}×</button>"), 'le quantita non sono state toccate');
  assert(P.includes('.ordine.compatta .portate,.ordine.compatta .cercaRiga,.ordine.compatta .conti{display:none;}'), 'scorrendo sparisce con le altre righe in cima');
});

Deno.test('si vede che l articolo e entrato: numero sul riquadro, lampo al tocco; e lo scorrimento non salta', () => {
  /* «come fa a capire che l articolo e andato dentro» e «lo scroll ogni
     tanto ha dei problemi» (la proprieta', 5 settembre 2026) */
  assert(m.includes('const nelConto = new Map(), daMandare = new Map();') && m.includes('<span class="nel ${daMandare.get(a.id) ? \'nuovo\' : \'\'}">'), 'il numero sul riquadro, oro se da inviare');
  assert(m.includes("toccato.classList.add('aggiunto')"), 'il lampo al tocco');
  assert(m.includes('const altezzaCima = () =>') && m.includes('g.scrollTop = Math.max(0, y - h);'), 'quel che era sotto il dito ci resta');
  assert(m.includes('accumulo > 70 && y > 120') && m.includes('accumulo < -40 || y < 30'), 'con isteresi, non a ogni pixel');
  assert(m.includes('y < 0 || y > massimo'), 'il rimbalzo di iOS non conta');
});

Deno.test('tre piadine, una senza formaggio: nel pannello la nota vale per tutte o per alcune, e la riga si divide', () => {
  assert(m.includes("from '/pos/stato.js'") && m.includes('dividi,'), 'dividi() viene dal modulo puro');
  assert(m.includes('<div id="pPer"></div>') && m.includes('La nota vale per'), 'la scelta nel pannello');
  assert(m.includes('const d = dividi(cambia(ordine, id, { quantita: q }), id, perQuante);'), 'la riga si divide');
  assert(m.includes('ordine = cambia(d.ordine, d.nuova, { ...campi, quantita: perQuante });'), 'e la nota va solo alla parte scelta');
  assert(P.includes('-webkit-user-select:none;-webkit-touch-callout:none;'), 'su iPhone il tocco lungo non seleziona il testo');
});

Deno.test('un tavolo gia aperto si apre dritto sulla comanda; il tavolo si riapre toccando il titolo', () => {
  /* «se un tavolo e gia aperto quando clicco sopra entra subito nella
     comanda, non nell anteprima» (la proprieta', 5 settembre 2026) */
  assert(m.includes('if (aperti.length) apriContoPerId(aperti[0].id); else schermataTavolo(t);'), 'aperto → comanda, libero → tavolo');
  assert(m.includes('async function apriContoPerId(id)') && m.includes('async function apriTavoloPerId(id)'), 'le due strade');
  assert(m.includes('function testa(titolo, indietro, sulTitolo = null)') && m.includes("$('titolo').onclick = sulTitolo;"), 'il titolo si tocca');
  assert(m.includes('cop. ▾`, () => { salvaBozza(); schermataSala(); }, () => { salvaBozza(); apriTavoloPerId(conto.tavolo); });'), 'e dalla comanda porta al tavolo, tenendo la bozza');
});

Deno.test('un conto con solo storni si chiude a zero, dal bottone Conto', () => {
  /* «non c e modo di chiuderlo» (la proprieta', 5 settembre 2026) */
  assert(m.includes("(tutte.length || dalServer.some((r) => r.stato === 'stornata')) && !nuove ? '' : 'disabled'"), 'Conto si accende anche con soli storni');
  assert(m.includes('id="pzZero"') && m.includes('Chiudi il conto a zero'), 'il bottone');
  assert(m.includes("const j = await scrivi('conto-elimina', { conto: conto.id });"), 'che passa da conto-elimina: il server chiude a zero e tiene gli storni');
});

Deno.test('un conto vuoto si toglie dalla comanda stessa: il bottone dice «Togli conto»', () => {
  /* «mi restano aperti tavoli a zero senza possibilita di chiuderli» (5 set 2026) */
  assert(m.includes("${!dalServer.length && !ordine.righe.length ? 'Togli conto' : 'Conto'}"), 'il bottone cambia nome');
  assert(m.includes("const soliStorni = dalServer.some((r) => r.stato === 'stornata');") && m.includes("'Togli il conto'"), 'e il pannello distingue vuoto da soli storni');
});

Deno.test('col conto ancora vuoto il riepilogo in fondo non c e: le categorie hanno tutto lo schermo', () => {
  assert(m.includes('const vuoto = !dalServer.length && !ordine.righe.length;'), 'vuoto = niente dal server e niente in bozza');
  assert(m.includes("${vuoto ? '' : `<div class=\"comanda "), 'la comanda si disegna solo se c e qualcosa');
  assert(m.includes("if ($('totaleRiga')) $('totaleRiga').onclick") && m.includes("if ($('comanda')) $('comanda').scrollTop"), 'e il codice non inciampa quando manca');
});

Deno.test('chiuso o tolto un conto, se il tavolo ne ha altri si resta sul tavolo', () => {
  /* «magari devo lavorare sugli altri conti aperti su quel tavolo» (5 set 2026) */
  assert(m.includes('const dopoChiuso = () => {') && m.includes('if (altri.length) apriContoPerId(altri[0].id); else schermataSala();'), 'sul primo degli altri, o in sala');
  assert(m.includes('if (j.chiuso) { via(); return dopoChiuso(); }') && m.includes('via(); dopoChiuso();'), 'dopo il pagamento, la camera e la chiusura a zero');
});

Deno.test('«+ Camera» nella riga dei conti apre un altro conto in camera sullo stesso tavolo', () => {
  /* «se invece e un altra camera?» (la proprieta', 5 settembre 2026) */
  assert(m.includes("if (id === 'nuovo-camera') return pannelloNuovoInCamera();"), 'il bottone passa dal pannello');
  assert(m.includes('const pannelloNuovoInCamera = () =>') && m.includes("leggiTesseraOCamera(velo, 'pnCodice', esito)"), 'tessera o numero di camera, come dal tavolo');
  assert(m.includes("tipo: 'camera', camera: s.camera, tessera: s.daTessera ? s.tessera : null") && m.includes('via(); cambiaConto(j.conto.id);'), 'nasce in camera e si apre subito');
});

Deno.test('gli ordini dal QR restano sul tavolo tutto il giorno: pannello con ristampa, sposta, storna e rimborsa; la coda di stampa avvisa', () => {
  /* spec docs/superpowers/specs/2026-09-05-ordini-qr-design.md */
  assert(m.includes('const pannelloQr = (o) => {') && m.includes("chiama('conto-ristampa', { method: 'POST', body: JSON.stringify({ conto: o.conto }), cloud: true })"), 'ristampa dal cloud');
  assert(m.includes("chiama('conto-sposta', { method: 'POST', body: JSON.stringify({ conto: o.conto, a: b.dataset.verso }), cloud: true })"), 'sposta un conto solo');
  assert(m.includes("chiama('riga-storna-rimborsa', { method: 'POST', body: JSON.stringify({ riga: r.id, motivo }), cloud: true })"), 'storna e rimborsa la riga');
  assert(m.includes('qrBlocco') && m.includes("📱 ${o.modo === 'camera' ? `in camera ${esc(o.camera || '')}` : 'pagato'}"), 'l etichetta sul tavolo');
  assert(m.includes('s.coda_stampa && s.coda_stampa.minuti >= 2') && m.includes('class="codaStampa"'), 'la fascia rossa sopra i due minuti');
});

Deno.test('la sala smette di aggiornarsi quando si esce: il tastierino del PIN non viene coperto da «sessione non valida»', () => {
  /* Il 5 settembre 2026 un palmare acceso da ore mostrava solo la scritta
     rossa «sessione non valida», senza tastierino: dopo i cinque minuti
     senza tocchi esci() disegnava l accesso, ma il ricaricamento della
     sala ogni dieci secondi continuava, chiedeva la sala senza sessione,
     riceveva 401 e scriveva l errore sopra il tastierino. */
  const esci = m.slice(m.indexOf('function esci()'), m.indexOf('/* ---------- testa ---------- */'));
  assert(esci.includes('clearInterval(timerSala)'), 'uscendo si ferma la sala');
  const sala = m.slice(m.indexOf('async function schermataSala()'), m.indexOf('timerSala = setInterval(disegna, 10000);'));
  assert(sala.includes("catch (e) { if (!SESSIONE || SCHERMATA !== 'sala') return;"), 'senza sessione l errore non si scrive: c e gia il tastierino');
  assert(sala.includes('id="salaRiprova"') && sala.includes('Riprova'), 'un errore vero ha un pulsante per riprovare, senza chiudere l app');
});

Deno.test('con la tastiera aperta la ricerca ha tutto lo schermo, e una ✕ la chiude', () => {
  /* «campo ricerca non funziona e la schermata non e' ben visibile» (la
     proprieta', 6 settembre 2026): sul palmare da 5 pollici, con la tastiera
     su, ai risultati non restava una riga */
  assert(P.includes('@media (max-width: 899px){.ordine.ricerca .portate,.ordine.ricerca .conti,.ordine.ricerca .comanda,.ordine.ricerca .totale,.ordine.ricerca .azioni{display:none;}}'), 'col fuoco sulla casella resta solo lei coi risultati, solo sul palmare');
  assert(P.includes('let cercaFocus = false;') && P.includes("c.onfocus = () => { cercaFocus = true;") && P.includes('setTimeout(() => { if (cercaFocus) return;'), 'il fuoco accende il modo, il fuoco perso lo spegne con un attimo di ritardo');
  assert(P.includes('id="cercaVia"') && P.includes("cercaVia.onclick = () => { cerca = ''; cercaFocus = false; disegna(); }"), 'la ✕ svuota e chiude');
});

Deno.test('il palmare vede «pronto in cucina»: bollino verde sul tavolo, riga nel pannello del conto', () => {
  /* Task 6 del piano Monitor cucina (6 settembre 2026): sala (cloud e PC del
     Bistrot) manda pronto_in_cucina e pronto_alle per ogni conto; qui solo
     la lettura, senza toccare ricerca o compatta */
  const stato = m.slice(m.indexOf('const conStato = (t) =>'), m.indexOf('const barra ='));
  assert(stato.includes('pronto_in_cucina'), 'conStato guarda pronto_in_cucina di ogni conto aperto');
  assert(stato.includes('bollinoPronto'), 'il bollino nel nome del tavolo');
  assert(m.includes("c.pronto ? ' pronto' : ''"), 'la classe si aggiunge accanto a stato, non al posto suo');
  assert(m.includes('class="tavoloVoce ${c.stato}${c.pronto') && m.includes('class="tavolo ${c.stato}${c.pronto'), 'in tutte e due le viste, elenco e piantina');
  assert(P.includes('.tavoloVoce.pronto') && P.includes('.tavolo.pronto'), 'la classe pronto in CSS, sulla piantina e sull elenco');
  const pan = m.slice(m.indexOf('const pannelloConto = (c) =>'), m.indexOf('const pannelloSpostaTavolo'));
  assert(pan.includes('Pronto in cucina alle'), 'la riga in cima al pannello del conto');
  assert(pan.includes('c.pronto_in_cucina'), 'solo se il server lo dice');
});

Deno.test('cancella tutto il tavolo con «Sei sicuro?»; il motivo dello storno solo a chi ha la spunta', () => {
  /* (la proprieta', 6 settembre 2026) */
  assert(m.includes('id="cancellaTavolo"') && m.includes('Cancella tutto il tavolo…'), 'il pulsante, sotto «Sposta tutto il tavolo»');
  assert(m.includes('${CAMERIERE && CAMERIERE.cancella_tavolo !== false ? \'<button type="button" class="bottone sec" id="cancellaTavolo"') && m.includes("const puoStorno = puoStornare();"), 'lo vede chi ha la spunta «cancella tavolo», accesa di base (la proprieta, 7 settembre 2026); lo storno della riga resta a chi puo');
  assert(m.includes('confirm(`Sei sicuro?'), 'e chiede prima');
  assert(m.includes("chiama('tavolo-svuota', { method: 'POST'") && !m.includes("scrivi('tavolo-svuota'"), 'mai in coda offline: o passa subito o si riprova');
  assert(m.includes('if (CAMERIERE && CAMERIERE.storno_con_motivo) {') && m.includes('Senza il motivo non si cancella.'), 'il motivo di tutto il tavolo solo con la spunta');
  assert(m.includes('Motivo dello storno (facoltativo)'), 'senza spunta il campo resta, ma facoltativo');
});

Deno.test('portate semplici al Bistrot: «Subito», «Segue 5′/10′/15′», «Segue a chiamata» e «Manda il segue»; il ristorante tiene le portate', () => {
  /* «si puo togliere [le portate] e aggiungere solo il pulsante SEGUE … tre scelte segue in 5 min 10 min 15 min» (la proprieta', 6 settembre 2026) */
  assert(m.includes('const SEMPLICI = () =>') && m.includes('l.portate_semplici'), 'lo dice il locale, dal menu');
  assert(m.includes("minutiSegue(l && l.segue_minuti != null ? l.segue_minuti : '5,10,15')"), 'i minuti dal back office, 5/10/15 se non detto');
  assert(m.includes('<span class="eti">Quando</span>') && m.includes('>Subito</button>') && m.includes('>Segue ${n}′</button>') && m.includes('>Segue a chiamata</button>'), 'le scelte al posto delle portate');
  assert(m.includes("SEMPLICI() ? 'Manda il segue' : prossima ?"), 'il pulsante');
  assert(m.includes('segueMin: SEMPLICI() ? segueScelto : null') && m.includes('segue_min: r.segue_min == null ? null : r.segue_min'), 'la scelta viaggia con la riga');
  assert(m.includes('Segue alle ${oraBreve(r.segue_alle)}'), 'e dopo l invio si legge a che ora parte');
  assert(m.includes("<span class=\"eti\">Portata</span>") && m.includes('Vai coi ${NOMI_PORTATE[prossima].toLowerCase()}'), 'il ristorante come prima');
});

Deno.test('un disegno della sala arrivato in ritardo non copre il tavolo aperto; il Segue vale un tocco; l indirizzo del PC si ripulisce anche in memoria', () => {
  /* «se apro un tavolo la schermata si chiude dopo 5 secondi» (la proprieta', 6 settembre 2026) */
  assert(m.includes("let SCHERMATA = 'accesso';") && m.includes("SCHERMATA = 'sala';") && m.includes("SCHERMATA = 'tavolo';") && m.includes("SCHERMATA = 'ordine';"), 'ogni schermata si firma');
  assert(m.includes("if (SCHERMATA !== 'sala') return;") && m.includes("if (!SESSIONE || SCHERMATA !== 'sala') return;"), 'e la sala disegna solo se e ancora lei');
  assert(m.includes('segueScelto = null;') && m.lastIndexOf('segueScelto = null;') > m.indexOf('segueMin: SEMPLICI() ? segueScelto : null'), 'dopo il tocco si torna a Subito');
  assert(m.includes('const normalizzaServer = (s) =>') && m.includes('normalizzaServer(localStorage.getItem(\'posServerLocale\')'), 'l indirizzo in memoria passa dalla stessa pulizia');
});
