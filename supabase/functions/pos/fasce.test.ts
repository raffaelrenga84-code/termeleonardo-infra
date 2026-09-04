/* ============================================================
   fasce.test.ts — i listini a fasce: happy hour, prezzo di sera.

   «i listini a fasce (happy hour, prezzo diverso di sera)» (la
   proprieta', 4 settembre 2026). Una fascia ha un'ora di inizio e una
   di fine (anche a cavallo della mezzanotte), i giorni, e il locale; e
   dentro la fascia un articolo costa o il prezzo scritto apposta per
   lui, o il listino meno uno sconto per categoria.
   ============================================================ */
import { assertEquals } from 'jsr:@std/assert';
import { applicaFascia, fasciaAttiva, minutiDi, oraLocale, prezzoInFascia } from './fasce.ts';

const happy = { id: 'F1', nome: 'Happy hour', locale: 'bistrot', dalle: '17:00', alle: '19:00', giorni: null, sconto_percento: 20, categorie: ['CAT-COCKTAIL'], attiva: true };
const notte = { id: 'F2', nome: 'Dopo cena', locale: null, dalle: '22:00', alle: '02:00', giorni: [5, 6], sconto_percento: null, categorie: null, attiva: true };
const spenta = { ...happy, id: 'F3', attiva: false };

Deno.test('l ora e il giorno si leggono nel fuso dell hotel, non in quello del server', () => {
  /* le 17:30 di Roma d'estate sono le 15:30 UTC */
  const r = oraLocale(new Date('2026-09-05T15:30:00Z'));
  assertEquals(r.minuti, 17 * 60 + 30);
  assertEquals(r.giorno, 6, 'sabato');
  assertEquals(minutiDi('17:00'), 1020);
  assertEquals(minutiDi('7:5'), 425);
  assertEquals(minutiDi('x'), null);
});

Deno.test('la fascia attiva: ora, giorno e locale', () => {
  const alle = (hhmm: string, giorno = 6) => ({ minuti: minutiDi(hhmm)!, giorno });
  assertEquals(fasciaAttiva({ fasce: [happy, notte, spenta], adesso: alle('17:30'), locale: 'bistrot' })?.id, 'F1');
  assertEquals(fasciaAttiva({ fasce: [happy, notte, spenta], adesso: alle('19:00'), locale: 'bistrot' }), null, 'alle 19:00 e finita: la fine e esclusa');
  assertEquals(fasciaAttiva({ fasce: [happy, notte], adesso: alle('17:30'), locale: 'ristorante' }), null, 'e del Bistrot');
  /* a cavallo della mezzanotte: le 23:00 di sabato e le 01:00 di domenica notte */
  assertEquals(fasciaAttiva({ fasce: [happy, notte], adesso: alle('23:00', 6), locale: 'ristorante' })?.id, 'F2');
  assertEquals(fasciaAttiva({ fasce: [happy, notte], adesso: alle('01:00', 0), locale: 'ristorante' })?.id, 'F2', 'l una di domenica notte e ancora il sabato sera');
  assertEquals(fasciaAttiva({ fasce: [happy, notte], adesso: alle('23:00', 2), locale: 'ristorante' }), null, 'il martedi no');
  /* una fascia del locale vince su una di tutti */
  const tutti = { ...happy, id: 'F4', locale: null };
  assertEquals(fasciaAttiva({ fasce: [tutti, happy], adesso: alle('17:30'), locale: 'bistrot' })?.id, 'F1');
});

Deno.test('dentro la fascia: prezzo scritto apposta, se no lo sconto della categoria, se no niente', () => {
  const prezzi = [{ fascia: 'F1', articolo: 'A-SPRITZ', prezzo_cent: 500 }];
  assertEquals(prezzoInFascia({ articolo: { id: 'A-SPRITZ', categoria: 'CAT-COCKTAIL', prezzo_cent: 700 }, fascia: happy, prezzi }), 500);
  assertEquals(prezzoInFascia({ articolo: { id: 'A-NEGRONI', categoria: 'CAT-COCKTAIL', prezzo_cent: 900 }, fascia: happy, prezzi }), 720);
  assertEquals(prezzoInFascia({ articolo: { id: 'A-CAFFE', categoria: 'CAT-CAFFE', prezzo_cent: 150 }, fascia: happy, prezzi }), null, 'fuori dalle categorie della fascia');
  assertEquals(prezzoInFascia({ articolo: { id: 'A-CAFFE', categoria: 'CAT-CAFFE', prezzo_cent: 150 }, fascia: notte, prezzi }), null, 'una fascia senza sconto tocca solo i prezzi scritti');
  /* lo sconto arrotonda al centesimo, e un articolo a zero resta a zero */
  assertEquals(prezzoInFascia({ articolo: { id: 'x', categoria: 'CAT-COCKTAIL', prezzo_cent: 333 }, fascia: happy, prezzi: [] }), 266);
  assertEquals(prezzoInFascia({ articolo: { id: 'x', categoria: 'CAT-COCKTAIL', prezzo_cent: 0 }, fascia: happy, prezzi: [] }), null);
});

Deno.test('il menu con la fascia applicata: prezzo in vigore, e il listino tenuto da parte', () => {
  const articoli = [{ id: 'A-SPRITZ', categoria: 'CAT-COCKTAIL', prezzo_cent: 700 }, { id: 'A-CAFFE', categoria: 'CAT-CAFFE', prezzo_cent: 150 }];
  const r = applicaFascia({ articoli, fascia: happy, prezzi: [{ fascia: 'F1', articolo: 'A-SPRITZ', prezzo_cent: 500 }] });
  assertEquals(r[0], { id: 'A-SPRITZ', categoria: 'CAT-COCKTAIL', prezzo_cent: 500, prezzo_base_cent: 700, in_fascia: true });
  assertEquals(r[1], { id: 'A-CAFFE', categoria: 'CAT-CAFFE', prezzo_cent: 150 });
  assertEquals(applicaFascia({ articoli, fascia: null, prezzi: [] }), articoli, 'senza fascia niente cambia');
});

Deno.test('dalle e alle uguali: tutto il giorno', () => {
  const sempre = { id: 'F9', nome: 'Sempre', locale: null, dalle: '00:00', alle: '00:00', giorni: null, sconto_percento: 10, categorie: null, attiva: true };
  assertEquals(fasciaAttiva({ fasce: [sempre], adesso: { minuti: 0, giorno: 0 }, locale: 'bistrot' })?.id, 'F9');
  assertEquals(fasciaAttiva({ fasce: [sempre], adesso: { minuti: 1439, giorno: 3 }, locale: null })?.id, 'F9');
});
