import { assertEquals } from 'jsr:@std/assert';
import { azzeraLimite, entroIlLimite } from './limite.ts';

const ORA = 1_770_000_000_000;   // istante fisso: i test non dipendono dall'orologio

Deno.test('i primi acquisti passano, poi si chiude', () => {
  azzeraLimite();
  for (let i = 0; i < 8; i++) assertEquals(entroIlLimite('1.2.3.4', ORA), true, 'tentativo ' + i);
  assertEquals(entroIlLimite('1.2.3.4', ORA), false);
});

Deno.test('un altro indirizzo non paga per il primo', () => {
  azzeraLimite();
  for (let i = 0; i < 8; i++) entroIlLimite('1.2.3.4', ORA);
  assertEquals(entroIlLimite('5.6.7.8', ORA), true);
});

Deno.test('passata la finestra si ricomincia', () => {
  azzeraLimite();
  for (let i = 0; i < 8; i++) entroIlLimite('1.2.3.4', ORA);
  assertEquals(entroIlLimite('1.2.3.4', ORA + 9 * 60 * 1000), false, 'dentro la finestra');
  assertEquals(entroIlLimite('1.2.3.4', ORA + 11 * 60 * 1000), true, 'fuori dalla finestra');
});

Deno.test('senza indirizzo non si blocca nessuno', () => {
  azzeraLimite();
  for (let i = 0; i < 20; i++) assertEquals(entroIlLimite('', ORA), true);
});
