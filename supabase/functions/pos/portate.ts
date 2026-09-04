/* ============================================================
   portate.ts — l'ordine delle portate e la regola dell'invio.

   «Antipasto prima; poi, dopo 15 minuti o quando decide il cameriere, la
   pasta» (la proprieta', 4 settembre 2026): all'invio escono subito le
   bevande e la portata di cibo piu' bassa fra quelle da inviare; le altre
   restano in attesa e partono con «Vai», una per volta, in ordine.
   Modulo puro: lo prova portate.test.ts, lo usano la funzione e il server
   locale sul PC del Bistrot.
   ============================================================ */
export const PORTATE = ['bevande', 'antipasti', 'primi', 'secondi', 'dolci'] as const;
export type Portata = typeof PORTATE[number];
type Riga = { portata: Portata; stato: string };

export const ordine = (p: Portata): number => PORTATE.indexOf(p);

/** Cosa parte subito e cosa aspetta, fra le righe ancora da inviare. */
export function dividi(righe: Riga[]): { subito: Portata[]; attesa: Portata[] } {
  const daInviare = [...new Set(righe.filter((r) => r.stato === 'da_inviare').map((r) => r.portata))]
    .sort((a, b) => ordine(a) - ordine(b));
  const cibo = daInviare.filter((p) => p !== 'bevande');
  const subito: Portata[] = [];
  if (daInviare.includes('bevande')) subito.push('bevande');
  if (cibo.length) subito.push(cibo[0]);
  return { subito, attesa: cibo.slice(1) };
}

/** La prossima portata in attesa (stato «inviata»), la piu' bassa; null se nessuna. */
export function prossima(righe: Riga[]): Portata | null {
  const inAttesa = righe.filter((r) => r.stato === 'inviata').map((r) => r.portata).sort((a, b) => ordine(a) - ordine(b));
  return inAttesa[0] ?? null;
}
