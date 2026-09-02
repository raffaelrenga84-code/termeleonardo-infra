/* ============================================================
   Offerta Leonardo — il cliente nuovo si compila da sé (v1.1)
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

   v1.1 — «AGGIORNA IL TELEFONO» SU UN PROFILO CHE ESISTE GIA'. Il
   cellulare che l'ospite scrive nel modulo transfer arrivava alla
   reception e ai tassisti, ma su Fidra restava da ricopiare a mano (la
   proprietà, 2 settembre 2026). Quando il modulo si apre su un cliente
   che c'è già, e la richiesta letta in Outlook ha un telefono diverso da
   quello del profilo, compare la stessa riga con un solo pulsante, che
   scrive SOLO il telefono. Due regole in più:
   - solo se è lo stesso ospite: email uguale, o — quando una delle due
     manca — cognome uguale. Due email diverse sono due persone, anche
     con lo stesso cognome;
   - solo se il numero è davvero diverso: «0049 162…» e «+49 162…» sono
     lo stesso numero, e proporlo sarebbe rumore.
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
               email: q.email || '', telefono: q.telefono || '',
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

  /* ---------- il telefono su un profilo che esiste già (v1.1) ---------- */
  function valoriProfilo(modale) {
    const c = campi(modale);
    const v = (el) => (el && el.value ? String(el.value) : '').trim();
    return { cognome: v(c.cognome), nome: v(c.nome), email: v(c.email), telefono: v(c.telefono) };
  }

  /* «0049 162 9821106» e «+49 1629821106» sono lo stesso numero; «333
     1234567» e «+39 333 1234567» pure. Si confrontano le cifre, tolto il
     doppio zero: se una è la coda dell'altra ed è lunga almeno nove cifre,
     cambia solo il prefisso. Senza numeri non c'è niente di uguale.
     Funzione chiusa in sé: nuovo-cliente.test.ts la estrae e la esegue. */
  function telefoniUguali(a, b) {
    const cifre = (t) => String(t || '').replace(/\D/g, '').replace(/^00/, '');
    const x = cifre(a), y = cifre(b);
    if (!x || !y) return false;
    if (x === y) return true;
    const corto = x.length < y.length ? x : y;
    const lungo = corto === x ? y : x;
    return corto.length >= 9 && lungo.endsWith(corto);
  }

  /* Lo stesso ospite: l'email decide, se c'è da tutte e due le parti — due
     email diverse sono due persone, anche con lo stesso cognome. Se una
     manca (la richiesta dal centralino non ce l'ha, un profilo vecchio
     nemmeno), decide il cognome. Senza nessuno dei due, no: scrivere il
     telefono di un ospite sul profilo di un altro è il danno peggiore che
     questo script possa fare. Anche questa chiusa in sé, per le prove. */
  function stessoOspite(dati, profilo) {
    const piatto = (s) => String(s || '').trim().toLowerCase();
    const e1 = piatto(dati.email), e2 = piatto(profilo.email);
    if (e1 && e2) return e1 === e2;
    const c1 = piatto(dati.cognome), c2 = piatto(profilo.cognome);
    return !!c1 && c1 === c2;
  }

  /* null se non c'è niente da proporre; altrimenti cosa c'è nel profilo,
     cosa arriva dalla richiesta, e perché */
  function telefonoDaAggiornare(modale) {
    if (!dati || !dati.telefono) return null;
    const profilo = valoriProfilo(modale);
    if (!stessoOspite(dati, profilo)) return null;
    if (telefoniUguali(profilo.telefono, dati.telefono)) return null;
    return { nelProfilo: profilo.telefono, nuovo: dati.telefono,
             perche: profilo.telefono ? 'diverso' : 'mancante' };
  }

  /* solo il telefono: su un profilo esistente il resto è dell'operatore */
  function aggiornaTelefono(modale) {
    const c = campi(modale);
    if (!c.telefono) return { scritto: false, perche: 'campo non trovato' };
    scriviNativo(c.telefono, dati.telefono);
    return { scritto: true };
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

  /* la riga del telefono, su un profilo che esiste già: stessa forma di
     quella sopra, un valore in meno e un pulsante che tocca un campo solo */
  const ID_TEL = ID + 'Tel';

  function mostraTelefono(modale, da) {
    if (document.getElementById(ID_TEL)) return;
    const box = document.createElement('div');
    box.id = ID_TEL;
    box.style.cssText = 'margin:0 0 14px 0;padding:10px 14px;background:#EAF4F5;' +
      'border-left:4px solid #1E7F88;border-radius:4px;' +
      'font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#2A2E2B;';
    box.innerHTML = `
      <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#1E7F88;">
        Telefono dell&rsquo;ospite &middot; da ${esc(dati.da)}</div>
      <div style="padding-top:2px;"><span style="color:#7B756A;">Nella richiesta</span> ${esc(da.nuovo)}</div>
      <div style="padding-top:2px;"><span style="color:#7B756A;">Nel profilo</span> ${
        da.nelProfilo ? esc(da.nelProfilo) : '<em>vuoto</em>'}</div>
      <div style="padding-top:8px;">
        <button type="button" id="${ID_TEL}Btn" style="cursor:pointer;background:#1E7F88;color:#fff;
          border:none;border-radius:5px;padding:6px 12px;font-size:13px;">${
          da.nelProfilo ? 'Aggiorna il telefono' : 'Scrivi il telefono'}</button>
        <span id="${ID_TEL}Esito" style="padding-left:10px;color:#55524B;"></span>
      </div>
      <div style="padding-top:6px;color:#8C8578;font-size:12px;">
        Tocco solo il telefono. Non salvo niente &mdash; <strong>Salva</strong> lo clicchi tu.</div>`;
    const primo = modale.querySelector('input');
    const dove = (primo && primo.closest('div')) || modale;
    (dove.parentElement || modale).insertBefore(box, dove);
    document.getElementById(ID_TEL + 'Btn').addEventListener('click', () => {
      const r = aggiornaTelefono(modale);
      /* dopo il clic la riga resta con l'esito finché il modulo è aperto:
         il numero ormai coincide e il ciclo qui sotto la toglierebbe */
      box.dataset.fatto = '1';
      document.getElementById(ID_TEL + 'Esito').textContent = r.scritto
        ? 'Scritto: telefono. Ora Salva.' : 'Non scritto: ' + r.perche;
    });
  }

  /* Fidra si ridisegna da sola: si guarda a intervalli invece di
     agganciarsi a un elemento che sparisce */
  setInterval(() => {
    if (!dati) return;
    const m = modaleProfilo();
    if (!m) {
      document.getElementById(ID)?.remove();
      document.getElementById(ID_TEL)?.remove();
      return;
    }
    if (vuoto(m)) { mostra(m); return; }
    /* profilo esistente: si propone solo il telefono, e solo finché serve */
    const da = telefonoDaAggiornare(m);
    const box = document.getElementById(ID_TEL);
    if (da) mostraTelefono(m, da);
    else if (box && !box.dataset.fatto) box.remove();
  }, 900);

  (typeof self !== 'undefined' ? self : window).leoNuovoCliente = () => {
    const m = modaleProfilo();
    return {
      versione: '1.1', dati,
      modaleTrovato: !!m,
      vuoto: m ? vuoto(m) : null,
      profilo: m ? valoriProfilo(m) : null,
      telefono: m ? telefonoDaAggiornare(m) : null,
      campi: m ? Object.entries(campi(m)).map(([k, v]) => ({
        campo: k, trovato: !!v, valore: v ? String(v.value || '').slice(0, 30) : null
      })) : null
    };
  };
})();
