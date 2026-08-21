/* ============================================================
   cane.test.ts — la domanda sul cane, e la catena che la porta in fondo.

   IL DIFETTO CHE PRESIDIA, e non è di software: è una regola della casa
   che il software impediva di rispettare. La Knowledge Base, sezione
   ANIMALI DOMESTICI, dice che il cane «va segnalato SEMPRE al momento
   della prenotazione, mai all'arrivo». Fino al 21 agosto 2026 la pagina
   di prenotazione non aveva nessun modo di dirlo: obbligava l'ospite a
   violare la regola, e la reception scopriva il cane al banco, a camera
   già assegnata.

   UNA CASELLA NON BASTA: il campo deve attraversare cinque punti — la
   pagina, componiCorpo, il filtro del server (validaSoggiorno, che
   scarta tutto quello che non riconosce), il jsonb e la riga che la
   reception legge. Se si rompe uno solo, la spunta esiste e non arriva a
   nessuno: il difetto peggiore, perché l'ospite crede di aver avvisato.

   E IL DIVIETO VA DETTO PRIMA. Parco, piscine, grotte e zona relax sono
   vietati al cane. Chi lo scopre al banco ha già pagato e ha già portato
   il cane: è la stessa logica della cuffia obbligatoria.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { SUPPLEMENTO_CANE_CENT } from './cane.js';
import { componiCorpo } from './logica.js';

const BASE = {
  scelta: {
    nome: 'Matrimoniale Queen', tariffa: 'Soggiorno breve', trattamento: 'Mezza Pensione',
    camera_id: 6, variante_id: 1, prezzo_cent: 52000,
  },
  nome: 'Mario Rossi', email: 'mario@example.com', telefono: '3331234567',
  checkIn: '2026-09-10', checkOut: '2026-09-12',
  adulti: 2, bambini: 0, lingua: 'it', note: '',
};

Deno.test('il supplemento e quello della casa, in centesimi', () => {
  /* 13,00 € al giorno per animale, Knowledge Base sezione ANIMALI DOMESTICI */
  assertEquals(SUPPLEMENTO_CANE_CENT, 1300);
});

Deno.test('la spunta arriva dentro la richiesta', () => {
  assertEquals(componiCorpo({ ...BASE, cane: true }).dati.cane, true);
});

Deno.test('e senza spunta il campo non c e proprio', () => {
  /* non «false»: un «cane: false» in back office e' rumore che si legge
     come un dato raccolto */
  assertEquals(componiCorpo(BASE).dati.cane, undefined);
  assertEquals(componiCorpo({ ...BASE, cane: false }).dati.cane, undefined);
  assert(!Object.hasOwn(componiCorpo(BASE).dati, 'cane'));
});

Deno.test('la pagina chiede, e mostra i due fatti solo a chi risponde di si', () => {
  const pagina = Deno.readTextFileSync(new URL('index.html', import.meta.url));
  assert(pagina.includes('id="fCane"'), 'la domanda sul cane non c e piu nel modulo');
  assert(
    pagina.includes("cane: $('fCane') ? $('fCane').checked : false"),
    'la spunta non viaggia piu con la richiesta: l ospite crederebbe di aver avvisato',
  );
  assert(
    pagina.includes('t.caneNota(euroDaCentesimi(SUPPLEMENTO_CANE_CENT))'),
    'il testo non prende piu il supplemento dalla costante: potrebbero divergere',
  );
  assert(
    pagina.includes("$('fCane').addEventListener('change', mostraCane)"),
    'la nota non compare piu quando si spunta',
  );
});

Deno.test('e in ogni lingua dice quanto costa e dove il cane non entra', () => {
  /* il divieto su parco e piscine la Knowledge Base dice di dirlo SEMPRE:
     chi lo scopre al banco ha gia pagato e ha gia portato il cane */
  const pagina = Deno.readTextFileSync(new URL('index.html', import.meta.url));
  const PRETESE: [string, RegExp][] = [
    ['il parco', /parco|Park|park|parc/],
    ['le piscine', /piscine|Thermalbäder|thermal pools|piscines/],
    ['le grotte', /grotte|Grotten|caves|grottes/],
  ];
  for (const [lingua, segno] of [['it', /caneNota:\(imp\)=>`([^`]*)`/g]] as const) {
    const testi = [...pagina.matchAll(segno)].map((m) => m[1]);
    assertEquals(testi.length, 4, `le note del cane sono ${testi.length}, non 4 (${lingua})`);
    for (const [i, testo] of testi.entries()) {
      assert(testo.includes('${imp}'), `nota ${i + 1}: non usa il supplemento della costante`);
      for (const [che, s] of PRETESE) {
        assert(s.test(testo), `nota ${i + 1}: non dice ${che} fra i luoghi vietati`);
      }
    }
  }
});

Deno.test('la domanda porta la sua icona, e non dentro le traduzioni', () => {
  /* un simbolo dentro quattro stringhe tradotte e' un simbolo che prima o
     poi una lingua si dimentica. Sta fuori, in un posto solo. */
  const pagina = Deno.readTextFileSync(new URL('index.html', import.meta.url));
  assert(pagina.includes('class="iconaCane"'), 'sparita l icona del cane');
  assert(
    pagina.includes('aria-hidden="true"'),
    'l icona non e nascosta a chi si fa leggere la pagina: sentirebbe «cane» due volte',
  );
  const dentroTraduzioni = [...pagina.matchAll(/cane:'([^']*)'/g)].map((m) => m[1]);
  assert(dentroTraduzioni.length >= 4, 'le traduzioni della domanda non sono quattro');
  for (const testo of dentroTraduzioni) {
    assert(!/[\u{1F300}-\u{1FAFF}]/u.test(testo), `l icona e finita dentro una traduzione: «${testo}»`);
  }
});
