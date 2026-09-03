/* Cosa entra in una prenotazione Day Spa, e cosa no. Stesse regole del
   modulo richieste per il Day Spa (richieste/tipi.ts): data ISO, oggi
   ammesso, passato no, persone 1-8 fra adulti e bambini, email con una
   chiocciola, nome non vuoto, lingua fra le quattro o italiano. */
import { fasceDelGiorno, PERSONE_MAX, type Fascia } from './listino.ts';

export const LINGUE = ['it', 'de', 'en', 'fr'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export type DatiPrenotazione = {
  giorno: string; fascia: Fascia; adulti: number; bambini: number; persone: number;
  nome: string; email: string; telefono: string; lingua: string; buono?: string;
};

const intero = (v: unknown): number =>
  (typeof v === 'number' || typeof v === 'string') && /^\d+$/.test(String(v)) ? Number(v) : NaN;

export function dataValida(iso: string): boolean {
  if (!ISO.test(iso)) return false;
  const d = new Date(iso + 'T12:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

export function validaPrenotazione(corpo: unknown, oggi: string): { errore?: string; dati?: DatiPrenotazione } {
  if (!corpo || typeof corpo !== 'object') return { errore: 'richiesta vuota' };
  const b = corpo as Record<string, unknown>;
  const giorno = String(b.giorno ?? '');
  if (!dataValida(giorno)) return { errore: 'data non valida' };
  if (giorno < oggi) return { errore: 'la data e passata' };
  const fascia = String(b.fascia ?? '') as Fascia;
  if (!fasceDelGiorno(giorno).includes(fascia)) {
    return { errore: `la fascia ${fascia || '?'} non esiste in quel giorno (il serale c e venerdi e sabato)` };
  }
  const adulti = intero(b.adulti);
  const bambini = b.bambini === undefined || b.bambini === '' ? 0 : intero(b.bambini);
  if (!(adulti >= 1)) return { errore: 'serve almeno un adulto' };
  if (!(bambini >= 0)) return { errore: 'bambini non valido' };
  const persone = adulti + bambini;
  if (persone > PERSONE_MAX) return { errore: `al massimo ${PERSONE_MAX} persone: per un gruppo scriva alla reception` };
  const nome = String(b.nome ?? '').trim();
  if (!nome) return { errore: 'manca il nome' };
  const email = String(b.email ?? '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { errore: 'email non valida' };
  const telefono = String(b.telefono ?? '').trim().slice(0, 40);
  const lingua = LINGUE.includes(String(b.lingua)) ? String(b.lingua) : 'it';
  const buono = b.buono ? String(b.buono).trim().toUpperCase().slice(0, 32) : undefined;
  return {
    dati: { giorno, fascia, adulti, bambini, persone, nome: nome.slice(0, 120), email: email.slice(0, 160), telefono, lingua, buono },
  };
}
