/* I sette giorni del Day Spa: da oggi compreso, in fila.

   «Al massimo 7 giorni: la disponibilita' dipende dal meteo e
   dall'occupazione dell'hotel, difficile fare previsioni piu' in la'» (la
   proprieta', 3 settembre 2026). Quindi niente calendario a mesi: sette
   giorni, ognuno con la sua parola. Puro: i nomi dei giorni e dei mesi
   arrivano come parametro (sono quelli di /comune/calendario.js), cosi'
   questo modulo si prova in Deno senza un percorso web da aprire. */
'use strict';

export const ORIZZONTE_GIORNI = 7;

const piu = (iso, n) => {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** I sette giorni da `oggi` compreso. */
export function setteGiorni(oggi) {
  return Array.from({ length: ORIZZONTE_GIORNI }, (_, i) => piu(oggi, i));
}

/** «sab», 5, «set»: giorno della settimana, numero, mese breve, nella
 *  lingua dell'ospite (o in italiano se la lingua non c'e'). */
export function pezziGiorno(iso, lingua, testi) {
  const t = testi[lingua] || testi.it;
  const d = new Date(iso + 'T12:00:00Z');
  return { settimana: t.giorni[(d.getUTCDay() + 6) % 7], giorno: d.getUTCDate(), mese: t.mesiBrevi[d.getUTCMonth()] };
}

/** La parola del giorno intero, dalle parole delle sue fasce: chiuso se
 *  sono chiuse tutte; poi la migliore che c'e' (disponibile, ultimi,
 *  esaurito); non in vendita se il server non ha mandato niente. */
export function statoDelGiorno(g) {
  if (!g || !Array.isArray(g.fasce) || !g.fasce.length) return 'non-in-vendita';
  const stati = g.fasce.map((f) => f.stato);
  if (stati.every((s) => s === 'chiuso')) return 'chiuso';
  if (stati.includes('disponibile')) return 'disponibile';
  if (stati.includes('ultimi')) return 'ultimi';
  if (stati.includes('esaurito')) return 'esaurito';
  return 'non-in-vendita';
}
