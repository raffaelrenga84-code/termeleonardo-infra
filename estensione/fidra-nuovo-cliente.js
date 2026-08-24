/* ============================================================
   Offerta Leonardo — il cliente nuovo si compila da sé (v1.0)
   ------------------------------------------------------------
   PERCHE' ESISTE. «Quando il cliente non c'è bisogna crearlo, ma Fidra
   non ti ripropone il nome: anche se ho usato il pulsante di Outlook per
   caricare in Fidra, il modulo si apre vuoto.» Ed è vero: i dati
   dell'ospite — cognome, nome, email, telefono — l'estensione li ha già
   letti dall'email e li tiene da parte per compilare la prenotazione.
   Poi si apre «Modifica profilo cliente» e si ricopia tutto a mano da
   un'altra finestra.

   COSA FA. Quando quel modulo si apre VUOTO, compare una riga sopra i
   campi con quello che so dell'ospite e un pulsante. Il pulsante scrive
   nei campi vuoti e basta.

   L'ULTIMO CLIC RESTA ALL'OPERATORE, come per tutto il resto
   dell'estensione. Non si compila da soli e non si salva mai: creare
   un'anagrafica sbagliata è peggio che non crearne nessuna, perché resta
   lì e la ritrova qualcun altro fra sei mesi.

   E SI VEDE PRIMA COSA VERRA' SCRITTO. Il cognome viene indovinato
   dall'ultima parola del nome in firma — «Una Pipic Leonard» diventa
   cognome Leonard, nome Una Pipic — e a volte sarà da invertire. Va
   letto prima di cliccare, non dopo: per questo la riga mostra i valori,
   non solo il pulsante.

   SOLO I CAMPI VUOTI. Se l'operatore ha già scritto qualcosa, quello
   non si tocca: ha davanti l'email e ne sa più di me.
   ============================================================ */
(() => {
  if (location.hostname !== 'leonardo.fidra.cloud') return;

  const ID = 'leoNuovoCliente';
  const VALIDITA_MS = 60 * 60 * 1000;   // un'ora: oltre, non è più questa richiesta

  const esc = (s) => String(s ?? '').replace(/[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- quello che so dell'ospite ---------- */
  let dati = null;

  function raccogli(ris) {
    /* la richiesta caricata da Outlook è la fonte più ricca: ha i campi
       già separati. Quella «libera» ha il nome tutto attaccato, e serve
       solo se l'altra non c'è. */
    const b = ris && ris.leonardo_bozza_centralino;
    if (b && Date.now() - (b.creato || 0) < VALIDITA_MS &&
        (b.cognome || b.nome || b.email || b.telefono)) {
      return { cognome: b.cognome || '', nome: b.nome || '',
               email: b.email || '', telefono: b.telefono || '',
               lingua: b.lingua || '', da: 'la richiesta caricata da Outlook' };
    }
    const q = ris && ris.leonardo_richiesta;
    if (q && Date.now() - (q.quando || 0) < VALIDITA_MS && (q.ospite || q.email)) {
      const parti = String(q.ospite || '').trim().split(/\s+/).filter(Boolean);
      return { cognome: parti.length > 1 ? parti[parti.length - 1] : (parti[0] || ''),
               nome: parti.length > 1 ? parti.slice(0, -1).join(' ') : '',
               email: q.email || '', telefono: '',
               lingua: q.lingua || '', da: 'l’ultima richiesta letta in Outlook' };
    }
    return null;
  }

  try {
    chrome.storage.local.get(['leonardo_bozza_centralino', 'leonardo_richiesta'],
      (ris) => { dati = raccogli(ris); });
  } catch (e) { /* senza dati il modulo si compila a mano, come prima */ }

  /* ---------- i campi del modulo ---------- */
  /* si cerca l'etichetta esatta e poi il primo campo che viene dopo, nel
     contenitore che li tiene insieme: i nomi delle classi di Fidra
     cambiano, l'etichetta che l'operatore legge no */
  function campoConEtichetta(radice, parole) {
    const et = [...radice.querySelectorAll('label, div, span, p')]
      .find(el => !el.children.length && parole.test((el.textContent || '').trim()));
    if (!et) return null;
    let su = et.parentElement;
    for (let i = 0; i < 3 && su && su !== radice.parentElement; i++, su = su.parentElement) {
      const c = su.querySelector('input, select, textarea');
      if (c) return c;
    }
    return null;
  }

  function campi(modale) {
    return {
      cognome:  campoConEtichetta(modale, /^cognome$/i),
      nome:     campoConEtichetta(modale, /^nome$/i),
      email:    campoConEtichetta(modale, /^e-?mail$/i),
      telefono: campoConEtichetta(modale, /^telefono$/i),
      lingua:   campoConEtichetta(modale, /^lingua$/i)
    };
  }

  /* i componenti di Fidra non si accorgono di un .value assegnato: il
     campo mostrerebbe il valore e il gestionale continuerebbe a non
     saperlo — un dato che si vede e non c'è */
  function scriviNativo(el, valore) {
    const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype
                : el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype
                : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, valore); else el.value = valore;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const NOMI_LINGUA = {
    it: /^(it|ita|italiano|italian)/i, de: /^(de|ted|tedesco|deutsch|german)/i,
    en: /^(en|ing|inglese|english)/i,  fr: /^(fr|fra|francese|fran)/i
  };

  function riempi(modale) {
    const c = campi(modale);
    const scritti = [], saltati = [];
    const prova = (chiave, campo, valore, etichetta) => {
      if (!valore) return;
      if (!campo) { saltati.push(etichetta + ' (campo non trovato)'); return; }
      if ((campo.value || '').trim()) { saltati.push(etichetta + ' (già scritto)'); return; }
      scriviNativo(campo, valore);
      scritti.push(etichetta);
    };
    prova('cognome', c.cognome, dati.cognome, 'cognome');
    prova('nome', c.nome, dati.nome, 'nome');
    prova('email', c.email, dati.email, 'email');
    prova('telefono', c.telefono, dati.telefono, 'telefono');
    /* la lingua è una tendina: si scrive solo se una delle sue opzioni
       corrisponde davvero, altrimenti si lascia stare */
    if (dati.lingua && c.lingua && c.lingua.tagName === 'SELECT' && !c.lingua.value) {
      const re = NOMI_LINGUA[dati.lingua];
      const opz = re && [...c.lingua.options]
        .find(o => re.test((o.textContent || '').trim()) || re.test(String(o.value).trim()));
      if (opz) { scriviNativo(c.lingua, opz.value); scritti.push('lingua'); }
    }
    return { scritti, saltati };
  }

  /* ---------- la riga sopra il modulo ---------- */
  function modaleProfilo() {
    /* il modulo si riconosce dal titolo che l'operatore legge; se un
       giorno cambiasse, si riconosce anche dall'avere insieme Cognome,
       Nome ed Email, che nessun'altra schermata di Fidra ha */
    for (const el of document.querySelectorAll('div, form, section')) {
      const t = (el.textContent || '').replace(/\s+/g, ' ');
      if (t.length > 1200) continue;
      if (!/Modifica profilo cliente/i.test(t)) continue;
      if (!el.querySelector('input')) continue;
      return el;
    }
    return null;
  }

  function vuoto(modale) {
    const c = campi(modale);
    /* si offre solo su un profilo NUOVO: se cognome o nome ci sono già,
       si sta correggendo un cliente esistente e non c'entra niente */
    return c.cognome && c.nome &&
           !(c.cognome.value || '').trim() && !(c.nome.value || '').trim();
  }

  function mostra(modale) {
    if (document.getElementById(ID)) return;
    const box = document.createElement('div');
    box.id = ID;
    box.style.cssText = 'margin:0 0 14px 0;padding:10px 14px;background:#EAF4F5;' +
      'border-left:4px solid #1E7F88;border-radius:4px;' +
      'font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#2A2E2B;';
    const riga = (e, v) => v
      ? `<div style="padding-top:2px;"><span style="color:#7B756A;">${e}</span> ${esc(v)}</div>` : '';
    box.innerHTML = `
      <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#1E7F88;">
        Dati dell&rsquo;ospite &middot; da ${esc(dati.da)}</div>
      ${riga('Cognome', dati.cognome)}${riga('Nome', dati.nome)}
      ${riga('Email', dati.email)}${riga('Telefono', dati.telefono)}
      <div style="padding-top:8px;">
        <button type="button" id="${ID}Btn" style="cursor:pointer;background:#1E7F88;color:#fff;
          border:none;border-radius:5px;padding:6px 12px;font-size:13px;">Riempi i campi</button>
        <span id="${ID}Esito" style="padding-left:10px;color:#55524B;"></span>
      </div>
      <div style="padding-top:6px;color:#8C8578;font-size:12px;">
        Il cognome &egrave; l&rsquo;ultima parola del nome in firma: se va invertito, correggilo
        dopo. Non salvo niente &mdash; <strong>Salva</strong> lo clicchi tu.</div>`;
    const primo = modale.querySelector('input');
    const dove = (primo && primo.closest('div')) || modale;
    (dove.parentElement || modale).insertBefore(box, dove);
    document.getElementById(ID + 'Btn').addEventListener('click', () => {
      const r = riempi(modale);
      const e = document.getElementById(ID + 'Esito');
      e.textContent = r.scritti.length
        ? 'Scritti: ' + r.scritti.join(', ') + (r.saltati.length ? ' · lasciati stare: ' + r.saltati.join(', ') : '')
        : 'Non c’era niente da scrivere' + (r.saltati.length ? ': ' + r.saltati.join(', ') : '');
    });
  }

  /* Fidra si ridisegna da sola: si guarda a intervalli invece di
     agganciarsi a un elemento che sparisce */
  setInterval(() => {
    if (!dati) return;
    const m = modaleProfilo();
    if (!m) { document.getElementById(ID)?.remove(); return; }
    if (vuoto(m)) mostra(m);
  }, 900);

  (typeof self !== 'undefined' ? self : window).leoNuovoCliente = () => {
    const m = modaleProfilo();
    return {
      versione: '1.0', dati,
      modaleTrovato: !!m,
      vuoto: m ? vuoto(m) : null,
      campi: m ? Object.entries(campi(m)).map(([k, v]) => ({
        campo: k, trovato: !!v, valore: v ? String(v.value || '').slice(0, 30) : null
      })) : null
    };
  };
})();
