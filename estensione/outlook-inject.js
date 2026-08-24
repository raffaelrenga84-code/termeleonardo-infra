(() => {
  'use strict';

  /* ============================================================
     v2.7.5 — DENTRO I FRAME
     Outlook mette il corpo del messaggio in un frame, e aprendo la mail
     in una finestra a se' l'indirizzo diventa «about:blank». Nessuna
     delle due cose era coperta: lo script girava solo sulla pagina
     principale, dove il testo della mail non c'e'.
     Ora il manifest lo carica anche nei frame. Qui dentro pero' non si
     disegna niente e non si tocca la posta: il frame fa una cosa sola,
     mandare alla pagina principale il testo che vede. Il resto — i
     pulsanti, l'anteprima, l'inserimento della risposta — resta dove
     l'operatore lo vede, cioe' nella finestra vera.
     ============================================================ */
  const IN_UN_FRAME = window !== window.top;
  if (IN_UN_FRAME) {
    const manda = () => {
      const testo = (document.body && document.body.innerText) || '';
      if (testo.length < 40) return;
      try { window.top.postMessage({ leonardo: 'testo-frame', testo: testo.slice(0, 20000) }, '*'); }
      catch (e) { /* il genitore non ci ascolta: pazienza */ }
    };
    setTimeout(manda, 600);
    setInterval(manda, 2000);
    /* v2.7.6: un segno che lo script c'e'. Senza, non c'e' modo di
       distinguere «non gira» da «gira ma non riconosce», e si finisce a
       tirare a indovinare. */
    console.log('%cLeonardo 2.8.13 — attivo in un frame', 'color:#8C8578',
      { indirizzo: location.href.slice(0, 80), caratteri: (document.body && document.body.innerText || '').length });
    window.leoDiagnostica = () => ({
      dove: 'frame', indirizzo: location.href,
      caratteri: (document.body && document.body.innerText || '').length,
      primi300: ((document.body && document.body.innerText) || '').replace(/\s+/g, ' ').slice(0, 300)
    });
    return;   // nel frame non si fa altro
  }

  /* quel che i frame ci mandano: l'ultimo testo ricevuto, con l'ora */
  let TESTO_DAI_FRAME = { testo: '', quando: 0 };
  window.addEventListener('message', (ev) => {
    const d = ev && ev.data;
    if (d && d.leonardo === 'testo-frame' && typeof d.testo === 'string') {
      TESTO_DAI_FRAME = { testo: d.testo, quando: Date.now() };
    }
  });

  function testoDaiFrame() {
    return (Date.now() - TESTO_DAI_FRAME.quando < 8000) ? TESTO_DAI_FRAME.testo : '';
  }
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
  /* v2.8.7 — l'elenco era quasi tutto italiano e tedesco: «camera» c'era,
     «room» no. Una richiesta come «what could be the price for one room
     1 adult, from 25.09- 3.10?» non faceva comparire il pulsante, pur
     essendo un preventivo in piena regola. Aggiunte le parole che gli
     ospiti inglesi e francesi usano davvero al posto di «booking». */
  const PAROLE_RICHIESTA = new RegExp([
    /* italiano */ 'prenotazion', 'prenotare', 'disponibilit', 'preventivo', 'soggiorn',
    'camera', 'camere', 'tariff', 'prezz', 'nott[ei]', 'quotazione',
    /* tedesco  */ 'Buchung', 'Anfrage', 'Zimmer', 'reservier', 'Verf&?uuml;gbark',
    'Verfügbark', 'Preis', 'Übernacht', 'Uebernacht', 'Aufenthalt', 'Angebot',
    /* inglese  */ 'booking', 'availab', 'check\\s*out', 'rooms?\\b', 'price', 'rates?\\b',
    'quote', 'nights?\\b', '\\bstay\\b', 'vacanc', 'reservation',
    /* francese */ 'r&eacute;servation', 'réservation', 'chambres?\\b', 'tarif',
    'prix', 'nuit', 's&eacute;jour', 'séjour', 'sejour', 'devis'
  ].join('|'), 'i');

  function annoDedotto(mese, giorno) {
    const oggi = new Date();
    let anno = oggi.getFullYear();
    const cand = new Date(anno, mese - 1, giorno);
    if (cand < new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate())) anno++;
    return anno;
  }

  /* ============================================================
     v2.9.3 — LE DATE SI LEGGONO IN UN POSTO SOLO
     ------------------------------------------------------------
     Questo blocco stava dentro parseLibera, e trovaRichiestaLibera
     filtrava gli elementi della pagina con una SUA regola sulle date,
     piu' stretta: conosceva «dal 12 al 13», «12-13» e «vom 12. bis»,
     e basta. Su una richiesta inglese — «from 29 to 30 August» — il
     corpo del messaggio non diventava mai candidato: passava solo
     qualche elemento piu' grande che conteneva l'oggetto della mail,
     con le date dentro e le persone, il cane e il trattamento fuori.
     L'anteprima scriveva «Persone: non lette» su un'email che diceva
     «2 adults, 1 girl, 15 year old».

     E' lo stesso difetto della v2.7.10: il ciclo accettava piu' cose
     della funzione che chiamava. Due grammatiche per la stessa cosa
     divergono sempre — qui ce n'e' una sola, e la usano tutte e due.
     ============================================================ */
  function leggiDate(testo) {
    const t = String(testo || '');
    const r = {};
    // date: "dal 12 al 13 agosto (2026)" · "12-13 agosto" · "vom 12. bis 13. August"
    /* v2.7: due modi di scrivere le date che i clienti usano davvero e che
       prima sfuggivano — verificati sulle richieste di Ippolito e Kreiner:
         "con arrivo venerdi' 21 agosto e partenza domenica 23 agosto 2026"
         "Dienstag 27. Oktober bis Samstag 31. Oktober 2026"
       Il giorno della settimana in mezzo va saltato, e i due mesi possono
       essere scritti entrambi (anche diversi: 30 ottobre - 2 novembre). */
    const GIORNI = String.raw`(?:lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica|` +
                   String.raw`Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)`;
    let m = t.match(/dal\s+(\d{1,2})\s+al\s+(\d{1,2})\s+([a-zà-ù]+)(?:\s+(\d{4}))?/i)
         || t.match(/(\d{1,2})\s*[-–\/]\s*(\d{1,2})\s+([a-zà-ù]+)(?:\s+(\d{4}))?/i)
         || t.match(/vom\s+(\d{1,2})\.?\s*(?:bis|[-–])\s*(\d{1,2})\.?\s*([A-Za-zäöü]+)(?:\s+(\d{4}))?/i)
         /* v2.7.3: inglese e francese. Il tipo di camera lo leggevamo gia'
            in tutte e quattro le lingue, ma senza le date la richiesta non
            veniva riconosciuta affatto e la deduzione non serviva a niente. */
         || t.match(/from\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(?:to|until|till)\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([A-Za-z]+)(?:\s+(\d{4}))?/i)
         || t.match(/du\s+(\d{1,2})(?:er)?\s+au\s+(\d{1,2})\s+([a-zà-ûü]+)(?:\s+(\d{4}))?/i);

    /* forma con i due mesi scritti per esteso */
    let m2 = null;
    if (!m && !r.arrivo) {
      const dueMesi = new RegExp(
        String.raw`(?:arrivo|anreise|ankunft|dal|vom|ab)?\s*(?:` + GIORNI + String.raw`)?\s*` +
        String.raw`(\d{1,2})\.?\s+([a-zà-ùäöü]+)(?:\s+(\d{4}))?` +
        String.raw`[^\d]{0,40}?(?:partenza|abreise|al|bis|fino al|to)\s*(?:` + GIORNI + String.raw`)?\s*` +
        String.raw`(\d{1,2})\.?\s+([a-zà-ùäöü]+)(?:\s+(\d{4}))?`, 'i');
      m2 = t.match(dueMesi);
    }
    if (m2) {
      const ALTRI = { januar:1, februar:2, 'märz':3, april:4, mai:5, juni:6, juli:7,
                      august:8, september:9, oktober:10, november:11, dezember:12,
                      january:1, march:3, may:5, june:6, july:7, october:10, december:12,
                      janvier:1, 'février':2, fevrier:2, mars:3, avril:4, juin:6, juillet:7,
                      'août':8, aout:8, septembre:9, octobre:10, novembre:11, 'décembre':12 };
      const mese1 = MESI_IT[m2[2].toLowerCase()] || ALTRI[m2[2].toLowerCase()];
      const mese2 = MESI_IT[m2[5].toLowerCase()] || ALTRI[m2[5].toLowerCase()];
      if (mese1 && mese2) {
        const anno1 = m2[3] ? +m2[3] : (m2[6] ? +m2[6] : annoDedotto(mese1, +m2[1]));
        const anno2 = m2[6] ? +m2[6] : (mese2 < mese1 ? anno1 + 1 : anno1);
        r.arrivo = { g: +m2[1], m: mese1, a: anno1 };
        r.partenza = { g: +m2[4], m: mese2, a: anno2 };
        const g1 = new Date(anno1, mese1 - 1, +m2[1]), g2 = new Date(anno2, mese2 - 1, +m2[4]);
        const n = Math.round((g2 - g1) / 86400000);
        if (n > 0 && n < 60) r.notti = n;
      }
    }
    if (m) {
      const MESI_DE = { januar:1, februar:2, m\u00e4rz:3, april:4, mai:5, juni:6, juli:7, august:8, september:9, oktober:10, november:11, dezember:12 };
      const MESI_EN = { january:1, february:2, march:3, april:4, may:5, june:6, july:7, august:8,
                        september:9, october:10, november:11, december:12,
                        jan:1, feb:2, mar:3, apr:4, jun:6, jul:7, aug:8, sep:9, sept:9, oct:10, nov:11, dec:12 };
      const MESI_FR = { janvier:1, f\u00e9vrier:2, fevrier:2, mars:3, avril:4, mai:5, juin:6, juillet:7,
                        ao\u00fbt:8, aout:8, septembre:9, octobre:10, novembre:11, d\u00e9cembre:12, decembre:12 };
      const chiave = m[3].toLowerCase();
      const mese = MESI_IT[chiave] || MESI_DE[chiave] || MESI_EN[chiave] || MESI_FR[chiave];
      if (mese) {
        const anno = m[4] ? +m[4] : annoDedotto(mese, +m[1]);
        r.arrivo = { g: +m[1], m: mese, a: anno };
        r.partenza = { g: +m[2], m: mese, a: anno };
        r.notti = Math.max(1, +m[2] - +m[1]);
      }
    }

    /* v2.8.7 — periodo scritto tutto in cifre: «from 25.09- 3.10»,
       «dal 25/09 al 3/10», «vom 25.09.-03.10.2026». Nessuno dei modi
       di prima lo prendeva, perche' cercavano tutti il nome di un mese.
       Si legge giorno.mese all'europea: e' come scrivono gli ospiti che
       arrivano qui, e l'anteprima mostra comunque la data per esteso
       («25 settembre 2026 → 3 ottobre 2026») proprio perche' un
       eventuale mese/giorno rovesciato salti all'occhio prima di aprire
       Fidra. */
    /* Va provato DOPO, non prima: su «dal 25/09 al 3/10» il tentativo
       coi nomi dei mesi abbocca lo stesso — legge «25/09» e poi prende
       «al» per un nome di mese — e finisce senza date ma con `m` pieno.
       Guardare `m` non basta: bisogna guardare se una data e' uscita. */
    let mNum = null;
    if (!r.arrivo) {
      mNum = t.match(
        /* il punto finale dopo il giorno e dopo il mese e' tedesco puro
           — «vom 25.09.-03.10.2026» — e senza `\.?` lo schema si ferma
           prima del trattino */
        /(?:dal|from|vom|du|ab)?\s*(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\.?\s*(?:[-–—]|al|to|until|till|bis|au|a)\s*(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\.?/i);
    }
    if (mNum) {
      const g1 = +mNum[1], me1 = +mNum[2], g2 = +mNum[4], me2 = +mNum[5];
      const valida = (g, me) => g >= 1 && g <= 31 && me >= 1 && me <= 12;
      if (valida(g1, me1) && valida(g2, me2)) {
        const norm = (v) => v == null ? null : (+v < 100 ? 2000 + +v : +v);
        const a1 = norm(mNum[3]) || annoDedotto(me1, g1);
        const a2 = norm(mNum[6]) || (me2 < me1 ? a1 + 1 : a1);
        const d1 = new Date(a1, me1 - 1, g1), d2 = new Date(a2, me2 - 1, g2);
        const n = Math.round((d2 - d1) / 86400000);
        if (n > 0 && n < 60) {
          r.arrivo = { g: g1, m: me1, a: a1 };
          r.partenza = { g: g2, m: me2, a: a2 };
          r.notti = n;
        }
      }
    }
    return r.arrivo ? r : null;
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
    const date = leggiDate(t);
    if (date) { r.arrivo = date.arrivo; r.partenza = date.partenza; r.notti = date.notti; }

    /* "Person(en)?" e non "Personen?": il secondo vuol dire «Persone» con la
       n facoltativa, e lasciava fuori proprio "1 Person" — il caso di chi
       viaggia solo, che e' quello dove serve il supplemento uso singola. */
    /* v2.8.7: «adult[oi]» copriva adulto e adulti ma non l'inglese
       «1 adult» — proprio il caso di chi viaggia solo, dove serve il
       supplemento uso singola. */
    /* v2.9.3 — «adulti» e «persone» non sono la stessa parola. Prendendo il
       primo numero che capitava, «3 guests (2 adults, 1 child)» dava tre
       adulti PIU' un bambino: quattro persone dove ce ne sono tre, ed e' il
       numero che moltiplica il prezzo. Ora si cerca prima la parola che
       parla solo di adulti; il totale vale come ripiego, e se i bambini si
       sono letti si sottraggono da quel totale. */
    let a = t.match(/(\d+)\s*(?:adult[oi]|adults?|adultes?|Erwachsene[rn]?)\b/i);
    let daTotale = false;
    if (!a) {
      a = t.match(/(\d+)\s*(?:person[ae]|personnes?|Person(?:en)?|guests?|people|pax|H[oö]st)\b/i);
      daTotale = !!a;
    }
    if (a) { r.adulti = +a[1]; r.adultiDaTotale = daTotale; }
    else if (/\bin due\b|\bper due\b|zu zweit/i.test(t)) r.adulti = 2;
    else {
      /* v2.7.1: chi scrive «una camera matrimoniale» quasi mai aggiunge «per
         due persone»: lo da' per scontato. Il tipo di camera lo dice, e senza
         questa deduzione l'anteprima restava muta proprio sul dato che
         determina il supplemento uso singola. Resta una deduzione, e come
         tale viene dichiarata nel riquadro. */
      /* L'ordine conta. «Doppia uso singola» contiene «doppia», ma le
         persone sono una: se si guardasse prima il tipo di camera si
         dedurrebbe due, e sarebbe l'errore peggiore possibile — proprio
         il caso in cui serve il supplemento uso singola. Per questo la
         riga dell'uso singola viene per prima e vince su tutte.
         Le sigle (DZ, EZ, DBL, SGL) sono quelle che i clienti tedeschi e
         le agenzie usano piu' delle parole intere. */
      const DA_CAMERA = [
        [/\buso\s+singol\w*|\bd\.?u\.?s\.?\b|\bAlleinbenutzung\b|\bEinzelnutzung\b|\bEinzelbelegung\b|\bsingle\s+(?:use|occupancy)\b|\busage\s+individuel\b/i, 1],
        [/\bsingol[aei]\b|\bEinzelzimmer\b|\bEZ\b|\bsingle\s*rooms?\b|\bSGL\b|\bchambres?\s+simples?\b/i, 1],
        [/\bmatrimonial[aei]\b|\bdoppi[ae]\b|\bDoppelzimmer\b|\bDZ\b|\bdouble\s*rooms?\b|\bDBL\b|\btwin\b|\bTWN\b|\bchambres?\s+doubles?\b|\bqueen\b/i, 2],
        [/\btripl[ae]\b|\bDreibettzimmer\b|\bDreibett\b|\btriple\b|\bTRPL\b|\bchambres?\s+triples?\b/i, 3],
        [/\bquadrupl[ae]\b|\bfamiliare\b|\bFamilienzimmer\b|\bfamily\s*room\b|\bVierbettzimmer\b/i, 4]
      ];
      for (const [cerca, perCamera] of DA_CAMERA) {
        const m2 = t.match(cerca);
        if (!m2) continue;
        /* quante camere: «2 DZ», «due camere doppie», «zwei Doppelzimmer» */
        const prima = t.slice(Math.max(0, m2.index - 26), m2.index);
        const NUM_PAROLA = { due: 2, tre: 3, quattro: 4, cinque: 5,
                             zwei: 2, drei: 3, vier: 4, funf: 5, 'fünf': 5,
                             two: 2, three: 3, four: 4, five: 5,
                             deux: 2, trois: 3, quatre: 4, cinq: 5 };
        const mq = prima.match(/(\d+|due|tre|quattro|cinque|zwei|drei|vier|f[uü]nf|two|three|four|five|deux|trois|quatre|cinq)\s*(?:camer\w*|zimmer|rooms?|chambres?)?\s*$/i);
        let camere = 1;
        if (mq) camere = /^\d+$/.test(mq[1]) ? +mq[1] : (NUM_PAROLA[mq[1].toLowerCase()] || 1);
        if (camere > 1 && camere <= 12) {
          r.nCamere = camere;
          r.adulti = perCamera * camere;
        } else {
          r.adulti = perCamera;
        }
        r.adultiDedotti = true;
        r.tipoCameraLetto = m2[0];
        break;
      }
    }
    /* v2.9.3 \u2014 i bambini si leggevano solo in italiano e tedesco. \u00ab1 girl\u00bb,
       \u00ab1 child\u00bb, \u00abun enfant\u00bb non li vedeva nessuno, e la richiesta di Una
       Pipic \u2014 \u00ab2 adults, 1 girl, 15 year old\u00bb \u2014 usciva con \u00abPersone: non
       lette\u00bb proprio nel numero che decide il prezzo. */
    const b = t.match(/(\d+)\s*(?:bambin[oi]|ragazz[oai]|Kind(?:er)?|child(?:ren)?|kids?|enfants?|girls?|boys?)\b/i);
    if (b) r.bambini = +b[1];

    /* il numero letto era un totale di persone e i bambini sono dentro:
       si tolgono, altrimenti si contano due volte */
    if (r.adultiDaTotale && r.bambini > 0 && r.adulti > r.bambini) {
      r.adulti -= r.bambini;
      r.adultiDedotti = true;
    }

    /* v2.9.3 \u2014 l'eta' scritta a parole: \u00ab15 year old\u00bb, \u00abdi 8 anni\u00bb,
       \u00ab17 Jahre\u00bb, \u00ab5 ans\u00bb. Serve al prezzo quanto il numero: un bambino di
       due anni e uno di sedici non costano uguale. Si accettano solo le
       eta' da bambino, cosi' \u00ab7 nights\u00bb o un anno non finiscono qui. */
    const eta = [...t.matchAll(/(\d{1,2})\s*(?:anni|anno|Jahre|Jahr|ans|years?\s*old)\b/gi)]
      .map(x => +x[1]).filter(n => n >= 0 && n <= 17);
    if (eta.length && (r.bambini || 0) > 0) r.etaBambini = eta.slice(0, r.bambini).join(' ');

    /* v2.9.3 \u2014 chi scrive \u00abdinner on the 29th and breakfast on the 30th\u00bb
       sta chiedendo la mezza pensione senza chiamarla per nome. Resta una
       deduzione, e come tale viene dichiarata nell'anteprima. */
    const cena = /\bcen[ae]\b|\bdinner\b|\bAbendessen\b|\bd[\u00eei]ner\b|\bsouper\b/i.test(t);
    const colazione = /colazione|fr\u00fchst\u00fcck|fruehstueck|breakfast|petit\s*d[\u00e9e]jeuner/i.test(t);
    if (/mezza\s*pensione|halbpension|half\s*board|demi[-\s]?pension/i.test(t)) {
      r.trattamento = 'Mezza Pensione';
    } else if (cena && colazione) {
      r.trattamento = 'Mezza Pensione';
      r.trattamentoDedotto = true;
    } else if (colazione || /b\s*&\s*b|bed\s*(?:&|and)\s*breakfast/i.test(t)) {
      r.trattamento = 'Bed & Breakfast';
    }

    /* v2.9.3 \u2014 il cane non si leggeva in nessuna lingua, e costa 13 \u20ac al
       giorno. \u00abcan[ei]\u00bb e non \u00abcani?\u00bb: il secondo vuol dire \u00abcan\u00bb con la i
       facoltativa e lasciava fuori proprio \u00abcane\u00bb. */
    if (/\bcan[ei]\b|\bcagnolin\w*|\bHund(?:in)?\b|\bHunde\b|\bdogs?\b|\bchiens?\b/i.test(t)) {
      r.cane = true;
    }
    if (/\bcure\s+termali\b|\bfangh?[io]\b|\bKuranwendung|\bthermal\s+(?:cure|treatment)/i.test(t)) {
      r.cure = true;
    }

    /* v2.9.9 — tre cose che l'operatore scriveva a mano ogni volta, lette
       dalla posta inviata di agosto.

       COMUNICANTI. Su Cersosimo la reception ha dovuto aggiungere in coda
       «Le 2 matrimoniali sono comunicanti». Chi viaggia con figli lo chiede
       spesso, e finora nessuno lo leggeva. */
    if (/\bcomunicant\w*|\bcomunicanti\b|\bVerbindungst[üu]r|\bverbindend\w*|\bconnecting\s+rooms?\b|\badjoining\b|\bcommunicantes?\b/i.test(t)) {
      r.comunicanti = true;
    }

    /* PENSIONE COMPLETA. Ferrario ha chiesto tre notti in pensione completa;
       l'hotel fa solo mezza pensione e il pranzo e' al Bistrot a la carte.
       La risposta e' sempre la stessa e si scriveva a mano. */
    if (/\bpensione\s+completa\b|\bVollpension\b|\bfull\s*board\b|\bpension\s+compl[èe]te\b/i.test(t)) {
      r.pensioneCompleta = true;
      r.trattamento = r.trattamento || 'Mezza Pensione';
    }

    /* ALTERNATIVE. «Potremmo valutare una quadrupla oppure due doppie»: e'
       il modo normale di chiedere, e la spunta del pannello finora si
       accendeva solo da una nota di portineria scritta dopo. */
    if (/\boppure\b|\bin alternativa\b|\bo in alternativa\b|\balternativ\w*|\boder\b|\bor\b\s+(?:two|a|an)\b|\balternatively\b|\bou\s+bien\b/i.test(t)) {
      r.forseAlternative = true;
    }
    r.note = t.replace(/\s+/g, ' ').trim().slice(0, 300);
    return (r.arrivo || r.email) ? r : null;
  }

  /* ============================================================
     v2.7.2 — RICHIESTE DAL SITO (RS-anno-numero)
     Il modulo del sito manda una mail gia' in ordine: campi con
     l'etichetta accanto, date in cifre, prezzo e caparra che l'ospite
     ha visto sulla pagina. Non c'e' niente da indovinare, e sarebbe
     stato uno spreco passarla al lettore del testo libero — che infatti
     su "22/08/2026 → 24/08/2026" non avrebbe letto nulla.
     Il prezzo si porta dietro fino all'anteprima perche' e' quello che
     l'ospite si aspetta: se in Fidra ne esce un altro, meglio saperlo
     prima di rispondere.
     ============================================================ */
  const SITO_SEGNO = /RICHIESTA\s+DAL\s+SITO|\bRS-20\d\d-\d{3,}/i;

  function campoSito(testo, etichetta) {
    /* l'etichetta puo' stare sulla stessa riga del valore (tabella) o su
       quella sopra (colonne impilate su schermo stretto): si prova prima
       la stessa riga, poi la successiva non vuota */
    const righe = testo.split('\n').map(r => r.trim());
    const re = new RegExp('^' + etichetta + "\\s*:?\\s*(.*)$", 'i');
    for (let i = 0; i < righe.length; i++) {
      const m = righe[i].match(re);
      if (!m) continue;
      if (m[1]) return m[1].trim();
      for (let k = i + 1; k < Math.min(i + 3, righe.length); k++) {
        if (righe[k]) return righe[k].trim();
      }
    }
    return null;
  }

  function dataSito(s) {
    const m = String(s || '').match(/(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/);
    return m ? { g: +m[1], m: +m[2], a: +m[3] } : null;
  }

  function parseSito(testo) {
    const t = String(testo || '').replace(/\r/g, '');
    if (!SITO_SEGNO.test(t)) return null;
    const r = { fonte: 'Sito', tipo: 'preventivo' };

    const rif = t.match(/\bRS-20\d\d-\d{3,}\b/i);
    if (rif) r.riferimento = rif[0].toUpperCase();

    /* il nome sta fra l'intestazione e il riferimento */
    const mn = t.match(/RICHIESTA\s+DAL\s+SITO\s*\n+\s*([^\n]{2,60})/i);
    if (mn && !/^RS-/i.test(mn[1].trim())) {
      r.ospite = mn[1].trim();
      const parti = r.ospite.split(/\s+/);
      r.cognome = parti[parti.length - 1];
      r.nome = parti.slice(0, -1).join(' ');
    }

    const periodo = campoSito(t, 'Periodo') || '';
    const date = periodo.match(/(\d{1,2}[\/.]\d{1,2}[\/.]\d{4})[^\d]+(\d{1,2}[\/.]\d{1,2}[\/.]\d{4})/);
    if (date) { r.arrivo = dataSito(date[1]); r.partenza = dataSito(date[2]); }

    const sogg = campoSito(t, 'Soggiorno') || '';
    const mNotti = sogg.match(/(\d+)\s*nott/i);      if (mNotti) r.notti = +mNotti[1];
    const mAd = sogg.match(/(\d+)\s*adult/i);         if (mAd) r.adulti = +mAd[1];
    const mBa = sogg.match(/(\d+)\s*bambin/i);        if (mBa) r.bambini = +mBa[1];
    if (r.adulti == null) {
      const mOsp = sogg.match(/(\d+)\s*ospit/i);
      if (mOsp) { r.adulti = +mOsp[1]; r.adultiDedotti = true; }
    }

    const email = campoSito(t, 'Email');
    if (email && /@/.test(email)) r.email = email.replace(/\s+/g, '');
    const tel = campoSito(t, 'Telefono');
    if (tel && /\d/.test(tel)) r.telefono = tel;

    r.categoria = campoSito(t, 'Camera') || null;
    r.pacchetto = campoSito(t, 'Pacchetto') || null;
    r.trattamento = campoSito(t, 'Trattamento') || null;
    r.prezzoVisto = campoSito(t, "Prezzo visto dall'ospite") || campoSito(t, 'Prezzo') || null;
    r.caparraIndicata = campoSito(t, 'Caparra indicata') || campoSito(t, 'Caparra') || null;

    const lingua = (campoSito(t, 'Lingua') || '').toLowerCase();
    if (/ital/.test(lingua)) r.lingua = 'it';
    else if (/tedesc|deutsch|german/.test(lingua)) r.lingua = 'de';
    else if (/ingles|english/.test(lingua)) r.lingua = 'en';
    else if (/frances|fran/.test(lingua)) r.lingua = 'fr';

    r.note = t.replace(/\s+/g, ' ').trim().slice(0, 300);
    return (r.arrivo || r.email) ? r : null;
  }

  function trovaRichiestaSito() {
    let migliore = null;
    for (const e of elementiLettura('div, td, p, table')) {
      if (!visibile(e)) continue;
      const txt = e.innerText || '';
      if (txt.length < 60 || txt.length > 4000) continue;
      if (!SITO_SEGNO.test(txt)) continue;
      if (!/Periodo|Soggiorno/i.test(txt)) continue;
      if (!migliore || txt.length < (migliore.innerText || '').length) migliore = e;
    }
    return migliore;
  }

  function mittenteDaPagina() {
    // intestazione OWA: "Nome Cognome<indirizzo@dominio>"
    const testo = testoCompleto();
    const mm = testo.match(/([A-ZÀ-Ü][^\n<>]{1,45}?)\s*<\s*([\w.+-]+@(?!termeleonardo|hldv)[\w.-]+\.[a-z]{2,})\s*>/i);
    if (mm) return { nome: mm[1].trim(), email: mm[2].trim() };
    return null;
  }

  function trovaRichiestaLibera() {
    let migliore = null;
    for (const e of elementiLettura('div, td, p')) {
      if (!visibile(e)) continue;
      const txt = e.innerText || '';
      if (txt.length < 40 || txt.length > 2500) continue;
      if (!PAROLE_RICHIESTA.test(txt)) continue;
      /* v2.9.3: si chiede al lettore, non a una seconda regola. Quella di
         prima conosceva meno forme di leggiDate, e sulle richieste inglesi
         scartava proprio il corpo del messaggio. */
      if (!leggiDate(txt)) continue;
      if (!migliore || txt.length < (migliore.innerText || '').length) migliore = e;
    }
    return migliore;
  }

  /* dentro un iframe offsetParent puo' essere nullo anche per elementi
     visibilissimi: si guarda se occupano spazio sullo schermo. */
  function visibile(e) {
    if (e.offsetParent) return true;
    const r = e.getBoundingClientRect ? e.getBoundingClientRect() : null;
    return !!(r && r.width > 0 && r.height > 0);
  }

  /* v2.7.4: il nuovo Outlook (outlook.cloud.microsoft) mette il corpo del
     messaggio in un iframe. Guardando il solo documento principale non si
     trovava niente e nessun pulsante compariva. Si cercano anche i frame
     dello stesso dominio; quelli di altra origine sollevano un errore ed
     e' giusto ignorarli. */
  function radici() {
    const fuori = [document];
    for (const f of document.querySelectorAll('iframe')) {
      try {
        const d = f.contentDocument;
        if (d && d.body) fuori.push(d);
      } catch (e) { /* frame di altra origine: non ci riguarda */ }
    }
    return fuori;
  }

  /* v2.7.7: Outlook costruisce l'interfaccia con componenti che tengono il
     contenuto in uno «shadow root»: querySelectorAll non lo attraversa, e
     dal di fuori la pagina sembra vuota. Lo script girava, i frame non
     eseguono estensioni, e il testo era li' — dietro quella porta.
     Si scende dentro ogni shadow root aperto, con un limite di profondita'
     perche' l'albero di OWA e' profondo e non serve arrivare in fondo. */
  function raccogli(radice, selettore, fuori, profondita) {
    if (!radice || profondita > 12) return;
    let trovati = [];
    try { trovati = radice.querySelectorAll(selettore); } catch (e) { return; }
    for (const e of trovati) fuori.push(e);
    let tutti = [];
    try { tutti = radice.querySelectorAll('*'); } catch (e) { return; }
    for (const e of tutti) {
      if (e.shadowRoot) raccogli(e.shadowRoot, selettore, fuori, profondita + 1);
    }
  }

  function elementiLettura(selettore) {
    const fuori = [];
    for (const d of radici()) {
      const area = d.querySelector('div[role="main"]') || d.body;
      if (!area) continue;
      raccogli(area, selettore, fuori, 0);
    }
    /* il corpo del messaggio arriva anche dal frame, che non possiamo
       leggere direttamente: si presenta come un elemento qualsiasi, cosi'
       i riconoscimenti non devono sapere da dove viene */
    const dalFrame = testoDaiFrame();
    if (dalFrame) {
      fuori.push({ innerText: dalFrame, offsetParent: true, daFrame: true,
                   getBoundingClientRect: () => ({ width: 1, height: 1 }) });
    }
    return fuori;
  }

  function areaLettura() {
    return document.querySelector('div[role="main"]') || document.body;
  }

  /* tutto il testo visibile, shadow root compresi */
  function testoCompleto() {
    const pezzi = [];
    for (const d of radici()) {
      const area = d.querySelector('div[role="main"]') || d.body;
      if (!area) continue;
      pezzi.push(area.innerText || '');
      const dentro = [];
      raccogli(area, 'div, td, p', dentro, 0);
      for (const e of dentro) {
        if (e.getRootNode && e.getRootNode() !== d) pezzi.push(e.innerText || '');
      }
    }
    pezzi.push(testoDaiFrame());
    return pezzi.join('\n');
  }

  function quantiShadow() {
    let n = 0;
    for (const d of radici()) {
      let tutti = [];
      try { tutti = d.querySelectorAll('*'); } catch (e) { continue; }
      for (const e of tutti) if (e.shadowRoot) n++;
    }
    return n;
  }

  function trovaRichiestaCentralino() {
    // l'elemento piu' piccolo, VISIBILE, che contiene la richiesta completa
    let migliore = null;
    for (const e of elementiLettura('div, td, p')) {
      if (!visibile(e)) continue;
      const txt = e.innerText || '';
      if (txt.length < 60 || txt.length > 4000) continue;
      if (/Richiesta\s+(preventivo|prenotazione)/i.test(txt) && /Ospite\s*:/i.test(txt)) {
        if (!migliore || txt.length < (migliore.innerText || '').length) migliore = e;
      }
    }
    return migliore;
  }

  /* ============================================================
     v2.7 — PRIMA DI APRIRE FIDRA, DIRE COSA SI E' CAPITO
     La lettura della richiesta sbaglia, e il caso peggiore non e'
     quando fallisce: e' quando produce date plausibili ma sbagliate,
     che finiscono in una prenotazione e poi in un'offerta senza che
     nessuno le abbia lette. Qui si mostrano prima, e si prosegue solo
     con un secondo clic.
     ============================================================ */
  const MESI_NOME = ['', 'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
                     'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

  function dataLeggibile(d) {
    if (!d || !d.g || !d.m) return null;
    return `${d.g} ${MESI_NOME[d.m] || d.m}${d.a ? ' ' + d.a : ''}`;
  }

  function mostraAnteprima(dati) {
    document.getElementById('leonardo-anteprima')?.remove();
    const righe = [];
    const agg = (etichetta, valore, mancante) => righe.push(
      `<tr><td style="padding:3px 12px 3px 0;color:#8C8578;white-space:nowrap;">${etichetta}</td>
       <td style="padding:3px 0;${valore ? '' : 'color:#B3261E;'}">${valore || mancante}</td></tr>`);

    agg('Ospite', dati.ospite || dati.nome || '', 'non letto — lo scrivi in Fidra');
    agg('Email', dati.email || '', 'non letta');
    const a = dataLeggibile(dati.arrivo), p = dataLeggibile(dati.partenza);
    agg('Periodo', a && p ? `dal ${a} al ${p}${dati.notti ? ` &middot; ${dati.notti} ${dati.notti === 1 ? 'notte' : 'notti'}` : ''}` : '',
        'date non lette — attenzione, sono la cosa piu\' facile da sbagliare');
    const soli = dati.adulti === 1;
    agg('Persone', dati.adulti != null
      ? `${dati.adulti} ${dati.adulti === 1 ? 'adulto' : 'adulti'}${dati.bambini ? `, ${dati.bambini} bambin${dati.bambini === 1 ? 'o' : 'i'}${
          dati.etaBambini ? ` di ${String(dati.etaBambini).trim().split(/\s+/).join(' e ')} anni` : ''}` : ''}` +
        (dati.adultiDedotti ? ` <span style="color:#8C7A45;">(dedotto da &laquo;${
          dati.tipoCameraLetto || (dati.adultiDaTotale ? 'totale persone meno i bambini' : 'tipo di camera')
          }&raquo;${dati.nCamere > 1 ? `, ${dati.nCamere} camere` : ''} — verifica)</span>` : '')
      : '', 'non lette');
    if (dati.categoria) agg('Camera', dati.categoria, '');
    if (dati.pacchetto) agg('Pacchetto', dati.pacchetto, '');
    if (dati.trattamento) agg('Trattamento', dati.trattamento +
      (dati.trattamentoDedotto
        ? ' <span style="color:#8C7A45;">(dedotto da cena e colazione — verifica)</span>' : ''), '');
    /* v2.9.3: il cane costa 13 € al giorno e prima non lo leggeva nessuno */
    if (dati.cane) agg('Cane', 'sì, al seguito — 13 &euro; al giorno', '');
    if (dati.cure) agg('Cure', 'nominate nella richiesta', '');
    if (dati.riferimento) agg('Riferimento', dati.riferimento, '');

    const scatola = document.createElement('div');
    scatola.id = 'leonardo-anteprima';
    scatola.style.cssText =
      'position:fixed;bottom:70px;right:24px;z-index:2147483647;width:390px;' +
      'background:#fff;border:1px solid #CBD5D8;border-radius:10px;' +
      'box-shadow:0 10px 30px rgba(15,92,100,.25);' +
      'font:14px/20px Arial,Helvetica,sans-serif;color:#2A2E2B;';
    scatola.innerHTML = `
      <div style="background:#1E7F88;color:#fff;padding:9px 14px;border-radius:10px 10px 0 0;font-weight:bold;">
        Ecco cosa ho letto nella richiesta</div>
      <div style="padding:12px 14px;">
        <table style="width:100%;font-size:13.5px;">${righe.join('')}</table>
        ${dati.prezzoVisto ? `<div style="margin-top:10px;padding:9px 11px;background:#FDF6EE;border-left:3px solid #C97B2C;
            font-size:12.5px;color:#7A5A2B;">L&apos;ospite ha visto <strong>${dati.prezzoVisto}</strong> sulla pagina${
              dati.caparraIndicata ? `, con caparra ${dati.caparraIndicata}` : ''}.
            Se in Fidra esce un altro prezzo, decidi tu quale vale &mdash; ma non lasciarlo scoprire a lui.</div>` : ''}
        ${soli ? `<div style="margin-top:10px;padding:9px 11px;background:#FDF6F5;border-left:3px solid #B3261E;
            font-size:12.5px;color:#8C2F28;">Un ospite solo: in Fidra ricordati il
            <strong>supplemento uso singola</strong> prima di generare l&apos;offerta.
            E' l&apos;errore che ci e' gia' costato tre email a un cliente.</div>` : ''}
        <div style="margin-top:10px;font-size:12.5px;color:#8C8578;">
          Quello che manca lo completi in Fidra: qui si apre solo il modulo.</div>
        <div style="margin-top:12px;text-align:right;">
          <button id="leoAnnulla" style="background:#fff;color:#55524B;border:1px solid #CBD5D8;
            border-radius:5px;padding:7px 14px;font:600 13px Arial;cursor:pointer;">Annulla</button>
          <button id="leoProsegui" style="margin-left:6px;background:#1E7F88;color:#fff;border:0;
            border-radius:5px;padding:7px 16px;font:600 13px Arial;cursor:pointer;">Apri in Fidra</button>
        </div>
      </div>`;
    document.body.appendChild(scatola);
    scatola.querySelector('#leoAnnulla').onclick = () => scatola.remove();
    scatola.querySelector('#leoProsegui').onclick = () => {
      scatola.remove();
      dati.creato = Date.now();
      chrome.storage.local.set({ leonardo_bozza_centralino: dati }, () => {
        avviso('Richiesta letta: apro il modulo di Fidra');
        window.open('https://leonardo.fidra.cloud/booking', '_blank');
      });
    };
  }

  /* I PULSANTI FLOTTANTI SI IMPILANO DA SOLI.

     Le posizioni erano scritte a mano — 70, 118, 122, 174 — e il Day Spa
     (122) finiva sotto il transfer ATAM (118): quattro pixel di distanza.
     Non poteva funzionare: i pulsanti stanno in due file diversi,
     compaiono in combinazioni che dipendono dall'email aperta, e chi ne
     aggiunge uno non sa quali altri saranno li' in quel momento.

     Qui si rimettono tutti in fila dal basso, nell'ordine del DOM. La
     funzione e' ripetuta nei due file APPOSTA: lavora sul DOM e non
     tiene stato, quindi due copie fanno lo stesso lavoro e l'ultima che
     gira sistema anche i pulsanti dell'altra. */
  const PULSANTE_BASSO = 70;
  const PULSANTE_PASSO = 52;
  function impilaPulsanti() {
    const tutti = Array.from(document.querySelectorAll('[data-leo-pulsante]'));
    tutti.forEach((b, i) => {
      b.style.bottom = (PULSANTE_BASSO + i * PULSANTE_PASSO) + 'px';
    });
  }
  /* v2.9.1 — quello che si e' letto qui serve dall'altra parte.
     Il riquadro «Disponibilita' e prezzi» sta dentro Fidra e non sa a chi
     stai rispondendo: senza questo, l'operatore ribatteva a mano nome ed
     email che l'estensione aveva appena letto dalla mail sotto gli occhi.
     Un'ora di validita': oltre, si sta rispondendo a un'altra richiesta. */
  function ricordaRichiesta(dati) {
    try {
      if (!chrome?.storage?.local) return;
      chrome.storage.local.set({ leonardo_richiesta: {
        quando: Date.now(),
        ospite: dati.ospite || '',
        email: dati.email || '',
        lingua: linguaTesto(dati.testoOriginale || dati.note || '') || 'it',
        cure: !!dati.cure,
        cane: !!dati.cane,
        oggetto: (dati.testoOriginale || '').slice(0, 80)
      }});
    } catch (e) { /* il riquadro si compila a mano, come prima */ }
  }

  function mostraPulsanteCentralino() {
    if (document.getElementById('leonardo-bozza-btn')) return;
    /* v2.7.10 — IL BACO CHE HA FATTO PERDERE QUATTRO VERSIONI.
       Qui si guardava solo la richiesta del centralino, mentre il ciclo
       che chiama questa funzione accetta anche quelle dal sito e quelle
       scritte a mano: per tutte le altre si usciva subito e il pulsante
       non compariva mai. La diagnostica lo ha detto in un colpo —
       «riconosce: {sito: true}» con nessun pulsante sullo schermo — dopo
       che avevo dato la colpa agli iframe, ad about:blank, ai frame
       protetti e agli shadow root, tutte cose che non c'entravano:
       il testo si leggeva benissimo, 790 caratteri, tutto al suo posto. */
    const el = trovaRichiestaSito() || trovaRichiestaCentralino() || trovaRichiestaLibera();
    if (!el) return;
    const btn = document.createElement('button');
    btn.id = 'leonardo-bozza-btn';
    btn.textContent = '\u{1F4CB} Prepara bozza in Fidra';
    btn.style.cssText =
      'position:fixed;right:24px;z-index:2147483647;' +
      'padding:12px 20px;border:0;border-radius:8px;cursor:pointer;' +
      'font:600 14px/18px Arial,Helvetica,sans-serif;color:#fff;' +
      'background:#1E7F88;box-shadow:0 3px 12px rgba(0,0,0,.3);';
    btn.dataset.leoPulsante = '1';
    btn.addEventListener('click', () => {
      /* dal piu' affidabile al meno: il modulo del sito ha i campi
         etichettati, il centralino un formato noto, il testo libero
         va indovinato */
      const daSito = trovaRichiestaSito();
      let dati = daSito ? parseSito(daSito.innerText) : null;
      if (!dati) {
        const daCentralino = trovaRichiestaCentralino();
        dati = daCentralino ? parseCentralino(daCentralino.innerText) : null;
      }
      if (!dati) {
        const libera = trovaRichiestaLibera();
        if (libera) dati = parseLibera(libera.innerText, mittenteDaPagina());
      }
      if (!dati || (!dati.arrivo && !dati.email)) {
        avviso('Richiesta non leggibile: apri la mail per intero e riprova', '#B3541E');
        return;
      }
      ricordaRichiesta(dati);
      mostraAnteprima(dati);
    });
    document.body.appendChild(btn);
    impilaPulsanti();
  }

  /* v2.7.4: quando un pulsante non compare non c'e' modo di sapere perche'.
     Da console: leoDiagnostica() dice quanti documenti guarda, quanto testo
     trova e quale riconoscimento scatta. */
  window.leoDiagnostica = function () {
    const docs = radici();
    const testo = testoCompleto();
    const esito = {
      documenti: docs.length,
      diCuiFrame: docs.length - 1,
      caratteriLetti: testo.length,
      caratteriDaiFrame: testoDaiFrame().length,
      iframeVisti: docs.length - 1,
      componentiConShadow: quantiShadow(),
      contiene: {
        'RICHIESTA DAL SITO': /RICHIESTA\s+DAL\s+SITO/i.test(testo),
        'RS-anno-numero': /\bRS-20\d\d-\d{3,}/i.test(testo),
        'Periodo': /Periodo/i.test(testo)
      },
      riconosce: {
        sito: !!trovaRichiestaSito(),
        centralino: !!trovaRichiestaCentralino(),
        libera: !!trovaRichiestaLibera(),
        dayspa: !!trovaRichiestaDaySpa(),
        buoni: !!trovaRichiestaBuoni()
      },
      primi300: testo.replace(/\s+/g, ' ').slice(0, 300)
    };
    console.log('%cLeonardo — cosa vedo in questa pagina', 'font-weight:bold;color:#0F5C64');
    console.log(JSON.stringify(esito, null, 2));
    return esito;
  };

  console.log('%cLeonardo 2.8.13 — attivo nella pagina', 'color:#0F5C64;font-weight:bold',
    'scrivi leoDiagnostica() per sapere cosa vede');

  /* v2.7.8: la diagnostica si stampa da sola. Chiederla a mano ha fatto
     perdere un giro: adesso, se dopo qualche secondo non e' comparso
     nessun pulsante ma nella pagina c'e' qualcosa che somiglia a una
     richiesta, il riepilogo finisce in console senza che nessuno debba
     digitare niente. Una volta ogni due minuti, per non intasare. */
  let ultimoRapporto = 0;
  setInterval(() => {
    if (Date.now() - ultimoRapporto < 120000) return;
    const cePulsante = document.getElementById('leonardo-bozza-btn') ||
                     document.getElementById('leonardo-dayspa-btn') ||
                     document.getElementById('leonardo-buoni-btn');
    if (cePulsante) return;
    const testo = testoCompleto();
    const sembraRichiesta = /RICHIESTA\s+DAL\s+SITO|\bRS-20\d\d-\d{3,}|Richiesta\s+(preventivo|prenotazione)|disponibilit|Anfrage|Verf[üu]gbarkeit|availability/i.test(testo);
    if (!sembraRichiesta) return;
    ultimoRapporto = Date.now();
    /* v2.7.9: stampato come testo e non come oggetto. La console mostra
       gli oggetti chiusi («Object») e vanno aperti a mano: un rigo di JSON
       si seleziona e si incolla, che e' quello che serve davvero. */
    const esito = leoDiagnostica();
    console.log('%cLeonardo — vedo una richiesta ma nessun pulsante. Copia le righe qui sotto:',
      'color:#B3541E;font-weight:bold');
    console.log(JSON.stringify(esito, null, 2));
  }, 4000);

  // il riquadro di lettura cambia via SPA: controllo periodico leggero
  setInterval(() => {
    const btn = document.getElementById('leonardo-bozza-btn');
    const c = trovaRichiestaSito() || trovaRichiestaCentralino() || trovaRichiestaLibera();
    if (c && !btn) mostraPulsanteCentralino();
    if (!c && btn) { btn.remove(); document.getElementById('leonardo-anteprima')?.remove(); }

    const btnSpa = document.getElementById('leonardo-dayspa-btn');
    const spa = trovaRichiestaDaySpa();
    if (spa && !btnSpa) mostraPulsanteDaySpa();
    if (!spa && btnSpa) btnSpa.remove();

    const btnBuoni = document.getElementById('leonardo-buoni-btn');
    const buoni = trovaRichiestaBuoni();
    if (buoni && !btnBuoni) mostraPulsanteBuoni();
    if (!buoni && btnBuoni) btnBuoni.remove();

    const btnChiusura = document.getElementById('leonardo-chiusura-btn');
    const chiusa = trovaRichiestaChiusura();
    if (chiusa && !btnChiusura) mostraPulsanteChiusura();
    if (!chiusa && btnChiusura) btnChiusura.remove();
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
    for (const e of elementiLettura('div, td, p')) {
      if (!visibile(e)) continue;
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

  /* ============================================================
     v2.7.1 — ANTEPRIMA ANCHE PER LE RISPOSTE PRONTE
     Day Spa e Buoni regalo non passano da Fidra: il modello viene
     scritto e basta. Le due cose che possono sbagliare sono la lingua
     (dedotta contando le parole) e il nome del destinatario, e nessuna
     delle due si vedeva prima di premere Rispondi. Qui si vedono.
     ============================================================ */
  const LINGUA_NOME = { it: 'italiano', de: 'tedesco', en: 'inglese', fr: 'francese' };

  function anteprimaRisposta({ titolo, lingua, destinatario, modello, nota, azione }) {
    document.getElementById('leonardo-anteprima')?.remove();
    const scatola = document.createElement('div');
    scatola.id = 'leonardo-anteprima';
    scatola.style.cssText =
      'position:fixed;bottom:70px;right:24px;z-index:2147483647;width:370px;' +
      'background:#fff;border:1px solid #CBD5D8;border-radius:10px;' +
      'box-shadow:0 10px 30px rgba(15,92,100,.25);' +
      'font:14px/20px Arial,Helvetica,sans-serif;color:#2A2E2B;';
    scatola.innerHTML = `
      <div style="background:#0F5C64;color:#fff;padding:9px 14px;border-radius:10px 10px 0 0;font-weight:bold;">
        ${titolo}</div>
      <div style="padding:12px 14px;">
        <table style="width:100%;font-size:13.5px;">
          <tr><td style="padding:3px 12px 3px 0;color:#8C8578;">Modello</td><td>${modello}</td></tr>
          <tr><td style="padding:3px 12px 3px 0;color:#8C8578;">Lingua</td>
              <td>${LINGUA_NOME[lingua] || lingua} <span style="color:#8C7A45;">(dedotta dal testo)</span></td></tr>
          <tr><td style="padding:3px 12px 3px 0;color:#8C8578;">A</td>
              <td${destinatario.generico ? ' style="color:#B3261E;"' : ''}>${destinatario.nome}</td></tr>
        </table>
        ${nota ? `<div style="margin-top:10px;font-size:12.5px;color:#8C8578;">${nota}</div>` : ''}
        <div style="margin-top:12px;text-align:right;">
          <button id="leoAnnulla" style="background:#fff;color:#55524B;border:1px solid #CBD5D8;
            border-radius:5px;padding:7px 14px;font:600 13px Arial;cursor:pointer;">Annulla</button>
          <button id="leoProsegui" style="margin-left:6px;background:#0F5C64;color:#fff;border:0;
            border-radius:5px;padding:7px 16px;font:600 13px Arial;cursor:pointer;">Prepara la risposta</button>
        </div>
      </div>`;
    document.body.appendChild(scatola);
    scatola.querySelector('#leoAnnulla').onclick = () => scatola.remove();
    scatola.querySelector('#leoProsegui').onclick = () => { scatola.remove(); azione(); };
  }

  function mostraPulsanteDaySpa() {
    if (document.getElementById('leonardo-dayspa-btn')) return;
    if (!trovaRichiestaDaySpa()) return;
    const btn = document.createElement('button');
    btn.id = 'leonardo-dayspa-btn';
    btn.textContent = '\u{1F4A7} Rispondi: Info Day Spa';
    btn.style.cssText =
      'position:fixed;right:24px;z-index:2147483647;' +
      'padding:12px 20px;border:0;border-radius:8px;cursor:pointer;' +
      'font:600 14px/18px Arial,Helvetica,sans-serif;color:#fff;' +
      'background:#0F5C64;box-shadow:0 3px 12px rgba(0,0,0,.3);';
    btn.dataset.leoPulsante = '1';
    btn.addEventListener('click', () => {
      const el = trovaRichiestaDaySpa();
      if (!el) { avviso('Richiesta non pi\u00f9 visibile: apri la mail e riprova', '#B3541E'); return; }
      const lingua = linguaTesto(el.innerText || '');
      const mitt = mittenteDaPagina();
      const nome = (mitt && mitt.nome) || '';
      anteprimaRisposta({
        titolo: 'Risposta Info Day Spa',
        modello: 'Info Day Spa — prezzi, orari, come prenotare',
        lingua,
        destinatario: nome ? { nome } : { nome: (DAYSPA_NOMI[lingua] || 'Cliente') + ' — nome non letto', generico: true },
        nota: 'Il testo entra da solo quando premi Rispondi in Outlook.',
        azione: () => chrome.storage.local.get(['firma'], (ris) => {
          const o = { genere: 'N', firma: (ris && ris.firma) || 'La Reception' };
          const d = { intestatario: nome || DAYSPA_NOMI[lingua] || 'Cliente' };
          const build = { it: costruisciDaySpaIT, de: costruisciDaySpaDE, en: costruisciDaySpaEN, fr: costruisciDaySpaFR };
          const html = (build[lingua] || build.it)(d, o);
          chrome.storage.local.set({ [CHIAVE]: { html, creato: Date.now(), firmaContenuto: 'day-spa/prenotazioni' } }, () => {
            avviso('Info Day Spa pronta (' + lingua.toUpperCase() + '): premi Rispondi, il testo si inserisce da solo');
          });
        })
      });
    });
    document.body.appendChild(btn);
    impilaPulsanti();
  }

  /* ==========================================================
     RISPOSTA BUONI REGALO (v2.7.1)
     Le richieste di buoni non passano da Fidra e la risposta e'
     sempre la stessa: si comprano online, si pagano con carta,
     arrivano per email. Il modello esiste gia' — mancava solo il
     pulsante per raggiungerlo dalla mail.
     ========================================================== */
  /* «buono» da solo basta come tema, perche' a filtrare ci pensa il contesto
     (regalare, acquistare, prezzo...). Senza, la frase piu' naturale in
     italiano — «vorrei regalare un buono» — non veniva riconosciuta.
     «buon soggiorno» non interferisce: manca la o finale. */
  const BUONI_TEMA = /\bbuon[oi]\b|gift\s*(?:card|voucher|certificate)|gutschein\w*|geschenkgutschein|bon\s+cadeau|ch[èe]que\s+cadeau|voucher/i;
  /* «regalare» da solo non basta: comparirebbe in mezzo alle frasi di
     cortesia. Serve il tema del buono, oppure regalare + terme/spa. */
  const BUONI_CONTESTO = /regal\w*|verschenk\w*|schenken|offrir|gift|acquist\w*|comprar\w*|kaufen|buy|prezz\w*|preis\w*|import\w*|valore|betrag|amount|validit\w*|g[üu]ltig|scadenz\w*/i;

  function trovaRichiestaBuoni() {
    let migliore = null;
    for (const e of elementiLettura('div, td, p')) {
      if (!visibile(e)) continue;
      const txt = e.innerText || '';
      if (txt.length < 15 || txt.length > 2500) continue;
      if (!BUONI_TEMA.test(txt) || !BUONI_CONTESTO.test(txt)) continue;
      /* una richiesta di soggiorno che nomina il buono resta agli altri
         pulsanti: li' il buono e' un dettaglio, non il motivo della mail */
      if (/Richiesta\s+(preventivo|prenotazione)/i.test(txt)) continue;
      if (!migliore || txt.length < (migliore.innerText || '').length) migliore = e;
    }
    return migliore;
  }

  const BUONI_NOMI = { it: 'Cliente', de: 'Gast', en: 'Guest', fr: 'Madame, Monsieur' };

  function mostraPulsanteBuoni() {
    if (document.getElementById('leonardo-buoni-btn')) return;
    if (!trovaRichiestaBuoni()) return;
    const btn = document.createElement('button');
    btn.id = 'leonardo-buoni-btn';
    btn.textContent = '\u{1F381} Rispondi: Buoni regalo';
    btn.style.cssText =
      'position:fixed;right:24px;z-index:2147483647;' +
      'padding:12px 20px;border:0;border-radius:8px;cursor:pointer;' +
      'font:600 14px/18px Arial,Helvetica,sans-serif;color:#fff;' +
      'background:#7A8450;box-shadow:0 3px 12px rgba(0,0,0,.3);';
    btn.dataset.leoPulsante = '1';
    btn.addEventListener('click', () => {
      const el = trovaRichiestaBuoni();
      if (!el) { avviso('Richiesta non pi\u00f9 visibile: apri la mail e riprova', '#B3541E'); return; }
      const lingua = linguaTesto(el.innerText || '');
      const mitt = mittenteDaPagina();
      const nome = (mitt && mitt.nome) || '';
      anteprimaRisposta({
        titolo: 'Risposta Buoni regalo',
        modello: 'Buoni regalo — come si compone, prezzi, validit\u00e0, acquisto online',
        lingua,
        destinatario: nome ? { nome } : { nome: (BUONI_NOMI[lingua] || 'Cliente') + ' \u2014 nome non letto', generico: true },
        nota: 'Il pulsante nell\'email porta alla pagina nella lingua giusta.',
        azione: () => chrome.storage.local.get(['firma'], (ris) => {
          const o = { genere: 'N', firma: (ris && ris.firma) || 'La Reception' };
          const d = { intestatario: nome || BUONI_NOMI[lingua] || 'Cliente' };
          const build = { it: costruisciBuoniIT, de: costruisciBuoniDE, en: costruisciBuoniEN, fr: costruisciBuoniFR };
          const html = (build[lingua] || build.it)(d, o);
          chrome.storage.local.set({ [CHIAVE]: { html, creato: Date.now(), firmaContenuto: 'buoni-regalo' } }, () => {
            avviso('Buoni regalo pronto (' + lingua.toUpperCase() + '): premi Rispondi, il testo si inserisce da solo');
          });
        })
      });
    });
    document.body.appendChild(btn);
    impilaPulsanti();
  }

  /* ==========================================================
     RISPOSTA CHIUSURA STAGIONALE (v2.9.9)
     ----------------------------------------------------------
     «Chiudiamo il 29 novembre e riapriamo a meta' febbraio»: nella
     sola settimana del 22 agosto 2026 e' stata scritta a mano due
     volte, uguale. Qui il pulsante compare da solo quando le date
     chieste cadono nella chiusura — non serve accorgersene.

     NON SI INDOVINA DAL TESTO, SI GUARDANO LE DATE. Cercare la
     parola «dicembre» avrebbe pescato anche chi scrive a dicembre
     per agosto. Si usa leggiDate(), lo stesso lettore dell'anteprima:
     se l'arrivo cade dentro CHIUSURA, non c'e' niente da indovinare.
     ========================================================== */
  function isoDaLetta(g) {
    if (!g || !g.a || !g.m || !g.g) return null;
    const due = (n) => (n < 10 ? '0' : '') + n;
    return `${g.a}-${due(g.m)}-${due(g.g)}`;
  }

  function trovaRichiestaChiusura() {
    if (typeof dentroChiusura !== 'function' || !CHIUSURA || !CHIUSURA.dal) return null;
    let migliore = null;
    for (const e of elementiLettura('div, td, p')) {
      if (!visibile(e)) continue;
      const txt = e.innerText || '';
      if (txt.length < 40 || txt.length > 2500) continue;
      if (!PAROLE_RICHIESTA.test(txt)) continue;
      const date = leggiDate(txt);
      if (!date || !dentroChiusura(isoDaLetta(date.arrivo))) continue;
      if (!migliore || txt.length < (migliore.innerText || '').length) migliore = e;
    }
    return migliore;
  }

  function mostraPulsanteChiusura() {
    if (document.getElementById('leonardo-chiusura-btn')) return;
    if (!trovaRichiestaChiusura()) return;
    const btn = document.createElement('button');
    btn.id = 'leonardo-chiusura-btn';
    btn.textContent = '\u{1F6AA} Rispondi: siamo chiusi';
    btn.style.cssText =
      'position:fixed;right:24px;z-index:2147483647;' +
      'padding:12px 20px;border:0;border-radius:8px;cursor:pointer;' +
      'font:600 14px/18px Arial,Helvetica,sans-serif;color:#fff;' +
      'background:#8C6239;box-shadow:0 3px 12px rgba(0,0,0,.3);';
    btn.dataset.leoPulsante = '1';
    btn.addEventListener('click', () => {
      const el = trovaRichiestaChiusura();
      if (!el) { avviso('Richiesta non più visibile: apri la mail e riprova', '#B3541E'); return; }
      const testo = el.innerText || '';
      const lingua = linguaTesto(testo);
      const date = leggiDate(testo);
      const mitt = mittenteDaPagina();
      const nome = (mitt && mitt.nome) || '';
      const arrivo = date ? dataLeggibile(date.arrivo) : '';
      anteprimaRisposta({
        titolo: 'Risposta: chiusura stagionale',
        modello: 'Siamo chiusi in quel periodo, con invito a scegliere altre date',
        lingua,
        destinatario: nome ? { nome } : { nome: 'nome non letto', generico: true },
        nota: arrivo
          ? `Ha chiesto il ${arrivo}, dentro la chiusura. Verifica prima di mandare: le date sono la cosa piu' facile da sbagliare.`
          : 'Il testo entra da solo quando premi Rispondi in Outlook.',
        azione: () => chrome.storage.local.get(['firma'], (ris) => {
          const o = { genere: 'N', firma: (ris && ris.firma) || 'La Reception' };
          const d = { intestatario: nome };
          const build = { it: costruisciChiusuraIT, de: costruisciChiusuraDE,
                          en: costruisciChiusuraEN, fr: costruisciChiusuraFR };
          const html = (build[lingua] || build.it)(d, o);
          chrome.storage.local.set({ [CHIAVE]: { html, creato: Date.now(), firmaContenuto: 'chiusura-stagionale' } }, () => {
            avviso('Chiusura stagionale pronta (' + lingua.toUpperCase() + '): premi Rispondi, il testo si inserisce da solo');
          });
        })
      });
    });
    document.body.appendChild(btn);
    impilaPulsanti();
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

  /* gancio per i test e per la console: parseLibera vive dentro l'IIFE */
  (typeof self !== 'undefined' ? self : globalThis).__leonardoInject =
    { parseLibera, leggiDate, PAROLE_RICHIESTA, annoDedotto };
})();
