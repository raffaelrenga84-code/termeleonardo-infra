/* ============================================================
   pianta.test.ts — la piantina non si schiaccia sul palmare.

   Le posizioni dei tavoli sono percentuali della pianta di Fidra, che
   e' larga (un PC). Sul Sunmi, alto e stretto, il 7% fra due tavoli
   diventa 24 px e i cerchi da 62 px si accavallano: «i tavoli si sono
   di nuovo tutti disallineati e incasinati» (la proprieta', 4 settembre
   2026). La pianta deve farsi larga quanto serve, e si scorre col dito.
   ============================================================ */
import { assertEquals } from 'jsr:@std/assert';
import { misuraPianta } from './pianta.js';

const t = (x: number, y: number) => ({ x, y });

Deno.test('sul PC, dove ci sta, la pianta resta larga quanto lo schermo', () => {
  const m = misuraPianta({ tavoli: [t(10, 10), t(50, 50), t(90, 90)], larghezza: 1380, altezzaDisponibile: 750 });
  assertEquals(m.larghezza, 1380);
  assertEquals(m.altezza, 750, 'l altezza e quella che c e, come prima');
});

Deno.test('sul palmare la pianta si allarga finche i tavoli piu vicini non si toccano piu', () => {
  /* T6..T10 di Fidra: cinque tavoli in fila al 7% l uno dall altro */
  const fila = [t(30, 50), t(37, 50), t(44, 50), t(51, 50), t(58, 50)];
  const m = misuraPianta({ tavoli: fila, larghezza: 340, altezzaDisponibile: 490, distanza: 66 });
  /* 66 px su 7% → almeno 943 px di larghezza */
  assertEquals(m.larghezza, 943);
  /* in altezza non si scorre: resta quella che c e sullo schermo */
  assertEquals(m.altezza, 490, 'mai piu alta dello spazio che c e: si scorre solo di lato');
});

Deno.test('conta la distanza vera, anche in diagonale', () => {
  /* due tavoli a 5% in orizzontale e 5% in verticale: sulla pianta 1,6:1
     la verticale pesa meno */
  const m = misuraPianta({ tavoli: [t(20, 20), t(25, 25)], larghezza: 340, altezzaDisponibile: 490, distanza: 66 });
  const dist = Math.hypot(5, 5 / 1.6);
  assertEquals(m.larghezza, Math.ceil(66 * 100 / dist));
});

Deno.test('due tavoli nello stesso punto non fanno una pianta infinita', () => {
  const m = misuraPianta({ tavoli: [t(50, 50), t(50, 50)], larghezza: 340, altezzaDisponibile: 490 });
  assertEquals(m.larghezza, 1600);
});

Deno.test('senza tavoli, o con uno solo, niente da allargare', () => {
  assertEquals(misuraPianta({ tavoli: [], larghezza: 340, altezzaDisponibile: 490 }).larghezza, 340);
  assertEquals(misuraPianta({ tavoli: [t(50, 50)], larghezza: 340, altezzaDisponibile: 490 }).larghezza, 340);
});
