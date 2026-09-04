/* ============================================================
   in-casa.ts — chi e' in casa, come lo capisce il POS.

   Le righe arrivano dall'estensione, che legge la pagina «In Casa» di
   Fidra (day-overview). Qui si decide una cosa sola ma importante: quanti
   pasti comprende l'arrangiamento. Da quella dipende se il menu' del
   giorno si paga o e' gia' dentro il soggiorno.

   I nomi degli arrangiamenti sono quelli del listino di Fidra: «Mi.Pr.
   Mezza Pensione», «Mi.Pr. Bed & Breakfast», «Do.Vi. 5 cure», «So.br.
   Mezza Pensione». I pacchetti cure (Dolce Vita, Spezial) comprendono la
   mezza pensione: al Leonardo la cura si vende sempre con la pensione.

   Modulo puro: lo prova in-casa.test.ts.
   ============================================================ */
export type Pasti = 'colazione' | 'mezza' | 'completa';

export type InCasa = {
  camera: string;
  cognome: string;
  nome: string | null;
  fidra_cliente: string | null;
  fidra_soggiorno: string | null;
  fidra_prenotazione: string | null;
  email: string | null;
  lingua: string | null;
  arrangiamento: string | null;
  pasti: Pasti;
  adulti: number;
  bambini: number;
  arrivo: string | null;
  partenza: string | null;
  note: string | null;
};

/** Quanti pasti comprende l'arrangiamento scritto da Fidra. */
export function pastiDi(arrangiamento: unknown): Pasti {
  const t = String(arrangiamento ?? '').toLowerCase();
  if (/pensione completa|full board|vollpension/.test(t)) return 'completa';
  if (/mezza pensione|half board|halbpension/.test(t)) return 'mezza';
  /* i pacchetti cure si vendono con la pensione: Dolce Vita, Spezial */
  if (/\bcure\b|dolce vita|do\.vi\.|spezial/.test(t)) return 'mezza';
  return 'colazione';
}

const testo = (x: unknown, max: number): string | null => {
  const s = String(x ?? '').trim().replace(/\s+/g, ' ');
  return s ? s.slice(0, max) : null;
};
const numero = (x: unknown, se: number): number => {
  const n = Number(x);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : se;
};
const giorno = (x: unknown): string | null => {
  const s = String(x ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

/** Legge le righe mandate dall'estensione. Scarta quelle senza camera o
    senza cognome: senza quelle due non servono a niente. */
export function leggiInCasa(righe: unknown): InCasa[] {
  if (!Array.isArray(righe)) return [];
  const fuori: InCasa[] = [];
  for (const r of righe) {
    const o = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
    const camera = testo(o.camera, 20);
    const cognome = testo(o.cognome, 80);
    if (!camera || !cognome) continue;
    fuori.push({
      camera, cognome,
      nome: testo(o.nome, 80),
      fidra_cliente: testo(o.fidra_cliente, 20),
      fidra_soggiorno: testo(o.fidra_soggiorno, 20),
      fidra_prenotazione: testo(o.fidra_prenotazione, 20),
      email: testo(o.email, 200),
      lingua: ['it', 'en', 'de', 'fr'].includes(String(o.lingua)) ? String(o.lingua) : null,
      arrangiamento: testo(o.arrangiamento, 120),
      pasti: pastiDi(o.arrangiamento),
      adulti: numero(o.adulti, 1),
      bambini: numero(o.bambini, 0),
      arrivo: giorno(o.arrivo),
      partenza: giorno(o.partenza),
      /* le note della prenotazione: allergie, «no cane», «paga il figlio».
         Sono lunghe e sono di chi le ha scritte: si tagliano, non si
         riscrivono. */
      note: testo(o.note, 1000),
    });
  }
  return fuori;
}
