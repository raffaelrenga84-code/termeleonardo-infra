/* permessi.test.ts — la tabella della spec, provata riga per riga. */
import { assertEquals } from 'jsr:@std/assert';
import { puo } from './permessi.ts';
const cam = { ruolo: 'cameriere' as const, storni: false, bloccato: false };

Deno.test('cameriere: comande si, storno solo se ammesso, prezzo e menu no', () => {
  assertEquals(puo(cam, 'comanda'), true);
  assertEquals(puo(cam, 'storno'), false);
  assertEquals(puo({ ...cam, storni: true }, 'storno'), true);
  assertEquals(puo(cam, 'prezzo'), false);
  assertEquals(puo(cam, 'menu'), false);
  assertEquals(puo(cam, 'chiusura'), false);
});

Deno.test('capo sala storna e mette prezzi, non tocca il menu; amministrazione tutto; bloccato niente', () => {
  const capo = { ruolo: 'capo_sala' as const, storni: false, bloccato: false };
  assertEquals([puo(capo, 'storno'), puo(capo, 'prezzo'), puo(capo, 'chiusura'), puo(capo, 'menu')], [true, true, true, false]);
  const amm = { ruolo: 'amministrazione' as const, storni: false, bloccato: false };
  assertEquals(puo(amm, 'menu'), true);
  assertEquals(puo({ ...amm, bloccato: true }, 'comanda'), false);
});
