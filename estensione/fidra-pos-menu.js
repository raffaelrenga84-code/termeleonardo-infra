/* ============================================================
   Offerta Leonardo — Il menù dal POS di Fidra (v2.36.0)
   ------------------------------------------------------------
   Gira sul POS di Fidra (leonardo.fidra.cloud/pos…). Non tocca niente:
   guarda lo schermo mentre la reception apre una categoria dopo l'altra e
   si segna gli articoli che compaiono, con il prezzo. Quando ha visto
   tutto, un pulsante manda il menù al nostro POS.

   PERCHE' COSI'. La categoria di un articolo, in Fidra, non sta nelle
   liste che si possono chiedere (`items` e' il magazzino, `item-variations`
   e' il listino ma senza categoria): sta solo qui, dentro questa
   schermata. Indovinarla dal nome faceva danni — «Gin Tonic» finiva nei
   Cocktail invece che nei Long Drinks (la proprieta', 4 settembre 2026,
   con le fotografie di categoria per categoria).

   SOLA LETTURA: nessun clic, nessun ordine, nessuna riga aggiunta a un
   tavolo. Quello che si raccoglie resta nel browser (chrome.storage)
   finche' non lo si manda o non lo si svuota.
   ============================================================ */
(() => {
  'use strict';

  /* Le barre dell'estensione sulla pagina del POS di Fidra (questa e quella
     dell'altro script: menu' e sala) stanno in UNA colonna in basso a
     sinistra, una sotto l'altra. Messe ognuna per conto suo nello stesso
     angolo si coprivano («vedo i pulsanti sormontati», la proprieta', 6
     settembre 2026). La prima che arriva crea la colonna, l'altra ci entra. */
  function colonnaBarre() {
    let c = document.getElementById('leoBarre');
    if (!c) {
      c = document.createElement('div');
      c.id = 'leoBarre';
      c.style.cssText = 'position:fixed;left:14px;bottom:14px;z-index:99999;display:flex;flex-direction:column;gap:8px;align-items:flex-start;';
      document.body.appendChild(c);
    }
    return c;
  }
  const ID = 'leoPosMenuBarra';
  if (document.getElementById(ID)) return;
  const FUNZIONE = 'https://mvuiuwakuseockotlcnp.supabase.co/functions/v1/pos?a=importa-menu';
  const DEPOSITO = 'posMenuRaccolto';

  const testo = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
  /* «8,50 €» → 850. Fidra scrive sempre con la virgola e due decimali. */
  const PREZZO = /(\d{1,5})[.,](\d{2})\s*€/;
  const centDi = (t) => { const m = String(t).match(PREZZO); return m ? Number(m[1]) * 100 + Number(m[2]) : null; };

  /* Le categorie: stanno tutte nella schermata che le elenca, ognuna
     dentro il proprio pulsante (wire:click="selectCategory({...})"). */
  function categorieSulloSchermo() {
    const fuori = [];
    for (const b of document.querySelectorAll('[wire\\:click^="selectCategory"]')) {
      const attr = b.getAttribute('wire:click') || '';
      const dentro = attr.slice(attr.indexOf('(') + 1, attr.lastIndexOf(')'));
      try {
        const o = JSON.parse(dentro);
        if (o && o.name) fuori.push(String(o.name).trim());
      } catch (e) { const t = testo(b); if (t) fuori.push(t); }
    }
    return fuori;
  }

  /* Gli articoli di una categoria aperta: i riquadri col prezzo. Il
     riquadro «Indietro» non ha prezzo e resta fuori da solo. */
  function articoliSulloSchermo() {
    const fuori = [];
    for (const b of document.querySelectorAll('button, [role="button"], a')) {
      if (b.getAttribute('wire:click') && /^selectCategory/.test(b.getAttribute('wire:click'))) continue;
      const t = testo(b);
      const cent = centDi(t);
      if (cent === null) continue;
      const nome = t.replace(PREZZO, '').replace(/\s+/g, ' ').trim();
      if (!nome || nome.length > 120) continue;
      fuori.push({ nome, prezzo_cent: cent });
    }
    return fuori;
  }

  /* Quale categoria e' aperta: sopra i riquadri Fidra scrive il suo nome,
     e non e' un pulsante. Si cerca fra i nomi che abbiamo gia' visto. */
  function categoriaAperta(note) {
    const candidati = [...document.querySelectorAll('div, span, h1, h2, h3, p, label')]
      .filter((el) => el.children.length === 0)
      .map((el) => testo(el));
    for (const n of candidati) if (note.has(n)) return n;
    return null;
  }

  /* ---------- quello che si e' raccolto ---------- */
  async function leggi() {
    try {
      const { [DEPOSITO]: r } = await chrome.storage.local.get([DEPOSITO]);
      return (r && typeof r === 'object') ? r : { categorie: {}, nomiCategorie: [] };
    } catch (e) { return { categorie: {}, nomiCategorie: [] }; }
  }
  async function scrivi(r) { try { await chrome.storage.local.set({ [DEPOSITO]: r }); } catch (e) { /* pieno o estensione ricaricata */ } }

  let raccolto = { categorie: {}, nomiCategorie: [] };
  const quanti = () => Object.values(raccolto.categorie).reduce((t, a) => t + a.length, 0);

  function aggiorna() {
    const b = document.getElementById('leoPosMenuStato');
    if (!b) return;
    const viste = Object.keys(raccolto.categorie).length;
    const tutte = raccolto.nomiCategorie.length;
    b.textContent = tutte
      ? `${viste} categorie su ${tutte}, ${quanti()} articoli.` + (viste < tutte ? ' Ne mancano: ' + raccolto.nomiCategorie.filter((n) => !raccolto.categorie[n]).slice(0, 6).join(', ') : ' Puo’ mandarlo.')
      : `${viste} categorie, ${quanti()} articoli. Apra le categorie una per una.`;
  }

  /* Guarda lo schermo. Non tocca niente: si limita a segnarsi cosa vede. */
  let ultimo = '';
  async function guarda() {
    const note = new Set(raccolto.nomiCategorie);
    const cats = categorieSulloSchermo();
    if (cats.length >= 5) {
      /* siamo sulla schermata che le elenca tutte: si prende l'elenco */
      raccolto.nomiCategorie = [...new Set(cats)];
      await scrivi(raccolto); aggiorna();
      return;
    }
    const arts = articoliSulloSchermo();
    if (!arts.length) return;
    const cat = categoriaAperta(note.size ? note : new Set(raccolto.nomiCategorie));
    if (!cat) return;
    const impronta = cat + '|' + arts.map((a) => a.nome + a.prezzo_cent).join('|');
    if (impronta === ultimo) return;
    ultimo = impronta;
    raccolto.categorie[cat] = arts;
    await scrivi(raccolto); aggiorna();
  }

  async function manda(stato, bottone) {
    /* la funzione legge intestazioni e righe come le legge da una tabella:
       nome, categoria, prezzo — l'ordine non conta, conta il nome */
    const intestazioni = ['nome', 'categoria', 'prezzo'];
    const righe = [];
    for (const [categoria, arts] of Object.entries(raccolto.categorie)) {
      for (const a of arts) righe.push([a.nome, categoria, (a.prezzo_cent / 100).toFixed(2)]);
    }
    if (!righe.length) { stato.textContent = 'Non ho ancora visto nessun articolo: apra una categoria.'; return; }
    let hotelKey;
    try { ({ hotelKey } = await chrome.storage.local.get(['hotelKey'])); }
    catch (e) { stato.textContent = 'L’estensione è stata aggiornata: ricarichi la pagina (F5).'; return; }
    if (!hotelKey) { stato.textContent = 'Serve la chiave hotel: la si imposta nel pannello dell’estensione.'; return; }
    bottone.disabled = true;
    stato.textContent = `Mando ${righe.length} articoli…`;
    try {
      const r = await fetch(FUNZIONE, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-hotel-key': hotelKey },
        body: JSON.stringify({ intestazioni: ['categoria', 'nome', 'prezzo_cent'], righe }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { stato.textContent = 'Errore: ' + (j.errore || r.status); return; }
      stato.textContent = `Mandati: ${j.articoli ?? righe.length} articoli in ${j.categorie ?? Object.keys(raccolto.categorie).length} categorie. Il POS li ha.`;
    } catch (e) { stato.textContent = 'Errore: ' + e.message; }
    finally { bottone.disabled = false; }
  }

  async function metti() {
    raccolto = await leggi();
    const barra = document.createElement('div');
    barra.id = ID;
    barra.style.cssText = 'background:#1A3626;color:#fff;padding:8px 12px;border-radius:8px;font:13px system-ui,sans-serif;display:flex;gap:8px;align-items:center;box-shadow:0 2px 8px rgba(0,0,0,.25);max-width:520px;flex-wrap:wrap;';
    const stato = document.createElement('span');
    stato.id = 'leoPosMenuStato';
    stato.style.cssText = 'flex-basis:100%;';
    const invia = document.createElement('button');
    invia.type = 'button';
    invia.textContent = 'Manda il menù al POS';
    invia.title = 'Manda al nostro POS le categorie viste finora, con gli articoli e i prezzi. Non tocca niente in Fidra.';
    invia.style.cssText = 'font:inherit;padding:6px 10px;border-radius:6px;border:0;background:#C9A961;color:#1A3626;cursor:pointer;white-space:nowrap;';
    invia.onclick = () => manda(stato, invia);
    const svuota = document.createElement('button');
    svuota.type = 'button';
    svuota.textContent = 'Ricomincia';
    svuota.title = 'Dimentica quello che ha raccolto finora.';
    svuota.style.cssText = 'font:inherit;padding:6px 10px;border-radius:6px;border:1px solid #fff;background:transparent;color:#fff;cursor:pointer;';
    svuota.onclick = async () => { raccolto = { categorie: {}, nomiCategorie: raccolto.nomiCategorie }; ultimo = ''; await scrivi(raccolto); aggiorna(); };
    barra.append(invia, svuota, stato);
    colonnaBarre().appendChild(barra);
    const stile = document.createElement('style');
    stile.textContent = '@media print{#' + ID + '{display:none !important;}}';
    document.head.appendChild(stile);
    aggiorna();
    /* Fidra ridisegna la schermata da sola: si guarda quando cambia, con
       un momento di calma perche' Livewire finisca. */
    let attesa = null;
    const osserva = new MutationObserver(() => { clearTimeout(attesa); attesa = setTimeout(() => { guarda().catch(() => {}); }, 400); });
    osserva.observe(document.body, { childList: true, subtree: true });
    guarda().catch(() => {});
  }

  metti();
})();
