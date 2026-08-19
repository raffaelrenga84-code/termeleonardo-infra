/* Test della validazione per tipo di richiesta.
   La data di riferimento arriva da fuori: legata a new Date() questi test
   comincerebbero a fallire da soli col passare del tempo. */
import { assert, assertEquals, assertNotEquals } from 'jsr:@std/assert';
import { TIPI_ATTIVI, validaDati } from './tipi.ts';
import { CAMERE } from './camere.ts';

const OGGI = new Date('2026-08-13T10:00:00Z');

const transfer = {
  quando: '2026-09-10',
  ora: '14:30',
  pax: 2,
  verso: 'arrivo',
  luogo: 'Venezia  aeroporto',
  volo: 'FR1234',
  ritorno: true,
  note: 'Due valigie grandi.',
};

Deno.test('un tipo sconosciuto viene rifiutato, non salvato per sicurezza', () => {
  assertEquals(validaDati('scommesse', {}, OGGI).errore, 'tipo di richiesta sconosciuto');
  assertEquals(validaDati('', {}, OGGI).errore, 'tipo di richiesta sconosciuto');
});

Deno.test('un transfer completo passa e arriva ripulito', () => {
  const { errore, dati } = validaDati('transfer', transfer, OGGI);
  assertEquals(errore, undefined);
  assertEquals(dati!.pax, 2);
  assertEquals(dati!.verso, 'arrivo');
  assertEquals(dati!.luogo, 'Venezia  aeroporto');
  assertEquals(dati!.ritorno, true);
});

/* Il valore finisce ricopiato nel modulo ATAM: se non combacia con il loro
   elenco, la reception deve cercarlo a mano fra 189 voci. */
Deno.test('il luogo deve esistere nell elenco ATAM, testualmente', () => {
  assertEquals(validaDati('transfer', { ...transfer, luogo: 'Venezia aeroporto' }, OGGI).errore,
    'luogo non in elenco');
  assertEquals(validaDati('transfer', { ...transfer, luogo: 'Marte' }, OGGI).errore,
    'luogo non in elenco');
  assertEquals(validaDati('transfer', { ...transfer, luogo: '' }, OGGI).errore,
    'luogo non in elenco');
  /* i tre circoli sono destinazioni valide: green fee e taxi sono la
     stessa richiesta */
  assertEquals(validaDati('transfer', { ...transfer, luogo: 'Golf Montecchia🏌' }, OGGI).errore,
    undefined);
});

Deno.test('la data del transfer deve avere senso', () => {
  assertEquals(validaDati('transfer', { ...transfer, quando: '' }, OGGI).errore, 'data mancante');
  assertEquals(validaDati('transfer', { ...transfer, quando: '2026-02-31' }, OGGI).errore,
    'data non valida');
  assertEquals(validaDati('transfer', { ...transfer, quando: '2026-08-12' }, OGGI).errore,
    'data nel passato');
  /* oggi stesso e' legittimo: chi atterra fra tre ore ha diritto di chiedere */
  assertEquals(validaDati('transfer', { ...transfer, quando: '2026-08-13' }, OGGI).errore,
    undefined);
  assertEquals(validaDati('transfer', { ...transfer, quando: '2029-08-13' }, OGGI).errore,
    'data troppo lontana');
});

Deno.test('l ora serve e deve essere un orario', () => {
  assertEquals(validaDati('transfer', { ...transfer, ora: '' }, OGGI).errore, 'ora mancante');
  assertEquals(validaDati('transfer', { ...transfer, ora: 'mattina' }, OGGI).errore, 'ora non valida');
  assertEquals(validaDati('transfer', { ...transfer, ora: '25:00' }, OGGI).errore, 'ora non valida');
  assertEquals(validaDati('transfer', { ...transfer, ora: '9:5' }, OGGI).errore, 'ora non valida');
  assertEquals(validaDati('transfer', { ...transfer, ora: '09:05' }, OGGI).errore, undefined);
});

Deno.test('i passeggeri stanno fra uno e otto', () => {
  assertEquals(validaDati('transfer', { ...transfer, pax: 0 }, OGGI).errore, 'passeggeri non validi');
  assertEquals(validaDati('transfer', { ...transfer, pax: 9 }, OGGI).errore, 'passeggeri non validi');
  assertEquals(validaDati('transfer', { ...transfer, pax: '3' }, OGGI).dati!.pax, 3);
});

Deno.test('arrivo o partenza, non altro', () => {
  assertEquals(validaDati('transfer', { ...transfer, verso: 'partenza' }, OGGI).errore, undefined);
  assertEquals(validaDati('transfer', { ...transfer, verso: 'forse' }, OGGI).errore,
    'indicare arrivo o partenza');
});

/* ---------------- green fee ---------------- */
const green = {
  circolo: 'montecchia', data: '2026-09-10', ora: '09:30', giocatori: 2,
  percorso: 'Rosso', golfcar: true, carrello: false, carrello_elettrico: false,
  sacca: true, tessera: 'FIG 12345', note: 'Prima volta qui.',
  taxi: true, taxi_ora: '08:45', taxi_ritorno: true,
};

Deno.test('un green fee completo passa', () => {
  const { errore, dati } = validaDati('greenfee', green, OGGI);
  assertEquals(errore, undefined);
  assertEquals(dati!.circolo, 'montecchia');
  assertEquals(dati!.giocatori, 2);
  assertEquals(dati!.golfcar, true);
  /* il luogo del taxi lo deduce il sistema dal circolo: chiederlo due volte
     sarebbe un modo per farli divergere */
  assertEquals(dati!.taxi_luogo, 'Golf Montecchia\u{1F3CC}');
});

Deno.test('il circolo deve essere uno dei tre convenzionati', () => {
  assertEquals(validaDati('greenfee', { ...green, circolo: 'augusta' }, OGGI).errore,
    'circolo sconosciuto');
  assertEquals(validaDati('greenfee', { ...green, circolo: '' }, OGGI).errore,
    'circolo sconosciuto');
  for (const c of ['padova', 'montecchia', 'frassanelle']) {
    assertEquals(validaDati('greenfee', { ...green, circolo: c }, OGGI).errore, undefined);
  }
});

/* Il valore di `circolo` arriva dal corpo della richiesta HTTP: chi manda i
   dati sceglie la stringa. Indicizzare CIRCOLI_GOLF con quella stringa e poi
   fidarsi di `if (!c)` come verifica di appartenenza non basta, perche' un
   oggetto non risponde `undefined` solo alle chiavi che non ha: risponde con
   quello che eredita da Object.prototype. `toString` e `constructor` sono
   funzioni, quindi truthy, e il controllo passa. Il risultato sarebbe una
   richiesta registrata e mandata per email alla reception con un circolo che
   non esiste e un luogo del taxi vuoto. */
Deno.test('una chiave ereditata da Object non e un circolo convenzionato', () => {
  for (const finto of ['toString', 'constructor', 'hasOwnProperty', 'valueOf',
    '__proto__', 'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString']) {
    assertEquals(validaDati('greenfee', { ...green, circolo: finto }, OGGI).errore,
      'circolo sconosciuto', `«${finto}» e' passato come circolo valido`);
  }
});

Deno.test('una partenza regge al massimo quattro giocatori', () => {
  assertEquals(validaDati('greenfee', { ...green, giocatori: 0 }, OGGI).errore, 'giocatori non validi');
  assertEquals(validaDati('greenfee', { ...green, giocatori: 5 }, OGGI).errore, 'giocatori non validi');
  assertEquals(validaDati('greenfee', { ...green, giocatori: 4 }, OGGI).errore, undefined);
});

Deno.test('chiedendo il taxi serve dire a che ora', () => {
  assertEquals(validaDati('greenfee', { ...green, taxi_ora: '' }, OGGI).errore, 'ora del taxi mancante');
  /* senza taxi l'ora non serve: non si blocca una richiesta per un campo
     che non c'entra */
  const senza = validaDati('greenfee', { ...green, taxi: false, taxi_ora: '' }, OGGI);
  assertEquals(senza.errore, undefined);
  assertEquals(senza.dati!.taxi_luogo, '');
});

/* ---------------- maestro ---------------- */
const lezione = { data: '2026-09-10', ora: '10:00', persone: 2, livello: 'principiante', note: '' };

Deno.test('una lezione col maestro passa', () => {
  const { errore, dati } = validaDati('maestro', lezione, OGGI);
  assertEquals(errore, undefined);
  assertEquals(dati!.persone, 2);
  assertEquals(dati!.livello, 'principiante');
});

Deno.test('il maestro segue al massimo quattro persone e un livello noto', () => {
  assertEquals(validaDati('maestro', { ...lezione, persone: 5 }, OGGI).errore, 'persone non valide');
  assertEquals(validaDati('maestro', { ...lezione, livello: 'campione' }, OGGI).errore,
    'livello sconosciuto');
  assertEquals(validaDati('maestro', { ...lezione, livello: '' }, OGGI).dati!.livello, 'non so');
});

/* ---------------- trattamenti ---------------- */
const spa = { voci: ['Massaggio antistress 50 min', 'Viso al fango termale'],
  giorno: '2026-09-11', fascia: 'pomeriggio', note: 'Preferirei tardi.' };

Deno.test('una richiesta di trattamenti passa', () => {
  const { errore, dati } = validaDati('trattamenti', spa, OGGI);
  assertEquals(errore, undefined);
  assertEquals((dati!.voci as string[]).length, 2);
  assertEquals(dati!.fascia, 'pomeriggio');
});

Deno.test('senza aver scelto niente non e una richiesta', () => {
  assertEquals(validaDati('trattamenti', { ...spa, voci: [] }, OGGI).errore, 'nessun trattamento scelto');
  assertEquals(validaDati('trattamenti', { ...spa, voci: 'massaggio' }, OGGI).errore,
    'nessun trattamento scelto');
});

Deno.test('non si prenotano venti trattamenti in un colpo', () => {
  const tanti = Array.from({ length: 9 }, (_, i) => 'Trattamento ' + i);
  assertEquals(validaDati('trattamenti', { ...spa, voci: tanti }, OGGI).errore,
    'troppi trattamenti in una richiesta');
});

Deno.test('la fascia sconosciuta diventa indifferente', () => {
  assertEquals(validaDati('trattamenti', { ...spa, fascia: 'alba' }, OGGI).dati!.fascia, 'indifferente');
  assertEquals(validaDati('trattamenti', { ...spa, fascia: '' }, OGGI).dati!.fascia, 'indifferente');
});

Deno.test('volo e note sono facoltativi ma non sconfinati', () => {
  const senza = validaDati('transfer', { ...transfer, volo: '', note: '' }, OGGI);
  assertEquals(senza.errore, undefined);
  assertEquals(senza.dati!.volo, '');
  assertEquals(validaDati('transfer', { ...transfer, note: 'a'.repeat(3000) }, OGGI).errore,
    'note troppo lunghe');
});

/* ---------------- soggiorno ---------------- */
Deno.test('un soggiorno senza camera scelta resta valido come prima', () => {
  const { errore, dati } = validaDati('soggiorno', {}, OGGI);
  assertEquals(errore, undefined);
  assertEquals(dati, {});
});

Deno.test('la camera scelta viene registrata', () => {
  const { errore, dati } = validaDati('soggiorno', {
    camera_id: 5, variante_id: 1, tariffa: 'Soggiorno breve',
    trattamento: 'Mezza Pensione', prezzo_cent: 31000,
  }, OGGI);
  assertEquals(errore, undefined);
  assertEquals(dati!.camera_id, 5);
  assertEquals(dati!.prezzo_cent, 31000);
  assertEquals(dati!.nome_camera, CAMERE[5].nome);
});

Deno.test('una camera inesistente viene rifiutata', () => {
  assertEquals(validaDati('soggiorno', { camera_id: 999 }, OGGI).errore,
    'camera sconosciuta');
});

/* il prezzo arriva dal cliente e non ci si fida: serve solo a mostrare cosa
   ha visto l'ospite, e un numero assurdo va fermato prima di finire in email */
Deno.test('un prezzo assurdo viene rifiutato', () => {
  assertEquals(validaDati('soggiorno', { camera_id: 5, prezzo_cent: -1 }, OGGI).errore,
    'prezzo non valido');
  assertEquals(validaDati('soggiorno', { camera_id: 5, prezzo_cent: 99999999 }, OGGI).errore,
    'prezzo non valido');
});

/* un null esplicito non e' uno zero: e' come non aver mandato il campo.
   Trattarlo come 0 farebbe comparire in email un prezzo finto di 0,00 EUR. */
Deno.test('un prezzo nullo esplicito non produce un prezzo finto', () => {
  const { errore, dati } = validaDati('soggiorno', { camera_id: 5, prezzo_cent: null }, OGGI);
  assertEquals(errore, undefined);
  assertEquals(dati!.prezzo_cent, undefined);
  assertEquals(dati!.valuta, undefined);
});

/* i centesimi sono interi per definizione: un valore frazionario non ha senso */
Deno.test('un prezzo frazionario viene rifiutato', () => {
  assertEquals(validaDati('soggiorno', { camera_id: 5, prezzo_cent: 30999.5 }, OGGI).errore,
    'prezzo non valido');
});

Deno.test('una variante negativa o frazionaria viene rifiutata', () => {
  assertEquals(validaDati('soggiorno', { camera_id: 5, variante_id: -1 }, OGGI).errore,
    'variante non valida');
  assertEquals(validaDati('soggiorno', { camera_id: 5, variante_id: 1.5 }, OGGI).errore,
    'variante non valida');
});

/* ---------------- C1: quello che l'ospite ha visto sullo schermo ----------------
   La camera da sola non basta: due proposte della stessa camera differiscono
   solo per trattamento e prezzo, e la caparra promessa dipende dagli ADULTI,
   non dagli ospiti. Se questi campi non sopravvivono alla validazione, la
   reception non ha modo di sapere cosa ha scelto l'ospite ne' a che cifra. */
Deno.test('adulti, bambini e caparra restano attaccati alla camera scelta', () => {
  const { errore, dati } = validaDati('soggiorno', {
    camera_id: 5, variante_id: 1, tariffa: 'Soggiorno breve',
    trattamento: 'Mezza Pensione', prezzo_cent: 31000,
    adulti: 2, bambini: 2, caparra_cent: 15000,
  }, OGGI);
  assertEquals(errore, undefined);
  assertEquals(dati!.adulti, 2);
  assertEquals(dati!.bambini, 2);
  assertEquals(dati!.caparra_cent, 15000);
});

/* 2 adulti + 2 bambini: la pagina promette 150 EUR di caparra, la colonna
   `ospiti` dice 4. Senza gli adulti la reception ne chiederebbe 300. */
Deno.test('la caparra registrata e quella degli adulti, non quella degli ospiti', () => {
  const { dati } = validaDati('soggiorno', {
    camera_id: 5, adulti: 2, bambini: 2, caparra_cent: 15000,
  }, OGGI);
  assertEquals(dati!.caparra_cent, 15000);
  assertEquals(dati!.adulti, 2);
});

Deno.test('adulti e bambini assurdi non entrano in dati', () => {
  assertEquals(validaDati('soggiorno', { camera_id: 5, adulti: 0 }, OGGI).errore,
    'adulti non validi');
  assertEquals(validaDati('soggiorno', { camera_id: 5, adulti: 'due' }, OGGI).errore,
    'adulti non validi');
  assertEquals(validaDati('soggiorno', { camera_id: 5, adulti: 99 }, OGGI).errore,
    'adulti non validi');
  assertEquals(validaDati('soggiorno', { camera_id: 5, bambini: -1 }, OGGI).errore,
    'bambini non validi');
  assertEquals(validaDati('soggiorno', { camera_id: 5, bambini: 1.5 }, OGGI).errore,
    'bambini non validi');
});

Deno.test('una caparra assurda viene rifiutata come il prezzo', () => {
  assertEquals(validaDati('soggiorno', { camera_id: 5, caparra_cent: -1 }, OGGI).errore,
    'caparra non valida');
  assertEquals(validaDati('soggiorno', { camera_id: 5, caparra_cent: 99999999 }, OGGI).errore,
    'caparra non valida');
  assertEquals(validaDati('soggiorno', { camera_id: 5, caparra_cent: 150.5 }, OGGI).errore,
    'caparra non valida');
});

/* la chat manda tipo:'soggiorno' senza niente di tutto questo: deve
   continuare a passare esattamente come prima */
Deno.test('senza adulti, bambini e caparra la camera resta valida come prima', () => {
  const { errore, dati } = validaDati('soggiorno', { camera_id: 5 }, OGGI);
  assertEquals(errore, undefined);
  assertEquals(dati!.adulti, undefined);
  assertEquals(dati!.bambini, undefined);
  assertEquals(dati!.caparra_cent, undefined);
});

/* ---------------- dayspa ---------------- */
Deno.test('dayspa: giorno e persone validi', () => {
  const r = validaDati('dayspa', { giorno: '2026-09-20', persone: 2, note: '' }, OGGI);
  assertEquals(r.errore, undefined);
  assertEquals(r.dati!.persone, 2);
  assertEquals(r.dati!.giorno, '2026-09-20');
});

Deno.test('dayspa: un giorno che non esiste viene rifiutato', () => {
  const r = validaDati('dayspa', { giorno: '2026-02-31', persone: 2 }, OGGI);
  assertNotEquals(r.errore, undefined);
});

Deno.test('dayspa: persone fuori scala rifiutate', () => {
  for (const p of [0, 9, 2.5, 'due']) {
    const r = validaDati('dayspa', { giorno: '2026-09-20', persone: p }, OGGI);
    assertNotEquals(r.errore, undefined, `persone ${p}`);
  }
});

/* ---------------- il presidio su TIPI_ATTIVI ----------------
   IL DIFETTO CHE PRESIDIA. `TIPI_ATTIVI` non ha consumatori a runtime: chi
   decide davvero quali tipi esistono e' lo `switch` di `validaDati` (e il suo
   `default`, che rifiuta tutto il resto). La costante e' una DICHIARAZIONE, e
   una dichiarazione che nessuno verifica invecchia in silenzio — infatti il
   prompt della chat si dichiarava «allineato a TIPI_ATTIVI» mentre TIPI_ATTIVI
   stessa non era allineata a niente.

   Senza questi test, chat/prompt.test.ts confronta la copia della chat con un
   originale che a sua volta nessuno verifica: un settimo tipo aggiunto allo
   switch e dimenticato nell'elenco lascerebbe tutto verde, e la chat non lo
   saprebbe mai.

   Il terzo test legge la SORGENTE dello switch — stessa tecnica di
   pagine/buoni/regala/serale.test.ts e pagine/richieste/avviso-dayspa.test.ts —
   perche' i `case` di uno switch non si possono enumerare a runtime. */
const SORGENTE_TIPI = Deno.readTextFileSync(new URL('tipi.ts', import.meta.url));

Deno.test('ogni tipo di TIPI_ATTIVI e accettato da validaDati', () => {
  for (const tipo of TIPI_ATTIVI) {
    /* con dati vuoti quasi tutti rispondono un errore di campo (data
       mancante, e simili): quello va benissimo. Quello che NON deve mai
       arrivare e' «tipo di richiesta sconosciuto», che vorrebbe dire che
       l'elenco promette un tipo che la funzione poi rifiuta. */
    assertNotEquals(
      validaDati(tipo, {}, OGGI).errore,
      'tipo di richiesta sconosciuto',
      `TIPI_ATTIVI promette «${tipo}», ma validaDati non lo conosce`,
    );
  }
});

Deno.test('un tipo fuori da TIPI_ATTIVI viene rifiutato, anche se sembra uno dei nostri', () => {
  /* 'toString' e 'constructor' sono il caso serio: esistono su
     Object.prototype, e una lookup diretta OGGETTO[tipo] ci cascherebbe.
     Lo switch no — questo test e' quello che tiene ferma quella scelta. */
  for (const finto of ['scommesse', '', 'toString', 'constructor', 'dayspa2', 'DAYSPA', 'soggiorni']) {
    assertEquals(
      validaDati(finto, {}, OGGI).errore,
      'tipo di richiesta sconosciuto',
      `«${finto}» e' passato come tipo valido`,
    );
  }
});

Deno.test('lo switch di validaDati e TIPI_ATTIVI dicono gli stessi tipi, nessuno in piu o in meno', () => {
  const corpo = /export function validaDati\([\s\S]*?switch \(tipo\) \{([\s\S]*?)\n  \}/.exec(SORGENTE_TIPI);
  assertNotEquals(corpo, null, 'lo switch di validaDati non si trova piu: e cambiata la forma?');
  const casi = [...corpo![1].matchAll(/case '([a-z]+)':/g)].map((m) => m[1]);
  /* arrivo e fattura sono l'eccezione voluta: nascono dal check-in online,
     non dal modulo pubblico, quindi stanno nello switch di proposito senza
     stare in TIPI_ATTIVI — e' il test «i due tipi nuovi NON sono creabili
     dal modulo pubblico» a presidiare proprio questo, non serve ripeterlo
     qui. Tolti loro, lo switch e TIPI_ATTIVI devono restare identici come
     prima. */
  const NON_PUBBLICI = ['arrivo', 'fattura'];
  const casiPubblici = casi.filter((c) => !NON_PUBBLICI.includes(c));
  assertEquals(
    casiPubblici.sort(),
    [...TIPI_ATTIVI].sort(),
    'un tipo e stato aggiunto o tolto in un posto solo: l elenco dichiarato e quello vero divergono',
  );
});

/* ============================================================
   TRANSFER: IL SERVIZIO E IL PREZZO CONFERMATO.

   `collettivo` lo sceglie l'ospite nel modulo (auto privata o navetta
   condivisa) e serve all'estensione per riempire is_collettivo su
   atam.biz. `prezzo_cent` non lo scrive l'ospite: lo conferma la
   reception, e finisce nella conferma come cifra da dare all'autista.

   IL DIFETTO CHE PRESIDIA: `?a=conferma` rivalida i dati con queste stesse
   regole. Un campo non previsto qui verrebbe scartato in silenzio al primo
   salvataggio — la reception conferma il prezzo, preme invia, e il prezzo
   sparisce senza un errore.
   ============================================================ */
Deno.test('il transfer conserva la scelta fra auto privata e navetta', () => {
  const v = validaDati('transfer', { ...transfer, collettivo: true }, OGGI);
  assertEquals(v.errore, undefined);
  assertEquals(v.dati?.collettivo, true);
});

Deno.test('senza la scelta il transfer vale come auto privata', () => {
  const v = validaDati('transfer', { ...transfer }, OGGI);
  assertEquals(v.dati?.collettivo, false);
});

Deno.test('il prezzo confermato dalla reception sopravvive alla validazione', () => {
  const v = validaDati('transfer', { ...transfer, prezzo_cent: 13500 }, OGGI);
  assertEquals(v.errore, undefined);
  assertEquals(v.dati?.prezzo_cent, 13500);
});

/* Senza prezzo la conferma non deve mostrarne uno: `null` dice «non c'e'»,
   uno zero direbbe «gratis». */
Deno.test('senza prezzo il campo e nullo, non zero', () => {
  assertEquals(validaDati('transfer', { ...transfer }, OGGI).dati?.prezzo_cent, null);
});

Deno.test('un prezzo assurdo o non intero viene respinto', () => {
  for (const p of [-100, 1.5, 1e9, 'centoventi']) {
    assert(validaDati('transfer', { ...transfer, prezzo_cent: p }, OGGI).errore, `passato: ${p}`);
  }
});

/* ============================================================
   IL RITORNO, CON GIORNO E ORA.

   IL DIFETTO. La spunta «mi serve anche il ritorno» mandava un booleano e
   basta: la reception sapeva CHE serviva, non QUANDO, e doveva telefonare.

   Restano facoltativi qui dentro anche se il modulo li pretende: le
   richieste gia' salvate hanno solo il booleano, e `?a=conferma` rivalida
   con queste stesse regole — pretenderli renderebbe impossibile confermare
   una richiesta arrivata prima di oggi.
   ============================================================ */
Deno.test('il ritorno porta il suo giorno e la sua ora', () => {
  const v = validaDati('transfer', {
    ...transfer, ritorno: true, ritorno_quando: '2026-09-17', ritorno_ora: '10:00',
  }, OGGI);
  assertEquals(v.errore, undefined);
  assertEquals(v.dati?.ritorno_quando, '2026-09-17');
  assertEquals(v.dati?.ritorno_ora, '10:00');
});

Deno.test('senza ritorno i suoi campi restano nulli', () => {
  const v = validaDati('transfer', { ...transfer, ritorno: false }, OGGI);
  assertEquals(v.dati?.ritorno_quando, null);
  assertEquals(v.dati?.ritorno_ora, null);
});

/* Una richiesta vecchia ha solo il booleano: deve restare confermabile. */
Deno.test('un ritorno senza giorno resta valido, per le richieste vecchie', () => {
  const v = validaDati('transfer', { ...transfer, ritorno: true }, OGGI);
  assertEquals(v.errore, undefined);
  assertEquals(v.dati?.ritorno_quando, null);
});

Deno.test('un giorno di ritorno inesistente viene respinto', () => {
  for (const q of ['2026-02-31', 'domani', '2026-13-01']) {
    assert(validaDati('transfer', { ...transfer, ritorno: true, ritorno_quando: q }, OGGI).errore,
      `passato: ${q}`);
  }
});

/* Il ritorno viene DOPO l'andata: al contrario e' un errore di battitura che
   manda un tassista il giorno sbagliato. */
Deno.test('il ritorno non puo cadere prima dell andata', () => {
  const v = validaDati('transfer', {
    ...transfer, ritorno: true, ritorno_quando: '2026-09-09',
  }, OGGI);
  assert(v.errore, 'un ritorno prima dell andata doveva essere respinto');
});

Deno.test('il ritorno lo stesso giorno dell andata e legittimo', () => {
  const v = validaDati('transfer', {
    ...transfer, ritorno: true, ritorno_quando: transfer.quando, ritorno_ora: '22:00',
  }, OGGI);
  assertEquals(v.errore, undefined);
});

/* L'ORA DEL VOLO, quando la navetta parte tre ore prima.

   `ora` resta l'ora del RITIRO in hotel — e' quello che chiede il modulo dei
   tassisti — ma l'ora del volo non deve perdersi: e' il dato da cui il
   ritiro e' stato calcolato, e senza, chi legge non puo' verificare il
   conto. */
Deno.test('l ora del volo si conserva accanto a quella del ritiro', () => {
  const v = validaDati('transfer', {
    ...transfer, verso: 'partenza', collettivo: true, ora: '11:30', ora_volo: '14:30',
  }, OGGI);
  assertEquals(v.errore, undefined);
  assertEquals(v.dati?.ora, '11:30');
  assertEquals(v.dati?.ora_volo, '14:30');
});

Deno.test('senza ora del volo il campo resta nullo', () => {
  assertEquals(validaDati('transfer', { ...transfer }, OGGI).dati?.ora_volo, null);
});

Deno.test('un ora del volo che non e un orario viene respinta', () => {
  assert(validaDati('transfer', { ...transfer, ora_volo: 'mattina' }, OGGI).errore);
});

/* Il ritorno ha un volo suo e un servizio suo: su atam.biz e' una seconda
   prenotazione, e alle 22:00 la navetta non e' in servizio — quindi un
   ritorno puo' essere privato anche se l'andata era condivisa. */
Deno.test('il ritorno porta il suo volo e il suo servizio', () => {
  const v = validaDati('transfer', {
    ...transfer, ritorno: true, ritorno_quando: '2026-09-17', ritorno_ora: '10:00',
    ritorno_volo: 'FR5678', ritorno_collettivo: true,
  }, OGGI);
  assertEquals(v.errore, undefined);
  assertEquals(v.dati?.ritorno_volo, 'FR5678');
  assertEquals(v.dati?.ritorno_collettivo, true);
});

Deno.test('senza indicazioni il ritorno e privato, non indeciso', () => {
  const v = validaDati('transfer', { ...transfer, ritorno: true }, OGGI);
  assertEquals(v.dati?.ritorno_collettivo, false);
  assertEquals(v.dati?.ritorno_volo, '');
});

/* ============================================================
   I DUE TIPI CHE NASCONO DAL CHECK-IN ONLINE.

   Non stanno in TIPI_ATTIVI apposta: dal modulo pubblico non si possono
   creare. Esistono in validaDati perche' li crea ?a=invia-arrivo, che
   pretende un token valido, e perche' ?a=conferma rivalida con le stesse
   regole — un campo non previsto qui sparirebbe in silenzio fra il
   "conferma" e l'email, che e' il difetto gia' documentato per
   prezzo_cent del transfer.
   ============================================================ */
Deno.test('i due tipi nuovi NON sono creabili dal modulo pubblico', () => {
  assert(!TIPI_ATTIVI.includes('arrivo' as never), 'arrivo e finito in TIPI_ATTIVI');
  assert(!TIPI_ATTIVI.includes('fattura' as never), 'fattura e finito in TIPI_ATTIVI');
});

Deno.test('un arrivo minimo passa', () => {
  const v = validaDati('arrivo', { ora_arrivo: '16:30', mezzo: 'auto' });
  assert(!v.errore, v.errore);
  assertEquals(v.dati?.ora_arrivo, '16:30');
  assertEquals(v.dati?.attenzioni, []);
  assertEquals(v.dati?.fanghi_desiderio, null);
});

/* Le attenzioni arrivano come CHIAVI, non come testo tradotto: la pagina
   parla quattro lingue e "Culla per neonato" in back office andrebbe
   letto da chi ha davanti "Babybett". E' la stessa scelta gia' fatta per
   il desiderio dei fanghi. */
Deno.test('le attenzioni fuori elenco cadono', () => {
  const v = validaDati('arrivo', { attenzioni: ['culla', 'elicottero', 'cane'] });
  assertEquals(v.dati?.attenzioni, ['culla', 'cane']);
});

Deno.test('il desiderio dei fanghi fuori elenco diventa null', () => {
  assertEquals(validaDati('arrivo', { fanghi_desiderio: 'alle 7' }).dati?.fanghi_desiderio, null);
  assertEquals(validaDati('arrivo', { fanghi_desiderio: 'presto' }).dati?.fanghi_desiderio, 'presto');
});

Deno.test('le persone senza nome non contano, e non se ne prendono piu di sei', () => {
  const tante = Array.from({ length: 9 }, (_, i) => ({ nome: `Tizio ${i}`, eta: '30' }));
  assertEquals((validaDati('arrivo', { persone_extra: tante }).dati?.persone_extra as unknown[]).length, 6);
  assertEquals((validaDati('arrivo', { persone_extra: [{ nome: '', eta: '9' }] })
    .dati?.persone_extra as unknown[]).length, 0);
});

/* Il tetto di sei deve contare PERSONE VERE, non posizioni nell'elenco: se
   lo scarto dei nomi vuoti venisse dopo il taglio a sei, tre voci vuote in
   testa a otto ne lascerebbero passare solo tre valide invece delle cinque
   che l'ospite ha davvero scritto. */
Deno.test('il tetto di sei conta le persone vere, non le posizioni', () => {
  const otto = [
    { nome: '', eta: '' }, { nome: '', eta: '' }, { nome: '', eta: '' },
    ...Array.from({ length: 5 }, (_, i) => ({ nome: `Tizio ${i}`, eta: '30' })),
  ];
  const persone = validaDati('arrivo', { persone_extra: otto }).dati?.persone_extra as unknown[];
  assertEquals(persone.length, 5);
});

/* Il segno che dice "qualcuno ha risposto". Deve sopravvivere alla
   rivalidazione, o ?a=conferma lo perderebbe e la richiesta tornerebbe
   bloccata dopo che il lavoro era stato fatto. */
Deno.test('persone_confermate sopravvive alla rivalidazione', () => {
  assertEquals(validaDati('arrivo', { persone_confermate: true }).dati?.persone_confermate, true);
  assertEquals(validaDati('arrivo', {}).dati?.persone_confermate, false);
});

Deno.test('una fattura senza ragione sociale e rifiutata', () => {
  assert(validaDati('fattura', { piva: 'IT02042330288' }).errore);
});

/* Senza partita IVA ne' codice fiscale non si emette niente: accettarla
   vorrebbe dire mettere in coda all'amministrazione una richiesta che non
   puo' lavorare, e scoprirlo al check-out. */
Deno.test('una fattura senza piva ne codice fiscale e rifiutata', () => {
  assert(validaDati('fattura', { ragione: 'Bianchi S.r.l.' }).errore);
});

Deno.test('una fattura completa passa', () => {
  const v = validaDati('fattura', {
    ragione: 'Bianchi S.r.l.', indirizzo: 'Via Roma 1, Padova',
    piva: 'IT02042330288', cf: 'BNCMRA80A01G224X', sdi: 'M5UXCR1', pec: 'b@pec.it',
  });
  assert(!v.errore, v.errore);
  assertEquals(v.dati?.piva, 'IT02042330288');
});
