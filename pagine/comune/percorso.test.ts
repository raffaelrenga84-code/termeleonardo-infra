import { assertEquals } from 'jsr:@std/assert';
import { indirizzoPerLingua, linguaScelta, PERCORSI, tipoScelto } from './percorso.js';

const TIPI = ['greenfee', 'maestro', 'trattamenti'];
/* la pagina delle richieste da oggi ne gestisce quattro: il Day Spa e' il
   sesto tipo del server, e il quarto che questa pagina sa disegnare */
const TIPI_OGGI = ['greenfee', 'maestro', 'trattamenti', 'dayspa'];

/* Il difetto vero, visto in produzione il 14 agosto 2026: /it/trattamenti
   apriva il modulo dei green fee. La riscrittura porta ?tipo=trattamenti
   nella destinazione, ma quella query la consuma il server di file statici e
   alla pagina non arriva: leggendo solo location.search si ricadeva sul
   predefinito. */
Deno.test('il tipo si legge dal percorso quando la query non c e', () => {
  assertEquals(tipoScelto('', '/it/trattamenti', TIPI, 'greenfee'), 'trattamenti');
  assertEquals(tipoScelto('', '/de/behandlungen', TIPI, 'greenfee'), 'trattamenti');
  assertEquals(tipoScelto('', '/en/treatments', TIPI, 'greenfee'), 'trattamenti');
  assertEquals(tipoScelto('', '/fr/soins', TIPI, 'greenfee'), 'trattamenti');
});

Deno.test('anche maestro e green fee, in tutte le lingue', () => {
  assertEquals(tipoScelto('', '/it/maestro-di-golf', TIPI, 'greenfee'), 'maestro');
  assertEquals(tipoScelto('', '/de/golflehrer', TIPI, 'greenfee'), 'maestro');
  assertEquals(tipoScelto('', '/en/golf-pro', TIPI, 'greenfee'), 'maestro');
  assertEquals(tipoScelto('', '/fr/pro-de-golf', TIPI, 'greenfee'), 'maestro');
  assertEquals(tipoScelto('', '/it/green-fee', TIPI, 'greenfee'), 'greenfee');
  assertEquals(tipoScelto('', '/de/greenfee', TIPI, 'greenfee'), 'greenfee');
});

/* Il Day Spa. `day-spa` e' uguale in tutte e quattro le lingue — «Day Spa»
   e' il nome con cui l'hotel vende l'ingresso, ed e' quello stampato sul
   buono: tradurlo darebbe un indirizzo che non compare da nessun'altra
   parte. Senza questa voce in PERCORSI, /it/day-spa aprirebbe il modulo
   dei GREEN FEE — che e' esattamente il difetto visto in produzione il 14
   agosto con /it/trattamenti. */
Deno.test('il Day Spa si riconosce dal percorso, in tutte e quattro le lingue', () => {
  assertEquals(tipoScelto('', '/it/day-spa', TIPI_OGGI, 'greenfee'), 'dayspa');
  assertEquals(tipoScelto('', '/de/day-spa', TIPI_OGGI, 'greenfee'), 'dayspa');
  assertEquals(tipoScelto('', '/en/day-spa', TIPI_OGGI, 'greenfee'), 'dayspa');
  assertEquals(tipoScelto('', '/fr/day-spa', TIPI_OGGI, 'greenfee'), 'dayspa');
});

/* e cambiando lingua si resta sull'indirizzo tradotto, come per gli altri */
Deno.test('cambiare lingua sul Day Spa non riporta a un indirizzo tecnico', () => {
  assertEquals(indirizzoPerLingua('/it/day-spa', '', 'dayspa', 'de'), '/de/day-spa');
  assertEquals(indirizzoPerLingua('/en/day-spa', '', 'dayspa', 'fr'), '/fr/day-spa');
});

/* gli altri tre non devono muoversi di un millimetro: una pagina che NON
   gestisce il Day Spa non deve cominciare a riconoscerlo */
Deno.test('una pagina che non gestisce il Day Spa continua a non riconoscerlo', () => {
  assertEquals(tipoScelto('', '/it/day-spa', TIPI, 'greenfee'), 'greenfee');
});

/* gli indirizzi vecchi devono continuare a funzionare identici */
Deno.test('la query vince sul percorso', () => {
  assertEquals(tipoScelto('?tipo=maestro', '/it/trattamenti', TIPI, 'greenfee'), 'maestro');
  assertEquals(tipoScelto('?tipo=trattamenti', '/richieste/', TIPI, 'greenfee'), 'trattamenti');
});

Deno.test('un percorso inventato non apre un modulo a caso', () => {
  assertEquals(tipoScelto('', '/it/qualcosa', TIPI, 'greenfee'), 'greenfee');
  assertEquals(tipoScelto('', '/', TIPI, 'greenfee'), 'greenfee');
  assertEquals(tipoScelto('', '', TIPI, 'greenfee'), 'greenfee');
});

/* una pagina che non gestisce un tipo non deve riconoscerlo dal percorso:
   la pagina del transfer non deve mai trovarsi a disegnare i green fee */
Deno.test('un tipo che la pagina non gestisce non viene restituito', () => {
  assertEquals(tipoScelto('', '/it/transfer', TIPI, 'greenfee'), 'greenfee');
  assertEquals(tipoScelto('', '/it/prenota', TIPI, 'greenfee'), 'greenfee');
});

/* La lingua aveva lo stesso difetto: su /de/behandlungen la decideva il
   browser, e la lingua qui decide anche quali condizioni l'ospite legge. */
Deno.test('la lingua si legge dal percorso quando la query non c e', () => {
  assertEquals(linguaScelta('', '/de/behandlungen', 'en-GB'), 'de');
  assertEquals(linguaScelta('', '/fr/soins', 'en-GB'), 'fr');
});

Deno.test('la query vince, poi il percorso, poi il browser', () => {
  assertEquals(linguaScelta('?l=it', '/de/behandlungen', 'en-GB'), 'it');
  assertEquals(linguaScelta('', '/de/behandlungen', 'en-GB'), 'de');
  assertEquals(linguaScelta('', '/richieste/', 'de-DE'), 'de');
  assertEquals(linguaScelta('', '/richieste/', 'es-ES'), 'en');
  assertEquals(linguaScelta('', '/richieste/', ''), 'en');
});

Deno.test('una lingua inventata nella query non passa', () => {
  assertEquals(linguaScelta('?l=zz', '/de/behandlungen', 'en-GB'), 'de');
});

/* Cambiando lingua su un indirizzo tradotto si resta tradotti: altrimenti
   l'ospite vede la barra tornare a un indirizzo tecnico. */
Deno.test('cambiare lingua su un indirizzo tradotto resta tradotto', () => {
  assertEquals(indirizzoPerLingua('/it/trattamenti', '', 'trattamenti', 'de'),
    '/de/behandlungen');
  assertEquals(indirizzoPerLingua('/de/golflehrer', '', 'maestro', 'fr'),
    '/fr/pro-de-golf');
});

Deno.test('sugli indirizzi vecchi si continua con la query', () => {
  const r = indirizzoPerLingua('/richieste/', '?tipo=maestro', 'maestro', 'de');
  assertEquals(r.startsWith('/richieste/?'), true);
  assertEquals(new URLSearchParams(r.split('?')[1]).get('l'), 'de');
  assertEquals(new URLSearchParams(r.split('?')[1]).get('tipo'), 'maestro');
});

/* i percorsi qui e le riscritture in vercel.json sono le due meta' della
   stessa cosa: se divergono, un indirizzo apre la pagina sbagliata */
Deno.test('ogni tipo ha un percorso in tutte e quattro le lingue', () => {
  for (const [tipo, tradotti] of Object.entries(PERCORSI)) {
    const t = tradotti as Record<string, string>;
    for (const l of ['it', 'de', 'en', 'fr']) {
      assertEquals(typeof t[l], 'string', `${tipo} manca in ${l}`);
      assertEquals(t[l].length > 0, true, `${tipo} vuoto in ${l}`);
    }
  }
});

/* ============================================================
   L'INDIRIZZO DI UN MODULO, COI DATI DELL'OSPITE DENTRO.

   IL DIFETTO CHE PRESIDIA. Chi ha appena chiesto una camera e vuole anche
   il transfer si trovava davanti un modulo vuoto: nome, email e telefono
   da ridigitare due minuti dopo averli scritti. Ogni campo da riempire
   una seconda volta è gente che rinuncia.

   IL DIFETTO PEGGIORE, e quello che una prova sola non vedrebbe: i nomi
   dei parametri che scriviamo devono essere quelli che la pagina di
   destinazione LEGGE. Se qualcuno ne rinomina uno, il collegamento
   continua a funzionare, il modulo si apre — e semplicemente non si
   riempie. Nessun errore, nessun rosso, e nessuno se ne accorge finché un
   ospite non si lamenta. Per questo l'ultima prova non guarda le
   stringhe: fa leggere l'indirizzo a parametriOspite() e pretende
   indietro i valori.
   ============================================================ */
import { indirizzoModulo, SITO } from './percorso.js';
import { parametriOspite } from './ospite-url.js';

const OSPITE = {
  nome: 'Mario Rossi',
  email: 'mario@example.com',
  tel: '333 1234567',
  arrivo: '2026-09-10',
  partenza: '2026-09-12',
};

Deno.test('ogni lingua ha il suo indirizzo tradotto', () => {
  const atteso: Record<string, string> = {
    it: '/it/trattamenti', de: '/de/behandlungen', en: '/en/treatments', fr: '/fr/soins',
  };
  for (const [l, percorso] of Object.entries(atteso)) {
    const u = new URL(indirizzoModulo('trattamenti', l, OSPITE));
    assertEquals(u.pathname, percorso, `lingua ${l}`);
  }
  assertEquals(new URL(indirizzoModulo('transfer', 'fr', OSPITE)).pathname, '/fr/transfert');
});

Deno.test('e l indirizzo e assoluto, sul dominio dell hotel', () => {
  /* la pagina che scrive questi collegamenti e' servita da due domini: un
     percorso relativo va a vuoto su quello dietro le riscritture */
  const u = indirizzoModulo('transfer', 'it', OSPITE);
  assertEquals(u.startsWith(SITO + '/'), true, u);
  assertEquals(SITO.startsWith('https://'), true);
});

Deno.test('i valori vuoti non sporcano l indirizzo', () => {
  const u = new URL(indirizzoModulo('transfer', 'it', { nome: 'Mario', email: '', tel: '  ' }));
  assertEquals(u.searchParams.get('nome'), 'Mario');
  assertEquals(u.searchParams.has('email'), false);
  assertEquals(u.searchParams.has('tel'), false);
});

Deno.test('senza dati resta l indirizzo nudo, che funziona lo stesso', () => {
  assertEquals(indirizzoModulo('transfer', 'it'), SITO + '/it/transfer');
  assertEquals(indirizzoModulo('transfer', 'it', {}), SITO + '/it/transfer');
});

Deno.test('un tipo che non esiste non produce un collegamento a caso', () => {
  /* meglio nessun pulsante che un pulsante che porta su una pagina che non
     c e */
  assertEquals(indirizzoModulo('inventato', 'it', OSPITE), '');
  assertEquals(indirizzoModulo('', 'it', OSPITE), '');
});

Deno.test('una lingua che non conosciamo ripiega sull inglese, come tutto il resto', () => {
  assertEquals(new URL(indirizzoModulo('transfer', 'es', OSPITE)).pathname, '/en/transfer');
});

Deno.test('e i parametri che scriviamo sono quelli che la pagina legge', () => {
  /* la prova che lega le due parti: non si confrontano stringhe, si fa
     leggere l indirizzo a chi lo leggera' davvero */
  const u = new URL(indirizzoModulo('trattamenti', 'it', OSPITE));
  const letti = parametriOspite(u.search);
  assertEquals(letti.nome, OSPITE.nome, 'il nome non arriva al modulo');
  assertEquals(letti.email, OSPITE.email, 'l email non arriva al modulo');
  assertEquals(letti.tel, OSPITE.tel, 'il telefono non arriva al modulo');
  assertEquals(letti.arrivo, OSPITE.arrivo, 'la data di arrivo non arriva al modulo');
  assertEquals(letti.partenza, OSPITE.partenza, 'la data di partenza non arriva al modulo');
});

Deno.test('e l indirizzo sa portare anche il numero della richiesta collegata', () => {
  /* chi prenota due camere fa due richieste: senza questo numero la
     reception riceve due fogli slegati e assegna due camere lontane a
     persone che viaggiano insieme */
  const u = new URL(indirizzoModulo('prenota', 'it', { ...OSPITE, insieme: 'S-2026-0001' }));
  assertEquals(u.pathname, '/it/prenota');
  assertEquals(u.searchParams.get('insieme'), 'S-2026-0001');
  const letti = parametriOspite(u.search);
  assertEquals(letti.insieme, 'S-2026-0001', 'il numero collegato non arriva alla pagina');
});
