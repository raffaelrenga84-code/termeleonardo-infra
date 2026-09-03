/* ============================================================
   chiusura.test.ts — la chiusura invernale come la dice la pagina Prenota.

   IL DIFETTO CHE PRESIDIA. Chi cercava date dentro la chiusura leggeva «Non
   risultano camere libere per queste date. Provi con altre date…». Non era
   vero: eravamo chiusi. L'ospite non veniva a saperlo, ne' sapeva quando
   riapriamo — e magari cercava un altro hotel.

   Le date della stagione vengono dal server (tabella stagione_chiusura,
   azione a=stagione). Qui si provano i testi nelle quattro lingue, le regole
   pure (giorno prima, stesse notti dalla riapertura, stagione in corso) e,
   piu' sotto, che la pagina li usi davvero.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import {
  dataEstesa, dateDallaRiapertura, giornoPrima, messaggioChiuso, rigaChiusiOra, stagioneInCorso, TESTI, UFFICIO,
} from './chiusura.js';

const S = { chiusura: '2026-11-29', riapertura: '2027-02-13' };

Deno.test('le date si scrivono per esteso nella lingua', () => {
  assertEquals(dataEstesa('2026-11-29', 'it'), '29 novembre 2026');
  assertEquals(dataEstesa('2026-11-29', 'de'), '29. November 2026');
  assertEquals(dataEstesa('2027-02-13', 'en'), '13 February 2027');
  assertEquals(dataEstesa('2027-02-13', 'fr'), '13 février 2027');
  assertEquals(giornoPrima('2027-02-13'), '2027-02-12');
  assertEquals(giornoPrima('2027-03-01'), '2027-02-28');
});

Deno.test('«cerca dal 13 febbraio» tiene le stesse notti', () => {
  assertEquals(dateDallaRiapertura('2027-02-13', 4), { arrivo: '2027-02-13', partenza: '2027-02-17' });
  assertEquals(dateDallaRiapertura('2027-02-13', 0), { arrivo: '2027-02-13', partenza: '2027-02-14' }, 'almeno una notte');
});

Deno.test('la stagione e in corso solo fra chiusura e riapertura', () => {
  assertEquals(stagioneInCorso(S, '2026-11-28'), null);
  assertEquals(stagioneInCorso(S, '2026-11-29'), S);
  assertEquals(stagioneInCorso(S, '2027-02-12'), S);
  assertEquals(stagioneInCorso(S, '2027-02-13'), null);
  assertEquals(stagioneInCorso(null, '2026-12-15'), null);
});

Deno.test('la riga in cima: prima dell 8 gennaio dice da quando risponde l ufficio, dopo solo gli orari', () => {
  const prima = rigaChiusiOra(S, '2026-12-15', 'it');
  assert(prima.includes('fino al 12 febbraio 2027'), prima);
  assert(prima.includes("dall'8 gennaio 2027"), prima);
  assert(prima.includes(UFFICIO.orari.it), prima);
  const dopo = rigaChiusiOra(S, '2027-01-20', 'it');
  assert(!dopo.includes('8 gennaio'), dopo);
  assert(dopo.includes(UFFICIO.orari.it), dopo);
  assertEquals(rigaChiusiOra(S, '2026-10-01', 'it'), '', 'aperti: niente riga');
  for (const l of ['de', 'en', 'fr'] as const) assert(rigaChiusiOra(S, '2026-12-15', l).length > 40, l);
});

Deno.test('il messaggio della ricerca dice le date e la riapertura, in quattro lingue', () => {
  assertEquals(messaggioChiuso(S, 'it'), "In quel periodo l'hotel è chiuso, dal 29 novembre 2026 al 12 febbraio 2027. Riapriamo il 13 febbraio 2027.");
  assert(messaggioChiuso(S, 'de').includes('13. Februar 2027'));
  assert(messaggioChiuso(S, 'en').includes('13 February 2027'));
  assert(messaggioChiuso(S, 'fr').includes('13 février 2027'));
  assertEquals(TESTI.it.cerca('13 febbraio 2027'), 'Cerca dal 13 febbraio 2027');
});

/* ---------- e la pagina li usa davvero ---------- */
const PAGINA = Deno.readTextFileSync(new URL('index.html', import.meta.url));

Deno.test('la pagina legge la stagione dal server e mostra la riga in cima', () => {
  assert(/from '\/prenota\/chiusura\.js'/.test(PAGINA), 'la pagina non importa chiusura.js');
  assert(/FUNZIONE \+ '\?a=stagione'/.test(PAGINA), 'la pagina non chiede la stagione al server');
  assert(/rigaChiusiOra\(STAGIONE, /.test(PAGINA), 'la riga in cima non si disegna dalla stagione letta');
  const riga = PAGINA.indexOf('rigaChiusura()');
  const guida = PAGINA.indexOf('<div class="avviso">${esc(t.sotto)}</div>');
  assert(riga > 0 && guida > 0 && riga < guida, 'la riga della chiusura non sta sopra la guida');
  assert(/\nleggiStagione\(\);/.test(PAGINA), 'nessuno chiama leggiStagione(): la stagione non arriverebbe mai');
});

Deno.test('con «chiuso» la ricerca non dice «nessuna camera»: dice le date e offre di cercare dalla riapertura', () => {
  const m = PAGINA.match(/if \(d\.chiuso\) \{([\s\S]*?)\n    \}/);
  assert(m, 'manca il ramo chiuso nella ricerca');
  assert(/messaggioChiuso\(d\.chiuso, LNG\)/.test(m![1]), 'non usa il messaggio del modulo');
  assert(/dateDallaRiapertura\(d\.chiuso\.riapertura, /.test(m![1]), 'il pulsante non riparte dalla riapertura con le stesse notti');
  assert(/cercaDisponibilita\(\)/.test(m![1]), 'il pulsante non rilancia la ricerca');
  const chiuso = PAGINA.indexOf('if (d.chiuso) {');
  const nessuna = PAGINA.indexOf('${esc(t.nessunaCamera)}');
  assert(chiuso > 0 && chiuso < nessuna, 'il ramo chiuso viene dopo «nessuna camera»: non si vedrebbe mai');
});
