/* ospite-url.js — i dati dell'ospite quando arrivano dall'INDIRIZZO, non dal
   nostro database.

   Da oggi le email della reception hanno pulsanti («Richiedi il transfer»,
   «Richiedi trattamenti e massaggi») che portano ai moduli del sito con i
   dati dell'ospite gia' scritti nella query:

     ?rif=O26%2F19130&nome=Marcheselli+Alessandro&email=...&tel=...
     &arrivo=2026-08-17&partenza=2026-08-19&adulti=1&lang=it

   Chi li ha costruiti (il sistema che genera le email, non questo codice)
   prende quei dati da Fidra, non dal nostro database: e' un ripiego per chi
   non ha un token `?t=`, non una fonte di cui fidarsi.

   ORDINE DI FIDUCIA. Dove esiste gia' una precompilazione da token (vedi
   `precompila()` in richieste/index.html e in richieste/transfer/index.html:
   `?t=TOKEN` interroga il nostro database e riempie OSPITE), quella vince
   SEMPRE. I valori di questo modulo riempiono solo i campi che il token non
   ha dato — ad esempio il telefono, che l'endpoint di precompilazione non
   restituisce mai. Le pagine fanno questa scelta al momento di usare i
   valori (`OSPITE?.nome || url.nome`), non questo modulo: qui dentro non si
   sa nemmeno se un token esiste.

   CONTRATTO — RIPULISCE, NON SFUGGE. Questo modulo valida e TRONCA, non fa
   escaping. I valori che restituisce sono ancora testo grezzo: un nome
   corto e dentro i limiti puo' benissimo contenere virgolette o un tag
   <script>, perche' il compito di questo modulo e' scartare quello che non
   ha senso (troppo lungo, una data che non esiste, un intero fuori scala),
   non renderlo sicuro da stampare. Chi scrive questi valori dentro un
   attributo HTML (value="...") DEVE comunque passarli per `esc()`, come gia'
   fa per ogni altro campo di queste pagine — e' quello il punto in cui un
   indirizzo malevolo verrebbe reso innocuo, e va fatto una volta sola, li'.

   Sono valori che arrivano da un indirizzo: chiunque puo' scriverci dentro
   qualsiasi cosa e mandarlo a un ospite spacciandolo per un link
   dell'hotel vero — l'indirizzo E' quello vero, quindi ci si fida. */

export const LINGUE = ['it', 'de', 'en', 'fr'];

/* Stessi limiti che il server accetta gia' per una richiesta vera — vedi
   richieste/valida.ts, costante LIMITI. Troncare qui a un numero piu' largo
   non servirebbe a niente (il server rifiuterebbe comunque il di piu'), e
   troncare a un numero piu' stretto taglierebbe un nome vero che il server
   avrebbe accettato: deve essere lo STESSO numero, non una stima. */
const NOME_MAX = 80;
const EMAIL_MAX = 120;
const TEL_MAX = 40;

/* Il riferimento dell'offerta non e' un campo validato dal server (finisce
   nelle note, che li' arrivano fino a 2000 caratteri): il tetto qui e'
   solo per non lasciare che un indirizzo costruito ad arte riempia le note
   della richiesta con qualcosa che non e' piu' un riferimento. Un vero
   riferimento Fidra ("O26/19130") ci sta con largo margine. */
const RIF_MAX = 60;

/* Lo stesso intervallo di OSPITI_MAX in richieste/valida.ts: e' il tetto che
   il server applica gia' a una richiesta di soggiorno vera. */
const ADULTI_MIN = 1;
const ADULTI_MAX = 10;

const testo = (v, max) => {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : '';
};

/* stessa forma accettata da richieste/valida.ts (validaContatti): non un
   controllo severo, solo "assomiglia a un indirizzo email" */
const EMAIL_RE = /.+@.+\..+/;

function emailValida(v) {
  const s = testo(v, EMAIL_MAX);
  return s && EMAIL_RE.test(s) ? s : '';
}

/* La data deve esistere DAVVERO: new Date('2026-02-31') non protesta, scivola
   al 3 marzo. Stesso controllo di richieste/tipi.ts e valida.ts (funzione
   `giorno`, identica in entrambe): formato fisso AAAA-MM-GG, poi si
   ricompone la data e si confronta con la stringa di partenza. Se non
   combaciano piu', la data non esisteva. */
function dataValida(v) {
  const s = String(v ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const d = new Date(s + 'T12:00:00Z');
  if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) return '';
  return s;
}

/* Un intero, non un numero qualunque: "2.5" persone non esistono. Fuori
   dall'intervallo sensato (o non un numero affatto, es. "abc") il valore
   si ignora — meglio un campo vuoto che un numero assurdo gia' scritto. */
function adultiValidi(v) {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= ADULTI_MIN && n <= ADULTI_MAX ? n : null;
}

/** Legge e ripulisce i dati dell'ospite dalla query di un indirizzo come
    quello dei pulsanti della reception. Ogni valore che non ha senso
    (troppo lungo, una data inesistente, un adulti fuori scala, un'email
    senza la forma di un'email) sparisce — diventa stringa vuota o, per
    `adulti` e `lang`, `null` — invece di arrivare al modulo cosi' com'era.

    Non fa escaping: vedi il commento in cima al file. */
export function parametriOspite(ricerca) {
  const q = new URLSearchParams(ricerca || '');
  return {
    rif: testo(q.get('rif'), RIF_MAX),
    nome: testo(q.get('nome'), NOME_MAX),
    email: emailValida(q.get('email')),
    tel: testo(q.get('tel'), TEL_MAX),
    arrivo: dataValida(q.get('arrivo')),
    partenza: dataValida(q.get('partenza')),
    adulti: adultiValidi(q.get('adulti')),
    lang: LINGUE.includes(q.get('lang')) ? q.get('lang') : null,
  };
}

/** `l` e `lang` nella stessa query. Le pagine leggono gia' `?l=` (e' il
    selettore di lingua in alto a destra); i link della reception, che
    nascono dai dati di Fidra e non dal nostro codice, mandano `lang=`.

    Restituisce una query in cui, se `l` manca ma `lang` e' una delle
    quattro lingue, viene COPIATO su `l`. Da usare prima di passare la query
    a qualunque calcolo di lingua gia' esistente (`linguaScelta` di
    percorso.js o di prenota/logica.js, o la lettura diretta di `?l=` nelle
    pagine che non hanno un modulo apposito): ognuna continua a scegliere la
    lingua esattamente come gia' faceva, e in piu' capisce anche `lang=`.

    `l` vince se ci sono entrambi perche' non viene MAI sovrascritto, solo
    completato quando manca. */
export function normalizzaLingua(ricerca) {
  const q = new URLSearchParams(ricerca || '');
  if (!LINGUE.includes(q.get('l')) && LINGUE.includes(q.get('lang'))) {
    q.set('l', q.get('lang'));
  }
  return q.toString();
}
