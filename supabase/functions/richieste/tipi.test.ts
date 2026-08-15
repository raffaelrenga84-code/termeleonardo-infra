/* Test della validazione per tipo di richiesta.
   La data di riferimento arriva da fuori: legata a new Date() questi test
   comincerebbero a fallire da soli col passare del tempo. */
import { assertEquals } from 'jsr:@std/assert';
import { validaDati } from './tipi.ts';
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
