#!/usr/bin/env node
/* ============================================================
   menu-ospiti.js — nomi, descrizioni e allergeni per chi ordina dal QR.

   Spec docs/superpowers/specs/2026-09-05-menu-ospiti-design.md. Italiano
   e tedesco vengono dal menù stampato «La Piazza Bistrot» (PDF 2026);
   inglese e francese sono tradotti. Le marche non si toccano. Scrive
   SOLO dove il campo e' vuoto: le correzioni fatte nel back office
   restano (con --forza riscrive tutto). Non tocca mai i prezzi.

   Uso:  node strumenti/menu-ospiti.js [--prova] [--forza]
   ============================================================ */
const fs = require('node:fs');

const PROVA = process.argv.includes('--prova');
const FORZA = process.argv.includes('--forza');
const token = (process.env.SUPABASE_ACCESS_TOKEN || fs.readFileSync('C:/Users/admin/token-supabase.txt', 'utf8')).trim();
const sql = async (query) => {
  const r = await fetch('https://api.supabase.com/v1/projects/mvuiuwakuseockotlcnp/database/query', {
    method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j));
  return j;
};
const S = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const J = (o) => S(JSON.stringify(o)) + '::jsonb';
const chiave = (s) => String(s).replace(/[’`´]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();

/* [nome nel POS] → { n: nomi it/en/de/fr, d: descrizioni, a: allergeni } */
const N = (it, en, de, fr) => ({ it, en, de, fr });
const ARTICOLI = {
  /* piatti freddi */
  'Mozzarella di Bufala & Pomodoro Rosso Origano e Basilico': { n: N('Mozzarella di bufala e pomodoro rosso', 'Buffalo mozzarella & red tomato', 'Büffelmozzarella & Tomaten', 'Mozzarella di bufala et tomate'), d: N('Origano e basilico (mozzarella 125 g)', 'Oregano and basil (125 g mozzarella)', 'Oregano und Basilikum (Mozzarella 125 g)', 'Origan et basilic (mozzarella 125 g)'), a: 'LA' },
  'Prosciutto Crudo Burrata e Valeriana': { n: N('Prosciutto crudo, burrata e valeriana', 'Parma ham, burrata and lamb’s lettuce', 'Parmaschinken, Burrata und Feldsalat', 'Jambon de Parme, burrata et mâche'), d: N('Burrata 125 g', '125 g burrata', 'Burrata 125 g', 'Burrata 125 g'), a: 'LA' },
  'RISO VENERE': { n: N('Riso Venere con verdure e gamberi', 'Black Venere rice with vegetables and prawns', 'Schwarzer Venere-Reis mit Gemüse und Garnelen', 'Riz Venere noir aux légumes et crevettes'), a: 'CR' },
  /* piatti caldi */
  'ZUPPA DI CEREALI': { n: N('Zuppa di cereali con crostini', 'Cereal soup with croutons', 'Getreidesuppe mit Croutons', 'Soupe de céréales aux croûtons'), a: 'GL-CE' },
  'Penne rigate alle verdure Glutenfree': { n: N('Penne rigate alle verdure o salsa del giorno', 'Penne rigate with vegetables or sauce of the day', 'Penne rigate mit Gemüse oder Tagessauce', 'Penne rigate aux légumes ou sauce du jour'), d: N('Senza glutine', 'Gluten-free', 'Glutenfrei', 'Sans gluten'), a: '' },
  'CANNELLONI CON RICOTTO E SPINACE': { n: N('Cannelloni con ricotta e spinaci', 'Cannelloni with ricotta and spinach', 'Cannelloni mit Ricotta und Spinat', 'Cannelloni à la ricotta et aux épinards'), a: 'GL-LA-U' },
  'Petto di Pollo Grigliato al Rosmarino': { n: N('Petto di pollo grigliato al rosmarino', 'Grilled chicken breast with rosemary', 'Gegrilltes Hähnchenbrustfilet mit Rosmarin', 'Blanc de poulet grillé au romarin'), d: N('Servito con verdure del giorno e patate al forno', 'With vegetables of the day and roast potatoes', 'Mit Tagesgemüse und Ofenkartoffeln', 'Légumes du jour et pommes de terre au four'), a: '' },
  'COTOLETTA DI POLLO MILANESE': { n: N('Cotoletta di pollo alla milanese', 'Chicken cutlet Milanese style', 'Panierte Hähnchenbrust', 'Escalope de poulet à la milanaise'), d: N('Con patatine fritte', 'With French fries', 'Mit Pommes frites', 'Avec frites'), a: 'GL-U' },
  /* specialita' da condividere */
  'PIADINA ROMAGNOLA': { n: N('Piadina romagnola', 'Piadina romagnola', 'Piadina romagnola', 'Piadina romagnola'), d: N('Squacquerone, crudo e rucola', 'Squacquerone cheese, Parma ham and rocket', 'Squacquerone-Käse, Parmaschinken und Rucola', 'Squacquerone, jambon cru et roquette'), a: 'GL-LA' },
  'PIADINA MEDITERRANEA': { n: N('Piadina mediterranea', 'Piadina mediterranea', 'Piadina mediterranea', 'Piadina mediterranea'), d: N('Mozzarella di bufala, verdure alla griglia, maionese e olio EVO', 'Buffalo mozzarella, grilled vegetables, mayonnaise and extra virgin olive oil', 'Büffelmozzarella, Gemüse vom Grill, Mayonnaise, Olivenöl extra vergine', 'Mozzarella di bufala, légumes grillés, mayonnaise et huile d’olive vierge extra'), a: 'GL-LA' },
  'Tostone Classico': { n: N('Tostone classico', 'Classic toastie', 'Klassischer Toast', 'Toast classique'), d: N('Formaggio e prosciutto cotto', 'Cheese and cooked ham', 'Käse, gekochter Schinken', 'Fromage et jambon cuit'), a: 'GL-LA' },
  'Tostone Farcito': { n: N('Tostone farcito', 'Filled toastie', 'Toast mit Zucchini', 'Toast garni'), d: N('Tostone classico + zucchine alla griglia', 'Classic toastie plus grilled courgettes', 'Toast, Käse, gekochter Schinken, gegrillte Zucchini', 'Toast classique + courgettes grillées'), a: 'GL-LA' },
  'La Pinsa PARMENSE': { n: N('La Pinsa parmense', 'Pinsa parmense', 'Pinsa parmense', 'Pinsa parmense'), d: N('Pomodoro, prosciutto crudo e stracciatella', 'Tomato, Parma ham and stracciatella', 'Tomaten, Parmaschinken und Stracciatella', 'Tomate, jambon de Parme et stracciatella'), a: 'GL-LA' },
  'La Pinsa VEGETARIANA': { n: N('La Pinsa vegetariana', 'Vegetarian pinsa', 'Pinsa vegetariana', 'Pinsa végétarienne'), d: N('Pomodoro, mozzarella fior di latte, melanzane e zucchine grigliate', 'Tomato, fior di latte mozzarella, grilled aubergines and courgettes', 'Tomaten, Mozzarella, Auberginen und gegrillte Zucchini', 'Tomate, mozzarella fior di latte, aubergines et courgettes grillées'), a: 'GL-LA' },
  'La Pinsa Margherita': { n: N('La Pinsa margherita', 'Pinsa margherita', 'Pinsa margherita', 'Pinsa margherita'), d: N('Pomodoro, mozzarella fior di latte, basilico', 'Tomato, fior di latte mozzarella, basil', 'Tomaten, Mozzarella und Basilikum', 'Tomate, mozzarella fior di latte, basilic'), a: 'GL-LA' },
  'SALMONE AFFUMICATO TOAST': { n: N('Toast al salmone affumicato', 'Smoked salmon toast', 'Geräucherter Wildlachs auf Toast', 'Toast au saumon fumé'), d: N('Uovo sodo, salsa guacamole, insalatina e sesamo', 'Boiled egg, guacamole, salad and sesame', 'Hartgekochtes Ei, Guacamole, Salatgarnitur, Sesam', 'Œuf dur, guacamole, salade et sésame'), a: 'GL-U-P-SE' },
  'BRUSCHETTA ALL’ITALIANA': { n: N('Bruschetta all’italiana', 'Italian bruschetta', 'Bruschetta all’italiana', 'Bruschetta à l’italienne'), d: N('Pomodoro, mozzarella, origano', 'Tomato, mozzarella, oregano', 'Tomate, Mozzarella, Oregano', 'Tomate, mozzarella, origan'), a: 'GL-LA' },
  'GUACAMOLE TOAST': { n: N('Guacamole toast', 'Guacamole toast', 'Guacamole-Toast', 'Toast au guacamole'), d: N('Prosciutto crudo, burrata, salsa guacamole e insalatina', 'Parma ham, burrata, guacamole and salad', 'Parmaschinken, Burrata, Guacamole und Salat', 'Jambon cru, burrata, guacamole et salade'), a: 'GL-LA' },
  'PANE PUCCIA CON CRUDO E MOZZARELLA': { n: N('Pane puccia con crudo e mozzarella', 'Puccia bread with Parma ham and mozzarella', 'Puccia-Brot mit Parmaschinken und Mozzarella', 'Pain puccia au jambon cru et mozzarella'), a: 'GL-LA' },
  /* contorni */
  'Verdure alla griglia': { n: N('Verdure alla griglia', 'Grilled vegetables', 'Gegrilltes Gemüse', 'Légumes grillés'), a: '' },
  'Insalata mista verde': { n: N('Insalata mista verde', 'Mixed green salad', 'Gemischter grüner Salat', 'Salade verte mixte'), a: '' },
  'Patate fritte': { n: N('Patate fritte', 'French fries', 'Pommes frites', 'Frites'), a: '' },
  'FIORI DI ZUCCA IN TEMPURA': { n: N('Fiori di zucca in tempura', 'Courgette flowers in tempura', 'Frittierte Zucchiniblüten in Tempura', 'Fleurs de courgette en tempura'), a: 'GL' },
  /* insalatone */
  'GINEVRA': { n: N('Insalatona Ginevra', 'Ginevra salad', 'Salatteller Ginevra', 'Salade Ginevra'), d: N('Misticanza, rucola, valeriana, pomodorini, mozzarella di bufala (125 g) e olive', 'Mixed leaves, rocket, lamb’s lettuce, cherry tomatoes, buffalo mozzarella (125 g) and olives', 'Gemischter Salat, Rucola, Feldsalat, Tomaten, Büffelmozzarella (125 g), Oliven', 'Mesclun, roquette, mâche, tomates cerises, mozzarella di bufala (125 g) et olives'), a: 'LA' },
  'LEONARDO': { n: N('Insalatona Leonardo', 'Leonardo salad', 'Salatteller Leonardo', 'Salade Leonardo'), d: N('Mix di insalate croccanti, pomodorini, uova, gamberetti e tonno', 'Crisp mixed salad, cherry tomatoes, eggs, prawns and tuna', 'Gemischter Salat, Rucola, Feldsalat, Tomate, gekochtes Ei, Thunfisch und Garnelen', 'Salades croquantes, tomates cerises, œufs, crevettes et thon'), a: 'CR-P-U' },
  'CESARE': { n: N('Insalatona Cesare', 'Caesar salad', 'Salatteller Cesare', 'Salade César'), d: N('Misticanza, rucola, valeriana, pomodorini, petto di pollo, grana a scaglie, crostini, salsa Caesar', 'Mixed leaves, rocket, lamb’s lettuce, cherry tomatoes, chicken breast, Grana shavings, croutons, Caesar dressing', 'Gemischter Salat, Rucola, Feldsalat, Tomate, Hähnchenbrust, gehobelter Grana, geröstete Brotscheiben, Caesar-Dressing', 'Mesclun, roquette, mâche, tomates cerises, blanc de poulet, copeaux de grana, croûtons, sauce César'), a: 'LA-GL-U' },
  'INSALATA DI FARRO CON VERDURE E GAMBERI': { n: N('Insalata di farro con verdure e gamberi', 'Spelt salad with vegetables and prawns', 'Dinkelsalat mit Gemüse und Garnelen', 'Salade d’épeautre aux légumes et crevettes'), a: 'GL-CR' },
  /* hamburger */
  'CLASSIC': { n: N('Hamburger Classic', 'Classic burger', 'Hamburger Classic', 'Burger Classic'), d: N('Pane, hamburger di Chianina 200 g, maionese, lattuga, pomodoro a fette, formaggio Cheddar', 'Bun, 200 g Chianina beef, mayonnaise, lettuce, sliced tomato, Cheddar', 'Brot, 200 g Chianina-Fleisch, Mayonnaise, Tomatenscheiben, Cheddar, Salat', 'Pain, bœuf Chianina 200 g, mayonnaise, laitue, tomate, cheddar'), a: 'GL-U-LA' },
  'ROYAL': { n: N('Hamburger Royal', 'Royal burger', 'Hamburger Royal', 'Burger Royal'), d: N('Pane, hamburger di Chianina 200 g, maionese, tartare di cipolla di Tropea in agrodolce, bacon croccante, cheddar', 'Bun, 200 g Chianina beef, mayonnaise, sweet-and-sour Tropea onion tartare, crispy bacon, Cheddar', 'Brot, 200 g Chianina-Fleisch, Mayonnaise, Tartar von süßsaurer Tropea-Zwiebel, knuspriger Speck, Cheddar', 'Pain, bœuf Chianina 200 g, mayonnaise, tartare d’oignon de Tropea aigre-doux, bacon croustillant, cheddar'), a: 'GL-U-LA' },
  'VEGGIE DELIZIA': { n: N('Hamburger Veggie Delizia', 'Veggie Delizia burger', 'Hamburger Veggie Delizia', 'Burger Veggie Delizia'), d: N('Pane, hamburger vegetariano, pomodoro, lattuga e maionese vegana', 'Bun, vegetarian burger, tomato, lettuce and vegan mayonnaise', 'Brot, vegetarischer Burger, Tomate, Salat und vegane Mayonnaise', 'Pain, burger végétarien, tomate, laitue et mayonnaise végane'), a: 'GL' },
  /* dessert */
  'TORTINO CALDO AL CIOCCOLATO': { n: N('Tortino caldo al cioccolato con cuore fondente', 'Warm chocolate cake with a molten dark heart', 'Warmes Schokotörtchen mit dunkler Schokoladenfüllung', 'Fondant au chocolat cœur coulant'), a: 'GL-U-LA' },
  'TIRAMISU’ DELLA CASA': { n: N('Tiramisù della casa', 'Homemade tiramisù', 'Hausgemachtes Tiramisu', 'Tiramisu maison'), a: 'GL-LA-U' },
  'DOLCE DEL GIORNO': { n: N('Dolce del giorno', 'Dessert of the day', 'Tagesdessert', 'Dessert du jour'), a: 'GL-LA-U-FG' },
  'MACEDONIA': { n: N('Macedonia di frutta fresca', 'Fresh fruit salad', 'Frischer Obstsalat', 'Salade de fruits frais'), a: '' },
  'TRIS DI GELATI ARTIGIANALI': { n: N('Tris di gelati artigianali', 'Trio of artisan ice creams', 'Dreierlei von Eis', 'Trio de glaces artisanales'), a: 'GL-LA-U-FG' },
  'CACO': { n: N('Caco', 'Persimmon', 'Kaki', 'Kaki'), a: '' },
  'Pallina Gelato': { n: N('Pallina di gelato', 'Scoop of ice cream', 'Kugel Eis', 'Boule de glace'), a: 'LA' },
  'Panna Montata': { n: N('Panna montata', 'Whipped cream', 'Schlagsahne', 'Chantilly'), a: 'LA' },
  'Sorbetto': { n: N('Sorbetto', 'Sorbet', 'Sorbet', 'Sorbet'), a: '' },
  /* vetrinetta */
  'ANGURIA O MELONE A FETTE': { n: N('Anguria o melone a fette', 'Sliced watermelon or melon', 'Wassermelone oder Melone in Scheiben', 'Pastèque ou melon en tranches'), a: '' },
  'BISCOTTINO': { n: N('Biscottino', 'Small biscuit', 'Kleiner Keks', 'Petit biscuit'), a: 'GL-LA-U' },
  'BISCOTTO': { n: N('Biscotto', 'Biscuit', 'Keks', 'Biscuit'), a: 'GL-LA-U' },
  'Brioche Albicocche': { n: N('Brioche all’albicocca', 'Apricot brioche', 'Brioche mit Aprikose', 'Brioche à l’abricot'), a: 'GL-LA-U' },
  'Brioche Cioccolata': { n: N('Brioche al cioccolato', 'Chocolate brioche', 'Brioche mit Schokolade', 'Brioche au chocolat'), a: 'GL-LA-U' },
  'Brioche Frutti di bosco': { n: N('Brioche ai frutti di bosco', 'Berry brioche', 'Brioche mit Waldbeeren', 'Brioche aux fruits des bois'), a: 'GL-LA-U' },
  'Danesina': { n: N('Danesina', 'Danish pastry', 'Plundergebäck', 'Danois'), a: 'GL-LA-U' },
  'FOCACCIA MARGHERITA': { n: N('Focaccia margherita', 'Focaccia margherita', 'Focaccia Margherita', 'Focaccia margherita'), a: 'GL-LA' },
  'Frittelle': { n: N('Frittelle', 'Fritters', 'Krapfen', 'Beignets'), a: 'GL-LA-U' },
  'Girelle uvetta': { n: N('Girella all’uvetta', 'Raisin swirl', 'Rosinenschnecke', 'Escargot aux raisins'), a: 'GL-LA-U' },
  'PIZZETTE': { n: N('Pizzette', 'Mini pizzas', 'Mini-Pizzen', 'Mini-pizzas'), a: 'GL-LA' },
  'SCHIACCIATA ROMANA': { n: N('Schiacciata romana', 'Roman flatbread', 'Römisches Fladenbrot', 'Fougasse romaine'), a: 'GL' },
  /* acqua */
  'Acqua Gaverina Naturale 0,75 L.': { n: N('Acqua Gaverina naturale 0,75 l', 'Gaverina still water 0.75 l', 'Gaverina stilles Wasser 0,75 l', 'Eau Gaverina plate 0,75 l') },
  'Acqua Gaverina Gasata 0,75 L.': { n: N('Acqua Gaverina frizzante 0,75 l', 'Gaverina sparkling water 0.75 l', 'Gaverina Wasser mit Kohlensäure 0,75 l', 'Eau Gaverina gazeuse 0,75 l') },
  'Acqua Minerale Naturale Latt. 0,50 L.': { n: N('Acqua naturale in lattina 0,5 l', 'Still water, can 0.5 l', 'Stilles Wasser, Dose 0,5 l', 'Eau plate, canette 0,5 l') },
  'Acqua Minerale Gassata Latt. 0,50 L.': { n: N('Acqua frizzante in lattina 0,5 l', 'Sparkling water, can 0.5 l', 'Wasser mit Kohlensäure, Dose 0,5 l', 'Eau gazeuse, canette 0,5 l') },
  'Acqua Minerale Panna 0,75 L.': { n: N('Acqua Panna naturale 0,75 l', 'Panna still water 0.75 l', 'Panna stilles Wasser 0,75 l', 'Eau Panna plate 0,75 l') },
  'Acqua Minerale San Pellegrino 0,75 L.': { n: N('Acqua San Pellegrino frizzante 0,75 l', 'San Pellegrino sparkling water 0.75 l', 'San Pellegrino Wasser mit Kohlensäure 0,75 l', 'Eau San Pellegrino gazeuse 0,75 l') },
  'Acqua San Pellegrino 0,5 L.': { n: N('Acqua San Pellegrino frizzante 0,5 l', 'San Pellegrino sparkling water 0.5 l', 'San Pellegrino Wasser mit Kohlensäure 0,5 l', 'Eau San Pellegrino gazeuse 0,5 l') },
  'Acqua Tavina Naturale 0,5 L.': { n: N('Acqua Tavina naturale 0,5 l', 'Tavina still water 0.5 l', 'Tavina stilles Wasser 0,5 l', 'Eau Tavina plate 0,5 l') },
  'Acqua Tavina Gassata 0,5 L.': { n: N('Acqua Tavina frizzante 0,5 l', 'Tavina sparkling water 0.5 l', 'Tavina Wasser mit Kohlensäure 0,5 l', 'Eau Tavina gazeuse 0,5 l') },
  'Bicchiere d’acqua': { n: N('Bicchiere d’acqua', 'Glass of water', 'Glas Wasser', 'Verre d’eau') },
  /* caffetteria e tisane */
  'Caffè Espresso': { n: N('Caffè espresso', 'Espresso', 'Espresso', 'Café expresso') },
  'Caffè Doppio': { n: N('Caffè doppio', 'Double espresso', 'Doppelter Espresso', 'Double expresso') },
  'CAFFE DOPPIO MACCHIATO': { n: N('Caffè doppio macchiato', 'Double espresso macchiato', 'Doppelter Espresso macchiato', 'Double expresso noisette') },
  'Caffè Macchiato': { n: N('Caffè macchiato', 'Espresso macchiato', 'Espresso macchiato', 'Café noisette') },
  'CAFFE RISTRETTO': { n: N('Caffè ristretto', 'Ristretto', 'Ristretto', 'Café serré') },
  'Caffè Lungo': { n: N('Caffè lungo', 'Long espresso', 'Verlängerter Espresso', 'Café allongé') },
  'Caffè Americano': { n: N('Caffè americano', 'Americano', 'Americano', 'Café américain') },
  'Caffè Decaffeinato': { n: N('Caffè decaffeinato', 'Decaf espresso', 'Entkoffeinierter Espresso', 'Café décaféiné') },
  'CAFFE’ DECA MACCHIATO': { n: N('Caffè decaffeinato macchiato', 'Decaf espresso macchiato', 'Entkoffeinierter Espresso macchiato', 'Café décaféiné noisette') },
  'Caffè Decaffeinato SHAKERATO': { n: N('Caffè decaffeinato shakerato', 'Shaken iced decaf', 'Entkoffeinierter Espresso, geschüttelt mit Eis', 'Café décaféiné frappé') },
  'Caffè Shakerato': { n: N('Caffè shakerato', 'Shaken iced espresso', 'Espresso, geschüttelt mit Eis', 'Café frappé') },
  'Caffè Corretto': { n: N('Caffè corretto', 'Espresso with a shot of liquor', 'Espresso mit Schuss', 'Café arrosé') },
  'Caffè D’orzo': { n: N('Caffè d’orzo', 'Barley coffee', 'Gerstenkaffee', 'Café d’orge') },
  'Caffè al Ginseng': { n: N('Caffè al ginseng', 'Ginseng coffee', 'Ginseng-Kaffee', 'Café au ginseng') },
  'CAFFE ORZO / GINSENG MACCHIATO': { n: N('Caffè d’orzo o ginseng macchiato', 'Barley or ginseng coffee macchiato', 'Gersten- oder Ginseng-Kaffee macchiato', 'Café d’orge ou ginseng noisette') },
  'Caffè Affogato': { n: N('Caffè affogato', 'Affogato (espresso over ice cream)', 'Affogato (Espresso auf Eis)', 'Café affogato (expresso sur glace)'), a: 'LA' },
  'Macchiatone': { n: N('Macchiatone', 'Macchiatone (small cappuccino)', 'Macchiatone (kleiner Cappuccino)', 'Macchiatone (petit cappuccino)'), a: 'LA' },
  'CAFFE MACCHIATONE DECA': { n: N('Macchiatone decaffeinato', 'Decaf macchiatone', 'Entkoffeinierter Macchiatone', 'Macchiatone décaféiné'), a: 'LA' },
  'Marocchino': { n: N('Marocchino', 'Marocchino (espresso, cocoa, milk foam)', 'Marocchino (Espresso, Kakao, Milchschaum)', 'Marocchino (expresso, cacao, mousse de lait)'), a: 'LA' },
  'Cappuccino': { n: N('Cappuccino', 'Cappuccino', 'Cappuccino', 'Cappuccino'), a: 'LA' },
  'CAPPUCCINO DECA': { n: N('Cappuccino decaffeinato', 'Decaf cappuccino', 'Entkoffeinierter Cappuccino', 'Cappuccino décaféiné'), a: 'LA' },
  'Cappuccino - Orzo': { n: N('Cappuccino d’orzo', 'Barley cappuccino', 'Gersten-Cappuccino', 'Cappuccino d’orge'), a: 'LA' },
  'Cappuccino - Ginseng': { n: N('Cappuccino al ginseng', 'Ginseng cappuccino', 'Ginseng-Cappuccino', 'Cappuccino au ginseng'), a: 'LA' },
  'Latte Macchiato': { n: N('Latte macchiato', 'Latte macchiato', 'Latte macchiato', 'Latte macchiato'), a: 'LA' },
  'Latte Caldo': { n: N('Latte caldo', 'Hot milk', 'Heiße Milch', 'Lait chaud'), a: 'LA' },
  'Cioccolata Calda': { n: N('Cioccolata calda', 'Hot chocolate', 'Heiße Schokolade', 'Chocolat chaud'), a: 'LA' },
  'Cioccolata Calda Con Panna': { n: N('Cioccolata calda con panna', 'Hot chocolate with whipped cream', 'Heiße Schokolade mit Sahne', 'Chocolat chaud avec chantilly'), a: 'LA' },
  'Eis Coffee': { n: N('Caffè freddo con gelato', 'Iced coffee with ice cream', 'Eiskaffee', 'Café glacé avec glace'), a: 'LA' },
  'Eis Schokolade': { n: N('Cioccolata fredda con gelato', 'Iced chocolate with ice cream', 'Eisschokolade', 'Chocolat glacé avec glace'), a: 'LA' },
  'Punch (Arancio, Rum)': { n: N('Punch all’arancia e rum', 'Orange and rum punch', 'Punsch mit Orange und Rum', 'Punch orange et rhum') },
  'The Caldo - Nero': { n: N('Tè caldo nero', 'Hot black tea', 'Schwarzer Tee', 'Thé noir chaud') },
  'The Caldo - Verde': { n: N('Tè caldo verde', 'Hot green tea', 'Grüner Tee', 'Thé vert chaud') },
  'The Caldo - Deteinato': { n: N('Tè caldo deteinato', 'Decaf tea', 'Entkoffeinierter Tee', 'Thé déthéiné') },
  'The Caldo - Camomilla': { n: N('Camomilla', 'Chamomile tea', 'Kamillentee', 'Camomille') },
  'The Caldo - Frutti Rossi': { n: N('Infuso ai frutti rossi', 'Red fruit infusion', 'Früchtetee (rote Früchte)', 'Infusion aux fruits rouges') },
  'The Caldo - Melissa': { n: N('Infuso alla melissa', 'Lemon balm infusion', 'Melissentee', 'Infusion à la mélisse') },
  'The Caldo - Menta': { n: N('Infuso alla menta', 'Mint infusion', 'Pfefferminztee', 'Infusion à la menthe') },
  'The Caldo - Verbena': { n: N('Infuso alla verbena', 'Verbena infusion', 'Verbenentee', 'Infusion à la verveine') },
  'Tisane - Rilassante': { n: N('Tisana rilassante', 'Relaxing herbal tea', 'Entspannungstee', 'Tisane relaxante') },
  /* bevande generiche e birre alla spina */
  'Spremute': { n: N('Spremuta di agrumi', 'Freshly squeezed citrus juice', 'Frisch gepresster Zitrussaft', 'Jus d’agrumes pressé') },
  'Succhi Di Frutta': { n: N('Succo di frutta', 'Fruit juice', 'Fruchtsaft', 'Jus de fruits') },
  'The Freddo - Limone': { n: N('Tè freddo al limone', 'Iced tea, lemon', 'Eistee Zitrone', 'Thé glacé citron') },
  'The Freddo - Pesca': { n: N('Tè freddo alla pesca', 'Iced tea, peach', 'Eistee Pfirsich', 'Thé glacé pêche') },
  'Aranciata San Pellegrino Amara': { n: N('Aranciata amara San Pellegrino', 'San Pellegrino bitter orange', 'San Pellegrino Aranciata Amara (bitter)', 'Orangeade amère San Pellegrino') },
  'Aranciata San Pellegrino Dolce': { n: N('Aranciata San Pellegrino', 'San Pellegrino orangeade', 'San Pellegrino Aranciata (Orangenlimonade)', 'Orangeade San Pellegrino') },
  'Birra FORST a la Spina 0,20 L.': { n: N('Birra Forst alla spina 0,2 l', 'Forst draught beer 0.2 l', 'Forst vom Fass 0,2 l', 'Bière Forst pression 0,2 l'), a: 'GL' },
  'Birra FORST a la Spina 0,40 L.': { n: N('Birra Forst alla spina 0,4 l', 'Forst draught beer 0.4 l', 'Forst vom Fass 0,4 l', 'Bière Forst pression 0,4 l'), a: 'GL' },
  'Birra Analcolica FORST Bott. 0.33 L.': { n: N('Birra analcolica Forst 0,33 l', 'Forst alcohol-free beer 0.33 l', 'Forst alkoholfrei 0,33 l', 'Bière sans alcool Forst 0,33 l'), a: 'GL' },
  'Birra Corona Bott. 0,33 L.': { n: N('Birra Corona 0,33 l', 'Corona 0.33 l', 'Corona 0,33 l', 'Corona 0,33 l'), a: 'GL' },
  'BIRRA ROSSA SIXTUS': { n: N('Birra rossa Sixtus', 'Sixtus red beer', 'Sixtus Rotbier', 'Bière rousse Sixtus'), a: 'GL' },
  'RADLER 0,33L BOTTIGLIA': { n: N('Radler 0,33 l', 'Radler (shandy) 0.33 l', 'Radler 0,33 l', 'Panaché 0,33 l'), a: 'GL' },
  'Weizen 0,50l': { n: N('Birra Weizen 0,5 l', 'Wheat beer 0.5 l', 'Weizenbier 0,5 l', 'Bière blanche 0,5 l'), a: 'GL' },
  'SPRITZ ANALCOLICO': { n: N('Spritz analcolico', 'Alcohol-free spritz', 'Alkoholfreier Spritz', 'Spritz sans alcool') },
  'Vino Del Giorno - Bianco': { n: N('Vino del giorno bianco', 'White wine of the day', 'Weißwein des Tages', 'Vin blanc du jour'), a: 'AS' },
  'Vino Del Giorno - Rosso': { n: N('Vino del giorno rosso', 'Red wine of the day', 'Rotwein des Tages', 'Vin rouge du jour'), a: 'AS' },
  'Calice di vino dei Colli': { n: N('Calice di vino dei Colli Euganei', 'Glass of Colli Euganei wine', 'Glas Wein aus den Colli Euganei', 'Verre de vin des Colli Euganei'), a: 'AS' },
  'Bicch. Prosecco': { n: N('Bicchiere di prosecco', 'Glass of prosecco', 'Glas Prosecco', 'Verre de prosecco'), a: 'AS' },
};

/* le categorie come le legge l'ospite */
const CATEGORIE = {
  'Acqua': N('Acqua', 'Water', 'Wasser', 'Eau'),
  'Amari': N('Amari', 'Bitters & digestifs', 'Amari & Digestifs', 'Amers & digestifs'),
  'Aperitivi': N('Aperitivi', 'Aperitifs', 'Aperitifs', 'Apéritifs'),
  'Bevande e Bibite': N('Bibite', 'Soft drinks', 'Erfrischungsgetränke', 'Boissons'),
  'Birre': N('Birre', 'Beers', 'Biere', 'Bières'),
  'Bollicine - champagnes': N('Bollicine e champagne', 'Sparkling wines & champagne', 'Schaumweine & Champagner', 'Bulles & champagne'),
  'Brandy e Cognac': N('Brandy e cognac', 'Brandy & cognac', 'Brandy & Cognac', 'Brandy & cognac'),
  'Caffetteria e tisane': N('Caffetteria e tisane', 'Coffee & tea', 'Kaffee & Tee', 'Cafés & tisanes'),
  'Cocktail': N('Cocktail', 'Cocktails', 'Cocktails', 'Cocktails'),
  'Contorni': N('Contorni', 'Side dishes', 'Beilagen', 'Accompagnements'),
  'Da Condividere': N('Specialità da condividere', 'Specialities to share', 'Spezialitäten zum Teilen', 'Spécialités à partager'),
  'DEALCOLIZZATO': N('Dealcolizzati', 'Alcohol-free wines', 'Alkoholfreie Weine', 'Vins sans alcool'),
  'Dessert': N('Dessert', 'Desserts', 'Desserts', 'Desserts'),
  'Grappe': N('Grappe', 'Grappa', 'Grappa', 'Grappa'),
  'Hamburger': N('Hamburger', 'Burgers', 'Burger', 'Burgers'),
  'Insalate': N('Le nostre insalatone', 'Our big salads', 'Große Salatteller', 'Nos grandes salades'),
  'Liquori e Distillati': N('Liquori e distillati', 'Liqueurs & spirits', 'Liköre & Spirituosen', 'Liqueurs & spiritueux'),
  'Long Drinks Alcolici': N('Long drink', 'Long drinks', 'Longdrinks', 'Long drinks'),
  'Long Drinks Analcolici': N('Long drink analcolici', 'Alcohol-free long drinks', 'Alkoholfreie Longdrinks', 'Long drinks sans alcool'),
  'Piatti Caldi': N('Piatti caldi', 'Hot dishes', 'Warme Gerichte', 'Plats chauds'),
  'Piatti Freddi': N('Piatti freddi', 'Cold dishes', 'Kalte Gerichte', 'Plats froids'),
  'Rose': N('Vini rosati', 'Rosé wines', 'Roséweine', 'Vins rosés'),
  'Rum': N('Rum', 'Rum', 'Rum', 'Rhum'),
  'Vetrinetta': N('Dalla vetrinetta', 'From the counter', 'Aus der Vitrine', 'De la vitrine'),
  'Vini ristorante': N('Carta dei vini', 'Wine list', 'Weinkarte', 'Carte des vins'),
  'Vini al calice': N('Vini al calice', 'Wines by the glass', 'Wein im Glas', 'Vins au verre'),
  'Vini Dessert': N('Vini da dessert', 'Dessert wines', 'Dessertweine', 'Vins de dessert'),
  'Vino Bianco': N('Vini bianchi', 'White wines', 'Weißweine', 'Vins blancs'),
  'Vino Bianco Colli': N('Bianchi dei Colli Euganei', 'Colli Euganei whites', 'Weißweine Colli Euganei', 'Blancs des Colli Euganei'),
  'Vino Rosso': N('Vini rossi', 'Red wines', 'Rotweine', 'Vins rouges'),
  'Vino Rosso Colli': N('Rossi dei Colli Euganei', 'Colli Euganei reds', 'Rotweine Colli Euganei', 'Rouges des Colli Euganei'),
  'Whiskey': N('Whisky', 'Whisky', 'Whisky', 'Whisky'),
};
/* cassetti tecnici: l'ospite non li vede */
const NASCOSTE = ['Varie', 'Menu', 'Del Giorno', 'Da sistemare'];

(async () => {
  const cat = await sql('select id, nome, nomi, per_ospiti from pos_categoria');
  const art = await sql('select id, nome, nomi, descrizioni, allergeni from pos_articolo where attivo');
  const comandi = [];
  const dire = (cosa, q) => comandi.push([cosa, q]);
  const mancanti = [];
  for (const [nomePos, v] of Object.entries(ARTICOLI)) {
    const a = art.find((x) => chiave(x.nome) === chiave(nomePos));
    if (!a) { mancanti.push(nomePos); continue; }
    const set = [];
    if (v.n && (FORZA || !a.nomi)) set.push(`nomi = ${J(v.n)}`);
    if (v.d && (FORZA || !a.descrizioni)) set.push(`descrizioni = ${J(v.d)}`);
    if (v.a !== undefined && (FORZA || a.allergeni === null)) set.push(`allergeni = ${S(v.a)}`);
    if (set.length) dire(`${a.nome} → ${v.n ? v.n.en : ''}${v.a ? ' [' + v.a + ']' : ''}`, `update pos_articolo set ${set.join(', ')}, aggiornato_il = now() where id = ${S(a.id)}`);
  }
  for (const [nomePos, n] of Object.entries(CATEGORIE)) {
    const c = cat.find((x) => x.nome === nomePos);
    if (!c) { mancanti.push('categoria ' + nomePos); continue; }
    if (FORZA || !c.nomi) dire(`categoria ${c.nome} → ${n.en}`, `update pos_categoria set nomi = ${J(n)}, aggiornato_il = now() where id = ${S(c.id)}`);
  }
  for (const nome of NASCOSTE) {
    const c = cat.find((x) => x.nome === nome);
    if (c && c.per_ospiti !== false) dire(`categoria ${nome}: nascosta agli ospiti`, `update pos_categoria set per_ospiti = false, aggiornato_il = now() where id = ${S(c.id)}`);
  }
  if (mancanti.length) { console.log('NEL DIZIONARIO MA NON NEL POS (li salto):'); for (const m of mancanti) console.log('  ' + m); }
  console.log(`${comandi.length} modifiche${PROVA ? ' (prova, non scrivo)' : ''}:`);
  for (const [cosa] of comandi) console.log('  ' + cosa);
  if (PROVA) return;
  for (const [, q] of comandi) await sql(q);
  const dopo = await sql("select count(*) filter (where nomi is not null) as tradotti, count(*) as tutti from pos_articolo where attivo");
  console.log(`DOPO: ${dopo[0].tradotti} articoli con i nomi tradotti su ${dopo[0].tutti} attivi`);
})().catch((e) => { console.error(String(e)); process.exit(1); });
