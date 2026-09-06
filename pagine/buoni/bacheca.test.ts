/* ============================================================
   bacheca.test.ts — POS · Menu' nel back office: la spunta «bacheca» e il
   testo del giorno, per la TV all'ingresso (6 settembre 2026).
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const B = Deno.readTextFileSync(new URL('./index.html', import.meta.url));

Deno.test('sull articolo: la spunta 📺 e il testo sulla TV; il testo vuoto resta vuoto (null)', () => {
  assert(B.includes('data-a="in_bacheca"') && B.includes('data-a="bacheca_testo"'), 'i due campi');
  assert(B.includes('fra i piatti del giorno">📺</th>') && B.includes('>Testo bacheca</th>'), 'con le intestazioni');
  assert(B.includes("k === 'locale_stampa' || k === 'bacheca_testo') ? (v || null)"), 'vuoto = null, non stringa vuota');
  assert(B.includes('<td colspan="17">'), 'la riga delle traduzioni copre anche le due colonne nuove');
});
