/* ============================================================
   Offerta Leonardo — lo storico del cliente mentre prenoti (v1.0)
   ------------------------------------------------------------
   PERCHE' ESISTE. Su /booking si sceglie il cliente dall'anagrafica e
   poi non si sa piu' niente di lui: per vedere se ha una mail, dove ha
   dormito l'ultima volta e con che trattamento bisogna uscire dalla
   schermata, cercarlo con il «Cerca» in alto a sinistra, riscrivere il
   nome, aprire la sua scheda — e poi rifare tutto da capo.

   Adesso, appena il cliente e' selezionato, compare qui a destra un
   riquadro con quello che serve: email, telefono, gli ultimi soggiorni
   con camera, notti e trattamento, e se aveva le cure.

   SOLA LETTURA. Non tocca il modulo, non seleziona niente, non salva
   niente: legge le pagine di Fidra con la sessione gia' aperta e le
   mostra. L'ultimo clic resta all'operatore, come per tutto il resto.

   COME TROVA IL CLIENTE. L'id non e' scritto da nessuna parte in
   chiaro, quindi si prova a strati: prima gli attributi del DOM attorno
   al campo, poi la ricerca di Fidra per nome. Se nessuno dei due basta,
   il riquadro lo dice e `leoStorico()` in console stampa cosa ha visto —
   che e' come si e' risolto il mistero degli shadow root di Outlook: una
   riga di diagnostica invece di quattro versioni a indovinare.
   ============================================================ */
(() => {
  if (location.hostname !== 'leonardo.fidra.cloud') return;
  if (!/\/booking/.test(location.pathname)) return;

  const ID = 'leoStoricoBox';
  const DIARIO = [];
  const nota = (passo, dati) => {
    DIARIO.push({ t: new Date().toISOString().slice(11, 19), passo, ...(dati || {}) });
    if (DIARIO.length > 40) DIARIO.shift();
  };

  const esc = (s) => String(s ?? '').replace(/[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- il nome scelto nel campo Cliente ----------
     v1.1 — DUE DIFETTI VISTI AL PRIMO USO.

     Il riquadro diceva «non trovo la scheda di 25 Aug. 2026 - 29 Aug.
     2026»: prendeva il primo input di testo con qualcosa dentro, e il
     primo e' il campo delle DATE. Adesso i valori che somigliano a una
     data si scartano, e il campo si cerca a partire dall'etichetta
     «Cliente» invece che a naso.

     E si apriva mentre l'operatore stava ancora scrivendo «Muller».
     Il segnale che la scelta e' avvenuta non e' il tempo: e' che Fidra
     ripete il nome in grande sotto il campo. Finche' quell'eco non c'e',
     si sta ancora digitando. */
  const PARE_DATA = /\d{1,2}\s*\w{0,4}\.?\s*20\d\d|\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4}/;

  /* v1.2 — risalire l'albero dall'etichetta era troppo grossolano: due
     livelli sopra «Cliente» si arriva a un contenitore che comprende
     anche il «Cerca...» della barra in alto, e quello e' vuoto — cosi'
     il riquadro non compariva piu' affatto.

     Adesso si prende il PRIMO input che viene DOPO l'etichetta
     nell'ordine del documento: e' Cliente, e Committente viene dopo. */
  function campoCliente() {
    const etichetta = [...document.querySelectorAll('label, div, span, h3, p')]
      .find(el => !el.children.length && /^cliente$/i.test((el.textContent || '').trim()));
    if (etichetta) {
      const dopo = [...document.querySelectorAll('input')].filter(i =>
        etichetta.compareDocumentPosition(i) & Node.DOCUMENT_POSITION_FOLLOWING);
      if (dopo.length) return dopo[0];
    }
    return [...document.querySelectorAll('input')]
      .find(i => /cerca\s*cliente/i.test(i.placeholder || '')) || null;
  }

  /* il valore visto al giro precedente: se non cambia, l'operatore ha
     smesso di digitare */
  let precedente = '';

  function nomeSelezionato() {
    const i = campoCliente();
    const v = ((i && i.value) || '').trim();
    const prima = precedente;
    precedente = v;
    if (v.length < 3 || PARE_DATA.test(v) || /^cerca/i.test(v)) return '';

    /* la scelta e' avvenuta se Fidra ripete il nome sotto il campo. Ma
       l'eco da sola non basta come condizione: se il tema cambia e il nome
       finisce dentro un elemento con figli, il riquadro sparisce del tutto
       — ed e' successo. Percio' vale anche un valore che sta fermo da un
       giro all'altro: chi digita cambia il campo di continuo. */
    const eco = [...document.querySelectorAll('h1, h2, h3, div, span, p')]
      .some(el => !el.children.length && el !== i && (el.textContent || '').trim() === v);
    return (eco || v === prima) ? v : '';
  }

  /* ---------- strato 1: l'id gia' scritto nel DOM ---------- */
  function idDalDom() {
    /* un link alla scheda, un attributo wire:key, un input nascosto:
       Fidra cambia, e uno di questi di solito c'e' */
    const a = document.querySelector('a[href*="/customers/"]');
    const daLink = a && (a.getAttribute('href') || '').match(/\/customers\/(\d+)/);
    if (daLink) return daLink[1];
    for (const el of document.querySelectorAll('[wire\\:key],[data-id],[data-customer-id],input[type=hidden]')) {
      const v = el.getAttribute('data-customer-id') || el.getAttribute('data-id') ||
                el.getAttribute('wire:key') || el.value || '';
      const m = String(v).match(/(?:customer|cliente)[^\d]{0,3}(\d{3,})/i);
      if (m) return m[1];
    }
    return null;
  }

  /* ---------- strato 2: la ricerca di Fidra per nome ---------- */
  async function idDallaRicerca(nome) {
    const prove = [
      '/customers?search=' + encodeURIComponent(nome),
      '/customers?q=' + encodeURIComponent(nome)
    ];
    for (const url of prove) {
      try {
        const r = await fetch(url, { credentials: 'same-origin' });
        if (!r.ok) { nota('ricerca non ok', { url, stato: r.status }); continue; }
        const testo = await r.text();
        /* si prende il primo /customers/NNN che non sia la pagina stessa */
        const trovati = [...testo.matchAll(/\/customers\/(\d+)/g)].map(m => m[1]);
        if (trovati.length) { nota('id dalla ricerca', { url, id: trovati[0] }); return trovati[0]; }
        nota('ricerca senza risultati', { url });
      } catch (e) { nota('ricerca fallita', { url, errore: String(e.message || e) }); }
    }
    return null;
  }

  /* ---------- la scheda del cliente ---------- */
  async function leggiScheda(id) {
    const r = await fetch('/customers/' + id, { credentials: 'same-origin' });
    if (!r.ok) throw new Error('scheda non leggibile (' + r.status + ')');
    const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
    const testo = (doc.body.textContent || '').replace(/\s+/g, ' ');

    const email = (testo.match(/[\w.+-]+@(?!termeleonardo|hldv)[\w.-]+\.[a-z]{2,}/i) || [])[0] || '';
    const tel = (testo.match(/\+?\d[\d\s().\/-]{7,}\d/) || [])[0] || '';
    const nome = (doc.querySelector('h1, h2') || {}).textContent?.trim() || '';

    /* i soggiorni: righe con data, camera, stato, notti. Si leggono dalle
       righe della tabella invece che dal testo, perche' i nomi delle
       colonne cambiano di lingua e l'ordine no. */
    const soggiorni = [];
    for (const tr of doc.querySelectorAll('tr')) {
      const celle = [...tr.querySelectorAll('td')].map(td => (td.textContent || '').replace(/\s+/g, ' ').trim());
      if (celle.length < 3) continue;
      const periodo = celle[0];
      if (!/\d{1,2}\s*[-–]\s*\d{1,2}\s+\w{3}\s+20\d\d|\d{1,2}\s+\w{3}\s+20\d\d/.test(periodo)) continue;
      const camera = celle.find(c => /^C\.\s*\d+|camera|zimmer/i.test(c)) || '';
      const stato = celle.find(c => /check-?out|check-?in|conferma|cancellat|opzione|offerta/i.test(c)) || '';
      const notti = (celle.find(c => /^\d{1,2}$/.test(c)) || '');
      const link = tr.querySelector('a[href*="/reservations/"]');
      const rid = link && (link.getAttribute('href') || '').match(/reservations\/(\d+)/);
      soggiorni.push({ periodo, camera, stato, notti, rid: rid ? rid[1] : null });
    }
    /* le prenotazioni cancellate non dicono niente sulle abitudini */
    const utili = soggiorni.filter(s => !/cancellat/i.test(s.stato));
    return { id, nome, email, tel, soggiorni: utili.slice(0, 6) };
  }

  /* ---------- il trattamento di un soggiorno ---------- */
  async function leggiTrattamento(id, rid) {
    try {
      const r = await fetch(`/customers/${id}/reservations/${rid}`, { credentials: 'same-origin' });
      if (!r.ok) return null;
      const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
      const testo = (doc.body.textContent || '').replace(/\s+/g, ' ');
      const t = (testo.match(/(MIGLIOR PREZZO|SOGGIORNO|DOLCE VITA|PENSIONE|SPEZIAL|GOLF)[A-Z&\s]{0,40}/i) || [])[0];
      const cure = /\bcure\b|\bfangh?[io]\b|dolce vita|spezial/i.test(testo);
      return { trattamento: t ? t.replace(/\s+/g, ' ').trim() : null, cure };
    } catch (e) { return null; }
  }

  /* ---------- il riquadro ---------- */
  function trascinabile(box, maniglia) {
    let dx = 0, dy = 0, giu = false;
    maniglia.style.cursor = 'move';
    maniglia.addEventListener('mousedown', (e) => {
      giu = true; dx = e.clientX - box.offsetLeft; dy = e.clientY - box.offsetTop;
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!giu) return;
      box.style.left = Math.max(0, e.clientX - dx) + 'px';
      box.style.top = Math.max(0, e.clientY - dy) + 'px';
      /* il riquadro nasce ancorato in basso a destra: spostandolo si passa
         a top/left, e i due ancoraggi vanno spenti o si litigano */
      box.style.right = 'auto';
      box.style.bottom = 'auto';
    });
    document.addEventListener('mouseup', () => { giu = false; });
  }

  function riquadro() {
    let box = document.getElementById(ID);
    if (box) return box;
    box = document.createElement('div');
    box.id = ID;
    /* v1.1: ancorato in BASSO a destra, non in alto.
       A 210px dall'alto finiva sopra l'elenco dei clienti che si apre
       sotto il campo di ricerca — cioe' proprio sopra la cosa che si sta
       usando per farlo comparire. Ancorandolo al fondo resta lontano dal
       campo qualunque sia la lunghezza dell'elenco, e sopra il pulsante
       «Disponibilita' e prezzi». Si sposta trascinando la testata. */
    box.style.cssText =
      'position:fixed;bottom:96px;right:24px;width:360px;max-height:52vh;overflow:auto;' +
      'z-index:2147483644;background:#fff;border:1px solid #CBD5D8;border-radius:10px;' +
      'box-shadow:0 10px 30px rgba(15,92,100,.22);' +
      'font:13px/19px Arial,Helvetica,sans-serif;color:#2A2E2B;';
    document.body.appendChild(box);
    return box;
  }

  function disegna(html, titolo) {
    const box = riquadro();
    box.innerHTML =
      `<div id="${ID}Testa" style="background:#1E7F88;color:#fff;padding:8px 12px;
        border-radius:10px 10px 0 0;font-weight:bold;display:flex;justify-content:space-between;
        align-items:center;gap:8px;">
        <span>${esc(titolo)}</span>
        <span id="${ID}X" style="cursor:pointer;font-weight:normal;opacity:.85;">&times;</span>
      </div>
      <div style="padding:10px 12px;">${html}</div>`;
    document.getElementById(ID + 'X').onclick = () => box.remove();
    trascinabile(box, document.getElementById(ID + 'Testa'));
  }

  function righeSoggiorni(s) {
    if (!s.soggiorni.length) return '<div style="color:#8C8578;">Nessun soggiorno precedente.</div>';
    return `<table style="width:100%;border-collapse:collapse;">${s.soggiorni.map(x => `
      <tr><td style="padding:5px 0;border-top:1px solid #F0EBE1;vertical-align:top;">
        <div><strong>${esc(x.periodo)}</strong>${x.notti ? ` <span style="color:#8C8578;">&middot; ${esc(x.notti)} notti</span>` : ''}</div>
        ${x.camera ? `<div style="color:#55524B;">${esc(x.camera)}</div>` : ''}
        <div class="tratt" data-rid="${x.rid || ''}" style="color:#0F5C64;">${
          x.rid ? '<span style="color:#A79E8F;">trattamento…</span>' : ''}</div>
      </td></tr>`).join('')}</table>`;
  }

  async function mostra(s) {
    const contatti = [
      s.email ? `&#9993; <a href="mailto:${esc(s.email)}" style="color:#1E7F88;">${esc(s.email)}</a>`
              : '<span style="color:#B3261E;">nessuna email in anagrafica</span>',
      s.tel ? `&#9742; ${esc(s.tel)}` : ''
    ].filter(Boolean).join('<br />');
    disegna(
      `<div style="padding-bottom:8px;">${contatti}</div>
       <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#1E7F88;
         padding:6px 0 2px;">Ultimi soggiorni</div>
       ${righeSoggiorni(s)}
       <div style="padding-top:8px;"><a href="/customers/${s.id}" target="_blank"
         style="color:#1E7F88;">Apri la scheda completa &rarr;</a></div>`,
      s.nome || 'Storico del cliente');

    /* i trattamenti arrivano dopo, uno per soggiorno: il riquadro e' gia'
       utile senza, e aspettarli tutti lo terrebbe vuoto per secondi */
    for (const el of document.querySelectorAll(`#${ID} .tratt[data-rid]`)) {
      const rid = el.dataset.rid;
      if (!rid) continue;
      const t = await leggiTrattamento(s.id, rid);
      if (!document.getElementById(ID)) return;   // chiuso nel frattempo
      el.innerHTML = t && t.trattamento
        ? esc(t.trattamento) + (t.cure ? ' <span style="color:#7A8450;">&middot; con cure</span>' : '')
        : '<span style="color:#A79E8F;">trattamento non letto</span>';
    }
  }

  /* ---------- il giro ---------- */
  let ultimoNome = '';
  let inCorso = false;

  async function guarda() {
    const nome = nomeSelezionato();
    if (!nome) {
      if (ultimoNome) { ultimoNome = ''; document.getElementById(ID)?.remove(); }
      return;
    }
    if (nome === ultimoNome || inCorso) return;
    ultimoNome = nome;
    inCorso = true;
    nota('cliente scelto', { nome });
    disegna('<span style="color:#8C8578;">Cerco la sua scheda…</span>', nome);
    try {
      let id = idDalDom();
      if (id) nota('id dal DOM', { id });
      if (!id) id = await idDallaRicerca(nome);
      if (!id) {
        disegna(`<div>Non riesco a trovare la scheda di <strong>${esc(nome)}</strong>.</div>
          <div style="color:#8C8578;padding-top:6px;">Apri la console di questa pagina e scrivi
          <code>leoStorico()</code>: dice che cosa ha visto, e con quello si sistema.</div>`, nome);
        return;
      }
      const s = await leggiScheda(id);
      nota('scheda letta', { id, soggiorni: s.soggiorni.length, email: !!s.email });
      await mostra(s);
    } catch (e) {
      nota('errore', { errore: String(e.message || e) });
      disegna(`<div style="color:#B3541E;">${esc(String(e.message || e))}</div>
        <div style="color:#8C8578;padding-top:6px;">Scrivi <code>leoStorico()</code> in console
        per sapere dove si e' fermato.</div>`, nome);
    } finally { inCorso = false; }
  }

  /* Fidra si ridisegna da sola (Livewire): si guarda a intervalli invece
     di agganciarsi a un elemento che sparisce */
  setInterval(guarda, 1200);

  (typeof self !== 'undefined' ? self : window).leoStorico = () => ({
    versione: '1.1',
    nomeLetto: nomeSelezionato(),
    campoClienteValore: ((campoCliente() || {}).value || '').trim(),
    campoClienteTrovato: !!campoCliente(),
    idDalDom: idDalDom(),
    linkClienti: document.querySelectorAll('a[href*="/customers/"]').length,
    inputTesto: [...document.querySelectorAll('input')].map(i => ({
      placeholder: i.placeholder || '', valore: (i.value || '').slice(0, 40), tipo: i.type
    })).slice(0, 12),
    diario: DIARIO
  });
})();
