/* ============================================================
   transfer.test.ts — il modulo transfer del sito (richieste/transfer).

   L'ETICHETTA DEL CAMPO DELL'ORA. Diceva «Ora» e basta, e la riga di guida
   in cima al riquadro («negli arrivi indichi l'orario a cui atterra…») e'
   proprio quella che l'ospite salta. La proprieta', il 2 settembre 2026,
   davanti al modulo: «anche qui specificherei Ora di arrivo del volo o
   treno». L'etichetta deve dire DA SOLA che ora chiediamo, in tutte e
   quattro le lingue:
   - arrivo: l'ora a cui atterra o arriva il treno;
   - partenza con auto privata: l'ora a cui passiamo a prenderlo in hotel;
   - partenza con navetta condivisa: l'ora del VOLO — il ritiro lo
     calcoliamo noi tre ore prima (ritiroPerVolo) e glielo scriviamo sotto.

   Le prove eseguono la tabella dei testi e la funzione VERE della pagina,
   estratte dal sorgente: le frasi che l'ospite legge sono quelle, non
   segnaposto scritti qui.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { chiaveOraTransfer } from './comune/obbligatori.js';

const SORGENTE = Deno.readTextFileSync(new URL('richieste/transfer/index.html', import.meta.url));
const LINGUE = ['it', 'de', 'en', 'fr'] as const;

type Testi = Record<string, string>;
type Etichetta = (t: Testi, verso: string, collettivo: boolean) => string;

function testiDellaPagina(): Record<string, Testi> {
  const m = SORGENTE.match(/\r?\nconst T = \{[\s\S]*?\r?\n\};/);
  assert(m, 'la tabella dei testi T non si trova per intero');
  return new Function(m[0] + '\nreturn T;')() as Record<string, Testi>;
}

function etichettaDellaPagina(): Etichetta {
  const m = SORGENTE.match(/\r?\nfunction etichettaOra\([^)]*\)\s*\{[\s\S]*?\r?\n\}/);
  assert(m, 'la funzione etichettaOra() non si trova per intero nella pagina');
  /* la pagina importa chiaveOraTransfer da /comune/obbligatori.js: qui
     gliela si passa quella vera, cosi' la prova esegue la regola condivisa
     e non una copia */
  return new Function('chiaveOraTransfer', m[0] + '\nreturn etichettaOra;')(chiaveOraTransfer) as Etichetta;
}

/* le frasi attese, lingua per lingua: [arrivo, ritiro in hotel, volo] */
const ATTESE: Record<string, [string, string, string]> = {
  it: ['Ora di arrivo del volo o treno', 'Ora del ritiro in hotel', 'Ora del volo'],
  de: ['Ankunftszeit von Flug oder Zug', 'Uhrzeit der Abholung am Hotel', 'Abflugzeit'],
  en: ['Flight or train arrival time', 'Pick-up time at the hotel', 'Flight time'],
  fr: ['Heure d’arrivée du vol ou du train', 'Heure de prise en charge à l’hôtel', 'Heure du vol'],
};

Deno.test('in arrivo l etichetta chiede l ora a cui atterra o arriva il treno', () => {
  const T = testiDellaPagina();
  const etichettaOra = etichettaDellaPagina();
  for (const l of LINGUE) {
    assertEquals(etichettaOra(T[l], 'arrivo', false), ATTESE[l][0],
      'in ' + l + ' l etichetta dell arrivo non dice di che ora si tratta');
  }
});

Deno.test('in partenza con l auto privata chiede l ora del ritiro in hotel', () => {
  const T = testiDellaPagina();
  const etichettaOra = etichettaDellaPagina();
  for (const l of LINGUE) {
    assertEquals(etichettaOra(T[l], 'partenza', false), ATTESE[l][1],
      'in ' + l + ' l etichetta della partenza non dice che e l ora del ritiro');
  }
});

Deno.test('in partenza con la navetta condivisa chiede l ora del volo, come prima', () => {
  const T = testiDellaPagina();
  const etichettaOra = etichettaDellaPagina();
  for (const l of LINGUE) {
    assertEquals(etichettaOra(T[l], 'partenza', true), ATTESE[l][2],
      'in ' + l + ' con la navetta in partenza l etichetta non e quella del volo');
  }
});

/* la navetta conta solo in partenza: chi arriva con la navetta ci dice
   comunque a che ora atterra, e il ritiro non e' da calcolare */
Deno.test('la navetta non cambia l etichetta degli arrivi', () => {
  const T = testiDellaPagina();
  const etichettaOra = etichettaDellaPagina();
  for (const l of LINGUE) {
    assertEquals(etichettaOra(T[l], 'arrivo', true), ATTESE[l][0],
      'in ' + l + ' la navetta ha cambiato l etichetta di un arrivo');
  }
});

/* «Ora» nudo non deve poter tornare da nessuna parte: ne' come chiave
   di ripiego nella tabella, ne' come testo scritto a mano nel modulo */
Deno.test('la chiave «ora» nuda non esiste piu e la pagina usa etichettaOra() sia al disegno sia al ricalcolo', () => {
  const T = testiDellaPagina();
  for (const l of LINGUE) {
    assert(!('ora' in T[l]), 'in ' + l + ' c e ancora la chiave "ora": qualcuno puo ricadere su «Ora»');
    for (const chiave of ['oraArrivo', 'oraRitiro', 'oraVolo']) {
      assert(typeof T[l][chiave] === 'string' && T[l][chiave].length > 0,
        'in ' + l + ' manca il testo ' + chiave);
    }
    assertEquals(new Set([T[l].oraArrivo, T[l].oraRitiro, T[l].oraVolo]).size, 3,
      'in ' + l + ' due delle tre etichette dell ora sono uguali: non si distinguono');
  }
  assert(/id="etiOra">\$\{esc\(etichettaOra\(t, VERSO, COLLETTIVO\)\)\}/.test(SORGENTE),
    'il modulo non disegna l etichetta con etichettaOra(): al primo sguardo l ospite legge un altra frase');
  assert(/\$\('etiOra'\)\.firstChild\.nodeValue = etichettaOra\(t, VERSO, COLLETTIVO\)/.test(SORGENTE),
    'aggiornaRitiro() non riscrive l etichetta con etichettaOra(): cambiando verso resta la frase sbagliata');
});
