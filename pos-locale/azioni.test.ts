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
  db.exec(`insert into pos_locale (id, nome, aggiornato_il) values ('L1', 'Bistrot', '2026-09-04T10:00:00Z');
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
  const r = await esegui(db, 'conto', { metodo: 'POST', query: {}, corpo: {}, intestazioni: {} }, cfg);
  assertEquals(r.stato, 401);
  const vivo = await esegui(db, 'stato-locale', { metodo: 'GET', query: {}, corpo: null, intestazioni: {} }, cfg);
  assertEquals(vivo.stato, 200);
});
