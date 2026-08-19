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
import { assert, assertEquals } from 'jsr:@std/assert';
import { pezziDaArrivo } from './arrivo-invio.ts';

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
