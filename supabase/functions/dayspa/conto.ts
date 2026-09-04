/* ============================================================
   conto.ts — il conto camera come lo manda Fidra, ridotto a quello che
   il totem mostra. Modulo puro: lo prova conto.test.ts.

   La forma in ingresso e' quella che il totem di hldv legge nel suo
   codice (room, chunks, total, caparra, outstanding, appointments,
   locale), vista dal vivo il 4 settembre 2026 con la tessera 1466: i
   totali arrivano come testo all'inglese («2,393.50»), le righe come
   numeri, gli appuntamenti con `scheduled_at` ISO in UTC. Tutto e'
   difensivo: un campo che manca diventa vuoto, un importo che non si
   legge resta com'e'. La pagina del totem riceve solo questo riassunto,
   mai la risposta grezza.
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

/** Da «2,393.50», «2.393,50», «1,250», «35.5», 180 a un numero; NaN se non si legge.
    Con tutti e due i separatori, l'ultimo e' quello dei decimali. Con la
    sola virgola seguita da esattamente tre cifre sono migliaia; altrimenti
    la virgola e' il decimale. Il solo punto e' sempre il decimale (Fidra
    scrive all'inglese). */
function numero(v: unknown): number {
  if (typeof v === 'number') return v;
  const s = testo(v).trim().replace(/[^\d,.-]/g, '');
  if (!s) return NaN;
  const uv = s.lastIndexOf(','), up = s.lastIndexOf('.');
  let pulito: string;
  if (uv >= 0 && up >= 0) pulito = uv > up ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (uv >= 0) pulito = /,\d{3}$/.test(s) && s.indexOf(',') === uv ? s.replace(',', '') : s.replace(',', '.');
  else pulito = s;
  return Number(pulito);
}

/** 180, «2,393.50», «35.5» → «180,00», «2.393,50», «35,50»; vuoto se manca; com'e' se non e' un numero. */
export function importo(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  const n = numero(v);
  if (!Number.isFinite(n)) return testo(v);
  /* a mano, non con toLocaleString: per l'italiano l'ICU non raggruppa le
     migliaia sotto le cinque cifre e scrive «2393,50» */
  const [intero, decimali] = Math.abs(n).toFixed(2).split('.');
  const conPunti = intero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (n < 0 ? '-' : '') + conPunti + ',' + decimali;
}

/** «2026-09-03T11:30:00.000000Z» → «03/09 13:30» (ora di Roma); com'e' se non e' una data. */
export function quando(iso: unknown): string {
  const s = testo(iso);
  const d = new Date(s);
  if (!s || Number.isNaN(d.getTime())) return s;
  const parti = new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const p = (t: string) => parti.find((x) => x.type === t)?.value ?? '';
  return `${p('day')}/${p('month')} ${p('hour')}:${p('minute')}`;
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
    return { quando: quando(x.scheduled_at), tipo: testo(x.type), operatore: testo(x.operator_name), fatto: !!x.completed };
  });
  return {
    camera: testo(d.room), lingua, righe,
    lordo: importo(d.total), acconto: importo(d.caparra), daPagare: importo(d.outstanding),
    appuntamenti,
  };
}
