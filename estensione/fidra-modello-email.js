/* ============================================================
   Offerta Leonardo — al posto di «Modello Email» (v1.0)
   ------------------------------------------------------------
   PERCHE' ESISTE. La reception continuava a mandare offerte e
   conferme col modello di Fidra. Non perche' non trovasse il
   pannello: perche' il pulsante di Fidra e' li', nel punto e nel
   momento in cui si sta gia' guardando la pratica, e il nostro
   chiedeva di ricordarsi Ctrl+Shift+L o di cercare l'icona.

   COSA FA. Sulla pagina di una prenotazione cerca i pulsanti
   «Modello Email» di Fidra. Il PRIMO lo nasconde e mette il nostro
   al suo posto; gli altri li lascia stare.

   PERCHE' UNO SOLO. Se sbagliamo su un caso — ed e' successo: le
   camere con periodi diversi uscivano con il doppio delle persone —
   la reception deve avere una via d'uscita che non sia «chiama chi
   ha scritto l'estensione». Il secondo pulsante e' quella via.
   Quando i casi noti sono coperti, si copre anche il secondo: e'
   una riga.

   NON SI SOVRAPPONE, SOSTITUISCE. Un pulsante messo sopra con
   position:absolute si scolla al primo scorrimento, al primo
   ridimensionamento e alla prima modifica del layout di Fidra —
   questo repo ha gia' pagato quattro versioni per inseguire il DOM
   di qualcun altro (2.7.4 → 2.7.7). Qui il pulsante di Fidra viene
   nascosto e il nostro entra al suo posto nel flusso: se Fidra
   cambia, al peggio non troviamo piu' niente e non compare nulla —
   che e' un guasto silenzioso ma innocuo, non un pulsante che
   galleggia sopra la pagina sbagliata.
   ============================================================ */
(() => {
  if (location.hostname !== 'leonardo.fidra.cloud') return;

  const ID = 'leoModelloEmail';
  const MARCHIO = 'data-leo-sostituito';

  /* solo sulla scheda di una prenotazione: altrove «Modello Email» non
     c'e', o vuol dire un'altra cosa */
  const suPrenotazione = () =>
    /\/customers\/\d+\/reservations\/\d+/.test(location.pathname);

  function bottoniFidra() {
    const fuori = [];
    for (const b of document.querySelectorAll('button, a')) {
      const t = (b.textContent || '').replace(/\s+/g, ' ').trim();
      if (t.toLowerCase() !== 'modello email') continue;
      if (b.id === ID || b.closest('#' + ID)) continue;
      fuori.push(b);
    }
    return fuori;
  }

  function nostro() {
    const b = document.createElement('button');
    b.id = ID;
    b.type = 'button';
    b.textContent = '✉ Email Leonardo';
    b.title = 'Apre il pannello Offerta Leonardo su questa pratica '
            + '(offerta, conferma, sollecito). Il modello di Fidra resta '
            + 'disponibile dall’altro pulsante.';
    b.style.cssText =
      'display:inline-flex;align-items:center;gap:6px;padding:8px 14px;' +
      'border:0;border-radius:6px;cursor:pointer;font:600 13px Arial,Helvetica,sans-serif;' +
      'color:#fff;background:#1E7F88;box-shadow:0 1px 3px rgba(0,0,0,.2);';
    b.addEventListener('mouseenter', () => { b.style.background = '#176068'; });
    b.addEventListener('mouseleave', () => { b.style.background = '#1E7F88'; });
    b.addEventListener('click', apriPannello);
    return b;
  }

  function dillo(testo, male) {
    const b = document.getElementById(ID);
    if (!b) return;
    let n = document.getElementById(ID + 'Nota');
    if (!n) {
      n = document.createElement('div');
      n.id = ID + 'Nota';
      n.style.cssText = 'font:12px Arial,Helvetica,sans-serif;padding-top:6px;max-width:260px;';
      b.parentNode.insertBefore(n, b.nextSibling);
    }
    n.style.color = male ? '#B3541E' : '#5A7A3E';
    n.textContent = testo;
  }

  async function apriPannello() {
    try {
      const esito = await chrome.runtime.sendMessage({ tipo: 'LEONARDO_APRI_PANNELLO' });
      if (esito && esito.ok) { dillo('Pannello aperto a lato.'); return; }
      /* Chrome vuole un gesto dell'operatore per aprire il pannello, e il
         gesto non sempre sopravvive al passaggio dal content script al
         service worker. Quando non sopravvive lo si dice, invece di
         lasciare un pulsante che sembra rotto. */
      dillo('Premi Ctrl+Shift+L per aprire il pannello'
            + (esito && esito.motivo ? ' (' + esito.motivo + ')' : ''), true);
    } catch (e) {
      dillo('Premi Ctrl+Shift+L per aprire il pannello', true);
    }
  }

  function sostituisci() {
    if (!suPrenotazione()) return;
    if (document.getElementById(ID)) return;
    const bottoni = bottoniFidra();
    if (!bottoni.length) return;
    /* il primo e basta: il secondo resta la via d'uscita */
    const vecchio = bottoni[0];
    if (vecchio.getAttribute(MARCHIO)) return;
    vecchio.setAttribute(MARCHIO, '1');
    vecchio.style.display = 'none';
    vecchio.parentNode.insertBefore(nostro(), vecchio);
  }

  /* Fidra e' una pagina che si ridisegna da sola (Livewire): il pulsante
     puo' comparire dopo, e sparire quando un pezzo di pagina si aggiorna.
     Si riguarda a ogni modifica, e il controllo costa una scansione dei
     bottoni solo quando il nostro non c'e' piu'. */
  const osserva = new MutationObserver(() => sostituisci());
  function avvia() {
    sostituisci();
    osserva.observe(document.body, { childList: true, subtree: true });
  }
  if (document.body) avvia();
  else document.addEventListener('DOMContentLoaded', avvia);
})();
