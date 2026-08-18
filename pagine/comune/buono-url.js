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
