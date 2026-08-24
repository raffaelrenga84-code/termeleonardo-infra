/* ============================================================
   Offerta Leonardo — Numeri camera in Nuova Prenotazione (v1.3)
   ------------------------------------------------------------
   Gira su leonardo.fidra.cloud/booking. Al clic su una tipologia
   di camera (le schede "Doppia · 13 Disponibili" ecc.) apre un
   popup piccolo e TRASCINABILE con i numeri delle camere libere
   di quella categoria nel periodo scelto in alto.

   Non tocca il comportamento di Fidra: il clic continua a
   selezionare la tipologia come sempre; il popup è solo in più.

   NON È PIÙ SOLA LETTURA, e va detto. Fino alla v1.2 leggeva e
   basta. Dalla v1.3 il clic su un numero, se si è sul tableau,
   clicca la casella del giorno d'arrivo su quella riga: è il gesto
   che l'operatore farebbe a mano, fatto al posto suo. UN clic solo,
   su una casella che si vede — niente che non si possa disfare
   guardando la griglia. Non salva niente: «Crea» resta all'operatore.
   ============================================================ */

(() => {
  const ID = 'leoNumeriCamere';
  let cache = { chiave: null, quando: 0, dati: null };   // 3 minuti
  const CACHE_MS = 3 * 60 * 1000;

  const VESTE = {
    pieno:   { bordo: '#4A7A2E', testo: '#3B6325', sfondo: '#EEF6E8',
               nota: 'si incastra perfettamente: all’arrivo parte qualcuno e alla partenza ne arriva un altro' },
    mezzo:   { bordo: '#C9A227', testo: '#8A6D12', sfondo: '#FDF8E6',
               nota: 'attacca da un lato solo' },
    isolato: { bordo: '#D08A3C', testo: '#9A5B18', sfondo: '#FDF1E6',
               nota: 'non attacca con nessuna prenotazione: lascia notti vuote prima e dopo' }
  };

  /* ---------- date dal campo in alto ---------- */
  const MESI = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8,
                 sep:9, oct:10, nov:11, dec:12,
                 gen:1, mag:5, giu:6, lug:7, ago:8, set:9, ott:10, dic:12 };
  const NOMI_IT = ['', 'gennaio','febbraio','marzo','aprile','maggio','giugno',
                   'luglio','agosto','settembre','ottobre','novembre','dicembre'];

  function iso(g, m, a) {
    return `${a}-${String(m).padStart(2, '0')}-${String(g).padStart(2, '0')}`;
  }

  /* "13 Aug. 2026 - 17 Aug. 2026" (o mesi italiani) → {da, a} in ISO */
  function periodoScelto() {
    const re = /(\d{1,2})\s+([A-Za-z]{3})\.?\s+(\d{4})\s*[-–]\s*(\d{1,2})\s+([A-Za-z]{3})\.?\s+(\d{4})/;
    // prima gli input (il campo data è un input readonly), poi il testo pagina
    for (const inp of document.querySelectorAll('input')) {
      const m = (inp.value || '').match(re);
      if (m) return daMatch(m);
    }
    const m = (document.body.innerText || '').match(re);
    return m ? daMatch(m) : null;
    function daMatch(m) {
      const m1 = MESI[m[2].toLowerCase()], m2 = MESI[m[5].toLowerCase()];
      if (!m1 || !m2) return null;
      return { da: iso(+m[1], m1, +m[3]), a: iso(+m[4], m2, +m[6]),
               testo: `${+m[1]} ${NOMI_IT[m1]} – ${+m[4]} ${NOMI_IT[m2]} ${m[6]}` };
    }
  }

  /* ---------- dati ---------- */
  const piuUnGiorno = (iso, quanti) => {
    const d = new Date(iso + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + quanti);
    return d.toISOString().slice(0, 10);
  };

  /* ============================================================
     v1.2 — COME SI INCASTRA UNA CAMERA (la stessa regola del pannello
     «Disponibilità e prezzi», portata qui perche' e' qui che si sceglie).

     Una camera libera non vale l'altra. Se il giorno dell'arrivo qualcuno
     parte da quella stanza, e il giorno della partenza ne arriva un altro,
     il soggiorno si infila fra due prenotazioni senza lasciare notti
     vuote: e' la camera che rende di piu'.

     · verde     parte qualcuno all'arrivo E ne arriva uno alla partenza
     · giallo    attacca da un lato solo
     · arancione non attacca con niente: apre un buco

     PERCHE' SERVE UN GIORNO IN PIU' PER LATO. Le due notti da guardare
     stanno FUORI dal periodo richiesto: chiedendo solo il periodo non si
     vedono, e ogni camera sembrerebbe isolata. Ma allora stay_days
     comprende anche i due giorni aggiunti, e usarlo per decidere chi e'
     libero direbbe occupata una camera che invece si puo' vendere:
     percio' le notti vere si contano a parte.
     ============================================================ */
  function incastro(camera, nottePrima, nottePartenza) {
    const occupate = new Set((camera.unavailability || []).map(u => u.date));
    const inArrivo = occupate.has(nottePrima);       // parte qualcuno
    const inPartenza = occupate.has(nottePartenza);  // arriva qualcuno
    if (inArrivo && inPartenza) return 'pieno';
    if (inArrivo || inPartenza) return 'mezzo';
    return 'isolato';
  }

  async function camereLibere(da, a) {
    const chiave = da + '|' + a;
    if (cache.chiave === chiave && Date.now() - cache.quando < CACHE_MS) return cache.dati;
    const r = await fetch(
      `/api/available/rooms?from_date=${piuUnGiorno(da, -1)}&to_date=${piuUnGiorno(a, 1)}&all=1`,
      { credentials: 'same-origin', headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error('Fidra ha risposto ' + r.status);
    const j = await r.json();
    /* le notti VERE del soggiorno, non stay_days: quello ora e' allargato */
    const giorni = [];
    for (let g = da; g < a; g = piuUnGiorno(g, 1)) giorni.push(g);
    const nottePrima = piuUnGiorno(da, -1), nottePartenza = a;
    const per = new Map();   // nome categoria → {libere:[], occupate:[], incastri:{}}
    for (const c of j.rooms || []) {
      const nome = ((c.room_category || {}).name || '—').trim();
      if (!per.has(nome)) per.set(nome, { libere: [], occupate: [], incastri: {} });
      const v = per.get(nome);
      const occupata = (c.unavailability || []).some(u => giorni.includes(u.date));
      v[occupata ? 'occupate' : 'libere'].push(c.number);
      if (!occupata) v.incastri[String(c.number)] = incastro(c, nottePrima, nottePartenza);
    }
    for (const v of per.values()) {
      v.libere.sort((x, y) => x - y);
      v.occupate.sort((x, y) => x - y);
    }
    cache = { chiave, quando: Date.now(), dati: per };
    return per;
  }

  /* nome sulla scheda → categoria dell'API (esatto, poi inclusione) */
  function trovaCategoria(per, nome) {
    const n = nome.trim().toLowerCase();
    for (const k of per.keys()) if (k.toLowerCase() === n) return k;
    for (const k of per.keys()) {
      const kk = k.toLowerCase();
      if (kk.includes(n) || n.includes(kk)) return k;
    }
    return null;
  }

  /* ---------- riconoscere il clic sulla scheda tipologia ---------- */
  function schedaCliccata(bersaglio) {
    let el = bersaglio;
    for (let i = 0; i < 7 && el && el !== document.body; i++, el = el.parentElement) {
      const t = (el.innerText || '').trim();
      if (t.length > 80) break;   // troppo grande: non è la scheda
      const m = t.match(/^(.+?)\s*\n?\s*(\d+)\s+Disponibili$/i);
      /* v1.8.6: cliccando sul solo contatore il testo è "19 Disponibili", e
         la lettura ingenua ne ricavava la categoria "1" con 9 disponibili
         (da cui «Categoria "1" non trovata»). Un nome di categoria contiene
         lettere: senza, si continua a salire verso il contenitore. */
      if (m && /\p{L}/u.test(m[1])) {
        return { nome: m[1].replace(/\s+/g, ' ').trim(), dichiarate: +m[2] };
      }
    }
    return null;
  }

  /* ---------- popup ---------- */
  function stile() {
    if (document.getElementById(ID + 'Css')) return;
    const s = document.createElement('style');
    s.id = ID + 'Css';
    s.textContent = `
#${ID}{position:fixed;z-index:2147483646;width:280px;max-height:60vh;overflow:auto;
  background:#fff;border:1px solid #CBD5D8;border-radius:10px;
  box-shadow:0 10px 30px rgba(15,92,100,.22);font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#2A2E2B;}
#${ID} .testata{cursor:move;background:#0F5C64;color:#fff;padding:8px 12px;border-radius:10px 10px 0 0;
  display:flex;justify-content:space-between;align-items:center;user-select:none;}
#${ID} .testata b{font-size:13px;font-weight:bold;}
#${ID} .chiudi{cursor:pointer;background:none;border:none;color:#fff;font-size:16px;line-height:1;padding:0 2px;}
#${ID} .corpo{padding:10px 12px;}
#${ID} .periodo{color:#7B756A;font-size:12px;margin-bottom:8px;}
#${ID} .numeri{display:flex;flex-wrap:wrap;gap:5px;}
#${ID} .num{background:#E3F0F1;color:#0F5C64;border:1px solid #BFDDE0;border-radius:6px;
  padding:3px 8px;font-weight:bold;font-size:13px;}
#${ID} .num.occ{background:#F4F1E9;color:#A79E8F;border-color:#E9E2D5;font-weight:normal;text-decoration:line-through;}
#${ID} .conto{margin-top:8px;color:#55524B;font-size:12px;}
#${ID} .avviso{color:#922B21;font-size:12px;margin-top:6px;}
#${ID} .caricamento{color:#7B756A;padding:4px 0;}`;
    document.head.appendChild(s);
  }

  function apriPopup(x, y) {
    let box = document.getElementById(ID);
    if (box) return box;
    stile();
    box = document.createElement('div');
    box.id = ID;
    // vicino al clic, ma dentro lo schermo
    box.style.left = Math.min(Math.max(8, x + 14), window.innerWidth - 300) + 'px';
    box.style.top  = Math.min(Math.max(8, y - 10), window.innerHeight - 220) + 'px';
    box.innerHTML = `
      <div class="testata"><b>Camere</b><button class="chiudi" title="Chiudi">×</button></div>
      <div class="corpo"></div>`;
    document.body.appendChild(box);
    box.querySelector('.chiudi').addEventListener('click', () => box.remove());
    // trascinamento dalla barra del titolo (stesso schema del pannello Disponibilità)
    const maniglia = box.querySelector('.testata');
    let giu = false, sx = 0, sy = 0, ox = 0, oy = 0;
    maniglia.addEventListener('mousedown', ev => {
      if (ev.target.closest('button')) return;
      giu = true; sx = ev.clientX; sy = ev.clientY;
      const r = box.getBoundingClientRect(); ox = r.left; oy = r.top;
      ev.preventDefault();
    });
    window.addEventListener('mousemove', ev => {
      if (!giu) return;
      box.style.left = Math.max(-200, ox + ev.clientX - sx) + 'px';
      box.style.top  = Math.max(0, oy + ev.clientY - sy) + 'px';
    });
    window.addEventListener('mouseup', () => { giu = false; });
    return box;
  }

  /* ============================================================
     v1.1 — ASSEGNARE LA CAMERA DA QUI
     ------------------------------------------------------------
     Su /booking la prenotazione non esiste ancora: si sceglie la
     categoria, e il numero di solito si assegna dopo, sulla pratica.
     Se pero' Fidra un campo per il numero ce l'ha, tanto vale usarlo.

     Percio' non si indovina: si cerca un campo che accetti quel
     numero — una tendina che lo contenga fra le opzioni, o un campo
     che parli di camera — e lo si scrive. Se non c'e', il numero
     finisce negli appunti e il riquadro lo dice chiaro, invece di
     fingere di aver fatto qualcosa.

     `leoCamere()` in console elenca i campi visti: se un campo c'e'
     e non l'ho riconosciuto, da li' si chiude in un colpo.
     ============================================================ */
  function campiCandidati() {
    /* i campi del nostro riquadro non sono candidati: scriveremmo dentro
       noi stessi invece che dentro Fidra */
    const dentro = (el) => el.closest && el.closest('#' + ID);
    const fuori = [];
    for (const el of document.querySelectorAll('select, input')) {
      if (dentro(el)) continue;
      const et = ((el.getAttribute('placeholder') || '') + ' ' +
                  (el.getAttribute('name') || '') + ' ' +
                  (el.getAttribute('aria-label') || '')).toLowerCase();
      fuori.push({ el, etichetta: et, tipo: el.tagName.toLowerCase() });
    }
    return fuori;
  }

  function scriviNativo(el, valore) {
    const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype
                                          : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, valore); else el.value = valore;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /* ============================================================
     v1.3 — LA CAMERA SI ASSEGNA NEL TABLEAU, e adesso lo sappiamo.

     Per due versioni ho cercato un campo «numero camera» in una pagina
     che non ce l'ha, e il riquadro rispondeva — correttamente ma
     inutilmente — che qui la prenotazione non esiste ancora. La
     schermata giusta e' /booking/availability: la griglia con una RIGA
     per ogni camera e una COLONNA per ogni giorno. Assegnare vuol dire
     cliccare la casella del giorno d'arrivo nella riga di quella camera:
     e' il gesto che l'operatore fa a mano, cercando la riga a occhio fra
     un centinaio.

     PERCHE' SI RIESCE A TROVARE QUELLA CASELLA. In una riga libera Fidra
     scrive dentro ogni casella il numero del giorno — 22, 23, 24, 25 —
     e a sinistra il numero della camera. Non serve indovinare nomi di
     classi: si cerca la riga che comincia col numero della camera, e
     dentro la casella che porta il giorno d'arrivo.

     SI CLICCA UNA CASELLA SOLA. Il periodo Fidra ce l'ha gia' in cima
     («4 Notti»), e allargare la selezione a mano vorrebbe dire indovinare
     come funziona il trascinamento. Una casella e' un gesto che
     l'operatore vede e puo' disfare; una manciata di caselle cliccate
     alla cieca no.

     E SE LA RIGA NON C'E' — perche' si e' ancora su /booking e non sul
     tableau — non si finge: il riquadro lo dice e porta la riga sotto gli
     occhi appena ci si arriva.
     ============================================================ */
  function foglie(radice) {
    return [...radice.querySelectorAll('*')].filter(el => !el.children.length);
  }

  /* la riga della griglia che appartiene alla camera n */
  function rigaCamera(n) {
    for (const el of document.querySelectorAll('td, th, div, span')) {
      if (el.children.length) continue;
      if ((el.textContent || '').trim() !== n) continue;
      if (el.closest('#' + ID)) continue;          // e' il nostro pulsante
      /* si sale finche' non si trova qualcosa che somiglia a una riga di
         calendario: tante celle, e quasi tutte con dentro un giorno */
      let su = el.parentElement;
      for (let i = 0; i < 4 && su && su !== document.body; i++, su = su.parentElement) {
        const giorni = foglie(su).filter(f => /^\d{1,2}$/.test((f.textContent || '').trim()));
        if (giorni.length >= 5) return { riga: su, celle: giorni };
      }
    }
    return null;
  }

  function clicVero(el) {
    for (const tipo of ['mousedown', 'mouseup', 'click']) {
      el.dispatchEvent(new MouseEvent(tipo, { bubbles: true, cancelable: true, view: window }));
    }
  }

  /* assegna dal tableau: la casella del giorno d'arrivo, nella riga della
     camera. Restituisce anche il caso «riga trovata ma casella no», che
     e' diverso da «non c'e' niente» e va detto in modo diverso. */
  function assegnaDalTableau(numero, giornoArrivo) {
    const n = String(numero);
    const r = rigaCamera(n);
    if (!r) return { ok: false, perche: 'nessuna riga' };
    r.riga.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const g = String(giornoArrivo);
    /* la casella dell'arrivo: quella che porta il giorno, e che non sia
       il numero della camera stessa (219 e' di tre cifre, i giorni no,
       ma una camera «25» esisterebbe eccome) */
    const cella = r.celle.find(c => (c.textContent || '').trim() === g && c !== r.riga.firstElementChild);
    if (!cella) return { ok: false, perche: 'riga senza il giorno', riga: r.riga };
    clicVero(cella);
    return { ok: true, dove: `casella del ${g} nella riga ${n}` };
  }

  function assegna(numero) {
    const n = String(numero);
    /* 1. una tendina che ha proprio quel numero fra le opzioni: e' il
          segnale piu' forte che esista, e non richiede di indovinare */
    for (const c of campiCandidati()) {
      if (c.tipo !== 'select') continue;
      const opz = [...c.el.options].find(o =>
        (o.textContent || '').trim() === n || String(o.value).trim() === n);
      if (opz) { scriviNativo(c.el, opz.value); return { ok: true, dove: 'tendina' }; }
    }
    /* 2. un campo che parla di camera e non e' quello del cliente */
    for (const c of campiCandidati()) {
      if (c.tipo !== 'input') continue;
      if (!/camera|room|zimmer|numero/.test(c.etichetta)) continue;
      if (/cliente|cerca cliente/.test(c.etichetta)) continue;
      scriviNativo(c.el, n);
      return { ok: true, dove: 'campo «' + (c.etichetta.trim() || 'camera') + '»' };
    }
    return { ok: false };
  }

  function agganciaNumeri(corpo, periodo) {
    const esito = corpo.querySelector('.esitoNum');
    const giornoArrivo = periodo ? +periodo.da.slice(8, 10) : null;
    corpo.querySelectorAll('button.num').forEach(b => {
      b.addEventListener('click', async (ev) => {
        /* il clic non deve scivolare sotto: sulla scheda della categoria
           aprirebbe il tableau, che e' proprio quello che si voleva evitare */
        ev.preventDefault();
        ev.stopPropagation();
        const n = b.dataset.num;

        /* PRIMA IL TABLEAU: e' li' che la camera si assegna davvero */
        const t = giornoArrivo ? assegnaDalTableau(n, giornoArrivo) : { ok: false, perche: 'niente date' };
        if (t.ok) {
          esito.style.color = '#3B6325';
          esito.textContent = `Ho cliccato la ${t.dove}. Controlla nel tableau prima di creare.`;
          return;
        }
        /* poi un campo, se questa pagina ne ha uno */
        const r = assegna(n);
        if (r.ok) {
          esito.style.color = '#3B6325';
          esito.textContent = `Camera ${n} scritta nella ${r.dove}. Controlla prima di salvare.`;
          return;
        }
        try { await navigator.clipboard.writeText(n); } catch (e) { /* resta il numero a schermo */ }
        /* v1.3 — SI DICE DOVE SI ASSEGNA, non solo che qui non si puo'.
           «Qui non c'e' un campo» era vero e inutile: chi legge resta con
           il problema in mano. La camera si assegna nel tableau, e allora
           il riquadro dice di andarci — e se la riga c'e' ma manca la
           casella del giorno, dice anche quello, che e' un'altra cosa. */
        esito.style.color = '#8A6D12';
        if (t.perche === 'riga senza il giorno') {
          try { t.riga.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* niente */ }
          esito.textContent = `Ho trovato la riga della ${n} e te l'ho portata sotto gli occhi, `
            + `ma la casella del ${giornoArrivo} non la riconosco: cliccala tu. `
            + `Il numero è negli appunti.`;
          return;
        }
        esito.innerHTML =
          `<div>La camera ${n} è negli appunti. Il numero si assegna nel tableau:
            apri <strong>&lt; Camere</strong> qui sotto e clicca la casella del giorno d'arrivo
            sulla riga della ${n} &mdash; da li' il clic sul numero la seleziona da solo.</div>
           <details style="margin-top:4px;"><summary style="cursor:pointer;color:#0F5C64;">campi che vedo
             in questa pagina</summary>
             <pre style="white-space:pre-wrap;font-size:11px;color:#55524B;margin:4px 0 0;"></pre></details>`;
        esito.querySelector('pre').textContent = campiCandidati()
          .filter(c => c.tipo === 'select' || c.etichetta.trim())
          .slice(0, 14)
          .map(c => `${c.tipo === 'select' ? '▾' : '·'} ${c.etichetta.trim() || '(senza nome)'}`
                    + (c.tipo === 'select'
                        ? ` [${[...c.el.options].slice(0, 4).map(o => (o.textContent || '').trim()).join(', ')}]`
                        : ''))
          .join('\n') || '(nessun campo)';
      });
    });
  }

  (typeof self !== 'undefined' ? self : window).leoCamere = () => ({
    versione: '1.3',
    campi: campiCandidati().map(c => ({
      tipo: c.tipo, etichetta: c.etichetta.trim(),
      valore: String(c.el.value || '').slice(0, 30),
      opzioni: c.tipo === 'select' ? [...c.el.options].slice(0, 12)
        .map(o => (o.textContent || '').trim()) : undefined
    })).slice(0, 25)
  });

  async function mostra(scheda, x, y) {
    const box = apriPopup(x, y);
    box.querySelector('.testata b').textContent = scheda.nome;
    const corpo = box.querySelector('.corpo');
    const periodo = periodoScelto();
    if (!periodo) {
      corpo.innerHTML = `<div class="avviso">Non leggo il periodo dal campo date in alto:
        scegli le date e riclicca sulla tipologia.</div>`;
      return;
    }
    corpo.innerHTML = `<div class="periodo">${periodo.testo}</div>
      <div class="caricamento">Chiedo a Fidra…</div>`;
    try {
      const per = await camereLibere(periodo.da, periodo.a);
      const k = trovaCategoria(per, scheda.nome);
      if (!k) {
        corpo.innerHTML = `<div class="periodo">${periodo.testo}</div>
          <div class="avviso">Categoria "${scheda.nome}" non trovata nella risposta di Fidra.</div>`;
        return;
      }
      const v = per.get(k);
      /* v1.1: i numeri erano etichette, e il clic passava sotto finendo
         sul tableau. Adesso sono pulsanti che provano ad assegnare la
         camera qui, senza aprire la pratica. */
      /* v1.2: il colore dice come si incastra con chi c'e' gia', come nel
         pannello «Disponibilità e prezzi». Qui serve anche di piu': e' il
         momento in cui la camera si sceglie. */
      const conteggio = { pieno: 0, mezzo: 0, isolato: 0 };
      const chips = v.libere.map(n => {
        const tipo = (v.incastri || {})[String(n)] || 'isolato';
        conteggio[tipo]++;
        const ve = VESTE[tipo];
        return `<button type="button" class="num" data-num="${n}"
          style="cursor:pointer;border:1px solid ${ve.bordo};color:${ve.testo};background:${ve.sfondo};"
          title="${ve.nota}">${n}</button>`;
      }).join('');
      const legenda = (conteggio.pieno || conteggio.mezzo)
        ? `<div class="conto"><span style="color:#3B6325;">&#9632;</span> ${conteggio.pieno} si incastrano
             &middot; <span style="color:#8A6D12;">&#9632;</span> ${conteggio.mezzo} da un lato
             &middot; <span style="color:#9A5B18;">&#9632;</span> ${conteggio.isolato} lasciano buchi</div>`
        : '';
      /* se i conteggi non tornano con la scheda, lo si dice invece di tacere */
      const nota = (scheda.dichiarate != null && v.libere.length !== scheda.dichiarate)
        ? `<div class="avviso">La scheda dice ${scheda.dichiarate} disponibili, l'API ne dà
           ${v.libere.length}: fa fede Fidra al momento della conferma.</div>` : '';
      corpo.innerHTML = `<div class="periodo">${periodo.testo}</div>
        <div class="numeri">${chips || '—'}</div>
        <div class="conto"><b>${v.libere.length}</b> ${v.libere.length === 1 ? 'libera' : 'libere'}</div>
        ${legenda}${nota}
        <div class="esitoNum" style="padding-top:6px;font-size:12px;"></div>`;
      agganciaNumeri(corpo, periodo);
    } catch (e) {
      corpo.innerHTML = `<div class="periodo">${periodo.testo}</div>
        <div class="avviso">Non riesco a leggere le camere: ${String(e.message || e)}</div>`;
    }
  }

  /* ascolto passivo: il clic continua a selezionare la tipologia in Fidra */
  document.addEventListener('click', ev => {
    const scheda = schedaCliccata(ev.target);
    if (scheda) mostra(scheda, ev.clientX, ev.clientY);
  }, true);
})();
