/* ============================================================
   arrivo-invio.test.ts — da una compilazione del check-in alle richieste.

   PERCHE' UN MODULO PURO. La parte che decide QUANTE righe nascono e con
   quali dati non ha bisogno ne' di rete ne' di database, e provarla
   attraverso una chiamata HTTP vorrebbe dire non provarla mai.

   IL TRANSFER DEV'ESSERE INDISTINGUIBILE da quello del sito: stesso
   validatore, stessi nomi di campo, quindi stesso prezzo, stesso pulsante
   ATAM, stessa conferma. Se qui si scrivesse una forma "simile", il
   listino non la riconoscerebbe e la reception tornerebbe a scrivere i
   prezzi a mano.
   ============================================================ */
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert';
import { carichiAvviso, pezziDaArrivo, righeDaArrivo } from './arrivo-invio.ts';
import { richiestaHTML } from './email-richiesta.ts';

const OGGI = new Date('2026-09-01T12:00:00Z');

const MINIMO = { ora_arrivo: '16:30', mezzo: 'auto' };

const COMPLETO = {
  ...MINIMO,
  attenzioni: ['culla', 'cane'],
  fanghi_desiderio: 'presto',
  persone_extra: [{ nome: 'Bianchi Luca', eta: '12' }],
  note: 'Arriviamo dopo cena se il traffico e brutto',
  transfer: true,
  transfer_dati: {
    verso: 'arrivo', luogo: 'Venezia  aeroporto', quando: '2026-09-12',
    ora: '15:30', pax: 3, volo: 'FR1234', cell: '+39 333 1234567',
  },
  fattura: true,
  fattura_dati: {
    ragione: 'Bianchi S.r.l.', indirizzo: 'Via Roma 1, Padova',
    piva: 'IT02042330288', sdi: 'M5UXCR1',
  },
};

Deno.test('una compilazione minima fa nascere una riga sola', () => {
  const r = pezziDaArrivo(MINIMO, OGGI);
  assert(!r.errore, r.errore);
  assertEquals(r.pezzi!.length, 1);
  assertEquals(r.pezzi![0].tipo, 'arrivo');
});

Deno.test('una compilazione completa ne fa nascere tre, in ordine', () => {
  const r = pezziDaArrivo(COMPLETO, OGGI);
  assert(!r.errore, r.errore);
  assertEquals(r.pezzi!.map((p) => p.tipo), ['arrivo', 'transfer', 'fattura']);
});

/* La spunta senza i dati non fa nascere una riga vuota: una richiesta di
   transfer senza luogo ne' data manderebbe la reception a telefonare per
   chiedere cosa ha chiesto l'ospite. */
Deno.test('la spunta del transfer senza dati e un errore, non una riga vuota', () => {
  const r = pezziDaArrivo({ ...MINIMO, transfer: true, transfer_dati: {} }, OGGI);
  assert(r.errore, 'e passata una richiesta di transfer senza niente dentro');
  assert(!r.pezzi, 'sono nati dei pezzi nonostante l errore');
});

/* LA PROVA CHE TIENE LE DUE STRADE INSIEME: il luogo passa dallo stesso
   elenco chiuso del modulo del sito. */
Deno.test('un luogo fuori elenco e rifiutato come dal sito', () => {
  const r = pezziDaArrivo({
    ...MINIMO, transfer: true,
    transfer_dati: { ...COMPLETO.transfer_dati, luogo: 'aeroporto di venezia' },
  }, OGGI);
  assert(r.errore?.includes('luogo'), `errore ricevuto: ${r.errore}`);
});

Deno.test('il transfer nasce coi nomi di campo del modulo del sito', () => {
  const t = pezziDaArrivo(COMPLETO, OGGI).pezzi!.find((p) => p.tipo === 'transfer')!;
  assertEquals(t.dati.luogo, 'Venezia  aeroporto');
  assertEquals(t.dati.quando, '2026-09-12');
  assertEquals(t.dati.ora, '15:30');
  assertEquals(t.dati.pax, 3);
  assertEquals(t.dati.verso, 'arrivo');
});

Deno.test('se un pezzo e invalido non ne nasce nessuno', () => {
  const r = pezziDaArrivo({ ...MINIMO, fattura: true, fattura_dati: { ragione: 'X' } }, OGGI);
  assert(r.errore, 'una fattura senza piva ne cf e passata');
  assert(!r.pezzi);
});

/* ============================================================
   GIRO DI CORREZIONE 1 — quattro difetti dalla revisione.

   IL PIU' GRAVE: l'azione passava `dati: p.dati` ANNIDATO al carico per
   avvisaHotel, ma richiestaHTML (email-richiesta.ts) legge i campi del
   tipo — luogo, quando, ragione, ora_arrivo... — STESI sull'oggetto, come
   fa il percorso pubblico del sito (componiRichiesta produce
   {...contatti, ...colonne, ...propri}). Un avviso cosi' arriva alla
   reception con ogni campo proprio a "undefined": peggio dell'email
   scritta a mano che questo compito sostituisce.

   IL SECONDO: `persone_confermate` esiste per sopravvivere a
   ?a=conferma, cioe' per essere scritto dalla RECEPTION. Ma `arrivo` non
   sta in TIPI_ATTIVI: questa azione e' l'UNICA porta pubblica sul campo,
   e senza un freno un ospite potrebbe mandarlo gia' `true` e disinnescare
   da solo la garanzia «qualcuno ha risposto».

   Le prove sotto muovono la logica pura — costruire le righe, stendere il
   carico per l'avviso — dentro questo modulo, cosi' si provano senza il
   guscio HTTP di index.ts. La sequenza dei cancelli (token, gia mandato,
   numerazione, insert) resta li': quella ha bisogno del database per
   essere vera, e non si finge. */

const LINK = { intestatario: 'Bianchi Mario', email: 'mario@example.it', lingua: 'it' };
const NUMERI = [
  { anno: 2026, progressivo: 41, numero: 'RS-2026-0041' },
  { anno: 2026, progressivo: 42, numero: 'RS-2026-0042' },
  { anno: 2026, progressivo: 43, numero: 'RS-2026-0043' },
];
const CONTESTO = {
  token: 'tok-abc123', telefono: '+39 333 1234567',
  ip: '1.2.3.4', adesso: '2026-09-01T12:00:00.000Z',
};

Deno.test('persone_confermate mandato dal browser non sopravvive alla validazione', () => {
  const r = pezziDaArrivo({ ...MINIMO, persone_confermate: true }, OGGI);
  assert(!r.errore, r.errore);
  const arrivo = r.pezzi!.find((p) => p.tipo === 'arrivo')!;
  assertEquals(arrivo.dati.persone_confermate, false);
});

Deno.test('persone_confermate resta falso anche con transfer e fattura spuntati', () => {
  const r = pezziDaArrivo({ ...COMPLETO, persone_confermate: true }, OGGI);
  assert(!r.errore, r.errore);
  const arrivo = r.pezzi!.find((p) => p.tipo === 'arrivo')!;
  assertEquals(arrivo.dati.persone_confermate, false);
});

Deno.test('righeDaArrivo fa una riga per pezzo, coi dati ancora annidati e il contesto giusto', () => {
  const pezzi = pezziDaArrivo(COMPLETO, OGGI).pezzi!;
  const righe = righeDaArrivo(LINK, pezzi, NUMERI, CONTESTO);
  assert(righe.length > 0, 'nessuna riga costruita');
  assertEquals(righe.length, 3);
  assertEquals(righe.map((r) => r.tipo), ['arrivo', 'transfer', 'fattura']);
  assertEquals(righe.map((r) => r.numero), NUMERI.map((n) => n.numero));
  /* per la RICEVUTA i dati restano annidati: riepilogoRichiesta() (Task 6)
     li legge cosi', non stesi */
  assertEquals(righe[1].dati.luogo, 'Venezia  aeroporto');
  assertEquals(righe[1].dati_originali, righe[1].dati);
  for (const r of righe) {
    assertEquals(r.nome, LINK.intestatario);
    assertEquals(r.email, LINK.email);
    assertEquals(r.lingua, LINK.lingua);
    assertEquals(r.arrivo_token, CONTESTO.token);
    assertEquals(r.origine, 'check-in online');
    assertEquals(r.ip, CONTESTO.ip);
    assertEquals(r.privacy_il, CONTESTO.adesso);
    assertEquals(r.telefono, CONTESTO.telefono);
  }
});

/* LA PROVA CHE AVREBBE SCOPERTO IL DIFETTO PIU' GRAVE: il carico per
   avvisaHotel porta il luogo in cima all'oggetto, non sotto `dati` — e non
   ha affatto una chiave `dati`, che e' esattamente la forma sbagliata che
   il codice mandava alla reception prima di questa correzione. */
Deno.test('carichiAvviso stende i dati sull oggetto: il carico del transfer porta il luogo', () => {
  const pezzi = pezziDaArrivo(COMPLETO, OGGI).pezzi!;
  const righe = righeDaArrivo(LINK, pezzi, NUMERI, CONTESTO);
  const carichi = carichiAvviso(righe);
  assert(carichi.length > 0, 'nessun carico costruito');
  const t = carichi.find((c) => c.tipo === 'transfer')!;
  assert(t, 'nessun carico di tipo transfer');
  assertEquals(t.luogo, 'Venezia  aeroporto');
  assertEquals(t.quando, '2026-09-12');
  assertEquals(t.pax, 3);
  assert(!Object.hasOwn(t, 'dati'), 'il carico annida ancora i dati: richiestaHTML li leggerebbe come undefined');
  assertEquals(t.numero, NUMERI[1].numero);
  assertEquals(t.nome, LINK.intestatario);
});

/* E LA PROVA GEMELLA, RESA VERA ATTRAVERSO richiestaHTML: e' quello che ha
   davvero ricevuto la reception prima della correzione — "RICHIESTA DAL
   SITO | Soggiorno | undefined notti · undefined ospiti" per l'arrivo e
   per la fattura, perche' ne' l'una ne' l'altra avevano un ramo loro in
   email-richiesta.ts. */
Deno.test('l HTML dell avviso per un arrivo non contiene mai la parola undefined', () => {
  const pezzi = pezziDaArrivo(COMPLETO, OGGI).pezzi!;
  const righe = righeDaArrivo(LINK, pezzi, NUMERI, CONTESTO);
  const carichi = carichiAvviso(righe);
  const a = carichi.find((c) => c.tipo === 'arrivo')!;
  assert(a, 'nessun carico di tipo arrivo');
  const h = richiestaHTML(a as never);
  assert(!h.includes('undefined'), `l'avviso arrivo contiene undefined:\n${h}`);
  assertStringIncludes(h, '16:30');
  assertStringIncludes(h, 'auto');
});

Deno.test('l HTML dell avviso per una fattura non contiene mai la parola undefined', () => {
  const pezzi = pezziDaArrivo(COMPLETO, OGGI).pezzi!;
  const righe = righeDaArrivo(LINK, pezzi, NUMERI, CONTESTO);
  const carichi = carichiAvviso(righe);
  const f = carichi.find((c) => c.tipo === 'fattura')!;
  assert(f, 'nessun carico di tipo fattura');
  const h = richiestaHTML(f as never);
  assert(!h.includes('undefined'), `l'avviso fattura contiene undefined:\n${h}`);
  assertStringIncludes(h, 'Bianchi S.r.l.');
  assertStringIncludes(h, 'IT02042330288');
});
