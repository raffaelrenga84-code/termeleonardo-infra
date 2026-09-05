/* ============================================================
   Offerta Leonardo — la privacy firmata da noi, nel registro di Fidra (v2.41)
   ------------------------------------------------------------
   PERCHE' ESISTE. Fidra tiene un suo registro delle privacy
   (leonardo.fidra.cloud/privacy): il check-in online lo riempie da solo,
   e la reception lo riempie a mano con privacy/create — cognome, nome,
   email, data, tre consensi, la firma nel riquadro. Le nostre firme
   (iPad e totem) vivono da noi, e in quel registro non ci finivano: «le
   email della privacy non riusciamo a importarle in Fidra?» (la
   proprieta', 5 settembre 2026).

   COSA FA. Sul modulo di Fidra compare una riga con le firme del giorno
   raccolte da noi. Un tocco riempie i campi vuoti e disegna la firma nel
   riquadro. NON salva niente: l'abbinamento all'ospite e «Salva» sono
   dell'operatore, come per il cliente nuovo (fidra-nuovo-cliente.js).
   Sola lettura verso la nostra funzione, con la chiave hotel.
   ============================================================ */
(() => {
  const ID = 'leoPrivacyCrea';
  const FUNZIONE = 'https://mvuiuwakuseockotlcnp.supabase.co/functions/v1/privacy';
  const STATO = FUNZIONE + '?a=stato';
  const FIRMA = FUNZIONE + '?a=firma-di';
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  /* en-CA scrive le date come AAAA-MM-GG, nell'ora dell'hotel */
  const oggiRoma = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const ora = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }); };
  const italiana = (aaaammgg) => { const [a, m, g] = String(aaaammgg).split('-'); return `${g}/${m}/${a}`; };

  /* ---------- i campi di Fidra, dalla loro etichetta ---------- */
  function campoConEtichetta(radice, parole, tipo) {
    const et = [...radice.querySelectorAll('label, div, span, p')]
      .find((el) => !el.children.length && parole.test((el.textContent || '').trim()));
    if (!et) return null;
    if (et.tagName === 'LABEL' && et.htmlFor) { const c = document.getElementById(et.htmlFor); if (c) return c; }
    let su = et.parentElement;
    for (let i = 0; i < 4 && su && su !== radice.parentElement; i++, su = su.parentElement) {
      const c = su.querySelector(tipo === 'spunta' ? 'input[type="checkbox"]' : 'input:not([type="checkbox"]):not([type="hidden"]), select, textarea');
      if (c) return c;
    }
    return null;
  }
  function campi(radice) {
    return {
      data:     campoConEtichetta(radice, /data (del )?consenso/i),
      cognome:  campoConEtichetta(radice, /^cognome$/i),
      nome:     campoConEtichetta(radice, /^nome$/i),
      email:    campoConEtichetta(radice, /^e-?mail$/i),
      /* i tre consensi di Fidra, con i nostri: telefono e messaggi = messaggi,
         dati = conservazione, newsletter = marketing */
      messaggi:      campoConEtichetta(radice, /telefono e messaggi/i, 'spunta'),
      conservazione: campoConEtichetta(radice, /consenso dati/i, 'spunta'),
      marketing:     campoConEtichetta(radice, /newsletter/i, 'spunta'),
    };
  }

  /* i componenti di Fidra (Livewire) non si accorgono di un .value
     assegnato: si scrive col setter nativo e si mandano input e change */
  function scriviNativo(el, valore) {
    const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype
                : el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype
                : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, valore); else el.value = valore;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function spunta(el, voluto) {
    if (el.checked === !!voluto) return;
    el.checked = !!voluto;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /* la firma dell'ospite, disegnata nel riquadro di Fidra: centrata, senza
     deformarla. Se Fidra all'invio legge il canvas, la firma parte con il
     resto; se legge solo i tratti fatti col dito, chiede di rifirmare —
     lo dice l'esito, e l'operatore lo vede prima di salvare. */
  function disegnaFirma(radice, dataUrl) {
    return new Promise((risolvi) => {
      const canvas = radice.querySelector('canvas');
      if (!canvas || !dataUrl) return risolvi(false);
      const img = new Image();
      img.onload = () => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return risolvi(false);
        const scala = Math.min(canvas.width / img.width, canvas.height / img.height) * 0.9;
        const w = img.width * scala, h = img.height * scala;
        ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
        for (const t of ['pointerup', 'mouseup', 'touchend', 'change']) canvas.dispatchEvent(new Event(t, { bubbles: true }));
        risolvi(true);
      };
      img.onerror = () => risolvi(false);
      img.src = dataUrl;
    });
  }

  async function chiave() {
    try { const { hotelKey } = await chrome.storage.local.get(['hotelKey']); return hotelKey || null; } catch (e) { return null; }
  }
  async function firmeDelGiorno(giorno, hotelKey) {
    const r = await fetch(STATO + '&giorno=' + encodeURIComponent(giorno), { headers: { 'x-hotel-key': hotelKey } });
    if (!r.ok) throw new Error('stato ' + r.status);
    const j = await r.json();
    return (j.consensi || []).filter((c) => c.stato === 'firmato');
  }
  async function firmaDi(id, hotelKey) {
    const r = await fetch(FIRMA + '&id=' + encodeURIComponent(id), { headers: { 'x-hotel-key': hotelKey } });
    if (!r.ok) return null;
    const j = await r.json();
    return j.firma || null;
  }

  async function riempi(radice, c, hotelKey) {
    const f = campi(radice);
    const scritti = [], saltati = [];
    const testo = (nome, campo, valore) => {
      if (!valore) return;
      if (!campo) { saltati.push(nome + ' (campo non trovato)'); return; }
      if ((campo.value || '').trim()) { saltati.push(nome + ' (gia scritto)'); return; }
      scriviNativo(campo, valore); scritti.push(nome);
    };
    const giorno = String(c.firmato_il || '').slice(0, 10);
    testo('data', f.data, f.data && f.data.type === 'date' ? giorno : italiana(giorno));
    testo('cognome', f.cognome, c.cognome);
    testo('nome', f.nome, c.nome);
    testo('email', f.email, c.email);
    for (const [k, nome] of [['messaggi', 'telefono e messaggi'], ['conservazione', 'dati'], ['marketing', 'newsletter']]) {
      if (!f[k]) { saltati.push(nome + ' (spunta non trovata)'); continue; }
      spunta(f[k], c[k]); scritti.push(nome + (c[k] ? ' sì' : ' no'));
    }
    const firma = await firmaDi(c.id, hotelKey);
    const disegnata = await disegnaFirma(radice, firma);
    if (disegnata) scritti.push('firma'); else saltati.push('firma (riquadro non trovato)');
    return { scritti, saltati };
  }

  /* ---------- la riga sopra il modulo ---------- */
  async function mostra(radice) {
    if (document.getElementById(ID)) return;
    const hotelKey = await chiave();
    if (!hotelKey) return;
    const box = document.createElement('div');
    box.id = ID;
    box.style.cssText = 'margin:0 0 14px 0;padding:10px 14px;background:#EAF4F5;border-left:4px solid #1E7F88;border-radius:4px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#2A2E2B;';
    const primo = radice.querySelector('input');
    const dove = (primo && primo.closest('div')) || radice;
    (dove.parentElement || radice).insertBefore(box, dove);
    let giorno = oggiRoma();
    const disegna = async () => {
      let firme = [];
      let errore = '';
      try { firme = await firmeDelGiorno(giorno, hotelKey); } catch (e) { errore = e.message; }
      box.innerHTML = `
        <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#1E7F88;">Firme raccolte da noi (iPad e totem)</div>
        <div style="padding-top:6px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <input type="date" id="${ID}Giorno" value="${esc(giorno)}" style="font:inherit;padding:4px 6px;border:1px solid #C9C3B8;border-radius:5px;" />
          ${errore ? `<span style="color:#8C2F28;">${esc(errore)}</span>` : ''}
          ${firme.map((c) => `<button type="button" data-id="${esc(c.id)}" style="cursor:pointer;background:#1E7F88;color:#fff;border:none;border-radius:5px;padding:6px 12px;font-size:13px;">${esc(c.cognome)} ${esc(c.nome || '')} · ${esc(ora(c.firmato_il))} · ${c.fonte === 'totem' ? 'totem' : 'iPad'} · cam. ${esc(c.camera)}</button>`).join('')}
          ${!firme.length && !errore ? '<span style="color:#7B756A;">nessuna firma in questo giorno</span>' : ''}
        </div>
        <div id="${ID}Esito" style="padding-top:6px;color:#55524B;"></div>
        <div style="padding-top:6px;color:#8C8578;font-size:12px;">Un tocco riempie i campi vuoti e disegna la firma. L&rsquo;abbinamento all&rsquo;ospite e <strong>Salva</strong> li fai tu; se Fidra non accetta la firma disegnata, l&rsquo;ospite rifirma qui.</div>`;
      box.querySelector('#' + ID + 'Giorno').addEventListener('change', (ev) => { giorno = ev.target.value || giorno; disegna(); });
      box.querySelectorAll('button[data-id]').forEach((b) => b.addEventListener('click', async () => {
        const c = firme.find((x) => x.id === b.dataset.id);
        const e = box.querySelector('#' + ID + 'Esito');
        e.textContent = 'Scrivo…';
        try {
          const r = await riempi(radice, c, hotelKey);
          e.textContent = (r.scritti.length ? 'Scritti: ' + r.scritti.join(', ') : 'Niente da scrivere') + (r.saltati.length ? ' · lasciati stare: ' + r.saltati.join(', ') : '');
        } catch (err) { e.textContent = 'Errore: ' + err.message; }
      }));
    };
    await disegna();
  }

  /* Livewire disegna il modulo dopo il caricamento: si aspetta che ci siano i campi */
  let tentativi = 0;
  const attesa = setInterval(() => {
    const radice = document.querySelector('form') || document.querySelector('main') || document.body;
    const c = campi(radice);
    if (c.cognome && c.nome) { clearInterval(attesa); mostra(radice); return; }
    if (++tentativi > 40) clearInterval(attesa);
  }, 500);
})();
