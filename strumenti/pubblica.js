/* Pubblica una funzione Supabase con l'API di gestione.
   Il token si legge dal file e non viene mai stampato.

   uso:  node strumenti/pubblica.js <slug> */
const fs = require('fs');
const path = require('path');

const REF = 'mvuiuwakuseockotlcnp';
const FILE_TOKEN = 'C:/Users/admin/token-supabase.txt';

/* I .js, non solo i .ts: un modulo lasciato fuori fa fallire il bundle con
   "Module not found", e l'errore arriva solo al deploy — le prove locali non
   se ne accorgono perche' il file c'e'.
   Le prove non vanno in produzione: pesano e non servono. */
function fileDellaFunzione(slug) {
  const dir = path.join(__dirname, '..', 'supabase', 'functions', slug);
  const nomi = fs.readdirSync(dir).filter((f) =>
    (f.endsWith('.ts') || f.endsWith('.js')) &&
    !f.endsWith('.test.ts') && !f.endsWith('.test.js'));
  return { dir, nomi };
}

async function pubblica(slug) {
  const token = fs.readFileSync(FILE_TOKEN, 'utf8').trim();
  const { dir, nomi } = fileDellaFunzione(slug);

  const form = new FormData();
  form.append('metadata', JSON.stringify({
    entrypoint_path: 'index.ts',
    name: slug,
    verify_jwt: false,
  }));
  for (const f of nomi) {
    form.append('file', new File([fs.readFileSync(path.join(dir, f))], f,
      { type: 'application/typescript' }));
  }

  const r = await fetch(
    `https://api.supabase.com/v1/projects/${REF}/functions/deploy?slug=${slug}`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  const testo = await r.text();
  if (!r.ok) throw new Error(`${slug}: HTTP ${r.status} — ${testo.slice(0, 300)}`);
  const j = JSON.parse(testo);
  return { versione: j.version, file: nomi };
}

module.exports = { pubblica };

if (require.main === module) {
  const slug = process.argv[2];
  if (!slug) { console.error('uso: node strumenti/pubblica.js <slug>'); process.exit(1); }
  pubblica(slug)
    .then(({ versione, file }) =>
      console.log(`${slug}: pubblicata versione ${versione} · ${file.length} file`))
    .catch((e) => { console.error(e.message); process.exit(1); });
}
