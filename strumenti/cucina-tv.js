#!/usr/bin/env node
/* ============================================================
   cucina-tv.js — la pagina dello schermo di cucina «tradotta» per i
   browser vecchi delle TV.

   «Non appare nulla» (la proprieta', 6 settembre 2026): il browser della
   TV in cucina carica la pagina ma non sa eseguire i moduli JavaScript e
   la sintassi moderna. Qui si prende il copione di pagine/cucina/index.html,
   si mettono dentro i due moduli che importa (schermo.js e /pos/server.js)
   e si fa tradurre tutto da esbuild per un motore vecchio (Chrome 52):
   niente import, niente «?.» ne' «??», async/await riscritti. Il risultato
   e' pagine/cucina/tv.html, che il sito e il PC servono a /tv/CODICE.

   index.html resta la pagina «vera», per tablet e PC; tv.html si RIGENERA
   con questo strumento a ogni modifica: la prova pagine/cucina/tv.test.ts
   confronta l'impronta e diventa rossa se e' vecchia.

   Uso:  node strumenti/cucina-tv.js
   ============================================================ */
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const RADICE = path.resolve(__dirname, '..');
process.chdir(RADICE);

const SORGENTI = ['pagine/cucina/index.html', 'pagine/cucina/schermo.js', 'pagine/pos/server.js'];
/** L'impronta dei tre sorgenti: se cambiano, tv.html va rifatto. */
function impronta() {
  const h = crypto.createHash('sha256');
  for (const f of SORGENTI) h.update(fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n'));
  return h.digest('hex').slice(0, 16);
}

const html = fs.readFileSync('pagine/cucina/index.html', 'utf8').replace(/\r\n/g, '\n');
const m = html.match(/<script type="module">\n([\s\S]*?)<\/script>/);
if (!m) throw new Error('pagine/cucina/index.html: copione <script type="module"> non trovato');

/* il copione con gli import che puntano ai file veri */
const copione = m[1]
  .replace("from '/cucina/schermo.js'", `from '${path.join(RADICE, 'pagine/cucina/schermo.js').replace(/\\/g, '/')}'`)
  .replace("from '/pos/server.js'", `from '${path.join(RADICE, 'pagine/pos/server.js').replace(/\\/g, '/')}'`);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cucina-tv-'));
const entrata = path.join(tmp, 'entrata.js');
const uscita = path.join(tmp, 'uscita.js');
fs.writeFileSync(entrata, copione);

const esito = spawnSync(`npx --yes esbuild@0.24.0 "${entrata}" --bundle --format=iife --target=chrome52 --charset=utf8 --log-level=warning --outfile="${uscita}"`, { encoding: 'utf8', shell: true });
if (esito.status !== 0) { console.error(esito.stderr || esito.stdout); process.exit(1); }
let tradotto = fs.readFileSync(uscita, 'utf8');
fs.rmSync(tmp, { recursive: true, force: true });
/* dentro un <script> classico la sequenza </script> chiuderebbe il tag */
tradotto = tradotto.replace(/<\/script/gi, '<\\/script');

const tv = html
  .replace('<script type="module">\n' + m[1] + '</script>',
    `<!-- GENERATO da strumenti/cucina-tv.js: non modificare a mano, modificare index.html e rigenerare. impronta:${impronta()} -->\n<script>\n${tradotto}</script>`)
  .replace('<title>', '<title>')  /* stesso titolo */
  ;
fs.writeFileSync('pagine/cucina/tv.html', tv);
console.log(`pagine/cucina/tv.html: ${(tv.length / 1024).toFixed(0)} KB, impronta ${impronta()}`);
