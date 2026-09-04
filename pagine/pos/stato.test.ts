/* ============================================================
   stato.test.ts — l'ordine in mano al cameriere: puro, senza DOM.
   ============================================================ */
import { assertEquals } from 'jsr:@std/assert';
import { aggiungi, cambia, creaOrdine, daInviare, perPortata, togli, totaleCent } from './stato.js';

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
