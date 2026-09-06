/* ============================================================
   azioni.test.ts — index.ts non e' importabile (Deno.serve in cima): si
   legge come testo, come fanno le altre funzioni del repository.

   Presidia il contratto (le azioni ci sono), la divisione dei compiti (le
   regole stanno nei moduli puri), i cancelli (sessione del cameriere,
   chiave hotel, chiave del cron) e i divieti (stampanti fiscali mai).
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const S = Deno.readTextFileSync(new URL('./index.ts', import.meta.url));
const senzaCommenti = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

Deno.test('le azioni del contratto esistono', () => {
  for (const a of ['menu', 'sala', 'accesso', 'conto', 'righe', 'invia', 'vai', 'storna', 'chiudi',
    'stampe', 'locale-vivo', 'stampa-cloud', 'allinea-su', 'allinea-giu', 'importa-menu',
    'menu-salva', 'tavoli-salva', 'personale-salva'])
    assert(new RegExp(`azione === '${a}'`).test(S), `manca ?a=${a}`);
});

Deno.test('le regole stanno nei moduli puri, non qui', () => {
  for (const m of ['./portate.ts', './conto.ts', './comanda.ts', './menu.ts', './permessi.ts', './ruoli.ts']) assert(S.includes(`from '${m}'`), m);
  for (const f of ['dividi(', 'prossima(', 'prezzoRiga(', 'testoBiglietto(', 'puo(', 'importa(', 'escpos(']) assert(S.includes(f), f);
});

Deno.test('sessione del cameriere su ogni azione del palmare; chiave hotel per locale ed estensione; cron per la stampa dal cloud', () => {
  assert(S.includes("'x-pos-sessione'") && S.includes("'x-pos-dispositivo'"));
  assert(S.includes("Deno.env.get('HOTEL_KEY')") && S.includes("Deno.env.get('CRON_KEY')"));
  const cloud = S.slice(S.indexOf("azione === 'stampa-cloud'"), S.indexOf("azione === 'allinea-su'"));
  assert(cloud.includes('90') && cloud.includes('Deno.connect'), 'il cloud stampa solo se il locale tace da 90 s');
  assert(!/8989|8990|192\.168\.0\.5[12]/.test(senzaCommenti(S)), 'le stampanti fiscali non compaiono mai');
});

Deno.test('i PIN non si salvano in chiaro; il back office salva menu, tavoli e personale solo con un accesso che il ruolo ammette', () => {
  assert(S.includes("crypto.subtle.digest('SHA-256'"));
  const bo = S.slice(S.indexOf('const azioniBackOffice'));
  /* un upsert e' un insert prima di essere un update: le colonne
     obbligatorie che il back office non manda vanno rimesse nella riga,
     o Postgres si ferma su «null value in column» (4 settembre 2026) */
  assert(bo.includes('riga.pin_hash = e.pin_hash'), 'il PIN vuoto lascia l impronta vecchia');
  assert(bo.includes('riga.token = e.token'), 'un palmare gia registrato tiene il suo codice');
  assert(bo.includes('d.nuovo_token'), 'e il back office puo chiederne uno nuovo');
  /* dal 6 settembre 2026 il cancello per ruolo sta in ruoli.ts
     (puoDalBackOffice): reception e amministrazione tutto, il bistrot
     solo menu', tavoli, fasce e ordini dal QR, la spa niente */
  assert(bo.includes('await autorizzato(req)') && bo.includes('puoDalBackOffice(acc.ruolo, azione)'), 'menu-salva e le altre passano da autorizzato e dal cancello per ruolo');
});

Deno.test('la sala si importa dalla piantina di Fidra: una zona per volta, senza sdoppiare ne cancellare tavoli', () => {
  const b = S.slice(S.indexOf("azione === 'importa-sala'"), S.indexOf('================= dal back office'));
  assert(b.includes('chiaveHotel(req)') && b.includes('leggiSala('), 'chiave hotel e modulo puro');
  assert(b.includes('chiaveNome(t.nome)') && b.includes("from('pos_tavolo').update("), 'un tavolo gia nostro si sposta, non si sdoppia');
  assert(!/delete\(\)/.test(b), 'non si cancella niente: i tavoli in piu si dicono e basta');
  assert(b.includes('in_piu'), 'e si dicono');
});

Deno.test('una riga passa a un altro conto dello stesso tavolo: chi paga cambia, la cucina no', () => {
  const b = S.slice(S.indexOf("azione === 'sposta'"), S.indexOf("/* ---------- gli ordini dal QR, dal palmare"));
  assert(S.includes("'storna', 'sposta', 'chiudi'"), 'lo spostamento e un gesto del cameriere');
  assert(b.includes("verso.tavolo !== da.tavolo"), 'solo fra conti dello stesso tavolo');
  assert(b.includes('b.nuovo') && b.includes("from('pos_conto').insert("), 'e si puo aprire li per li un conto nuovo');
  assert(!b.includes('creaStampe('), 'non si stampa niente: non e un ordine nuovo');
  const conto = S.slice(S.indexOf("azione === 'conto'"), S.indexOf("azione === 'righe'"));
  assert(conto.includes('fratelli'), 'il conto porta con se gli altri conti aperti del tavolo');
});

Deno.test('l invio crea le stampe per stampante e segna le portate partite', () => {
  const invia = S.slice(S.indexOf("azione === 'invia'"), S.indexOf("azione === 'vai'"));
  assert(invia.includes('dividi(') && invia.includes("'partita'") && invia.includes("'inviata'") && invia.includes('creaStampe('));
});

Deno.test('nome del conto, conto vuoto tolto, prezzo e disponibilita: le nuove azioni del palmare', () => {
  assert(S.includes("'conto-cambia', 'conto-elimina'") && S.includes("'articolo-cambia'"), 'sono gesti del cameriere, non del back office');
  assert(S.includes('function titoloConto('), 'come si chiama un conto lo dice una funzione sola');
  assert(S.includes('nome: c.nome ?? null, titolo: titoloConto(c),'), 'la sala manda il nome scritto e come si legge');
  const el = S.slice(S.indexOf("azione === 'conto-elimina'"), S.indexOf("azione === 'articolo-cambia'"));
  assert(el.includes('if (vive.length) return risposta') && el.includes('409'), 'con delle righe vive dentro non si cancella');
  assert(el.includes("from('pos_conto').delete()"), 'vuoto invece se ne va');
  const ar = S.slice(S.indexOf("azione === 'articolo-cambia'"));
  assert(ar.includes("puo(cameriere!, 'menu')"), 'il prezzo lo cambia l amministrazione');
  assert(ar.includes("puo(cameriere!, 'prezzo')"), 'esaurito anche il capo sala');
  assert(ar.includes('p > 100000'), 'un prezzo assurdo non entra');
  assert(S.includes('conti_eliminati'), 'e il PC del Bistrot puo dire quali conti ha tolto');
});

Deno.test('la tessera dice solo la camera, e a Fidra non si scrive niente', () => {
  const t = S.slice(S.indexOf('async function cameraDallaTessera'), S.indexOf('/* Come si chiama un conto'));
  assert(t.includes("Deno.env.get('FIDRA_TOTEM_KEY')") && t.includes('/api/bill-scanner/'), 'la stessa porta del totem in hall');
  assert(!t.includes("method: 'POST'"), 'legge e basta');
  const a = S.slice(S.indexOf("azione === 'tessera'"), S.indexOf("azione === 'conto-cambia'"));
  assert(a.includes('/^[0-9]{4,20}$/'), 'un codice e cifre');
  assert(a.includes('camera: f.camera, lingua: f.lingua'), 'torna la camera, non il conto dell ospite');
  assert(!a.includes('righe') && !a.includes('totale'), 'il conto camera dell ospite non passa dal palmare');
});

Deno.test('chiuso in camera: l addebito entra in coda, e senza camera non si chiude', () => {
  const c = S.slice(S.indexOf("azione === 'chiudi'"), S.indexOf('/* ================= dal server locale'));
  assert(c.includes("modo === 'camera' && !String(c.camera ?? '').trim()") && c.includes('409'), 'senza camera non si addebita');
  assert(c.includes("from('pos_addebito').insert("), 'l addebito entra in coda');
  assert(c.includes("stato: 'da_riportare'"), 'e nasce da riportare');
  assert(c.includes("righe.filter((r) => r.stato !== 'stornata')"), 'le righe stornate non si addebitano');
  assert(c.includes('l\'addebito non e\' entrato in coda') || c.includes('addebito non e'), 'se la coda non accetta, lo dice');
});

Deno.test('la coda degli addebiti la legge e la segna il back office, non il palmare', () => {
  assert(S.includes("'addebiti', 'addebito-segna'"), 'sono azioni del back office');
  assert(!S.includes("'addebiti', 'addebito-segna'] ;"), 'e non del palmare');
  const l = S.slice(S.indexOf("azione === 'addebiti'"), S.indexOf("azione === 'menu-salva'"));
  assert(l.includes("['da_riportare', 'riportato', 'annullato'].includes"), 'tre stati e basta');
  assert(l.includes('riportato_da'), 'si segna chi l ha riportato');
  assert(S.includes("['addebiti', 'giornata', 'tavoli-qr', 'ospite-ordini'].includes(azione) && req.method === 'GET'"), 'la lista si legge in GET, come la giornata');
});

Deno.test('la firma dell ospite sull addebito: un PNG, piccolo, e facoltativa', () => {
  const c = S.slice(S.indexOf("azione === 'chiudi'"), S.indexOf('/* ================= dal server locale'));
  assert(c.includes("firma.startsWith('data:image/png;base64,')") && c.includes('FIRMA_MAX'), 'un PNG e piccolo');
  assert(c.includes('firma: firma || null, firmato_il: firma ? ora : null'), 'si segna quando e stata data');
  assert(!c.includes('if (!firma) return risposta'), 'senza firma il conto si chiude lo stesso: l ospite puo essersi alzato');
  assert(S.includes("lingua: ['it', 'en', 'de', 'fr'].includes(String(b.lingua))"), 'la lingua dell ospite sta sul conto');
});

Deno.test('il motivo lo pretende il server, non solo la pagina', () => {
  /* se stesse solo nella pagina basterebbe un palmare vecchio per saltarlo */
  const s = S.slice(S.indexOf("azione === 'storna'"), S.indexOf("azione === 'sposta'"));
  assert(s.includes('const motivo = motivoPulito(b.motivo)') && s.includes('scriva il motivo dello storno'), 'storno');
  const r = S.slice(S.indexOf("azione === 'righe'"), S.indexOf("azione === 'invia'"));
  assert(r.includes('prezzoCambiato({') && r.includes('scriva il motivo della variazione di prezzo'), 'prezzo di riga');
  assert(r.includes('motivo_prezzo: cambiato ? motivoPrezzo : null'), 'e resta scritto sulla riga');
  const a = S.slice(S.indexOf("azione === 'articolo-cambia'"));
  assert(a.includes("from('pos_prezzo_cambiato').insert(") && a.includes('da_cent: cambio.da'), 'il listino lascia traccia: prima, dopo, chi e perche');
});

Deno.test('un biglietto per ogni coppia locale-stampante, e il cloud stampa dove va stampato', () => {
  const c = S.slice(S.indexOf('async function creaStampe'), S.indexOf('/* ---------- allineamento'));
  assert(c.includes('localeChePrepara({') && c.includes('portareA({'), 'la regola sta nel modulo puro');
  assert(c.includes('const chiave = `${dove}|${stampante}|${r.stampante}`'), 'si raggruppa per locale e stampante (quella decisa dall ora, e quella di partenza per l avviso)');
  assert(c.includes('locale: dove'), 'e il biglietto va in coda al locale che prepara');
  const p = S.slice(S.indexOf("azione === 'stampa-cloud'"), S.indexOf("azione === 'allinea-su'"));
  assert(p.includes("from('pos_locale').select('stampante_cucina, stampante_bar')"), 'la stampante e quella del locale del biglietto');
  assert(p.includes("Deno.env.get(s.stampante === 'bar' ? 'POS_STAMPANTE_BAR'"), 'le variabili restano per il collaudo a un locale solo');
  assert(c.includes("from('pos_postazione')") && c.includes('stato: statoIniziale(') && c.includes('biglietto: b,'), 'il biglietto nasce con lo stato della postazione e porta i dati');
  const giu = S.slice(S.indexOf("azione === 'allinea-giu'"), S.indexOf("azione === 'importa-menu'"));
  assert(/const tabelle = \[[^\]]*'pos_postazione'[^\]]*\]/.test(giu), 'le postazioni scendono al PC, nell elenco tabelle di allinea-giu');
  assert(giu.includes(".in('stato', ['da_stampare', 'a_schermo'])"));
  /* le sessioni viaggiano fra PC e cloud (6 settembre 2026, sera): su, giu' solo al PC */
  const suSlice = S.slice(S.indexOf("azione === 'allinea-su'"), S.indexOf("azione === 'allinea-giu'"));
  assert(suSlice.includes("sessioni: await upsertSeNuovi('pos_sessione'"), 'le sessioni aperte sul PC salgono');
  assert(/const tabelle = \[[^\]]*'pos_sessione'[^\]]*\]/.test(giu) && giu.includes("if (!dalPc) nascoste.push('pos_sessione');"), 'e scendono, ma solo al PC');
});

Deno.test('dove non c e stampante non nasce nessun biglietto', () => {
  /* la cucina del ristorante non ne ha: la riga resta sul conto, ma in
     coda non ci va niente che nessuno stampera' mai */
  const c = S.slice(S.indexOf('async function creaStampe'), S.indexOf('/* ---------- allineamento'));
  assert(c.includes('siStampa({ stampante: stampante as'), 'si controlla prima di creare');
  assert(c.includes('return [];'), 'e quel gruppo non produce biglietti');
  assert(c.includes("select('id, nome, stampante_cucina, stampante_bar, orari_cucina')"), 'le stampanti dei locali arrivano da li, con gli orari della cucina');
  assert(c.includes("from('pos_comanda').insert("), 'la comanda resta scritta lo stesso: cosa e stato mandato si sa');
});

Deno.test('importare gli articoli non rifa il menu gia messo a posto', () => {
  /* il menu e stato sistemato categoria per categoria sulle fotografie del
     POS di Fidra: quelle sono la verita (la proprieta, 4 settembre 2026) */
  const i = S.slice(S.indexOf("azione === 'importa-menu'"), S.indexOf("azione === 'importa-sala'"));
  assert(i.includes('const giaCiSono = new Set(') && i.includes('if (giaCiSono.has(uguale(a.nome))) { saltati++; continue; }'), 'quello che c e gia col suo nome non si tocca');
  assert(i.includes('categoriaVino(a.nome)'), 'i vini vanno nella loro categoria dal nome');
  assert(i.includes("const DA_SISTEMARE = 'Da sistemare'") && i.includes('attivo = false'), 'quello che non si riconosce va da parte, e spento');
  assert(i.includes('attiva: false'), 'e la categoria stessa non compare sul palmare');
  assert(!i.includes('prezzo_cent: a.prezzo_cent, iva: a.iva, fidra_id: a.fidra_id, aggiornato_il'), 'ogni riga nuova porta anche attivo');
});

Deno.test('la cassa di fine giornata si legge dal back office, e i numeri li fa giornata.ts', () => {
  /* «il riepilogo di fine giornata (incassato per cameriere, per
     contanti/carta/camera, articoli piu venduti)» (4 settembre 2026) */
  assert(S.includes("'addebito-segna', 'giornata'"), 'azione del back office');
  assert(S.includes("['addebiti', 'giornata', 'tavoli-qr', 'ospite-ordini'].includes(azione) && req.method === 'GET'"), 'si legge, non si scrive');
  assert(S.includes("import { riepilogo } from './giornata.ts';") && S.includes('giornata: riepilogo({'), 'i numeri li fa il modulo puro');
  assert(S.includes(".eq('stato', 'chiuso').gte('chiuso_il', da).lt('chiuso_il', a)"), 'solo i conti chiusi nella finestra chiesta');
});

Deno.test('tutto il tavolo su un altro: i conti aperti insieme, nello stesso locale', () => {
  assert(S.includes("'tessera', 'tavolo-sposta'"), 'e un gesto del cameriere');
  const t = S.slice(S.indexOf("azione === 'tavolo-sposta'"), S.indexOf("azione === 'chiudi'"));
  assert(t.includes(".eq('tavolo', daId).neq('stato', 'chiuso')"), 'solo i conti aperti, tutti');
  assert(t.includes('localeDi(da) !== localeDi(a)'), 'mai in un altro locale: le stampanti sono altre');
  assert(t.includes("'questo tavolo non ha conti aperti'"), 'un tavolo vuoto non ha niente da spostare');
});

Deno.test('paga: un pezzo per volta, e il conto si chiude da solo quando i pezzi coprono il totale', () => {
  assert(S.includes("'tavolo-sposta', 'tavolo-svuota', 'paga']"), 'e un gesto del cameriere');
  const p = S.slice(S.indexOf("azione === 'paga'"), S.indexOf("azione === 'chiudi'"));
  assert(p.includes("['contanti', 'carta'].includes(String(b.modo))"), 'contanti o carta: la camera non e un pagamento');
  assert(p.includes("r.stato === 'da_inviare'"), 'con righe da inviare non si incassa');
  assert(p.includes('importoValido(importo, daPagare)'), 'mai piu del dovuto');
  assert(p.includes('chiusoCome([...(prima ?? []), pagamento])'), 'misto se contanti e carta');
  assert(p.includes('resto_cent: resto(ricevuto, importo)'), 'il resto dei contanti');
  const c = S.slice(S.indexOf("azione === 'chiudi'"), S.indexOf('/* ================= dal server locale'));
  assert(c.includes("if (manca > 0) await db.from('pos_pagamento').insert("), 'anche chiudi lascia un pagamento');
  assert(S.includes("pagamenti: await upsertSeNuovi('pos_pagamento'"), 'e dal PC del Bistrot salgono con gli altri');
});

Deno.test('i listini a fasce: il menu e le righe usano il prezzo in vigore, il back office le salva', () => {
  assert(S.includes("import { applicaFascia, fasciaAttiva, minutiDi, oraLocale, prezzoInFascia } from './fasce.ts';"), 'il modulo puro');
  const menu = S.slice(S.indexOf("azione === 'menu'"), S.indexOf("azione === 'sala'"));
  assert(menu.includes('applicaFascia({') && menu.includes('fasciaAttiva({'), 'nel menu il prezzo in vigore');
  const righe = S.slice(S.indexOf("azione === 'righe'"), S.indexOf("azione === 'invia'"));
  assert(righe.includes('prezzoInFascia({') && righe.includes('prezzo_listino_cent: listino'), 'sulla riga il listino e quello della fascia');
  assert(S.includes("'giornata', 'fasce-salva'"), 'si salvano dal back office');
  assert(S.includes("['pos_fascia', 'pos_prezzo_fascia'].includes(t)"), 'e scendono al PC del Bistrot per intero');
});

Deno.test('conto-cambia accetta la camera: un conto esterno diventa in camera al momento di pagare', () => {
  const c = S.slice(S.indexOf("azione === 'conto-cambia'"), S.indexOf("azione === 'conto-elimina'"));
  assert(c.includes("if (b.camera !== undefined) {") && c.includes("agg.tipo = 'camera'; agg.camera = camera;"), 'la camera cambia il tipo');
  assert(c.includes("if (!camera) return risposta({ errore: 'serve la camera' }, 400);"), 'ma vuota no');
  assert(c.includes('agg.tessera = b.tessera ? String(b.tessera) : null;') && c.includes("['it', 'en', 'de', 'fr'].includes(String(b.lingua))"), 'con tessera e lingua per la firma');
});

Deno.test('l ordine dal tavolo col QR: menu pubblico firmato, carta via Stripe, camera con tessera che combacia', () => {
  /* la proprieta', 5 settembre 2026 */
  assert(S.includes("import { cameraCombacia, candidatiTessera, dallHotel, ipDi, numeroOrdine, reteNascosta, righeOrdine, tavoloFirmato, firmaTavolo, type RigaOspite } from './ospite.ts';"), 'le regole nel modulo puro');
  assert(S.includes("const azioniOspite = ['ospite-menu', 'ospite-ordine', 'ospite-stato'];"), 'tre azioni pubbliche');
  const o = S.slice(S.indexOf('const azioniOspite'), S.indexOf('/* ================= dal palmare'));
  assert(o.includes("if (!(await tavoloFirmato(t, k, Deno.env.get('HOTEL_KEY'))))"), 'senza la firma del QR niente');
  assert(o.includes('const esito = righeOrdine(b.righe, vendibili);'), 'le righe si ricostruiscono dal listino');
  assert(o.includes('|| !cameraCombacia(camera, f.camera)) {'), 'la camera scritta deve combaciare con la tessera');
  assert(o.includes('dividiParametri(parametriLink({ numero, descrizione:'), 'il link Stripe nasce da parametriLink: a uso singolo, col numero nei metadati');
  assert(o.includes("if (evento.type !== 'checkout.session.completed')") && o.includes("if (o.stato !== 'in_attesa') return risposta({ esito: 'ok', gia: o.stato });"), 'il webhook manda in cucina una volta sola');
  assert(S.includes('async function mandaInCucina(o: Riga)') && S.includes('QR · IN CAMERA') && S.includes('QR · PAGATO ONLINE'), 'il biglietto dice che e un ordine dal QR e come ha pagato');
  assert(S.includes("aperto_da: OSPITI_QR") && S.includes("const OSPITI_QR = 'ospiti-qr';"), 'il cameriere fittizio');
  assert(S.includes("'fasce-salva', 'tavoli-qr', 'ospite-ordini'") && S.includes("azione === 'tavoli-qr'"), 'i QR dei tavoli dal back office');
  assert(S.includes('qr_recenti:'), 'la sala mostra gli ordini dal QR');
});

Deno.test('conto-elimina: con soli storni dentro il conto si chiude a zero, gli storni restano', () => {
  const c = S.slice(S.indexOf("azione === 'conto-elimina'"), S.indexOf("azione === 'articolo-cambia'"));
  assert(c.includes("const vive = righe.filter((r) => r.stato !== 'stornata');"), 'contano solo le righe vive');
  assert(c.includes("update({ stato: 'chiuso', chiuso_come: null, chiuso_da: cameriere!.id"), 'con soli storni si chiude, non si cancella');
  assert(c.includes("return risposta({ esito: 'ok', chiuso: true });"), 'e lo dice');
});

Deno.test('ospite-tavoli: l elenco pubblico dei tavoli con la firma, per chi scrive il tavolo a mano', () => {
  const o = S.slice(S.indexOf("azione === 'ospite-tavoli'"), S.indexOf('const azioniOspite'));
  assert(o.includes('k: await firmaTavolo(String(tv.id), segreto)'), 'ogni tavolo porta la sua firma');
  assert(o.includes(".eq('attivo', true)"), 'solo i tavoli attivi');
});

Deno.test('l ordine dal tavolo solo dalla rete dell hotel, tessera dalle cifre stampate, consegna in camera', () => {
  /* Col QR l'IP non si guarda piu': la firma del tavolo e' la prova di
     esserci stati, e ogni ordine si paga prima di stampare. La Protezione
     IP di iPhone (iCloud Privato) nasconde l'indirizzo dell'hotel e teneva
     fuori gli ospiti veri (la proprieta', 6 settembre 2026). */
  const ospite = S.slice(S.indexOf("const azioniOspite = "), S.indexOf("if (azione === 'ospite-menu')"));
  assert(!ospite.includes('if (!dallHotel(') && !ospite.includes('if (dallHotel('), 'col QR si ordina da qualunque connessione: la rete dell hotel serve solo a esentare dai freni');
  assert(ospite.includes('tavoloFirmato('), 'la firma del tavolo resta la porta');
  assert(S.includes('const candidati = candidatiTessera(b.tessera);') && S.includes('for (const c of candidati.slice(1)) {') && S.includes('if (f.stato !== 404) break;'), 'il codice a barre lo rifa il server, provando ogni lettura delle cifre');
  assert(S.includes("const consegna = String(b.consegna ?? '').trim().slice(0, 10) || null;"), 'la camera di consegna');
  assert(S.includes("`QR · PAGATO ONLINE${o.camera ? ` · CAMERA ${String(o.camera)}` : ''}`"), 'e sul biglietto si legge');
});

Deno.test('il menu per l ospite porta i nomi tradotti, le descrizioni e gli allergeni; le categorie il loro nome tradotto', () => {
  /* spec docs/superpowers/specs/2026-09-05-menu-ospiti-design.md */
  const o = S.slice(S.indexOf("azione === 'ospite-menu'"), S.indexOf("azione === 'ospite-stato'"));
  assert(o.includes("select('id, nome, posizione, colore, sotto, per_ospiti, note_rapide, nomi, orari, stampante').eq('attiva', true)"), 'categorie con nomi');
  assert(o.includes("select('id, categoria, nome, prezzo_cent, portata, esaurito, prezzo_libero, nomi, descrizioni, allergeni, orari, per_ospiti, senza_glutine, vegetariano, vegano, senza_lattosio').eq('attivo', true)"), 'articoli con nomi, descrizioni, allergeni');
});

Deno.test('gli orari del menu: il menu per l ospite dice cosa e ordinabile adesso, e l ordine fuori orario si ferma', () => {
  /* fase 2 della spec 2026-09-05-menu-ospiti-design.md */
  assert(S.includes("import { apertoOra, leggiOrari, restringi, stampanteAdesso } from './orari.ts';"), 'il modulo puro');
  const o = S.slice(S.indexOf("azione === 'ospite-menu'"), S.indexOf("azione === 'ospite-stato'"));
  assert(o.includes('note_rapide, nomi, orari') && o.includes('nomi, descrizioni, allergeni, orari'), 'si leggono gli orari di categorie e articoli');
  assert(o.includes('disponibile: apertoOra(') && o.includes('finestre'), 'ogni categoria e ogni articolo dice se e aperto adesso, con le sue finestre');
  const ord = S.slice(S.indexOf('/* ospite-ordine */'), S.indexOf("azione === 'ospite-stato'") > 0 ? S.indexOf('/* ================= dal palmare') : S.length);
  assert(ord.includes('fuori_orario:'), 'l ordine porta il segno «fuori orario» a righeOrdine');
  assert(S.includes("Deno.env.get('POS_IP_OSPITI') || Deno.env.get('TOTEM_IP')"), 'gli IP ammessi per la rete dell hotel possono essere piu di uno');
});

Deno.test('a cucina chiusa (pos_locale.orari_cucina) il biglietto della cucina esce al bancone, con l avviso', () => {
  /* la proprieta', 5 settembre 2026 */
  const c = S.slice(S.indexOf('async function creaStampe('), S.indexOf('async function creaStampe(') + 4000);
  assert(c.includes("select('id, nome, stampante_cucina, stampante_bar, orari_cucina')"), 'si leggono gli orari della cucina del locale');
  assert(c.includes('const stampante = stampanteAdesso(r.stampante, (locali ?? []).find((l) => l.id === dove)?.orari_cucina, adessoOra);'), 'la stampante la decide l ora');
  assert(c.includes("avviso: [avviso, stampante !== originale ? 'cucina chiusa: al bancone' : null].filter(Boolean).join(' · ') || null,"), 'il biglietto lo dice, insieme a un eventuale altro avviso (ristampa)');
});

Deno.test('«ospiti (QR)» sul singolo articolo: il palmare vede tutto, l ospite solo cio che il Bistrot ha davvero', () => {
  /* la proprieta', 5 settembre 2026: l acqua del Bistrot e solo la Tavina da mezzo litro */
  const o = S.slice(S.indexOf("azione === 'ospite-menu'"), S.indexOf("azione === 'ospite-stato'"));
  assert(o.includes("nomi, descrizioni, allergeni, orari, per_ospiti, senza_glutine, vegetariano, vegano, senza_lattosio').eq('attivo', true)"), 'si legge la spunta');
  assert(o.includes('&& !a.prezzo_libero && !a.esaurito && a.per_ospiti !== false)'), 'nel menu dell ospite non compare');
  const ord = S.slice(S.indexOf('/* ospite-ordine */'), S.indexOf('/* ================= dal palmare'));
  assert(ord.includes("prezzo_libero, attivo, per_ospiti, orari, cat:pos_categoria(") && ord.includes('c.per_ospiti !== false && a.per_ospiti !== false;'), 'e non si ordina nemmeno a mano');
});

Deno.test('una categoria e aperta se almeno un suo articolo lo e: le insalatone con la «X» tengono aperta «Insalate» fino alle 17:20', () => {
  const o = S.slice(S.indexOf("azione === 'ospite-menu'"), S.indexOf("azione === 'ospite-stato'"));
  assert(o.includes('disponibile: suoi.length ? suoi.some((a) => a.disponibile) : apertoOra(finestre, adessoOra)'), 'la categoria guarda i suoi articoli');
  assert(o.indexOf('const articoliOspite') < o.indexOf('const categorieOspite'), 'prima gli articoli, poi le categorie');
});

Deno.test('gli ordini dal QR dal back office: elenco, rimborso, annullo dell addebito, ristampa, nota', () => {
  /* spec docs/superpowers/specs/2026-09-05-ordini-qr-design.md */
  assert(S.includes("import { corpoRimborsoStripe, importoRiga, importoRimborso, type OrdineRimborsabile, residuoRimborso, statoDopoRimborso } from './rimborsi.ts';"), 'le regole pure');
  assert(S.includes("'ospite-ordini', 'ospite-rimborsa', 'ospite-annulla-addebito', 'ospite-ristampa', 'ospite-nota'"), 'nel gruppo del back office');
  assert(S.includes("['addebiti', 'giornata', 'tavoli-qr', 'ospite-ordini'].includes(azione) && req.method === 'GET'"), 'l elenco si legge');
  const r = S.slice(S.indexOf("azione === 'ospite-rimborsa'"), S.indexOf("azione === 'ospite-annulla-addebito'"));
  assert(r.includes('const esito = importoRimborso(o as OrdineRimborsabile, b.importo_cent);') && r.includes("stripe(chiave, '/refunds', corpoRimborsoStripe("), 'con la carta si chiede a Stripe');
  assert(r.includes("if (ad.stato === 'riportato') return risposta({ errore: 'l addebito e gia riportato in Fidra: si corregge la' }, 409);"), 'in camera si toglie dall addebito, se non e gia in Fidra');
  assert(S.includes('async function ristampaConto(contoId: string, chi: string): Promise<number>') && S.includes('cameriere: string, avviso: string | null = null)'), 'la ristampa con l avviso in cima');
  assert(S.includes('rimborsi_qr_cent'), 'la giornata li mostra');
});

Deno.test('il palmare: gli ordini dal QR di oggi sul tavolo, la coda di stampa, ristampa, sposta, storna e rimborsa', () => {
  const s = S.slice(S.indexOf("azione === 'sala'"), S.indexOf("azione === 'conto')"));
  assert(s.includes('const { data: qrOggi } = idTavoli.length') && s.includes('qr: qrPronti.filter((o) => o.tavolo === t.id)'), 'gli ordini dal QR di oggi, tavolo per tavolo');
  assert(s.includes('coda_stampa: { n: (coda ?? []).length, minuti:'), 'la coda di stampa del locale');
  assert(S.includes("'conto-ristampa', 'conto-sposta', 'riga-storna-rimborsa'"), 'nel gruppo del palmare');
  const st = S.slice(S.indexOf("azione === 'riga-storna-rimborsa'"), S.indexOf("azione === 'conto-sposta'"));
  assert(st.includes("if (!puo(cameriere!, 'storno')) return risposta({ errore: 'storno non permesso' }, 403);"), 'solo chi puo stornare');
  assert(st.includes('const cent = importoRiga({ quantita: Number(r.quantita), prezzo_cent: Number(r.prezzo_cent) });'), 'torna l importo della riga');
});

Deno.test('l elenco dei tavoli si apre da ovunque, ma chi non e sulla rete dell hotel ha un tetto', () => {
  /* «Puoi fare entrambe? Con qr e senza?» (la proprieta', 6 settembre
     2026): la scelta a mano vale da qualunque connessione, perche' un
     ordine si paga comunque prima di stampare. Resta un freno contro chi
     si porta via le firme a raffica — e non tocca la rete dell'hotel, da
     dove escono tutti gli ospiti insieme. */
  const t = S.slice(S.indexOf("if (azione === 'ospite-tavoli')"), S.indexOf("const azioniOspite = "));
  assert(t.includes("dallHotel(req.headers, Deno.env.get('POS_IP_OSPITI') || Deno.env.get('TOTEM_IP'))") && t.includes('frenoTavoli.entroIlLimite('), 'il freno solo fuori dalla rete');
  assert(t.includes('429'), 'chi supera il tetto legge un rifiuto chiaro, non un guasto');
  assert(!/return risposta\(\{ errore: `per scegliere il tavolo a mano/.test(t), 'niente piu porta chiusa per l elenco');
  assert(S.includes("import { creaFreno } from './freno.ts';"), 'il freno vive nel suo modulo, provato a parte');
});

Deno.test('il monitor cucina: due azioni con la chiave dello schermo, il ripiego nel cron, pronto in sala', () => {
  assert(S.includes("'x-schermo-chiave'"), 'l intestazione dello schermo e in CORS');
  for (const a of ['schermo', 'schermo-stato', 'postazioni-salva']) assert(new RegExp(`azione === '${a}'`).test(S), `manca ?a=${a}`);
  const sc = S.slice(S.indexOf("azione === 'schermo'"), S.indexOf("azione === 'schermo-stato'"));
  assert(sc.includes('schermo non riconosciuto') && sc.includes('vista_il') && sc.includes('inizioGiornata('), 'lo schermo legge solo la sua postazione, di oggi, e segna cosa ha mostrato');
  const pds = S.slice(S.indexOf('async function postazioneDelloSchermo'), S.indexOf('const oraRoma'));
  assert(pds.includes("eq('chiave_hash', await impronta(chiave))") && pds.includes('if (locale && stampante) q = q'), 'sulla TV basta il codice: la postazione si riconosce dalla chiave (6 settembre 2026)');
  const st = S.slice(S.indexOf("azione === 'schermo-stato'"), S.indexOf("azione === 'postazioni-salva'"));
  assert(st.includes("di un'altra postazione") && st.includes('passo('), 'i passi passano dal modulo puro');
  const cloud = S.slice(S.indexOf("azione === 'stampa-cloud'"), S.indexOf("azione === 'allinea-su'"));
  assert(cloud.includes('daRipiegare('), 'il cloud ripiega sulla carta per i locali che tacciono');
  const sala = S.slice(S.indexOf("azione === 'sala'"), S.indexOf("azione === 'conto'"));
  assert(sala.includes('prontoInCucina(') && sala.includes('pronto_in_cucina'), 'la sala dice cosa e pronto');
  assert(S.includes("'postazioni-salva'") && S.includes('chiaveCasuale()') && S.includes('impronta('), 'le postazioni si salvano dal back office con la chiave nuova');
  /* fix round 1 (6 settembre 2026) */
  const ps = S.slice(S.indexOf("azione === 'postazioni-salva'"), S.indexOf("azione === 'personale-salva'"));
  assert(ps.includes('locale sconosciuto'), 'un locale che non esiste si ferma sulla porta');
  assert(ps.indexOf('locale sconosciuto') < ps.indexOf('.upsert('), 'e si ferma PRIMA di scrivere: a meta giro una chiave gia data sarebbe persa');
  const daGiu = S.indexOf("azione === 'allinea-giu'");
  const ag = S.slice(daGiu, S.indexOf("azione === 'in-casa'", daGiu));
  assert(ag.includes('chiave_hash: _nonServe'), 'l impronta della chiave dello schermo scende solo al PC, non al back office');
});

Deno.test('si entra col solo PIN di quattro cifre: il PIN e la persona, e non puo essere di due', () => {
  /* «falli identificare solo con un PIN di 4 cifre» (la proprieta', 6 settembre 2026) */
  const a = S.slice(S.indexOf("azione === 'accesso'"), S.indexOf('const cameriere = await cameriereDi(req);'));
  assert(a.includes("if (!/^\\d{4}$/.test(pin)) return risposta({ errore: 'serve il PIN di quattro cifre' }, 400);"), 'quattro cifre');
  assert(a.includes('PIN non riconosciuto') && a.includes('PIN uguale per due persone'), 'si prova ogni cameriere, uno solo deve combaciare');
  assert(a.includes("sbagliato('codice non riconosciuto')"), 'la strada col codice resta per la pagina vecchia');
  const p = S.slice(S.indexOf("azione === 'personale-salva'"), S.indexOf("for (const d of dispositivi)"));
  assert(p.includes("PIN gia' usato da") && p.includes("il PIN e' di quattro cifre"), 'il back office non lascia dare due volte lo stesso PIN');
});

Deno.test('cancellare tutto il tavolo: uno storno di tutto, col biglietto per quello gia partito; il motivo solo a chi ha la spunta', () => {
  /* «un pulsante per cancellare tutto un tavolo … bisogna chiedere sei sicuro?» e «decidere che cameriere
     deve darmi motivazione e quale non serve» (la proprieta', 6 settembre 2026) */
  const s = S.slice(S.indexOf("azione === 'tavolo-svuota'"), S.indexOf("azione === 'tavolo-sposta'"));
  assert(s.includes("puo(cameriere!, 'tavolo')"), 'lo fa chi ha la spunta «cancella tavolo», accesa di base (la proprieta, 7 settembre 2026)');
  assert(S.includes('cancella_tavolo: c.cancella_tavolo !== false'), 'la spunta si salva e arriva al palmare');
  assert(s.includes('cameriere!.storno_con_motivo') && s.includes("'tavolo cancellato'"), 'il motivo solo a chi lo deve dare; la traccia dice che era tutto il tavolo');
  assert(s.includes("'storno', cameriere!.nome") && s.includes("r.stato === 'partita'"), 'in cucina esce lo STORNO di quello che era partito');
  assert(s.includes("stato: 'chiuso', chiuso_come: null") && s.includes(".delete().eq('id', c.id)"), 'i conti si chiudono a zero, quelli vuoti spariscono');
  const st = S.slice(S.indexOf("azione === 'storna'"), S.indexOf("azione === 'sposta'"));
  assert(st.includes('!motivo && cameriere!.storno_con_motivo'), 'lo storno di una riga: idem');
  assert(S.includes('storni, bloccato, storno_con_motivo, cancella_tavolo)'), 'la sessione porta le spunte');
  assert(S.includes('storno_con_motivo: !!c.storno_con_motivo'), 'il back office la salva, l accesso la manda al palmare');
  assert(/const azioniPalmare = \[[^\n]*'tavolo-svuota'/.test(S), 'e un gesto del cameriere: serve la sessione');
});

Deno.test('portate semplici al Bistrot: tutto insieme, il segue a tempo o a chiamata, e il cloud lo fa partire solo se il PC tace', () => {
  /* «il bistro non e un vero ristorante … solo il pulsante SEGUE … segue in 5 min 10 min 15 min» (la proprieta', 6 settembre 2026) */
  const inv = S.slice(S.indexOf("azione === 'invia'"), S.indexOf("azione === 'vai'"));
  assert(inv.includes('loc?.portate_semplici') && inv.includes('dividiSemplice(righe)'), 'l invio guarda il locale del tavolo');
  assert(inv.includes("creaStampe(c, subito, 'tutto', 'comanda'") && inv.includes('quandoSegue(ora, minutiSegueValido(r.segue_min))'), 'un biglietto solo, e il segue ha l ora');
  const vai = S.slice(S.indexOf("azione === 'vai'"), S.indexOf("azione === 'storna'"));
  assert(vai.includes('gruppoSegue(righe)') && vai.includes("creaStampe(c, rr, 'segue', 'vai'"), '«Manda il segue»');
  const righe = S.slice(S.indexOf("azione === 'righe'"), S.indexOf("azione === 'invia'"));
  assert(righe.includes('segue_min: minutiSegueValido(r.segue_min), segue_alle: null'), 'la riga porta il segue');
  const cloud = S.slice(S.indexOf("azione === 'stampa-cloud'"), S.indexOf("azione === 'allinea-su'"));
  assert(cloud.includes('await mandaSegueScaduti(conPc)') && cloud.includes("from('pos_sessione').delete().lt('scade_il'"), 'ogni minuto, dal cron della carta; e le sessioni morte se ne vanno');
  const m = S.slice(S.indexOf('async function mandaSegueScaduti'), S.indexOf('/* La comanda di nuovo'));
  assert(m.includes('conPc.has(loc.id as string)) continue') && m.includes("'segue', 'vai', 'a tempo'"), 'solo per i locali senza PC, firmato «a tempo»');
  assert(S.includes("select('id, nome, portate_semplici, segue_minuti')"), 'il palmare sa se il suo locale e semplice e quali minuti offrire');
});

Deno.test('la bacheca all ingresso: pubblica, il giorno di Roma, i testi scritti a mano e il calice del giorno; il back office la salva', () => {
  /* «una sezione a parte … per tutti i giorni della settimana … random dai vini a calice» (la proprieta', 6 settembre 2026) */
  const i = S.indexOf("azione === 'bacheca'");
  assert(i > 0 && i < S.indexOf("azione === 'ospite-tavoli'"), 'sta prima di ogni porta');
  const b = S.slice(i, S.indexOf("azione === 'ospite-tavoli'"));
  assert(b.includes('giornoRoma(new Date())') && b.includes(".eq('giorno', oggi.giorno)"), 'il giorno e quello di Roma');
  assert(b.includes('scegliCalice(candidatiCalice(') && b.includes('`${oggi.data}|${locale}`') && b.includes('nomeCalice('), 'il calice: a caso fra i vini al calice, lo stesso tutto il giorno');
  assert(b.includes('a_mano: true'), 'quello scritto a mano vince');
  assert(!b.includes('cameriere') && !b.includes('autorizzato('), 'nessuna porta');
  const s = S.slice(S.indexOf("azione === 'bacheca-salva'"), S.indexOf("azione === 'pacchetto'"));
  assert(s.includes("puoDalBackOffice(acc.ruolo, 'bacheca-salva')") && s.includes("onConflict: 'locale,giorno'") && s.includes('testoBacheca('), 'la salva il back office, anche il bistrot');
  assert(S.includes("'pos_postazione', 'pos_sessione', 'pos_bacheca']"), 'e scende col resto, al PC e al back office');
});

Deno.test('il pacchetto per il PC del Bistrot: con la chiave hotel, una versione sola per volta, un file per chiamata', () => {
  /* «aggiornamento automatico del PC per non ricopiare la cartella a ogni modifica» (la proprieta', 6 settembre 2026) */
  const p = S.slice(S.indexOf("azione === 'pacchetto'"), S.indexOf("azione === 'allinea-su'"));
  assert((p.match(/chiaveHotel\(req\)/g) ?? []).length === 2, 'tutte e due le azioni chiedono la chiave hotel');
  assert(p.includes('if (versioni.size !== 1) return risposta({ versione: null, file: [] });'), 'a meta pubblicazione il PC aspetta');
  assert(p.includes("azione === 'pacchetto-file'") && p.includes(".eq('percorso', percorso).maybeSingle()"), 'un file per chiamata');
  assert(!p.includes('contenuto') || p.indexOf('contenuto') > p.indexOf("azione === 'pacchetto-file'"), 'il manifesto non porta i contenuti');
});

Deno.test('revisione del 6 settembre 2026: tessera e camera non si indovinano da fuori, Fidra ha un tetto, i PIN non escono, le sessioni scadute non scendono', () => {
  const ord = S.slice(S.indexOf('/* ospite-ordine */'), S.indexOf('/* ================= dal palmare'));
  assert(ord.includes('frenoTessera.pieno(candidati[0])') && ord.includes('frenoCameraIp.pieno(ip)'), 'gli errori si contano per tessera e per indirizzo');
  assert(!ord.includes("'tessera non riconosciuta'") && !ord.includes("'il numero di camera non corrisponde alla tessera'"), 'niente oracolo');
  assert(ord.includes("'tessera o numero di camera non corretti: li controlli tutti e due, o chiami il cameriere'"), 'una risposta sola per tutti e due gli errori');
  assert((ord.match(/frenoFidra\.entroIlLimite\('fidra'\)/g) ?? []).length === 2, 'ogni lettura di Fidra passa dal tetto');
  assert(ord.includes('frenoCarta.entroIlLimite('), 'e la carta ha il suo freno');
  const giu = S.slice(S.indexOf("azione === 'allinea-giu'"), S.indexOf("azione === 'allinea-giu'") + 8000);
  assert(giu.includes('pin_hash: _mai') && giu.includes(".gt('scade_il', adesso())"), 'niente impronte al browser, niente sessioni morte');
  const acc = S.slice(S.indexOf("azione === 'accesso'"), S.indexOf("azione === 'accesso'") + 4000);
  assert(acc.includes('frenoAccesso.pieno(chiaveDisp)') && (acc.match(/sbagliato\(/g) ?? []).length >= 3, 'cinque PIN sbagliati e si aspetta');
  const ps = S.slice(S.indexOf("azione === 'personale-salva'"));
  assert(ps.includes('cambiando il codice va rimesso anche il PIN') && !ps.includes('senza_pin: !!c.senza_pin'), 'il codice nuovo vuole il PIN nuovo; niente piu «senza PIN»');
  assert(S.includes("tessera: ruoloBackOffice === 'bistrot' ? null : tessera"), 'il bistrot non legge le tessere');
  assert(!S.includes("azione === 'eco-ip'"), 'la sonda e stata tolta');
  const tav = S.slice(S.indexOf("azione === 'ospite-tavoli'"), S.indexOf("const azioniOspite = "));
  assert(tav.includes('const passaTavoli = frenoTavoli.entroIlLimite('), 'il freno dei tavoli conta sempre');
});
