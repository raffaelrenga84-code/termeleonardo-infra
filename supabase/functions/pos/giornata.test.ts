/* ============================================================
   giornata.test.ts — la cassa di fine giornata, dai conti chiusi.

   «il riepilogo di fine giornata (incassato per cameriere, per
   contanti/carta/camera, articoli piu' venduti)» (la proprieta', 4
   settembre 2026).
   ============================================================ */
import { assertEquals } from 'jsr:@std/assert';
import { riepilogo } from './giornata.ts';

const nomi = { anna: 'Anna', luca: 'Luca' };
const conti = [
  { id: 'c1', chiuso_come: 'contanti', chiuso_da: 'anna', coperti: 2 },
  { id: 'c2', chiuso_come: 'carta', chiuso_da: 'anna', coperti: 3 },
  { id: 'c3', chiuso_come: 'camera', chiuso_da: 'luca', coperti: 1, camera: '229' },
];
const righe = [
  { conto: 'c1', nome: 'Spritz', quantita: 2, prezzo_cent: 600, stato: 'partita' },
  { conto: 'c1', nome: 'Toast', quantita: 1, prezzo_cent: 700, stato: 'partita' },
  { conto: 'c2', nome: 'Spritz', quantita: 3, prezzo_cent: 600, stato: 'partita' },
  { conto: 'c2', nome: 'Birra', quantita: 1, prezzo_cent: 500, stato: 'stornata', motivo_storno: 'cambiato idea', stornata_da: 'anna' },
  { conto: 'c3', nome: 'Caffe', quantita: 2, prezzo_cent: 150, stato: 'partita' },
];

Deno.test('incassato per modo: contanti e carta sono incasso, la camera e un addebito', () => {
  const g = riepilogo({ conti, righe, nomi });
  assertEquals(g.per_modo, { contanti: 1900, carta: 1800, camera: 300 });
  assertEquals(g.incasso_cent, 3700, 'contanti + carta');
  assertEquals(g.camera_cent, 300);
  assertEquals(g.totale_cent, 4000);
  assertEquals(g.conti, 3);
  assertEquals(g.coperti, 6);
});

Deno.test('per cameriere: chi ha chiuso il conto, dal piu grosso', () => {
  const g = riepilogo({ conti, righe, nomi });
  assertEquals(g.per_cameriere, [
    { id: 'anna', nome: 'Anna', conti: 2, totale_cent: 3700 },
    { id: 'luca', nome: 'Luca', conti: 1, totale_cent: 300 },
  ]);
});

Deno.test('gli articoli piu venduti, sommati per nome, senza gli storni', () => {
  const g = riepilogo({ conti, righe, nomi });
  assertEquals(g.articoli[0], { nome: 'Spritz', quantita: 5, totale_cent: 3000 });
  assertEquals(g.articoli.map((a) => a.nome), ['Spritz', 'Caffe', 'Toast']);
  assertEquals(g.articoli.some((a) => a.nome === 'Birra'), false);
});

Deno.test('gli storni si vedono a parte, col motivo e chi li ha fatti', () => {
  const g = riepilogo({ conti, righe, nomi });
  assertEquals(g.storni, [{ nome: 'Birra', quantita: 1, totale_cent: 500, motivo: 'cambiato idea', da: 'Anna' }]);
  assertEquals(g.storni_cent, 500);
});

Deno.test('una giornata vuota non rompe niente', () => {
  const g = riepilogo({ conti: [], righe: [], nomi: {} });
  assertEquals(g.totale_cent, 0);
  assertEquals(g.per_cameriere, []);
  assertEquals(g.articoli, []);
});

Deno.test('un cameriere di cui non si sa il nome resta col suo codice', () => {
  const g = riepilogo({ conti: [{ id: 'c9', chiuso_come: 'contanti', chiuso_da: 'x9', coperti: 1 }], righe: [{ conto: 'c9', nome: 'Acqua', quantita: 1, prezzo_cent: 200, stato: 'partita' }], nomi: {} });
  assertEquals(g.per_cameriere[0].nome, 'x9');
});
