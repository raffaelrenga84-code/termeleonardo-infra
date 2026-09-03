/* ruoli.test.ts — tre indirizzi, dominio esatto, il rimborso solo a chi
   tocca il denaro. */
import { assert, assertEquals } from 'jsr:@std/assert';
import { puoRimborsare, ruoloDi, vedeDayspa } from './ruoli.ts';

Deno.test('i tre indirizzi hanno il loro ruolo, gli altri no', () => {
  assertEquals(ruoloDi('reception@termeleonardo.com'), 'reception');
  assertEquals(ruoloDi('SPA@termeleonardo.com '), 'spa');
  assertEquals(ruoloDi('amministrazione@termeleonardo.com'), 'amministrazione');
  assertEquals(ruoloDi('altro@termeleonardo.com'), null, 'un account del dominio giusto ma non previsto non entra');
  assertEquals(ruoloDi('reception@termeleonardo.com.evil.net'), null);
  assertEquals(ruoloDi(undefined), null);
});

Deno.test('vedono tutti e tre; rimborsano reception e amministrazione', () => {
  for (const r of ['reception', 'spa', 'amministrazione'] as const) assert(vedeDayspa(r));
  assert(!vedeDayspa(null));
  assert(puoRimborsare('reception') && puoRimborsare('amministrazione'));
  assert(!puoRimborsare('spa') && !puoRimborsare(null));
});
