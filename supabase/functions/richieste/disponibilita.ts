/* disponibilita.ts — riduce la risposta di /api/available/rates a quello che
   serve alla pagina.

   ATTENZIONE ALL'UNITA': l'API lavora in CENTESIMI. 15500 sono 155,00 euro.
   Il campo si chiama `prezzo_cent` proprio perche' nessuno debba ricordarselo:
   la stessa trappola ha gia' prodotto un difetto nella funzione `chat`. */

import { CAMERE, descrizioneCamera } from './camere.ts';

export type Proposta = {
  camera_id: number;
  nome: string;
  descrizione: string;
  max_adulti: number;
  tariffa_id: number;
  variante_id: number;
  tariffa: string;
  trattamento: string;
  prezzo_cent: number;
};

const n = (v: unknown): number | null =>
  typeof v === 'number' && isFinite(v) ? v : null;

export function normalizzaDisponibilita(grezzo: unknown, lingua: string): Proposta[] {
  if (!Array.isArray(grezzo)) return [];
  const fuori: Proposta[] = [];
  /* il primo livello e' una camera richiesta, il secondo le categorie */
  for (const gruppo of grezzo) {
    if (!Array.isArray(gruppo)) continue;
    for (const c of gruppo) {
      const id = n(c?.room_category_id);
      if (id === null) continue;
      const cat = CAMERE[id];
      const nome = cat?.nome ?? String(c?.room_category?.name ?? '').trim();
      if (!nome) continue;
      for (const tariffa of (Array.isArray(c?.rates) ? c.rates : [])) {
        for (const v of (Array.isArray(tariffa?.rate_variations) ? tariffa.rate_variations : [])) {
          const tot = n(v?.total);
          if (tot === null) continue;
          fuori.push({
            camera_id: id,
            nome,
            descrizione: descrizioneCamera(id, lingua),
            max_adulti: n(c?.room_category?.max_adults) ?? 0,
            tariffa_id: n(tariffa?.id) ?? 0,
            variante_id: n(v?.id) ?? 0,
            tariffa: String(v?.rate_name ?? tariffa?.name ?? '').trim(),
            trattamento: String(v?.name ?? '').trim(),
            prezzo_cent: tot,
          });
        }
      }
    }
  }
  return fuori;
}

/* 75 euro a persona, per adulto: e' cosi' che la reception calcola l'acconto
   nelle offerte (acconto / adulti). A camera sarebbe la meta' su una doppia,
   e due canali che chiedono cifre diverse per la stessa camera diventano un
   reclamo al check-in. */
export function caparraCent(adulti: number): number {
  const a = Number.isFinite(adulti) && adulti > 0 ? Math.floor(adulti) : 1;
  return 7500 * a;
}
