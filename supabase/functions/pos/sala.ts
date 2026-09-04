/* ============================================================
   sala.ts — zone e tavoli come li manda la piantina di Fidra.

   Fidra chiama «categories» le zone del POS e disegna i tavoli sopra una
   pianta, ognuno col suo posto; l'estensione legge la zona aperta e manda
   nome, posti e posizione in percentuale. Qui si ripuliscono: i nomi
   misti di Fidra («Tavolo 9» dentro, «Table 21» fuori) diventano uno
   solo, le coordinate restano fra 0 e 100, i tavoli senza nome cadono.
   Modulo puro: lo prova sala.test.ts.
   ============================================================ */
export type TavoloImportato = { nome: string; posti: number; x: number; y: number };
export type Sala = { locale: string; zona: string; zona_fidra: string | null; tavoli: TavoloImportato[] };
export type Esito<T> = { ok: true; valore: T } | { ok: false; errore: string };

const PAROLE_TAVOLO = /^(tavolo|table|tisch|mesa)\b\s*/i;

/** «Table 21» → «Tavolo 21». Un nome che non comincia con una parola per
    «tavolo» resta com'e': al bar ci sono anche i divani. */
export function nomeTavolo(grezzo: unknown): string {
  const t = String(grezzo ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  return PAROLE_TAVOLO.test(t) ? `Tavolo ${t.replace(PAROLE_TAVOLO, '')}`.replace(/\s+/g, ' ').trim() : t;
}

/** Per metterli in fila: il numero del tavolo, o in fondo. */
export const numeroTavolo = (nome: string): number => {
  const m = String(nome).match(/(\d+)/);
  return m ? Number(m[1]) : 9999;
};

/** La chiave con cui si riconosce lo stesso tavolo gia' nostro. */
export const chiaveNome = (nome: unknown): string => nomeTavolo(nome).toLowerCase().replace(/\s+/g, '');

const dentro = (v: unknown): number => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 50;
  return Math.round(Math.min(100, Math.max(0, n)) * 10) / 10;
};

export function leggiSala(corpo: unknown): Esito<Sala> {
  const c = (corpo && typeof corpo === 'object' ? corpo : {}) as Record<string, unknown>;
  const locale = String(c.locale ?? '').trim();
  const zona = String(c.zona ?? '').replace(/\s+/g, ' ').trim();
  if (!locale) return { ok: false, errore: 'serve il locale' };
  if (!zona) return { ok: false, errore: 'serve la zona' };
  const grezzi = Array.isArray(c.tavoli) ? c.tavoli as Record<string, unknown>[] : [];
  const visti = new Set<string>();
  const tavoli: TavoloImportato[] = [];
  for (const t of grezzi) {
    const nome = nomeTavolo(t.nome);
    if (!nome || visti.has(chiaveNome(nome))) continue;
    visti.add(chiaveNome(nome));
    /* «(0/0)» in Fidra vuol dire posti non impostati: quattro, come i suoi */
    const posti = Math.min(30, Math.max(1, Math.round(Number(t.posti) || 0) || 4));
    tavoli.push({ nome, posti, x: dentro(t.x), y: dentro(t.y) });
  }
  if (!tavoli.length) return { ok: false, errore: 'nessun tavolo da importare' };
  tavoli.sort((a, b) => numeroTavolo(a.nome) - numeroTavolo(b.nome) || a.nome.localeCompare(b.nome));
  return { ok: true, valore: { locale, zona, zona_fidra: String(c.zona_fidra ?? '').trim() || null, tavoli } };
}
