/* Il conto fra quanto copre il buono e quanto costa la voce scelta.
   Puro e senza rete: e' la parte dove si sbaglia coi soldi, e un errore
   qui l'ospite lo scopre alla cassa.

   `residuo` non e' un dettaglio: le condizioni stampate sul buono dicono
   che l'importo residuo non e' rimborsabile ne' riutilizzabile. Dirlo al
   momento della scelta evita un reclamo al banco. */
export type EsitoDifferenza = {
  tipo: 'copre' | 'differenza' | 'residuo' | 'ignoto';
  copre: number;
  scelto: number;
  differenza: number;
};

const numero = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
};

/* due decimali: senza questo 80.2 - 65.5 darebbe 14.699999999999999 */
const centesimi = (n: number) => Math.round(n * 100) / 100;

export function differenzaBuono(
  copre: number | null | undefined,
  scelto: number | null | undefined,
): EsitoDifferenza {
  const c = numero(copre);
  const s = numero(scelto);
  if (c === null || s === null) {
    return { tipo: 'ignoto', copre: c ?? 0, scelto: s ?? 0, differenza: 0 };
  }
  if (s > c) return { tipo: 'differenza', copre: c, scelto: s, differenza: centesimi(s - c) };
  if (s < c) return { tipo: 'residuo', copre: c, scelto: s, differenza: centesimi(c - s) };
  return { tipo: 'copre', copre: c, scelto: s, differenza: 0 };
}
