/* ============================================================
   menu.ts — dagli articoli di Fidra al nostro menu'.

   «Bevande al bar, e alcuni prodotti dessert della vetrinetta; cibo in
   cucina» (la proprieta', 4 settembre 2026). La regola guarda il nome
   della categoria; il back office puo' poi cambiare stampante e portata
   articolo per articolo (pos_articolo.stampante, pos_articolo.portata).

   L'importazione riceve intestazioni e righe COME LE LEGGE L'ESTENSIONE
   dalla tabella di Fidra (admin/resources/items): le colonne si
   riconoscono dal nome dell'intestazione, cosi' se Fidra cambia l'ordine
   delle colonne non cambia nulla qui. Modulo puro: lo prova menu.test.ts.
   ============================================================ */
import type { Portata } from './portate.ts';

const BAR = /amar|aperitiv|bevand|bibit|birr|bollicin|champagn|brandy|cognac|caffett|tisan|cocktail|dealcol|grapp|liquor|distillat|long drink|\brose\b|\brum\b|vetrinett|vin[oi]\b|vini|whisk/i;

export const stampantePer = (categoria: string): 'cucina' | 'bar' => BAR.test(categoria) ? 'bar' : 'cucina';

export function portataPer(categoria: string): Portata {
  if (stampantePer(categoria) === 'bar' && !/vetrinett/i.test(categoria)) return 'bevande';
  if (/dessert|dolc|vetrinett/i.test(categoria)) return 'dolci';
  if (/freddi|antipast|insalat|condivid/i.test(categoria)) return 'antipasti';
  if (/\bprim|past[ae]\b|zupp|risott/i.test(categoria)) return 'primi';
  return 'secondi';
}

const trova = (intestazioni: string[], re: RegExp) => intestazioni.findIndex((h) => re.test(h));

/* IN CHE UNITA' E' SCRITTO IL PREZZO. La tabella di Fidra che si vede a
   schermo lo scrive in euro («6,00»); l'elenco `item-variations`, quello
   che ha dentro anche i vini del ristorante, lo da' in centesimi interi
   (600). Rimoltiplicando per cento il calice di vino dei Colli e'
   comparso sul palmare a 500,00 euro: «sicuro che i prezzi sono
   giusti?» (la proprieta', 4 settembre 2026). L'unita' non si indovina
   dal numero — la dichiara chi legge. */
export type UnitaPrezzo = 'euro' | 'centesimi';

/** «28,00», «3.5», «€ 6,00» → centesimi; 0 se non si legge. */
const cent = (s: string, unita: UnitaPrezzo): number => {
  if (unita === 'centesimi') {
    const n = Number(String(s).replace(/[^\d-]/g, ''));
    return Number.isFinite(n) ? Math.round(n) : 0;
  }
  const n = Number(String(s).replace(/[^\d,.-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

export type ArticoloImportato = { fidra_id: string; nome: string; categoria: string; prezzo_cent: number; iva: number };
export type CategoriaImportata = { nome: string; stampante: 'cucina' | 'bar'; portata: Portata };

/* LA RETE. Un listino di bar e ristorante dove meta' delle voci costa
   piu' di cinquanta euro non e' un listino: e' un fattore cento. Poche
   voci care (il noleggio della sala, un massaggio lungo) non spostano la
   mediana, e i prezzi a zero non fanno testo. */
export const MEDIANA_MASSIMA_CENT = 5000;

/** I prezzi appena letti stanno in piedi? Falso = l'unita' e' sbagliata. */
export function prezziSensati(articoli: { prezzo_cent: number }[], massimoCent = MEDIANA_MASSIMA_CENT): boolean {
  const p = articoli.map((a) => Number(a.prezzo_cent)).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!p.length) return true;
  return p[Math.floor(p.length / 2)] <= massimoCent;
}

export function importa(intestazioni: string[], righe: string[][], unita: UnitaPrezzo = 'euro'): { categorie: CategoriaImportata[]; articoli: ArticoloImportato[]; scartate: number } {
  const iId = trova(intestazioni, /^id$/i);
  const iNome = trova(intestazioni, /nome|name/i);
  const iCat = trova(intestazioni, /categor/i);
  const iPrezzo = trova(intestazioni, /prezzo|price/i);
  const iIva = trova(intestazioni, /\biva\b|vat/i);
  const categorie = new Map<string, CategoriaImportata>();
  const articoli: ArticoloImportato[] = [];
  let scartate = 0;
  for (const r of righe) {
    const nome = (r[iNome] ?? '').trim();
    const categoria = ((iCat >= 0 ? r[iCat] : '') ?? '').trim() || 'Varie';
    if (!nome) { scartate++; continue; }
    if (!categorie.has(categoria)) categorie.set(categoria, { nome: categoria, stampante: stampantePer(categoria), portata: portataPer(categoria) });
    const ivaLetta = iIva >= 0 && (r[iIva] ?? '').trim() ? Number(r[iIva]) : 10;
    articoli.push({
      fidra_id: iId >= 0 && (r[iId] ?? '').trim() ? String(r[iId]).trim() : nome,
      nome, categoria,
      prezzo_cent: cent(r[iPrezzo] ?? '0', unita),
      iva: Number.isFinite(ivaLetta) ? ivaLetta : 10,
    });
  }
  return { categorie: [...categorie.values()], articoli, scartate };
}
