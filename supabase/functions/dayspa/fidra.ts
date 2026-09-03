/* I posti come li ha caricati la reception in Fidra, letti dall'API del
   sito precedente e tradotti nelle nostre righe.

   «Da disponibilita' puoi aggiornarla con questa:
   termeleonardo.com/it/api/1/availability» (la proprieta', 3 settembre
   2026). Finche' i posti si caricano in Fidra, da noi si leggono da li'
   invece di ribatterli. L'API risponde con una riga per giorno e
   variante: Feriale, Pre-Festivo e Festivo sono la fascia giornaliera coi
   tre tipi; Serale e' la fascia serale, e il tipo del giorno lo dice il
   calendario. `amount` sono i posti ancora liberi in Fidra, `sale_price`
   il prezzo in centesimi.

   I posti da caricare da noi sono i liberi di Fidra PIU' quelli gia'
   venduti da noi: Fidra non sa delle nostre vendite, e senza la somma
   ogni lettura cancellerebbe i nostri. Puro: la rete sta in index.ts. */
import { tipoDelGiorno, type Fascia, type Tipo } from './listino.ts';
import { dataValida } from './validazione.ts';

export const URL_FIDRA = (da: string, a: string): string =>
  `https://www.termeleonardo.com/it/api/1/availability?from_date=${da}&to_date=${a}&people=1`;

const VARIANTI: Record<string, { fascia: Fascia; tipo: Tipo | null }> = {
  'Feriale': { fascia: 'giornaliero', tipo: 'feriale' },
  'Pre-Festivo': { fascia: 'giornaliero', tipo: 'prefestivo' },
  'Festivo': { fascia: 'giornaliero', tipo: 'festivo' },
  'Serale': { fascia: 'serale', tipo: null },
};

export type RigaFidra = { giorno: string; fascia: Fascia; tipo: Tipo; posti: number; prezzo_cent: number; liberiFidra: number };

export function righeDaFidra(risposta: unknown, vendutiDaNoi: (giorno: string, fascia: Fascia) => number): RigaFidra[] {
  if (!Array.isArray(risposta)) return [];
  const out: RigaFidra[] = [];
  for (const r of risposta) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const giorno = String(o.date ?? '');
    if (!dataValida(giorno)) continue;
    const variante = o.product_variation as Record<string, unknown> | undefined;
    const v = VARIANTI[String(variante?.name ?? '')];
    if (!v) continue;
    const liberi = Number(o.amount);
    if (!Number.isInteger(liberi) || liberi < 0) continue;
    const prezzo = Number(o.sale_price);
    if (!Number.isInteger(prezzo) || prezzo <= 0) continue;
    out.push({
      giorno, fascia: v.fascia, tipo: v.tipo ?? tipoDelGiorno(giorno),
      posti: liberi + vendutiDaNoi(giorno, v.fascia), prezzo_cent: prezzo, liberiFidra: liberi,
    });
  }
  return out;
}
