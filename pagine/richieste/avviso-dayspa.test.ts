/* ============================================================
   avviso-dayspa.test.ts — la prima frase che legge un ospite Day Spa.

   IL DIFETTO CHE PRESIDIA. Il riquadro in cima al modulo diceva «Le
   confermiamo giorno, ORA e prezzo» anche sul Day Spa, che un'ora non ce
   l'ha: e' l'ingresso di una giornata (9:00–18:30). E' la prima cosa che
   quell'ospite legge, e prometteva una cosa che il servizio non da'.

   Sono quattro lingue e quattro frasi scritte a mano: la lingua che nessuno
   rilegge e' quella che resta indietro. Qui si guarda la SORGENTE della
   pagina, come fanno gia' regala/serale.test.ts e regala/importo.test.ts —
   il modulo e' un file HTML, non c'e' niente da importare.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const SORGENTE = Deno.readTextFileSync(new URL('index.html', import.meta.url));
const LINGUE = 4;

/* le frasi arrivano con gli apici tipografici dentro (’), quindi si prende
   tutto fino all'apice dritto che chiude la stringa JavaScript */
const frasi = (chiave: string): string[] =>
  [...SORGENTE.matchAll(new RegExp(`${chiave}:'([^']*(?:’[^']*)*)'`, 'g'))].map((m) => m[1]);

/* La promessa, come e' scritta nelle quattro lingue. Si guarda la promessa
   intera e non la sola parola «ora»: la frase finisce con «di solito entro
   poche ore», che parla del tempo di risposta dell'hotel e non di un orario
   dato all'ospite. Cercare `\bore\b` avrebbe pescato quella. */
const PROMETTE_UN_ORA = /giorno, ora|Tag, Uhrzeit|day, time|jour, heure/;

Deno.test('tutte e quattro le lingue hanno la frase del Day Spa', () => {
  assertEquals(frasi('avvisoDayspa').length, LINGUE);
  assertEquals(frasi('avviso').length, LINGUE, 'gli altri tipi tengono la loro');
});

Deno.test('la frase del Day Spa non promette un ora, che quel servizio non ha', () => {
  for (const f of frasi('avvisoDayspa')) {
    assert(!PROMETTE_UN_ORA.test(f), `questa frase nomina un orario: ${f}`);
  }
});

Deno.test('la frase del Day Spa nomina comunque il giorno e il prezzo', () => {
  const attese = [/giorno e prezzo/, /Tag und Preis/, /day and price/, /jour et prix/];
  const trovate = frasi('avvisoDayspa');
  for (const attesa of attese) {
    assert(trovate.some((f) => attesa.test(f)), `nessuna frase corrisponde a ${attesa}`);
  }
});

/* la frase degli altri tipi NON cambia: li' l'ora si conferma davvero (un
   transfer, una partenza al campo, un massaggio) */
Deno.test('gli altri tipi continuano a promettere anche l ora', () => {
  for (const f of frasi('avviso')) {
    assert(PROMETTE_UN_ORA.test(f), `questa frase ha perso l orario: ${f}`);
  }
});

Deno.test('e la pagina sceglie davvero la frase del Day Spa sul modulo Day Spa', () => {
  assert(
    /TIPO === 'dayspa' \? t\.avvisoDayspa : t\.avviso/.test(SORGENTE),
    'le frasi ci sono ma nessuno le sceglie: il riquadro le mostrerebbe sempre uguali',
  );
});
