/* Test di dataConsenso: dal booleano grezzo alla data, o a null.
   La data di riferimento si passa da fuori, come in valida.test.ts, cosi'
   il test non dipende dall'istante in cui gira. */
import { assertEquals } from 'jsr:@std/assert';
import { dataConsenso } from './consenso.ts';

const ORA = new Date('2026-08-15T10:00:00Z');

Deno.test('consenso dato (true): restituisce la data passata', () => {
  assertEquals(dataConsenso(true, ORA), ORA.toISOString());
});

Deno.test('consenso rifiutato (false): nessuna data', () => {
  assertEquals(dataConsenso(false, ORA), null);
});

Deno.test('consenso assente (undefined): nessuna data', () => {
  assertEquals(dataConsenso(undefined, ORA), null);
});

Deno.test('consenso assente (null): nessuna data', () => {
  assertEquals(dataConsenso(null, ORA), null);
});

Deno.test('la stringa "true" non e il booleano true: nessuna data', () => {
  assertEquals(dataConsenso('true', ORA), null);
});

Deno.test('il numero 1 non e il booleano true: nessuna data', () => {
  assertEquals(dataConsenso(1, ORA), null);
});

Deno.test('senza una data esplicita si usa adesso, e il risultato e vicino a ora vera', () => {
  const prima = Date.now();
  const risultato = dataConsenso(true);
  const dopo = Date.now();
  const t = new Date(risultato!).getTime();
  assertEquals(t >= prima && t <= dopo, true);
});
