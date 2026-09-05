/* ============================================================
   comanda.test.ts — il biglietto per cucina e bar, e i byte ESC/POS.
   Larghezza 32 colonne; il titolo in doppia altezza; taglio in coda.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { escpos, testoBiglietto } from './comanda.ts';

const b = {
  tipo: 'COMANDA' as const, locale: 'Bistrot', tavolo: 'Tavolo 7', conto: 'Esterno', coperti: 2,
  portata: 'primi', ora: '20:41', cameriere: 'Anna',
  righe: [
    { quantita: 2, nome: 'Tagliatelle al ragù', variante: null, nota: 'senza glutine' },
    { quantita: 1, nome: 'Risotto', variante: 'mezza porzione', nota: null },
  ],
  noteVitto: 'Allergia noci',
};

Deno.test('il biglietto: intestazione grande, righe con quantita, variante e nota, note vitto in evidenza', () => {
  const t = testoBiglietto(b);
  const righe = t.split('\n');
  assertEquals(righe[0], 'COMANDA  PRIMI');
  assertEquals(righe[1], 'Tavolo 7  (2 cop.)  Esterno');
  assert(t.includes('20:41  Anna'));
  assert(t.includes('2 x Tagliatelle al ragù'));
  assert(t.includes('    > senza glutine'), 'la nota sta sotto la riga, rientrata');
  assert(t.includes('    + mezza porzione'), 'la variante sta sotto la riga con il piu');
  assert(t.includes('!!! Allergia noci !!!'));
  for (const r of righe) assert(r.length <= 32, `riga troppo lunga: ${r}`);
});

Deno.test('VAI e STORNO si riconoscono dalla prima riga', () => {
  assertEquals(testoBiglietto({ ...b, tipo: 'VAI' }).split('\n')[0], 'VAI  PRIMI');
  assertEquals(testoBiglietto({ ...b, tipo: 'STORNO' }).split('\n')[0], 'STORNO  PRIMI');
});

Deno.test('una riga lunga va a capo senza superare le 32 colonne', () => {
  const t = testoBiglietto({ ...b, righe: [{ quantita: 1, nome: 'Tagliata di manzo con rucola, grana e pomodorini confit', variante: null, nota: null }] });
  for (const r of t.split('\n')) assert(r.length <= 32, r);
  assert(t.includes('1 x Tagliata di manzo con'));
});

Deno.test('escpos: inizializza, titolo doppio, taglia; gli accenti passano in CP1252', () => {
  const byte = escpos('COMANDA  PRIMI\nTagliatelle al ragù\n');
  assertEquals([...byte.slice(0, 2)], [0x1b, 0x40], 'ESC @');
  assert([...byte].slice(-3).join(',') === '29,86,0', 'GS V 0 in coda: taglio');
  assert(byte.includes(0xf9), 'ù in CP1252 e 0xF9');
  assert(!byte.includes(0xc3), 'niente UTF-8 a due byte sulla stampante');
  assert([...byte].join(',').includes('27,33,48'), 'ESC ! 0x30 sul titolo');
});

Deno.test('il biglietto che esce in un altro locale dice dove portarlo', () => {
  /* «il ristorante ordina al bistro, cosi' gli portano le bevande senza
     dover chiamare telefonicamente» (la proprieta', 4 settembre 2026) */
  const t = testoBiglietto({
    tipo: 'COMANDA', locale: 'Ristorante', tavolo: 'Tavolo 5', conto: 'Camera 229', coperti: 2,
    portata: 'bevande', ora: '19:42', cameriere: 'Anna',
    righe: [{ quantita: 2, nome: 'Gin Tonic - Bombay' }],
    portareA: 'Ristorante',
  });
  const righe = t.split('\n');
  assertEquals(righe[0], 'COMANDA  BEVANDE');
  assertEquals(righe[1], '>>> PORTARE AL RISTORANTE');
  assert(righe[2].startsWith('Tavolo 5'), 'e subito sotto il tavolo');
  assert(t.includes('2 x Gin Tonic - Bombay'));
});

Deno.test('il biglietto di casa non dice niente di strano', () => {
  const t = testoBiglietto({
    tipo: 'COMANDA', locale: 'Bistrot', tavolo: 'Tavolo 7', conto: 'Esterno', coperti: 2,
    portata: 'bevande', ora: '19:42', cameriere: 'Anna', righe: [{ quantita: 1, nome: 'Birra' }],
  });
  assert(!t.includes('PORTARE'), 'si serve dove si e ordinato');
});

Deno.test('a cucina chiusa il biglietto esce al bancone con l avviso in cima, sotto il titolo', async () => {
  /* la proprieta', 5 settembre 2026: «dopo le 14:30 ogni comanda esce al bancone» */
  const { testoBiglietto: testo } = await import('./comanda.ts');
  const t = testo({ tipo: 'COMANDA', locale: 'Bistrot', tavolo: 'Tavolo 3', conto: 'Esterno', coperti: 2, portata: 'secondi', ora: '15:10', cameriere: 'Anna', righe: [{ quantita: 1, nome: 'Piadina romagnola' }], avviso: 'cucina chiusa: al bancone' });
  const righe = t.split('\n');
  assertEquals(righe[1], '>>> CUCINA CHIUSA: AL BANCONE');
  assert(!testo({ tipo: 'COMANDA', locale: 'Bistrot', tavolo: 'Tavolo 3', conto: 'Esterno', coperti: 2, portata: 'secondi', ora: '13:10', cameriere: 'Anna', righe: [{ quantita: 1, nome: 'Piadina' }] }).includes('>>>'), 'senza avviso niente');
});
