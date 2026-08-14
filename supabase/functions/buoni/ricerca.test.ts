import { assertEquals, assertThrows } from 'jsr:@std/assert';
import { filtroRicercaBuoni } from './ricerca.ts';

/* ---------- uno specchio, a tre livelli, di come PostgREST e Postgres
   leggono DAVVERO il filtro che filtroRicercaBuoni produce ----------
   Non è codice di produzione: serve solo qui, per i test, a rileggere il
   filtro esattamente come lo leggerebbe il sistema vero, tre passaggi in
   fila — una prima versione di questo file simulava solo la grammatica
   or() e dava per scontato che l'unico backslash che conta fosse quello
   davanti all'apice; una revisione, andando a leggere il parser vero di
   PostgREST (ApiRequest/QueryParams.hs) e la sostituzione di `*` per
   ilike/like (Query/SqlFragment.hs), ha trovato che non è così — un
   backslash scritto qui davanti a QUALSIASI carattere sparisce, non solo
   davanti ad apice o backslash — e quella prima versione dei test non se
   ne accorgeva perché replicava lo stesso errore invece di controllarlo.
   Questi tre livelli replicano quello che i sorgenti dicono per davvero:

   1. GRAMMATICA or() DI POSTGREST — condizioni separate da virgola,
      valore fra apici doppi; dentro l'apice, un backslash mangia SEMPRE
      se stesso e restituisce alla lettera il carattere dopo, qualunque
      esso sia (non solo apice o backslash).
   2. SOSTITUZIONE `*` → `%` DI ILIKE/LIKE — cieca, carattere per
      carattere, sul valore uscito dal livello 1: non guarda se quel `*`
      aveva un backslash davanti nel testo originale (quel backslash, se
      c'era, il livello 1 l'ha già consumato per conto suo).
   3. LIKE/ILIKE DI POSTGRES — nel valore uscito dal livello 2, un
      backslash rende letterale il carattere dopo (compreso un altro
      backslash: è così che si cerca un backslash vero); `%` e `_` non
      preceduti da backslash restano jolly veri.

   Se, per ogni condizione, il risultato finale è: jolly-sequenza, poi un
   carattere LETTERALE per ognuno dei caratteri digitati (con `*` che
   atterra come `%` letterale — mai come jolly, vedi ricerca.ts), poi
   jolly-sequenza — vuol dire che il testo di ricerca è stato cercato
   alla lettera dall'inizio alla fine, senza aprire sintassi né jolly
   che non gli competono. È questo, non la stringa intermedia, il fatto
   che conta davvero — ed è questo che i test qui sotto controllano. */

type Condizione = { colonna: string; operatore: string; valoreGrezzo: string };

function leggiCondizioniOr(filtro: string): Condizione[] {
  const condizioni: Condizione[] = [];
  let i = 0;
  while (i < filtro.length) {
    const p1 = filtro.indexOf('.', i);
    const colonna = filtro.slice(i, p1);
    const p2 = filtro.indexOf('.', p1 + 1);
    const operatore = filtro.slice(p1 + 1, p2);
    i = p2 + 1;
    let valoreGrezzo = '';
    if (filtro[i] === '"') {
      i++;
      for (;;) {
        if (i >= filtro.length) throw new Error('apice di chiusura mancante: ' + filtro);
        if (filtro[i] === '"') { i++; break; }
        if (filtro[i] === '\\') {
          if (i + 1 >= filtro.length) throw new Error('backslash a fine valore: ' + filtro);
          valoreGrezzo += filtro[i + 1];   // qualunque carattere sia: la regola vera di PostgREST
          i += 2;
          continue;
        }
        valoreGrezzo += filtro[i];
        i++;
      }
    } else {
      const fine = filtro.indexOf(',', i);
      const e = fine === -1 ? filtro.length : fine;
      valoreGrezzo = filtro.slice(i, e);
      i = e;
    }
    condizioni.push({ colonna, operatore, valoreGrezzo });
    if (filtro[i] === ',') i++;
  }
  return condizioni;
}

type Token =
  | { tipo: 'letterale'; carattere: string }
  | { tipo: 'jolly-sequenza' }
  | { tipo: 'jolly-carattere' };

/* livello 3: come Postgres legge il pattern LIKE/ILIKE finale */
function interpretaPatternLike(pattern: string): Token[] {
  const token: Token[] = [];
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === '\\') {
      if (i + 1 >= pattern.length) throw new Error('pattern LIKE termina con un backslash a vuoto');
      token.push({ tipo: 'letterale', carattere: pattern[i + 1] });
      i += 2;
    } else if (c === '%') {
      token.push({ tipo: 'jolly-sequenza' }); i++;
    } else if (c === '_') {
      token.push({ tipo: 'jolly-carattere' }); i++;
    } else {
      token.push({ tipo: 'letterale', carattere: c }); i++;
    }
  }
  return token;
}

/* i tre livelli in fila: dal filtro che filtroRicercaBuoni produce ai
   token finali che decidono davvero cosa viene trovato */
function pipelinePostgrest(filtro: string): Array<{ colonna: string; operatore: string; token: Token[] }> {
  return leggiCondizioniOr(filtro).map(({ colonna, operatore, valoreGrezzo }) => {
    /* livello 2: solo per like/ilike, e cieco al backslash — proprio come Query/SqlFragment.hs */
    const dopoStar = (operatore === 'ilike' || operatore === 'like')
      ? valoreGrezzo.replace(/\*/g, '%')
      : valoreGrezzo;
    return { colonna, operatore, token: interpretaPatternLike(dopoStar) };
  });
}

const COLONNE_ATTESE = ['codice', 'acquirente', 'acquirente_email', 'destinatario', 'destinatario_email'];

/* i token finali attesi per un testo di ricerca cercato alla lettera:
   jolly all'inizio e alla fine (il "contains" che aggiunge filtroRicercaBuoni),
   un letterale per ogni carattere digitato — tranne l'asterisco, che non può
   restare sé stesso (PostgREST lo sostituisce sempre con %, vedi ricerca.ts)
   e il cui esito corretto è un `%` letterale, MAI un jolly aperto */
function tokenAttesi(cerca: string): Token[] {
  const interni: Token[] = [...cerca].map((carattere) =>
    ({ tipo: 'letterale', carattere: carattere === '*' ? '%' : carattere }));
  return [{ tipo: 'jolly-sequenza' }, ...interni, { tipo: 'jolly-sequenza' }];
}

/* controlla, su tutte e cinque le colonne, che il testo digitato venga
   cercato alla lettera dall'inizio alla fine — nessuna sintassi aperta,
   nessun jolly che il testo non aveva intenzione di aprire */
function assertRicercaLetterale(cerca: string) {
  const condizioni = pipelinePostgrest(filtroRicercaBuoni(cerca));
  assertEquals(condizioni.length, 5, 'sempre cinque condizioni, qualunque sia il testo');
  assertEquals(condizioni.map((c) => c.colonna), COLONNE_ATTESE);
  const attesi = tokenAttesi(cerca);
  for (const c of condizioni) {
    assertEquals(c.operatore, 'ilike', `colonna ${c.colonna}`);
    assertEquals(c.token, attesi, `colonna ${c.colonna}`);
  }
}

/* ---------- comportamento invariato rispetto a prima ---------- */

Deno.test('cerca ora anche nelle due colonne email, oltre alle tre di prima', () => {
  const condizioni = leggiCondizioniOr(filtroRicercaBuoni('mario'));
  assertEquals(condizioni.map((c) => c.colonna), COLONNE_ATTESE);
});

Deno.test('resta insensibile a maiuscole e minuscole: ogni condizione usa ilike', () => {
  for (const c of leggiCondizioniOr(filtroRicercaBuoni('mario'))) assertEquals(c.operatore, 'ilike');
});

Deno.test('un testo senza caratteri speciali cerca la stessa sottostringa di prima, su ogni colonna', () => {
  assertRicercaLetterale('mario rossi');
});

Deno.test('un\'email vera, con punto e chiocciola, arriva intatta nel filtro', () => {
  assertRicercaLetterale('raffael.renga@hotmail.it');
});

/* ---------- i caratteri richiesti dal collaudo: virgole, parentesi, apostrofi, asterischi ---------- */

Deno.test('una virgola nel testo di ricerca non spezza il filtro in condizioni in più', () => {
  assertRicercaLetterale('Mario, Rossi');
});

Deno.test('una parentesi nel testo di ricerca non spezza il raggruppamento or()', () => {
  assertRicercaLetterale('Hotel (Terme)');
});

Deno.test('un apostrofo (nomi italiani, "D\'Amico", "dell\'Hotel") passa cercato alla lettera', () => {
  assertRicercaLetterale("D'Amico");
});

Deno.test('un asterisco viene cercato senza aprire un jolly incontrollato: al più un "%" letterale, mai un jolly', () => {
  const condizioni = pipelinePostgrest(filtroRicercaBuoni('a*b'));
  for (const c of condizioni) {
    /* il punto centrale del collaudo: il token per l'asterisco NON è un
       jolly-sequenza (che matcherebbe qualunque cosa fra "a" e "b"), è un
       letterale — la differenza fra "risultati che non c'entrano" e una
       ricerca innocua che al più non trova quell'unico carattere */
    assertEquals(c.token, [
      { tipo: 'jolly-sequenza' },
      { tipo: 'letterale', carattere: 'a' },
      { tipo: 'letterale', carattere: '%' },
      { tipo: 'letterale', carattere: 'b' },
      { tipo: 'jolly-sequenza' },
    ]);
  }
  assertRicercaLetterale('a*b');   // stessa cosa, con l'helper generico
});

/* ---------- oltre il collaudo richiesto: gli altri caratteri della stessa famiglia ---------- */

Deno.test('un apice doppio nel testo di ricerca non chiude la citazione anzitempo', () => {
  assertRicercaLetterale('il buono "regalo"');
});

Deno.test('un backslash nel testo di ricerca resta un carattere letterale, non uno sfuggimento a metà', () => {
  assertRicercaLetterale('C:\\cartella');
});

Deno.test('percento e trattino basso — i jolly di ilike — sono cercati alla lettera, non come jolly', () => {
  assertRicercaLetterale('50% sconto_vero');
});

Deno.test('un testo con TUTTI i caratteri critici insieme resta una ricerca letterale, non una sintassi', () => {
  assertRicercaLetterale('D\'Amico, "Il Re" (Bar) 50%_a*b \\ fine');
});

Deno.test('un tentativo di iniettare una condizione extra tramite virgole e parentesi fallisce', () => {
  /* un testo pensato per somigliare a "chiudo la mia condizione e ne apro
     un'altra" — se lo schermo funziona, resta un unico valore di ricerca */
  assertRicercaLetterale('%",stato.eq.pagato,x.ilike."%');
});

/* ---------- il parser-specchio stesso: non deve accettare un filtro malformato in silenzio ---------- */

Deno.test('lo specchio dei test segnala un apice di chiusura mancante invece di leggere a vanvera', () => {
  assertThrows(() => leggiCondizioniOr('codice.ilike."%aperto senza chiudere%'));
});
