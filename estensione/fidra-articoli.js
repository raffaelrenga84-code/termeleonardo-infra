/* ============================================================
   Offerta Leonardo — Articoli al POS (v2.37.0)
   ------------------------------------------------------------
   Gira su leonardo.fidra.cloud/admin/resources/item-variations (e su items). Un pulsante,
   «Manda gli articoli al POS»: prende l'elenco completo e lo manda alla
   nostra funzione pos, che riconosce le colonne dal nome e decide da sola
   stampante e portata per ogni categoria (menu.ts).

   COME LO PRENDE. Fidra e' fatto con Laravel Nova: la tabella che si vede
   non sta nella pagina, la disegna il browser dopo aver chiesto i dati a
   `/nova-api/item-variations`. Leggere la tabella dallo schermo funzionava male e
   costringeva a sfogliare le pagine una a una; adesso si chiede l'elenco
   allo stesso indirizzo che usa Fidra, cento righe per volta, con la
   sessione gia' aperta della reception. Se quell'indirizzo non
   rispondesse, si torna a leggere la tabella come prima.

   SOLA LETTURA SU FIDRA: chiede e basta, non salva e non modifica niente.
   La chiave hotel e' quella gia' salvata dal pannello (hotelKey).
   ============================================================ */
(() => {
  'use strict';
  const ID = 'leoArticoliBarra';
  if (document.getElementById(ID)) return;
  const FUNZIONE = 'https://mvuiuwakuseockotlcnp.supabase.co/functions/v1/pos?a=importa-menu';
  /* Nova mette le sue interfacce sotto /nova-api; in qualche installazione
     stanno sotto il percorso del pannello. Si provano tutte e due. */
  const BASI = ['/nova-api', '/admin/nova-api'];
  /* IL LISTINO, NON IL MAGAZZINO. `items` sono i prodotti dei fornitori,
     con le confezioni e i colli, e NON hanno prezzo; quello che si vende
     sta in `item-variations`, 592 righe con nome e prezzo in centesimi —
     i vini del ristorante compresi (la proprieta', 4 settembre 2026).
     Fidra non dice la categoria: quella la decide il server dal nome, e
     cio' che non riconosce lo mette da parte spento. */
  const RISORSA = 'item-variations';

  const testo = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();

  /* ---------- la strada buona: l'elenco come lo chiede Fidra ---------- */
  const semplice = (v) => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') return String(v.name ?? v.title ?? v.label ?? v.value ?? v.display ?? '');
    return String(v);
  };

  async function pagina(base, numero) {
    const r = await fetch(`${base}/${RISORSA}?perPage=100&page=${numero}&orderBy=id&orderByDirection=asc`, {
      credentials: 'same-origin',
      headers: { accept: 'application/json', 'x-requested-with': 'XMLHttpRequest' },
    });
    if (!r.ok) throw new Error('elenco ' + r.status);
    return await r.json();
  }

  async function daNova(stato) {
    let base = null, prima = null;
    for (const b of BASI) {
      try { prima = await pagina(b, 1); base = b; break; } catch (e) { /* si prova l altra */ }
    }
    if (!base || !prima || !Array.isArray(prima.resources)) return null;
    const risorse = [...prima.resources];
    for (let p = 2; p <= 60; p++) {
      stato('Chiedo l’elenco… ' + risorse.length + ' articoli');
      let j;
      try { j = await pagina(base, p); } catch (e) { break; }
      if (!Array.isArray(j.resources) || !j.resources.length) break;
      risorse.push(...j.resources);
      if (!j.next_page_url) break;
    }
    /* le colonne sono i campi della prima riga; ogni riga si allinea a quelle */
    const intestazioni = (risorse[0].fields || []).map((f) => String(f.attribute || f.name || ''));
    const righe = risorse.map((x) => {
      const per = new Map((x.fields || []).map((f) => [String(f.attribute || f.name || ''), semplice(f.value)]));
      return intestazioni.map((k) => per.get(k) ?? '');
    });
    return { intestazioni, righe, unita: 'centesimi' }; /* item-variations: interi in centesimi */
  }

  /* ---------- il ripiego: la tabella come si vede ---------- */
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

  async function daSchermo(stato) {
    const prima = leggiPagina();
    const intestazioni = prima.intestazioni;
    let righe = prima.righe;
    let ultima = impronta(prima.righe);
    for (let i = 0; i < 200; i++) {
      const p = prossimo();
      if (!p) break;
      p.click();
      let pag = null;
      for (let t = 0; t < 30; t++) { await attesa(200); pag = leggiPagina(); if (pag.righe.length && impronta(pag.righe) !== ultima) break; pag = null; }
      if (!pag) break;
      ultima = impronta(pag.righe);
      righe = righe.concat(pag.righe);
      stato('Leggo… ' + righe.length + ' righe (pagina ' + (i + 2) + ')');
    }
    return { intestazioni, righe, unita: 'euro' }; /* la tabella a schermo: «6,00» */
  }

  async function manda(esito) {
    const stato = (m) => { esito.textContent = m; };
    const { hotelKey } = await chrome.storage.local.get(['hotelKey']);
    if (!hotelKey) { stato('Serve la chiave hotel: la si imposta nel pannello dell\'estensione (Chiave hotel...).'); return; }
    stato('Chiedo l’elenco a Fidra…');
    let dati = null;
    try { dati = await daNova(stato); } catch (e) { dati = null; }
    if (!dati || !dati.righe.length) { stato('Leggo dalla tabella…'); dati = await daSchermo(stato); }
    if (!dati.righe.length) { stato('Non trovo gli articoli: apra la pagina Articoli di Fidra e riprovi.'); return; }
    stato('Mando ' + dati.righe.length + ' articoli…');
    const r = await fetch(FUNZIONE, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hotel-key': hotelKey }, body: JSON.stringify(dati) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { stato('Chiave hotel sbagliata: la si reimposta nel pannello dell\'estensione.'); return; }
    stato(r.ok
      ? 'Fatto: ' + j.nuovi + ' nuovi, ' + j.saltati + ' c’erano già' + (j.da_sistemare ? ', ' + j.da_sistemare + ' messi in «Da sistemare» (spenti: li guardi in back office)' : '') + '.'
      : 'Errore: ' + (j.errore || r.status));
  }

  const barra = document.createElement('div');
  barra.id = ID;
  barra.style.cssText = 'position:fixed;left:14px;bottom:14px;z-index:99999;background:#1A3626;color:#fff;padding:8px 12px;border-radius:8px;font:14px system-ui,sans-serif;display:flex;gap:10px;align-items:center;box-shadow:0 2px 8px rgba(0,0,0,.25);max-width:520px;flex-wrap:wrap;';
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = 'Manda gli articoli al POS';
  b.style.cssText = 'font:inherit;padding:6px 10px;border-radius:6px;border:0;background:#C9A961;color:#1A3626;cursor:pointer;white-space:nowrap;';
  const esito = document.createElement('span');
  esito.style.cssText = 'flex-basis:100%;';
  b.onclick = () => { b.disabled = true; manda(esito).catch((e) => { esito.textContent = 'Errore: ' + e.message; }).finally(() => { b.disabled = false; }); };
  barra.append(b, esito);
  document.body.appendChild(barra);
  const stile = document.createElement('style');
  stile.textContent = '@media print{#' + ID + '{display:none !important;}}';
  document.head.appendChild(stile);
})();
