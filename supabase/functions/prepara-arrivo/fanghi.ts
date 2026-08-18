/* ============================================================
   fanghi.ts — il desiderio d'orario per i fanghi.

   E' UNA PREFERENZA, NON UN APPUNTAMENTO, e il nome delle cose qui dentro
   lo dice apposta. Il ciclo fanghi ha sei turni al mattino, dalle 5:50 alle
   10:30, con la visita medica di ammissione obbligatoria prima; il turno lo
   assegna la Segreteria Cure dopo quella visita. Qualunque cosa somigli a
   una prenotazione sarebbe una promessa che il servizio non puo'
   mantenere.

   Tre fasce e nient'altro. Nessun orario preciso, nessun turno scelto,
   nessuna disponibilita' mostrata: sono le tre cose che l'ospite puo' dire
   senza che nessuno gli prometta niente.

   ELENCO CHIUSO perche' il valore arriva dal browser, e il browser si
   aggira: senza, in reception arriverebbe qualunque stringa qualcuno
   decida di mandare — e quella stringa finisce in un'email col nostro logo.
   ============================================================ */

export const DESIDERI = ['presto', 'tardi', 'indifferente'] as const;

export type Desiderio = typeof DESIDERI[number];

/** La scelta dell'ospite, o `null` se non e' una delle tre. */
export function desiderioValido(v: unknown): Desiderio | null {
  return (DESIDERI as readonly string[]).includes(v as string) ? v as Desiderio : null;
}

/* Come si legge in reception. Sta qui e non nell'email perche' e' la
   stessa cosa che la pagina dice all'ospite, e due scritture divergono. */
export const IN_RECEPTION: Record<Desiderio, string> = {
  presto: 'presto — dalle 5:50',
  tardi: 'più tardi — verso le 10:00',
  indifferente: 'indifferente',
};
