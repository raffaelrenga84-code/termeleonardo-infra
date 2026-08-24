/* ============================================================
   modello-email.test.ts — il pulsante messo al posto di quello di
   Fidra, e la via d'uscita che deve restare aperta.

   PERCHE'. La reception continuava a mandare offerte col modello di
   Fidra, e il nostro pulsante era a un Ctrl+Shift+L di distanza. Ora
   il nostro prende il posto del loro, li' dove si sta gia' guardando
   la pratica.

   MA UNO SOLO. Fidra ne ha due, e il secondo resta apposta: il 24
   agosto 2026 il nostro sistema scriveva «6 persone» su una pratica
   che ne aveva tre, e la reception se n'e' accorta proprio perche'
   poteva mandare l'offerta con l'altro. Un sistema che copre la
   propria alternativa deve prima essere giusto; finche' non lo e', la
   via d'uscita e' quello che ci fa scoprire gli errori.

   Questa prova esiste perche' quel «uno solo» non diventi «tutti»
   per distrazione.
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const SORGENTE = Deno.readTextFileSync(new URL('fidra-modello-email.js', import.meta.url));

Deno.test('sostituisce un pulsante solo, non tutti', () => {
  assert(
    /bottoni\[0\]/.test(SORGENTE),
    'non prende piu solo il primo: la via d uscita della reception sparisce',
  );
  assert(
    !/for \(const [a-z]+ of bottoniFidra\(\)\)/.test(SORGENTE),
    'sostituisce tutti i pulsanti «Modello Email»: resta un sistema senza alternativa',
  );
});

Deno.test('nasconde e rimpiazza, non si sovrappone', () => {
  /* un pulsante con position:absolute sopra quello di Fidra si scolla al
     primo scorrimento; qui si nasconde il loro e il nostro entra nel
     flusso, cosi' segue il layout invece di inseguirlo */
  assert(/style\.display = 'none'/.test(SORGENTE), 'non nasconde piu il pulsante di Fidra');
  assert(/insertBefore/.test(SORGENTE), 'non inserisce piu il nostro nel flusso');
  /* si guarda il CSS che il pulsante riceve davvero, non il file: il
     commento qui sopra nomina position:absolute per spiegare perche' non
     si usa, e una prova che legge i commenti non prova niente */
  /* \r?\n, NON \n. Su Windows git riscrive i fine riga al checkout: questa
     prova passava sul ramo e falliva su main appena ricreato — stesso
     commit, stesso codice, solo byte diversi in fondo alle righe. Una
     prova che dipende da come il file e' finito su disco non sta provando
     il codice, e fa perdere mezz'ora a cercare una regressione che non c'e'. */
  const css = (SORGENTE.match(/cssText\s*=\s*([\s\S]*?);\r?\n/g) || []).join(' ');
  assert(css.length > 50, 'non trovo piu il CSS del pulsante: la prova guarderebbe il vuoto');
  assert(
    !/position:\s*(absolute|fixed)/.test(css),
    'e tornato a sovrapporsi: si scollera al primo scorrimento',
  );
});

Deno.test('solo sulla scheda di una prenotazione', () => {
  assert(
    /customers\\\/\\d\+\\\/reservations/.test(SORGENTE),
    'tocca «Modello Email» anche fuori dalla scheda di una prenotazione',
  );
});

Deno.test('se il pannello non si apre, lo dice invece di sembrare rotto', () => {
  assert(/Ctrl\+Shift\+L/.test(SORGENTE), 'sparita la via di riserva per l operatore');
  assert(
    /LEONARDO_APRI_PANNELLO/.test(SORGENTE),
    'il pulsante non chiede piu di aprire il pannello',
  );
  const bg = Deno.readTextFileSync(new URL('background.js', import.meta.url));
  assert(
    /LEONARDO_APRI_PANNELLO/.test(bg),
    'il service worker non sa aprire il pannello: il pulsante non fa niente',
  );
});
