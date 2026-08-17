import { assertEquals } from 'jsr:@std/assert';
import { codiceDaUrl } from './buono-url.js';
import { differenzaBuono as dalServer } from '../../supabase/functions/richieste/differenza-buono.ts';
import { differenzaBuono as dallaPagina } from './buono-url.js';

Deno.test('il codice si legge dall indirizzo, ripulito', () => {
  assertEquals(codiceDaUrl('?buono=leo-abc-123'), 'LEO-ABC-123');
  assertEquals(codiceDaUrl('?buono=  LEO-ABC-123  '), 'LEO-ABC-123');
});

Deno.test('quello che non e un codice viene scartato', () => {
  for (const q of ['', '?buono=', '?buono=<script>', '?buono=' + 'A'.repeat(200), '?altro=x']) {
    assertEquals(codiceDaUrl(q), '', q);
  }
});

/* Le due implementazioni del conto devono dire la stessa cosa: una sbaglia
   e l'ospite legge una cifra sulla pagina e ne sente un'altra alla cassa. */
Deno.test('il conto della pagina combacia con quello del server', () => {
  for (const [c, s] of [[65, 80], [70, 40], [65, 65], [0, 80], [65, 0], [65.5, 80.2]]) {
    assertEquals(dallaPagina(c, s), dalServer(c, s), `copre ${c}, scelto ${s}`);
  }
});
