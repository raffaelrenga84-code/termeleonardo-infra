/* ============================================================
   bacheca.test.ts — POS · Bacheca nel back office: la bacheca all'ingresso
   scritta a mano giorno per giorno (6 settembre 2026).
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const B = Deno.readTextFileSync(new URL('./index.html', import.meta.url));

Deno.test('una scheda a parte, giorno per giorno: primo, secondo e il calice facoltativo; la vede anche il bistrot; niente piu sull articolo', () => {
  /* «non deve essere collegata a tutti gli articoli ma in una sezione a parte» (la proprieta', 6 settembre 2026) */
  assert(B.includes("['posBacheca', 'POS · Bacheca']") && B.includes('function vistaPosBacheca()') && B.includes('posBacheca: vistaPosBacheca'), 'la scheda');
  assert(B.includes('data-b="primo"') && B.includes('data-b="secondo"') && B.includes('data-b="calice"') && B.includes('data-bg="${i + 1}"'), 'sette righe, tre campi');
  assert(B.includes("chiama('?a=bacheca-salva', { method: 'POST', body: JSON.stringify({ righe: D.righe }) }"), 'salva con la funzione pos, tutti i locali insieme: cambiando locale non si perde niente');
  assert(B.includes('data-b="primo_estero"') && B.includes('data-b="secondo_estero"') && B.includes('maxlength="300"'), 'la riga per gli stranieri, e il tetto dei 300 caratteri si vede');
  assert(!B.includes('data-a="in_bacheca"') && !B.includes('data-a="bacheca_testo"') && B.includes('<td colspan="15">'), 'niente piu sull articolo');
  assert(B.includes("['posMenu', 'posBacheca', 'posTavoli', 'posFasce', 'posOrdiniQr']"), 'il bistrot la vede, dopo il menu');
});
