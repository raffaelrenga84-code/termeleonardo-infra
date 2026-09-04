/* Porta nel nostro POS le categorie e gli articoli di Fidra, letti dai file
   che la reception ha salvato da /nova-api. Gli articoli vendibili stanno in
   "item-variations" (nome + prezzo di vendita); le categorie in "categories".
   Le quattro zone della sala (Interno, Hall, Esterno, Terrazza) stanno nella
   stessa tabella di Fidra ma da noi sono zone, non categorie del menù. */
const fs = require('fs');
const path = require('path');

const CARTELLA = 'C:/Users/admin/OneDrive/Documents/SITO INTERNET/POS';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PROGETTO = 'mvuiuwakuseockotlcnp';

const ZONE = ['Interno', 'Hall', 'Esterno', 'Terrazza'];

/* per ogni categoria: dove si stampa, che portata, che IVA, che colore */
const REGOLE = {
  'Bevande e Bibite': ['bar', 'bevande', 10, '#4A90A4'],
  'Birre': ['bar', 'bevande', 22, '#C9A227'],
  'Caffetteria e tisane': ['bar', 'bevande', 10, '#6F4E37'],
  'Cocktail': ['bar', 'bevande', 22, '#D2691E'],
  'Liquori e Distillati': ['bar', 'bevande', 22, '#8B5A2B'],
  'Varie': ['bar', 'bevande', 22, '#7B756A'],
  'Vini': ['bar', 'bevande', 22, '#7B1E3A'],
  'Vino Bianco Colli': ['bar', 'bevande', 22, '#C8B560'],
  'Vino Rosso Colli': ['bar', 'bevande', 22, '#6B1B2E'],
  'Vino Bianco': ['bar', 'bevande', 22, '#D6C67A'],
  'Vino Rosso': ['bar', 'bevande', 22, '#7B1E3A'],
  'Rose': ['bar', 'bevande', 22, '#E29AA6'],
  'Vini Dessert': ['bar', 'bevande', 22, '#B5651D'],
  'Vini al calice': ['bar', 'bevande', 22, '#9C2542'],
  'Bollicine - champagnes': ['bar', 'bevande', 22, '#C9A961'],
  'Rum': ['bar', 'bevande', 22, '#8A5A2B'],
  'Whiskey': ['bar', 'bevande', 22, '#A9601A'],
  'Grappe': ['bar', 'bevande', 22, '#9AA3A8'],
  'Brandy e Cognac': ['bar', 'bevande', 22, '#8C4A1E'],
  'Amari': ['bar', 'bevande', 22, '#4E5B31'],
  'Aperitivi': ['bar', 'bevande', 22, '#E2571E'],
  'Long Drinks Alcolici': ['bar', 'bevande', 22, '#C05621'],
  'Long Drinks Analcolici': ['bar', 'bevande', 10, '#3E8E7E'],
  'DEALCOLIZZATO': ['bar', 'bevande', 10, '#5B8C5A'],
  'Vetrinetta': ['bar', 'dolci', 10, '#D98BA0'],
  'Menu': ['cucina', 'secondi', 10, '#1A3626'],
  'Del Giorno': ['cucina', 'secondi', 10, '#2E7D5B'],
  'Piatti Caldi': ['cucina', 'secondi', 10, '#3C5346'],
  'Piatti Freddi': ['cucina', 'antipasti', 10, '#8FC4BC'],
  'Contorni': ['cucina', 'contorni'.replace('contorni', 'secondi'), 10, '#7FA05B'],
  'Insalate': ['cucina', 'secondi', 10, '#6FA85B'],
  'Hamburger': ['cucina', 'secondi', 10, '#A0522D'],
  'Dessert': ['cucina', 'dolci', 10, '#D98BA0'],
  'Da Condividere': ['cucina', 'antipasti', 10, '#B08D57'],
};

/* dal nome dell'articolo alla categoria: la prima regola che risponde vince */
const DAL_NOME = [
  [/DEALCOLIZZAT|ALCOHOL FREE|ALCOHL FREE|0\.0 /i, 'DEALCOLIZZATO'],
  [/CALICE/i, 'Vini al calice'],
  [/CHAMPAGNE|VEUVE|MOET|FRANCIACORTA/i, 'Bollicine - champagnes'],
  [/CAFF|CAPPUCCIN|LATTE MACCH|TISANA|CAMOMILLA|CIOCCOLATA CALDA|ORZO|GINSENG/i, 'Caffetteria e tisane'],
  [/SPRITZ|GIN TONIC|GIN LEMON|MULE|COSMOPOLITAN|LONG ISLAND|CINDERELLA|VIRGIN|SHIRLEY|COCKTAIL|CRODINO E PROSECCO|RUM COLA|VODCA TONIC|VODKA TONIC|NEGRONI|AMERICANO|MOJITO|MARGARITA|DAIQUIRI|BELLINI/i, 'Cocktail'],
  [/BIRRA|RADLER|WEIZEN|WEIHENSTEPHAN|LAGER|PILS/i, 'Birre'],
  [/GRAPPA/i, 'Grappe'],
  [/WHISK/i, 'Whiskey'],
  [/\bRUM\b|ZACAPA|DIPLOMATICO|MATUSALEM|PAMPERO|HAVANA|CACHACA/i, 'Rum'],
  [/BRANDY|COGNAC|ARMANGNAC|ARMAGNAC|REMY|MARTEL|STRAVECCHIO/i, 'Brandy e Cognac'],
  [/AMARO|JEFFERSON|ZUCCA|UNICUM|DEL CAPO|FERNET|MONTENEGRO|BRAULIO/i, 'Amari'],
  [/APERITIVO|CAMPARI|SELECT|BITTER|APEROL|CRODINO/i, 'Aperitivi'],
  [/\bGIN\b|VODKA|VODCA|TEQUILA|MEZCAL|SAMBUCA|LIMONCELLO|LIQUORE|DRAMBUIE|BENEDECTINE|MARNIER|COINTREAU|PUNCH|ALPESTRE|BATIDA|SHERRY|PORTO |VERMOUTH|PRIME UVE|PASTIS|RICARD|BAILEYS/i, 'Liquori e Distillati'],
  [/ROSE|ROSATO/i, 'Rose'],
  [/RIESLING|CARMENERE|ME-MO|TENORE|PROSECCO|VINO DEL GIORNO|MERLOT|CABERNET|CHARDONNAY|PINOT|SOAVE|AMARONE|VALPOLICELLA/i, 'Vini'],
  [/ACQUA|COCA|FANTA|SPRITE|TONICA|SUCCO|SUCCHI|GINGER|DANDY|FEVERTREE|SCHWEPPES|SODA|SPREMUTA|CHINOTTO|GINGERINO|THE FREDDO/i, 'Bevande e Bibite'],
  [/BISCOTT|PIZZETTE|FRITTELL|BRIOCHE|TRAMEZZIN/i, 'Vetrinetta'],
  [/TORTINO|TIRAMIS|GELATO|SORBETTO|PANNA COTTA|DOLCE|CACO|ANGURIA|MELONE A FETTE/i, 'Dessert'],
  [/DEL GIORNO/i, 'Del Giorno'],
  [/INSALATA|INSALATE/i, 'Insalate'],
  [/HAMBURGER|CHEESEBURGER/i, 'Hamburger'],
  [/TOAST|PIADINA|PUCCIA|CRUDO|SALMONE|CARPACCIO|TAGLIERE/i, 'Piatti Freddi'],
  [/ZUPPA|RISO|RISOTTO|CANNELLONI|PENNE|SPAGHETT|PASTA|GNOCCHI|LASAGN/i, 'Piatti Caldi'],
  [/VERDUR|CONTORNO|PATATE|FIORI DI ZUCCA|FRITTO/i, 'Contorni'],
  [/COTOLETTA|POLLO|MANZO|PESCE|TAGLIATA|CLASSIC/i, 'Piatti Caldi'],
];

/* la portata vera dell'articolo, quando il nome la dice */
const PORTATA_DAL_NOME = [
  [/ZUPPA|RISO|RISOTTO|CANNELLONI|PENNE|SPAGHETT|PASTA|GNOCCHI|LASAGN|MINESTRA|CONSOMM/i, 'primi'],
  [/TOAST|PIADINA|PUCCIA|CRUDO E MELONE|CARPACCIO|TAGLIERE|BRUSCHETT/i, 'antipasti'],
  [/TORTINO|TIRAMIS|GELATO|SORBETTO|PANNA COTTA|DOLCE|BISCOTT|FRITTELL|ANGURIA|MELONE A FETTE|CACO/i, 'dolci'],
];

/* questi non sono roba da bar o cucina: golf, spa, soggiorno, ricarica auto */
const FUORI = /Greenfee|SOGGIORNO|RICARICA|Prodotti Estetici/i;

const campo = (r, nome) => {
  const f = (r.fields || []).find((x) => x.attribute === nome);
  return f ? f.value : null;
};
const chiave = (s) => String(s).toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

function categoriaDi(nome, padre) {
  for (const [re, cat] of DAL_NOME) if (re.test(nome)) return cat;
  if (/menu/i.test(padre)) return 'Menu';
  if (/vino/i.test(padre)) return 'Vini';
  if (/bevande/i.test(padre)) return 'Bevande e Bibite';
  return 'Varie';
}
function portataDi(nome, portataCategoria) {
  for (const [re, p] of PORTATA_DAL_NOME) if (re.test(nome)) return p;
  return portataCategoria;
}

const q = (sql) => fetch(`https://api.supabase.com/v1/projects/${PROGETTO}/database/query`, {
  method: 'POST',
  headers: { authorization: 'Bearer ' + TOKEN, 'content-type': 'application/json' },
  body: JSON.stringify({ query: sql }),
}).then(async (r) => { const t = await r.text(); if (!r.ok) throw new Error(r.status + ' ' + t.slice(0, 300)); return t; });

const cita = (v) => v === null || v === undefined ? 'null' : "'" + String(v).replace(/'/g, "''") + "'";

async function main() {
  const fileCat = fs.readdirSync(CARTELLA).filter((f) => /^categories.*[.]json$/i.test(f)).sort().pop();
  if (!fileCat) throw new Error('nessun file categories*.json in ' + CARTELLA);
  const cats = JSON.parse(fs.readFileSync(path.join(CARTELLA, fileCat), 'utf8'));
  const pagine = fs.readdirSync(CARTELLA).filter((f) => /^item-variations.*[.]json$/i.test(f)).sort();
  if (!pagine.length) throw new Error('nessun file item-variations*.json in ' + CARTELLA);
  const vars = { resources: [] };
  const visti = new Set();
  for (const f of pagine) {
    const j = JSON.parse(fs.readFileSync(path.join(CARTELLA, f), 'utf8'));
    for (const r of (j.resources || [])) {
      const id = String((r.id && r.id.value) ?? '');
      if (id && visti.has(id)) continue;
      if (id) visti.add(id);
      vars.resources.push(r);
    }
    console.log('  ' + f + ': ' + (j.resources || []).length + ' righe' + (j.total ? ' (in tutto ne esistono ' + j.total + ')' : ''));
  }

  /* ---------- le categorie ---------- */
  const righeCat = [];
  const perNome = new Map();
  let pos = 0;
  for (const r of cats.resources) {
    const nome = String(campo(r, 'name') || '').trim();
    if (!nome || ZONE.includes(nome)) continue;
    const regola = REGOLE[nome] || ['bar', 'bevande', 22, null];
    const id = 'fidra-cat-' + chiave(nome);
    perNome.set(nome, { id, stampante: regola[0], portata: regola[1], iva: regola[2] });
    pos += 10;
    righeCat.push(`(${cita(id)}, ${cita(nome)}, ${pos}, ${cita(regola[3])}, ${cita(regola[0])}, ${cita(regola[1])}, null, '{}'::text[], ${cita(String(campo(r, 'id')))}, true, now())`);
  }
  await q(`insert into pos_categoria (id, nome, posizione, colore, stampante, portata, sotto, note_rapide, fidra_id, attiva, aggiornato_il) values
${righeCat.join(',\n')}
on conflict (id) do update set nome = excluded.nome, colore = excluded.colore, stampante = excluded.stampante, portata = excluded.portata, attiva = true, aggiornato_il = now();`);
  console.log('categorie: ' + righeCat.length);

  /* ---------- gli articoli vendibili ---------- */
  const righeArt = [];
  let fuori = 0, senzaPrezzo = 0;
  let n = 0;
  for (const r of vars.resources) {
    const nome = String(campo(r, 'name') || '').trim();
    const padre = String(campo(r, 'item') || '');
    if (!nome) continue;
    if (FUORI.test(padre) || FUORI.test(nome)) { fuori++; continue; }
    const prezzo = Number(campo(r, 'price') || 0);
    if (!prezzo) { senzaPrezzo++; continue; }
    const nomeCat = categoriaDi(nome, padre);
    const cat = perNome.get(nomeCat) || perNome.get('Varie');
    n += 10;
    righeArt.push(`(${cita('fidra-art-' + campo(r, 'id'))}, ${cita(cat.id)}, ${cita(nome)}, ${prezzo}, ${cat.iva}, ${cita(portataDi(nome, cat.portata))}, ${cita(cat.stampante)}, false, false, null, false, ${n}, ${cita(String(campo(r, 'id')))}, true, now())`);
  }
  for (let i = 0; i < righeArt.length; i += 200) {
    await q(`insert into pos_articolo (id, categoria, nome, prezzo_cent, iva, portata, stampante, prezzo_libero, incluso_trattamento, conto_ricavo, esaurito, posizione, fidra_id, attivo, aggiornato_il) values
${righeArt.slice(i, i + 200).join(',\n')}
on conflict (id) do update set categoria = excluded.categoria, nome = excluded.nome, prezzo_cent = excluded.prezzo_cent, iva = excluded.iva, portata = excluded.portata, stampante = excluded.stampante, attivo = true, aggiornato_il = now();`);
  }
  console.log('articoli: ' + righeArt.length + ' (fuori dal POS: ' + fuori + ', senza prezzo: ' + senzaPrezzo + ')');

  const conto = JSON.parse(await q("select (select count(*) from pos_categoria) as categorie, (select count(*) from pos_articolo) as articoli;"));
  console.log('nel POS adesso: ' + JSON.stringify(conto[0]));
  const perCat = JSON.parse(await q("select c.nome, count(a.id) as quanti from pos_categoria c left join pos_articolo a on a.categoria = c.id group by c.nome order by quanti desc limit 12;"));
  for (const r of perCat) console.log('  ' + r.nome + ': ' + r.quanti);
}

main().catch((e) => { console.error('ERRORE: ' + e.message); process.exit(1); });
