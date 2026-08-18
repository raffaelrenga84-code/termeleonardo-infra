/* ============================================================
   Offerta Leonardo — coda solleciti (v1.2)
   ------------------------------------------------------------
   Sulla home di Fidra (/front-office) c'e' la sezione
   "Prenotazioni in scadenza". Questo script la legge e mostra un
   pulsante: al clic salva la coda in chrome.storage e apre la
   prima prenotazione. Il popup, aperto su una prenotazione della
   coda, si presenta gia' su "Sollecito offerta" con "1 di N" e il
   collegamento "prossima →". NIENTE INVII AUTOMATICI: ogni email
   viene rivista e spedita dall'operatore, una alla volta.
   ============================================================ */
(() => {
  const CHIAVE = 'leonardo_coda_solleciti';

  function sezioneScadenze() {
    // l'elemento visibile piu' piccolo che inizia con "Prenotazioni in scadenza"
    let migliore = null;
    for (const e of document.querySelectorAll('div, section, h1, h2, h3, h4, span, p')) {
      if (!e.offsetParent) continue;
      const t = (e.textContent || '').trim();
      if (!t.toLowerCase().startsWith('prenotazioni in scadenza')) continue;
      if (!migliore || t.length < (migliore.textContent || '').length) migliore = e;
    }
    return migliore;
  }

  function raccogliVoci() {
    const sez = sezioneScadenze();
    if (!sez) return [];
    // i link alle prenotazioni stanno nel contenitore della sezione:
    // risalgo finche' non ne trovo, al massimo di quattro livelli
    let nodo = sez, anchors = [];
    for (let i = 0; i < 4 && nodo; i++) {
      anchors = [...nodo.querySelectorAll('a[href*="/reservations/"]')];
      if (anchors.length) break;
      nodo = nodo.parentElement;
    }
    const visti = new Set();
    const voci = [];
    for (const a of anchors) {
      const url = new URL(a.getAttribute('href'), location.origin).href;
      if (!/\/customers\/\d+\/reservations\/\d+/.test(url) || visti.has(url)) continue;
      visti.add(url);
      voci.push({ url, etichetta: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) });
    }
    return voci;
  }

  function aggiornaPulsante() {
    const voci = raccogliVoci();
    let btn = document.getElementById('leonardo-solleciti-btn');
    if (!voci.length) { if (btn) btn.remove(); return; }
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'leonardo-solleciti-btn';
      btn.style.cssText =
        'position:fixed;bottom:24px;right:24px;z-index:2147483647;' +
        'padding:12px 20px;border:0;border-radius:8px;cursor:pointer;' +
        'font:600 14px/18px Arial,Helvetica,sans-serif;color:#fff;' +
        'background:#0F5C64;box-shadow:0 3px 12px rgba(0,0,0,.3);';
      btn.addEventListener('click', () => {
        const attuali = raccogliVoci();
        if (!attuali.length) return;
        chrome.storage.local.set({ [CHIAVE]: { creato: Date.now(), indice: 0, voci: attuali } }, () => {
          window.open(attuali[0].url, '_blank');
        });
      });
      document.body.appendChild(btn);
    }
    btn.textContent = '\u2709 Coda solleciti (' + voci.length + ')';
    btn.title = 'Apre le prenotazioni in scadenza una alla volta: il popup si presenta gi\u00e0 sul sollecito. Ogni email la rivedi e la mandi tu.';
  }

  // la home e' una SPA: controllo leggero e periodico
  aggiornaPulsante();
  setInterval(aggiornaPulsante, 2000);
})();
