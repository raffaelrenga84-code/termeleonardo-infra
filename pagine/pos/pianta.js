/* ============================================================
   pianta.js — quanto deve essere larga la piantina, puro: niente DOM.

   I tavoli hanno la posizione in percentuale della pianta di Fidra, che
   e' larga come lo schermo di un PC. Sul palmare, alto e stretto, le
   stesse percentuali schiacciano i tavoli uno sull'altro: il 7% fra due
   tavoli sono 24 px, e i cerchi da 62 px si accavallano («i tavoli si
   sono di nuovo tutti disallineati e incasinati», la proprieta', 4
   settembre 2026).

   La regola: la pianta e' larga quanto lo schermo se ci sta; se no si
   allarga fino a che i due tavoli piu' vicini stanno a `distanza` px, e
   si scorre col dito. L'altezza segue la proporzione di una pianta
   larga (1,6:1) e mai piu' di quella disponibile. Lo prova
   pianta.test.ts.
   ============================================================ */

export const PROPORZIONE = 1.6;   // larghezza / altezza di una pianta di sala
export const DISTANZA = 66;       // px fra i centri: un cerchio da 62 e un filo d'aria
export const MASSIMO = 1600;      // oltre non ha senso: due tavoli sullo stesso punto

/** @returns {{ larghezza: number, altezza: number }} in px */
export function misuraPianta({ tavoli, larghezza, altezzaDisponibile, distanza = DISTANZA, proporzione = PROPORZIONE, massimo = MASSIMO }) {
  const punti = (tavoli || []).map((t) => ({ x: Number(t.x) || 0, y: Number(t.y) || 0 }));
  /* la distanza piu' corta fra due tavoli, in «percentuali di larghezza»:
     la verticale pesa 1/proporzione perche' la pianta e' piu' larga che alta */
  let minima = Infinity;
  for (let i = 0; i < punti.length; i++) {
    for (let j = i + 1; j < punti.length; j++) {
      const d = Math.hypot(punti[i].x - punti[j].x, (punti[i].y - punti[j].y) / proporzione);
      if (d < minima) minima = d;
    }
  }
  let l = Math.max(0, Number(larghezza) || 0);
  if (minima !== Infinity) {
    const serve = minima > 0 ? Math.ceil(distanza * 100 / minima) : massimo;
    l = Math.min(massimo, Math.max(l, serve));
  }
  const alta = Math.max(0, Number(altezzaDisponibile) || 0);
  const altezza = Math.min(alta, Math.round(l / proporzione));
  return { larghezza: l, altezza };
}
