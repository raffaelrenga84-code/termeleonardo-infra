/* ============================================================
   Offerta Leonardo — Disponibilità e prezzi (v1.3)
   ------------------------------------------------------------
   Pannello dentro Fidra che risponde alle due domande che il
   gestionale lascia scoperte:
     1) QUALI camere sono libere (Fidra mostra solo le quantità:
        se l'ospite chiede la 413 fix, il numero non si vede);
     2) QUANTO costa davvero, incluso l'uso singola e i bambini
        per età, che nel modulo vanno messi a mano.
   I dati vengono dalle stesse API che alimentano il motore del
   sito: /api/available/rooms e /api/available/rates.
   Girando dentro la pagina di Fidra la sessione è già valida:
   nessuna chiave, nessun dato che esce da qui.
   ============================================================ */
(() => {
  /* da segnalibro può partire ovunque: si lavora solo dentro Fidra */
  if (location.hostname !== 'leonardo.fidra.cloud') {
    alert('Questo strumento funziona dentro Fidra: apri leonardo.fidra.cloud (loggato) e riclicca il segnalibro.');
    return;
  }
  /* estensione o segnalibro? Nel segnalibro chrome.storage non esiste */
  const ESTENSIONE = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local);

  const ACCESSIBILI = /accessibil/i;
  const FITTIZIA = /fittizi/i;

  const euro = (cent) => (cent / 100).toLocaleString('it-IT',
    { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const CHIAVE_SUPPL = 'leonardo_uso_singola';

  /* Il supplemento uso singola di Fidra è spesso vecchio (per la Queen il
     listino dice 25 €, Fidra 15): qui si può correggere per categoria e la
     correzione resta. Nell'estensione va in chrome.storage, da segnalibro
     in localStorage. */
  async function leggiSupplementi() {
    try {
      if (ESTENSIONE) {
        const r = await chrome.storage.local.get([CHIAVE_SUPPL]);
        return r[CHIAVE_SUPPL] || {};
      }
      return JSON.parse(localStorage.getItem(CHIAVE_SUPPL) || '{}');
    } catch (e) { return {}; }
  }
  async function salvaSupplementi(mappa) {
    try {
      if (ESTENSIONE) await chrome.storage.local.set({ [CHIAVE_SUPPL]: mappa });
      else localStorage.setItem(CHIAVE_SUPPL, JSON.stringify(mappa));
    } catch (e) {}
  }
  let SUPPL = {};   // categoria → euro a notte (in centesimi)

  /* ============================================================
     v1.9.4 — SUPPLEMENTI LEGATI ALLA TARIFFA
     Il supplemento uso singola non dipende solo dalla categoria: su
     alcune offerte a periodo vale di piu'. Sulla Queen la November
     Spezial e la Februar Spezial chiedono 25 € a notte, mentre il
     Dolce Vita valido tutto l'anno resta a 15.
     Si guarda il NOME della tariffa, non le date: se l'ospite anticipa
     o prolunga, le notti in piu' hanno un'altra tariffa e quindi
     tornano da sole a 15, che e' proprio il comportamento voluto.
     Per aggiungere un'eccezione basta una riga qui sotto.
     ============================================================ */
  const SUPPL_ECCEZIONI = [
    { categoria: /queen/i, tariffa: /spezial/i, centesimi: 2500,
      nota: 'offerta Spezial: uso singola 25 € invece di 15 €' }
  ];

  /* Il reparto fanghi chiude d'estate: un Dolce Vita in quelle settimane
     non si può fare, e conviene accorgersene qui invece che dopo aver
     mandato l'offerta. Le date vanno aggiornate ogni anno. */
  const CHIUSURE_CURE = [
    { da: '2026-07-18', a: '2026-08-09', motivo: 'reparto fanghi chiuso' }
  ];

  function chiusuraCure(arrivo, partenza) {
    for (const c of CHIUSURE_CURE) {
      if (arrivo < c.a && partenza > c.da) return c;   // i periodi si sovrappongono
    }
    return null;
  }

  /* ============================================================
     v2.2.5 — QUALI TARIFFE VANNO A SETTIMANE
     Il riconoscimento cercava le parole "Dolce Vita", ma in Fidra le
     offerte a periodo si chiamano "Spezial 5 cure" e basta: venivano
     trattate come tariffa del giorno, con il prezzo di listino ignorato
     e il supplemento sbagliato (116 invece di 126 sulla Queen).
     Ora conta la sostanza: una tariffa con cure comprese e un nome che
     parla di Dolce Vita o di Spezial e' un pacchetto settimanale.
     ============================================================ */
  const RE_SETTIMANALE = /dolce\s*vita|spezial|special/i;
  function eSettimanale(variazione) {
    if (!variazione) return false;
    if (!((variazione.items_total_price || 0) > 0)) return false;   // senza cure non e' un pacchetto
    return RE_SETTIMANALE.test(variazione.full_name || variazione.name || '');
  }

  function supplPerTariffa(nomeCategoria, nomeTariffa, predefinito) {
    for (const e of SUPPL_ECCEZIONI) {
      if (e.categoria.test(nomeCategoria || '') && e.tariffa.test(nomeTariffa || '')) {
        return { centesimi: e.centesimi, nota: e.nota };
      }
    }
    return { centesimi: predefinito, nota: null };
  }

  const oggiISO = () => new Date().toISOString().slice(0, 10);
  const piuGiorni = (iso, n) => {
    const d = new Date(iso + 'T12:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const notti = (a, p) => Math.round((new Date(p + 'T12:00') - new Date(a + 'T12:00')) / 86400000);
  const dataIT = (iso) => {
    const M = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio',
               'agosto','settembre','ottobre','novembre','dicembre'];
    const d = new Date(iso + 'T12:00');
    return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear()}`;
  };

  /* ---------- stile ---------- */
  const CSS = `
  #leoDispWrap{position:fixed;top:18px;left:max(8px,calc(50vw - 470px));z-index:2147483646;
    font-family:Arial,Helvetica,sans-serif;}
  #leoDisp{background:#FAF8F4;color:#2A2E2B;width:min(940px,94vw);border-radius:10px;
    box-shadow:0 14px 48px rgba(0,0,0,.42);overflow:hidden;display:flex;flex-direction:column;
    max-height:calc(100vh - 36px);}
  #leoDisp .corpo{overflow:auto;}
  #leoDisp *{box-sizing:border-box;}
  #leoDisp .testa{background:#0F5C64;color:#fff;padding:13px 20px;display:flex;
    justify-content:space-between;align-items:center;cursor:move;user-select:none;}
  #leoDisp .testa h2{margin:0;font:normal 18px Georgia,'Times New Roman',serif;letter-spacing:.3px;}
  #leoDisp .chiudi{background:none;border:0;color:#fff;font-size:24px;cursor:pointer;line-height:1;}
  #leoDisp .corpo{padding:16px 20px 22px;}
  #leoDisp .filtri{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;
    background:#fff;border:1px solid #E9E2D5;border-radius:8px;padding:14px 16px;}
  #leoDisp label{display:block;font-size:11px;letter-spacing:.6px;text-transform:uppercase;
    color:#8C8578;margin-bottom:4px;}
  #leoDisp input[type=date],#leoDisp input[type=number],#leoDisp select{
    padding:8px 9px;border:1px solid #D8D2C4;border-radius:5px;font:14px Arial;color:#2A2E2B;background:#fff;}
  #leoDisp input[type=number]{width:74px;}
  #leoDisp .cerca{background:#E8751A;color:#fff;border:0;border-radius:5px;padding:10px 22px;
    font:600 14px Arial;cursor:pointer;}
  #leoDisp .cerca:disabled{background:#CFCABF;}
  #leoDisp .eta{display:flex;gap:6px;flex-wrap:wrap;}
  #leoDisp .eta input{width:58px;}
  #leoDisp .nota{font-size:12px;line-height:18px;color:#7B756A;padding-top:8px;}
  #leoDisp .cat{background:#fff;border:1px solid #E9E2D5;border-radius:8px;margin-top:12px;overflow:hidden;}
  #leoDisp .cat.vuota{opacity:.55;}
  #leoDisp .catTesta{display:flex;justify-content:space-between;align-items:baseline;gap:12px;
    padding:12px 16px;border-left:4px solid #1E7F88;}
  #leoDisp .cat.vuota .catTesta{border-left-color:#CFCABF;}
  #leoDisp .catNome{font:normal 17px Georgia,serif;}
  #leoDisp .catQta{font-size:13px;color:#7B756A;}
  #leoDisp .supp{width:56px;padding:2px 4px;border:1px solid #D8D2C4;border-radius:4px;
    font:13px Arial;color:#0F5C64;text-align:right;}
  #leoDisp .numeri{padding:0 16px 12px 20px;display:flex;gap:6px;flex-wrap:wrap;}
  #leoDisp .num{background:#E3F0F1;color:#0F5C64;border:1px solid #C7E0E3;border-radius:4px;
    padding:3px 9px;font:600 13px Arial;cursor:pointer;}
  #leoDisp .num:hover{background:#0F5C64;color:#fff;}
  #leoDisp .num.acc{background:#F4EFE3;color:#8C7A45;border-color:#E2D6B8;}
  #leoDisp table{width:100%;border-collapse:collapse;font-size:13.5px;}
  #leoDisp th{background:#F4F1EA;color:#0F5C64;text-align:left;font-weight:600;
    padding:7px 16px;font-size:11px;letter-spacing:.6px;text-transform:uppercase;}
  #leoDisp td{padding:8px 16px;border-top:1px solid #F0EBE1;vertical-align:top;}
  #leoDisp td.pr{text-align:right;white-space:nowrap;}
  #leoDisp .tot{font-weight:600;color:#0F5C64;}
  #leoDisp .usa{background:none;border:1px solid #1E7F88;color:#1E7F88;border-radius:4px;
    padding:4px 10px;font:13px Arial;cursor:pointer;white-space:nowrap;}
  #leoDisp .usa:hover{background:#1E7F88;color:#fff;}
  #leoDisp .avviso{background:#FFF6E8;border-left:4px solid #E8751A;padding:10px 14px;
    border-radius:0 6px 6px 0;font-size:13px;line-height:20px;color:#6B4A22;margin-top:12px;}
  #leoDisp .esito{font-size:13px;color:#0F5C64;min-height:18px;padding-top:8px;}
  /* v2.9.1 — il preventivo si chiude qui dentro: era l'azione finale
     travestita da pulsante secondario, e non la trovava nessuno. */
  #leoDisp .prevBarra{position:sticky;bottom:0;z-index:3;background:#FFF6E8;
    border-top:2px solid #E8751A;padding:12px 16px;font:13px Arial;color:#6B4A22;}
  #leoDisp .prevRiga{display:flex;gap:10px;align-items:center;flex-wrap:wrap;}
  #leoDisp .prevBarra input[type=text]{border:1px solid #D8CFBE;border-radius:4px;
    padding:6px 8px;font:13px Arial;min-width:150px;}
  #leoDisp .prevBarra label{display:inline-flex;align-items:center;gap:4px;cursor:pointer;}
  #leoDisp .prevVai{background:#E8751A;color:#fff;border:0;border-radius:6px;
    padding:11px 20px;font:600 14px Arial;cursor:pointer;white-space:nowrap;}
  #leoDisp .prevVai:hover{background:#CF6414;}
  #leoDisp .prevVai:disabled{background:#CFCABF;cursor:default;}
  #leoDispBtn{position:fixed;bottom:76px;right:24px;z-index:2147483645;padding:12px 20px;
    border:0;border-radius:8px;cursor:pointer;font:600 14px Arial;color:#fff;background:#1E7F88;
    box-shadow:0 3px 12px rgba(0,0,0,.3);}`;

  function stile() {
    if (document.getElementById('leoDispCss')) return;
    const s = document.createElement('style');
    s.id = 'leoDispCss';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ---------- dati ---------- */
  async function chiedi(percorso) {
    const r = await fetch(percorso, { credentials: 'same-origin', headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error('Fidra ha risposto ' + r.status);
    return r.json();
  }

  const piuUnGiorno = (iso, quanti) => {
    const d = new Date(iso + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + quanti);
    return d.toISOString().slice(0, 10);
  };

  async function cerca(arrivo, partenza) {
    const q = `from_date=${arrivo}&to_date=${partenza}`;
    /* v2.12.0 — le camere si chiedono con un giorno in piu' da ogni lato.
       Serve a sapere se la notte PRIMA dell'arrivo e quella DEL giorno di
       partenza sono occupate: e' l'unico modo per dire se una camera si
       incastra con chi c'e' gia' o se lascia un buco. Le tariffe restano
       sul periodo vero — allargarle darebbe prezzi di giorni che non
       riguardano questo soggiorno. */
    const qLargo = `from_date=${piuUnGiorno(arrivo, -1)}&to_date=${piuUnGiorno(partenza, 1)}`;
    const [camere, tariffe] = await Promise.all([
      chiedi(`/api/available/rooms?${qLargo}&all=1`),
      chiedi(`/api/available/rates?${q}`)
    ]);
    /* le notti VERE del soggiorno: stay_days ora comprende anche i due
       giorni in piu', e usarlo direbbe occupata una camera libera */
    const notti = [];
    for (let g = arrivo; g < partenza; g = piuUnGiorno(g, 1)) notti.push(g);
    camere.nottiRichieste = notti;
    camere.nottePrima = piuUnGiorno(arrivo, -1);
    camere.nottePartenza = partenza;
    return { camere, tariffe };
  }

  /* ============================================================
     v2.12.0 — COME SI INCASTRA UNA CAMERA
     ------------------------------------------------------------
     Una camera libera non vale l'altra. Se il giorno dell'arrivo
     qualcuno parte da quella stanza, e il giorno della partenza ne
     arriva un altro, il soggiorno si infila fra due prenotazioni
     senza lasciare notti vuote: e' la camera che rende di piu'.
     Se attacca da un lato solo va comunque bene; se non attacca da
     nessuno, apre un buco che poi bisogna riempire.

     Si legge dalle notti occupate che l'API restituisce gia':
     · notte PRIMA dell'arrivo occupata  → qualcuno parte quel giorno
     · notte DEL giorno di partenza occupata → qualcuno arriva
     ============================================================ */
  function incastro(camera, camere) {
    const occupate = new Set((camera.unavailability || []).map(u => u.date));
    const inArrivo = occupate.has(camere.nottePrima);      // parte qualcuno
    const inPartenza = occupate.has(camere.nottePartenza); // arriva qualcuno
    if (inArrivo && inPartenza) return 'pieno';
    if (inArrivo || inPartenza) return 'mezzo';
    return 'isolato';
  }

  /* camere libere per l'intero periodo, raggruppate per categoria */
  function libere(camere) {
    const giorni = camere.nottiRichieste || camere.stay_days || [];
    const per = new Map();
    for (const c of camere.rooms || []) {
      const nome = (c.room_category || {}).name || '—';
      if (FITTIZIA.test(nome)) continue;
      const occupata = (c.unavailability || []).some(u => giorni.includes(u.date));
      if (!per.has(nome)) per.set(nome, { libere: [], totali: 0, categoria: c.room_category, incastri: {} });
      const v = per.get(nome);
      v.totali++;
      if (!occupata) {
        v.libere.push(c.number);
        v.incastri[String(c.number)] = incastro(c, camere);
      }
    }
    for (const v of per.values()) v.libere.sort((a, b) => a - b);
    return per;
  }

  /* prezzo di una variazione tariffaria per l'occupazione richiesta */
  function calcola(variazione, categoria, adulti, etaBambini) {
    /* nei pacchetti (Dolce Vita, Golf...) il prezzo è spezzato: "total" è
       camera+pensione, "items_total_price" sono le cure. Il prezzo vero a
       persona è la somma: package_total quando c'è, altrimenti la somma. */
    const cure = variazione.items_total_price || 0;
    const perPersona = (variazione.package_total != null)
      ? variazione.package_total
      : (variazione.total || 0) + cure;
    const nNotti = (variazione.days || []).length;
    let bambini = 0;
    const dettaglioB = [];
    for (const eta of etaBambini) {
      let somma = 0;
      for (const g of variazione.days || []) {
        const v = (g.children || []).find(x => Number(x.age) === Number(eta));
        somma += v ? v.price : 0;
      }
      bambini += somma;
      dettaglioB.push({ eta, prezzo: somma });
    }
    const nome = (categoria && categoria.name) || '';
    const base = (SUPPL[nome] != null)
      ? SUPPL[nome]
      : ((categoria && categoria.single_occupancy_charge) || 0);
    /* v1.9.4: certe tariffe hanno un supplemento proprio */
    const ecc = supplPerTariffa(nome, (variazione && (variazione.full_name || variazione.name)) || '', base);
    const perNotte = ecc.centesimi;
    const suppl = (adulti === 1 && perNotte) ? perNotte * nNotti : 0;
    const supplCorretto = SUPPL[nome] != null &&
      SUPPL[nome] !== ((categoria && categoria.single_occupancy_charge) || 0);
    return {
      perPersona, nNotti, bambini, dettaglioB, suppl, cure, perNotte, supplCorretto,
      supplNota: ecc.nota,
      totale: perPersona * adulti + bambini + suppl
    };
  }

  /* ============================================================
     PACCHETTI A SETTIMANE (Dolce Vita)
     Il pacchetto copre settimane intere; i giorni in più vanno a
     tariffa normale. Fidra non lo scorpora: chiede il prezzo notte
     per notte, e finora si faceva a mano. Qui si calcola.
     Prezzi dal listino Dolce Vita (a persona, al giorno).
     La riga Queen del listino ("Einzelzimmer Queen") è già il prezzo
     in uso singola: 130 in Werbesaison, 126 in Spezial. Verificato
     contro la prenotazione Boos, dove le notti del pacchetto furono
     inserite a mano proprio a 130.
     ============================================================ */
  /* ============================================================
     LISTINO DEI PACCHETTI (prezzo a notte, a persona)
     ------------------------------------------------------------
     v1.9.6 — il listino cartaceo scrive la Queen come "Einzelzimmer
     Queen (101+25)": quel 126 vale in USO SINGOLA e comprende gia' il
     supplemento. Usarlo anche con due persone gonfiava il prezzo di
     25 € a testa per notte. Ora le due cifre sono separate: `cent` e'
     il prezzo a persona, `singola` quello quando la camera e'
     occupata da uno solo.
     Le righe senza `singola` prendono il supplemento della categoria
     come sempre.
     ============================================================ */
  /* Kurpaket: il pacchetto cure che si somma alle sette notti. Il listino
     lo dà a 398 € a persona per cinque cure — con dieci raddoppia (796 €,
     come nella 18968). Serve a controllare che i totali tornino: se l'API
     dà un valore molto diverso, il pannello lo segnala invece di far
     passare un prezzo storto. */
  const KURPAKET_5_CURE = 39800;

  /* ============================================================
     v2.21.0 — LA QUEEN, NEL DOLCE VITA, SI VENDE SOLO IN USO SINGOLA.
     ------------------------------------------------------------
     Qui c'era un prezzo «a persona» anche per la Queen: 115 in
     Werbesaison, 101 in Spezial. Il primo non compare da nessuna parte
     nel listino; il secondo compare solo dentro il conto «(101+25)», che
     e' il modo in cui il listino spiega come si arriva ai 126 dell'uso
     singola — non una tariffa che si vende.

     La riga del listino, in tutte e due le stagioni, si chiama
     «Einzelzimmer Queen»: camera singola. Con questi pacchetti la Queen
     entra soltanto cosi'.

     Percio' `soloSingola` non e' un dettaglio tecnico: dice che per due
     persone quel prodotto NON ESISTE, e un prezzo inventato per un
     prodotto che non esiste e' peggio di un prezzo sbagliato — perche'
     non c'e' nessun listino con cui smentirlo. Quando capita, il prezzo
     si prende da Fidra e il riquadro dice da dove viene.
     ============================================================ */
  const LISTINO_PACCHETTI = {
    werbesaison: {
      etichetta: 'Werbesaison',
      periodi: [['2026-03-07', '2026-06-13'], ['2026-06-27', '2026-11-07']],
      camere: { 'Doppia': 11500, 'Doppia Superior': 11500,
                'Matrimoniale Queen': { singola: 13000, soloSingola: true },
                'Junior Suite': 12600, 'Junior Suite Abano': 12600, 'Junior Suite Colli Euganei': 12600,
                'Suite': 13600, 'Suite Colli Euganei': 13600, 'Suite Monteortone': 13600 }
    },
    spezial: {
      etichetta: 'Spezial',
      periodi: [['2026-02-14', '2026-03-07'], ['2026-06-13', '2026-06-27'], ['2026-11-07', '2026-11-29']],
      /* i 126 dell'uso singola il listino li scrive «(101+25)»: 101 e' la
         base del conto, non una tariffa per due — la Queen in due, con
         questo pacchetto, non si vende */
      camere: { 'Doppia': 11200, 'Doppia Superior': 11200,
                'Matrimoniale Queen': { singola: 12600, soloSingola: true },
                'Junior Suite': 12200, 'Junior Suite Abano': 12200, 'Junior Suite Colli Euganei': 12200,
                'Suite': 13100, 'Suite Colli Euganei': 13100, 'Suite Monteortone': 13100 }
    }
  };

  /* ============================================================
     v2.20.0 — IL CONFINE FRA LE STAGIONI, E DUE PREZZI SBAGLIATI.
     ------------------------------------------------------------
     Segnalato dalla proprieta' sulla 19242: soggiorno dal 7 al 15
     novembre, il pannello diceva «pacchetto a 115,00 € a notte
     (listino Werbesaison)» e la reception aveva gia' scritto 112 a
     mano. Il listino cartaceo da' novembre allo Spezial.

     LA CAUSA NON ERA UNA CIFRA: le due stagioni CONDIVIDONO le date
     di confine — il Dolce Vita comincia di sabato e finisce di
     sabato, quindi il giorno in cui una finisce e' lo stesso in cui
     l'altra comincia. Con gli estremi tutti e due compresi, quel
     giorno cadeva in tutt'e due gli intervalli, e vinceva quello
     dichiarato per primo nell'oggetto: sempre la Werbesaison.

     Su quattro confini due erano sbagliati — il 13 giugno e il 7
     novembre — e tutti e due IN ECCESSO: 115 invece di 112, cioe' 21 €
     a persona su una settimana, scritti in un'offerta.

     LA REGOLA GIUSTA: chi COMINCIA batte chi finisce. Si ottiene
     escludendo la data finale, che e' il giorno di partenza, non un
     giorno di arrivo. Cosi' il 29 novembre — giorno in cui l'hotel
     chiude — smette anche di risultare prenotabile.
     ============================================================ */
  function stagionePacchetto(iso) {
    for (const [chiave, s] of Object.entries(LISTINO_PACCHETTI))
      for (const [da, a] of s.periodi) if (iso >= da && iso < a) return chiave;
    return null;
  }

  /* prezzo del pacchetto a notte per questa camera, se il listino lo conosce */
  function prezzoPacchetto(nomeCategoria, arrivo, adulti) {
    const st = stagionePacchetto(arrivo);
    if (!st) return null;
    const tab = LISTINO_PACCHETTI[st].camere;
    const chiave = Object.keys(tab).find(k => k.toLowerCase() === String(nomeCategoria).toLowerCase());
    if (!chiave) return null;
    const v = tab[chiave];
    const dettagliato = (v && typeof v === 'object');
    /* la Queen, con questi pacchetti, si vende solo in uso singola: per
       due persone non c'e' un prezzo da dare, e inventarlo sarebbe peggio
       che non darlo. Si dice com'e' stanno le cose e il prezzo lo mette
       Fidra, che sa cosa sta vendendo davvero. */
    if (dettagliato && v.soloSingola && adulti !== 1) {
      return { cent: null, soloSingola: true, stagione: LISTINO_PACCHETTI[st].etichetta };
    }
    const cent = dettagliato
      ? ((adulti === 1 && v.singola != null) ? v.singola : v.cent)
      : v;
    if (cent == null) return null;
    return {
      cent,
      stagione: LISTINO_PACCHETTI[st].etichetta,
      /* con la cifra da listino il supplemento e' gia' dentro: non va
         aggiunto una seconda volta */
      singolaInclusa: dettagliato && adulti === 1 && v.singola != null
    };
  }

  /* ============================================================
     v2.2 — DOVE COMINCIA IL PACCHETTO
     Il Dolce Vita si vende a settimane e parte di sabato o domenica.
     La regola, come si applica in reception:
     · soggiorno di 7 o 14 notti esatte → tutto pacchetto, qualunque sia
       il giorno di arrivo;
     · soggiorno piu' lungo e arrivo di sabato o domenica → le settimane
       partono subito, le notti in piu' restano in coda;
     · soggiorno piu' lungo e arrivo infrasettimanale → le notti fino al
       primo sabato sono a tariffa del giorno, poi partono le settimane,
       e l'eventuale resto torna in coda.
     Prima le settimane venivano messe sempre all'inizio: su un arrivo di
     mercoledi' il conto era sbagliato.
     ============================================================ */
  function pianoPacchetto(arrivo, nNotti) {
    const settimane = Math.floor(nNotti / 7);
    if (!settimane) return { inizio: 0, nPacchetto: 0 };
    if (nNotti % 7 === 0) return { inizio: 0, nPacchetto: nNotti };   // 7, 14, 21…

    const g = new Date(arrivo + 'T12:00').getDay();   // 0 domenica, 6 sabato
    if (g === 6 || g === 0) return { inizio: 0, nPacchetto: settimane * 7 };

    /* quante notti mancano al primo sabato */
    const alSabato = (6 - g + 7) % 7;
    const dopo = nNotti - alSabato;
    const sett2 = Math.floor(dopo / 7);
    if (sett2 < 1) return { inizio: 0, nPacchetto: settimane * 7 };   // non ci sta: si torna al vecchio
    return { inizio: alSabato, nPacchetto: sett2 * 7 };
  }

  /* scorporo: settimane a prezzo pacchetto, resto a tariffa normale */
  function scorpora(opz) {
    const { nNotti, nPacchetto, prezzoPacchettoCent, variazioneExtra, supplCent, adulti, arrivo,
            supplPacchCent, supplGiaIncluso, inizioPacchetto = 0 } = opz;
    /* v1.9.7: sulle notti del pacchetto l'uso singola va aggiunto, perche'
       ne' Fidra ne' il listino lo applicano da soli — tranne per la Queen,
       dove il listino scrive gia' la cifra comprensiva ("101+25"). La
       Junior Suite, per esempio, ha il suo supplemento di sempre e va
       sommato: 122 + 60. */
    const supplSuPacchetto = (adulti === 1 && !supplGiaIncluso) ? (supplPacchCent || 0) : 0;
    const notti = [];
    const giorniExtra = (variazioneExtra && variazioneExtra.days) || [];
    for (let i = 0; i < nNotti; i++) {
      const d = new Date(arrivo + 'T12:00'); d.setDate(d.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      if (i >= inizioPacchetto && i < inizioPacchetto + nPacchetto) {
        notti.push({ iso, cent: prezzoPacchettoCent + supplSuPacchetto, etichetta: 'pacchetto' });
      } else {
        /* la notte extra costa la tariffa del giorno più l'uso singola */
        const g = giorniExtra.find(x => (x.for_date || x.date) === iso) || giorniExtra[i] || null;
        const base = g ? (g.price || 0) : 0;
        notti.push({ iso, cent: base + (adulti === 1 ? supplCent : 0), etichetta: 'extra' });
      }
    }
    const pernottamento = notti.reduce((s, n) => s + n.cent, 0);
    return { notti, nNotti, nPacchetto, inizioPacchetto, nExtra: nNotti - nPacchetto, pernottamento };
  }

  /* la finestra si sposta prendendola dalla barra del titolo, così si
     affianca alla pagina di Fidra per confrontare i numeri */
  function rendiTrascinabile(scatola, maniglia) {
    let giu = false, sx = 0, sy = 0, ox = 0, oy = 0;
    maniglia.addEventListener('mousedown', ev => {
      if (ev.target.closest('button')) return;
      giu = true; sx = ev.clientX; sy = ev.clientY;
      const r = scatola.getBoundingClientRect(); ox = r.left; oy = r.top;
      ev.preventDefault();
    });
    window.addEventListener('mousemove', ev => {
      if (!giu) return;
      scatola.style.left = Math.max(-200, ox + ev.clientX - sx) + 'px';
      scatola.style.top = Math.max(0, oy + ev.clientY - sy) + 'px';
      scatola.style.right = 'auto';
    });
    window.addEventListener('mouseup', () => { giu = false; });
  }

  /* ---------- interfaccia ---------- */
  /* ============================================================
     v1.7.9 — PRECOMPILAZIONE DALLA PRENOTAZIONE APERTA
     Se il pannello viene aperto da dentro una prenotazione, date,
     occupazione e categoria si leggono dalla pagina invece di
     ripartire da oggi + 3 notti.
     ============================================================ */
  const MESI3 = { Jan:1, Feb:2, Mar:3, Apr:4, May:5, Jun:6, Jul:7, Aug:8, Sep:9, Oct:10, Nov:11, Dec:12,
                  Gen:1, Mag:5, Giu:6, Lug:7, Ago:8, Set:9, Ott:10, Dic:12 };

  function datiPrenotazione() {
    if (!/\/reservations\/\d+/.test(location.pathname)) return null;
    const testo = document.body.innerText || '';
    /* "2 Notti dal 17 - 19 Aug" oppure "5 Notti dal 30 Aug - 2 Sep" */
    const m = testo.match(/(\d+)\s+Notti\s+dal\s+(\d{1,2})\s*([A-Za-z]{3})?\s*-\s*(\d{1,2})\s+([A-Za-z]{3})/);
    if (!m) return null;
    const mesePart = MESI3[m[5]], meseArr = MESI3[m[3]] || mesePart;
    if (!meseArr || !mesePart) return null;
    /* l'anno non sta accanto al periodo: si prende quello che rende la data
       più vicina a oggi, così funziona anche a cavallo di Capodanno */
    const oggi = new Date(); oggi.setHours(12, 0, 0, 0);
    let anno = oggi.getFullYear(), migliore = null;
    for (const a of [anno - 1, anno, anno + 1]) {
      const d = new Date(a, meseArr - 1, +m[2], 12);
      const scarto = Math.abs(d - oggi);
      if (!migliore || scarto < migliore.scarto) migliore = { a, scarto };
    }
    anno = migliore.a;
    const annoPart = mesePart < meseArr ? anno + 1 : anno;   // dicembre → gennaio
    const iso = (a, me, g) => `${a}-${String(me).padStart(2,'0')}-${String(g).padStart(2,'0')}`;
    const occ = testo.match(/in totale\s+(\d+)\s+Adulti\s+e\s+(\d+)\s+Bambini/i);
    /* "Caparra Disponibile 1.191,00 € di 1.191,00 €": il primo importo è
       quanto l'ospite ha effettivamente versato. Serve per il 3%, che si
       riconosce solo a chi ha saldato tutto. */
    const cap = testo.match(/Caparra\s+Disponibile\s+([\d.]*\d,\d{2})\s*€/i);
    const soldi = (x) => x ? Math.round(parseFloat(x.replace(/\./g, '').replace(',', '.')) * 100) : null;
    const eta = (testo.match(/Eta Bambini\s*([\d,\s]+)/) || [])[1];
    const rigaCat = testo.replace(/[^\S\n]*[^\w\s]*[^\S\n]*fix[^\S\n]*$/gim, '')
                         .match(/^(.+?)\s+n\.\s*(\d*)\s*$/m) || [];
    const cat = rigaCat[1];
    /* il trattamento è la riga che segue "Adulti n Bambini n [Eta Bambini …]" */
    const tratt = (testo.match(/Adulti\s+\d+\s+Bambini\s+\d+[^\n]*\n([^\n]+)/) || [])[1];

    /* ============================================================
       v1.9.0 — TUTTE le camere, ognuna con il SUO periodo.
       Una prenotazione può avere camere su periodi diversi (18968:
       la Doppia due notti, la Queen diciotto). Finora si leggeva
       solo la prima camera e il periodo globale, e il pannello
       lavorava su dati che non erano di nessuna delle due.
       Quando una camera ha date proprie, Fidra le scrive accanto al
       nome: "2 notti 02 - 04 Sep".
       ============================================================ */
    const L = testo.split('\n').map(x => x.trim()).filter(Boolean);
    const camere = [];
    L.forEach((riga, i) => {
      /* v2.2.6: come nell'estrattore, si scarta il "fix" della camera bloccata */
      const mc = riga.replace(/\s*[^\w\s]*\s*fix\s*$/i, '').trim()
                     .match(/^(.+?)\s+n\.\s*(\d*)(?:\s|$)/);
      if (!mc || /^(Notte|Nacht)\b/i.test(mc[1])) return;
      const blocco = L.slice(i, i + 10);
      const testoBlocco = blocco.join('\n');
      if (!/Adulti\s+\d+\s+Bambini/.test(testoBlocco)) return;   // non è una camera

      const mo = testoBlocco.match(/Adulti\s+(\d+)\s+Bambini\s+(\d+)/);
      const me2 = testoBlocco.match(/Eta Bambini\s*([\d,\s]+)/);
      const mt = testoBlocco.match(/Adulti\s+\d+\s+Bambini\s+\d+[^\n]*\n([^\n]+)/);
      const mpp = testoBlocco.match(/Totale\s+([\d.]*\d,\d{2})\s*€\s*p\.p\./i);

      /* Periodo proprio, scritto accanto al nome: "2 notti 02 - 04 Sep".
         v1.9.2: puo' non essere sulla riga subito successiva (in mezzo ci
         finisce "Opzioni" o altro), quindi si guardano le prime righe del
         blocco. Il periodo globale — "18 Notti dal 02 - 20 Sep" — non viene
         scambiato per uno di camera perche' ha "dal" tra le due parti. */
      let da = null, a2 = null;
      const mp = blocco.slice(0, 5).join(' ').match(
        /(\d+)\s+notti?\s+(\d{1,2})\s*([A-Za-z]{3})?\s*-\s*(\d{1,2})\s+([A-Za-z]{3})/i);
      if (mp) {
        const m2 = MESI3[mp[5]], m1 = MESI3[mp[3]] || m2;
        if (m1 && m2) {
          const an1 = anno, an2 = m2 < m1 ? anno + 1 : anno;
          da = iso(an1, m1, +mp[2]); a2 = iso(an2, m2, +mp[4]);
        }
      }
      camere.push({
        categoria: mc[1].trim(), numero: mc[2],
        adulti: mo ? +mo[1] : null, bambini: mo ? +mo[2] : null,
        etaBambini: ((me2 && me2[1]) || '').match(/\d+/g) || [],
        trattamento: mt ? mt[1].trim() : null,
        prezzoPP: mpp ? Math.round(parseFloat(mpp[1].replace(/\./g,'').replace(',','.')) * 100) : null,
        arrivo: da || iso(anno, meseArr, +m[2]),
        partenza: a2 || iso(annoPart, mesePart, +m[4]),
        periodoProprio: !!da
      });
    });

    return {
      camere,
      trattamento: tratt ? tratt.trim() : null,
      numeroCamera: rigaCat[2] || null,
      arrivo: iso(anno, meseArr, +m[2]),
      partenza: iso(annoPart, mesePart, +m[4]),
      adulti: occ ? +occ[1] : null,
      bambini: occ ? +occ[2] : null,
      etaBambini: (eta || '').match(/\d+/g) || [],
      categoria: cat ? cat.trim() : null,
      caparraCent: soldi(cap && cap[1])
    };
  }

  function apri() {
    if (document.getElementById('leoDispWrap')) return;
    stile();
    /* v2.9: le sistemazioni messe da parte per il preventivo. Vivono
       quanto il riquadro: chiuderlo e riaprirlo azzera la scelta, ed e'
       giusto — una selezione fatta su una ricerca non vale per la
       successiva, e riproporla sarebbe peggio che non averla. */
    const SCELTE = [];
    const MAX_SCELTE = 4;
    const wrap = document.createElement('div');
    wrap.id = 'leoDispWrap';
    const pren = datiPrenotazione();
    /* v1.9.0: con piu' camere si parte dalla prima e si cambia con le
       linguette qui sotto: ogni camera ha il suo periodo e la sua
       occupazione, e il pannello lavora su quelli. */
    const camPren = (pren && pren.camere && pren.camere.length) ? pren.camere : [];
    const primaCam = camPren[0] || null;
    const a = (primaCam && primaCam.arrivo) || (pren && pren.arrivo) || oggiISO();
    const p = (primaCam && primaCam.partenza) || (pren && pren.partenza) || piuGiorni(a, 3);
    const adInit = (primaCam && primaCam.adulti) || (pren && pren.adulti) || 2;
    const bamInit = (primaCam && primaCam.bambini) || (pren && pren.bambini) || 0;
    wrap.innerHTML = `<div id="leoDisp">
      <div class="testa">
        <h2>Disponibilit&agrave; e prezzi</h2>
        <button class="chiudi" id="leoDispX" title="Chiudi">&times;</button>
      </div>
      <div class="corpo">
        <div class="filtri">
          <div><label>Arrivo</label><input type="date" id="dArrivo" value="${a}" /></div>
          <div><label>Partenza</label><input type="date" id="dPartenza" value="${p}" /></div>
          <div><label>Adulti</label><input type="number" id="dAdulti" min="1" max="6" value="${adInit}" /></div>
          <div><label>Bambini</label><input type="number" id="dBambini" min="0" max="4" value="${bamInit}" /></div>
          <div style="flex-basis:100%;${camPren.length > 1 ? '' : 'display:none;'}">
            <label>Camere della prenotazione</label>
            <div id="dCamere" style="display:flex;gap:6px;flex-wrap:wrap;">
              ${camPren.map((c, i) => `<button type="button" class="lingCam" data-i="${i}"
                style="border:1px solid ${i === 0 ? '#B3261E' : '#CBD5D8'};background:${i === 0 ? '#FDF6F5' : '#fff'};
                       color:${i === 0 ? '#B3261E' : '#2A2E2B'};border-radius:14px;padding:4px 12px;
                       font:600 12.5px Arial;cursor:pointer;">
                ${esc(c.categoria)} n. ${esc(c.numero)}
                <span style="font-weight:normal;color:#8C8578;">&middot; ${c.arrivo.slice(8)}&ndash;${c.partenza.slice(8)}/${c.partenza.slice(5,7)}</span>
              </button>`).join('')}
            </div>
          </div>
          <div><label>Sconto pensione</label>
            <select id="dSconto">
              <option value="0">nessuno</option>
              <option value="5">5% fedelt&agrave; &mdash; si toglie dal prezzo</option>
              <option value="3">3% anticipo 2027 &mdash; reso alla partenza</option>
              <option value="53">5% + 3%</option>
            </select></div>
          <div id="dEtaBox" style="display:none;"><label>Et&agrave; dei bambini</label><div class="eta" id="dEta"></div></div>
          <button class="cerca" id="dCerca">Cerca</button>
        </div>
        <div class="esito" id="dEsito"></div>
        <div id="dRis"></div>
        <div id="dPrevBarra" class="prevBarra" style="display:none;"></div>
      </div>
    </div>`;
    document.body.appendChild(wrap);

    const $ = (id) => document.getElementById(id);
    $('leoDispX').onclick = () => wrap.remove();
    rendiTrascinabile(wrap, wrap.querySelector('.testa'));

    let etaIniziali = (pren && pren.etaBambini) || [];
    function campiEta() {
      const n = Math.max(0, Math.min(4, parseInt($('dBambini').value, 10) || 0));
      $('dEtaBox').style.display = n ? '' : 'none';
      const box = $('dEta');
      const vecchi = [...box.querySelectorAll('input')].map(i => i.value);
      box.innerHTML = '';
      for (let i = 0; i < n; i++) {
        const inp = document.createElement('input');
        inp.type = 'number'; inp.min = '0'; inp.max = '17';
        inp.value = vecchi[i] || etaIniziali[i] || '6';
        inp.title = 'et\u00e0 alla data del soggiorno';
        box.appendChild(inp);
      }
    }
    $('dBambini').addEventListener('input', campiEta);
    $('dSconto').addEventListener('change', () => { if ($('dRis').innerHTML.trim()) esegui(); });

    /* v1.9.0: la linguetta porta il pannello sulla camera scelta — periodo,
       occupazione, eta' dei bambini — e rilancia la ricerca. Cosi' una sola
       finestra basta per confrontare due camere con periodi diversi. */
    let camAttiva = camPren.length ? 0 : -1;
    function vaiACamera(i) {
      const c = camPren[i]; if (!c) return;
      camAttiva = i;
      $('dArrivo').value = c.arrivo;
      $('dPartenza').value = c.partenza;
      $('dAdulti').value = c.adulti || 2;
      $('dBambini').value = c.bambini || 0;
      etaIniziali = c.etaBambini || [];
      campiEta();
      document.querySelectorAll('#dCamere .lingCam').forEach((b, k) => {
        const suo = k === i;
        b.style.borderColor = suo ? '#B3261E' : '#CBD5D8';
        b.style.background  = suo ? '#FDF6F5' : '#fff';
        b.style.color       = suo ? '#B3261E' : '#2A2E2B';
      });
      esegui();
    }
    document.querySelectorAll('#dCamere .lingCam').forEach(b =>
      b.addEventListener('click', () => vaiACamera(+b.dataset.i)));
    $('dArrivo').addEventListener('change', () => {
      if ($('dPartenza').value <= $('dArrivo').value) $('dPartenza').value = piuGiorni($('dArrivo').value, 1);
    });
    $('dCerca').addEventListener('click', esegui);
    esegui();

    async function esegui() {
      const arrivo = $('dArrivo').value, partenza = $('dPartenza').value;
      const adulti = Math.max(1, parseInt($('dAdulti').value, 10) || 1);
      const etaBambini = [...$('dEta').querySelectorAll('input')].map(i => parseInt(i.value, 10) || 0);
      if (!arrivo || !partenza || notti(arrivo, partenza) < 1) {
        $('dEsito').textContent = 'La partenza deve essere dopo l\u2019arrivo.';
        return;
      }
      $('dCerca').disabled = true;
      $('dEsito').textContent = 'Chiedo a Fidra\u2026';
      SUPPL = await leggiSupplementi();
      $('dRis').innerHTML = '';
      try {
        const { camere, tariffe } = await cerca(arrivo, partenza);
        disegna(camere, tariffe, arrivo, partenza, adulti, etaBambini);
        const ch = chiusuraCure(arrivo, partenza);
        if (ch) {
          $('dEsito').innerHTML = `<span style="color:#B3261E;">In questo periodo il
            <strong>${ch.motivo}</strong> (${ch.da.slice(8)}/${ch.da.slice(5,7)} &ndash;
            ${ch.a.slice(8)}/${ch.a.slice(5,7)}): le tariffe con cure non sono utilizzabili.</span>`;
        } else {
          $('dEsito').textContent = '';
        }
      } catch (e) {
        $('dEsito').textContent = 'Non sono riuscito a leggere: ' + e.message +
          ' \u2014 controlla di essere ancora dentro Fidra.';
      } finally {
        $('dCerca').disabled = false;
      }
    }

    function disegna(camere, tariffe, arrivo, partenza, adulti, etaBambini) {
      const nNotti = notti(arrivo, partenza);
      const perCat = libere(camere);
      const tariffePerCat = new Map();
      for (const t of tariffe || []) tariffePerCat.set((t.room_category || {}).name, t);

      /* Le categorie senza nemmeno una camera libera non si mostrano: non
         servono a niente e allungano la lista.
         L'ordine segue l'occupazione richiesta: prima quelle che la ospitano
         con la capienza più vicina (1 persona → le singole in cima, 3 persone
         → le camere che tengono tre), poi quelle troppo piccole, e infine
         sempre le accessibili. */
      const ospiti = adulti + etaBambini.length;
      const punteggio = (nome) => {
        const cat = (perCat.get(nome) || {}).categoria || {};
        const cap = (cat.max_adults != null) ? cat.max_adults : null;
        const capB = (cat.max_children != null) ? cat.max_children : null;
        let gruppo;
        if (cap == null) gruppo = 2;                       // capienza ignota
        else if (cap >= ospiti) gruppo = 0;                // ci sta
        else gruppo = 3;                                   // troppo piccola
        /* con bambini al seguito, se la categoria non li accetta scende */
        if (gruppo === 0 && etaBambini.length && capB != null && capB < etaBambini.length) gruppo = 1;
        const scarto = (cap == null) ? 99 : Math.abs(cap - ospiti);
        return { accessibile: ACCESSIBILI.test(nome) ? 1 : 0, gruppo, scarto };
      };
      const nomi = [...perCat.keys()]
        .filter(n => perCat.get(n).libere.length)
        .sort((x, y) => {
          const a = punteggio(x), b = punteggio(y);
          if (a.accessibile !== b.accessibile) return a.accessibile - b.accessibile;
          if (a.gruppo !== b.gruppo) return a.gruppo - b.gruppo;
          if (a.scarto !== b.scarto) return a.scarto - b.scarto;
          return x.localeCompare(y);
        });

      if (!nomi.length) {
        $('dRis').innerHTML = `<div class="avviso">Nessuna camera libera per tutte le notti
          del periodo. Prova a spostare le date o a spezzare il soggiorno.</div>`;
        return;
      }

      let html = `<div class="nota">${dataIT(arrivo)} &rarr; ${dataIT(partenza)} &middot;
        ${nNotti} ${nNotti === 1 ? 'notte' : 'notti'} &middot; ${adulti} ${adulti === 1 ? 'adulto' : 'adulti'}${
        etaBambini.length ? ` &middot; ${etaBambini.length} ${etaBambini.length === 1 ? 'bambino' : 'bambini'} (${etaBambini.join(', ')} anni)` : ''}
        &middot; clicca un numero di camera per copiarlo</div>`;

      /* v1.8.2: la categoria, la camera e il trattamento della prenotazione
         aperta si segnano in rosso, per ritrovarli a colpo d'occhio tra le
         alternative. Confronto normalizzato: la pagina scrive in maiuscolo
         ("MIGLIOR PREZZO BED & BREAKFAST"), l'API in maiuscoletto. */
      const norm = (x) => (x || '').toLowerCase()
        .replace(/&/g, ' e ').replace(/[^a-z0-9]+/g, ' ')
        .replace(/\band\b/g, 'e').replace(/\s+/g, ' ').trim();
      const PREN = datiPrenotazione() || {};
      /* si evidenzia la camera su cui il pannello sta lavorando ora */
      const cAttiva = (PREN.camere || []).find(c =>
        c.arrivo === $('dArrivo').value && c.partenza === $('dPartenza').value) || (PREN.camere || [])[0] || {};
      const catPren = norm(cAttiva.categoria || PREN.categoria);
      const trattPren = norm(cAttiva.trattamento || PREN.trattamento);
      PREN.numeroCamera = cAttiva.numero || PREN.numeroCamera;
      const ROSSO = '#B3261E';

      for (const nome of nomi) {
        const v = perCat.get(nome);
        const suaCategoria = catPren && norm(nome) === catPren;
        const t = tariffePerCat.get(nome);
        const cat = v.categoria || {};
        const capienza = (cat.max_adults != null)
          ? `fino a ${cat.max_adults} ${cat.max_adults === 1 ? 'adulto' : 'adulti'}` : '';
        const troppoPiccola = cat.max_adults != null && adulti > cat.max_adults;

        html += `<div class="cat"${suaCategoria ? ` style="border-left:3px solid ${ROSSO};background:#FDF6F5;"` : ''}>
          <div class="catTesta">
            <div class="catNome">${esc(nome)}${ACCESSIBILI.test(nome) ? ' <span style="font-size:12px;color:#8C7A45;">(solo su richiesta)</span>' : ''}${
              suaCategoria ? ` <span style="font-size:11px;color:${ROSSO};border:1px solid ${ROSSO};border-radius:9px;padding:1px 7px;vertical-align:2px;">questa prenotazione</span>` : ''}</div>
            <div class="catQta">${v.libere.length} libere su ${v.totali}${capienza ? ' &middot; ' + capienza : ''}${
              adulti === 1 ? ` &middot; uso singola <input class="supp" data-cat="${esc(nome)}" type="number" min="0" step="1"
                 value="${(((SUPPL[nome] != null ? SUPPL[nome] : (cat.single_occupancy_charge || 0))) / 100).toFixed(0)}"
                 title="Euro a notte: correggilo se il listino dice altro, resta memorizzato" /> &euro;/notte` : ''}</div>
          </div>`;

        if (v.libere.length) {
          /* v2.10.0: le coppie comunicanti libere TUTTE E DUE. E' la cosa
             che serve quando una famiglia le chiede: sapere che la 319 e'
             libera non aiuta se la 320 e' occupata. Le sei coppie stanno in
             template.js, caricato anche qui. */
          const libere = new Set(v.libere.map(String));
          const coppieLibere = (typeof COMUNICANTI !== 'undefined' ? COMUNICANTI : [])
            .filter(([a, b]) => libere.has(a) && libere.has(b));
          const inCoppia = new Set(coppieLibere.flat());
          /* v2.12.0: il colore dice come si incastra con chi c'e' gia'.
             Verde = si infila fra due prenotazioni senza lasciare notti
             vuote; giallo = attacca da un lato; arancione = apre un buco.
             La camera di QUESTA pratica resta rossa: dire com'e' fatto
             l'incastro di una camera gia' assegnata non serve a scegliere. */
          const VESTE = {
            pieno:   { bordo: '#4A7A2E', testo: '#3B6325', sfondo: '#EEF6E8',
                       nota: 'si incastra perfettamente: quel giorno parte qualcuno e alla partenza ne arriva un altro' },
            mezzo:   { bordo: '#C9A227', testo: '#8A6D12', sfondo: '#FDF8E6',
                       nota: 'attacca da un lato solo' },
            isolato: { bordo: '#D08A3C', testo: '#9A5B18', sfondo: '#FDF1E6',
                       nota: 'non attacca con nessuna prenotazione: lascia notti vuote prima e dopo' }
          };
          const conteggio = { pieno: 0, mezzo: 0, isolato: 0 };
          html += `<div class="numeri">` + v.libere.map(n => {
            const chiave = String(n);
            const tipo = (v.incastri || {})[chiave] || 'isolato';
            conteggio[tipo]++;
            if (suaCategoria && chiave === String(PREN.numeroCamera)) {
              return `<button class="num${ACCESSIBILI.test(nome) ? ' acc' : ''}" data-num="${n}"
                style="border-color:${ROSSO};color:${ROSSO};font-weight:bold;"
                title="camera di questa prenotazione">${n}</button>`;
            }
            const veste = VESTE[tipo];
            const com = inCoppia.has(chiave);
            const titolo = veste.nota + (com ? ` · comunicante con la ${comunicanteDi(n)}, libera anche lei` : '');
            return `<button class="num${ACCESSIBILI.test(nome) ? ' acc' : ''}" data-num="${n}"
              style="border-color:${veste.bordo};color:${veste.testo};background:${veste.sfondo};"
              title="${esc(titolo)}">${n}${com ? ' &#8646;' : ''}</button>`;
          }).join('') + `</div>`;
          if (conteggio.pieno || conteggio.mezzo) {
            html += `<div class="nota" style="padding:0 16px 8px;font-size:12px;">
              <span style="color:#3B6325;">&#9632;</span> ${conteggio.pieno} si incastrano fra due prenotazioni
              &middot; <span style="color:#8A6D12;">&#9632;</span> ${conteggio.mezzo} attaccano da un lato
              &middot; <span style="color:#9A5B18;">&#9632;</span> ${conteggio.isolato} lasciano notti vuote</div>`;
          }
          if (coppieLibere.length) {
            html += `<div class="nota" style="padding:0 16px 8px;color:#4A5636;">
              Comunicanti libere: ${coppieLibere.map(([a, b]) => `<strong>${a}&ndash;${b}</strong>`).join(', ')}
              &middot; una porta interna collega le due camere.</div>`;
          }
        }

        const variazioni = [];
        for (const r of (t && t.rates) || []) for (const rv of r.rate_variations || []) variazioni.push(rv);

        if (v.libere.length && variazioni.length && !troppoPiccola) {
          html += `<table><tr><th>Trattamento</th><th style="text-align:right;">A persona</th>
            <th style="text-align:right;">Totale soggiorno</th><th></th></tr>`;
          const pctSconto = parseInt((document.getElementById('dSconto') || {}).value, 10) || 0;
          for (const rv of variazioni) {
            const c = calcola(rv, cat, adulti, etaBambini);
            /* v1.7.9 — sconto sulla quota di PENSIONE.
               Base scontabile: il totale meno cure e trattamenti (che non
               scontiamo mai). Nei pacchetti a settimane (Dolce Vita) la
               quota del pacchetto è esclusa: si sconta solo l'eventuale
               coda di notti fuori pacchetto, e il conto esatto sta nel
               riquadro "Notte per notte". */
            const cureTot = (c.cure || 0) * adulti;
            const pacchetto = (rv.items_total_price || 0) > 0 &&
                              RE_SETTIMANALE.test(rv.full_name || rv.name || '');
            const nSett = pacchetto ? Math.floor(c.nNotti / 7) * 7 : 0;
            const nFuori = c.nNotti - nSett;
            /* v1.8.0 — i due sconti NON sono la stessa cosa:
               · 5% fedeltà: si toglie subito dal prezzo, il cliente paga meno;
               · 3% anticipo 2027: il cliente paga il prezzo pieno e riceve
                 l'importo ALLA PARTENZA — non va sottratto dall'offerta.
               Perciò si calcolano e si mostrano separati. */
            let sconto = null;
            if (pctSconto) {
              const con5 = pctSconto === 5 || pctSconto === 53;
              const con3 = pctSconto === 3 || pctSconto === 53;
              let base, stima = false, dove = '';
              if (!pacchetto) {
                base = c.totale - cureTot; dove = 'sulla pensione';
              } else if (nFuori > 0) {
                base = Math.round((c.totale - cureTot) * nFuori / c.nNotti); stima = true;
                dove = `sulle ${nFuori} notti fuori pacchetto (stima: il conto esatto è in "Notte per notte")`;
              } else {
                base = 0; dove = 'pacchetto intero: la quota pacchetto non si sconta';
              }
              /* il 3% si calcola sulla pensione al netto del 5% già tolto */
              const imp5 = con5 ? Math.round(base * 5 / 100) : 0;
              const imp3 = con3 ? Math.round((base - imp5) * 3 / 100) : 0;
              sconto = { imp5, imp3, base, stima, dove, con5, con3 };
            }
            const extra = [];
            if (c.cure) extra.push(`di cui cure e trattamenti ${euro(c.cure)} &euro; a persona`);
            if (c.suppl) extra.push(`uso singola +${euro(c.suppl)} &euro; (${euro(c.perNotte)} &euro; a notte${
              c.supplNota ? `, <span style="color:#8C7A45;">${esc(c.supplNota)}</span>`
                          : (c.supplCorretto ? ', corretto da te' : '')})`);
            for (const b of c.dettaglioB) extra.push(`bambino ${b.eta} anni: ${b.prezzo ? euro(b.prezzo) + ' \u20ac' : 'gratuito'}`);
            const suoTrattamento = suaCategoria && trattPren &&
              norm(rv.full_name || rv.name) === trattPren;
            html += `<tr${suoTrattamento ? ` style="background:#FBEDEB;"` : ''}>
              <td>${suoTrattamento ? `<span style="color:${ROSSO};font-weight:bold;">${esc(rv.full_name || rv.name)}</span>
                <span style="font-size:11px;color:${ROSSO};">&larr; in offerta</span>` : esc(rv.full_name || rv.name)}${extra.length
                ? `<div style="font-size:12px;color:#8C8578;padding-top:2px;">${extra.join(' &middot; ')}</div>` : ''}</td>
              <td class="pr">${euro(c.perPersona)} &euro;</td>
              <td class="pr tot">${euro(c.totale)} &euro;${sconto ? `
                <div style="font-size:12px;font-weight:normal;padding-top:3px;">
                  ${sconto.con5 ? (sconto.imp5
                    ? `<div style="color:#5A7A3E;">5% fedelt&agrave; &minus;${euro(sconto.imp5)} &euro;
                        &rarr; <strong>${euro(c.totale - sconto.imp5)} &euro;</strong> da pagare</div>`
                    : `<div style="color:#8C8578;">5% fedelt&agrave;: non applicabile</div>`) : ''}
                  ${sconto.con3 ? (sconto.imp3
                    ? `<div style="color:#8C7A45;">3% anticipo 2027: <strong>${euro(sconto.imp3)} &euro;</strong>
                        resi alla partenza &mdash; non toglierli dall'offerta</div>`
                    : `<div style="color:#8C8578;">3% anticipo: non applicabile</div>`) : ''}
                  ${sconto.imp5 ? `<div style="color:#8C8578;">come extra in Fidra:
                    <strong style="color:#5A7A3E;">${euro(Math.round(sconto.imp5 / c.nNotti))} &euro;</strong>
                    al giorno per camera (&times; ${c.nNotti} ${c.nNotti === 1 ? 'notte' : 'notti'})</div>` : ''}
                  <div style="color:#8C8578;">${sconto.dove}</div>
                </div>` : ''}</td>
              <td class="pr">${
                `<button class="usa scorpora"
                  data-cat="${esc(nome)}" data-tratt="${esc(rv.full_name || rv.name)}"
                  data-idx="${variazioni.indexOf(rv)}">&#128208; Notte per notte</button>
                <button class="usa prev"
                  data-cat="${esc(nome)}" data-tratt="${esc(rv.full_name || rv.name)}"
                  data-pp="${c.perPersona}" data-tot="${c.totale}" data-cure="${cureTot}"
                  data-sc5="${sconto ? sconto.imp5 : 0}" data-sc3="${sconto ? sconto.imp3 : 0}"
                  data-bimbi="${c.dettaglioB.map(b => b.prezzo || 0).join(',')}"
                  ${sconto && sconto.stima
                    ? 'disabled data-stima="1" title="Il 5% qui &egrave; una stima: il conto esatto sta in Notte per notte, e una stima non si manda a un cliente."'
                    : ''}>+ Prev.</button>`}</td>
            </tr>`;
          }
          html += `</table>`;
        } else if (troppoPiccola && v.libere.length) {
          html += `<div class="nota" style="padding:0 16px 12px;">Non tiene ${adulti} adulti: ${capienza}.</div>`;
        }
        html += `</div>`;
      }

      html += `<div class="avviso"><strong>Da rileggere prima di promettere.</strong>
        I prezzi sono le tariffe di Fidra, le stesse del sito, e cambiano con
        l&apos;occupazione: una tariffa letta oggi pu&ograve; non essere quella di ieri.
        Il supplemento uso singola Fidra lo tiene in archivio ma non lo applica da solo:
        qui viene sommato, e se il valore non &egrave; quello giusto lo correggi nel campo
        accanto alla categoria. I numeri di camera sono liberi per tutte le notti del
        periodo.</div>`;

      $('dRis').innerHTML = html;

      /* ---------- v2.9: il carrello del preventivo ---------- */
      /* v2.9.1: la barra e' il modulo intero e finisce il lavoro qui.
         Prima depositava un dato e toccava aprire il pannello laterale,
         scegliere il documento, ribattere nome ed email: due finestre e
         quattro gesti per una cosa sola. Adesso l'email si costruisce in
         questa pagina — i modelli sono caricati anche qui — e Outlook si
         apre gia' pronto. Quello che l'operatore digita, lo digita una
         volta e dentro il riquadro dove sta gia' guardando. */
      function aggiornaBarra() {
        const b = $('dPrevBarra');
        if (!b) return;
        if (!SCELTE.length) { b.style.display = 'none'; return; }
        /* si ridisegna solo il conteggio se il modulo c'e' gia': riscrivere
           tutto cancellerebbe il nome mentre lo si sta scrivendo */
        if ($('dPrevVai')) {
          $('dPrevQuante').textContent = etichettaQuante();
          return;
        }
        b.style.display = 'block';
        b.innerHTML = `
          <div class="prevRiga" style="padding-bottom:8px;">
            <strong id="dPrevQuante" style="flex:1;">${etichettaQuante()}</strong>
            <button class="usa" id="dPrevSvuota">Svuota</button>
          </div>
          <div class="prevRiga">
            <input type="text" id="dPrevNome" placeholder="Cognome e nome (facoltativo)" />
            <input type="text" id="dPrevEmail" placeholder="email dell&apos;ospite" />
            <select id="dPrevLingua" style="border:1px solid #D8CFBE;border-radius:4px;padding:6px 8px;font:13px Arial;">
              <option value="it">Italiano</option><option value="de">Deutsch</option>
              <option value="en">English</option><option value="fr">Fran&ccedil;ais</option>
            </select>
            <select id="dPrevGenere" title="Come rivolgersi" style="border:1px solid #D8CFBE;border-radius:4px;padding:6px 8px;font:13px Arial;">
              <option value="N">Neutro</option>
              <option value="F">Signora / Frau</option>
              <option value="M">Signor / Herr</option>
            </select>
            <label><input type="checkbox" id="dPrevCure" /> cure termali</label>
            <label><input type="checkbox" id="dPrevCane" /> cane</label>
            <label title="Spuntato solo se all'ospite servono davvero tutte: altrimenti sono alternative e i prezzi non si sommano"><input type="checkbox" id="dPrevInsieme" /> servono insieme</label>
            <button class="prevVai" id="dPrevVai">Crea preventivo e apri Outlook</button>
          </div>
          <div id="dPrevNota" style="padding-top:6px;color:#8C7A45;"></div>`;
        $('dPrevSvuota').onclick = () => { SCELTE.length = 0; marcaPulsanti(); aggiornaBarra(); };
        $('dPrevVai').onclick = creaPreventivo;
        riempiDaRichiesta();
      }

      function etichettaQuante() {
        return `${SCELTE.length} ${SCELTE.length === 1
          ? 'sistemazione scelta' : 'sistemazioni scelte'}${
          SCELTE.length >= MAX_SCELTE ? ' · il massimo è quattro' : ''}`;
      }

      /* Chi risponde a un'email non deve ribattere quello che l'estensione
         ha gia' letto dall'email stessa. outlook-inject.js lo mette da
         parte quando riconosce una richiesta; qui si riempie e si dice da
         dove viene, perche' un campo che si compila da solo senza dirlo e'
         un campo che nessuno rilegge. */
      async function riempiDaRichiesta() {
        if (!ESTENSIONE) return;
        try {
          const r = await chrome.storage.local.get(['leonardo_richiesta']);
          const q = r.leonardo_richiesta;
          if (!q || Date.now() - (q.quando || 0) > 60 * 60 * 1000) return;
          if (q.ospite && $('dPrevNome') && !$('dPrevNome').value) $('dPrevNome').value = q.ospite;
          if (q.email && $('dPrevEmail') && !$('dPrevEmail').value) $('dPrevEmail').value = q.email;
          if (q.lingua && $('dPrevLingua')) $('dPrevLingua').value = q.lingua;
          if (q.cane && $('dPrevCane')) $('dPrevCane').checked = true;
          if (q.cure && $('dPrevCure')) $('dPrevCure').checked = true;
          const n = $('dPrevNota');
          if (n) n.textContent = 'Compilato dalla richiesta aperta in Outlook'
            + (q.oggetto ? ' «' + q.oggetto.slice(0, 60) + '»' : '') + ' — rileggi prima di mandare.';
        } catch (e) { /* si compila a mano, come prima */ }
      }

      /* un pulsante gia' scelto lo dice, e ricliccandolo si toglie */
      function marcaPulsanti() {
        $('dRis').querySelectorAll('.prev').forEach(b => {
          if (b.dataset.stima) return;              // stima: resta spento
          const dentro = SCELTE.some(v => v.categoria === b.dataset.cat &&
                                          v.trattamento === b.dataset.tratt);
          b.textContent = dentro ? '✓ nel preventivo' : '+ Prev.';
          b.disabled = !dentro && SCELTE.length >= MAX_SCELTE;
        });
      }

      $('dRis').querySelectorAll('.prev').forEach(b => b.addEventListener('click', () => {
        const i = SCELTE.findIndex(v => v.categoria === b.dataset.cat &&
                                        v.trattamento === b.dataset.tratt);
        if (i >= 0) SCELTE.splice(i, 1);
        else if (SCELTE.length < MAX_SCELTE) SCELTE.push({
          categoria:   b.dataset.cat,
          trattamento: b.dataset.tratt,
          prezzoPP: +b.dataset.pp   || 0,
          totale:   +b.dataset.tot  || 0,
          cure:     +b.dataset.cure || 0,
          sconto5:  +b.dataset.sc5  || 0,
          sconto3:  +b.dataset.sc3  || 0,
          /* il prezzo di ogni bambino per eta', in centesimi: il modale lo
             ha gia' calcolato, e buttarlo via vorrebbe dire farlo ricopiare
             a mano proprio a chi non deve ricopiare niente. Uno zero e' un
             bambino gratuito, e va detto anche quello. */
          bambiniPrezzi: (b.dataset.bimbi || '').split(',').filter(x => x !== '').map(Number),
          stima: false
        });
        marcaPulsanti();
        aggiornaBarra();
      }));

      /* MESI_ABBR come li vogliono i modelli: 'Aug', non 7 */
      const MESI_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

      function datiPreventivo(nome, lingua) {
        const A = new Date(arrivo + 'T00:00'), P = new Date(partenza + 'T00:00');
        return {
          ok: true, rapido: true, preventivo: true, id: null, numeroOfferta: null,
          linkPagamento: null, stato: 'preventivo',
          intestatario: nome, emailAlternative: [], note: [], mancanti: [], profilo: {},
          giornoArrivo: A.getDate(), mese: MESI_ABBR[A.getMonth()], anno: A.getFullYear(),
          giornoPartenza: P.getDate(), mesePartenza: MESI_ABBR[P.getMonth()],
          annoPartenza: P.getFullYear(),
          notti: nNotti, adulti, bambini: etaBambini.length,
          etaBambini: etaBambini.slice(), voci: SCELTE.slice(),
          /* v2.9.6: due sistemazioni scelte qui sono alternative per
             definizione — stesse date, stessi ospiti. Se invece servono
             tutte e due, lo dice questa spunta e i prezzi si sommano. */
          insieme: !!(($('dPrevInsieme') || {}).checked),
          camere: [], nCamere: 0, caparraVersata: 0, caparraDovuta: null
        };
      }

      const MODELLI_PREV = {
        it: [() => costruisciPreventivoIT, () => oggettoPreventivoIT],
        de: [() => costruisciPreventivoDE, () => oggettoPreventivoDE],
        en: [() => costruisciPreventivoEN, () => oggettoPreventivoEN],
        fr: [() => costruisciPreventivoFR, () => oggettoPreventivoFR]
      };

      async function creaPreventivo() {
        if (!SCELTE.length) return;
        const box = $('dEsito');
        const vai = $('dPrevVai');
        const dice = (testo, male) => {
          box.style.color = male ? '#B3541E' : '#0F5C64';
          box.textContent = testo;
        };
        try {
          if (!ESTENSIONE) throw new Error('serve l’estensione, non il segnalibro');
          if (typeof costruisciPreventivoIT !== 'function') {
            throw new Error('i modelli non sono caricati in questa pagina: ricarica l’estensione');
          }
          const lingua = ($('dPrevLingua') || {}).value || 'it';
          const nome = (($('dPrevNome') || {}).value || '').trim();
          const dest = (($('dPrevEmail') || {}).value || '').trim();
          /* la firma e' quella che l'operatore ha gia' scelto nel pannello:
             non gliela si richiede in un secondo posto */
          let firma = 'La Reception';
          try {
            const f = await chrome.storage.local.get(['firma']);
            if (f && f.firma) firma = f.firma;
          } catch (e) { /* resta quella predefinita */ }
          const opzioni = {
            genere: (($('dPrevGenere') || {}).value || 'N'), titolo: '', firma,
            cure: !!($('dPrevCure') || {}).checked,
            cane: !!($('dPrevCane') || {}).checked
          };
          const [fnHtml, fnOgg] = MODELLI_PREV[lingua] || MODELLI_PREV.it;
          const d = datiPreventivo(nome, lingua);
          const html = fnHtml()(d, opzioni);
          const ogg = fnOgg()(d);

          if (vai) { vai.disabled = true; vai.textContent = 'Apro Outlook…'; }

          /* gli appunti restano la riserva, come nel pannello: se
             l'inserimento automatico non scatta, c'e' Ctrl+V */
          try {
            await navigator.clipboard.write([new ClipboardItem({
              'text/html': new Blob([html], { type: 'text/html' }),
              'text/plain': new Blob([html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')], { type: 'text/plain' })
            })]);
          } catch (e) { /* alcuni contesti non danno gli appunti: si prosegue */ }

          await chrome.storage.local.set({ leonardo_email_pendente: {
            html, creato: Date.now(), firmaContenuto: 'prev#' + Date.now()
          }});

          const url = 'https://outlook.office.com/mail/deeplink/compose'
            + '?to=' + encodeURIComponent(dest)
            + '&subject=' + encodeURIComponent(ogg);
          const esito = await chrome.runtime.sendMessage({ tipo: 'LEONARDO_APRI_OUTLOOK', url });
          if (!esito || !esito.ok) throw new Error((esito && esito.motivo) || 'Outlook non si e’ aperto');

          dice('Outlook aperto: il testo si inserisce da solo.'
            + (dest ? '' : ' Manca il destinatario: mettilo tu nella scheda.')
            + ' Se l’ospite accetta, apri la pratica in Fidra e manda l’offerta.');
        } catch (e) {
          dice('Preventivo non mandato: ' + e.message, true);
        } finally {
          if (vai) { vai.disabled = false; vai.textContent = 'Crea preventivo e apri Outlook'; }
        }
      }

      marcaPulsanti();
      aggiornaBarra();

      $('dRis').querySelectorAll('.scorpora').forEach(b => b.addEventListener('click', () => {
        const nome = b.dataset.cat;
        const v = perCat.get(nome);
        const t2 = tariffePerCat.get(nome);
        const varz = [];
        for (const r2 of (t2 && t2.rates) || []) for (const rv2 of r2.rate_variations || []) varz.push(rv2);
        const pacchetto = varz[+b.dataset.idx];
        /* per i giorni extra si usa la mezza pensione se c'è, altrimenti la prima senza cure */
        const extra = varz.find(x => /mezza pensione|halbpension|half board/i.test(x.full_name || '') && !x.items_total_price)
                   || varz.find(x => !x.items_total_price) || null;
        mostraScorporo(nome, (v.categoria || {}), pacchetto, extra, arrivo, partenza, adulti);
      }));

      $('dRis').querySelectorAll('.supp').forEach(inp => inp.addEventListener('change', async () => {
        const v = Math.max(0, Math.round(parseFloat(inp.value.replace(',', '.')) || 0)) * 100;
        SUPPL[inp.dataset.cat] = v;
        await salvaSupplementi(SUPPL);
        disegna(camere, tariffe, arrivo, partenza, adulti, etaBambini);
        $('dEsito').textContent = 'Uso singola ' + inp.dataset.cat + ': ' +
          (v / 100).toFixed(0) + ' \u20ac a notte, memorizzato.';
      }));

      $('dRis').querySelectorAll('.num').forEach(b => b.addEventListener('click', () => {
        navigator.clipboard?.writeText(String(b.dataset.num));
        $('dEsito').textContent = 'Camera ' + b.dataset.num + ' copiata.';
      }));
    }
  }

  /* ============================================================
     v1.8.1 — SCRITTURA DIRETTA NEL RIQUADRO «PREZZI» DI FIDRA
     Fidra chiede un campo per ogni notte: copiare un elenco non
     serve, perché va incollato una casella alla volta (per quindici
     notti è una tortura). Qui i campi si compilano da soli.
     NON si salva nulla: il pulsante Salva di Fidra resta all'operatore,
     che vede i numeri prima di confermarli.
     ============================================================ */

  /* i campi di Fidra sono gestiti da un framework: assegnare .value non
     basta, il framework non se ne accorge. Si usa il setter nativo e si
     annunciano gli eventi, come farebbe una digitazione vera. */
  function scriviCampo(input, valore) {
    const proto = Object.getPrototypeOf(input);
    const setter = Object.getOwnPropertyDescriptor(proto, 'value');
    if (setter && setter.set) setter.set.call(input, valore);
    else input.value = valore;
    for (const tipo of ['input', 'change', 'blur']) {
      input.dispatchEvent(new Event(tipo, { bubbles: true }));
    }
  }

  /* trova gli input del riquadro Prezzi: per ciascuno si legge l'etichetta
     nel contenitore ("Notte 3", "Totale") invece di affidarsi all'ordine */
  /* v1.8.6 — come si trovano i campi.
     Il tentativo precedente risaliva dai campi alle etichette, ma in Fidra
     "Notte 3" NON è un antenato dell'input: è un elemento fratello che lo
     precede. Si parte quindi dalle etichette, che sono inequivocabili, e da
     ciascuna si scende al primo campo che la segue nell'ordine del documento. */
  function campiPrezziFidra() {
    const perNotte = new Map();
    let totale = null;

    const nostri = (n) => n.closest && n.closest('#leoDispWrap, #leoScorporo, #leoNumeriCamere, #leoPdfFrame');
    const tutti = [...document.querySelectorAll('input, textarea')]
      .filter(i => !nostri(i) && !i.disabled && i.type !== 'checkbox' &&
                   i.type !== 'radio' && i.type !== 'hidden');
    if (!tutti.length) return { perNotte, totale };

    /* elenco ordinato di tutti i nodi del documento, per dire "chi viene dopo chi" */
    const ordine = new Map();
    let k = 0;
    const cammino = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    for (let n = cammino.currentNode; n; n = cammino.nextNode()) ordine.set(n, k++);
    const posizione = (el) => ordine.has(el) ? ordine.get(el) : Infinity;

    const primoCampoDopo = (el) => {
      const p = posizione(el);
      let scelto = null, distanza = Infinity;
      for (const inp of tutti) {
        const d = posizione(inp) - p;
        if (d > 0 && d < distanza) { distanza = d; scelto = inp; }
      }
      return distanza <= 12 ? scelto : null;   // dev'essere lì accanto, non a fondo pagina
    };

    for (const el of document.querySelectorAll('label, span, div, p, td, th, strong, b')) {
      if (nostri(el)) continue;
      if (el.children.length) continue;                    // solo le foglie: l'etichetta pura
      const t = (el.textContent || '').trim();
      if (!t || t.length > 24) continue;
      const mn = t.match(/^(?:Notte|Nacht|Night|Nuit)\s*(\d+)$/i);
      if (mn) {
        const inp = primoCampoDopo(el);
        if (inp && !perNotte.has(+mn[1])) perNotte.set(+mn[1], inp);
        continue;
      }
      if (/^(Totale|Gesamt(preis)?|Total)$/i.test(t) && !totale) {
        totale = primoCampoDopo(el);
      }
    }
    return { perNotte, totale };
  }

  function compilaPrezziFidra(notti, totaleCent) {
    const { perNotte, totale } = campiPrezziFidra();
    if (!perNotte.size) {
      return { ok: false, messaggio: 'Non vedo il riquadro «Prezzi» di Fidra: aprilo ' +
        '(camera → Modifica → Prezzi) e riprova senza chiudere questa finestra.' };
    }
    if (perNotte.size !== notti.length) {
      return { ok: false, messaggio: `Il riquadro di Fidra ha ${perNotte.size} notti, il calcolo ` +
        `ne ha ${notti.length}: controlla che il periodo sia lo stesso. Non ho toccato nulla.` };
    }
    notti.forEach((n, i) => {
      const inp = perNotte.get(i + 1);
      if (inp) scriviCampo(inp, (n.cent / 100).toFixed(2).replace('.', ','));
    });
    if (totale && totaleCent != null) scriviCampo(totale, (totaleCent / 100).toFixed(2).replace('.', ','));
    return { ok: true, messaggio: `Compilate ${notti.length} notti` +
      (totale ? ' e il totale' : '') + '. Controlla i numeri e premi Salva in Fidra.' };
  }

  /* ============================================================
     v2.1 — SCORCIATOIA DALLA SCHEDA CAMERA
     La "i" accanto a "Totale 705,00 € p.p." e' il punto in cui ci si
     chiede come sia fatto quel prezzo. Da li' si apre direttamente il
     riquadro "Notte per notte" di quella camera e di quel trattamento,
     senza passare dal pannello e senza reimpostare periodo e occupazione.
     Il pannello resta com'e': questa e' una strada in piu', non al posto
     di quella.
     ============================================================ */

  /* dal punto cliccato si risale al riquadro della camera e se ne legge
     tutto: categoria, trattamento, occupazione, periodo proprio */
  function cameraDalClic(bersaglio) {
    let el = bersaglio;
    for (let i = 0; i < 8 && el && el !== document.body; i++, el = el.parentElement) {
      const t = (el.innerText || '');
      if (!/Adulti\s+\d+\s+Bambini\s+\d+/.test(t)) continue;
      if (t.length > 1200) break;                     // troppo grande: e' la pagina
      const righe = t.split('\n').map(x => x.trim()).filter(Boolean);
      const mc = righe[0] && righe[0].match(/^(.+?)\s+n\.\s*(\d*)\s*$/);
      if (!mc) continue;
      const dati = datiPrenotazione() || {};
      const norm = (x) => (x || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      /* si preferisce la camera gia' letta da datiPrenotazione, che porta
         anche il periodo proprio; il DOM serve a capire QUALE delle camere */
      const candidate = (dati.camere || []).filter(c => norm(c.categoria) === norm(mc[1]));
      if (!candidate.length) continue;
      if (candidate.length === 1) return candidate[0];
      const num = mc[2];
      return candidate.find(c => c.numero && String(c.numero) === num)
          || candidate.find(c => t.includes(c.trattamento || '\u0000'))
          || candidate[0];
    }
    return null;
  }

  async function apriNotteDaCamera(cam) {
    if (!cam || !cam.arrivo || !cam.partenza) return false;
    const avviso = (testo, colore) => {
      const a = document.createElement('div');
      a.textContent = testo;
      a.style.cssText = `position:fixed;bottom:130px;right:24px;z-index:2147483647;
        background:${colore || '#0F5C64'};color:#fff;padding:10px 16px;border-radius:8px;
        font-family:Arial,Helvetica,sans-serif;font-size:13px;box-shadow:0 6px 18px rgba(0,0,0,.2);`;
      document.body.appendChild(a);
      setTimeout(() => a.remove(), 3500);
    };
    avviso('Calcolo notte per notte\u2026');
    try {
      SUPPL = await leggiSupplementi();
      const { camere, tariffe } = await cerca(cam.arrivo, cam.partenza);
      const perCat = libere(camere);
      const norm = (x) => (x || '').toLowerCase().replace(/&/g, ' e ')
        .replace(/[^a-z0-9]+/g, ' ').replace(/\band\b/g, 'e').replace(/\s+/g, ' ').trim();
      const nome = [...perCat.keys()].find(k => norm(k) === norm(cam.categoria));
      if (!nome) { avviso('Categoria "' + cam.categoria + '" non trovata in Fidra', '#B3541E'); return false; }
      const t = (tariffe || []).find(x => ((x.room_category || {}).name) === nome);
      const varz = [];
      for (const r of (t && t.rates) || []) for (const rv of r.rate_variations || []) varz.push(rv);
      if (!varz.length) { avviso('Nessuna tariffa per questo periodo', '#B3541E'); return false; }
      /* la tariffa della prenotazione; se non si trova, la prima con cure
         (i pacchetti sono quelli che hanno bisogno dello scorporo) */
      const scelta = varz.find(rv => norm(rv.full_name || rv.name) === norm(cam.trattamento))
                  || varz.find(rv => (rv.items_total_price || 0) > 0)
                  || varz[0];
      const extra = varz.find(x => /mezza pensione|halbpension|half board/i.test(x.full_name || '') && !x.items_total_price)
                 || varz.find(x => !x.items_total_price) || null;
      mostraScorporo(nome, (perCat.get(nome).categoria || {}), scelta, extra,
                     cam.arrivo, cam.partenza, cam.adulti || 1);
      return true;
    } catch (e) {
      avviso('Non riesco a leggere i prezzi: ' + e.message, '#B3541E');
      return false;
    }
  }

  /* la "i" di Fidra continua a fare quel che faceva: qui si ascolta soltanto */
  document.addEventListener('click', (ev) => {
    if (!/\/reservations\/\d+/.test(location.pathname)) return;
    const el = ev.target;
    if (!el || el.closest('#leoDispWrap, #leoScorporo, #leoNumeriCamere')) return;
    const testo = (el.innerText || el.textContent || '').trim();
    const attr = (n) => (el.getAttribute && el.getAttribute(n)) || '';
    const etichetta = attr('title') || attr('aria-label') || attr('data-tooltip');
    /* v2.1.1: la "i" puo' essere una lettera, un pulsante con titolo, o
       un'icona senza testo. Nell'ultimo caso non basta guardare l'elemento:
       si controlla che sia un segno piccolo appoggiato al prezzo "… € p.p.",
       cosi' un clic su "Opzioni" o su un nome non apre nulla. */
    let eInfo = /^i$/i.test(testo) || /info|dettagl/i.test(etichetta);
    if (!eInfo && testo.length <= 2) {
      const nodo = (el.tagName === 'path' || el.tagName === 'circle') ? el.parentElement : el;
      const cornice = nodo && (nodo.closest ? nodo.closest('button, a, span, div') : null);
      const vicino = cornice && cornice.parentElement;
      const attorno = (vicino && vicino.innerText || '').trim();
      eInfo = /€\s*p\.p\./i.test(attorno) && attorno.length < 80;
    }
    if (!eInfo) return;
    const cam = cameraDalClic(el);
    if (cam) apriNotteDaCamera(cam);
  }, true);

  function mostraScorporo(nomeCat, cat, pacchetto, extraIn, arrivo, partenza, adulti) {
    let extra = extraIn;
    const $ = (id) => document.getElementById(id);
    const nNotti = notti(arrivo, partenza);
    const listino = prezzoPacchetto(nomeCat, arrivo, adulti);
    const supplBase = (SUPPL[nomeCat] != null) ? SUPPL[nomeCat] : (cat.single_occupancy_charge || 0);
    /* v1.9.4: il pacchetto puo' avere un supplemento suo (Spezial 25 €),
       mentre le notti fuori pacchetto seguono la loro tariffa e tornano
       al valore normale: chi prolunga paga 15, non 25. */
    const supplPacch = supplPerTariffa(nomeCat, (pacchetto && (pacchetto.full_name || pacchetto.name)) || '', supplBase);
    const supplExtra = supplPerTariffa(nomeCat, (extra && (extra.full_name || extra.name)) || '', supplBase);
    const supplCent = supplExtra.centesimi;   // vale per le notti fuori pacchetto
    /* `listino.cent` puo' essere nullo quando il listino conosce la camera
       ma non quel modo di venderla — la Queen in due. Allora il prezzo lo
       da' Fidra, come quando il listino non copre il periodo. */
    const prezzoPacc = (listino && listino.cent != null)
      ? listino.cent
      : Math.round((pacchetto.total || 0) / nNotti);
    /* A settimane va solo il Dolce Vita. Gli altri trattamenti — Smart,
       Deluxe, e le righe senza cure — vanno notte per notte alla PROPRIA
       tariffa del giorno, più l'uso singola: comodo per riempire il
       riquadro "Prezzi" di Fidra su qualsiasi trattamento. */
    const haCure = (pacchetto.items_total_price || 0) > 0;
    const settimanale = eSettimanale(pacchetto);
    const piano = settimanale ? pianoPacchetto(arrivo, nNotti) : { inizio: 0, nPacchetto: 0 };
    const nPacchetto = piano.nPacchetto;
    if (!settimanale || !extra) extra = settimanale && extra ? extra : pacchetto;
    if (!settimanale) extra = pacchetto;

    const cure = (pacchetto.items || []).map(i => ({
      n: i.name || i.description || 'trattamento',
      q: i.quantity || i.qty || null,
      p: i.price || i.total || 0
    }));
    const totCure = pacchetto.items_total_price || cure.reduce((s, x) => s + x.p * (x.q || 1), 0);

    const calcolo = scorpora({
      nNotti, nPacchetto, inizioPacchetto: piano.inizio,
      prezzoPacchettoCent: prezzoPacc, variazioneExtra: extra,
      supplCent, adulti, arrivo,
      supplPacchCent: supplPacch.centesimi,
      supplGiaIncluso: !!(listino && listino.singolaInclusa)
    });

    /* ============================================================
       v1.8.7 — SCONTI CALCOLATI NOTTE PER NOTTE
       Qui ogni notte ha il suo prezzo e la sua tariffa, quindi il 5% si
       applica ESATTAMENTE alle sole notti fuori pacchetto: niente stima
       proporzionale come nella tabella riassuntiva.
       Il 3% è un rimborso alla partenza e vale solo se l'ospite ha già
       versato l'intero importo: la caparra si legge dalla pagina e si
       confronta con il totale. Chi ha versato meno non lo riceve, e il
       pannello dice di quanto è sotto.
       ============================================================ */
    const PREN2 = datiPrenotazione() || {};
    /* ============================================================
       v2.2.1 — DUE SCONTI, DUE BASI DIVERSE
       · 5% fedelta': solo le notti FUORI pacchetto. Il pacchetto ha gia'
         il suo prezzo di listino e non si sconta.
       · 3% anticipo: TUTTO il pernottamento, comprese le notti del
         pacchetto — quelle sono camera e pensione. Restano fuori cure,
         trattamenti ed extra, che non si scontano mai.
       Con entrambi attivi il 3% si calcola sulla pensione gia' scontata
       del 5%, per non scontare due volte la stessa cifra.
       ============================================================ */
    const baseCinque = calcolo.notti
      .filter(n => n.etichetta !== 'pacchetto')
      .reduce((t, n) => t + n.cent, 0);
    const baseTre = calcolo.pernottamento;      // tutte le notti, niente cure
    const baseScontabile = baseCinque;          // usata dal 5%
    const totalePersona = calcolo.pernottamento + totCure;
    const totalePratica = totalePersona * (adulti || 1);
    const caparra = PREN2.caparraCent;
    const saldata = caparra != null && Math.abs(caparra - totalePratica) <= 100;  // 1 € di tolleranza
    const mancante = caparra != null ? totalePratica - caparra : null;

    /* v1.8.8: il 3% premia il denaro arrivato in anticipo. Se l'ospite ha
       versato meno del totale, la parte non versata non è stata anticipata
       e quindi non si sconta: la base scende della differenza. Il pannello
       mostra comunque il 3% pieno accanto, così in reception si decide caso
       per caso — la spunta non è più bloccata. */
    function scontiEsatti(con5, con3) {
      const imp5 = con5 ? Math.round(baseCinque * 5 / 100) : 0;
      /* v2.2.3: il 3% cade sulla pensione AL NETTO del 5% gia' riconosciuto.
         Sulla 18968: 2.385 − 28,25 = 2.356,75, di cui il 3% fa 70,70 €.
         Se un giorno la regola cambiasse in "3% sul lordo", basta togliere
         il meno imp5 qui sotto: il resto del calcolo non cambia. */
      const pensioneNetta = baseTre - imp5;
      const imp3 = con3 ? Math.round(pensioneNetta * 3 / 100) : 0;
      /* quanto e' rimasto da versare, come informazione: non si decurta piu'
         in automatico, si vede il conto pieno e si decide */
      const perAdulto = (mancante != null && mancante > 0) ? mancante / (adulti || 1) : 0;
      return {
        imp5, imp3, basePensione: pensioneNetta,
        imp3Ridotto: con3 ? Math.round(Math.max(0, pensioneNetta - perAdulto) * 3 / 100) : 0,
        ridotto: perAdulto > 0
      };
    }

    /* Da importo a voce di Fidra: il gestionale accetta solo cifre al
       giorno, per camera o per persona. Qui si converte, cosi' il numero
       si copia senza rifare i conti. Gli importi del riquadro sono a
       persona: per la voce "per camera" vanno moltiplicati per gli adulti. */
    function comeVoceFidra(importoAPersona, notteDaContare) {
      const n = notteDaContare || 1;
      const ad = adulti || 1;
      const perAdulto = Math.round(importoAPersona / n);
      const perCamera = Math.round((importoAPersona * ad) / n);
      return { perAdulto, perCamera, notti: n, adulti: ad };
    }

    const righe = calcolo.notti.map((n, i) =>
      `<tr><td>Notte ${i + 1}</td><td class="pr"><strong>${euro(n.cent)}</strong></td>
       <td style="color:#8C8578;font-size:12px;">${n.etichetta === 'pacchetto'
         ? esc(pacchetto.full_name || 'pacchetto')
         : esc((extra && (extra.full_name || extra.name)) || 'tariffa del giorno')}</td></tr>`).join('');

    const testoCopia = calcolo.notti.map((n, i) => `Notte ${i + 1}: ${euro(n.cent)}`).join('\n') +
      `\nTotale pernottamento: ${euro(calcolo.pernottamento)} \u20ac a persona` +
      `\nCure: ${euro(totCure)} \u20ac \u00b7 Totale: ${euro(calcolo.pernottamento + totCure)} \u20ac a persona`;

    const box = document.createElement('div');
    box.id = 'leoScorporo';
    /* v2.11.1: appoggiato al bordo destro invece che a meta' schermo.
       Il riquadro «Prezzi» di Fidra si apre al centro, e questo ci finiva
       sopra proprio mentre si guardano i due elenchi per confrontarli —
       che e' l'unico motivo per cui e' aperto. Resta trascinabile. */
    box.style.cssText = 'position:fixed;top:34px;right:16px;z-index:2147483647;' +
      'font-family:Arial,Helvetica,sans-serif;';
    box.innerHTML = `<div style="background:#FAF8F4;width:min(560px,94vw);border-radius:10px;overflow:hidden;box-shadow:0 14px 48px rgba(0,0,0,.44);max-height:calc(100vh - 60px);display:flex;flex-direction:column;">
      <div style="background:#0F5C64;color:#fff;padding:12px 18px;display:flex;justify-content:space-between;align-items:center;">
        <h2 style="margin:0;font:normal 17px Georgia,serif;">Notte per notte &middot; ${esc(nomeCat)}</h2>
        <button id="scX" style="background:none;border:0;color:#fff;font-size:22px;cursor:pointer;">&times;</button>
      </div>
      <div style="padding:14px 18px 18px;overflow:auto;">
        <div style="font-size:13px;color:#7B756A;line-height:19px;">
          ${settimanale
            ? `${nNotti} notti &middot; <strong>${calcolo.nPacchetto}</strong> coperte dal pacchetto
               e <strong>${calcolo.nExtra}</strong> a tariffa del giorno${
                 calcolo.inizioPacchetto
                   ? ` &mdash; <span style="color:#8C7A45;">le prime ${calcolo.inizioPacchetto}
                       ${calcolo.inizioPacchetto === 1 ? 'notte' : 'notti'} prima del sabato, quando parte
                       il pacchetto${calcolo.nNotti - calcolo.inizioPacchetto - calcolo.nPacchetto > 0
                         ? `, e ${calcolo.nNotti - calcolo.inizioPacchetto - calcolo.nPacchetto} alla fine` : ''}</span>`
                   : ''}.<br />
               Pacchetto a ${euro(prezzoPacc)} &euro; a notte ${
                 listino && listino.soloSingola
                   ? `<span style="color:#8C7A45;">(ricavato da Fidra: nel listino
                      ${esc(listino.stagione)} la Queen con questo pacchetto c&rsquo;&egrave;
                      <strong>solo in uso singola</strong>, e qui gli adulti sono ${adulti})</span>`
                 : listino
                 ? `(listino ${esc(listino.stagione)}${
                      listino.singolaInclusa ? ', uso singola gi&agrave; incluso'
                      : (adulti === 1 && supplPacch.centesimi
                          ? `, con uso singola +${euro(supplPacch.centesimi)} &euro;` : '')})`
                 : '(ricavato da Fidra: il listino non copre questo periodo)'}${
                 adulti === 1 && supplCent && calcolo.nExtra ? ` &middot; giorni extra con uso singola +${euro(supplCent)} &euro;` : ''}${
                 adulti === 1 && supplPacch.nota && supplPacch.centesimi !== supplExtra.centesimi
                   ? `<div style="color:#8C7A45;font-size:12.5px;padding-top:4px;">Nel pacchetto l'uso singola è
                      ${euro(supplPacch.centesimi)} € a notte (${esc(supplPacch.nota)}); le notti fuori pacchetto
                      tornano a ${euro(supplExtra.centesimi)} €.</div>` : ''}`
            : `${nNotti} ${nNotti === 1 ? 'notte' : 'notti'} alla tariffa del giorno${
                 adulti === 1 && supplCent ? `, uso singola +${euro(supplCent)} &euro; a notte compreso` : ''}.`}
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13.5px;margin-top:10px;">
          <tr><th style="text-align:left;padding:6px 0;color:#0F5C64;font-size:11px;letter-spacing:.6px;">NOTTE</th>
              <th style="text-align:right;padding:6px 0;color:#0F5C64;font-size:11px;">PREZZO</th>
              <th style="text-align:left;padding:6px 0 6px 10px;color:#0F5C64;font-size:11px;">TARIFFA</th></tr>
          ${righe}
          <tr><td style="border-top:2px solid #E9E2D5;padding-top:8px;"><strong>Pernottamento</strong></td>
              <td class="pr" style="border-top:2px solid #E9E2D5;padding-top:8px;"><strong>${euro(calcolo.pernottamento)} &euro;</strong></td>
              <td style="border-top:2px solid #E9E2D5;"></td></tr>
          ${cure.length ? cure.map(x => `<tr><td style="color:#7B756A;font-size:12.5px;">${x.q ? x.q + ' &times; ' : ''}${esc(x.n)}</td>
              <td class="pr" style="color:#7B756A;font-size:12.5px;">${euro(x.p * (x.q || 1))} &euro;</td><td></td></tr>`).join('') : ''}
          <tr><td><strong>Totale a persona</strong></td>
              <td class="pr"><strong style="color:#0F5C64;">${euro(calcolo.pernottamento + totCure)} &euro;</strong></td><td></td></tr>
        </table>
        <div id="scSconti" style="margin-top:12px;padding:10px 12px;background:#F7F4EC;border-radius:6px;font-size:13px;">
          <label style="display:block;margin-bottom:5px;cursor:pointer;">
            <input type="checkbox" id="sc5" /> <strong>5% fedelt&agrave;</strong>
            &mdash; si toglie dal prezzo${calcolo.nPacchetto
              ? `, solo sulle <strong>${calcolo.nExtra}</strong> notti fuori pacchetto` : ''}</label>
          <label style="display:block;cursor:pointer;">
            <input type="checkbox" id="sc3" />
            <strong>3% anticipo</strong> &mdash; sulla pensione, cure escluse
            ${caparra == null ? '<span style="color:#8C8578;">(caparra non leggibile)</span>'
              : saldata ? `<span style="color:#5A7A3E;">(caparra ${euro(caparra)} &euro;: saldato per intero)</span>`
              : `<span style="color:#8C7A45;">(versati ${euro(caparra)} &euro; su ${euro(totalePratica)} &euro;)</span>`}</label>
          <div id="scRisultato" style="margin-top:8px;color:#55524B;"></div>
        </div>
        <button id="scRiempi" style="margin-top:12px;background:#0F5C64;color:#fff;border:0;border-radius:5px;padding:9px 16px;font:600 13px Arial;cursor:pointer;">
          &#9997; Compila i campi in Fidra</button>
        <button id="scCopia" style="margin-top:12px;margin-left:8px;background:#fff;color:#0F5C64;border:1px solid #B9CFD2;border-radius:5px;padding:9px 14px;font:600 13px Arial;cursor:pointer;">
          Copia l&apos;elenco</button>
        <div style="margin-top:10px;font-size:12.5px;color:#55524B;">
          Dettaglio per l&apos;email (righe pronte da incollare nel campo del pannello):
          <button id="scDettIT" style="margin-left:6px;background:#fff;color:#0F5C64;border:1px solid #B9CFD2;border-radius:5px;padding:5px 11px;font:600 12.5px Arial;cursor:pointer;">italiano</button>
          <button id="scDettDE" style="margin-left:4px;background:#fff;color:#0F5C64;border:1px solid #B9CFD2;border-radius:5px;padding:5px 11px;font:600 12.5px Arial;cursor:pointer;">deutsch</button>
        </div>
        <div style="font-size:12px;color:#7B756A;line-height:18px;padding-top:10px;">
          Con il primo pulsante i campi del riquadro &laquo;Prezzi&raquo; di Fidra si compilano da soli,
          uno per notte: tienilo aperto mentre premi. Il salvataggio resta a te.
          Le notti fuori pacchetto
          usano la tariffa <strong>di oggi</strong>, che cambia con l&apos;occupazione: su un&apos;offerta
          preparata giorni fa i numeri possono non coincidere. Rileggi prima di salvare.
        </div>
        <div id="scEsito" style="font-size:12.5px;color:#0F5C64;min-height:16px;line-height:17px;padding-top:6px;"></div>
      </div></div>`;
    document.body.appendChild(box);
    document.getElementById('scX').onclick = () => box.remove();
    {
      const testaSc = box.querySelector('h2');
      if (testaSc && testaSc.parentElement) {
        testaSc.parentElement.style.cursor = 'move';
        testaSc.parentElement.style.userSelect = 'none';
        rendiTrascinabile(box, testaSc.parentElement);
      }
    }
    /* le spunte aggiornano il conto e influenzano la compilazione in Fidra */
    function aggiornaSconti() {
      const con5 = document.getElementById('sc5').checked;
      const con3 = document.getElementById('sc3').checked;
      const { imp5, imp3, imp3Ridotto, ridotto, basePensione } = scontiEsatti(con5, con3);
      const box = document.getElementById('scRisultato');
      if (!con5 && !con3) { box.innerHTML = ''; return; }

      /* la riga da copiare in Fidra, nelle due forme che il gestionale accetta */
      const voce = (imp, notte) => {
        const v = comeVoceFidra(imp, notte);
        /* la cifra al giorno e' arrotondata al centesimo: moltiplicata per le
           notti puo' non ricomporre l'importo esatto. Lo scarto si dichiara,
           cosi' chi inserisce la voce sa che in conto uscira' quel numero. */
        const ricomposto = v.perCamera * v.notti;
        const esatto = imp * v.adulti;
        const scarto = ricomposto - esatto;
        return `<div style="color:#8C8578;font-size:12px;padding-top:2px;">
          come voce in Fidra: <strong>${euro(v.perCamera)} &euro;</strong> al giorno per camera
          ${v.adulti > 1 ? `, oppure <strong>${euro(v.perAdulto)} &euro;</strong> al giorno per adulto` : ''}
          &times; ${v.notti} ${v.notti === 1 ? 'notte' : 'notti'}
          ${Math.abs(scarto) >= 1 ? `<br /><span style="color:#8C7A45;">in conto risulter&agrave;
            ${euro(ricomposto)} &euro; invece di ${euro(esatto)} &euro;: ${scarto > 0 ? '+' : '&minus;'}${euro(Math.abs(scarto))} &euro;
            per l'arrotondamento al centesimo</span>` : ''}</div>`;
      };

      box.innerHTML =
        (con5 ? `<div>5% fedelt&agrave;: <strong style="color:#5A7A3E;">&minus;${euro(imp5)} &euro;</strong> a persona
           &rarr; totale <strong>${euro(totalePersona - imp5)} &euro;</strong>
           ${calcolo.nExtra ? voce(imp5, calcolo.nExtra) : ''}</div>` : '') +
        (con3 ? `<div style="color:#8C7A45;padding-top:${con5 ? '8px' : '0'};">
           3% anticipo: <strong>${euro(imp3)} &euro;</strong> a persona
           <span style="color:#8C8578;">(3% di ${euro(basePensione)} &euro; di pensione${
             totCure ? `, cure e trattamenti esclusi` : ''}${con5 ? ', al netto del 5%' : ''})</span>
           ${voce(imp3, calcolo.nNotti)}
           ${ridotto ? `<div style="color:#B3261E;font-size:12px;padding-top:3px;">Attenzione:
             mancano ${euro(mancante)} &euro; al saldo della pratica. Sul solo importo gi&agrave;
             versato il 3% sarebbe ${euro(imp3Ridotto)} &euro;.</div>` : ''}</div>` : '');
    }
    /* ============================================================
       v1.9.8 — DETTAGLIO PRONTO PER L'EMAIL
       Dall'offerta non si capiva come si arrivasse al totale: quanto
       pesano le 14 notti di pacchetto, quanto le 4 in mezza pensione,
       e su quali giorni cade il 5%. Qui il testo si costruisce dai
       numeri veri e si incolla nel campo "Dettaglio del soggiorno"
       del pannello email, che lo stampa come distinta sotto la camera.
       ============================================================ */
    /* ============================================================
       v2.1.5 — IL DETTAGLIO SI TRADUCE
       Le righe uscivano con i nomi come li scrive Fidra: "Matrimoniale
       Queen", "Miglior Prezzo Mezza Pensione" in mezzo a un testo tedesco.
       Le regole sono le stesse dei modelli email (kategorieDE e
       traduciTrattamento), riportate qui perche' questo script gira dentro
       Fidra e non ha accesso a quei file.
       ============================================================ */
    const CATEG = {
      de: [['matrimoniale queen', 'Queen-Doppelzimmer'], ['doppia superior', 'Doppelzimmer Superior'],
           ['doppia', 'Doppelzimmer'], ['singola senza balcone', 'Einzelzimmer ohne Balkon'],
           ['singola parco', 'Einzelzimmer mit Parkblick'], ['singola accessibile', 'Barrierefreies Einzelzimmer'],
           ['singola', 'Einzelzimmer'], ['junior suite accessibile', 'Barrierefreie Junior Suite']],
      it: []
    };
    const TRATT = {
      de: [[/\bMiglior\s*Prezzo\b/i, 'Bestpreis'], [/\b(\d+)\s*cure\b/i, 'mit $1 Anwendungen'],
           [/\bMezza\s*Pensione\b/i, 'Halbpension'], [/\bSoggiorno\s*Breve\b/i, 'Kurzaufenthalt'],
           [/\bPernottamento\s*e\s*Colazione\b/i, '\u00dcbernachtung mit Fr\u00fchst\u00fcck'],
           [/\bPensione\s*Completa\b/i, 'Vollpension']],
      it: []
    };

    function traduciNome(testo, tabella, lingua) {
      let out = String(testo || '').trim();
      if (!out || lingua === 'it') return out;
      /* da TUTTO MAIUSCOLO a Iniziali Maiuscole, come nei modelli */
      if (out === out.toUpperCase() && /[A-Z]/.test(out)) {
        out = out.toLowerCase().replace(/(^|[\s&(\/-])([a-z\u00e0-\u00f9])/g, (m, p, c) => p + c.toUpperCase());
      }
      for (const [cerca, sost] of (tabella[lingua] || [])) {
        out = typeof cerca === 'string'
          ? out.replace(new RegExp(cerca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), sost)
          : out.replace(cerca, sost);
      }
      return out;
    }

    /* "Queen-Doppelzimmer zur Alleinbenutzung" quando l'ospite e' solo */
    function nomeCameraTradotto(lingua) {
      const base = traduciNome(nomeCat, CATEG, lingua);
      if ((adulti || 1) !== 1) return base;
      return lingua === 'de' ? `${base} zur Alleinbenutzung` : `${base} in uso singola`;
    }

    function testoDettaglio(lingua) {
      const con5 = document.getElementById('sc5').checked;
      const con3 = document.getElementById('sc3').checked;
      const { imp5, imp3 } = scontiEsatti(con5, con3);
      const soldi = (c) => euro(c) + ' €';
      const nP = calcolo.nPacchetto, nE = calcolo.nExtra;
      const centPacc = calcolo.notti.filter(n => n.etichetta === 'pacchetto').reduce((t, n) => t + n.cent, 0);
      const centExtra = calcolo.notti.filter(n => n.etichetta !== 'pacchetto').reduce((t, n) => t + n.cent, 0);
      const nomePacc = traduciNome((pacchetto && (pacchetto.full_name || pacchetto.name)) || 'pacchetto', TRATT, lingua);
      const nomeExtra = traduciNome((extra && (extra.full_name || extra.name)) ||
        (lingua === 'de' ? 'Halbpension' : 'mezza pensione'), TRATT, lingua);
      const righe = [];
      const N = lingua === 'de'
        ? { notti: (n) => `${n} ${n === 1 ? 'Nacht' : 'N\u00e4chte'}`,
            cure: 'Kuren und Behandlungen', sc5: (n) => `5 % Treuerabatt auf die ${n} N\u00e4chte`,
            sc5tutto: '5 % Treuerabatt', sc3: '3 % bei Vorauszahlung, bei der Abreise verrechnet',
            /* con un ospite solo "pro Person" non significa nulla */
            tot: (adulti || 1) === 1 ? 'Gesamt' : 'Gesamt pro Person' }
        : { notti: (n) => `${n} ${n === 1 ? 'notte' : 'notti'}`,
            cure: 'cure e trattamenti', sc5: (n) => `sconto fedelt\u00e0 5% sulle ${n} notti`,
            sc5tutto: 'sconto fedelt\u00e0 5%', sc3: '3% pagamento anticipato, reso alla partenza',
            tot: (adulti || 1) === 1 ? 'totale' : 'totale a persona' };

      if (nP) righe.push(`${N.notti(nP)} ${nomePacc} \u00b7 ${soldi(centPacc)}`);
      if (nE) righe.push(`${N.notti(nE)} ${nomeExtra} \u00b7 ${soldi(centExtra)}`);
      if (totCure) righe.push(`${N.cure} \u00b7 ${soldi(totCure)}`);
      if (imp5) righe.push(`${nP && nE ? N.sc5(nE) : N.sc5tutto} \u00b7 \u2212${soldi(imp5)}`);
      righe.push(`${N.tot} \u00b7 ${soldi(totalePersona - imp5)}`);
      if (imp3) righe.push(`${N.sc3} \u00b7 \u2212${soldi(imp3)}`);
      return righe.join('\n');
    }

    async function copiaDettaglio(lingua) {
      const testo = testoDettaglio(lingua);
      try { await navigator.clipboard.writeText(testo); } catch (e) {}
      /* v1.9.9: oltre agli appunti, il dettaglio si mette da parte: il
         pannello email lo trova gia' pronto nel suo campo, senza che
         nessuno debba ricordarsi di incollarlo. */
      let messo = false;
      try {
        if (ESTENSIONE && chrome.storage) {
          await chrome.storage.local.set({ leonardo_dettaglio: {
            testo, lingua, quando: Date.now(),
            /* v2.2.4: il dettaglio appartiene a UNA prenotazione. Senza
               questo numero il pannello lo riproponeva su qualsiasi pratica
               aperta entro la mezz'ora, con i dati di quella precedente. */
            prenotazione: (location.pathname.match(/reservations\/(\d+)/) || [])[1] || '',
            camera: nomeCameraTradotto(lingua) +
              (pacchetto ? ' \u00b7 ' + traduciNome(pacchetto.full_name || pacchetto.name, TRATT, lingua) : '')
          }});
          messo = true;
        }
      } catch (e) { /* restano gli appunti */ }
      const box = document.getElementById('scEsito');
      box.style.color = '#0F5C64';
      box.innerHTML = messo
        ? 'Dettaglio pronto: lo trovi gi&agrave; nel pannello email, sotto &laquo;Dettaglio del soggiorno&raquo;. (&Egrave; anche negli appunti.)'
        : 'Dettaglio copiato: incollalo nel campo &laquo;Dettaglio del soggiorno&raquo; del pannello email.';
    }
    document.getElementById('scDettIT').onclick = () => copiaDettaglio('it');
    document.getElementById('scDettDE').onclick = () => copiaDettaglio('de');

    document.getElementById('sc5').onchange = aggiornaSconti;
    document.getElementById('sc3').onchange = aggiornaSconti;

    document.getElementById('scRiempi').onclick = () => {
      /* con il 5% attivo si scrivono in Fidra le notti già scontate:
         lo sconto sta sulle notti fuori pacchetto, quindi si distribuisce
         solo su quelle, e l'ultima assorbe l'arrotondamento. */
      const con5 = document.getElementById('sc5').checked;
      let notti = calcolo.notti, totale = calcolo.pernottamento + totCure;
      if (con5) {
        const { imp5 } = scontiEsatti(true, false);
        const fuori = calcolo.notti.filter(n => n.etichetta !== 'pacchetto').length;
        if (fuori) {
          const q = Math.floor(imp5 / fuori);
          let resto = imp5 - q * fuori, visti = 0;
          notti = calcolo.notti.map(n => {
            if (n.etichetta === 'pacchetto') return n;
            visti++;
            const in_più = visti === fuori ? resto : 0;
            return Object.assign({}, n, { cent: n.cent - q - in_più });
          });
          totale -= imp5;
        }
      }
      const esito = compilaPrezziFidra(notti, totale);
      const box2 = document.getElementById('scEsito');
      box2.style.color = esito.ok ? '#0F5C64' : '#B3541E';
      box2.textContent = esito.messaggio;
      if (esito.ok) offriSalvaERicarica();
    };

    /* v2.11.1 — IL PASSO CHE MANCAVA, E CHE COSTAVA UN PREZZO SBAGLIATO.
       Compilati i campi, restava da premere Salva in Fidra e POI ricaricare
       la pagina: senza il ricaricamento l'estrattore rilegge la pagina
       vecchia, e l'offerta esce con il prezzo di prima. Nessuno se ne
       accorge, perche' i numeri ci sono e sembrano giusti.

       Il pulsante lo fa in un gesto: preme Salva, aspetta che Fidra
       risponda, e ricarica. Se non trova Salva lo dice, invece di
       ricaricare buttando via quello che si e' appena scritto. */
    function pulsanteSalvaFidra() {
      return [...document.querySelectorAll('button')]
        .filter(b => !b.closest('#leoScorporo') && !b.closest('#leoDispWrap'))
        .find(b => /^salva$/i.test((b.textContent || '').replace(/\s+/g, ' ').trim())) || null;
    }

    function offriSalvaERicarica() {
      if (document.getElementById('scSalva')) return;
      const box2 = document.getElementById('scEsito');
      if (!box2) return;
      const b = document.createElement('button');
      b.id = 'scSalva';
      b.type = 'button';
      b.textContent = 'Salva in Fidra e ricarica';
      b.style.cssText = 'margin-top:10px;background:#E8751A;color:#fff;border:0;border-radius:6px;' +
        'padding:10px 18px;font:600 13px Arial;cursor:pointer;';
      b.onclick = async () => {
        const salva = pulsanteSalvaFidra();
        if (!salva) {
          box2.style.color = '#B3541E';
          box2.textContent = 'Non trovo il pulsante Salva di Fidra: premilo tu, '
            + 'poi ricarica la pagina — se non ricarichi, l’offerta esce col prezzo vecchio.';
          return;
        }
        b.disabled = true;
        b.textContent = 'Salvo…';
        salva.click();
        /* Livewire risponde via rete: si aspetta un attimo perche' il
           ricaricamento non arrivi prima del salvataggio */
        await new Promise(r => setTimeout(r, 1500));
        location.reload();
      };
      box2.parentNode.insertBefore(b, box2.nextSibling);
      box2.textContent += ' Ora premi qui sotto: senza ricaricare, l’offerta uscirebbe col prezzo vecchio.';
    }
    document.getElementById('scCopia').onclick = async () => {
      try { await navigator.clipboard.writeText(testoCopia); document.getElementById('scEsito').textContent = 'Copiato.'; }
      catch (e) { document.getElementById('scEsito').textContent = 'Copia non riuscita: selezionalo a mano.'; }
    };
  }

  /* ---------- pulsante ---------- */
  function pulsante() {
    if (document.getElementById('leoDispBtn')) return;
    const b = document.createElement('button');
    b.id = 'leoDispBtn';
    /* stile addosso al pulsante: cosi' si vede anche prima che il foglio
       CSS del pannello venga iniettato (bug della prima 1.3.0) */
    b.style.cssText =
      'position:fixed;bottom:76px;right:24px;z-index:2147483645;' +
      'padding:12px 20px;border:0;border-radius:8px;cursor:pointer;' +
      'font:600 14px Arial;color:#fff;background:#1E7F88;' +
      'box-shadow:0 3px 12px rgba(0,0,0,.3);';
    b.textContent = '\u{1F50E} Disponibilit\u00e0 e prezzi';
    b.title = 'Quali camere sono libere (con i numeri) e quanto costano';
    b.addEventListener('click', apri);
    document.body.appendChild(b);
  }
  if (ESTENSIONE) {
    pulsante();
    setInterval(pulsante, 3000);
  } else {
    apri();   /* dal segnalibro: subito la finestra */
  }
})();
