#!/usr/bin/env node
/* ============================================================
   acqua-e-vini-ristorante.js — «Acqua» per tutti, «Vini ristorante»
   che raccoglie il listino stampato.

   La proprieta' (5 settembre 2026): un sistema solo per Bistrot e
   ristorante, dove il ristorante trova in una casella tutto il listino
   vini cartaceo, e l'acqua — che ordinano tutti e due — a portata di
   mano. Un articolo sta in UNA categoria: le acque non si sdoppiano fra
   «Bevande e Bibite» e i vini, vanno in una categoria «Acqua» che e' la
   PRIMA casella di ogni palmare (posizione 0) e si prepara «dove si
   mangia» (locale_stampa null: al Bistrot la stampa il bancone, al
   ristorante non si stampa perche' non ha stampanti).

   «Vini ristorante» e' un contenitore (pos_categoria.sotto): dentro, le
   sette categorie di bottiglie del listino. «Vini al calice» resta fuori,
   perche' i calici li vende anche il Bistrot. La vecchia «Vini» (quello
   che restava delle fotografie) si svuota e si spegne.

   Ripetibile. Uso:  node strumenti/acqua-e-vini-ristorante.js [--prova]
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
const S = (s) => (s === null || s === undefined ? 'null' : "'" + String(s).replace(/'/g, "''") + "'");
const chiave = (s) => String(s).replace(/[’`´]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();

const ACQUA = { id: 'acqua', nome: 'Acqua', posizione: 0, colore: '#6FA8C9', stampante: 'bar', portata: 'bevande' };
const VINI_RIST = { id: 'vini-ristorante', nome: 'Vini ristorante', posizione: 275, colore: '#7B1E3B', stampante: 'bar', portata: 'bevande' };
const SOTTO_VINI = ['Bollicine - champagnes', 'Rose', 'Vini Dessert', 'Vino Bianco', 'Vino Bianco Colli', 'Vino Rosso', 'Vino Rosso Colli'];

/* le acque che vanno in «Acqua»: [categoria di adesso, nome, nuovo nome o null, accendere] */
const ACQUE = [
  ['Bevande e Bibite', 'Acqua Minerale Naturale Latt. 0,50 L.', null, true],
  ['Bevande e Bibite', 'Acqua Minerale Gassata Latt. 0,50 L.', null, true],
  ['Bevande e Bibite', 'ACQUA MINERALE NATURALE TAVINA 0,5 L', 'Acqua Tavina Naturale 0,5 L.', true],
  ['Bevande e Bibite', 'ACQUA MINERALE GASSATA TAVINA 0,5', 'Acqua Tavina Gassata 0,5 L.', true],
  ['Bevande e Bibite', 'Acqua Minerale Panna 0,75 L.', null, true],
  ['Bevande e Bibite', 'Acqua Minerale San Pellegrino 0,75 L.', null, true],
  ['Bevande e Bibite', 'Bicchiere D’acqua Minerale', 'Bicchiere d’acqua', true],
  ['Da sistemare', 'San Pellegrino 0.5 L', 'Acqua San Pellegrino 0,5 L.', true],
  ['Da sistemare', 'Gaverina', 'Acqua Gaverina Naturale 0,75 L.', true],
];
/* la Gaverina gasata non c'era in Fidra: nasce dalla naturale, stesso prezzo */
const GAVERINA_GASATA = { da: 'Acqua Gaverina Naturale 0,75 L.', nome: 'Acqua Gaverina Gasata 0,75 L.' };

/* i due orfani della vecchia «Vini» */
const ORFANI = [['Vini', 'Spumanti - Piccolo 7,00', 'Bollicine - champagnes'], ['Vini', 'VINUCI - DECISO RIESLING FERMO DEALCOLIZZATO 0,75L', 'Vino Bianco']];

(async () => {
  const cat = await sql('select id, nome, sotto, attiva from pos_categoria');
  const idCat = (nome) => (cat.find((c) => c.nome === nome) || {}).id;
  const nomeCat = new Map(cat.map((c) => [c.id, c.nome]));
  const art = await sql('select id, categoria, nome, prezzo_cent, iva, attivo, stampante, portata from pos_articolo');
  const trova = (categoria, nome) => art.find((a) => nomeCat.get(a.categoria) === categoria && chiave(a.nome) === chiave(nome));
  const comandi = [];
  const dire = (cosa, q) => comandi.push([cosa, q]);

  for (const c of [ACQUA, VINI_RIST]) {
    if (!cat.find((x) => x.id === c.id)) {
      dire(`creo la categoria «${c.nome}»`, `insert into pos_categoria (id, nome, posizione, colore, stampante, portata, sotto, locale_stampa, attiva, aggiornato_il) values (${S(c.id)}, ${S(c.nome)}, ${c.posizione}, ${S(c.colore)}, ${S(c.stampante)}, ${S(c.portata)}, null, null, true, now())`);
    }
  }
  for (const nome of SOTTO_VINI) {
    const c = cat.find((x) => x.nome === nome);
    if (!c) { console.log('categoria non trovata: ' + nome); continue; }
    if (c.sotto !== VINI_RIST.id) dire(`«${nome}» sotto «Vini ristorante»`, `update pos_categoria set sotto = ${S(VINI_RIST.id)}, aggiornato_il = now() where id = ${S(c.id)}`);
  }
  for (const [catDa, nome, nuovo, accendi] of ACQUE) {
    const a = trova(catDa, nome);
    if (!a) { console.log(`acqua non trovata: ${catDa} | ${nome}`); continue; }
    dire(`«${nome}» → Acqua${nuovo ? ` come «${nuovo}»` : ''}`, `update pos_articolo set categoria = ${S(ACQUA.id)}, nome = ${S(nuovo || a.nome)}, attivo = ${accendi ? 'true' : 'false'}, locale_stampa = null, aggiornato_il = now() where id = ${S(a.id)}`);
  }
  const gav = trova('Da sistemare', 'Gaverina');
  if (gav && !art.find((a) => chiave(a.nome) === chiave(GAVERINA_GASATA.nome))) {
    dire(`creo «${GAVERINA_GASATA.nome}» a ${(gav.prezzo_cent / 100).toFixed(2)} (dalla naturale)`,
      `insert into pos_articolo (id, categoria, nome, prezzo_cent, iva, portata, stampante, prezzo_libero, esaurito, posizione, attivo, aggiornato_il) values (${S('acqua-gaverina-gasata')}, ${S(ACQUA.id)}, ${S(GAVERINA_GASATA.nome)}, ${Number(gav.prezzo_cent)}, ${Number(gav.iva) || 10}, ${S(gav.portata)}, ${S(gav.stampante)}, false, false, 0, true, now())`);
  }
  for (const [catDa, nome, verso] of ORFANI) {
    const a = trova(catDa, nome);
    if (!a) { console.log(`non trovato: ${catDa} | ${nome}`); continue; }
    dire(`«${nome}» → ${verso}`, `update pos_articolo set categoria = ${S(idCat(verso))}, aggiornato_il = now() where id = ${S(a.id)}`);
  }
  const vini = cat.find((x) => x.nome === 'Vini');
  if (vini && vini.attiva) dire('spengo la vecchia categoria «Vini»', `update pos_categoria set attiva = false, aggiornato_il = now() where id = ${S(vini.id)}`);

  console.log(`${comandi.length} modifiche${PROVA ? ' (prova, non scrivo)' : ''}:`);
  for (const [cosa] of comandi) console.log('  ' + cosa);
  if (PROVA) return;
  for (const [, q] of comandi) await sql(q);
  const dopo = await sql("select c.nome, coalesce(p.nome, '') as dentro, count(a.id) filter (where a.attivo) as accesi from pos_categoria c left join pos_categoria p on p.id = c.sotto left join pos_articolo a on a.categoria = c.id where c.nome in ('Acqua', 'Vini ristorante', 'Vini', 'Vini al calice') or c.sotto = 'vini-ristorante' group by c.nome, p.nome order by p.nome nulls first, c.nome");
  console.log('DOPO: ' + dopo.map((x) => `${x.dentro ? x.dentro + ' › ' : ''}${x.nome}: ${x.accesi}`).join(' · '));
})().catch((e) => { console.error(String(e)); process.exit(1); });
