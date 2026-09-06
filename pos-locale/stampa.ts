/* ============================================================
   stampa.ts - i biglietti alle stampanti di cucina e bar, sulla LAN.

   ESC/POS grezzo sulla porta 9100 (o quella scritta in config): il PC
   del Bistrot raggiunge le stampanti anche senza internet. Un biglietto
   stampato qui resta da allineare (allineato = 0), cosi' il cloud lo
   segna «stampata» e non lo stampa una seconda volta.

   Qui non compaiono e non compariranno le stampanti degli scontrini.
   ============================================================ */
import type { Db, Riga } from './db.ts';
import { escpos } from '../supabase/functions/pos/comanda.ts';
import { daRipiegare, inizioGiornata } from '../supabase/functions/pos/schermo.ts';
import { oraLocale } from '../supabase/functions/pos/fasce.ts';

export type Destinazione = { host: string; porta: number };
export type Connessione = { write(b: Uint8Array): Promise<number>; close(): void };
export type Connetti = (o: { hostname: string; port: number }) => Promise<Connessione>;
export type Stampanti = { cucina?: string; bar?: string };

const connettiVero: Connetti = (o) => Deno.connect(o) as unknown as Promise<Connessione>;

export async function stampa(dest: Destinazione, byte: Uint8Array, connetti: Connetti = connettiVero): Promise<void> {
  const c = await connetti({ hostname: dest.host, port: dest.porta });
  try {
    let scritti = 0;
    while (scritti < byte.length) scritti += await c.write(byte.subarray(scritti));
  } finally { c.close(); }
}

/** Gli indirizzi delle due stampanti di un locale: prima quelli scritti
    nel back office (scendono col menu' e i tavoli), poi quelli del
    config.json come ripiego. Cosi' cambiare stampante non vuol dire
    andare al PC del Bistrot con la tastiera. */
export function stampantiDi(db: Db, locale: string, dalFile: Stampanti = {}): Stampanti {
  const r = db.prepare('select stampante_cucina, stampante_bar from pos_locale where id = ?').get(locale) as Riga | undefined;
  const dal = (v: unknown) => { const s = String(v ?? '').trim(); return s || undefined; };
  return {
    cucina: dal(r?.stampante_cucina) ?? dalFile.cucina,
    bar: dal(r?.stampante_bar) ?? dalFile.bar,
  };
}

/** «host:porta» dalla configurazione; senza porta, 9100. */
export function destinazione(s: string | undefined): Destinazione | null {
  if (!s) return null;
  const [host, porta] = s.split(':');
  if (!host) return null;
  return { host, porta: Number(porta) || 9100 };
}

/** Stampa quello che aspetta. Un biglietto senza stampante configurata
    resta in coda; uno che la stampante rifiuta va in errore (lo si vede
    nel back office) e non blocca gli altri. */
export async function giroStampe(db: Db, stampanti: Stampanti, connetti: Connetti = connettiVero, adesso: Date = new Date()): Promise<number> {
  /* uno schermo spento non fa perdere niente: la carta esce dopo
     ripiego_s secondi se nessuno schermo ha mostrato il biglietto
     (daRipiegare, schermo.ts) */
  const postazioni = db.prepare('select locale, stampante, ripiego_s from pos_postazione').all() as Riga[];
  const postazioneDi = (locale: string, stampante: string) => postazioni.find((p) => p.locale === locale && p.stampante === stampante) ?? null;
  /* solo la giornata di oggi: senza questo limite, con ripiego_s = 0
     («mai») e uno schermo spento le righe non escono mai da questo
     insieme e la finestra resta occupata per sempre */
  const inizioOggi = inizioGiornata(adesso, oraLocale(adesso).minuti);
  const aSchermo = db.prepare("select id, locale, stampante, stato, vista_il, creato_il from pos_stampa where stato = 'a_schermo' and vista_il is null and creato_il >= ? order by creato_il").all(inizioOggi.toISOString()) as Riga[];
  const oraRipiego = adesso.toISOString();
  for (const s of aSchermo) {
    if (daRipiegare(s as { stato: unknown; vista_il?: unknown; creato_il: unknown }, postazioneDi(String(s.locale), String(s.stampante)), adesso)) {
      db.prepare("update pos_stampa set stato = 'da_stampare', aggiornato_il = ?, allineato = 0 where id = ?").run(oraRipiego, String(s.id));
    }
  }
  const daFare = db.prepare("select * from pos_stampa where stato = 'da_stampare' order by creato_il, rowid limit 50").all() as Riga[];
  let fatte = 0;
  for (const s of daFare) {
    const dest = destinazione(s.stampante === 'bar' ? stampanti.bar : stampanti.cucina);
    if (!dest) continue;
    const ora = new Date().toISOString();
    try {
      await stampa(dest, escpos(String(s.testo)), connetti);
      db.prepare("update pos_stampa set stato = 'stampata', stampata_il = ?, stampata_da = 'locale', errore = null, aggiornato_il = ?, allineato = 0 where id = ?").run(ora, ora, String(s.id));
      fatte++;
    } catch (e) {
      db.prepare("update pos_stampa set stato = 'errore', errore = ?, aggiornato_il = ?, allineato = 0 where id = ?").run(String((e as Error).message ?? e).slice(0, 300), ora, String(s.id));
    }
  }
  return fatte;
}
