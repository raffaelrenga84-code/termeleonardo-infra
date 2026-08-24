/* ============================================================
   Offerta Leonardo — estrattore dati da Fidra Cloud
   SOLA LETTURA. Non modifica la pagina, non invia nulla.
   ============================================================ */

const MESI = { Jan:1, Feb:2, Mar:3, Apr:4, May:5, Jun:6,
               Jul:7, Aug:8, Sep:9, Oct:10, Nov:11, Dec:12 };

const CAPARRA_PER_ADULTO = 75; // regola standard: 75 € a persona

/* ---------- utilità ---------- */
const righe = (t) => (t || '').split('\n').map(s => s.trim()).filter(Boolean);
const num   = (s) => s ? parseFloat(s.replace(/\./g, '').replace(',', '.')) : null;

function euro(n) {
  return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ---------- intestazione cliente ---------- */
function estraiHeader() {
  const h = {};
  const mail = document.querySelector('a[href^="mailto:"]');
  h.email = mail ? decodeURIComponent(mail.getAttribute('href').replace('mailto:', '')) : null;

  // il blocco anagrafica sta alcuni livelli sopra il link mailto
  let n = mail;
  for (let i = 0; i < 6 && n; i++) n = n.parentElement;
  const A = righe(n ? n.innerText : '');

  h.intestatario = A[0] || null;
  h.eta      = (A.find(x => /^\d+\s*anni$/.test(x)) || '').match(/\d+/)?.[0] || null;
  h.telefono = A.find(x => /^[\d +]{8,}$/.test(x)) || null;
  const iCC  = A.findIndex(x => /^[A-Z]{2}$/.test(x));
  h.paese = iCC > -1 ? A[iCC] : null;
  h.citta = iCC > -1 ? A[iCC + 1] : null;

  // riga di stato
  const S = document.body.innerText;
  const k = S.indexOf('N. #');
  const riga = k > -1 ? S.slice(k, k + 300) : '';
  h.numero   = riga.match(/N\.\s*#(\d+)/)?.[1] || null;
  h.stato    = riga.match(/N\.\s*#\d+\s+(\S+)\s+Sorgente/)?.[1] || null;
  h.sorgente = riga.match(/Sorgente:\s*(\w+)/)?.[1] || null;
  h.scadenza = riga.match(/\n\s*(\d{1,2}\s+[A-Za-z]{3}\s+20\d\d)\s+Ultima modifica/)?.[1] || null;
  return h;
}

/* ---------- soggiorno e camere ---------- */
function estraiSoggiorno() {
  const root = document.querySelector('main') || document.body;
  const T = root.innerText;
  const L = righe(T);
  const r = { camere: [] };

  /* Due formati: "9 Notti dal 25 - 03 Sep" (stesso mese) e
     "9 Notti dal 25 Aug - 03 Sep" (a cavallo di due mesi). */
  const s = T.match(/(\d+)\s*Notti dal\s*(\d{1,2})\s*([A-Za-z]{3})?\s*-\s*(\d{1,2})\s*([A-Za-z]{3})/);
  if (s) {
    r.notti = +s[1];
    r.giornoArrivo = +s[2];
    r.giornoPartenza = +s[4];
    r.mese = s[3] || s[5];        // senza il primo mese, arrivo e partenza sono nello stesso
    r.mesePartenza = s[5];
  }

  const t = T.match(/(\d+)\s*Camere prenotate con in totale\s*(\d+)\s*Adulti e\s*(\d+)\s*Bambini/);
  if (t) { r.nCamere = +t[1]; r.adulti = +t[2]; r.bambini = +t[3]; }

  // v1.1.1: lettura caparra a quattro strategie in cascata. Il simbolo €
  // potrebbe essere un'icona (non un carattere) e fra etichetta e cifre può
  // esserci testo invisibile: nessuna singola regex è affidabile da sola.
  (function leggiCaparra() {
    const T2 = document.body.innerText;
    // 1) formato canonico "Caparra Disponibile 150,00 € di 150,00 €"
    let cap = T2.match(/Caparra(?:\s+Disponibile)?\s*:?\s*([\d.]+(?:,\d{1,2})?)\s*€\s*di\s*([\d.]+(?:,\d{1,2})?)\s*€/);
    // 2) tollerante: € facoltativo, fino a 80 caratteri qualsiasi di distanza
    if (!cap) cap = T2.match(/Caparra[\s\S]{0,80}?([\d.]+(?:,\d{1,2})?)\s*€?[\s\S]{0,20}?\bdi\b[\s\S]{0,20}?([\d.]+(?:,\d{1,2})?)/);
    if (cap) { r.caparraVersata = num(cap[1]); r.caparraDovuta = num(cap[2]); return; }
    // 3) scansione numerica: primi due importi decimali dopo la parola Caparra
    const j = T2.search(/Caparra/i);
    if (j > -1) {
      const zona = T2.slice(j, j + 200);
      const importi = zona.match(/\d[\d.]*,\d{2}/g);
      if (importi && importi.length >= 2) {
        r.caparraVersata = num(importi[0]);
        r.caparraDovuta  = num(importi[1]);
        return;
      }
      // 4) via DOM: blocco che contiene l'etichetta, numeri dal testo del contenitore
      const nodi = Array.from(document.querySelectorAll('*')).filter(e =>
        e.children.length === 0 && /caparra/i.test(e.textContent || ''));
      for (const n of nodi) {
        const blocco = (n.closest('div,section,header') || n.parentElement);
        const im = blocco ? (blocco.textContent.match(/\d[\d.]*,\d{2}/g) || []) : [];
        if (im.length >= 2) {
          r.caparraVersata = num(im[0]);
          r.caparraDovuta  = num(im[1]);
          return;
        }
      }
      // Tutte fallite: conserva il testo grezzo per la diagnosi nel popup
      r.caparraDebug = zona.slice(0, 160);
    }
  })();

  L.forEach((line, i) => {
    /* v2.0.1: il numero di camera puo' mancare — in offerta le camere non
       sono ancora assegnate e Fidra scrive "Matrimoniale Queen n." senza
       cifra. Pretenderlo faceva sparire tutte le camere e bloccava
       l'offerta con "mancano dei dati: camere". Ora il numero e'
       facoltativo; serve solo, quando c'e', ad abbinare la camera ai
       dati dell'API. */
    /* v2.2.6: dopo il numero Fidra puo' scrivere altro — il lucchetto e la
       parola "fix" per una camera bloccata. Pretendere la fine subito dopo
       le cifre faceva sparire la camera, e con lei gli extra e il totale.
       Si toglie il suffisso prima di leggere. */
    const line2 = line.replace(/\s*[^\w\s]*\s*fix\s*$/i, '').trim();
    const m = line2.match(/^(.+?)\s+n\.\s*(\d*)\s*$/);
    if (!m) return;
    const blocco = L.slice(i, i + 16);
    const testo  = blocco.join(' | ');
    /* senza "Adulti n Bambini n" nelle righe seguenti non e' una camera:
       il controllo evita che una riga qualsiasi finita con "n." passi */
    if (!/Adulti\s*\d+\s*Bambini\s*\d+/.test(testo)) return;
    const ad = testo.match(/Adulti\s*(\d+)\s*Bambini\s*(\d+)/);
    const tt = testo.match(/Totale\s*([\d.]+,\d{2})\s*€\s*p\.p\./);
    const iAd = blocco.findIndex(x => /^Adulti \d+ Bambini \d+/.test(x));
    const ospiti = [];
    /* v1.6.3: per ogni ospite si legge anche l'eventuale DATA PROPRIA che
       Fidra scrive accanto al nome quando arriva o parte in giorni diversi
       dal resto della camera (es. "Arrivo 15-Aug"). Serve in due modi:
       come tripwire (il "Totale p.p." della pagina non vale per tutti) e
       come fonte dei periodi per ospite se l'API non li espone. */
    const ospitiDettaglio = [];
    const RE_DATA_OSPITE = /^(Arrivo|Partenza|Arrival|Departure|Anreise|Abreise)?\s*:?\s*(\d{1,2})[-\s]([A-Za-z]{3})$/;
    blocco.forEach((x, j) => {
      if (x !== 'vai al Soggiorno') return;
      let nome = blocco[j - 1], arrivoProprio = null, partenzaPropria = null;
      const md = (nome || '').match(RE_DATA_OSPITE);
      if (md && MESI[md[3]]) {   // la riga prima del link è una data: il nome sta una più su
        const data = { g: +md[2], mese: md[3] };
        if (/Partenza|Departure|Abreise/i.test(md[1] || '')) partenzaPropria = data;
        else arrivoProprio = data;
        nome = blocco[j - 2];
      }
      if (nome) ospiti.push(nome);
      ospitiDettaglio.push({ nome: nome || null, arrivoProprio, partenzaPropria });
    });
    const dateMiste = ospitiDettaglio.some(o => o.arrivoProprio || o.partenzaPropria);

    /* v1.6.7: EXTRA della camera. In pagina compaiono dopo la riga "Extra":
       nome + importo, e sotto l'unità di misura ("Al giorno per camera",
       "Al giorno per adulto (esclusi bambini)"). Si leggono nome, prezzo
       unitario e unità; la moltiplicazione avviene dopo, quando si conoscono
       notti e persone. Se l'unità non è riconosciuta, l'extra si legge lo
       stesso ma NON si somma: si avvisa e decide l'operatore. */
    const extra = [];
    /* v2.2.7: "Extra" non sta per forza entro le 16 righe del blocco. Con due
       soggiornanti e i loro pulsanti finisce piu' in basso, e gli extra
       sparivano dal conto (19146: 340 invece di 460). Si cerca fino
       all'inizio della camera successiva, o alla fine dell'elenco camere. */
    const finePezzo = (() => {
      for (let k = i + 1; k < L.length; k++) {
        if (/^(.+?)\s+n\.\s*\d*\s*(?:[^\w\s]*\s*fix)?\s*$/i.test(L[k]) &&
            /Adulti\s*\d+\s*Bambini/.test(L.slice(k, k + 6).join(' '))) return k;   // camera dopo
        if (/^(Aggiungi una camera|Note|Email|Portineria)$/i.test(L[k])) return k;
      }
      return L.length;
    })();
    const iEx = L.slice(i, finePezzo).indexOf('Extra');
    if (iEx > -1) {
      const coda = L.slice(i + iEx + 1, finePezzo);
      for (let j = 0; j < coda.length; j++) {
        const x = coda[j];
        if (/^(Aggiungi|Note|Email|Extra$)/i.test(x)) break;
        const me = x.match(/^(.+?)\s+(-|−)?\s*([\d.]*\d,\d{2})\s*€$/);
        if (!me) continue;
        let unita = null;
        for (let k = j + 1; k < Math.min(j + 3, coda.length); k++) {
          if (/^(Al giorno|Per |Una tantum|A persona)/i.test(coda[k])) { unita = coda[k]; break; }
        }
        const nomeVoce = me[1].replace(/\s*elimina\s*$/i, '').trim();
        /* v1.7.7: una voce di SCONTO va sottratta, non sommata (l'offerta
           19130 mostrava 220 + 11 = 231 invece di 209). Il segno può
           arrivare dalla pagina, ma Fidra scrive spesso l'importo positivo
           lasciando la parola "sconto" nel nome: quella basta. */
        const sconto = /\bsconto\b|\bsconti\b|\briduzion|\brabatt|\bdiscount\b|\bremise\b/i.test(nomeVoce);
        const segno = (me[2] || sconto) ? -1 : 1;
        extra.push({ nome: nomeVoce, prezzo: num(me[3]) * segno, unita, sconto: segno < 0 });
      }
    }

    // età bambini, se presenti dopo "Eta Bambini"
    const eta = (testo.match(/Eta Bambini\s*([\d,\s]+)/) || [])[1];

    const chk = testo.match(/Check-in\s*(\d+)\s*di\s*(\d+)/i);

    // v1.1.1: periodo proprio della camera (camere con date diverse).
    // Cerco nel blocco un pattern data; lo tengo solo se differisce dal globale.
    let periodo = null;
    const pd = testo.match(/(?:(\d+)\s*Notti\s*(?:dal)?\s*)?(\d{1,2})\s*([A-Za-z]{3})?\s*-\s*(\d{1,2})\s+([A-Za-z]{3})\b/);
    if (pd) {
      const cand = {
        notti: pd[1] ? +pd[1] : null, g1: +pd[2], g2: +pd[4],
        mese: pd[3] || pd[5], mesePartenza: pd[5]
      };
      const diverso = (cand.notti && r.notti && cand.notti !== r.notti) ||
        (r.giornoArrivo && (cand.g1 !== r.giornoArrivo || cand.g2 !== r.giornoPartenza ||
                            cand.mese !== r.mese || cand.mesePartenza !== (r.mesePartenza || r.mese)));
      if (diverso) periodo = cand;
    }

    r.camere.push({
      periodo,
      checkinFatti: chk ? +chk[1] : null,
      checkinTotali: chk ? +chk[2] : null,
      categoria: m[1].replace(/\s*fix\s*$/, '').trim(),
      numero: m[2],
      adulti:  ad ? +ad[1] : null,
      bambini: ad ? +ad[2] : null,
      etaBambini: eta ? eta.trim() : null,
      trattamento: iAd > -1 ? blocco[iAd + 1] : null,
      totalePP: tt ? num(tt[1]) : null,
      ospiti,
      ospitiDettaglio,     // v1.6.3: nome + eventuale data propria per ospite
      extra,               // v1.6.7: extra della camera, non ancora moltiplicati
      dateMiste            // v1.6: nella camera c'è chi ha date proprie
    });
  });

  return r;
}

/* ---------- note (per trovare destinatari alternativi) ---------- */
function estraiNote() {
  const L = righe(document.body.innerText);
  const reparti = ['Portineria','Piani','Spa','Ricevimento','Cucina','Manutenzione','Direzione'];
  const note = [];
  L.forEach((l, i) => {
    if (reparti.includes(l) && /^\d{2} [A-Za-z]{3} \d{4}$/.test(L[i + 1] || '')) {
      note.push({ reparto: l, data: L[i + 1], testo: L[i + 2] || '' });
    }
  });
  return note;
}

/* ---------- anno di arrivo ----------
   Le offerte hanno una data di scadenza; le conferme no. Si usa quindi la prima
   data disponibile come riferimento temporale, nell'ordine:
     1) scadenza offerta   2) ultima modifica   3) data della nota più recente
   L'arrivo non può precedere il riferimento: se lo fa, è l'anno successivo. */
function riferimentoTemporale() {
  const T = document.body.innerText;
  const k = T.indexOf('N. #');
  const riga = k > -1 ? T.slice(k, k + 300) : '';

  const scad = riga.match(/\n\s*(\d{1,2}\s+[A-Za-z]{3}\s+20\d\d)\s+Ultima modifica/);
  if (scad) return { data: scad[1], fonte: 'scadenza offerta' };

  const mod = riga.match(/Ultima modifica:.*?(\d{1,2}\s+[A-Za-z]{3}\s+20\d\d)/);
  if (mod) return { data: mod[1], fonte: 'ultima modifica' };

  const note = T.match(/\d{2}\s+[A-Za-z]{3}\s+20\d\d/g);
  if (note && note.length) return { data: note[0], fonte: 'data di una nota' };

  return null;
}

function deduciAnno(mese, giorno, riferimento) {
  if (!mese || !riferimento) return null;
  const ms = String(riferimento).match(/(\d{1,2})\s+([A-Za-z]{3})\s+(20\d\d)/);
  if (!ms) return null;
  const annoBase = +ms[3];
  const dRif = new Date(annoBase, MESI[ms[2]] - 1, +ms[1]);
  const dArr = new Date(annoBase, MESI[mese] - 1, giorno);
  return dArr < dRif ? annoBase + 1 : annoBase;
}

/* ============================================================
   v2.9.2 — MASSIMA OCCUPAZIONE SIMULTANEA
   ------------------------------------------------------------
   Due camere con periodi che non si sovrappongono non possono
   ospitare persone diverse: in ogni istante ne e' occupata una
   sola. Sommarle e' sbagliato sia con le alternative (l'ospite ne
   sceglie una) sia con un cambio camera (le stesse persone si
   spostano), e i due casi da qui non si distinguono — ma per
   contare le persone non serve distinguerli.

   Si guarda notte per notte: per ogni notte si sommano le camere
   che quella notte sono occupate, e si tiene la notte piu'
   affollata. Con le camere prenotate insieme il massimo E' la
   somma, quindi il caso normale non cambia di una virgola.

   Restituisce null quando non c'e' niente da correggere: nessuna
   camera, date illeggibili, oppure il massimo coincide con la
   somma. Meglio lasciare il numero di Fidra che inventarne uno.
   ============================================================ */
function occupazioneMassima(s, anno, annoPartenza) {
  const camere = (s && s.camere) || [];
  if (camere.length < 2) return null;

  const giorno = (g, mese, a) => (g && mese && MESI[mese] && a)
    ? Date.UTC(a, MESI[mese] - 1, g) / 86400000 : null;

  const periodi = [];
  for (const c of camere) {
    const p = c.periodo || {};
    const g1 = p.g1 || s.giornoArrivo;
    const g2 = p.g2 || s.giornoPartenza;
    const meseA = p.mese || s.mese;
    const meseP = p.mesePartenza || p.mese || s.mesePartenza || s.mese;
    /* l'anno della partenza cambia solo a cavallo di Capodanno, e in quel
       caso lo sa gia' chi ci ha passato annoPartenza */
    const t1 = giorno(g1, meseA, anno);
    const t2 = giorno(g2, meseP, (MESI[meseP] < MESI[meseA]) ? annoPartenza : anno);
    if (t1 == null || t2 == null || t2 <= t1) return null;   // date illeggibili: non si indovina
    periodi.push({ t1, t2, adulti: c.adulti || 0, bambini: c.bambini || 0 });
  }

  const sommaAd = periodi.reduce((a, p) => a + p.adulti, 0);
  const sommaBa = periodi.reduce((a, p) => a + p.bambini, 0);

  let migliore = null;
  const inizio = Math.min(...periodi.map(p => p.t1));
  const fine = Math.max(...periodi.map(p => p.t2));
  /* una notte per volta: la notte «n» va da n a n+1 */
  for (let n = inizio; n < fine; n++) {
    let ad = 0, ba = 0;
    for (const p of periodi) if (n >= p.t1 && n < p.t2) { ad += p.adulti; ba += p.bambini; }
    if (!migliore || (ad + ba) > (migliore.adulti + migliore.bambini)) {
      migliore = { adulti: ad, bambini: ba };
    }
  }
  if (!migliore) return null;
  if (migliore.adulti === sommaAd && migliore.bambini === sommaBa) return null;
  return migliore;
}

/* ---------- assemblaggio ---------- */
function estrai() {
  const h = estraiHeader();
  const s = estraiSoggiorno();
  const note = estraiNote();

  const id = location.pathname.match(/reservations\/(\d+)/)?.[1] || h.numero;
  const rif  = riferimentoTemporale();
  const anno = deduciAnno(s.mese, s.giornoArrivo, rif ? rif.data : null);
  /* soggiorno a cavallo di due mesi (e magari di due anni: dicembre → gennaio) */
  const mesePartenza = s.mesePartenza || s.mese;
  const annoPartenza = (anno && s.mese && mesePartenza && MESI[mesePartenza] < MESI[s.mese])
    ? anno + 1 : anno;

  // totale = somma di (totale p.p. × adulti) per ogni camera
  let totale = 0, calcolabile = true;
  s.camere.forEach(c => {
    if (c.totalePP == null || c.adulti == null) calcolabile = false;
    else totale += c.totalePP * c.adulti;
  });

  /* v2.9.4 — LE PERSONE SI SOMMANO, COME SEMPRE.

     Per un giorno qui c'e' stata una regola automatica: se le camere non si
     sovrappongono, non sommare le persone. Sembrava solida — in un istante
     due camere che non si sovrappongono ospitano una sola comitiva — ed e'
     sbagliata, perche' un'offerta non descrive un istante.

     IL CASO CHE LA SMONTA: due camere 25→27 e 28→30 per persone diverse,
     i genitori una settimana e il fratello quella dopo. Non si sovrappongono
     mai, ma gli ospiti sono quattro e la caparra e' 4 × 75. Automatizzando
     si sarebbero dimezzate le persone e la caparra di ogni prenotazione di
     questo tipo — molto peggio del difetto che si voleva correggere.

     Alternative, cambio camera e camere separate hanno lo stesso aspetto nei
     dati: cambia solo l'intenzione di chi ha prenotato, e quella la sa una
     persona sola. Percio' qui si somma, e l'operatore lo dice con una spunta
     quando le camere sono alternative.

     Resta il calcolo dell'occupazione, che non decide piu' niente: serve a
     sapere QUANDO offrire la spunta (solo se le camere non si sovrappongono
     — altrimenti non e' nemmeno una domanda) e con quante persone contare la
     singola soluzione. */
  const occ = occupazioneMassima(s, anno, annoPartenza);
  const adulti  = s.adulti ?? s.camere.reduce((a, c) => a + (c.adulti || 0), 0);
  const bambini = s.bambini ?? s.camere.reduce((a, c) => a + (c.bambini || 0), 0);
  const acconto = (s.caparraDovuta && s.caparraDovuta > 0)
      ? s.caparraDovuta
      : adulti * CAPARRA_PER_ADULTO;

  // email alternative citate nelle note
  const emailNote = [...new Set(
    note.flatMap(n => (n.testo.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || []))
  )].filter(e => e !== h.email);

  // l'ospite è già in casa se almeno un check-in risulta fatto
  const checkinFatti = s.camere.reduce((a, c) => a + (c.checkinFatti || 0), 0);
  const giaInCasa = checkinFatti > 0;

  // l'arrivo è già passato?
  let arrivoPassato = false;
  if (anno && s.mese && s.giornoArrivo) {
    const oggi = new Date(); oggi.setHours(0,0,0,0);
    arrivoPassato = new Date(anno, MESI[s.mese] - 1, s.giornoArrivo) < oggi;
  }

  const numeroOfferta = anno ? `O${String(anno).slice(2)}/${id}` : null;
  const linkPagamento = (id && numeroOfferta)
    ? `https://www.termeleonardo.com/it/deposit-payment?id=${id}`
      + `&number=${encodeURIComponent(numeroOfferta)}`
      + `&amount=${Math.round(acconto * 100)}`
    : null;

  return {
    ok: true,
    id, numeroOfferta, linkPagamento,
    stato: h.stato, sorgente: h.sorgente,
    fonteAnno: rif ? rif.fonte : null,
    giaInCasa, checkinFatti, arrivoPassato,
    intestatario: h.intestatario, email: h.email, telefono: h.telefono,
    eta: h.eta, paese: h.paese, citta: h.citta,
    emailAlternative: emailNote,
    scadenza: h.scadenza,
    anno, mese: s.mese, giornoArrivo: s.giornoArrivo, giornoPartenza: s.giornoPartenza,
    mesePartenza, annoPartenza,
    notti: s.notti, nCamere: s.nCamere, adulti, bambini,
    /* le camere non si sovrappongono: potrebbero essere alternative, un
       cambio camera oppure due soggiorni distinti di persone diverse. Non
       si decide qui: si offre la spunta all'operatore, con quante persone
       avrebbe la singola soluzione. */
    camereNonSovrapposte: !!occ,
    personeUnaSoluzione: occ ? { adulti: occ.adulti, bambini: occ.bambini } : null,
    camere: s.camere,
    totale: calcolabile ? totale : null,
    totaleFmt: calcolabile ? euro(totale) : null,
    acconto, accontoFmt: euro(acconto),
    // v1.1.1: FIX — questi tre campi venivano letti ma mai restituiti:
    // il popup e la conferma leggevano d.caparraVersata sempre vuota.
    caparraVersata: s.caparraVersata ?? null,
    caparraDovuta: s.caparraDovuta ?? null,
    caparraDebug: s.caparraDebug || null,
    saldo: calcolabile ? totale - acconto : null,
    saldoFmt: calcolabile ? euro(totale - acconto) : null,
    note
  };
}

/* ---------- validazione: meglio non produrre nulla che produrre sbagliato ---------- */
function valida(d) {
  const mancanti = [];
  if (!d.intestatario) mancanti.push('nome intestatario');
  if (!d.notti)        mancanti.push('numero di notti');
  if (!d.anno)         mancanti.push("anno di arrivo: nella pagina non c'è nessuna data con l'anno");
  if (!d.camere.length) mancanti.push('camere');
  if (d.totale == null) mancanti.push('totale (una camera è senza prezzo o senza adulti)');
  /* il link di pagamento NON blocca più: dalla v1.2 i modelli, se manca,
     mostrano soltanto il bonifico invece del pulsante con carta. Resta un
     avviso, così l'operatore sa perché il pulsante non c'è. */
  d.camere.forEach((c, i) => {
    if (c.bambini > 0 && !c.etaBambini) mancanti.push(`età bambini camera ${i + 1}`);
    /* v1.6: camera con ospiti su date proprie ma senza dettaglio per ospite
       (API non leggibile): il "Totale p.p. × adulti" della pagina è il prezzo
       del primo ospite e darebbe un totale falso. Meglio niente che sbagliato. */
    if (c.dateMiste && !(c.soggiornanti && c.soggiornanti.length)) {
      mancanti.push(`camera ${i + 1} (${c.categoria || 'n. ' + c.numero}): gli ospiti hanno ` +
        `date proprie ma il dettaglio per ospite non è leggibile — il totale sarebbe ` +
        `sbagliato. Ricarica la pagina e riprova; se ricompare, prepara l'email a mano.`);
    }
  });
  return mancanti;
}

/* ---------- profilo cliente: sesso e lingua ----------
   Fidra rende già disponibili nel DOM della pagina prenotazione i campi del
   modale "Modifica profilo cliente": select[name="sex"] con valori F/M e
   select[name="locale"] con it / de / fr / en.
   Compaiono due volte (stessi dati): leggiamo il primo gruppo e verifichiamo
   che il cognome corrisponda all'intestatario. */
function leggiProfilo(intestatario) {
  const sel = document.querySelector('select[name="sex"]');
  const loc = document.querySelector('select[name="locale"]');
  if (!sel && !loc) return { sesso: null, lingua: null, fonte: 'campi non trovati' };

  // controllo di coerenza: il cognome nel modale deve essere quello dell'intestatario
  const cont = (sel || loc).closest('form')
            || (sel || loc).closest('div[x-data]')
            || (sel || loc).parentElement?.parentElement?.parentElement;
  const cognomeCampo = cont ? cont.querySelector('input[name="last_name"]') : null;
  const cognomeAtteso = (intestatario || '').trim().split(/\s+/)[0] || '';
  if (cognomeCampo && cognomeAtteso &&
      cognomeCampo.value.trim().toLowerCase() !== cognomeAtteso.toLowerCase()) {
    return { sesso: null, lingua: null, fonte: 'profilo di un altro ospite' };
  }

  const sesso  = sel && /^[FM]$/.test(sel.value) ? sel.value : null;
  const lingua = loc && ['it','de','fr','en'].includes(loc.value) ? loc.value : null;
  return {
    sesso, lingua,
    fonte: (sesso || lingua) ? 'profilo cliente' : 'campi vuoti in Fidra'
  };
}

/* ---------- operatore loggato in Fidra (v1.1.1) ----------
   Fidra scrive l'utente nella pagina: window.Laravel = {"user":{"name":"..."}}.
   Il content script vive in un mondo isolato e non vede window.Laravel,
   ma puo' leggere il testo degli script inline. */
function operatoreLoggato() {
  for (const s of document.querySelectorAll('script:not([src])')) {
    const m = (s.textContent || '').match(/"user"\s*:\s*\{[^{}]*?"name"\s*:\s*"([^"]{2,40})"/);
    if (m) return m[1];
  }
  return null;
}

/* ---------- profilo via API (v1.1.1) ----------
   L'anagrafica Fidra espone sesso e lingua in /api/customers/{id}:
   molto piu' affidabile dei select del modale, che spesso non sono nel DOM.
   L'id cliente e' nell'URL della pagina. Fallback: lettura DOM. */
async function leggiProfiloAPI(intestatario) {
  const cid = location.pathname.match(/customers\/(\d+)/)?.[1];
  if (cid) {
    try {
      const resp = await fetch('/api/customers/' + cid, {
        headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
      });
      if (resp.ok) {
        const j = await resp.json();
        const c = j.data || j;
        const sesso  = /^[FM]$/i.test(c.sex || '') ? c.sex.toUpperCase() : null;
        const lingua = ['it','de','fr','en'].includes((c.locale || '').toLowerCase())
          ? c.locale.toLowerCase() : null;
        const nome = (c.first_name || '').trim() || null;
        const cognome = (c.last_name || '').trim() || null;
        const email = (c.email || '').trim() || null;
        if (sesso || lingua || nome || cognome)
          return { sesso, lingua, nome, cognome, email, fonte: 'anagrafica Fidra' };
      }
    } catch (e) { /* si passa al fallback DOM */ }
  }
  return leggiProfilo(intestatario);
}

/* ============================================================
   v1.6 — SOGGIORNANTI VIA API
   La pagina scrive un solo "Totale … p.p." per camera: quando gli ospiti
   hanno prezzi o date diversi, quel numero è il prezzo del PRIMO ospite e
   moltiplicarlo per gli adulti produce un totale falso (18824: 650×2=1300
   invece di 650+390=1040). L'API /api/reservations/{id} espone invece il
   prezzo di ciascun adulto (prices.adults) e il periodo di ciascun
   soggiornante (stays). Qui si legge l'API, si confronta con la pagina e,
   in caso di divergenza, si SEGNALA e si usa l'API — mai una scelta
   silenziosa. Se l'API non risponde e la pagina mostra date miste, si
   blocca la generazione: meglio niente che sbagliato.
   ============================================================ */

/* Il formato esatto della risposta non è documentato: il lettore è
   tollerante sui nomi dei campi e, dove non riconosce nulla, rinuncia
   (restituendo null) invece di indovinare. */

function apiNumero(v) {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (typeof v === 'string') {
    const s = v.replace(/[€\s]/g, '');
    // "1.040,00" it — oppure "1040.00" en
    const it = s.match(/^\d{1,3}(\.\d{3})*(,\d{1,2})?$/) ? num(s) : null;
    if (it != null && !isNaN(it)) return it;
    const en = parseFloat(s.replace(/,/g, ''));
    return isNaN(en) ? null : en;
  }
  if (v && typeof v === 'object') {
    for (const k of ['total', 'price', 'amount', 'gross', 'value', 'net']) {
      if (v[k] != null) { const n = apiNumero(v[k]); if (n != null) return n; }
    }
  }
  return null;
}

const INV_MESI = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function apiData(v) {
  if (!v) return null;
  if (typeof v === 'object' && v.date) v = v.date;
  if (typeof v !== 'string') return null;
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);                 // ISO 2026-08-15
  if (m) return { anno: +m[1], mese: INV_MESI[+m[2] - 1], g: +m[3] };
  m = v.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/);         // 15/08/2026
  if (m) return { anno: +m[3], mese: INV_MESI[+m[2] - 1], g: +m[1] };
  m = v.match(/^(\d{1,2})[-\s]([A-Za-z]{3})[-\s]?(\d{4})?/);   // 15-Aug-2026 / 15 Aug
  if (m && MESI[m[2]]) return { anno: m[3] ? +m[3] : null, mese: m[2], g: +m[1] };
  return null;
}

function apiCampo(o, chiavi) {
  for (const k of chiavi) if (o && o[k] != null) return o[k];
  return undefined;
}

function apiNottiTra(a, b) {
  if (!a || !b || !a.anno || !b.anno) return null;
  const d1 = new Date(a.anno, MESI[a.mese] - 1, a.g);
  const d2 = new Date(b.anno, MESI[b.mese] - 1, b.g);
  const n = Math.round((d2 - d1) / 86400000);
  return n > 0 ? n : null;
}

function apiSoggiornante(s) {
  if (!s || typeof s !== 'object') return null;
  const arrivo = apiData(apiCampo(s, ['check_in','checkin','check_in_date','arrival','arrival_date','from','date_from','start_date','start','begin']));
  const partenza = apiData(apiCampo(s, ['check_out','checkout','check_out_date','departure','departure_date','to','date_to','end_date','end']));
  const cliente = apiCampo(s, ['customer','guest','person']) || s;
  const nome = [apiCampo(cliente, ['last_name','lastname','surname','cognome']),
                apiCampo(cliente, ['first_name','firstname','nome'])]
               .filter(Boolean).join(' ')
            || apiCampo(cliente, ['name','full_name']) || null;
  const prezzo = apiNumero(apiCampo(s, ['price','total','amount','total_price','gross_total']));
  const trattamento = apiCampo(s, ['board','board_type','treatment','arrangement','meal_plan','trattamento','rate_plan']) || null;
  /* v1.6.4: se i nomi dei campi non sono tra quelli noti, si scandaglia
     l'oggetto per qualunque valore che sembri una data (con anno): la prima
     in ordine cronologico è l'arrivo, l'ultima la partenza. Le voci con una
     data sola (es. tariffe giornaliere) restano fuori perché servono DUE
     date distinte. */
  let arrivoTrovato = arrivo, partenzaTrovata = partenza;
  if (!arrivoTrovato || !partenzaTrovata) {
    const date = [];
    /* v1.6.8: fuori le date di sistema. Prendere "qualunque data" faceva
       pescare created_at/updated_at (14 maggio 2021 → 1917 notti in email). */
    const META = /creat|updat|modif|insert|delet|cancel|nasc|birth|scaden|expir|emiss|registr|log|sync|conferm/i;
    (function racc(o, prof) {
      if (!o || typeof o !== 'object' || prof > 2) return;
      for (const [k, v] of Object.entries(o)) {
        if (META.test(k)) continue;
        if (typeof v === 'string') { const dd = apiData(v); if (dd && dd.anno) date.push(dd); }
        else if (v && typeof v === 'object') racc(v, prof + 1);
      }
    })(s, 0);
    date.sort((x, y) => (x.anno - y.anno) || (MESI[x.mese] - MESI[y.mese]) || (x.g - y.g));
    if (date.length >= 2) {
      const prima = date[0], ultima = date[date.length - 1];
      const diverse = prima.anno !== ultima.anno || prima.mese !== ultima.mese || prima.g !== ultima.g;
      if (diverse) {
        if (!arrivoTrovato) arrivoTrovato = prima;
        if (!partenzaTrovata) partenzaTrovata = ultima;
      }
    }
  }
  const arrivoF = arrivoTrovato, partenzaF = partenzaTrovata;
  if (!arrivoF && !partenzaF && prezzo == null && !nome) return null;
  return {
    nome, prezzo,
    trattamento: typeof trattamento === 'string' ? trattamento : null,
    arrivo: arrivoF, partenza: partenzaF,
    notti: apiNottiTra(arrivoF, partenzaF)
  };
}

/* Trova nella risposta gli oggetti-camera: qualunque oggetto con
   prices.adults (il campo osservato in Fidra: un prezzo per ogni adulto). */
function apiTrovaCamere(radice) {
  const camere = [];
  const visti = new Set();
  (function scendi(nodo, profondita) {
    if (!nodo || typeof nodo !== 'object' || profondita > 8 || visti.has(nodo)) return;
    visti.add(nodo);
    if (nodo.prices && nodo.prices.adults != null) { camere.push(nodo); return; }
    for (const k of Object.keys(nodo)) scendi(nodo[k], profondita + 1);
  })(radice, 0);
  return camere;
}

async function leggiCamereAPI() {
  const rid = location.pathname.match(/reservations\/(\d+)/)?.[1];
  if (!rid) return null;
  let j;
  try {
    const resp = await fetch('/api/reservations/' + rid, {
      headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
    });
    if (!resp.ok) return null;
    j = await resp.json();
  } catch (e) { return null; }

  const grezze = apiTrovaCamere(j.data || j);
  if (!grezze.length) return null;

  return grezze.map(cr => {
    // prezzi per adulto: array di numeri, di oggetti, oppure oggetto indicizzato
    let pa = cr.prices.adults;
    if (!Array.isArray(pa) && typeof pa === 'object') pa = Object.values(pa);
    if (!Array.isArray(pa)) pa = [pa];
    const prezzi = pa.map(apiNumero).filter(v => v != null);

    /* v1.6.3: periodi per soggiornante. Il nome del campo non è noto con
       certezza: si cerca in TUTTO l'oggetto camera un array di oggetti che
       abbiano SIA arrivo SIA partenza (questo li distingue dagli array
       giornalieri di tariffe, che hanno una data sola) e che siano tanti
       quanti i prezzi. Se non c'è, pazienza: le date arriveranno dalla
       pagina in arricchisciConAPI. */
    let sg = [];
    (function cercaStays(o, prof) {
      if (sg.length || !o || typeof o !== 'object' || prof > 4) return;
      for (const k of Object.keys(o)) {
        const v = o[k];
        if (Array.isArray(v) && v.length && v[0] && typeof v[0] === 'object') {
          const letti = v.map(apiSoggiornante).filter(x => x && x.arrivo && x.partenza);
          // v1.6.4: anche array più lunghi (es. con i bambini): valgono i primi N
          if (prezzi.length && letti.length >= prezzi.length) { sg = letti.slice(0, prezzi.length); return; }
        } else if (v && typeof v === 'object' && k !== 'prices') {
          cercaStays(v, prof + 1);
        }
      }
    })(cr, 0);

    // accoppia prezzo e periodo per posizione (grezzi: la scala è tarata dopo)
    const soggiornanti = prezzi.map((p, i) => Object.assign(
      { nome: null, trattamento: null, arrivo: null, partenza: null, notti: null },
      sg[i] || {}, { prezzo: p }));

    /* v1.6.4: prezzo dei bambini (prices.children), stessa scala degli adulti */
    let pb = (cr.prices || {}).children;
    if (pb != null && !Array.isArray(pb) && typeof pb === 'object') pb = Object.values(pb);
    const prezziBambini = (Array.isArray(pb) ? pb : (pb != null ? [pb] : []))
      .map(apiNumero).filter(v => v != null && v > 0);

    const numero = apiCampo(cr.room || cr, ['number','room_number','numero']) ?? null;
    return {
      numero: numero != null ? String(numero) : null,
      adulti: typeof cr.adults === 'number' ? cr.adults : soggiornanti.length,
      soggiornanti,
      prezziBambini
    };
  });
}

/* ============================================================
   v1.6.3 — TARATURA DELLA SCALA (centesimi vs euro)
   L'API di Fidra lavora in CENTESIMI (come /api/available, e come il
   link di pagamento che moltiplica per 100). Ma non ci si fida di una
   costante: si tara ogni camera contro il prezzo che la pagina mostra
   (il "Totale X € p.p.", che è il prezzo del primo ospite). Se nessuna
   scala fa combaciare un prezzo API con quello di pagina, la camera si
   considera NON leggibile: meglio bloccarsi che spedire 65.000 €.
   ============================================================ */
function scalaPrezzi(prezzi, riferimento) {
  if (!prezzi.length) return null;
  if (riferimento != null && riferimento > 0) {
    for (const p of prezzi) {
      if (Math.abs(p / 100 - riferimento) < 0.011) return 100;  // centesimi
      if (Math.abs(p - riferimento) < 0.011) return 1;          // euro
    }
    return null;   // nessun prezzo combacia in nessuna scala: non fidarsi
  }
  // senza riferimento di pagina: interi e "grandi" → quasi certamente centesimi
  return prezzi.every(p => Number.isInteger(p)) && Math.min(...prezzi) >= 1000 ? 100 : 1;
}

/* periodo di un ospite quando l'API non lo dà: la data propria annotata
   in pagina ("Arrivo 15-Aug"), completata con le date della camera */
function periodoDaPagina(det, c, d) {
  const base = c.periodo || {};
  const annoDi = (mese) => {
    if (!d.anno) return null;
    return (d.annoPartenza && d.mesePartenza && mese === d.mesePartenza &&
            d.mesePartenza !== d.mese) ? d.annoPartenza : d.anno;
  };
  const gA = base.g1 ?? d.giornoArrivo,  mA = base.mese ?? d.mese;
  const gP = base.g2 ?? d.giornoPartenza,
        mP = (base.mesePartenza || base.mese) ?? (d.mesePartenza || d.mese);
  const pr = det && det.arrivoProprio, pp = det && det.partenzaPropria;
  const arrivo   = pr ? { g: pr.g, mese: pr.mese, anno: annoDi(pr.mese) }
                      : (gA && mA ? { g: gA, mese: mA, anno: annoDi(mA) } : null);
  const partenza = pp ? { g: pp.g, mese: pp.mese, anno: annoDi(pp.mese) }
                      : (gP && mP ? { g: gP, mese: mP, anno: annoDi(mP) } : null);
  return { arrivo, partenza, notti: apiNottiTra(arrivo, partenza) };
}

/* Fusione: attribuisce a ogni camera di pagina i suoi soggiornanti API,
   tara la scala dei prezzi, completa le date dalla pagina, ricalcola il
   totale come SOMMA e confronta con quello di pagina. */
async function arricchisciConAPI(d) {
  d.avvisi = d.avvisi || [];
  let api = null;
  try { api = await leggiCamereAPI(); } catch (e) { /* si prosegue senza */ }
  d.apiLetta = !!(api && api.length);

  if (d.apiLetta) {
    /* v1.6.4: abbinamento camera di pagina ↔ camera API. Prima per numero
       camera; poi per FIRMA DI PREZZO (un prezzo adulto dell'API che
       combacia col "p.p." di pagina, in euro o centesimi) — è questo che
       evita gli scambi quando l'ordine dell'API differisce da quello della
       pagina; per posizione solo come ultima spiaggia. Ogni camera API si
       usa una volta sola. */
    const usate = new Set();
    const combacia = (a, c) => c.totalePP != null && a.soggiornanti.some(s =>
      s.prezzo != null && (Math.abs(s.prezzo - c.totalePP) < 0.011 ||
                           Math.abs(s.prezzo / 100 - c.totalePP) < 0.011));
    const trovaAbbinata = (c, i) => {
      let k = api.findIndex((a, j) => !usate.has(j) && a.numero != null &&
                                       String(c.numero) === a.numero);
      if (k < 0) k = api.findIndex((a, j) => !usate.has(j) && combacia(a, c));
      if (k < 0 && api.length === d.camere.length && !usate.has(i)) k = i;
      if (k < 0) return null;
      usate.add(k);
      return api[k];
    };
    d.camere.forEach((c, i) => {
      const a = trovaAbbinata(c, i);
      if (!a || !a.soggiornanti.length) return;

      // 1) scala: centesimi o euro, tarata sul prezzo di pagina
      const grezzi = a.soggiornanti.map(s => s.prezzo).filter(v => v != null);
      const scala = scalaPrezzi(grezzi, c.totalePP);
      if (scala == null) {
        d.avvisi.push({ tipo: 'scala-illeggibile',
          testo: `Camera ${i + 1} (${c.categoria || 'n. ' + c.numero}): i prezzi dell'API ` +
                 `(${grezzi.join(', ')}) non combaciano con il prezzo di pagina ` +
                 `(${c.totalePP != null ? euro(c.totalePP) + ' €' : 'assente'}) né in euro né in ` +
                 `centesimi. Dettaglio per ospite scartato.` });
        return;   // niente soggiornanti: se la camera è mista, valida() blocca
      }
      const soggiornanti = a.soggiornanti.map(s => Object.assign({}, s, {
        prezzo: s.prezzo != null ? s.prezzo / scala : null
      }));

      // 2) date: se l'API non le ha date, si prendono quelle annotate in pagina
      if (soggiornanti.every(s => !s.arrivo && !s.partenza) &&
          (c.ospitiDettaglio || []).length === soggiornanti.length) {
        soggiornanti.forEach((s, k) => {
          const per = periodoDaPagina(c.ospitiDettaglio[k], c, d);
          s.arrivo = per.arrivo; s.partenza = per.partenza; s.notti = per.notti;
          if (!s.nome) s.nome = c.ospitiDettaglio[k].nome;
        });
        /* buon senso sull'abbinamento per posizione: a parità di camera e
           trattamento, chi sta più notti non può pagare meno. Se succede,
           i prezzi si riabbinano per durata (decrescente con decrescente). */
        const nottiNote = soggiornanti.every(s => s.notti != null);
        const prezziNoti = soggiornanti.every(s => s.prezzo != null);
        if (nottiNote && prezziNoti) {
          const perDurata = [...soggiornanti].sort((x, y) => y.notti - x.notti);
          const perPrezzo = [...soggiornanti].map(s => s.prezzo).sort((x, y) => y - x);
          const incoerente = perDurata.some((s, k) => s.prezzo < perPrezzo[k] - 0.005 &&
            perDurata.filter(z => z.notti === s.notti).length === 1);
          if (incoerente) perDurata.forEach((s, k) => { s.prezzo = perPrezzo[k]; });
        }
      }

      /* ============================================================
         v1.6.8 — CONTROLLO DI PLAUSIBILITÀ DELLE DATE PER OSPITE
         Un periodo per ospite ha senso solo DENTRO il soggiorno della
         camera: stesso anno, non prima dell'arrivo, non dopo la partenza,
         mai più notti del soggiorno. Se anche una sola data non regge,
         si buttano TUTTE le date per ospite (i prezzi restano) e si
         avvisa: meglio righe senza periodo che "1917 notti".
         ============================================================ */
      const gg = (x) => x && x.anno && x.mese && MESI[x.mese]
        ? new Date(x.anno, MESI[x.mese] - 1, x.g).getTime() : null;
      const arrivoCam   = { g: (c.periodo && c.periodo.g1) || d.giornoArrivo,
                            mese: (c.periodo && c.periodo.mese) || d.mese, anno: d.anno };
      const partenzaCam = { g: (c.periodo && c.periodo.g2) || d.giornoPartenza,
                            mese: (c.periodo && (c.periodo.mesePartenza || c.periodo.mese)) ||
                                  d.mesePartenza || d.mese,
                            anno: d.annoPartenza || d.anno };
      const tA = gg(arrivoCam), tP = gg(partenzaCam);
      const nottiCam = (c.periodo && c.periodo.notti) || d.notti || null;
      const anniOk = [d.anno, d.annoPartenza].filter(Boolean);
      if (soggiornanti.some(s => s.arrivo || s.partenza)) {
        const fuori = soggiornanti.some(s => {
          // durata oltre il soggiorno: controllo che vale anche senza anno noto
          if (s.notti != null && nottiCam && s.notti > nottiCam) return true;
          // anno diverso da quello del soggiorno
          if (anniOk.length) {
            for (const x of [s.arrivo, s.partenza])
              if (x && x.anno && !anniOk.includes(x.anno)) return true;
          }
          // fuori dall'intervallo, quando le date sono confrontabili
          const a = gg(s.arrivo), p = gg(s.partenza);
          if (tA && tP) {
            if (a != null && (a < tA - 86400000 || a > tP)) return true;
            if (p != null && (p > tP + 86400000 || p < tA)) return true;
          }
          return false;
        });
        if (fuori) {
          soggiornanti.forEach(s => { s.arrivo = null; s.partenza = null; s.notti = null; });
          d.avvisi.push({ tipo: 'date-ospiti-implausibili',
            testo: `Camera ${i + 1} (${c.categoria || 'n. ' + c.numero}): le date per ospite ` +
                   `lette dall'API cadono fuori dal soggiorno ${arrivoCam.g}–${partenzaCam.g} ` +
                   `${partenzaCam.mese}, quindi sono state scartate. In email restano i prezzi ` +
                   `per ospite senza periodi: se servono le date, scrivile a mano.` });
        }
      }

      c.soggiornanti = soggiornanti;
      c.totaleCamera = soggiornanti.reduce((t, s) => t + (s.prezzo || 0), 0);

      /* v1.6.4: quota bambini, con la stessa scala tarata sugli adulti */
      if ((a.prezziBambini || []).length) {
        c.bambiniPrezzi = a.prezziBambini.map(p => p / scala);
        c.totaleCamera += c.bambiniPrezzi.reduce((t, p) => t + p, 0);
      } else if ((c.bambini || 0) > 0) {
        d.avvisi.push({ tipo: 'bambino-senza-prezzo',
          testo: `Camera ${i + 1} (${c.categoria || 'n. ' + c.numero}): ${c.bambini} ` +
                 `bambin${c.bambini === 1 ? 'o' : 'i'} ma il prezzo bambino non è ` +
                 `nell'API — il totale potrebbe non comprendere la sua quota. Verifica in Fidra.` });
      }
      const prezzi = soggiornanti.map(s => s.prezzo).filter(v => v != null);
      c.prezziDiversi = prezzi.length > 1 && Math.max(...prezzi) - Math.min(...prezzi) > 0.005;
      const chiavePeriodo = (s) => s.arrivo && s.partenza
        ? `${s.arrivo.g}-${s.arrivo.mese}|${s.partenza.g}-${s.partenza.mese}` : null;
      const periodi = [...new Set(soggiornanti.map(chiavePeriodo).filter(Boolean))];
      c.periodiOspitiDiversi = periodi.length > 1;
      if (c.periodiOspitiDiversi || c.prezziDiversi) c.dateMiste = true;
    });

    const conAPI = d.camere.filter(c => c.totaleCamera != null);
    if (conAPI.length === d.camere.length && d.camere.length) {
      const totaleAPI = conAPI.reduce((a, c) => a + c.totaleCamera, 0);
      if (d.totale != null && Math.abs(totaleAPI - d.totale) > 0.009) {
        d.avvisi.push({
          tipo: 'totale-divergente',
          pagina: d.totale, api: totaleAPI,
          testo: `La pagina porta a ${euro(d.totale)} € (prezzo p.p. × adulti), ma i prezzi ` +
                 `dei singoli ospiti${d.camere.some(c => (c.bambiniPrezzi || []).length) ? ', bambini inclusi,' : ''} ` +
                 `sommano ${euro(totaleAPI)} €. L'email usa i prezzi per ospite.`
        });
      }
      // in ogni caso la somma per ospite è la fonte più fine: si adotta
      d.totale = totaleAPI;
      d.totaleFmt = euro(totaleAPI);
      d.fonteTotale = 'prezzi per ospite (API)';
      d.saldo = d.totale - d.acconto;
      d.saldoFmt = euro(d.saldo);
    }
  }

  /* ============================================================
     v1.6.7 — EXTRA NEL TOTALE
     La pagina elenca gli extra con un prezzo unitario e un'unità
     ("Al giorno per camera", "Al giorno per adulto"). Qui si moltiplica
     secondo l'unità dichiarata e si somma al totale. Un extra con
     un'unità che non si sa interpretare NON si somma: si avvisa e
     decide l'operatore, invece di indovinare un importo.
     ============================================================ */
  d.extra = [];
  let extraCalcolabile = true;
  d.camere.forEach((c, i) => {
    (c.extra || []).forEach(e => {
      const nottiCamera = (c.periodo && c.periodo.notti) || d.notti || 1;
      const ad = c.adulti || 0, bam = c.bambini || 0;
      const u = (e.unita || '').toLowerCase();
      let quantita = null, spiega = '';
      const alGiorno = /al giorno/.test(u);
      const perAdulto = /adulto/.test(u), perPersona = /persona|ospite/.test(u),
            perCamera = /camera/.test(u) || /una tantum/.test(u);
      if (perAdulto)       { quantita = ad;  spiega = `${ad} adulti`; }
      else if (perPersona) { quantita = ad + bam; spiega = `${ad + bam} persone`; }
      else if (perCamera)  { quantita = 1;  spiega = '1 camera'; }
      if (quantita != null && alGiorno) {
        quantita *= nottiCamera;
        spiega += ` × ${nottiCamera} ${nottiCamera === 1 ? 'notte' : 'notti'}`;
      }
      const voce = { nome: e.nome, unitario: e.prezzo, unita: e.unita,
                     quantita, spiega, camera: i + 1,
                     totale: quantita != null ? e.prezzo * quantita : null };
      d.extra.push(voce);
      (c.extraCalcolati = c.extraCalcolati || []).push(voce);
      if (quantita == null) {
        extraCalcolabile = false;
        d.avvisi.push({ tipo: 'extra-non-calcolabile',
          testo: `Extra "${e.nome}" (${euro(Math.abs(e.prezzo))} €${e.sconto ? ' di sconto' : ''}${e.unita ? ', ' + e.unita : ''}): ` +
                 `non so quante volte va contato, quindi NON è nel totale. Aggiungilo a mano.` });
      }
    });
  });
  const totaleExtra = d.extra.reduce((t, e) => t + (e.totale || 0), 0);
  if (Math.abs(totaleExtra) > 0.005 && d.totale != null) {
    d.totaleCamere = d.totale;
    d.totale += totaleExtra;
    d.totaleExtra = totaleExtra;
    d.totaleFmt = euro(d.totale);
    d.saldo = d.totale - d.acconto;
    d.saldoFmt = euro(d.saldo);
    d.avvisi.push({ tipo: 'extra-inclusi',
      testo: `Extra in prenotazione: ${d.extra.filter(e => e.totale != null)
        .map(e => `${e.nome} ${e.totale < 0 ? '−' : ''}${euro(Math.abs(e.totale))} €${e.spiega ? ' (' + e.spiega + ')' : ''}`).join(' · ')}. ` +
        `Totale con extra ${euro(d.totale)} €. Controlla che coincida con Fidra.` });
  }

  /* v2.9.8 — UN TOTALE DI ZERO NON E' UN TOTALE.

     Il 12 agosto 2026 e' partito a Salvatore Ferrario un sollecito che
     diceva «3 notti per 4 persone, 0,00 € in totale» e undici righe piu'
     sotto «per bloccarla basta l'acconto di 300,00 €». Il soggiorno
     costava 1.440 €: due Matrimoniale Queen, 2 x 360 €, tre notti.

     Il conto e' `totale = somma(totalePP x adulti)`, e `calcolabile`
     diventa falso SOLO se quei valori sono null. Se la pagina restituisce
     zero, il totale e' zero ed e' considerato buono: passa tutti i
     controlli e finisce nell'email. Zero, per il codice, e' un numero come
     un altro — ed e' il tipo di difetto che non si vede provando, perche'
     nelle prove i prezzi ci sono sempre.

     Non si blocca l'email: si dice all'operatore, che il prezzo giusto ce
     l'ha sotto gli occhi in Fidra e lo scrive nel campo del pannello. */
  if (d.totale === 0 && (d.camere || []).length > 0) {
    d.avvisi.push({
      tipo: 'totale-zero',
      testo: 'Il totale letto dalla pagina e\' 0,00 €, ma la prenotazione ha ' +
             `${d.camere.length} camer${d.camere.length === 1 ? 'a' : 'e'}` +
             (d.acconto ? ` e una caparra di ${euro(d.acconto)} €` : '') +
             '. Scrivi tu l\'importo giusto qui sotto: senza, l\'email dice ' +
             'all\'ospite che il soggiorno costa zero.'
    });
  }

  // caparra versata sopra il totale: il "saldo all'arrivo" sarebbe negativo
  if (d.totale != null && d.caparraVersata != null && d.caparraVersata - d.totale > 0.009) {
    d.avvisi.push({
      tipo: 'caparra-eccedente',
      eccedenza: d.caparraVersata - d.totale,
      testo: `Caparra versata ${euro(d.caparraVersata)} € su un totale di ${euro(d.totale)} €: ` +
             `l'ospite risulta in credito di ${euro(d.caparraVersata - d.totale)} €. Verifica la pratica.`
    });
  }

  return d;
}

/* ---------- canale con il popup ---------- */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.tipo !== 'ESTRAI') return;
  (async () => {
    try {
      const d = estrai();
      await arricchisciConAPI(d);   // v1.6: prezzi e date per singolo ospite
      d.profilo = await leggiProfiloAPI(d.intestatario);
      d.operatore = operatoreLoggato();
      // v1.1.1: senza email in anagrafica il link mailto manca e la lettura
      // dell'intestazione fallisce a catena: nome ed email arrivano dall'API.
      if (!d.intestatario && d.profilo && (d.profilo.cognome || d.profilo.nome)) {
        d.intestatario = [d.profilo.cognome, d.profilo.nome].filter(Boolean).join(' ');
      }
      if (!d.email && d.profilo && d.profilo.email) d.email = d.profilo.email;
      d.mancanti = valida(d);
      sendResponse(d);
    } catch (e) {
      sendResponse({ ok: false, errore: String(e) });
    }
  })();
  return true; // canale aperto per la risposta asincrona
});
