/* ============================================================
   stampa.test.ts - i biglietti sulla LAN, dal PC del Bistrot.

   Le stampanti di cucina e bar sono sulla rete locale (9100, ESC/POS):
   il PC le raggiunge anche senza internet. Qui si prova con una
   connessione finta. Le stampanti degli scontrini non c'entrano e non
   compaiono.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { apri, creaSchema } from './db.ts';
import { giroStampe, stampa } from './stampa.ts';

Deno.test('stampa: apre la connessione, scrive tutti i byte, chiude', async () => {
  const scritto: number[] = []; let chiuso = false, dove = '';
  const finta = (o: { hostname: string; port: number }) => { dove = `${o.hostname}:${o.port}`; return Promise.resolve({
    write: (b: Uint8Array) => { scritto.push(...b); return Promise.resolve(b.length); }, close: () => { chiuso = true; } }); };
  await stampa({ host: '192.168.0.60', porta: 9100 }, new Uint8Array([1, 2, 3]), finta as never);
  assertEquals([dove, scritto, chiuso], ['192.168.0.60:9100', [1, 2, 3], true]);
});

Deno.test('giroStampe: ogni da_stampare va alla sua stampante e resta da allineare; se la stampante non risponde, errore', async () => {
  const db = apri(':memory:'); creaSchema(db);
  db.exec(`insert into pos_locale (id, nome, aggiornato_il) values ('L1', 'Bistrot', '2026-09-04T10:00:00Z');
    insert into pos_stampa (id, locale, stampante, testo, stato, creato_il, aggiornato_il, allineato) values
      ('P1', 'L1', 'cucina', 'COMANDA', 'da_stampare', '2026-09-04T10:00:00Z', '2026-09-04T10:00:00Z', 1),
      ('P2', 'L1', 'bar', 'BEVANDE', 'da_stampare', '2026-09-04T10:00:00Z', '2026-09-04T10:00:00Z', 1);`);
  const dove: string[] = [];
  const finta = (o: { hostname: string; port: number }) => {
    if (o.port === 9102) return Promise.reject(new Error('connessione rifiutata'));
    dove.push(`${o.hostname}:${o.port}`);
    return Promise.resolve({ write: (b: Uint8Array) => Promise.resolve(b.length), close: () => {} });
  };
  const n = await giroStampe(db, { cucina: '192.168.0.60:9102', bar: '192.168.0.61:9101' }, finta as never);
  assertEquals(n, 1);
  assertEquals(dove, ['192.168.0.61:9101']);
  const righe = db.prepare('select id, stato, stampata_da, allineato, errore from pos_stampa order by id').all() as Record<string, unknown>[];
  assertEquals(righe[0].stato, 'errore'); assert(String(righe[0].errore).includes('rifiutata'));
  assertEquals(righe[1], { id: 'P2', stato: 'stampata', stampata_da: 'locale', allineato: 0, errore: null });
});

Deno.test('senza indirizzo per quella stampante il biglietto resta in coda, non sparisce', async () => {
  const db = apri(':memory:'); creaSchema(db);
  db.exec(`insert into pos_locale (id, nome, aggiornato_il) values ('L1', 'Bistrot', '2026-09-04T10:00:00Z');
    insert into pos_stampa (id, locale, stampante, testo, stato, creato_il, aggiornato_il) values ('P1', 'L1', 'cucina', 'X', 'da_stampare', '2026-09-04T10:00:00Z', '2026-09-04T10:00:00Z');`);
  const n = await giroStampe(db, { bar: '192.168.0.61:9101' }, (() => Promise.reject(new Error('mai'))) as never);
  assertEquals(n, 0);
  assertEquals((db.prepare('select stato from pos_stampa').get() as { stato: string }).stato, 'da_stampare');
});
