/* ============================================================
   ruoli.test.ts — chi può leggere le richieste, e quali.

   IL BUCO CHE CHIUDE. Fino al 18 agosto 2026 `autorizzato()` in
   richieste/index.ts finiva così:

       const { data } = await db.auth.getUser(token);
       return !!data?.user;

   QUALUNQUE utente autenticato. Nessun controllo sul dominio, nessuno
   sull'indirizzo IP. E sul progetto la registrazione era APERTA
   (`disable_signup: false`), quindi la strada era: registrarsi con un
   indirizzo qualsiasi, confermarlo, ottenere un token, e chiamare
   `?a=elenco` — che restituisce nome, email, telefono e dettagli di ogni
   ospite che ha scritto dal sito.

   La funzione usa la chiave di servizio, quindi RLS non protegge nulla:
   quel cancello era l'unica difesa.

   La funzione `buoni` il controllo sul dominio ce l'aveva già
   (DOMINI_AMMESSI). Questa no: la stessa protezione, in due funzioni, con
   due livelli diversi — ed è sempre quella più debole a decidere.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { dominioAmmesso, ruoloDi, tipiVisibili, vedeTutto } from './ruoli.ts';

/* ---------- il dominio ---------- */

Deno.test('gli indirizzi dell hotel passano', () => {
  for (const e of ['reception@termeleonardo.com', 'SPA@Termeleonardo.com', 'x@hldv.com']) {
    assert(dominioAmmesso(e), `doveva passare: ${e}`);
  }
});

/* IL BUCO: un indirizzo qualunque. Chiunque poteva registrarsi. */
Deno.test('un indirizzo estraneo non passa, nemmeno se somiglia', () => {
  for (
    const e of [
      'chiunque@gmail.com', '', null, undefined,
      /* i travestimenti classici: sottodominio, suffisso, prefisso */
      'x@termeleonardo.com.evil.net', 'x@nontermeleonardo.com', 'x@termeleonardo.co',
      'termeleonardo.com@gmail.com',
    ]
  ) {
    assertEquals(dominioAmmesso(e as string), false, `doveva essere respinto: ${e}`);
  }
});

/* ---------- i ruoli ---------- */

Deno.test('la reception vede tutto', () => {
  assertEquals(ruoloDi('reception@termeleonardo.com'), 'reception');
  assert(vedeTutto('reception'));
});

Deno.test('la spa vede solo trattamenti e day spa', () => {
  assertEquals(ruoloDi('spa@termeleonardo.com'), 'spa');
  assertEquals(vedeTutto('spa'), false);
  const tipi = tipiVisibili('spa');
  assertEquals([...tipi].sort(), ['dayspa', 'trattamenti']);
});

/* Non deve vedere transfer, green fee, maestro, soggiorni: sono dati di
   ospiti che con la spa non c'entrano niente. */
Deno.test('la spa non vede i tipi che non la riguardano', () => {
  const tipi = tipiVisibili('spa');
  for (const fuori of ['transfer', 'greenfee', 'maestro', 'soggiorno']) {
    assertEquals(tipi.includes(fuori), false, `${fuori} non doveva essere visibile alla spa`);
  }
});

/* Amministrazione resta come oggi — tutto — in attesa della decisione su
   cosa NON le interessa. Restringere indovinando toglierebbe a qualcuno
   qualcosa che usa ogni giorno, e nessuno saprebbe perche'. */
Deno.test('amministrazione per ora vede tutto, e lo dice il nome del ruolo', () => {
  assertEquals(ruoloDi('amministrazione@termeleonardo.com'), 'amministrazione');
  assert(vedeTutto('amministrazione'));
});

/* IL PRINCIPIO: un indirizzo del dominio giusto ma non previsto NON entra.
   L'errore giusto qui e' escludere: un account nuovo che si aggiunge da
   solo con pieni poteri e' il difetto da cui nasce questo file. Chi resta
   fuori telefona e lo si aggiunge in una riga. */
Deno.test('un indirizzo dell hotel non previsto non ha un ruolo', () => {
  for (const e of ['direzione@termeleonardo.com', 'nuovo@hldv.com']) {
    assertEquals(ruoloDi(e), null, `${e} non doveva avere un ruolo`);
  }
});

Deno.test('senza ruolo non si vede niente', () => {
  assertEquals(vedeTutto(null), false);
  assertEquals(tipiVisibili(null), []);
});

/* Le maiuscole e gli spazi arrivano da come uno digita l'indirizzo: non
   devono decidere se entra. */
Deno.test('maiuscole e spazi non cambiano il ruolo', () => {
  assertEquals(ruoloDi('  Reception@TERMELEONARDO.com '), 'reception');
});
