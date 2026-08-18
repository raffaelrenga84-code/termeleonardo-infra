/* ============================================================
   Offerta Leonardo — service worker (v1.1.1)
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
    func: (a, p) => {
      try {
        const fp = document.querySelector('input.flatpickr-input');
        if (!fp || !fp._flatpickr) return { ok: false, motivo: 'flatpickr non trovato' };
        fp._flatpickr.setDate([a, p], true);
        return { ok: true, value: fp.value };
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
      sel.dispatchEvent(new Event('change', { bubbles: true }));
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
