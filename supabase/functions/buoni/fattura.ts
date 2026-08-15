/* ============================================================
   fattura.ts — raccolta e validazione dei dati per la fattura di un
   acquisto online (?a=acquista). SOLO questo: niente XML FatturaPA,
   niente numerazione, niente aliquote — quelle parti dipendono da una
   conferma del commercialista non ancora arrivata (vedi
   docs/superpowers/specs/2026-08-13-fatturazione-buoni-design.md).

   Modulo puro, come scadenza.ts: dati dentro, dati validati (o un
   errore) fuori. Chi chiama (acquista.ts) decide cosa farne; qui non
   c'è né Deno.serve né una richiesta HTTP, quindi si collauda senza
   rete e senza database.

   LA VALIDAZIONE VERA STA QUI, NON NELLA PAGINA. Il riquadro sul sito
   serve solo a dare un messaggio gentile prima di pagare: un campo può
   sempre arrivare falsificato da una chiamata diretta a questa funzione
   di Supabase, e chi compila il modulo non è l'unica porta d'ingresso.

   Prima si sceglie chi è l'intestatario — privato o azienda — perché i
   due casi vogliono campi diversi. Chiedere la ragione sociale a un
   privato produrrebbe una fattura con una denominazione al posto di
   nome e cognome: è l'errore che questo file esiste per evitare (vedi
   la sezione "Prima si sceglie chi è l'intestatario" nella specifica).
   ============================================================ */

export type Intestatario = 'privato' | 'azienda';

/* Elenco chiuso, non un oggetto indicizzato dal valore che arriva dal
   cliente: 'toString', 'constructor' eccetera esistono su qualunque
   oggetto letterale per ereditarietà da Object.prototype, e un accesso
   diretto tipo LOOKUP[intestatario] li troverebbe truthy. Stesso
   precedente di LISTINO in acquista.ts e di LINGUE in
   richieste/condizioni.ts. */
const INTESTATARI: readonly Intestatario[] = ['privato', 'azienda'];

export interface DatiFattura {
  fatt_richiesta: boolean;
  fatt_intestatario: Intestatario | null;
  /** ragione sociale: solo azienda. Per il privato la denominazione sono
   *  nome e cognome, già raccolti altrove nell'acquisto — non si chiede
   *  una seconda volta qui, e questa colonna resta vuota apposta. */
  fatt_denominazione: string | null;
  /** solo azienda: al privato non si chiede */
  fatt_piva: string | null;
  fatt_cf: string | null;
  fatt_indirizzo: string | null;
  fatt_civico: string | null;
  fatt_cap: string | null;
  fatt_comune: string | null;
  fatt_provincia: string | null;
  fatt_sdi: string | null;
  /** solo azienda: al privato non si chiede */
  fatt_pec: string | null;
}

/* La spunta non è attiva: non si chiede né si valida niente, la fattura
   non serve a tutti. Un oggetto solo, riusato ogni volta che questo è il
   caso, così i due rami (spento del tutto / azienda / privato) non
   rischiano di dimenticare un campo l'uno rispetto all'altro. */
const NESSUNA_FATTURA: DatiFattura = {
  fatt_richiesta: false, fatt_intestatario: null, fatt_denominazione: null,
  fatt_piva: null, fatt_cf: null, fatt_indirizzo: null, fatt_civico: null,
  fatt_cap: null, fatt_comune: null, fatt_provincia: null,
  fatt_sdi: null, fatt_pec: null,
};

/* Il codice destinatario di chi non ha un cassetto fiscale aziendale.
   Per una persona fisica la fattura elettronica arriva nel suo cassetto
   fiscale personale, non serve indicare un canale: il codice è sempre
   questo, non un dato che l'ospite possa scegliere o sbagliare. Scritto
   qui come costante e MAI letto dal corpo della richiesta per il ramo
   privato — vedi validaFattura più sotto: anche se un client falsificato
   mandasse un altro valore in fatt_sdi, il privato riceve comunque
   questo. */
export const SDI_PRIVATO = '0000000';

/* Cifra di controllo della partita IVA italiana: variante Luhn.
   Sulle prime dieci cifre, quelle in posizione pari (2ª, 4ª, ...,
   contate da 1) si raddoppiano e, se il risultato supera 9, gli si
   sottrae 9 — esattamente come nell'algoritmo di Luhn delle carte di
   credito. La cifra di controllo è quella che porta la somma a un
   multiplo di 10.
   Non basta contare le cifre: un numero digitato male ma lungo 11
   passerebbe un controllo di sola lunghezza, la fattura partirebbe, e
   verrebbe scartata dallo SdI giorni dopo — quando l'amministrazione
   deve rincorrere il cliente per un dato che poteva chiedere subito. */
function cifraControlloPiva(primeDieci: string): number {
  let somma = 0;
  for (let i = 0; i < 10; i++) {
    let cifra = Number(primeDieci[i]);
    if (i % 2 === 1) {                 // 2ª, 4ª, ... cifra (indice dispari, 0-based)
      cifra *= 2;
      if (cifra > 9) cifra -= 9;
    }
    somma += cifra;
  }
  return (10 - (somma % 10)) % 10;
}

function pivaValida(v: string): boolean {
  if (!/^\d{11}$/.test(v)) return false;
  return cifraControlloPiva(v.slice(0, 10)) === Number(v[10]);
}

/* Un testo obbligatorio entro dei limiti di lunghezza: null se manca o
   se fuori dai limiti, così chi chiama può limitarsi a un `if (!x)`
   senza ripetere il controllo di lunghezza a ogni campo. */
function testoObbligatorio(v: unknown, min: number, max: number): string | null {
  const s = String(v ?? '').trim();
  return (s.length >= min && s.length <= max) ? s : null;
}

export function validaFattura(b: Record<string, unknown>): { errore?: string; dati?: DatiFattura } {
  /* confronto stretto, come condizioni_accettate in acquista.ts: un
     valore "quasi vero" (la stringa 'true', un 1) non deve bastare a
     far scattare una richiesta di dati che nessuno ha davvero fatto. */
  if (b.fatt_richiesta !== true) return { dati: NESSUNA_FATTURA };

  const intestatarioGrezzo = String(b.fatt_intestatario ?? '');
  if (!INTESTATARI.includes(intestatarioGrezzo as Intestatario)) {
    return { errore: 'scelga se la fattura è per un privato o per un\'azienda' };
  }
  const intestatario = intestatarioGrezzo as Intestatario;

  /* Campi comuni ai due casi: indirizzo, comune, CAP e provincia sono
     sempre obbligatori; il civico è l'unica eccezione, facoltativo. */
  const indirizzo = testoObbligatorio(b.fatt_indirizzo, 1, 60);
  if (!indirizzo) return { errore: 'indirizzo non valido' };

  const civicoGrezzo = String(b.fatt_civico ?? '').trim();
  if (civicoGrezzo.length > 8) return { errore: 'numero civico troppo lungo' };

  const comune = testoObbligatorio(b.fatt_comune, 1, 60);
  if (!comune) return { errore: 'comune non valido' };

  const cap = String(b.fatt_cap ?? '').trim();
  if (!/^\d{5}$/.test(cap)) return { errore: 'CAP non valido: servono esattamente 5 cifre' };

  /* NON normalizzata in maiuscolo: la validazione chiede "2 lettere
     maiuscole" alla lettera, e una provincia scritta minuscola va
     rifiutata così com'è, non corretta alle spalle di chi l'ha scritta —
     un ospite che sbaglia il formato deve saperlo, non scoprire mesi
     dopo una fattura con un dato che ha scritto in un modo e che il
     sistema ha silenziosamente cambiato. */
  const provincia = String(b.fatt_provincia ?? '').trim();
  if (!/^[A-Z]{2}$/.test(provincia)) return { errore: 'provincia non valida: due lettere maiuscole' };

  const civico = civicoGrezzo || null;

  if (intestatario === 'privato') {
    /* Per la persona fisica il codice fiscale è sempre di 16 caratteri:
       non è "una delle due forme possibili" come per l'azienda, è
       l'unica. Obbligatorio: senza partita IVA non c'è altro modo di
       identificare il cessionario nell'XML. */
    const cf = String(b.fatt_cf ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9]{16}$/.test(cf)) {
      return { errore: 'codice fiscale non valido: per una persona fisica servono 16 caratteri' };
    }
    return { dati: {
      fatt_richiesta: true, fatt_intestatario: 'privato',
      /* denominazione, partita IVA, PEC: MAI presi dal corpo della
         richiesta per il privato, qualunque cosa contenga — non si
         chiedono, quindi non si accettano nemmeno se qualcuno li manda.
         Il codice destinatario è sempre il valore fisso: lo scrive il
         sistema, non l'ospite (vedi il commento su SDI_PRIVATO). */
      fatt_denominazione: null, fatt_piva: null,
      fatt_cf: cf,
      fatt_indirizzo: indirizzo, fatt_civico: civico, fatt_cap: cap,
      fatt_comune: comune, fatt_provincia: provincia,
      fatt_sdi: SDI_PRIVATO, fatt_pec: null,
    } };
  }

  /* intestatario === 'azienda' */
  const denominazione = testoObbligatorio(b.fatt_denominazione, 2, 80);
  if (!denominazione) return { errore: 'ragione sociale non valida' };

  const piva = String(b.fatt_piva ?? '').trim();
  if (!pivaValida(piva)) return { errore: 'partita IVA non valida' };

  /* Il codice fiscale è facoltativo perché la partita IVA basta già a
     identificare il cessionario. Se però viene indicato, ha una forma:
     o le stesse 11 cifre della partita IVA (le società la usano
     identica), o i 16 alfanumerici di una persona fisica (titolare di
     una ditta individuale). Un valore che non rientra in nessuna delle
     due non è "nessun dato", è un dato sbagliato: si segnala. */
  const cfGrezzo = String(b.fatt_cf ?? '').trim().toUpperCase();
  let cf: string | null = null;
  if (cfGrezzo) {
    if (!/^(\d{11}|[A-Z0-9]{16})$/.test(cfGrezzo)) return { errore: 'codice fiscale non valido' };
    cf = cfGrezzo;
  }

  /* Codice destinatario e PEC: ciascuno, SE presente, ha una forma
     precisa — un valore malformato non si scusa dietro l'altro campo
     valido, va segnalato subito. Solo dopo, se ENTRAMBI mancano, scatta
     l'errore che conta di più: è l'errore che le aziende fanno più
     spesso ed è la causa numero uno di fatture scartate dallo SdI. */
  const sdiGrezzo = String(b.fatt_sdi ?? '').trim().toUpperCase();
  if (sdiGrezzo && !/^[A-Z0-9]{7}$/.test(sdiGrezzo)) {
    return { errore: 'codice destinatario non valido: servono 7 caratteri alfanumerici' };
  }
  const pecGrezzo = String(b.fatt_pec ?? '').trim();
  if (pecGrezzo && !/.+@.+\..+/.test(pecGrezzo)) {
    return { errore: 'PEC non valida' };
  }
  if (!sdiGrezzo && !pecGrezzo) {
    return { errore: 'serve il codice destinatario o la PEC: almeno uno dei due' };
  }

  return { dati: {
    fatt_richiesta: true, fatt_intestatario: 'azienda',
    fatt_denominazione: denominazione, fatt_piva: piva, fatt_cf: cf,
    fatt_indirizzo: indirizzo, fatt_civico: civico, fatt_cap: cap,
    fatt_comune: comune, fatt_provincia: provincia,
    fatt_sdi: sdiGrezzo || null, fatt_pec: pecGrezzo || null,
  } };
}
