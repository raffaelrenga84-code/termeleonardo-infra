/* ============================================================
   Offerta Leonardo — Numeri camera in Nuova Prenotazione (v1.6.1)
   ------------------------------------------------------------
   Gira su leonardo.fidra.cloud/booking. Al clic su una tipologia
   di camera (le schede "Doppia · 13 Disponibili" ecc.) apre un
   popup piccolo e TRASCINABILE con i numeri delle camere libere
   di quella categoria nel periodo scelto in alto.

   Non tocca il comportamento di Fidra: il clic continua a
   selezionare la tipologia come sempre; il popup è solo in più.
   SOLA LETTURA: usa /api/available/rooms, non salva nulla.
   ============================================================ */

(() => {
  const ID = 'leoNumeriCamere';
  let cache = { chiave: null, quando: 0, dati: null };   // 3 minuti
  const CACHE_MS = 3 * 60 * 1000;

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
  async function camereLibere(da, a) {
    const chiave = da + '|' + a;
    if (cache.chiave === chiave && Date.now() - cache.quando < CACHE_MS) return cache.dati;
    const r = await fetch(`/api/available/rooms?from_date=${da}&to_date=${a}&all=1`,
      { credentials: 'same-origin', headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error('Fidra ha risposto ' + r.status);
    const j = await r.json();
    const giorni = j.stay_days || [];
    const per = new Map();   // nome categoria → {libere:[], occupate:[]}
    for (const c of j.rooms || []) {
      const nome = ((c.room_category || {}).name || '—').trim();
      if (!per.has(nome)) per.set(nome, { libere: [], occupate: [] });
      const occupata = (c.unavailability || []).some(u => giorni.includes(u.date));
      per.get(nome)[occupata ? 'occupate' : 'libere'].push(c.number);
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
      const chips = v.libere.map(n => `<span class="num">${n}</span>`).join('');
      /* se i conteggi non tornano con la scheda, lo si dice invece di tacere */
      const nota = (scheda.dichiarate != null && v.libere.length !== scheda.dichiarate)
        ? `<div class="avviso">La scheda dice ${scheda.dichiarate} disponibili, l'API ne dà
           ${v.libere.length}: fa fede Fidra al momento della conferma.</div>` : '';
      corpo.innerHTML = `<div class="periodo">${periodo.testo}</div>
        <div class="numeri">${chips || '—'}</div>
        <div class="conto"><b>${v.libere.length}</b> ${v.libere.length === 1 ? 'libera' : 'libere'}</div>${nota}`;
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
