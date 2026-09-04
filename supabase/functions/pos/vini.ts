/* ============================================================
   vini.ts — in quale categoria va un vino, letto dal suo nome.

   Il listino del ristorante ha un centinaio di etichette e sta tutto in
   Fidra col prezzo giusto; quello che Fidra non dice e' la categoria. La
   proprieta' ha scelto di prenderle da li' lo stesso, perche' i due
   rischi non sono uguali (4 settembre 2026):

     il PREZZO sbagliato non si vede e costa una bottiglia → non si
     indovina mai, viene da Fidra;
     la CATEGORIA sbagliata si vede in un colpo nel back office e si
     sposta in un secondo → quella si puo' dedurre dal nome.

   Le categorie sono quelle del listino stampato, che il cameriere ha in
   mano: Bollicine, bianchi, rossi, i Colli Euganei a parte, i rosati, i
   dessert e i calici.

   Quello che non e' riconoscibile NON si inventa: torna null, e chi
   chiama lo mette da parte spento invece di infilarlo a caso.
   Modulo puro: lo prova vini.test.ts.
   ============================================================ */

/* i nomi delle categorie sono quelli che esistono gia' in banca dati,
   arrivati da Fidra con le fotografie della proprieta' */
export const CATEGORIE_VINO = [
  'Bollicine - champagnes',
  'Vini al calice',
  'Vini Dessert',
  'Rose',
  'Vino Bianco Colli',
  'Vino Bianco',
  'Vino Rosso Colli',
  'Vino Rosso',
] as const;
export type CategoriaVino = typeof CATEGORIE_VINO[number];

const BOLLICINE = /prosecco|franciacorta|champagne|spumant|brut\b|moet|mo[eë]t|veuve|clicquot|cartizze|ferrari|bellavista|metodo classico/i;
const DESSERT = /passito|vin santo|vinsanto|sauternes|recioto|torcolato|malvasia|fior d.arancio/i;
/* «Rosè» con l'accento non chiude con \b — l'accento non e' una lettera
   per le espressioni regolari, e «Vegro Rosè Sengiari» sfuggiva */
const ROSATO = /\brosè|\brosé|\brose\b|rosat|chiaretto|petalo di rosa/i;
const ROSSO = /\brosso|cabernet|merlot|bardolino|carmen[eè]re|refosco|raboso|amarone|valpolicella|nero d.avola|sangiovese|barbera|nebbiolo|barolo|barbaresco|primitivo|aglianico|montepulciano|chianti|corvina|pinot nero|shiraz|syrah/i;
const BIANCO = /\bbianco|chardonnay|sauvignon|pinot grigio|pinot bianco|soave|custoza|kerner|serprino|garganega|riesling|verduzzo|manzoni|traminer|m[uü]ller|gew[uü]rz|vermentino|falanghina|greco|fiano|lugana|friulano|tocai|prosecco tranquillo/i;
/* SOLO i Colli Euganei. «Colli Berici», «Colli Senesi», «Collio» sono
   altri posti: un Cabernet dei Colli Berici e' un rosso, non un rosso dei
   Colli (le schermate del POS ristorante, 4 settembre 2026). */
const COLLI = /colli euganei|\beuganei\b/i;
/* «vino» da solo non basta: «Vino Del Giorno» non e' una bottiglia di
   listino, e nemmeno «VARIE BEVANDE» */
const VINO_GENERICO = /\bvino\b|\bvini\b|\bdoc\b|\bdocg\b|\bigt\b|\bcalice\b|bottiglia|0,75|0,375/i;

/** Sembra un vino? Serve a non tirare dentro il resto del listino. */
export function eVino(nome: string): boolean {
  const n = String(nome ?? '');
  if (!n.trim()) return false;
  /* roba che vino non e', anche se il nome ci somiglia */
  if (/greenfee|soggiorno|ricarica|prodotti estetic|room service|acqua|birra|caff|the |tisan/i.test(n)) return false;
  return BOLLICINE.test(n) || DESSERT.test(n) || ROSATO.test(n) || ROSSO.test(n) || BIANCO.test(n) || VINO_GENERICO.test(n);
}

/** La categoria di un vino dal suo nome, o null se non si capisce.
    L'ordine conta: un «CALICE Vegro Rosè» e' un calice prima che un
    rosato, e un Franciacorta e' bollicina prima che bianco. */
export function categoriaVino(nome: string): CategoriaVino | null {
  const n = String(nome ?? '');
  if (!eVino(n)) return null;
  if (/^\s*(calice|bicch)/i.test(n)) return 'Vini al calice';
  /* IL PREFISSO DI FIDRA VINCE SU TUTTO. I vini del ristorante si chiamano
     «Vino Rosso Barolo…», «Vino Dessert Franciacorta Brut…»: la categoria
     e' scritta nel nome, e non c'e' niente da dedurre. Senza questa regola
     il Franciacorta finirebbe fra le bollicine invece che fra i dessert,
     dove Fidra lo tiene (le schermate del POS ristorante, 4 set 2026). */
  const colli = COLLI.test(n);
  if (/^\s*vino\s+dessert/i.test(n)) return 'Vini Dessert';
  if (/^\s*vino\s+ros[eèé]|^\s*vino\s+rosat/i.test(n)) return 'Rose';
  if (/^\s*vino\s+rosso/i.test(n)) return colli ? 'Vino Rosso Colli' : 'Vino Rosso';
  if (/^\s*vino\s+bianco/i.test(n)) return colli ? 'Vino Bianco Colli' : 'Vino Bianco';
  if (BOLLICINE.test(n)) return 'Bollicine - champagnes';
  if (DESSERT.test(n)) return 'Vini Dessert';
  if (ROSATO.test(n)) return 'Rose';
  if (ROSSO.test(n)) return colli ? 'Vino Rosso Colli' : 'Vino Rosso';
  if (BIANCO.test(n)) return colli ? 'Vino Bianco Colli' : 'Vino Bianco';
  return null;
}
