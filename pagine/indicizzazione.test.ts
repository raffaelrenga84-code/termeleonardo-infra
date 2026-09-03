/* ============================================================
   indicizzazione.test.ts — quali pagine possono comparire in una ricerca.

   IL DIFETTO CHE PRESIDIA, trovato il 19 agosto 2026 leggendo il sito con
   l'audit. `richieste/index.html` e' UNA pagina che serve SEDICI indirizzi:
   quattro servizi (trattamenti, green fee, maestro, day spa) per quattro
   lingue, attraverso le riscritture di hoteltermeleonardo.com. Tutti e
   sedici portano lo stesso titolo — «Richieste — Hotel Terme Leonardo» — e
   nessuna description. Per un motore sono sedici risultati identici che non
   dicono cosa offrono, e uno di quegli indirizzi e' `/it/day-spa`, cioe' la
   parola con cui il pubblico locale cerca: la occupava un modulo mentre la
   pagina vera, con milleduecento parole, sta su termeleonardo.com.

   Un modulo di richiesta e' un passaggio, non un approdo: chi cerca vuole
   la pagina che racconta il servizio, non il campo da compilare.

   MA NON TUTTO CIO' CHE E' UN MODULO VA NASCOSTO. `transfer`, `prenota` e
   `buoni/regala` hanno un titolo proprio, dicono cosa sono, e per qualcuno
   sono la risposta giusta: quelli restano visibili. La prova qui sotto
   tiene i due insiemi separati, cosi' un domani nessuno chiude tutto con
   un colpo di spugna.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const leggi = (p: string): string => Deno.readTextFileSync(new URL(p, import.meta.url));

const robotsDi = (html: string): string => {
  const m = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i);
  return m ? m[1].toLowerCase() : '';
};

/* Possono comparire in una ricerca: hanno un titolo che dice cosa sono. */
const VISIBILI = [
  'prenota/index.html',
  'richieste/transfer/index.html',
  'buoni/regala/index.html',
];

/* Non devono comparire: back office, pagine di servizio, e il modulo delle
   richieste, che da solo vale sedici indirizzi tutti uguali. */
const NASCOSTE = [
  'arrivo/index.html',
  'documenti.html',
  'segnalibri.html',
  'buoni/index.html',
  'buoni/stampa/index.html',
  'richieste/index.html',
  /* il Day Spa e' di prova (3 settembre 2026): quando andra' in linea con un
     titolo suo, passa fra le VISIBILI e robots.txt del sito smette di
     escluderlo */
  'dayspa/index.html',
  /* lo sportello del Day Spa: pagina del tablet della reception */
  'ingresso/index.html',
];

Deno.test('gli elenchi non sono vuoti, altrimenti i cicli girano a vuoto', () => {
  assertEquals(VISIBILI.length, 3);
  assertEquals(NASCOSTE.length, 8);
});

Deno.test('ogni pagina riservata dichiara noindex', () => {
  for (const p of NASCOSTE) {
    const r = robotsDi(leggi(p));
    assert(r.includes('noindex'), `${p} non dichiara noindex: «${r}»`);
  }
});

Deno.test('IL MODULO DELLE RICHIESTE e fra quelle nascoste', () => {
  const r = robotsDi(leggi('richieste/index.html'));
  assert(
    r.includes('noindex'),
    'sedici indirizzi con lo stesso titolo «Richieste» tornerebbero nei risultati',
  );
  /* «follow» e non «nofollow»: la pagina rimanda al sito dell'hotel e a
     quelle pagine il collegamento va lasciato buono. */
  assert(r.includes('follow') && !r.includes('nofollow'), `dovrebbe seguire i link: «${r}»`);
});

Deno.test('e nessuna delle pagine che vendono e stata nascosta', () => {
  for (const p of VISIBILI) {
    const r = robotsDi(leggi(p));
    assert(!r.includes('noindex'), `${p} e stata nascosta per sbaglio: «${r}»`);
  }
});

/* Quelle tre restano visibili perche' un titolo ce l'hanno: se un giorno
   qualcuno lo togliesse, sarebbero rumore come «Richieste». */
Deno.test('le pagine visibili hanno un titolo che dice cosa sono', () => {
  for (const p of VISIBILI) {
    const t = (leggi(p).match(/<title>([^<]*)<\/title>/i) ?? ['', ''])[1];
    assert(t.trim().length > 0, `${p} e visibile ma non ha titolo`);
    assert(
      !/^Richieste\b/.test(t.trim()),
      `${p} ha il titolo generico «${t}»: o gliene dai uno suo, o va nascosta`,
    );
  }
});
