/* Il codice del buono letto dall'indirizzo, e il conto della differenza.
   ------------------------------------------------------------------
   Il conto e' RISCRITTO qui e non importato: questa pagina gira nel
   browser, quella funzione vive in Deno. Sono due copie della stessa
   regola, ed e' esattamente il difetto che questo progetto ha gia' pagato
   quattro volte coi listini — per questo buono-url.test.ts le confronta
   su ogni caso: se divergono, diventa rosso. */

const CODICE_MAX = 40;

export function codiceDaUrl(ricerca) {
  const v = new URLSearchParams(ricerca || '').get('buono') || '';
  const pulito = v.trim().toUpperCase();
  /* solo lettere, cifre e trattini: il codice non contiene altro, e cosi'
     un tentativo di iniezione non arriva nemmeno al server */
  if (!pulito || pulito.length > CODICE_MAX || !/^[A-Z0-9-]+$/.test(pulito)) return '';
  return pulito;
}

const numero = (v) => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
};
const centesimi = (n) => Math.round(n * 100) / 100;

export function differenzaBuono(copre, scelto) {
  const c = numero(copre);
  const s = numero(scelto);
  if (c === null || s === null) return { tipo: 'ignoto', copre: c ?? 0, scelto: s ?? 0, differenza: 0 };
  if (s > c) return { tipo: 'differenza', copre: c, scelto: s, differenza: centesimi(s - c) };
  if (s < c) return { tipo: 'residuo', copre: c, scelto: s, differenza: centesimi(c - s) };
  return { tipo: 'copre', copre: c, scelto: s, differenza: 0 };
}
