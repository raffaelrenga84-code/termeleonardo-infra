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
  const FUNZIONE = 'https://mvuiuwakuseockotlcnp.supabase.co/functions/v1/privacy?a=attesa';
  const MESI = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
  const LINGUA_DEL_PAESE = { IT: 'it', SM: 'it', DE: 'de', AT: 'de', CH: 'de', LI: 'de', FR: 'fr', BE: 'fr', LU: 'fr', MC: 'fr' };

  const iso = (anno, mese, giorno) => (anno && MESI[mese] && giorno) ? `${anno}-${String(MESI[mese]).padStart(2, '0')}-${String(giorno).padStart(2, '0')}` : null;
  /* Fidra scrive «Cognome Nome»: la prima parola e' il cognome */
  const spezza = (intero) => { const p = String(intero || '').trim().split(/\s+/); return { cognome: p[0] || '', nome: p.slice(1).join(' ') }; };

  /** Un'attesa per ogni camera assegnata: l'ospite della camera, se Fidra lo
      dice, altrimenti l'intestatario; l'email solo sulla prima. */
  function attese(d) {
    const lingua = LINGUA_DEL_PAESE[String(d.paese || '').toUpperCase()] || 'en';
    const arrivo = iso(d.anno, d.mese, d.giornoArrivo);
    const partenza = iso(d.annoPartenza || d.anno, d.mesePartenza || d.mese, d.giornoPartenza);
    return (d.camere || []).filter((c) => c.numero).map((c, i) => {
      const chi = spezza((c.ospiti && c.ospiti[0]) || d.intestatario);
      return { camera: String(c.numero), cognome: chi.cognome, nome: chi.nome, email: i === 0 ? (d.email || null) : null, lingua, fidra_prenotazione: d.id ? String(d.id) : null, arrivo, partenza };
    });
  }

  async function manda(esito, b) {
    const dillo = (m) => { esito.textContent = m; };
    const { hotelKey } = await chrome.storage.local.get(['hotelKey']);
    if (!hotelKey) { dillo('Serve la chiave hotel: la si imposta nel pannello dell\'estensione (Chiave hotel...).'); return; }
    const d = estrai();
    if (!d || !d.ok) { dillo('Non riesco a leggere la prenotazione.'); return; }
    const lista = attese(d);
    if (!lista.length) { dillo('Nessuna camera assegnata: assegni la camera, poi prema di nuovo.'); return; }
    dillo('Mando...');
    const fatte = [];
    for (const a of lista) {
      const r = await fetch(FUNZIONE, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hotel-key': hotelKey }, body: JSON.stringify(a) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) { dillo('Chiave hotel sbagliata: la si reimposta nel pannello dell\'estensione.'); return; }
      if (!r.ok) { dillo('Errore: ' + (j.errore || r.status)); return; }
      fatte.push(`camera ${a.camera} · ${a.cognome} ${a.nome}`.trim());
    }
    dillo('In attesa al totem: ' + fatte.join('; ') + '. L\'ospite passa la tessera al totem, o la reception lo sceglie sull\'iPad.');
    b.textContent = 'Privacy al totem ✓';
  }

  function metti() {
    if (document.getElementById(ID)) return;
    if (typeof estrai !== 'function') return;
    const barra = document.createElement('div');
    barra.id = ID;
    barra.style.cssText = 'position:fixed;top:8px;right:16px;z-index:99999;background:#1A3626;color:#fff;padding:8px 12px;border-radius:8px;font:14px system-ui,sans-serif;display:flex;gap:10px;align-items:center;box-shadow:0 2px 8px rgba(0,0,0,.25);max-width:560px;';
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Privacy al totem';
    b.title = 'Manda i dati della prenotazione al totem e agli iPad per il consenso privacy. Non scrive niente in Fidra.';
    b.style.cssText = 'font:inherit;padding:6px 10px;border-radius:6px;border:0;background:#C9A961;color:#1A3626;cursor:pointer;white-space:nowrap;';
    const esito = document.createElement('span');
    b.onclick = () => { b.disabled = true; manda(esito, b).catch((e) => { esito.textContent = 'Errore: ' + e.message; }).finally(() => { b.disabled = false; }); };
    barra.append(b, esito);
    document.body.appendChild(barra);
    const stile = document.createElement('style');
    stile.textContent = '@media print{#' + ID + '{display:none !important;}}';
    document.head.appendChild(stile);
  }

  /* Fidra si ridisegna da sola: si riguarda ogni tanto */
  metti();
  setInterval(metti, 1500);
})();
