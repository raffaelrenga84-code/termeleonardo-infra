/* ============================================================
   menu-dalle-foto.js — le categorie che la proprieta' ha fotografato.

   La categoria di un articolo, in Fidra, non sta in nessuna lista che si
   possa chiedere: sta solo nella schermata del POS. Il 4 settembre 2026 la
   proprieta' ha aperto una categoria dopo l'altra e ne ha mandato la
   fotografia, «per farti vedere cosa c'e' dentro, che cosi' potevi
   aggiustare». Qui ci sono quelle categorie, lette dalle fotografie: nome
   e prezzo come li scrive Fidra.

   Le altre le raccogliera' l'estensione (fidra-pos-menu.js) al prossimo
   giro sul POS di Fidra: questa e' solo la parte gia' vista.

   Un articolo puo' stare in piu' categorie (lo stesso Serprino e' fra i
   vini bianchi, fra i Colli e fra i dessert): la chiave e' «categoria|nome»,
   non il nome da solo, se no la seconda cancellerebbe la prima.

   Uso: node strumenti/menu-dalle-foto.js
   Vuole il token in C:/Users/admin/token-supabase.txt (o SUPABASE_ACCESS_TOKEN).
   ============================================================ */
const fs = require('node:fs');

const PROGETTO = 'mvuiuwakuseockotlcnp';
const TOKEN = (process.env.SUPABASE_ACCESS_TOKEN || fs.readFileSync('C:/Users/admin/token-supabase.txt', 'utf8')).trim();

/* prezzi in centesimi, come sulle fotografie */
const MENU = {
  'Hamburger': [
    ['CLASSIC', 1300], ['ROYAL', 1400], ['VEGGIE DELIZIA', 1300],
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

/* la stessa IVA che hanno gia' le categorie sorelle: cibo 10, alcolici 22 */
const IVA = {
  'Hamburger': 10, 'Da Condividere': 10, 'Varie': 10,
  'Long Drinks Alcolici': 22, 'Long Drinks Analcolici': 10,
  'Vini Dessert': 22, 'Vino Bianco': 22, 'Vino Bianco Colli': 22, 'Vino Rosso': 22, 'Vino Rosso Colli': 22,
};

const apice = (s) => String(s).replace(/'/g, "''");

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
  const valori = [];
  for (const [categoria, articoli] of Object.entries(MENU)) {
    const id = idDi.get(categoria);
    if (!id) { console.log('categoria che non c’è:', categoria); continue; }
    for (const [nome, prezzo] of articoli) {
      /* «categoria|nome»: lo stesso vino sta in piu' categorie */
      valori.push(`('${apice(categoria + '|' + nome)}', '${apice(id)}', '${apice(nome)}', ${prezzo}, ${IVA[categoria] ?? 10}, '${apice(categoria + '|' + nome)}')`);
    }
  }
  await sql(`insert into pos_articolo (id, categoria, nome, prezzo_cent, iva, fidra_id)
    values ${valori.join(', ')}
    on conflict (id) do update set categoria = excluded.categoria, nome = excluded.nome,
      prezzo_cent = excluded.prezzo_cent, iva = excluded.iva, aggiornato_il = now()`);
  const conto = await sql(`select c.nome as categoria, count(a.id) as quanti
    from pos_categoria c left join pos_articolo a on a.categoria = c.id
    group by c.nome order by c.nome`);
  console.log(`Messi ${valori.length} articoli in ${Object.keys(MENU).length} categorie.\n`);
  const vuote = conto.filter((c) => Number(c.quanti) === 0).map((c) => c.categoria);
  console.log('Ancora vuote (' + vuote.length + '):', vuote.join(', ') || 'nessuna');
})().catch((e) => { console.error('Errore:', e.message); process.exit(1); });
