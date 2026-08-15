/* ============================================================
   promemoria.ts — chi va avvisato che il buono sta per scadere.

   Modulo puro: righe dentro, elenco fuori. Nessuna rete, nessun database,
   cosi' la regola si prova per intero senza toccare la produzione.

   La finestra e' «trenta giorni o meno, e non ancora scaduto», non
   «esattamente trenta»: se il lavoro non gira un giorno — e prima o poi
   non girera' — con l'uguaglianza secca chi scadeva quel giorno resterebbe
   senza avviso per sempre.
   ============================================================ */

export const GIORNI_PRIMA = 30;

export type RigaBuono = {
  codice: string; stato: string; scade_il: string | null;
  riscosso_il: string | null; promemoria_il: string | null;
  destinatario_email: string | null; acquirente_email: string | null;
};

const GIORNO_MS = 86400000;
const valida = (e: string | null) => !!e && /.+@.+\..+/.test(e);

export function daAvvisare(righe: RigaBuono[], oggi: Date): { codice: string; email: string }[] {
  /* "oggi" va letto a mezzogiorno UTC, come si legge scade_il due righe
     sotto: e' la convenzione di tutto il progetto (vedi richieste/tipi.ts).
     Confrontare una mezzanotte con un mezzogiorno sfaserebbe il conto di
     dodici ore, e Math.round sul confine fra un giorno e l'altro
     arrotonderebbe al giorno sbagliato — proprio dove i test controllano
     il limite. */
  const adesso = Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth(), oggi.getUTCDate(), 12);
  const fuori: { codice: string; email: string }[] = [];

  for (const r of righe) {
    if (r.stato !== 'pagato') continue;          // annullato, in attesa: niente
    if (r.riscosso_il) continue;                 // gia' speso
    if (r.promemoria_il) continue;               // gia' avvisato, una volta sola
    if (!r.scade_il) continue;

    const scade = new Date(r.scade_il + 'T12:00:00Z').getTime();
    if (isNaN(scade)) continue;
    const mancano = Math.round((scade - adesso) / GIORNO_MS);
    if (mancano < 0 || mancano > GIORNI_PRIMA) continue;

    /* a chi ha il buono in mano: il destinatario se il suo indirizzo c'e',
       altrimenti chi l'ha comprato. Non a entrambi — chi ha regalato ha gia'
       fatto la sua parte. */
    const email = valida(r.destinatario_email) ? r.destinatario_email!
      : valida(r.acquirente_email) ? r.acquirente_email! : '';
    if (!email) continue;

    fuori.push({ codice: r.codice, email });
  }
  return fuori;
}
