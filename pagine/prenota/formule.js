/* formule.js — che cosa comprende il trattamento di una tariffa.

   IL MOTORE MANDA SOLO IL NOME. Una riga della pagina diceva «Mezza
   Pensione» e basta: chi non e' di casa non sa se comprende la cena, il
   pranzo, tutti e due. E accanto c'era «Bed & Breakfast» a un prezzo piu'
   basso, senza niente che spiegasse la differenza.

   LE PAROLE SONO QUELLE DELLA CASA, non inventate qui: il prompt
   dell'agente vocale (v4.10, confermato dalla proprieta') dice «solo:
   pernottamento con colazione oppure mezza pensione con cena — buffet
   serale». Niente pensione completa.

   SI RICONOSCE DAL NOME, e non c'e' alternativa: la risposta del motore
   non porta un identificativo del trattamento, solo la stringa. Per questo
   il riconoscimento e' fatto di segni larghi, e per questo QUELLO CHE NON
   SI RICONOSCE NON SI DESCRIVE: meglio la riga muta di prima che una
   formula sbagliata su una pagina che vende.

   NON DESCRIVE IL PIANO TARIFFARIO. «Soggiorno breve», «Miglior Prezzo»,
   «Soggiorno Smart» sono cose diverse dal trattamento, e che cosa
   comprendano non sta scritto in nessuna fonte di casa: finche' non lo
   scrive la proprieta', qui non si indovina.

   Presidiato da formule.test.ts. */

'use strict';

/** I segni per riconoscere la formula, nelle quattro lingue in cui il
 *  motore puo' scrivere il trattamento. Il primo che corrisponde vince,
 *  quindi la mezza pensione va prima: «mezza pensione» non contiene la
 *  parola colazione, ma «pernottamento e prima colazione» si'. */
export const FORMULE = [
  {
    chiave: 'cena',
    segno: /mezza\s*pensione|halbpension|half\s*board|demi[-\s]?pension/i,
  },
  {
    chiave: 'colazione',
    segno: /b\s*&\s*b\b|bed\s*(?:and|&)\s*breakfast|colazione|fr[üu]hst[üu]ck|petit[-\s]?d[ée]jeuner|breakfast/i,
  },
];

/** La formula di questo trattamento: 'cena', 'colazione', o stringa vuota
 *  se non si riconosce. Il vuoto e' un esito normale: la riga esce come
 *  usciva prima, col solo nome. */
export function formulaDi(trattamento) {
  const s = String(trattamento ?? '');
  for (const f of FORMULE) if (f.segno.test(s)) return f.chiave;
  return '';
}
