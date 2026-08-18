/* ============================================================
   Offerta Leonardo — Bozza in Fidra dal centralino (v1.1.1)
   ------------------------------------------------------------
   Gira su leonardo.fidra.cloud/booking. Se in chrome.storage c'è
   una richiesta del centralino (salvata dal pulsante in Outlook),
   mostra un pannello laterale con i dati e compila il modulo:
   Sorgente, Adulti/Bambini, ricerca Cliente. Le date prova a
   impostarle dal calendario; se non riesce, lo dice.

   REGOLE DI SICUREZZA:
   - non salva MAI la prenotazione: l'ultimo clic è dell'operatore
   - non seleziona MAI un cliente dai risultati: sceglie l'operatore
   - dopo ogni azione rilegge la pagina e dichiara l'esito
   ============================================================ */

(() => {
  const CHIAVE = 'leonardo_bozza_centralino';
  const VALIDITA_MS = 30 * 60 * 1000;
  const MESI = ['', 'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
    'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const MESI_EN = ['', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  const attesa = (ms) => new Promise(r => setTimeout(r, ms));
  const dataIT = (d) => d ? `${d.g} ${MESI[d.m]} ${d.a}` : '—';

  function scriviNativo(input, valore) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, valore);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function foglia(testoEsatto) {
    return Array.from(document.querySelectorAll('*')).find(e =>
      e.children.length === 0 && (e.textContent || '').trim() === testoEsatto);
  }

  /* ---------- 1. Sorgente = Telefono ---------- */
  function impostaSorgente(nome) {
    const cercato = new RegExp('^' + (nome || 'Telefono') + '$', 'i');
    for (const sel of document.querySelectorAll('select')) {
      const opt = Array.from(sel.options).find(o => cercato.test(o.text.trim()));
      if (opt) {
        sel.value = opt.value;
        sel.dispatchEvent(new Event('input', { bubbles: true }));
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        return sel.options[sel.selectedIndex]?.text.trim() === opt.text.trim();
      }
    }
    return false;
  }

  /* ---------- 2. contatori Adulti / Bambini ----------
     Sono input numerici (name="adults"/"children") fra i pulsanti +/-:
     si scrive direttamente nell'input e si verifica rileggendolo. */
  function inputContatore(nome, etichetta) {
    let el = document.querySelector(`input[name="${nome}"]`);
    if (el) return el;
    const lab = foglia(etichetta);
    if (lab) el = (lab.closest('label') || lab.parentElement)?.querySelector('input[type="number"]');
    return el || null;
  }

  async function impostaContatore(nome, etichetta, obiettivo) {
    if (obiettivo == null) return null;
    const el = inputContatore(nome, etichetta);
    if (!el) return false;
    scriviNativo(el, String(obiettivo));
    await attesa(500);
    return String(el.value) === String(obiettivo);
  }

  /* ---------- 3. ricerca Cliente (senza auto-selezione) ---------- */
  function campoCliente() {
    const inputs = Array.from(document.querySelectorAll('input'))
      .filter(i => /cerca\s*cliente/i.test(i.placeholder || ''));
    return inputs[0] || null; // il primo è Cliente, il secondo Committente
  }

  async function cercaCliente(termine) {
    const box = campoCliente();
    if (!box || !termine) return false;
    box.focus();
    scriviNativo(box, termine);
    return true;
  }

  /* ---------- 4. date via flatpickr (collaudato dal vivo) ----------
     Il campo è un flatpickr: il modo affidabile è comandare il componente
     stesso con setDate(). L'istanza vive nel contesto della pagina, quindi
     il comando viene iniettato con un tag <script>; l'esito torna in un
     attributo data- sul body. */
  const iso = (d) => `${d.a}-${String(d.m).padStart(2, '0')}-${String(d.g).padStart(2, '0')}`;

  async function impostaDate(arrivo, partenza) {
    const a = iso(arrivo), p = iso(partenza);
    // il comando parte dal service worker via chrome.scripting (MAIN world):
    // immune alla CSP della pagina, che blocca gli script inline
    const ris = await new Promise(res =>
      chrome.runtime.sendMessage({ tipo: 'LEONARDO_SET_DATE', a, p }, r => res(r)));
    if (!ris || !ris.ok) return false;
    await attesa(900);
    const campo = document.querySelector('input.flatpickr-input');
    const v = (campo && campo.value) || ris.value || '';
    return v.includes(a) && v.includes(p);
  }

  /* ---------- 5. categoria camera e trattamento (v1.1.1) ----------
     La tessera viene cliccata solo se la richiesta nomina una categoria
     riconosciuta; mai le camere Accessibili. Il trattamento si imposta
     solo se il filtro arrangiamento e' una tendina verificabile. */
  const CATEGORIE_NOTE = ['matrimoniale queen', 'junior suite colli euganei',
    'junior suite abano', 'junior suite monteortone', 'suite colli euganei',
    'suite monteortone', 'singola senza balcone', 'singola parco', 'doppia', 'singola'];

  function categoriaRichiesta(d) {
    const testo = ((d.preferenza || '') + ' ' + (d.note || '')).toLowerCase();
    return CATEGORIE_NOTE.find(c => testo.includes(c)) || null;
  }

  async function selezionaCategoria(nome) {
    if (!nome) return null;
    const tessere = Array.from(document.querySelectorAll('div, button')).filter(e => {
      const t = (e.innerText || '').trim();
      return t.toLowerCase().startsWith(nome) && /Disponibili/i.test(t) &&
             t.length < 80 && !/accessibile/i.test(t);
    });
    // il contenitore piu' piccolo che rappresenta la tessera
    const tessera = tessere.sort((a, b) => (a.innerText || '').length - (b.innerText || '').length)[0];
    if (!tessera) return false;
    tessera.click();
    await attesa(700);
    return null; // cliccata: l'esito visivo lo verifica l'operatore
  }

  async function impostaTrattamento(nome) {
    if (!nome) return null;
    const cercaMP = /mezza\s*pensione/i.test(nome);
    const parola = cercaMP ? /mezza\s*pensione/i : /bed\s*(?:&|and|e)\s*breakfast|b\s*&\s*b/i;
    // 1) i pallini nella lista Prezzi: riga il cui testo e' il trattamento
    const foglie = Array.from(document.querySelectorAll('label, span, div')).filter(e =>
      e.children.length <= 1 && e.offsetParent && parola.test((e.innerText || '').trim()) &&
      (e.innerText || '').trim().length < 30);
    for (const f of foglie) {
      const riga = f.closest('label') || f.parentElement?.closest('div') || f.parentElement;
      const radio = (riga && riga.querySelector('input[type="radio"]')) ||
                    (f.parentElement && f.parentElement.querySelector('input[type="radio"]'));
      if (radio) {
        radio.click();
        await attesa(400);
        return radio.checked === true;
      }
    }
    // 2) riserva: SOLO la tendina del filtro arrangiamento (riconoscibile
    //    perche' contiene "Mezza Pensione"; mai quella della Sorgente)
    for (const sel of document.querySelectorAll('select')) {
      const testi = Array.from(sel.options).map(o => o.text);
      if (testi.some(x => /telefono/i.test(x))) continue;      // e' la Sorgente
      if (!testi.some(x => /mezza\s*pensione/i.test(x))) continue;
      const opt = Array.from(sel.options).find(o => parola.test(o.text));
      if (opt) {
        sel.value = opt.value;
        sel.dispatchEvent(new Event('input', { bubbles: true }));
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        return parola.test(sel.options[sel.selectedIndex]?.text || '');
      }
    }
    return false;
  }

  /* ---------- verifica finale dalla barra riepilogo ---------- */
  function riepilogoPagina() {
    const m = (document.body.innerText || '').match(/(\d+)\s*Nott[ei],?\s*(\d+)\s*Camere,?\s*(\d+)\s*Adulti/i);
    return m ? { notti: +m[1], camere: +m[2], adulti: +m[3] } : null;
  }

  /* ---------- pannello ---------- */
  function riga(et, val, esito) {
    const icona = esito === true ? ' <span style="color:#2E7D32;">✓</span>'
      : esito === false ? ' <span style="color:#C62828;">✗ a mano</span>' : '';
    return `<div style="padding:4px 0;border-bottom:1px solid #EDE7DC;">
      <span style="color:#7B756A;font-size:11px;">${et}</span><br>
      <strong style="color:#2A2E2B;">${val ?? '—'}</strong>${icona}</div>`;
  }

  function mostraPannello(d, esiti) {
    const vecchio = document.getElementById('leonardo-bozza-pannello');
    if (vecchio) vecchio.remove();
    const p = document.createElement('div');
    p.id = 'leonardo-bozza-pannello';
    p.style.cssText =
      'position:fixed;bottom:16px;right:16px;width:300px;max-height:76vh;overflow:auto;' +
      'z-index:2147483000;background:#FFFFFF;border:1px solid #D8D2C4;border-radius:10px;' +
      'box-shadow:0 6px 24px rgba(0,0,0,.18);padding:0 16px 14px;' +
      'font:13px/18px Arial,Helvetica,sans-serif;';
    p.innerHTML = `
      <div id="leonardo-bozza-testa" style="display:flex;align-items:center;justify-content:space-between;
        cursor:move;user-select:none;margin:0 -16px 8px;padding:10px 12px 8px 16px;
        background:#F4F1EA;border-radius:10px 10px 0 0;border-bottom:1px solid #E4DECF;">
        <span style="font:600 12px/16px Arial;letter-spacing:1px;color:#1E7F88;">
          ${d.fonte === 'Email' ? 'RICHIESTA EMAIL' : 'CENTRALINO'} · ${d.tipo === 'prenotazione' ? 'PRENOTAZIONE' : 'PREVENTIVO'}</span>
        <button id="leonardo-bozza-riduci" title="Riduci" style="border:0;background:none;cursor:pointer;
          font:700 15px Arial;color:#7B756A;padding:0 4px;">&#8211;</button>
      </div>
      <div id="leonardo-bozza-corpo">
      ${riga('Ospite', d.ospite, null)}
      ${riga('Telefono', d.telefono, null)}
      ${riga('Email', d.email, null)}
      ${riga('Arrivo → Partenza', dataIT(d.arrivo) + ' → ' + dataIT(d.partenza) + (d.notti ? ` (${d.notti} notti)` : ''), esiti.date)}
      ${riga('Adulti', d.adulti, esiti.adulti)}
      ${riga('Bambini', (d.bambini ?? 0) + (d.etaBambini ? ' — età ' + d.etaBambini : ''), esiti.bambini)}
      ${riga('Trattamento', d.trattamento, esiti.trattamento)}
      ${categoriaRichiesta(d) ? riga('Camera richiesta', categoriaRichiesta(d), esiti.categoria) : ''}
      ${riga('Sorgente', d.fonte || 'Telefono', esiti.sorgente)}
      ${d.preferenza ? riga('Preferenza', d.preferenza, null) : ''}
      ${d.note ? riga('Note', d.note, null) : ''}
      ${esiti.avvisoNotti ? `<div style="margin-top:6px;padding:6px 8px;background:#FFF6DE;border-left:3px solid #B3541E;font-size:12px;color:#7A5A1E;">Il riepilogo indica ${esiti.avvisoNotti} notti invece di ${d.notti}: ricontrolla le date prima di salvare.</div>` : ''}
      ${d.testoOriginale ? `<div style="margin-top:8px;">
        <div style="color:#7B756A;font-size:10px;letter-spacing:1px;padding-bottom:3px;">TESTO DELLA MAIL</div>
        <div style="max-height:110px;overflow:auto;background:#F7F5F0;border:1px solid #E7E1D4;border-radius:6px;
          padding:8px 10px;font-size:12px;line-height:17px;color:#55524B;white-space:pre-wrap;">${
          String(d.testoOriginale).replace(/&/g,'&amp;').replace(/</g,'&lt;')}</div></div>` : ''}
      <div style="padding:8px 0 2px;color:#7B756A;font-size:11px;" id="leonardo-bozza-stato">
        Cliente: cercato "${[d.cognome, d.nome].filter(Boolean).join(' ')}" — <strong>scegli tu</strong> il profilo giusto
        dai risultati, o usa Crea se non esiste. Nulla viene salvato da solo.</div>
      <button id="leonardo-bozza-riprova" style="margin-top:8px;width:100%;padding:8px;border:0;
        border-radius:6px;background:#1E7F88;color:#fff;font:600 13px Arial;cursor:pointer;">
        Ricompila il modulo</button>
      <button id="leonardo-bozza-chiudi" style="margin-top:6px;width:100%;padding:6px;border:1px solid #D8D2C4;
        border-radius:6px;background:#fff;color:#7B756A;font:12px Arial;cursor:pointer;">
        Chiudi e dimentica la richiesta</button>
      </div>`;
    document.body.appendChild(p);

    // --- trascinamento dalla testata ---
    const testa = document.getElementById('leonardo-bozza-testa');
    let trascino = null;
    testa.addEventListener('mousedown', (e) => {
      if (e.target.id === 'leonardo-bozza-riduci') return;
      const r = p.getBoundingClientRect();
      trascino = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      p.style.bottom = 'auto'; p.style.right = 'auto';
      p.style.left = r.left + 'px'; p.style.top = r.top + 'px';
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!trascino) return;
      p.style.left = Math.max(0, Math.min(window.innerWidth - 80, e.clientX - trascino.dx)) + 'px';
      p.style.top = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - trascino.dy)) + 'px';
    });
    document.addEventListener('mouseup', () => { trascino = null; });

    // --- riduci a linguetta ---
    document.getElementById('leonardo-bozza-riduci').addEventListener('click', () => {
      const corpo = document.getElementById('leonardo-bozza-corpo');
      const ridotto = corpo.style.display === 'none';
      corpo.style.display = ridotto ? '' : 'none';
      document.getElementById('leonardo-bozza-riduci').textContent = ridotto ? '\u2013' : '+';
    });
    document.getElementById('leonardo-bozza-chiudi').addEventListener('click', () => {
      chrome.storage.local.remove(CHIAVE);
      p.remove();
    });
    document.getElementById('leonardo-bozza-riprova').addEventListener('click', () => compila(d));
  }

  /* ---------- regia ---------- */
  async function compila(d) {
    const esiti = {};
    esiti.sorgente = impostaSorgente(d.fonte);
    await attesa(300);
    esiti.adulti = await impostaContatore('adults', 'Adulti', d.adulti);
    esiti.bambini = d.bambini > 0 ? await impostaContatore('children', 'Bambini', d.bambini) : null;
    await attesa(300);
    try { esiti.date = await impostaDate(d.arrivo, d.partenza); }
    catch (e) { esiti.date = false; }
    if (esiti.date && d.notti) {
      await attesa(800);
      const rq = riepilogoPagina();
      if (rq && rq.notti !== d.notti) esiti.avvisoNotti = rq.notti;
    }
    esiti.categoria = await selezionaCategoria(categoriaRichiesta(d));
    esiti.trattamento = await impostaTrattamento(d.trattamento);
    // "Cognome Nome" filtra molto meglio del solo cognome (collaudato sull'API)
    await cercaCliente([d.cognome, d.nome].filter(Boolean).join(' ') || d.email || '');
    mostraPannello(d, esiti);
  }

  chrome.storage.local.get(CHIAVE, async (ris) => {
    const d = ris && ris[CHIAVE];
    if (!d || !d.arrivo) return;
    if (Date.now() - (d.creato || 0) > VALIDITA_MS) {
      chrome.storage.local.remove(CHIAVE);
      return;
    }
    await attesa(2000); // lascio montare il modulo
    compila(d);
  });
})();
