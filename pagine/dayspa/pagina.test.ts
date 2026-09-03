/* ============================================================
   pagina.test.ts — la pagina dell'ospite per il Day Spa, letta dal
   sorgente (il DOM in Deno non c'e').

   Specifica del 3 settembre 2026: tre passi su una schermata, calendario
   comune con gli stati del server, totale detto dal server, la riga «non
   rimborsabile» PRIMA del pulsante di pagamento, pagina nascosta finche'
   e' di prova.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const P = Deno.readTextFileSync(new URL('./index.html', import.meta.url));
const modulo = () => (P.match(/<script type="module">([\s\S]*?)<\/script>/) ?? ['', ''])[1];

Deno.test('e nascosta finche e di prova: noindex, chiave nell indirizzo, e la costante che lo dice', () => {
  assert(/<meta name="robots" content="noindex, follow"/.test(P));
  assert(/const PROVA = true;/.test(modulo()));
  assert(/\.get\('k'\) !== CHIAVE_PROVA/.test(modulo()), 'senza ?k= la pagina di prova non si apre');
});

Deno.test('usa il calendario comune con statoExtra, legge chiusure e giorni dal server, e i testi da testi.js', () => {
  assert(/from '\/comune\/calendario\.js'/.test(P));
  assert(/from '\/dayspa\/testi\.js'/.test(P), 'i testi stanno in un modulo loro');
  assert(/innestaGiorno\(\{[^}]*\bstatoExtra\b/.test(modulo()), 'il calendario deve ricevere statoExtra');
  assert(/leggiChiusure\(/.test(modulo()));
  assert(/a=giorni/.test(modulo()) && /a=listino/.test(modulo()) && /a=prenota/.test(modulo()) && /a=stato/.test(modulo()));
  assert(/innestaGiorno\(\{/.test(modulo()), 'il giorno si sceglie con l innesto a un giorno solo');
});

Deno.test('la riga non rimborsabile sta prima del pulsante di pagamento', () => {
  /* nell'HTML, non nel copione: e' l'ordine sulla pagina che conta */
  const riga = P.indexOf('id="tNonRimborsabile"'), paga = P.indexOf('id="bPaga"');
  assert(riga > 0 && paga > riga, 'l ospite deve leggerla prima di pagare');
  assert(/\.nonRimborsabile\b/.test(modulo()), 'la riga prende il testo dalla lingua scelta');
});

Deno.test('il totale lo dice il server: nessun prezzo scritto nella pagina', () => {
  assert(!/\b(3500|4500|2900|35 ?€|45 ?€|29 ?€)\b/.test(P), 'un prezzo scritto qui divergerebbe dal listino');
  assert(/prezzoCent/.test(modulo()), 'il prezzo arriva dalle fasce che manda il server');
});

Deno.test('adulti e bambini dai 2 anni, i neonati spiegati, al massimo le persone del listino', () => {
  const m = modulo();
  for (const id of ['tAdulti', 'tBambini', 'tNeonati', 'tMassimo']) assert(P.includes(`id="${id}"`), `manca ${id}`);
  assert(/\.neonati\b/.test(m) && /\.bambini\b/.test(m) && /\.adulti\b/.test(m), 'i testi vengono dalla lingua scelta');
  assert(/personeMax/.test(m), 'il massimo persone arriva dal listino, non e scritto qui');
});

Deno.test('la pagina di grazie aspetta il webhook interrogando lo stato, e i tre passi stanno in una schermata', () => {
  const m = modulo();
  assert(/\.get\('grazie'\)/.test(m) && /a=stato&numero=/.test(m));
  assert(/setTimeout\(/.test(m) || /setInterval\(/.test(m), 'deve riprovare finche il pagamento non e confermato');
  for (const id of ['passoQuando', 'passoChi', 'passoDati']) assert(P.includes(`id="${id}"`), `manca ${id}`);
});

Deno.test('la lingua viene dall indirizzo e i dati precompilati pure', () => {
  const m = modulo();
  assert(/normalizzaLingua\(/.test(m) && /parametriOspite\(/.test(m));
  assertEquals((P.match(/<select id="lng"/g) ?? []).length, 1, 'una select vera per la lingua, come Prenota');
});
