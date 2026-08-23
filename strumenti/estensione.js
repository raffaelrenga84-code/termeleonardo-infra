/* estensione.js — porta l'estensione dal repo alla cartella che la
   reception carica davvero.

   PERCHE' ESISTE. L'estensione vive in due posti: `estensione/` in questo
   repo, dove si scrive e si prova, e una cartella dentro OneDrive, che e'
   quella che Chrome carica scompattata sui computer della reception.
   Correggere il repo e basta non cambia niente per chi lavora: il 23
   agosto 2026 il difetto delle «tre persone in Fidra» e' stato corretto
   nel repo e la reception ha continuato a caricare la versione vecchia
   finche' la proprieta' non ha chiesto «l'hai corretta anche in one
   drive?».

   NON E' UN DEPLOY. Non c'e' niente da pubblicare: si copiano dei file su
   un disco che si sincronizza da solo. Quello che serve e' che il gesto
   sia UNO, e che dica che cosa ha fatto — una copia silenziosa e' una
   copia che non si sa se e' avvenuta.

   IL NOME DELLA CARTELLA RESTA «offerta-leonardo-v2.7.10» anche se dentro
   c'e' la 2.8.x: e' il percorso che Chrome ha registrato quando
   l'estensione e' stata caricata scompattata, e cambiarlo vorrebbe dire
   ricaricarla a mano su ogni computer. Il numero che conta e' quello del
   manifest.

   Uso:  node strumenti/estensione.js            (copia e dice cosa)
         node strumenti/estensione.js --controlla (guarda e basta)
*/
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', 'estensione');
const FUORI = 'C:/Users/admin/OneDrive/Documents/MAIL RECEPTION HOTEL/offerta-leonardo-v2.7.10';

/* quello che Chrome carica: codice e manifest. Le prove (.test.ts), i
   LEGGIMI e i file di collaudo restano nel repo — la reception non li usa,
   e copiarli vorrebbe dire tenere allineata anche roba che non serve. */
const DA_PORTARE = (nome) =>
  (nome.endsWith('.js') || nome.endsWith('.json') || nome.endsWith('.html')) &&
  !nome.endsWith('.test.js') && !nome.startsWith('test-');

/* IL CONFRONTO GUARDA IL CONTENUTO, non i byte: git su Windows riscrive
   i file con CRLF e la copia in OneDrive ha LF, quindi un confronto byte
   a byte direbbe «diverso» su file identici riga per riga — e si
   copierebbe ogni volta senza motivo. */
const contenuto = (percorso) =>
  fs.readFileSync(percorso, 'utf8').split('\r\n').join('\n');

function elenco() {
  return fs.readdirSync(REPO).filter((n) =>
    fs.statSync(path.join(REPO, n)).isFile() && DA_PORTARE(n));
}

function versione() {
  try {
    return JSON.parse(fs.readFileSync(path.join(REPO, 'manifest.json'), 'utf8')).version;
  } catch {
    return '?';
  }
}

function main() {
  const soloControllo = process.argv.includes('--controlla');
  if (!fs.existsSync(FUORI)) {
    console.error('la cartella della reception non c\u0027e\u0027: ' + FUORI);
    console.error('se OneDrive non e\u0027 montato su questo computer, non c\u0027e\u0027 niente da copiare.');
    process.exit(1);
  }

  const diversi = [];
  const nuovi = [];
  for (const nome of elenco()) {
    const la = path.join(FUORI, nome);
    if (!fs.existsSync(la)) { nuovi.push(nome); continue; }
    if (contenuto(path.join(REPO, nome)) !== contenuto(la)) diversi.push(nome);
  }

  if (!diversi.length && !nuovi.length) {
    console.log('estensione ' + versione() + ': gia\u0027 allineata, niente da copiare.');
    return;
  }

  if (soloControllo) {
    for (const n of diversi) console.log('  diverso: ' + n);
    for (const n of nuovi) console.log('  manca:   ' + n);
    console.error('\nla reception sta caricando una versione diversa da questa.');
    console.error('per allinearla:  node strumenti/estensione.js');
    process.exit(1);
  }

  for (const nome of [...diversi, ...nuovi]) {
    fs.copyFileSync(path.join(REPO, nome), path.join(FUORI, nome));
    console.log('  copiato: ' + nome);
  }
  console.log('\nestensione ' + versione() + ' portata in ' + FUORI);
  console.log('RICORDA: su ogni computer della reception va ricaricata da chrome://extensions.');
}

main();
