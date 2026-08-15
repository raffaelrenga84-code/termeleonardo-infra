/* Test di fattura.ts: SOLO raccolta e validazione dei dati fattura.
   Niente XML, niente numerazione, niente aliquote — quelle parti della
   specifica dipendono da una conferma del commercialista non ancora
   arrivata (vedi docs/superpowers/specs/2026-08-13-fatturazione-buoni-design.md,
   sezione "Punti aperti"). */
import { assertEquals } from 'jsr:@std/assert';
import { validaFattura, SDI_PRIVATO } from './fattura.ts';

/* Partita IVA vera dell'hotel (dalla specifica): 02042330288. Usarla come
   caso valido invece di inventarne una vuol dire che il test conosce un
   numero che l'Agenzia delle Entrate riconoscerebbe davvero, non solo un
   numero che il NOSTRO calcolo approva — se l'algoritmo fosse implementato
   in modo autoreferenziale (es. sempre true) questo caso non lo scoprirebbe
   da solo, ma sbagliare la formula E avere lo stesso risultato sul numero
   reale dell'hotel è molto meno probabile che sbagliarla e basta. */
const PIVA_VALIDA = '02042330288';
/* stessa base, ultima cifra (quella di controllo) sbagliata di proposito */
const PIVA_CIFRA_SBAGLIATA = '02042330280';

const CF_PRIVATO_VALIDO = 'RSSMRA85M01H501Z';

const AZIENDA_BASE = {
  fatt_richiesta: true, fatt_intestatario: 'azienda',
  fatt_denominazione: 'Tria S.r.l.', fatt_piva: PIVA_VALIDA,
  fatt_indirizzo: 'Via Roma', fatt_civico: '1', fatt_cap: '35037',
  fatt_comune: 'Abano Terme', fatt_provincia: 'PD',
  fatt_sdi: 'ABC1234',
};

const PRIVATO_BASE = {
  fatt_richiesta: true, fatt_intestatario: 'privato',
  fatt_cf: CF_PRIVATO_VALIDO,
  fatt_indirizzo: 'Via Roma', fatt_civico: '1', fatt_cap: '35037',
  fatt_comune: 'Abano Terme', fatt_provincia: 'PD',
};

/* ============================================================
   La spunta non è attiva: non si chiede né si valida niente.
   Cosa lo farebbe fallire: un controllo aggiunto per errore fuori dal
   ramo "richiesta", che pretendesse indirizzo o CAP anche quando la
   spunta è spenta. ============================================== */

Deno.test('spunta non attiva e nessun dato: passa, la fattura non serve a tutti', () => {
  const r = validaFattura({});
  assertEquals(r.errore, undefined);
  assertEquals(r.dati!.fatt_richiesta, false);
  assertEquals(r.dati!.fatt_intestatario, null);
});

Deno.test('fatt_richiesta non true (stringa "true", 1) resta trattata come non richiesta', () => {
  for (const grezzo of ['true', 1, 'sì']) {
    const r = validaFattura({ fatt_richiesta: grezzo });
    assertEquals(r.errore, undefined, `valore ${grezzo}`);
    assertEquals(r.dati!.fatt_richiesta, false, `valore ${grezzo}`);
  }
});

/* ============================================================
   L'intestatario: elenco chiuso, arriva dal cliente.
   Cosa lo farebbe fallire: sostituire l'.includes() con un accesso diretto
   tipo LOOKUP[intestatario], che renderebbe 'toString' truthy per
   ereditarietà da Object.prototype invece che rifiutato.
   ============================================================ */

Deno.test('un tipo di intestatario inventato viene rifiutato', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_intestatario: 'famiglia' });
  assertEquals(r.dati, undefined);
  assertEquals(typeof r.errore, 'string');
});

Deno.test('fatt_intestatario "toString" viene rifiutato, non trattato come proprietà ereditata', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_intestatario: 'toString' });
  assertEquals(r.dati, undefined);
  assertEquals(typeof r.errore, 'string');
});

Deno.test('intestatario mancante viene rifiutato', () => {
  const r = validaFattura({ fatt_richiesta: true });
  assertEquals(r.dati, undefined);
  assertEquals(typeof r.errore, 'string');
});

/* ============================================================
   Partita IVA: 11 cifre, cifra di controllo verificata.
   Cosa lo farebbe fallire: un controllo che si limita a `.length === 11`
   senza calcolare la cifra di controllo — un numero lungo giusto ma
   digitato male passerebbe, e la fattura verrebbe scartata dallo SdI
   giorni dopo.
   ============================================================ */

Deno.test('partita IVA con cifra di controllo giusta viene accettata', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_piva: PIVA_VALIDA });
  assertEquals(r.errore, undefined);
  assertEquals(r.dati!.fatt_piva, PIVA_VALIDA);
});

Deno.test('partita IVA con cifra di controllo sbagliata viene rifiutata', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_piva: PIVA_CIFRA_SBAGLIATA });
  assertEquals(r.dati, undefined);
  assertEquals(typeof r.errore, 'string');
});

Deno.test('partita IVA di 10 cifre viene rifiutata', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_piva: '0204233028' });
  assertEquals(r.dati, undefined);
});

Deno.test('partita IVA di 12 cifre viene rifiutata', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_piva: '020423302880' });
  assertEquals(r.dati, undefined);
});

Deno.test('partita IVA mancante per un azienda viene rifiutata', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_piva: undefined });
  assertEquals(r.dati, undefined);
});

/* ============================================================
   Codice destinatario o PEC: almeno uno dei due, solo per l'azienda.
   Cosa lo farebbe fallire: un `&&` al posto dell'`||` nel controllo finale
   (richiederebbe sempre entrambi), o la rimozione del controllo che
   lascerebbe passare un'azienda senza nessuno dei due.
   ============================================================ */

Deno.test('azienda senza né SDI né PEC viene rifiutata', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_sdi: undefined, fatt_pec: undefined });
  assertEquals(r.dati, undefined);
  assertEquals(typeof r.errore, 'string');
});

Deno.test('azienda con solo il codice destinatario passa', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_sdi: 'ABC1234', fatt_pec: undefined });
  assertEquals(r.errore, undefined);
  assertEquals(r.dati!.fatt_sdi, 'ABC1234');
  assertEquals(r.dati!.fatt_pec, null);
});

Deno.test('azienda con sola PEC passa', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_sdi: undefined, fatt_pec: 'fatture@pec-azienda.it' });
  assertEquals(r.errore, undefined);
  assertEquals(r.dati!.fatt_sdi, null);
  assertEquals(r.dati!.fatt_pec, 'fatture@pec-azienda.it');
});

Deno.test('azienda con entrambi SDI e PEC passa', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_sdi: 'ABC1234', fatt_pec: 'fatture@pec-azienda.it' });
  assertEquals(r.errore, undefined);
  assertEquals(r.dati!.fatt_sdi, 'ABC1234');
  assertEquals(r.dati!.fatt_pec, 'fatture@pec-azienda.it');
});

Deno.test('codice destinatario di 6 caratteri viene rifiutato', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_sdi: 'ABC123', fatt_pec: undefined });
  assertEquals(r.dati, undefined);
});

Deno.test('codice destinatario di 8 caratteri viene rifiutato', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_sdi: 'ABC12345', fatt_pec: undefined });
  assertEquals(r.dati, undefined);
});

/* un codice destinatario malformato non si scusa dietro una PEC valida:
   un dato sbagliato mandato dal cliente va segnalato, non ignorato in
   silenzio perché "tanto l'altro campo basta" */
Deno.test('codice destinatario malformato viene rifiutato anche con una PEC valida', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_sdi: 'ABC123', fatt_pec: 'fatture@pec-azienda.it' });
  assertEquals(r.dati, undefined);
});

Deno.test('PEC malformata viene rifiutata', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_sdi: undefined, fatt_pec: 'non-una-email' });
  assertEquals(r.dati, undefined);
});

Deno.test('PEC malformata viene rifiutata anche con un codice destinatario valido', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_sdi: 'ABC1234', fatt_pec: 'non-una-email' });
  assertEquals(r.dati, undefined);
});

/* ============================================================
   Codice fiscale: obbligatorio e di 16 caratteri per il privato;
   facoltativo per l'azienda se c'è la partita IVA (11 cifre o 16
   alfanumerici quando c'è).
   ============================================================ */

Deno.test('privato senza codice fiscale viene rifiutato', () => {
  const r = validaFattura({ ...PRIVATO_BASE, fatt_cf: undefined });
  assertEquals(r.dati, undefined);
  assertEquals(typeof r.errore, 'string');
});

Deno.test('privato con codice fiscale di 11 caratteri viene rifiutato: per una persona fisica sono 16', () => {
  const r = validaFattura({ ...PRIVATO_BASE, fatt_cf: '12345678901' });
  assertEquals(r.dati, undefined);
});

Deno.test('privato con codice fiscale di 16 caratteri viene accettato', () => {
  const r = validaFattura({ ...PRIVATO_BASE, fatt_cf: CF_PRIVATO_VALIDO });
  assertEquals(r.errore, undefined);
  assertEquals(r.dati!.fatt_cf, CF_PRIVATO_VALIDO);
});

Deno.test('azienda senza codice fiscale passa: è facoltativo quando c è la partita IVA', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_cf: undefined });
  assertEquals(r.errore, undefined);
  assertEquals(r.dati!.fatt_cf, null);
});

Deno.test('azienda con codice fiscale a 11 cifre (uguale alla P.IVA) viene accettato', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_cf: PIVA_VALIDA });
  assertEquals(r.errore, undefined);
  assertEquals(r.dati!.fatt_cf, PIVA_VALIDA);
});

Deno.test('azienda con codice fiscale a 16 alfanumerici (titolare persona fisica) viene accettato', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_cf: CF_PRIVATO_VALIDO });
  assertEquals(r.errore, undefined);
  assertEquals(r.dati!.fatt_cf, CF_PRIVATO_VALIDO);
});

Deno.test('azienda con un codice fiscale di lunghezza sbagliata (12) viene rifiutata', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_cf: '123456789012' });
  assertEquals(r.dati, undefined);
});

/* ============================================================
   Il codice destinatario del privato lo scrive il sistema, non l'ospite:
   anche se un client falsificato lo mandasse diverso, il server lo
   sovrascrive. Stesso trattamento per PEC (mai chiesta al privato) e per
   la ragione sociale (per il privato la denominazione sono nome e cognome,
   già raccolti nell'acquisto — non una seconda volta qui).
   Cosa lo farebbe fallire: usare direttamente il valore mandato dal
   client invece della costante SDI_PRIVATO.
   ============================================================ */

Deno.test('privato: il codice destinatario è sempre 0000000, anche se il client ne manda un altro', () => {
  const r = validaFattura({ ...PRIVATO_BASE, fatt_sdi: 'ZZZZZZZ' });
  assertEquals(r.errore, undefined);
  assertEquals(r.dati!.fatt_sdi, SDI_PRIVATO);
  assertEquals(SDI_PRIVATO, '0000000');
});

Deno.test('privato: la PEC resta vuota anche se il client ne manda una', () => {
  const r = validaFattura({ ...PRIVATO_BASE, fatt_pec: 'qualcuno@esempio.it' });
  assertEquals(r.errore, undefined);
  assertEquals(r.dati!.fatt_pec, null);
});

Deno.test('privato: la denominazione resta vuota anche se il client ne manda una: usa nome e cognome dell acquisto', () => {
  const r = validaFattura({ ...PRIVATO_BASE, fatt_denominazione: 'Mario Rossi' });
  assertEquals(r.errore, undefined);
  assertEquals(r.dati!.fatt_denominazione, null);
});

Deno.test('privato: la partita IVA non si chiede, resta vuota anche se il client ne manda una', () => {
  const r = validaFattura({ ...PRIVATO_BASE, fatt_piva: PIVA_VALIDA });
  assertEquals(r.errore, undefined);
  assertEquals(r.dati!.fatt_piva, null);
});

/* ============================================================
   Controlli di forma comuni a privato e azienda: CAP, provincia,
   indirizzo, comune, civico.
   ============================================================ */

Deno.test('CAP di 4 cifre viene rifiutato', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_cap: '3503' });
  assertEquals(r.dati, undefined);
});

Deno.test('CAP di 6 cifre viene rifiutato', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_cap: '350377' });
  assertEquals(r.dati, undefined);
});

Deno.test('CAP di 5 cifre viene accettato', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_cap: '35037' });
  assertEquals(r.errore, undefined);
  assertEquals(r.dati!.fatt_cap, '35037');
});

/* la provincia minuscola NON viene normalizzata e accettata: deve essere
   rifiutata così com'è, non "corretta" in maiuscolo alle sue spalle —
   altrimenti un test che si aspetta il rifiuto scoprirebbe invece
   un'accettazione silenziosa */
Deno.test('provincia minuscola viene rifiutata', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_provincia: 'pd' });
  assertEquals(r.dati, undefined);
});

Deno.test('provincia di una sola lettera viene rifiutata', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_provincia: 'P' });
  assertEquals(r.dati, undefined);
});

Deno.test('provincia di tre lettere viene rifiutata', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_provincia: 'PDX' });
  assertEquals(r.dati, undefined);
});

Deno.test('provincia di due lettere maiuscole viene accettata', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_provincia: 'PD' });
  assertEquals(r.errore, undefined);
  assertEquals(r.dati!.fatt_provincia, 'PD');
});

Deno.test('indirizzo mancante viene rifiutato', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_indirizzo: '' });
  assertEquals(r.dati, undefined);
});

Deno.test('indirizzo oltre 60 caratteri viene rifiutato', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_indirizzo: 'x'.repeat(61) });
  assertEquals(r.dati, undefined);
});

Deno.test('comune mancante viene rifiutato', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_comune: '' });
  assertEquals(r.dati, undefined);
});

Deno.test('numero civico facoltativo: assente passa', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_civico: undefined });
  assertEquals(r.errore, undefined);
  assertEquals(r.dati!.fatt_civico, null);
});

Deno.test('numero civico oltre 8 caratteri viene rifiutato', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_civico: '123456789' });
  assertEquals(r.dati, undefined);
});

Deno.test('numero civico di 8 caratteri viene accettato', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_civico: '12345678' });
  assertEquals(r.errore, undefined);
  assertEquals(r.dati!.fatt_civico, '12345678');
});

/* ============================================================
   Ragione sociale: 2–80 caratteri, richiesta solo all'azienda.
   ============================================================ */

Deno.test('ragione sociale mancante per un azienda viene rifiutata', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_denominazione: '' });
  assertEquals(r.dati, undefined);
});

Deno.test('ragione sociale di un solo carattere viene rifiutata', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_denominazione: 'X' });
  assertEquals(r.dati, undefined);
});

Deno.test('ragione sociale oltre 80 caratteri viene rifiutata', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_denominazione: 'x'.repeat(81) });
  assertEquals(r.dati, undefined);
});

Deno.test('ragione sociale di 80 caratteri viene accettata', () => {
  const r = validaFattura({ ...AZIENDA_BASE, fatt_denominazione: 'x'.repeat(80) });
  assertEquals(r.errore, undefined);
});

/* ============================================================
   Un buono azienda completo e uno privato completo: i due percorsi
   principali, per intero.
   ============================================================ */

Deno.test('azienda completa: tutti i dati tornano validati e normalizzati', () => {
  const r = validaFattura(AZIENDA_BASE);
  assertEquals(r.errore, undefined);
  assertEquals(r.dati, {
    fatt_richiesta: true, fatt_intestatario: 'azienda',
    fatt_denominazione: 'Tria S.r.l.', fatt_piva: PIVA_VALIDA, fatt_cf: null,
    fatt_indirizzo: 'Via Roma', fatt_civico: '1', fatt_cap: '35037',
    fatt_comune: 'Abano Terme', fatt_provincia: 'PD',
    fatt_sdi: 'ABC1234', fatt_pec: null,
  });
});

Deno.test('privato completo: tutti i dati tornano validati, SDI e PEC ai valori fissi', () => {
  const r = validaFattura(PRIVATO_BASE);
  assertEquals(r.errore, undefined);
  assertEquals(r.dati, {
    fatt_richiesta: true, fatt_intestatario: 'privato',
    fatt_denominazione: null, fatt_piva: null, fatt_cf: CF_PRIVATO_VALIDO,
    fatt_indirizzo: 'Via Roma', fatt_civico: '1', fatt_cap: '35037',
    fatt_comune: 'Abano Terme', fatt_provincia: 'PD',
    fatt_sdi: SDI_PRIVATO, fatt_pec: null,
  });
});
