/* ============================================================
   schermo.ts — il monitor cucina: cosa nasce da stampare e cosa va sullo
   schermo, quando la carta fa da ripiego, i passi di una comanda.

   «Come riusciamo a fare un monitor per ordini al posto dei biglietti
   stampati?» (la proprieta', 6 settembre 2026). Una postazione (locale +
   stampante) dice come riceve i biglietti: stampante, schermo, o tutt'e
   due; col solo schermo la carta esce di ripiego se nessuno schermo ha
   mostrato il biglietto entro `ripiego_s` secondi, cosi' uno schermo
   spento non fa perdere niente. Puro: lo prova schermo.test.ts, lo usano
   la funzione (index.ts) e il server locale (pos-locale).
   ============================================================ */
export type Postazione = {
  locale: string; stampante: 'cucina' | 'bar'; nome: string;
  schermo: boolean; stampa_sempre: boolean; ripiego_s: number; chiave_hash?: string | null;
};
export type Passo = 'presa' | 'pronta' | 'riapri';

export const RIPIEGO_S = 30;
export const RIAPRI_MS = 2 * 60 * 1000;
export const PRONTO_MS = 20 * 60 * 1000;

/* da SQLite arrivano 0 e 1, dal cloud true e false */
const vero = (x: unknown): boolean => x === true || (typeof x === 'number' && x !== 0) || x === '1' || x === 'true';
const data = (x: unknown): Date | null => { const d = new Date(String(x ?? '')); return Number.isNaN(d.getTime()) ? null : d; };

/** Lo stato con cui nasce un biglietto per questa postazione. */
export function statoIniziale(p: { schermo?: unknown; stampa_sempre?: unknown } | null | undefined): 'da_stampare' | 'a_schermo' {
  if (!p || !vero(p.schermo)) return 'da_stampare';
  return vero(p.stampa_sempre) ? 'da_stampare' : 'a_schermo';
}

/** Vero se un biglietto «a schermo» che nessuno ha mostrato deve uscire di carta. */
export function daRipiegare(s: { stato: unknown; vista_il?: unknown; creato_il: unknown }, p: { ripiego_s?: unknown } | null | undefined, adesso: Date): boolean {
  if (s.stato !== 'a_schermo' || s.vista_il) return false;
  const secondi = p && p.ripiego_s !== undefined && p.ripiego_s !== null ? Number(p.ripiego_s) : RIPIEGO_S;
  if (!(secondi > 0)) return false;
  const nato = data(s.creato_il);
  return !!nato && adesso.getTime() - nato.getTime() > secondi * 1000;
}

/** I campi da scrivere per un passo dello schermo, o l'errore. */
export function passo(s: { presa_il?: unknown; pronta_il?: unknown }, quale: string, adesso: Date, postazione: string): { campi: Record<string, string | null> } | { errore: string; stato: 400 | 409 } {
  const ora = adesso.toISOString();
  if (quale === 'presa') return { campi: { presa_il: ora } };
  if (quale === 'pronta') {
    const campi: Record<string, string | null> = { pronta_il: ora, pronta_da: postazione };
    if (!s.presa_il) campi.presa_il = ora;
    return { campi: Object.fromEntries(Object.entries(campi).sort(([a], [b]) => a.localeCompare(b))) };
  }
  if (quale === 'riapri') {
    const pronta = data(s.pronta_il);
    if (!pronta || adesso.getTime() - pronta.getTime() > RIAPRI_MS) return { errore: 'troppo tardi per riaprire', stato: 409 };
    return { campi: { pronta_il: null, pronta_da: null } };
  }
  return { errore: 'passo sconosciuto', stato: 400 };
}

/** Le quattro del mattino di oggi, ora di Roma: stessa regola della sala. */
export function inizioGiornata(adesso: Date, minutiRoma: number): Date {
  const inizio = new Date(adesso.getTime()); inizio.setUTCSeconds(0, 0);
  inizio.setUTCMinutes(inizio.getUTCMinutes() - minutiRoma + 4 * 60);
  if (minutiRoma < 4 * 60) inizio.setUTCDate(inizio.getUTCDate() - 1);
  return inizio;
}

/** Sullo schermo: nato oggi e non ancora pronto. */
export function daMostrare(s: { pronta_il?: unknown; creato_il: unknown }, inizio: Date): boolean {
  if (s.pronta_il) return false;
  const nato = data(s.creato_il);
  return !!nato && nato.getTime() >= inizio.getTime();
}

/** «Pronto in cucina» sul palmare: un biglietto pronto negli ultimi venti minuti. */
export function prontoInCucina(stampe: { pronta_il?: unknown }[], adesso: Date): { pronto: boolean; alle: string | null } {
  const recenti = stampe.map((s) => data(s.pronta_il)).filter((d): d is Date => !!d && adesso.getTime() - d.getTime() <= PRONTO_MS).sort((a, b) => a.getTime() - b.getTime());
  const ultima = recenti.pop();
  return ultima ? { pronto: true, alle: ultima.toISOString() } : { pronto: false, alle: null };
}

/** L'impronta della chiave dello schermo: nel database sta solo questa. */
export async function impronta(chiave: string): Promise<string> {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(chiave));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** Una chiave da scrivere a mano senza sbagliare: niente O/0 e I/1. */
export function chiaveCasuale(): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return [...crypto.getRandomValues(new Uint8Array(16))].map((b) => alfabeto[b % alfabeto.length]).join('');
}
