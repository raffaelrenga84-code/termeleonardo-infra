/* ============================================================
   personale.test.ts — POS · Personale nel back office, letto dal sorgente.
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const B = Deno.readTextFileSync(new URL('./index.html', import.meta.url));

Deno.test('la spunta «motivo storno» per persona, spenta per chi e nuovo', () => {
  /* «decidere che cameriere deve darmi motivazione e quale non serve; all'inizio
     lo terrei disattivato per tutti per fare pratica» (la proprieta', 6 settembre 2026) */
  assert(B.includes('data-k="storno_con_motivo"'), 'la casella');
  assert(B.includes('<th title="Se spuntato, allo storno il palmare pretende il motivo">Motivo storno</th>'), 'con la spiegazione');
  assert(B.includes('storni: false, storno_con_motivo: false, bloccato: false, nuovo: true'), 'un cameriere nuovo parte senza');
  assert(B.includes('di una riga o di tutto il tavolo il palmare pretende il motivo'), 'e si dice che vale anche per tutto il tavolo');
});
