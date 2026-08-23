/* ============================================================
   supplementi.test.ts — la culla e il cane dentro il conto delle email.

   IL DIFETTO, segnalato dalla proprietà con la ricevuta ricevuta sul
   telefono: la pagina gli aveva mostrato il totale coi supplementi e
   l'email diceva il prezzo della camera e basta. Due numeri per la stessa
   richiesta, e quello scritto nero su bianco è il più basso: la
   differenza si scopre al banco.

   TRE MODI DI ROMPERSI, e nessuno si vede su una richiesta senza cane né
   culla:

   · i numeri di casa divergono da quelli della pagina — 13 € al giorno
     scritti in due posti, e un giorno uno dei due cambia;
   · il cane si conta sulle notti di una camera sola: con due camere di
     periodi diversi l'email dice meno di quello che la reception chiede;
   · i supplementi si sommano ma non si scrivono, e l'ospite legge un
     totale che non sa spiegare — che è quello che poi contesta.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import {
  nottiDelSoggiorno, righeSupplementi, SUPPLEMENTO_CANE_CENT,
  SUPPLEMENTO_CULLA_CENT, supplementiCent, vociSupplementi,
} from './supplementi.ts';
import { cifra, ETICHETTE } from './dettagli-richiesta.ts';
import { SUPPLEMENTO_CANE_CENT as CANE_PAGINA } from '../../../pagine/prenota/cane.js';
import { SUPPLEMENTO_CULLA_CENT as CULLA_PAGINA } from '../../../pagine/prenota/culla.js';

const T = ETICHETTE.it;

/* diciotto notti e due notti, la #18968 */
const PRIMA = { check_in: '2026-09-02', check_out: '2026-09-20', prezzo_cent: 319100 };
const SECONDA = {
  numero: 'C26/19131',
  colonne: {
    check_in: '2026-09-02', check_out: '2026-09-04',
    dati: { prezzo_cent: 29000, culla: true },
  },
};

/* ============ i numeri sono quelli della pagina ============ */

Deno.test('i supplementi del server sono quelli della pagina', () => {
  /* le funzioni si pubblicano una cartella per volta e non possono
     importare dalle pagine: la copia e voluta, e questa e il presidio.
     Se divergono, la pagina promette una cifra e l email ne scrive un altra. */
  assertEquals(SUPPLEMENTO_CANE_CENT, CANE_PAGINA);
  assertEquals(SUPPLEMENTO_CULLA_CENT, CULLA_PAGINA);
});

/* ============ le due regole ============ */

Deno.test('la culla si conta per CAMERA', () => {
  const una = vociSupplementi({ ...PRIMA, culla: true }, [], T);
  assertEquals(una.length, 1);
  assertEquals(una[0].cent, SUPPLEMENTO_CULLA_CENT);
  assertEquals(una[0].eti, 'Culla');

  const due = vociSupplementi({ ...PRIMA, culla: true }, [SECONDA], T);
  assertEquals(due[0].cent, 2 * SUPPLEMENTO_CULLA_CENT);
  assertEquals(due[0].eti, '2 culle');
});

Deno.test('e il cane AL GIORNO, su tutto il soggiorno', () => {
  /* dal 2 al 20 settembre sono 18 notti, non le 2 della seconda camera:
     contare quelle direbbe un numero piu basso di quello che la reception
     poi chiede */
  assertEquals(nottiDelSoggiorno(PRIMA, [SECONDA]), 18);
  const voci = vociSupplementi({ ...PRIMA, cane: true }, [SECONDA], T);
  const cane = voci.find((v) => v.eti.includes('Cane'));
  assert(cane, 'il cane non si conta');
  assertEquals(cane!.cent, 18 * SUPPLEMENTO_CANE_CENT);
  assertEquals(cane!.eti, 'Cane · 18 giorni');
});

Deno.test('e il cane e della PERSONA: sta sulla capofila', () => {
  /* chi prenota tre stanze ha un cane, non tre. Un `cane: true` su una
     camera in piu non lo raddoppia. */
  const soloSullaSeconda = {
    ...SECONDA,
    colonne: { ...SECONDA.colonne, dati: { ...SECONDA.colonne.dati, cane: true } },
  };
  assertEquals(vociSupplementi(PRIMA, [soloSullaSeconda], T).filter((v) =>
    v.eti.includes('Cane')).length, 0);
});

Deno.test('e chi non ha chiesto niente non ha nessuna riga', () => {
  /* «Culla 0,00 €» e un prezzo in piu su un email che ne ha gia tanti */
  assertEquals(vociSupplementi(PRIMA, [], T), []);
  assertEquals(supplementiCent(PRIMA, [], T), 0);
  assertEquals(righeSupplementi(PRIMA, [], T, cifra), '');
});

Deno.test('e le date storte non inventano notti', () => {
  /* le date arrivano da un database: possono essere qualunque cosa, e un
     cane «· NaN giorni» in reception non si puo leggere */
  for (const d of [{}, { check_in: 'domani', check_out: 'dopodomani' },
    { check_in: '2026-09-20', check_out: '2026-09-02' }]) {
    assertEquals(nottiDelSoggiorno({ ...d, cane: true }, []), 0);
    assertEquals(vociSupplementi({ ...d, cane: true }, [], T), []);
  }
});

/* ============ e si leggono ============ */

Deno.test('le righe si scrivono con l etichetta e la cifra', () => {
  const html = righeSupplementi({ ...PRIMA, cane: true, culla: true }, [SECONDA], T, cifra);
  assert(html.includes('2 culle'), 'manca la riga delle culle');
  assert(html.includes(cifra(2 * SUPPLEMENTO_CULLA_CENT)), 'manca la cifra delle culle');
  assert(html.includes('Cane · 18 giorni'), 'manca la riga del cane');
  assert(html.includes(cifra(18 * SUPPLEMENTO_CANE_CENT)), 'manca la cifra del cane');
});

Deno.test('e si leggono nella lingua di chi legge', () => {
  const attese: Record<string, string> = {
    it: 'Culla', de: 'Kinderbett', en: 'Cot', fr: 'Lit bébé',
  };
  for (const [l, atteso] of Object.entries(attese)) {
    const voci = vociSupplementi({ ...PRIMA, culla: true }, [], ETICHETTE[l]);
    assertEquals(voci[0].eti, atteso, `in ${l} la culla si chiama diversamente`);
  }
});
