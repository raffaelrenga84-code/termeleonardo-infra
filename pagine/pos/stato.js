/* ============================================================
   stato.js — l'ordine in mano al cameriere, puro: nessun DOM, nessuna rete.
   Lo prova stato.test.ts. La pagina lo usa per le righe NUOVE, quelle non
   ancora mandate al server; le righe gia' inviate arrivano dal server.
   ============================================================ */
const PORTATE = ['bevande', 'antipasti', 'primi', 'secondi', 'dolci'];

/** @returns {{ righe: Array<Record<string, any>> }} */
export const creaOrdine = () => ({ righe: [] });

/** Aggiunge un articolo. Lo stesso articolo, senza nota ne' variante ne'
    prezzo a mano, toccato di nuovo fa quantita' + 1 sulla riga che c'e'. */
export function aggiungi(o, articolo, opz = {}) {
  const nota = opz.nota ?? null, variante = opz.variante ?? null, varianteId = opz.varianteId ?? null;
  const manuale = opz.prezzoManualeCent ?? null;
  const portata = opz.portata ?? articolo.portata;
  /* portate semplici: null = subito, 0 = segue a chiamata, N = segue tra N minuti */
  const segueMin = opz.segueMin ?? null;
  const quantita = opz.quantita ?? 1;
  const uguale = o.righe.find((r) => r.stato === 'da_inviare' && r.articolo === articolo.id && r.nota === nota &&
    r.variante === variante && r.prezzo_manuale_cent === manuale && r.portata === portata && (r.segue_min ?? null) === segueMin);
  if (uguale && !nota && !variante && manuale === null) {
    return { ...o, righe: o.righe.map((r) => r === uguale ? { ...r, quantita: r.quantita + quantita } : r) };
  }
  const riga = {
    id: crypto.randomUUID(), articolo: articolo.id, nome: articolo.nome,
    quantita, variante, variante_id: varianteId, nota,
    prezzo_manuale_cent: manuale, prezzo_cent: manuale ?? articolo.prezzo_cent,
    portata, segue_min: segueMin, stato: 'da_inviare',
  };
  return { ...o, righe: [...o.righe, riga] };
}

export const cambia = (o, id, campi) => ({ ...o, righe: o.righe.map((r) => r.id === id ? { ...r, ...campi } : r) });
export const togli = (o, id) => ({ ...o, righe: o.righe.filter((r) => r.id !== id) });

/** Le righe raggruppate per portata, nell'ordine delle portate. */
export function perPortata(o) {
  const m = new Map();
  for (const p of PORTATE) { const rr = o.righe.filter((r) => r.portata === p); if (rr.length) m.set(p, rr); }
  return m;
}

export const daInviare = (o) => o.righe.filter((r) => r.stato === 'da_inviare');
export const totaleCent = (o) => o.righe.filter((r) => r.stato !== 'stornata').reduce((t, r) => t + r.quantita * r.prezzo_cent, 0);
export const euro = (cent) => {
  const [intero, dec] = (Math.abs(cent) / 100).toFixed(2).split('.');
  return (cent < 0 ? '-' : '') + intero.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + dec + ' €';
};
export { PORTATE };

/** Ne stacca `quante` da una riga: tre piadine, una senza formaggio — la
    nota va solo a quella (la proprieta', 5 settembre 2026). La riga
    vecchia tiene il resto, la nuova e' una copia con un id suo, subito
    dopo. Per zero, per tutte, o su una riga che non c'e', non cambia
    niente. */
export function dividi(o, id, quante) {
  const r = o.righe.find((x) => x.id === id);
  const n = Math.floor(Number(quante) || 0);
  if (!r || n <= 0 || n >= r.quantita) return { ordine: o, nuova: null };
  const nuova = { ...r, id: crypto.randomUUID(), quantita: n };
  const righe = [];
  for (const x of o.righe) {
    if (x.id === id) righe.push({ ...x, quantita: x.quantita - n }, nuova);
    else righe.push(x);
  }
  return { ordine: { ...o, righe }, nuova: nuova.id };
}

/** I minuti del «segue» scelti nel back office («5,10,15»): interi fra 1 e
    180, senza doppioni, in ordine (la stessa regola di portate.ts). */
export function minutiSegue(testo) {
  const n = String(testo ?? '').split(/[^0-9]+/).filter(Boolean).map(Number).filter((x) => Number.isInteger(x) && x >= 1 && x <= 180);
  return [...new Set(n)].sort((a, b) => a - b);
}
