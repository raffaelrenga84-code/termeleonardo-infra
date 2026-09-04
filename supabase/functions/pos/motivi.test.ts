/* ============================================================
   motivi.test.ts — senza motivo non si tocca un prezzo, non si storna.
   ============================================================ */
import { assertEquals } from 'jsr:@std/assert';
import { motivoDelPrezzo, motivoPulito, prezzoCambiato } from './motivi.ts';

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

Deno.test('una nota scritta vale come motivo: non si spiega due volte', () => {
  /* «se c'e' una nota gia' non serve che il cameriere deve aggiungere la
     spiegazione» (la proprieta', 4 settembre 2026): la pasta senza glutine
     costa di piu', la nota dice gia' perche' */
  assertEquals(motivoDelPrezzo({ motivo: 'omaggio direzione', nota: 'senza glutine' }), 'omaggio direzione', 'quello scritto apposta vince');
  assertEquals(motivoDelPrezzo({ motivo: '', nota: 'senza glutine, al pomodoro' }), 'senza glutine, al pomodoro');
  assertEquals(motivoDelPrezzo({ motivo: null, nota: '  latte di soia ' }), 'latte di soia');
  /* una nota che non dice niente non salva nessuno */
  assertEquals(motivoDelPrezzo({ motivo: null, nota: 'no' }), null);
  assertEquals(motivoDelPrezzo({}), null);
});
