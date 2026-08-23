/* ============================================================
   allineata.test.ts — la reception carica la stessa estensione che sta
   qui dentro.

   IL DIFETTO, scoperto da una domanda della proprietà: «l'hai corretta
   anche in one drive?». No. Il 23 agosto 2026 il difetto delle «tre
   persone in Fidra» è stato corretto in questo repo, provato, messo sotto
   git — e la reception ha continuato a caricare la versione vecchia,
   perché l'estensione che Chrome apre scompattata vive in una cartella
   dentro OneDrive, e nessuno l'aveva copiata.

   Due versioni in circolazione sono peggio di una vecchia: chi guarda il
   codice vede la correzione, chi usa il computer vede il difetto, e non
   c'è niente che colleghi le due cose.

   COME FUNZIONA QUESTA PROVA. Se la cartella della reception non c'è —
   un altro computer, un OneDrive non montato — non c'è niente da
   confrontare e la prova passa: non è un difetto del codice, è un disco
   che non c'è. Se invece c'è ed è diversa, questa diventa rossa e dice il
   comando che la allinea.

   Non copia niente: una prova che ripara quello che sta misurando non
   misura più niente. A copiare ci pensa `node strumenti/estensione.js`.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const QUI = new URL('.', import.meta.url);
const RECEPTION =
  'C:/Users/admin/OneDrive/Documents/MAIL RECEPTION HOTEL/offerta-leonardo-v2.7.10';

/* gli stessi file che porta strumenti/estensione.js: quello che Chrome
   carica. Le prove e i LEGGIMI restano qui e non servono alla reception. */
const daPortare = (n: string) =>
  (n.endsWith('.js') || n.endsWith('.json') || n.endsWith('.html')) &&
  !n.endsWith('.test.js') && !n.startsWith('test-');

function ceLaCartella(): boolean {
  try {
    return Deno.statSync(RECEPTION).isDirectory;
  } catch {
    return false;
  }
}

function nostri(): string[] {
  const fuori: string[] = [];
  for (const e of Deno.readDirSync(QUI)) {
    if (e.isFile && daPortare(e.name)) fuori.push(e.name);
  }
  return fuori.sort();
}

Deno.test('la cartella della reception ha gli stessi file di questa', () => {
  if (!ceLaCartella()) return; /* un altro computer: niente da confrontare */
  const mancanti = nostri().filter((n) => {
    try {
      return !Deno.statSync(`${RECEPTION}/${n}`).isFile;
    } catch {
      return true;
    }
  });
  assertEquals(
    mancanti,
    [],
    'file dell estensione che la reception non ha: ' +
      'allineala con «node strumenti/estensione.js»',
  );
});

Deno.test('e lo stesso codice, non solo gli stessi nomi', () => {
  /* e la parte che conta: un file con lo stesso nome e il codice di due
     settimane fa e esattamente quello che e successo col difetto delle
     tre persone in Fidra.

     SI CONFRONTA IL CONTENUTO E NON I BYTE: git su Windows riscrive i
     file con CRLF mentre la copia in OneDrive ha LF, e un confronto byte
     a byte suonerebbe dopo ogni «git checkout» su un file identico riga
     per riga. Un allarme che suona quando non e successo niente si impara
     a ignorare, e il giorno che suona davvero non lo guarda piu nessuno. */
  if (!ceLaCartella()) return;
  const righe = (t: string) => t.split('\r\n').join('\n');
  const diversi: string[] = [];
  for (const n of nostri()) {
    try {
      const qui = righe(Deno.readTextFileSync(new URL(n, QUI)));
      const la = righe(Deno.readTextFileSync(`${RECEPTION}/${n}`));
      if (qui !== la) diversi.push(n);
    } catch {
      diversi.push(n);
    }
  }
  assertEquals(
    diversi,
    [],
    'la reception sta caricando una versione diversa di questi file. ' +
      'Allineala con «node strumenti/estensione.js», poi ricarica l estensione ' +
      'da chrome://extensions su ogni computer',
  );
});

Deno.test('e lo strumento che le allinea guarda la stessa cartella', () => {
  /* due percorsi scritti in due posti divergono al primo giorno che
     qualcuno rinomina la cartella: la prova guarderebbe una cartella e lo
     strumento ne allineerebbe un altra */
  const strumento = Deno.readTextFileSync(new URL('../strumenti/estensione.js', import.meta.url));
  assert(
    strumento.includes(RECEPTION),
    'strumenti/estensione.js copia in una cartella diversa da quella che questa prova controlla',
  );
});
