/* ============================================================
   portate.test.ts — la regola dell'invio a portate.

   «Antipasto prima; poi, dopo 15 minuti o quando decide il cameriere, la
   pasta» (la proprieta', 4 settembre 2026). All'invio escono subito le
   bevande e la portata di cibo piu' bassa; le altre aspettano «Vai».
   ============================================================ */
import { assertEquals } from 'jsr:@std/assert';
import { dividi, ordine, PORTATE, prossima } from './portate.ts';
const r = (portata: string, stato = 'da_inviare') => ({ portata: portata as never, stato });

Deno.test('all invio partono subito le bevande e la prima portata di cibo; il resto aspetta', () => {
  const righe = [r('bevande'), r('antipasti'), r('primi'), r('dolci')];
  assertEquals(dividi(righe), { subito: ['bevande', 'antipasti'], attesa: ['primi', 'dolci'] });
});

Deno.test('senza antipasti parte la portata di cibo piu bassa che c e', () => {
  assertEquals(dividi([r('secondi'), r('primi'), r('bevande')]), { subito: ['bevande', 'primi'], attesa: ['secondi'] });
});

Deno.test('solo bevande: parte tutto, niente in attesa', () => {
  assertEquals(dividi([r('bevande')]), { subito: ['bevande'], attesa: [] });
});

Deno.test('le righe gia partite o stornate non contano', () => {
  assertEquals(dividi([r('antipasti', 'partita'), r('primi', 'stornata'), r('secondi')]), { subito: ['secondi'], attesa: [] });
});

Deno.test('prossima: la portata in attesa piu bassa, o null', () => {
  assertEquals(prossima([r('primi', 'inviata'), r('dolci', 'inviata'), r('antipasti', 'partita')]), 'primi');
  assertEquals(prossima([r('antipasti', 'partita')]), null);
  assertEquals(PORTATE.length, 5);
  assertEquals(ordine('dolci'), 4);
});
