/* La finestra e il pulsante «Disponibilita e prezzi» sono fissi sullo
   schermo di ogni pagina di Fidra: in stampa (il conto cure, 4 settembre
   2026) il pulsante usciva come un riquadro vuoto in fondo al foglio.
   In stampa non deve esistere. */
import { assert } from 'jsr:@std/assert';
const S = Deno.readTextFileSync(new URL('./fidra-disponibilita.js', import.meta.url));
Deno.test('in stampa il pulsante e la finestra della disponibilita spariscono', () => {
  const stampa = S.slice(S.indexOf('@media print'));
  assert(S.includes('@media print'), 'manca la regola di stampa');
  assert(stampa.includes('#leoDispBtn') && stampa.includes('#leoDispWrap') && stampa.includes('display:none'), 'nasconde pulsante e finestra');
  /* e la regola deve esistere gia' quando c'e' solo il pulsante, non solo dopo aver aperto il pannello */
  const nascita = S.slice(S.indexOf("b.id = 'leoDispBtn'") - 700, S.indexOf("b.id = 'leoDispBtn'"));
  assert(nascita.includes('leoDispStampa') && nascita.includes('@media print'), 'la regola di stampa nasce col pulsante');
});
