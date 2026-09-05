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
  assert(/const PROVA = false;/.test(modulo()), "in linea dal 5 settembre 2026");
  assert(/\.get\('k'\) !== CHIAVE_PROVA/.test(modulo()), 'senza ?k= la pagina di prova non si apre');
});

Deno.test('quattordici giorni in fila al posto del calendario, giorni dal server, testi da testi.js', () => {
  /* «al massimo 7 giorni: la disponibilita dipende dal meteo e
     dall occupazione dell hotel» (la proprieta', 3 settembre 2026) */
  assert(/from '\/dayspa\/giorni\.js'/.test(P), 'i sette giorni stanno in un modulo loro');
  assert(/from '\/dayspa\/testi\.js'/.test(P), 'i testi stanno in un modulo loro');
  assert(!/innestaGiorno\(/.test(modulo()) && !/apriCalendario\(/.test(modulo()), 'niente calendario a mesi: sette giorni bastano');
  assert(P.includes('id="giorni"'), 'manca la fila dei giorni');
  assert(/ORIZZONTE_GIORNI/.test(modulo()), 'quanti giorni si chiedono lo dice il modulo, non un numero scritto qui');
  assert(/a=giorni/.test(modulo()) && /a=listino/.test(modulo()) && /a=prenota/.test(modulo()) && /a=stato/.test(modulo()));
  assert(/t\(\)\.orizzonte|x\.orizzonte/.test(modulo()), 'la riga che spiega i sette giorni va mostrata');
  /* «e nel calendario fai vedere la chiusura stagionale»: la riga con le
     date, come in Prenota, e i giorni chiusi segnati */
  assert(/leggiChiusure\(/.test(modulo()) && /notaChiusura\(/.test(modulo()), 'la chiusura stagionale va letta e detta con le date');
  assert(P.includes('id="notaChiusura"'), 'manca il posto per la riga della chiusura');
  assert(/'chiuso'/.test(modulo()), 'un giorno chiuso deve dirsi chiuso anche nella fila');
});

Deno.test('il serale del venerdi e del sabato si vede sul giorno e si vende sotto la fascia', () => {
  const m = modulo();
  assert(/haSerale\(/.test(m), 'il segno «sera» sul giorno viene da haSerale');
  assert(/\.seraBadge\b/.test(m), 'il segno sul giorno ha il suo testo');
  assert(/\.seraleVendita\b/.test(m), 'sotto la fascia serale va la riga che la vende');
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

Deno.test('niente salti mentre carica: l avviso di prova si decide subito, la nota della chiusura sta sotto i giorni, il pulsante dice cosa manca', () => {
  /* Lighthouse da telefono, 3 settembre 2026: CLS 0,69. L'avviso di prova
     compariva in cima quando rispondeva il server e spingeva tutto giu';
     la nota della chiusura pure, sopra i sette giorni. */
  const m = modulo();
  assert(/\$\('avvisoProva'\)\.hidden = !PROVA/.test(m), 'l avviso di prova viene dalla costante della pagina, non dal server');
  assert(P.indexOf('id="giorni"') < P.indexOf('id="notaChiusura"'), 'la nota della chiusura sta sotto i giorni, cosi non li sposta');
  assert(/\$\('bPaga'\)\.textContent = [^;]*scegliGiorno/.test(m), 'senza giorno e fascia il pulsante dice «Scelga il giorno», non un «Paga» spento');
});

Deno.test('i testi piccoli si leggono: giorno e mese sui pulsanti, occhiello e pie di pagina non in grigio chiaro', () => {
  assert(/\.gg \.s\{[^}]*var\(--verde-medio\)/.test(P) && /\.gg \.m\{[^}]*var\(--verde-medio\)/.test(P), 'giorno della settimana e mese sui pulsanti');
  assert(/\.occhiello\{[^}]*#6E5228/.test(P), 'l occhiello sul verde chiaro della testata');
  assert(/\.pie\{[^}]*#5E5A52/.test(P), 'il pie di pagina');
});

Deno.test('la lingua viene dall indirizzo e i dati precompilati pure', () => {
  const m = modulo();
  assert(/normalizzaLingua\(/.test(m) && /parametriOspite\(/.test(m));
  assertEquals((P.match(/<select id="lng"/g) ?? []).length, 1, 'una select vera per la lingua, come Prenota');
});

Deno.test('«sistema» (3 settembre, notte): numero del passo leggibile, errore che porta al primo campo mancante, consenso segnato', () => {
  /* Nella schermata «3 I suoi dati» il 3 era un pedice di 13 px in
     Cormorant: un tondino col numero si legge. E premuto «Paga» con i
     campi vuoti si vedeva solo «Manca qualcosa»: ora si segna anche il
     consenso, il fuoco va al primo campo mancante, e il rosso sparisce
     mentre si scrive. */
  const tondino = P.slice(P.indexOf('h2 small{'), P.indexOf('}', P.indexOf('h2 small{')));
  assert(tondino.includes('border-radius:50%'), 'il numero del passo e un tondino, non un pedice');
  assert(P.includes('id="lConsenso"'), 'la riga del consenso ha un id per poterla segnare');
  const M = (P.match(/<script type="module">([\s\S]*?)<\/script>/) ?? ['', ''])[1];
  const p = M.slice(M.indexOf('async function paga('), M.indexOf("addEventListener('click', paga)"));
  assert(p.includes("$('lConsenso').classList.toggle('vuoto'"), 'anche il consenso mancante si segna in rosso');
  assert(p.includes('.focus(') && p.includes('scrollIntoView('), 'il fuoco e lo scorrimento vanno al primo campo mancante');
  assert(M.includes("addEventListener('input'"), 'il rosso sparisce mentre si scrive');
});
