import { assertEquals, assertNotEquals } from 'jsr:@std/assert';
import { normalizzaLingua, parametriOspite } from './ospite-url.js';

/* Il link vero che manda la reception, quello descritto nel brief: se il
   modulo non legge questi otto parametri esattamente cosi', l'ospite si
   ritrova a riscrivere a mano quello che l'hotel sa gia'. */
const INDIRIZZO_VERO =
  'rif=O26%2F19130&nome=Marcheselli+Alessandro&email=alessandro.marcheselli%40sysma.it' +
  '&tel=3474852657&arrivo=2026-08-17&partenza=2026-08-19&adulti=1&lang=it';

Deno.test('un indirizzo vero, come quello dei pulsanti della reception, si legge intero', () => {
  const r = parametriOspite(INDIRIZZO_VERO);
  assertEquals(r, {
    rif: 'O26/19130', insieme: '', camera: null,
    nome: 'Marcheselli Alessandro',
    email: 'alessandro.marcheselli@sysma.it',
    tel: '3474852657',
    arrivo: '2026-08-17',
    partenza: '2026-08-19',
    adulti: 1,
    lang: 'it',
  });
});

/* Senza parametri, ogni campo torna vuoto (o null per adulti/lang): mai
   `undefined`, mai un valore raccolto per errore da chissa' dove — una
   pagina che scrive `esc(url.nome)` deve poter contare su una stringa. */
Deno.test('parametri assenti: tutto vuoto, niente per magia', () => {
  assertEquals(parametriOspite(''), {
    rif: '', insieme: '', camera: null, nome: '', email: '', tel: '',
    arrivo: '', partenza: '', adulti: null, lang: null,
  });
  assertEquals(parametriOspite('altro=cosa'), {
    rif: '', insieme: '', camera: null, nome: '', email: '', tel: '',
    arrivo: '', partenza: '', adulti: null, lang: null,
  });
});

/* Il tetto e' lo STESSO numero che il server accetta gia' per un nome
   (richieste/valida.ts, LIMITI.nome = 80): un numero diverso, piu' grande o
   piu' piccolo, farebbe fallire questo test. Se domani il server cambia
   limite e questo modulo no, una richiesta precompilata con un nome lungo
   verrebbe rifiutata — o troncata piu' del dovuto — senza che nessuna prova
   se ne accorga finche' non lo segnala un ospite vero. */
Deno.test('un nome lunghissimo si tronca a 80 caratteri, non di piu e non di meno', () => {
  const lunghissimo = 'Alessandro '.repeat(20); // ben oltre 80
  const r = parametriOspite('nome=' + encodeURIComponent(lunghissimo));
  assertEquals(r.nome.length, 80);
  assertEquals(r.nome, lunghissimo.slice(0, 80));
});

Deno.test('telefono ed email lunghissimi si troncano ai limiti del server (40 e 120)', () => {
  const telLungo = '3'.repeat(60);
  const r = parametriOspite('tel=' + telLungo);
  assertEquals(r.tel.length, 40);

  /* un'email valida ma con la @ oltre il carattere 120: la si tronca PRIMA
     di controllarne la forma (lo stesso ordine di operazioni del server:
     valida.ts controlla la lunghezza prima della forma), quindi cio' che
     resta e' 120 lettere senza ne' @ ne' punto — corretto scartarla invece
     di restare con un indirizzo email mutilato */
  const emailLunga = 'a'.repeat(125) + '@x.com'; // la @ e' al carattere 126
  const r2 = parametriOspite('email=' + emailLunga);
  assertEquals(r2.email, '');
});

/* Un'email senza la forma di un'email non deve arrivare al modulo: e'
   esattamente il controllo che richieste/valida.ts fa gia' lato server
   (`/.+@.+\..+/`), qui solo per dare un modulo pulito, non un secondo
   giudice — il server resta l'unico che decide davvero. */
Deno.test('un email malformata sparisce', () => {
  assertEquals(parametriOspite('email=non-e-una-email').email, '');
  assertEquals(parametriOspite('email=' + encodeURIComponent('a@b')).email, '');
  assertEquals(parametriOspite('email=' + encodeURIComponent('@senza-utente.it')).email, '');
});

/* Trovato provando il modulo con input ostili: "<img src=x onerror=alert(1)>@b.it"
   ha una chiocciola e un punto, quindi passava EMAIL_RE cosi' com'era prima.
   Non e' un pericolo — esc() lo neutralizza comunque — ma e' l'opposto del
   motivo per cui questo modulo esiste: un campo email precompilato con
   markup e' un campo che l'ospite deve RIPULIRE prima di poterlo usare,
   invece di uno che trova gia' pronto. Dentro un indirizzo email vero non
   ci stanno `<`, `>`, virgolette (singole o doppie) ne' spazi: se ci sono,
   meglio un campo vuoto che uno sbagliato. */
Deno.test('un email con markup, virgolette o spazi non ha la forma di un email vera', () => {
  assertEquals(parametriOspite('email=' + encodeURIComponent('<img src=x onerror=alert(1)>@b.it')).email, '');
  assertEquals(parametriOspite('email=' + encodeURIComponent('mario"rossi@b.it')).email, '');
  assertEquals(parametriOspite('email=' + encodeURIComponent("mario'rossi@b.it")).email, '');
  assertEquals(parametriOspite('email=' + encodeURIComponent('mario rossi@b.it')).email, '');
  /* la controprova che il controllo e' mirato ai caratteri vietati e non a
     tutto: un'email vera, senza niente di quello, deve continuare a passare */
  assertEquals(parametriOspite('email=' + encodeURIComponent('mario.rossi@example.it')).email, 'mario.rossi@example.it');
});

/* Il difetto vero che questo test esiste a evitare: new Date('2026-02-31')
   NON protesta, scivola avanti al 3 marzo 2026. Un ospite con un link che
   contenesse quella data per errore si vedrebbe precompilare un arrivo
   sbagliato invece di vedere il campo restare vuoto. */
Deno.test('una data che non esiste (2026-02-31) viene scartata, non corretta in silenzio', () => {
  const r = parametriOspite('arrivo=2026-02-31&partenza=2026-02-31');
  assertEquals(r.arrivo, '');
  assertEquals(r.partenza, '');
  /* prova che il controllo e' reale e non sempre falso: la stessa forma con
     un giorno che esiste davvero deve passare */
  assertNotEquals(parametriOspite('arrivo=2026-02-28').arrivo, '');
});

Deno.test('una data in un formato diverso da AAAA-MM-GG viene scartata', () => {
  assertEquals(parametriOspite('arrivo=17/08/2026').arrivo, '');
  assertEquals(parametriOspite('arrivo=2026-8-17').arrivo, '');
  assertEquals(parametriOspite('arrivo=2026/08/17').arrivo, '');
  assertEquals(parametriOspite('arrivo=17-08-2026').arrivo, '');
  assertEquals(parametriOspite('arrivo=domani').arrivo, '');
});

/* 29 febbraio: c'e' negli anni bisestili e non negli altri. Se il controllo
   della data fosse fatto con una regex sulla FORMA soltanto (non sul
   calendario vero), questo test lo scoprirebbe: 2026 non e' bisestile. */
Deno.test('il 29 febbraio esiste solo negli anni bisestili', () => {
  assertEquals(parametriOspite('arrivo=2026-02-29').arrivo, '');
  assertEquals(parametriOspite('arrivo=2028-02-29').arrivo, '2028-02-29');
});

/* Trovato provando il modulo con input ostili: arrivo e partenza erano
   validate SEPARATAMENTE (ognuna e' una data vera) ma non nella loro
   RELAZIONE — un periodo impossibile (si parte prima di essere arrivati)
   passava intero fino a prenota/index.html. Stessa regola del server
   (richieste/valida.ts, validaRichiesta: `partenza <= arrivo` e' un
   errore), qui applicata scartando solo la partenza: un ospite che vede
   l'arrivo giusto e la partenza vuota capisce subito cosa correggere, uno
   che se le vede tornare indietro tutte e due no. */
Deno.test('una partenza non dopo l arrivo si scarta, l arrivo resta', () => {
  const primaDellArrivo = parametriOspite('arrivo=2026-09-20&partenza=2026-09-10');
  assertEquals(primaDellArrivo.arrivo, '2026-09-20');
  assertEquals(primaDellArrivo.partenza, '');

  /* stesso giorno: non si parte il giorno in cui si arriva, la regola del
     server e' `<=`, non `<` */
  const stessoGiorno = parametriOspite('arrivo=2026-09-20&partenza=2026-09-20');
  assertEquals(stessoGiorno.arrivo, '2026-09-20');
  assertEquals(stessoGiorno.partenza, '');
});

Deno.test('una partenza dopo l arrivo resta cosi come e', () => {
  const r = parametriOspite('arrivo=2026-09-20&partenza=2026-09-25');
  assertEquals(r.arrivo, '2026-09-20');
  assertEquals(r.partenza, '2026-09-25');
});

/* Senza le due date insieme non c'e' una relazione da controllare: una
   partenza da sola (l'arrivo manca o non e' una data vera) non deve sparire
   per colpa di un confronto con un arrivo che non esiste. */
Deno.test('senza arrivo valido la partenza da sola non si tocca', () => {
  assertEquals(parametriOspite('partenza=2026-09-10').partenza, '2026-09-10');
  assertEquals(parametriOspite('arrivo=2026-13-40&partenza=2026-09-10').partenza, '2026-09-10');
});

/* adulti: un intero fra 1 e 10 (lo stesso tetto di OSPITI_MAX in
   richieste/valida.ts) o niente. "abc" non e' un numero, 0 e 99 sono numeri
   ma fuori da qualunque soggiorno vero. */
Deno.test('adulti non numerico, a zero o fuori scala si ignora', () => {
  assertEquals(parametriOspite('adulti=abc').adulti, null);
  assertEquals(parametriOspite('adulti=0').adulti, null);
  assertEquals(parametriOspite('adulti=99').adulti, null);
  assertEquals(parametriOspite('adulti=-1').adulti, null);
  assertEquals(parametriOspite('adulti=2.5').adulti, null); // non e' un intero
  assertEquals(parametriOspite('adulti=').adulti, null);
});

Deno.test('adulti in scala (1..10) passa cosi come e', () => {
  assertEquals(parametriOspite('adulti=1').adulti, 1);
  assertEquals(parametriOspite('adulti=10').adulti, 10);
  assertEquals(parametriOspite('adulti=4').adulti, 4);
});

/* Il punto che puo' far male davvero: il modulo NON deve alterare il
   contenuto di un valore che rientra nei limiti di lunghezza, nemmeno per
   renderlo "piu' sicuro". Se lo facesse (per esempio togliendo `<` e `>`),
   la pagina che si fida di `esc()` per lo stesso scopo finirebbe per fare
   la stessa cosa due volte, ed e' proprio quel tipo di doppio lavoro che fa
   divergere due copie della stessa regola. La sicurezza vera si prova sulla
   PAGINA (vedi il resoconto), qui si prova solo che il modulo non mente su
   cosa restituisce. */
Deno.test('un valore con virgolette e script passa invariato: la pulizia non e uno scudo', () => {
  const insidioso = 'Mario "il grande" <script>alert(1)</script>';
  const r = parametriOspite('nome=' + encodeURIComponent(insidioso));
  assertEquals(r.nome, insidioso);
  assertEquals(r.nome.includes('<script>'), true);
});

Deno.test('rif si tronca (60 caratteri) ma non si tocca il contenuto', () => {
  assertEquals(parametriOspite('rif=' + encodeURIComponent('O26/19130')).rif, 'O26/19130');
  const rifLungo = 'X'.repeat(90);
  assertEquals(parametriOspite('rif=' + rifLungo).rif.length, 60);
});

/* lang: solo le quattro lingue del sito, tutto il resto e' come se non ci
   fosse — un valore inventato non deve mai arrivare a un `T[lang]` che non
   esiste, altrimenti la pagina resta bianca (il difetto gia' successo tre
   volte con la lingua dal percorso, vedi percorso.test.ts). */
Deno.test('lang accetta solo le quattro lingue del sito', () => {
  assertEquals(parametriOspite('lang=it').lang, 'it');
  assertEquals(parametriOspite('lang=de').lang, 'de');
  assertEquals(parametriOspite('lang=en').lang, 'en');
  assertEquals(parametriOspite('lang=fr').lang, 'fr');
  assertEquals(parametriOspite('lang=zz').lang, null);
  assertEquals(parametriOspite('lang=IT').lang, null); // maiuscole non contano: non e' fra le quattro stringhe esatte
});

/* --------- normalizzaLingua: l e lang nella stessa query --------- */

Deno.test('senza l, lang prende il suo posto', () => {
  const q = normalizzaLingua('lang=de');
  assertEquals(new URLSearchParams(q).get('l'), 'de');
});

/* Il caso che da' il nome al requisito: "l vince se ci sono entrambi" —
   se questa regola si invertisse (lang sovrascrive l), un ospite che avesse
   scelto esplicitamente un'altra lingua col selettore in alto a destra,
   tornando sulla stessa richiesta (indirizzo con ancora `lang=` attaccato),
   se la vedrebbe cambiare sotto i piedi. */
Deno.test('l vince su lang quando ci sono entrambi', () => {
  const q = normalizzaLingua('l=fr&lang=de');
  assertEquals(new URLSearchParams(q).get('l'), 'fr');
});

Deno.test('senza ne l ne lang, normalizzaLingua non inventa niente', () => {
  const q = normalizzaLingua('altro=1');
  assertEquals(new URLSearchParams(q).get('l'), null);
  assertEquals(new URLSearchParams(q).get('altro'), '1');
});

/* una lingua inventata in lang non deve mai finire su l: se lo facesse, un
   `?lang=zz` scavalcherebbe la stessa difesa che linguaScelta gia' applica
   a `?l=` (vedi percorso.test.ts, "una lingua inventata nella query non
   passa") e una pagina che si fidasse ciecamente di `l` dopo la
   normalizzazione si troverebbe a cercare T['zz']. */
Deno.test('un lang inventato non finisce mai su l', () => {
  const q = normalizzaLingua('lang=zz');
  assertEquals(new URLSearchParams(q).get('l'), null);
});

/* gli altri parametri della query sopravvivono alla normalizzazione: non e'
   una funzione che ricostruisce la query da zero, ne cambia solo un pezzo */
Deno.test('normalizzaLingua non perde gli altri parametri', () => {
  const q = normalizzaLingua('t=abc123&lang=fr&nome=Mario');
  const p = new URLSearchParams(q);
  assertEquals(p.get('t'), 'abc123');
  assertEquals(p.get('l'), 'fr');
  assertEquals(p.get('nome'), 'Mario');
});

Deno.test('il numero della camera si legge, e uno assurdo vale come assente', () => {
  /* serve solo a dire all ospite dove si trova quando aggiunge una camera
     a una richiesta gia fatta: un numero sbagliato disorienterebbe piu
     del silenzio */
  assertEquals(parametriOspite('?camera=2').camera, 2);
  assertEquals(parametriOspite('?camera=1').camera, 1);
  for (const v of ['0', '-1', '11', '2.5', 'due', '']) {
    assertEquals(parametriOspite('?camera=' + v).camera, null, `camera=${v}`);
  }
  assertEquals(parametriOspite('').camera, null);
});
