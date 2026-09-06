#!/usr/bin/env node
/* ============================================================
   pacchetto-bistrot.js — il POS del Bistrot in una cartella da copiare.

   «Dammi una cosa che basta che copio e incollo e funziona tutto sia su
   pc che su palmari» (la proprieta', 5 settembre 2026). Il PC del
   Bistrot non deve installare Deno, Git o certificati: qui si mette in
   una cartella deno.exe (firmato da Deno Land), i sorgenti del server,
   la pagina del POS, quella dello schermo della cucina e l'installa.cmd;
   la cartella va su OneDrive, dove la reception la vede. Sul PC del
   Bistrot: tasto destro su installa.cmd, «Esegui come amministratore».
   Fine.

   PERCHE' NON UN ESEGUIBILE COMPILATO. `deno compile` fa un .exe nuovo e
   non firmato, e Windows Defender (Exploit Guard, evento 1121) lo blocca
   all'avvio: «Accesso negato», visto il 5 settembre 2026 su questo PC.
   deno.exe e' firmato e conosciuto: passa.

   Il server non ha dipendenze da scaricare (deno info: solo file
   locali), quindi funziona anche senza internet al primo avvio.

   La pagina dello schermo della cucina viaggia con lui (6 settembre 2026):
   sul PC del Bistrot si apre a /cucina, e le comande si vedono anche
   quando internet non c'e'.

   Da rifare (e rieseguire installa.cmd sul PC) ogni volta che cambia
   qualcosa in pos-locale/, in supabase/functions/pos/ o nelle pagine.

   Uso:  node strumenti/pacchetto-bistrot.js [cartella di destinazione]
   ============================================================ */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const DEST = process.argv[2] || 'C:/Users/admin/OneDrive/Documents/MAIL RECEPTION HOTEL/POS Bistrot';
const RADICE = path.resolve(__dirname, '..');
process.chdir(RADICE);
fs.mkdirSync(DEST, { recursive: true });

console.log('[1/4] deno.exe...');
const dove = spawnSync('where', ['deno'], { encoding: 'utf8' });
const denoExe = String(dove.stdout || '').split(/\r?\n/).map((s) => s.trim()).find((s) => /deno(\.exe)?$/i.test(s));
if (!denoExe) { console.error('deno non trovato nel PATH'); process.exit(1); }
fs.copyFileSync(denoExe, path.join(DEST, 'deno.exe'));
const versione = spawnSync(denoExe, ['--version'], { encoding: 'utf8' }).stdout.split(/\r?\n/)[0];
/* un vecchio eseguibile compilato non deve restare in giro: Defender lo blocca */
for (const vecchio of ['pos-locale.exe']) if (fs.existsSync(path.join(DEST, vecchio))) fs.rmSync(path.join(DEST, vecchio));

console.log('[2/4] i sorgenti del server (senza le prove)...');
const src = path.join(DEST, 'src');
fs.rmSync(src, { recursive: true, force: true });
const copiaTs = (da, a) => {
  fs.mkdirSync(a, { recursive: true });
  for (const f of fs.readdirSync(da)) {
    if (!f.endsWith('.ts') || f.endsWith('.test.ts')) continue;
    fs.copyFileSync(path.join(da, f), path.join(a, f));
  }
};
copiaTs('pos-locale', path.join(src, 'pos-locale'));
copiaTs('supabase/functions/pos', path.join(src, 'supabase/functions/pos'));
if (fs.existsSync('deno.json')) fs.copyFileSync('deno.json', path.join(src, 'deno.json'));

console.log('[3/4] le pagine del POS e dello schermo della cucina...');
const pagina = path.join(DEST, 'pagina');
fs.mkdirSync(path.join(pagina, 'ingresso'), { recursive: true });
for (const f of ['index.html', 'stato.js', 'server.js', 'pianta.js', 'manifest.webmanifest', 'sw.js']) {
  fs.copyFileSync(path.join('pagine/pos', f), path.join(pagina, f));
}
for (const f of ['icona-192.png', 'icona-512.png']) {
  fs.copyFileSync(path.join('pagine/ingresso', f), path.join(pagina, 'ingresso', f));
}
/* lo schermo della cucina: il PC la serve a /cucina, e il monitor appeso in
   cucina la apre col link della postazione */
fs.mkdirSync(path.join(pagina, 'cucina'), { recursive: true });
for (const f of ['index.html', 'schermo.js']) {
  fs.copyFileSync(path.join('pagine/cucina', f), path.join(pagina, 'cucina', f));
}

console.log('[4/4] installa.cmd e il modello della configurazione...');
fs.copyFileSync('pos-locale/installa.cmd', path.join(DEST, 'installa.cmd'));
fs.copyFileSync('pos-locale/config.esempio.json', path.join(DEST, 'config.modello.json'));
fs.writeFileSync(path.join(DEST, 'VERSIONE.txt'), `${new Date().toISOString()}\n${versione}\n`);
console.log(`fatto: ${DEST} (${versione})`);
console.log('Sul PC del Bistrot: tasto destro su installa.cmd → «Esegui come amministratore».');
