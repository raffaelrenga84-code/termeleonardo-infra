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
