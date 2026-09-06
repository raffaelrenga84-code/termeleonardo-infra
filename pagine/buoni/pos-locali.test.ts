/* ============================================================
   pos-locali.test.ts — POS · Tavoli, il riquadro dei locali nel back office.
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const B = Deno.readTextFileSync(new URL('./index.html', import.meta.url));

Deno.test('portate semplici e minuti del segue, locale per locale', () => {
  /* (la proprieta', 6 settembre 2026) */
  assert(B.includes('data-l="portate_semplici"') && B.includes('data-l="segue_minuti"'), 'la spunta e i minuti');
  assert(B.includes("el.type === 'checkbox' ? el.checked : el.dataset.l === 'segue_minuti' ? el.value.trim()"), 'la spunta resta vero/falso e i minuti vuoti restano vuoti (= solo a chiamata)');
  assert(B.includes("portate_semplici: false, segue_minuti: '5,10,15'"), 'un locale nuovo parte a portate, con 5/10/15 pronti');
});
