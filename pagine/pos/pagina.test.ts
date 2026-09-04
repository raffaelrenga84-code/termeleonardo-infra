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

Deno.test('si entra col solo codice: il PIN lo chiede il server, e solo a chi ce l ha', () => {
  assert(m.includes('const entra = async'), 'un solo gesto: codice e invio');
  assert(m.includes("/serve il PIN/i.test(e.message)"), 'il PIN si chiede solo se il server lo dice');
  assert(!m.includes("if (campo === 'codice') { if (codice) campo = 'pin'; return disegna(); }"), 'il passaggio al PIN non e piu automatico');
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
  assert(m.includes("chiama('tessera', { qs: `&codice=${encodeURIComponent(codice)}`, cloud: true })"), 'la tessera la legge il cloud');
  assert(m.includes("if (ev.key === 'Enter')"), 'il lettore del palmare scrive e manda invio');
  assert(m.includes("tessera: scritta === camera ? tessera : null"), 'se la camera viene cambiata a mano, la tessera non la certifica piu');
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
  assert(m.includes("lingua: scritta === camera ? lingua : null"), 'la lingua la dice Fidra con la tessera');
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
  assert(m.includes('if (cambiaPrezzo && campi.motivo_prezzo.length < 3)'), 'e allora il motivo e obbligatorio');
  assert(m.includes('motivo_prezzo: r.motivo_prezzo'), 'e viaggia col la riga fino al server');
  assert(m.includes("if (motivo.length < 3)") && m.includes('Scriva il motivo dello storno'), 'lo storno lo pretende');
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
  assert(m.includes('locale_stampa: r.locale_stampa }));'), 'e arriva al server con la riga');
});
