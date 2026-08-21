/* ============================================================
   formule.test.ts — che cosa comprende il trattamento di una tariffa.

   IL DIFETTO CHE PRESIDIA. La riga di una tariffa diceva «Mezza Pensione»
   e basta. Chi non è di casa non sa se comprende la cena, il pranzo, tutti
   e due — e accanto c'era «Bed & Breakfast» a un prezzo più basso senza
   niente che spiegasse la differenza. Su una pagina che vende, il prezzo
   più basso senza una ragione visibile sembra semplicemente quello giusto.

   IL DIFETTO CHE POTREBBE NASCERE DALLA CURA. Il motore non manda un
   identificativo del trattamento: solo una stringa, e in quattro lingue.
   Riconoscerla per forza vorrebbe dire descrivere una formula sbagliata su
   una pagina che vende — peggio del silenzio di prima. Per questo il
   riconoscimento è largo e QUELLO CHE NON SI RICONOSCE RESTA MUTO, e c'è
   una prova apposta per pretenderlo.
   ============================================================ */
import { assertEquals } from 'jsr:@std/assert';
import { formulaDi } from './formule.js';

Deno.test('la mezza pensione si riconosce nelle quattro lingue', () => {
  for (const s of ['Mezza Pensione', 'mezza pensione', 'Halbpension', 'Half Board', 'Demi-pension']) {
    assertEquals(formulaDi(s), 'cena', `non riconosciuta: «${s}»`);
  }
});

Deno.test('e la colazione anche', () => {
  for (
    const s of [
      'Bed & Breakfast',
      'Bed and Breakfast',
      'B&B',
      'Pernottamento e prima colazione',
      'Übernachtung mit Frühstück',
      'Petit-déjeuner',
    ]
  ) {
    assertEquals(formulaDi(s), 'colazione', `non riconosciuta: «${s}»`);
  }
});

Deno.test('la mezza pensione vince sulla colazione, non il contrario', () => {
  /* «mezza pensione con colazione e cena» contiene tutte e due le parole:
     descriverla come sola colazione toglierebbe la cena dal piatto di chi
     l'ha pagata */
  assertEquals(formulaDi('Mezza pensione (colazione e cena)'), 'cena');
  assertEquals(formulaDi('Halbpension mit Frühstück'), 'cena');
});

Deno.test('quello che non si riconosce resta muto', () => {
  /* il vuoto e' un esito normale: la riga esce col solo nome, come prima.
     Una formula indovinata su una pagina che vende e' peggio del silenzio. */
  for (const s of ['', null, undefined, 'Tutto compreso', 'All inclusive', 'Pacchetto Terme', 42]) {
    assertEquals(formulaDi(s as string), '', `ha indovinato su «${s}»`);
  }
});

Deno.test('e non descrive il piano tariffario, che e un altra cosa', () => {
  /* «Soggiorno Smart» costa piu' di «Soggiorno breve» a parita' di
     trattamento, e il perche' non sta scritto in nessuna fonte di casa.
     Finche' non lo scrive la proprieta', qui non si indovina. */
  for (const s of ['Soggiorno breve', 'Miglior Prezzo', 'Soggiorno Smart', 'Thermal Escape']) {
    assertEquals(formulaDi(s), '', `ha descritto il piano tariffario «${s}»`);
  }
});
