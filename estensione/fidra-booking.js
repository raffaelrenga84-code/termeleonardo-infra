/* ============================================================
   Offerta Leonardo — Bozza in Fidra dal centralino (v1.8.0)
   ------------------------------------------------------------
   Gira su leonardo.fidra.cloud/booking. Se in chrome.storage c'è
   una richiesta del centralino (salvata dal pulsante in Outlook),
   mostra un pannello laterale con i dati e compila il modulo:
   Sorgente, Adulti/Bambini, ricerca Cliente. Le date prova a
   impostarle dal calendario; se non riesce, lo dice.

   REGOLE DI SICUREZZA:
   - non salva MAI la prenotazione: l'ultimo clic è dell'operatore
   - non seleziona MAI un cliente dai risultati: sceglie l'operatore
   - dopo ogni azione rilegge la pagina e dichiara l'esito
   ============================================================ */

(() => {
  const CHIAVE = 'leonardo_bozza_centralino';
  const VALIDITA_MS = 30 * 60 * 1000;
  const MESI = ['', 'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
    'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const MESI_EN = ['', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  const attesa = (ms) => new Promise(r => setTimeout(r, ms));
  const dataIT = (d) => d ? `${d.g} ${MESI[d.m]} ${d.a}` : '—';

  /* ---------- 0. diario: cosa ha visto lo script, passo per passo ----------
     v1.2.0 — Ogni funzione scrive qui quello che ha trovato. Si legge dalla
     console (contesto "Offerta Leonardo") con  __leonardo.diario  e mostra
     dove si e' fermato senza dover indovinare. */
  const DIARIO = [];
  function nota(passo, dati) {
    DIARIO.push({ t: new Date().toISOString().slice(11, 19), passo, ...dati });
    console.log('%c[Leonardo] ' + passo, 'color:#1E7F88;font-weight:bold', dati);
  }
  /* fotografia dello stato visivo di un elemento: serve per capire se un
     clic ha davvero cambiato qualcosa, senza sapere come Fidra marca la
     selezione (classe? aria? stile inline? cambia da una versione all'altra) */
  /* v1.3.0 — l'impronta guarda TUTTO il sottoalbero, non il solo elemento.
     Fidra (Livewire + Tailwind) marca la selezione su un nodo interno alla
     tessera: guardando solo il contenitore esterno non cambiava mai niente
     e la verifica diceva sempre "non selezionata" anche quando lo era. */
  function impronta(el) {
    if (!el) return null;
    const pezzi = [];
    (function scendi(n) {
      pezzi.push(String(n.className || ''),
                 n.getAttribute('aria-selected') || '',
                 n.getAttribute('aria-checked') || '',
                 n.getAttribute('data-selected') || '');
      for (const c of n.children) scendi(c);
    })(el);
    const s = getComputedStyle(el);
    pezzi.push(s.backgroundColor, s.borderColor, s.boxShadow);
    return pezzi.join('|');
  }

  function scriviNativo(input, valore) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, valore);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function foglia(testoEsatto) {
    return Array.from(document.querySelectorAll('*')).find(e =>
      e.children.length === 0 && (e.textContent || '').trim() === testoEsatto);
  }

  /* ---------- 1. Sorgente = Telefono ---------- */
  function impostaSorgente(nome) {
    const cercato = new RegExp('^' + (nome || 'Telefono') + '$', 'i');
    for (const sel of document.querySelectorAll('select')) {
      const opt = Array.from(sel.options).find(o => cercato.test(o.text.trim()));
      if (opt) {
        sel.value = opt.value;
        sel.dispatchEvent(new Event('input', { bubbles: true }));
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        return sel.options[sel.selectedIndex]?.text.trim() === opt.text.trim();
      }
    }
    return false;
  }

  /* ---------- 2. contatori Adulti / Bambini ----------
     Sono input numerici (name="adults"/"children") fra i pulsanti +/-:
     si scrive direttamente nell'input e si verifica rileggendolo. */
  function inputContatore(nome, etichetta) {
    let el = document.querySelector(`input[name="${nome}"]`);
    if (el) return el;
    const lab = foglia(etichetta);
    if (lab) el = (lab.closest('label') || lab.parentElement)?.querySelector('input[type="number"]');
    return el || null;
  }

  async function impostaContatore(nome, etichetta, obiettivo) {
    if (obiettivo == null) return null;
    const el = inputContatore(nome, etichetta);
    if (!el) return false;
    scriviNativo(el, String(obiettivo));
    await attesa(500);
    return String(el.value) === String(obiettivo);
  }

  /* ---------- 3. ricerca Cliente (senza auto-selezione) ---------- */
  function campoCliente() {
    const inputs = Array.from(document.querySelectorAll('input'))
      .filter(i => /cerca\s*cliente/i.test(i.placeholder || ''));
    return inputs[0] || null; // il primo è Cliente, il secondo Committente
  }

  async function cercaCliente(termine) {
    const box = campoCliente();
    if (!box || !termine) return false;
    box.focus();
    scriviNativo(box, termine);
    return true;
  }

  /* ---------- 4. date via flatpickr (collaudato dal vivo) ----------
     Il campo è un flatpickr: il modo affidabile è comandare il componente
     stesso con setDate(). L'istanza vive nel contesto della pagina, quindi
     il comando viene iniettato con un tag <script>; l'esito torna in un
     attributo data- sul body. */
  const iso = (d) => `${d.a}-${String(d.m).padStart(2, '0')}-${String(d.g).padStart(2, '0')}`;

  async function impostaDate(arrivo, partenza) {
    const a = iso(arrivo), p = iso(partenza);
    /* v1.5.0 — la verifica di prima era una tautologia: confrontava il campo
       con il valore che ci aveva appena scritto dentro, e diceva sempre ✓.
       Intanto Fidra restava sul periodo precedente e calcolava disponibilita'
       e prezzi sulle date sbagliate — senza che niente lo segnalasse.
       Ora fa fede la barra "N Notti": e' l'unico posto della pagina che dice
       cosa ha capito Fidra, non cosa c'e' scritto nel campo. */
    const ris = await new Promise(res =>
      chrome.runtime.sendMessage({ tipo: 'LEONARDO_SET_DATE', a, p }, r => res(r)));
    nota('date', ris || { ok: false, motivo: 'nessuna risposta dal service worker' });
    return !!(ris && ris.ok);
  }


  /* ---------- 5. categoria camera e trattamento (v1.1.1) ----------
     La tessera viene cliccata solo se la richiesta nomina una categoria
     riconosciuta; mai le camere Accessibili. Il trattamento si imposta
     solo se il filtro arrangiamento e' una tendina verificabile. */
  const CATEGORIE_NOTE = ['matrimoniale queen', 'junior suite colli euganei',
    'junior suite abano', 'junior suite monteortone', 'suite colli euganei',
    'suite monteortone', 'singola senza balcone', 'singola parco', 'doppia', 'singola'];

  /* v1.2.0 — prima si guarda d.categoria, che outlook-inject.js riempie dal
     campo "Camera" della richiesta dal sito. Prima si leggeva solo note e
     preferenza: funzionava per caso, perche' d.note contiene tutta la mail —
     ma tagliata a 300 caratteri. Con una mail piu' lunga la categoria finisce
     oltre il taglio e sparisce senza che nessuno se ne accorga. */
  function categoriaRichiesta(d) {
    const diretto = String(d.categoria || '').toLowerCase().trim();
    if (diretto) {
      const esatta = CATEGORIE_NOTE.find(c => diretto === c) ||
                     CATEGORIE_NOTE.find(c => diretto.includes(c));
      if (esatta) return esatta;
    }
    const testo = ((d.preferenza || '') + ' ' + (d.note || '')).toLowerCase();
    return CATEGORIE_NOTE.find(c => testo.includes(c)) || null;
  }

  /* v1.3.0 — QUI STAVA IL BACO VERO.
     Il filtro trovava 2 elementi con lo stesso testo: la colonna della
     griglia (Tailwind: "w-full pb-2 text-center md:w-1/3") e, dentro, la
     tessera cliccabile. L'ordinamento per lunghezza del testo li dava pari
     e teneva il PRIMO in ordine di documento, cioe' il contenitore esterno:
     il clic non arrivava a nessun gestore e non succedeva niente.
     Ora si scarta chiunque contenga un altro candidato: resta la tessera. */
  function tessereCategoria(nome) {
    const tutti = Array.from(document.querySelectorAll('div, button, a, label')).filter(e => {
      const t = (e.innerText || '').trim();
      return t.toLowerCase().startsWith(nome) && /Disponibili/i.test(t) &&
             t.length < 80 && !/accessibile/i.test(t);
    });
    return tutti.filter(e => !tutti.some(o => o !== e && e.contains(o)));
  }

  /* i possibili bersagli del clic, dal piu' probabile in giu': Livewire
     mette il gestore su un nodo con wire:click, che puo' stare dentro o
     fuori la tessera. Si prova finche' qualcosa cambia. */
  function bersagli(tessera) {
    const lista = [];
    const dentro = tessera.querySelector('[wire\\:click], [x-on\\:click], [role="button"], button, a');
    if (dentro) lista.push(dentro);
    lista.push(tessera);
    let n = tessera.parentElement;
    for (let i = 0; i < 3 && n && n !== document.body; i++, n = n.parentElement) {
      if (n.hasAttribute('wire:click') || n.hasAttribute('x-on:click') ||
          n.tagName === 'BUTTON' || n.tagName === 'A') lista.unshift(n);
      else lista.push(n);
    }
    return [...new Set(lista)];
  }

  async function selezionaCategoria(nome) {
    if (!nome) return null;
    const tessere = tessereCategoria(nome);
    nota('categoria', {
      cercata: nome, quante: tessere.length,
      candidate: tessere.map(e => (e.innerText || '').replace(/\s+/g, ' ').trim()),
      /* il markup vero della tessera: se il clic non prende, e' questo che
         serve per capire dove sta il gestore, senza doverlo indovinare */
      markup: tessere[0] ? tessere[0].outerHTML.replace(/\s+/g, ' ').slice(0, 700) : null
    });
    const tessera = tessere[0];
    if (!tessera) return false;

    const zona = tessera.parentElement?.parentElement || tessera.parentElement || tessera;
    for (const b of bersagli(tessera)) {
      const prima = impronta(zona);
      b.click();
      await attesa(600);
      if (impronta(zona) !== prima) {
        nota('categoria/esito', { preso: true, su: b.tagName + '.' + String(b.className).slice(0, 60) });
        return true;
      }
    }
    nota('categoria/esito', { preso: false, provati: bersagli(tessera).length });
    return false;
  }

  /* ---------- trattamento: la riga giusta, non la prima ----------
     v1.7.0 — Due correzioni, tutte e due imparate sul campo.

     1) L'ORDINE. Il pallino veniva cliccato PRIMA di scegliere la camera,
        e scegliere la camera rifa' la lista prezzi: la spunta spariva.
        Il diario lo diceva senza che lo leggessi — "Mezza Pensione €580"
        mentre a schermo la riga costa €290: 580 e' il prezzo di un'altra
        lista, quella di prima. Ora il trattamento va per ultimo.

     2) QUALE riga. Con "Soggiorno breve · Mezza Pensione €290" e
        "Thermal Escape · Mezza Pensione €330" ci sono due righe che dicono
        Mezza Pensione, e prendere la prima significa scegliere un prezzo a
        caso. Si sceglie solo se il pacchetto della richiesta dice quale.
        Se non lo dice, NON si spunta niente e lo si dichiara: una tariffa
        scelta male e' peggio di una tariffa non scelta, perche' la prima
        finisce nell'offerta e la seconda te la fa scegliere a te. */
  function righeTariffa(parola) {
    const righe = [];
    for (const radio of document.querySelectorAll('input[type="radio"]')) {
      if (!radio.offsetParent) continue;
      let riga = radio.closest('label') || radio.parentElement;
      for (let i = 0; i < 4 && riga && (riga.innerText || '').trim().length < 10; i++) {
        riga = riga.parentElement;
      }
      const testo = (riga?.innerText || '').replace(/\s+/g, ' ').trim();
      if (!testo || testo.length > 120 || !parola.test(testo)) continue;
      righe.push({ radio, testo, sezione: titoloSezione(riga) });
    }
    return righe;
  }

  /* il titolo del gruppo ("Soggiorno breve", "Thermal Escape", "Miglior
     Prezzo") sta sopra la riga, come fratello precedente di un antenato */
  function titoloSezione(riga) {
    let n = riga;
    for (let i = 0; i < 5 && n; i++, n = n.parentElement) {
      let f = n.previousElementSibling;
      while (f) {
        const t = (f.innerText || '').replace(/\s+/g, ' ').trim();
        if (t && t.length < 40 && !/\u20AC|dettaglio/i.test(t)) return t;
        f = f.previousElementSibling;
      }
    }
    return null;
  }

  /* v1.8.0 — IL PACCHETTO VA VERIFICATO CONTRO LA RICHIESTA.
     Caso vero: la richiesta non nominava nessun pacchetto, ma arrivava
     `pacchetto: "Thermal Escape"`, e con due righe Mezza Pensione lo
     script ha usato quel nome per scegliere — prendendo la tariffa da
     330 invece che quella da 290. Non ha sbagliato a ragionare: ha
     ragionato su un dato che non veniva dall'ospite.
     Da qui in poi il pacchetto vale solo se il suo nome compare
     davvero nel testo della richiesta. Se non c'e', si torna al caso
     ambiguo: nessuna tariffa scelta, e la sceglie l'operatore. */
  function pacchettoAffidabile(d) {
    if (!d || !d.pacchetto) return null;
    const p = String(d.pacchetto).toLowerCase().trim();
    const fonte = [d.note, d.testoOriginale, d.preferenza, d.categoria]
      .filter(Boolean).join(' ').toLowerCase();
    const confermato = fonte.includes(p);
    nota('trattamento/pacchetto', {
      pacchetto: d.pacchetto, confermatoDallaRichiesta: confermato,
      motivo: confermato ? null : 'nome non presente nel testo della richiesta: non lo uso'
    });
    return confermato ? d.pacchetto : null;
  }

  /* la tendina "Filtro arrangiamento": restringe la lista prezzi a un
     solo trattamento. Non decide una tariffa, quindi si puo' impostare
     sempre — ed e' quello che l'operatore si aspetta di vedere. */
  async function impostaFiltroArrangiamento(parola) {
    for (const sel of document.querySelectorAll('select')) {
      const testi = Array.from(sel.options).map(o => o.text);
      if (testi.some(x => /telefono/i.test(x))) continue;        // e' la Sorgente
      if (!testi.some(x => /mezza\s*pensione/i.test(x))) continue;
      const opt = Array.from(sel.options).find(o => parola.test(o.text));
      if (!opt) continue;
      sel.value = opt.value;
      for (const t of ['input', 'change']) sel.dispatchEvent(new Event(t, { bubbles: true }));
      await attesa(700);
      const ok = parola.test(sel.options[sel.selectedIndex]?.text || '');
      nota('trattamento/filtro', { scelto: opt.text, ok });
      return ok;
    }
    nota('trattamento/filtro', { ok: false, motivo: 'tendina arrangiamento non trovata' });
    return false;
  }

  async function impostaTrattamento(nome, pacchetto) {
    if (!nome) return null;
    const cercaMP = /mezza\s*pensione/i.test(nome);
    const parola = cercaMP ? /mezza\s*pensione/i : /bed\s*(?:&|and|e)\s*breakfast|b\s*&\s*b/i;

    /* prima la tendina: filtra la lista, poi si guarda cosa resta */
    const filtro = await impostaFiltroArrangiamento(parola);

    const righe = righeTariffa(parola);
    nota('trattamento/righe', {
      filtroImpostato: filtro,
      cercato: nome, pacchetto: pacchetto || null, quante: righe.length,
      trovate: righe.map(r => ({ sezione: r.sezione, riga: r.testo }))
    });

    let scelta = null;
    if (righe.length === 1) {
      scelta = righe[0];
    } else if (righe.length > 1 && pacchetto) {
      const p = String(pacchetto).toLowerCase().trim();
      scelta = righe.find(r => (r.sezione || '').toLowerCase().includes(p)) ||
               righe.find(r => p.includes((r.sezione || '~~~').toLowerCase()));
    }

    if (!scelta) {
      nota('trattamento', {
        ok: false,
        motivo: righe.length > 1
          ? 'piu\' righe "' + nome + '": senza pacchetto non scelgo un prezzo a caso'
          : 'nessuna riga trovata per "' + nome + '"'
      });
      return false;
    }

    scelta.radio.click();
    await attesa(600);
    /* la lista puo' rifarsi da sola: si ricontrolla che la spunta sia rimasta */
    const tenuta = scelta.radio.isConnected && scelta.radio.checked === true;
    nota('trattamento', {
      ok: tenuta, via: 'pallino', sezione: scelta.sezione, riga: scelta.testo,
      motivo: tenuta ? null : 'spuntato ma la lista si e\' rifatta subito dopo'
    });
    return tenuta;
  }


  /* ---------- verifica delle date ----------
     v1.4.0 — Prima si leggevano le notti dalla barra "N Notti, N Camere,
     N Adulti". Quella barra NON segue il modulo: con 22-24 agosto (2 notti)
     e 2 adulti impostati continua a dire "4 Notti, 0 Camere, 0 Adulti".
     Usarla come verifica produceva un avviso "ricontrolla le date" sempre
     falso — e un avviso che grida ogni volta e' un avviso che non si legge
     piu' il giorno in cui ha ragione. Ora le date si verificano dal campo
     che le contiene davvero, e la barra si registra solo nel diario. */
  function barraRiepilogo() {
    const m = (document.body.innerText || '').match(/(\d+)\s*Nott[ei],?\s*(\d+)\s*Camere,?\s*(\d+)\s*Adulti/i);
    return m ? { notti: +m[1], camere: +m[2], adulti: +m[3], testo: m[0] } : null;
  }

  const notteDiff = (a, p) =>
    Math.round((Date.UTC(p.a, p.m - 1, p.g) - Date.UTC(a.a, a.m - 1, a.g)) / 86400000);

  /* v1.5.0 — la barra NON e' inaffidabile: e' lo stato di Fidra. Quando
     diceva "4 Notti" su un periodo di 2 aveva ragione lei, ed era il solo
     avviso che il modulo stava lavorando sulle date sbagliate. */
  function verificaNotti(d) {
    const campo = document.querySelector('input.flatpickr-input');
    const attese = notteDiff(d.arrivo, d.partenza);
    const barra = barraRiepilogo();
    nota('date/verifica', {
      campo: campo ? campo.value : null,
      nottiDaDate: attese,
      nottiDichiarate: d.notti ?? null,
      nottiSecondoFidra: barra ? barra.notti : null,
      fidraAllineata: barra ? barra.notti === attese : null
    });
    if (barra && barra.notti !== attese) return { tipo: 'fidra', quante: barra.notti, attese };
    if (d.notti != null && attese !== d.notti) return { tipo: 'richiesta', quante: attese, dichiarate: d.notti };
    return null;
  }

  /* ---------- convivenza col pulsante "Disponibilita' e prezzi" ----------
     v1.4.0 — Quel pulsante (fidra-disponibilita.js) sta a bottom:76px
     right:24px, cioe' esattamente sopra il pannello, e ne copre le righe
     Sorgente e Note. Invece di spostarlo per sempre, lo si scansa finche'
     il pannello e' aperto e lo si rimette dov'era quando si chiude:
     chi lo cerca con l'occhio lo ritrova al suo posto. */
  const DISP_CASA = '24px';
  function scansaPulsanteDisp(attivo) {
    const b = document.getElementById('leoDispBtn');
    if (!b) return;
    b.style.right = attivo ? '332px' : DISP_CASA;   // 300 pannello + 16 + 16
    b.style.transition = 'right .18s ease';
  }

  /* ---------- pannello ---------- */
  function riga(et, val, esito) {
    const icona = esito === true ? ' <span style="color:#2E7D32;">✓</span>'
      : esito === false ? ' <span style="color:#C62828;">✗ a mano</span>' : '';
    return `<div style="padding:4px 0;border-bottom:1px solid #EDE7DC;">
      <span style="color:#7B756A;font-size:11px;">${et}</span><br>
      <strong style="color:#2A2E2B;">${val ?? '—'}</strong>${icona}</div>`;
  }

  function mostraPannello(d, esiti) {
    const vecchio = document.getElementById('leonardo-bozza-pannello');
    if (vecchio) vecchio.remove();
    const p = document.createElement('div');
    p.id = 'leonardo-bozza-pannello';
    p.style.cssText =
      'position:fixed;bottom:16px;right:16px;width:300px;max-height:76vh;overflow:auto;' +
      'z-index:2147483000;background:#FFFFFF;border:1px solid #D8D2C4;border-radius:10px;' +
      'box-shadow:0 6px 24px rgba(0,0,0,.18);padding:0 16px 14px;' +
      'font:13px/18px Arial,Helvetica,sans-serif;';
    p.innerHTML = `
      <div id="leonardo-bozza-testa" style="display:flex;align-items:center;justify-content:space-between;
        cursor:move;user-select:none;margin:0 -16px 8px;padding:10px 12px 8px 16px;
        background:#F4F1EA;border-radius:10px 10px 0 0;border-bottom:1px solid #E4DECF;">
        <span style="font:600 12px/16px Arial;letter-spacing:1px;color:#1E7F88;">
          ${d.fonte === 'Email' ? 'RICHIESTA EMAIL' : 'CENTRALINO'} · ${d.tipo === 'prenotazione' ? 'PRENOTAZIONE' : 'PREVENTIVO'}</span>
        <button id="leonardo-bozza-riduci" title="Riduci" style="border:0;background:none;cursor:pointer;
          font:700 15px Arial;color:#7B756A;padding:0 4px;">&#8211;</button>
      </div>
      <div id="leonardo-bozza-corpo">
      ${riga('Ospite', d.ospite, null)}
      ${riga('Telefono', d.telefono, null)}
      ${riga('Email', d.email, null)}
      ${riga('Arrivo → Partenza', dataIT(d.arrivo) + ' → ' + dataIT(d.partenza) + (d.notti ? ` (${d.notti} notti)` : ''), esiti.date)}
      <!-- v2.8.13 — il segno accanto ad «Adulti» adesso e' quello del
           CONTROLLO FINALE, non quello della scrittura: scrivere 2 e
           riuscirci non vuol dire che alla fine ci sia ancora 2. -->
      ${riga('Adulti', d.adulti,
        esiti.controlloFinale ? esiti.controlloFinale.adultiTornano : esiti.adulti)}
      ${riga('Bambini', (d.bambini ?? 0) + (d.etaBambini ? ' — età ' + d.etaBambini : ''), esiti.bambini)}
      ${riga('Trattamento', d.trattamento, esiti.trattamento)}
      ${categoriaRichiesta(d) ? riga('Camera richiesta', categoriaRichiesta(d), esiti.categoria) : ''}
      ${riga('Sorgente', d.fonte || 'Telefono', esiti.sorgente)}
      ${d.preferenza ? riga('Preferenza', d.preferenza, null) : ''}
      ${d.note ? riga('Note', d.note, null) : ''}
      <!-- IL NUMERO DI PERSONE NON TORNA. Prima finiva solo nel diario,
           che nessuno apre: la bozza partiva con tre persone al posto di
           due e se ne accorgeva l'ospite in fattura. -->
      ${esiti.controlloFinale && esiti.controlloFinale.adultiTornano === false
        ? `<div style="margin-top:6px;padding:6px 8px;background:#FDF0EE;border-left:3px solid #C0392B;font-size:12px;color:#7A2E24;"><strong>In Fidra ci sono ${esiti.controlloFinale.adulti} adulti, non ${esiti.controlloFinale.adultiAttesi}.</strong> Scegliere la camera rimette l'occupazione a quella di casa: correggila a mano prima di salvare.</div>`
        : ''}
      ${esiti.avvisoNotti ? `<div style="margin-top:6px;padding:6px 8px;background:#FFF6DE;border-left:3px solid #B3541E;font-size:12px;color:#7A5A1E;">${esiti.avvisoNotti.tipo === 'fidra'
            ? `<strong>Fidra sta ancora lavorando su ${esiti.avvisoNotti.quante} notti</strong>, non su ${esiti.avvisoNotti.attese}: disponibilit&agrave; e prezzi qui sotto sono del periodo sbagliato. Riscegli le date dal calendario prima di guardare le camere.`
            : `Fra le due date ci sono ${esiti.avvisoNotti.quante} notti, ma la richiesta ne dice ${esiti.avvisoNotti.dichiarate}: ricontrolla prima di salvare.`}</div>` : ''}
      ${d.testoOriginale ? `<div style="margin-top:8px;">
        <div style="color:#7B756A;font-size:10px;letter-spacing:1px;padding-bottom:3px;">TESTO DELLA MAIL</div>
        <div style="max-height:110px;overflow:auto;background:#F7F5F0;border:1px solid #E7E1D4;border-radius:6px;
          padding:8px 10px;font-size:12px;line-height:17px;color:#55524B;white-space:pre-wrap;">${
          String(d.testoOriginale).replace(/&/g,'&amp;').replace(/</g,'&lt;')}</div></div>` : ''}
      <div style="padding:8px 0 2px;color:#7B756A;font-size:11px;" id="leonardo-bozza-stato">
        Cliente: cercato "${[d.cognome, d.nome].filter(Boolean).join(' ')}" — <strong>scegli tu</strong> il profilo giusto
        dai risultati, o usa Crea se non esiste. Nulla viene salvato da solo.</div>
      <button id="leonardo-bozza-riprova" style="margin-top:8px;width:100%;padding:8px;border:0;
        border-radius:6px;background:#1E7F88;color:#fff;font:600 13px Arial;cursor:pointer;">
        Ricompila il modulo</button>
      <button id="leonardo-bozza-chiudi" style="margin-top:6px;width:100%;padding:6px;border:1px solid #D8D2C4;
        border-radius:6px;background:#fff;color:#7B756A;font:12px Arial;cursor:pointer;">
        Chiudi e dimentica la richiesta</button>
      </div>`;
    document.body.appendChild(p);
    scansaPulsanteDisp(true);

    // --- trascinamento dalla testata ---
    const testa = document.getElementById('leonardo-bozza-testa');
    let trascino = null;
    testa.addEventListener('mousedown', (e) => {
      if (e.target.id === 'leonardo-bozza-riduci') return;
      const r = p.getBoundingClientRect();
      trascino = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      p.style.bottom = 'auto'; p.style.right = 'auto';
      p.style.left = r.left + 'px'; p.style.top = r.top + 'px';
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!trascino) return;
      p.style.left = Math.max(0, Math.min(window.innerWidth - 80, e.clientX - trascino.dx)) + 'px';
      p.style.top = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - trascino.dy)) + 'px';
    });
    document.addEventListener('mouseup', () => { trascino = null; });

    // --- riduci a linguetta ---
    document.getElementById('leonardo-bozza-riduci').addEventListener('click', () => {
      const corpo = document.getElementById('leonardo-bozza-corpo');
      const ridotto = corpo.style.display === 'none';
      corpo.style.display = ridotto ? '' : 'none';
      document.getElementById('leonardo-bozza-riduci').textContent = ridotto ? '\u2013' : '+';
      /* ridotto a linguetta il pannello e' basso: il pulsante puo' tornare a casa */
      scansaPulsanteDisp(ridotto);
    });
    document.getElementById('leonardo-bozza-chiudi').addEventListener('click', () => {
      chrome.storage.local.remove(CHIAVE);
      scansaPulsanteDisp(false);
      p.remove();
    });
    document.getElementById('leonardo-bozza-riprova').addEventListener('click', () => compila(d));
  }

  /* ---------- regia ---------- */
  async function compila(d) {
    const esiti = {};
    esiti.sorgente = impostaSorgente(d.fonte);
    await attesa(300);
    await attesa(300);
    try { esiti.date = await impostaDate(d.arrivo, d.partenza); }
    catch (e) { esiti.date = false; }
    if (esiti.date) {
      await attesa(800);
      esiti.avvisoNotti = verificaNotti(d);
    }
    const cat = categoriaRichiesta(d);
    /* v1.5.0 — la griglia delle categorie dipende dalle date: se Fidra e'
       rimasta sul periodo vecchio, le tessere sono di un altro periodo e
       sceglierne una e' peggio che non sceglierne nessuna. In quel caso non
       si tocca niente e lo si dice, invece di cliccare al buio. */
    if (esiti.date === false && cat) {
      esiti.categoria = false;
      nota('categoria/saltata', { motivo: 'date non registrate da Fidra', cercata: cat });
    } else {
      esiti.categoria = await selezionaCategoria(cat);
    }
    if (esiti.categoria === true) {
      const t0 = tessereCategoria(cat)[0];
      const zona0 = t0?.parentElement?.parentElement || t0;
      const foto = impronta(zona0);
      await attesa(900);
      esiti.categoriaTenuta = impronta(zona0) === foto;
      nota('categoria/tenuta', { tenuta: esiti.categoriaTenuta });
    }

    /* v2.8.13 — LE PERSONE DOPO LA CAMERA, e per la stessa ragione del
       trattamento qui sotto: cliccare la tessera della categoria rimette
       l'occupazione a quella di casa per quella camera. La Junior Suite
       Abano e' «la sistemazione per tre persone», e il 2 scritto un
       secondo prima spariva — con il pannello che intanto diceva ✓,
       perche' la scrittura era riuscita davvero. */
    await attesa(300);
    esiti.adulti = await impostaContatore('adults', 'Adulti', d.adulti);
    esiti.bambini = d.bambini > 0 ? await impostaContatore('children', 'Bambini', d.bambini) : null;

    /* v1.7.0 — il trattamento PER ULTIMO. Scegliere la camera rifa' la
       lista prezzi, quindi ogni spunta messa prima viene cancellata. */
    await attesa(600);
    esiti.trattamento = await impostaTrattamento(d.trattamento, pacchettoAffidabile(d));

    /* controllo finale: la lista prezzi si rifa' da sola piu' volte, e
       quello che era giusto a meta' strada puo' non esserlo alla fine */
    await attesa(700);
    esiti.controlloFinale = {
      notti: barraRiepilogo()?.notti ?? null,
      nottiAttese: notteDiff(d.arrivo, d.partenza),
      adulti: document.querySelector('input[name="adults"]')?.value ?? null,
      adultiAttesi: d.adulti ?? null,
      categoria: cat ? (tessereCategoria(cat).length > 0) : null,
      /* IL CONFRONTO, fatto qui e non lasciato a chi legge il diario:
         null vuol dire «non c'era un numero da rispettare» */
      adultiTornano: d.adulti == null ? null
        : String(document.querySelector('input[name="adults"]')?.value ?? '') === String(d.adulti),
    };
    nota('controllo-finale', esiti.controlloFinale);

    // "Cognome Nome" filtra molto meglio del solo cognome (collaudato sull'API)
    await cercaCliente([d.cognome, d.nome].filter(Boolean).join(' ') || d.email || '');
    nota('fine', { esiti });
    mostraPannello(d, esiti);
  }

  /* ---------- aggancio per la console (contesto "Offerta Leonardo") ----------
     __leonardo.diario        cosa ha visto e fatto ogni passo
     __leonardo.tessere('junior suite abano')   le tessere che riconosce ORA
     __leonardo.categoria(d)  quale categoria ricava dalla richiesta */
    self.__leonardo = {
    diario: DIARIO,
    tessere: (n) => tessereCategoria(n).map(e => (e.innerText || '').replace(/\s+/g, ' ').trim()),
    categoria: categoriaRichiesta,
    impronta,
    _interni: { selezionaCategoria, impostaTrattamento, tessereCategoria, categoriaRichiesta,
                righeTariffa, titoloSezione, pacchettoAffidabile,
                notteDiff, verificaNotti, barraRiepilogo, scansaPulsanteDisp }
  };

  chrome.storage.local.get(CHIAVE, async (ris) => {
    const d = ris && ris[CHIAVE];
    if (!d || !d.arrivo) return;
    if (Date.now() - (d.creato || 0) > VALIDITA_MS) {
      chrome.storage.local.remove(CHIAVE);
      return;
    }
    await attesa(2000); // lascio montare il modulo
    compila(d);
  });
})();
