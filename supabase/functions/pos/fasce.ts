/* ============================================================
   fasce.ts — i listini a fasce: happy hour, il prezzo di sera. Puro.

   «i listini a fasce (happy hour, prezzo diverso di sera)» (la
   proprieta', 4 settembre 2026). Una fascia ha ore di inizio e fine
   (la fine esclusa; anche a cavallo della mezzanotte: dalle 22 alle 2),
   i giorni della settimana, il locale. Dentro la fascia un articolo
   costa il prezzo scritto apposta per lui (pos_prezzo_fascia), se no il
   listino meno lo sconto della fascia — solo per le categorie segnate,
   o per tutte se non ne e' segnata nessuna.

   L'ora e' quella dell'hotel (Europe/Rome), non quella del server, che
   sta chissa' dove. Lo prova fasce.test.ts.
   ============================================================ */
export type Fascia = {
  id: string; nome: string; locale?: string | null; dalle: string; alle: string;
  giorni?: number[] | null; sconto_percento?: number | null; categorie?: string[] | null; attiva?: boolean | number | null;
};
export type PrezzoFascia = { fascia: string; articolo: string; prezzo_cent: number };
export type Adesso = { minuti: number; giorno: number };   // minuti da mezzanotte, 0 = domenica
export const FUSO = 'Europe/Rome';

/** Che ora e' e che giorno e', nel fuso dell'hotel. */
export function oraLocale(quando: Date, fuso = FUSO): Adesso {
  const parti = new Intl.DateTimeFormat('en-US', { timeZone: fuso, hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(quando);
  const di = (t: string) => parti.find((p) => p.type === t)?.value ?? '';
  const giorni: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { minuti: (Number(di('hour')) % 24) * 60 + Number(di('minute')), giorno: giorni[di('weekday')] ?? 0 };
}

/** «17:00» → 1020; null se non e' un'ora. */
export function minutiDi(hhmm: unknown): number | null {
  const [h, m] = String(hhmm ?? '').trim().split(':');
  if (h === undefined || m === undefined || h === '' || m === '') return null;
  const hh = Number(h), mm = Number(m);
  if (!Number.isInteger(hh) || !Number.isInteger(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function dentro(f: Fascia, adesso: Adesso): boolean {
  const da = minutiDi(f.dalle), a = minutiDi(f.alle);
  if (da === null || a === null) return false;
  const giorni = Array.isArray(f.giorni) && f.giorni.length ? f.giorni.map(Number) : null;
  const oggi = !giorni || giorni.includes(adesso.giorno);
  if (da === a) return oggi;                                   // tutto il giorno
  if (da < a) return oggi && adesso.minuti >= da && adesso.minuti < a;
  /* a cavallo della mezzanotte: la parte serale e' di oggi, quella dopo
     mezzanotte appartiene ancora al giorno prima */
  if (adesso.minuti >= da) return oggi;
  if (adesso.minuti < a) return !giorni || giorni.includes((adesso.giorno + 6) % 7);
  return false;
}

/** La fascia in corso, o null. Una fascia del locale vince su una di tutti. */
export function fasciaAttiva({ fasce, adesso, locale }: { fasce: Fascia[]; adesso: Adesso; locale?: string | null }): Fascia | null {
  const buone = (fasce ?? []).filter((f) => (f.attiva === undefined || f.attiva === null || !!f.attiva) && (!f.locale || f.locale === locale) && dentro(f, adesso));
  if (!buone.length) return null;
  return buone.find((f) => !!f.locale) ?? buone[0];
}

/** Quanto costa un articolo dentro la fascia; null = come sempre. */
export function prezzoInFascia({ articolo, fascia, prezzi }: {
  articolo: { id: string; categoria?: string | null; prezzo_cent: number }; fascia: Fascia | null; prezzi: PrezzoFascia[];
}): number | null {
  if (!fascia) return null;
  const scritto = (prezzi ?? []).find((p) => p.fascia === fascia.id && p.articolo === articolo.id);
  if (scritto) return Math.max(0, Math.round(Number(scritto.prezzo_cent) || 0));
  const sconto = Number(fascia.sconto_percento);
  if (!Number.isFinite(sconto) || sconto <= 0) return null;
  const cats = Array.isArray(fascia.categorie) && fascia.categorie.length ? fascia.categorie : null;
  if (cats && !cats.includes(String(articolo.categoria ?? ''))) return null;
  const base = Math.round(Number(articolo.prezzo_cent) || 0);
  if (base <= 0) return null;
  return Math.round(base * (100 - sconto) / 100);
}

/** Il menu' con la fascia applicata: prezzo in vigore, e il listino da parte. */
export function applicaFascia<T extends { id: string; categoria?: string | null; prezzo_cent: number }>({ articoli, fascia, prezzi }: {
  articoli: T[]; fascia: Fascia | null; prezzi: PrezzoFascia[];
}): (T & { prezzo_base_cent?: number; in_fascia?: boolean })[] {
  if (!fascia) return articoli;
  return articoli.map((a) => {
    const p = prezzoInFascia({ articolo: a, fascia, prezzi });
    return p === null ? a : { ...a, prezzo_cent: p, prezzo_base_cent: Number(a.prezzo_cent), in_fascia: true };
  });
}
