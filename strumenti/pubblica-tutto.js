/* La pubblicazione del lavoro sui buoni, nell'ordine che conta.

   uso:  node strumenti/pubblica-tutto.js            pubblica tutto
         node strumenti/pubblica-tutto.js --prova    non tocca niente: misura e basta
         node strumenti/pubblica-tutto.js --da 3     riprende dal passo 3

   Ogni inversione dell'ordine produce un guasto che risponde 200 — di quelli
   che nessuno vede finché non se ne lamenta un ospite. Per questo dopo ogni
   passo c'è un cancello: se non si apre, la pubblicazione si ferma lì.

   Misurato in produzione il 18 agosto 2026, prima di pubblicare:
     ?a=dayspa            -> 401 "non autorizzato"
     /richieste/          -> nessuna occorrenza di "dayspa"
     /it/day-spa          -> 6583 byte (la vetrina, non il modulo)
   Sono i tre rossi da cui i cancelli devono diventare verdi. */

const fs = require('fs');
const { execFileSync } = require('child_process');
const { pubblica } = require('./pubblica.js');

const REF = 'mvuiuwakuseockotlcnp';
const FILE_TOKEN = 'C:/Users/admin/token-supabase.txt';
const FUNZIONI = `https://${REF}.supabase.co/functions/v1`;
const ARRIVO = 'https://arrivo-terme-leonardo.vercel.app';
const VETRINA = 'https://www.hoteltermeleonardo.com';

const ATTESA_MAX_MS = 6 * 60 * 1000;
const INTERVALLO_MS = 10 * 1000;

const dorme = (ms) => new Promise((r) => setTimeout(r, ms));
const fraGiorni = (n) =>
  new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

/* Riprova finché la misura non diventa verde, o finché non scade il tempo.
   Vercel impiega da mezzo minuto a tre a mettere in linea una build. */
async function attende(nome, cancello, versione) {
  const scadenza = Date.now() + ATTESA_MAX_MS;
  let ultima = '';
  for (;;) {
    let esito;
    try { esito = await cancello(versione); } catch (e) { esito = { ok: false, dice: e.message }; }
    ultima = esito.dice;
    if (esito.ok) return esito.dice;
    if (Date.now() > scadenza) throw new Error(`${nome}: il cancello resta chiuso — ${ultima}`);
    process.stdout.write('.');
    await dorme(INTERVALLO_MS);
  }
}

/* La versione in linea, secondo Supabase. Serve a provare che quello che
   abbiamo spedito è davvero quello che risponde. */
async function versioneInLinea(slug) {
  const token = fs.readFileSync(FILE_TOKEN, 'utf8').trim();
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/functions/${slug}`,
    { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`lettura versione: HTTP ${r.status}`);
  return JSON.parse(await r.text()).version;
}

/* Per buoni e chat non c'è un comportamento nuovo da interrogare dal di
   fuori: il buono non esiste finché non se ne vende uno, e il chatbot
   risponde in prosa. Quello che si può provare è che la versione che
   risponde in linea sia quella appena spedita — non una più vecchia
   rimasta su per un deploy fallito a metà. */
const cancelloVersione = (slug) => async (attesa) => {
  if (attesa == null) return { misurabile: false, dice: 'si misura solo pubblicando' };
  const viva = await versioneInLinea(slug);
  if (viva !== attesa) return { ok: false, dice: `in linea c'è la v${viva}, non la v${attesa}` };
  return { ok: true, dice: `in linea la v${viva}` };
};

async function cancelloRichieste() {
  const url = `${FUNZIONI}/richieste?a=dayspa&giorno=${fraGiorni(3)}&persone=2`;
  const r = await fetch(url);
  const testo = await r.text();
  if (r.status !== 200) return { ok: false, dice: `HTTP ${r.status} ${testo.slice(0, 80)}` };
  let j;
  try { j = JSON.parse(testo); } catch { return { ok: false, dice: 'risposta non JSON' }; }
  if (!j.stato) return { ok: false, dice: `200 ma senza stato: ${testo.slice(0, 80)}` };
  return { ok: true, dice: `200 · stato "${j.stato}"` };
}

async function cancelloPagine() {
  const r = await fetch(`${ARRIVO}/richieste/`);
  const testo = await r.text();
  if (r.status !== 200) return { ok: false, dice: `HTTP ${r.status}` };
  const quante = (testo.match(/dayspa/g) || []).length;
  if (quante === 0) return { ok: false, dice: 'la pagina in linea non conosce ancora "dayspa"' };
  return { ok: true, dice: `${quante} occorrenze di "dayspa" · ${testo.length} byte` };
}

/* Un 200 con text/html non prova niente: ogni indirizzo della vetrina
   risponde così. Quello che distingue il modulo vero dal guscio della
   vetrina è il peso. */
async function cancelloRiscritture() {
  const r = await fetch(`${VETRINA}/it/day-spa`);
  const testo = await r.text();
  if (testo.length < 20000)
    return { ok: false, dice: `${testo.length} byte — è ancora la vetrina, non il modulo` };
  if (!testo.includes('dayspa'))
    return { ok: false, dice: `${testo.length} byte ma senza "dayspa"` };
  return { ok: true, dice: `${testo.length} byte · il modulo Day Spa` };
}

/* git push scrive l'avanzamento su stderr, non su stdout: leggere stdout
   dà sempre la stringa vuota, anche quando ha spinto venti commit. L'unico
   modo onesto di dire cosa è successo è contare i commit di scarto prima. */
function spinge(deposito) {
  const scarto = execFileSync('git', ['-C', deposito, 'rev-list', '--count', '@{u}..HEAD'],
    { encoding: 'utf8' }).trim();
  if (scarto === '0') return { dice: 'niente da spingere: era già allineato' };
  execFileSync('git', ['-C', deposito, 'push'], { encoding: 'utf8', stdio: 'pipe' });
  const rimasti = execFileSync('git', ['-C', deposito, 'rev-list', '--count', '@{u}..HEAD'],
    { encoding: 'utf8' }).trim();
  if (rimasti !== '0') throw new Error(`${deposito}: dopo il push restano ${rimasti} commit di scarto`);
  return { dice: `spinti ${scarto} commit` };
}

const pubblicaFunzione = (slug) => () =>
  pubblica(slug).then(({ versione, file }) =>
    ({ dice: `versione ${versione} · ${file.length} file`, versione }));

const PASSI = [
  {
    titolo: 'la funzione richieste',
    perche: 'senza, l\u2019ospite compila tutto e legge «non siamo riusciti a registrare la richiesta, ci chiami»',
    fa: pubblicaFunzione('richieste'),
    cancello: cancelloRichieste,
  },
  {
    titolo: 'le pagine',
    perche: 'sono quelle che sanno parlare col nuovo tipo di richiesta',
    fa: () => spinge('C:/Users/admin/termeleonardo-infra'),
    cancello: cancelloPagine,
  },
  {
    titolo: 'le riscritture della vetrina',
    perche: 'prima delle pagine, /it/day-spa aprirebbe il modulo dei green fee',
    fa: () => spinge('C:/Users/admin/termeleonardo'),
    cancello: cancelloRiscritture,
  },
  {
    titolo: 'la funzione buoni',
    perche: 'è il pulsante «Prenota online» nelle mail — prima delle riscritture porterebbe alla home',
    fa: pubblicaFunzione('buoni'),
    cancello: cancelloVersione('buoni'),
  },
  {
    titolo: 'la funzione chat',
    perche: 'il chatbot deve sapere che chi ha un buono non paga di nuovo',
    fa: pubblicaFunzione('chat'),
    cancello: cancelloVersione('chat'),
  },
];

async function principale() {
  const prova = process.argv.includes('--prova');
  const i = process.argv.indexOf('--da');
  const da = i >= 0 ? Number(process.argv[i + 1]) : 1;

  if (prova) {
    console.log('Prova: non tocco niente, misuro e basta.\n');
    for (let n = 0; n < PASSI.length; n++) {
      const esito = await PASSI[n].cancello(null).catch((e) => ({ ok: false, dice: e.message }));
      const voce = esito.misurabile === false ? '     —' : (esito.ok ? ' VERDE' : ' rosso');
      console.log(`  ${n + 1}.${voce}  ${PASSI[n].titolo}: ${esito.dice}`);
    }
    console.log('\nIl foglio A4 si stampa solo quando sono tutti verdi.');
    return;
  }

  if (da > 1) console.log(`Riprendo dal passo ${da}. I precedenti li do per fatti.\n`);

  for (let n = da - 1; n < PASSI.length; n++) {
    const passo = PASSI[n];
    console.log(`${n + 1}. ${passo.titolo}`);
    console.log(`   perché: ${passo.perche}`);
    const { dice, versione } = await passo.fa();
    console.log(`   ${dice}`);
    process.stdout.write('   verifico ');
    const esito = await attende(passo.titolo, passo.cancello, versione ?? null);
    console.log(`\n   verde: ${esito}\n`);
  }

  console.log('Tutto in linea. Adesso, e solo adesso, si può stampare il foglio A4.');
  console.log('Da guardare per primo: la prima richiesta Day Spa vera, nella casella della reception.');
}

/* Senza questa guardia, un semplice require() di questo file pubblica in
   produzione: principale() partirebbe al caricamento. È successo davvero,
   il 18 agosto 2026, mentre si provava a caricare il modulo per esaminarlo. */
if (require.main === module) {
  principale().catch((e) => {
    console.error(`\nFermato: ${e.message}`);
    console.error('Niente di quello che segue è stato pubblicato. Si riprende con --da <passo>.');
    process.exit(1);
  });
}

module.exports = { PASSI, principale };
