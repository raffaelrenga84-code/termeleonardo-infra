import { assertEquals } from 'jsr:@std/assert';
import { nasceGiaPagato } from './pagamenti.ts';

Deno.test('i pagamenti incassati in reception emettono subito il codice', () => {
  for (const p of ['contanti', 'bancomat', 'pos']) assertEquals(nasceGiaPagato(p), true, p);
});

Deno.test('il promozionale nasce già valido: è un omaggio, non c’è nulla da incassare', () => {
  assertEquals(nasceGiaPagato('promozionale'), true);
});

Deno.test('bonifico e link restano in attesa del pagamento', () => {
  for (const p of ['bonifico', 'stripe']) assertEquals(nasceGiaPagato(p), false, p);
});

Deno.test('un pagamento mancante o sconosciuto non emette nulla', () => {
  for (const p of [null, undefined, '', 'chissà']) assertEquals(nasceGiaPagato(p), false, String(p));
});
