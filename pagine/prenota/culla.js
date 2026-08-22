/* culla.js — la culla: quanto costa e dove ci sta.

   PERCHE' ESISTE QUESTO FILE. Fino al 22 agosto 2026 la pagina di
   prenotazione non aveva nessun modo di chiedere una culla, e chi
   viaggiava con un neonato sceglieva una Matrimoniale Queen convinto che
   ci stesse. La culla si scopriva in reception, a camera già assegnata,
   e a quel punto le strade sono due: cambiare categoria all'arrivo — se
   c'è posto — oppure dire di no a un ospite che era arrivato con un
   bambino piccolo.

   I DUE NUMERI STANNO QUI E BASTA, come il supplemento del cane: il
   testo che l'ospite legge se li fa dare da queste costanti, in quattro
   lingue. Se un domani cambiano, cambiano in un posto solo.

   I DUE FATTI, confermati dalla proprietà il 22 agosto 2026:

   · 30 € PER TUTTO IL SOGGIORNO, non al giorno — ed è la differenza col
     cane, che sono 13 € al giorno. Scrivere «al giorno» qui sarebbe una
     cifra sbagliata su una pagina che vende;
   · la culla CI STA solo nelle Junior Suite e nelle Suite. Nelle
     singole, nella Doppia e nella Matrimoniale Queen non c'è lo spazio
     per posizionarla.

   QUELLO CHE NON STA QUI, E PERCHE'. Nessuna età massima del bambino: la
   Knowledge Base dice che i neonati fino a un anno entrano
   gratuitamente e si aggiungono dopo la prenotazione, ma non dice fino a
   quando una culla vada bene invece di un letto — e una soglia inventata
   qui sarebbe una domanda a cui la casa non ha risposto.

   Presidiato da culla.test.ts. */

'use strict';

/** 30,00 € per tutto il soggiorno — NON al giorno. Confermato dalla
 *  proprietà il 22 agosto 2026. */
export const SUPPLEMENTO_CULLA_CENT = 3000;

/** Le categorie dove la culla ci sta: tutte le Junior Suite e tutte le
 *  Suite. Gli identificativi sono quelli di camere.ts, che vengono
 *  dall'API e sono stabili — mai i nomi, che i modelli della reception
 *  abbinano per sottostringa e sbagliano.
 *
 *  7  Junior Suite Colli Euganei
 *  8  Junior Suite Accessibile
 *  9  Suite Colli Euganei
 *  10 Suite Monteortone
 *  11 Junior Suite Monteortone
 *  12 Junior Suite Abano */
export const CAMERE_CON_CULLA = [7, 8, 9, 10, 11, 12];

/** Se in questa categoria la culla ci sta.
 *
 *  SI SBAGLIA CHIUSO, non aperto: una camera che non conosciamo — un
 *  identificativo nuovo, un dato guasto — risponde «no», e l'ospite legge
 *  che deve cambiare categoria. L'errore opposto lo manderebbe ad Abano
 *  con una culla che non entra in camera, e quello si paga al banco. */
export function ciStaLaCulla(cameraId) {
  const n = Number(cameraId);
  return Number.isInteger(n) && CAMERE_CON_CULLA.includes(n);
}

/** Fra le camere libere per quelle date, la MENO CARA che ospita una
 *  culla — quella da proporre a chi ne ha chiesta una su una camera che
 *  non la ospita.
 *
 *  La meno cara e non la prima dell'elenco: chi si sente dire «deve
 *  cambiare categoria» sta già ricevendo una notizia che costa, e
 *  proporgli la Suite quando basta una Junior Suite è il modo più veloce
 *  di far chiudere la pagina.
 *
 *  Torna `null` quando non ce n'è nessuna: allora non si propone niente e
 *  si dice soltanto che per quelle date non c'è. Un pulsante che non
 *  porta da nessuna parte è peggio di nessun pulsante. */
export function primaConCulla(proposte) {
  const buone = (Array.isArray(proposte) ? proposte : [])
    .map((p, i) => ({ ...p, indice: typeof p?.indice === 'number' ? p.indice : i }))
    .filter((p) => ciStaLaCulla(p?.camera_id))
    .filter((p) => Number.isFinite(Number(p?.prezzo_cent)));
  if (!buone.length) return null;
  return buone.reduce((meglio, p) =>
    Number(p.prezzo_cent) < Number(meglio.prezzo_cent) ? p : meglio
  );
}
