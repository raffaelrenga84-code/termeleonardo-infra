/* ============================================================
   portate-semplici.test.ts — il Bistrot senza portate: tutto insieme, e
   solo il «segue» aspetta, a tempo o a chiamata (6 settembre 2026).
   ============================================================ */
import { assertEquals } from 'jsr:@std/assert';
import { dividiSemplice, gruppoSegue, minutiSegue, minutiSegueValido, quandoSegue, segueScaduti } from './portate.ts';

Deno.test('i minuti del back office: «5,10,15», puliti, senza doppioni, in ordine', () => {
  assertEquals(minutiSegue('5,10,15'), [5, 10, 15]);
  assertEquals(minutiSegue(' 15; 5 , 5, 0, 200, x '), [5, 15]);
  assertEquals(minutiSegue(''), []);
  assertEquals(minutiSegue(null), []);
});

Deno.test('segue_min dal palmare: null subito, 0 a chiamata, N minuti, mai piu di 180', () => {
  assertEquals(minutiSegueValido(null), null);
  assertEquals(minutiSegueValido(''), null);
  assertEquals(minutiSegueValido(0), 0);
  assertEquals(minutiSegueValido('10'), 10);
  assertEquals(minutiSegueValido(999), 180);
  assertEquals(minutiSegueValido(-3), null);
  assertEquals(minutiSegueValido('boh'), null);
});

Deno.test('quando parte da se: l invio piu i minuti; niente se subito o a chiamata', () => {
  assertEquals(quandoSegue('2026-09-06T18:00:00.000Z', 5), '2026-09-06T18:05:00.000Z');
  assertEquals(quandoSegue('2026-09-06T18:00:00.000Z', 0), null);
  assertEquals(quandoSegue('2026-09-06T18:00:00.000Z', null), null);
});

Deno.test('all invio parte tutto, tranne il segue', () => {
  const righe = [
    { id: 'a', stato: 'da_inviare', segue_min: null },
    { id: 'b', stato: 'da_inviare', segue_min: 5 },
    { id: 'c', stato: 'da_inviare', segue_min: 0 },
    { id: 'd', stato: 'partita', segue_min: null },
  ];
  const { subito, attesa } = dividiSemplice(righe);
  assertEquals(subito.map((r) => r.id), ['a']);
  assertEquals(attesa.map((r) => r.id), ['b', 'c']);
});

Deno.test('«Manda il segue»: prima quello a chiamata, poi il tempo piu vicino, gruppo per gruppo', () => {
  const righe = [
    { id: 'caffe', stato: 'inviata', segue_alle: '2026-09-06T18:05:00.000Z' },
    { id: 'dolce', stato: 'inviata', segue_alle: '2026-09-06T18:15:00.000Z' },
    { id: 'amaro', stato: 'inviata', segue_alle: null },
    { id: 'pizza', stato: 'partita', segue_alle: null },
  ];
  assertEquals(gruppoSegue(righe).map((r) => r.id), ['amaro']);
  const senzaChiamata = righe.filter((r) => r.id !== 'amaro');
  assertEquals(gruppoSegue(senzaChiamata).map((r) => r.id), ['caffe']);
  assertEquals(gruppoSegue([{ id: 'x', stato: 'partita', segue_alle: null }]), []);
});

Deno.test('a tempo: parte da se solo quando il tempo e scaduto', () => {
  const righe = [
    { id: 'caffe', stato: 'inviata', segue_alle: '2026-09-06T18:05:00.000Z' },
    { id: 'dolce', stato: 'inviata', segue_alle: '2026-09-06T18:15:00.000Z' },
    { id: 'amaro', stato: 'inviata', segue_alle: null },
  ];
  assertEquals(segueScaduti(righe, new Date('2026-09-06T18:04:59Z')).map((r) => r.id), []);
  assertEquals(segueScaduti(righe, new Date('2026-09-06T18:05:00Z')).map((r) => r.id), ['caffe']);
  assertEquals(segueScaduti(righe, new Date('2026-09-06T19:00:00Z')).map((r) => r.id), ['caffe', 'dolce']);
});
