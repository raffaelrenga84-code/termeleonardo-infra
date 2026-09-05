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

Deno.test('i PIN non si salvano in chiaro; il back office salva menu, tavoli e personale solo con accesso da amministrazione', () => {
  assert(S.includes("crypto.subtle.digest('SHA-256'"));
  const bo = S.slice(S.indexOf('const azioniBackOffice'));
  /* un upsert e' un insert prima di essere un update: le colonne
     obbligatorie che il back office non manda vanno rimesse nella riga,
     o Postgres si ferma su «null value in column» (4 settembre 2026) */
  assert(bo.includes('riga.pin_hash = e.pin_hash'), 'il PIN vuoto lascia l impronta vecchia');
  assert(bo.includes('riga.token = e.token'), 'un palmare gia registrato tiene il suo codice');
  assert(bo.includes('d.nuovo_token'), 'e il back office puo chiederne uno nuovo');
  assert(bo.includes('await autorizzato(req)') && bo.includes("'amministrazione'"), 'menu-salva e le altre passano da autorizzato');
});

Deno.test('la sala si importa dalla piantina di Fidra: una zona per volta, senza sdoppiare ne cancellare tavoli', () => {
  const b = S.slice(S.indexOf("azione === 'importa-sala'"), S.indexOf('================= dal back office'));
  assert(b.includes('chiaveHotel(req)') && b.includes('leggiSala('), 'chiave hotel e modulo puro');
  assert(b.includes('chiaveNome(t.nome)') && b.includes("from('pos_tavolo').update("), 'un tavolo gia nostro si sposta, non si sdoppia');
  assert(!/delete\(\)/.test(b), 'non si cancella niente: i tavoli in piu si dicono e basta');
  assert(b.includes('in_piu'), 'e si dicono');
});

Deno.test('una riga passa a un altro conto dello stesso tavolo: chi paga cambia, la cucina no', () => {
  const b = S.slice(S.indexOf("azione === 'sposta'"), S.indexOf("azione === 'chiudi'"));
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
  assert(el.includes('if (righe.length) return risposta') && el.includes('409'), 'con delle righe dentro non si cancella');
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
  assert(S.includes("['addebiti', 'giornata', 'tavoli-qr'].includes(azione) && req.method === 'GET'"), 'la lista si legge in GET, come la giornata');
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
  assert(c.includes('const chiave = `${dove}|${r.stampante}`'), 'si raggruppa per locale e stampante');
  assert(c.includes('locale: dove'), 'e il biglietto va in coda al locale che prepara');
  const p = S.slice(S.indexOf("azione === 'stampa-cloud'"), S.indexOf("azione === 'allinea-su'"));
  assert(p.includes("from('pos_locale').select('stampante_cucina, stampante_bar')"), 'la stampante e quella del locale del biglietto');
  assert(p.includes("Deno.env.get(s.stampante === 'bar' ? 'POS_STAMPANTE_BAR'"), 'le variabili restano per il collaudo a un locale solo');
});

Deno.test('dove non c e stampante non nasce nessun biglietto', () => {
  /* la cucina del ristorante non ne ha: la riga resta sul conto, ma in
     coda non ci va niente che nessuno stampera' mai */
  const c = S.slice(S.indexOf('async function creaStampe'), S.indexOf('/* ---------- allineamento'));
  assert(c.includes('siStampa({ stampante: stampante as'), 'si controlla prima di creare');
  assert(c.includes('return [];'), 'e quel gruppo non produce biglietti');
  assert(c.includes("select('id, nome, stampante_cucina, stampante_bar')"), 'le stampanti dei locali arrivano da li');
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
  assert(S.includes("['addebiti', 'giornata', 'tavoli-qr'].includes(azione) && req.method === 'GET'"), 'si legge, non si scrive');
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
  assert(S.includes("'tavolo-sposta', 'paga']"), 'e un gesto del cameriere');
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
  assert(S.includes("import { cameraCombacia, numeroOrdine, righeOrdine, tavoloFirmato, firmaTavolo, type RigaOspite } from './ospite.ts';"), 'le regole nel modulo puro');
  assert(S.includes("const azioniOspite = ['ospite-menu', 'ospite-ordine', 'ospite-stato'];"), 'tre azioni pubbliche');
  const o = S.slice(S.indexOf('const azioniOspite'), S.indexOf('/* ================= dal palmare'));
  assert(o.includes("if (!(await tavoloFirmato(t, k, Deno.env.get('HOTEL_KEY'))))"), 'senza la firma del QR niente');
  assert(o.includes('const esito = righeOrdine(b.righe, vendibili);'), 'le righe si ricostruiscono dal listino');
  assert(o.includes('if (!cameraCombacia(camera, f.camera)) return risposta'), 'la camera scritta deve combaciare con la tessera');
  assert(o.includes('dividiParametri(parametriLink({ numero, descrizione:'), 'il link Stripe nasce da parametriLink: a uso singolo, col numero nei metadati');
  assert(o.includes("if (evento.type !== 'checkout.session.completed')") && o.includes("if (o.stato !== 'in_attesa') return risposta({ esito: 'ok', gia: o.stato });"), 'il webhook manda in cucina una volta sola');
  assert(S.includes('async function mandaInCucina(o: Riga)') && S.includes("const chi = inCamera ? `QR · IN CAMERA ${String(conto.camera ?? '')}` : 'QR · PAGATO ONLINE';"), 'il biglietto dice che e un ordine dal QR e come ha pagato');
  assert(S.includes("aperto_da: OSPITI_QR") && S.includes("const OSPITI_QR = 'ospiti-qr';"), 'il cameriere fittizio');
  assert(S.includes("'fasce-salva', 'tavoli-qr']") && S.includes("azione === 'tavoli-qr'"), 'i QR dei tavoli dal back office');
  assert(S.includes('qr_recenti:'), 'la sala mostra gli ordini dal QR');
});
