/* ============================================================
   vini.test.ts — i vini veri del listino Leonardo, dal PDF del
   ristorante e dalle schermate di Fidra (4 settembre 2026).
   ============================================================ */
import { assertEquals } from 'jsr:@std/assert';
import { categoriaVino, eVino } from './vini.ts';

Deno.test('i calici sono calici prima di tutto', () => {
  assertEquals(categoriaVino('CALICE Vegro Rosè Sengiari'), 'Vini al calice');
  assertEquals(categoriaVino('CALICE Soave DOC La Campagnola'), 'Vini al calice');
  assertEquals(categoriaVino('CALICE Vigna Costa Borin Cabernet Sauvignon'), 'Vini al calice');
  assertEquals(categoriaVino('Bicch. Prosecco'), 'Vini al calice');
});

Deno.test('le bollicine vengono prima del bianco', () => {
  assertEquals(categoriaVino('Franciacorta Uberti Brut'), 'Bollicine - champagnes');
  assertEquals(categoriaVino('MOET & CHANDON BRUT RISERVA IMPERIAL 0,75L'), 'Bollicine - champagnes');
  assertEquals(categoriaVino('VEUVE CLICQUOT BRUT 0,75L'), 'Bollicine - champagnes');
  assertEquals(categoriaVino('Prosecco Valdobbiadene DOC BORTOLOMIOL'), 'Bollicine - champagnes');
});

Deno.test('rossi e bianchi, e i Colli Euganei per conto loro', () => {
  assertEquals(categoriaVino('Vegro Sengiari Cabernet e Merlot'), 'Vino Rosso');
  assertEquals(categoriaVino('Vigna Costa Borin Cabernet Sauvignon'), 'Vino Rosso');
  assertEquals(categoriaVino('MERLOT Colli Euganei Sengiari'), 'Vino Rosso Colli');
  assertEquals(categoriaVino('Soave DOC La Campagnola'), 'Vino Bianco');
  assertEquals(categoriaVino('Sauvignon Blanc Borin'), 'Vino Bianco');
  assertEquals(categoriaVino('Kerner Palladium Martini&Son'), 'Vino Bianco');
  assertEquals(categoriaVino('BIANCO Colli Euganei Sengiari'), 'Vino Bianco Colli');
});

Deno.test('i rosati e i dessert', () => {
  assertEquals(categoriaVino('Vegro Rosè Sengiari'), 'Rose');
  assertEquals(categoriaVino('ROSE PETALO DI ROSA Frizzante Borin'), 'Rose');
  assertEquals(categoriaVino('"CORTE GIARA" CHIARETTO'), 'Rose');
  assertEquals(categoriaVino('Moscato Fior d’Arancio Colli Euganei'), 'Vini Dessert');
  assertEquals(categoriaVino('MALVASIA DON BOSCO'), 'Vini Dessert');
});

Deno.test('quello che vino non e resta fuori: niente finisce a caso', () => {
  for (const x of ['Greenfee 18 buche', 'SOGGIORNO ESENZIONE IVA', 'RICARICA AUTO ELETRICA WALLBOX',
    'Prodotti Estetici', 'Room Service', 'ACQUA MINERALE PANNA 0,75 L.', 'Birra Corona Bott. 0,33 L.',
    'Caffè Espresso', 'The Caldo - Menta']) {
    assertEquals(eVino(x), false, x);
    assertEquals(categoriaVino(x), null, x);
  }
});

Deno.test('un vino che non si capisce non si inventa: torna null', () => {
  /* meglio metterlo da parte spento che infilarlo nella categoria
     sbagliata e vederlo comparire sul palmare */
  assertEquals(categoriaVino('ETE’L 2019'), null);
  assertEquals(categoriaVino(''), null);
});
