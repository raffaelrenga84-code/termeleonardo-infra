/* Test di riepilogo.ts.
   Il difetto che questi test presidiano e' quello visto in una schermata
   vera del back office: "→ · null notti · null ospiti" per una richiesta
   che non era affatto un soggiorno. Ogni test qui sotto o verifica che il
   tipo giusto produca la riga giusta, o che un campo mancante sparisca
   dalla riga invece di comparirci come null/undefined/NaN — e, dov'e' il
   caso, che una richiesta senza dettagli lo DICA invece di lasciare la riga
   bianca: una riga vuota in elenco e' lo stesso difetto vestito diverso,
   perche' chi guarda non sa se la richiesta e' vuota o se qualcosa si e'
   rotto. */
import { assert, assertEquals } from 'jsr:@std/assert';
import { riepilogoRichiesta } from './riepilogo.ts';

/* la stringa che compare quando non c'e' proprio niente da dire — deve
   comparire lei, non il vuoto */
const NESSUN_DETTAGLIO = 'nessun dettaglio indicato';

/* nessuna riga deve mai contenere questi tre testi, qualunque sia il caso:
   e' esattamente il difetto da cui parte questo modulo */
function senzaValoriSporchi(s: string): boolean {
  return !/\b(null|undefined|NaN)\b/i.test(s);
}

/* ---------------- trattamenti ---------------- */

const trattamentiCompleti = {
  tipo: 'trattamenti',
  dati: { voci: ['Massaggio antistress', 'Shiatsu', 'Scrub del Mar Morto'], giorno: '2026-08-21', fascia: 'mattina' },
};

Deno.test('trattamenti: dati completi danno la riga con conteggio, giorno e fascia', () => {
  const r = riepilogoRichiesta(trattamentiCompleti);
  assertEquals(r.etichetta, 'Trattamenti');
  assertEquals(r.riepilogo, '3 trattamenti · 21 agosto · mattina');
});

Deno.test('trattamenti: un solo trattamento si dice al singolare', () => {
  const r = riepilogoRichiesta({ tipo: 'trattamenti', dati: { voci: ['Shiatsu'], giorno: '2026-08-21', fascia: 'mattina' } });
  assertEquals(r.riepilogo, '1 trattamento · 21 agosto · mattina');
});

/* "indifferente" da sola, in mezzo a un conteggio e una data, non dice a
   cosa si riferisce: si scrive per esteso invece di lasciarla ambigua (o di
   ometterla, che qui varrebbe dire "tenere per se'" un'informazione vera —
   l'ospite ha risposto "mi va bene qualunque orario", e questo si dice) */
Deno.test('trattamenti: la fascia "indifferente" si legge per esteso, non ambigua', () => {
  const r = riepilogoRichiesta({ tipo: 'trattamenti', dati: { voci: ['Shiatsu', 'Pindasweda'], giorno: '2026-08-21', fascia: 'indifferente' } });
  assertEquals(r.riepilogo, '2 trattamenti · 21 agosto · orario indifferente');
});

Deno.test('trattamenti: dati a null lo dice, non lascia la riga bianca', () => {
  const r = riepilogoRichiesta({ tipo: 'trattamenti', dati: null });
  assertEquals(r.etichetta, 'Trattamenti');
  assertEquals(r.riepilogo, NESSUN_DETTAGLIO);
  assert(senzaValoriSporchi(r.riepilogo));
});

Deno.test('trattamenti: dati vuoto {} lo dice, non lascia la riga bianca', () => {
  const r = riepilogoRichiesta({ tipo: 'trattamenti', dati: {} });
  assertEquals(r.riepilogo, NESSUN_DETTAGLIO);
  assert(senzaValoriSporchi(r.riepilogo));
});

Deno.test('trattamenti: senza il giorno restano solo conteggio e fascia', () => {
  const r = riepilogoRichiesta({ tipo: 'trattamenti', dati: { voci: ['Shiatsu', 'Pindasweda'], fascia: 'pomeriggio' } });
  assertEquals(r.riepilogo, '2 trattamenti · pomeriggio');
  assert(senzaValoriSporchi(r.riepilogo));
});

Deno.test('trattamenti: senza la fascia restano conteggio e giorno', () => {
  const r = riepilogoRichiesta({ tipo: 'trattamenti', dati: { voci: ['Shiatsu'], giorno: '2026-08-21' } });
  assertEquals(r.riepilogo, '1 trattamento · 21 agosto');
});

/* ---------------- transfer ---------------- */

/* il valore vero letto dal database: due spazi copiati testualmente
   dall'elenco ATAM (vedi luoghi.ts). Il dato resta cosi' — solo la riga di
   riepilogo lo mostra con uno spazio solo */
const transferCompleto = {
  tipo: 'transfer',
  dati: { quando: '2026-08-15', ora: '15:30', pax: 2, verso: 'arrivo', luogo: 'Venezia  aeroporto' },
};

Deno.test('transfer: dati completi danno luogo, orario e persone, con un solo spazio', () => {
  const r = riepilogoRichiesta(transferCompleto);
  assertEquals(r.etichetta, 'Transfer');
  assertEquals(r.riepilogo, 'Venezia aeroporto → hotel · 15 ago 15:30 · 2 persone');
});

Deno.test('transfer: la partenza va verso il luogo, non da esso', () => {
  const r = riepilogoRichiesta({ tipo: 'transfer', dati: { ...transferCompleto.dati, verso: 'partenza' } });
  assertEquals(r.riepilogo, 'hotel → Venezia aeroporto · 15 ago 15:30 · 2 persone');
});

Deno.test('transfer: un solo passeggero si dice al singolare', () => {
  const r = riepilogoRichiesta({ tipo: 'transfer', dati: { ...transferCompleto.dati, pax: 1 } });
  assertEquals(r.riepilogo, 'Venezia aeroporto → hotel · 15 ago 15:30 · 1 persona');
});

Deno.test('transfer: dati a null lo dice, non lascia la riga bianca', () => {
  const r = riepilogoRichiesta({ tipo: 'transfer', dati: null });
  assertEquals(r.etichetta, 'Transfer');
  assertEquals(r.riepilogo, NESSUN_DETTAGLIO);
  assert(senzaValoriSporchi(r.riepilogo));
});

Deno.test('transfer: dati vuoto {} lo dice, non lascia la riga bianca', () => {
  const r = riepilogoRichiesta({ tipo: 'transfer', dati: {} });
  assertEquals(r.riepilogo, NESSUN_DETTAGLIO);
  assert(senzaValoriSporchi(r.riepilogo));
});

/* il regression case vero: se direzione() non controllasse il luogo prima
   di comporre la freccia, un luogo mancante darebbe "→ hotel" col vuoto a
   sinistra invece di sparire */
Deno.test('transfer: senza il luogo la freccia sparisce, non resta a meta', () => {
  const r = riepilogoRichiesta({ tipo: 'transfer', dati: { quando: '2026-08-15', ora: '15:30', pax: 2, verso: 'arrivo' } });
  assertEquals(r.riepilogo, '15 ago 15:30 · 2 persone');
  assert(senzaValoriSporchi(r.riepilogo));
});

Deno.test('transfer: senza un verso riconosciuto si mostra solo il luogo, con un solo spazio', () => {
  const r = riepilogoRichiesta({ tipo: 'transfer', dati: { quando: '2026-08-15', ora: '15:30', pax: 2, luogo: 'Venezia  aeroporto' } });
  assertEquals(r.riepilogo, 'Venezia aeroporto · 15 ago 15:30 · 2 persone');
});

/* ---------------- green fee ---------------- */

const greenfeeCompleto = {
  tipo: 'greenfee',
  dati: { circolo: 'montecchia', circolo_nome: 'Golf della Montecchia', data: '2026-09-10', ora: '09:30', giocatori: 2 },
};

/* circolo_nome, salvato gia' da tipi.ts, e' il nome buono e va per intero:
   la chiave capitalizzata e' solo il ripiego per le richieste che non
   hanno ancora circolo_nome */
Deno.test('greenfee: dati completi danno il nome per esteso del circolo, orario e giocatori', () => {
  const r = riepilogoRichiesta(greenfeeCompleto);
  assertEquals(r.etichetta, 'Green fee');
  assertEquals(r.riepilogo, 'Golf della Montecchia · 10 set 09:30 · 2 giocatori');
});

Deno.test('greenfee: un solo giocatore si dice al singolare', () => {
  const r = riepilogoRichiesta({ tipo: 'greenfee', dati: { ...greenfeeCompleto.dati, giocatori: 1 } });
  assertEquals(r.riepilogo, 'Golf della Montecchia · 10 set 09:30 · 1 giocatore');
});

/* se un giorno la chiave e il nome per esteso non corrispondessero (un dato
   corretto a mano, un refuso), vince circolo_nome: e' quello che tipi.ts
   salva apposta come nome da mostrare, non un derivato dalla chiave */
Deno.test('greenfee: circolo_nome ha la precedenza sulla chiave capitalizzata', () => {
  const r = riepilogoRichiesta({
    tipo: 'greenfee',
    dati: { circolo: 'montecchia', circolo_nome: 'Golf della Montecchia (soci)', data: '2026-09-10', ora: '09:30', giocatori: 2 },
  });
  assertEquals(r.riepilogo, 'Golf della Montecchia (soci) · 10 set 09:30 · 2 giocatori');
});

Deno.test('greenfee: dati a null lo dice, non lascia la riga bianca', () => {
  const r = riepilogoRichiesta({ tipo: 'greenfee', dati: null });
  assertEquals(r.etichetta, 'Green fee');
  assertEquals(r.riepilogo, NESSUN_DETTAGLIO);
  assert(senzaValoriSporchi(r.riepilogo));
});

Deno.test('greenfee: dati vuoto {} lo dice, non lascia la riga bianca', () => {
  const r = riepilogoRichiesta({ tipo: 'greenfee', dati: {} });
  assertEquals(r.riepilogo, NESSUN_DETTAGLIO);
});

/* una richiesta vecchia puo' non avere la chiave 'circolo' (aggiunta dopo):
   con solo circolo_nome si passa comunque dalla via principale, non dal
   ripiego */
Deno.test('greenfee: senza la chiave del circolo, circolo_nome basta', () => {
  const r = riepilogoRichiesta({ tipo: 'greenfee', dati: { circolo_nome: 'Golf della Montecchia', data: '2026-09-10', ora: '09:30', giocatori: 2 } });
  assertEquals(r.riepilogo, 'Golf della Montecchia · 10 set 09:30 · 2 giocatori');
});

/* senza circolo_nome si cade sulla chiave capitalizzata, verificata contro
   CIRCOLI_GOLF: e' il ripiego per le richieste ancora piu' vecchie */
Deno.test('greenfee: senza circolo_nome si usa la chiave capitalizzata', () => {
  const r = riepilogoRichiesta({ tipo: 'greenfee', dati: { circolo: 'montecchia', data: '2026-09-10', ora: '09:30', giocatori: 2 } });
  assertEquals(r.riepilogo, 'Montecchia · 10 set 09:30 · 2 giocatori');
});

/* circolo_nome e' testo libero quanto il luogo di un transfer: la stessa
   normalizzazione vale anche qui, per lo stesso motivo */
Deno.test('greenfee: anche il nome del circolo si mostra con un solo spazio', () => {
  const r = riepilogoRichiesta({ tipo: 'greenfee', dati: { circolo_nome: 'Golf  della  Montecchia', data: '2026-09-10', ora: '09:30', giocatori: 2 } });
  assertEquals(r.riepilogo, 'Golf della Montecchia · 10 set 09:30 · 2 giocatori');
});

Deno.test('greenfee: senza ne il circolo ne il suo nome il pezzo sparisce', () => {
  const r = riepilogoRichiesta({ tipo: 'greenfee', dati: { data: '2026-09-10', ora: '09:30', giocatori: 2 } });
  assertEquals(r.riepilogo, '10 set 09:30 · 2 giocatori');
});

/* un circolo battuto male, o non piu' in CIRCOLI_GOLF, non e' un club vero:
   Object.hasOwn lo scarta e il pezzo sparisce, mai una chiave capitalizzata
   a caso */
Deno.test('greenfee: un circolo sconosciuto non passa come nome breve inventato', () => {
  const r = riepilogoRichiesta({ tipo: 'greenfee', dati: { circolo: 'marte', circolo_nome: '', data: '2026-09-10', ora: '09:30', giocatori: 2 } });
  assertEquals(r.riepilogo, '10 set 09:30 · 2 giocatori');
});

/* ---------------- maestro ---------------- */

const maestroCompleto = {
  tipo: 'maestro',
  dati: { data: '2026-09-10', ora: '09:30', persone: 2, livello: 'principiante' },
};

Deno.test('maestro: dati completi danno orario, persone e livello', () => {
  const r = riepilogoRichiesta(maestroCompleto);
  assertEquals(r.etichetta, 'Maestro');
  assertEquals(r.riepilogo, '10 set 09:30 · 2 persone · principiante');
});

Deno.test('maestro: dati a null lo dice, non lascia la riga bianca', () => {
  const r = riepilogoRichiesta({ tipo: 'maestro', dati: null });
  assertEquals(r.etichetta, 'Maestro');
  assertEquals(r.riepilogo, NESSUN_DETTAGLIO);
});

Deno.test('maestro: dati vuoto {} lo dice, non lascia la riga bianca', () => {
  const r = riepilogoRichiesta({ tipo: 'maestro', dati: {} });
  assertEquals(r.riepilogo, NESSUN_DETTAGLIO);
});

Deno.test('maestro: senza il livello restano solo orario e persone', () => {
  const r = riepilogoRichiesta({ tipo: 'maestro', dati: { data: '2026-09-10', ora: '09:30', persone: 2 } });
  assertEquals(r.riepilogo, '10 set 09:30 · 2 persone');
  assert(senzaValoriSporchi(r.riepilogo));
});

/* ---------------- soggiorno ---------------- */

const soggiornoCompleto = { tipo: 'soggiorno', check_in: '2026-09-10', check_out: '2026-09-15', notti: 5, ospiti: 2 };

Deno.test('soggiorno: come oggi, periodo notti e ospiti', () => {
  const r = riepilogoRichiesta(soggiornoCompleto);
  assertEquals(r.etichetta, 'Soggiorno');
  assertEquals(r.riepilogo, '10/09/2026 → 15/09/2026 · 5 notti · 2 ospiti');
});

Deno.test('soggiorno: una notte e un ospite si dicono al singolare', () => {
  const r = riepilogoRichiesta({ tipo: 'soggiorno', check_in: '2026-09-10', check_out: '2026-09-11', notti: 1, ospiti: 1 });
  assertEquals(r.riepilogo, '10/09/2026 → 11/09/2026 · 1 notte · 1 ospite');
});

/* il contenuto di dati non conta per un soggiorno: la scheda camera vive li,
   il riepilogo usa solo le colonne del periodo */
Deno.test('soggiorno: dati a null non produce una riga sporca, il periodo resta', () => {
  const r = riepilogoRichiesta({ ...soggiornoCompleto, dati: null });
  assertEquals(r.riepilogo, '10/09/2026 → 15/09/2026 · 5 notti · 2 ospiti');
});

Deno.test('soggiorno: senza check_in/check_out/notti/ospiti lo dice, non torna "null notti null ospiti" ne resta bianca', () => {
  const r = riepilogoRichiesta({ tipo: 'soggiorno' });
  assertEquals(r.etichetta, 'Soggiorno');
  assertEquals(r.riepilogo, NESSUN_DETTAGLIO);
  assert(senzaValoriSporchi(r.riepilogo));
});

Deno.test('soggiorno: senza le notti restano periodo e ospiti', () => {
  const r = riepilogoRichiesta({ tipo: 'soggiorno', check_in: '2026-09-10', check_out: '2026-09-15', ospiti: 2 });
  assertEquals(r.riepilogo, '10/09/2026 → 15/09/2026 · 2 ospiti');
  assert(senzaValoriSporchi(r.riepilogo));
});

Deno.test('soggiorno: senza gli ospiti restano periodo e notti', () => {
  const r = riepilogoRichiesta({ tipo: 'soggiorno', check_in: '2026-09-10', check_out: '2026-09-15', notti: 5, ospiti: null });
  assertEquals(r.riepilogo, '10/09/2026 → 15/09/2026 · 5 notti');
  assert(senzaValoriSporchi(r.riepilogo));
});

/* ---------------- niente e' proprio niente: la riga lo dice ---------------- */

/* Il rilievo vero: una riga bianca in elenco e' lo stesso difetto di
   partenza vestito diverso, perche' chi guarda non sa se la richiesta non
   ha dettagli o se il back office si e' rotto. Questo test prova che
   compare del testo leggibile, non solo che non compare "null". */
Deno.test('senza alcun dettaglio la riga lo dice esplicitamente, non resta bianca', () => {
  const r = riepilogoRichiesta({ tipo: 'trattamenti', dati: null });
  assertEquals(r.riepilogo, NESSUN_DETTAGLIO);
  assert(r.riepilogo.length > 0, 'una riga vuota sembra un back office rotto, non una richiesta senza dettagli');
});

/* ---------------- tipo sconosciuto / il difetto OGGETTO[tipo] ---------------- */

Deno.test('un tipo sconosciuto non fa esplodere niente e non inventa un etichetta', () => {
  const r = riepilogoRichiesta({ tipo: 'scommesse', check_in: '2026-09-10', check_out: '2026-09-15', notti: 5, ospiti: 2 });
  assertEquals(r.etichetta, 'Richiesta');
  assertEquals(r.riepilogo, '10/09/2026 → 15/09/2026 · 5 notti · 2 ospiti');
});

/* 'toString' esiste su Object.prototype: un OGGETTO[tipo] senza guardia lo
   troverebbe (una funzione, quindi truthy) e lo restituirebbe com'etichetta.
   Con lo switch qui sotto questo non puo' succedere, ma il test lo blocca
   comunque se qualcuno un giorno riscrivesse la funzione con una tabella. */
Deno.test('il tipo "toString" e trattato come sconosciuto, non come una funzione ereditata', () => {
  const r = riepilogoRichiesta({ tipo: 'toString' });
  assertEquals(typeof r.etichetta, 'string');
  assertEquals(r.etichetta, 'Richiesta');
  assertEquals(r.riepilogo, NESSUN_DETTAGLIO);
  assert(!r.etichetta.includes('function'));
  assert(!r.riepilogo.includes('function'));
});

Deno.test('un tipo assente (undefined) e trattato come sconosciuto, e lo dice', () => {
  const r = riepilogoRichiesta({});
  assertEquals(r.etichetta, 'Richiesta');
  assertEquals(r.riepilogo, NESSUN_DETTAGLIO);
});
