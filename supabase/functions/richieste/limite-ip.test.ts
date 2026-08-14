/* Test del freno in memoria per indirizzo IP usato dall'azione pubblica
   a=disponibilita. Il tempo si passa da fuori (il secondo argomento di
   `permesso`) cosi' il test non deve davvero aspettare che una finestra
   scorra. */
import { assertEquals } from 'jsr:@std/assert';
import { creaFrenoIp } from './limite-ip.ts';

Deno.test('il freno scatta oltre il tetto nella stessa finestra', () => {
  const permesso = creaFrenoIp(3, 60_000);
  const ip = '203.0.113.5';
  assertEquals(permesso(ip, 1_000), true);
  assertEquals(permesso(ip, 1_001), true);
  assertEquals(permesso(ip, 1_002), true);
  /* la quarta chiamata nella stessa finestra supera il tetto di 3 */
  assertEquals(permesso(ip, 1_003), false);
  assertEquals(permesso(ip, 1_004), false);
});

Deno.test('indirizzi IP diversi hanno conteggi separati', () => {
  const permesso = creaFrenoIp(1, 60_000);
  assertEquals(permesso('1.1.1.1', 0), true);
  assertEquals(permesso('1.1.1.1', 1), false);
  /* un altro IP non paga il conto del primo */
  assertEquals(permesso('2.2.2.2', 1), true);
});

Deno.test('la finestra scorre: le chiamate vecchie escono dal conteggio', () => {
  const permesso = creaFrenoIp(2, 1_000);
  const ip = '198.51.100.9';
  assertEquals(permesso(ip, 0), true);
  assertEquals(permesso(ip, 100), true);
  assertEquals(permesso(ip, 200), false);
  /* oltre la finestra le prime due chiamate non contano piu' */
  assertEquals(permesso(ip, 1_200), true);
});
