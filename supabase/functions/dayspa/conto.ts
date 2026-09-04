/* ============================================================
   conto.ts — il conto camera come lo manda Fidra, ridotto a quello che
   il totem mostra. Modulo puro: lo prova conto.test.ts.

   La forma in ingresso e' quella che il totem di hldv legge nel suo
   codice (room, chunks, total, caparra, outstanding, appointments,
   locale). Tutto e' difensivo: un campo che manca diventa vuoto, un
   importo che non si legge resta com'e'. La pagina del totem riceve solo
   questo riassunto, mai la risposta grezza.
   ============================================================ */

export type RigaConto = { quantita: string; descrizione: string; totale: string };
export type Appuntamento = { quando: string; tipo: string; operatore: string; fatto: boolean };
export type Conto = {
  camera: string; lingua: string; righe: RigaConto[];
  lordo: string; acconto: string; daPagare: string; appuntamenti: Appuntamento[];
};

const LINGUE = ['it', 'en', 'de', 'fr'];
const testo = (v: unknown): string => v === null || v === undefined ? '' : String(v);
const oggetto = (v: unknown): Record<string, unknown> =>
  (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;

/** 180, «180», «35.00» → «180,00», «35,00»; vuoto se manca; com'e' se non e' un numero. */
export function importo(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n)) return testo(v);
  return n.toFixed(2).replace('.', ',');
}

export function riassuntoConto(dati: unknown): Conto {
  const d = oggetto(dati);
  const righe: RigaConto[] = [];
  for (const gruppo of (Array.isArray(d.chunks) ? d.chunks : [])) {
    for (const r of (Array.isArray(gruppo) ? gruppo : [])) {
      const x = oggetto(r);
      righe.push({ quantita: testo(x.quantita), descrizione: testo(x.descrizione), totale: importo(x.totale) });
    }
  }
  const lingua = LINGUE.includes(testo(d.locale)) ? testo(d.locale) : 'it';
  const appuntamenti = (Array.isArray(d.appointments) ? d.appointments : []).map((a) => {
    const x = oggetto(a);
    return { quando: testo(x.scheduled_at), tipo: testo(x.type), operatore: testo(x.operator_name), fatto: !!x.completed };
  });
  return {
    camera: testo(d.room), lingua, righe,
    lordo: importo(d.total), acconto: importo(d.caparra), daPagare: importo(d.outstanding),
    appuntamenti,
  };
}
