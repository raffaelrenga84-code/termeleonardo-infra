/* piani.js — che cosa comprende un PIANO TARIFFARIO, oltre al trattamento.

   LA DOMANDA CHE HA FATTO NASCERE QUESTO FILE. Sulla Matrimoniale Queen
   uscivano tre righe: Miglior Prezzo 190, Soggiorno breve 260, Soggiorno
   Smart 384. Le prime due si spiegano da sole adesso che la pagina scrive
   il trattamento per esteso — l'una e' camera e colazione, l'altra e'
   mezza pensione. La terza no: stesso trattamento della seconda, quasi il
   doppio del prezzo, e niente che dicesse perche'.

   PERCHE': «Soggiorno Smart» non e' un prezzo, e' un PACCHETTO, e
   comprende un massaggio. Sta scritto sulla pagina dell'offerta
   (termeleonardo.com/it/offerte/smart, «1 Massaggio relax (55 min) a
   persona») e la Knowledge Base lo conferma («Smart 1 notte + massaggio»).
   Due fonti di casa che dicono la stessa cosa.

   QUELLO CHE NON STA QUI. Il pacchetto comprende anche il kit spa e le
   city bike, e non li nominiamo: la riga di una tariffa non e' la pagina
   dell'offerta, e il massaggio e' cio' che spiega il salto di prezzo. Per
   questo il testo dice «comprende ANCHE», che non promette di essere
   l'elenco completo.

   Deluxe e Golf non sono qui: il Deluxe dichiara «massaggi» al plurale
   nel titolo e «1 massaggio da 25 minuti» nell'elenco, e finche' non si sa
   quale delle due e' giusta non si scrive niente. Una riga assente lascia
   la tariffa come stava; una riga sbagliata su una pagina che vende no.

   SI RICONOSCE DAL NOME perche' non c'e' altro: la risposta del motore
   porta `tariffa_id`, ma quel numero non e' documentato da nessuna parte
   e cambierebbe senza avvisare. Il nome e' pubblico — il prompt
   dell'agente vocale autorizza a nominarlo — ed e' quello che l'ospite
   legge.

   Presidiato da piani.test.ts. */

'use strict';

/** I pacchetti che comprendono un massaggio, e di quanti minuti.
 *  I minuti vengono dalla pagina dell'offerta dell'hotel. */
export const PIANI = [
  { chiave: 'smart', minuti: 55, segno: /soggiorno\s*smart|\bsmart\b/i },
  { chiave: 'escape', minuti: 25, segno: /thermal\s*escape|\bescape\b/i },
];

/** Quanti minuti di massaggio comprende questa tariffa, o 0 se non e' un
 *  pacchetto che ne comprende. Zero e' l'esito normale: quasi tutte le
 *  tariffe sono prezzi, non pacchetti, e la riga esce come usciva. */
export function massaggioDelPiano(tariffa) {
  const s = String(tariffa ?? '');
  for (const p of PIANI) if (p.segno.test(s)) return p.minuti;
  return 0;
}
