/* ============================================================
   opinione.ts — l'opinione dell'ospite dal totem: lettura del corpo,
   email per la direzione, destinatari. Modulo puro: lo prova
   opinione.test.ts. La rete e il database stanno in index.ts.
   ============================================================ */
export type Lingua = 'it' | 'en' | 'de' | 'fr';
const LINGUE: readonly Lingua[] = ['it', 'en', 'de', 'fr'];
const NOME_LINGUA: Record<Lingua, string> = { it: 'italiano', en: 'inglese', de: 'tedesco', fr: 'francese' };

/* i sette temi, nell'ordine in cui il totem li mostra; le parole per
   l'ospite nelle quattro lingue stanno nella pagina (opinione.js) */
export const TEMI = [
  { chiave: 'camera', it: 'Camera' },
  { chiave: 'cure', it: 'Cure termali' },
  { chiave: 'piscine', it: 'Piscine e spa' },
  { chiave: 'ristorante', it: 'Ristorante' },
  { chiave: 'personale', it: 'Personale' },
  { chiave: 'pulizia', it: 'Pulizia' },
  { chiave: 'prezzo', it: 'Prezzo' },
] as const;

export type Voti = Record<string, number>;
export type Opinione = { lingua: Lingua; stelle: number; temi: string[]; voti: Voti; commento: string | null; tessera: string | null };

/** Il corpo mandato dal totem, ripulito. Le stelle sono l'unica cosa
    obbligatoria: senza, non c'e' opinione. */
export function leggiOpinione(corpo: unknown): { ok: true; valore: Opinione } | { ok: false; errore: string } {
  const c = (corpo && typeof corpo === 'object' ? corpo : {}) as Record<string, unknown>;
  const stelle = Number(c.stelle);
  if (!Number.isInteger(stelle) || stelle < 1 || stelle > 5) return { ok: false, errore: 'le stelle vanno da 1 a 5' };
  const lingua = LINGUE.includes(c.lingua as Lingua) ? c.lingua as Lingua : 'it';
  const noti = new Set<string>(TEMI.map((t) => t.chiave));
  const temi = Array.isArray(c.temi) ? [...new Set(c.temi.map(String).filter((t) => noti.has(t)))] : [];
  const commento = typeof c.commento === 'string' && c.commento.trim() ? c.commento.trim().slice(0, 500) : null;
  const tessera = typeof c.tessera === 'string' && /^[0-9]{4,20}$/.test(c.tessera.trim()) ? c.tessera.trim() : null;
  /* un voto per reparto, tutti facoltativi: si tiene solo cio' che ha senso */
  const voti: Voti = {};
  const dati = (c.voti && typeof c.voti === 'object' ? c.voti : {}) as Record<string, unknown>;
  for (const t of TEMI) {
    const v = Number(dati[t.chiave]);
    if (Number.isInteger(v) && v >= 1 && v <= 5) voti[t.chiave] = v;
  }
  return { ok: true, valore: { lingua, stelle, temi, voti, commento, tessera } };
}

export const stelleTesto = (n: number): string => '★'.repeat(n) + '☆'.repeat(5 - n);

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const oraRoma = (iso: string) => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)).replace(',', '');

export type PerEmail = {
  lingua: Lingua; stelle: number; temi: string[]; voti?: Voti; commento: string | null;
  camera: string | null; tesseraFallita: boolean; creatoIl: string; fonte: string; prova: boolean;
};

/** L'email per la direzione: tutto quello che c'e', in italiano. */
export function emailOpinione(o: PerEmail): { oggetto: string; html: string; testo: string } {
  const chi = o.camera ? `camera ${o.camera}` : 'anonima';
  const oggetto = `Opinione dal ${o.fonte}: ${stelleTesto(o.stelle)} ${o.stelle}/5 · ${chi}`;
  const temi = o.temi.map((k) => (TEMI.find((t) => t.chiave === k) || { it: k }).it);
  /* i reparti dal voto piu' basso: la prima riga e' quella da guardare */
  const voti = Object.entries(o.voti ?? {}).sort((a, b) => a[1] - b[1]);
  const righe: [string, string][] = [
    ['Quando', oraRoma(o.creatoIl)],
    ['Stelle', `${stelleTesto(o.stelle)} (${o.stelle}/5)`],
    ['Ospite', o.camera ? `camera ${o.camera}` : (o.tesseraFallita ? 'anonima (tessera non riconosciuta)' : 'anonima')],
    ['Lingua', NOME_LINGUA[o.lingua]],
    ...voti.map(([k, v]): [string, string] => [(TEMI.find((t) => t.chiave === k) || { it: k }).it, `${stelleTesto(v)} (${v}/5)`]),
    ...(temi.length ? [['Temi', temi.join(', ')] as [string, string]] : []),
    ['Commento', o.commento || 'nessun commento'],
  ];
  if (o.prova) righe.push(['Nota', 'opinione di prova (DAYSPA_PROVA)']);
  const testo = `Opinione dal ${o.fonte}\n\n` + righe.map(([k, v]) => `${k}: ${v}`).join('\n') + '\n';
  const html = `<div style="font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#2A2E2B;max-width:560px;">
    <p style="font-size:22px;margin:0 0 12px;">${esc(stelleTesto(o.stelle))} <span style="font-size:15px;color:#7B756A;">${o.stelle}/5 · ${esc(chi)}</span></p>
    <table style="border-collapse:collapse;">${righe.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#7B756A;vertical-align:top;">${esc(k)}</td><td style="padding:4px 0;white-space:pre-wrap;">${esc(v)}</td></tr>`).join('')}</table>
  </div>`;
  return { oggetto, html, testo };
}

/** Sempre la direzione; la reception solo quando puo' ancora fare qualcosa:
    3 stelle o meno E si sa la camera. Lo stesso indirizzo una volta sola. */
export function destinatariOpinione(o: { stelle: number; camera: string | null }, direzione: string, reception: string): string[] {
  const a = [direzione];
  if (o.stelle <= 3 && o.camera && reception && !a.includes(reception)) a.push(reception);
  return a;
}
