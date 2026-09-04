/* ============================================================
   menu-dalle-foto.js — le categorie che la proprieta' ha fotografato.

   La categoria di un articolo, in Fidra, non sta in nessuna lista che si
   possa chiedere: sta solo nella schermata del POS. Il 4 settembre 2026 la
   proprieta' l'ha aperta categoria per categoria e ne ha mandato la
   fotografia, «per farti vedere cosa c'e' dentro, che cosi' potevi
   aggiustare». Qui ci sono quelle categorie, lette dalle fotografie: nome
   e prezzo come li scrive Fidra.

   SOSTITUISCE, non aggiunge: di una categoria fotografata si vede tutto,
   quindi quello che avevamo dentro e che nella fotografia non c'e' era
   sbagliato e se ne va. Un articolo gia' ordinato non si tocca mai: se
   qualcuno l'ha messo su un conto, lo script si ferma e lo dice.

   Un articolo puo' stare in piu' categorie (lo stesso Serprino e' fra i
   vini bianchi, fra i Colli e fra i dessert): la chiave e' «categoria|nome»,
   non il nome da solo, se no la seconda cancellerebbe la prima.

   Le categorie non ancora fotografate restano come sono, e le raccogliera'
   l'estensione (fidra-pos-menu.js) al prossimo giro sul POS di Fidra.

   Uso: node strumenti/menu-dalle-foto.js
   Vuole il token in C:/Users/admin/token-supabase.txt (o SUPABASE_ACCESS_TOKEN).
   ============================================================ */
const fs = require('node:fs');

const PROGETTO = 'mvuiuwakuseockotlcnp';
const TOKEN = (process.env.SUPABASE_ACCESS_TOKEN || fs.readFileSync('C:/Users/admin/token-supabase.txt', 'utf8')).trim();

/* prezzi in centesimi, come sulle fotografie */
const MENU = {
  'Amari': [
    ['Amaro del Capo', 500], ['Averna', 500], ['Branca Menta', 500], ['Braulio', 500],
    ['Fernet Branca', 500], ['JEFFERSON AMARO', 600], ['Jagermeister', 500], ['Lucano', 500],
    ['Montenegro', 500], ['Ramazzotti', 500], ['Unicum', 500],
  ],
  'Aperitivi': [
    ['CAMPARI SODA', 450], ['CRODINO E PROSECCO', 550], ['Campari', 500], ['Crodino', 350],
    ['Hugo', 600], ['Martini Bianco', 500], ['Martini Dry', 500], ['Martini Rosso', 500],
    ['SELECT BITTER', 600], ['SPRITZ AL LIMONCELLO', 600], ['SPRITZ ANALCOLICO', 500],
    ['SPRITZ BIANCO', 600], ['SPRITZ ROSA', 600], ['San Bitter', 350],
    ['Spritz Aperol', 600], ['Spritz Campari', 600],
  ],
  'Bevande e Bibite': [
    ['ACQUA MINERALE GASSATA TAVINA 0,5', 300],
    /* nella fotografia il prezzo era coperto dal riquadro sotto: qui c'e'
       quello che avevamo gia' dal listino di Fidra. */
    ['ACQUA MINERALE NATURALE TAVINA 0,5 L', 300],
    ['Acqua Minerale Gassata Latt. 0,50 L.', 220], ['Acqua Minerale Naturale Latt. 0,50 L.', 220],
    ['Acqua Minerale Panna 0,75 L.', 400], ['Acqua Minerale San Pellegrino 0,75 L.', 400],
    ['Aranciata San Pellegrino Amara', 400], ['Aranciata San Pellegrino Dolce', 400],
    ['Bicchiere D’acqua Minerale', 100], ['Chinotto San Pellegrino', 350],
    ['Coca Cola', 400], ['Coca Cola Zero', 400], ['FANTA 0,33 L', 400],
    ['FEVERTREE GINGER ALE', 600], ['FEVERTREE GINGER BEER', 600],
    ['Schweppes - Ginger Ale', 400], ['Schweppes - Lemon', 400], ['Schweppes - Tonica', 400],
    ['Spremute', 600], ['Succhi Di Frutta', 400],
    ['TONICA DANDY', 600], ['TONICA INDIAN OD MEDITERRAN', 600],
    ['The Freddo - Limone', 400], ['The Freddo - Pesca', 400],
  ],
  'Birre': [
    ['BIRRA ROSSA SIXTUS', 550], ['Birra Analcolica FORST Bott. 0.33 L.', 450],
    ['Birra Corona Bott. 0,33 L.', 500], ['Birra FORST a la Spina 0,20 L.', 350],
    ['Birra FORST a la Spina 0,40 L.', 550], ['RADLER 0,33L BOTTIGLIA', 500], ['Weizen 0,50l', 600],
  ],
  'Bollicine - champagnes': [
    ['Franciacorta Uberti Brut', 6800], ['MOET & CHANDON BRUT RISERVA IMPERIAL 0,75L', 9000],
    ['VEUVE CLICQUOT BRUT 0,75L', 9800],
  ],
  'Brandy e Cognac': [
    /* il prezzo era coperto nella fotografia: questo e' quello che
       avevamo gia' dal listino di Fidra */
    ['ARMANGNAC DARTIGALONGUE HORSE D’AGE 4 CL', 700],
    ['Armagnac V.S.O.P.', 700], ['Calvados V.S.', 500], ['Cardenal Mendoza', 700],
    ['Carlos I', 700], ['Martell', 900], ['Remy Martin', 900], ['Stravecchio Branca', 500],
  ],
  'Caffetteria e tisane': [
    ['CAFFE DOPPIO MACCHIATO', 350], ['CAFFE MACCHIATONE DECA', 270],
    ['CAFFE ORZO / GINSENG MACCHIATO', 280], ['CAFFE RISTRETTO', 180], ['CAFFE’ DECA MACCHIATO', 220],
    ['CAPPUCCINO DECA', 280], ['Caffè Affogato', 400], ['Caffè Americano', 200],
    ['Caffè Corretto', 250], ['Caffè D’orzo', 250], ['Caffè Decaffeinato', 200],
    ['Caffè Decaffeinato SHAKERATO', 550], ['Caffè Doppio', 320], ['Caffè Espresso', 180],
    ['Caffè Lungo', 180], ['Caffè Macchiato', 200], ['Caffè Shakerato', 500],
    ['Caffè al Ginseng', 250], ['Cappuccino', 250], ['Cappuccino - Ginseng', 300],
    ['Cappuccino - Orzo', 300], ['Cioccolata Calda', 400], ['Cioccolata Calda Con Panna', 500],
    ['Eis Coffee', 800], ['Eis Schokolade', 800], ['Latte Caldo', 200], ['Latte Macchiato', 400],
    ['Macchiatone', 250], ['Marocchino', 250], ['Punch (Arancio, Rum)', 400],
    ['The Caldo - Camomilla', 400], ['The Caldo - Deteinato', 400], ['The Caldo - Frutti Rossi', 400],
    ['The Caldo - Melissa', 400], ['The Caldo - Menta', 400], ['The Caldo - Nero', 400],
    ['The Caldo - Verbena', 400], ['The Caldo - Verde', 400], ['Tisane - Rilassante', 500],
  ],
  'Cocktail': [
    ['AMARO SOUR', 750], ['Americano', 700], ['Aperol', 500], ['Bloody Mary', 850],
    ['COCKTAIL DEL GIORNO', 850], ['COSMOPOLITAN', 900], ['Caipirinha', 900], ['Caipiroska', 900],
    ['Daiquiri', 850], ['LONDON MULE', 900], ['LONG ISLAND ICED TEA', 850], ['MOSCOWMULE', 900],
    ['Manhattan', 850], ['Margarita', 850], ['Martini Cocktail', 850], ['Mojito', 900],
    ['Negroni', 900], ['Papaya', 700], ['Pelmopink', 700], ['Punt & Mes', 500],
    ['Sole', 700], ['Tropical', 700], ['Whisky Sour', 850], ['White Lady', 850],
  ],
  'Contorni': [
    ['FIORI DI ZUCCA IN TEMPURA', 600], ['Insalata mista verde', 600],
    ['Patate fritte', 500], ['Verdure alla griglia', 500],
  ],
  'DEALCOLIZZATO': [
    ['VINUCI - DECISO RIESLING FERMO DEALCOLIZZATO 0,75L', 3500],
  ],
  'Del Giorno': [
    ['DOLCE DEL GIORNO', 600], ['MENU DEL GIORNO', 2500], ['PRIMI DEL GIORNO € 12', 1200],
    ['Primi Del Giorno', 1400], ['SECONDO DEL GIORNO € 15', 1500], ['Secondo Del Giorno', 2000],
    ['Vino Del Giorno - Bianco', 500], ['Vino Del Giorno - Rosso', 550], ['Vino Del Giorno - Rosè', 500],
  ],
  'Dessert': [
    ['CACO', 300], ['DOLCE DEL GIORNO', 600], ['MACEDONIA', 600], ['Pallina Gelato', 200],
    ['Panna Montata', 100], ['Sorbetto', 600], ['TIRAMISU’ DELLA CASA', 600],
    ['TORTINO CALDO AL CIOCCOLATO', 600], ['TRIS DI GELATI ARTIGIANALI', 600],
  ],
  'Grappe': [
    ['Bonollo Bianca', 500], ['Bonollo Euganea', 500], ['Bonollo Of Barrique di Amarone', 800],
    ['Da Ponte Barrique di Prosecco', 600], ['GRAPPA NARDINI BIANCA 4CL', 500],
    ['GRAPPA NONNINO FRIULANA 4CL', 500], ['Maschio 903 Barrique', 600], ['Nardini Riserva', 600],
    ['Prime uve - Bianca', 600], ['Prime uve - Nera', 600], ['Storica Nera', 800],
    ['Tosolini Chardonnay', 600], ['Tosolini Moscato', 600], ['Tosolini Most Bianca', 600],
  ],
  'Hamburger': [
    ['CLASSIC', 1300], ['ROYAL', 1400], ['VEGGIE DELIZIA', 1300],
  ],
  'Insalate': [
    ['CESARE', 1300], ['GINEVRA', 1200],
    ['INSALATA DI FARRO CON VERDURE E GAMBERI', 1200], ['LEONARDO', 1200],
  ],
  'Liquori e Distillati': [
    ['Alpestre', 500], ['Amaretto Di Saronno', 500], ['Anima Nera', 500], ['Armagnac', 700],
    ['BENEDECTINE', 600], ['Bacardi Bianco', 500], ['Baileys', 500], ['COINTREAU', 600],
    ['China Martini', 500], ['DRAMBUIE', 600], ['GIN MARE', 700], ['GRAN MARNIER', 600],
    ['Gran Duca D’alba', 700], ['Limoncello', 500], ['Sambuca', 500], ['Tequila', 400],
    ['Tia Maria', 500], ['Vecchia Romagna', 500], ['Vodka', 500], ['William’s', 500],
  ],
  'Piatti Caldi': [
    ['CANNELLONI CON RICOTTO E SPINACE', 1300], ['COTOLETTA DI POLLO MILANESE', 1400],
    ['Penne rigate alle verdure Glutenfree', 1200], ['Petto di Pollo Grigliato al Rosmarino', 1500],
    ['ZUPPA DI CEREALI', 800],
  ],
  'Piatti Freddi': [
    /* il prezzo era coperto dal riquadro sotto: entra a prezzo libero, lo
       si batte al momento finche' la proprieta' non lo dice */
    ['Mozzarella di Bufala & Pomodoro Rosso Origano e Basilico', 1200],
    ['Prosciutto Crudo Burrata e Valeriana', 1300], ['RISO VENERE', 1100],
  ],
  'Rose': [
    ['Vino ROSE PETALO DI ROSA Frizzante Borin', 2800],
  ],
  'Rum': [
    ['Bacardi Bianco', 500], ['Havana 7', 600], ['Pampero Anniversario', 600],
    ['RUM DIPLOMATICO', 800], ['Zacapa 23', 1200],
  ],
  'Vetrinetta': [
    ['ANGURIA O MELONE A FETTE', 600], ['BISCOTTINO', 50], ['BISCOTTO', 200],
    ['Brioche Albicocche', 200], ['Brioche Cioccolata', 200], ['Brioche Frutti di bosco', 200],
    ['Danesina', 200], ['FOCACCIA MARGHERITA', 400], ['Frittelle', 250],
    ['Girelle uvetta', 200], ['PIZZETTE', 400], ['SCHIACCIATA ROMANA', 600],
  ],
  'Vini': [
    ['CALICE Kerner Palladium Martini&Son', 550], ['CALICE Sauvignon Blanc BORIN', 500],
    ['CALICE Vegro Sengiari Cabernet e Merlot', 550], ['Kerner Palladium Martini&Son', 3100],
    ['Moscato Fior d’Arancio Colli Euganei', 1900], ['Prosecco Valdobbiadene DOC BORTOLOMIOL', 3000],
    ['Sauvignon Blanc Borin', 2800], ['Serprino frizzante Borin', 1950],
    ['Serprino vino frizzante dei Colli Euganei', 1950], ['Spumanti - Piccolo 7,00', 700],
    ['VINUCI - DECISO RIESLING FERMO DEALCOLIZZATO 0,75L', 3500],
    ['Vegro Rosè Sengiari', 2800], ['Vegro Sengiari Cabernet e Merlot', 3400],
    ['Vigna Costa Borin Cabernet Sauvignon', 3000], ['Vino Del Giorno - Bianco', 500],
    ['Vino Del Giorno - Rosso', 550], ['Vino ROSE PETALO DI ROSA Frizzante Borin', 2800],
  ],
  'Vini al calice': [
    ['Bicch. Prosecco', 550], ['CALICE ROSE FRIZZANTE PETALO DI ROSA 0,125', 500],
    ['CALICE VINUCI - DECISO RIESLING FERMO DEALCOLIZZATO', 600],
    ['CALICE Kerner Palladium Martini&Son', 550], ['CALICE Sauvignon Blanc BORIN', 500],
    ['CALICE Soave DOC La Campagnola', 500], ['CALICE Vegro Rosè Sengiari', 500],
    ['CALICE Vegro Sengiari Cabernet e Merlot', 550],
    ['CALICE Vigna Costa Borin Cabernet Sauvignon', 500],
    ['Vino Del Giorno - Bianco', 500], ['Vino Del Giorno - Rosso', 550],
  ],
  'Whiskey': [
    ['WHISKY 12 ANNI', 800], ['WHISKY 14 ANNI', 1200], ['WHISKY 16 ANNI', 1400],
    ['Whisky - OBAN', 1200],
    /* «WHISKY - SCOTCH, BOURBON, CANAD, IRISH»: il prezzo era coperto e
       non ce l'avevamo da nessuna parte. A prezzo libero finche' non si sa. */
    ['WHISKY - SCOTCH, BOURBON, CANAD, IRISH', 0, true],
  ],
  'Da Condividere': [
    ['BRUSCHETTA ALL’ITALIANA', 850], ['GUACAMOLE TOAST', 1300], ['La Pinsa Margherita', 900],
    ['La Pinsa PARMENSE', 1050], ['La Pinsa VEGETARIANA', 1000],
    ['PANE PUCCIA CON CRUDO E MOZZARELLA', 1300], ['PIADINA MEDITERRANEA', 850],
    ['PIADINA ROMAGNOLA', 950], ['SALMONE AFFUMICATO TOAST', 1300],
    ['Tostone Classico', 700], ['Tostone Farcito', 850],
  ],
  'Long Drinks Alcolici': [
    ['Bellini', 800], ['Campari Orange', 850], ['Cuba Libre', 850],
    ['GIN LEMON MARE', 1200], ['GIN TONIC HENDRIX', 1200], ['GIN TONIC MARE', 1200], ['GIN TONIC ROKU', 1200],
    ['Gin Fizz', 900], ['Gin Lemon - Tanqueray', 850], ['Gin Lemon - Tanqueray 10', 1000], ['Gin Orange', 900],
    ['Gin Tonic - Bombay', 1000], ['Gin Tonic - Gordon', 850], ['Gin Tonic - Tanqueray 10', 1000],
    ['Mimosa', 800], ['Pina Colada', 800], ['Tequila Sunrise', 800], ['VODCA TONIC', 800], ['Vodka Orange', 900],
  ],
  'Long Drinks Analcolici': [
    ['CINDERELLA', 750], ['Papaya', 700], ['Pelmopink', 700], ['SHIRLEY TEMPL', 750],
    ['Sole', 700], ['Tropical', 700], ['VIRGIN BELLINI', 750],
  ],
  'Varie': [
    ['Room Service', 200], ['VARIE BEVANDE', 1000], ['varie', 500],
  ],
  'Vini Dessert': [
    ['MOET & CHANDON BRUT RISERVA IMPERIAL 0,75L', 9000], ['Moscato Fior d’Arancio Colli Euganei', 1900],
    ['Prosecco Valdobbiadene DOC BORTOLOMIOL', 3000], ['Serprino vino frizzante dei Colli Euganei', 1950],
    ['VEUVE CLICQUOT BRUT 0,75L', 9800],
  ],
  'Vino Bianco': [
    ['CALICE Kerner Palladium Martini&Son', 550], ['CALICE Soave DOC La Campagnola', 500],
    ['Kerner Palladium Martini&Son', 3100], ['Serprino vino frizzante dei Colli Euganei', 1950],
  ],
  'Vino Bianco Colli': [
    ['Moscato Fior d’Arancio Colli Euganei', 1900], ['Serprino vino frizzante dei Colli Euganei', 1950],
  ],
  'Vino Rosso': [
    ['CALICE Vegro Rosè Sengiari', 500], ['CALICE Vigna Costa Borin Cabernet Sauvignon', 500],
    ['Vegro Rosè Sengiari', 2800], ['Vegro Sengiari Cabernet e Merlot', 3400],
    ['Vigna Costa Borin Cabernet Sauvignon', 3000], ['Vino Del Giorno - Rosso', 550],
  ],
  'Vino Rosso Colli': [
    ['CALICE Vegro Rosè Sengiari', 500], ['CALICE Vegro Sengiari Cabernet e Merlot', 550],
    ['CALICE Vigna Costa Borin Cabernet Sauvignon', 500], ['Vegro Rosè Sengiari', 2800],
    ['Vegro Sengiari Cabernet e Merlot', 3400], ['Vigna Costa Borin Cabernet Sauvignon', 3000],
  ],
};

/* la stessa IVA delle categorie sorelle: cibo e bevande analcoliche 10,
   alcolici 22. Si cambia articolo per articolo dal back office. */
const IVA = {
  'Amari': 22, 'Aperitivi': 22, 'Bevande e Bibite': 10, 'Birre': 22,
  'Bollicine - champagnes': 22, 'Brandy e Cognac': 22, 'Caffetteria e tisane': 10,
  'Cocktail': 22, 'Contorni': 10, 'DEALCOLIZZATO': 10, 'Del Giorno': 10, 'Dessert': 10,
  'Grappe': 22, 'Hamburger': 10, 'Da Condividere': 10, 'Insalate': 10,
  'Liquori e Distillati': 22, 'Piatti Caldi': 10, 'Piatti Freddi': 10, 'Rose': 22,
  'Rum': 22, 'Vetrinetta': 10, 'Vini': 22, 'Vini al calice': 22, 'Whiskey': 22,
  'Long Drinks Alcolici': 22, 'Long Drinks Analcolici': 10, 'Varie': 10,
  'Vini Dessert': 22, 'Vino Bianco': 22, 'Vino Bianco Colli': 22, 'Vino Rosso': 22, 'Vino Rosso Colli': 22,
};

const apice = (s) => String(s).replace(/'/g, "''");
const elenco = (a) => a.map((x) => `'${apice(x)}'`).join(', ');

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROGETTO}/database/query`, {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const j = await r.json();
  if (!r.ok || (j && j.message)) throw new Error(JSON.stringify(j).slice(0, 400));
  return j;
}

(async () => {
  const categorie = await sql('select id, nome from pos_categoria');
  const idDi = new Map(categorie.map((c) => [c.nome, c.id]));
  const idCategorie = [];
  const valori = [];
  for (const [categoria, articoli] of Object.entries(MENU)) {
    const id = idDi.get(categoria);
    if (!id) { console.log('categoria che non c’è in banca dati:', categoria); continue; }
    idCategorie.push(id);
    for (const [nome, prezzo, libero] of articoli) {
      /* «categoria|nome»: lo stesso vino sta in piu' categorie */
      const chiave = categoria + '|' + nome;
      valori.push(`('${apice(chiave)}', '${apice(id)}', '${apice(nome)}', ${prezzo}, ${IVA[categoria] ?? 10}, ${libero ? 'true' : 'false'}, '${apice(chiave)}')`);
    }
  }

  /* niente si tocca se qualcuno l'ha gia' messo su un conto */
  const usati = await sql(`select count(*) as n from pos_riga r join pos_articolo a on a.id = r.articolo
    where a.categoria in (${elenco(idCategorie)})`);
  if (Number(usati[0].n) > 0) {
    console.log('FERMO: in queste categorie ci sono articoli gia\u2019 ordinati (' + usati[0].n + ' righe). Non tocco niente.');
    return;
  }

  const tolti = await sql(`delete from pos_articolo where categoria in (${elenco(idCategorie)}) returning id`);
  await sql(`insert into pos_articolo (id, categoria, nome, prezzo_cent, iva, prezzo_libero, fidra_id)
    values ${valori.join(', ')}`);

  const conto = await sql(`select c.nome as categoria, count(a.id) as quanti
    from pos_categoria c left join pos_articolo a on a.categoria = c.id
    group by c.nome order by c.nome`);
  console.log(`Sostituite ${idCategorie.length} categorie: tolti ${tolti.length}, messi ${valori.length}.`);
  const vuote = conto.filter((c) => Number(c.quanti) === 0).map((c) => c.categoria);
  const daVedere = conto.filter((c) => !MENU[c.categoria]).map((c) => `${c.categoria} (${c.quanti})`);
  console.log('\nIn tutto:', conto.reduce((t, c) => t + Number(c.quanti), 0), 'articoli');
  console.log('\nAncora da fotografare (' + daVedere.length + '):', daVedere.join(', ') || 'nessuna');
  if (vuote.length) console.log('\nVuote:', vuote.join(', '));
})().catch((e) => { console.error('Errore:', e.message); process.exit(1); });
