import { assertEquals } from 'jsr:@std/assert';
import { indirizzoPerLingua, linguaScelta, PERCORSI, tipoScelto } from './percorso.js';

const TIPI = ['greenfee', 'maestro', 'trattamenti'];

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
