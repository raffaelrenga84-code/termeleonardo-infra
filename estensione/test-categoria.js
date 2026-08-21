/* Test: riconoscimento categoria e trattamento su un DOM che riproduce
   il modulo Nuova Prenotazione di Fidra (griglia tessere + sezione Prezzi).
   Esegui:  node test-categoria.js                                        */
const { JSDOM } = require('jsdom');
const fs = require('fs');

const CATEGORIE = [
  ['Fittizia', 1], ['Doppia', 6], ['Matrimoniale Queen', 13],
  ['Junior Suite Colli Euganei', 5], ['Junior Suite Accessibile', 1],
  ['Suite Colli Euganei', 1], ['Suite Monteortone', 3],
  ['Junior Suite Monteortone', 1], ['Junior Suite Abano', 6]
];

/* la sezione Prezzi: ogni tariffa e' una riga con un pallino, e il testo
   della riga contiene il trattamento. E' la trappola in cui cadeva il codice. */
const SEZIONI = [
  ['Soggiorno breve', [['Mezza Pensione', '\u20AC290']]],
  ['Miglior Prezzo',  [['Bed & Breakfast', '\u20AC220']]],
  ['Thermal Escape',  [['Mezza Pensione', '\u20AC330']]]
];

function costruisciDOM() {
  /* struttura reale osservata in Fidra: una COLONNA Tailwind che avvolge la
     tessera cliccabile. Solo la tessera interna ha il gestore del clic. */
  const tessere = CATEGORIE.map(([n, q]) =>
    `<div class="w-full pb-2 text-center md:pr-2 md:w-1/3" data-col="${n}">
       <div class="tessera" wire:click="pick" data-cat="${n}"><div class="nome">${n}</div>
         <div class="disp">${q} &nbsp;Disponibili</div></div></div>`).join('');
  let k = 0;
  const righe = SEZIONI.map(([titolo, voci]) =>
    `<div class="sezione"><h3>${titolo}</h3>` +
    voci.map(([tr, pr]) =>
      `<div class="riga-prezzo"><label><input type="radio" name="tariffa" value="${k++}">
         <span class="tr">${tr}</span><span class="pr">${pr}</span></label>
         <a class="dett">dettaglio</a></div>`).join('') + `</div>`).join('');
  return new JSDOM(`<body>
    <div class="griglia">${tessere}</div>
    <div class="prezzi"><label>Filtro arrangiamento</label>
      <select id="arr"><option value=""></option>
        <option value="mp">Mezza Pensione</option>
        <option value="bb">Bed &amp; Breakfast</option></select>
      ${righe}</div>
    <div id="barra">4 Notti, 0 Camere, 0 Adulti, 0 Bambini</div>
    <input class="flatpickr-input" value="2026-10-04 - 2026-10-06">
    <button id="leoDispBtn" style="position:fixed;bottom:76px;right:24px;">Disponibilita'</button>
    <select id="sorgente"><option>Telefono</option><option>Sito</option></select>
  </body>`, { pretendToBeVisual: true, runScripts: 'outside-only' });
}

/* jsdom non calcola innerText: lo mappo su textContent con gli a capo dei blocchi */
function abilitaInnerText(win) {
  Object.defineProperty(win.HTMLElement.prototype, 'innerText', {
    get() {
      return Array.from(this.childNodes).map(n =>
        n.nodeType === 3 ? n.textContent
          : (n.tagName === 'DIV' || n.tagName === 'LABEL' ? '\n' + n.innerText : n.innerText)
      ).join('').replace(/\n{2,}/g, '\n').trim();
    }
  });
  Object.defineProperty(win.HTMLElement.prototype, 'offsetParent',
    { get() { return this.parentElement; } });
}

/* ---- le funzioni sotto esame, estratte dal file vero ---- */
function caricaFunzioni(dom) {
  const src = fs.readFileSync(__dirname + '/fidra-booking.js', 'utf8');
  const win = dom.window;
  win.chrome = { storage: { local: { get: () => {}, remove: () => {} } }, runtime: {} };
  win.eval(src);
  return win.__leonardo;
}

/* ---- casi ---- */
let falliti = 0;
const ok = (nome, cond, extra) => {
  console.log((cond ? '  \x1b[32mOK\x1b[0m  ' : '  \x1b[31mKO\x1b[0m  ') + nome +
              (extra !== undefined && !cond ? '   → ' + JSON.stringify(extra) : ''));
  if (!cond) falliti++;
};

const dom = costruisciDOM();
abilitaInnerText(dom.window);
const L = caricaFunzioni(dom);
const doc = dom.window.document;

console.log('\n— quale categoria si ricava dalla richiesta —');
ok('dal campo Camera della richiesta dal sito',
   L.categoria({ categoria: 'Junior Suite Abano' }) === 'junior suite abano',
   L.categoria({ categoria: 'Junior Suite Abano' }));
ok('campo Camera con spazi e maiuscole miste',
   L.categoria({ categoria: '  JUNIOR suite Abano ' }) === 'junior suite abano');
ok('mail lunga: la categoria oltre i 300 caratteri di note NON si perde piu\'',
   L.categoria({ categoria: 'Junior Suite Abano', note: 'x'.repeat(300) }) === 'junior suite abano');
ok('senza campo Camera si ripiega sulle note (comportamento di prima)',
   L.categoria({ note: 'periodo ... camera junior suite abano ...' }) === 'junior suite abano');
ok('richiesta che non nomina camere: nessuna categoria',
   L.categoria({ note: 'vorrei un preventivo per due notti' }) === null);
ok('mai le camere accessibili, nemmeno se richieste per nome',
   L.tessere('junior suite accessibile').length === 0);

console.log('\n— quale tessera viene riconosciuta —');
const t = L.tessere('junior suite abano');
ok('scarta la colonna esterna e tiene una sola tessera', t.length === 1, t);
ok('la tessera contiene nome e disponibilita\'', /Junior Suite Abano.*6.*Disponibili/.test(t[0] || ''), t[0]);
ok('"doppia" non pesca anche altre tessere', L.tessere('doppia').length === 1, L.tessere('doppia'));

console.log('\n— trattamento: due righe "Mezza Pensione", quale? —');
(async () => {
  const righe = L._interni.righeTariffa(/mezza\s*pensione/i);
  ok('trova entrambe le righe Mezza Pensione', righe.length === 2, righe.length);
  ok('legge il titolo della sezione di ognuna',
     righe.map(r => r.sezione).join('|') === 'Soggiorno breve|Thermal Escape',
     righe.map(r => r.sezione));

  doc.querySelectorAll('input[name="tariffa"]').forEach(r => { r.checked = false; });
  const ambiguo = await L._interni.impostaTrattamento('Mezza Pensione');
  const spuntati = () => Array.from(doc.querySelectorAll('input[name="tariffa"]')).filter(r => r.checked);
  ok('senza pacchetto NON sceglie un prezzo a caso', ambiguo === false, ambiguo);
  ok('e non lascia nessun pallino spuntato', spuntati().length === 0, spuntati().length);

  doc.querySelectorAll('input[name="tariffa"]').forEach(r => { r.checked = false; });
  const giusto = await L._interni.impostaTrattamento('Mezza Pensione', 'Soggiorno breve');
  ok('col pacchetto sceglie la riga giusta', giusto === true, giusto);
  ok('la riga spuntata e\' quella da \u20AC290, non da \u20AC330',
     /290/.test(spuntati()[0]?.closest('.riga-prezzo')?.textContent || ''),
     spuntati()[0]?.closest('.riga-prezzo')?.textContent.trim());

  doc.querySelectorAll('input[name="tariffa"]').forEach(r => { r.checked = false; });
  const bb = await L._interni.impostaTrattamento('Bed & Breakfast');
  ok('una sola riga B&B: la sceglie senza bisogno del pacchetto', bb === true, bb);

  console.log('\n— il pacchetto deve venire dalla richiesta, non dal nulla —');
  const P = L._interni.pacchettoAffidabile;
  ok('pacchetto nominato nelle note: si usa',
     P({ pacchetto: 'Soggiorno breve', note: '... Pacchetto Soggiorno breve · 2 notti' })
       === 'Soggiorno breve');
  /* il caso vero del 20 agosto 2026: pacchetto "Thermal Escape" che nella
     richiesta non c'era, e la tariffa scelta era quella da 330 invece di 290 */
  ok('pacchetto assente dal testo: NON si usa',
     P({ pacchetto: 'Thermal Escape',
         note: 'RICHIESTA DAL SITO RS-2026-0009 Periodo 04/10/2026 06/10/2026 2 adulti' })
       === null);
  ok('senza pacchetto non inventa niente', P({ note: 'qualcosa' }) === null);
  ok('confronto insensibile a maiuscole e spazi',
     P({ pacchetto: ' soggiorno BREVE ', note: 'pacchetto Soggiorno Breve' }) !== null);

  doc.querySelectorAll('input[name="tariffa"]').forEach(r => { r.checked = false; });
  const finto = await L._interni.impostaTrattamento('Mezza Pensione',
    P({ pacchetto: 'Thermal Escape', note: 'richiesta senza pacchetto' }));
  const spuntatiOra = Array.from(doc.querySelectorAll('input[name="tariffa"]')).filter(r => r.checked);
  ok('col pacchetto non confermato non spunta la tariffa da \u20AC330',
     finto === false && spuntatiOra.length === 0, spuntatiOra.length);

console.log('\n— selezione della tessera, con verifica dell\'esito —');
  const tess = doc.querySelector('[data-cat="Junior Suite Abano"]');
  const col = doc.querySelector('[data-col="Junior Suite Abano"]');
  /* come Fidra: il clic sulla COLONNA non fa niente, quello sulla tessera si' */
  col.addEventListener('click', (e) => { if (e.target === col) return; });
  tess.addEventListener('click', () => tess.classList.add('scelta'));
  const r1 = await L._interni.selezionaCategoria('junior suite abano');
  ok('dichiara true quando la tessera cambia aspetto', r1 === true, r1);
  ok('ha cliccato proprio la Junior Suite Abano', tess.classList.contains('scelta'));
  ok('la categoria scelta dopo il trattamento vince sul pallino',
     tess.classList.contains('scelta') &&
     !doc.querySelector('[data-cat="Doppia"]').classList.contains('scelta'));
  ok('il clic e\' arrivato alla tessera, non alla colonna Tailwind',
     !col.classList.contains('scelta'));

  const r2 = await L._interni.selezionaCategoria('suite monteortone');
  ok('dichiara false se il clic non cambia niente (prima diceva sempre null)',
     r2 === false, r2);

  console.log('\n— notti: la barra di Fidra come oracolo —');
  const nd = L._interni.notteDiff;
  ok('22 → 24 agosto sono 2 notti',
     nd({ g: 22, m: 8, a: 2026 }, { g: 24, m: 8, a: 2026 }) === 2);
  ok('a cavallo di fine mese: 30 ago → 2 set sono 3 notti',
     nd({ g: 30, m: 8, a: 2026 }, { g: 2, m: 9, a: 2026 }) === 3);
  ok('a cavallo di capodanno: 30 dic → 2 gen sono 3 notti',
     nd({ g: 30, m: 12, a: 2026 }, { g: 2, m: 1, a: 2027 }) === 3);
  /* la barra dice 4, il periodo e' di 2: Fidra e' rimasta indietro */
  const disallineata = L._interni.verificaNotti({ arrivo: { g: 4, m: 10, a: 2026 },
    partenza: { g: 6, m: 10, a: 2026 }, notti: 2 });
  ok('accorge che Fidra e\' rimasta su un altro periodo',
     disallineata && disallineata.tipo === 'fidra' && disallineata.quante === 4, disallineata);
  ok('e dice quante notti dovrebbero essere', disallineata && disallineata.attese === 2);

  doc.getElementById('barra').textContent = '2 Notti, 0 Camere, 0 Adulti, 0 Bambini';
  ok('quando Fidra si allinea, nessun avviso',
     L._interni.verificaNotti({ arrivo: { g: 4, m: 10, a: 2026 },
       partenza: { g: 6, m: 10, a: 2026 }, notti: 2 }) === null);
  const sbagliata = L._interni.verificaNotti({ arrivo: { g: 4, m: 10, a: 2026 },
    partenza: { g: 6, m: 10, a: 2026 }, notti: 4 });
  ok('se e\' la richiesta a sbagliare le notti, lo dice diversamente',
     sbagliata && sbagliata.tipo === 'richiesta' && sbagliata.quante === 2, sbagliata);

  console.log('\n— il pulsante Disponibilita\' si scansa —');
  const btn = doc.getElementById('leoDispBtn');
  L._interni.scansaPulsanteDisp(true);
  ok('si sposta a sinistra quando il pannello e\' aperto', btn.style.right === '332px', btn.style.right);
  L._interni.scansaPulsanteDisp(false);
  ok('torna al suo posto quando il pannello si chiude', btn.style.right === '24px', btn.style.right);

  console.log('\n— diario —');
  ok('il diario registra i passi', L.diario.length >= 3, L.diario.length);

  console.log(falliti === 0
    ? '\n\x1b[32mTutti i test passati.\x1b[0m\n'
    : `\n\x1b[31m${falliti} test falliti.\x1b[0m\n`);
  process.exit(falliti === 0 ? 0 : 1);
})();
