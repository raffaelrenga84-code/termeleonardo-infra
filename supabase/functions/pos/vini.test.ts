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

Deno.test('i vini del ristorante hanno la categoria nel nome: quella vince su tutto', () => {
  /* le schermate del POS ristorante (la proprieta', 4 settembre 2026):
     «Vino Rosso Barolo…», «Vino Dessert Franciacorta…». Fidra la scrive,
     non c e niente da dedurre. */
  assertEquals(categoriaVino('Vino Rosso Barolo Docg Az. Marchesi'), 'Vino Rosso');
  assertEquals(categoriaVino('Vino Bianco Pinot Grigio Le Monde'), 'Vino Bianco');
  assertEquals(categoriaVino('Vino Rosato Ca’ Dei Frati'), 'Rose');
  assertEquals(categoriaVino('Vino Rosato Levius Rosé Martin & Son'), 'Rose');
  /* IL CASO CHE MI AVREBBE FREGATO: un Franciacorta brut e' una bollicina
     dappertutto, ma Fidra lo tiene fra i dessert e comanda lui */
  assertEquals(categoriaVino('Vino Dessert Franciacorta Brut D.o.c.g.'), 'Vini Dessert');
  assertEquals(categoriaVino('Vino Dessert Prosecco Miol'), 'Vini Dessert');
  assertEquals(categoriaVino('Vino Dessert Prosecco "D’O" Rosè brut DOC'), 'Vini Dessert');
});

Deno.test('Colli Euganei si, Colli Berici e Collio no', () => {
  /* «Colli Berici», «Colli Senesi», «Collio» sono altri posti: un
     Cabernet dei Colli Berici e un rosso, non un rosso dei Colli */
  assertEquals(categoriaVino('Vino Rosso Merlot Colli Euganei Sengiari'), 'Vino Rosso Colli');
  assertEquals(categoriaVino('Vino Rosso "Triangolo" Colli Euganei riserva Terre Gaie'), 'Vino Rosso Colli');
  assertEquals(categoriaVino('Vino Bianco Bianco Colli Euganei Sengiari'), 'Vino Bianco Colli');
  assertEquals(categoriaVino('Vino Rosso Merlot Colli Berici Igt Riserva'), 'Vino Rosso');
  assertEquals(categoriaVino('Vino Rosso Chianti Colli Senesi Farnetella'), 'Vino Rosso');
  assertEquals(categoriaVino('Vino Bianco Pinot Grigio Collio - Schiopetto'), 'Vino Bianco');
  assertEquals(categoriaVino('Vino Rosso Merlot Collio Superiore Az. Russiz'), 'Vino Rosso');
});

Deno.test('i calici del ristorante restano calici', () => {
  assertEquals(categoriaVino('Calice di Vino Dei Colli'), 'Vini al calice');
  assertEquals(categoriaVino('Calice di vino dei Colli'), 'Vini al calice');
});
