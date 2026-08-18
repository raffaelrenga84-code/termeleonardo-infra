/* ============================================================
   ruoli-coerenza.test.ts — le due copie dei ruoli non devono divergere.

   PERCHE' CI SONO DUE COPIE. `strumenti/pubblica.js` manda alla Management
   API soltanto i file della cartella della funzione: `richieste/` non PUO'
   importare da `buoni/`, e un modulo condiviso non arriverebbe mai lassu'.
   Cosi' i ruoli sono definiti due volte — in richieste/ruoli.ts e in
   buoni/ruoli.ts — e sono la stessa decisione scritta in due posti.

   IL DIFETTO CHE PRESIDIA. Fra un mese qualcuno aggiunge
   `direzione@termeleonardo.com` in un file e si dimentica dell'altro:
   quella persona vede le richieste degli ospiti e non i buoni, o il
   contrario. Nessuno se ne accorge subito, e quando se ne accorge non
   capisce perche'.

   Il deploy non puo' tenerle insieme. Questa prova si': importa tutte e due
   e pretende che diano la stessa risposta sugli stessi indirizzi.

   E' lo stesso presidio gia' messo su ricerca.ts, per la stessa ragione.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { dominioAmmesso, ruoloDi as ruoloRichieste, vedeTutto } from './ruoli.ts';
import { ruoloDi as ruoloBuoni, vedeIBuoni } from '../buoni/ruoli.ts';

/* Gli indirizzi che esistono davvero (verificati in auth.users il 18 agosto
   2026), piu' quelli che NON devono entrare. Se qualcuno aggiunge un ruolo,
   lo aggiunga anche qui: e' il posto dove le due copie si guardano in
   faccia. */
const INDIRIZZI = [
  'reception@termeleonardo.com',
  'spa@termeleonardo.com',
  'amministrazione@termeleonardo.com',
  /* i respinti */
  'direzione@termeleonardo.com',
  'chiunque@gmail.com',
  'x@termeleonardo.com.evil.net',
  'x@nontermeleonardo.com',
  '',
];

Deno.test('lo stesso indirizzo ha lo stesso ruolo nelle due funzioni', () => {
  for (const e of INDIRIZZI) {
    assertEquals(
      ruoloRichieste(e),
      ruoloBuoni(e),
      `«${e}» ha ruoli diversi nelle due copie: richieste dice ${ruoloRichieste(e)}, buoni dice ${ruoloBuoni(e)}`,
    );
  }
});

/* La prova sopra passerebbe anche se tutte e due dicessero sempre null.
   Questa impedisce quel vuoto. */
Deno.test('almeno un indirizzo ha davvero un ruolo, in tutte e due', () => {
  const conRuolo = INDIRIZZI.filter((e) => ruoloRichieste(e) !== null);
  assertEquals(conRuolo.length, 3, `indirizzi con ruolo: ${conRuolo.join(', ')}`);
  for (const e of conRuolo) assert(ruoloBuoni(e), `${e} ha ruolo solo in richieste`);
});

/* I POTERI DEVONO ANDARE D'ACCORDO. Chi vede tutte le richieste deve vedere
   tutti i buoni, e chi ne vede una parte deve vederne una parte anche
   dall'altra parte. Un ruolo che vede tutto in una funzione e niente
   nell'altra e' un errore di distrazione, non una scelta. */
Deno.test('chi vede tutte le richieste vede tutti i buoni', () => {
  for (const e of INDIRIZZI) {
    const r = ruoloRichieste(e);
    if (!r) continue;
    if (vedeTutto(r)) {
      assertEquals(vedeIBuoni(ruoloBuoni(e)), 'tutti', `${e} vede tutte le richieste ma non tutti i buoni`);
    } else {
      assertEquals(vedeIBuoni(ruoloBuoni(e)), 'solo spa', `${e} vede una parte delle richieste ma tutti i buoni`);
    }
  }
});

/* Il controllo sul dominio e' l'unica difesa contro un estraneo che si
   registra: se le due copie non lo applicano allo stesso modo, una delle
   due funzioni ha una porta piu' larga — ed e' sempre quella piu' larga a
   decidere quanto vale l'insieme. */
Deno.test('il dominio si giudica allo stesso modo nelle due copie', () => {
  for (const e of INDIRIZZI) {
    /* buoni/ruoli.ts non esporta dominioAmmesso: si osserva dal fuori —
       un dominio non ammesso non puo' produrre un ruolo, mai */
    if (!dominioAmmesso(e)) {
      assertEquals(ruoloBuoni(e), null, `«${e}» ha un dominio non ammesso ma buoni gli da un ruolo`);
    }
  }
});
