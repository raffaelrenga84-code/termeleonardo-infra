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
/* IL COLLEGAMENTO FRA I DUE CAMPI DATA.

   ASCOLTA TUTTI E DUE, non solo l'arrivo. Fino al 22 agosto 2026
   ascoltava il solo arrivo: una partenza precedente all'arrivo, scelta a
   mano dal calendario, non la correggeva nessuno — e restava a schermo un
   soggiorno che il server rifiuta dopo aver fatto compilare tutto il
   resto. Visto su iPhone: arrivo 26 agosto, partenza 22.

   E ASCOLTA ANCHE `input`, non solo `change`. Sul calendario di iOS la
   scelta di un giorno cambia il valore mentre il pannello resta aperto:
   aspettare `change` vuol dire lasciare il campo `min` della partenza
   indietro di un passo proprio mentre l'ospite sta scegliendo.

   E DOPO L'ARRIVO PASSA DA SOLO ALLA PARTENZA. Su iPhone il pannello del
   calendario non si chiude da solo: chi ha appena scelto l'arrivo crede di
   stare scegliendo la partenza e continua a spostare l'arrivo. Il blur
   chiude il pannello, e il focus sulla partenza apre il suo (apriAlTocco).

   Solo su `change` e solo se la partenza e' VUOTA: cosi' chi sta
   correggendo l'arrivo su un modulo gia' compilato non si vede rubare il
   fuoco, e chi scrive la data a tastiera non viene interrotto a meta'. */
export function collegaArrivoPartenza(arrivo, partenza) {
  if (!arrivo || !partenza) return;
  const aggiorna = () => {
    const { minimo, partenza: buona } = partenzaCoerente(arrivo.value, partenza.value);
    if (minimo) partenza.min = minimo;
    if (partenza.value !== buona) partenza.value = buona;
  };

  const vaAllaPartenza = () => {
    aggiorna();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(arrivo.value || ''))) return;
    if (partenza.value) return;
    try {
      arrivo.blur?.();
      partenza.focus?.();
    } catch { /* un browser che non lo permette non deve rompere la pagina */ }
  };

  for (const ev of ['input', 'change']) {
    arrivo.addEventListener(ev, aggiorna);
    partenza.addEventListener(ev, aggiorna);
  }
  arrivo.addEventListener('change', vaAllaPartenza);
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

/* IL PREAVVISO DEI TRATTAMENTI: 48 ore, decise dalla proprieta' il 18 agosto
   2026. Un giorno e una fascia (mattina/pomeriggio) non permettono di
   contare le ore, quindi il giorno del servizio deve cadere almeno DUE
   giorni dopo oggi — mai meno di 24 ore reali, nel caso peggiore 48 piene.

   ⚠ Lo stesso numero vive in supabase/functions/richieste/preavviso.ts, che
   e' dove il server rifiuta: `strumenti/pubblica.js` manda alla Management
   API solo i file della cartella della funzione, quindi quel modulo non puo'
   importare questo. Le due copie sono tenute insieme da una prova
   (preavviso-coerenza.test.ts): se una cambia senza l'altra, diventa rossa.

   Il server e' l'unico che decide davvero. Questo serve a non far scegliere
   all'ospite una data che verrebbe respinta dopo che ha compilato tutto. */
export const PREAVVISO_GIORNI_TRATTAMENTI = 2;

export function primoGiornoUtileTrattamenti(oggi = new Date()) {
  let g = oggiISO(oggi);
  for (let i = 0; i < PREAVVISO_GIORNI_TRATTAMENTI; i++) g = giornoDopo(g);
  return g;
}

/* CHE ORA E' IN ITALIA, non sul dispositivo di chi guarda la pagina.
   oggiISO() qui sopra usa l'orologio locale, ed e' giusto per quello che
   fa: riempire un campo data per chi sta prenotando. Ma una regola che
   dipende dall'ORA — «dopo le 14:30 non si prenota piu' per oggi» — con
   l'orologio locale sbaglia per chiunque non sia in Italia: chi guarda da
   Londra alle 14:00 in Italia ha gia' le 15:00, e passerebbe. Chi guarda
   da Tokyo all'una di notte in Italia e' ancora il giorno prima.

   Restituisce il giorno e i minuti dalla mezzanotte, tutti e due a Roma.
   Il fuso lo tiene Intl, che sa gia' quando scatta l'ora legale. */
export function adessoARoma(d = new Date()) {
  const parti = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    /* h23 e non hour12:false: con hour12 la mezzanotte esce «24» su certe
       versioni di ICU, e 24*60 sarebbe un orario che non esiste */
    hourCycle: 'h23',
  }).formatToParts(d);
  const p = {};
  for (const x of parti) p[x.type] = x.value;
  return {
    giorno: `${p.year}-${p.month}-${p.day}`,
    minuti: Number(p.hour) * 60 + Number(p.minute),
  };
}

/* Quante notti fra due date ISO, o 0 se non si puo' dire. Serve a dire
   quanto pesa una differenza di prezzo A NOTTE, che e' l'unico modo in cui
   una differenza si giudica davvero. */
export function nottiFra(arrivo, partenza) {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(String(arrivo || '')) || !iso.test(String(partenza || ''))) return 0;
  /* mezzogiorno e non mezzanotte: cosi' il cambio dell'ora legale non fa
     sparire o comparire una notte */
  const a = new Date(arrivo + 'T12:00:00');
  const p = new Date(partenza + 'T12:00:00');
  if (isNaN(a.getTime()) || isNaN(p.getTime())) return 0;
  const n = Math.round((p.getTime() - a.getTime()) / 86400000);
  return n > 0 ? n : 0;
}
