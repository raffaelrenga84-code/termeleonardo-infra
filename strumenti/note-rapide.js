#!/usr/bin/env node
/* ============================================================
   note-rapide.js — le note che il cameriere tocca invece di scrivere.

   «se uno vuole una coca zero ghiaccio e limone... un decaffeinato tazza
   grande macchiato soia... se c'e' una nota gia' non serve che il
   cameriere deve aggiungere la spiegazione» (la proprieta', 4 settembre
   2026). Sul palmare Sunmi si scrive male: queste diventano bottoncini
   sotto la casella «Nota per la cucina», e finiscono sul biglietto di
   cucina e di bar.

   Solo parole: nessuna di queste tocca il prezzo. I supplementi che
   costano (soia, tazza grande) sono varianti, e i loro importi li da' la
   proprieta' — qui non si inventa un euro.

   Uso:  node strumenti/note-rapide.js [--prova]
   ============================================================ */
const fs = require('node:fs');

const GRUPPI = [
  { note: ['Deca', 'Tazza grande', 'Macchiato caldo', 'Macchiato freddo', 'Latte di soia', 'Senza lattosio', 'Orzo', 'Ginseng', 'Senza schiuma', 'Corretto', 'In vetro', 'Ristretto', 'Lungo', 'Freddo'],
    categorie: ['Caffetteria e tisane'] },
  { note: ['Con ghiaccio', 'Senza ghiaccio', 'Con limone', 'Senza limone', 'Non fredda', 'Con cannuccia', 'In bicchiere', 'Bicchieri in piu'],
    categorie: ['Bevande e Bibite'] },
  { note: ['In bicchiere', 'Non ghiacciata', 'Con limone', 'Poca schiuma'],
    categorie: ['Birre'] },
  { note: ['Con ghiaccio', 'Senza ghiaccio', 'Con limone', 'Con arancia', 'Con oliva', 'Leggero', 'Poco amaro', 'In coppa'],
    categorie: ['Aperitivi', 'Cocktail', 'Long Drinks Alcolici', 'Long Drinks Analcolici', 'DEALCOLIZZATO'] },
  { note: ['Liscio', 'Con ghiaccio', 'In bicchiere grande', 'Freddo di frigo', 'Temperatura ambiente'],
    categorie: ['Amari', 'Grappe', 'Rum', 'Whiskey', 'Brandy e Cognac', 'Liquori e Distillati'] },
  { note: ['Senza glutine', 'Senza lattosio', 'Senza formaggio', 'Senza cipolla', 'Al pomodoro', 'In bianco', 'Senza sale', 'Ben cotto', 'Allergia', 'Porzione bambino', 'Da dividere', 'Condimento a parte'],
    categorie: ['Piatti Caldi', 'Piatti Freddi', 'Da Condividere', 'Del Giorno', 'Menu'] },
  { note: ['Ben cotto', 'Media cottura', 'Al sangue', 'Pane senza glutine', 'Senza pane', 'Senza cipolla', 'Senza salsa', 'Senza formaggio', 'Patatine a parte', 'Allergia'],
    categorie: ['Hamburger'] },
  { note: ['Senza glutine', 'Senza lattosio', 'Senza formaggio', 'Senza cipolla', 'Senza tonno', 'Condimento a parte', 'Allergia', 'Porzione bambino'],
    categorie: ['Insalate'] },
  { note: ['Senza sale', 'In bianco', 'Ben cotto', 'Senza olio', 'Da dividere', 'Allergia'],
    categorie: ['Contorni'] },
  { note: ['Senza glutine', 'Senza lattosio', 'Con panna', 'Senza panna', 'Porzione bambino', 'Allergia', 'Con candelina'],
    categorie: ['Dessert'] },
  { note: ['Da portare via', 'Da scaldare', 'Incartato', 'Da dividere'],
    categorie: ['Vetrinetta', 'Varie'] },
  { note: ['Fresco', 'Temperatura ambiente', 'Da aprire dopo', 'In caraffa', 'Bicchieri in piu', 'Con ghiaccio'],
    categorie: ['Bollicine - champagnes', 'Vini', 'Vini al calice', 'Vini Dessert', 'Vino Bianco', 'Vino Bianco Colli', 'Vino Rosso', 'Vino Rosso Colli', 'Rose'] },
];

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
const stringa = (s) => "'" + String(s).replace(/'/g, "''") + "'";

(async () => {
  const viste = new Set();
  const comandi = [];
  for (const g of GRUPPI) {
    for (const c of g.categorie) {
      if (viste.has(c)) throw new Error('categoria ripetuta in due gruppi: ' + c);
      viste.add(c);
    }
    comandi.push(`update pos_categoria set note_rapide = array[${g.note.map(stringa).join(',')}]::text[], aggiornato_il = now() where nome in (${g.categorie.map(stringa).join(',')})`);
  }
  const tutte = (await sql('select nome from pos_categoria')).map((x) => x.nome);
  const fuori = tutte.filter((n) => !viste.has(n));
  if (fuori.length) console.log('categorie senza note rapide:', fuori.join(', '));
  if (PROVA) { console.log(comandi.join(';\n')); return; }
  for (const c of comandi) await sql(c);
  const dopo = await sql("select nome, array_length(note_rapide, 1) as quante from pos_categoria where array_length(note_rapide, 1) > 0 order by nome");
  console.log(dopo.map((x) => `${x.nome}: ${x.quante}`).join('\n'));
})().catch((e) => { console.error(String(e)); process.exit(1); });
