/* ============================================================
   pagamenti.ts — come si paga un conto. Puro: lo prova pagamenti.test.ts.

   Un conto si paga in una volta, in parti uguali («dividere il conto fra
   persone al tavolo») o un pezzo per volta, e i contanti hanno il resto
   («strumenti aggiuntivi per incassare, dare resto» — la proprieta',
   4-5 settembre 2026). Ogni pagamento e' una riga di pos_pagamento; il
   conto si chiude da solo quando i pagamenti coprono il totale.

   «In camera» NON e' un pagamento: e' un addebito, e resta la strada di
   prima (chiudi con modo camera, tutto il conto).
   ============================================================ */

export type Pagamento = { modo?: string | null; importo_cent: number };

/** Il totale in n parti uguali; i centesimi che avanzano sulle prime. */
export function quote(totaleCent: number, n: number): number[] {
  const parti = Math.max(1, Math.floor(Number(n) || 0));
  const tot = Math.max(0, Math.round(Number(totaleCent) || 0));
  const base = Math.floor(tot / parti), avanzo = tot - base * parti;
  return Array.from({ length: parti }, (_, i) => base + (i < avanzo ? 1 : 0));
}

/** Quanto resta da pagare, mai sotto zero. */
export function residuo(totaleCent: number, pagamenti: { importo_cent: number }[]): number {
  const pagato = pagamenti.reduce((t, p) => t + (Math.round(Number(p.importo_cent)) || 0), 0);
  return Math.max(0, Math.round(Number(totaleCent) || 0) - pagato);
}

/** Un importo si accetta se e' intero, positivo e non passa il dovuto. */
export function importoValido(importoCent: unknown, residuoCent: number): boolean {
  const n = Number(importoCent);
  return Number.isInteger(n) && n > 0 && n <= residuoCent;
}

/** Come si segna il conto chiuso: contanti, carta, o misto se tutti e due. */
export function chiusoCome(pagamenti: { modo?: string | null }[]): 'contanti' | 'carta' | 'misto' {
  const modi = new Set(pagamenti.map((p) => p.modo));
  if (modi.has('contanti') && modi.has('carta')) return 'misto';
  if (modi.has('carta')) return 'carta';
  return 'contanti';
}

/** Il resto da dare: quanto ha dato meno quanto doveva, se ha dato di piu'. */
export function resto(ricevutoCent: unknown, dovutoCent: number): number {
  const r = Number(ricevutoCent);
  if (!Number.isFinite(r)) return 0;
  return Math.max(0, Math.round(r) - Math.round(Number(dovutoCent) || 0));
}
