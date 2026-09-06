/* freno-errori.test.ts — pieno/segna: si contano solo gli errori (revisione del 6 settembre 2026) */
import { assert } from 'jsr:@std/assert';
import { creaFreno } from './freno.ts';

Deno.test('pieno e segna: si contano solo gli errori, e a tetto raggiunto si aspetta la finestra', () => {
  const f = creaFreno(3, 1000);
  assert(!f.pieno('a', 0));
  f.segna('a', 0); f.segna('a', 10);
  assert(!f.pieno('a', 20), 'due errori: si prova ancora');
  f.segna('a', 30);
  assert(f.pieno('a', 40), 'tre errori: pieno');
  assert(!f.pieno('b', 40), 'un altro no');
  assert(!f.pieno('a', 1031), 'passata la finestra si riprova');
  assert(!f.pieno('', 0), 'senza chiave non si discrimina');
  f.segna('', 0);
  assert(!f.pieno('', 0));
});
