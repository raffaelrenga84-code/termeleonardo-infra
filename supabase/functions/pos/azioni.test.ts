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
  assert(S.includes("azione === 'addebiti' && req.method === 'GET'"), 'la lista si legge in GET');
});
