/* ============================================================
   stato.test.ts — l'ordine in mano al cameriere: puro, senza DOM.
   ============================================================ */
import { assertEquals } from 'jsr:@std/assert';
import { aggiungi, cambia, creaOrdine, daInviare, dividi, minutiSegue, perPortata, togli, totaleCent } from './stato.js';

const birra = { id: 'a1', nome: 'Birra', prezzo_cent: 500, portata: 'bevande', prezzo_libero: false };
const pasta = { id: 'a2', nome: 'Tagliatelle', prezzo_cent: 1400, portata: 'primi', prezzo_libero: false };

Deno.test('aggiungere, cambiare, togliere: ogni riga ha un id suo e la portata dell articolo', () => {
  let o = creaOrdine();
  o = aggiungi(o, birra, { quantita: 2 });
  o = aggiungi(o, pasta, { nota: 'senza glutine' });
  assertEquals(o.righe.length, 2);
  assertEquals(o.righe[0].portata, 'bevande');
  assertEquals(o.righe[1].nota, 'senza glutine');
  assertEquals(typeof o.righe[0].id, 'string');
  o = cambia(o, o.righe[0].id, { quantita: 3 });
  assertEquals(totaleCent(o), 1500 + 1400);
  o = togli(o, o.righe[1].id);
  assertEquals(o.righe.length, 1);
});

Deno.test('lo stesso articolo toccato due volte diventa quantita 2, non due righe', () => {
  let o = creaOrdine();
  o = aggiungi(o, birra); o = aggiungi(o, birra);
  assertEquals(o.righe.length, 1);
  assertEquals(o.righe[0].quantita, 2);
  /* ma con una nota diversa e una riga a se */
  o = aggiungi(o, birra, { nota: 'senza ghiaccio' });
  assertEquals(o.righe.length, 2);
});

Deno.test('perPortata raggruppa nell ordine delle portate; daInviare prende solo le nuove', () => {
  let o = creaOrdine();
  o = aggiungi(o, pasta); o = aggiungi(o, birra);
  assertEquals([...perPortata(o).keys()], ['bevande', 'primi']);
  o = cambia(o, o.righe[0].id, { stato: 'partita' });
  assertEquals(daInviare(o).length, 1);
});

Deno.test('la portata si puo scegliere a mano, e il prezzo a mano vince sul listino', () => {
  let o = creaOrdine();
  o = aggiungi(o, pasta, { portata: 'secondi', prezzoManualeCent: 1000 });
  assertEquals(o.righe[0].portata, 'secondi');
  assertEquals(totaleCent(o), 1000);
});

Deno.test('tre piadine, una senza formaggio: la riga si divide, e la nota va solo a quella', () => {
  /* «se uno ordina tre piadine ma una sola deve essere senza formaggio»
     (la proprieta', 5 settembre 2026) */
  let o = creaOrdine();
  o = aggiungi(o, pasta, { quantita: 3 });
  const id = o.righe[0].id;
  const d = dividi(o, id, 1);
  assertEquals(d.ordine.righe.length, 2);
  assertEquals(d.ordine.righe[0].quantita, 2, 'le due di prima restano sulla riga vecchia');
  assertEquals(d.ordine.righe[1].quantita, 1);
  assertEquals(d.ordine.righe[1].id, d.nuova, 'la riga nuova ha un id suo');
  assertEquals(d.ordine.righe[1].articolo, 'a2');
  assertEquals(d.ordine.righe[1].nota, null, 'nasce uguale: la nota la mette chi divide');
  /* dividere per tutte, o per zero, non divide niente */
  assertEquals(dividi(o, id, 3).ordine, o);
  assertEquals(dividi(o, id, 0).ordine, o);
  assertEquals(dividi(o, 'x', 1).ordine, o);
});

Deno.test('portate semplici: lo stesso articolo «subito» e «segue» fa due righe; i minuti del back office', () => {
  const caffe = { id: 'c', nome: 'Caffè', prezzo_cent: 150, portata: 'dolci' };
  let o = aggiungi(creaOrdine(), caffe);
  o = aggiungi(o, caffe, { segueMin: 5 });
  o = aggiungi(o, caffe, { segueMin: 5 });
  o = aggiungi(o, caffe, { segueMin: 0 });
  assertEquals(o.righe.map((r: { quantita: number; segue_min: number | null }) => [r.quantita, r.segue_min]), [[1, null], [2, 5], [1, 0]]);
  assertEquals(minutiSegue('5,10,15'), [5, 10, 15]);
  assertEquals(minutiSegue('15 5 5 0 999'), [5, 15]);
  assertEquals(minutiSegue(''), []);
});
