/* ============================================================
   Offerta Leonardo — Privacy al totem (v2.28.0)
   ------------------------------------------------------------
   Gira sulla prenotazione aperta in Fidra (le pagine «reservations»),
   dopo extractor.js. Al check-in la reception preme «Privacy al totem»:
   per ogni camera assegnata manda alla funzione privacy (?a=attesa, con la
   chiave hotel gia' salvata dal pannello) cognome, nome, email, lingua,
   camera, date e numero della prenotazione. Da quel momento l'ospite che
   passa la tessera al totem, o che la reception sceglie sull'iPad, trova
   il modulo gia' compilato: legge, tocca tre volte, firma.

   SOLA LETTURA SU FIDRA: nessun clic, nessun salvataggio. Il consenso
   vive da noi; la spunta in Fidra resta a mano.
   ============================================================ */
(() => {
  'use strict';
  const ID = 'leoPrivacyBarra';
  const FUNZIONE = 'https://mvuiuwakuseockotlcnp.supabase.co/functions/v1/privacy';
  const MANDA = FUNZIONE + '?a=attesa';
  const ANNULLA = FUNZIONE + '?a=annulla';
  const MESI = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
  const LINGUA_DEL_PAESE = { IT: 'it', SM: 'it', VA: 'it', DE: 'de', AT: 'de', CH: 'de', LI: 'de', FR: 'fr', BE: 'fr', LU: 'fr', MC: 'fr' };
  /* il prefisso del telefono quando il paese manca o non dice niente:
     un ospite di lingua tedesca con residenza italiana (Alto Adige) e'
     normale qui, e finiva in inglese (4 settembre 2026) */
  const LINGUA_DEL_PREFISSO = [[/^\+?(49|43|41|423)/, 'de'], [/^\+?(33|32|352|377)/, 'fr'], [/^\+?39/, 'it']];

  const iso = (anno, mese, giorno) => (anno && MESI[mese] && giorno) ? `${anno}-${String(MESI[mese]).padStart(2, '0')}-${String(giorno).padStart(2, '0')}` : null;
  /* Fidra scrive «Cognome Nome»: la prima parola e' il cognome */
  const spezza = (intero) => { const p = String(intero || '').trim().split(/\s+/); return { cognome: p[0] || '', nome: p.slice(1).join(' ') }; };

  /** Un'attesa per ogni camera assegnata: l'ospite della camera, se Fidra lo
      dice, altrimenti l'intestatario; l'email solo sulla prima. */
  function linguaDi(d) {
    const dalPaese = LINGUA_DEL_PAESE[String(d.paese || '').toUpperCase()];
    const tel = String(d.telefono || '').replace(/[^\d+]/g, '');
    const dalTelefono = (LINGUA_DEL_PREFISSO.find(([re]) => re.test(tel)) || [])[1];
    /* il telefono batte il paese quando dicono cose diverse: chi chiama da
       un numero tedesco parla tedesco anche se abita a Bolzano */
    if (dalTelefono && dalTelefono !== 'it') return dalTelefono;
    return dalPaese || dalTelefono || 'it';
  }

  function attese(d) {
    const lingua = linguaDi(d);
    const arrivo = iso(d.anno, d.mese, d.giornoArrivo);
    const partenza = iso(d.annoPartenza || d.anno, d.mesePartenza || d.mese, d.giornoPartenza);
    /* UNA FIRMA PER PERSONA, non per camera: in doppia dormono in due e
       il consenso di uno non vale per l'altro (la proprieta', 4 settembre
       2026). L'email va solo al primo, che e' l'intestatario. */
    const fuori = [];
    for (const c of (d.camere || []).filter((x) => x.numero)) {
      const gente = (c.ospiti || []).filter((n) => String(n || '').trim());
      for (const nome of (gente.length ? gente : [d.intestatario])) {
        const chi = spezza(nome);
        if (!chi.cognome) continue;
        fuori.push({
          camera: String(c.numero), cognome: chi.cognome, nome: chi.nome,
          email: fuori.length === 0 ? (d.email || null) : null,
          lingua, fidra_prenotazione: d.id ? String(d.id) : null, arrivo, partenza,
        });
      }
    }
    return fuori;
  }

  /* gli ultimi consensi mandati, per poterli togliere subito se ci si e'
     sbagliati; dopo tre minuti sparirebbero da soli dall'elenco */
  let ultimi = [];

  /* Quando l'estensione si aggiorna, le pagine gia' aperte restano con la
     vecchia in pancia e chrome.storage smette di rispondere: «Extension
     context invalidated». Non e' un guasto, ma va detto in italiano, con
     il rimedio (4 settembre 2026). */
  const vecchia = (e) => /Extension context invalidated|context invalidated/i.test(String(e && e.message || e));
  const AVVISO_VECCHIA = 'L’estensione è stata aggiornata: ricarichi questa pagina di Fidra (F5) e riprovi.';

  async function chiave(dillo) {
    let hotelKey;
    try { ({ hotelKey } = await chrome.storage.local.get(['hotelKey'])); }
    catch (e) { dillo(vecchia(e) ? AVVISO_VECCHIA : 'Errore: ' + e.message); return null; }
    if (!hotelKey) { dillo('Serve la chiave hotel: la si imposta nel pannello dell\'estensione (Chiave hotel...).'); return null; }
    return hotelKey;
  }

  async function manda(esito, destinazione, annulla, campoLingua) {
    const dillo = (m) => { esito.textContent = m; };
    const hotelKey = await chiave(dillo);
    if (!hotelKey) return;
    const d = estrai();
    if (!d || !d.ok) { dillo('Non riesco a leggere la prenotazione.'); return; }
    /* la lingua indovinata si puo' correggere prima di mandare: Fidra non
       la dice, e il paese non basta (un tedesco di Bolzano) */
    const lista = attese(d).map((a) => ({ ...a, lingua: campoLingua.value || a.lingua }));
    if (!lista.length) { dillo('Nessuna camera assegnata: assegni la camera, poi prema di nuovo.'); return; }
    dillo('Mando...');
    const fatte = [];
    ultimi = [];
    for (const a of lista) {
      const r = await fetch(MANDA, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hotel-key': hotelKey }, body: JSON.stringify({ ...a, destinazione }) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) { dillo('Chiave hotel sbagliata: la si reimposta nel pannello dell\'estensione.'); return; }
      if (!r.ok) { dillo('Errore: ' + (j.errore || r.status)); return; }
      if (j.id) ultimi.push(j.id);
      fatte.push(`camera ${a.camera} · ${a.cognome} ${a.nome}`.trim());
    }
    dillo(fatte.join('; ') + (destinazione === 'totem'
      ? '. Ora l\'ospite passa la tessera della camera al totem in hall.'
      : '. Compare sull\'iPad per tre minuti: la reception lo tocca e passa il tablet all\'ospite.'));
    annulla.hidden = false;
  }

  async function togli(esito, annulla) {
    const dillo = (m) => { esito.textContent = m; };
    if (!ultimi.length) { dillo('Niente da togliere.'); return; }
    const hotelKey = await chiave(dillo);
    if (!hotelKey) return;
    for (const id of ultimi) {
      await fetch(ANNULLA, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hotel-key': hotelKey }, body: JSON.stringify({ id }) });
    }
    ultimi = [];
    annulla.hidden = true;
    dillo('Tolto: non compare piu\' ne\' sull\'iPad ne\' col passaggio della tessera.');
  }

  const NOMI_LINGUA = { it: 'Italiano', en: 'English', de: 'Deutsch', fr: 'Français' };

  function metti() {
    if (document.getElementById(ID)) return;
    if (typeof estrai !== 'function') return;
    const barra = document.createElement('div');
    barra.id = ID;
    barra.style.cssText = 'position:fixed;left:14px;bottom:14px;z-index:99999;background:#1A3626;color:#fff;padding:8px 12px;border-radius:8px;font:14px system-ui,sans-serif;display:flex;gap:10px;align-items:center;box-shadow:0 2px 8px rgba(0,0,0,.25);max-width:560px;';
    const esito = document.createElement('span');
    esito.style.cssText = 'flex-basis:100%;';
    const annulla = document.createElement('button');
    annulla.type = 'button';
    annulla.textContent = 'Annulla';
    annulla.hidden = true;
    annulla.title = 'Toglie subito il consenso in attesa appena mandato.';
    annulla.style.cssText = 'font:inherit;padding:6px 10px;border-radius:6px;border:1px solid #fff;background:transparent;color:#fff;cursor:pointer;white-space:nowrap;';
    annulla.onclick = () => { annulla.disabled = true; togli(esito, annulla).catch((e) => { esito.textContent = vecchia(e) ? AVVISO_VECCHIA : 'Errore: ' + e.message; }).finally(() => { annulla.disabled = false; }); };
    /* due strade per lo stesso consenso: l'iPad che la reception porge, o
       il totem in hall dove l'ospite passa la tessera da solo */
    const lingua = document.createElement('select');
    lingua.id = 'leoPrivacyLingua';
    lingua.title = 'La lingua del modulo. La indovino dal paese e dal telefono: se sbaglio, la corregga qui prima di mandare.';
    lingua.style.cssText = 'font:inherit;padding:5px 8px;border-radius:6px;border:0;';
    let indovinata = 'it';
    try { const d = estrai(); if (d && d.ok) indovinata = linguaDi(d); } catch (e) { /* la barra si mette lo stesso */ }
    for (const [k, n] of Object.entries(NOMI_LINGUA)) {
      const o = document.createElement('option');
      o.value = k; o.textContent = n; o.selected = k === indovinata;
      lingua.appendChild(o);
    }
    const pulsante = (testo, destinazione, titolo) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = testo;
      b.title = titolo;
      b.style.cssText = 'font:inherit;padding:6px 10px;border-radius:6px;border:0;background:#C9A961;color:#1A3626;cursor:pointer;white-space:nowrap;';
      b.onclick = () => { b.disabled = true; manda(esito, destinazione, annulla, lingua).catch((e) => { esito.textContent = vecchia(e) ? AVVISO_VECCHIA : 'Errore: ' + e.message; }).finally(() => { b.disabled = false; }); };
      return b;
    };
    barra.append(lingua,
      pulsante('Privacy all’iPad', 'ipad', 'Mette l’ospite nell’elenco dell’iPad della reception, per tre minuti. Non scrive niente in Fidra.'),
      pulsante('Privacy al totem', 'totem', 'L’ospite passa la tessera al totem in hall e trova il modulo compilato. Non scrive niente in Fidra.'),
      annulla, esito);
    document.body.appendChild(barra);
    const stile = document.createElement('style');
    stile.textContent = '@media print{#' + ID + '{display:none !important;}}';
    document.head.appendChild(stile);
  }

  /* Fidra si ridisegna da sola: si riguarda ogni tanto */
  metti();
  setInterval(metti, 1500);
})();
