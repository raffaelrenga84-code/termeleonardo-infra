/* ============================================================
   altre-camere.test.ts — le camere in più dentro le due email.

   IL DIFETTO, trovato rispondendo a una domanda della proprietà: «con
   più camere il cane dove va? che altri problemi potrebbero emergere?».

   Il carrello salvava le camere in più e index.ts le metteva in
   `altre_camere`, col commento «senza, l'ospite riceverebbe una ricevuta
   con una camera sola dopo averne prenotate tre». Quel campo NON LO
   LEGGEVA NESSUNO: la ricevuta mostrava una camera e un prezzo, l'avviso
   alla reception pure. Le altre esistevano in back office, legate dal
   campo `insieme`, ma nelle email — cioè nell'unica cosa che qualcuno
   legge davvero — non c'erano.

   È il difetto del buono regalo, per intero: un dato che arriva al
   database e non entra nell'email è un dato che nessuno leggerà.

   QUATTRO MODI DI ROMPERSI, e nessuno si vede prenotando una camera
   sola:

   · le camere in più non si stampano affatto, che è il difetto di
     partenza;
   · si stampano senza il loro numero di pratica, e in reception non si
     sa quale foglio è quale;
   · il totale conta solo quelle in più e dimentica la prima, o viceversa:
     una cifra sbagliata su un'email che parla di soldi;
   · un jsonb storto fa esplodere l'email, e allora l'ospite non riceve
     niente — che è peggio di una ricevuta incompleta.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import {
  camereInPiu, righeAltreCamere, rigaTotale, totaleCamereCent,
} from './altre-camere.ts';
import { cifra, ETICHETTE } from './dettagli-richiesta.ts';
import { ricevutaHTML } from './ricevuta.ts';
import { richiestaHTML } from './email-richiesta.ts';

/* la #18968, quella vera: due camere, periodi diversi */
const PRIMA = {
  check_in: '2026-09-02', check_out: '2026-09-20', ospiti: 1,
  tipo_camera: 'Matrimoniale Queen', pacchetto: 'Dolce Vita 10 cure',
  trattamento: 'Mezza Pensione', prezzo_cent: 319100, caparra_cent: 30000,
};
const SECONDA = {
  numero: 'C26/19131',
  colonne: {
    check_in: '2026-09-02', check_out: '2026-09-04', ospiti: 2,
    tipo_camera: 'Doppia', pacchetto: 'Soggiorno breve',
    dati: { trattamento: 'Mezza Pensione', prezzo_cent: 29000, culla: true },
  },
};
const TERZA = {
  numero: 'C26/19132',
  colonne: {
    check_in: '2026-09-10', check_out: '2026-09-12', ospiti: 2,
    tipo_camera: 'Suite Colli Euganei', pacchetto: 'Miglior Prezzo',
    dati: { trattamento: 'Bed & Breakfast', prezzo_cent: 45000 },
  },
};

/* ============ il conto ============ */

Deno.test('il totale conta la prima camera E quelle in piu', () => {
  /* il modo piu facile di sbagliare, e il piu caro: un totale che
     dimentica una camera su un email che parla di soldi */
  assertEquals(totaleCamereCent(PRIMA, [SECONDA, TERZA]), 319100 + 29000 + 45000);
});

Deno.test('e senza camere in piu resta il prezzo della prima', () => {
  assertEquals(totaleCamereCent(PRIMA, []), 319100);
  assertEquals(totaleCamereCent(PRIMA, null), 319100);
});

Deno.test('una camera senza prezzo non azzera il totale', () => {
  /* un totale che somma NaN non si stampa affatto, ed e peggio di un
     totale che vale un po meno */
  const rotta = { numero: 'C26/1', colonne: { tipo_camera: 'Doppia', dati: {} } };
  assertEquals(totaleCamereCent(PRIMA, [SECONDA, rotta]), 319100 + 29000);
});

Deno.test('e un jsonb storto non fa esplodere niente', () => {
  /* arriva da un database: puo essere qualunque cosa. Un email che non
     parte e peggio di una ricevuta incompleta. */
  for (const v of ['due', 42, {}, null, undefined, [null, 'x', 7]]) {
    assertEquals(camereInPiu(v).length, 0, `«${JSON.stringify(v)}» e passato`);
    assertEquals(totaleCamereCent(PRIMA, v), 319100);
    assertEquals(righeAltreCamere(v, ETICHETTE.it), '');
    assertEquals(rigaTotale(PRIMA, v, ETICHETTE.it, cifra), '');
  }
});

/* ============ quello che si legge ============ */

Deno.test('ogni camera in piu porta le sue date, la sua camera, il suo prezzo', () => {
  const html = righeAltreCamere([SECONDA, TERZA], ETICHETTE.it);
  for (const pezzo of ['Doppia', 'Soggiorno breve', '290,00 €',
    'Suite Colli Euganei', 'Miglior Prezzo', '450,00 €']) {
    assert(html.includes(pezzo), `manca «${pezzo}»`);
  }
});

Deno.test('e il suo numero di pratica', () => {
  /* in reception quelle righe sono pratiche distinte: senza il numero
     accanto non si sa quale foglio corrisponde a quale camera */
  const html = righeAltreCamere([SECONDA, TERZA], ETICHETTE.it);
  assert(html.includes('C26/19131'), 'manca il numero della seconda');
  assert(html.includes('C26/19132'), 'manca il numero della terza');
});

Deno.test('e si numerano da DUE: la prima e quella qui sopra', () => {
  const html = righeAltreCamere([SECONDA, TERZA], ETICHETTE.it);
  assert(html.includes('Camera 2'), 'la prima in piu non e la numero 2');
  assert(html.includes('Camera 3'), 'la seconda in piu non e la numero 3');
  assert(!html.includes('Camera 1'), 'una camera in piu si chiama «Camera 1»');
});

Deno.test('la culla chiesta su UNA camera si legge su quella camera', () => {
  /* e' della camera, non della persona: chi prenota due stanze puo'
     volerla in una sola */
  const html = righeAltreCamere([SECONDA, TERZA], ETICHETTE.it);
  assertEquals(html.split('Culla').length - 1, 1, 'la culla si legge su piu di una camera');
});

Deno.test('il totale si scrive solo quando le camere sono piu d una', () => {
  /* sotto un prezzo solo, «Totale» ripeterebbe la stessa cifra due righe
     piu sotto */
  assertEquals(rigaTotale(PRIMA, [], ETICHETTE.it, cifra), '');
  const con = rigaTotale(PRIMA, [SECONDA], ETICHETTE.it, cifra);
  assert(con.includes('Totale'), 'con due camere non si scrive il totale');
  assert(
    con.includes(cifra(319100 + 29000)),
    `il totale non e la somma delle due camere: ${con}`,
  );
});

Deno.test('e si legge nella lingua di chi legge', () => {
  const attese: Record<string, string> = {
    it: 'Camera 2', de: 'Zimmer 2', en: 'Room 2', fr: 'Chambre 2',
  };
  for (const [l, atteso] of Object.entries(attese)) {
    assert(
      righeAltreCamere([SECONDA], ETICHETTE[l]).includes(atteso),
      `in ${l} manca «${atteso}»`,
    );
  }
});

/* ============ e arrivano dentro le due email ============ */

const OSPITE = {
  tipo: 'soggiorno', numero: 'C26/19130', nome: 'Mario Rossi',
  email: 'mario@example.com', telefono: '3331234567', lingua: 'it',
  ...PRIMA,
  dati: { trattamento: 'Mezza Pensione', prezzo_cent: 319100, caparra_cent: 30000 },
};

Deno.test('la RICEVUTA all ospite le porta tutte, col totale', () => {
  /* era il difetto: «grazie, ecco la sua richiesta» e una camera sola,
     dopo che ne aveva chieste tre */
  const html = ricevutaHTML({ ...OSPITE, altre_camere: [SECONDA, TERZA] } as never);
  assert(html.includes('Doppia'), 'la ricevuta non porta la seconda camera');
  assert(html.includes('Suite Colli Euganei'), 'la ricevuta non porta la terza');
  assert(html.includes('C26/19131'), 'la ricevuta non porta i numeri delle altre');
  assert(
    html.includes(cifra(319100 + 29000 + 45000)),
    'la ricevuta non dice quanto costa in tutto',
  );
});

Deno.test('e con una camera sola resta esattamente quella di prima', () => {
  /* chi ne prenota una non deve trovarsi righe nuove: la ricevuta con una
     camera sola non cambia di una virgola */
  const sola = ricevutaHTML({ ...OSPITE } as never);
  assert(!sola.includes('Camera 2'), 'compare una seconda camera che non esiste');
  assert(!sola.includes('Totale di tutte le camere'), 'compare un totale di una camera sola');
});

Deno.test('l AVVISO alla reception le porta tutte, in italiano', () => {
  /* un avviso con una camera sola manda la reception a cercare le altre
     due in back office — sempre che sappia che ci sono */
  const html = richiestaHTML({ ...OSPITE, altre_camere: [SECONDA, TERZA] } as never);
  assert(html.includes('Camera 2'), 'l avviso non porta la seconda camera');
  assert(html.includes('C26/19132'), 'l avviso non porta il numero della terza');
  assert(html.includes('Totale di tutte le camere'), 'l avviso non dice il totale');
  assert(
    html.includes(cifra(319100 + 29000 + 45000)),
    'il totale dell avviso non e la somma delle tre camere',
  );
});

Deno.test('e in italiano anche quando l ospite scrive in tedesco', () => {
  /* questo avviso lo legge la casa, non l ospite: e' tutto in italiano */
  const html = richiestaHTML(
    { ...OSPITE, lingua: 'de', altre_camere: [SECONDA] } as never,
  );
  assert(html.includes('Camera 2'), 'l avviso alla reception e finito in tedesco');
  assert(!html.includes('Zimmer 2'), 'l avviso alla reception e finito in tedesco');
});
