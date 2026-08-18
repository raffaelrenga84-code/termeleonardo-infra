/* ============================================================
   Offerta Leonardo — inserimento automatico in Outlook Web
   ------------------------------------------------------------
   Il popup salva l'email in chrome.storage.local e apre il
   deeplink di composizione. Questo script, su outlook.office.com,
   trova l'editor e inserisce l'HTML direttamente nel DOM: così
   la formattazione non passa dagli appunti e non viene sanificata
   (il Ctrl+V di Outlook Web rimuove sfondi, font e colori).
   Il Ctrl+V resta come riserva: il popup copia comunque negli appunti.
   ============================================================ */

(() => {
  const CHIAVE = 'leonardo_email_pendente';
  const VALIDITA_MS = 10 * 60 * 1000;   // ignora richieste più vecchie di 10 minuti
  const TENTATIVI = 60;                 // ~30 secondi di attesa dell'editor
  const INTERVALLO_MS = 500;

  function avviso(testo, colore) {
    const vecchio = document.getElementById('leonardo-avviso');
    if (vecchio) vecchio.remove();
    const div = document.createElement('div');
    div.id = 'leonardo-avviso';
    div.textContent = testo;
    div.style.cssText =
      'position:fixed;bottom:18px;left:50%;transform:translateX(-50%);' +
      'z-index:2147483647;padding:10px 22px;border-radius:6px;' +
      'font:14px/20px Arial,Helvetica,sans-serif;color:#fff;' +
      'background:' + (colore || '#1E7F88') + ';box-shadow:0 2px 10px rgba(0,0,0,.25);';
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 6000);
  }

  function trovaEditor() {
    // L'editor del corpo in Outlook Web: contenteditable con ruolo textbox.
    // Il campo oggetto è un input, quindi non collide con questo selettore.
    return document.querySelector('div[contenteditable="true"][role="textbox"]');
  }

  /* ============================================================
     v1.9.3 — VIA LA FIRMA AUTOMATICA DI OUTLOOK
     Le nostre email hanno gia' il piè di pagina dell'hotel: la firma
     che Outlook aggiunge da sola arriva subito sotto e ripete nome,
     indirizzo, telefono e dati societari.
     Si toglie solo se la si riconosce con certezza — il contenitore
     marcato da Outlook, oppure un blocco che contiene un dato
     inequivocabile della firma aziendale. Nel dubbio non si tocca
     nulla: cancellare testo di chi scrive sarebbe molto peggio che
     lasciare una ripetizione.
     ============================================================ */

  /* stringhe che compaiono solo nella firma, non in un'email scritta a mano */
  const IMPRONTE_FIRMA = [
    'IT02042330288', 'M5UXCR1', 'admin.tria@pec-mail.it',
    'Prima di stampare, pensa all', 'Think before you print'
  ];

  function togliFirmaOutlook(editor) {
    if (!editor) return 0;
    const testoDi = (el) => (el && el.innerText || '').trim();
    /* Quante impronte diverse porta un blocco. Una sola non basta:
       l'operatore può citare la P.IVA dentro il messaggio, e cancellargli
       il testo sarebbe molto peggio di una firma ripetuta. La firma vera
       ne porta sempre parecchie insieme. */
    const quanteImpronte = (t) => IMPRONTE_FIRMA.filter(x => t.includes(x)).length;
    const eFirma = (t) => quanteImpronte(t) >= 2;
    const marcati = new Set();
    const candidati = new Set();

    /* 1) il contenitore che Outlook marca come firma: qui basta il marcatore */
    editor.querySelectorAll('[id*="ignature"], [class*="ignature"], [data-testid*="ignature"]')
      .forEach(el => { candidati.add(el); marcati.add(el); });

    /* 2) blocchi riconoscibili da un dato che solo la firma contiene */
    for (const el of editor.querySelectorAll('div, table, p, section')) {
      const t = testoDi(el);
      if (!eFirma(t)) continue;
      /* Si sale finché il genitore NON aggiunge testo estraneo: così si
         prende il blocco intero della firma e ci si ferma un attimo prima
         del contenitore che comprende anche il messaggio. La proporzione
         non serve — su un messaggio nuovo la firma è tutto il contenuto. */
      let scelto = el;
      for (let p = el.parentElement; p && p !== editor; p = p.parentElement) {
        if (testoDi(p).length > testoDi(scelto).length + 40) break;
        scelto = p;
      }
      candidati.add(scelto);
    }

    /* v2.2.7 — la firma spezzata in piu' blocchi.
       Outlook la scrive come una fila di <div> fratelli: "Cordiali saluti",
       il nome dell'hotel, i dati societari, la riga sul non stampare.
       Nessuno di quei blocchi porta due impronte da solo, quindi il
       controllo per blocco non li toglieva. Su un messaggio NUOVO — dove
       non c'e' citazione e l'editor contiene solo la firma — si guarda
       l'insieme: se il testo complessivo porta due impronte e non e'
       lungo, si svuota tutto. */
    const testoTot = testoDi(editor);
    const citazione = /^(Da|From|Von|Inviato|Sent|Gesendet)\s*:/m.test(testoTot) ||
                      /-----\s*(Messaggio originale|Original Message)/i.test(testoTot);
    /* si svuota solo se OGNI blocco e' riconoscibile come parte della firma:
       se in mezzo c'e' del testo scritto da chi manda, non si tocca niente
       e si torna al controllo blocco per blocco */
    const RIGA_DI_FIRMA = /^(cordiali saluti|distinti saluti|mit freundlichen|kind regards|la reception|hotel terme leonardo|terme leonardo|via monteortone|societ|tria s\.?r\.?l|p\.\s?iva|pec|sdi|\+?39|www\.|info@|think before|prima di stampare)/i;
    const figli = editor.children ? [...editor.children] : [];
    const soloFirma = figli.length > 0 && figli.every(f => {
      const t = testoDi(f);
      return !t || quanteImpronte(t) > 0 || t.split('\n').every(r => !r.trim() || RIGA_DI_FIRMA.test(r.trim()));
    });
    if (!citazione && soloFirma && quanteImpronte(testoTot) >= 2 && testoTot.length < 1500) {
      figli.forEach(f => f.remove());
      return figli.length;
    }

    let tolti = 0;
    for (const el of candidati) {
      if (!el.isConnected || el === editor) continue;
      /* si cancella solo ciò che porta un'impronta certa: mai testo scritto
         da chi manda l'email, e mai la citazione della conversazione */
      if (!marcati.has(el) && !eFirma(testoDi(el))) continue;
      if (/^(Da|From|Von|Inviato|Sent|Gesendet)\s*:/m.test(testoDi(el))) continue;   // è una citazione
      el.remove(); tolti++;
    }
    return tolti;
  }

  function inserisci(editor, html) {
    togliFirmaOutlook(editor);
    editor.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.setStart(editor, 0);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    const ok = document.execCommand('insertHTML', false, html);
    if (!ok) {
      // riserva: inserimento diretto nel DOM
      const contenitore = document.createElement('div');
      contenitore.innerHTML = html;
      editor.insertBefore(contenitore, editor.firstChild);
    }
    editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
  }

  function esegui(dati) {
    let giri = 0;
    const timer = setInterval(() => {
      giri++;
      const editor = trovaEditor();
      if (editor) {
        clearInterval(timer);
        /* non inserire due volte (es. ricaricamento della pagina).
           v1.6.7: il controllo vale solo su un editor che ha già del
           contenuto: su un editor vuoto non c'è nulla da duplicare, e
           saltare l'inserimento lasciava la mail senza corpo. */
        if (dati.firmaContenuto && (editor.innerText || '').trim().length > 40 &&
            editor.innerHTML.includes(dati.firmaContenuto)) return;
        inserisci(editor, dati.html);
        chrome.storage.local.remove(CHIAVE);
        avviso('Email inserita — rileggi e premi Invia');
      } else if (giri >= TENTATIVI) {
        clearInterval(timer);
        avviso('Editor non trovato: usa Ctrl+V nel corpo del messaggio', '#B3541E');
      }
    }, INTERVALLO_MS);
  }

  /* ==========================================================
     BOZZA IN FIDRA DAL CENTRALINO (v1.1.1)
     Quando nel riquadro di lettura c'e' una richiesta del
     centralino vocale ("Richiesta preventivo/prenotazione. Ospite: ..."),
     appare un pulsante flottante: al clic la richiesta viene letta,
     salvata in chrome.storage e si apre il modulo Nuova Prenotazione
     di Fidra, dove fidra-booking.js la usa per precompilare i campi.
     ========================================================== */
/* ============================================================
   Parser delle richieste del centralino vocale (Grok Voice)
   Gestisce i due formati osservati nelle mail reali:
   A) a righe:  "Ospite: ...\nEmail: ...\nDate: 14-15 agosto 2026 (1 notte)\nPersone: 1 adulto, 0 bambini\nTrattamento: ..."
   B) in linea: "Richiesta preventivo. Ospite: ... Tel: ... Date: 9-11 agosto 2026 (2 notti). Adulti: 2, bambini: 0. Preferenza: ..."
   ============================================================ */
const MESI_IT = {
  gennaio:1, febbraio:2, marzo:3, aprile:4, maggio:5, giugno:6, luglio:7,
  agosto:8, settembre:9, ottobre:10, novembre:11, dicembre:12,
  gen:1, feb:2, mar:3, apr:4, mag:5, giu:6, lug:7, ago:8, set:9, ott:10, nov:11, dic:12
};

function campoDopo(testo, etichette) {
  for (const et of etichette) {
    const re = new RegExp(et + String.raw`\s*:\s*([^\n]*?)(?=(?:\.\s+[A-ZÀ-Ù][a-zà-ù]+\s*:|\n|$))`, 'i');
    const m = testo.match(re);
    if (m && m[1].trim()) return m[1].trim().replace(/[.\s]+$/, '');
  }
  return null;
}

function parseCentralino(testo) {
  const t = String(testo || '').replace(/\r/g, '');
  if (!/Richiesta\s+(preventivo|prenotazione)/i.test(t) || !/Ospite\s*:/i.test(t)) return null;

  const r = { fonte: 'Telefono', testoOriginale: t.replace(/\s+/g, ' ').trim().slice(0, 600) };
  r.tipo = /Richiesta\s+prenotazione/i.test(t) ? 'prenotazione' : 'preventivo';

  // ospite: "Nome Cognome" → in Fidra nome = tutte le parole meno l'ultima, cognome = ultima
  const ospite = campoDopo(t, ['Ospite']);
  if (ospite) {
    r.ospite = ospite;
    const parti = ospite.trim().split(/\s+/);
    r.cognome = parti.length > 1 ? parti[parti.length - 1] : parti[0];
    r.nome = parti.length > 1 ? parti.slice(0, -1).join(' ') : '';
  }

  const tel = campoDopo(t, ['Tel(?:efono)?']);
  if (tel && /\d{6,}/.test(tel.replace(/\s/g, ''))) r.telefono = tel.replace(/[^\d+]/g, '');

  const em = t.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  if (em && !/nessuna email/i.test(t.slice(Math.max(0, em.index - 30), em.index))) r.email = em[0];

  // date — stesso mese: "14-15 agosto 2026" · mesi diversi: "30 agosto - 2 settembre 2026"
  let d = t.match(/Date\s*:\s*(\d{1,2})\s*[-–]\s*(\d{1,2})\s+([a-zà-ù]+)\s+(\d{4})/i);
  if (d) {
    const mese = MESI_IT[d[3].toLowerCase()];
    if (mese) r.arrivo = { g: +d[1], m: mese, a: +d[4] }, r.partenza = { g: +d[2], m: mese, a: +d[4] };
  } else {
    d = t.match(/Date\s*:\s*(\d{1,2})\s+([a-zà-ù]+)\s*[-–]\s*(\d{1,2})\s+([a-zà-ù]+)\s+(\d{4})/i);
    if (d) {
      const m1 = MESI_IT[d[2].toLowerCase()], m2 = MESI_IT[d[4].toLowerCase()];
      if (m1 && m2) {
        r.arrivo = { g: +d[1], m: m1, a: +d[5] };
        r.partenza = { g: +d[3], m: m2, a: m2 < m1 ? +d[5] + 1 : +d[5] };
      }
    }
  }
  const nt = t.match(/\((\d+)\s*nott/i);
  if (nt) r.notti = +nt[1];

  // persone — "Persone: 1 adulto, 0 bambini" oppure "Adulti: 2, bambini: 0"
  let a = t.match(/Adulti\s*:\s*(\d+)/i) || t.match(/(\d+)\s*adult[oi]/i);
  if (a) r.adulti = +a[1];
  let b = t.match(/[Bb]ambini\s*:\s*(\d+)/) || t.match(/(\d+)\s*bambin[oi]/i);
  if (b) r.bambini = +b[1];
  const eta = t.match(/(?:et[aà]|anni)[^.\n]*?((?:\d{1,2}(?:\s*,\s*|\s+e\s+|\s+))+\d{0,2})/i);
  if (eta && r.bambini > 0) r.etaBambini = eta[1].trim();

  // trattamento
  if (/mezza\s*pensione|half\s*board/i.test(t)) r.trattamento = 'Mezza Pensione';
  else if (/bed\s*(?:&|and|e)\s*breakfast|B\s*&\s*B|colazione/i.test(t)) r.trattamento = 'Bed & Breakfast';

  r.preferenza = campoDopo(t, ['Preferenz[ae](?:\\s+camera)?']);
  r.note = campoDopo(t, ['Note']);
  return r;
}

  /* ---------- richieste in testo libero (v1.1.1) ----------
     Email dirette degli ospiti: date + parole da richiesta. I campi non
     dichiarati restano vuoti: il pannello li evidenzia, nessuna invenzione. */
  const PAROLE_RICHIESTA = /prenotazion|prenotare|disponibilit|preventivo|soggiorn|camera|check\s*out|Buchung|Anfrage|Zimmer|reservier|Verf&?uuml;gbark|Verfügbark|r&eacute;servation|réservation|booking|availab/i;

  function annoDedotto(mese, giorno) {
    const oggi = new Date();
    let anno = oggi.getFullYear();
    const cand = new Date(anno, mese - 1, giorno);
    if (cand < new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate())) anno++;
    return anno;
  }

  function parseLibera(testo, mittente) {
    const t = String(testo || '');
    const r = { fonte: 'Email', tipo: 'preventivo', testoOriginale: t.replace(/\s+/g, ' ').trim().slice(0, 600) };
    if (mittente) {
      if (mittente.email) r.email = mittente.email;
      if (mittente.nome) {
        r.ospite = mittente.nome;
        const parti = mittente.nome.trim().split(/\s+/);
        r.cognome = parti[parti.length - 1];
        r.nome = parti.slice(0, -1).join(' ');
      }
    }
    // date: "dal 12 al 13 agosto (2026)" · "12-13 agosto" · "vom 12. bis 13. August"
    let m = t.match(/dal\s+(\d{1,2})\s+al\s+(\d{1,2})\s+([a-zà-ù]+)(?:\s+(\d{4}))?/i)
         || t.match(/(\d{1,2})\s*[-–\/]\s*(\d{1,2})\s+([a-zà-ù]+)(?:\s+(\d{4}))?/i)
         || t.match(/vom\s+(\d{1,2})\.?\s*(?:bis|[-–])\s*(\d{1,2})\.?\s*([A-Za-zäöü]+)(?:\s+(\d{4}))?/i);
    if (m) {
      const MESI_DE = { januar:1, februar:2, m\u00e4rz:3, april:4, mai:5, juni:6, juli:7, august:8, september:9, oktober:10, november:11, dezember:12 };
      const chiave = m[3].toLowerCase();
      const mese = MESI_IT[chiave] || MESI_DE[chiave];
      if (mese) {
        const anno = m[4] ? +m[4] : annoDedotto(mese, +m[1]);
        r.arrivo = { g: +m[1], m: mese, a: anno };
        r.partenza = { g: +m[2], m: mese, a: anno };
        r.notti = Math.max(1, +m[2] - +m[1]);
      }
    }
    let a = t.match(/(\d+)\s*(?:adult[oi]|person[ae]|Personen|Erwachsene)/i);
    if (a) r.adulti = +a[1];
    else if (/\bin due\b|\bper due\b|zu zweit/i.test(t)) r.adulti = 2;
    const b = t.match(/(\d+)\s*(?:bambin[oi]|Kind(?:er)?)/i);
    if (b) r.bambini = +b[1];
    if (/mezza\s*pensione|halbpension|half\s*board/i.test(t)) r.trattamento = 'Mezza Pensione';
    else if (/colazione|fr\u00fchst\u00fcck|b\s*&\s*b|bed\s*(?:&|and)\s*breakfast/i.test(t)) r.trattamento = 'Bed & Breakfast';
    r.note = t.replace(/\s+/g, ' ').trim().slice(0, 300);
    return (r.arrivo || r.email) ? r : null;
  }

  function mittenteDaPagina() {
    // intestazione OWA: "Nome Cognome<indirizzo@dominio>"
    const testo = areaLettura().innerText || '';
    const mm = testo.match(/([A-ZÀ-Ü][^\n<>]{1,45}?)\s*<\s*([\w.+-]+@(?!termeleonardo|hldv)[\w.-]+\.[a-z]{2,})\s*>/i);
    if (mm) return { nome: mm[1].trim(), email: mm[2].trim() };
    return null;
  }

  function trovaRichiestaLibera() {
    let migliore = null;
    for (const e of areaLettura().querySelectorAll('div, td, p')) {
      if (!e.offsetParent) continue;
      const txt = e.innerText || '';
      if (txt.length < 40 || txt.length > 2500) continue;
      if (!PAROLE_RICHIESTA.test(txt)) continue;
      if (!/\d{1,2}\s*(?:al|[-–\/]|bis)\s*\d{1,2}|dal\s+\d{1,2}|vom\s+\d{1,2}/i.test(txt)) continue;
      if (!migliore || txt.length < (migliore.innerText || '').length) migliore = e;
    }
    return migliore;
  }

  function areaLettura() {
    // OWA tiene nel DOM anche messaggi gia' aperti e anteprime dell'elenco:
    // si cerca SOLO nel riquadro di lettura visibile.
    return document.querySelector('div[role="main"]') || document.body;
  }

  function trovaRichiestaCentralino() {
    // l'elemento piu' piccolo, VISIBILE, che contiene la richiesta completa
    let migliore = null;
    for (const e of areaLettura().querySelectorAll('div, td, p')) {
      if (!e.offsetParent) continue;
      const txt = e.innerText || '';
      if (txt.length < 60 || txt.length > 4000) continue;
      if (/Richiesta\s+(preventivo|prenotazione)/i.test(txt) && /Ospite\s*:/i.test(txt)) {
        if (!migliore || txt.length < (migliore.innerText || '').length) migliore = e;
      }
    }
    return migliore;
  }

  function mostraPulsanteCentralino() {
    if (document.getElementById('leonardo-bozza-btn')) return;
    const el = trovaRichiestaCentralino();
    if (!el) return;
    const btn = document.createElement('button');
    btn.id = 'leonardo-bozza-btn';
    btn.textContent = '\u{1F4CB} Prepara bozza in Fidra';
    btn.style.cssText =
      'position:fixed;bottom:70px;right:24px;z-index:2147483647;' +
      'padding:12px 20px;border:0;border-radius:8px;cursor:pointer;' +
      'font:600 14px/18px Arial,Helvetica,sans-serif;color:#fff;' +
      'background:#1E7F88;box-shadow:0 3px 12px rgba(0,0,0,.3);';
    btn.addEventListener('click', () => {
      const daCentralino = trovaRichiestaCentralino();
      let dati = daCentralino ? parseCentralino(daCentralino.innerText) : null;
      if (!dati) {
        const libera = trovaRichiestaLibera();
        if (libera) dati = parseLibera(libera.innerText, mittenteDaPagina());
      }
      if (!dati || (!dati.arrivo && !dati.email)) {
        avviso('Richiesta non leggibile: apri la mail per intero e riprova', '#B3541E');
        return;
      }
      dati.creato = Date.now();
      chrome.storage.local.set({ leonardo_bozza_centralino: dati }, () => {
        avviso('Richiesta letta: apro il modulo di Fidra');
        window.open('https://leonardo.fidra.cloud/booking', '_blank');
      });
    });
    document.body.appendChild(btn);
  }

  // il riquadro di lettura cambia via SPA: controllo periodico leggero
  setInterval(() => {
    const btn = document.getElementById('leonardo-bozza-btn');
    const c = trovaRichiestaCentralino() || trovaRichiestaLibera();
    if (c && !btn) mostraPulsanteCentralino();
    if (!c && btn) btn.remove();

    const btnSpa = document.getElementById('leonardo-dayspa-btn');
    const spa = trovaRichiestaDaySpa();
    if (spa && !btnSpa) mostraPulsanteDaySpa();
    if (!spa && btnSpa) btnSpa.remove();
  }, 1500);

  /* ==========================================================
     RISPOSTA INFO DAY SPA (v1.2)
     Le richieste sul Day Spa non passano da Fidra: quando la mail
     aperta parla di ingresso, prezzi o orari delle piscine, un
     pulsante prepara la risposta col modello Day Spa nella lingua
     della richiesta. L'inserimento usa la stessa sentinella del
     flusso "Rispondi": si preme Rispondi e il testo entra da solo.
     ========================================================== */
  const DAYSPA_TEMA = /day\s*-?\s*spa|piscin\w*|pool|thermalb\w*|thermen?\b|tageskarte|day\s*ticket|grotte|sauna|spa\b/i;
  const DAYSPA_CONTESTO = /prezz\w*|quanto\s+costa|cost[oaie]\b|tariff\w*|orari?\w*|apert\w*|apre|aprono|ingress\w*|entrat\w*|bigliett\w*|eintritt\w*|preis\w*|\u00f6ffnungszeit\w*|price\w*|how\s+much|open(?:ing)?\b|hours|admission|ticket\w*|tarif\w*|horaire\w*|combien|entr\u00e9e|ouvert\w*/i;

  function trovaRichiestaDaySpa() {
    let migliore = null;
    for (const e of areaLettura().querySelectorAll('div, td, p')) {
      if (!e.offsetParent) continue;
      const txt = e.innerText || '';
      if (txt.length < 15 || txt.length > 2500) continue;
      if (!DAYSPA_TEMA.test(txt) || !DAYSPA_CONTESTO.test(txt)) continue;
      // le richieste di soggiorno restano al pulsante della bozza
      if (/Richiesta\s+(preventivo|prenotazione)/i.test(txt)) continue;
      if (!migliore || txt.length < (migliore.innerText || '').length) migliore = e;
    }
    return migliore;
  }

  function linguaTesto(t) {
    const s = ' ' + String(t || '').toLowerCase() + ' ';
    const punte = {
      de: (s.match(/\b(und|ich|wir|bitte|preise?|f\u00fcr|m\u00f6chten?|guten|sehr|danke|\u00f6ffnungszeiten|eintritt|kostet)\b/g) || []).length,
      en: (s.match(/\b(the|and|please|price|prices|would|hello|thanks|open|how|much|ticket|pools?)\b/g) || []).length,
      fr: (s.match(/\b(bonjour|merci|vous|tarifs?|combien|est-ce|nous|entr\u00e9e|horaires?|piscines?)\b/g) || []).length,
      it: (s.match(/\b(buongiorno|buonasera|salve|grazie|vorrei|vorremmo|quanto|costa|orari|ingresso|prezzi|piscine|informazioni|sapere)\b/g) || []).length
    };
    let scelta = 'it', max = 0;
    for (const l of Object.keys(punte)) if (punte[l] > max) { max = punte[l]; scelta = l; }
    return scelta;
  }

  const DAYSPA_NOMI = { it: 'Cliente', de: 'Gast', en: 'Guest', fr: 'Madame, Monsieur' };

  function mostraPulsanteDaySpa() {
    if (document.getElementById('leonardo-dayspa-btn')) return;
    if (!trovaRichiestaDaySpa()) return;
    const btn = document.createElement('button');
    btn.id = 'leonardo-dayspa-btn';
    btn.textContent = '\u{1F4A7} Rispondi: Info Day Spa';
    btn.style.cssText =
      'position:fixed;bottom:122px;right:24px;z-index:2147483647;' +
      'padding:12px 20px;border:0;border-radius:8px;cursor:pointer;' +
      'font:600 14px/18px Arial,Helvetica,sans-serif;color:#fff;' +
      'background:#0F5C64;box-shadow:0 3px 12px rgba(0,0,0,.3);';
    btn.addEventListener('click', () => {
      const el = trovaRichiestaDaySpa();
      if (!el) { avviso('Richiesta non pi\u00f9 visibile: apri la mail e riprova', '#B3541E'); return; }
      const lingua = linguaTesto(el.innerText || '');
      const mitt = mittenteDaPagina();
      chrome.storage.local.get(['firma'], (ris) => {
        const o = { genere: 'N', firma: (ris && ris.firma) || 'La Reception' };
        const d = { intestatario: (mitt && mitt.nome) || DAYSPA_NOMI[lingua] || 'Cliente' };
        const build = { it: costruisciDaySpaIT, de: costruisciDaySpaDE, en: costruisciDaySpaEN, fr: costruisciDaySpaFR };
        const html = (build[lingua] || build.it)(d, o);
        chrome.storage.local.set({ [CHIAVE]: { html, creato: Date.now(), firmaContenuto: 'day-spa/prenotazioni' } }, () => {
          avviso('Info Day Spa pronta (' + lingua.toUpperCase() + '): premi Rispondi, il testo si inserisce da solo');
        });
      });
    });
    document.body.appendChild(btn);
  }

  /* ---------- ricerca automatica nella casella di Outlook (v1.1.1) ---------- */
  const CHIAVE_RICERCA = 'leonardo_ricerca_outlook';

  function trovaCasellaRicerca() {
    return document.querySelector('input#topSearchInput')
        || document.querySelector('input[type="search"]')
        || document.querySelector('[role="search"] input')
        || document.querySelector('input[aria-label*="erca"]')     // Cerca / Ricerca
        || document.querySelector('input[aria-label*="earch"]');   // Search
  }

  function scriviNativo(input, valore) {
    // React ignora input.value diretto: serve il setter nativo + evento input
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, valore);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  async function eseguiRicerca(dati) {
    // OWA all'avvio monta una casella provvisoria e poi la SOSTITUISCE:
    // scrivere subito va a vuoto. Quindi: scrivo, verifico che il testo
    // sia rimasto, e se la casella e' stata rimpiazzata riprovo su quella nuova.
    const attesa = (ms) => new Promise(r => setTimeout(r, ms));
    await attesa(3000); // lascio partire l'interfaccia
    for (let giro = 0; giro < 15; giro++) {
      const box = trovaCasellaRicerca();
      if (box) {
        box.focus();
        scriviNativo(box, dati.q);
        await attesa(400);
        const invio = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true };
        box.dispatchEvent(new KeyboardEvent('keydown', invio));
        box.dispatchEvent(new KeyboardEvent('keyup', invio));
        await attesa(1300);
        const box2 = trovaCasellaRicerca();
        if (box2 && box2.value === dati.q) {
          chrome.storage.local.remove(CHIAVE_RICERCA);
          avviso('Ricerca: ' + dati.q);
          return;
        }
        // casella sostituita o svuotata: nuovo giro sulla casella attuale
      } else {
        await attesa(1200);
      }
    }
    avviso('Ricerca non partita: incolla con Ctrl+V nella casella', '#B3541E');
  }


  /* Sentinella continua (v1.1.1): l'email pendente puo' arrivare mentre
     Outlook e' gia' aperto (flusso "Rispondi" alla mail del cliente).
     Ogni secondo: se c'e' un'email in attesa e compare un editor di
     composizione che non la contiene, la inserisce in testa, sopra la
     citazione del messaggio del cliente. */
  let pendente = null;
  let inseritoPer = null;

  function aggiorna(ris) {
    const email = ris && ris[CHIAVE];
    pendente = (email && email.html && Date.now() - (email.creato || 0) <= VALIDITA_MS) ? email : null;
  }
  chrome.storage.local.get([CHIAVE, CHIAVE_RICERCA], (ris) => {
    aggiorna(ris);
    const ricerca = ris && ris[CHIAVE_RICERCA];
    if (ricerca && ricerca.q && Date.now() - (ricerca.creato || 0) <= VALIDITA_MS) {
      eseguiRicerca(ricerca);
    } else if (ricerca) {
      chrome.storage.local.remove(CHIAVE_RICERCA);
    }
  });
  chrome.storage.onChanged.addListener((cambi, area) => {
    if (area !== 'local') return;
    if (cambi[CHIAVE]) {
      const v = cambi[CHIAVE].newValue;
      pendente = (v && v.html) ? v : null;
      inseritoPer = null;
    }
    if (cambi[CHIAVE_RICERCA] && cambi[CHIAVE_RICERCA].newValue) {
      eseguiRicerca(cambi[CHIAVE_RICERCA].newValue);
    }
  });

  setInterval(() => {
    if (!pendente) return;
    if (Date.now() - (pendente.creato || 0) > VALIDITA_MS) {
      pendente = null;
      chrome.storage.local.remove(CHIAVE);
      return;
    }
    const editor = trovaEditor();
    if (!editor) return;
    const firma = pendente.firmaContenuto || '';
    const pieno = (editor.innerText || '').trim().length > 40;
    if (firma && ((pieno && editor.innerHTML.includes(firma)) || inseritoPer === firma)) return;
    inserisci(editor, pendente.html);
    inseritoPer = firma;
    pendente = null;
    chrome.storage.local.remove(CHIAVE);
    avviso('Email inserita — rileggi e premi Invia');
  }, 1000);
})();
