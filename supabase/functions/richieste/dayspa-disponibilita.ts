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
