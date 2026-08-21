/* ============================================================
   numeri-invia-arrivo.test.ts — chi ricarica non brucia i numeri.

   IL DIFETTO CHE PRESIDIA. In `?a=invia-arrivo` l'ordine era: valida,
   prendi fino a TRE numeri di pratica, poi chiedi «l'ha già mandato?» e
   rispondi 409. Un ospite che ricarica la pagina e rimanda — il gesto
   più naturale del mondo davanti a una pagina lenta — se ne porta via
   tre numeri a ogni giro. La serie RS-2026-#### si riempie di buchi, e
   chi la guarda non sa distinguere un numero saltato da una richiesta
   sparita.

   PERCHÉ NON BASTAVA SPOSTARE IL CONTROLLO. Quello che c'è sta appena
   prima dell'insert APPOSTA: lì la finestra fra la lettura e la
   scrittura non contiene nessun'altra chiamata di rete, ed è la più
   stretta ottenibile senza un indice unico su `arrivo_token` — che non
   si può mettere, perché un invio riuscito lascia già fino a tre righe
   con lo stesso token. Spostarlo e basta avrebbe chiuso un fastidio
   allargando una corsa: due invii simultanei sarebbero passati
   entrambi.

   Quindi la domanda si fa DUE volte: una presto, che ferma il caso
   ordinario prima di toccare la numerazione, e una tardi, che resta
   dov'era a fare la guardia sulla corsa.

   COME SI PROVA. Il gestore parla col database a ogni riga e non si può
   eseguire senza; quello che si può verificare è l'ORDINE, che è
   esattamente ciò che è andato storto. Si guarda dove cadono, dentro il
   blocco di `?a=invia-arrivo`, le due domande e la numerazione: una
   prima, la numerazione in mezzo, una dopo. Un test che cercasse la
   parola «arrivoGiaInviato» sarebbe verde anche con le due chiamate
   nell'ordine sbagliato — ed è proprio l'ordine il difetto.
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const SORGENTE = Deno.readTextFileSync(new URL('index.ts', import.meta.url));

/** Il corpo del ramo `?a=invia-arrivo`, fino al ramo successivo. */
function bloccoInviaArrivo(): string {
  const da = SORGENTE.indexOf("if (azione === 'invia-arrivo') {");
  assert(da >= 0, "il ramo ?a=invia-arrivo non si trova: il gestore e cambiato");
  /* il ramo successivo comincia con un altro `if (azione === ` in colonna 2 */
  const a = SORGENTE.indexOf("\n  if (azione === '", da + 10);
  assert(a > da, 'la fine del ramo ?a=invia-arrivo non si trova');
  return SORGENTE.slice(da, a);
}

/** Le posizioni di tutte le occorrenze di `ago` dentro `fieno`. */
function posizioni(fieno: string, ago: string): number[] {
  const fuori: number[] = [];
  for (let i = fieno.indexOf(ago); i >= 0; i = fieno.indexOf(ago, i + 1)) fuori.push(i);
  return fuori;
}

Deno.test('la domanda «gia mandato?» si fa anche PRIMA di prendere i numeri', () => {
  const b = bloccoInviaArrivo();
  const numerazione = posizioni(b, 'prossimo_numero_richiesta');
  assert(
    numerazione.length > 0,
    'la numerazione non si trova nel ramo: la prova non sta guardando niente',
  );
  /* le CHIAMATE, non la parola: `arrivoGiaInviato(` compare una volta
     sola, dentro la funzione che le due chiamate condividono */
  const domande = posizioni(b, 'await rifiutoSeGiaInviato()');
  assert(
    domande.length >= 2,
    `la domanda «gia mandato?» si fa ${domande.length} volta: chi ricarica ` +
      'si porta via fino a tre numeri di pratica prima del 409',
  );
  assert(
    domande[0] < numerazione[0],
    'la prima domanda cade DOPO la numerazione: i numeri si bruciano lo stesso',
  );
  /* e la domanda e' quella giusta: «c'e' gia' un arrivo?», non «c'e'
     gia' una riga?» — vedi arrivoGiaInviato() in arrivo-invio.ts */
  assert(
    b.includes('arrivoGiaInviato('),
    'la funzione non chiede piu ad arrivoGiaInviato(): contare le righe chiuderebbe fuori chi ha usato un modulo del sito con lo stesso token',
  );
});

Deno.test('e quella tardi resta dov era, appena prima dell insert', () => {
  const b = bloccoInviaArrivo();
  const numerazione = posizioni(b, 'prossimo_numero_richiesta');
  const domande = posizioni(b, 'await rifiutoSeGiaInviato()');
  assert(
    domande.some((p) => p > numerazione[numerazione.length - 1]),
    'nessuna domanda dopo la numerazione: la finestra della corsa si e allargata, ' +
      'e due invii simultanei passerebbero tutti e due',
  );
});

Deno.test('la domanda e sempre la stessa, scritta una volta sola', () => {
  /* due copie della stessa lettura divergono al primo cambiamento: la
     seconda si dimentica, e resta a rispondere con una regola vecchia. */
  const b = bloccoInviaArrivo();
  /* la lettura per token e' LA domanda: l'insert sulla stessa tabella e'
     un'altra cosa e non va contato */
  const letture = posizioni(b, "eq('arrivo_token', t)").length;
  assert(
    letture === 1,
    `la lettura per token e scritta ${letture} volte: due copie divergono al ` +
      'primo cambiamento, e la seconda resta a rispondere con una regola vecchia',
  );
});
