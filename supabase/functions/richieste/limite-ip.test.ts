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

/* Un indirizzo che chiama una volta sola e non torna piu' non deve restare
   in memoria per sempre: la voce va buttata via, non solo ignorata quando
   la finestra e' scaduta. `dimensione()` guarda dentro alla mappa: non
   basta che il conteggio torni a "permesso", la voce deve sparire
   davvero. */
Deno.test('le voci scadute vengono rimosse dalla mappa, non solo ignorate', () => {
  const permesso = creaFrenoIp(5, 1_000);
  permesso('192.0.2.1', 0);
  assertEquals(permesso.dimensione(), 1);
  /* oltre la finestra, una chiamata qualsiasi (anche di un altro indirizzo,
     che non c'entra nulla con il primo) deve far sparire la voce scaduta */
  permesso('192.0.2.2', 5_000);
  assertEquals(permesso.dimensione(), 1);
});

/* Chi ruota gli indirizzi puo' far crescere la mappa in fretta, dentro la
   stessa finestra, prima che ci sia qualcosa di scaduto da ripulire: serve
   un tetto sulla dimensione complessiva, non solo sulle chiamate per
   singolo indirizzo. */
Deno.test('la mappa non supera il tetto di dimensione anche con molti indirizzi diversi', () => {
  const permesso = creaFrenoIp(5, 60_000, 100);
  for (let i = 0; i < 500; i++) {
    permesso(`203.0.113.${i}`, i);
  }
  assertEquals(permesso.dimensione() <= 100, true);
});
