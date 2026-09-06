/* ============================================================
   bacheca.ts — la bacheca all'ingresso del Bistrot: le regole, pure.

   «una sezione a parte dove uno puo' scrivere a mano, per tutti i giorni
   della settimana, il primo del giorno e il secondo del giorno; e prendi
   random dai vini a calice del Bistrot il consigliato» (la proprieta', 6
   settembre 2026). Qui: che giorno e' a Roma (la TV e il cloud vivono in
   fusi diversi), quali articoli sono «vini al calice», come si sceglie il
   calice del giorno — a caso, ma lo stesso per tutta la giornata — e come
   si scrive il suo nome senza il «CALICE» davanti. Lo prova bacheca.test.ts;
   lo usano la funzione e il PC del Bistrot.
   ============================================================ */
export const GIORNI = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'] as const;
export const TESTO_MASSIMO = 300;

/** Il giorno di oggi a Roma: 1 = lunedi' … 7 = domenica, il nome, la data. */
export function giornoRoma(quando: Date, fuso = 'Europe/Rome'): { giorno: number; nome: string; data: string } {
  const parti = new Intl.DateTimeFormat('en-US', { timeZone: fuso, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(quando);
  const di = (t: string) => parti.find((p) => p.type === t)?.value ?? '';
  const idx: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const giorno = idx[di('weekday')] ?? 1;
  return { giorno, nome: GIORNI[giorno - 1], data: `${di('year')}-${di('month')}-${di('day')}` };
}

/** Un testo scritto a mano nel back office: pulito, al massimo TESTO_MASSIMO, null se vuoto. */
export function testoBacheca(x: unknown): string | null {
  const t = String(x ?? '').replace(/\r\n?/g, '\n').split('\n').map((r) => r.trim()).filter(Boolean).join('\n').slice(0, TESTO_MASSIMO).trim();
  return t || null;
}

type Categoria = { id: unknown; nome: unknown };
type Articolo = { nome: unknown; categoria: unknown; esaurito?: unknown; attivo?: unknown };

/** I vini al calice fra cui scegliere: le categorie col «calice» nel nome,
    gli articoli non esauriti, senza le mezze bottiglie («Vino Cl. 0,375») e
    senza i segnaposto «del giorno». */
export function candidatiCalice<T extends Articolo>(articoli: T[], categorie: Categoria[]): T[] {
  const calice = new Set(categorie.filter((c) => /calic/i.test(String(c.nome ?? ''))).map((c) => String(c.id)));
  return articoli.filter((a) => calice.has(String(a.categoria)) && !Number(a.esaurito ?? 0) && (a.attivo === undefined || !!Number(a.attivo))
    && !/^\s*vino\s+cl\b/i.test(String(a.nome ?? '')) && !/del\s+giorno/i.test(String(a.nome ?? '')));
}

/** Il nome sulla TV: via il «CALICE», il «Bicch.», il «di» che segue; spazi doppi via; iniziale maiuscola. */
export function nomeCalice(nome: unknown): string {
  const t = String(nome ?? '').replace(/^\s*(calice|bicch\.?|bicchiere)\s*(di\s+)?/i, '').replace(/\s+/g, ' ').trim();
  return t ? t[0].toUpperCase() + t.slice(1) : '';
}

/** A caso, ma sempre lo stesso per lo stesso seme (la data e il locale): il
    calice del giorno non cambia ogni minuto. Null senza candidati. */
export function scegliCalice<T>(candidati: T[], seme: string): T | null {
  if (!candidati.length) return null;
  let h = 5381;
  for (let i = 0; i < seme.length; i++) h = ((h * 33) ^ seme.charCodeAt(i)) >>> 0;
  return candidati[h % candidati.length];
}
