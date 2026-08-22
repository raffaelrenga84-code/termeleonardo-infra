/* altre-camere.ts — le camere in più dentro le due email.

   IL DIFETTO CHE CORREGGE, trovato rispondendo a una domanda della
   proprietà («con più camere il cane dove va? che altri problemi
   potrebbero emergere?»).

   Il carrello salva N righe e index.ts le mette in `altre_camere` dentro
   i dati passati alle due email. Il commento accanto a quel campo dice
   testualmente «senza, l'ospite riceverebbe una ricevuta con una camera
   sola dopo averne prenotate tre» — ed era esattamente quello che
   succedeva: NESSUNO leggeva quel campo. Chi prenotava tre camere
   riceveva una ricevuta con una camera e un prezzo, e la reception
   riceveva un avviso con una camera; le altre due esistevano in back
   office, legate dal campo `insieme`, ma nell'email — cioè nell'unica
   cosa che qualcuno legge davvero — non c'erano.

   È lo stesso difetto del buono regalo, già visto in questo progetto: un
   dato che arriva al database e non entra nell'email è un dato che
   nessuno leggerà.

   PERCHÉ UN MODULO SOLO PER LE DUE EMAIL. Le righe sono le stesse —
   periodo, camera, pacchetto, prezzo — e le costruisce dettagli(), la
   stessa funzione che disegna la prima camera. Due copie divergerebbero
   al primo campo aggiunto.

   IL TOTALE. Chi ne prenota tre vuole sapere quanto spende in tutto, e
   sulla pagina quel numero l'ha già visto: non ripeterlo nell'email
   vorrebbe dire farglielo ricalcolare a mano da tre cifre sparse. */

import { dettagli, esc, riga } from './dettagli-richiesta.ts';

/** Una camera in più com'è stata salvata: le colonne della riga e il suo
 *  numero di pratica. La forma è quella che index.ts mette in
 *  `altre_camere`. */
export type CameraInPiu = {
  colonne?: Record<string, unknown> | null;
  numero?: string | null;
};

/** Le camere in più, normalizzate: quello che non è una lista di camere
 *  vere diventa una lista vuota, e le due email non stampano niente. Un
 *  jsonb arriva da un database e può essere qualunque cosa. */
export function camereInPiu(v: unknown): CameraInPiu[] {
  if (!Array.isArray(v)) return [];
  return v.filter((c): c is CameraInPiu =>
    !!c && typeof c === 'object' && !Array.isArray(c)
  );
}

/** I campi di una camera come li vogliono le righe: le colonne più il
 *  jsonb appiattito, esattamente come index.ts fa per la prima. */
function appiattita(c: CameraInPiu): Record<string, unknown> {
  const col = (c.colonne || {}) as Record<string, unknown>;
  const dati = (col.dati || {}) as Record<string, unknown>;
  return { ...col, ...dati };
}

/** Quanto costa una camera, in centesimi. Zero quando non si sa: un
 *  totale che somma NaN non si stampa affatto, ed è peggio di un totale
 *  che vale un po' meno. */
function prezzoCent(d: Record<string, unknown>): number {
  const n = Number(d.prezzo_cent);
  return Number.isFinite(n) ? n : 0;
}

/** Il totale di TUTTE le camere: la prima più quelle in più. */
export function totaleCamereCent(prima: Record<string, unknown>, altre: unknown): number {
  return camereInPiu(altre)
    .map((c) => prezzoCent(appiattita(c)))
    .reduce((t, n) => t + n, prezzoCent(prima || {}));
}

/** Le righe delle camere in più, da appendere alla tabella dei dettagli.
 *
 *  Ogni camera si apre con «Camera 2» e il SUO numero di pratica: in
 *  reception quelle righe sono pratiche distinte, e senza il numero
 *  accanto non si saprebbe quale foglio corrisponde a quale camera.
 *
 *  Torna stringa vuota quando non ce ne sono: chi prenota una camera sola
 *  non deve leggere un'intestazione che annuncia il nulla. */
export function righeAltreCamere(
  altre: unknown,
  t: Record<string, string>,
): string {
  const camere = camereInPiu(altre);
  if (!camere.length) return '';
  return camere.map((c, i) => {
    const d = appiattita(c);
    const corpo = dettagli('soggiorno', d, t);
    if (!corpo) return '';
    /* la numerazione parte da 2: la prima camera e' quella qui sopra */
    const titolo = `${t.cameraN ? t.cameraN.replace('{n}', String(i + 2)) : ''}`;
    return `<tr><td colspan="2" style="padding:16px 0 4px;border-top:1px solid #E6E2D8;">
      <span style="font-size:13px;color:#1B4D4A;font-weight:bold;">${esc(titolo)}</span>
      ${c.numero ? `<span style="font-size:12px;color:#9AA9A6;"> · ${esc(String(c.numero))}</span>` : ''}
    </td></tr>${corpo}`;
  }).join('');
}

/** La riga del totale di tutte le camere. Solo quando le camere sono più
 *  d'una: sotto un prezzo solo, «Totale» ripeterebbe la stessa cifra due
 *  righe più sotto. */
export function rigaTotale(
  prima: Record<string, unknown>,
  altre: unknown,
  t: Record<string, string>,
  cifra: (c: unknown) => string,
): string {
  if (!camereInPiu(altre).length) return '';
  return riga(t.totaleCamere, cifra(totaleCamereCent(prima, altre)));
}
