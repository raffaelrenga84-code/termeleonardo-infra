/* variabili.js — cerca le variabili che non esistono.

   PERCHE' ESISTE. Il 24 agosto 2026 lo storico del cliente si e' rotto in
   reception con «id is not defined»: avevo rinominato una variabile e ne
   era rimasto un uso indietro. Le prove non l'hanno visto, e non potevano:
   quei file vivono dentro il DOM di Fidra e fuori dal browser non si
   eseguono — `new Function(sorgente)` li LEGGE soltanto, e un nome
   sbagliato dentro una funzione mai chiamata non si nota fino a quando
   non la chiama qualcuno alla reception.

   `deno lint --rules-include=no-undef` invece quel nome lo vede, senza
   eseguire niente.

   PERCHE' A GRUPPI. I file si controllano nella stessa combinazione in
   cui il browser li carica: sono le liste `content_scripts` del manifest,
   piu' il service worker. Cosi' un nome definito in template.js e usato
   in template-extra.js risulta definito — perche' nel browser lo e' — e
   una collisione fra due file che si caricano insieme si vede subito,
   com'e' successo a `BANCA` dichiarata due volte.

   Uso:  node strumenti/variabili.js
*/
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const os = require('os');

const DIR = path.join(__dirname, '..', 'estensione');

/* quello che il browser mette a disposizione da se': dichiararlo qui
   evita di far passare per «non definito» meta' del linguaggio */
const AMBIENTE = `/* eslint-disable */
var chrome, browser, document, window, self, globalThis, navigator, location,
    fetch, Headers, Request, Response, FormData, Blob, File, FileReader, URL,
    URLSearchParams, DOMParser, XMLHttpRequest, Node, Element, HTMLElement,
    HTMLInputElement, HTMLSelectElement, HTMLTextAreaElement, MutationObserver,
    IntersectionObserver, ResizeObserver, Event, CustomEvent, KeyboardEvent,
    MouseEvent, PointerEvent, ClipboardEvent, getComputedStyle, requestAnimationFrame,
    cancelAnimationFrame, setTimeout, clearTimeout, setInterval, clearInterval,
    console, alert, confirm, prompt, atob, btoa, structuredClone, crypto,
    localStorage, sessionStorage, history, screen, matchMedia, Image, Audio,
    getSelection, close, open, postMessage, addEventListener,
    removeEventListener, dispatchEvent, scrollTo, Intl, TextEncoder,
    TextDecoder, AbortController, performance, InputEvent, ClipboardItem,
    NodeFilter, NodeList, DocumentFragment, Range, innerWidth, innerHeight,
    scrollX, scrollY, devicePixelRatio, top, parent, frames, origin;
`;

function gruppi() {
  const m = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
  const g = (m.content_scripts || []).map((c) => ({
    nome: c.matches.join(' '),
    file: c.js || [],
  }));
  const sw = m.background && m.background.service_worker;
  if (sw) g.push({ nome: 'service worker', file: [sw] });
  return g;
}

function controlla(gruppo, tmp) {
  /* si segna dove comincia ogni file, per riportare l'errore alla riga
     giusta del file giusto invece che a una riga del cumulo */
  let testo = AMBIENTE;
  const inizio = [];
  for (const f of gruppo.file) {
    inizio.push({ f, riga: testo.split('\n').length });
    testo += '\n' + fs.readFileSync(path.join(DIR, f), 'utf8');
  }
  fs.writeFileSync(tmp, testo);
  /* senza shell:true Node non concatena gli argomenti, e non avvisa: qui
     dentro finisce un percorso di file, che uno spazio ce l'ha spesso */
  const eseguibile = 'deno';
  const r = spawnSync(eseguibile, ['lint', '--rules-include=no-undef',
    '--rules-exclude=no-unused-vars,no-var,prefer-const,no-window,ban-untagged-todo',
    '--json', tmp], { encoding: 'utf8' });
  let esito;
  try { esito = JSON.parse(r.stdout); } catch (e) {
    return [{ testo: 'deno lint non ha risposto: ' + (r.stderr || '').slice(0, 300) }];
  }
  return (esito.diagnostics || [])
    .filter((d) => d.code === 'no-undef')
    .map((d) => {
      const riga = d.range && d.range.start ? d.range.start.line : 0;
      let dove = { f: '(prologo)', riga: 0 };
      for (const i of inizio) if (riga >= i.riga) dove = i;
      return { testo: `${dove.f}:${riga - dove.riga + 1}  ${d.message}` };
    });
}

/* guarda e basta: restituisce l'elenco dei problemi, senza stampare
   niente e senza uscire. Cosi' lo puo' chiamare anche chi copia. */
function esamina() {
  const tmp = path.join(os.tmpdir(), 'leo-variabili.js');
  const problemi = [];
  const gruppiVisti = [];
  for (const g of gruppi()) {
    const p = controlla(g, tmp);
    gruppiVisti.push({ nome: g.nome, problemi: p.map((x) => x.testo) });
    for (const x of p) problemi.push(`${g.nome}  ${x.testo}`);
  }
  try { fs.unlinkSync(tmp); } catch (e) { /* pazienza */ }
  return { problemi, gruppi: gruppiVisti };
}

function main() {
  const { gruppi: visti, problemi } = esamina();
  for (const g of visti) {
    if (!g.problemi.length) { console.log(`  ok   ${g.nome}`); continue; }
    console.log(`  NO   ${g.nome}`);
    for (const x of g.problemi) console.log(`         ${x}`);
  }
  if (problemi.length) {
    const n = problemi.length;
    console.log(`\n${n} variabil${n === 1 ? 'e' : 'i'} che non esist${n === 1 ? 'e' : 'ono'}.`);
    process.exit(1);
  }
  console.log('\nNessuna variabile fuori posto.');
}

if (require.main === module) main();
module.exports = { gruppi, controlla, esamina, AMBIENTE };
