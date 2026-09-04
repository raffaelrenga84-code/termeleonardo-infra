/* ============================================================
   opinione-pagina.test.ts — «La sua opinione» sul totem, letta dal
   sorgente della pagina dell'ingresso (come pagina.test.ts).
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const P = Deno.readTextFileSync(new URL('./index.html', import.meta.url));
const m = (P.match(/<script type="module">([\s\S]*?)<\/script>/) ?? ['', ''])[1];
const t = m.slice(m.indexOf('function totem('), m.indexOf('function sportello('));

Deno.test('nel riposo del totem c e il pulsante nelle quattro lingue, e il suo tocco non fa scattare il «tocco ovunque»', () => {
  assert(t.includes('id="opinioneApri"'), 'il pulsante');
  for (const s of ['La sua opinione', 'Your feedback', 'Ihre Meinung', 'Votre avis']) assert(t.includes(s), s);
  assert(t.includes('stopPropagation()'), 'il tocco sul pulsante non arriva a document.onclick');
  assert(t.includes('document.onclick = null'), 'dentro il percorso il tocco ovunque e spento');
});

Deno.test('il percorso: stelle, temi, commento, chi e, grazie; le parole dal modulo; 60 secondi senza tocchi e si torna al riposo', () => {
  assert(m.includes("from '/ingresso/opinione.js'"), 'le parole vengono dal modulo, con percorso assoluto');
  assert(t.includes('function opinione(') || t.includes('const opinione = '), 'il percorso');
  const o = t.slice(t.indexOf('opinione'));
  for (const s of ['testiOpinione(', 'TEMI_OPINIONE', 'maxlength="500"', 'a=opinione', 'qr-google', 'tipoCodice(', 'chiAnonimo', 'chiTessera']) assert(o.includes(s), s);
  assert(t.includes('OPINIONE_RIPOSO_MS') && t.includes('60 * 1000'), 'sessanta secondi senza tocchi');
});

Deno.test('la pagina manda solo cifre della tessera e non parla con Fidra', () => {
  assert(!t.includes('bill-scanner') && !t.includes('fidra.cloud'));
  assert(t.includes("=== 'tessera'"), 'la tessera si riconosce dal tipo del codice letto');
});

Deno.test('un voto per reparto, come sul foglio cartaceo: sette righe di stelle, tutte facoltative', () => {
  const o = t.slice(t.indexOf('const opinione = '));
  assert(o.includes('const reparti = ') && o.includes('opRepStelle'), 'la schermata dei reparti');
  assert(o.includes('t.repartiTitolo') && o.includes('TEMI_OPINIONE.map'), 'un reparto per riga, nella lingua scelta');
  assert(o.includes('voti: st.voti'), 'i voti partono con l opinione');
  assert(o.includes("st.voti[k] === v ? 0 : v"), 'ritoccando la stessa stella il voto si toglie');
});
