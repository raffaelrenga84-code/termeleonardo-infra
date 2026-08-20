/* ============================================================
   arrivi.test.ts — che cosa vede, di un arrivo, chi lo guarda.

   COSA C'E' DENTRO UN ARRIVO. Chi compila «Prepara il suo arrivo» scrive
   l'ora, il mezzo, il transfer, le persone da aggiungere, il desiderio dei
   fanghi — e i dati di FATTURAZIONE: ragione sociale, partita IVA, codice
   fiscale, codice SDI, PEC. Sono ventuno campi, e non riguardano tutti le
   stesse persone.

   ALLA SPA SERVONO I FANGHI, NON LA PARTITA IVA. La regola dei ruoli e' gia'
   in piedi per le richieste dal sito (la spa vede trattamenti e Day Spa e
   nient'altro): qui vale lo stesso principio dentro una riga sola.

   ELENCO CHIUSO, NON LISTA DI ESCLUSIONI. E' la differenza che conta: con
   una lista di campi vietati, il primo campo aggiunto domani ad
   arrivo_richiesta arriverebbe alla spa senza che nessuno l'abbia deciso.
   Con l'elenco chiuso, un campo nuovo non arriva finche' qualcuno non lo
   scrive — e l'ultima prova qui sotto e' proprio quella.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import {
  CAMPI_SPA, giornoValido, perRuolo, perToken, puoChiudere, richiestePerRuolo, tipiCura,
} from './arrivi.ts';
import { tipiVisibili } from './ruoli.ts';

/* ============================================================
   IL GIORNO CHE ARRIVA DAL BROWSER.
   Finisce dentro un filtro PostgREST costruito come testo, perche' per i
   campi dentro un JSON non c'e' altra forma. Quindi o e' una data, o non
   entra: e' l'unica difesa che non dipende da quanto si e' stati attenti a
   comporre la stringa.
   ============================================================ */
Deno.test('una data vera passa', () => {
  assertEquals(giornoValido('2026-09-12'), '2026-09-12');
  assertEquals(giornoValido(' 2026-09-12 '), '2026-09-12');
});

Deno.test('tutto quello che non e una data non passa', () => {
  for (const brutto of ['2026-9-12', '12/09/2026', '', '  ', 'oggi', null, undefined, 42]) {
    assertEquals(giornoValido(brutto), null, `e passato: ${JSON.stringify(brutto)}`);
  }
});

/* Il caso per cui il cancello esiste: qualcuno che prova ad allungare il
   filtro con altra sintassi. */
Deno.test('un tentativo di allungare il filtro non passa', () => {
  assertEquals(giornoValido('2026-09-12,tipo.eq.soggiorno'), null);
  assertEquals(giornoValido('2026-09-12)'), null);
  assertEquals(giornoValido('2026-09-12 or 1=1'), null);
});

const PIVA = 'IT02042330288';

const RIGA = {
  numero: 'C26/19130',
  intestatario: 'Bianchi Maria',
  email: 'maria@esempio.it',
  data_arrivo: '2026-09-12',
  data_partenza: '2026-09-19',
  adulti: 2,
  bambini: 0,
  cure: true,
  ora_arrivo: '16:30',
  mezzo: 'auto',
  fanghi_desiderio: 'presto',
  note: 'Arriviamo dopo cena se il traffico è brutto',
  fattura: true,
  fatt_ragione: 'Bianchi S.r.l.',
  fatt_indirizzo: 'Via Roma 1, Padova',
  fatt_piva: PIVA,
  fatt_cf: 'BNCMRA80A01G224X',
  fatt_sdi: 'M5UXCR1',
  fatt_pec: 'bianchi@pec-mail.it',
  persone_extra: [{ nome: 'Bianchi Luca', eta: '12' }],
  transfer: true,
  transfer_volo: 'FR1234',
  transfer_cell: '+39 333 1234567',
};

Deno.test('l elenco dei campi della spa non e vuoto', () => {
  assert(CAMPI_SPA.length >= 8, `solo ${CAMPI_SPA.length} campi: la prova girerebbe a vuoto`);
});

Deno.test('la reception vede tutto, partita IVA compresa', () => {
  const r = perRuolo(RIGA, 'reception', false);
  assert(r, 'la reception non vede niente');
  assertEquals(r.fatt_piva, PIVA);
  assertEquals(r.transfer_cell, '+39 333 1234567');
});

Deno.test('l amministrazione vede tutto', () => {
  const r = perRuolo(RIGA, 'amministrazione', false);
  assert(r && r.fatt_sdi === 'M5UXCR1');
});

/* Il controllo forte: non «manca il campo fatt_piva», ma «quella stringa
   non compare da nessuna parte nella risposta». Prende anche l'errore di
   chi un domani annidasse i dati dentro un oggetto. */
Deno.test('alla spa la fatturazione non arriva, in nessuna forma', () => {
  const r = perRuolo(RIGA, 'spa', false);
  assert(r, 'la spa non vede niente');
  const tutto = JSON.stringify(r);
  assert(!tutto.includes(PIVA), 'la partita IVA e nella risposta');
  assert(!tutto.includes('M5UXCR1'), 'il codice SDI e nella risposta');
  assert(!tutto.includes('pec-mail'), 'la PEC e nella risposta');
  assert(!tutto.includes('333 1234567'), 'il cellulare del transfer e nella risposta');
});

Deno.test('ma alla spa arriva quello che le serve', () => {
  const r = perRuolo(RIGA, 'spa', false);
  assert(r);
  assertEquals(r.fanghi_desiderio, 'presto');
  assertEquals(r.intestatario, 'Bianchi Maria');
  assertEquals(r.data_arrivo, '2026-09-12');
  assertEquals(r.cure, true);
  assertEquals(r.ora_arrivo, '16:30');
});

Deno.test('senza ruolo non si vede niente', () => {
  assertEquals(perRuolo(RIGA, null, false), null);
});

/* La chiave interna e' quella dell'estensione: vale come la reception. */
Deno.test('con la chiave interna si vede tutto', () => {
  const r = perRuolo(RIGA, null, true);
  assert(r && r.fatt_piva === PIVA);
});

/* LA PROVA CHE DISTINGUE UN ELENCO CHIUSO DA UNA LISTA DI ESCLUSIONI.
   Domani qualcuno aggiunge una colonna alla tabella: con l'elenco chiuso
   non arriva alla spa finche' non lo si scrive; con la lista di esclusioni
   arriverebbe subito, e nessuno se ne accorgerebbe. */
Deno.test('un campo aggiunto domani non arriva alla spa da solo', () => {
  const domani = { ...RIGA, documento_identita: 'AX1234567' };
  const r = perRuolo(domani, 'spa', false);
  assert(r, 'la spa non vede niente');
  assert(
    !JSON.stringify(r).includes('AX1234567'),
    'un campo mai deciso e arrivato alla spa: l elenco non e chiuso',
  );
});

/* I campi che nella riga non ci sono non devono comparire come «undefined»:
   una scheda piena di caselle vuote sembra un guasto. */
Deno.test('i campi assenti non compaiono affatto', () => {
  const scarna = { intestatario: 'Rossi', data_arrivo: '2026-09-12' };
  const r = perRuolo(scarna, 'spa', false);
  assert(r);
  assert(!('fanghi_desiderio' in r), 'un campo assente e comparso lo stesso');
  assertEquals(r.intestatario, 'Rossi');
});

/* ============================================================
   DUE COMPILAZIONI PER LO STESSO OSPITE.

   prepara-arrivo fa un `insert`, non un `upsert`: chi rimanda il modulo —
   perche' ha sbagliato l'ora, perche' il volo e' cambiato — lascia DUE
   righe con lo stesso token. Sceglierne una a caso e mostrarla come se
   fosse l'unica e' il modo silenzioso di sbagliare un transfer.

   Quindi due cose insieme: si tiene la piu' recente quando la riga porta
   una data, e in ogni caso si DICE quante ce n'erano. Il numero e' la
   parte che non puo' mentire.
   ============================================================ */
Deno.test('senza compilazioni non esce niente', () => {
  assertEquals(Object.keys(perToken([])).length, 0);
});

Deno.test('una compilazione sola: la riga e quella, e si conta una', () => {
  const g = perToken([{ token: 'aaa', ora_arrivo: '16:30' }]);
  assertEquals(g.aaa.compilazioni, 1);
  assertEquals(g.aaa.riga.ora_arrivo, '16:30');
});

Deno.test('due compilazioni con data: vince la piu recente', () => {
  const g = perToken([
    { token: 'aaa', ora_arrivo: '16:30', creato_il: '2026-08-01T10:00:00Z' },
    { token: 'aaa', ora_arrivo: '21:00', creato_il: '2026-08-05T09:00:00Z' },
  ]);
  assertEquals(g.aaa.riga.ora_arrivo, '21:00', 'ha vinto la vecchia');
  assertEquals(g.aaa.compilazioni, 2);
});

/* L'ordine in cui il database restituisce le righe non e' garantito: la
   prova sopra deve valere anche se arrivano al contrario. */
Deno.test('e vince anche se arrivano nell ordine opposto', () => {
  const g = perToken([
    { token: 'aaa', ora_arrivo: '21:00', creato_il: '2026-08-05T09:00:00Z' },
    { token: 'aaa', ora_arrivo: '16:30', creato_il: '2026-08-01T10:00:00Z' },
  ]);
  assertEquals(g.aaa.riga.ora_arrivo, '21:00');
});

/* Se la data non c'e' non si inventa un vincitore: si dice che sono due,
   ed e' quel numero a mandare qualcuno a guardare. */
Deno.test('senza data si dice comunque quante sono', () => {
  const g = perToken([
    { token: 'aaa', ora_arrivo: '16:30' },
    { token: 'aaa', ora_arrivo: '21:00' },
  ]);
  assertEquals(g.aaa.compilazioni, 2);
});

Deno.test('ospiti diversi non si mescolano', () => {
  const g = perToken([
    { token: 'aaa', ora_arrivo: '16:30' },
    { token: 'bbb', ora_arrivo: '09:00' },
  ]);
  assertEquals(g.aaa.riga.ora_arrivo, '16:30');
  assertEquals(g.bbb.riga.ora_arrivo, '09:00');
  assertEquals(g.aaa.compilazioni, 1);
});

/* Il numero di compilazioni serve anche alla spa, e per la stessa ragione:
   se l'ospite ha rimandato il modulo, il desiderio dei fanghi che si sta
   leggendo potrebbe essere quello vecchio. */
Deno.test('alla spa arriva anche quante volte ha compilato', () => {
  const r = perRuolo({ ...RIGA, compilazioni: 2 }, 'spa', false);
  assert(r);
  assertEquals(r.compilazioni, 2);
});

/* ============================================================
   QUALI RICHIESTE, ACCANTO AGLI ARRIVI.

   Nella scheda «Arrivi» si vedono anche i trattamenti chiesti per quel
   giorno. Quali tipi siano «trattamenti» lo sa gia' ruoli.ts, e riscriverlo
   qui vorrebbe dire due elenchi che divergono al primo cambiamento — e a
   decidere sarebbe il piu' debole dei due. Quindi: i tipi delle cure,
   intersecati con quello che quel ruolo puo' leggere.
   ============================================================ */
Deno.test('la reception vede tutti i tipi di cura', () => {
  assertEquals(tipiCura('reception', false).sort(), ['dayspa', 'trattamenti']);
});

Deno.test('con la chiave interna anche', () => {
  assertEquals(tipiCura(null, true).sort(), ['dayspa', 'trattamenti']);
});

/* Il controllo che conta: quello che torna alla spa non e' una lista
   scritta a mano qui, ma l'intersezione con quello che la spa puo' vedere.
   Se domani la spa perde il Day Spa, questa prova cambia da sola. */
Deno.test('alla spa tornano solo tipi che la spa puo gia leggere', () => {
  const suoi = tipiCura('spa', false);
  assert(suoi.length > 0, 'la spa non vede nessun tipo: la prova girerebbe a vuoto');
  for (const t of suoi) {
    assert(tipiVisibili('spa').includes(t), `"${t}" torna alla spa e la spa non puo leggerlo`);
  }
});

Deno.test('senza ruolo e senza chiave non torna nessun tipo', () => {
  assertEquals(tipiCura(null, false), []);
});

/* ============================================================
   UNA RICHIESTA D'ARRIVO CON GENTE DA AGGIUNGERE NON SI CHIUDE.

   Chi ha scritto "si aggiunge mia figlia" sta aspettando di sapere se c'e'
   posto e quanto costa. Una richiesta d'arrivo si chiude in fretta, perche'
   quasi sempre non c'e' niente da rispondere: e' esattamente il caso in
   cui una riga si perde.

   Il segno che qualcuno ha risposto e' persone_confermate, che
   validaArrivo conserva apposta attraverso ?a=conferma.
   ============================================================ */
Deno.test('un arrivo con persone da aggiungere non si chiude', () => {
  const r = puoChiudere({ tipo: 'arrivo', dati: { persone_extra: [{ nome: 'Bianchi Luca' }] } });
  assert(!r.ok);
  assert(r.perche && r.perche.length > 10, 'rifiuta senza dire perche');
});

Deno.test('ma si chiude quando qualcuno ha risposto', () => {
  assert(puoChiudere({ tipo: 'arrivo', dati: {
    persone_extra: [{ nome: 'Bianchi Luca' }], persone_confermate: true } }).ok);
});

Deno.test('un arrivo senza persone si chiude sempre', () => {
  assert(puoChiudere({ tipo: 'arrivo', dati: { ora_arrivo: '16:30' } }).ok);
  assert(puoChiudere({ tipo: 'arrivo', dati: { persone_extra: [] } }).ok);
});

/* La regola vale per l'arrivo e per nient'altro: un transfer con dentro
   una chiave persone_extra per sbaglio non deve diventare inchiudibile. */
Deno.test('gli altri tipi non sono toccati', () => {
  assert(puoChiudere({ tipo: 'transfer', dati: { persone_extra: [{ nome: 'X' }] } }).ok);
  assert(puoChiudere({ tipo: 'trattamenti', dati: {} }).ok);
});

/* ============================================================
   L'ARRIVO ADESSO E' FATTO DI RICHIESTE.

   Fino a ieri la scheda leggeva arrivo_richiesta. Adesso legge le
   richieste che portano il token della prenotazione — ma le righe gia'
   scritte nella vecchia tabella devono continuare a vedersi finche' quegli
   arrivi non sono passati: non si migra niente, e un ospite che ha
   compilato la settimana scorsa non deve sparire dalla schermata.
   ============================================================ */
const RICHIESTE = [
  { numero: 'C26/19130', tipo: 'arrivo', dati: { ora_arrivo: '16:30' } },
  { numero: 'C26/19131', tipo: 'transfer', dati: { luogo: 'Venezia  aeroporto' } },
  { numero: 'C26/19132', tipo: 'fattura', dati: { ragione: 'Bianchi S.r.l.', piva: 'IT02042330288' } },
  { numero: 'C26/19133', tipo: 'trattamenti', dati: { voci: ['Massaggio antistress'] } },
];

Deno.test('l elenco di prova non e vuoto', () => {
  assert(RICHIESTE.length >= 4, 'la prova girerebbe a vuoto');
});

Deno.test('la reception vede tutte le richieste di un arrivo', () => {
  assertEquals(richiestePerRuolo(RICHIESTE, 'reception', false).length, RICHIESTE.length);
  assertEquals(richiestePerRuolo(RICHIESTE, null, true).length, RICHIESTE.length);
});

/* La spa vede quello che vede gia' nell'elenco delle richieste, e non altro:
   la regola e' quella di ruoli.ts, non una seconda scritta qui. */
Deno.test('la spa vede solo le sue', () => {
  const suoi = richiestePerRuolo(RICHIESTE, 'spa', false);
  assertEquals(suoi.map((r) => (r as { tipo: string }).tipo), ['trattamenti']);
});

/* Il controllo forte, come quello di ieri: non «manca il campo», ma quella
   stringa non compare da nessuna parte in quello che parte. */
Deno.test('alla spa la fatturazione non arriva in nessuna forma', () => {
  const tutto = JSON.stringify(richiestePerRuolo(RICHIESTE, 'spa', false));
  assert(!tutto.includes('IT02042330288'), 'la partita IVA e nella risposta');
  assert(!tutto.includes('Venezia'), 'il transfer di un altro reparto e nella risposta');
});

/* E il desiderio dei fanghi continua ad arrivarle dalla SCHEDA dell'arrivo,
   che e' piatta e passa da CAMPI_SPA: e' il dato che le serve, senza la
   fatturazione che gli sta accanto. */
Deno.test('ma la scheda dell arrivo le porta ancora i fanghi', () => {
  const r = perRuolo({
    intestatario: 'Bianchi Maria', data_arrivo: '2026-09-12',
    ora_arrivo: '16:30', fanghi_desiderio: 'presto',
  }, 'spa', false);
  assert(r);
  assertEquals(r.fanghi_desiderio, 'presto');
});
