/* ============================================================
   db.test.ts - lo schema SQLite del server locale.

   Le stesse tabelle del cloud (supabase/2026-09-04-pos.sql) tradotte in
   SQLite, piu' `allineato` sulle tabelle che salgono al cloud e pos_meta
   per ricordare l'ultimo allineamento in giu'. Ripetibile: creaSchema si
   puo' chiamare a ogni avvio.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { apri, colonneDi, creaSchema } from './db.ts';

Deno.test('lo schema si crea, si puo ricreare, e le tabelle pos_* ci sono tutte', () => {
  const db = apri(':memory:');
  creaSchema(db); creaSchema(db);
  const tab = (db.prepare("select name from sqlite_master where type = 'table' and name like 'pos_%' order by name").all() as { name: string }[]).map((r) => r.name);
  for (const t of ['pos_locale', 'pos_zona', 'pos_tavolo', 'pos_categoria', 'pos_articolo', 'pos_variante', 'pos_preferito', 'pos_cameriere', 'pos_dispositivo', 'pos_sessione', 'pos_conto', 'pos_riga', 'pos_comanda', 'pos_stampa', 'pos_postazione', 'pos_meta']) assert(tab.includes(t), t);
});

Deno.test('quello che sale al cloud porta allineato, e parte da 0', () => {
  const db = apri(':memory:'); creaSchema(db);
  for (const t of ['pos_conto', 'pos_riga', 'pos_comanda', 'pos_stampa', 'pos_sessione']) {
    const cols = (db.prepare(`pragma table_info(${t})`).all() as { name: string; dflt_value: string | null }[]);
    const c = cols.find((x) => x.name === 'allineato');
    assert(c, `${t}.allineato`);
    assertEquals(c!.dflt_value, '0');
  }
});

Deno.test('gli array (note_rapide, righe della comanda) vanno e tornano come JSON', () => {
  const db = apri(':memory:'); creaSchema(db);
  db.prepare("insert into pos_categoria (id, nome, stampante, portata, note_rapide, aggiornato_il) values ('C1', 'Primi', 'cucina', 'primi', ?, '2026-09-04T10:00:00Z')").run(JSON.stringify(['senza glutine']));
  const r = db.prepare('select note_rapide from pos_categoria').get() as { note_rapide: string };
  assertEquals(JSON.parse(r.note_rapide), ['senza glutine']);
});

Deno.test('il monitor cucina: pos_stampa porta le colonne nuove', () => {
  const db = apri(':memory:'); creaSchema(db);
  const cols = colonneDi(db, 'pos_stampa');
  for (const c of ['biglietto', 'conto', 'vista_il', 'presa_il', 'pronta_il', 'pronta_da']) assert(cols.includes(c), c);
});

Deno.test('un PC gia installato prima del monitor cucina non si reinstalla da zero: le colonne arrivano con un alter', () => {
  const db = apri(':memory:');
  /* la pos_stampa di prima del 6 settembre 2026, senza le colonne del monitor */
  db.exec(`create table pos_stampa (
    id text primary key, locale text not null, stampante text not null, testo text not null,
    stato text not null default 'da_stampare', creato_il text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    stampata_il text, stampata_da text, errore text, aggiornato_il text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    allineato integer not null default 0)`);
  creaSchema(db);
  const cols = colonneDi(db, 'pos_stampa');
  for (const c of ['biglietto', 'conto', 'vista_il', 'presa_il', 'pronta_il', 'pronta_da']) assert(cols.includes(c), c);
});

Deno.test('le sessioni dei palmari salgono al cloud: un PC gia installato riceve la colonna allineato', () => {
  /* chi passa dal PC al cloud (o viceversa) non deve rientrare col codice
     (la proprieta', 6 settembre 2026, sera) */
  const db = apri(':memory:');
  db.exec(`create table pos_sessione (id text primary key, cameriere text not null, dispositivo text not null, scade_il text not null,
    aggiornato_il text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))`);
  creaSchema(db);
  assert(colonneDi(db, 'pos_sessione').includes('allineato'));
});

Deno.test('un PC gia installato riceve la spunta «motivo storno» dei camerieri con un alter', () => {
  const db = apri(':memory:');
  db.exec(`create table pos_cameriere (id text primary key, nome text not null, codice text not null, pin_hash text not null,
    ruolo text not null, storni integer not null default 0, bloccato integer not null default 0, senza_pin integer not null default 0,
    aggiornato_il text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))`);
  creaSchema(db);
  assert(colonneDi(db, 'pos_cameriere').includes('storno_con_motivo'));
});
