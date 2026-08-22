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

   COSA FA. Mette in una famiglia le tariffe con lo STESSO PIANO, e dentro
   tiene un'opzione per trattamento: e' li' che «aggiungi la cena» ha un
   senso, perche' e' la stessa offerta con e senza. Fra piani diversi non
   si accorpa niente.

   IL LIMITE CHE C'ERA E CHE E' STATO PAGATO. Fino al 22 agosto 2026 la
   famiglia era «ha un massaggio o no», e dentro restava una sola opzione
   per trattamento. Su un soggiorno lungo (provato su 02-20 settembre) una
   camera ha cinque proposte:

     Miglior Prezzo · Bed & Breakfast · 3255
     Miglior Prezzo · Mezza Pensione  · 3705
     Dolce Vita     · 5 cure          · 3965
     Dolce Vita     · 10 cure         · 4225
     Golf           · Mezza Pensione  · 3878

   «Golf» ha la stessa Mezza Pensione di «Miglior Prezzo» e costa di piu':
   SPARIVA. Un pacchetto intero invendibile dalla pagina, e nessuno se ne
   accorgeva perche' sui soggiorni corti il Golf non esce. E «5 cure» e «10
   cure» finivano dentro la famiglia standard come se fossero due modi di
   mangiare.

   IL NOME SI USA, ma con l'unica equivalenza che serve: «Soggiorno breve»
   e «Miglior Prezzo» sono la stessa offerta, il nome cambia con la durata.
   Sta in STESSO_PIANO, e chi ne trovasse un'altra deve aggiungerla
   apposta invece di allargare una regola.

   Presidiato da famiglie.test.ts. */

'use strict';

/** I nomi che sono LO STESSO PIANO con un altro nome.
 *
 *  «Soggiorno breve» e' il nome che prende il prezzo in mezza pensione
 *  quando il soggiorno e' di una o due notti — detto dalla proprieta' il
 *  21 agosto 2026. Su un soggiorno lungo la stessa offerta si chiama
 *  «Miglior Prezzo» e porta tutti e due i trattamenti.
 *
 *  E' l'unico caso in cui due nomi vanno uniti, e sta scritto qui perche'
 *  chi ne trovasse un altro debba aggiungerlo apposta invece di allargare
 *  una regola. Le chiavi sono in minuscolo: il motore risponde sempre in
 *  italiano, qualunque lingua gli si chieda. */
export const STESSO_PIANO = new Map([
  ['soggiorno breve', 'miglior prezzo'],
]);

/** Il piano di una tariffa: il suo nome, o quello a cui e' unita. */
export function famiglia(tariffa) {
  const k = String(tariffa ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  return STESSO_PIANO.get(k) ?? k;
}

/** Accorpa le tariffe di una camera, per PIANO TARIFFARIO.
 *
 *  Dentro un piano resta un'opzione per trattamento, la piu' economica: e'
 *  li' che «aggiungi la cena» ha senso, perche' e' la stessa offerta con e
 *  senza. Fra piani diversi non si accorpa NIENTE, e questo e' il punto:
 *  «Golf · Mezza Pensione» e «Miglior Prezzo · Mezza Pensione» hanno lo
 *  stesso trattamento e prezzi diversi, e prima il Golf spariva.
 *
 *  Restituisce le famiglie dalla piu' economica, e dentro ognuna le
 *  opzioni dalla piu' economica. */
export function accorpa(voci) {
  const prezzo = (v) => Number(v?.prezzo_cent) || 0;
  const famiglie = new Map();

  for (const v of voci ?? []) {
    const chiave = famiglia(v?.tariffa);
    if (!famiglie.has(chiave)) famiglie.set(chiave, new Map());
    const perTrattamento = famiglie.get(chiave);
    const b = String(v?.trattamento ?? '');
    const gia = perTrattamento.get(b);
    /* stesso piano E stesso trattamento a due prezzi: resta il minore.
       Sono la stessa cosa, e nessuno vuole pagare di piu'. */
    if (!gia || prezzo(v) < prezzo(gia)) perTrattamento.set(b, v);
  }

  return [...famiglie.entries()]
    .map(([chiave, perTrattamento]) => ({
      chiave,
      opzioni: [...perTrattamento.values()].sort((a, b) => prezzo(a) - prezzo(b)),
    }))
    .sort((a, b) => prezzo(a.opzioni[0]) - prezzo(b.opzioni[0]));
}
