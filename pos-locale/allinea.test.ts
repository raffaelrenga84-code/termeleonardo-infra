/* ============================================================
   allinea.test.ts - il PC del Bistrot e il cloud si tengono allineati.

   SU: conti, righe, comande e stampe nate qui salgono al cloud
   (pos?a=allinea-su) appena c'e' linea; `allineato` dice cosa manca.
   GIU: menu', tavoli, personale e dispositivi scendono dal cloud
   (pos?a=allinea-giu&da=ultimo_giu), insieme alle stampe nate nel cloud
   da un palmare che era in modalita' cloud: le stampa il PC, se c'e'.
   BATTITO: finche' il PC dice «sono vivo», il cloud non stampa da se'.
   Il fetch e' iniettato: niente rete nelle prove.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { apri, creaSchema } from './db.ts';
import { battito, giu, su } from './allinea.ts';

type Chiamata = { url: string; corpo: unknown; testa: Record<string, string> };
function cloudFinto(risposte: (c: Chiamata) => unknown) {
  const chiamate: Chiamata[] = [];
  const fetch = (url: string, init?: RequestInit) => {
    const c = { url, corpo: init?.body ? JSON.parse(String(init.body)) : null, testa: (init?.headers ?? {}) as Record<string, string> };
    chiamate.push(c);
    return Promise.resolve(new Response(JSON.stringify(risposte(c)), { status: 200 }));
  };
  return { chiamate, cloud: { base: 'https://cloud/pos', hotelKey: 'k', locale: 'L1', fetch: fetch as unknown as typeof globalThis.fetch } };
}
function base() {
  const db = apri(':memory:'); creaSchema(db);
  db.exec(`insert into pos_locale (id, nome, aggiornato_il) values ('L1', 'Bistrot', '2026-09-04T10:00:00Z');
    insert into pos_zona (id, locale, nome, aggiornato_il) values ('Z1', 'L1', 'Interno', '2026-09-04T10:00:00Z');
    insert into pos_tavolo (id, zona, nome, aggiornato_il) values ('T7', 'Z1', 'Tavolo 7', '2026-09-04T10:00:00Z');
    insert into pos_conto (id, tavolo, tipo, coperti, stato, aperto_il, aggiornato_il) values ('C1', 'T7', 'esterno', 2, 'aperto', '2026-09-04T10:00:00Z', '2026-09-04T10:00:00Z');
    insert into pos_riga (id, conto, nome, quantita, prezzo_listino_cent, prezzo_cent, portata, stato, creata_il, aggiornato_il) values ('r1', 'C1', 'Birra', 1, 500, 500, 'bevande', 'partita', '2026-09-04T10:00:00Z', '2026-09-04T10:00:00Z');
    insert into pos_comanda (id, conto, portata, tipo, righe, aggiornato_il) values ('K1', 'C1', 'bevande', 'comanda', '["r1"]', '2026-09-04T10:00:00Z');
    insert into pos_sessione (id, cameriere, dispositivo, scade_il, aggiornato_il) values ('S1', 'K1', 'D1', '2026-09-05T00:00:00Z', '2026-09-04T10:00:00Z');`);
  return db;
}

Deno.test('su: manda al cloud conti, righe, comande e stampe con allineato = 0, con la chiave hotel, e li segna', async () => {
  const db = base();
  const { chiamate, cloud } = cloudFinto(() => ({ esito: 'ok' }));
  assertEquals(await su(db, cloud), 4);
  assertEquals(chiamate[0].url, 'https://cloud/pos?a=allinea-su');
  assertEquals(chiamate[0].testa['x-hotel-key'], 'k');
  const corpo = chiamate[0].corpo as { conti: unknown[]; righe: unknown[]; comande: { righe: unknown }[]; sessioni: { id: string }[] };
  assertEquals([corpo.conti.length, corpo.righe.length, corpo.comande.length], [1, 1, 1]);
  assertEquals(corpo.sessioni.map((s) => s.id), ['S1'], 'anche la sessione del palmare sale: al cloud vale uguale');
  assertEquals(corpo.comande[0].righe, ['r1'], 'gli array tornano array, non testo');
  assert(!('allineato' in (corpo.conti[0] as Record<string, unknown>)), 'allineato e cosa nostra, il cloud non lo conosce');
  assertEquals(await su(db, cloud), 0, 'la seconda volta niente');
});

Deno.test('su: se il cloud non risponde niente si segna, si riprova dopo', async () => {
  const db = base();
  const cloud = { base: 'https://cloud/pos', hotelKey: 'k', locale: 'L1', fetch: (() => Promise.reject(new TypeError('rete'))) as unknown as typeof globalThis.fetch };
  assertEquals(await su(db, cloud), 0);
  assertEquals((db.prepare('select count(*) as n from pos_conto where allineato = 0').get() as { n: number }).n, 1);
});

Deno.test('giu: chiede solo il nuovo (da = ultimo_giu), scrive menu, tavoli, personale e ricorda adesso', async () => {
  const db = apri(':memory:'); creaSchema(db);
  db.prepare("insert into pos_meta (chiave, valore) values ('ultimo_giu', '2026-09-01T00:00:00Z')").run();
  const { chiamate, cloud } = cloudFinto(() => ({
    adesso: '2026-09-04T10:00:01Z',
    locale: [{ id: 'L1', nome: 'Bistrot', reparto: 'F&B', stampante_cucina: null, stampante_bar: null, aggiornato_il: '2026-09-04T10:00:00Z' }],
    zona: [], tavolo: [],
    categoria: [{ id: 'C1', nome: 'Primi', posizione: 0, colore: null, stampante: 'cucina', portata: 'primi', sotto: null, note_rapide: ['senza glutine'], fidra_id: null, attiva: true, aggiornato_il: '2026-09-04T10:00:00Z' }],
    articolo: [], variante: [], preferito: [],
    cameriere: [{ id: 'K1', nome: 'Anna', codice: '11', pin_hash: 'x', ruolo: 'cameriere', storni: false, bloccato: false, aggiornato_il: '2026-09-04T10:00:00Z' }],
    dispositivo: [], stampe: [],
  }));
  await giu(db, cloud);
  assert(chiamate[0].url.includes('a=allinea-giu') && chiamate[0].url.includes('da=2026-09-01T00%3A00%3A00Z') && chiamate[0].url.includes('locale=L1'), chiamate[0].url);
  assertEquals((db.prepare('select note_rapide from pos_categoria').get() as { note_rapide: string }).note_rapide, JSON.stringify(['senza glutine']));
  assertEquals((db.prepare('select storni from pos_cameriere').get() as { storni: number }).storni, 0);
  assertEquals((db.prepare("select valore from pos_meta where chiave = 'ultimo_giu'").get() as { valore: string }).valore, '2026-09-04T10:00:01Z');
});

Deno.test('giu: una stampa nata nel cloud entra in coda locale gia allineata (non risale); battito manda locale-vivo', async () => {
  const db = apri(':memory:'); creaSchema(db);
  db.exec("insert into pos_locale (id, nome, aggiornato_il) values ('L1', 'Bistrot', '2026-09-04T10:00:00Z')");
  const { chiamate, cloud } = cloudFinto((c) => c.url.includes('allinea-giu')
    ? { adesso: 'x', locale: [], zona: [], tavolo: [], categoria: [], articolo: [], variante: [], preferito: [], cameriere: [], dispositivo: [],
      postazione: [{ locale: 'L1', stampante: 'bar', nome: 'Banco', schermo: true, stampa_sempre: false, ripiego_s: 30, chiave_hash: null, aggiornato_il: '2026-09-06T00:00:00Z' }],
      sessione: [{ id: 'S9', cameriere: 'K1', dispositivo: 'D1', scade_il: '2026-09-05T00:00:00Z', aggiornato_il: '2026-09-04T10:00:00Z' }],
      stampe: [{ id: 'P9', locale: 'L1', stampante: 'cucina', testo: 'T', stato: 'da_stampare', creato_il: '2026-09-04T10:00:00Z', stampata_il: null, stampata_da: null, errore: null, aggiornato_il: '2026-09-04T10:00:00Z' }] }
    : { esito: 'ok' });
  await giu(db, cloud);
  assertEquals(db.prepare('select id, stato, allineato from pos_stampa').all(), [{ id: 'P9', stato: 'da_stampare', allineato: 1 }]);
  assertEquals((db.prepare('select locale, stampante, nome, schermo from pos_postazione').get() as { schermo: number }).schermo, 1, 'la postazione scende col suo schermo');
  assertEquals(db.prepare('select id, allineato from pos_sessione').all(), [{ id: 'S9', allineato: 1 }], 'la sessione nata nel cloud scende gia allineata: non risale');
  await battito(cloud);
  const b = chiamate.find((c) => c.url.includes('locale-vivo'))!;
  assertEquals(b.corpo, { locale: 'L1' });
});

Deno.test('su: anche i conti tolti qui salgono, e restano in lista finche il cloud non li ha tolti', async () => {
  /* cancellare non e' scrivere: una riga sparita non sale con le altre */
  const db = base();
  db.exec("delete from pos_conto where id = 'C1'; delete from pos_riga; delete from pos_comanda; delete from pos_sessione;");
  db.exec("insert into pos_eliminato (id, tabella, quando) values ('C1', 'pos_conto', '2026-09-04T11:00:00Z');");
  const { chiamate, cloud } = cloudFinto(() => ({ esito: 'ok' }));
  assertEquals(await su(db, cloud), 0, 'niente da scrivere, ma la cancellazione parte lo stesso');
  assertEquals((chiamate[0].corpo as { conti_eliminati: string[] }).conti_eliminati, ['C1']);
  assertEquals(db.prepare('select count(*) as n from pos_eliminato').get(), { n: 0 }, 'detto al cloud, si dimentica');
});

Deno.test('su: se il cloud non risponde, i conti tolti restano da dire', async () => {
  const db = base();
  db.exec("delete from pos_conto where id = 'C1'; delete from pos_riga; delete from pos_comanda; delete from pos_sessione;");
  db.exec("insert into pos_eliminato (id, tabella, quando) values ('C1', 'pos_conto', '2026-09-04T11:00:00Z');");
  const cloud = { base: 'https://cloud/pos', hotelKey: 'k', locale: 'L1', fetch: (() => Promise.reject(new Error('giu'))) as unknown as typeof globalThis.fetch };
  assertEquals(await su(db, cloud), 0);
  assertEquals(db.prepare('select count(*) as n from pos_eliminato').get(), { n: 1 });
});
