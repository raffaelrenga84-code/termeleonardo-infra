/* ============================================================
   prompt.test.ts — il presidio sull'elenco dei tipi di richiesta.

   IL DIFETTO CHE PRESIDIA. Il prompt dichiara «Tipi di richiesta (allineati
   a TIPI_ATTIVI della funzione richieste)» e poi li elenca a mano. Il 17
   agosto 2026 quella dichiarazione era falsa: il Day Spa era diventato il
   sesto tipo, il prompt ne elencava cinque, e il chatbot non poteva
   registrare l'unico servizio per cui il lavoro sui buoni esiste. Una
   dichiarazione di allineamento che nessuno verifica invecchia in silenzio:
   chi legge il prompt crede alla riga fra parentesi e non va a controllare.

   PERCHE' UNA COPIA E NON UN IMPORT. `chat` e `richieste` sono due funzioni
   Supabase pubblicate separatamente: un import fra le due cartelle
   romperebbe il bundle — e' la ragione, gia' scritta, per cui
   `leggiStagioni()` e' riscritta in chat/index.ts invece di essere importata
   da buoni/ (vedi il commento li'). La copia quindi resta, ma smette di
   poter divergere: qui la si confronta voce per voce con l'originale. Un
   test gira da disco e non viene pubblicato, quindi l'import fra cartelle e'
   innocuo proprio dove serve. E' lo stesso rimedio dei listini
   (pagine/buoni/listino-copie.test.ts) e della differenza del buono
   (pagine/comune/buono-url.test.ts).
   ============================================================ */
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert';
import { REGOLE_CANALE, TIPI_RICHIESTA } from './prompt.ts';
import { TIPI_ATTIVI } from '../richieste/tipi.ts';

Deno.test('l elenco dei tipi della chat e esattamente TIPI_ATTIVI, voce per voce', () => {
  assertEquals([...TIPI_RICHIESTA].sort(), [...TIPI_ATTIVI].sort());
});

Deno.test('ogni tipo attivo e nominato nel prompt spedito al modello', () => {
  /* non basta che la costante sia giusta: il modello legge il TESTO, e la
     riga dell'elenco potrebbe essere stata ricopiata a mano accanto */
  for (const t of TIPI_ATTIVI) {
    assertStringIncludes(REGOLE_CANALE, '`' + t + '`');
  }
});

Deno.test('la riga dell elenco nel prompt non nomina tipi che la funzione richieste non conosce', () => {
  const trovata = /\*\*Tipi di richiesta\*\*[^\n]*\n([^\n]*)/.exec(REGOLE_CANALE);
  assert(trovata, 'la riga dei tipi non si trova piu nel prompt: e cambiata la forma?');
  const elencati = [...trovata[1].matchAll(/`([a-z]+)`/g)].map((m) => m[1]);
  assertEquals(elencati.sort(), [...TIPI_ATTIVI].sort());
});

/* Il Day Spa e' il motivo per cui questo giro di lavoro esiste: chi ha un
   buono regalo prenota da noi, e la chat deve poterlo registrare. */
Deno.test('il Day Spa e fra i tipi che la chat puo registrare', () => {
  assert(TIPI_RICHIESTA.includes('dayspa'), 'senza dayspa la chat non registra un ingresso');
});
