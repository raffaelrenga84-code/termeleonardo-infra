/* ============================================================
   Offerta Leonardo — il modulo dei tassisti si compila da solo (v2.3)
   ------------------------------------------------------------
   Gira su atam.biz/prenotazioni. Se l'indirizzo porta un frammento
   #leo=… — scritto dal back office quando si apre una richiesta di
   transfer — compila il modulo e mostra un pannello con l'esito
   campo per campo.

   PERCHE' UN CONTENT SCRIPT E NON UN LINK. Il modulo e' un POST
   Django con CSRF, e la sua vista NON legge la query: provato dal
   vivo su ?pax=3&note_cliente=Prova, i campi restano vuoti. Un link
   precompilato non esiste; questa e' l'unica strada.

   PERCHE' IL FRAMMENTO E NON chrome.storage. Il back office e' una
   pagina web, non l'estensione: non puo' scrivere in chrome.storage.
   Il frammento (tutto cio' che sta dopo il #) non viene mai mandato
   al server — e' lo stesso meccanismo del segnalibro «Documenti
   Leonardo». Letto una volta, viene tolto dall'indirizzo.

   REGOLE DI SICUREZZA, le stesse di fidra-booking.js:
   - non preme MAI Prenota: l'ultimo clic e' dell'operatore
   - non sceglie MAI cio' che la richiesta non dice (il pagamento):
     resta come lo trova
   - dopo aver compilato rilegge il modulo e dichiara l'esito
   ============================================================ */

(() => {
  const attesa = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (id) => document.getElementById(id);

  /* ---------- i dati dal frammento ---------- */
  function datiDalFrammento() {
    const m = (location.hash || '').match(/[#&]leo=([^&]+)/);
    if (!m) return null;
    try {
      const d = JSON.parse(decodeURIComponent(m[1]));
      /* tolto subito dall'indirizzo: non deve restare nella cronologia
         ne' ricomparire se l'operatore ricarica dopo aver compilato */
      history.replaceState(null, '', location.pathname + location.search);
      return d && typeof d === 'object' ? d : null;
    } catch (e) { return null; }
  }

  /* ---------- scrittura nei campi ----------
     I campi sono gestiti da un framework: assegnare .value non basta.
     Setter nativo piu' gli eventi, come farebbe una digitazione vera. */
  function scrivi(el, valore) {
    if (!el) return false;
    const proto = Object.getPrototypeOf(el);
    const setter = Object.getOwnPropertyDescriptor(proto, 'value');
    if (setter && setter.set) setter.set.call(el, valore); else el.value = valore;
    for (const t of ['input', 'change', 'blur']) el.dispatchEvent(new Event(t, { bubbles: true }));
    return String(el.value) === String(valore);
  }

  /* ---------- i due campi che vivono in jQuery ----------
     La data e' un bootstrap-datepicker, il luogo una tendina Chosen:
     tutti e due vivono nel mondo della pagina, dove un content script
     non arriva. Il comando parte dal service worker con world:'MAIN',
     esattamente come LEONARDO_SET_DATE fa per il flatpickr di Fidra. */
  function chiediAlMondoPagina(messaggio) {
    return new Promise((res) => {
      try { chrome.runtime.sendMessage(messaggio, (r) => res(r || { ok: false })); }
      catch (e) { res({ ok: false, motivo: String(e) }); }
    });
  }

  /* ---------- compilazione ---------- */
  async function compila(d) {
    const esiti = {};

    /* LA DATA. Il datepicker e' inizializzato senza `format`: scrivere
       la data a mano dipenderebbe da quale formato usa (col
       language:"it" rende dd/mm/yyyy, ma non e' dichiarato da nessuna
       parte). Con setDate e una data vera il formato non conta: la
       compone lui. */
    if (d.data) {
      const r = await chiediAlMondoPagina({ tipo: 'ATAM_SET_DATE', data: d.data });
      esiti.data = !!(r && r.ok);
      esiti.dataValore = (r && r.value) || '';
    }

    if (d.ora) esiti.ora = scrivi($('id_data_corsa_1'), d.ora);
    if (d.pax != null && d.pax !== '') esiti.pax = scrivi($('id_pax'), String(d.pax));

    /* arrivo o partenza: i valori del modulo sono le stringhe True e False */
    if (d.verso) {
      const cercato = d.verso === 'partenza' ? 'False' : 'True';
      const r = [...document.querySelectorAll('input[name="is_arrivo"]')]
        .find((x) => x.value === cercato);
      if (r) { r.click(); esiti.verso = r.checked; } else esiti.verso = false;
    }

    /* INDIVIDUALE O COLLETTIVO. Fino al 18 agosto 2026 questi due pallini
       restavano in bianco, e il commento diceva «la richiesta non lo dice,
       sceglierlo sarebbe indovinare». Adesso la richiesta lo dice: il modulo
       del sito chiede se serve l'auto privata o la navetta condivisa, e
       `datiATAM()` porta sempre un booleano vero — mai `undefined`.

       Stesso meccanismo di is_arrivo: i valori sono le stringhe True e
       False, e True vuol dire collettivo. */
    if (d.collettivo !== undefined) {
      const cercato = d.collettivo ? 'True' : 'False';
      const r = [...document.querySelectorAll('input[name="is_collettivo"]')]
        .find((x) => x.value === cercato);
      if (r) { r.click(); esiti.collettivo = r.checked; } else esiti.collettivo = false;
    }

    /* IL LUOGO. Si cerca per testo, ma il confronto ESATTO non basta:
       `option.text` comprime i doppi spazi, e mezzo elenco dei tassisti
       ne ha uno dentro — «Venezia  aeroporto», «Terme  Euganee FS».
       Sul confronto esatto quelle voci non combaciano nemmeno con se
       stesse. E' il confronto normalizzato a fare il lavoro; l'esatto
       resta come primo tentativo perche' e' piu' stretto quando serve.
       Verificato dal vivo sul modulo vero. */
    if (d.luogo) {
      const sel = $('id_luogo');
      const piatto = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const opt = sel && ([...sel.options].find((o) => o.text === d.luogo)
        || [...sel.options].find((o) => piatto(o.text) === piatto(d.luogo)));
      if (opt) {
        const r = await chiediAlMondoPagina({ tipo: 'ATAM_SET_LUOGO', valore: opt.value });
        esiti.luogo = !!(r && r.ok) && sel.value === opt.value;
        esiti.luogoTesto = opt.text;
      } else {
        esiti.luogo = false;
        esiti.luogoTesto = d.luogo;   // per dirlo nel pannello: non e' in elenco
      }
    }

    if (d.nome) esiti.nome = scrivi($('id_note_cliente'), d.nome);
    if (d.camera) esiti.camera = scrivi($('id_note_camera'), d.camera);
    if (d.volo) esiti.volo = scrivi($('id_note_arrivo'), d.volo);
    if (d.note) esiti.note = scrivi($('id_note'), d.note);

    /* Cosa NON si tocca, di proposito:
       · pagamento — resta come lo trova (il loro predefinito e' Diretto,
         che e' anche il nostro caso normale: «pagamento diretto all'autista»)
       · Prenota — l'ultimo clic e' dell'operatore

       is_collettivo NON e' piu' in questo elenco: dal 18 agosto 2026 il
       modulo del sito chiede se serve l'auto privata o la navetta
       condivisa, e la richiesta lo dice. */
    return esiti;
  }

  /* ---------- pannello ---------- */
  function riga(etichetta, valore, esito) {
    const segno = esito === true ? ' <span style="color:#2E7D32;">✓</span>'
      : esito === false ? ' <span style="color:#C62828;">✗ a mano</span>' : '';
    return `<div style="padding:4px 0;border-bottom:1px solid #EDE7DC;">
      <span style="color:#7B756A;font-size:11px;">${etichetta}</span><br>
      <strong style="color:#2A2E2B;">${valore || '—'}</strong>${segno}</div>`;
  }

  const esc = (s) => String(s ?? '').replace(/[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function mostraPannello(d, esiti) {
    document.getElementById('leo-atam-pannello')?.remove();
    const mancano = Object.entries(esiti).filter(([k, v]) => v === false && !/Valore|Testo/.test(k));
    const p = document.createElement('div');
    p.id = 'leo-atam-pannello';
    p.style.cssText =
      'position:fixed;bottom:16px;right:16px;width:300px;max-height:76vh;overflow:auto;' +
      'z-index:2147483000;background:#FFFFFF;border:1px solid #D8D2C4;border-radius:10px;' +
      'box-shadow:0 6px 24px rgba(0,0,0,.18);padding:0 16px 14px;' +
      'font:13px/18px Arial,Helvetica,sans-serif;';
    p.innerHTML = `
      <div id="leo-atam-testa" style="display:flex;align-items:center;justify-content:space-between;
        cursor:move;user-select:none;margin:0 -16px 8px;padding:10px 12px 8px 16px;
        background:#F4F1EA;border-radius:10px 10px 0 0;border-bottom:1px solid #E4DECF;">
        <span style="font:600 12px/16px Arial;letter-spacing:1px;color:#1E7F88;">TRANSFER · DA LEONARDO</span>
        <button id="leo-atam-chiudi" title="Chiudi" style="border:0;background:none;cursor:pointer;
          font:700 15px Arial;color:#7B756A;padding:0 4px;">&times;</button>
      </div>
      ${riga('Data', esc(esiti.dataValore || d.data), esiti.data)}
      ${riga('Ora', esc(d.ora), esiti.ora)}
      ${riga('Pax', esc(d.pax), esiti.pax)}
      ${riga('Servizio', d.collettivo ? 'Navetta condivisa' : 'Auto privata', esiti.collettivo)}
      ${riga(d.verso === 'partenza' ? 'Partenza per' : 'Arrivo da', esc(esiti.luogoTesto || d.luogo), esiti.luogo)}
      ${riga('Nome del cliente', esc(d.nome), esiti.nome)}
      ${d.camera ? riga('Numero di camera', esc(d.camera), esiti.camera) : ''}
      ${d.volo ? riga('Dettagli arrivo', esc(d.volo), esiti.volo) : ''}
      ${d.note ? riga('Note', esc(d.note), esiti.note) : ''}
      ${esiti.luogo === false ? `<div style="margin-top:8px;padding:7px 9px;background:#FDF0EE;
        border-left:3px solid #C62828;font-size:12px;color:#7A2E24;">Il luogo
        «${esc(esiti.luogoTesto || d.luogo)}» non è nell'elenco dei tassisti: scegli tu la voce
        giusta dalla tendina.</div>` : ''}
      <div style="margin-top:9px;padding:7px 9px;background:#F4F1EA;font-size:12px;color:#55524B;">
        <strong>Il pagamento</strong> non lo tocco: la richiesta non lo dice.<br />
        <strong>Prenota lo premi tu</strong>, dopo aver riletto.
      </div>
      ${mancano.length ? `<div style="margin-top:8px;font-size:12px;color:#7A2E24;">
        ${mancano.length} ${mancano.length === 1 ? 'campo' : 'campi'} da mettere a mano.</div>` : ''}`;
    document.body.appendChild(p);

    document.getElementById('leo-atam-chiudi').addEventListener('click', () => p.remove());

    /* trascinamento dalla testata, come il pannello del centralino */
    const testa = document.getElementById('leo-atam-testa');
    let trascino = null;
    testa.addEventListener('mousedown', (e) => {
      if (e.target.id === 'leo-atam-chiudi') return;
      const r = p.getBoundingClientRect();
      trascino = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      p.style.bottom = 'auto'; p.style.right = 'auto';
      p.style.left = r.left + 'px'; p.style.top = r.top + 'px';
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!trascino) return;
      p.style.left = Math.max(0, Math.min(innerWidth - 80, e.clientX - trascino.dx)) + 'px';
      p.style.top = Math.max(0, Math.min(innerHeight - 40, e.clientY - trascino.dy)) + 'px';
    });
    document.addEventListener('mouseup', () => { trascino = null; });
  }

  /* ---------- avvio ---------- */
  (async () => {
    const d = datiDalFrammento();
    if (!d) return;                 // pagina aperta a mano: non si tocca niente
    await attesa(1200);             // lascio montare datepicker e Chosen
    const esiti = await compila(d);
    mostraPannello(d, esiti);
  })();
})();
