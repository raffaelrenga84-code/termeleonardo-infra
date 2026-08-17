import { assertEquals } from 'jsr:@std/assert';
import { differenzaBuono } from './differenza-buono.ts';

Deno.test('scelta piu cara: la differenza si paga all arrivo', () => {
  const r = differenzaBuono(65, 80);
  assertEquals(r.tipo, 'differenza');
  assertEquals(r.differenza, 15);
});

Deno.test('scelta piu economica: si avvisa del residuo, non si promette un resto', () => {
  const r = differenzaBuono(70, 40);
  assertEquals(r.tipo, 'residuo');
  assertEquals(r.differenza, 30);
});

Deno.test('stesso importo: nessun avviso', () => {
  assertEquals(differenzaBuono(65, 65).tipo, 'copre');
});

/* il prezzo dello scelto puo' mancare (voce senza prezzo, o "da 30 €"):
   non si inventa un conto, si dice che non si sa */
Deno.test('prezzo dello scelto assente: ignoto, nessun numero inventato', () => {
  for (const v of [null, undefined, 0, NaN]) {
    assertEquals(differenzaBuono(65, v as number).tipo, 'ignoto', `scelto ${v}`);
  }
});

Deno.test('valore del buono assente: ignoto', () => {
  assertEquals(differenzaBuono(null, 80).tipo, 'ignoto');
});

/* i centesimi non devono produrre 14.999999999999998 */
Deno.test('gli importi con decimali non producono code di virgola', () => {
  assertEquals(differenzaBuono(65.5, 80.2).differenza, 14.7);
});
