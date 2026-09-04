/* ============================================================
   db.test.ts - lo schema SQLite del server locale.

   Le stesse tabelle del cloud (supabase/2026-09-04-pos.sql) tradotte in
   SQLite, piu' `allineato` sulle tabelle che salgono al cloud e pos_meta
   per ricordare l'ultimo allineamento in giu'. Ripetibile: creaSchema si
   puo' chiamare a ogni avvio.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { apri, creaSchema } from './db.ts';

Deno.test('lo schema si crea, si puo ricreare, e le tabelle pos_* ci sono tutte', () => {
  const db = apri(':memory:');
  creaSchema(db); creaSchema(db);
  const tab = (db.prepare("select name from sqlite_master where type = 'table' and name like 'pos_%' order by name").all() as { name: string }[]).map((r) => r.name);
  for (const t of ['pos_locale', 'pos_zona', 'pos_tavolo', 'pos_categoria', 'pos_articolo', 'pos_variante', 'pos_preferito', 'pos_cameriere', 'pos_dispositivo', 'pos_sessione', 'pos_conto', 'pos_riga', 'pos_comanda', 'pos_stampa', 'pos_meta']) assert(tab.includes(t), t);
});

Deno.test('quello che sale al cloud porta allineato, e parte da 0', () => {
  const db = apri(':memory:'); creaSchema(db);
  for (const t of ['pos_conto', 'pos_riga', 'pos_comanda', 'pos_stampa']) {
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
