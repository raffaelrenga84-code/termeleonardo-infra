/* ============================================================
   azioni.test.ts - le azioni del palmare servite dal PC del Bistrot.

   Stesso contratto del cloud (supabase/functions/pos/index.ts), stesse
   regole (i moduli puri importati da li'): il palmare non sa con chi parla.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { apri, creaSchema } from './db.ts';
import { esegui, type Richiesta } from './azioni.ts';
import { impronta } from '../supabase/functions/pos/schermo.ts';

const cfg = { locale: 'L1' };

function base() {
  const db = apri(':memory:'); creaSchema(db);
  db.exec(`insert into pos_locale (id, nome, stampante_cucina, stampante_bar, aggiornato_il) values ('L1', 'Bistrot', '10.0.0.1:9100', '10.0.0.2:9100', '2026-09-04T10:00:00Z');
    insert into pos_zona (id, locale, nome, aggiornato_il) values ('Z1', 'L1', 'Interno', '2026-09-04T10:00:00Z');
    insert into pos_tavolo (id, zona, nome, aggiornato_il) values ('T7', 'Z1', 'Tavolo 7', '2026-09-04T10:00:00Z');
    insert into pos_categoria (id, nome, stampante, portata, aggiornato_il) values ('C1', 'Primi', 'cucina', 'primi', '2026-09-04T10:00:00Z'), ('C2', 'Birre', 'bar', 'bevande', '2026-09-04T10:00:00Z');
    insert into pos_articolo (id, categoria, nome, prezzo_cent, aggiornato_il) values ('A1', 'C1', 'Tagliatelle', 1400, '2026-09-04T10:00:00Z'), ('A2', 'C2', 'Birra', 500, '2026-09-04T10:00:00Z');
    insert into pos_cameriere (id, nome, codice, pin_hash, ruolo, aggiornato_il) values ('K1', 'Anna', '11', 'x', 'cameriere', '2026-09-04T10:00:00Z');
    insert into pos_dispositivo (id, nome, token, aggiornato_il) values ('D1', 'Sunmi 1', 'tok', '2026-09-04T10:00:00Z');
    insert into pos_sessione (id, cameriere, dispositivo, scade_il, aggiornato_il) values ('S1', 'K1', 'D1', '2099-01-01T00:00:00Z', '2026-09-04T10:00:00Z');`);
  return db;
}
const req = (metodo: string, corpo: unknown = null, query: Record<string, string> = {}): Richiesta =>
  ({ metodo, query, corpo, intestazioni: { 'x-pos-dispositivo': 'tok', 'x-pos-sessione': 'S1' } });

Deno.test('conto, righe, invia: parte la prima portata e le bevande, la stampa e in coda per la sua stampante', async () => {
  const db = base();
  const c = await esegui(db, 'conto', req('POST', { tavolo: 'T7', tipo: 'esterno', coperti: 2 }), cfg);
  assertEquals(c.stato, 200);
  const conto = (c.corpo as { conto: { id: string } }).conto.id;
  const r = await esegui(db, 'righe', req('POST', { conto, righe: [
    { id: 'r1', articolo: 'A1', quantita: 1, portata: 'primi' },
    { id: 'r2', articolo: 'A2', quantita: 2, portata: 'bevande' },
    { id: 'r3', articolo: 'A1', quantita: 1, portata: 'secondi' }] }), cfg);
  assertEquals(r.stato, 200);
  const inv = await esegui(db, 'invia', req('POST', { conto }), cfg);
  assertEquals(inv.corpo, { partite: ['bevande', 'primi'], attesa: ['secondi'] });
  const stampe = db.prepare('select stampante, stato, allineato from pos_stampa order by stampante').all() as { stampante: string; stato: string; allineato: number }[];
  assertEquals(stampe, [{ stampante: 'bar', stato: 'da_stampare', allineato: 0 }, { stampante: 'cucina', stato: 'da_stampare', allineato: 0 }]);
  const vai = await esegui(db, 'vai', req('POST', { conto, portata: 'secondi' }), cfg);
  assertEquals((vai.corpo as { partita: string }).partita, 'secondi');
  const letto = await esegui(db, 'conto', req('GET', null, { id: conto }), cfg);
  assertEquals((letto.corpo as { righe: { stato: string }[] }).righe.map((x) => x.stato), ['partita', 'partita', 'partita']);
});

Deno.test('con una postazione a schermo il biglietto nasce a_schermo e porta i dati', async () => {
  const db = base();
  db.exec(`insert into pos_postazione (locale, stampante, nome, schermo, stampa_sempre, ripiego_s) values ('L1', 'bar', 'Banco', 1, 0, 30)`);
  const c = await esegui(db, 'conto', req('POST', { tavolo: 'T7', tipo: 'esterno', coperti: 2 }), cfg);
  const conto = (c.corpo as { conto: { id: string } }).conto.id;
  await esegui(db, 'righe', req('POST', { conto, righe: [{ id: 'r1', articolo: 'A2', quantita: 2, portata: 'bevande' }] }), cfg);
  await esegui(db, 'invia', req('POST', { conto }), cfg);
  const stampa = db.prepare('select stampante, stato, biglietto, conto from pos_stampa where stampante = ?').get('bar') as { stampante: string; stato: string; biglietto: string; conto: string };
  assertEquals(stampa.stato, 'a_schermo');
  assertEquals(stampa.conto, conto);
  const biglietto = JSON.parse(stampa.biglietto) as { righe: unknown[] };
  assert(Array.isArray(biglietto.righe), 'il biglietto porta le righe');
});

Deno.test('la sala mostra il conto aperto col totale; chiudi lo toglie', async () => {
  const db = base();
  const c = await esegui(db, 'conto', req('POST', { tavolo: 'T7', tipo: 'esterno', coperti: 2 }), cfg);
  const conto = (c.corpo as { conto: { id: string } }).conto.id;
  await esegui(db, 'righe', req('POST', { conto, righe: [{ id: 'r1', articolo: 'A2', quantita: 2, portata: 'bevande' }] }), cfg);
  const sala = await esegui(db, 'sala', req('GET', null, { locale: 'L1' }), cfg);
  const t7 = (sala.corpo as { tavoli: { id: string; conti: { totale_cent: number; da_inviare: boolean }[] }[] }).tavoli.find((t) => t.id === 'T7')!;
  assertEquals(t7.conti[0].totale_cent, 1000);
  assertEquals(t7.conti[0].da_inviare, true);
  const bloccato = await esegui(db, 'chiudi', req('POST', { conto, modo: 'contanti' }), cfg);
  assertEquals(bloccato.stato, 409, 'con righe da inviare non si chiude');
  await esegui(db, 'invia', req('POST', { conto }), cfg);
  const ok = await esegui(db, 'chiudi', req('POST', { conto, modo: 'contanti' }), cfg);
  assertEquals(ok.stato, 200);
  const dopo = await esegui(db, 'sala', req('GET', null, { locale: 'L1' }), cfg);
  assertEquals((dopo.corpo as { tavoli: { id: string; conti: unknown[] }[] }).tavoli.find((t) => t.id === 'T7')!.conti.length, 0);
});

Deno.test('due conti sullo stesso tavolo: una riga si sposta da uno all altro, e se ne puo aprire uno li per li', async () => {
  const db = base();
  const primo = (await esegui(db, 'conto', req('POST', { tavolo: 'T7', tipo: 'esterno', coperti: 2 }), cfg).then((r) => r.corpo)) as { conto: { id: string } };
  const conto = primo.conto.id;
  await esegui(db, 'righe', req('POST', { conto, righe: [
    { id: 'r1', articolo: 'A1', quantita: 1, portata: 'primi' },
    { id: 'r2', articolo: 'A2', quantita: 1, portata: 'bevande' }] }), cfg);
  /* l amico paga la sua birra: si apre il suo conto spostandoci la riga */
  const s = await esegui(db, 'sposta', req('POST', { riga: 'r2', nuovo: true, coperti: 1 }), cfg);
  assertEquals(s.stato, 200);
  const altro = (s.corpo as { conto: string }).conto;
  assert(altro && altro !== conto);
  const letto = await esegui(db, 'conto', req('GET', null, { id: conto }), cfg);
  assertEquals((letto.corpo as { righe: { id: string }[] }).righe.map((r) => r.id), ['r1']);
  assertEquals((letto.corpo as { fratelli: unknown[] }).fratelli.length, 1, 'il conto conosce gli altri del tavolo');
  const suo = await esegui(db, 'conto', req('GET', null, { id: altro }), cfg);
  assertEquals((suo.corpo as { righe: { id: string }[] }).righe.map((r) => r.id), ['r2']);
  /* e si torna indietro spostandola sul primo */
  await esegui(db, 'sposta', req('POST', { riga: 'r2', conto }), cfg);
  const dopo = await esegui(db, 'conto', req('GET', null, { id: conto }), cfg);
  assertEquals((dopo.corpo as { righe: unknown[] }).righe.length, 2);
});

Deno.test('storna una riga partita: STORNO in coda di stampa; il cameriere senza permesso no', async () => {
  const db = base();
  const c = await esegui(db, 'conto', req('POST', { tavolo: 'T7', tipo: 'esterno', coperti: 1 }), cfg);
  const conto = (c.corpo as { conto: { id: string } }).conto.id;
  await esegui(db, 'righe', req('POST', { conto, righe: [{ id: 'r1', articolo: 'A1', quantita: 1, portata: 'primi' }] }), cfg);
  await esegui(db, 'invia', req('POST', { conto }), cfg);
  const no = await esegui(db, 'storna', req('POST', { riga: 'r1', motivo: 'errore' }), cfg);
  assertEquals(no.stato, 403);
  db.exec("update pos_cameriere set storni = 1 where id = 'K1'");
  const si = await esegui(db, 'storna', req('POST', { riga: 'r1', motivo: 'errore' }), cfg);
  assertEquals(si.stato, 200);
  const testi = (db.prepare('select testo from pos_stampa order by rowid').all() as { testo: string }[]).map((r) => r.testo);
  assert(testi.length === 2 && testi[1].includes('STORNO'), testi.join('|'));
});

Deno.test('un cameriere «senza PIN» entra col solo codice; agli altri il PIN si chiede ancora', async () => {
  const db = base();
  const senza = { metodo: 'POST', query: {}, corpo: { codice: '11' }, intestazioni: { 'x-pos-dispositivo': 'tok' } };
  const primo = await esegui(db, 'accesso', senza, cfg);
  assertEquals(primo.stato, 400, 'finche non e senza PIN, il codice da solo non basta');
  assertEquals((primo.corpo as { errore: string }).errore, 'serve il PIN');
  db.exec("update pos_cameriere set senza_pin = 1 where id = 'K1'");
  const dopo = await esegui(db, 'accesso', senza, cfg);
  assertEquals(dopo.stato, 200);
  assert(typeof (dopo.corpo as { sessione: string }).sessione === 'string');
});

Deno.test('accesso col PIN: hash SHA-256 di codice:pin, sessione nuova; sbagliato 401; senza sessione 401; stato-locale risponde a tutti', async () => {
  const db = base();
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('11:1234'));
  db.prepare('update pos_cameriere set pin_hash = ? where id = ?').run([...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join(''), 'K1');
  const senza: Richiesta = { metodo: 'POST', query: {}, corpo: { codice: '11', pin: '1234' }, intestazioni: { 'x-pos-dispositivo': 'tok' } };
  const ok = await esegui(db, 'accesso', senza, cfg);
  assertEquals(ok.stato, 200);
  assert(typeof (ok.corpo as { sessione: string }).sessione === 'string');
  assertEquals((db.prepare('select allineato from pos_sessione').get() as { allineato: number }).allineato, 0, 'la sessione sale al cloud');
  const no = await esegui(db, 'accesso', { ...senza, corpo: { codice: '11', pin: '0000' } }, cfg);
  assertEquals(no.stato, 401);
  /* un codice che non esiste si dice subito, senza far scrivere un PIN a vuoto */
  const ignoto = await esegui(db, 'accesso', { ...senza, corpo: { codice: '77' } }, cfg);
  assertEquals([ignoto.stato, (ignoto.corpo as { errore: string }).errore], [401, 'codice non riconosciuto']);
  const r = await esegui(db, 'conto', { metodo: 'POST', query: {}, corpo: {}, intestazioni: {} }, cfg);
  assertEquals(r.stato, 401);
  const vivo = await esegui(db, 'stato-locale', { metodo: 'GET', query: {}, corpo: null, intestazioni: {} }, cfg);
  assertEquals(vivo.stato, 200);
});

Deno.test('al tavolo i conti si chiamano col nome di chi paga, e quello vuoto si toglie', async () => {
  const db = base();
  const c = await esegui(db, 'conto', req('POST', { tavolo: 'T7', tipo: 'esterno', coperti: 2 }), cfg);
  const conto = (c.corpo as { conto: { id: string } }).conto.id;

  /* prima e «Esterno» come tutti, poi porta il nome di chi paga */
  const s1 = await esegui(db, 'sala', req('GET', null, { locale: 'L1' }), cfg);
  const primo = (s1.corpo as { tavoli: { conti: { titolo: string }[] }[] }).tavoli[0].conti[0];
  assertEquals(primo.titolo, 'Esterno');
  const n = await esegui(db, 'conto-cambia', req('POST', { conto, nome: 'Rossi', coperti: 4 }), cfg);
  assertEquals(n.stato, 200);
  const s2 = await esegui(db, 'sala', req('GET', null, { locale: 'L1' }), cfg);
  const dopo = (s2.corpo as { tavoli: { conti: { titolo: string; nome: string; coperti: number }[] }[] }).tavoli[0].conti[0];
  assertEquals(dopo.titolo, 'Rossi');
  assertEquals(dopo.nome, 'Rossi');
  assertEquals(Number(dopo.coperti), 4);

  /* vuoto se ne va, e l id resta da dire al cloud */
  const via = await esegui(db, 'conto-elimina', req('POST', { conto }), cfg);
  assertEquals(via.stato, 200);
  assertEquals(db.prepare('select count(*) as n from pos_conto').get(), { n: 0 });
  assertEquals(db.prepare("select id from pos_eliminato where tabella = 'pos_conto'").get(), { id: conto });
});

Deno.test('un conto con delle righe non si cancella: si storna o si chiude', async () => {
  const db = base();
  const c = await esegui(db, 'conto', req('POST', { tavolo: 'T7', tipo: 'esterno', coperti: 1 }), cfg);
  const conto = (c.corpo as { conto: { id: string } }).conto.id;
  await esegui(db, 'righe', req('POST', { conto, righe: [{ id: 'r1', articolo: 'A2', quantita: 1, portata: 'bevande' }] }), cfg);
  const via = await esegui(db, 'conto-elimina', req('POST', { conto }), cfg);
  assertEquals(via.stato, 409);
  assertEquals(db.prepare('select count(*) as n from pos_conto').get(), { n: 1 });
});

Deno.test('prezzi e disponibilita non si cambiano sul PC: il menu scende dal cloud e li cancellerebbe', async () => {
  const db = base();
  const r = await esegui(db, 'articolo-cambia', req('POST', { articolo: 'A1', prezzo_cent: 1500 }), cfg);
  assertEquals(r.stato, 503);
  assertEquals(db.prepare("select prezzo_cent as p from pos_articolo where id = 'A1'").get(), { p: 1400 });
});

Deno.test('chiuso in camera: l addebito nasce qui e aspetta di salire al cloud', async () => {
  const db = base();
  const c = await esegui(db, 'conto', req('POST', { tavolo: 'T7', tipo: 'camera', camera: '229', tessera: '12345', ospite: 'Rossi', coperti: 2 }), cfg);
  const conto = (c.corpo as { conto: { id: string } }).conto.id;
  await esegui(db, 'righe', req('POST', { conto, righe: [{ id: 'r1', articolo: 'A2', quantita: 2, portata: 'bevande' }] }), cfg);
  await esegui(db, 'invia', req('POST', { conto }), cfg);
  const ch = await esegui(db, 'chiudi', req('POST', { conto, modo: 'camera' }), cfg);
  assertEquals(ch.stato, 200);
  const a = db.prepare('select * from pos_addebito').get() as Record<string, unknown>;
  assertEquals([a.camera, a.tessera, a.ospite, a.totale_cent, a.stato, a.allineato], ['229', '12345', 'Rossi', 1000, 'da_riportare', 0]);
  assertEquals(JSON.parse(String(a.righe)), [{ quantita: 2, nome: 'Birra', totale_cent: 1000 }]);
});

Deno.test('un conto esterno non si addebita in camera', async () => {
  const db = base();
  const c = await esegui(db, 'conto', req('POST', { tavolo: 'T7', tipo: 'esterno', coperti: 1 }), cfg);
  const conto = (c.corpo as { conto: { id: string } }).conto.id;
  const ch = await esegui(db, 'chiudi', req('POST', { conto, modo: 'camera' }), cfg);
  assertEquals(ch.stato, 409);
  assertEquals(db.prepare('select count(*) as n from pos_addebito').get(), { n: 0 });
});

Deno.test('la tessera la legge il cloud: qui si scrive la camera', async () => {
  const db = base();
  const r = await esegui(db, 'tessera', req('GET', null, { codice: '12345' }), cfg);
  assertEquals(r.stato, 503);
});

Deno.test('senza motivo il server locale non storna e non cambia prezzo', async () => {
  const db = base();
  const c = await esegui(db, 'conto', req('POST', { tavolo: 'T7', tipo: 'esterno', coperti: 1 }), cfg);
  const conto = (c.corpo as { conto: { id: string } }).conto.id;
  /* il cameriere di prova puo stornare (storni = 1 nel base()? no: ruolo cameriere) */
  db.exec("update pos_cameriere set storni = 1 where id = 'K1'");
  await esegui(db, 'righe', req('POST', { conto, righe: [{ id: 'r1', articolo: 'A2', quantita: 1, portata: 'bevande' }] }), cfg);
  await esegui(db, 'invia', req('POST', { conto }), cfg);
  const senza = await esegui(db, 'storna', req('POST', { riga: 'r1' }), cfg);
  assertEquals(senza.stato, 400);
  assertEquals((db.prepare("select stato from pos_riga where id = 'r1'").get() as { stato: string }).stato, 'partita');
  const con = await esegui(db, 'storna', req('POST', { riga: 'r1', motivo: 'piatto rifatto' }), cfg);
  assertEquals(con.stato, 200);
  assertEquals((db.prepare("select motivo_storno as m from pos_riga where id = 'r1'").get() as { m: string }).m, 'piatto rifatto');
});

Deno.test('il ristorante ordina le bevande al Bistrot: il biglietto esce li, con scritto dove portarlo', async () => {
  /* «cosi' gli portano le bevande dal bistro al ristorante senza dover
     chiamare telefonicamente» (la proprieta', 4 settembre 2026) */
  const db = base();
  db.exec(`insert into pos_locale (id, nome, aggiornato_il) values ('rist', 'Ristorante', '2026-09-04T10:00:00Z');
    insert into pos_zona (id, locale, nome, aggiornato_il) values ('ZR', 'rist', 'Sala', '2026-09-04T10:00:00Z');
    insert into pos_tavolo (id, zona, nome, aggiornato_il) values ('T5', 'ZR', 'Tavolo 5', '2026-09-04T10:00:00Z');
    update pos_categoria set locale_stampa = 'L1' where id = 'C2';`);
  const c = await esegui(db, 'conto', req('POST', { tavolo: 'T5', tipo: 'esterno', coperti: 2 }), cfg);
  const conto = (c.corpo as { conto: { id: string } }).conto.id;
  await esegui(db, 'righe', req('POST', { conto, righe: [
    { id: 'r1', articolo: 'A1', quantita: 1, portata: 'primi' },
    { id: 'r2', articolo: 'A2', quantita: 2, portata: 'bevande' },
  ] }), cfg);
  await esegui(db, 'invia', req('POST', { conto }), cfg);
  const stampe = db.prepare('select locale, stampante, testo from pos_stampa order by locale').all() as { locale: string; stampante: string; testo: string }[];
  const alBistrot = stampe.find((s) => s.locale === 'L1');
  const alRistorante = stampe.find((s) => s.locale === 'rist');
  assertEquals(alBistrot?.stampante, 'bar', 'le bevande escono al bar del Bistrot');
  assert(alBistrot!.testo.includes('>>> PORTARE AL RISTORANTE'), 'con scritto dove portarle');
  assert(alBistrot!.testo.includes('2 x Birra'));
  assert(!alRistorante || !alRistorante.testo.includes('Birra'), 'e non escono anche a casa');
});

Deno.test('la riga puo dire da sola dove si prepara, e batte la categoria', async () => {
  const db = base();
  const c = await esegui(db, 'conto', req('POST', { tavolo: 'T7', tipo: 'esterno', coperti: 1 }), cfg);
  const conto = (c.corpo as { conto: { id: string } }).conto.id;
  db.exec("insert into pos_locale (id, nome, stampante_cucina, stampante_bar, aggiornato_il) values ('rist', 'Ristorante', '10.0.0.3:9100', '10.0.0.4:9100', '2026-09-04T10:00:00Z');");
  await esegui(db, 'righe', req('POST', { conto, righe: [{ id: 'r1', articolo: 'A2', quantita: 1, portata: 'bevande', locale_stampa: 'rist' }] }), cfg);
  await esegui(db, 'invia', req('POST', { conto }), cfg);
  const s = db.prepare("select locale, testo from pos_stampa").get() as { locale: string; testo: string };
  assertEquals(s.locale, 'rist');
  assert(s.testo.includes('>>> PORTARE AL BISTROT'), 'il tavolo e al Bistrot: la roba torna li');
});

Deno.test('il ristorante non ha stampanti: il cibo non fa biglietti, le bibite escono al Bistrot', async () => {
  /* «la cucina del ristorante non ha stampante e neppure il ristorante:
     usano il palmare solo per gli addebiti e per ordinare le bibite al
     Bistrot» (la proprieta', 4 settembre 2026) */
  const db = base();
  db.exec(`insert into pos_locale (id, nome, stampante_cucina, stampante_bar, aggiornato_il)
      values ('rist', 'Ristorante', null, null, '2026-09-04T10:00:00Z');
    update pos_locale set stampante_cucina = '10.0.0.1:9100', stampante_bar = '10.0.0.2:9100' where id = 'L1';
    insert into pos_zona (id, locale, nome, aggiornato_il) values ('ZR', 'rist', 'Sala', '2026-09-04T10:00:00Z');
    insert into pos_tavolo (id, zona, nome, aggiornato_il) values ('T5', 'ZR', 'Tavolo 5', '2026-09-04T10:00:00Z');
    update pos_categoria set locale_stampa = 'L1' where id = 'C2';`);
  const c = await esegui(db, 'conto', req('POST', { tavolo: 'T5', tipo: 'esterno', coperti: 2 }), cfg);
  const conto = (c.corpo as { conto: { id: string } }).conto.id;
  await esegui(db, 'righe', req('POST', { conto, righe: [
    { id: 'r1', articolo: 'A1', quantita: 1, portata: 'primi' },
    { id: 'r2', articolo: 'A2', quantita: 2, portata: 'bevande' },
  ] }), cfg);
  await esegui(db, 'invia', req('POST', { conto }), cfg);
  const stampe = db.prepare('select locale, stampante, testo from pos_stampa').all() as { locale: string; stampante: string; testo: string }[];
  assertEquals(stampe.length, 1, 'un biglietto solo: quello del Bistrot');
  assertEquals([stampe[0].locale, stampe[0].stampante], ['L1', 'bar']);
  assert(stampe[0].testo.includes('>>> PORTARE AL RISTORANTE'));
  /* le tagliatelle restano sul conto: non si stampano, ma si pagano */
  const r = db.prepare("select stato, prezzo_cent from pos_riga where id = 'r1'").get() as { stato: string; prezzo_cent: number };
  assertEquals([r.stato, r.prezzo_cent], ['partita', 1400]);
  /* e la comanda resta scritta lo stesso: cosa e stato mandato si sa */
  assertEquals((db.prepare('select count(*) as n from pos_comanda').get() as { n: number }).n, 2);
});

Deno.test('tutto il tavolo su un altro: i conti aperti cambiano tavolo insieme, nello stesso locale', async () => {
  /* «spostare un tavolo intero su un altro» (la proprieta', 4 settembre
     2026): piove sulla terrazza, o il tavolo era stato battuto sbagliato */
  const db = base();
  db.exec(`insert into pos_tavolo (id, zona, nome, aggiornato_il) values ('T8', 'Z1', 'Tavolo 8', '2026-09-04T10:00:00Z');
    insert into pos_locale (id, nome, stampante_cucina, stampante_bar, aggiornato_il) values ('L2', 'Ristorante', null, null, '2026-09-04T10:00:00Z');
    insert into pos_zona (id, locale, nome, aggiornato_il) values ('Z2', 'L2', 'Sala', '2026-09-04T10:00:00Z');
    insert into pos_tavolo (id, zona, nome, aggiornato_il) values ('T9', 'Z2', 'Tavolo 9', '2026-09-04T10:00:00Z');`);
  const vuoto = await esegui(db, 'tavolo-sposta', req('POST', { da: 'T7', a: 'T8' }), cfg);
  assertEquals(vuoto.stato, 409, 'un tavolo senza conti non ha niente da spostare');
  const c = await esegui(db, 'conto', req('POST', { tavolo: 'T7', tipo: 'esterno', coperti: 2 }), cfg);
  const conto = (c.corpo as { conto: { id: string } }).conto.id;
  await esegui(db, 'righe', req('POST', { conto, righe: [{ id: 'r1', articolo: 'A2', quantita: 2, portata: 'bevande' }] }), cfg);
  await esegui(db, 'conto', req('POST', { tavolo: 'T7', tipo: 'esterno', coperti: 1 }), cfg);
  assertEquals((await esegui(db, 'tavolo-sposta', req('POST', { da: 'T7', a: 'T7' }), cfg)).stato, 400, 'lo stesso tavolo no');
  assertEquals((await esegui(db, 'tavolo-sposta', req('POST', { da: 'T7', a: 'T99' }), cfg)).stato, 404, 'un tavolo che non c e');
  assertEquals((await esegui(db, 'tavolo-sposta', req('POST', { da: 'T7', a: 'T9' }), cfg)).stato, 409, 'un altro locale ha altre stampanti: no');
  const s = await esegui(db, 'tavolo-sposta', req('POST', { da: 'T7', a: 'T8' }), cfg);
  assertEquals(s.stato, 200);
  assertEquals((s.corpo as { conti: number }).conti, 2, 'tutti e due i conti');
  const sala = await esegui(db, 'sala', req('GET', null, { locale: 'L1' }), cfg);
  const tavoli = (sala.corpo as { tavoli: { id: string; conti: unknown[] }[] }).tavoli;
  assertEquals(tavoli.find((t) => t.id === 'T7')!.conti.length, 0);
  assertEquals(tavoli.find((t) => t.id === 'T8')!.conti.length, 2);
  /* e i conti hanno l'aggiornamento segnato, cosi' salgono al cloud */
  assertEquals((db.prepare("select count(*) as n from pos_conto where tavolo = 'T8' and allineato = 0").get() as { n: number }).n, 2);
});

Deno.test('un conto si paga in parti: ogni pagamento e una riga, e all ultimo il conto si chiude da solo', async () => {
  /* «dividere il conto fra persone al tavolo», «dare resto» (4-5 settembre 2026) */
  const db = base();
  const c = await esegui(db, 'conto', req('POST', { tavolo: 'T7', tipo: 'esterno', coperti: 3 }), cfg);
  const conto = (c.corpo as { conto: { id: string } }).conto.id;
  await esegui(db, 'righe', req('POST', { conto, righe: [{ id: 'r1', articolo: 'A1', quantita: 3, portata: 'primi' }] }), cfg);
  assertEquals((await esegui(db, 'paga', req('POST', { conto, modo: 'carta', importo_cent: 1400 }), cfg)).stato, 409, 'con righe da inviare non si incassa');
  await esegui(db, 'invia', req('POST', { conto }), cfg);
  assertEquals((await esegui(db, 'paga', req('POST', { conto, modo: 'carta', importo_cent: 5000 }), cfg)).stato, 409, 'piu del dovuto no');
  const p1 = await esegui(db, 'paga', req('POST', { conto, modo: 'carta', importo_cent: 1400 }), cfg);
  assertEquals(p1.stato, 200);
  assertEquals((p1.corpo as { residuo_cent: number }).residuo_cent, 2800);
  assertEquals((p1.corpo as { chiuso: boolean }).chiuso, false);
  const letto = await esegui(db, 'conto', req('GET', null, { id: conto }), cfg);
  assertEquals((letto.corpo as { pagamenti: { importo_cent: number }[] }).pagamenti.map((p) => p.importo_cent), [1400]);
  assertEquals((letto.corpo as { conto: { stato: string } }).conto.stato, 'aperto');
  /* i contanti col resto: senza importo si paga tutto quello che resta */
  const p2 = await esegui(db, 'paga', req('POST', { conto, modo: 'contanti', ricevuto_cent: 5000 }), cfg);
  assertEquals(p2.stato, 200);
  assertEquals((p2.corpo as { chiuso: boolean }).chiuso, true);
  assertEquals((p2.corpo as { resto_cent: number }).resto_cent, 2200);
  assertEquals((p2.corpo as { residuo_cent: number }).residuo_cent, 0);
  const dopo = await esegui(db, 'conto', req('GET', null, { id: conto }), cfg);
  assertEquals((dopo.corpo as { conto: { chiuso_come: string } }).conto.chiuso_come, 'misto');
  assertEquals((dopo.corpo as { conto: { stato: string } }).conto.stato, 'chiuso');
  assertEquals((await esegui(db, 'paga', req('POST', { conto, modo: 'carta', importo_cent: 100 }), cfg)).stato, 409, 'un conto chiuso non si paga piu');
  /* e i pagamenti salgono al cloud */
  assertEquals((db.prepare('select count(*) as n from pos_pagamento where allineato = 0').get() as { n: number }).n, 2);
});

Deno.test('chiudi in contanti o carta lascia un pagamento: la giornata li somma da li', async () => {
  const db = base();
  const c = await esegui(db, 'conto', req('POST', { tavolo: 'T7', tipo: 'esterno', coperti: 1 }), cfg);
  const conto = (c.corpo as { conto: { id: string } }).conto.id;
  await esegui(db, 'righe', req('POST', { conto, righe: [{ id: 'r1', articolo: 'A2', quantita: 1, portata: 'bevande' }] }), cfg);
  await esegui(db, 'invia', req('POST', { conto }), cfg);
  await esegui(db, 'chiudi', req('POST', { conto, modo: 'carta' }), cfg);
  const p = db.prepare('select modo, importo_cent from pos_pagamento where conto = ?').all(conto) as { modo: string; importo_cent: number }[];
  assertEquals(p, [{ modo: 'carta', importo_cent: 500 }]);
});

Deno.test('dentro una fascia il listino e quello della fascia: nel menu e sulla riga', async () => {
  /* «i listini a fasce (happy hour, prezzo diverso di sera)» (4 settembre 2026) */
  const db = base();
  db.exec(`insert into pos_fascia (id, nome, locale, dalle, alle, giorni, sconto_percento, categorie, attiva, aggiornato_il) values ('F1', 'Sempre', 'L1', '00:00', '00:00', null, 50, '["C2"]', 1, '2026-09-05T10:00:00Z');
    insert into pos_prezzo_fascia (id, fascia, articolo, prezzo_cent, aggiornato_il) values ('P1', 'F1', 'A1', 1000, '2026-09-05T10:00:00Z');`);
  const menu = await esegui(db, 'menu', req('GET'), cfg);
  const corpo = menu.corpo as { articoli: { id: string; prezzo_cent: number }[]; fascia: { nome: string } | null };
  assertEquals(corpo.articoli.find((a) => a.id === 'A1')!.prezzo_cent, 1000, 'il prezzo scritto apposta');
  assertEquals(corpo.articoli.find((a) => a.id === 'A2')!.prezzo_cent, 250, 'la birra a meta: lo sconto della categoria');
  assertEquals(corpo.fascia!.nome, 'Sempre');
  const c = await esegui(db, 'conto', req('POST', { tavolo: 'T7', tipo: 'esterno', coperti: 1 }), cfg);
  const conto = (c.corpo as { conto: { id: string } }).conto.id;
  const r = await esegui(db, 'righe', req('POST', { conto, righe: [{ id: 'r1', articolo: 'A1', quantita: 1, portata: 'primi' }, { id: 'r2', articolo: 'A2', quantita: 1, portata: 'bevande' }] }), cfg);
  assertEquals(r.stato, 200);
  const righe = (r.corpo as { righe: { id: string; prezzo_cent: number; prezzo_listino_cent: number }[] }).righe;
  assertEquals(righe.find((x) => x.id === 'r1')!.prezzo_cent, 1000);
  assertEquals(righe.find((x) => x.id === 'r2')!.prezzo_cent, 250);
  assertEquals(righe.find((x) => x.id === 'r2')!.prezzo_listino_cent, 250, 'il listino in vigore e quello della fascia');
});

Deno.test('un conto esterno diventa in camera al momento di pagare: conto-cambia con la camera, poi chiudi in camera', async () => {
  /* «basta aggiungere il pulsante in camera... al posto di uscire e
     rientrare dall altra parte» (la proprieta', 5 settembre 2026) */
  const db = base();
  const c = await esegui(db, 'conto', req('POST', { tavolo: 'T7', tipo: 'esterno', coperti: 2 }), cfg);
  const conto = (c.corpo as { conto: { id: string } }).conto.id;
  await esegui(db, 'righe', req('POST', { conto, righe: [{ id: 'r1', articolo: 'A2', quantita: 2, portata: 'bevande' }] }), cfg);
  await esegui(db, 'invia', req('POST', { conto }), cfg);
  assertEquals((await esegui(db, 'chiudi', req('POST', { conto, modo: 'camera' }), cfg)).stato, 409, 'senza camera non si addebita');
  assertEquals((await esegui(db, 'conto-cambia', req('POST', { conto, camera: '  ' }), cfg)).stato, 400, 'una camera vuota no');
  const cambiato = await esegui(db, 'conto-cambia', req('POST', { conto, camera: '229', tessera: '12345', ospite: 'Rossi', lingua: 'de' }), cfg);
  assertEquals(cambiato.stato, 200);
  const dopo = (cambiato.corpo as { conto: { tipo: string; camera: string; tessera: string; ospite: string; lingua: string; coperti: number } }).conto;
  assertEquals([dopo.tipo, dopo.camera, dopo.tessera, dopo.ospite, dopo.lingua, dopo.coperti], ['camera', '229', '12345', 'Rossi', 'de', 2]);
  const chiuso = await esegui(db, 'chiudi', req('POST', { conto, modo: 'camera' }), cfg);
  assertEquals(chiuso.stato, 200);
  const add = db.prepare('select camera, totale_cent from pos_addebito where conto = ?').get(conto) as { camera: string; totale_cent: number };
  assertEquals(add, { camera: '229', totale_cent: 1000 });
});

Deno.test('un conto con dentro solo storni e a zero: si chiude, e gli storni restano', async () => {
  /* «se cancello un conto che non ha nulla dentro mi dice che ha delle
     righe... anche se e a zero» (la proprieta', 5 settembre 2026) */
  const db = base();
  db.exec("update pos_cameriere set storni = 1 where id = 'K1'");
  const c = await esegui(db, 'conto', req('POST', { tavolo: 'T7', tipo: 'esterno', coperti: 1 }), cfg);
  const conto = (c.corpo as { conto: { id: string } }).conto.id;
  await esegui(db, 'righe', req('POST', { conto, righe: [{ id: 'r1', articolo: 'A2', quantita: 1, portata: 'bevande' }] }), cfg);
  await esegui(db, 'invia', req('POST', { conto }), cfg);
  assertEquals((await esegui(db, 'conto-elimina', req('POST', { conto }), cfg)).stato, 409, 'con una riga viva no');
  assertEquals((await esegui(db, 'storna', req('POST', { riga: 'r1', motivo: 'cambiato idea' }), cfg)).stato, 200);
  const e = await esegui(db, 'conto-elimina', req('POST', { conto }), cfg);
  assertEquals(e.stato, 200);
  assertEquals((e.corpo as { chiuso: boolean }).chiuso, true, 'non sparisce: si chiude a zero');
  const dopo = db.prepare('select stato, chiuso_come from pos_conto where id = ?').get(conto) as { stato: string; chiuso_come: string | null };
  assertEquals(dopo, { stato: 'chiuso', chiuso_come: null });
  assertEquals((db.prepare("select count(*) as n from pos_riga where conto = ? and stato = 'stornata'").get(conto) as { n: number }).n, 1, 'lo storno resta per la giornata');
  const sala = await esegui(db, 'sala', req('GET', null, { locale: 'L1' }), cfg);
  assertEquals((sala.corpo as { tavoli: { id: string; conti: unknown[] }[] }).tavoli.find((t) => t.id === 'T7')!.conti.length, 0, 'e il tavolo e libero');
});

Deno.test('a cucina chiusa (orari_cucina del locale) il biglietto della cucina esce al bancone, con l avviso in cima', async () => {
  /* la proprieta', 5 settembre 2026: «dopo le 14:30 ogni comanda esce al bancone» */
  const db = base();
  const { oraLocale } = await import('../supabase/functions/pos/fasce.ts');
  const chiusa = oraLocale(new Date()).minuti < 12 * 60 ? '13:00-13:05' : '02:00-02:05';   // un orario che adesso e' sicuramente passato
  db.prepare('update pos_locale set orari_cucina = ? where id = ?').run(chiusa, 'L1');
  const c = await esegui(db, 'conto', req('POST', { tavolo: 'T7', tipo: 'esterno', coperti: 2 }), cfg);
  const conto = (c.corpo as { conto: { id: string } }).conto.id;
  await esegui(db, 'righe', req('POST', { conto, righe: [{ id: 'r1', articolo: 'A1', quantita: 1, portata: 'primi' }, { id: 'r2', articolo: 'A2', quantita: 1, portata: 'bevande' }] }), cfg);
  await esegui(db, 'invia', req('POST', { conto }), cfg);
  const stampe = db.prepare('select stampante, testo from pos_stampa order by testo').all() as { stampante: string; testo: string }[];
  assertEquals(stampe.map((s) => s.stampante), ['bar', 'bar'], 'tutti e due i biglietti escono al bar');
  const cucina = stampe.find((s) => s.testo.includes('Tagliatelle'))!;
  assertEquals(cucina.testo.split('\n')[1], '>>> CUCINA CHIUSA: AL BANCONE');
  assert(!stampe.find((s) => s.testo.includes('Birra'))!.testo.includes('CUCINA CHIUSA'), 'il biglietto del bar e normale');
});

/* ---------- il monitor cucina sul PC del Bistrot (6 settembre 2026) ---------- */

const reqSchermo = (chiave: string, corpo: unknown = null, metodo = 'GET'): Richiesta =>
  ({ metodo, query: { locale: 'L1', stampante: 'bar' }, corpo, intestazioni: { 'x-schermo-chiave': chiave } });

Deno.test('schermo: mostra solo i biglietti non ancora pronti e scrive vista_il; la chiave sbagliata e rifiutata', async () => {
  const db = base();
  const chiaveHash = await impronta('ABCDEFGHJKLMNPQR');
  db.prepare("insert into pos_postazione (locale, stampante, nome, schermo, stampa_sempre, ripiego_s, chiave_hash) values ('L1', 'bar', 'Banco', 1, 0, 30, ?)").run(chiaveHash);
  const fa = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
  db.prepare(`insert into pos_stampa (id, locale, stampante, testo, stato, creato_il, aggiornato_il, allineato, biglietto, conto) values (?, 'L1', 'bar', 'BEVANDE', 'a_schermo', ?, ?, 0, ?, 'CT1')`)
    .run('P1', fa(5), fa(5), JSON.stringify({ righe: [] }));
  db.prepare(`insert into pos_stampa (id, locale, stampante, testo, stato, creato_il, aggiornato_il, allineato, biglietto, conto, pronta_il) values (?, 'L1', 'bar', 'GIA PRONTO', 'a_schermo', ?, ?, 0, ?, 'CT1', ?)`)
    .run('P2', fa(6), fa(6), JSON.stringify({ righe: [] }), fa(1));

  const sbagliata = await esegui(db, 'schermo', reqSchermo('CHIAVE-SBAGLIATA'), cfg);
  assertEquals(sbagliata, { stato: 401, corpo: { errore: 'schermo non riconosciuto' } });

  const r = await esegui(db, 'schermo', reqSchermo('ABCDEFGHJKLMNPQR'), cfg);
  assertEquals(r.stato, 200);
  const corpo = r.corpo as { postazione: { nome: string }; biglietti: { id: string; vista_il: string | null; biglietto: { righe: unknown[] } }[] };
  assertEquals(corpo.postazione.nome, 'Banco');
  assertEquals(corpo.biglietti.length, 1, 'solo il biglietto non ancora pronto');
  assertEquals(corpo.biglietti[0].id, 'P1');
  assert(Array.isArray(corpo.biglietti[0].biglietto.righe), 'il biglietto torna come oggetto');
  assert(!!corpo.biglietti[0].vista_il, 'la risposta porta gia il vista_il');
  const riga = db.prepare('select vista_il from pos_stampa where id = ?').get('P1') as { vista_il: string | null };
  assert(!!riga.vista_il, 'e resta scritto nel database');

  const metodoSbagliato = await esegui(db, 'schermo', reqSchermo('ABCDEFGHJKLMNPQR', null, 'POST'), cfg);
  assertEquals(metodoSbagliato, { stato: 405, corpo: { errore: 'metodo non ammesso' } });
});

Deno.test('schermo-stato: pronta scrive pronta_il, pronta_da e allineato = 0; di un altra stampante e vietato; metodo sbagliato 405', async () => {
  const db = base();
  const chiaveHash = await impronta('ABCDEFGHJKLMNPQR');
  db.prepare("insert into pos_postazione (locale, stampante, nome, schermo, stampa_sempre, ripiego_s, chiave_hash) values ('L1', 'bar', 'Banco', 1, 0, 30, ?)").run(chiaveHash);
  db.exec(`insert into pos_stampa (id, locale, stampante, testo, stato, creato_il, aggiornato_il, allineato, conto) values
    ('P1', 'L1', 'bar', 'BEVANDE', 'a_schermo', '2026-09-04T10:00:00Z', '2026-09-04T10:00:00Z', 1, 'CT1'),
    ('P2', 'L1', 'cucina', 'PASTA', 'a_schermo', '2026-09-04T10:00:00Z', '2026-09-04T10:00:00Z', 1, 'CT1')`);

  const metodoSbagliato = await esegui(db, 'schermo-stato', reqSchermo('ABCDEFGHJKLMNPQR', { id: 'P1', passo: 'pronta' }, 'GET'), cfg);
  assertEquals(metodoSbagliato, { stato: 405, corpo: { errore: 'metodo non ammesso' } });

  const pronta = await esegui(db, 'schermo-stato', reqSchermo('ABCDEFGHJKLMNPQR', { id: 'P1', passo: 'pronta' }, 'POST'), cfg);
  assertEquals(pronta.stato, 200);
  assertEquals((pronta.corpo as { esito: string; pronta_da: string }).pronta_da, 'Banco');
  const riga = db.prepare('select pronta_il, pronta_da, presa_il, allineato from pos_stampa where id = ?').get('P1') as Record<string, unknown>;
  assert(!!riga.pronta_il, 'pronta_il scritto'); assertEquals(riga.pronta_da, 'Banco');
  assert(!!riga.presa_il, 'pronta prende anche presa_il se non c era gia'); assertEquals(riga.allineato, 0);

  const altra = await esegui(db, 'schermo-stato', reqSchermo('ABCDEFGHJKLMNPQR', { id: 'P2', passo: 'pronta' }, 'POST'), cfg);
  assertEquals(altra, { stato: 403, corpo: { errore: "di un'altra postazione" } });

  const ignoto = await esegui(db, 'schermo-stato', reqSchermo('ABCDEFGHJKLMNPQR', { id: 'non-esiste', passo: 'pronta' }, 'POST'), cfg);
  assertEquals(ignoto, { stato: 404, corpo: { errore: 'biglietto non trovato' } });
});

Deno.test('la sala dice pronto_in_cucina per il conto con un biglietto pronto da pochi minuti', async () => {
  const db = base();
  const c = await esegui(db, 'conto', req('POST', { tavolo: 'T7', tipo: 'esterno', coperti: 2 }), cfg);
  const conto = (c.corpo as { conto: { id: string } }).conto.id;
  const cinqueMinFa = new Date(Date.now() - 5 * 60_000).toISOString();
  db.prepare(`insert into pos_stampa (id, locale, stampante, testo, stato, creato_il, aggiornato_il, allineato, conto, pronta_il) values ('P1', 'L1', 'cucina', 'X', 'stampata', ?, ?, 0, ?, ?)`)
    .run(cinqueMinFa, cinqueMinFa, conto, cinqueMinFa);
  const sala = await esegui(db, 'sala', req('GET', null, { locale: 'L1' }), cfg);
  const t7 = (sala.corpo as { tavoli: { id: string; conti: { id: string; pronto_in_cucina: boolean; pronto_alle: string | null }[] }[] }).tavoli.find((t) => t.id === 'T7')!;
  const contoRiga = t7.conti.find((x) => x.id === conto)!;
  assertEquals(contoRiga.pronto_in_cucina, true);
  assertEquals(contoRiga.pronto_alle, cinqueMinFa);
});

Deno.test('si entra col solo PIN di quattro cifre; uno sbagliato 401; due persone con lo stesso PIN 409', async () => {
  /* «falli identificare solo con un PIN di 4 cifre» (la proprieta', 6 settembre 2026) */
  const db = base();
  const hash = async (s: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((x) => x.toString(16).padStart(2, '0')).join('');
  db.prepare('update pos_cameriere set pin_hash = ? where id = ?').run(await hash('11:1234'), 'K1');
  const con = (corpo: unknown): Richiesta => ({ metodo: 'POST', query: {}, corpo, intestazioni: { 'x-pos-dispositivo': 'tok' } });
  const ok = await esegui(db, 'accesso', con({ pin: '1234' }), cfg);
  assertEquals(ok.stato, 200);
  assertEquals((ok.corpo as { cameriere: { id: string } }).cameriere.id, 'K1');
  assertEquals([(await esegui(db, 'accesso', con({ pin: '0000' }), cfg)).stato, (await esegui(db, 'accesso', con({ pin: '12' }), cfg)).stato], [401, 400]);
  db.prepare("insert into pos_cameriere (id, nome, codice, pin_hash, ruolo, aggiornato_il) values ('K2', 'Bruno', '12', ?, 'cameriere', '2026-09-04T10:00:00Z')").run(await hash('12:1234'));
  const due = await esegui(db, 'accesso', con({ pin: '1234' }), cfg);
  assertEquals([due.stato, (due.corpo as { errore: string }).errore], [409, 'PIN uguale per due persone: cambiarlo nel back office']);
});
