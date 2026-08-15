import { assertEquals } from 'jsr:@std/assert';
import { daAvvisare, type RigaBuono } from './promemoria.ts';

const OGGI = new Date('2026-08-15T09:00:00Z');

const riga = (p: Partial<RigaBuono> = {}): RigaBuono => ({
  codice: 'LEO-1', stato: 'pagato', scade_il: '2026-09-14',
  riscosso_il: null, promemoria_il: null,
  destinatario_email: 'silvia@example.com', acquirente_email: 'marco@example.com',
  ...p,
});

Deno.test('trenta giorni prima: si avvisa', () => {
  assertEquals(daAvvisare([riga()], OGGI), [{ codice: 'LEO-1', email: 'silvia@example.com' }]);
});

Deno.test('trentuno giorni prima: non ancora', () => {
  assertEquals(daAvvisare([riga({ scade_il: '2026-09-15' })], OGGI), []);
});

Deno.test('ventinove giorni prima: si avvisa lo stesso, non si salta il giorno perso', () => {
  /* se il lavoro non gira un giorno, chi scadeva quel giorno non deve
     restare senza avviso per sempre */
  assertEquals(daAvvisare([riga({ scade_il: '2026-09-13' })], OGGI).length, 1);
});

Deno.test('gia scaduto: non si avvisa', () => {
  assertEquals(daAvvisare([riga({ scade_il: '2026-08-14' })], OGGI), []);
});

Deno.test('gia avvisato: non si ripete', () => {
  assertEquals(daAvvisare([riga({ promemoria_il: '2026-08-14T09:00:00Z' })], OGGI), []);
});

Deno.test('gia riscosso: non si avvisa', () => {
  assertEquals(daAvvisare([riga({ riscosso_il: '2026-07-01T10:00:00Z' })], OGGI), []);
});

Deno.test('annullato: non si avvisa', () => {
  assertEquals(daAvvisare([riga({ stato: 'annullato' })], OGGI), []);
});

Deno.test('non pagato: non si avvisa', () => {
  assertEquals(daAvvisare([riga({ stato: 'attesa' })], OGGI), []);
});

Deno.test('senza email del destinatario si scrive a chi ha comprato', () => {
  assertEquals(daAvvisare([riga({ destinatario_email: null })], OGGI),
    [{ codice: 'LEO-1', email: 'marco@example.com' }]);
});

Deno.test('senza nessun indirizzo non si manda niente, e non si esplode', () => {
  assertEquals(daAvvisare([riga({ destinatario_email: null, acquirente_email: null })], OGGI), []);
});

Deno.test('scade_il assente: si salta', () => {
  assertEquals(daAvvisare([riga({ scade_il: null })], OGGI), []);
});
