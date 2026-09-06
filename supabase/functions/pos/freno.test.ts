/* ============================================================
   freno.test.ts — il freno dell'elenco dei tavoli.

   L'elenco («dove e' seduto?») si apre da ovunque, ma consegna la firma
   di ogni tavolo: senza un tetto, chi vuole se lo porta via a raffica.
   Il tetto e' per indirizzo e non tocca chi e' sulla rete dell'hotel,
   dove tutti gli ospiti escono dallo stesso indirizzo.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { creaFreno } from './freno.ts';

Deno.test('il freno conta per indirizzo, dentro la finestra', () => {
  const f = creaFreno(3, 1000);
  const ora = 1_000_000;
  for (let i = 0; i < 3; i++) assert(f.entroIlLimite("1.2.3.4", ora + i), "passaggio " + i);
  assertEquals(f.entroIlLimite("1.2.3.4", ora + 3), false, "il quarto no");
  assertEquals(f.entroIlLimite("9.9.9.9", ora + 3), true, "un altro indirizzo non c entra");
  assertEquals(f.entroIlLimite("1.2.3.4", ora + 2000), true, "passata la finestra si riparte");
});

Deno.test('senza indirizzo non si discrimina, e la memoria non cresce senza fine', () => {
  const f = creaFreno(1, 1000);
  assert(f.entroIlLimite("", 1) && f.entroIlLimite("", 2), "senza indirizzo passa sempre");
  for (let i = 0; i < 600; i++) f.entroIlLimite("10.0." + Math.floor(i / 256) + "." + (i % 256), 1000);
  assert(f.quanti(3000) === 0, "gli indirizzi vecchi si dimenticano");
  f.azzera();
  assertEquals(f.quanti(1000), 0);
});
