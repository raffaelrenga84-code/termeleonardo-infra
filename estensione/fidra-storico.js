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

  /* v1.5 — LA VERSIONE SI VEDE, e non e' un vezzo.
     Il 24 agosto 2026 abbiamo inseguito per due giri un difetto gia'
     corretto: il riquadro sullo schermo era di due versioni prima e non
     c'era modo di accorgersene. Con il numero in testata la domanda
     «l'hai ricaricata?» si risponde da sola. */
  const versione = () => {
    try { return 'v' + chrome.runtime.getManifest().version; } catch (e) { return ''; }
  };

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
  /* v1.3 — il campo subito dopo l'etichetta «Cliente» NON e' quello del
     nome: Fidra ci mette prima un campo nascosto con l'id, e il riquadro
     e' arrivato a dire «non trovo la scheda di 7324» — che era l'id
     giusto, letto al posto del nome.

     Ottima notizia in realta': l'id sta li', pronto. Ora i due campi si
     distinguono per quello che contengono, non per l'ordine. */
  function campiDopoCliente() {
    const etichetta = [...document.querySelectorAll('label, div, span, h3, p')]
      .find(el => !el.children.length && /^cliente$/i.test((el.textContent || '').trim()));
    if (!etichetta) return [];
    return [...document.querySelectorAll('input')].filter(i =>
      etichetta.compareDocumentPosition(i) & Node.DOCUMENT_POSITION_FOLLOWING);
  }

  function campoCliente() {
    /* il nome: visibile, e non un numero secco */
    const dopo = campiDopoCliente().filter(i =>
      i.type !== 'hidden' && !/^\d+$/.test((i.value || '').trim()));
    if (dopo.length) return dopo[0];
    return [...document.querySelectorAll('input')]
      .find(i => /cerca\s*cliente/i.test(i.placeholder || '')) || null;
  }

  /* l'id: un campo, anche nascosto, con dentro solo cifre */
  function idDalCampo() {
    const n = campiDopoCliente()
      .map(i => (i.value || '').trim())
      .find(v => /^\d{2,8}$/.test(v));
    return n || null;
  }

  /* ============================================================
     v1.6 — QUANDO SI PUO' DIRE CHE UN CLIENTE E' STATO SCELTO
     ------------------------------------------------------------
     IL DIFETTO, VISTO DAL VIVO. Con «renga» appena digitato nel campo e
     la tendina ancora aperta, il riquadro mostrava «+ Schurr Antonie»:
     un cliente che nessuno aveva scelto, senza email e senza soggiorni.

     Due cause, tutt'e due nostre.

     1. «FERMO DA UN GIRO ALL'ALTRO» NON VUOL DIRE SCELTO. Chi digita si
        ferma: basta una pausa di un secondo e mezzo davanti alla tendina
        e «renga» passava per un nome scelto. Era il ripiego messo quando
        l'eco del nome non si trovava, e ha fatto piu' danno del problema
        che risolveva.

     2. POI SI CARICAVA IL CLIENTE SBAGLIATO. Senza id, si prendeva il
        primo link /customers/NNN che c'era in pagina — un link qualunque,
        di un cliente qualunque. Da li' «+ Schurr Antonie».

     LA REGOLA ADESSO E' UNA SOLA, e non si presta a interpretazioni:
     Fidra scrive l'id del cliente in un campo SOLO quando lo si sceglie
     dalla tendina. Nessun id, nessun riquadro. Digitare non basta,
     fermarsi non basta, somigliare a un nome non basta.

     Che quel campo ci sia lo sappiamo per prova: quando il riquadro
     diceva «non trovo la scheda di 7324», 7324 era proprio l'id giusto
     di Konold Otto — letto da li'.
     ============================================================ */
  function sceltaCorrente() {
    const id = idDalCampo();
    if (!id) return null;                 // non si e' ancora scelto nessuno
    const i = campoCliente();
    let v = ((i && i.value) || '').trim();
    if (v.length < 3 || PARE_DATA.test(v) || /^cerca/i.test(v) ||
        /^[0-9]+$/.test(v) || !/^\p{L}/u.test(v)) v = '';
    return { id, nome: v };
  }

  function nomeSelezionato() {
    const s = sceltaCorrente();
    return s ? s.nome : '';
  }

  /* ---------- strato 1: l'id gia' scritto nel DOM ---------- */
  function idDalDom() {
    /* v1.3: prima il campo accanto all'etichetta — e' quello che Fidra
       riempie scegliendo il cliente, ed e' il piu' affidabile dei tre */
    const dalCampo = idDalCampo();
    if (dalCampo) return dalCampo;
    /* v1.6 — IL PRIMO LINK /customers/ NON E' PIU' UN RIPIEGO. Era «un
       cliente qualunque presente in pagina», e infatti ha caricato la
       scheda di uno che nessuno aveva cercato. Meglio nessuna scheda che
       la scheda di un altro: chi legge non ha modo di accorgersene. */
    for (const el of document.querySelectorAll('[wire\\:key],[data-id],[data-customer-id],input[type=hidden]')) {
      const v = el.getAttribute('data-customer-id') || el.getAttribute('data-id') ||
                el.getAttribute('wire:key') || el.value || '';
      const m = String(v).match(/(?:customer|cliente)[^\d]{0,3}(\d{3,})/i);
      if (m) return m[1];
    }
    return null;
  }

  /* ---------- la scheda del cliente ---------- */
  async function leggiScheda(id) {
    const r = await fetch('/customers/' + id, { credentials: 'same-origin' });
    if (!r.ok) throw new Error('scheda non leggibile (' + r.status + ')');
    const grezzo = await r.text();
    const doc = new DOMParser().parseFromString(grezzo, 'text/html');
    const testo = (doc.body.textContent || '').replace(/\s+/g, ' ');

    /* v1.4 — L'EMAIL NON STA NEL TESTO. Il riquadro diceva «nessuna email
       in anagrafica» su un profilo che ce l'ha: nella scheda l'indirizzo
       vive dentro il campo del modulo «Modifica profilo cliente», e
       textContent non legge il valore dei campi — legge solo il testo.

       Si guarda in tre posti, dal piu' attendibile al meno: il link
       mailto, i campi del modulo, e infine il testo. */
    const RE_MAIL = /[\w.+-]+@(?!termeleonardo|hldv|fidra|sentry|example|sentry\.io)[\w.-]+\.[a-z]{2,}/i;
    const daMailto = doc.querySelector('a[href^="mailto:"]');
    const daCampo = [...doc.querySelectorAll('input')]
      .map(i => (i.getAttribute('value') || '').trim())
      .find(v => RE_MAIL.test(v));
    /* v1.6 — L'EMAIL NON E' NEMMENO NEI CAMPI. Il riquadro continuava a
       dire «nessuna email in anagrafica» su un profilo che ce l'ha,
       perche' quel campo sta dentro «Modifica profilo cliente», un modale
       che Fidra disegna solo quando lo apri: nell'HTML della pagina il
       campo non esiste ancora. Lo stato del componente pero' si', gia'
       serializzato negli attributi (wire:snapshot). Percio' l'ultimo
       tentativo guarda l'HTML COME ARRIVA, attributi compresi, invece del
       solo testo — che degli attributi non sa niente. */
    const daGrezzo = ((grezzo || '').match(new RegExp(RE_MAIL.source, 'gi')) || [])
      .find(v => RE_MAIL.test(v));
    const email =
      (daMailto && (daMailto.getAttribute('href') || '').replace(/^mailto:/i, '').trim()) ||
      daCampo || (testo.match(RE_MAIL) || [])[0] || daGrezzo || '';

    const RE_TEL = /\+?\d[\d\s().\/-]{7,}\d/;
    const telCampo = [...doc.querySelectorAll('input')]
      .map(i => (i.getAttribute('value') || '').trim())
      .find(v => RE_TEL.test(v) && !RE_MAIL.test(v) && !/^\d{1,2}[\/.]\d{1,2}/.test(v));
    const tel = telCampo || (testo.match(RE_TEL) || [])[0] || '';
    const nome = (doc.querySelector('h1, h2') || {}).textContent?.trim() || '';

    /* i soggiorni: righe con data, camera, stato, notti. Si leggono dalle
       righe della tabella invece che dal testo, perche' i nomi delle
       colonne cambiano di lingua e l'ordine no. */
    const soggiorni = [];
    for (const tr of doc.querySelectorAll('tr')) {
      const celle = [...tr.querySelectorAll('td')].map(td => (td.textContent || '').replace(/\s+/g, ' ').trim());
      if (celle.length < 3) continue;
      const periodo = celle[0];
      /* v1.3: l'anno spesso non c'e'. Nella scheda di Konold Otto il
         soggiorno piu' recente e' scritto «03 - 10 Oct», senza anno,
         perche' e' dell'anno in corso: pretenderlo scartava proprio le
         righe piu' utili, cioe' le ultime. */
      if (!/\d{1,2}\s*[-–]\s*\d{1,2}\s+\w{3}|\d{1,2}\s+\w{3}\s+20\d\d/.test(periodo)) continue;
      const camera = celle.find(c => /^C\.\s*\d+|camera|zimmer/i.test(c)) || '';
      const stato = celle.find(c => /check-?out|check-?in|conferma|cancellat|opzione|offerta/i.test(c)) || '';
      const notti = (celle.find(c => /^\d{1,2}$/.test(c)) || '');
      /* v1.4 — il numero della pratica non e' per forza dentro un href:
         «Apri >» puo' essere un'azione Livewire, e cercando solo <a href>
         non si trovava niente — percio' il trattamento restava vuoto.
         Si guarda tutta la riga: href, wire:click, data-*, qualunque cosa. */
      /* v1.6 — E NON SI CHIAMA «reservations». Aprendo un soggiorno dalla
         scheda si finisce su /customers/7324/stays/32795/charges: la riga
         porta a «stays», non a «reservations», e cercando solo la seconda
         parola non si trovava mai niente — percio' ogni riga diceva
         «trattamento non raggiungibile». Si accettano entrambe, e la
         pagina da leggere dipende da quale delle due c'e'. */
      const q = (tr.outerHTML || '').match(/\/(stays|reservations)[\/\\"']{1,3}(\d+)/);
      soggiorni.push({ periodo, camera, stato, notti,
                       rid: q ? q[2] : null, via: q ? q[1] : null });
    }
    /* le prenotazioni cancellate non dicono niente sulle abitudini */
    const utili = soggiorni.filter(s => !/cancellat/i.test(s.stato));
    return { id, nome, email, tel, soggiorni: utili.slice(0, 6) };
  }

  /* ---------- il trattamento di un soggiorno ---------- */
  async function leggiTrattamento(id, rid, via) {
    /* v1.6: la pagina del soggiorno e' /customers/7324/stays/32795/charges,
       ed e' li' che sta scritto «MIGLIOR PREZZO MEZZA PENSIONE», sotto il
       titolo della camera. Se la riga porta a «reservations» si legge
       quella, ma il caso vero e' il primo. */
    const dove = via === 'reservations'
      ? `/customers/${id}/reservations/${rid}`
      : `/customers/${id}/stays/${rid}/charges`;
    try {
      const r = await fetch(dove, { credentials: 'same-origin' });
      if (!r.ok) { nota('soggiorno non letto', { dove, stato: r.status }); return null; }
      const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
      const testo = (doc.body.textContent || '').replace(/\s+/g, ' ');
      /* v1.4: il trattamento si cerca fra gli elementi scritti TUTTI IN
         MAIUSCOLO, che e' come Fidra lo stampa nella scheda. Prima si
         cercava nel testo intero con /i, e una parola come «pensione»
         dentro una frase qualunque bastava a far partire il taglio. */
      const PAROLE = /MIGLIOR PREZZO|SOGGIORNO|DOLCE VITA|PENSIONE|SPEZIAL|GOLF|BED\s*&\s*BREAKFAST|HALBPENSION/;
      let t = [...doc.querySelectorAll('div, span, p, td, a')]
        .map(el => (el.textContent || '').replace(/\s+/g, ' ').trim())
        .find(x => x.length > 4 && x.length < 70 && x === x.toUpperCase() && PAROLE.test(x));
      /* v1.6: nella pagina del soggiorno il trattamento sta in mezzo ad
         altro — «< Prenotazione MIGLIOR PREZZO MEZZA PENSIONE» — e cosi'
         l'elemento intero non e' tutto maiuscolo. Allora si cerca il tratto
         maiuscolo DENTRO al testo, invece dell'elemento tutto maiuscolo. */
      if (!t) {
        t = (testo.match(/[A-ZÀ-Ü][A-ZÀ-Ü0-9 &'.\-]{4,60}/g) || [])
          .map(x => x.replace(/\s+/g, ' ').trim())
          .find(x => PAROLE.test(x));
      }
      /* la sigla che serve a colpo d'occhio: BB, HB o FB */
      const sigla = !t ? null
        : /MEZZA\s*PENSIONE|HALBPENSION|HALF\s*BOARD/.test(t) ? 'HB'
        : /PENSIONE\s*COMPLETA|VOLLPENSION|FULL\s*BOARD/.test(t) ? 'FB'
        : /BED\s*&\s*BREAKFAST|B\s*&\s*B|COLAZIONE/.test(t) ? 'BB'
        : null;
      /* v1.6 — «cure» DA SOLA NON VALE PIU'. Nella pagina del soggiorno
         c'e' una linguetta che si chiama proprio «Cure», sempre, anche per
         chi non ne ha fatte: bastava quella per scrivere «con cure» sotto
         ogni riga. Meglio non dirlo che dirlo sbagliato, quindi servono
         parole che compaiono solo se le cure ci sono davvero. */
      const cure = /fangh[io]|bagno termale|cure termali|inalazion|percorso vascolare|dolce vita|spezial/i.test(testo);
      return { trattamento: t || null, sigla, cure };
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
      'position:fixed;bottom:150px;right:24px;width:360px;max-height:52vh;overflow:auto;' +
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
        <span style="font-weight:normal;opacity:.6;font-size:11px;">${esc(versione())}</span>
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
        <div class="tratt" data-rid="${x.rid || ''}" data-via="${x.via || ''}" style="color:#0F5C64;">${
          x.rid ? '<span style="color:#A79E8F;">trattamento…</span>'
                : '<span style="color:#C0AFA0;">trattamento non raggiungibile</span>'}</div>
      </td></tr>`).join('')}</table>`;
  }

  async function mostra(s) {
    const contatti = [
      s.email ? `&#9993; <a href="mailto:${esc(s.email)}" style="color:#1E7F88;">${esc(s.email)}</a>`
              : '<span style="color:#B3261E;">nessuna email in anagrafica</span>',
      s.tel ? `&#9742; ${esc(s.tel)}` : ''
    ].filter(Boolean).join('<br />');
    /* v1.5: il link alla scheda sta IN CIMA. In fondo bisognava scorrere
       tutti i soggiorni per trovarlo, e quando serve — «voglio vedere il
       resto» — si vuole subito, non dopo aver letto tutto. */
    disegna(
      `<div style="padding-bottom:8px;"><a href="/customers/${s.id}" target="_blank"
         style="color:#1E7F88;">Apri la scheda completa &rarr;</a></div>
       <div style="padding-bottom:8px;">${contatti}</div>
       <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#1E7F88;
         padding:6px 0 2px;">Ultimi soggiorni</div>
       ${righeSoggiorni(s)}`,
      s.nome || 'Storico del cliente');

    /* i trattamenti arrivano dopo, uno per soggiorno: il riquadro e' gia'
       utile senza, e aspettarli tutti lo terrebbe vuoto per secondi */
    for (const el of document.querySelectorAll(`#${ID} .tratt[data-rid]`)) {
      const rid = el.dataset.rid;
      if (!rid) continue;
      const t = await leggiTrattamento(s.id, rid, el.dataset.via);
      if (!document.getElementById(ID)) return;   // chiuso nel frattempo
      el.innerHTML = t && t.trattamento
        ? (t.sigla ? `<strong style="color:#0F5C64;">${t.sigla}</strong> &middot; ` : '') +
          `<span style="color:#55524B;">${esc(t.trattamento.toLowerCase())}</span>` +
          (t.cure ? ' <span style="color:#7A8450;">&middot; con cure</span>' : '')
        : '<span style="color:#A79E8F;">trattamento non letto</span>';
    }
  }

  /* ---------- il giro ---------- */
  let ultimoId = '';
  let inCorso = false;

  async function guarda() {
    const scelta = sceltaCorrente();
    /* v1.6: finche' Fidra non ha scritto l'id, nessuno ha scelto nessuno
       — e il riquadro non deve esserci. Sparisce anche quando si svuota
       il campo per cercare un altro cliente: lasciarlo li' con il nome
       di prima e' come mostrare la scheda sbagliata. */
    if (!scelta) {
      if (ultimoId) { ultimoId = ''; document.getElementById(ID)?.remove(); }
      return;
    }
    const nome = scelta.nome;
    if (scelta.id === ultimoId || inCorso) return;
    ultimoId = scelta.id;
    inCorso = true;
    nota('cliente scelto', { nome, id: scelta.id });
    disegna('<span style="color:#8C8578;">Cerco la sua scheda…</span>', nome || 'Storico del cliente');
    try {
      const s = await leggiScheda(scelta.id);
      nota('scheda letta', { id: scelta.id, soggiorni: s.soggiorni.length, email: !!s.email });
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
