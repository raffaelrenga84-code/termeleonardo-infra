/* ============================================================
   rimborsi.test.ts — quanto torna al cliente di un ordine dal QR.

   La proprieta', 5 settembre 2026: rimborsi tutto o in parte dal back
   office, con Stripe come i buoni; in camera si toglie dall'addebito.
   ============================================================ */
import { assertEquals } from 'jsr:@std/assert';
import { corpoRimborsoStripe, importoRiga, importoRimborso, residuoRimborso, statoDopoRimborso } from './rimborsi.ts';

const carta = { totale_cent: 2450, rimborsato_cent: 0, modo: 'carta', stato: 'in_cucina', stripe_pagamento: 'pi_1' };

Deno.test('quanto si puo ancora restituire: il totale meno quel che e gia tornato', () => {
  assertEquals(residuoRimborso(carta), 2450);
  assertEquals(residuoRimborso({ ...carta, rimborsato_cent: 1000 }), 1450);
  assertEquals(residuoRimborso({ ...carta, rimborsato_cent: 9999 }), 0, 'mai sotto zero');
});

Deno.test('l importo chiesto: vuoto = tutto il residuo; intero fra 1 e il residuo; con la carta serve il pagamento Stripe', () => {
  assertEquals(importoRimborso(carta, undefined), { ok: true, cent: 2450 });
  assertEquals(importoRimborso(carta, ''), { ok: true, cent: 2450 });
  assertEquals(importoRimborso(carta, 1000), { ok: true, cent: 1000 });
  assertEquals(importoRimborso(carta, '1000'), { ok: true, cent: 1000 });
  assertEquals(importoRimborso(carta, 2451).ok, false, 'oltre il residuo no');
  assertEquals(importoRimborso(carta, 0).ok, false);
  assertEquals(importoRimborso(carta, 12.5).ok, false, 'centesimi interi');
  assertEquals(importoRimborso({ ...carta, rimborsato_cent: 2450 }, undefined).ok, false, 'niente da restituire');
  assertEquals(importoRimborso({ ...carta, stripe_pagamento: null }, 100).ok, false, 'senza pagamento Stripe non si sa cosa restituire');
  assertEquals(importoRimborso({ ...carta, stato: 'in_attesa' }, 100).ok, false, 'un ordine mai pagato non si rimborsa');
  assertEquals(importoRimborso({ ...carta, modo: 'camera', stripe_pagamento: null }, 100), { ok: true, cent: 100 }, 'in camera si toglie dall addebito');
});

Deno.test('dopo il rimborso: tutto tornato = rimborsato, altrimenti lo stato resta', () => {
  assertEquals(statoDopoRimborso(2450, 2450), 'rimborsato');
  assertEquals(statoDopoRimborso(2450, 1000), null);
});

Deno.test('l importo di una riga e il corpo per Stripe', () => {
  assertEquals(importoRiga({ quantita: 3, prezzo_cent: 950 }), 2850);
  assertEquals(corpoRimborsoStripe('pi_1', 1000), { payment_intent: 'pi_1', amount: '1000' });
});
