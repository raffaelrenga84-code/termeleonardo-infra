/* nuovo file: disponibilita-azione.test.ts
   Non si prova la rete: si prova che la risposta dichiari l'unita' e la
   caparra, che sono le due cose che possono far sbagliare cifre all'ospite. */
import { assertEquals } from 'jsr:@std/assert';
/*  sta in disponibilita.ts e NON in index.ts: index.ts
   chiama Deno.serve in cima al file, quindi importarlo da un test avvierebbe
   un server vero durante . */
import { componiRisposta } from './disponibilita.ts';

const GREZZO = [[{
  room_category_id: 5,
  room_category: { id: 5, name: 'Doppia', max_adults: 2 },
  rates: [{ id: 1, name: 'Soggiorno breve', rate_variations: [{
    id: 1, rate_name: 'Soggiorno breve', name: 'Mezza Pensione',
    adult_total: 15500, children_total: 0, total: 31000,
  }] }],
}]];

Deno.test('la risposta dichiara che i prezzi sono in centesimi', () => {
  const r = componiRisposta(GREZZO, 2, 'it');
  assertEquals(r.valuta, 'centesimi');
  assertEquals(r.proposte[0].prezzo_cent, 31000);
});

Deno.test('la caparra e per adulto e viaggia con la disponibilita', () => {
  assertEquals(componiRisposta(GREZZO, 2, 'it').caparra_cent, 15000);
  assertEquals(componiRisposta(GREZZO, 3, 'it').caparra_cent, 22500);
});

Deno.test('le condizioni seguono la lingua chiesta', () => {
  assertEquals(componiRisposta(GREZZO, 2, 'de').condizioni.righe.join(' ').includes('7 Tage'), true);
  assertEquals(componiRisposta(GREZZO, 2, 'it').condizioni.righe.join(' ').includes('due giorni'), true);
});

/* ============================================================
   LA CHIUSURA INVERNALE (3 settembre 2026). Prove sul sorgente dell'handler:
   index.ts chiama Deno.serve in cima e non si importa.
   ============================================================ */
import { assert } from 'jsr:@std/assert';
const INDICE = Deno.readTextFileSync(new URL('index.ts', import.meta.url));

Deno.test('la stagione di chiusura si legge dalla tabella, non dal codice, e si espone alla pagina', () => {
  const m = INDICE.match(/if \(azione === 'stagione'\) \{([\s\S]*?)\n  \}/);
  assert(m, 'manca l azione stagione');
  assert(/leggiStagioni\(\)/.test(m![1]), 'non legge la tabella');
  assert(/s\.riapertura > oggi/.test(m![1]), 'non sceglie la stagione in corso o prossima');
  assert(/\?\? null/.test(m![1]), 'senza stagione deve rispondere null, non un errore');
});

Deno.test('con un soggiorno dentro la chiusura si risponde chiuso, senza chiamare il motore', () => {
  const m = INDICE.match(/if \(azione === 'disponibilita'\) \{([\s\S]*?)\n  \}/);
  assert(m, 'manca l azione disponibilita');
  const dove = m![1].indexOf('chiusuraCheCopre(');
  const fetchAMonte = m![1].indexOf("'/functions/v1/check-availability'");
  assert(dove > 0, 'non guarda le stagioni');
  assert(fetchAMonte > 0 && dove < fetchAMonte, 'guarda le stagioni DOPO aver chiamato il motore');
  assert(/proposte: \[\], chiuso/.test(m![1]), 'la risposta chiusa non porta la stagione');
});
