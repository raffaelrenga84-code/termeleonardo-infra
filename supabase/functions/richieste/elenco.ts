/* ============================================================
   elenco.ts — la riga come la vede il back office in `?a=elenco`.

   riepilogo.ts sa calcolare l'etichetta e il riepilogo per tipo;
   differenze.ts sa confrontare l'originale col corrente. Questo modulo fa
   solo una cosa: li chiama tutti e due per ogni riga di richiesta_sito,
   cosi' la pagina HTML del back office — che e' HTML puro e non puo'
   importare moduli Deno — riceve gia' pronto quello che deve mostrare.
   Una sola implementazione della regola, non due che divergono al primo
   cambiamento: e' il difetto che questo progetto ha gia' pagato con i
   prezzi del listino, i testi dei buoni, l'indirizzo, i trattamenti.

   Modulo puro: righe dentro, righe arricchite fuori. Nessuna rete, nessun
   database.
   ============================================================ */

import { riepilogoRichiesta, type Riga } from './riepilogo.ts';
import { differenze, type Differenza } from './differenze.ts';

/* La riga come arriva da `select('*')` su richiesta_sito: i campi che
   riepilogo.ts e differenze.ts guardano davvero, dichiarati per tipo, piu'
   un indice aperto per tutti gli altri (numero, stato, email, ...) che qui
   non servono ma vanno restituiti intatti. */
export type RigaGrezza = {
  tipo?: string;
  dati?: Record<string, unknown> | null;
  dati_originali?: Record<string, unknown> | null;
  check_in?: string | null;
  check_out?: string | null;
  notti?: number | null;
  ospiti?: number | null;
  [k: string]: unknown;
};

export type RigaArricchita = RigaGrezza & Riga & { differenze: Differenza[] };

export function arricchisciRiga(r: RigaGrezza): RigaArricchita {
  const { etichetta, riepilogo } = riepilogoRichiesta(r);
  return {
    ...r,
    etichetta,
    riepilogo,
    /* dati_originali puo' mancare o essere null sulle righe piu' vecchie:
       differenze() gia' tratta quel caso come "niente da confrontare", non
       come "ogni campo del corrente e' una novita'" — qui non si aggira
       quel presidio con un `?? {}`. */
    differenze: differenze(r.dati_originali, r.dati),
  };
}

export function arricchisciElenco(righe: RigaGrezza[]): RigaArricchita[] {
  return righe.map(arricchisciRiga);
}
