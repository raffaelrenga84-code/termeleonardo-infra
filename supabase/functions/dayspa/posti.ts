/* Lo stato dei posti detto in una parola, la scadenza dei venti minuti, il
   numero e il codice della prenotazione. Tutto puro: nessun orologio letto
   qui dentro, `adesso` arriva sempre da fuori (i test lo passano). */
import { SOGLIA_ULTIMI } from './listino.ts';

export type Stato = 'chiuso' | 'non-in-vendita' | 'esaurito' | 'ultimi' | 'disponibile';

/* La parola per l'ospite. `riga` e' la riga di dayspa_giorno, o null se la
   reception non ha ancora caricato quel giorno. Chiuso vince su tutto.
   Da qui non esce mai il numero dei posti: solo la parola. */
export function statoPosti(riga: { posti: number; venduti: number } | null, chiuso: boolean): Stato {
  if (chiuso) return 'chiuso';
  if (!riga) return 'non-in-vendita';
  const liberi = riga.posti - riga.venduti;
  if (liberi <= 0) return 'esaurito';
  return liberi <= SOGLIA_ULTIMI ? 'ultimi' : 'disponibile';
}

export const MINUTI_PAGAMENTO = 20;

export function scadenza(adesso: Date): string {
  return new Date(adesso.getTime() + MINUTI_PAGAMENTO * 60_000).toISOString();
}

export function eScaduta(scadeIl: string, adesso: Date): boolean {
  return new Date(scadeIl).getTime() < adesso.getTime();
}

export function numeroPrenotazione(anno: number, progressivo: number): string {
  return `DS-${anno}-${String(progressivo).padStart(4, '0')}`;
}

/* Senza 0/O e 1/I: si legge a voce al telefono senza equivoci. */
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function codicePrenotazione(casuale: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < 10; i++) s += ALFABETO[Math.floor(casuale() * ALFABETO.length) % ALFABETO.length];
  return s;
}
