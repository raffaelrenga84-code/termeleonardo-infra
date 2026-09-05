#!/usr/bin/env node
/* ============================================================
   orari-menu.js — gli orari del menù stampato dentro il POS, per chi
   ordina dal QR (fase 2 della spec 2026-09-05-menu-ospiti-design.md).

   Dal menù «La Piazza Bistrot» 2026: «Piatti disponibili dalle ore
   12:15 alle 14:30. "X" disponibile fino alle ore 17:30, venerdì e
   sabato fino alle ore 20:30». Le categorie del cibo prendono la
   cucina; i piatti con la «X» il loro orario lungo. La lista delle X
   l'ha dettata la proprietà il 5 settembre 2026 (dal PDF il simbolo si
   perde): i tre piatti freddi, Ginevra e Leonardo, piadine, tostoni e
   toast, e tutti i dolci — percio' la categoria Dessert e' tutta X.

   Scrive SOLO dove il campo e' vuoto (con --forza riscrive), e toglie
   la X a chi ce l'ha per sbaglio (orario uguale alla X ma fuori lista:
   le righe scritte a mano nel back office con un altro testo restano).

   Uso:  node strumenti/orari-menu.js [--prova] [--forza]
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
const chiave = (s) => String(s).replace(/[’`´]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();

const CUCINA = '12:15-14:30';
const X = '12:15-17:30; ven,sab 12:15-20:30';
const CATEGORIE = { 'Piatti Freddi': CUCINA, 'Piatti Caldi': CUCINA, 'Da Condividere': CUCINA, 'Contorni': CUCINA, 'Insalate': CUCINA, 'Hamburger': CUCINA, 'Dessert': X };
const CON_LA_X = [
  'Mozzarella di Bufala & Pomodoro Rosso Origano e Basilico',
  'Prosciutto Crudo Burrata e Valeriana',
  'RISO VENERE',
  'GINEVRA', 'LEONARDO',
  'PIADINA ROMAGNOLA', 'PIADINA MEDITERRANEA',
  'Tostone Classico', 'Tostone Farcito',
  'SALMONE AFFUMICATO TOAST', 'GUACAMOLE TOAST',
  'TORTINO CALDO AL CIOCCOLATO', 'TIRAMISU’ DELLA CASA', 'DOLCE DEL GIORNO', 'MACEDONIA', 'TRIS DI GELATI ARTIGIANALI',
];

(async () => {
  const cat = await sql('select id, nome, orari from pos_categoria');
  const art = await sql('select id, nome, orari from pos_articolo where attivo');
  const comandi = [];
  const mancanti = [];
  for (const [nome, orari] of Object.entries(CATEGORIE)) {
    const c = cat.find((x) => x.nome === nome);
    if (!c) { mancanti.push('categoria ' + nome); continue; }
    if (FORZA || !c.orari) comandi.push([`categoria ${c.nome} → ${orari}`, `update pos_categoria set orari = ${S(orari)}, aggiornato_il = now() where id = ${S(c.id)}`]);
  }
  const conX = new Set();
  for (const nome of CON_LA_X) {
    const a = art.find((x) => chiave(x.nome) === chiave(nome));
    if (!a) { mancanti.push(nome); continue; }
    conX.add(a.id);
    if (FORZA || !a.orari) comandi.push([`${a.nome} → ${X}`, `update pos_articolo set orari = ${S(X)}, aggiornato_il = now() where id = ${S(a.id)}`]);
  }
  /* la X messa per sbaglio (una vecchia esecuzione, o una deduzione dal PDF) si toglie */
  for (const a of art) {
    if (a.orari === X && !conX.has(a.id)) comandi.push([`${a.nome}: via la X, vale l'orario della categoria`, `update pos_articolo set orari = null, aggiornato_il = now() where id = ${S(a.id)}`]);
  }
  /* la cucina del Bistrot: fuori da questi orari il biglietto della cucina esce al bancone */
  const bistrot = await sql("select id, orari_cucina from pos_locale where id = 'bistrot'");
  if (bistrot[0] && (FORZA || !bistrot[0].orari_cucina)) comandi.push(['locale bistrot: cucina ' + CUCINA, "update pos_locale set orari_cucina = " + S(CUCINA) + ", aggiornato_il = now() where id = 'bistrot'"]);
  if (mancanti.length) { console.log('NON TROVATI NEL POS (li salto):'); for (const m of mancanti) console.log('  ' + m); }
  console.log(`${comandi.length} modifiche${PROVA ? ' (prova, non scrivo)' : ''}:`);
  for (const [cosa] of comandi) console.log('  ' + cosa);
  if (PROVA) return;
  for (const [, q] of comandi) await sql(q);
  console.log('fatto');
})().catch((e) => { console.error(String(e)); process.exit(1); });
