/* Test del ramo pubblico a=acquista: la validazione è l'unica
   fonte dei prezzi — quello che arriva dal browser non conta. */
import { assertEquals, assertMatch } from 'jsr:@std/assert';
import { validaAcquisto } from './acquista.ts';

Deno.test('rifiuta email mancante o malformata', () => {
  const r1 = validaAcquisto({ tipo: 'valore', valore: 100 });
  assertEquals(r1.errore, 'email non valida');
  const r2 = validaAcquisto({ tipo: 'valore', valore: 100, acquirente_email: 'pippo@' });
  assertEquals(r2.errore, 'email non valida');
});

Deno.test('rifiuta una voce di listino sconosciuta', () => {
  const r = validaAcquisto({ tipo: 'servizio', voce_id: 'xxx', acquirente_email: 'a@b.it' });
  assertEquals(r.errore, 'voce di listino sconosciuta');
});

Deno.test('rifiuta importi fuori dai limiti 25–1000', () => {
  for (const valore of [5, 24, 1001, 0, -50]) {
    const r = validaAcquisto({ tipo: 'valore', valore, acquirente_email: 'a@b.it' });
    assertEquals(r.errore, 'importo fuori dai limiti (25–1000 €)', `valore ${valore}`);
  }
});

Deno.test('accetta un buono valore e lo descrive nella lingua del buono', () => {
  const r = validaAcquisto({
    tipo: 'valore', valore: 100, lingua: 'de', acquirente_email: 'a@b.it',
    condizioni_accettate: true
  });
  assertEquals(r.errore, undefined);
  assertEquals(r.dati!.valore, 100);
  assertEquals(r.dati!.tipo, 'valore');
  assertEquals(r.dati!.voce_id, null);
  assertMatch(r.dati!.descrizione, /Wertgutschein über 100,00 €/);
});

Deno.test('per un servizio il prezzo viene dal listino, non dal browser', () => {
  const r = validaAcquisto({
    tipo: 'servizio', voce_id: 'relax25', valore: 1,   // il client mente sul prezzo
    acquirente_email: 'a@b.it', condizioni_accettate: true
  });
  assertEquals(r.errore, undefined);
  assertEquals(r.dati!.valore, 40);                     // prezzo del listino server
  assertEquals(r.dati!.voce_id, 'relax25');
  assertMatch(r.dati!.descrizione, /Massaggio relax con olio di cacao/);
});

Deno.test('lingua sconosciuta ricade su italiano', () => {
  const r = validaAcquisto({
    tipo: 'valore', valore: 50, lingua: 'xx', acquirente_email: 'a@b.it',
    condizioni_accettate: true
  });
  assertEquals(r.dati!.lingua, 'it');
  assertMatch(r.dati!.descrizione, /Buono valore di 50,00 €/);
});

Deno.test('scadenza a 12 mesi da oggi', () => {
  const r = validaAcquisto({
    tipo: 'valore', valore: 100, acquirente_email: 'a@b.it', condizioni_accettate: true
  });
  const attesa = new Date();
  attesa.setFullYear(attesa.getFullYear() + 1);
  assertEquals(r.dati!.scade_il, attesa.toISOString().slice(0, 10));
});

Deno.test('campi liberi accorciati e ripuliti', () => {
  const r = validaAcquisto({
    tipo: 'valore', valore: 100, acquirente_email: '  a@b.it  ',
    acquirente: 'x'.repeat(300), dedica: 'y'.repeat(500),
    destinatario: '  Anna  ', destinatario_email: 'z'.repeat(300) + '@c.it',
    condizioni_accettate: true
  });
  assertEquals(r.dati!.acquirente_email, 'a@b.it');
  assertEquals(r.dati!.acquirente.length, 120);
  assertEquals(r.dati!.dedica.length, 400);
  assertEquals(r.dati!.destinatario, 'Anna');
  assertEquals(r.dati!.destinatario_email.length, 160);
});

/* Le condizioni (chiusura stagionale, niente rimborso, 12 mesi) vanno
   accettate PRIMA di pagare: il controllo sta anche qui, non solo nel
   browser, altrimenti basterebbe una chiamata diretta per aggirarlo. */
Deno.test('senza accettazione delle condizioni l’acquisto non parte', () => {
  const r = validaAcquisto({ tipo: 'valore', valore: 100, acquirente_email: 'a@b.it' });
  assertEquals(r.errore, 'condizioni non accettate');
  const r2 = validaAcquisto({
    tipo: 'valore', valore: 100, acquirente_email: 'a@b.it', condizioni_accettate: 'sì'
  });
  assertEquals(r2.errore, 'condizioni non accettate');
});

Deno.test('con le condizioni accettate l’acquisto procede', () => {
  const r = validaAcquisto({
    tipo: 'valore', valore: 100, acquirente_email: 'a@b.it', condizioni_accettate: true
  });
  assertEquals(r.errore, undefined);
  assertEquals(r.dati!.valore, 100);
});
