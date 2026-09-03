/* Il ponte sulla disponibilita' del Day Spa.
   Traduce la risposta dell'API del sito precedente in UNA parola, e non
   lascia uscire nient'altro. Vedi la specifica del 17 agosto 2026 per il
   perche' del ponte (niente CORS, e `amount` da non mostrare). */

export type Esito = { stato: 'chiuso' | 'non-aperte' | 'disponibile' | 'esaurito' | 'ignoto' };

/* Sette giorni: e' l'orizzonte con cui l'hotel apre le vendite, per tenere
   conto anche del meteo. Oltre, la disponibilita' non esiste ancora — non
   e' esaurita. Confonderli manda via chi potrebbe venire.
   Esportata (e non piu' un dettaglio interno) perche' index.ts la userebbe
   di nuovo, a mano, per lo stesso confronto: due copie dello stesso numero
   che potrebbero divergere il giorno in cui l'orizzonte cambia. */
export const ORIZZONTE_GIORNI = 7;

export function esitoDisponibilita(risposta: unknown, giorni: number, chiuso: boolean): Esito {
  if (chiuso) return { stato: 'chiuso' };
  if (!Number.isFinite(giorni) || giorni > ORIZZONTE_GIORNI) return { stato: 'non-aperte' };
  if (!Array.isArray(risposta)) return { stato: 'ignoto' };
  return { stato: risposta.length > 0 ? 'disponibile' : 'esaurito' };
}

/* ------------------------------------------------------------------
   Le due decisioni che scelgono la parola detta all'ospite: se l'hotel e'
   chiuso quel giorno, e quanti giorni mancano. Stavano in index.ts, che per
   convenzione non e' importabile dai test (chiama Deno.serve in cima) —
   erano le uniche righe nuove senza collaudo. Spostate qui, pure. */

export type Stagione = { chiusura: string; riapertura: string };

/* Vero se il giorno cade fra chiusura e riapertura esclusa, per una
   qualsiasi stagione: il confronto e' su stringhe AAAA-MM-GG, che ordinano
   come le date perche' hanno tutte la stessa forma. */
export function aHotelChiuso(giorno: string, stagioni: Stagione[]): boolean {
  return stagioni.some((s) => giorno >= s.chiusura && giorno < s.riapertura);
}

/* Quanti giorni separano `oggi` dal giorno richiesto, arrotondato. `oggi`
   e' un parametro e non l'orologio letto qui dentro: altrimenti la funzione
   dipenderebbe dal momento in cui gira e non si potrebbe collaudare senza
   aspettare che il tempo passi davvero — lo stesso motivo per cui
   creaFrenoIp (limite-ip.ts) accetta un `adesso` opzionale. */
export function distanzaGiorni(giorno: string, oggi: Date): number {
  return Math.round(
    (new Date(giorno + 'T12:00:00Z').getTime() - oggi.getTime()) / 86400000,
  );
}

/* LA STAGIONE CHE UN SOGGIORNO TOCCA: almeno una notte dentro, cioe'
   `check_in < riapertura && check_out > chiusura`. Il giorno di riapertura e'
   un arrivo buono; il giorno di chiusura e' una partenza buona (ultima notte
   la sera prima). Null se nessuna, o se le date non sono date. La usa
   l'azione a=disponibilita per dire «siamo chiusi» invece di «nessuna
   camera» (3 settembre 2026). */
export function chiusuraCheCopre(check_in: string, check_out: string, stagioni: Stagione[]): Stagione | null {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(check_in) || !iso.test(check_out)) return null;
  return stagioni.find((s) => check_in < s.riapertura && check_out > s.chiusura) ?? null;
}
