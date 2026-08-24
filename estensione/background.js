/* ============================================================
   Offerta Leonardo — service worker (v1.2.1)
   Unico compito: eseguire nel contesto pagina (MAIN world) il
   comando flatpickr.setDate per il modulo di Fidra. Il content
   script non può farlo da solo: la CSP della pagina blocca gli
   script iniettati inline; chrome.scripting invece è immune.
   ============================================================ */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.tipo !== 'LEONARDO_SET_DATE' || !sender.tab?.id) return;
  chrome.scripting.executeScript({
    target: { tabId: sender.tab.id },
    world: 'MAIN',
    func: async (a, p) => {
      /* v1.2.0 — setDate() da solo NON basta.
         Scrive nel campo, e il campo mostra le date giuste, ma Fidra
         (Livewire) continua a ragionare sul periodo di prima: la barra
         resta "4 Notti" e la griglia camere mostra la disponibilita' di
         un altro periodo. Selezionando le date a mano funziona, e la
         differenza e' la CHIUSURA del calendario: Fidra si aggiorna li'.
         Quindi: setDate, eventi nativi su tutti e due gli input (con
         altInput il campo visibile e' un secondo elemento), poi close().
         E soprattutto: si aspetta che la barra di Fidra confermi. */
      const dorme = (ms) => new Promise(r => setTimeout(r, ms));
      /* v1.2.1 — nel mondo della pagina "new Event(...)" esplode con
         «Event is not a constructor»: qualcosa nel bundle di Fidra occupa
         quel nome. Si costruisce l'evento nel modo antico, che non dipende
         da nessun costruttore globale. */
      const evento = (nome) => {
        try { const e = document.createEvent('HTMLEvents'); e.initEvent(nome, true, false); return e; }
        catch (x) { return null; }
      };
      const manda = (el, nome) => { const e = evento(nome); if (el && e) el.dispatchEvent(e); };
      const barra = () => {
        const m = (document.body.innerText || '')
          .match(/(\d+)\s*Nott[ei],?\s*(\d+)\s*Camere/i);
        return m ? { notti: +m[1], testo: m[0] } : null;
      };
      const nottiAttese = Math.round(
        (Date.parse(p + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
      try {
        const el = document.querySelector('input.flatpickr-input');
        if (!el || !el._flatpickr) return { ok: false, motivo: 'flatpickr non trovato' };
        const fp = el._flatpickr;
        const prima = barra();

        fp.setDate([a, p], true);
        for (const campo of [fp.input, fp.altInput].filter(Boolean)) {
          manda(campo, 'input'); manda(campo, 'change');
        }
        try { fp.close(); } catch (e) { /* gia' chiuso */ }
        for (const campo of [fp.input, fp.altInput].filter(Boolean)) manda(campo, 'blur');

        /* Livewire risponde via rete: si aspetta fino a 6 secondi che la
           barra dica il numero di notti giusto. Se non lo dice, si
           dichiara fallito invece di far finta di niente. */
        let dopo = null, capito = false;
        for (let i = 0; i < 20; i++) {
          await dorme(300);
          dopo = barra();
          if (dopo && dopo.notti === nottiAttese) { capito = true; break; }
        }
        return {
          ok: capito, value: el.value, altValue: fp.altInput ? fp.altInput.value : null,
          nottiAttese, barraPrima: prima, barraDopo: dopo,
          motivo: capito ? null : 'il campo e\' scritto ma Fidra non ha aggiornato il periodo'
        };
      } catch (e) { return { ok: false, motivo: String(e) }; }
    },
    args: [msg.a, msg.p]
  }).then(ris => sendResponse(ris?.[0]?.result || { ok: false, motivo: 'nessun risultato' }))
    .catch(e => sendResponse({ ok: false, motivo: String(e) }));
  return true; // risposta asincrona
});

/* ============================================================
   Offerta Leonardo — i due campi jQuery del modulo dei tassisti (v2.3)
   Stessa ragione del blocco qui sopra: la data e' un
   bootstrap-datepicker e il luogo una tendina Chosen, tutti e due
   vivono nel mondo della pagina. Il content script non li raggiunge;
   chrome.scripting invece si'.
   ============================================================ */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.tipo !== 'ATAM_SET_DATE' && msg?.tipo !== 'ATAM_SET_LUOGO') return;
  if (!sender.tab?.id) return;

  const perData = (iso) => {
    try {
      const [a, m, g] = String(iso).split('-').map(Number);
      const el = document.getElementById('id_data_corsa_0');
      if (!el || !window.jQuery) return { ok: false, motivo: 'datepicker non raggiungibile' };
      window.jQuery(el).datepicker('setDate', new Date(a, m - 1, g));
      return { ok: !!el.value, value: el.value };
    } catch (e) { return { ok: false, motivo: String(e) }; }
  };

  /* Chosen non si accorge di un cambio fatto sul <select>: va avvisata,
     altrimenti la tendina continua a mostrare «---------» mentre il
     valore vero e' cambiato — cioe' il caso peggiore, perche' chi
     guarda crede di non aver scelto e sceglie di nuovo. */
  const perLuogo = (valore) => {
    try {
      const sel = document.getElementById('id_luogo');
      if (!sel) return { ok: false, motivo: 'tendina non trovata' };
      sel.value = String(valore);
      /* v2.3.1 — stesso motivo del blocco Fidra: "new Event" non e'
         costruibile nel mondo della pagina. Qui non era ancora esploso
         solo perche' nessuno ha riprovato il modulo tassisti di recente. */
      try { const e = document.createEvent('HTMLEvents'); e.initEvent('change', true, false);
            sel.dispatchEvent(e); } catch (x) { /* niente */ }
      if (window.jQuery && window.jQuery.fn.chosen) window.jQuery(sel).trigger('chosen:updated');
      return { ok: sel.value === String(valore), value: sel.value };
    } catch (e) { return { ok: false, motivo: String(e) }; }
  };

  chrome.scripting.executeScript({
    target: { tabId: sender.tab.id },
    world: 'MAIN',
    func: msg.tipo === 'ATAM_SET_DATE' ? perData : perLuogo,
    args: [msg.tipo === 'ATAM_SET_DATE' ? msg.data : msg.valore],
  }).then((ris) => sendResponse(ris?.[0]?.result || { ok: false, motivo: 'nessun risultato' }))
    .catch((e) => sendResponse({ ok: false, motivo: String(e) }));
  return true; // risposta asincrona
});

/* ============================================================
   L'estensione si ricarica da sola (v2.9.7)
   ------------------------------------------------------------
   IL PROBLEMA. L'estensione e' caricata scompattata da una cartella
   di OneDrive: i file arrivano da soli su tutti i computer, ma Edge
   non guarda se sono cambiati. A ogni versione qualcuno doveva fare
   il giro dei computer e premere Ricarica su chrome://extensions —
   e quando non lo faceva, un computer mandava le email con il codice
   di due settimane prima senza che nessuno se ne accorgesse. E' lo
   stesso difetto della v2.8.8, ma moltiplicato per il numero di
   postazioni.

   COME. Il manifest che sta girando dice la sua versione
   (chrome.runtime.getManifest); quello sul disco dice la sua. Se sul
   disco c'e' un numero piu' alto, i file nuovi sono arrivati e
   chrome.runtime.reload() fa ripartire l'estensione leggendoli.

   TRE PRECAUZIONI, perche' un ricaricamento a meta' lavoro fa perdere
   quello che si stava facendo:
   · solo se la versione sul disco e' STRETTAMENTE piu' alta, mai
     "diversa": un numero che scende sarebbe un file mezzo scritto da
     OneDrive, e ricaricare in un ciclo e' peggio di non ricaricare;
   · mai mentre c'e' un'email in attesa di essere inserita in Outlook
     o un preventivo fresco nel riquadro: si aspetta il giro dopo;
   · si ricorda l'ultima versione per cui si e' ricaricato, cosi' se
     il ricaricamento non prende effetto non ci si riprova all'infinito.

   Da console del service worker: leoAggiornamento() dice cosa vede.
   ============================================================ */
const CHIAVE_RICARICA = 'leonardo_ultima_ricarica';

function versioneMaggiore(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}

async function versioneSulDisco() {
  /* la marca temporale e no-store perche' un manifest servito dalla cache
     direbbe per sempre la versione con cui l'estensione e' partita */
  const url = chrome.runtime.getURL('manifest.json') + '?t=' + Date.now();
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error('manifest non leggibile: ' + r.status);
  const j = await r.json();
  if (!j || !j.version) throw new Error('manifest senza versione');
  return String(j.version);
}

async function lavoroInCorso() {
  try {
    const s = await chrome.storage.local.get(['leonardo_email_pendente', 'leonardo_preventivo']);
    if (s.leonardo_email_pendente && s.leonardo_email_pendente.html) return 'email in attesa in Outlook';
    const p = s.leonardo_preventivo;
    if (p && Date.now() - (p.quando || 0) < 30 * 60 * 1000) return 'preventivo appena preparato';
  } catch (e) { /* nel dubbio si prosegue: il controllo e' una cortesia */ }
  return null;
}

async function guardaAggiornamento(silenzioso) {
  const ora = chrome.runtime.getManifest().version;
  let disco;
  try { disco = await versioneSulDisco(); }
  catch (e) { return { ora, errore: String(e.message || e) }; }

  const esito = { ora, disco, piuNuova: versioneMaggiore(disco, ora) };
  if (!esito.piuNuova) return esito;

  const occupato = await lavoroInCorso();
  if (occupato) { esito.rimandato = occupato; return esito; }

  const s = await chrome.storage.local.get([CHIAVE_RICARICA]);
  if (s[CHIAVE_RICARICA] === disco) { esito.giaProvato = true; return esito; }

  await chrome.storage.local.set({ [CHIAVE_RICARICA]: disco });
  esito.ricarico = true;
  if (!silenzioso) console.log(`Leonardo: ${ora} → ${disco}, ricarico`);
  chrome.runtime.reload();
  return esito;
}

self.leoAggiornamento = () => guardaAggiornamento(true);

chrome.alarms?.create('leonardo-aggiornamento', { periodInMinutes: 5, delayInMinutes: 1 });
chrome.alarms?.onAlarm.addListener((a) => {
  if (a.name === 'leonardo-aggiornamento') guardaAggiornamento(false);
});
chrome.runtime.onStartup.addListener(() => guardaAggiornamento(false));

/* ============================================================
   Apri Outlook con l'email pronta (v2.9.1)
   ------------------------------------------------------------
   Il riquadro «Disponibilita' e prezzi» vive dentro la pagina di
   Fidra, e un content script non puo' aprire una scheda: chrome.tabs
   esiste solo qui. Prima il preventivo doveva passare per il pannello
   laterale — due finestre e quattro clic per un gesto solo.
   ============================================================ */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.tipo !== 'LEONARDO_APRI_OUTLOOK') return;
  if (typeof msg.url !== 'string' || !/^https:\/\/outlook\./.test(msg.url)) {
    sendResponse({ ok: false, motivo: 'indirizzo non consentito' });
    return true;
  }
  chrome.tabs.create({ url: msg.url })
    .then(() => sendResponse({ ok: true }))
    .catch((e) => sendResponse({ ok: false, motivo: String(e) }));
  return true; // risposta asincrona
});

/* ============================================================
   Apri il pannello dal pulsante messo al posto di «Modello Email»
   ------------------------------------------------------------
   chrome.sidePanel.open vuole un gesto dell'operatore. Il clic lo e',
   ma passando dal content script al service worker il gesto non
   sopravvive sempre: quando fallisce si risponde con il motivo, e il
   pulsante dice di premere Ctrl+Shift+L invece di sembrare rotto.
   ============================================================ */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.tipo !== 'LEONARDO_APRI_PANNELLO') return;
  (async () => {
    try {
      if (!chrome.sidePanel) throw new Error('pannello non disponibile');
      const finestra = sender.tab?.windowId;
      await chrome.sidePanel.open(finestra != null ? { windowId: finestra } : {});
      sendResponse({ ok: true });
    } catch (e) {
      sendResponse({ ok: false, motivo: String(e && e.message || e) });
    }
  })();
  return true; // risposta asincrona
});

/* ============================================================
   Pannello laterale (v1.2)
   Edge non riapre il pannello dopo il riavvio e l'API non permette
   di aprirlo senza un gesto dell'operatore. Con la preferenza
   "tienilo fisso" attiva facciamo la cosa migliore consentita:
   il clic sull'icona nella barra apre direttamente il pannello
   invece del popup, e la scorciatoia da tastiera fa lo stesso.
   ============================================================ */
const PREF_PANNELLO = 'pannelloFisso';

async function applicaComportamentoPannello() {
  if (!chrome.sidePanel) return;
  const { [PREF_PANNELLO]: fisso } = await chrome.storage.local.get([PREF_PANNELLO]);
  try {
    // con il popup impostato il clic mostrerebbe il popup: va tolto
    await chrome.action.setPopup({ popup: fisso ? '' : 'popup.html' });
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: !!fisso });
    await chrome.action.setTitle({
      title: fisso ? 'Apri il pannello Offerta Leonardo' : 'Prepara offerta'
    });
  } catch (e) { /* Edge vecchi: resta il popup normale */ }
}

chrome.runtime.onInstalled.addListener(applicaComportamentoPannello);
chrome.runtime.onStartup.addListener(applicaComportamentoPannello);
applicaComportamentoPannello();

chrome.storage.onChanged.addListener((cambi, area) => {
  if (area === 'local' && cambi[PREF_PANNELLO]) applicaComportamentoPannello();
});

/* scorciatoia da tastiera: il comando conta come gesto dell'operatore,
   quindi il pannello può essere aperto anche a preferenza spenta */
chrome.commands?.onCommand.addListener(async (comando) => {
  if (comando !== 'apri-pannello' || !chrome.sidePanel) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch (e) { /* niente da fare: il pannello si apre dall'icona */ }
});
