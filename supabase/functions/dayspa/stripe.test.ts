/* ============================================================
   stripe.test.ts — il link a uso singolo, la firma del webhook.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { dividi, firmaValida, parametriLink } from './stripe.ts';

Deno.test('il link e a uso singolo, porta il numero nei metadati e torna alla pagina di grazie', () => {
  const p = parametriLink({
    numero: 'DS-2026-0007', descrizione: 'Ingresso Day Spa · sabato 12 settembre · 2 persone', importoCent: 9000,
    redirect: 'https://www.hoteltermeleonardo.com/dayspa/?grazie=DS-2026-0007',
  });
  assertEquals(p['restrictions[completed_sessions][limit]'], '1', 'senza, chi ricarica paga due volte');
  assertEquals(p['metadata[numero]'], 'DS-2026-0007');
  assertEquals(p['payment_intent_data[metadata][numero]'], 'DS-2026-0007');
  assertEquals(p['after_completion[type]'], 'redirect');
  assertEquals(p.unit_amount, '9000');
  assertEquals(p.currency, 'eur');
  assert(p['product_data[name]'].startsWith('Ingresso Day Spa'));
});

Deno.test('dividi separa cio che va al prezzo da cio che va al link', () => {
  const { prezzo, link } = dividi(parametriLink({ numero: 'DS-2026-0001', descrizione: 'x', importoCent: 100, redirect: 'https://x' }));
  assertEquals(Object.keys(prezzo).sort(), ['currency', 'product_data[name]', 'unit_amount']);
  assert(!('unit_amount' in link) && 'metadata[numero]' in link);
});

async function firma(segreto: string, t: string, corpo: string): Promise<string> {
  const chiave = await crypto.subtle.importKey('raw', new TextEncoder().encode(segreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const f = await crypto.subtle.sign('HMAC', chiave, new TextEncoder().encode(`${t}.${corpo}`));
  return Array.from(new Uint8Array(f)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.test('la firma del webhook: giusta passa, sbagliata no, assente no, vecchia no', async () => {
  const segreto = 'whsec_prova';
  const corpo = '{"id":"evt_1"}';
  const t = '1700000000';
  const adesso = Number(t) * 1000 + 1000;
  assert(await firmaValida(corpo, `t=${t},v1=${await firma(segreto, t, corpo)}`, segreto, adesso));
  assert(!(await firmaValida(corpo, `t=${t},v1=${'0'.repeat(64)}`, segreto, adesso)));
  assert(!(await firmaValida(corpo, null, segreto, adesso)));
  assert(!(await firmaValida(corpo, `t=${t},v1=${await firma(segreto, t, corpo)}`, undefined, adesso)), 'senza segreto non si accetta niente');
  assert(!(await firmaValida(corpo, `t=${t},v1=${await firma(segreto, t, corpo)}`, segreto, adesso + 10 * 60 * 1000)), 'un evento di dieci minuti fa e un rinvio');
});
