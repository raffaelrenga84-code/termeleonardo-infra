import { assertEquals } from 'jsr:@std/assert';
import { calcolaScadenza, type Stagione } from './scadenza.ts';

/* Le date vere della stagione 2026/2027, dalla proprietà. */
const STAGIONI: Stagione[] = [
  { chiusura: '2026-11-29', riapertura: '2027-02-13' },
];

const acquisto = (s: string) => new Date(s + 'T12:00:00Z');

Deno.test('fuori dalla chiusura: dodici mesi pieni, nessuna proroga', () => {
  assertEquals(calcolaScadenza(acquisto('2026-08-15'), STAGIONI), {
    scade_il: '2027-08-15', scade_il_base: '2027-08-15', prorogato: false,
  });
});

Deno.test('dentro la chiusura: spostata a riapertura piu un mese', () => {
  /* comprato il 30 novembre 2025 -> scadrebbe il 30 novembre 2026, che e'
     il giorno dopo la chiusura: l'hotel e' chiuso, si sposta */
  assertEquals(calcolaScadenza(acquisto('2025-11-30'), STAGIONI), {
    scade_il: '2027-03-13', scade_il_base: '2026-11-30', prorogato: true,
  });
});

Deno.test('il giorno della chiusura conta come chiuso', () => {
  assertEquals(calcolaScadenza(acquisto('2025-11-29'), STAGIONI).prorogato, true);
});

Deno.test('il giorno della riapertura conta come chiuso: nessun margine per prenotare', () => {
  const r = calcolaScadenza(acquisto('2026-02-13'), STAGIONI);
  assertEquals(r.scade_il_base, '2027-02-13');
  assertEquals(r.prorogato, true);
  assertEquals(r.scade_il, '2027-03-13');
});

Deno.test('il giorno prima della chiusura non si tocca', () => {
  assertEquals(calcolaScadenza(acquisto('2025-11-28'), STAGIONI).prorogato, false);
});

Deno.test('il giorno dopo la riapertura non si tocca', () => {
  assertEquals(calcolaScadenza(acquisto('2026-02-14'), STAGIONI).prorogato, false);
});

Deno.test('senza le date della stagione non si proroga: scadenza naturale', () => {
  assertEquals(calcolaScadenza(acquisto('2025-11-30'), []), {
    scade_il: '2026-11-30', scade_il_base: '2026-11-30', prorogato: false,
  });
});

Deno.test('sceglie la stagione giusta fra piu stagioni', () => {
  const due: Stagione[] = [
    { chiusura: '2026-11-29', riapertura: '2027-02-13' },
    { chiusura: '2027-11-28', riapertura: '2028-02-12' },
  ];
  assertEquals(calcolaScadenza(acquisto('2026-12-01'), due).scade_il, '2028-03-12');
});

Deno.test('29 febbraio: i dodici mesi non inventano un giorno che non esiste', () => {
  /* comprato il 29 febbraio 2028 (bisestile): un anno dopo il 29 febbraio
     non esiste. Il risultato deve essere una data vera, non il 1 marzo per
     scivolamento silenzioso di Date. */
  const r = calcolaScadenza(acquisto('2028-02-29'), []);
  assertEquals(r.scade_il_base, '2029-02-28');
});

Deno.test('riapertura piu un mese: il 31 non diventa il 3 del mese dopo', () => {
  const strane: Stagione[] = [{ chiusura: '2026-11-29', riapertura: '2027-01-31' }];
  /* 31 gennaio + 1 mese: il 31 febbraio non esiste */
  assertEquals(calcolaScadenza(acquisto('2026-01-15'), strane).scade_il, '2027-02-28');
});
