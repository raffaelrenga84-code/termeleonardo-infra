/* ============================================================
   Offerta Leonardo — La sala al POS (v2.29.0)
   ------------------------------------------------------------
   Gira sulla pagina del POS di Fidra, quella con la piantina. Ogni zona
   (Interno, Hall, Esterno, Terrazza) e' una «category» di Fidra e ha i
   tavoli disegnati al loro posto: il pulsante legge la zona aperta e la
   manda alla nostra funzione pos, con nome, posti e posizione in
   percentuale del riquadro della pianta. Una zona per volta: si cambia
   scheda in Fidra e si preme di nuovo.

   SOLA LETTURA SU FIDRA: non salva, non modifica, non clicca niente.
   La chiave hotel e' quella gia' salvata dal pannello (hotelKey).
   ============================================================ */
(() => {
  'use strict';
  const ID = 'leoSalaBarra';
  if (document.getElementById(ID)) return;
  const FUNZIONE = 'https://mvuiuwakuseockotlcnp.supabase.co/functions/v1/pos?a=importa-sala';
  const RE_TAVOLO = /^(tavolo|table|tisch|mesa)\s*\d+/i;

  const testo = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
  const numero = (s) => { const m = String(s).match(/\((\d+)\s*\/\s*(\d+)\)/); return m ? Number(m[2]) : 0; };

  /** I cerchi dei tavoli: si parte dai nodi che dicono «Tavolo 9», si
      tiene il piu' interno, e da li' si sale al riquadro posizionato. */
  function cerchi() {
    const nodi = [...document.querySelectorAll('div, span, p, a, button')].filter((el) => RE_TAVOLO.test(testo(el)));
    const foglie = nodi.filter((el) => !nodi.some((x) => x !== el && el.contains(x)));
    const trovati = new Map();
    for (const f of foglie) {
      let el = f;
      while (el && el !== document.body && getComputedStyle(el).position !== 'absolute') el = el.parentElement;
      const cerchio = (el && el !== document.body) ? el : f;
      if (!trovati.has(cerchio)) trovati.set(cerchio, f);
    }
    return [...trovati.entries()];
  }

  function tavoli() {
    const trovati = cerchi();
    if (!trovati.length) return { tavoli: [], quadro: null };
    /* la pianta e' il riquadro dentro cui i cerchi sono posizionati */
    const quadro = trovati[0][0].offsetParent || trovati[0][0].parentElement;
    if (!quadro) return { tavoli: [], quadro: null };
    const q = quadro.getBoundingClientRect();
    if (!q.width || !q.height) return { tavoli: [], quadro: null };
    const fuori = [];
    for (const [cerchio, foglia] of trovati) {
      const r = cerchio.getBoundingClientRect();
      fuori.push({
        nome: testo(foglia),
        posti: numero(testo(cerchio)),
        x: Math.round(((r.left + r.width / 2 - q.left) / q.width) * 1000) / 10,
        y: Math.round(((r.top + r.height / 2 - q.top) / q.height) * 1000) / 10,
      });
    }
    return { tavoli: fuori, quadro };
  }

  /** La zona aperta: l'indirizzo dice il suo numero, la barra il suo nome.
      Se non lo si capisce, lo scrive la reception nel campo. */
  function zonaAperta() {
    const n = new URLSearchParams(location.search).get('selectedCategory') || '';
    const link = [...document.querySelectorAll('a[href*="selectedCategory="]')];
    const mia = link.find((a) => { try { return new URL(a.href, location.href).searchParams.get('selectedCategory') === n; } catch (e) { return false; } });
    if (mia && testo(mia)) return { id: n, nome: testo(mia) };
    /* la scheda aperta di solito non e' un link: e' l'unica voce della
       barra che non porta a un'altra zona */
    if (link.length) {
      const barra = link[0].parentElement && link[0].parentElement.parentElement;
      const altre = new Set(link.map(testo));
      const voci = barra ? [...barra.querySelectorAll('a, button, span, div')] : [];
      const sola = voci.find((e) => !e.children.length && testo(e) && testo(e).length < 24 && !altre.has(testo(e)));
      if (sola) return { id: n, nome: testo(sola) };
    }
    return { id: n, nome: '' };
  }

  async function manda(stato, campoLocale, campoZona) {
    const dillo = (m) => { stato.textContent = m; };
    const { hotelKey } = await chrome.storage.local.get(['hotelKey']);
    if (!hotelKey) { dillo('Serve la chiave hotel: la si imposta nel pannello dell\'estensione.'); return; }
    const locale = campoLocale.value.trim();
    const zona = campoZona.value.trim();
    if (!locale || !zona) { dillo('Servono il locale e il nome della zona.'); return; }
    const letti = tavoli();
    if (!letti.tavoli.length) { dillo('Non trovo tavoli in questa pagina: apra la piantina di una zona.'); return; }
    await chrome.storage.local.set({ posLocaleImport: locale });
    dillo('Mando ' + letti.tavoli.length + ' tavoli...');
    const r = await fetch(FUNZIONE, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hotel-key': hotelKey },
      body: JSON.stringify({ locale, zona, zona_fidra: zonaAperta().id, tavoli: letti.tavoli }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { dillo('Chiave hotel sbagliata: la si reimposta nel pannello dell\'estensione.'); return; }
    if (!r.ok) { dillo('Errore: ' + (j.errore || r.status)); return; }
    dillo('Zona ' + j.zona + ': ' + j.tavoli + ' tavoli (' + j.nuovi + ' nuovi, ' + j.spostati + ' spostati)'
      + (j.in_piu && j.in_piu.length ? '. Da noi restano anche: ' + j.in_piu.join(', ') : '')
      + '. Ora cambi zona in Fidra e prema di nuovo.');
  }

  async function metti() {
    const z = zonaAperta();
    const { posLocaleImport } = await chrome.storage.local.get(['posLocaleImport']);
    const barra = document.createElement('div');
    barra.id = ID;
    barra.style.cssText = 'position:fixed;top:8px;right:16px;z-index:99999;background:#1A3626;color:#fff;padding:8px 12px;border-radius:8px;font:14px system-ui,sans-serif;display:flex;gap:8px;align-items:center;box-shadow:0 2px 8px rgba(0,0,0,.25);max-width:640px;flex-wrap:wrap;';
    const stileCampo = 'font:inherit;padding:5px 8px;border-radius:6px;border:0;width:110px;';
    const locale = document.createElement('input');
    locale.id = 'leoSalaLocale';
    locale.value = posLocaleImport || 'bistrot';
    locale.title = 'Il locale del nostro POS: bistrot o ristorante';
    locale.style.cssText = stileCampo;
    const zona = document.createElement('input');
    zona.id = 'leoSalaZona';
    zona.value = z.nome;
    zona.placeholder = 'zona';
    zona.title = 'Il nome della zona aperta in Fidra';
    zona.style.cssText = stileCampo;
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Manda la sala al POS';
    b.style.cssText = 'font:inherit;padding:6px 10px;border-radius:6px;border:0;background:#C9A961;color:#1A3626;cursor:pointer;white-space:nowrap;';
    const stato = document.createElement('span');
    stato.style.cssText = 'flex-basis:100%;';
    b.onclick = () => { b.disabled = true; manda(stato, locale, zona).catch((e) => { stato.textContent = 'Errore: ' + e.message; }).finally(() => { b.disabled = false; }); };
    barra.append(locale, zona, b, stato);
    document.body.appendChild(barra);
    const stile = document.createElement('style');
    stile.textContent = '@media print{#' + ID + '{display:none !important;}}';
    document.head.appendChild(stile);
  }

  /* la piantina arriva dopo il resto: si aspetta di vedere i tavoli */
  let tentativi = 0;
  const attesa = setInterval(() => {
    tentativi += 1;
    if (document.getElementById(ID) || tentativi > 40) { clearInterval(attesa); return; }
    if (cerchi().length) { clearInterval(attesa); metti(); }
  }, 500);
})();
