/* ============================================================
   permessi.ts — chi puo' fare cosa, la tabella della spec in una funzione.

   | azione   | cameriere        | capo sala | amministrazione |
   | comanda  | si'              | si'       | si'             |
   | storno   | se «storni»      | si'       | si'             |
   | prezzo   | no               | si'       | si'             |
   | chiusura | no               | si'       | si'             |
   | menu     | no               | no        | si'             |
   Un cameriere bloccato non fa niente. Modulo puro: lo prova permessi.test.ts.
   ============================================================ */
export type Ruolo = 'cameriere' | 'capo_sala' | 'amministrazione';
export type Azione = 'comanda' | 'storno' | 'prezzo' | 'menu' | 'chiusura';

export function puo(c: { ruolo: Ruolo; storni: boolean; bloccato: boolean }, azione: Azione): boolean {
  if (c.bloccato) return false;
  if (c.ruolo === 'amministrazione') return true;
  if (c.ruolo === 'capo_sala') return azione !== 'menu';
  if (azione === 'comanda') return true;
  if (azione === 'storno') return c.storni;
  return false;
}
