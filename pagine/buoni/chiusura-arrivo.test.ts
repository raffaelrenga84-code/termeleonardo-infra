/* ============================================================
   chiusura-arrivo.test.ts — la chiave della chiusura esiste davvero, e ce
   l'ha il back office.

   IL DIFETTO CHE PRESIDIA. puoChiudere() (supabase/functions/richieste/
   arrivi.ts) rifiuta di portare a «chiusa» una richiesta d'arrivo con
   persone da aggiungere finche' nessuno ha risposto, e il segno che
   qualcuno ha risposto e' `persone_confermate`. I due inserimenti pubblici
   lo forzano a FALSO apposta — e' la porta dell'ospite — quindi l'unica via
   per metterlo a vero e' ?a=conferma, che accetta soltanto i dati che gli
   manda il back office.

   Il back office non gliene mandava. `campiModificabili` non aveva un ramo
   per `arrivo` e restituiva stringa vuota; `datiCorretti` restituiva
   `undefined`. Risultato: la famiglia Rossi scrive «si aggiunge nostra
   figlia Elena», la reception apre la richiesta, preme Chiudi e legge «ci
   sono persone da aggiungere in attesa di risposta»; preme «Conferma e
   avvisa l'ospite» scrivendo il prezzo, ripreme Chiudi e rilegge lo stesso
   rifiuto. Per sempre. L'unica via d'uscita era una query a mano.

   PERCHE' NON BASTAVA LA PROVA CHE C'ERA. arrivi.test.ts dimostra che
   puoChiudere ACCETTA persone_confermate a vero. Non dimostra che qualcuno
   possa produrlo — ed era esattamente quello che mancava. Questa prova
   percorre la strada intera: la compilazione dell'ospite, il rifiuto, il
   modulo che il back office disegna, quello che quel modulo manda a
   ?a=conferma, la rivalidazione di tipi.ts, e la chiusura che finalmente
   passa.

   COME SI ESEGUE UNA PAGINA SENZA BROWSER. Le tre funzioni si ritagliano
   dal sorgente e si eseguono con un `$` finto e un `esc` finto — nessun
   DOM, nessuna finestra. E' l'unico modo di provare il COMPORTAMENTO
   invece della presenza di una parola nel file: una prova che cercasse
   «case 'arrivo'» resterebbe verde davanti a un ramo che restituisce la
   casella sbagliata.
   ============================================================ */
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert';
import { puoChiudere } from '../../supabase/functions/richieste/arrivi.ts';
import { validaDati } from '../../supabase/functions/richieste/tipi.ts';
import { pezziDaArrivo } from '../../supabase/functions/richieste/arrivo-invio.ts';

const SORGENTE = Deno.readTextFileSync(new URL('index.html', import.meta.url));

/** Il testo di una `function nome(...) { ... }`, graffe bilanciate. */
function fonteDi(nome: string): string {
  const inizio = SORGENTE.indexOf(`function ${nome}(`);
  assert(inizio >= 0, `function ${nome}() non si trova in pagine/buoni/index.html: ` +
    'la pagina e cambiata, aggiornare questa prova');
  const apre = SORGENTE.indexOf('{', inizio);
  let livello = 0;
  for (let i = apre; i < SORGENTE.length; i++) {
    if (SORGENTE[i] === '{') livello++;
    else if (SORGENTE[i] === '}') {
      livello--;
      if (livello === 0) return SORGENTE.slice(inizio, i + 1);
    }
  }
  throw new Error(`function ${nome}() non si chiude: sorgente troncato?`);
}

const NOMI = [
  'nomeAttenzione', 'nomeFanghi', 'elencoPersoneArrivo',
  'righeCheckIn', 'campiArrivo', 'campiModificabili', 'datiCorretti',
];

type Modulo = {
  campiModificabili: (r: Record<string, unknown>) => string;
  datiCorretti: (r: Record<string, unknown>) => Record<string, unknown> | undefined;
  righeCheckIn: (
    r: Record<string, unknown>,
    riga: (e: string, v: string) => string,
  ) => string;
};

/** Le funzioni della pagina, vive, con un `$` che pesca da `caselle`. */
function moduloBackOffice(caselle: Record<string, { checked: boolean }>): Modulo {
  /* Le funzioni non bastano: `nomeFanghi` legge DESIDERIO_IN_PAGINA, che
     e' una costante e non una funzione, ed e' l'unica tabella delle tre
     fasce da quando le due copie sono state unificate. Senza, qui dentro
     verrebbe «DESIDERIO_IN_PAGINA is not defined»: la prova fallirebbe per
     una dipendenza mancante invece che per un difetto. */
  const tabella = SORGENTE.match(/const DESIDERIO_IN_PAGINA = \{[^}]*\};/);
  assert(tabella, 'DESIDERIO_IN_PAGINA non si trova: la pagina e cambiata');
  const fonti = [tabella![0], ...NOMI.map(fonteDi)].join('\n\n');
  const esc = (s: unknown) => String(s ?? '')
    .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
  const dollaro = (id: string) => Object.hasOwn(caselle, id) ? caselle[id] : null;
  /* la nota «aveva chiesto» ha una prova sua altrove: qui non deve
     sporcare quello che si guarda */
  const avevaChiesto = () => '';
  const fabbrica = new Function(
    'esc', '$', 'avevaChiesto',
    `${fonti}\nreturn { campiModificabili, datiCorretti, righeCheckIn };`,
  );
  return fabbrica(esc, dollaro, avevaChiesto) as Modulo;
}

const CON_PERSONE = {
  numero: 'C26/19130', tipo: 'arrivo',
  dati: {
    ora_arrivo: 'Tra le 15:00 e le 18:00', mezzo: 'Auto',
    attenzioni: ['culla'], fanghi_desiderio: 'presto',
    persone_extra: [{ nome: 'Rossi Elena', eta: '12' }],
    persone_confermate: false,
    note: 'Siamo intolleranti al lattosio.',
  },
};

/* ---------- il modulo che la reception vede ---------- */

Deno.test('un arrivo con persone da aggiungere offre la casella che sblocca la chiusura', () => {
  const m = moduloBackOffice({});
  const html = m.campiModificabili(CON_PERSONE);
  assertStringIncludes(html, 'id="cPersoneOk"');
  assertStringIncludes(html, 'type="checkbox"');
});

Deno.test('la casella nasce spuntata solo se qualcuno aveva gia risposto', () => {
  const m = moduloBackOffice({});
  assert(!m.campiModificabili(CON_PERSONE).includes('checked'),
    'la casella nasce spuntata: la reception confermerebbe senza accorgersene');
  const gia = { ...CON_PERSONE, dati: { ...CON_PERSONE.dati, persone_confermate: true } };
  assertStringIncludes(m.campiModificabili(gia), 'checked');
});

/* Senza persone da aggiungere la chiusura non e' bloccata: una spunta che
   non sblocca niente si legge come un adempimento da fare sempre. */
Deno.test('un arrivo senza persone da aggiungere non offre nessuna casella', () => {
  const m = moduloBackOffice({});
  assertEquals(m.campiModificabili({ tipo: 'arrivo', dati: { ora_arrivo: '16:30' } }), '');
  assertEquals(m.campiModificabili({ tipo: 'arrivo', dati: { persone_extra: [] } }), '');
});

/* ---------- quello che quel modulo manda a ?a=conferma ---------- */

Deno.test('spuntando la casella, il back office manda persone_confermate a vero', () => {
  const m = moduloBackOffice({ cPersoneOk: { checked: true } });
  const dati = m.datiCorretti(CON_PERSONE)!;
  assert(dati, 'datiCorretti non manda niente per un arrivo: ?a=conferma terrebbe i dati vecchi');
  assertEquals(dati.persone_confermate, true);
  /* e non perde per strada quello che l'ospite aveva scritto */
  assertEquals(dati.ora_arrivo, 'Tra le 15:00 e le 18:00');
  assertEquals(dati.note, 'Siamo intolleranti al lattosio.');
});

Deno.test('senza spuntarla resta falso, e la richiesta resta giustamente bloccata', () => {
  const m = moduloBackOffice({ cPersoneOk: { checked: false } });
  assertEquals(m.datiCorretti(CON_PERSONE)!.persone_confermate, false);
});

/* La casella non c'e' quando non ci sono persone da aggiungere: leggere
   `false` da un campo assente riscriverebbe a falso una conferma gia' data
   — il modo silenzioso di richiudere fuori la reception. */
Deno.test('dove la casella non esiste, il valore che c era non viene sovrascritto', () => {
  const m = moduloBackOffice({});
  const gia = { tipo: 'arrivo', dati: { ora_arrivo: '16:30', persone_confermate: true } };
  assertEquals(m.datiCorretti(gia)!.persone_confermate, true);
});

/* ---------- la strada intera ---------- */

Deno.test('dalla compilazione dell ospite alla chiusura: la porta si apre davvero', () => {
  /* 1. l'ospite compila il check-in e aggiunge sua figlia */
  const pezzi = pezziDaArrivo({
    ora_arrivo: 'Tra le 15:00 e le 18:00', mezzo: 'Auto',
    persone_extra: [{ nome: 'Rossi Elena', eta: '12' }],
    /* anche mandandolo a vero dal browser: la porta pubblica lo forza a falso */
    persone_confermate: true,
  }, new Date('2026-09-01T12:00:00Z')).pezzi!;
  const arrivo = pezzi.find((p) => p.tipo === 'arrivo')!;
  assertEquals(arrivo.dati.persone_confermate, false);

  /* 2. la reception preme Chiudi e viene respinta */
  const primo = puoChiudere({ tipo: 'arrivo', dati: arrivo.dati });
  assertEquals(primo.ok, false);
  assert(primo.perche && primo.perche.includes('persone da aggiungere'));

  /* 3. apre il pannello, spunta la casella e conferma */
  const m = moduloBackOffice({ cPersoneOk: { checked: true } });
  const mandati = m.datiCorretti({ tipo: 'arrivo', dati: arrivo.dati })!;

  /* 4. ?a=conferma rivalida con lo stesso validatore dell'ospite: se
        validaArrivo non conservasse il campo, il lavoro sparirebbe qui */
  const v = validaDati('arrivo', mandati);
  assert(!v.errore, v.errore);
  assertEquals(v.dati!.persone_confermate, true);

  /* 5. e adesso Chiudi passa */
  assertEquals(puoChiudere({ tipo: 'arrivo', dati: v.dati! }).ok, true);
});

/* ---------- quello che la reception deve poter LEGGERE ---------- */

/* Messo insieme al blocco della chiusura: non si puo' chiedere alla
   reception di rispondere su un contenuto che nessuna schermata le mostra.
   Le note e i nomi vivevano solo nell'email arrivata a info@. */
const riga = (e: string, v: string) => v ? `[${e}] ${v}\n` : '';

Deno.test('la scheda di un arrivo mostra le persone da aggiungere e le note dell ospite', () => {
  const testo = moduloBackOffice({}).righeCheckIn(CON_PERSONE, riga);
  assertStringIncludes(testo, 'Rossi Elena (12)');
  assertStringIncludes(testo, 'in attesa di risposta');
  assertStringIncludes(testo, 'Siamo intolleranti al lattosio.');
  assertStringIncludes(testo, 'Tra le 15:00 e le 18:00');
  /* le chiavi tornano parole: in back office non si legge «culla» come
     l'ha scritta la pagina tedesca */
  assertStringIncludes(testo, 'culla');
  assertStringIncludes(testo, 'presto — dalle 5:50');
  assert(!testo.includes('undefined'), 'un campo assente arriva a schermo come undefined');
});

Deno.test('quando qualcuno ha risposto, la scheda lo dice', () => {
  const gia = { ...CON_PERSONE, dati: { ...CON_PERSONE.dati, persone_confermate: true } };
  const testo = moduloBackOffice({}).righeCheckIn(gia, riga);
  assertStringIncludes(testo, 'confermate');
  assert(!testo.includes('in attesa di risposta'));
});

/* L'amministrazione fattura da questa schermata: indirizzo, codice fiscale,
   SDI e PEC stavano solo nell'email in copia. */
Deno.test('la scheda di una fattura porta tutto quello che serve per emetterla', () => {
  const testo = moduloBackOffice({}).righeCheckIn({
    tipo: 'fattura',
    dati: {
      ragione: 'Bianchi S.r.l.', indirizzo: 'Via Roma 1, Padova',
      piva: 'IT02042330288', cf: 'BNCMRA80A01G224X', sdi: 'M5UXCR1', pec: 'bianchi@pec.it',
    },
  }, riga);
  for (const atteso of ['Bianchi S.r.l.', 'Via Roma 1, Padova', 'IT02042330288',
    'BNCMRA80A01G224X', 'M5UXCR1', 'bianchi@pec.it']) {
    assertStringIncludes(testo, atteso);
  }
  assert(!testo.includes('undefined'));
});

/* Un campo che non c'e' non deve lasciare una riga a meta' ne' un
   «undefined»: le richieste vecchie hanno buchi, ed e' il caso normale. */
Deno.test('i campi assenti spariscono, non compaiono come undefined', () => {
  const m = moduloBackOffice({});
  for (const r of [
    { tipo: 'arrivo', dati: {} },
    { tipo: 'arrivo', dati: null },
    { tipo: 'fattura', dati: {} },
    { tipo: 'arrivo', dati: { attenzioni: ['monopattino'], fanghi_desiderio: 'alba' } },
  ]) {
    const testo = m.righeCheckIn(r as Record<string, unknown>, riga);
    assert(!testo.includes('undefined'), `${JSON.stringify(r)} produce un undefined a schermo`);
    assert(!testo.includes('monopattino'), 'una chiave sconosciuta arriva a schermo cosi com e');
    /* e nemmeno una riga vuota: `<strong></strong>` e' una stringa non
       vuota, e riga() la disegnerebbe come una riga senza contenuto */
    assertEquals(testo, '', `${JSON.stringify(r)} disegna righe senza niente dentro: «${testo}»`);
  }
});

/* Gli altri tipi non devono ereditare queste righe: un transfer non ha
   persone da aggiungere, e una riga vuota fa sembrare la scheda rotta. */
Deno.test('gli altri tipi non ricevono le righe del check-in', () => {
  const m = moduloBackOffice({});
  assertEquals(m.righeCheckIn({ tipo: 'transfer', dati: { luogo: 'Padova FS' } }, riga), '');
  assertEquals(m.righeCheckIn({ tipo: 'soggiorno', dati: {} }, riga), '');
});

/* ---------- e le funzioni sono davvero appese alla scheda ---------- */

/* Le prove qui sopra chiamano le funzioni direttamente: restano tutte
   verdi anche se nessuno le chiama dalla pagina. E' lo stesso buco gia'
   visto sullo stato «gia inviato» del check-in, dove le etichette
   esistevano e il ramo che le mostrava era stato cancellato. */
Deno.test('la scheda di dettaglio chiama davvero le righe del check-in', () => {
  const i = SORGENTE.indexOf('function dettaglioRichiesta(');
  assert(i > 0, 'dettaglioRichiesta() non si trova');
  assert(fonteDi('dettaglioRichiesta').includes('righeCheckIn(r, riga)'),
    'la scheda di dettaglio non disegna piu le righe del check-in: ' +
    'note e persone da aggiungere tornerebbero invisibili');
});

Deno.test('il pannello di conferma offre davvero i campi di un arrivo', () => {
  const fonte = fonteDi('campiModificabili');
  assert(/case\s*'arrivo'\s*:\s*return campiArrivo\(r\)/.test(fonte),
    'campiModificabili non ha piu un ramo per arrivo: la casella non compare');
});
