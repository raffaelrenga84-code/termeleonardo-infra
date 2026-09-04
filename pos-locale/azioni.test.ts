/* ============================================================
   azioni.test.ts - le azioni del palmare servite dal PC del Bistrot.

   Stesso contratto del cloud (supabase/functions/pos/index.ts), stesse
   regole (i moduli puri importati da li'): il palmare non sa con chi parla.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { apri, creaSchema } from './db.ts';
import { esegui, type Richiesta } from './azioni.ts';

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
