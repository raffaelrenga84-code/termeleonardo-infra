#!/usr/bin/env node
/* ============================================================
   pulisci-vini.js — i vini come sul listino stampato, una riga per vino.

   «Pulisci e sistema» (la proprieta', 5 settembre 2026), dopo il
   confronto col listino vini del ristorante. Tre cose, tutte per nome
   e categoria, niente indovinato:

     DOPPIONI  lo stesso vino stava in 2-6 categorie (le fotografie del
               POS di Fidra lo mostravano dappertutto): resta UNA riga —
               quella col nome di Fidra e il suo prezzo — le altre si
               SPENGONO, non si cancellano (potrebbero stare su un conto).
     CATEGORIE i bianchi e i rossi dei Colli Euganei vanno nelle
               categorie «Colli», come sul listino; i rosati in Rosé.
     ACCESI    ME-MO (rosato) e i calici da 0,375 erano spenti in «Da
               sistemare».

   Non tocca: i vini che stanno nel POS ma non sul listino (punto 2 del
   confronto: decide la proprieta'), i prezzi (mai), la cucina.

   Uso:  node strumenti/pulisci-vini.js [--prova]
   ============================================================ */
const fs = require('node:fs');

const PROVA = process.argv.includes('--prova');
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
const chiave = (s) => String(s).replace(/[’`´]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();

/* ---- cosa fare, riga per riga: [categoria, nome] → azione ---- */
const SPEGNI = [
  // Serprino: resta «Vino Bianco Serprino frizzante» (che va nei Colli)
  ['Vini', 'Serprino frizzante Borin'], ['Vini', 'Serprino vino frizzante dei Colli Euganei'],
  ['Vini Dessert', 'Serprino vino frizzante dei Colli Euganei'], ['Vino Bianco', 'Serprino vino frizzante dei Colli Euganei'],
  ['Vino Bianco Colli', 'Serprino vino frizzante dei Colli Euganei'],
  // Moscato: resta quello in Vini Dessert
  ['Vini', "Moscato Fior d'Arancio Colli Euganei"], ['Vino Bianco Colli', "Moscato Fior d'Arancio Colli Euganei"],
  // Kerner: resta «Vino Bianco Kerner Palladium Martini & Sohn»
  ['Vini', 'Kerner Palladium Martini&Son'], ['Vino Bianco', 'Kerner Palladium Martini&Son'],
  // Vegro rosso: resta «Vino Rosso "Vegro" Sengiari» (che va nei Colli)
  ['Vini', 'Vegro Sengiari Cabernet e Merlot'], ['Vino Rosso', 'Vegro Sengiari Cabernet e Merlot'], ['Vino Rosso Colli', 'Vegro Sengiari Cabernet e Merlot'],
  // Vegro rose': resta quello in Rose (rinominato)
  ['Vini', 'Vegro Rosè Sengiari'], ['Vino Rosso', 'Vegro Rosè Sengiari'], ['Vino Rosso Colli', 'Vegro Rosè Sengiari'],
  // Vigna Costa: resta «Vino Rosso "Vigna Costa" Cabernet Sauvignon Borin»
  ['Vini', 'Vigna Costa Borin Cabernet Sauvignon'], ['Vino Rosso', 'Vigna Costa Borin Cabernet Sauvignon'],
  // Franciacorta: sul listino sta fra i dessert
  ['Bollicine - champagnes', 'Franciacorta Uberti Brut'],
  // Moet e Veuve: bollicine, non dessert
  ['Vini Dessert', 'MOET & CHANDON BRUT RISERVA IMPERIAL 0,75L'], ['Vini Dessert', 'VEUVE CLICQUOT BRUT 0,75L'],
  // Petalo di Rosa: resta «Vino ROSE PETALO DI ROSA Frizzante Borin» in Rose
  ['Rose', 'ROSE PETALO DI ROSA Frizzante Borin'], ['Vini', 'Vino ROSE PETALO DI ROSA Frizzante Borin'],
  // Sauvignon Blanc Borin: resta il «Vino Bianco …»
  ['Vini', 'Sauvignon Blanc Borin'],
  // Prosecco Bortolomiol: resta in Vini Dessert
  ['Vini', 'Prosecco Valdobbiadene DOC BORTOLOMIOL'],
  // Soave: resta «Vino Bianco Soave La Campagnola» a 29,00 (l altra riga diceva 28,00)
  ['Vino Bianco', 'Soave DOC La Campagnola'],
  // calici: una riga sola, in «Vini al calice»
  ['Vino Rosso', 'CALICE Vegro Rosè Sengiari'], ['Vino Rosso Colli', 'CALICE Vegro Rosè Sengiari'],
  ['Vino Rosso Colli', 'CALICE Vegro Sengiari Cabernet e Merlot'], ['Vini', 'CALICE Vegro Sengiari Cabernet e Merlot'],
  ['Vino Rosso', 'CALICE Vigna Costa Borin Cabernet Sauvignon'], ['Vino Rosso Colli', 'CALICE Vigna Costa Borin Cabernet Sauvignon'],
  ['Vini', 'CALICE Kerner Palladium Martini&Son'], ['Vino Bianco', 'CALICE Kerner Palladium Martini&Son'],
  ['Vini', 'CALICE Sauvignon Blanc BORIN'], ['Vino Bianco', 'CALICE Soave DOC La Campagnola'],
  ['Vini al calice', 'CALICE VINUCI - DECISO RIESLING FERMO DEALCOLIZZATO'],
  ['Vini', 'Vino Del Giorno - Bianco'], ['Vini', 'Vino Del Giorno - Rosso'], ['Vino Rosso', 'Vino Del Giorno - Rosso'],
];

const SPOSTA = [
  // bianchi dei Colli Euganei (listino: VINI BIANCHI COLLI EUGANEI)
  ...['Vino Bianco Bianco Dei Mandorli - Borin', 'Vino Bianco Serprino frizzante', 'Vino Bianco Pinot Bianco - Borin',
    'Vino Bianco Olivetani Bianco', 'Vino Bianco Chardonnay Doc Borin', 'Vino Bianco Pinot Grigio - Borin',
    'Vino Bianco Sassara Chardonnay Sengiari', 'Vino Bianco Sauvignon Blanc Borin', 'Vino Bianco "UNICO" Fior d\'arancio secco Terre Gaie',
  ].map((n) => ['Vino Bianco', n, 'Vino Bianco Colli']),
  // rossi dei Colli Euganei (listino: VINI ROSSI COLLI EUGANEI)
  ...['TENORE CARMENERE IGT', 'Vino Rosso "Stema" Pinot Nero Terre Gaie', 'Vino Rosso Merlot Foscolo Borin',
    'Vino Rosso "Vigna Costa" Cabernet Sauvignon Borin', 'Vino Rosso "Sasso Nero" Merlot Riserva Zanovello',
    'Vino Rosso "Monsilicis" Cabernet Borin', 'Vino Rosso "Rocca Chiara"  Merlot Borin',
    'Vino Rosso "Vigna Cecilia" Cabernet Sauvignon Filò delle Vigne', 'Vino Rosso "Girapoggio" Cabernet Zanovello',
    'Vino Rosso "Vegro" Sengiari', 'Vino Rosso "Vittorio" IGT Merlot Terre Gaie',
  ].map((n) => ['Vino Rosso', n, 'Vino Rosso Colli']),
  // i calici da 0,375 della carta Dolce Vita
  ['Vino Bianco', 'Vino Cl. 0,375 Soave Classico', 'Vini al calice'],
  ['Da sistemare', 'Vino Cl. 0,375 Valpollicella Classico', 'Vini al calice'],
  // il rosato Me-Mo
  ['Da sistemare', 'ME-MO DOC   TERRE GAIE', 'Rose'],
];

const RINOMINA = [
  ['Rose', 'Vino Rosato Vero Rose Segnari', 'Vino Rosato Vegro Rosè Sengiari'],
  ['Da sistemare', 'ME-MO DOC   TERRE GAIE', 'Vino Rosato Me-Mo DOC Terre Gaie'],
  ['Vino Rosso', 'TENORE CARMENERE IGT', 'Vino Rosso "Tenore" Carmenère IGT Terre Gaie'],
];

const ACCENDI = [
  ['Da sistemare', 'Vino Cl. 0,375 Valpollicella Classico'],
  ['Da sistemare', 'ME-MO DOC   TERRE GAIE'],
];

(async () => {
  const cat = await sql('select id, nome from pos_categoria');
  const idCat = new Map(cat.map((c) => [c.nome, c.id]));
  const nomeCat = new Map(cat.map((c) => [c.id, c.nome]));
  const art = await sql('select id, categoria, nome, prezzo_cent, attivo from pos_articolo');
  const trova = (categoria, nome) => art.find((a) => nomeCat.get(a.categoria) === categoria && chiave(a.nome) === chiave(nome));
  const comandi = [];
  const mancanti = [];
  const segna = (categoria, nome) => { const a = trova(categoria, nome); if (!a) mancanti.push(`${categoria} | ${nome}`); return a; };

  for (const [c, n] of SPEGNI) {
    const a = segna(c, n); if (!a) continue;
    if (a.attivo) comandi.push([`spengo   ${c} | ${a.nome}`, `update pos_articolo set attivo = false, aggiornato_il = now() where id = ${S(a.id)}`]);
  }
  for (const [c, n, verso] of SPOSTA) {
    const a = segna(c, n); if (!a) continue;
    const id = idCat.get(verso); if (!id) throw new Error('categoria sconosciuta: ' + verso);
    comandi.push([`sposto   ${c} → ${verso} | ${a.nome}`, `update pos_articolo set categoria = ${S(id)}, aggiornato_il = now() where id = ${S(a.id)}`]);
  }
  for (const [c, n, nuovo] of RINOMINA) {
    const a = segna(c, n); if (!a) continue;
    comandi.push([`rinomino ${a.nome} → ${nuovo}`, `update pos_articolo set nome = ${S(nuovo)}, aggiornato_il = now() where id = ${S(a.id)}`]);
  }
  for (const [c, n] of ACCENDI) {
    const a = segna(c, n); if (!a) continue;
    if (!a.attivo) comandi.push([`accendo  ${a.nome}`, `update pos_articolo set attivo = true, aggiornato_il = now() where id = ${S(a.id)}`]);
  }
  if (mancanti.length) { console.log('NON TROVATI (li salto):'); for (const m of mancanti) console.log('  ' + m); }
  console.log(`${comandi.length} modifiche${PROVA ? ' (prova, non scrivo)' : ''}:`);
  for (const [cosa] of comandi) console.log('  ' + cosa);
  if (PROVA) return;
  for (const [, q] of comandi) await sql(q);
  const dopo = await sql("select c.nome as categoria, count(*) filter (where a.attivo) as accesi, count(*) filter (where not a.attivo) as spenti from pos_categoria c join pos_articolo a on a.categoria = c.id where c.nome in ('Bollicine - champagnes','Vini al calice','Vini Dessert','Rose','Vino Bianco Colli','Vino Bianco','Vino Rosso Colli','Vino Rosso','Vini') group by c.nome order by c.nome");
  console.log('DOPO: ' + dopo.map((x) => `${x.categoria} ${x.accesi} accesi${Number(x.spenti) ? ` (${x.spenti} spenti)` : ''}`).join(' · '));
})().catch((e) => { console.error(String(e)); process.exit(1); });
