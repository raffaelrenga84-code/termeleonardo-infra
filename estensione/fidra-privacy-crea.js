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
      /* la ricerca dell'ospite da abbinare, se e' un campo di testo: si scrive il cognome e la scelta resta all'operatore */
      abbinamento:   campoConEtichetta(radice, /abbinamento/i),
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
  /* I tre consensi del modulo di Fidra (visto il 5 settembre 2026) sono tre
     domande numerate, ognuna con due radio «Autorizzo / Non autorizzo»:
     1. comunicazione esterna per ricevere messaggi e telefonate = messaggi;
     2. conservazione delle generalita' = conservazione;
     3. invio di tariffe e offerte = marketing.
     La domanda si riconosce dalle parole; i radio sono il primo gruppo che
     viene dopo di lei nella pagina. */
  const DOMANDE = [
    ['messaggi', /messaggi e telefonate|telefonate a me|Nachrichten und Anrufe|messages and (phone )?calls|messages et (des )?appels/i],
    ['conservazione', /conservazione delle mie generalit|Aufbewahrung|storage of my|conservation de mes/i],
    ['marketing', /tariffe e sulle offerte|offerte praticate|Tarife und Angebote|rates and offers|tarifs et (les )?offres/i],
  ];
  function radioDomanda(radice, parole) {
    const domanda = [...radice.querySelectorAll('p, div, span, label, li, h3, h4')]
      .find((el) => el.children.length <= 3 && (el.textContent || '').length < 400 && parole.test((el.textContent || '').trim()) && !el.querySelector('input'));
    if (!domanda) return null;
    const tutti = [...radice.querySelectorAll('input[type="radio"]')];
    const primo = tutti.find((r) => domanda.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING);
    if (!primo) return null;
    const gruppo = primo.name ? tutti.filter((r) => r.name === primo.name) : tutti.slice(tutti.indexOf(primo), tutti.indexOf(primo) + 2);
    const testoDi = (r) => ((r.closest('label') || r.parentElement || r).textContent || '').trim();
    const no = gruppo.find((r) => /^non|nicht|not|^ne |n.autorise pas|do not/i.test(testoDi(r)));
    const si = gruppo.find((r) => r !== no) || null;
    return si && no ? { si, no } : null;
  }
  function scegliRadio(r) {
    if (r.checked) return;
    r.checked = true;
    r.dispatchEvent(new Event('input', { bubbles: true }));
    r.dispatchEvent(new Event('change', { bubbles: true }));
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
  /* I tratti della firma, riga per riga: ogni corsa di pixel scuri
     dell'immagine diventa un tratto (pointerdown, pointermove..., pointerup
     e lo stesso coi mouse events), in coordinate dello schermo. Al massimo
     ~4000 eventi: se la firma e' fitta si saltano piu' righe. */
  function ridisegnaConIlDito(canvas, img, offX, offY, scala) {
    const letto = document.createElement('canvas');
    letto.width = img.width; letto.height = img.height;
    const c2 = letto.getContext('2d');
    if (!c2) return 0;
    c2.drawImage(img, 0, 0);
    const px = c2.getImageData(0, 0, letto.width, letto.height).data;
    const scuro = (x, y) => { const i = (y * letto.width + x) * 4; return px[i + 3] > 80 && (px[i] + px[i + 1] + px[i + 2]) < 450; };
    const corse = [];
    for (let passo = 3; passo <= 12; passo *= 2) {
      corse.length = 0;
      for (let y = 0; y < letto.height; y += passo) {
        let inizio = -1;
        for (let x = 0; x <= letto.width; x++) {
          const s = x < letto.width && scuro(x, y);
          if (s && inizio < 0) inizio = x;
          if (!s && inizio >= 0) { corse.push([inizio, x - 1, y]); inizio = -1; }
        }
      }
      if (corse.length * 3 <= 4000) break;
    }
    const r = canvas.getBoundingClientRect();
    const sx = r.width / canvas.width, sy = r.height / canvas.height;
    const punto = (x, y) => ({ clientX: r.left + (offX + x * scala) * sx, clientY: r.top + (offY + y * scala) * sy });
    const manda = (tipo, p) => {
      const base = { bubbles: true, cancelable: true, clientX: p.clientX, clientY: p.clientY, button: 0, buttons: tipo.endsWith('up') ? 0 : 1 };
      if (window.PointerEvent) canvas.dispatchEvent(new PointerEvent('pointer' + tipo, { ...base, pointerId: 1, pointerType: 'pen', isPrimary: true, pressure: tipo.endsWith('up') ? 0 : 0.5 }));
      canvas.dispatchEvent(new MouseEvent('mouse' + tipo, base));
    };
    let eventi = 0;
    for (const [x0, x1, y] of corse) {
      manda('down', punto(x0, y)); eventi++;
      for (let x = x0 + 2; x < x1; x += 2) { manda('move', punto(x, y)); eventi++; }
      manda('move', punto(x1, y)); manda('up', punto(x1, y)); eventi += 2;
    }
    return eventi;
  }
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
        const offX = (canvas.width - w) / 2, offY = (canvas.height - h) / 2;
        ctx.drawImage(img, offX, offY, w, h);
        /* Il blocco firma di Fidra (un signature pad) tiene i tratti per
           conto suo: un'immagine disegnata sul canvas la vede l'occhio, non
           lui, e la firma «non la riconosce»: la reception doveva fare un
           punto a mano prima di Salva (la proprieta', 5 settembre 2026).
           Allora la firma la si RIDISEGNA come farebbe un dito: la si legge
           pixel per pixel e ogni tratto scuro diventa una corsa di eventi
           pointer e mouse sul canvas (il pad ascolta gli uni o gli altri,
           a seconda della versione; quelli che non ascolta cadono nel
           vuoto). Cosi' isEmpty() e' falso e toData() porta la firma vera.
           Non e' un clic: Salva resta della reception. */
        ridisegnaConIlDito(canvas, img, offX, offY, w / img.width);
        for (const t of ['change']) canvas.dispatchEvent(new Event(t, { bubbles: true }));
        risolvi(true);
      };
      img.onerror = () => risolvi(false);
      img.src = dataUrl;
    });
  }

  /* il consenso da compilare: ?leo= nell'indirizzo, oppure quello messo da
     parte prima di scegliere la lingua (la scelta puo' cambiare indirizzo) */
  const leoScelto = () => {
    const dalUrl = new URLSearchParams(location.search).get('leo');
    if (dalUrl) { try { sessionStorage.setItem('leoPrivacy', dalUrl); } catch (e) { /* senza memoria si va avanti lo stesso */ } return dalUrl; }
    try { return sessionStorage.getItem('leoPrivacy'); } catch (e) { return null; }
  };
  /* Il modulo di Fidra parte dalla scelta della lingua (ITA · DEU · ENG · FRA):
     e' la lingua dell'ospite, che conosciamo, e senza sceglierla i campi non
     compaiono. E' l'unico tocco che l'estensione da' su Fidra: non salva, non
     manda niente — apre la pagina seguente del modulo (5 settembre 2026). */
  const SIGLA = { it: /^ita/i, de: /^deu/i, en: /^eng/i, fr: /^fra/i };
  function scegliLingua(lingua) {
    const re = SIGLA[lingua] || SIGLA.it;
    const b = [...document.querySelectorAll('button, a')].find((el) => re.test((el.textContent || '').trim()) && (el.textContent || '').trim().length <= 4);
    if (!b) return false;
    b.click();
    return true;
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
  async function consensoDi(id, hotelKey) {
    const r = await fetch(STATO + '&id=' + encodeURIComponent(id), { headers: { 'x-hotel-key': hotelKey } });
    if (!r.ok) return null;
    const j = await r.json();
    return (j.consensi || []).find((c) => c.stato === 'firmato') || null;
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
    const testo = (nome, campo, valore, facoltativo) => {
      if (!valore) return;
      if (!campo) { if (!facoltativo) saltati.push(nome + ' (campo non trovato)'); return; }
      if ((campo.value || '').trim()) { saltati.push(nome + ' (gia scritto)'); return; }
      scriviNativo(campo, valore); scritti.push(nome);
    };
    const giorno = String(c.firmato_il || '').slice(0, 10);
    testo('data', f.data, f.data && f.data.type === 'date' ? giorno : italiana(giorno), true);
    testo('cognome', f.cognome, c.cognome);
    testo('nome', f.nome, c.nome);
    testo('email', f.email, c.email);
    /* la domanda 1 (messaggi e telefonate) nel nostro modulo non c'e' piu': la
       proprieta' l'ha tolta «per toglierci dai problemi» e ha chiesto di mettere
       «Autorizzo» da soli (5 settembre 2026). Se un consenso vecchio la porta,
       vale quella. */
    const valori = {
      messaggi: c.messaggi === null || c.messaggi === undefined ? true : !!c.messaggi,
      conservazione: !!c.conservazione,
      marketing: !!c.marketing,
    };
    for (const [k, nome] of [['messaggi', 'telefono e messaggi'], ['conservazione', 'dati'], ['marketing', 'offerte']]) {
      const parole = (DOMANDE.find(([x]) => x === k) || [])[1];
      const radio = parole ? radioDomanda(radice, parole) : null;
      if (radio) { scegliRadio(valori[k] ? radio.si : radio.no); scritti.push(nome + (valori[k] ? ' sì' : ' no')); continue; }
      if (!f[k]) { saltati.push(nome + ' (domanda non trovata)'); continue; }
      spunta(f[k], valori[k]); scritti.push(nome + (valori[k] ? ' sì' : ' no'));
    }
    if (f.abbinamento && !(f.abbinamento.value || '').trim()) { scriviNativo(f.abbinamento, c.cognome); scritti.push('ricerca ospite'); }
    const firma = await firmaDi(c.id, hotelKey);
    const disegnata = await disegnaFirma(radice, firma);
    if (disegnata) scritti.push('firma'); else saltati.push('firma (riquadro non trovato)');
    /* chi e' l'ospite, per l'abbinamento dopo Salva (fidra-privacy-abbina.js) */
    try { sessionStorage.setItem('leoAbbina', JSON.stringify({ leo: c.id, cognome: c.cognome || '', nome: c.nome || '', camera: c.camera || '', quando: Date.now() })); } catch (e) { /* senza memoria si abbina a mano */ }
    aspettaSalvato(radice);
    return { scritti, saltati };
  }

  /* Dopo «Salva» Fidra dice «successo» e la privacy esiste, ma slegata
     dall'ospite: bisognava aprire l'elenco, la riga, e premere Abbina
     («molti passaggi, troppo macchinoso», la proprieta', 5 settembre 2026).
     Da qui in poi lo fa l'estensione: appena il modulo sparisce e la pagina
     dice che ha salvato, si va all'elenco, e fidra-privacy-abbina.js
     continua. innerText e non textContent: i messaggi nascosti nel DOM non
     contano, solo quello che si vede. */
  let orologioSalvato = null;
  function aspettaSalvato(radice) {
    clearInterval(orologioSalvato);
    const inizio = Date.now();
    orologioSalvato = setInterval(() => {
      if (Date.now() - inizio > 15 * 60 * 1000) { clearInterval(orologioSalvato); return; }
      if (campi(radice).cognome) return;
      if (!/succes|salvat/i.test(document.body.innerText || '')) return;
      clearInterval(orologioSalvato);
      location.href = 'https://leonardo.fidra.cloud/privacy';
    }, 800);
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
        <div style="padding-top:6px;color:#8C8578;font-size:12px;">Un tocco riempie i campi vuoti e disegna la firma. <strong>Salva</strong> lo premi tu; dopo, l&rsquo;abbinamento all&rsquo;ospite lo fa l&rsquo;estensione da sola.</div>`;
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
    /* aperto da «Registra in Fidra» sulla prenotazione: si compila da solo
       («meno lavoro possibile alla reception», la proprieta', 5 settembre 2026) */
    const leo = leoScelto();
    if (leo) {
      const e = box.querySelector('#' + ID + 'Esito');
      e.textContent = 'Compilo…';
      try {
        const c = await consensoDi(leo, hotelKey);
        if (!c) { e.textContent = 'Consenso non trovato: scelga dalla riga qui sopra.'; return; }
        const r = await riempi(radice, c, hotelKey);
        e.textContent = 'Compilato: ' + r.scritti.join(', ') + (r.saltati.length ? ' · lasciati stare: ' + r.saltati.join(', ') : '') + '. Controlli e prema Salva: all’abbinamento con l’ospite pensa l’estensione.';
      } catch (err) { e.textContent = 'Errore: ' + err.message; }
    }
  }

  /* Livewire disegna il modulo dopo il caricamento, e prima chiede la lingua:
     si sceglie quella dell'ospite (se c'e' un consenso da compilare) e si
     aspetta che compaiano i campi */
  let tentativi = 0, linguaScelta = false, linguaDelConsenso = null;
  const leoIniziale = leoScelto();
  const attesa = setInterval(async () => {
    const radice = document.querySelector('form') || document.querySelector('main') || document.body;
    const c = campi(radice);
    if (c.cognome && c.nome) { clearInterval(attesa); mostra(radice); return; }
    if (!linguaScelta) {
      if (linguaDelConsenso === null && leoIniziale) {
        linguaDelConsenso = 'it';
        const hotelKey = await chiave();
        const cons = hotelKey ? await consensoDi(leoIniziale, hotelKey) : null;
        if (cons && cons.lingua) linguaDelConsenso = cons.lingua;
      }
      if (linguaDelConsenso !== null) linguaScelta = scegliLingua(linguaDelConsenso);
    }
    if (++tentativi > 120) clearInterval(attesa);
  }, 500);
})();
