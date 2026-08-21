/* famiglie.js — le tariffe di una camera, accorpate per famiglia.

   IL DIFETTO. Sulla Matrimoniale Queen uscivano tre righe:

     Miglior Prezzo   · Bed & Breakfast  380
     Soggiorno breve  · Mezza Pensione   520
     Thermal Escape   · Mezza Pensione   594

   Le prime due SONO LA STESSA OFFERTA, con e senza cena: «Soggiorno
   breve» e' il nome che prende il prezzo in mezza pensione quando il
   soggiorno e' di una o due notti (detto dalla proprieta' il 21 agosto
   2026). Due nomi diversi per una differenza sola, e nessun modo per
   l'ospite di capirlo — anzi, «Soggiorno breve» accanto a «Miglior
   Prezzo» sembra un prodotto diverso.

   COSA FA. Mette in una famiglia sola tutto quello che NON e' un
   pacchetto, e lascia ogni pacchetto per conto suo — perche' un pacchetto
   comprende altro (un massaggio) e non e' la stessa cosa con la cena in
   piu'. Dentro la famiglia resta un'opzione per trattamento.

   PERCHE' NON SI RAGGRUPPA PER NOME. Perche' il nome cambia con la durata
   del soggiorno: un elenco di nomi sarebbe giusto oggi e sbagliato per un
   soggiorno di cinque notti. Si guarda invece se la tariffa comprende
   qualcosa (piani.js lo sa), che e' il fatto vero.

   IL LIMITE, DETTO. Se due tariffe diverse offrissero lo STESSO
   trattamento a prezzi diversi — per esempio una rimborsabile e una no —
   qui resterebbe la piu' economica e l'altra sparirebbe. Oggi non
   succede: la risposta del motore non porta nessuna condizione di
   cancellazione per tariffa, quindi due righe con lo stesso trattamento
   sarebbero indistinguibili anche per l'ospite. Se un domani quelle
   condizioni arrivassero nei dati, questa regola va rifatta — e c'e' una
   prova che lo dice.

   Presidiato da famiglie.test.ts. */

'use strict';

/** Accorpa le tariffe di una camera.
 *
 *  `comprende(tariffa)` dice se quella tariffa e' un pacchetto (in
 *  pratica massaggioDelPiano di piani.js): si riceve invece di importarlo
 *  perche' cosi' questa regola si prova da sola.
 *
 *  Restituisce le famiglie dalla piu' economica, e dentro ognuna le
 *  opzioni dalla piu' economica. */
export function accorpa(voci, comprende) {
  const prezzo = (v) => Number(v?.prezzo_cent) || 0;
  const famiglie = new Map();

  for (const v of voci ?? []) {
    const pacchetto = typeof comprende === 'function' && comprende(v?.tariffa);
    const chiave = pacchetto ? 'pacchetto:' + String(v?.tariffa ?? '') : 'standard';
    if (!famiglie.has(chiave)) famiglie.set(chiave, new Map());
    const perTrattamento = famiglie.get(chiave);
    const b = String(v?.trattamento ?? '');
    const gia = perTrattamento.get(b);
    /* a parita' di trattamento resta la piu' economica: vedi IL LIMITE */
    if (!gia || prezzo(v) < prezzo(gia)) perTrattamento.set(b, v);
  }

  return [...famiglie.entries()]
    .map(([chiave, perTrattamento]) => ({
      chiave,
      opzioni: [...perTrattamento.values()].sort((a, b) => prezzo(a) - prezzo(b)),
    }))
    .sort((a, b) => prezzo(a.opzioni[0]) - prezzo(b.opzioni[0]));
}
