/* date.js — i campi data delle pagine rivolte agli ospiti.

   Sta in un modulo solo perche' `oggiISO` era gia' copiata in tre pagine
   identiche: la stessa regola in tre posti diverge al primo che ne cambia
   una, ed e' gia' successo in questo progetto con l'anteprima del buono.

   Va importato con il PERCORSO ASSOLUTO `/comune/date.js`. Un percorso
   relativo si risolve contro l'indirizzo che vede l'ospite, non contro la
   cartella del file: sotto un indirizzo tradotto come /it/prenota diventa
   /it/comune/date.js e la pagina resta bianca. */

/* Data di oggi in ora LOCALE, non UTC. Con toISOString() fra mezzanotte e
   le due del mattino in Italia il campo indicava ieri, e l'ospite poteva
   scegliere una data che il server poi rifiutava. */
export function oggiISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* Il giorno dopo una data ISO. Serve per la partenza: si parte almeno il
   giorno seguente all'arrivo, non lo stesso. */
export function giornoDopo(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return '';
  const d = new Date(iso + 'T12:00:00');
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + 1);
  return oggiISO(d);
}

/* Dato l'arrivo, che partenza e' ancora valida?
   Restituisce il minimo ammesso e la partenza corretta: se quella scelta
   e' precedente o uguale all'arrivo va buttata, altrimenti resterebbe a
   schermo un soggiorno che il server rifiuta dopo aver fatto compilare
   tutto il resto. */
export function partenzaCoerente(arrivo, partenza) {
  const minimo = giornoDopo(arrivo);
  if (!minimo) return { minimo: '', partenza: partenza || '' };
  if (!partenza || partenza < minimo) return { minimo, partenza: '' };
  return { minimo, partenza };
}

/* Il calendario si apre toccando il campo, non solo la piccola icona.
   Senza questo bisogna centrare l'iconcina, che sul telefono e' un bersaglio
   di pochi millimetri: e' il "bisogna premere piu' volte" segnalato dalla
   proprieta'. showPicker() non c'e' su tutti i browser, quindi si prova e
   se non c'e' si lascia il comportamento di prima. */
export function apriAlTocco(campo) {
  if (!campo || campo.dataset.calendarioPronto) return;
  campo.dataset.calendarioPronto = '1';
  const apri = () => {
    try { campo.showPicker?.(); } catch { /* alcuni browser lo vietano fuori da un gesto */ }
  };
  campo.addEventListener('click', apri);
  campo.addEventListener('focus', apri);
}

/* Collega arrivo e partenza: appena si sceglie l'arrivo, la partenza non
   puo' piu' essere prima. */
export function collegaArrivoPartenza(arrivo, partenza) {
  if (!arrivo || !partenza) return;
  const aggiorna = () => {
    const { minimo, partenza: buona } = partenzaCoerente(arrivo.value, partenza.value);
    if (minimo) partenza.min = minimo;
    if (partenza.value !== buona) partenza.value = buona;
  };
  arrivo.addEventListener('change', aggiorna);
  aggiorna();
}

/* Da chiamare dopo ogni disegno della pagina: i moduli qui si ridisegnano,
   e i campi vecchi spariscono insieme ai loro ascoltatori. */
export function attivaDate(radice = document) {
  radice.querySelectorAll('input[type="date"]').forEach(apriAlTocco);
  const a = radice.querySelector('#fArrivo');
  const p = radice.querySelector('#fPartenza');
  if (a && p) collegaArrivoPartenza(a, p);
}
