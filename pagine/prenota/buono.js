/* buono.js — che cosa succede alla caparra quando c'e' un buono.

   LA REGOLA, decisa dalla proprieta' il 21 agosto 2026: il buono COPRE
   la caparra. Se vale meno, la caparra si riduce di quel tanto.

   E SI DICE COSI' E BASTA: «il buono copre la caparra». Non «non le sara'
   chiesto nulla», che sarebbe falso — resta la tassa di soggiorno, e
   restano gli extra. Una frase che promette troppo si paga al banco.

   PERCHE' QUESTA PAGINA NON SCONTA IL PREZZO. /prenota non incassa
   niente: e' una richiesta, e la reception conferma. Un totale gia'
   scontato sarebbe una promessa che questa pagina non puo' mantenere — e
   se il buono nel frattempo fosse gia' stato speso, l'ospite avrebbe
   visto un numero che non esiste. Si tocca solo la CAPARRA, che e' una
   cosa che la reception chiedera' o non chiedera'.

   IL VALORE ARRIVA IN EURO. La colonna `valore` di buono_regalo e' in
   euro, non in centesimi — come la legge gia' la pagina /richieste. La
   caparra invece vive in centesimi. Convertire nel posto sbagliato qui
   vorrebbe dire sbagliare di cento volte su una cifra che l'ospite legge.

   Presidiato da buono.test.ts. */

'use strict';

/** Il valore di un buono in centesimi, o null se non si sa.
 *  `valore` arriva dall'API in EURO, e puo' arrivare come stringa. */
export function valoreInCentesimi(valore) {
  const n = typeof valore === 'string' ? Number(valore) : valore;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

/** Che cosa resta della caparra.
 *
 *  Restituisce { copre, resta }:
 *  · `copre` vero quando il buono vale almeno quanto la caparra;
 *  · `resta` i centesimi che la reception chiedera' comunque.
 *
 *  Senza un buono leggibile la caparra resta intera: un dato che non si
 *  capisce non fa sconti. */
export function caparraDopoBuono(caparraCent, buonoCent) {
  const c = Number(caparraCent);
  if (!Number.isInteger(c) || c < 0) return { copre: false, resta: 0 };
  const b = Number(buonoCent);
  if (!Number.isInteger(b) || b <= 0) return { copre: false, resta: c };
  if (b >= c) return { copre: true, resta: 0 };
  return { copre: false, resta: c - b };
}
