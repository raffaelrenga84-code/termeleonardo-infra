/* ============================================================
   motivi.ts — chi tocca un prezzo o storna deve dire perche'.

   «se uno applica una variazione di prezzo deve scrivere la motivazione
   altrimenti non deve permettere la modifica; la stessa cosa anche in
   caso di storno o cancellazione comanda» (la proprieta', 4 settembre
   2026).

   Il controllo sta qui, in un modulo puro, e lo chiamano tutti e due i
   server: se stesse solo nella pagina basterebbe un palmare vecchio per
   saltarlo. Un motivo di due lettere non e' un motivo: si chiede almeno
   una parola vera, e si taglia a duecento caratteri.
   ============================================================ */
export const MOTIVO_MINIMO = 3;
export const MOTIVO_MASSIMO = 200;

/** Il motivo scritto, ripulito; null se non c'e' o non dice niente. */
export function motivoPulito(x: unknown): string | null {
  const s = String(x ?? '').trim().replace(/\s+/g, ' ');
  if (s.length < MOTIVO_MINIMO) return null;
  return s.slice(0, MOTIVO_MASSIMO);
}

/** Il prezzo battuto a mano cambia davvero quello di listino? Solo
    allora serve un motivo: confermare il prezzo giusto non e' una
    variazione, e un articolo a prezzo libero non ha listino da cambiare. */
export function prezzoCambiato(
  { prezzoListinoCent, supplementoCent = 0, prezzoManualeCent, prezzoLibero = false }: {
    prezzoListinoCent: number;
    supplementoCent?: number;
    prezzoManualeCent: number | null | undefined;
    prezzoLibero?: boolean;
  },
): boolean {
  if (prezzoLibero) return false;
  if (prezzoManualeCent === null || prezzoManualeCent === undefined) return false;
  return Math.round(prezzoManualeCent) !== Math.round(prezzoListinoCent + supplementoCent);
}
