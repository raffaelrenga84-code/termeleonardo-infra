/* La cifra da PROPORRE alla reception quando conferma un transfer.

   Oggi il prezzo si scrive a mano nel messaggio («il prezzo e' di 85 € a
   tratta, pagamento diretto all'autista»): va cercato ogni volta, e ogni
   volta si puo' sbagliare. Qui si propone gia' scritto, e la reception lo
   conferma o lo corregge.

   PROPORRE, NON DECIDERE. E' quella conferma umana a rendere onesta la cifra
   che poi arriva all'ospite: il sistema non manda mai un prezzo che nessuno
   ha guardato.

   E PER QUESTO IL LISTINO TACE DOVE NON SA. Proporre una cifra sbagliata e'
   molto peggio che non proporne nessuna: una cifra scritta dal sistema si
   legge come verificata, e chi conferma in fretta la lascia passare. Su
   Verona, Bologna, Mestre, i golf e Montegrotto il listino pubblico non dice
   niente, e allora qui non si dice niente: la reception scrive a mano, come
   fa oggi.

   La copia. Questi numeri stanno anche sulla pagina pubblica del sito, ed e'
   una seconda copia — inevitabile, perche' quella pagina la legge un ospite e
   questa la legge un programma. Il freno e' che qui la cifra e' una PROPOSTA
   che un essere umano conferma: se le due copie divergono, se ne accorge chi
   conferma, non l'ospite che ha gia' pagato. */

/* Centesimi, come prezzo_cent e caparra_cent nel resto del sistema: 13500
   sono 135 euro. E' il trabocchetto gia' incontrato in email-richiesta.ts e
   in differenze.ts, e si evita scrivendo tutto in centesimi da subito. */
const PRIVATO = [
  { mete: ['Venezia  aeroporto', 'Venezia P.le Roma', 'Venezia porto'], cent: 13500 },
  { mete: ['Treviso Aeroporto'], cent: 15000 },
  { mete: ['Padova FS', 'Padova città'], cent: 3600 },
  { mete: ['Terme  Euganee FS', 'Abano'], cent: 1800 },
];

/* La navetta condivisa esiste solo su Venezia aeroporto, e il prezzo dipende
   da quante persone sono. A quattro non e' in listino: l'assenza qui non e'
   una dimenticanza, e' il motivo per cui il modulo a quattro non la offre. */
const NAVETTA = { 1: 6500, 2: 9500, 3: 13500 };
const META_NAVETTA = 'Venezia  aeroporto';

/* I nomi delle mete hanno doppi spazi ed emoji perche' devono combaciare
   parola per parola con l'elenco di atam.biz. Il confronto e' normalizzato,
   come in navetta.js e in atam-booking.js. */
const piatto = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

/* null = il listino non sa, e chi non sa tace.
   Altrimenti: la tratta, quante corse, e il totale che l'autista deve
   incassare. Il listino e' A TRATTA — lo diceva gia' il testo che la
   reception scriveva a mano — e chi ha chiesto il ritorno ne fa due. */
export function prezzoTransfer(dati) {
  if (!dati) return null;
  const luogo = piatto(dati.luogo);
  if (!luogo) return null;

  const pax = Number(dati.pax) || 1;
  let trattaCent = null;

  if (dati.collettivo) {
    if (luogo !== piatto(META_NAVETTA)) return null;
    trattaCent = NAVETTA[pax] ?? null;
  } else {
    const riga = PRIVATO.find((r) => r.mete.some((m) => piatto(m) === luogo));
    trattaCent = riga ? riga.cent : null;
  }
  if (trattaCent === null) return null;

  const corse = dati.ritorno ? 2 : 1;
  return { trattaCent, corse, totaleCent: trattaCent * corse };
}
