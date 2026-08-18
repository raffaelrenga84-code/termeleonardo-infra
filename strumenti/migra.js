/* Esegue una migrazione SQL con l'API di gestione Supabase.
   Il token si legge dal file e non viene mai stampato.

   uso:  node strumenti/migra.js supabase/2026-08-18-fanghi-desiderio.sql

   PERCHE' ESISTE. Le migrazioni si applicavano a mano nell'editor SQL, e
   andava bene finche' erano poche. Il rischio di quel modo non e' la
   fatica: e' che nessuno sappia PIU' TARDI se una migrazione e' stata
   eseguita davvero, perche' l'unica traccia era un file .sql nel deposito
   che dice cosa AVREBBE dovuto succedere.

   Qui il file resta la fonte — si legge quello, non si scrive SQL a mano
   sulla riga di comando — e l'esito si vede.

   NON E' TRANSAZIONALE. L'API esegue quello che le mandi; se una
   migrazione ha piu' istruzioni e la seconda fallisce, la prima resta
   fatta. Le migrazioni di questo deposito usano `if not exists` apposta:
   rieseguirle non rompe niente. Una migrazione che NON e' ripetibile va
   scritta dentro `begin; ... commit;` da chi la scrive. */
const fs = require('fs');

const REF = 'mvuiuwakuseockotlcnp';
const FILE_TOKEN = 'C:/Users/admin/token-supabase.txt';

async function migra(percorso) {
  const sql = fs.readFileSync(percorso, 'utf8');
  const token = fs.readFileSync(FILE_TOKEN, 'utf8').trim();

  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const testo = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${testo.slice(0, 400)}`);
  return testo;
}

/* Senza questa guardia un require() di questo file eseguirebbe una
   migrazione in produzione. E' gia' successo con pubblica-tutto.js, il 18
   agosto 2026, mentre si provava a caricare il modulo per esaminarlo. */
if (require.main === module) {
  const percorso = process.argv[2];
  if (!percorso) {
    console.error('uso: node strumenti/migra.js <file.sql>');
    process.exit(1);
  }
  migra(percorso)
    .then((esito) => console.log(`${percorso}: eseguita · ${esito.slice(0, 200)}`))
    .catch((e) => { console.error(String(e.message)); process.exit(1); });
}

module.exports = { migra };
