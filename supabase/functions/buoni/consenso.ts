/* ============================================================
   consenso.ts — la data del consenso, o niente.

   IL PUNTO CHE CONTA. Non basta "piu' sopra si e' gia' controllato che il
   consenso c'e'" (validaAcquisto, in acquista.ts, lo fa gia' per
   condizioni_accettate e privacy_presa_atto): se un giorno quel controllo
   cambiasse — si allentasse, si spostasse, si dimenticasse in un ramo nuovo
   — chi scrive la data qui non lo saprebbe, e la scriverebbe comunque. Una
   data scritta senza un vero consenso e' una prova FALSA, peggio di nessuna
   prova — proprio sui buoni, dove chi compra accetta che non sono
   rimborsabili: se fra otto mesi qualcuno contesta, e' quella data la cosa
   da mostrare.

   Percio' questa funzione non si fida di essere "chiamata dopo che si e'
   gia' controllato": ricontrolla lei stessa, sul valore grezzo cosi' come
   arriva dal modulo, prima di decidere se la data esiste. Il consenso e la
   data nascono insieme, qui, nell'unico punto della funzione che decide —
   chi la chiama non deve (e non puo') separare le due cose.

   Solo `true` — il booleano vero, non un valore che gli somiglia — conta:
   la stringa "true", il numero 1, "on" arrivano tutti da fuori (dal
   browser, o da chi costruisce la richiesta a mano) e un confronto largo
   (`==`, o un semplice `if (preso)`) li accetterebbe come se fossero la
   spunta. Solo `===` con `true` no.

   Una funzione sola per i due consensi (privacy_il e condizioni_il): sono
   la stessa regola applicata a due booleani diversi, non due regole. */

export function dataConsenso(preso: unknown, adesso: Date = new Date()): string | null {
  return preso === true ? adesso.toISOString() : null;
}
