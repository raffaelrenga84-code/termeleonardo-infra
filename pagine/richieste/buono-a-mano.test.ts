/* ============================================================
   buono-a-mano.test.ts — il codice del buono scritto a mano.

   IL DIFETTO CHE PRESIDIA. Due decisioni giuste, ognuna per conto suo:

     · il foglio A4 stampa `hoteltermeleonardo.com/it/day-spa` SENZA il
       codice, perché è un indirizzo che si digita da un foglio di carta e
       ogni carattere in più è un carattere in più da sbagliare;
     · il modulo leggeva il codice solo da `?buono=` nell'indirizzo.

   Insieme non lasciavano nessuna strada. Chi digitava l'indirizzo dal foglio
   arrivava su un modulo dove il suo buono non si poteva nominare: compilava
   una richiesta normale, leggeva «le confermiamo giorno e prezzo», e in
   reception arrivava una richiesta senza alcun segno del buono — cioè la
   telefonata che tutto questo lavoro esiste per evitare.

   Trovato guardando la pagina in un browser vero: fra i 24 campi che
   l'ospite può compilare non ce n'era nessuno per il buono.

   La correzione NON crea una seconda strada: chi scrive il codice a mano
   viene rimandato allo stesso indirizzo con `?buono=` dentro, e da lì gira
   esattamente il codice che gira già. Queste prove presidiano proprio
   quello — che non nasca una seconda via da tenere allineata.

   Si guarda la SORGENTE della pagina, come fanno già avviso-dayspa.test.ts
   e regala/serale.test.ts: il modulo è un file HTML, non c'è niente da
   importare.
   ============================================================ */
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert';

const SORGENTE = Deno.readTextFileSync(new URL('index.html', import.meta.url));
const LINGUE = 4;

Deno.test('c e un campo dove scrivere il codice a mano', () => {
  assertStringIncludes(SORGENTE, 'id="fBuonoCodice"');
  assertStringIncludes(SORGENTE, 'id="bBuonoApri"');
});

Deno.test('l invito a usare il buono e tradotto in tutte e quattro le lingue', () => {
  for (const chiave of ['invitoTit', 'invitoGuida', 'invitoApri', 'invitoVuoto']) {
    const quante = SORGENTE.split(`${chiave}:`).length - 1;
    assertEquals(quante, LINGUE, `${chiave} compare ${quante} volte invece di ${LINGUE}`);
  }
});

/* Il presidio vero. Se un domani qualcuno ripulisse il codice scritto a mano
   con una regola sua — una maiuscola in meno, un carattere in più — un
   buono accettato dal link dell'email verrebbe rifiutato scritto a mano, e
   l'ospite non avrebbe modo di capire perché. */
Deno.test('il codice a mano passa dalla stessa ripulitura di quello dell indirizzo', () => {
  assertStringIncludes(SORGENTE, 'normalizzaCodice');
  const importa = SORGENTE.match(/import \{([^}]*)\} from '\/comune\/buono-url\.js'/);
  assert(importa, 'la pagina non importa piu da buono-url.js');
  assert(
    importa[1].includes('normalizzaCodice'),
    'normalizzaCodice non arriva da buono-url.js: la ripulitura e stata riscritta in pagina',
  );
});

/* Chi ha gia' il codice nell'indirizzo il riquadro ce l'ha: l'invito
   sarebbe un secondo posto dove mettere la stessa cosa. */
Deno.test('l invito non si mostra quando il codice e gia nell indirizzo', () => {
  assertStringIncludes(SORGENTE, 'function invitoBuono');
  const corpo = SORGENTE.slice(SORGENTE.indexOf('function invitoBuono'));
  const fine = corpo.indexOf('\n}');
  assertStringIncludes(
    corpo.slice(0, fine),
    'if (CODICE_BUONO) return',
    'invitoBuono non si tira indietro quando il codice e gia nell indirizzo',
  );
});
