/* ============================================================
   Offerta Leonardo — Documento fiscale in PDF A4 (v1.6.9)
   ------------------------------------------------------------
   Gira su leonardo.fidra.cloud/invoices/*. Aggiunge un pulsante
   "📄 PDF A4": legge il documento dalla pagina e apre la stampa
   di un foglio A4 con l'intestazione e i dati dell'hotel, dal
   quale si sceglie "Salva come PDF".

   SOLA LETTURA: non modifica nulla in Fidra, non invia dati
   fuori dal browser. La stampa avviene in un iframe interno.
   ============================================================ */

(() => {
  const HOTEL = {
    nome: 'Hotel Terme Leonardo',
    societa: 'Tria S.r.l.',
    indirizzo: 'Via Monteortone 46 · 35037 Monteortone di Teolo (PD)',
    contatti: '+39 049 9939 200 · info@termeleonardo.com · termeleonardo.com',
    fiscali: 'P.IVA IT 02042330288',
    cin: 'CIN IT028089A18QYO48ED',   // non obbligatorio in testata: resta nel piè di pagina
    /* logo ufficiale 2025 (versione nera), incorporato come data URI: si
       stampa anche senza rete. Il viewBox è ritagliato al marchio — l'SVG
       originale ha una cornice vuota che lo faceva sembrare minuscolo. */
    logo: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz48c3ZnIGlkPSJMaXZlbGxvXzEiIGRhdGEtbmFtZT0iTGl2ZWxsbyAxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjI4LjkgMTA3LjEgMjI1LjcgNjkuMyI+PGRlZnM+PHN0eWxlPiAuY2xzLTEgeyBmaWxsOiAjMjMxZjIwOyBzdHJva2Utd2lkdGg6IDBweDsgfSA8L3N0eWxlPjwvZGVmcz48Zz48cG9seWdvbiBjbGFzcz0iY2xzLTEiIHBvaW50cz0iMTAzLjYgMTcwLjIzIDEwMS43MiAxNjguODUgOTkuODMgMTcwLjIxIDEwMC41NiAxNjggOTguNjggMTY2LjYyIDEwMS4wMSAxNjYuNjMgMTAxLjc0IDE2NC40MiAxMDIuNDUgMTY2LjY0IDEwNC43OCAxNjYuNjUgMTAyLjg5IDE2OC4wMSAxMDMuNiAxNzAuMjMiLz48cG9seWdvbiBjbGFzcz0iY2xzLTEiIHBvaW50cz0iMTMwLjI3IDE3MC4yMyAxMjguMzkgMTY4Ljg1IDEyNi41IDE3MC4yMSAxMjcuMjMgMTY4IDEyNS4zNSAxNjYuNjIgMTI3LjY4IDE2Ni42MyAxMjguNDEgMTY0LjQyIDEyOS4xMiAxNjYuNjQgMTMxLjQ0IDE2Ni42NSAxMjkuNTYgMTY4LjAxIDEzMC4yNyAxNzAuMjMiLz48cG9seWdvbiBjbGFzcz0iY2xzLTEiIHBvaW50cz0iMTU2LjkzIDE3MC4yMyAxNTUuMDYgMTY4Ljg1IDE1My4xNyAxNzAuMjEgMTUzLjkgMTY4IDE1Mi4wMiAxNjYuNjIgMTU0LjM1IDE2Ni42MyAxNTUuMDggMTY0LjQyIDE1NS43OSAxNjYuNjQgMTU4LjExIDE2Ni42NSAxNTYuMjIgMTY4LjAxIDE1Ni45MyAxNzAuMjMiLz48cG9seWdvbiBjbGFzcz0iY2xzLTEiIHBvaW50cz0iMTgzLjYgMTcwLjIzIDE4MS43MyAxNjguODUgMTc5Ljg0IDE3MC4yMSAxODAuNTcgMTY4IDE3OC42OSAxNjYuNjIgMTgxLjAyIDE2Ni42MyAxODEuNzQgMTY0LjQyIDE4Mi40NSAxNjYuNjQgMTg0Ljc4IDE2Ni42NSAxODIuODkgMTY4LjAxIDE4My42IDE3MC4yMyIvPjwvZz48Zz48cG9seWdvbiBjbGFzcz0iY2xzLTEiIHBvaW50cz0iMzguMjcgMTE0LjMxIDM1LjEyIDExNC4zMSAzNS4xMiAxMzMuMSA0Ni4wMiAxMzMuMSA0Ni4wMiAxMzAuMjMgMzguMjcgMTMwLjIzIDM4LjI3IDExNC4zMSIvPjxwb2x5Z29uIGNsYXNzPSJjbHMtMSIgcG9pbnRzPSI1OS4wNSAxMzMuMSA3MC40MyAxMzMuMSA3MC40MyAxMzAuMjMgNjIuMiAxMzAuMjMgNjIuMiAxMjQuNzMgNjguOTggMTI0LjczIDY4Ljk4IDEyMS44NiA2Mi4yIDEyMS44NiA2Mi4yIDExNy4xNiA3MC40MyAxMTcuMTYgNzAuNDMgMTE0LjMxIDU5LjA1IDExNC4zMSA1OS4wNSAxMzMuMSIvPjxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTEwMS4wMiwxMTYuNDJjLS45Ny0uOTQtMi4wMy0xLjY2LTMuMjctMi4xOS0xLjI5LS41My0yLjY0LS44LTQuMDEtLjhzLTIuNzMuMjctMy45OS44Yy0xLjI2LjUzLTIuMzMsMS4yNS0zLjI3LDIuMTktLjk2Ljk5LTEuNywyLjA5LTIuMjEsMy4yNy0uNTMsMS4yOS0uOCwyLjY0LS44LDQuMDFzLjI3LDIuNzMuOCwzLjk5Yy41MSwxLjIxLDEuMjYsMi4zMSwyLjIyLDMuMjdzMi4wNiwxLjcsMy4yNywyLjIyYzEuMjYuNTMsMi42MS44LDMuOTkuOHMyLjcyLS4yNyw0LjAyLS44YzEuMTgtLjUxLDIuMjgtMS4yNSwzLjI3LTIuMjIuOTQtLjk0LDEuNjYtMi4wMSwyLjE5LTMuMjcuNTMtMS4yNi44LTIuNi44LTMuOTlzLS4yNy0yLjczLS44LTQuMDJjLS41My0xLjIzLTEuMjUtMi4zLTIuMTktMy4yN1pNMTAwLjU5LDEyMy43MWMwLDEuODItLjcyLDMuNTQtMi4wMiw0Ljg0LTEuMywxLjMtMy4wMiwyLjAxLTQuODQsMi4wMXMtMy41NC0uNzItNC44NC0yLjAxYy0xLjMtMS4zLTIuMDEtMy4wMi0yLjAxLTQuODRzLjcyLTMuNTQsMi4wMS00Ljg0YzEuMy0xLjMsMy4wMi0yLjAyLDQuODQtMi4wMnMzLjU0LjcyLDQuODQsMi4wMmMxLjMsMS4zLDIuMDIsMy4wMiwyLjAyLDQuODRaIi8+PHBvbHlnb24gY2xhc3M9ImNscy0xIiBwb2ludHM9IjEyOC43IDEyNi4wMSAxMTcuMDYgMTEzLjI0IDExNy4wNiAxMzMuMSAxMjAuMiAxMzMuMSAxMjAuMiAxMjEuMzggMTMxLjg4IDEzNC4xNSAxMzEuODggMTE0LjMxIDEyOC43IDExNC4zMSAxMjguNyAxMjYuMDEiLz48cGF0aCBjbGFzcz0iY2xzLTEiIGQ9Ik0xNDQuOTksMTMyLjkzbC0uMDcuMTdoMy40N2wxLjU3LTMuOTdoNi40M2wxLjU3LDMuOTdoMy40NWwtOC4yNC0xOS44NS04LjE5LDE5LjY3Wk0xNTEuMTEsMTI2LjI4bDIuMDctNS4xOSwyLjA2LDUuMTloLTQuMTNaIi8+PHBhdGggY2xhc3M9ImNscy0xIiBkPSJNMTg0Ljc5LDEyNC45NGMuOTktMS4wOSwxLjUzLTIuNjQsMS41My00LjM2cy0uNTMtMy4yOC0xLjUzLTQuMzhjLS43Ni0uODYtMi4yLTEuODktNC43Mi0xLjg5aC01LjYydjE4LjhoMy4xNXYtNi4yN2gxLjk0bDQuNjQsNi4yMi4wNC4wNWgzLjU4bC01LjA1LTYuNzZjLjk4LS4zOCwxLjY1LS45NiwyLjA0LTEuNFpNMTgzLjQ1LDEyMC41OGMwLDEuMDYtLjI3LDEuODgtLjc5LDIuNDQtLjU2LjY0LTEuNDMuOTYtMi41OC45NmgtMi40N3YtNi44aDIuNDdjMS4xNywwLDIuMDMuMzEsMi41OC45NC41My41Ni43OSwxLjM5Ljc5LDIuNDZaIi8+PHBhdGggY2xhc3M9ImNscy0xIiBkPSJNMjA5LjQ2LDExNS4wNGMtMS4xOS0uNDktMi41My0uNzQtNC4xLS43NGgtNC41MnYxOC44aDQuNTJjMS40OSwwLDIuODYtLjI1LDQuMDktLjczLDEuMTgtLjQ1LDIuMi0xLjE1LDMuMDItMi4wOCwxLjQ5LTEuNjQsMi4yOC0zLjkyLDIuMjgtNi41OHMtLjc5LTQuOTQtMi4yOC02LjU4Yy0uODMtLjkzLTEuODUtMS42My0zLjAyLTIuMDhaTTIxMS42MSwxMjMuNzFjMCwxLjg0LS41MiwzLjQyLTEuNDcsNC40Ni0xLjA5LDEuMTgtMi43LDEuNzgtNC43OCwxLjc4aC0xLjM4di0xMi41aDEuMzhjMi4xMSwwLDMuNzIuNiw0Ljc4LDEuNzguOTYsMS4wNiwxLjQ3LDIuNiwxLjQ3LDQuNDZaIi8+PHBhdGggY2xhc3M9ImNscy0xIiBkPSJNMjQ3LjU0LDExOS42OWMtLjUzLTEuMjMtMS4yNS0yLjMtMi4xOS0zLjI3LS45Ni0uOTQtMi4wMy0xLjY2LTMuMjctMi4xOS0xLjI5LS41My0yLjY0LS44LTQuMDEtLjhzLTIuNzMuMjctMy45OS44Yy0xLjI2LjUzLTIuMzMsMS4yNS0zLjI3LDIuMTktLjk2Ljk5LTEuNywyLjA4LTIuMjEsMy4yNy0uNTMsMS4yOS0uOCwyLjY0LS44LDQuMDFzLjI3LDIuNzMuOCwzLjk5Yy41MSwxLjIxLDEuMjYsMi4zMSwyLjIyLDMuMjcuOTYuOTYsMi4wNiwxLjcsMy4yNywyLjIyLDEuMjYuNTMsMi42MS44LDMuOTkuOHMyLjcyLS4yNyw0LjAyLS44YzEuMTgtLjUxLDIuMjgtMS4yNiwzLjI3LTIuMjIuOTQtLjk0LDEuNjYtMi4wMSwyLjE5LTMuMjcuNTMtMS4yNi44LTIuNi44LTMuOTlzLS4yNy0yLjczLS44LTQuMDJaTTI0NC45MiwxMjMuNzFjMCwxLjgyLS43MiwzLjU0LTIuMDIsNC44NC0xLjMsMS4zLTMuMDIsMi4wMS00Ljg0LDIuMDFzLTMuNTQtLjcyLTQuODMtMi4wMWMtMS4zLTEuMy0yLjAyLTMuMDItMi4wMi00Ljg0cy43Mi0zLjU0LDIuMDItNC44NCwzLjAyLTIuMDIsNC44My0yLjAyLDMuNTQuNzIsNC44NCwyLjAyLDIuMDEsMy4wMiwyLjAxLDQuODRaIi8+PC9nPjxnPjxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTEwMS4zNSwxNDYuMzh2NS44MmgtMS4wMnYtNS44MmgtMS41NnYtLjk2aDQuMTR2Ljk2aC0xLjU1WiIvPjxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTExMC4yNiwxNDYuMzhoLTIuNzJ2MS42M2gyLjY0di45NmgtMi42NHYyLjI3aDIuNzJ2Ljk2aC0zLjc0di02Ljc5aDMuNzR2Ljk2WiIvPjxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTExNi42MSwxNDkuMzJsMi4xLDIuODloLTEuMjVsLTEuOTQtMi43OGgtLjE4djIuNzhoLTEuMDJ2LTYuNzloMS4yYy45LDAsMS41NC4xNywxLjk0LjUxLjQ0LjM4LjY2Ljg3LjY2LDEuNDgsMCwuNDgtLjE0Ljg5LS40MSwxLjI0cy0uNjQuNTctMS4wOS42NlpNMTE1LjMzLDE0OC41NGguMzNjLjk3LDAsMS40Ni0uMzcsMS40Ni0xLjExLDAtLjY5LS40Ny0xLjA0LTEuNDItMS4wNGgtLjM2djIuMTVaIi8+PHBhdGggY2xhc3M9ImNscy0xIiBkPSJNMTIyLjE5LDE1Mi4yMWwxLjQzLTcuMjksMi4zMyw1LjI3LDIuNDEtNS4yNywxLjI4LDcuMjloLTEuMDVsLS42NS00LjEtMi4wMSw0LjQxLTEuOTUtNC40MS0uNzMsNC4xaC0xLjA2WiIvPjxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTEzNy41MiwxNDYuMzhoLTIuNzJ2MS42M2gyLjY0di45NmgtMi42NHYyLjI3aDIuNzJ2Ljk2aC0zLjc0di02Ljc5aDMuNzR2Ljk2WiIvPjxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTE0OC4wNywxNDguMDhoMi45M3YtMi42NWgxLjAydjYuNzloLTEuMDJ2LTMuMTdoLTIuOTN2My4xN2gtMS4wMnYtNi43OWgxLjAydjIuNjVaIi8+PHBhdGggY2xhc3M9ImNscy0xIiBkPSJNMTU2LjAxLDE0OC43OGMwLS45NS4zNS0xLjc4LDEuMDUtMi40Ni43LS42OSwxLjUzLTEuMDMsMi41MS0xLjAzczEuNzkuMzUsMi40OSwxLjA0Yy43LjY5LDEuMDQsMS41MiwxLjA0LDIuNDlzLS4zNSwxLjgtMS4wNSwyLjQ4Yy0uNy42OC0xLjU1LDEuMDItMi41NCwxLjAyLS44OCwwLTEuNjYtLjMtMi4zNi0uOTEtLjc3LS42Ny0xLjE1LTEuNTUtMS4xNS0yLjY0Wk0xNTcuMDQsMTQ4LjhjMCwuNzUuMjUsMS4zNy43NiwxLjg1LjUuNDgsMS4wOC43MywxLjc0LjczLjcxLDAsMS4zMS0uMjUsMS44LS43NC40OS0uNS43My0xLjExLjczLTEuODJzLS4yNC0xLjMzLS43My0xLjgyYy0uNDgtLjQ5LTEuMDgtLjc0LTEuNzgtLjc0cy0xLjMuMjUtMS43OS43NGMtLjQ5LjQ5LS43MywxLjA5LS43MywxLjhaIi8+PHBhdGggY2xhc3M9ImNscy0xIiBkPSJNMTY4LjcyLDE0Ni4zOHY1LjgyaC0xLjAydi01LjgyaC0xLjU2di0uOTZoNC4xNHYuOTZoLTEuNTVaIi8+PHBhdGggY2xhc3M9ImNscy0xIiBkPSJNMTc3LjYzLDE0Ni4zOGgtMi43MnYxLjYzaDIuNjR2Ljk2aC0yLjY0djIuMjdoMi43MnYuOTZoLTMuNzR2LTYuNzloMy43NHYuOTZaIi8+PHBhdGggY2xhc3M9ImNscy0xIiBkPSJNMTgyLjcsMTQ1LjQydjUuODJoMnYuOTZoLTMuMDJ2LTYuNzloMS4wMloiLz48L2c+PC9zdmc+'
  };

  /* v1.7.4 — marchi di certificazione sul PDF. Nel foglio stampato le
     immagini incorporate funzionano (a differenza delle email), quindi qui
     si possono usare sia un indirizzo https sia un data URI. Finché sono
     vuoti non si stampa nulla. Stessa altezza per i due marchi e zona di
     rispetto del 33%, come chiedono le linee guida GSTC; il marchio GSTC
     non va mai da solo né ritagliato o ricolorato. */
  const MARCHIO_GSTC = '';   // logo GSTC-Certified con il codice della struttura
  const MARCHIO_ENTE = '';   // logo dell'ente certificatore (Vireo)
  const MARCHI_ALTEZZA = 15; // mm sul foglio

  /* colori di marca 2025 */
  const VERDE = '#333B20';   // verde della casa, dal logo ufficiale
  const CARTA = '#EDE8DE';

  const testo = (n) => (n ? (n.innerText || n.textContent || '').trim() : '');
  const righe = (t) => t.split('\n').map(x => x.trim()).filter(Boolean);
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /* ---------- lettura del documento dalla pagina ---------- */
  function leggiDocumento() {
    const L = righe(testo(document.body));
    const d = { righe: [], iva: [], pagamenti: [] };

    // "hotel R 2026/5311" + stato
    const iTit = L.findIndex(x => /^\s*\w+\s+[A-Z]\s+20\d\d\/\d+/.test(x));
    if (iTit > -1) {
      d.titolo = L[iTit].replace(/\s*(pagato|non pagato|annullato|stornato)\s*$/i, '').trim();
      const st = L[iTit].match(/(pagato|non pagato|annullato|stornato)/i) ||
                 (L[iTit + 1] || '').match(/^(pagato|non pagato|annullato|stornato)$/i);
      d.stato = st ? st[1] : null;
    }
    // data del documento e chi l'ha creato
    const md = (L.find(x => /^\d{1,2}\s+[A-Za-z]{3}\s+20\d\d$/.test(x)) || '');
    d.data = md || null;
    d.creatoDa = (L.find(x => /^Creato da:/i.test(x)) || '').replace(/^Creato da:\s*/i, '') || null;

    /* Anagrafica. In pagina le etichette vuote (CF. PI. Codice: PEC:) si
       succedono senza valore: prendere "la riga dopo" pescherebbe il codice
       di trasmissione o la voce successiva della pagina. Quindi un valore
       si accetta solo se non è a sua volta un'etichetta o un elemento noto
       dell'interfaccia. */
    const NON_VALORE = /^(CF|PI|PEC)\.?:?$|^(Codice|Codice Lotteria|Pagamenti|Opzioni|Documenti Fiscali|Descrizione|Totale|Elimina|Creato da)\b|^OK\s*\d|^\d{1,2}\s+[A-Za-z]{3}\s+20\d\d$|^[\d.]+,\d{2}\s*€$|^\d+$|^\w+\s+[A-Z]\s+20\d\d\/\d+/i;
    /* v1.7.5: l'anagrafica dell'intestatario occupa più righe — nome, via,
       città, paese — e prenderne una sola faceva finire in email la sola
       città. Si risale da "CF.": si saltano data ed emittente, poi si
       raccolgono le righe consecutive valide (la più alta è il nome). */
    const iCF = L.findIndex(x => /^CF\.?:?$/i.test(x));
    if (iCF > 0) {
      const valida = (x) => x && !NON_VALORE.test(x) && x.length > 2 && !/^\W+$/.test(x);
      let k = iCF - 1, salti = 0;
      while (k >= 0 && !valida(L[k]) && salti < 5) { k--; salti++; }
      const blocco = [];
      while (k >= 0 && valida(L[k]) && blocco.length < 5) { blocco.unshift(L[k]); k--; }
      if (blocco.length) {
        d.cliente = blocco[0];
        // il codice paese finale ("it") non serve nell'indirizzo stampato
        d.indirizzo = blocco.slice(1).filter(x => !/^[a-z]{2}$/i.test(x));
      }
    }
    const dopo = (etichetta) => {
      const i = L.findIndex(x => new RegExp('^' + etichetta + '\\.?:?$', 'i').test(x));
      if (i < 0) return null;
      const v = L[i + 1];
      return v && !NON_VALORE.test(v) ? v : null;
    };
    d.cf = dopo('CF'); d.pi = dopo('PI');
    d.codice = dopo('Codice'); d.pec = dopo('PEC');
    const ok = L.find(x => /^OK\s*\d+/.test(x));
    if (ok) d.trasmissione = ok.trim();
    const lot = L.findIndex(x => /^Codice Lotteria:?$/i.test(x));
    if (lot > -1 && L[lot + 1] && !NON_VALORE.test(L[lot + 1])) d.lotteria = L[lot + 1];

    /* righe del documento: dalle tabelle vere, così le colonne restano
       allineate anche quando una descrizione contiene spazi o cifre */
    document.querySelectorAll('table').forEach(tab => {
      const intest = righe(testo(tab.querySelector('thead') || tab.rows[0] || null))
        .join(' ').toUpperCase();
      const corpo = [...tab.querySelectorAll('tbody tr')].length
        ? [...tab.querySelectorAll('tbody tr')] : [...tab.rows].slice(1);
      if (/DESCRIZIONE/.test(intest)) {
        corpo.forEach(tr => {
          const c = [...tr.cells].map(x => testo(x));
          if (c.length >= 4 && c[0]) {
            d.righe.push({ descrizione: c[0], q: c[1], prezzo: c[2],
                           totale: c[3], iva: c[4] || '' });
          }
        });
      } else if (/IMPONIBILE/.test(intest)) {
        corpo.forEach(tr => {
          const c = [...tr.cells].map(x => testo(x));
          if (c.length >= 4 && c[0]) {
            d.iva.push({ aliquota: c[0], imponibile: c[1], imposta: c[2], totale: c[3],
                         finale: /totale/i.test(c[0]) });
          }
        });
      }
    });

    // totale del documento
    const mt = (L.find(x => /^Totale\s+[\d.]+,\d{2}\s*€$/.test(x)) || '')
      .match(/([\d.]+,\d{2})\s*€/);
    d.totale = mt ? mt[1] + ' €' : (d.iva.find(r => r.finale) || {}).totale || null;

    // pagamenti: importo, modo, data
    const iPag = L.findIndex(x => /^Pagamenti$/i.test(x));
    if (iPag > -1) {
      for (let i = iPag + 1; i < Math.min(iPag + 24, L.length); i++) {
        const m = L[i].match(/^([\d.]+,\d{2})\s*€$/);
        if (!m) continue;
        const vicino = L.slice(i, i + 5);
        const modo = vicino.find(x => /contante|carta|bancomat|bonifico|assegno|satispay|pos/i.test(x)) || '';
        const data = (vicino.find(x => /del\s+\d{1,2}\s+[A-Za-z]{3}\s+20\d\d/.test(x)) || '')
          .replace(/^.*del\s*/, '');
        const causale = vicino.find(x => /incasso|acconto|caparra|saldo/i.test(x)) || '';
        d.pagamenti.push({ importo: m[1] + ' €', modo, data, causale });
      }
    }
    return d;
  }

  /* ---------- foglio A4 ---------- */
  function foglio(d) {
    const oggi = new Date().toLocaleDateString('it-IT',
      { day: 'numeric', month: 'long', year: 'numeric' });
    const rigaAnagrafica = [
      d.cf && `C.F. ${esc(d.cf)}`, d.pi && `P.IVA ${esc(d.pi)}`,
      d.codice && `Codice ${esc(d.codice)}`, d.pec && `PEC ${esc(d.pec)}`
    ].filter(Boolean).join(' &middot; ');

    return `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8" />
<title>${esc(d.titolo || 'Documento fiscale')}</title>
<style>
  @page { size: A4; margin: 16mm 15mm 16mm 15mm; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: Georgia, 'Times New Roman', serif; color:#2A2E2B; font-size:11pt; }
  .testata { border-bottom:1.5px solid ${VERDE}; padding-bottom:16px; margin-bottom:20px;
             text-align:center; }
  .testata img { width:78mm; max-width:100%; height:auto; display:block; margin:0 auto; }
  h2 { font-size:14pt; margin:0 0 2px; }
  .stato { display:inline-block; font-size:8.5pt; font-family:Arial,Helvetica,sans-serif;
           border:1px solid ${VERDE}; color:${VERDE}; border-radius:9px; padding:1px 8px;
           vertical-align:3px; margin-left:6px; text-transform:uppercase; letter-spacing:.4px; }
  .intestazioni { display:flex; justify-content:space-between; gap:24px; margin:14px 0 18px; }
  .riquadro { flex:1; font-size:10pt; line-height:1.55; }
  .riquadro .et { font-size:8pt; letter-spacing:1px; text-transform:uppercase;
                  color:#8C8578; font-family:Arial,Helvetica,sans-serif; margin-bottom:3px; }
  table { width:100%; border-collapse:collapse; font-size:10pt; }
  th { text-align:left; font-size:8pt; letter-spacing:.8px; text-transform:uppercase;
       color:#55524B; font-family:Arial,Helvetica,sans-serif; font-weight:normal;
       border-bottom:1px solid #C9C2B4; padding:5px 6px; }
  td { padding:6px; border-bottom:1px solid #EDE8DE; vertical-align:top; }
  .n { text-align:right; white-space:nowrap; }
  .sotto { display:flex; justify-content:space-between; align-items:flex-start;
           gap:24px; margin-top:16px; }
  .iva { width:56%; }
  .iva td, .iva th { padding:4px 6px; font-size:9.5pt; }
  .iva tr.finale td { font-weight:bold; border-top:1px solid #C9C2B4; border-bottom:none; }
  .totale { text-align:right; font-size:17pt; padding-top:6px; white-space:nowrap; }
  .totale span { display:block; font-size:8pt; letter-spacing:1px; text-transform:uppercase;
                 color:#8C8578; font-family:Arial,Helvetica,sans-serif; margin-bottom:2px; }
  .pagamenti { margin-top:20px; }
  .pagamenti .et { font-size:8pt; letter-spacing:1px; text-transform:uppercase; color:#8C8578;
                   font-family:Arial,Helvetica,sans-serif; border-bottom:1px solid #C9C2B4;
                   padding-bottom:4px; margin-bottom:6px; }
  /* v1.7.6: il piè di pagina sta in fondo al foglio e si ripete su ogni
     pagina. Deve restare DENTRO l'area di stampa: con un bottom negativo
     sconfinava nel margine e Chrome apriva una seconda pagina vuota.
     Il body riserva lo spazio in basso perché il testo non ci finisca sopra. */
  body { padding-bottom:20mm; }
  footer { position:fixed; bottom:0; left:0; right:0;
           padding-top:6px; border-top:1px solid #E0D9CB;
           font-size:8pt; color:#8C8578; line-height:1.6; text-align:center;
           background:#fff; }
</style></head><body>

<div class="testata">
  <img src="${HOTEL.logo}" alt="${esc(HOTEL.nome)}" onerror="this.style.display='none'" />
</div>

<h2>${esc(d.titolo || 'Documento fiscale')}${d.stato ? `<span class="stato">${esc(d.stato)}</span>` : ''}</h2>

<div class="intestazioni">
  <div class="riquadro">
    <div class="et">Intestatario</div>
    <strong>${esc(d.cliente || '—')}</strong>
    ${(d.indirizzo || []).length ? '<br />' + d.indirizzo.map(esc).join('<br />') : ''}
    ${rigaAnagrafica ? `<br />${rigaAnagrafica}` : ''}
  </div>
  <div class="riquadro" style="text-align:right;">
    <div class="et">Documento</div>
    ${d.data ? `Data ${esc(d.data)}<br />` : ''}
    ${d.trasmissione ? `Trasmissione ${esc(d.trasmissione)}<br />` : ''}
    ${d.lotteria ? `Codice lotteria ${esc(d.lotteria)}<br />` : ''}

  </div>
</div>

<table>
  <thead><tr>
    <th>Descrizione</th><th class="n">Q.tà</th><th class="n">Prezzo unitario</th>
    <th class="n">Totale</th><th class="n">IVA</th>
  </tr></thead>
  <tbody>
    ${d.righe.length ? d.righe.map(r => `<tr>
      <td>${esc(r.descrizione)}</td><td class="n">${esc(r.q)}</td>
      <td class="n">${esc(r.prezzo)}</td><td class="n">${esc(r.totale)}</td>
      <td class="n">${esc(r.iva)}</td></tr>`).join('')
      : '<tr><td colspan="5">Nessuna riga letta dalla pagina.</td></tr>'}
  </tbody>
</table>

<div class="sotto">
  <table class="iva">
    ${d.iva.length ? `<thead><tr><th>IVA</th><th class="n">Imponibile</th>
      <th class="n">Imposta</th><th class="n">Totale</th></tr></thead><tbody>
      ${d.iva.map(r => `<tr class="${r.finale ? 'finale' : ''}">
        <td>${esc(r.aliquota)}</td><td class="n">${esc(r.imponibile)}</td>
        <td class="n">${esc(r.imposta)}</td><td class="n">${esc(r.totale)}</td></tr>`).join('')}
      </tbody>` : ''}
  </table>
  <div class="totale"><span>Totale documento</span>${esc(d.totale || '—')}</div>
</div>

${d.pagamenti.length ? `<div class="pagamenti">
  <div class="et">Pagamenti</div>
  ${d.pagamenti.map(p => `<div>${esc(p.importo)}${p.modo ? ' &middot; ' + esc(p.modo) : ''}${p.data ? ' &middot; ' + esc(p.data) : ''}${p.causale ? ' &middot; ' + esc(p.causale) : ''}</div>`).join('')}
</div>` : ''}

<footer>
  ${(MARCHIO_GSTC && MARCHIO_ENTE) ? `<div style="margin:0 0 ${(MARCHI_ALTEZZA * .33).toFixed(1)}mm;">
    <img src="${MARCHIO_GSTC}" alt="GSTC-Certified" style="height:${MARCHI_ALTEZZA}mm;vertical-align:middle;" />
    <span style="display:inline-block;width:${(MARCHI_ALTEZZA * .66).toFixed(1)}mm;"></span>
    <img src="${MARCHIO_ENTE}" alt="Vireo" style="height:${MARCHI_ALTEZZA}mm;vertical-align:middle;" />
  </div>` : ''}
  ${esc(HOTEL.societa)} &middot; ${esc(HOTEL.indirizzo)} &middot; ${esc(HOTEL.contatti)}<br />
  ${esc(HOTEL.fiscali)} &middot; ${esc(HOTEL.cin)}<br />
  Documento stampato il ${esc(oggi)} &middot; copia di cortesia del documento fiscale registrato in Fidra
</footer>
</body></html>`;
  }

  /* ---------- stampa in un iframe interno (niente pop-up) ---------- */
  function stampa(html) {
    const vecchio = document.getElementById('leoPdfFrame');
    if (vecchio) vecchio.remove();
    const f = document.createElement('iframe');
    f.id = 'leoPdfFrame';
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;';
    document.body.appendChild(f);
    f.srcdoc = html;
    f.addEventListener('load', () => {
      // il logo è remoto: un attimo perché arrivi, poi si stampa
      setTimeout(() => {
        try { f.contentWindow.focus(); f.contentWindow.print(); }
        catch (e) { avviso('Stampa non riuscita: ' + e.message, '#B3541E'); }
      }, 350);
    });
  }

  function avviso(testoMsg, colore) {
    const a = document.createElement('div');
    a.textContent = testoMsg;
    a.style.cssText = `position:fixed;bottom:130px;right:24px;z-index:2147483647;
      background:${colore || VERDE};color:#fff;padding:10px 16px;border-radius:8px;
      font-family:Arial,Helvetica,sans-serif;font-size:13px;box-shadow:0 6px 18px rgba(0,0,0,.2);`;
    document.body.appendChild(a);
    setTimeout(() => a.remove(), 4000);
  }

  /* ---------- pulsante ---------- */
  function metti() {
    if (document.getElementById('leoPdfBtn')) return;
    const b = document.createElement('button');
    b.id = 'leoPdfBtn';
    b.textContent = '\uD83D\uDCC4 PDF A4';
    b.title = 'Stampa il documento su A4 con intestazione dell\u2019hotel (poi "Salva come PDF")';
    b.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:2147483645;
      padding:12px 20px;background:${VERDE};color:#fff;border:none;border-radius:24px;
      font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;cursor:pointer;
      box-shadow:0 6px 18px rgba(51,59,32,.32);`;
    b.addEventListener('click', () => {
      try {
        const d = leggiDocumento();
        if (!d.righe.length && !d.totale) {
          avviso('Non riesco a leggere il documento da questa pagina', '#B3541E');
          return;
        }
        stampa(foglio(d));
      } catch (e) { avviso('Errore: ' + e.message, '#B3541E'); }
    });
    document.body.appendChild(b);
  }

  metti();
  // Fidra è una single page application: il pulsante va rimesso a ogni cambio pagina
  new MutationObserver(() => {
    if (/\/invoices\/\d+/.test(location.pathname)) metti();
    else document.getElementById('leoPdfBtn')?.remove();
  }).observe(document.body, { childList: true, subtree: true });
})();
