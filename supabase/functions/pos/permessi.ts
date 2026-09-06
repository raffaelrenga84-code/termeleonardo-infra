/* ============================================================
   permessi.ts — chi puo' fare cosa, la tabella della spec in una funzione.

   | azione   | cameriere        | capo sala | amministrazione |
   | comanda  | si'              | si'       | si'             |
   | storno   | se «storni»      | si'       | si'             |
   | tavolo   | se «cancella tavolo» (acceso di base) | si' | si' |
   | prezzo   | no               | si'       | si'             |
   | chiusura | no               | si'       | si'             |
   | menu     | no               | no        | si'             |
   Un cameriere bloccato non fa niente. Modulo puro: lo prova permessi.test.ts.
   ============================================================ */
export type Ruolo = 'cameriere' | 'capo_sala' | 'amministrazione';
export type Azione = 'comanda' | 'storno' | 'tavolo' | 'prezzo' | 'menu' | 'chiusura';

export function puo(c: { ruolo: Ruolo; storni: boolean; bloccato: boolean; cancella_tavolo?: boolean }, azione: Azione): boolean {
  if (c.bloccato) return false;
  if (c.ruolo === 'amministrazione') return true;
  if (c.ruolo === 'capo_sala') return azione !== 'menu';
  if (azione === 'comanda') return true;
  if (azione === 'storno') return c.storni;
  /* «Cancella tutto il tavolo»: acceso di base (l'hanno chiesto i camerieri), si spegne per persona (7 settembre 2026) */
  if (azione === 'tavolo') return c.cancella_tavolo !== false;
  return false;
}
