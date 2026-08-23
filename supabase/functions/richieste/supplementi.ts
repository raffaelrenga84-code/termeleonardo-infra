/* supplementi.ts — la culla e il cane dentro il conto delle email.

   IL DIFETTO CHE CORREGGE, segnalato dalla proprietà con la ricevuta
   ricevuta sul telefono: la pagina gli aveva mostrato «Con i supplementi:
   516,00 €» e l'email diceva «Prezzo 460,00 €». Due numeri per la stessa
   richiesta, e quello scritto è il più basso: la differenza si scopre al
   banco, che è il posto peggiore.

   I NUMERI SONO UNA COPIA di pagine/prenota/cane.js e culla.js. Le
   funzioni si pubblicano una cartella per volta e non possono importare
   dalle pagine — è la stessa ragione per cui esistono le altre copie di
   questo progetto, e come quelle è tenuta ferma da una prova che confronta
   i due valori (supplementi.test.ts).

   LE DUE REGOLE, che devono restare quelle della pagina:

   · la CULLA è della camera e costa per tutto il soggiorno: due camere con
     la culla, due supplementi;
   · il CANE è della persona e costa AL GIORNO, su tutto il soggiorno — dal
     primo arrivo all'ultima partenza, non sulle notti di una camera sola,
     che con periodi diversi direbbe un numero più basso di quello che la
     reception poi chiede. */

import { camereInPiu } from './altre-camere.ts';
import { riga } from './dettagli-richiesta.ts';

/** 13,00 € al giorno per animale. Copia di SUPPLEMENTO_CANE_CENT in
 *  pagine/prenota/cane.js. */
export const SUPPLEMENTO_CANE_CENT = 1300;

/** 30,00 € per tutto il soggiorno, NON al giorno. Copia di
 *  SUPPLEMENTO_CULLA_CENT in pagine/prenota/culla.js. */
export const SUPPLEMENTO_CULLA_CENT = 3000;

const GIORNO_MS = 86400000;

/** Le notti fra due giorni scritti come 2026-09-02. Mezzogiorno e non
 *  mezzanotte: a cavallo dell'ora legale una differenza calcolata sulle
 *  mezzanotti dà 23 o 25 ore e arrotonda a una notte in meno. */
function nottiFra(arrivo: unknown, partenza: unknown): number {
  const g = (v: unknown) => {
    const s = String(v ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const d = new Date(s + 'T12:00:00Z');
    return isNaN(d.getTime()) ? null : d.getTime();
  };
  const a = g(arrivo);
  const p = g(partenza);
  if (a === null || p === null) return 0;
  const n = Math.round((p - a) / GIORNO_MS);
  return n > 0 ? n : 0;
}

/** Tutte le camere di una richiesta, appiattite: la prima più quelle in
 *  più. Serve sia per contare le culle sia per trovare la finestra del
 *  soggiorno. */
function tutteLeCamere(
  prima: Record<string, unknown>,
  altre: unknown,
): Record<string, unknown>[] {
  const inPiu = camereInPiu(altre).map((c) => {
    const col = (c.colonne || {}) as Record<string, unknown>;
    return { ...col, ...((col.dati || {}) as Record<string, unknown>) };
  });
  return [prima || {}, ...inPiu];
}

/** Le notti del soggiorno intero: dal primo arrivo all'ultima partenza. */
export function nottiDelSoggiorno(
  prima: Record<string, unknown>,
  altre: unknown,
): number {
  const camere = tutteLeCamere(prima, altre);
  const date = (campo: string) =>
    camere.map((c) => c[campo]).filter(Boolean).map(String).sort();
  const arrivi = date('check_in');
  const partenze = date('check_out');
  if (!arrivi.length || !partenze.length) return 0;
  return nottiFra(arrivi[0], partenze[partenze.length - 1]);
}

/** I supplementi, uno per riga, con le stesse regole della pagina.
 *
 *  Torna un elenco vuoto quando non ce n'è nessuno: una riga «Culla 0,00 €»
 *  è un prezzo in più su un'email che ne ha già tanti. */
export function vociSupplementi(
  prima: Record<string, unknown>,
  altre: unknown,
  t: Record<string, string>,
): { eti: string; cent: number }[] {
  const voci: { eti: string; cent: number }[] = [];
  const culle = tutteLeCamere(prima, altre).filter((c) => c.culla === true).length;
  if (culle) {
    voci.push({
      eti: culle === 1 ? t.extraCulla1 : (t.extraCullaN || '').replace('{n}', String(culle)),
      cent: culle * SUPPLEMENTO_CULLA_CENT,
    });
  }
  /* il cane e' della PERSONA e sta sulla richiesta capofila: chi prenota
     tre stanze ha un cane, non tre */
  const notti = (prima || {}).cane === true ? nottiDelSoggiorno(prima, altre) : 0;
  if (notti > 0) {
    voci.push({
      eti: (t.extraCane || '').replace('{n}', String(notti)),
      cent: notti * SUPPLEMENTO_CANE_CENT,
    });
  }
  return voci;
}

export function supplementiCent(
  prima: Record<string, unknown>,
  altre: unknown,
  t: Record<string, string>,
): number {
  return vociSupplementi(prima, altre, t).reduce((n, v) => n + v.cent, 0);
}

/** Le righe dei supplementi per le due email, nello stesso formato delle
 *  altre. */
export function righeSupplementi(
  prima: Record<string, unknown>,
  altre: unknown,
  t: Record<string, string>,
  cifra: (c: unknown) => string,
): string {
  return vociSupplementi(prima, altre, t)
    .map((v) => riga(v.eti, cifra(v.cent)))
    .join('');
}
