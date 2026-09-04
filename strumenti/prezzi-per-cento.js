#!/usr/bin/env node
/* ============================================================
   prezzi-per-cento.js — rimette a posto i prezzi gonfiati ×100.

   L'importazione delle 21:27 del 4 settembre 2026 ha letto i prezzi di
   `item-variations` (interi in centesimi: 600 = 6,00 euro) come se
   fossero euro, e li ha scritti moltiplicati per cento: il calice di
   vino dei Colli e' comparso sul palmare a 500,00 euro. «sicuro che i
   prezzi sono giusti?» (la proprieta').

   Tocca SOLO le righe scritte da quell'importazione (la finestra di un
   minuto) e solo quelle sopra i 100,00 euro: il Consomme' a 5,00, che in
   quella finestra ha avuto solo il nome aggiornato, e i prezzi a zero
   restano dove sono. Sono tutte multiple di 100, quindi la divisione e'
   esatta e si puo' rifare all'incontrario.

   Uso:  node strumenti/prezzi-per-cento.js [--prova]
   ============================================================ */
const fs = require('node:fs');

const DOVE = "aggiornato_il >= '2026-09-04 21:27:00+00' and aggiornato_il < '2026-09-04 21:28:00+00' and prezzo_cent >= 10000 and prezzo_cent % 100 = 0";
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

(async () => {
  const prima = await sql('select count(*) as n from pos_articolo where ' + DOVE);
  console.log('righe da correggere:', prima[0].n);
  if (PROVA) {
    console.log(await sql('select nome, prezzo_cent as ora, prezzo_cent / 100 as dopo from pos_articolo where ' + DOVE + ' order by prezzo_cent desc limit 5'));
    return;
  }
  await sql('update pos_articolo set prezzo_cent = prezzo_cent / 100 where ' + DOVE);
  const restano = await sql('select count(*) as n from pos_articolo where ' + DOVE);
  console.log('restano gonfiate:', restano[0].n);
  console.log('i piu cari del menu adesso:', await sql('select nome, prezzo_cent from pos_articolo order by prezzo_cent desc limit 4'));
})().catch((e) => { console.error(String(e)); process.exit(1); });
/* FATTO il 4 settembre 2026: 291 righe divise per cento. Rieseguirlo
   dividerebbe di nuovo le poche voci care che restano dentro al filtro
   (noleggio sala, programmi benessere): il file resta come memoria di
   cosa e' successo, non si rilancia. */
