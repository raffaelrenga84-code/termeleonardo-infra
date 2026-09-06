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

/* ---------- portate semplici (il Bistrot, 6 settembre 2026) ----------
   «il bistro non e' un vero ristorante: l'ordinazione deve arrivare tutta
   insieme; resta solo SEGUE per spezzare la comanda, con tre scelte: 5, 10,
   15 minuti» (la proprieta'). Niente antipasti/primi/secondi: tutto parte
   con l'invio, aspetta solo quello segnato «segue» — un tempo (segue_alle)
   o la chiamata del cameriere («Manda il segue»). Sulla riga: segue_min
   null = subito, 0 = a chiamata, N = tra N minuti. */
export type PortataBiglietto = Portata | 'tutto' | 'segue';
export type RigaSegue = { stato: string; segue_min?: unknown; segue_alle?: unknown };

/** I minuti scelti nel back office («5,10,15»): interi fra 1 e 180, senza doppioni, in ordine. */
export function minutiSegue(testo: unknown): number[] {
  const n = String(testo ?? '').split(/[^0-9]+/).filter(Boolean).map(Number).filter((x) => Number.isInteger(x) && x >= 1 && x <= 180);
  return [...new Set(n)].sort((a, b) => a - b);
}

/** segue_min come lo manda il palmare: null = subito; 0 = a chiamata; N minuti (al massimo 180). */
export function minutiSegueValido(x: unknown): number | null {
  if (x === null || x === undefined || x === '') return null;
  const n = Math.round(Number(x));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(180, n);
}

/** Quando parte da se': l'ora dell'invio piu' i minuti; null se subito o a chiamata. */
export function quandoSegue(inviato: string | Date, minuti: number | null): string | null {
  if (minuti === null || minuti <= 0) return null;
  return new Date(new Date(inviato).getTime() + minuti * 60000).toISOString();
}

/** Cosa parte subito e cosa aspetta, fra le righe da inviare: tutto, tranne il «segue». */
export function dividiSemplice<T extends RigaSegue>(righe: T[]): { subito: T[]; attesa: T[] } {
  const da = righe.filter((r) => r.stato === 'da_inviare');
  return { subito: da.filter((r) => minutiSegueValido(r.segue_min) === null), attesa: da.filter((r) => minutiSegueValido(r.segue_min) !== null) };
}

/** «Manda il segue»: il gruppo in attesa da far partire — prima quello a
    chiamata, se no quello col tempo piu' vicino. Vuoto se niente aspetta. */
export function gruppoSegue<T extends RigaSegue>(righe: T[]): T[] {
  const inAttesa = righe.filter((r) => r.stato === 'inviata');
  const aChiamata = inAttesa.filter((r) => !r.segue_alle);
  if (aChiamata.length) return aChiamata;
  const tempi = inAttesa.map((r) => String(r.segue_alle)).sort();
  return tempi.length ? inAttesa.filter((r) => String(r.segue_alle) === tempi[0]) : [];
}

/** Le righe in attesa il cui tempo e' scaduto: partono da sole. */
export function segueScaduti<T extends RigaSegue>(righe: T[], quando: Date): T[] {
  return righe.filter((r) => r.stato === 'inviata' && !!r.segue_alle && new Date(String(r.segue_alle)).getTime() <= quando.getTime());
}
