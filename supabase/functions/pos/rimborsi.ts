/* ============================================================
   rimborsi.ts — quanto torna al cliente di un ordine dal QR. Puro.

   «Rimborsa, tutto o una parte, con Stripe come gia' fanno i buoni;
   annulla l'addebito per quelli in camera» (la proprieta', 5 settembre
   2026). Qui le regole: quanto resta da restituire, se l'importo chiesto
   va bene, lo stato dopo, l'importo di una riga, il corpo per Stripe.
   Lo prova rimborsi.test.ts.
   ============================================================ */
export type OrdineRimborsabile = { totale_cent: number; rimborsato_cent?: number | null; modo: string; stato: string; stripe_pagamento?: string | null };

/* si restituisce solo quel che e' stato pagato davvero */
const RIMBORSABILI = new Set(['pagato', 'in_cucina', 'rimborsato']);

/** Il totale meno quel che e' gia' tornato, mai sotto zero. */
export function residuoRimborso(o: OrdineRimborsabile): number {
  return Math.max(0, Math.round(Number(o.totale_cent) || 0) - Math.round(Number(o.rimborsato_cent ?? 0) || 0));
}

/** L'importo da restituire: vuoto = tutto il residuo; se no centesimi
    interi fra 1 e il residuo. Con la carta serve il pagamento Stripe. */
export function importoRimborso(o: OrdineRimborsabile, richiesto: unknown): { ok: true; cent: number } | { ok: false; errore: string } {
  if (!RIMBORSABILI.has(o.stato)) return { ok: false, errore: 'l ordine non e stato pagato: niente da restituire' };
  if (o.modo === 'carta' && !o.stripe_pagamento) return { ok: false, errore: 'manca il riferimento del pagamento Stripe' };
  const residuo = residuoRimborso(o);
  if (residuo <= 0) return { ok: false, errore: 'e gia stato restituito tutto' };
  if (richiesto === undefined || richiesto === null || richiesto === '') return { ok: true, cent: residuo };
  const n = Number(richiesto);
  if (!Number.isInteger(n) || n <= 0) return { ok: false, errore: 'importo in centesimi interi, sopra lo zero' };
  if (n > residuo) return { ok: false, errore: `si possono restituire al massimo ${(residuo / 100).toFixed(2)} €` };
  return { ok: true, cent: n };
}

/** Tutto tornato = «rimborsato»; altrimenti lo stato resta com'era (null). */
export function statoDopoRimborso(totale_cent: number, rimborsato_cent: number): 'rimborsato' | null {
  return rimborsato_cent >= totale_cent ? 'rimborsato' : null;
}

export const importoRiga = (r: { quantita: number; prezzo_cent: number }): number => Math.round(Number(r.quantita) * Number(r.prezzo_cent));

/** POST /v1/refunds: il pagamento e l'importo in centesimi. */
export const corpoRimborsoStripe = (paymentIntent: string, cent: number): Record<string, string> => ({ payment_intent: paymentIntent, amount: String(cent) });
