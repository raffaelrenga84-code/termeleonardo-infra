/* ============================================================
   Offerta Leonardo — da Bozza a Offerta in un clic (v1.0)
   ------------------------------------------------------------
   PERCHE'. Ogni prenotazione nuova nasce «Bozza», e ogni volta
   l'operatore fa lo stesso giro: Modifica → Stato → Offerta →
   Salva. Quattro gesti, sempre gli stessi, su ogni pratica.

   UN CLIC, NON ZERO. Non lo si fa da soli all'apertura della
   pagina: questa e' l'unica cosa in tutta l'estensione che SCRIVE
   dentro Fidra, e la regola di casa — scritta in fidra-booking.js
   dal primo giorno — e' che l'ultimo clic e' dell'operatore. Un
   automatismo che cambia lo stato di una pratica mentre la stai
   solo guardando e' esattamente il genere di cosa che nessuno si
   fida piu' a lasciare acceso.

   E DOPO SI RILEGGE. Livewire risponde via rete: si aspetta che la
   pagina dica «Offerta» prima di dichiarare fatto. Se non lo dice,
   lo si ammette invece di far finta.
   ============================================================ */
(() => {
  if (location.hostname !== 'leonardo.fidra.cloud') return;
  if (!/\/customers\/\d+\/reservations\/\d+/.test(location.pathname)) return;

  const ID = 'leoBozzaOfferta';
  const attesa = (ms) => new Promise(r => setTimeout(r, ms));

  /* lo stato attuale, come lo scrive Fidra accanto al numero pratica */
  function statoAttuale() {
    for (const el of document.querySelectorAll('span, div, td')) {
      if (el.children.length) continue;
      const t = (el.textContent || '').trim();
      if (/^(bozza|offerta|conferma(ta)?|opzione|cancellata)$/i.test(t)) return t.toLowerCase();
    }
    return '';
  }

  /* la tendina Stato dentro il riquadro Modifica */
  function tendinaStato() {
    for (const s of document.querySelectorAll('select')) {
      const opzioni = [...s.options].map(o => (o.textContent || '').trim().toLowerCase());
      if (opzioni.includes('bozza') && opzioni.includes('offerta')) return s;
    }
    return null;
  }

  function apriModifica() {
    /* il riquadro si apre da un pulsante «Modifica» che sta accanto al
       riepilogo delle notti — non quello grande in alto a destra, che
       apre la scheda del cliente */
    const canditati = [...document.querySelectorAll('button, [role=button]')]
      .filter(b => /^modifica$/i.test((b.textContent || '').replace(/\s+/g, ' ').trim()));
    /* l'ultimo e' quello dentro la pratica: quello in alto viene prima */
    const b = canditati[canditati.length - 1];
    if (b) b.click();
    return !!b;
  }

  /* i componenti di Fidra non si accorgono di un .value assegnato:
     va usato il setter nativo e poi annunciato con un evento vero */
  function scegliNativo(select, testo) {
    const opz = [...select.options].find(o => (o.textContent || '').trim().toLowerCase() === testo);
    if (!opz) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
    if (setter) setter.call(select, opz.value); else select.value = opz.value;
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function pulsanteSalva() {
    return [...document.querySelectorAll('button')]
      .find(b => /^salva$/i.test((b.textContent || '').replace(/\s+/g, ' ').trim())) || null;
  }

  function dillo(testo, male) {
    const b = document.getElementById(ID);
    if (!b) return;
    let n = document.getElementById(ID + 'Nota');
    if (!n) {
      n = document.createElement('span');
      n.id = ID + 'Nota';
      n.style.cssText = 'font:12px Arial,Helvetica,sans-serif;padding-left:8px;';
      b.parentNode.insertBefore(n, b.nextSibling);
    }
    n.style.color = male ? '#B3541E' : '#5A7A3E';
    n.textContent = testo;
  }

  async function segnaOfferta(btn) {
    btn.disabled = true;
    const testoPrima = btn.textContent;
    btn.textContent = 'Ci provo…';
    try {
      let sel = tendinaStato();
      if (!sel) { apriModifica(); await attesa(400); sel = tendinaStato(); }
      if (!sel) throw new Error('non trovo la tendina Stato');
      if (!scegliNativo(sel, 'offerta')) throw new Error('«Offerta» non è fra le scelte');

      await attesa(200);
      const salva = pulsanteSalva();
      if (!salva) throw new Error('non trovo il pulsante Salva');
      salva.click();

      /* Livewire risponde via rete: si aspetta che la pagina lo dica */
      for (let i = 0; i < 20; i++) {
        await attesa(300);
        if (/offerta/i.test(statoAttuale())) {
          dillo('Fatto: adesso è un\'offerta.');
          btn.remove();
          return;
        }
      }
      throw new Error('salvato, ma la pagina dice ancora «' + (statoAttuale() || '?') + '»');
    } catch (e) {
      dillo(String(e.message || e) + ' — fallo a mano da Modifica → Stato.', true);
      btn.disabled = false;
      btn.textContent = testoPrima;
    }
  }

  function metti() {
    if (document.getElementById(ID)) return;
    if (statoAttuale() !== 'bozza') return;
    /* accanto al numero pratica, dove si legge «Bozza» */
    const badge = [...document.querySelectorAll('span, div')]
      .find(el => !el.children.length && /^bozza$/i.test((el.textContent || '').trim()));
    if (!badge || !badge.parentNode) return;

    const btn = document.createElement('button');
    btn.id = ID;
    btn.type = 'button';
    btn.textContent = '→ Offerta';
    btn.title = 'Mette lo stato su Offerta e salva. È l\'unica cosa che questa '
              + 'estensione scrive dentro Fidra, e la fa solo se la premi tu.';
    btn.style.cssText =
      'margin-left:8px;padding:3px 10px;border:1px solid #E8751A;border-radius:12px;' +
      'background:#FFF6E8;color:#B35C12;font:600 12px Arial,Helvetica,sans-serif;cursor:pointer;';
    btn.addEventListener('click', () => segnaOfferta(btn));
    badge.parentNode.insertBefore(btn, badge.nextSibling);
  }

  /* Fidra si ridisegna da sola: si riguarda, e il pulsante sparisce da
     solo quando la pratica non e' piu' una bozza */
  setInterval(() => {
    const b = document.getElementById(ID);
    if (b && statoAttuale() !== 'bozza') b.remove();
    else metti();
  }, 1200);
})();
