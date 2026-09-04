/* ============================================================
   Offerta Leonardo — Articoli al POS (v2.27.0)
   ------------------------------------------------------------
   Gira su leonardo.fidra.cloud/admin/resources/items. Aggiunge in alto
   un pulsante «Manda gli articoli al POS»: legge la tabella pagina per
   pagina (l'unico clic e' su «Prossimo») e manda intestazioni e righe
   alla funzione pos, che da sola riconosce le colonne dal nome e decide
   stampante e portata per ogni categoria (menu.ts). Il listino del POS
   nasce cosi', e si aggiorna ripremendo il pulsante: gli articoli gia'
   noti cambiano solo il nome, quelli nuovi entrano.

   SOLA LETTURA SU FIDRA: non salva, non modifica, non chiama la sua API.
   La chiave hotel e' quella gia' salvata dal popup (hotelKey, in
   chrome.storage.local): se manca o e' sbagliata lo si dice, non la si
   chiede qui.
   ============================================================ */
(() => {
  'use strict';
  if (document.getElementById('leoArticoliBarra')) return;
  const FUNZIONE = 'https://mvuiuwakuseockotlcnp.supabase.co/functions/v1/pos?a=importa-menu';

  const testo = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
  const tabella = () => [...document.querySelectorAll('table')].find((t) => t.querySelectorAll('tbody tr').length) || document.querySelector('table');
  const leggiPagina = () => {
    const t = tabella();
    if (!t) return { intestazioni: [], righe: [] };
    const intestazioni = [...t.querySelectorAll('thead th, thead td')].map(testo);
    const righe = [...t.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map(testo)).filter((r) => r.length);
    return { intestazioni, righe };
  };
  const attesa = (ms) => new Promise((r) => setTimeout(r, ms));
  const spento = (b) => b.disabled || b.classList.contains('disabled') || b.getAttribute('aria-disabled') === 'true' || (b.closest('li, .page-item') || b).classList.contains('disabled');
  const prossimo = () => [...document.querySelectorAll('a, button')].find((b) => /^(prossim[oa]|next|successiv[oa]|›|»)$/i.test(testo(b)) && !spento(b));
  const impronta = (righe) => righe.map((r) => r.join('')).join('');

  async function tutte(stato) {
    const prima = leggiPagina();
    const intestazioni = prima.intestazioni;
    let righe = prima.righe;
    let ultima = impronta(prima.righe);
    for (let i = 0; i < 200; i++) {
      const p = prossimo();
      if (!p) break;
      p.click();
      /* la pagina nuova arriva quando le righe cambiano; oltre 6 secondi si smette */
      let pag = null;
      for (let t = 0; t < 30; t++) { await attesa(200); pag = leggiPagina(); if (pag.righe.length && impronta(pag.righe) !== ultima) break; pag = null; }
      if (!pag) break;
      ultima = impronta(pag.righe);
      righe = righe.concat(pag.righe);
      stato('Leggo... ' + righe.length + ' righe (pagina ' + (i + 2) + ')');
    }
    return { intestazioni, righe };
  }

  async function manda(esito) {
    const stato = (m) => { esito.textContent = m; };
    const { hotelKey } = await chrome.storage.local.get(['hotelKey']);
    if (!hotelKey) { stato('Serve la chiave hotel: la si imposta nel pannello dell\'estensione (Chiave hotel...).'); return; }
    stato('Leggo le pagine...');
    const dati = await tutte(stato);
    if (!dati.righe.length) { stato('Non trovo la tabella degli articoli in questa pagina.'); return; }
    stato('Mando ' + dati.righe.length + ' righe...');
    const r = await fetch(FUNZIONE, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hotel-key': hotelKey }, body: JSON.stringify(dati) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { stato('Chiave hotel sbagliata: la si reimposta nel pannello dell\'estensione.'); return; }
    stato(r.ok
      ? 'Fatto: ' + j.articoli + ' articoli in ' + j.categorie + ' categorie, ' + j.nuovi + ' nuovi' + (j.scartate ? ', ' + j.scartate + ' righe senza nome scartate' : '') + '.'
      : 'Errore: ' + (j.errore || r.status));
  }

  const barra = document.createElement('div');
  barra.id = 'leoArticoliBarra';
  barra.style.cssText = 'position:fixed;top:8px;right:16px;z-index:99999;background:#1A3626;color:#fff;padding:8px 12px;border-radius:8px;font:14px system-ui,sans-serif;display:flex;gap:10px;align-items:center;box-shadow:0 2px 8px rgba(0,0,0,.25);max-width:520px;';
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = 'Manda gli articoli al POS';
  b.style.cssText = 'font:inherit;padding:6px 10px;border-radius:6px;border:0;background:#C9A961;color:#1A3626;cursor:pointer;white-space:nowrap;';
  const esito = document.createElement('span');
  b.onclick = () => { b.disabled = true; manda(esito).catch((e) => { esito.textContent = 'Errore: ' + e.message; }).finally(() => { b.disabled = false; }); };
  barra.append(b, esito);
  document.body.appendChild(barra);
  const stile = document.createElement('style');
  stile.textContent = '@media print{#leoArticoliBarra{display:none !important;}}';
  document.head.appendChild(stile);
})();
