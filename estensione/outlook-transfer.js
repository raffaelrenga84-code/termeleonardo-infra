/* ============================================================
   Offerta Leonardo — Transfer: dalla mail al modulo dei tassisti (v1.5.0)
   ------------------------------------------------------------
   Gira in Outlook Web. Quando nel riquadro di lettura c'e' una
   richiesta di transfer, appare un pulsante: al clic mostra cosa ha
   capito, e solo al secondo clic apre atam.biz/prenotazioni con il
   frammento #leo=… che atam-booking.js sa leggere.

   PERCHE' UN FILE A PARTE e non dentro outlook-inject.js: quel file
   sono 1152 righe che oggi funzionano, e la lettura del testo libero
   e' la parte che sbaglia di piu'. Tenerla separata vuol dire poterla
   spegnere togliendo una riga dal manifest, senza toccare le offerte.

   LA COSA PIU' FACILE DA SBAGLIARE SONO LE DATE. In una richiesta di
   transfer ce ne sono quasi sempre due: quella della corsa e quella
   del soggiorno. «für den 28.08.26 ein Taxi … Urlaub vom 28.08.-
   06.09.26»: prendere la prima e' fortuna, non lettura. Quando il
   testo ne contiene piu' d'una, l'anteprima le mostra tutte e la
   scelta e' dell'operatore.
   ============================================================ */

(() => {
  const ID_BTN = 'leonardo-transfer-btn';
  const ID_ANT = 'leonardo-transfer-anteprima';

  /* ============================================================
     1. LE DESTINAZIONI
     L'elenco dei tassisti e' chiuso: 189 voci, con doppi spazi dentro
     («Venezia  aeroporto») ed emoji («Verona Aeroporto✈️»). L'ospite
     scrive «Flughafen Venedig Marco Polo». Senza una tabella dichiarata
     non si incontrano mai, e un confronto approssimativo sceglierebbe
     male — che su un taxi vuol dire un'auto all'aeroporto sbagliato.
     Qui stanno solo le voci che compaiono davvero nelle richieste; per
     tutte le altre non si indovina: si lascia scegliere.
     ============================================================ */
  const LUOGHI = [
    ['Venezia  aeroporto', ['venezia aeroporto', 'aeroporto di venezia', 'marco polo', 'vce',
      'flughafen venedig', 'venedig flughafen', 'flughafen marco polo', 'airport venice',
      'venice airport', 'aeroport de venise', 'aeroport venise']],
    ['Treviso Aeroporto', ['treviso aeroporto', 'aeroporto di treviso', 'canova', 'tsf',
      'flughafen treviso', 'treviso airport']],
    ['Verona Aeroporto✈️', ['verona aeroporto', 'aeroporto di verona', 'catullo', 'vrn',
      'flughafen verona', 'verona airport']],
    ['Bologna Aeroporto', ['bologna aeroporto', 'aeroporto di bologna', 'marconi', 'blq',
      'flughafen bologna', 'bologna airport']],
    ['Milano Malpensa✈️', ['malpensa', 'mxp']],
    ['Milano-Linate', ['linate', 'lin']],
    ['Bergamo aeroporto✈️', ['bergamo aeroporto', 'orio al serio', 'bgy']],
    ['Aeroporto Roma fiumicino', ['fiumicino', 'fco', 'roma aeroporto', 'aeroporto di roma']],
    ['Venezia P.le Roma', ['piazzale roma', 'p.le roma', 'ple roma']],
    ['Venezia porto', ['porto di venezia', 'venezia porto', 'terminal crociere', 'hafen venedig']],
    ['Padova FS', ['padova stazione', 'stazione di padova', 'padova fs', 'bahnhof padua',
      'padua bahnhof', 'padova centrale', 'padua station']],
    ['Terme  Euganee FS', ['terme euganee', 'stazione montegrotto', 'montegrotto stazione',
      'bahnhof montegrotto']],
    ['Mestre fs', ['mestre stazione', 'stazione di mestre', 'mestre fs', 'bahnhof mestre',
      'bahnhof venezia mestre', 'venezia mestre', 'venice mestre', 'mestre bahnhof']],
    ['Abano F.S', ['abano stazione', 'stazione di abano', 'abano fs']],
    ['Verona Arena🌛', ['arena di verona', 'verona arena']],
    ['Padova città', ['padova centro', 'centro di padova', 'padua stadt']]
  ];

  /* via emoji, accenti e spazi doppi: e' l'unico modo perche' «Venezia
     aeroporto» e «Venezia  aeroporto» siano la stessa cosa */
  const piatto = (s) => String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2190-\u2BFF\uFE0F\u{1F000}-\u{1FAFF}]/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase();

  function riconosciLuogo(testo) {
    const t = piatto(testo);
    let migliore = null;
    for (const [voce, sinonimi] of LUOGHI) {
      for (const s of sinonimi) {
        const p = piatto(s);
        if (t.includes(p) && (!migliore || p.length > migliore.lung)) {
          migliore = { voce, lung: p.length, riconosciutoDa: s };
        }
      }
    }
    return migliore;
  }

  /* ============================================================
     2. DATE, ORE, PERSONE
     ============================================================ */
  const MESI = {
    gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6, luglio: 7,
    agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
    januar: 1, februar: 2, marz: 3, april: 4, mai: 5, juni: 6, juli: 7,
    august: 8, september: 9, oktober: 10, november: 11, dezember: 12,
    january: 1, february: 2, march: 3, may: 5, june: 6, july: 7, october: 10, december: 12
  };
  const NOMI_IT = ['', 'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
    'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

  const iso = (d) => `${d.a}-${String(d.m).padStart(2, '0')}-${String(d.g).padStart(2, '0')}`;
  const leggibile = (d) => `${d.g} ${NOMI_IT[d.m]} ${d.a}`;

  /* anno a due cifre: 26 → 2026. Non si accettano anni passati: una
     richiesta di transfer per l'anno scorso non esiste, ed e' quasi
     sempre un numero che non era una data. */
  function anno(v) {
    const n = +v;
    if (n >= 1000) return n;
    return 2000 + n;
  }

  function trovaDate(testo) {
    const viste = new Map();   // ISO → {data, contesto}
    const agg = (g, m, a, indice) => {
      if (!(g >= 1 && g <= 31 && m >= 1 && m <= 12)) return;
      const d = { g, m, a: anno(a) };
      if (d.a < new Date().getFullYear()) return;
      const k = iso(d);
      if (!viste.has(k)) {
        viste.set(k, { ...d, contesto: contorno(testo, indice) });
      }
    };

    /* 28.08.26 · 28/08/2026 · 28-08-2026 */
    let m;
    const re1 = /(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/g;
    while ((m = re1.exec(testo))) agg(+m[1], +m[2], m[3], m.index);

    /* 28. August 2026 · 28 agosto 2026 · 6 settembre */
    const re2 = /(\d{1,2})\.?\s+([A-Za-zÀ-ÿ]{3,10})\.?\s*(\d{4})?/g;
    while ((m = re2.exec(testo))) {
      const mese = MESI[piatto(m[2]).replace(/\s/g, '')];
      if (mese) agg(+m[1], mese, m[3] || new Date().getFullYear(), m.index);
    }
    return [...viste.values()];
  }

  /* le parole intorno a una data: servono all'operatore per capire
     quale delle due e' la corsa, senza dover riaprire la mail */
  function contorno(testo, i) {
    return testo.slice(Math.max(0, i - 45), i + 30).replace(/\s+/g, ' ').trim();
  }

  const PAROLE_CORSA = /taxi|transfer|abhol|navett|shuttle|pick\s*up|corsa|trasferiment/i;
  /* «Urlaub vom 28.08.- 06.09.26» non e' una corsa: e' il soggiorno.
     Lo diceva la richiesta vera di Edith, dove per il 6 settembre non
     c'era ne' un'ora ne' un luogo — perche' il ritorno non lo stava
     chiedendo. Un transfer di ritorno e' comunque una prenotazione ATAM
     a parte, quindi proporlo come alternativa alla corsa e' rumore. */
  const PAROLE_SOGGIORNO = /urlaub|aufenthalt|soggiorno|ferien|s[eé]jour|\bstay\b|vacanz|holiday/i;

  /* v1.3.0 — ogni data viene etichettata per quello che la circonda:
     corsa · soggiorno · incerta. Le date di soggiorno escono di scena e
     restano solo come nota, cosi' l'operatore non deve scegliere fra la
     data giusta e una che non e' mai stata in gara. */
  function classifica(d) {
    const corsa = PAROLE_CORSA.test(d.contesto);
    const soggiorno = PAROLE_SOGGIORNO.test(d.contesto);
    if (corsa && !soggiorno) return 'corsa';
    if (soggiorno && !corsa) return 'soggiorno';
    return 'incerta';
  }

  /* un'ora vicina e' un buon segno che si tratti di una corsa: per il
     6 settembre non c'era, e infatti nessuno lo stava chiedendo.
     Il punto NON vale come separatore: «06.09» e' la data stessa, e
     letta come orario darebbe le 06:09 — il test l'ha beccato subito.
     Valgono i due punti, o il punto con «Uhr»/«ore» accanto. */
  function haOraVicina(d) {
    return /\b([01]?\d|2[0-3]):([0-5]\d)\b/.test(d.contesto) ||
           /\b(?:ore|um|alle)\s*([01]?\d|2[0-3])\.([0-5]\d)\b/i.test(d.contesto) ||
           /\b([01]?\d|2[0-3])\.([0-5]\d)\s*(?:uhr\b|h\b)/i.test(d.contesto);
  }

  function dataProbabile(date) {
    if (date.length <= 1) return date[0] || null;
    const corse = date.filter(d => d.tipo === 'corsa');
    if (corse.length === 1) return corse[0];
    const inGara = corse.length ? corse : date.filter(d => d.tipo !== 'soggiorno');
    if (inGara.length === 1) return inGara[0];
    /* fra piu' candidate, quella con un'ora accanto */
    const conOra = inGara.filter(haOraVicina);
    if (conOra.length === 1) return conOra[0];
    return null;      // davvero ambigua: sceglie l'operatore
  }

  /* Il test ha trovato subito il baco: su «28.08.26» questa funzione
     leggeva le ore 08:26. Il punto separa sia le ore sia le date, e una
     data e' fatta apposta per somigliare a un orario. Quindi: i due
     punti valgono sempre, il punto solo se qualcosa nel testo dice che
     e' un'ora — «Uhr», «ore», «alle», «um». */
  function trovaOra(testo) {
    const due = (h, m) => `${String(+h).padStart(2, '0')}:${m}`;

    /* v1.2.0 — prima si prendeva il primo HH:MM del testo, e nel riquadro
       di lettura di Outlook il primo HH:MM non e' nella mail: e' l'orario
       nell'elenco dei messaggi a sinistra. Risultato dal vivo: 19:13, che
       era l'ora in cui e' arrivata la posta, al posto di 10:25.
       Ora vale prima l'ora DICHIARATA — «10:25 Uhr», «ore 10:25»,
       «Ankunft 10:25» — e solo se nel testo ce n'e' una sola, senza
       nessuna parola intorno, si accetta quella nuda. */
    const MARCATE = [
      /\b(?:ankunft|arrivo|arrival|partenza|abfahrt|departure|abholung|pick\s*up)\b[^\n\d]{0,20}([01]?\d|2[0-3])[:.]([0-5]\d)/i,
      /\b(?:ore|um|alle|alle ore|h|at)\s*([01]?\d|2[0-3])[:.]([0-5]\d)\b/i,
      /\b([01]?\d|2[0-3])[:.]([0-5]\d)\s*(?:uhr\b|h\b|hrs\b)/i
    ];
    for (const re of MARCATE) {
      const m = testo.match(re);
      if (m) return due(m[1], m[2]);
    }

    const nude = [...testo.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g)];
    if (nude.length === 1) return due(nude[0][1], nude[0][2]);
    return null;      // nessuna, oppure troppe: la mette l'operatore
  }


  function trovaPax(testo) {
    /* «3 Personen» ma anche «Personen: 1» — le richieste scritte a
       moduli mettono l'etichetta prima e il numero dopo */
    const m = testo.match(/\b(\d{1,2})\s*(?:person|persone|personen|pax|passegger|passenger|adult|erwachsen|people|ospiti)/i)
      || testo.match(/\b(?:person(?:en|e|es|s)?|pax|passegger\w*|passengers?|ospiti|adulti|erwachsene)\s*:?\s*(\d{1,2})\b/i)
      || testo.match(/(?:per|für|for|fur)\s+(\d{1,2})\s/i);
    const n = m ? +m[1] : null;
    return (n && n >= 1 && n <= 16) ? n : null;
  }

  /* «FLUG: Condor DE 4237» · «Flugnummer: EN8204» · «volo AZ 1234»
     Il codice compagnia e' di due caratteri: due lettere (DE, EN, LH),
     lettera piu' cifra (U2) o cifra piu' lettera (4U). Ammetterne tre
     spezzava «EN8204» in «EN8 204», perche' l'8 veniva preso per parte
     del codice invece che del numero — trovato dal test. */
  function trovaVolo(testo) {
    const m = testo.match(/(?:flug\s?nummer|numero\s+(?:di\s+)?volo|flight\s?(?:no|number)|flug|volo|flight|vol)\s*(?:nr\.?|n\.?|:)?\s*([A-Za-zÀ-ÿ]{2,10}\s+)?([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{1,4})\b/i);
    if (m) return `${m[1] ? m[1].trim() + ' ' : ''}${m[2].toUpperCase()} ${m[3]}`.trim();
    const t = testo.match(/(?:treno|zug|train)\s*(?:nr\.?|n\.?|:)?\s*([A-Z0-9]{2,8})/i);
    return t ? `Treno ${t[1].toUpperCase()}` : null;
  }

  /* arrivo = l'ospite viene PRESO fuori e portato in hotel */
  /* Anche qui il test ha smascherato un errore: su «dall'hotel
     all'aeroporto» leggeva ARRIVO. La colpa e' dell'apostrofo — dentro
     «dall'hotel» c'e' «all'hotel», e la regola dell'arrivo scattava
     sulla coda della parola della partenza. Togliere gli apostrofi
     prima di guardare risolve, e obbligare a uno spazio fra la
     preposizione e «hotel» impedisce che si ripeta. */
  function trovaVerso(testo) {
    const netto = String(testo).replace(/[’']/g, ' ').replace(/\s+/g, ' ');
    const frase = (netto.match(new RegExp('[^.\\n]*' + PAROLE_CORSA.source + '[^.\\n]*', 'i')) || [netto])[0];
    const versoHotel = /\b(?:zum|ins|nach|al|all|alla|allo|verso l|to the|to)\s+hotel\b|\bin hotel\b/i;
    const daHotel = /\b(?:vom|ab|dal|dall|dalla|dallo|from the|from)\s+hotel\b|\bpartenza\b|\babfahrt\b|r[uü]ckfahrt|\bdeparture\b|check\s*-?\s*out/i;
    if (versoHotel.test(frase) && !daHotel.test(frase)) return 'arrivo';
    if (daHotel.test(frase) && !versoHotel.test(frase)) return 'partenza';
    if (versoHotel.test(netto) && !daHotel.test(netto)) return 'arrivo';
    if (daHotel.test(netto) && !versoHotel.test(netto)) return 'partenza';
    /* le richieste a moduli non scrivono «zum Hotel»: scrivono
       «Ankunft Daten» oppure «Abreise / Rückflug». Vale meno di una
       frase esplicita, quindi si guarda solo se le regole sopra tacciono. */
    const arrivo = /\bankunft\b|\banreise\b|\barrivo\b|\barrival\b|\blanding\b|\batterragg/i.test(netto);
    const partenza = /\babreise\b|\babflug\b|\br[uü]ckflug\b|\bdeparture\b|\bpartenza\b|\bcheck\s*-?\s*out\b/i.test(netto);
    if (arrivo && !partenza) return 'arrivo';
    if (partenza && !arrivo) return 'partenza';
    return null;
  }

  /* i nomi dei passeggeri: «TN: Edith Gutbrecht, Felix Schneider, Klara Marquardt» */
  function trovaNomi(testo) {
    const m = testo.match(/(?:^|\n)\s*(?:TN|Teilnehmer|Passeggeri|Nomi|Names?|Ospiti)\s*:\s*([^\n]{3,160})/i);
    if (m) return m[1].replace(/\s*,,\s*/g, ', ').replace(/\s{2,}/g, ' ').trim();
    return null;
  }

  /* ---------- auto privata o navetta condivisa ----------
     v1.1.0 — Gli ospiti tedeschi a volte lo scrivono: «Sammeltaxi»,
     «Sammeltransfer». Quando lo dicono va raccolto, perche' cambia il
     prezzo della corsa e altrimenti l'operatore deve rileggersi la mail.
     Quando NON lo dicono resta indefinito e i pallini non si toccano:
     «ein Taxi» non vuol dire privato — vuol dire taxi, e in tedesco lo
     scrivono anche quelli che poi accettano la navetta. Dedurlo dal
     silenzio sarebbe scegliere al posto dell'ospite una cosa che paga lui.

     I composti tedeschi si scrivono attaccati, staccati o col trattino:
     Sammeltaxi · Sammel-Taxi · Sammel Taxi. La normalizzazione di
     `piatto()` toglie il trattino, quindi basta ammettere lo spazio. */
  const COLLETTIVO = /\bsammel\s?(?:taxi|transfer|bus|fahrt)|\bsammel\b|navetta condivisa|transfer collettivo|servizio collettivo|\bcollettiv|shared (?:shuttle|transfer|ride)|navette collective/i;
  const INDIVIDUALE = /privat\s?(?:taxi|transfer|wagen|fahrt)|\bprivat\b|auto privata|taxi privato|transfer privato|\bindividual/i;

  /* true = collettivo · false = individuale · undefined = non lo dice */
  function trovaCollettivo(testo) {
    const t = piatto(testo);
    const c = COLLETTIVO.test(t), i = INDIVIDUALE.test(t);
    if (c && !i) return true;
    if (i && !c) return false;
    return undefined;      // silenzio, oppure dice tutte e due: non si sceglie
  }

  const RICHIESTA = /taxi|transfer|navett|shuttle|abholung|abholen|trasferiment/i;

  function leggiRichiesta(testo) {
    const t = String(testo || '').replace(/\r/g, '');
    if (!RICHIESTA.test(t)) return null;
    const date = trovaDate(t);
    for (const d of date) { d.tipo = classifica(d); d.conOra = haOraVicina(d); }
    const luogo = riconosciLuogo(t);
    const r = {
      date,
      data: dataProbabile(date),
      dateSoggiorno: date.filter(d => d.tipo === 'soggiorno'),
      dateInGara: date.filter(d => d.tipo !== 'soggiorno'),
      ora: trovaOra(t),
      pax: trovaPax(t),
      verso: trovaVerso(t),
      luogo: luogo ? luogo.voce : null,
      luogoDa: luogo ? luogo.riconosciutoDa : null,
      volo: trovaVolo(t),
      nomi: trovaNomi(t),
      collettivo: trovaCollettivo(t),
      testo: t.replace(/\s+/g, ' ').trim().slice(0, 400)
    };
    /* senza almeno una data e un luogo non c'e' abbastanza per aprire
       niente: meglio non far comparire il pulsante che farlo comparire
       e aprire un modulo vuoto */
    return (date.length || luogo) ? r : null;
  }

  /* ============================================================
     3. IL FRAMMENTO PER atam-booking.js
     ============================================================ */
  function frammento(r, dataScelta) {
    const d = {
      data: dataScelta ? iso(dataScelta) : null,
      ora: r.ora || '',
      pax: r.pax || '',
      verso: r.verso === 'partenza' ? 'partenza' : 'arrivo',
      luogo: r.luogo || '',
      nome: r.nomi || r.mittente || '',
      volo: r.volo || '',
      note: ''
      /* pagamento: non e' nel contratto — resta Diretto, il predefinito
         del modulo, che e' anche il caso normale dell'hotel. */
    };
    for (const k of Object.keys(d)) if (d[k] === '' || d[k] == null) delete d[k];
    /* collettivo va messo DOPO la ripulitura: `false` significa «auto
       privata, detto dall'ospite» ed e' un dato, non un campo vuoto —
       se passasse di la' verrebbe cancellato insieme alle stringhe vuote.
       Se invece la mail non lo dice, la chiave non compare affatto e
       atam-booking.js lascia i pallini come li trova. */
    if (r.collettivo !== undefined) d.collettivo = r.collettivo;
    return 'https://www.atam.biz/prenotazioni/#leo=' + encodeURIComponent(JSON.stringify(d));
  }

  /* ============================================================
     4. INTERFACCIA
     ============================================================ */
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function riga(et, val, mancante) {
    return `<tr><td style="padding:3px 12px 3px 0;color:#8C8578;white-space:nowrap;vertical-align:top;">${et}</td>
      <td style="padding:3px 0;${val ? '' : 'color:#B3261E;'}">${val ? esc(val) : mancante}</td></tr>`;
  }

  function mostraAnteprima(r) {
    document.getElementById(ID_ANT)?.remove();
    let scelta = r.data;

    const box = document.createElement('div');
    box.id = ID_ANT;
    box.style.cssText =
      'position:fixed;bottom:70px;right:24px;z-index:2147483647;width:400px;max-height:80vh;' +
      'overflow:auto;background:#fff;border:1px solid #CBD5D8;border-radius:10px;' +
      'box-shadow:0 10px 30px rgba(15,92,100,.25);' +
      'font:14px/20px Arial,Helvetica,sans-serif;color:#2A2E2B;';

    const disegna = () => {
      const piuDate = r.dateInGara.length > 1;
      box.innerHTML = `
        <div style="background:#C97B2C;color:#fff;padding:9px 14px;border-radius:10px 10px 0 0;font-weight:bold;">
          Transfer — ecco cosa ho letto</div>
        <div style="padding:12px 14px;">
          <table style="width:100%;font-size:13.5px;">
            ${riga('Corsa', scelta ? leggibile(scelta) : '',
                   piuDate ? 'scegli quale data qui sotto' : 'data non letta')}
            ${riga('Ora', r.ora, 'non letta — la metti a mano')}
            ${riga('Persone', r.pax, 'non lette')}
            ${riga('Direzione', r.verso === 'partenza' ? 'Partenza per…'
                   : r.verso === 'arrivo' ? 'Arrivo da…' : '', 'non capita — la scegli tu')}
            ${riga('Luogo', r.luogo, 'non riconosciuto — lo scegli dalla tendina')}
            ${riga('Servizio', r.collettivo === true ? 'Navetta condivisa (detto nella mail)'
                   : r.collettivo === false ? 'Auto privata (detto nella mail)' : '',
                   'non detto — i pallini restano vuoti')}
            ${r.volo ? riga('Volo / treno', r.volo, '') : ''}
            ${r.nomi ? riga('Passeggeri', r.nomi, '') : ''}
          </table>
          ${piuDate ? `<div style="margin-top:10px;padding:9px 11px;background:#FDF6EE;
            border-left:3px solid #C97B2C;font-size:12.5px;color:#7A5A2B;">
            Nella mail ci sono <strong>${r.dateInGara.length} date</strong> che potrebbero essere
            la corsa. Non indovino — scegli tu:
            <div style="margin-top:7px;">${r.dateInGara.map((d, i) =>
              `<label style="display:block;padding:2px 0;cursor:pointer;">
                 <input type="radio" name="leoData" value="${i}" ${scelta && iso(scelta) === iso(d) ? 'checked' : ''}>
                 <strong>${leggibile(d)}</strong>
                 <span style="color:#8C8578;">— «…${esc(d.contesto)}…»</span></label>`).join('')}</div>
          </div>` : ''}
          ${r.dateSoggiorno.length ? `<div style="margin-top:9px;padding:8px 10px;background:#F4F1EA;
            font-size:12.5px;color:#55524B;">La mail nomina anche
            <strong>${r.dateSoggiorno.map(leggibile).join(' e ')}</strong>, ma come
            ${r.dateSoggiorno.length === 1 ? 'data del soggiorno' : 'date del soggiorno'}, senza ora.
            Se serve anche il transfer di ritorno &egrave; una prenotazione a parte.</div>` : ''}
          ${r.luogoDa ? `<div style="margin-top:8px;font-size:12px;color:#8C8578;">
            Luogo riconosciuto da &laquo;${esc(r.luogoDa)}&raquo; nel testo.</div>` : ''}
          <div style="margin-top:10px;padding:9px 11px;background:#F4F1EA;font-size:12.5px;color:#55524B;">
            Il <strong>pagamento</strong> resta Diretto.
            ${r.collettivo === undefined
              ? 'I pallini <strong>auto privata / navetta</strong> non li tocco: la mail non lo dice.'
              : 'Il servizio lo imposto perch&eacute; la mail lo dice.'}
            <strong>Prenota lo premi tu.</strong></div>
          <div style="margin-top:12px;text-align:right;">
            <button id="leoTrAnnulla" style="background:#fff;color:#55524B;border:1px solid #CBD5D8;
              border-radius:5px;padding:7px 14px;font:600 13px Arial;cursor:pointer;">Annulla</button>
            <button id="leoTrVai" style="margin-left:6px;background:#C97B2C;color:#fff;border:0;
              border-radius:5px;padding:7px 16px;font:600 13px Arial;cursor:pointer;">Apri modulo ATAM</button>
          </div>
        </div>`;

      box.querySelectorAll('input[name="leoData"]').forEach((el) => {
        el.addEventListener('change', () => { scelta = r.dateInGara[+el.value]; disegna(); });
      });
      box.querySelector('#leoTrAnnulla').onclick = () => box.remove();
      box.querySelector('#leoTrVai').onclick = () => {
        box.remove();
        window.open(frammento(r, scelta), '_blank');
      };
    };

    disegna();
    document.body.appendChild(box);
  }

  /* ---------- trovare la richiesta nel riquadro di lettura ---------- */
  /* ---------- quale pezzo di testo si legge ----------
     v1.4.0 — Caso vero: una mail a catena, con firma, informativa
     privacy e due messaggi precedenti citati. Il criterio di prima —
     «l'elemento visibile piu' piccolo che nomina il taxi» — sceglieva
     un punto elenco («Bieten Sie die Moglichkeit, ein Sammel-Taxi zu
     buchen?»): dentro c'era il luogo, e nient'altro. Data, ora e
     persone stavano una riga piu' su.

     Il piu' piccolo non e' il migliore: il migliore e' quello che
     risponde a piu' domande. Ogni blocco candidato viene provato
     davvero, e vince quello da cui si ricava di piu'; a parita', il
     piu' corto. E prima si tolgono le parti che non sono la richiesta:
     la storia citata sotto e il piede del messaggio. */

  /* v1.5.0 — LA CORREZIONE DELLA CORREZIONE.
     La versione di prima tagliava tutto da «Da:» in giu'. In Outlook
     pero' l'intestazione «Da: / Inviato: / A: / Oggetto:» sta in CIMA
     anche quando il messaggio non e' citato: e' quella del messaggio
     che stai leggendo. Risultato dal vivo: mail buttata via intera e
     nessun pulsante. Stesso errore del piede, fatto due volte.

     Ora le righe di intestazione si tolgono UNA A UNA — cosi' sparisce
     anche «Inviato: lunedi' 6 luglio 2026 17:05», che e' una data che
     non c'entra niente con la corsa — e si taglia solo davanti ai
     segni inequivocabili di un messaggio precedente. */
  const RIGHE_INTESTAZIONE =
    /^\s*(?:Da|Von|From|A|An|To|Cc|Ccn|Bcc|Oggetto|Betreff|Subject|Inviato|Inviata|Gesendet|Sent|Data|Datum\s+dell)\s*:/i;

  function senzaCitato(t) {
    const tagli = [
      /\n\s*-{3,}\s*(?:Original|Messaggio originale|Urspr)/i,
      /\n\s*Il giorno .{0,60}ha scritto\s*:/i,
      /\n\s*Am .{0,60}schrieb\s/i,
      /\n\s*On .{0,60}wrote\s*:/i
    ];
    let fine = t.length;
    for (const re of tagli) {
      const m = t.match(re);
      if (m && m.index < fine) fine = m.index;
    }
    return t.slice(0, fine)
      .split('\n').filter(r => !RIGHE_INTESTAZIONE.test(r)).join('\n');
  }

  /* Il piede: partita IVA, PEC, «Prima di stampare», informativa privacy.
     Il test ha mostrato che tagliare da li' in giu' non va: nel riquadro
     di lettura di Outlook la firma compare anche SOPRA la richiesta,
     perche' e' quella del messaggio precedente. Tagliando si sarebbe
     buttata via tutta la mail. Si tolgono le righe, non la coda. */
  const RIGHE_PIEDE = /^\s*(?:P\.\s?IVA|C\.F\.|SDI\s*:|PEC\s*:|Prima di stampare|Think before you print|Messaggio riservato|This message is confidential|\+39[\d\s|]+PEC)/i;
  function senzaPiede(t) {
    return String(t).split('\n').filter(r => !RIGHE_PIEDE.test(r)).join('\n');
  }

  const ripulisci = (t) => senzaPiede(senzaCitato(String(t || '')));

  /* quante delle cose che servono si ricavano da questo testo */
  function punteggio(t) {
    const date = trovaDate(t);
    return (date.length ? 2 : 0) + (trovaOra(t) ? 2 : 0) +
           (riconosciLuogo(t) ? 1 : 0) + (trovaPax(t) ? 1 : 0) +
           (trovaVerso(t) ? 1 : 0);
  }

  let ultimoBlocco = null;   // per guardarlo dalla console

  function testoLettura() {
    const area = document.querySelector('div[role="main"]') || document.body;
    const visti = [];
    for (const e of area.querySelectorAll('div, td, p')) {
      const grezzo = e.innerText || '';
      if (grezzo.length < 60 || grezzo.length > 6000) continue;
      if (!RICHIESTA.test(grezzo)) continue;
      if (!(e.offsetParent || e.getClientRects?.().length)) continue;
      const t = ripulisci(grezzo);
      if (t.length < 40) continue;
      visti.push({ t, punti: punteggio(t), lung: t.length });
    }
    if (!visti.length) {
      ultimoBlocco = { t: ripulisci(area.innerText || ''), punti: null, quanti: 0 };
      return ultimoBlocco.t;
    }
    visti.sort((a, b) => (b.punti - a.punti) || (a.lung - b.lung));
    ultimoBlocco = { ...visti[0], quanti: visti.length, scartati: visti.slice(1, 4) };
    return visti[0].t;
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
  function mostraPulsante() {
    if (document.getElementById(ID_BTN)) return;
    const r = leggiRichiesta(testoLettura());
    if (!r) return;
    const b = document.createElement('button');
    b.id = ID_BTN;
    b.textContent = '\u{1F695} Prepara transfer ATAM';
    /* la posizione la decide impilaPulsanti(): scritta a mano finiva a
       118px, quattro pixel sotto il Day Spa (122), e i due si
       sovrapponevano su una mail che era insieme transfer e Day Spa */
    b.style.cssText =
      'position:fixed;right:24px;z-index:2147483647;' +
      'padding:12px 20px;border:0;border-radius:8px;cursor:pointer;' +
      'font:600 14px/18px Arial,Helvetica,sans-serif;color:#fff;' +
      'background:#C97B2C;box-shadow:0 3px 12px rgba(0,0,0,.3);';
    b.dataset.leoPulsante = '1';
    b.onclick = () => mostraAnteprima(leggiRichiesta(testoLettura()) || r);
    document.body.appendChild(b);
    impilaPulsanti();
  }

  function via() {
    const attuale = testoLettura().slice(0, 300);
    let ultimo = null;
    setInterval(() => {
      const ora = testoLettura().slice(0, 300);
      if (ora !== ultimo) {
        ultimo = ora;
        document.getElementById(ID_BTN)?.remove();
        document.getElementById(ID_ANT)?.remove();
      }
      mostraPulsante();
    }, 1500);
    void attuale;
  }

  if (typeof window !== 'undefined' && window.document) via();

  /* aggancio per la console e per i test */
  (typeof self !== 'undefined' ? self : globalThis).__leonardoTransfer = {
    leggiRichiesta, riconosciLuogo, trovaDate, dataProbabile, trovaOra,
    trovaPax, trovaVolo, trovaVerso, trovaNomi, trovaCollettivo, classifica,
    haOraVicina, frammento, piatto, iso,
    senzaCitato, senzaPiede, ripulisci, punteggio, testoLettura,
    /* __leonardoTransfer.blocco() dice quale pezzo di mail e' stato letto
       e quali sono stati scartati: senza questo si tira a indovinare */
    blocco: () => ultimoBlocco
  };
})();
