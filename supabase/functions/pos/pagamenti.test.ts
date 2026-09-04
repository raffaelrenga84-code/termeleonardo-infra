/* ============================================================
   pagamenti.test.ts — un conto si paga in una volta, in parti uguali,
   o un pezzo per volta; e i contanti hanno il resto.

   «dividere il conto fra persone al tavolo» e «strumenti aggiuntivi per
   incassare, dare resto» (la proprieta', 4-5 settembre 2026).
   ============================================================ */
import { assertEquals } from 'jsr:@std/assert';
import { chiusoCome, importoValido, quote, residuo, resto } from './pagamenti.ts';

Deno.test('parti uguali: i centesimi che avanzano vanno sulle prime parti', () => {
  assertEquals(quote(1000, 3), [334, 333, 333]);
  assertEquals(quote(1000, 4), [250, 250, 250, 250]);
  assertEquals(quote(4550, 2), [2275, 2275]);
  assertEquals(quote(4551, 2), [2276, 2275]);
  assertEquals(quote(1000, 1), [1000]);
  /* zero o meno parti non hanno senso: una sola */
  assertEquals(quote(1000, 0), [1000]);
  assertEquals(quote(0, 3), [0, 0, 0]);
});

Deno.test('quanto resta da pagare, mai sotto zero', () => {
  assertEquals(residuo(4550, []), 4550);
  assertEquals(residuo(4550, [{ importo_cent: 2275 }]), 2275);
  assertEquals(residuo(4550, [{ importo_cent: 2275 }, { importo_cent: 2275 }]), 0);
  assertEquals(residuo(4550, [{ importo_cent: 5000 }]), 0);
});

Deno.test('un importo vale se e positivo e non passa il dovuto', () => {
  assertEquals(importoValido(1000, 2275), true);
  assertEquals(importoValido(2275, 2275), true);
  assertEquals(importoValido(2276, 2275), false);
  assertEquals(importoValido(0, 2275), false);
  assertEquals(importoValido(-5, 2275), false);
  assertEquals(importoValido(10.5, 2275), false, 'centesimi interi');
});

Deno.test('come si e chiuso: contanti, carta, o misto se tutti e due', () => {
  assertEquals(chiusoCome([{ modo: 'contanti' }]), 'contanti');
  assertEquals(chiusoCome([{ modo: 'carta' }, { modo: 'carta' }]), 'carta');
  assertEquals(chiusoCome([{ modo: 'contanti' }, { modo: 'carta' }]), 'misto');
  assertEquals(chiusoCome([]), 'contanti', 'senza pagamenti registrati vale il vecchio modo');
});

Deno.test('il resto dei contanti', () => {
  assertEquals(resto(5000, 4550), 450);
  assertEquals(resto(4550, 4550), 0);
  assertEquals(resto(4000, 4550), 0, 'se ha dato meno non c e resto: manca ancora');
  assertEquals(resto(null, 4550), 0);
});
