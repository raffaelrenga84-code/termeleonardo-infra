/* Il codice del buono letto dall'indirizzo, e il conto della differenza.
   ------------------------------------------------------------------
   Il conto e' RISCRITTO qui e non importato: questa pagina gira nel
   browser, quella funzione vive in Deno. Sono due copie della stessa
   regola, ed e' esattamente il difetto che questo progetto ha gia' pagato
   quattro volte coi listini — per questo buono-url.test.ts le confronta
   su ogni caso: se divergono, diventa rosso. */

const CODICE_MAX = 40;

/* Un codice, da qualunque parte arrivi: dall'indirizzo o scritto a mano nel
   modulo. La ripulitura sta qui una volta sola perche' due ripuliture diverse
   vorrebbero dire che un codice accettato per una via viene rifiutato per
   l'altra — e chi digita dal foglio stampato non ha modo di capire perche'.
   Restituisce '' per tutto cio' che un codice non e'. */
export function normalizzaCodice(grezzo) {
  const pulito = String(grezzo ?? '').trim().toUpperCase();
  /* solo lettere, cifre e trattini: il codice non contiene altro, e cosi'
     un tentativo di iniezione non arriva nemmeno al server */
  if (!pulito || pulito.length > CODICE_MAX || !/^[A-Z0-9-]+$/.test(pulito)) return '';
  return pulito;
}

export function codiceDaUrl(ricerca) {
  return normalizzaCodice(new URLSearchParams(ricerca || '').get('buono') || '');
}

const numero = (v) => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
};
const centesimi = (n) => Math.round(n * 100) / 100;

export function differenzaBuono(copre, scelto) {
  const c = numero(copre);
  const s = numero(scelto);
  if (c === null || s === null) return { tipo: 'ignoto', copre: c ?? 0, scelto: s ?? 0, differenza: 0 };
  if (s > c) return { tipo: 'differenza', copre: c, scelto: s, differenza: centesimi(s - c) };
  if (s < c) return { tipo: 'residuo', copre: c, scelto: s, differenza: centesimi(c - s) };
  return { tipo: 'copre', copre: c, scelto: s, differenza: 0 };
}

/* Quanto di quel buono si puo' spendere nei trattamenti di QUESTO modulo, e
   quali caselle spuntare — una regola sola per tutte e due le cose, cosi'
   non possono contraddirsi.
   ------------------------------------------------------------------
   PERCHE' NON BASTA `valore`. Il `valore` del buono e' la somma di tutto
   quello che contiene (prezzo x quantita', fino a due voci — sommaVoci in
   buoni/acquista.ts), e non e' detto che sia spendibile qui:

   · un INGRESSO DAY SPA non e' un trattamento del reparto e non ha nessuna
     casella da spuntare. Col buono "Day Spa + massaggio" (105 €) e lo
     Shiatsu da 70 € preselezionato, usare `valore` faceva scrivere alla
     pagina «l'importo residuo non e' rimborsabile ne' riutilizzabile» su
     35 € che l'ospite NON perde: sono il suo ingresso, che si tiene;
   · una QUANTITA' di due (il listino ne ammette fino a quattro) non si puo'
     rappresentare con una casella, che si spunta o no: un buono per due
     massaggi diventerebbe «residuo 70 €», e un massaggio solo in reception.

   Quando il modulo non sa rappresentare fedelmente quello che il buono
   contiene, `copre` torna null e chi disegna la pagina TACE la riga della
   differenza. Meglio non dire niente che dire una cifra falsa sui soldi:
   e' l'unico posto di questa pagina dove un errore l'ospite lo scopre
   pagando.

   L'elenco dei trattamenti arriva come ARGOMENTO e non con un import:
   questo modulo lo carica il browser, dove l'unico percorso ammesso e'
   quello assoluto (/comune/trattamenti.js), mentre i test lo caricano da
   disco — un import solo non puo' andare bene a tutti e due. Chi chiama sa
   gia' qual e' l'elenco giusto.

   Torna { copre, indici, ignorate, ripetute }:
   · copre    quanto dire che il buono copre, o null se non si puo' dire;
   · indici   le posizioni da spuntare, nell'ordine delle voci del buono;
   · ignorate gli id che qui non hanno un trattamento — ingressi Day Spa
              compresi. Sul modulo dei trattamenti e' da qui che esce la nota
              «il buono comprende anche un ingresso»: serve intero;
   · sconosciute le stesse, MENO gli ingressi Day Spa: cioe' solo quelle che
              non hanno un motivo dichiarato per non avere una casella. Sono
              le sole da segnalare in console — un ingresso senza casella e'
              il caso normale del modulo Day Spa, e un avviso che suona a
              ogni caricamento nasconde quello vero (una voce nuova a listino
              che nessuno ha collegato, un id tolto dopo la vendita);
   · ripetute gli id presi piu' di una volta. La richiesta che parte da
              questo modulo ne nomina UNO — le caselle non hanno quantita' —
              quindi chi la legge in reception deve trovarlo scritto nelle
              note, o preparerebbe un turno invece di due. */
/* Gli ingressi Day Spa hanno un id che comincia per 'dayspa': stessa regola
   del server (eIngressoDaySpa in buoni/acquista.ts), e la stessa che
   buono-url.test.ts usa per sapere quali voci del LISTINO devono avere un
   trattamento corrispondente. Qui serve a distinguere le due specie di voce
   senza casella: quella che non ce l'ha PER COSTRUZIONE e quella che non
   ce l'ha per una dimenticanza. */
const eIngressoDaySpa = (id) => id.startsWith('dayspa');

export function coperturaBuono(buono, trattamenti) {
  const voci = buono?.voci;
  const vuoto = { copre: null, indici: [], ignorate: [], ripetute: [], sconosciute: [] };
  /* niente voci: e' un buono a IMPORTO, e un importo si spende su qualunque
     trattamento — li' il conto e' esattamente il suo valore (la specifica:
     «per i buoni a importo libero il conto funziona identico») */
  if (voci === null || voci === undefined) return { ...vuoto, copre: buono?.valore ?? null };
  if (!Array.isArray(voci)) return vuoto;
  if (!voci.length) return { ...vuoto, copre: buono?.valore ?? null };

  const indici = [];
  const ignorate = [];
  const ripetute = [];
  let somma = 0;
  let dicibile = true;
  for (const v of voci) {
    const id = String(v?.voce_id ?? '');
    /* la quantita' si guarda PRIMA di sapere se la voce ha una casella:
       vale anche per un ingresso Day Spa preso due volte, che qui non si
       spunta ma in reception sono comunque due ingressi */
    if (id && (v?.quantita ?? 1) > 1) ripetute.push(id);
    const i = id ? trattamenti.findIndex((t) => t.regalabile === id) : -1;
    if (i < 0) {
      /* una voce che questo modulo non sa spuntare: un ingresso Day Spa,
         oppure una voce di listino nuova che nessuno ha collegato qui */
      if (id) ignorate.push(id);
      dicibile = false;
      continue;
    }
    if ((v?.quantita ?? 1) !== 1) dicibile = false;
    if (indici.includes(i)) { dicibile = false; continue; }
    indici.push(i);
    somma += trattamenti[i].prezzo;
  }
  return {
    copre: dicibile ? somma : null,
    indici,
    ignorate,
    ripetute,
    sconosciute: ignorate.filter((id) => !eIngressoDaySpa(id)),
  };
}

/* ============================================================
   Se un buono comprende un ingresso DAY SPA, oltre a quello che c'è d'altro.

   NON è «dove si prenota». Quella la decide moduloDelBuono() in
   pagine/buoni/buono.js, e su un buono MISTO — Day Spa più un massaggio —
   risponde `trattamenti`, perché i massaggi si devono poter spuntare.
   Questa risponde a un'altra domanda: fra le voci c'è anche la piscina?

   A COSA SERVE: a mostrare la disponibilità del Day Spa anche sul modulo dei
   trattamenti. Senza, chi ha un buono misto prenota alla cieca sulla
   piscina — e se la piscina è piena, il massaggio da solo non lo voleva. È
   la ragione per cui questa funzione esiste.

   STA QUI E NON IN buono.js perché la pagina delle richieste importa già
   questo modulo (7 KB) e non quello (40 KB): caricare quaranta chilobyte su
   ogni modulo di richiesta per una funzione sola non si fa.

   Il segno è "Day Spa", che sta letteralmente in tutte e tre le voci
   dayspa_* del listino — ed è in italiano qualunque sia la lingua del buono.
   ============================================================ */
const eRigaDaySpa = (riga) => /day spa/i.test(riga);

export function contieneDaySpa(b) {
  if (!b) return false;
  if (String(b.voce_id || '').startsWith('dayspa')) return true;
  return String(b.descrizione || '').split('\n')
    .map((r) => r.trim()).filter(Boolean)
    .some(eRigaDaySpa);
}

/* ============================================================
   SU QUALI MODULI un buono regalo si può usare.

   Il listino dei buoni è INTERAMENTE spa — programmi, massaggi, viso, corpo
   e i tre ingressi Day Spa. Un buono non paga un green fee, non paga una
   lezione col maestro e non paga un taxi: su quei moduli il riquadro
   «Ha un buono regalo?» chiede una cosa che non serve a niente.

   E NON È SOLO INUTILE, È DANNOSO. `avvisoInCima()` toglie la promessa del
   prezzo quando c'è un buono valido — regola giusta, scritta per non
   promettere un prezzo a chi l'ha già pagato. Ma su un green fee il buono
   NON ha pagato niente, e quella frase si legge come «è già a posto».
   Bastava aprire /it/green-fee e digitare il codice di un buono valido.

   Restano i due moduli che un buono lo sanno raccontare: i trattamenti, dove
   le voci si spuntano e la copertura si calcola, e il Day Spa. Il soggiorno
   no: là non c'è nessun riquadro che dica quanto il buono copre, quindi
   togliere la promessa del prezzo lascerebbe l'ospite senza nessuna
   informazione al suo posto — lo stesso difetto del green fee.
   ============================================================ */
export const TIPI_COL_BUONO = ['trattamenti', 'dayspa'];

export function buonoUsabileSu(tipo) {
  return TIPI_COL_BUONO.includes(String(tipo ?? ''));
}

/* ============================================================
   QUANTE PERSONE ENTRANO COL BUONO, e CHI E' — per precompilare il modulo
   delle richieste da solo.

   «Dovrebbe metterlo in automatico in base al buono, precompilando anche i
   nomi... deve essere tutto piu' proattivo» (la proprieta', 5 settembre
   2026): il campo Persone del Day Spa restava a 1 e il campo Nome vuoto
   anche quando il buono diceva gia' tutto, e chi apriva il modulo dal
   proprio buono doveva ricompilarli a mano.

   DUE FONTI, PERCHE' UN BUONO PUO' NASCERE IN DUE MODI. Un buono venduto
   online ha `voci` (le righe del listino, ognuna con la sua quantita'): li'
   si somma la quantita' dei soli ingressi Day Spa, perche' sono loro a
   contare le persone — un massaggio nello stesso buono non ne aggiunge
   nessuna. Un buono scritto a mano in reception non ha `voci` (solo la
   descrizione libera): il numero si legge dalla riga che parla di Day Spa,
   davanti alla quale la reception scrive «n. 2 · …» o «2 × …» (la stessa
   forma che usa il server, in acquista.ts e nelle email). Le due letture
   non vanno mai contro: un buono ha l'una o l'altra fonte, mai tutte e due.

   SE NON SI SA, UNA PERSONA SOLA. E' la stessa scelta gia' presa per la
   disponibilita' del Day Spa (in caso di dubbio si dice disponibile, mai
   esaurito): un numero indovinato per eccesso rischia di dire «esaurito»
   a un ospite per cui c'era posto, un numero indovinato per difetto no. */
const PERSONE_DAYSPA_MAX = 8; // PERSONE_DAYSPA_MAX di richieste/tipi.ts
const persone = (n) => Math.min(PERSONE_DAYSPA_MAX, Math.max(1, n));

/* «n. 2 · …» (un buono scritto a mano) o «2 × …» (la forma di acquista.ts,
   componiDescrizione): il numero sta sempre davanti alla riga, mai dentro. */
const NUMERO_IN_TESTA = /^n\.\s*(\d+)\s*·|^(\d+)\s*×/i;

/** Quante persone entrano col buono: la somma delle quantita' delle voci
 *  dayspa_*; senza `voci`, il numero davanti alla riga della descrizione
 *  che parla di Day Spa («n. 2 · …», «2 × …»); se non si sa, 1. Sempre fra
 *  1 e 8 (PERSONE_DAYSPA_MAX del server). */
export function personeDalBuono(b) {
  if (!b) return 1;
  if (Array.isArray(b.voci)) {
    const somma = b.voci
      .filter((v) => eIngressoDaySpa(String(v?.voce_id ?? '')))
      .reduce((tot, v) => tot + (Number(v?.quantita) || 1), 0);
    return somma > 0 ? persone(somma) : 1;
  }
  const riga = String(b.descrizione ?? '').split('\n')
    .map((r) => r.trim()).filter(Boolean).find(eRigaDaySpa);
  if (!riga) return 1;
  const m = riga.match(NUMERO_IN_TESTA);
  if (!m) return 1;
  return persone(Number(m[1] ?? m[2]));
}

/** Il nome di chi usa il buono, per il campo «Nome»: il destinatario,
 *  ripulito; '' se manca. */
export function nomeDalBuono(b) {
  return String(b?.destinatario ?? '').trim();
}
