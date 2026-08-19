/* ============================================================
   orari.test.ts — gli orari che scriviamo agli ospiti.

   IL DIFETTO CHE PRESIDIA, trovato il 19 agosto 2026. Il Bistrot La Piazza
   compariva in nove punti, cinque file e quattro lingue, con TRE orari
   diversi — e nessuno dei tre era quello vero:

     italiano   «dalle 12:30 alle 14:30»
     tedesco    «taeglich 10:00-14:30 Uhr»
     inglese    «12:30-14:30»

   La verita', dalla proprieta': il Bistrot e' aperto dalle 10:00 alle 23:00,
   il pranzo si serve dalle 12:30 alle 14:30 e gli spuntini fino alle 17:30.
   Tutte e tre le versioni facevano credere all'ospite che alle 14:30 chiuda:
   uno che scende alle 16 e trova aperto ha avuto una sorpresa buona, ma uno
   che rinuncia a scendere perche' crede sia chiuso non lo sapra' mai.

   L'orario di chiusura e' UN FATTO, e un fatto che si scrive in quattro
   lingue si scorda in tre. Questa prova non guarda la forma delle frasi —
   ognuna ha il suo giro di parole — ma pretende che ovunque si dia un
   orario del Bistrot compaia l'ora di chiusura vera.

   Nota: questo file vive dentro estensione/ perche' e' li' che stanno i
   modelli che presidia. Finisce anche nello zip dell'estensione, dove non
   fa niente: Chrome carica solo quello che il manifest dichiara.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const CARTELLA = new URL('.', import.meta.url);

function righeConBistrot(): { file: string; riga: string }[] {
  const fuori: { file: string; riga: string }[] = [];
  for (const voce of Deno.readDirSync(CARTELLA)) {
    if (!voce.isFile || !voce.name.endsWith('.js')) continue;
    const testo = Deno.readTextFileSync(new URL(voce.name, CARTELLA));
    for (const riga of testo.split('\n')) {
      if (riga.includes('Bistrot')) fuori.push({ file: voce.name, riga });
    }
  }
  return fuori;
}

/* Una riga «da' un orario» se contiene due ore in forma 10:00 / 10h00.
   La riga che nomina il Bistrot senza orari — per dire dov'e' o cosa si
   mangia — non deve essere costretta a portarne uno. */
const DA_UN_ORARIO = /\d{1,2}[:h]\d{2}/;
const DICE_LA_CHIUSURA = /23[:h]00/;

Deno.test('il Bistrot e nominato dove ci aspettiamo, in quattro lingue', () => {
  const righe = righeConBistrot();
  assert(righe.length >= 8, `trovate solo ${righe.length} righe: la ricerca non guarda piu niente`);
});

Deno.test('ovunque si dia un orario del Bistrot, la chiusura e le 23:00', () => {
  const conOrario = righeConBistrot().filter((r) => DA_UN_ORARIO.test(r.riga));
  assert(conOrario.length >= 8, `solo ${conOrario.length} righe con un orario: sono nove`);
  for (const { file, riga } of conOrario) {
    assert(
      DICE_LA_CHIUSURA.test(riga),
      `${file}: dice un orario del Bistrot senza la chiusura vera →\n  ${riga.trim().slice(0, 160)}`,
    );
  }
});

/* E il pranzo resta scritto, perche' e' un'altra cosa dall'apertura: chi
   arriva alle 15 trova il bar aperto ma il pranzo finito, e saperlo prima
   evita una delusione al tavolo. */
Deno.test('e dove c e la chiusura c e anche l ora del pranzo', () => {
  const conOrario = righeConBistrot().filter((r) => DA_UN_ORARIO.test(r.riga));
  assertEquals(conOrario.length >= 8, true, 'la ricerca non guarda piu niente');
  for (const { file, riga } of conOrario) {
    assert(
      /12[:h]30/.test(riga),
      `${file}: dice quando apre ma non quando si pranza →\n  ${riga.trim().slice(0, 160)}`,
    );
  }
});
