/* Test del ramo pubblico a=acquista: la validazione è l'unica
   fonte dei prezzi — quello che arriva dal browser non conta. */
import { assertEquals, assertMatch, assertNotEquals } from 'jsr:@std/assert';
import { LISTINO, validaAcquisto, colonnaVoci, componiDescrizione, scadenzaCrea } from './acquista.ts';
import { type Stagione } from './scadenza.ts';

/* oggetto minimo che validaAcquisto accetta, riusato dai test sulla
   scadenza cosi' com'e', senza reinventarlo ogni volta */
const ACQUISTO_VALIDO = {
  tipo: 'valore', valore: 100, acquirente_email: 'a@b.it',
  condizioni_accettate: true, privacy_presa_atto: true,
};

const STAGIONI: Stagione[] = [{ chiusura: '2026-11-29', riapertura: '2027-02-13' }];

Deno.test('rifiuta email mancante o malformata', () => {
  const r1 = validaAcquisto({ tipo: 'valore', valore: 100 });
  assertEquals(r1.errore, 'email non valida');
  const r2 = validaAcquisto({ tipo: 'valore', valore: 100, acquirente_email: 'pippo@' });
  assertEquals(r2.errore, 'email non valida');
});

Deno.test('rifiuta una voce di listino sconosciuta', () => {
  const r = validaAcquisto({ tipo: 'servizio', voce_id: 'xxx', acquirente_email: 'a@b.it' });
  assertEquals(r.errore, 'voce di listino sconosciuta');
});

Deno.test('rifiuta importi fuori dai limiti 25–1000', () => {
  for (const valore of [5, 24, 1001, 0, -50]) {
    const r = validaAcquisto({ tipo: 'valore', valore, acquirente_email: 'a@b.it' });
    assertEquals(r.errore, 'importo fuori dai limiti (25–1000 €)', `valore ${valore}`);
  }
});

Deno.test('accetta un buono valore e lo descrive nella lingua del buono', () => {
  const r = validaAcquisto({
    tipo: 'valore', valore: 100, lingua: 'de', acquirente_email: 'a@b.it',
    condizioni_accettate: true, privacy_presa_atto: true
  });
  assertEquals(r.errore, undefined);
  assertEquals(r.dati!.valore, 100);
  assertEquals(r.dati!.tipo, 'valore');
  assertEquals(r.dati!.voce_id, null);
  assertMatch(r.dati!.descrizione, /Wertgutschein über 100,00 €/);
});

Deno.test('per un servizio il prezzo viene dal listino, non dal browser', () => {
  const r = validaAcquisto({
    tipo: 'servizio', voce_id: 'relax25', valore: 1,   // il client mente sul prezzo
    acquirente_email: 'a@b.it', condizioni_accettate: true, privacy_presa_atto: true
  });
  assertEquals(r.errore, undefined);
  assertEquals(r.dati!.valore, 40);                     // prezzo del listino server
  assertEquals(r.dati!.voce_id, 'relax25');
  /* il nome e' quello del listino ufficiale del reparto: «Massaggio Relax
     (con olio di cacao)». Diceva «relax con olio di cacao» minuscolo, ed era
     una delle tre voci in cui il LISTINO del server divergeva dal listino
     stampato — allineate il 15 agosto 2026. */
  assertMatch(r.dati!.descrizione, /Massaggio Relax \(con olio di cacao\)/);
});

Deno.test('lingua sconosciuta ricade su italiano', () => {
  const r = validaAcquisto({
    tipo: 'valore', valore: 50, lingua: 'xx', acquirente_email: 'a@b.it',
    condizioni_accettate: true, privacy_presa_atto: true
  });
  assertEquals(r.dati!.lingua, 'it');
  assertMatch(r.dati!.descrizione, /Buono valore di 50,00 €/);
});

Deno.test('senza stagioni: dodici mesi, e le due date coincidono', () => {
  const r = validaAcquisto(ACQUISTO_VALIDO, []);
  const attesa = new Date(); attesa.setFullYear(attesa.getFullYear() + 1);
  assertEquals(r.dati!.scade_il, attesa.toISOString().slice(0, 10));
  assertEquals(r.dati!.scade_il_base, r.dati!.scade_il);
  assertEquals(r.dati!.prorogato, false);
});

Deno.test('le stagioni arrivano da fuori, non dal codice di acquista', () => {
  /* si prova che validaAcquisto le USA davvero, con una stagione finta che
     copre l'anno intero: qualunque scadenza deve risultare prorogata */
  const anno = new Date().getFullYear() + 1;
  const sempre: Stagione[] = [{ chiusura: `${anno}-01-01`, riapertura: `${anno}-12-31` }];
  const r = validaAcquisto(ACQUISTO_VALIDO, sempre);
  assertEquals(r.dati!.prorogato, true);
  assertEquals(r.dati!.scade_il, `${anno + 1}-01-31`);
  assertNotEquals(r.dati!.scade_il, r.dati!.scade_il_base);
});

/* ============================================================
   scadenzaCrea — il ramo ?a=crea del back office (index.ts), dove
   l'operatore può scrivere una scadenza a mano per un caso particolare.
   Quella data, se c'è, è definitiva: non va prorogata né trattata come
   "naturale" — sennò un domani qualcuno "semplifica" e la sovrascrive.
   ============================================================ */

Deno.test('scadenzaCrea: la data scritta a mano dall operatore vince, anche se cadrebbe a hotel chiuso', () => {
  /* una data futura, dentro la finestra 2026-11-29..2027-02-13: se
     passasse per calcolaScadenza verrebbe prorogata. Non deve succedere. */
  const r = scadenzaCrea('2026-12-05', STAGIONI);
  assertEquals(r.errore, undefined);
  assertEquals(r.scadenza, { scade_il: '2026-12-05', scade_il_base: '2026-12-05', prorogato: false });
});

Deno.test('scadenzaCrea: senza data manuale calcola come fa il sito', () => {
  const r = scadenzaCrea(undefined, []);
  const attesa = new Date(); attesa.setFullYear(attesa.getFullYear() + 1);
  assertEquals(r.errore, undefined);
  assertEquals(r.scadenza!.scade_il, attesa.toISOString().slice(0, 10));
  assertEquals(r.scadenza!.scade_il_base, r.scadenza!.scade_il);
  assertEquals(r.scadenza!.prorogato, false);
});

Deno.test('scadenzaCrea: senza data manuale, prorogata se cade a hotel chiuso', () => {
  const anno = new Date().getFullYear() + 1;
  const sempre: Stagione[] = [{ chiusura: `${anno}-01-01`, riapertura: `${anno}-12-31` }];
  const r = scadenzaCrea(undefined, sempre);
  assertEquals(r.errore, undefined);
  assertEquals(r.scadenza!.prorogato, true);
  assertNotEquals(r.scadenza!.scade_il, r.scadenza!.scade_il_base);
});

/* ------------------------------------------------------------
   Validazione della data manuale: il difetto trovato in revisione.
   L'operatore ha un cliente davanti e digita l'anno sbagliato (2025 invece
   di 2026, il tipico errore nei primi mesi dell'anno): senza controllo il
   buono nasceva già scaduto, senza nessun avviso — lo si scopriva mesi
   dopo, coi contanti già in cassa. ------------------------------------ */

Deno.test('scadenzaCrea: una data manuale nel passato viene rifiutata', () => {
  const r = scadenzaCrea('2025-08-15', []);
  assertEquals(r.scadenza, undefined);
  assertNotEquals(r.errore, undefined);
});

Deno.test('scadenzaCrea: oggi stesso e accettato, non e nel passato', () => {
  const oggi = new Date().toISOString().slice(0, 10);
  const r = scadenzaCrea(oggi, []);
  assertEquals(r.errore, undefined);
  assertEquals(r.scadenza!.scade_il, oggi);
});

Deno.test('scadenzaCrea: una data che non esiste (31 novembre) viene rifiutata', () => {
  const r = scadenzaCrea('2026-11-31', []);
  assertEquals(r.scadenza, undefined);
  assertNotEquals(r.errore, undefined);
});

Deno.test('scadenzaCrea: input non una data (0, spazio) vengono rifiutati', () => {
  for (const spazzatura of ['0', ' ', 'non-una-data']) {
    const r = scadenzaCrea(spazzatura, []);
    assertEquals(r.scadenza, undefined, `input "${spazzatura}"`);
    assertNotEquals(r.errore, undefined, `input "${spazzatura}"`);
  }
});

Deno.test('scadenzaCrea: una data troppo lontana nel futuro (9999-12-31) viene rifiutata', () => {
  const r = scadenzaCrea('9999-12-31', []);
  assertEquals(r.scadenza, undefined);
  assertNotEquals(r.errore, undefined);
});

Deno.test('campi liberi accorciati e ripuliti', () => {
  const r = validaAcquisto({
    tipo: 'valore', valore: 100, acquirente_email: '  a@b.it  ',
    acquirente: 'x'.repeat(300), dedica: 'y'.repeat(500),
    destinatario: '  Anna  ', destinatario_email: 'z'.repeat(300) + '@c.it',
    condizioni_accettate: true, privacy_presa_atto: true
  });
  assertEquals(r.dati!.acquirente_email, 'a@b.it');
  assertEquals(r.dati!.acquirente.length, 120);
  assertEquals(r.dati!.dedica.length, 400);
  assertEquals(r.dati!.destinatario, 'Anna');
  assertEquals(r.dati!.destinatario_email.length, 160);
});

/* Le condizioni (chiusura stagionale, niente rimborso, 12 mesi) vanno
   accettate PRIMA di pagare: il controllo sta anche qui, non solo nel
   browser, altrimenti basterebbe una chiamata diretta per aggirarlo. */
Deno.test('senza accettazione delle condizioni l’acquisto non parte', () => {
  const r = validaAcquisto({ tipo: 'valore', valore: 100, acquirente_email: 'a@b.it' });
  assertEquals(r.errore, 'condizioni non accettate');
  const r2 = validaAcquisto({
    tipo: 'valore', valore: 100, acquirente_email: 'a@b.it', condizioni_accettate: 'sì'
  });
  assertEquals(r2.errore, 'condizioni non accettate');
});

Deno.test('con le condizioni accettate l’acquisto procede', () => {
  const r = validaAcquisto({
    tipo: 'valore', valore: 100, acquirente_email: 'a@b.it', condizioni_accettate: true, privacy_presa_atto: true
  });
  assertEquals(r.errore, undefined);
  assertEquals(r.dati!.valore, 100);
});

/* Il listino si verifica qui e non contro la produzione: una chiamata
   valida a ?a=acquista crea un buono vero e un link di pagamento vero. */
Deno.test('il Day Spa serale sostituisce il pomeridiano, che non esiste', () => {
  const r = validaAcquisto({
    tipo: 'servizio', voce_id: 'dayspa_sera',
    acquirente_email: 'a@b.it', condizioni_accettate: true, privacy_presa_atto: true
  });
  assertEquals(r.errore, undefined);
  assertEquals(r.dati!.valore, 29);
  assertMatch(r.dati!.descrizione, /serale.*venerdì e sabato.*18\.00–22\.30/);
});

Deno.test('il vecchio identificativo porta comunque al prodotto vero', () => {
  const vecchio = validaAcquisto({
    tipo: 'servizio', voce_id: 'dayspa_pom',
    acquirente_email: 'a@b.it', condizioni_accettate: true, privacy_presa_atto: true
  });
  const nuovo = validaAcquisto({
    tipo: 'servizio', voce_id: 'dayspa_sera',
    acquirente_email: 'a@b.it', condizioni_accettate: true, privacy_presa_atto: true
  });
  assertEquals(vecchio.errore, undefined);
  assertEquals(vecchio.dati!.descrizione, nuovo.dati!.descrizione);
  assertEquals(vecchio.dati!.valore, 29);
});

Deno.test('giornaliero e festivo portano giorni e orari sul buono', () => {
  const fer = validaAcquisto({ tipo:'servizio', voce_id:'dayspa_fer', acquirente_email:'a@b.it', condizioni_accettate:true, privacy_presa_atto:true });
  const fes = validaAcquisto({ tipo:'servizio', voce_id:'dayspa_wknd', acquirente_email:'a@b.it', condizioni_accettate:true, privacy_presa_atto:true });
  assertEquals(fer.dati!.valore, 35);
  assertMatch(fer.dati!.descrizione, /luned.*vener.*9\.00–18\.30/);
  assertEquals(fes.dati!.valore, 45);
  assertMatch(fes.dati!.descrizione, /sabato, domenica e festivi.*9\.00–18\.30/);
});


/* La privacy e' un consenso distinto da quello sulle condizioni: le
   condizioni si accettano, dell'informativa si prende atto. Tenerli in un
   campo solo li renderebbe indistinguibili se qualcuno chiedesse conto di
   quale dei due e' stato dato. */
Deno.test('senza presa d atto della privacy non si compra', () => {
  const r = validaAcquisto({
    tipo: 'valore', valore: 100, acquirente_email: 'a@b.it',
    condizioni_accettate: true, privacy_presa_atto: false,
  });
  assertEquals(r.errore, 'informativa privacy non accettata');
});

Deno.test('le condizioni da sole non bastano: sono due consensi', () => {
  const r = validaAcquisto({
    tipo: 'valore', valore: 100, acquirente_email: 'a@b.it',
    condizioni_accettate: true,
  });
  assertEquals(r.errore, 'informativa privacy non accettata');
});

/* ============================================================
   Voci multiple con quantita': fino a due voci diverse, quantita'
   da 1 a 4, prezzo sempre somma secca del listino server.
   ============================================================ */

const base = {
  tipo: 'servizio', lingua: 'it', destinatario: 'Anna',
  acquirente: 'Mario', acquirente_email: 'mario@email.it',
  condizioni_accettate: true, privacy_presa_atto: true,
};

Deno.test('due voci con quantita fanno la somma secca del listino', () => {
  const { errore, dati } = validaAcquisto({ ...base, voci: [
    { voce_id: 'dayspa_wknd', quantita: 4 },
    { voce_id: 'antistress45', quantita: 4 },
  ]});
  assertEquals(errore, undefined);
  const atteso = LISTINO['dayspa_wknd'][1] * 4 + LISTINO['antistress45'][1] * 4;
  assertEquals(dati!.valore, atteso);
  assertEquals(dati!.voci.length, 2);
});

/* ============================================================
   Il Day Spa serale (venerdi' e sabato, 18.00-22.30) non si abbina a un
   trattamento: a quell'ora il centro benessere non fa trattamenti, e un
   buono "serale + massaggio" sarebbe un buono che il cliente non potrebbe
   usare come gli e' stato venduto. Resta libero di combinarsi con un altro
   ingresso Day Spa (compreso un secondo serale): sono ingressi, non
   trattamenti che pretendono il centro aperto.
   ============================================================ */

const ERRORE_SERALE =
  'il Day Spa serale non si può abbinare a un trattamento: di sera il centro non fa trattamenti — scelga il Day Spa infrasettimanale o festivo';

Deno.test('serale + trattamento viene rifiutato', () => {
  const r = validaAcquisto({ ...base, voci: [
    { voce_id: 'dayspa_sera', quantita: 1 },
    { voce_id: 'antistress45', quantita: 1 },
  ]});
  assertEquals(r.errore, ERRORE_SERALE);
});

Deno.test('trattamento + serale, ordine inverso, viene rifiutato ugualmente', () => {
  const r = validaAcquisto({ ...base, voci: [
    { voce_id: 'antistress45', quantita: 1 },
    { voce_id: 'dayspa_sera', quantita: 1 },
  ]});
  assertEquals(r.errore, ERRORE_SERALE);
});

Deno.test('il vecchio identificativo dayspa_pom conta come serale: rifiutato insieme a un trattamento', () => {
  const r = validaAcquisto({ ...base, voci: [
    { voce_id: 'relax25', quantita: 1 },
    { voce_id: 'dayspa_pom', quantita: 1 },
  ]});
  assertEquals(r.errore, ERRORE_SERALE);
});

Deno.test('serale da solo viene accettato', () => {
  const r = validaAcquisto({ ...base, voce_id: 'dayspa_sera' });
  assertEquals(r.errore, undefined);
});

Deno.test('serale a quantita 4 viene accettato', () => {
  const r = validaAcquisto({ ...base, voci: [{ voce_id: 'dayspa_sera', quantita: 4 }] });
  assertEquals(r.errore, undefined);
  assertEquals(r.dati!.valore, LISTINO.dayspa_sera[1] * 4);
});

Deno.test('festivo + trattamento resta permesso', () => {
  const r = validaAcquisto({ ...base, voci: [
    { voce_id: 'dayspa_wknd', quantita: 1 },
    { voce_id: 'antistress45', quantita: 1 },
  ]});
  assertEquals(r.errore, undefined);
});

Deno.test('infrasettimanale + trattamento resta permesso', () => {
  const r = validaAcquisto({ ...base, voci: [
    { voce_id: 'dayspa_fer', quantita: 1 },
    { voce_id: 'antistress45', quantita: 1 },
  ]});
  assertEquals(r.errore, undefined);
});

Deno.test('due trattamenti insieme restano permessi', () => {
  const r = validaAcquisto({ ...base, voci: [
    { voce_id: 'relax25', quantita: 1 },
    { voce_id: 'antistress45', quantita: 1 },
  ]});
  assertEquals(r.errore, undefined);
});

Deno.test('festivo + serale, due ingressi Day Spa insieme, resta permesso', () => {
  const r = validaAcquisto({ ...base, voci: [
    { voce_id: 'dayspa_wknd', quantita: 1 },
    { voce_id: 'dayspa_sera', quantita: 1 },
  ]});
  assertEquals(r.errore, undefined);
});

/* ============================================================
   componiDescrizione — la regola nuova chiesta dalla proprietà: quando le
   voci sono più di una il numero si scrive su tutte, anche dove vale uno.
   Con una voce sola resta come prima: "1 × Massaggio" non si scrive, è il
   modo in cui un modulo dice a un essere umano che l'ha compilato una
   macchina. Vive anche in riepilogoVoci (pagine/buoni/buono.js), presidiato
   da buono.test.ts perché il confronto è con questa funzione vera, non con
   una copia scritta a mano.
   ============================================================ */

Deno.test('componiDescrizione: una voce sola a quantita 1 non porta il numero', () => {
  assertEquals(componiDescrizione([{ voce_id: 'relax25', quantita: 1 }]), LISTINO.relax25[0]);
});

Deno.test('componiDescrizione: una voce sola a quantita sopra 1 porta il numero', () => {
  assertEquals(componiDescrizione([{ voce_id: 'relax25', quantita: 3 }]), `3 × ${LISTINO.relax25[0]}`);
});

Deno.test('componiDescrizione: con due voci il numero si scrive su entrambe, anche a quantita 1', () => {
  const r = componiDescrizione([
    { voce_id: 'dayspa_wknd', quantita: 2 },
    { voce_id: 'antistress45', quantita: 1 },
  ]);
  assertEquals(r, `2 × ${LISTINO.dayspa_wknd[0]}\n1 × ${LISTINO.antistress45[0]}`);
});

/* lo stesso controllo passando da validaAcquisto: e' li' che il server
   esegue davvero, sulle voci grezze cosi' come le manderebbe la pagina */
Deno.test('validaAcquisto: due voci di cui una a quantita 1 mostrano il numero su entrambe sul buono vero', () => {
  const { errore, dati } = validaAcquisto({ ...base, voci: [
    { voce_id: 'dayspa_wknd', quantita: 2 },
    { voce_id: 'antistress45', quantita: 1 },
  ]});
  assertEquals(errore, undefined);
  assertEquals(dati!.descrizione, `2 × ${LISTINO.dayspa_wknd[0]}\n1 × ${LISTINO.antistress45[0]}`);
});

Deno.test('validaAcquisto: una voce sola a quantita 1 non mostra il numero, come oggi', () => {
  const { errore, dati } = validaAcquisto({ ...base, voce_id: 'dayspa_wknd' });
  assertEquals(errore, undefined);
  assertEquals(dati!.descrizione, LISTINO.dayspa_wknd[0]);
});

/* il prezzo arriva dal cliente e non fa testo: vale il listino del server */
Deno.test('un prezzo mandato dal cliente viene ignorato', () => {
  const { dati } = validaAcquisto({ ...base, valore: 1,
    voci: [{ voce_id: 'dayspa_wknd', quantita: 1 }] });
  assertEquals(dati!.valore, LISTINO['dayspa_wknd'][1]);
});

Deno.test('una voce sola senza quantita continua a funzionare come prima', () => {
  const { errore, dati } = validaAcquisto({ ...base, voce_id: 'dayspa_wknd' });
  assertEquals(errore, undefined);
  assertEquals(dati!.valore, LISTINO['dayspa_wknd'][1]);
  assertEquals(dati!.voci.length, 1);
  assertEquals(dati!.voci[0].quantita, 1);
});

Deno.test('tre voci vengono rifiutate', () => {
  assertEquals(validaAcquisto({ ...base, voci: [
    { voce_id: 'dayspa_wknd', quantita: 1 },
    { voce_id: 'antistress45', quantita: 1 },
    { voce_id: 'relax25', quantita: 1 },
  ]}).errore, 'al massimo due voci');
});

/* chi sceglie due volte la stessa voce sta dicendo una quantita', non due
   voci: si sommano, altrimenti il tetto di quattro si aggira scegliendo la
   stessa voce due volte */
Deno.test('la stessa voce due volte si somma in una riga', () => {
  const { errore, dati } = validaAcquisto({ ...base, voci: [
    { voce_id: 'relax25', quantita: 2 },
    { voce_id: 'relax25', quantita: 2 },
  ]});
  assertEquals(errore, undefined);
  assertEquals(dati!.voci.length, 1);
  assertEquals(dati!.voci[0].quantita, 4);
  assertEquals(dati!.valore, LISTINO['relax25'][1] * 4);
});

Deno.test('la stessa voce due volte non aggira il tetto di quattro', () => {
  assertEquals(validaAcquisto({ ...base, voci: [
    { voce_id: 'relax25', quantita: 3 },
    { voce_id: 'relax25', quantita: 3 },
  ]}).errore, 'quantita fuori dai limiti (1-4)');
});

Deno.test('quantita fuori dai limiti o non intere vengono rifiutate', () => {
  for (const q of [0, -1, 5, 2.5, NaN]) {
    assertEquals(validaAcquisto({ ...base,
      voci: [{ voce_id: 'relax25', quantita: q }] }).errore,
      'quantita fuori dai limiti (1-4)', `quantita ${q}`);
  }
});

Deno.test('una quantita scritta come testo viene letta, non rifiutata a caso', () => {
  const { errore, dati } = validaAcquisto({ ...base,
    voci: [{ voce_id: 'relax25', quantita: '3' }] });
  assertEquals(errore, undefined);
  assertEquals(dati!.voci[0].quantita, 3);
});

Deno.test('una voce inesistente viene rifiutata', () => {
  assertEquals(validaAcquisto({ ...base,
    voci: [{ voce_id: 'inventata', quantita: 1 }] }).errore, 'voce di listino sconosciuta');
});

Deno.test('un elenco vuoto viene rifiutato', () => {
  assertEquals(validaAcquisto({ ...base, voci: [] }).errore, 'voce di listino sconosciuta');
});

/* 'toString', 'constructor', '__proto__', 'hasOwnProperty' e 'valueOf'
   esistono su LISTINO per ereditarieta' da Object.prototype, non come voci
   di listino: un accesso diretto LISTINO[id] le troverebbe truthy (una
   funzione, o per '__proto__' l'oggetto prototipo stesso) e lascerebbe
   passare una voce fasulla fino al calcolo del prezzo, con NaN al posto di
   un rifiuto — esattamente il precedente di condizioni.ts con la lingua.
   L'elenco e' quello intero, non un campione: il test gemello in
   richieste/condizioni.test.ts prova 'hasOwnProperty', qui mancava, e una
   guardia che copre tre nomi su cinque lascia aperta la domanda su cosa
   succeda con gli altri due. Costano una riga e la chiudono per sempre. */
Deno.test('le proprieta ereditate da Object.prototype non sono voci di listino', () => {
  for (const finta of ['toString', 'constructor', '__proto__', 'hasOwnProperty', 'valueOf']) {
    const r = validaAcquisto({ ...base, voci: [{ voce_id: finta, quantita: 1 }] });
    assertEquals(r.errore, 'voce di listino sconosciuta', finta);
  }
});

/* il buono monetario non deve cambiare in niente */
Deno.test('il buono monetario resta com era', () => {
  const { errore, dati } = validaAcquisto({ ...base, tipo: 'valore', valore: 100 });
  assertEquals(errore, undefined);
  assertEquals(dati!.valore, 100);
  assertEquals(dati!.voci.length, 0);
});

/* ============================================================
   colonnaVoci: cosa finisce nella colonna jsonb al salvataggio.
   null e [] sono due cose diverse per chi legge i dati (il back
   office le distingue): un buono monetario non ha scelto niente
   da un elenco, quindi la colonna resta null, non un array vuoto.
   ============================================================ */

Deno.test('colonnaVoci: un elenco vuoto (buono monetario) diventa null', () => {
  assertEquals(colonnaVoci([]), null);
});

Deno.test('colonnaVoci: le voci scelte passano invariate', () => {
  const voci = [{ voce_id: 'dayspa_wknd', quantita: 4 }, { voce_id: 'antistress45', quantita: 4 }];
  assertEquals(colonnaVoci(voci), voci);
});

Deno.test('colonnaVoci: una voce sola passa invariata', () => {
  const voci = [{ voce_id: 'relax25', quantita: 1 }];
  assertEquals(colonnaVoci(voci), voci);
});

/* ============================================================
   Integrazione con fattura.ts: validaAcquisto chiama validaFattura e
   ne propaga sia l'errore sia i dati validati. La validazione dei
   singoli campi è già provata per intero in fattura.test.ts — qui si
   prova solo che il collegamento c'è davvero, in entrambi i sensi.
   ============================================================ */

Deno.test('senza spunta fattura, acquisto normale: fattura torna con fatt_richiesta false', () => {
  const r = validaAcquisto({ ...ACQUISTO_VALIDO });
  assertEquals(r.errore, undefined);
  assertEquals(r.dati!.fattura.fatt_richiesta, false);
  assertEquals(r.dati!.fattura.fatt_intestatario, null);
});

/* prova che validaAcquisto usa DAVVERO validaFattura per rifiutare, non
   solo per arricchire i dati: un dato fattura mancante blocca l'intero
   acquisto, esattamente come un'email non valida lo blocca più sopra.
   Cosa lo farebbe fallire: rimuovere la chiamata a validaFattura (o il
   suo controllo dell'errore) da validaAcquisto */
Deno.test('con la fattura richiesta, un dato mancante blocca tutto l acquisto', () => {
  const r = validaAcquisto({
    ...ACQUISTO_VALIDO,
    fatt_richiesta: true, fatt_intestatario: 'azienda',
    // manca la partita IVA
    fatt_denominazione: 'Tria S.r.l.', fatt_indirizzo: 'Via Roma', fatt_cap: '35037',
    fatt_comune: 'Abano Terme', fatt_provincia: 'PD', fatt_sdi: 'ABC1234',
  });
  assertEquals(r.dati, undefined);
  assertEquals(typeof r.errore, 'string');
});

Deno.test('con la fattura richiesta e i dati completi, l acquisto procede e porta i dati fattura', () => {
  const r = validaAcquisto({
    ...ACQUISTO_VALIDO,
    fatt_richiesta: true, fatt_intestatario: 'azienda',
    fatt_denominazione: 'Tria S.r.l.', fatt_piva: '02042330288',
    fatt_indirizzo: 'Via Roma', fatt_cap: '35037',
    fatt_comune: 'Abano Terme', fatt_provincia: 'PD', fatt_sdi: 'ABC1234',
  });
  assertEquals(r.errore, undefined);
  assertEquals(r.dati!.fattura.fatt_richiesta, true);
  assertEquals(r.dati!.fattura.fatt_intestatario, 'azienda');
  assertEquals(r.dati!.fattura.fatt_denominazione, 'Tria S.r.l.');
  assertEquals(r.dati!.fattura.fatt_piva, '02042330288');
});

/* il buono monetario con richiesta fattura resta accettato dalla
   validazione: l'acquisto procede (nessun XML si genera qui — quella
   regola vive in un'altra fase, non ancora costruita), coerente con la
   riga "Buono monetario con richiesta fattura" della tabella Errori
   nella specifica */
Deno.test('un buono valore con fattura richiesta viene comunque accettato', () => {
  const r = validaAcquisto({
    ...ACQUISTO_VALIDO, tipo: 'valore', valore: 100,
    fatt_richiesta: true, fatt_intestatario: 'privato',
    fatt_cf: 'RSSMRA85M01H501Z', fatt_indirizzo: 'Via Roma', fatt_cap: '35037',
    fatt_comune: 'Abano Terme', fatt_provincia: 'PD',
  });
  assertEquals(r.errore, undefined);
  assertEquals(r.dati!.fattura.fatt_richiesta, true);
  assertEquals(r.dati!.fattura.fatt_sdi, '0000000');
});
