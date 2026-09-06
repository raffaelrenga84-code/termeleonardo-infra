#!/usr/bin/env node
/* ============================================================
   pubblica-pacchetto.js — mette il pacchetto del PC del Bistrot nel cloud.

   «aggiornamento automatico del PC per non ricopiare la cartella a ogni
   modifica» (la proprieta', 6 settembre 2026). Legge la cartella «POS
   Bistrot» (quella che fa pacchetto-bistrot.js), prende src/ e pagina/
   — non deno.exe — e li scrive in pos_pacchetto, un file per riga, con
   l'impronta e la versione (VERSIONE.txt). Il PC del Bistrot li chiede
   ogni minuto e, se la versione e' piu' nuova della sua, si aggiorna da
   solo (pos-locale/aggiorna.ts).

   Passa dall'API di gestione come migra.js: il token sta nel file e non
   si stampa. Un file per chiamata, poi si tolgono le righe della versione
   vecchia: finche' non e' finito le versioni sono due e il PC aspetta.

   Uso:  node strumenti/pubblica-pacchetto.js [cartella del pacchetto]
   ============================================================ */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const REF = 'mvuiuwakuseockotlcnp';
const FILE_TOKEN = 'C:/Users/admin/token-supabase.txt';
const DEST = process.argv[2] || 'C:/Users/admin/OneDrive/Documents/MAIL RECEPTION HOTEL/POS Bistrot';

async function sql(query, token) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const testo = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${testo.slice(0, 300)}`);
  return JSON.parse(testo);
}

/** Tutti i file sotto una cartella, con il percorso relativo alla radice del pacchetto (barre in avanti). */
function elenca(radice, sotto) {
  const out = [];
  const giro = (d) => {
    for (const nome of fs.readdirSync(d)) {
      const p = path.join(d, nome);
      if (fs.statSync(p).isDirectory()) giro(p);
      else out.push(path.relative(radice, p).split(path.sep).join('/'));
    }
  };
  giro(path.join(radice, sotto));
  return out;
}

async function pubblica() {
  const versione = fs.readFileSync(path.join(DEST, 'VERSIONE.txt'), 'utf8').split(/\r?\n/)[0].trim();
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$/.test(versione)) throw new Error(`VERSIONE.txt strana: «${versione}»`);
  const token = fs.readFileSync(FILE_TOKEN, 'utf8').trim();
  const file = [...elenca(DEST, 'src'), ...elenca(DEST, 'pagina')];
  if (!file.includes('src/pos-locale/main.ts') || !file.includes('pagina/index.html')) throw new Error('nel pacchetto mancano main.ts o la pagina');
  let byteTotali = 0;
  for (const percorso of file) {
    if (!/^(src|pagina)\/[A-Za-z0-9_.\-/]+$/.test(percorso)) throw new Error(`percorso non ammesso: ${percorso}`);
    const byte = fs.readFileSync(path.join(DEST, percorso));
    const sha256 = crypto.createHash('sha256').update(byte).digest('hex');
    byteTotali += byte.length;
    await sql(`insert into pos_pacchetto (percorso, versione, sha256, byte, contenuto, aggiornato_il)
      values ('${percorso}', '${versione}', '${sha256}', ${byte.length}, '${byte.toString('base64')}', now())
      on conflict (percorso) do update set versione = excluded.versione, sha256 = excluded.sha256, byte = excluded.byte, contenuto = excluded.contenuto, aggiornato_il = now()`, token);
  }
  /* via le righe della versione prima: da qui il pacchetto e' intero e il PC lo prende */
  await sql(`delete from pos_pacchetto where versione <> '${versione}'`, token);
  const [{ n, v }] = await sql('select count(*)::int as n, count(distinct versione)::int as v from pos_pacchetto', token);
  if (Number(n) !== file.length || Number(v) !== 1) throw new Error(`nel cloud ${n} file e ${v} versioni: mi aspettavo ${file.length} e 1`);
  console.log(`pubblicato nel cloud: versione ${versione}, ${file.length} file, ${Math.round(byteTotali / 1024)} KB. Il PC del Bistrot si aggiorna da solo entro un minuto.`);
}

if (require.main === module) {
  pubblica().catch((e) => { console.error(String(e.message)); process.exit(1); });
}

module.exports = { pubblica };
