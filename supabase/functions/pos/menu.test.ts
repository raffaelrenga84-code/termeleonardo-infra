/* ============================================================
   menu.test.ts — dagli articoli di Fidra al nostro menu'.
   «Bevande al bar, e alcuni prodotti dessert della vetrinetta; cibo in
   cucina» (la proprieta', 4 settembre 2026).
   ============================================================ */
import { assertEquals } from 'jsr:@std/assert';
import { importa, portataPer, stampantePer } from './menu.ts';

Deno.test('stampante: bevande, vetrinetta e dessert da banco al bar; cibo in cucina', () => {
  for (const c of ['Amari', 'Aperitivi', 'Bevande e Bibite', 'Birre', 'Bollicine - champagnes', 'Caffetteria e tisane', 'Cocktail', 'Vino Rosso Colli', 'Vetrinetta', 'Whiskey', 'Long Drinks Analcolici', 'Rose', 'Rum', 'Grappe', 'DEALCOLIZZATO', 'Vini al calice'])
    assertEquals(stampantePer(c), 'bar', c);
  for (const c of ['Piatti Caldi', 'Hamburger', 'Insalate', 'Contorni', 'Da Condividere', 'Dessert', 'Del Giorno', 'Piatti Freddi', 'Varie'])
    assertEquals(stampantePer(c), 'cucina', c);
});

Deno.test('portata predefinita dalla categoria', () => {
  assertEquals(portataPer('Birre'), 'bevande');
  assertEquals(portataPer('Piatti Freddi'), 'antipasti');
  assertEquals(portataPer('Hamburger'), 'secondi');
  assertEquals(portataPer('Dessert'), 'dolci');
  assertEquals(portataPer('Vetrinetta'), 'dolci');
  assertEquals(portataPer('Del Giorno'), 'secondi');
});

Deno.test('importa: riconosce le colonne dai nomi, prezzi con la virgola, righe senza nome scartate', () => {
  const r = importa(['ID', 'Nome', 'Categoria', 'Prezzo', 'IVA'], [
    ['12', 'Vino ROSE PETALO DI ROSA', 'Vini', '28,00', '10'],
    ['13', 'Coca Cola', 'Bevande e Bibite', '3.5', ''],
    ['14', '', 'Vini', '1', '10'],
  ]);
  assertEquals(r.scartate, 1);
  assertEquals(r.categorie, [{ nome: 'Vini', stampante: 'bar', portata: 'bevande' }, { nome: 'Bevande e Bibite', stampante: 'bar', portata: 'bevande' }]);
  assertEquals(r.articoli[0], { fidra_id: '12', nome: 'Vino ROSE PETALO DI ROSA', categoria: 'Vini', prezzo_cent: 2800, iva: 10 });
  assertEquals(r.articoli[1].prezzo_cent, 350);
  assertEquals(r.articoli[1].iva, 10, 'IVA vuota: 10, la ristorazione');
});

Deno.test('importa: senza colonna id usa il nome; il prezzo con il simbolo dell euro si legge lo stesso', () => {
  const r = importa(['Name', 'Category', 'Price'], [['Spritz Aperol', 'Aperitivi', '€ 6,00']]);
  assertEquals(r.articoli[0], { fidra_id: 'Spritz Aperol', nome: 'Spritz Aperol', categoria: 'Aperitivi', prezzo_cent: 600, iva: 10 });
});
