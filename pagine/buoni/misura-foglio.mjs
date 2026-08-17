/* ============================================================
   misura-foglio.mjs — quanto spazio resta in fondo al foglio A4.

   PERCHE' ESISTE. La meta' interna del buono (`.meta.interno`) ha altezza
   fissa — 148.5mm, meta' di un A4 — e `overflow:hidden`. Quando il contenuto
   supera quell'altezza non succede niente di visibile: il testo che avanza
   viene semplicemente TAGLIATO, e quello che avanza per ultimo e' la coda
   delle CONDIZIONI, cioe' cancellazione, rimborso e validita' — proprio il
   testo che il cliente dichiara di aver accettato prima di pagare.

   E' gia' successo: il foglio tagliava 24px in italiano e 74px in tedesco, e
   nessun test se n'era accorto, perche' nessun test in Deno guarda il CSS.
   L'ha trovato una revisione che ha renderizzato il foglio per davvero.

   Il tedesco e' il caso peggiore e non e' un caso: le stesse frasi in tedesco
   sono piu' lunghe, e la lingua non e' un dettaglio grafico — un buono
   comprato da un ospite austriaco e' un buono normale.

   COME SI USA
     node pagine/buoni/misura-foglio.mjs
   Stampa, per ogni caso, quanti pixel restano fra l'ultimo elemento e il
   fondo utile del riquadro. Un numero NEGATIVO vuol dire che il foglio sta
   tagliando: va stretto qualcosa in stampa.css finche' non torna positivo.
   Sotto i 20px conviene comunque intervenire: e' il margine che serve a un
   nome piu' lungo o a un sottotitolo in piu' per far ricominciare il taglio.

   NON e' un test automatico apposta: serve un browser vero installato, e un
   test che fallisce su una macchina senza browser sarebbe un test che la
   gente impara a ignorare. Si esegue quando si tocca un testo del buono o
   una regola di stampa.css.
   ============================================================ */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const SOGLIA = 20;   /* sotto questa aria si e' troppo al limite: vedi sopra */

/* Un browser qualunque basato su Chromium: si prende il primo che c'e'. */
const CANDIDATI = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const browser = CANDIDATI.find((p) => fs.existsSync(p));
if (!browser) {
  console.error('Nessun browser Chromium trovato: senza, il foglio non si puo\' misurare.');
  console.error('Cercati:\n  ' + CANDIDATI.join('\n  '));
  process.exit(2);
}

const { buonoStampaHTML } = await import(new URL('./buono.js', import.meta.url).href);
const css = fs.readFileSync(path.join(QUI, 'stampa.css'), 'utf8');

/* I casi che contano.
   ------------------------------------------------------------------
   Fino al 17 agosto 2026 qui c'era UN SOLO contenuto: un Day Spa a una voce
   con la descrizione accorciata a mano ('Day Spa festivo'), e il commento
   diceva «se non ci sta quello, non ci sta niente». Era falso, ed e' il modo
   piu' pericoloso in cui un copione di misura puo' sbagliare: rendeva il caso
   PIU' FACILE e dichiarava "ci sta" per tutti gli altri. Il foglio tagliava
   gia' le condizioni sui buoni a due voci, e nessuno lo vedeva.

   Due cose sono cambiate, tutte e due per rendere i casi VERI:

   · le descrizioni sono quelle che il buono porta davvero — le voci del
     LISTINO (supabase/functions/buoni/acquista.ts) composte da
     componiDescrizione(), che con piu' di una voce scrive il numero su
     TUTTE le righe. Sono ricopiate qui perche' questo copione gira in Node e
     quelle vivono in un .ts: se il listino cambia quei due nomi, vanno
     rifatte anche qui;
   · c'e' il buono a DUE VOCI. Il tetto e' due (VOCI_MAX), ogni riga e' un
     .servizio-nome da 18px che spesso va a capo, ed e' proprio il buono di
     cui parla la specifica §4-bis — un ingresso Day Spa piu' un massaggio.
     Non e' un caso di laboratorio: e' quello che si vende.

   Il sottotitolo entra ed esce: sui buoni scritti in reception lo si compila
   a mano, e una riga in piu' li' e' la differenza fra un foglio intero e uno
   che taglia le condizioni. */

/* i nomi veri, dal LISTINO */
const DAYSPA = 'Day Spa festivo — piscine e grotte, sabato, domenica e festivi, 9.00–18.30';
const MASSAGGIO = 'Massaggio Shiatsu (50 min)';

const CONTENUTI = [
  /* una voce sola: componiDescrizione non scrive il numero */
  { nome: '1voce', descrizione: DAYSPA, sottotitolo: '' },
  { nome: '1voce-sott', descrizione: DAYSPA, sottotitolo: 'piscine e grotte' },
  /* due voci: il numero va su tutte e due le righe */
  { nome: '2voci', descrizione: `1 × ${DAYSPA}\n1 × ${MASSAGGIO}`, sottotitolo: '' },
  { nome: '2voci-sott', descrizione: `1 × ${DAYSPA}\n1 × ${MASSAGGIO}`, sottotitolo: 'piscine e grotte' },
];

const CASI = [];
for (const lingua of ['it', 'de', 'en', 'fr']) {
  for (const contenuto of CONTENUTI) {
    for (const prorogato of [false, true]) {
      CASI.push({
        nome: `${lingua}-${contenuto.nome}-${prorogato ? 'prorogato' : 'normale'}`,
        lingua, prorogato,
        descrizione: contenuto.descrizione, sottotitolo: contenuto.sottotitolo,
      });
    }
  }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'foglio-'));
let peggiore = Infinity, peggioreNome = '';

for (const c of CASI) {
  const b = {
    numero: 'BR-2026-0042', codice: 'LEO-ACDE-FGHJ',
    tipo: 'servizio', voce_id: 'dayspa_wknd',
    descrizione: c.descrizione, sottotitolo: c.sottotitolo,
    destinatario: 'Anna Mustermann', acquirente: 'Max Mustermann', dedica: '',
    lingua: c.lingua,
    scade_il: c.prorogato ? '2027-03-13' : '2027-08-15',
    scade_il_base: c.prorogato ? '2026-11-30' : '2027-08-15',
    prorogato: c.prorogato,
  };

  const file = path.join(tmp, c.nome + '.html');
  fs.writeFileSync(file, `<!doctype html><meta charset="utf-8"><style>${css}</style>
<div id="stampa">${buonoStampaHTML(b, false)}</div>
<script>
addEventListener('load', () => {
  const box = document.querySelector('#stampa .meta.interno');
  const d = document.createElement('div');
  d.id = 'MISURA';
  if (!box) { d.textContent = 'ARIA=?'; document.body.appendChild(d); return; }
  /* scrollHeight si ferma a clientHeight quando il contenuto ci sta: direbbe
     "ci sta" senza dire quanto avanza. Si misura invece il fondo dell'ultimo
     elemento contro il fondo utile del riquadro. */
  const ultimo = box.lastElementChild;
  const aria = Math.round(
    box.getBoundingClientRect().bottom
    - parseFloat(getComputedStyle(box).paddingBottom)
    - ultimo.getBoundingClientRect().bottom);
  d.textContent = 'ARIA=' + aria;
  document.body.appendChild(d);
});
</script>`);

  const dom = execFileSync(browser, [
    '--headless', '--disable-gpu', '--virtual-time-budget=3000',
    '--dump-dom', 'file:///' + file.replace(/\\/g, '/'),
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

  const m = dom.match(/id="MISURA">ARIA=(-?\d+)/);
  const aria = m ? Number(m[1]) : NaN;
  if (aria < peggiore) { peggiore = aria; peggioreNome = c.nome; }
  const giudizio = isNaN(aria) ? 'NON MISURATO'
    : aria < 0 ? `TAGLIA ${-aria}px di condizioni`
    : aria < SOGLIA ? 'troppo al limite' : '';
  console.log(`${c.nome.padEnd(28)} aria ${String(aria).padStart(5)}px  ${giudizio}`);
}

fs.rmSync(tmp, { recursive: true, force: true });

console.log(`\ncaso peggiore: ${peggioreNome}, ${peggiore}px`);
if (peggiore < 0) {
  console.error('IL FOGLIO STA TAGLIANDO. Stringere qualcosa in stampa.css.');
  process.exit(1);
}
if (peggiore < SOGLIA) {
  console.error(`Meno di ${SOGLIA}px di margine: ci sta oggi, non ci stara' al primo testo piu' lungo.`);
  process.exit(1);
}
console.log('Ci sta, con margine.');
