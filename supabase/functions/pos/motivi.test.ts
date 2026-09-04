/* ============================================================
   motivi.test.ts — senza motivo non si tocca un prezzo, non si storna.
   ============================================================ */
import { assertEquals } from 'jsr:@std/assert';
import { motivoPulito, prezzoCambiato } from './motivi.ts';

Deno.test('un motivo di due lettere non e un motivo', () => {
  assertEquals(motivoPulito(''), null);
  assertEquals(motivoPulito('   '), null);
  assertEquals(motivoPulito('ok'), null);
  assertEquals(motivoPulito(null), null);
  assertEquals(motivoPulito('  sbagliato   ordine '), 'sbagliato ordine');
  assertEquals(motivoPulito('x'.repeat(300))?.length, 200);
});

Deno.test('il motivo serve solo se il prezzo cambia davvero', () => {
  /* confermare il prezzo giusto non e' una variazione */
  assertEquals(prezzoCambiato({ prezzoListinoCent: 1400, prezzoManualeCent: 1400 }), false);
  assertEquals(prezzoCambiato({ prezzoListinoCent: 1400, prezzoManualeCent: null }), false);
  assertEquals(prezzoCambiato({ prezzoListinoCent: 1400, prezzoManualeCent: 1200 }), true);
  /* con la variante il listino e' listino piu supplemento */
  assertEquals(prezzoCambiato({ prezzoListinoCent: 1400, supplementoCent: 200, prezzoManualeCent: 1600 }), false);
  assertEquals(prezzoCambiato({ prezzoListinoCent: 1400, supplementoCent: 200, prezzoManualeCent: 1500 }), true);
  /* un articolo a prezzo libero non ha listino da cambiare */
  assertEquals(prezzoCambiato({ prezzoListinoCent: 0, prezzoManualeCent: 900, prezzoLibero: true }), false);
});
