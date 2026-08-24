/* ============================================================
   Offerta Leonardo — popup
   ============================================================ */

let DATI = null;
let MODO = 'fidra';   // 'fidra' = dalla prenotazione aperta · 'rapido' = fuori da Fidra

const FIRME = [
  'La Reception',
  'La Reception — Sibilla',
  'La Reception — Marco',
  'La Reception — Elena',
  'La Reception — Beatrice'
];

/* capienza massima e camere per categoria — foglio interno reception */
const CAPIENZA = {
  'junior suite monteortone': { max: 4, camere: ['331','431'] },
  'junior suite abano':       { max: 3, camere: ['218','318','418','519','521','523','525','527'] },
  'junior suite colli':       { max: 2, camere: ['217','317','417','232','332','432','610','620'] },
  'suite monteortone':        { max: 4, camere: ['529','630','640'] },
  'suite colli':              { max: 2, camere: ['533','600'] },
  'junior suite accessibile': { max: 2, camere: ['650'] }
};

/* camere che in Fidra non corrispondono a una vera sistemazione vendibile */
const CAMERE_FITTIZIE = {
  '651': 'usata come camera d\'appoggio, non è una suite',
  '652': 'usata come camera d\'appoggio, non è una suite',
  '653': 'camera del personale, non vendibile',
  '654': 'camera del personale, non vendibile'
};

function limiteCategoria(categoria) {
  const c = (categoria || '').toLowerCase();
  let best = '';
  for (const k in CAPIENZA) { if (c.includes(k) && k.length > best.length) best = k; }
  return best ? CAPIENZA[best] : null;
}

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

document.addEventListener('DOMContentLoaded', avvia);

async function avvia() {
  /* --- pannello laterale di Edge: stessa pagina, larghezza fluida --- */
  const inPannello = location.search.includes('pannello=1');
  if (inPannello) {
    document.body.style.width = 'auto';
    document.body.style.minWidth = '320px';
    const c = document.querySelector('.corpo');
    if (c) c.style.maxHeight = 'none';
    piedePannello();
  } else if (chrome.sidePanel) {
    const piede = document.querySelector('footer');
    if (piede && !document.getElementById('apriPannello')) {
      const a = document.createElement('a');
      a.id = 'apriPannello';
      a.href = '#';
      a.textContent = '\ud83d\udccc Tieni fisso a lato (non si chiude da solo)';
      a.style.cssText = 'display:block;text-align:center;padding:6px 0 0;color:#1E7F88;font-size:12px;text-decoration:none;';
      piede.appendChild(a);
      a.addEventListener('click', async ev => {
        ev.preventDefault();
        try {
          const [t2] = await chrome.tabs.query({ active: true, currentWindow: true });
          // preferenza: da ora il clic sull'icona apre direttamente il pannello
          await chrome.storage.local.set({ pannelloFisso: true });
          await chrome.sidePanel.open({ windowId: t2.windowId });
          window.close();
        } catch (e) {
          $('esito').textContent = 'Pannello laterale non disponibile: ' + e.message;
        }
      });
    }
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!/leonardo\.fidra\.cloud\/customers\/\d+\/reservations\/\d+/.test(tab.url || '')) {
    await disegnaRapido();
    return;
  }

  let d;
  try {
    d = await chrome.tabs.sendMessage(tab.id, { tipo: 'ESTRAI' });
  } catch (e) {
    $('titolo').textContent = 'Pagina non pronta';
    $('corpo').innerHTML = '<div class="errore">Ricarica la pagina di Fidra e riapri l\'estensione.</div>'
      + linkRapido();
    agganciaLinkRapido();
    return;
  }

  if (!d || !d.ok) {
    $('titolo').textContent = 'Errore di lettura';
    $('corpo').innerHTML = `<div class="errore">${esc(d?.errore || 'dati non leggibili')}</div>`
      + linkRapido();
    agganciaLinkRapido();
    return;
  }

  DATI = d;
  await disegna(d);
}

/* --- scadenza già passata? --- */
function scadenzaPassata(s) {
  const M = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
  const m = (s||'').match(/(\d{1,2})\s+([A-Za-z]{3})\s+(20\d\d)/);
  if (!m) return false;
  const oggi = new Date(); oggi.setHours(0,0,0,0);
  return new Date(+m[3], M[m[2]], +m[1]) < oggi;
}

/* v2.9.4 — camere alternative: l'ospite ne sceglie una.

   Non si indovina dai dati: alternative, cambio camera e due soggiorni
   distinti di persone diverse hanno lo stesso aspetto in Fidra. Lo dice
   l'operatore con la spunta, e da qui in poi ogni camera diventa una
   soluzione con il suo totale e la sua caparra — calcolata sui SUOI adulti,
   con la stessa regola di sempre (75 € ad adulto), non sulla somma.

   Si scrive dentro `d` invece di passare un parametro: `d` arriva gia' a
   tutte e quattro le lingue, un parametro nuovo andrebbe aggiunto a otto
   funzioni e dimenticato in una — ed e' il difetto che pulsanti.test.ts
   sorveglia da mesi. */
const CAPARRA_ADULTO = 75;
function preparaAlternative(d, attivo) {
  d.alternative = !!attivo;
  (d.camere || []).forEach((c, i) => {
    if (!attivo) { delete c.soluzione; delete c.accontoSoluzione; return; }
    c.soluzione = i + 1;
    c.accontoSoluzione = (c.adulti || 0) * CAPARRA_ADULTO;
  });
}

/* --- deduzioni automatiche --- */
function deduci(d) {
  const trattamenti = d.camere.map(c => (c.trattamento||'').toUpperCase()).join(' ');
  const note = d.note.map(n => n.testo.toLowerCase()).join(' ');
  const mese = new Date().getMonth(); // 0=gen … 10=nov
  return {
    promo: (mese >= 10 || mese <= 1),   // novembre → febbraio
    cure: /\bCUR[AE]|FANGO|TERMAL|DOLCE VITA/.test(trattamenti) || (d.notti || 0) > 5,
    cureMotivo: /\bCUR[AE]|FANGO|TERMAL|DOLCE VITA/.test(trattamenti) ? 'dal trattamento'
              : ((d.notti || 0) > 5 ? `${d.notti} notti` : ''),
    cane: /\bcane\b|\bcani\b|\bhund\b|\bcagnolin/.test(note),
    straniero: d.paese && d.paese !== 'IT',
    /* v2.0: se lo sconto e' gia' registrato in Fidra — come voce di extra
       ("Soggiorno/Pensione sconto") o annotato in portineria — la casella
       si spunta da sola: chiederlo a chi scrive l'email significava
       dimenticarlo, e l'ospite riceveva un prezzo scontato senza
       nessuna riga che glielo dicesse. */
    fedelta: (d.extra || []).some(e => e.sconto) || /\b5\s*%|fedelt|treue|stammgast/i.test(note),
    fedeltaMotivo: (d.extra || []).some(e => e.sconto)
      ? 'sconto gi&agrave; in prenotazione'
      : (/\b5\s*%|fedelt|treue|stammgast/i.test(note) ? 'dalle note' : '')
  };
}

async function disegna(d) {
  $('titolo').textContent = d.intestatario || '—';
  const auto = deduci(d);
  const salvate = await chrome.storage.local.get(['firma', 'hotelKey']);

  const bloccante = d.mancanti.length > 0;
  let h = '';

  if (bloccante) {
    h += `<div class="errore"><strong>Non genero l'email: mancano dei dati.</strong>
      <ul>${d.mancanti.map(m => `<li>${esc(m)}</li>`).join('')}</ul>
      Completa la prenotazione in Fidra e riapri.</div>`;
  }

  /* v1.6: avvisi dall'estrattore. Non bloccano — l'email esce già con i
     numeri giusti — ma chiedono un controllo della pratica in Fidra. */
  (d.avvisi || []).forEach(a => {
    const titolo = a.tipo === 'totale-divergente' ? 'Totale corretto con i prezzi per ospite.'
                 : a.tipo === 'caparra-eccedente' ? 'Acconto superiore al totale.'
                 : a.tipo === 'scala-illeggibile' ? 'Prezzi API non decifrabili.'
                 : a.tipo === 'bambino-senza-prezzo' ? 'Quota bambino non trovata.'
                 : a.tipo === 'date-ospiti-implausibili' ? 'Date per ospite scartate.'
                 : a.tipo === 'extra-inclusi' ? 'Extra compresi nel totale.'
                 : a.tipo === 'extra-non-calcolabile' ? 'Extra non conteggiato.'
                 : 'Avviso.';
    const classe = a.tipo === 'extra-inclusi' ? 'box' : 'errore';
    h += `<div class="${classe}"><strong>${titolo}</strong> ${esc(a.testo)}</div>`;
  });

  /* v2.9.4: le camere non si sovrappongono. Puo' voler dire tre cose
     diverse — alternative fra cui scegliere, stesse persone che cambiano
     camera, oppure due soggiorni distinti di persone diverse — e nei dati
     hanno lo stesso aspetto. Non si indovina: si chiede, e solo qui, dove
     la domanda ha senso. */
  if (d.camereNonSovrapposte) {
    const u = d.personeUnaSoluzione || {};
    const note = d.note.map(n => (n.testo || '').toLowerCase()).join(' ');
    const spia = /alternativ|oppure|a scelta|x\s*\d\s*date|due date|2 date|opzion/i.exec(note);
    h += `<div class="box"><strong>Camere con periodi che non si sovrappongono.</strong>
      L&apos;offerta le somma: ${d.adulti} ${d.adulti === 1 ? 'adulto' : 'adulti'}${
        d.bambini ? ` e ${d.bambini} bambin${d.bambini === 1 ? 'o' : 'i'}` : ''},
      caparra ${esc(euroFmt(d.acconto))} &euro;. Giusto se all&apos;ospite servono
      davvero tutte e due.
      <label style="margin-top:6px;"><input type="checkbox" id="optAlternative"
        ${spia ? 'checked' : ''} /> <strong>Sono alternative</strong>: l&apos;ospite ne sceglie una
        ${u.adulti != null ? `<span class="sub">(${u.adulti} ${u.adulti === 1 ? 'adulto' : 'adulti'}${
          u.bambini ? ` e ${u.bambini} bambin${u.bambini === 1 ? 'o' : 'i'}` : ''} per soluzione)</span>` : ''}</label>
      ${spia ? `<div class="sub" style="color:#5A7A3E;">Spuntata dalla nota
        &laquo;${esc(spia[0])}&raquo; &mdash; verifica prima di mandare.</div>` : ''}</div>`;
  }
  d.camere.forEach((c, i) => {
    if (c && c.soggiornanti && c.soggiornanti.length > 1 && (c.prezziDiversi || c.periodiOspitiDiversi)) {
      const cosa = c.prezziDiversi && c.periodiOspitiDiversi ? 'prezzi e date'
                 : c.prezziDiversi ? 'prezzi' : 'date';
      h += `<div class="box">Camera ${i + 1} (${esc(c.categoria || ('n. ' + c.numero))}):
        ospiti con <strong>${cosa} diversi</strong> — nell'email compaiono su righe separate,
        con il totale camera come somma (${esc((c.totaleCamera ?? 0).toLocaleString('it-IT',
        { minimumFractionDigits: 2 }))} &euro;).</div>`;
    }
  });

  if (!bloccante && !d.linkPagamento && !/conferma/i.test(d.stato || '')) {
    h += `<div class="box">Nessun link di pagamento in Fidra: l'offerta uscir&agrave;
      <strong>solo con il bonifico</strong>, senza il pulsante per la carta.
      <div class="sub">Se lo vuoi, genera il link in Fidra e riapri.</div></div>`;
  }

  if (d.stato && d.stato.toLowerCase() !== 'offerta') {
    h += `<div class="box">Prenotazione in stato <strong>${esc(d.stato)}</strong>, non "offerta".
      Verifica che sia giusto inviare una proposta.</div>`;
  }

  if (!d.email) {
    h += `<div class="box"><strong>L'ospite non ha un'email in anagrafica.</strong>
      L'email viene generata lo stesso: Outlook si apre senza destinatario,
      lo scrivi tu (e se lo aggiungi anche in Fidra, la prossima volta è automatico).</div>`;
  }
  if (d.giaInCasa) {
    h += `<div class="box"><strong>L'ospite è già in casa</strong>
      (check-in effettuato${d.checkinFatti > 1 ? ` per ${d.checkinFatti} persone` : ''}).
      Ha senso solo una <strong>conferma aggiornata</strong> — per esempio per un
      prolungamento del soggiorno: controlla date, camere e importi prima di inviare.</div>`;
  } else if (d.arrivoPassato) {
    h += `<div class="errore"><strong>La data di arrivo è già passata.</strong>
      Il soggiorno risulta iniziato il ${d.giornoArrivo} ${esc(d.mese)} ${d.anno}: verifica in Fidra
      prima di inviare qualsiasi cosa.</div>`;
  }

  if (d.stato && /conferma/i.test(d.stato) && !(d.caparraVersata > 0) && d.caparraDovuta !== null) {
    h += `<div class="box"><strong>Conferma senza acconto registrato.</strong>
      In Fidra la caparra versata risulta a zero o non &egrave; leggibile: se l'ospite ha
      pagato, scrivi l'importo nel campo &quot;Acconto ricevuto&quot; qui sotto,
      altrimenti l'email dir&agrave; &quot;abbiamo ricevuto il suo acconto&quot; con 0,00 &euro;.${
        d.caparraDebug ? `<br><span class="sub">Testo letto dalla pagina: <code>${
          String(d.caparraDebug).replace(/&/g,'&amp;').replace(/</g,'&lt;').slice(0,140)
        }</code></span>` : ''
      }</div>`;
  }

  const eccessi = [];
  d.camere.forEach(c => {
    const lim = limiteCategoria(c.categoria);
    if (!lim) return;
    const persone = (c.adulti || 0) + (c.bambini || 0);
    if (persone > lim.max) eccessi.push(`${c.categoria}: ${persone} persone, massimo ${lim.max}`);
    if (c.numero && lim.camere.length && !lim.camere.includes(String(c.numero)))
      eccessi.push(`camera ${c.numero} non risulta fra le ${c.categoria}`);
  });
  d.camere.forEach(c => {
    const f = CAMERE_FITTIZIE[String(c.numero)];
    if (f) eccessi.push(`camera ${c.numero}: ${f}`);
  });

  if (eccessi.length) {
    h += `<div class="box"><strong>Da controllare in Fidra:</strong>
      <ul style="margin:6px 0 0 16px;padding:0;">${eccessi.map(e=>`<li>${esc(e)}</li>`).join('')}</ul></div>`;
  }

  if (scadenzaPassata(d.scadenza)) {
    h += `<div class="errore"><strong>La scadenza è già passata</strong> (${esc(d.scadenza)}).
      Aggiornala in Fidra prima di inviare, altrimenti l'ospite legge una data scaduta.</div>`;
  }

  const isConferma = d.stato && /conferma/i.test(d.stato);
  h += `<h3>Tipo di documento</h3>
    <label><input type="radio" name="doc" value="offerta" ${isConferma ? '' : 'checked'}> Offerta</label>
    <label><input type="radio" name="doc" value="conferma" ${isConferma ? 'checked' : ''}> Conferma
      ${isConferma ? '<span class="sub">(stato in Fidra)</span>' : ''}</label>
    <label><input type="radio" name="doc" value="sollecito"> Sollecito offerta
      <span class="sub">${scadutaExtra(d.scadenza) ? '(opzione scaduta: il modello lo dice con garbo)' : '(opzione in scadenza)'}</span></label>
    <label><input type="radio" name="doc" value="dayspa"> Info Day Spa
      <span class="sub">(prezzi e istruzioni, non usa i dati del soggiorno)</span></label>
    <label><input type="radio" name="doc" value="buoni"> Buoni regalo
      <span class="sub">(rimanda alla pagina per l'acquisto online)</span></label>
    <label class="sub" style="padding-top:6px;">Acconto ricevuto in &euro; (usato solo dalla conferma)</label>
    <input id="accontoRicevuto" inputmode="decimal"
      value="${d.caparraVersata > 0 ? d.caparraVersata.toLocaleString('it-IT', {minimumFractionDigits:2}) : ''}"
      placeholder="${d.caparraVersata > 0 ? '' : 'non letto da Fidra — inserisci a mano'}"
      style="width:100%;padding:7px;border:1px solid #ddd;border-radius:4px;font-family:inherit;font-size:13px;" />
    <div class="sub">La conferma calcola il saldo da questo importo. Precompilato dalla
      &quot;Caparra Disponibile&quot; di Fidra; correggilo se non torna.</div>
    <label style="padding-top:8px;"><input type="checkbox" id="optArrivo"
      ${salvate.hotelKey ? 'checked' : 'disabled'}>
      Metti nella conferma il pulsante &quot;Prepara il suo arrivo&quot;</label>
    <div class="sub" id="arrivoStato" style="padding-left:22px;">${salvate.hotelKey
      ? `Chiave salvata (…${esc(String(salvate.hotelKey).slice(-4))})`
      : 'Serve la chiave hotel (la x-hotel-key di Supabase): impostala qui sotto.'}</div>
    <a href="#" id="arrivoImposta" class="sub" style="color:#1E7F88;display:inline-block;padding-left:22px;">Chiave hotel&hellip;</a>
    <div id="arrivoArea" style="display:none;padding:6px 0 0 22px;">
      <input id="arrivoChiave" type="password" placeholder="chiave condivisa x-hotel-key"
        style="width:100%;padding:7px;border:1px solid #ddd;border-radius:4px;font-family:inherit;font-size:13px;" />
      <button type="button" class="sec" id="arrivoSalva" style="width:auto;">Salva la chiave</button>
    </div>`;

  h += `<h3>Soggiorno</h3>
    <div class="riga"><span class="k">Date</span><span class="v">${d.giornoArrivo}–${d.giornoPartenza} ${esc(d.mese)} ${d.anno ?? '?'}</span></div>
    <div class="riga"><span class="k">Notti</span><span class="v">${d.notti ?? '?'}</span></div>
    <div class="riga"><span class="k">Ospiti</span><span class="v">${d.adulti} adulti · ${d.bambini} bambini</span></div>
    <div class="riga"><span class="k">Scadenza offerta</span><span class="v">${esc(d.scadenza || '—')}</span></div>
    ${d.fonteAnno && d.fonteAnno !== 'scadenza offerta' ? `<div class="sub">Anno ${d.anno} dedotto dalla ${esc(d.fonteAnno)} — verifica</div>` : ''}`;

  h += `<h3>Camere</h3>`;
  d.camere.forEach(c => {
    h += `<div class="cam"><b>${esc(c.categoria)}</b> n. ${esc(c.numero)}
      &middot; ${c.adulti} ad.${c.bambini ? ' · ' + c.bambini + ' bamb.' + (c.etaBambini ? ' (' + esc(c.etaBambini) + ')' : '') : ''}<br />
      <span class="sub">${esc(c.trattamento || '—')} — ${c.totalePP?.toLocaleString('it-IT',{minimumFractionDigits:2})} € p.p.</span></div>`;
  });

  h += `<h3>Importi</h3>
    <div class="riga"><span class="k">Totale</span><span class="v">${d.totaleFmt ?? '—'} €</span></div>
    <div class="riga"><span class="k">Acconto</span><span class="v">${d.accontoFmt} €</span></div>
    <div class="riga"><span class="k">Saldo all'arrivo</span><span class="v">${d.saldoFmt ?? '—'} €</span></div>`;

  h += `<h3>Destinatario</h3>`;
  if (d.email) {
    h += `<label><input type="radio" name="dest" value="${esc(d.email)}" checked>
      ${esc(d.email)} <span class="sub">(intestatario)</span></label>`;
  }
  d.emailAlternative.forEach(e => {
    const nota = d.note.find(n => n.testo.includes(e));
    h += `<label><input type="radio" name="dest" value="${esc(e)}">
      ${esc(e)} <span class="sub">(dalle note${nota ? ' del ' + esc(nota.data) : ''})</span></label>`;
  });
  if (d.emailAlternative.length) {
    h += `<div class="box sub">Nelle note c'è più di un indirizzo. Scegli tu: l'estensione non decide.</div>`;
  }

  const PAESE_LINGUA = { IT:'it', DE:'de', AT:'de', CH:'de', FR:'fr', BE:'fr', LU:'fr', MC:'fr' };
  const prof = d.profilo || {};
  const lngDaProfilo = ['it','de','en','fr'].includes(prof.lingua) ? prof.lingua : null;
  const lngAuto = lngDaProfilo || PAESE_LINGUA[d.paese] || (d.paese ? 'en' : 'it');
  const origineLingua = lngDaProfilo ? 'dal campo Lingua di Fidra'
                      : (d.paese ? `dedotta dal paese ${esc(d.paese)} — in Fidra la lingua non è impostata` : 'predefinita');
  const sel = (l) => lngAuto === l ? 'checked' : '';
  h += `<h3>Lingua</h3>
    <label><input type="radio" name="lng" value="it" ${sel('it')}> Italiano</label>
    <label><input type="radio" name="lng" value="de" ${sel('de')}> Deutsch</label>
    <label><input type="radio" name="lng" value="en" ${sel('en')}> English</label>
    <label><input type="radio" name="lng" value="fr" ${sel('fr')}> Français</label>
    <div class="sub">Preselezione ${origineLingua} — correggibile</div>`;

  const gen = prof.sesso;
  h += `<h3>Come rivolgersi</h3>
    <label><input type="radio" name="gen" value="F" ${gen === 'F' ? 'checked' : ''}> Femminile — Signora / Frau / Mrs / Madame</label>
    <label><input type="radio" name="gen" value="M" ${gen === 'M' ? 'checked' : ''}> Maschile — Signor / Herr / Mr / Monsieur</label>
    <label><input type="radio" name="gen" value="N" ${gen ? '' : 'checked'}> Neutro</label>
    <div class="sub">${gen ? 'Dal campo Sesso di Fidra' : 'In Fidra il campo Sesso è vuoto: controlla prima di generare'}</div>
    <label class="sub" style="padding-top:6px;">Titolo (facoltativo: Dr., Prof.)</label>
    <input id="titoloOspite" placeholder="es. Dr." style="width:100%;padding:7px;border:1px solid #ddd;border-radius:4px;font-family:inherit;font-size:13px;" />`;

  h += `<h3>Blocchi da includere</h3>
    <label><input type="checkbox" id="optCure" ${auto.cure ? 'checked' : ''}> Cure termali
      ${auto.cure ? `<span class="sub">(${auto.cureMotivo})</span>` : ''}</label>
    <label><input type="checkbox" id="optCane" ${auto.cane ? 'checked' : ''}> Cane al seguito
      ${auto.cane ? '<span class="sub">(dalle note)</span>' : ''}</label>
    <label><input type="checkbox" id="optPromo" ${auto.promo ? 'checked' : ''}> Sconto 3% pagamento anticipato
      ${auto.promo ? '<span class="sub">(periodo promozionale)</span>' : ''}</label>
    <label><input type="checkbox" id="optFedelta" ${auto.fedelta ? 'checked' : ''}> Sconto 5% fedeltà
      <span class="sub">${auto.fedeltaMotivo || '(dal 5° soggiorno)'}</span></label>`;

  h += `<h3>Dettaglio del soggiorno</h3>
    <div class="sub" style="padding-bottom:6px;">Facoltativo. Una riga per periodo: l'ospite lo vede sotto la camera.
    Utile quando il soggiorno cambia trattamento.</div>
    <textarea id="dettaglio" rows="4" placeholder="1ª settimana — mezza pensione&#10;2ª settimana — Dolce Vita con 5 fanghi&#10;3ª settimana — mezza pensione"
      style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-family:inherit;font-size:13px;resize:vertical;"></textarea>`;

  h += `<h3>Firma</h3>
    <select id="firma" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-family:inherit;font-size:13px;">
      ${(() => {
        /* v1.1.1: preseleziona la firma dell'operatore loggato in Fidra;
           se non e' in lista, la aggiunge. La scelta manuale resta possibile. */
        let lista = FIRME.slice();
        let scelta = salvate.firma;
        if (d.operatore) {
          // solo il nome di battesimo: "Marco Scapin" → "Marco"
          let nomeOp = String(d.operatore).trim().split(/\s+/)[0];
          /* v1.8.6: in Fidra l'utenza di Elena è registrata come "Nena".
             Nelle email agli ospiti va il nome vero. */
          if (/^nena$/i.test(nomeOp)) nomeOp = 'Elena';
          const match = lista.find(f => f.toLowerCase().includes(nomeOp.toLowerCase()));
          if (match) scelta = match;
          else { const nuova = `La Reception — ${nomeOp}`; lista.splice(1, 0, nuova); scelta = nuova; }
        }
        return lista.map(f => `<option ${f === scelta ? 'selected' : ''}>${esc(f)}</option>`).join('');
      })()}
    </select>
    ${d.operatore ? `<div class="sub">Preselezionata dall'accesso Fidra: ${esc(String(d.operatore).trim().split(/\s+/)[0])}</div>` : ''}`;

  h += `<label style="padding-top:10px;"><input type="checkbox" id="optOutlook" checked>
    Apri Outlook con destinatario e oggetto gi&agrave; scritti</label>`;

  h += `<h3>Corrispondenza</h3>
    <div class="sub" style="padding-bottom:6px;">Apre Outlook e cerca da solo.</div>`;
  const ricerche = [];
  if (d.email) ricerche.push({ q: d.email, et: `Email di ${d.email}` });
  if (d.numeroOfferta) ricerche.push({ q: d.numeroOfferta, et: `Pratica ${d.numeroOfferta}` });
  ricerche.forEach((r, i) => {
    h += `<div class="cam"><a href="#" class="cerca" data-q="${esc(r.q)}"
      style="color:#1E7F88;text-decoration:none;font-size:13px;">&#128269; ${esc(r.et)}</a></div>`;
  });

  if (d.note.length) {
    h += `<h3>Note dai reparti</h3>`;
    d.note.forEach(n => {
      h += `<div class="cam sub"><b>${esc(n.reparto)}</b> ${esc(n.data)}<br />${esc(n.testo)}</div>`;
    });
  }

  $('corpo').innerHTML = h;
  $('copia').disabled = bloccante;

  /* v1.9.9: se dal riquadro "Notte per notte" e' stato preparato un
     dettaglio, lo si trova gia' scritto qui invece di doverlo incollare.
     Vale mezz'ora e solo se il campo e' vuoto: quanto ha scritto
     l'operatore non si sovrascrive mai. */
  (async () => {
    try {
      const r = await chrome.storage.local.get(['leonardo_dettaglio']);
      const dt = r.leonardo_dettaglio;
      if (!dt || !dt.testo) return;
      if (Date.now() - (dt.quando || 0) > 30 * 60 * 1000) return;
      /* deve essere la stessa prenotazione: il dettaglio di un'altra pratica
         sarebbe peggio di un campo vuoto, perche' sembra giusto */
      const idOra = String((DATI && DATI.id) || '');
      if (dt.prenotazione && idOra && dt.prenotazione !== idOra) return;
      if (dt.prenotazione && !idOra) return;   // fuori da una prenotazione: non si applica
      const campo = $('dettaglio');
      if (!campo || campo.value.trim()) return;
      campo.value = dt.testo;
      /* v2.1.4: si ricorda anche a quale camera si riferisce, cosi' in email
         il titolo lo dice e non sembra riferito all'ultima stampata */
      window.__leoDettaglioCamera = dt.camera || '';
      /* usato una volta, si mette via: se l'operatore lo svuota di proposito
         e riapre il pannello, non deve ricomparire da solo */
      chrome.storage.local.remove('leonardo_dettaglio');
      /* v2.0: il dettaglio dice anche quali sconti sono stati calcolati.
         Se ci sono, le caselle si spuntano da sole: era assurdo che il
         pannello calcolasse il 5% e poi l'email non lo nominasse perche'
         qualcuno non aveva messo la spunta. */
      if (/fedelt|treuerabatt/i.test(dt.testo)) {
        const c = $('optFedelta'); if (c && !c.checked) c.checked = true;
      }
      if (/pagamento anticipato|vorauszahlung/i.test(dt.testo)) {
        const c = $('optPromo'); if (c && !c.checked) c.checked = true;
      }
      const nota = document.createElement('div');
      nota.className = 'sub';
      nota.style.cssText = 'padding-top:5px;color:#5A7A3E;';
      nota.textContent = 'Compilato dal calcolo notte per notte'
        + (dt.camera ? ' (' + dt.camera + ')' : '') + '. Puoi modificarlo o svuotarlo.';
      campo.insertAdjacentElement('afterend', nota);
    } catch (e) { /* senza dettaglio si prosegue come sempre */ }
  })();

  $('firma').addEventListener('change', e =>
    chrome.storage.local.set({ firma: e.target.value }));

  $('arrivoImposta')?.addEventListener('click', ev => {
    ev.preventDefault();
    const a = $('arrivoArea');
    a.style.display = a.style.display === 'none' ? 'block' : 'none';
  });
  $('arrivoSalva')?.addEventListener('click', async () => {
    const k = $('arrivoChiave').value.trim();
    if (!k) return;
    await chrome.storage.local.set({ hotelKey: k });
    $('arrivoChiave').value = '';
    $('arrivoArea').style.display = 'none';
    $('optArrivo').disabled = false;
    $('optArrivo').checked = true;
    $('arrivoStato').textContent = `Chiave salvata (…${k.slice(-4)})`;
  });

  mostraAccontoAnnunciato();
  mostraCodaSolleciti();

  document.querySelectorAll('a.cerca').forEach(a => {
    a.addEventListener('click', async ev => {
      ev.preventDefault();
      // v1.1.1: la ricerca la esegue outlook-inject.js su outlook.office.com.
      // Gli appunti restano come riserva (Ctrl+V nella casella di ricerca).
      try { await navigator.clipboard.writeText(a.dataset.q); } catch (e) {}
      await chrome.storage.local.set({ leonardo_ricerca_outlook: {
        q: a.dataset.q, creato: Date.now()
      }});
      chrome.tabs.create({ url: 'https://outlook.office.com/mail/' });
      $('esito').textContent = `Apro Outlook e cerco "${a.dataset.q}"`;
    });
  });
}

/* ============================================================
   Preventivo rapido — offerta senza prenotazione in Fidra
   ============================================================ */

const MESI_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const euroFmt = (n) => {
  const [int, dec] = n.toFixed(2).split('.');
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + dec;
};

function linkRapido() {
  /* v2.9: non dice piu' «preventivo rapido». Adesso il preventivo esiste
     davvero, e nasce dal riquadro in Fidra: chiamare cosi' questo link
     manderebbe a cercare un modulo che non c'e' piu'. */
  return `<div class="box sub" style="margin-top:10px;">Oppure <a href="#" id="vaiRapido"
    style="color:#1E7F88;">rispondi senza leggere la pagina</a>.</div>`;
}
function agganciaLinkRapido() {
  const a = document.getElementById('vaiRapido');
  if (a) a.addEventListener('click', ev => { ev.preventDefault(); disegnaRapido(); });
}

async function disegnaRapido() {
  MODO = 'rapido';
  DATI = null;
  const salvate = await chrome.storage.local.get(['firma']);
  $('titolo').textContent = 'Fuori da Fidra';

  $('corpo').innerHTML = `
    <div class="box">Offerte, conferme e solleciti si generano <strong>solo dalla
      prenotazione aperta in Fidra</strong>: apri la scheda del cliente e riapri
      l&apos;estensione. Cos&igrave; i dati sono quelli veri, non ricopiati.
      <div class="sub">Su Fidra trovi anche &#128270; Disponibilit&agrave; e prezzi,
      in basso a destra.</div></div>

    <h3>Che cosa mandi</h3>
    <div class="sub" style="margin-bottom:8px;">Questi due documenti non usano i dati del
      soggiorno: prezzi e istruzioni sono nel modello, serve solo a chi &egrave; rivolto.
      Sono le richieste che arrivano per email e non passano da Fidra.
      <div style="padding-top:4px;">Il <strong>preventivo</strong> si fa invece dal riquadro
      &#128270; Disponibilit&agrave; e prezzi dentro Fidra, che apre Outlook da solo.</div></div>
    <label><input type="radio" name="doc" value="dayspa" checked /> Info Day Spa
      <span class="sub">(ingressi, orari, come prenotare)</span></label>
    <label><input type="radio" name="doc" value="buoni" /> Buoni regalo
      <span class="sub">(come si compone, prezzi, validit&agrave;, acquisto online)</span></label>

    <h3>A chi &egrave; rivolto</h3>
    <label>Cognome e nome <span class="sub">(facoltativo: senza, l&apos;email saluta
      &laquo;Gentile Ospite&raquo;)</span><br />
      <input type="text" id="rapNome" placeholder="es. Bianchi Maria" /></label>
    <label>Email (facoltativa: apre Outlook gi&agrave; indirizzato)<br />
      <input type="text" id="rapEmail" placeholder="ospite@esempio.it" /></label>

    <h3>Come rivolgersi</h3>
    <label><input type="radio" name="gen" value="F" /> Femminile &mdash; Signora / Frau / Mrs / Madame</label>
    <label><input type="radio" name="gen" value="M" /> Maschile &mdash; Signor / Herr / Mr / Monsieur</label>
    <label><input type="radio" name="gen" value="N" checked /> Neutro</label>

    <h3>Lingua</h3>
    <label><input type="radio" name="lng" value="it" checked /> Italiano</label>
    <label><input type="radio" name="lng" value="de" /> Deutsch</label>
    <label><input type="radio" name="lng" value="en" /> English</label>
    <label><input type="radio" name="lng" value="fr" /> Fran&ccedil;ais</label>

    <h3>Firma</h3>
    <input type="text" id="firma" value="${esc(salvate.firma || 'La Reception')}" />
    <label style="margin-top:8px;"><input type="checkbox" id="optOutlook" checked />
      Apri Outlook Web con l&apos;email pronta</label>`;

  $('firma').addEventListener('change', () =>
    chrome.storage.local.set({ firma: $('firma').value }));
  $('copia').disabled = false;
}

/* legge il modulo e costruisce lo stesso oggetto dati dell'estrattore Fidra */
function costruisciDatiRapidi() {
  const errori = [];
  const oggi0 = new Date(); oggi0.setHours(0, 0, 0, 0);

  const nome = $('rapNome').value.trim();
  const senzaSoggiorno = ['dayspa', 'buoni'].includes(
    document.querySelector('input[name=doc]:checked')?.value);
  /* v2.0.5: per Info Day Spa e Buoni regalo il nome e' facoltativo — spesso
     la richiesta arriva da un indirizzo senza firma. Senza nome l'email
     saluta in modo generico ("Gentile Ospite", "Sehr geehrte Damen und
     Herren"). Per offerte e conferme resta obbligatorio. */
  if (!nome && !senzaSoggiorno) errori.push('cognome e nome dell\'ospite');

  /* Info Day Spa: prezzi e istruzioni sono nel modello, serve solo l'ospite */
  if (['dayspa', 'buoni'].includes(document.querySelector('input[name=doc]:checked')?.value)) {
    if (errori.length) return { errori };
    return { dati: {
      /* v2.0.4: vale sia per Info Day Spa sia per Buoni regalo — arrivano
         entrambi per email e non hanno una prenotazione dietro */
      ok: true, rapido: true, dayspa: true, id: null, numeroOfferta: null,
      linkPagamento: null, stato: 'senza soggiorno',
      intestatario: nome, email: $('rapEmail').value.trim(),
      emailAlternative: [], note: [], mancanti: [], profilo: {},
      camere: [], nCamere: 0, adulti: 0, bambini: 0,
      caparraVersata: 0, caparraDovuta: null
    } };
  }

  /* Non c'e' nessun altro documento che il pannello sappia fare fuori da
     Fidra. Il modulo che chiedeva camere e prezzi a mano stava qui ed e'
     stato tolto il 24 agosto 2026: e' il caso Kreiner, «ho copiato il
     modello con prezzi dus non inseriti». Un prezzo digitato e' un prezzo
     sbagliato, e adesso c'e' un modo di leggerlo.

     v2.9.1: e il preventivo non passa piu' di qui. Si fa per intero nel
     riquadro «Disponibilita' e prezzi», che ha i prezzi sotto gli occhi e
     apre Outlook da solo: farlo passare anche dal pannello voleva dire due
     finestre e quattro gesti per una cosa sola. */
  return { errori: ['un documento che il pannello sappia fare senza Fidra'] };
}

/* modulo → DATI. Usato da entrambi i pulsanti del footer.
   Nessun link di pagamento: la carta passa da Fidra, che registra la caparra. */
async function preparaDatiRapidiConLink() {
  const r = costruisciDatiRapidi();
  if (r.errori) { $('esito').textContent = 'Manca: ' + r.errori.join(' \u00b7 '); return false; }
  DATI = r.dati;
  $('esito').textContent = '';
  return true;
}



/* ---------- conferma con caparra a zero: bonifico annunciato? ----------
   Molti clienti pagano con bonifico e mandano subito la copia: la conferma
   parte prima che i soldi arrivino. In quel caso "Acconto ricevuto 0,00" è
   sbagliato e suona pure male. Qui l'operatore sceglie la dicitura giusta. */
function mostraAccontoAnnunciato() {
  if (!DATI || MODO !== 'fidra') return;
  const versata = DATI.caparraVersata || 0;
  const dovuta = DATI.caparraDovuta || DATI.acconto || 0;
  if (versata > 0 || dovuta <= 0) return;   // c'è già, o non è previsto acconto

  const div = document.createElement('div');
  div.className = 'box';
  div.id = 'boxAnnunciato';
  div.style.cssText = 'margin-bottom:10px;display:none;';
  div.innerHTML = `Caparra a <strong>0,00 &euro;</strong> in Fidra, ma la conferma prevede
    un acconto di <strong>${(dovuta).toLocaleString('it-IT', { minimumFractionDigits: 2 })} &euro;</strong>. Cosa scrivo?
    <label style="display:block;padding-top:6px;"><input type="radio" name="accontoScelta" value="annunciato" checked />
      Bonifico annunciato: ho la copia &rarr; "abbiamo ricevuto la copia del suo bonifico", acconto contato</label>
    <label style="display:block;"><input type="radio" name="accontoScelta" value="zero" />
      Davvero nessun acconto &rarr; "acconto ricevuto 0,00 &euro;", saldo pieno</label>
    <div class="sub">Se in Fidra la caparra dovrebbe esserci ed &egrave; a zero, forse &egrave; solo da registrare.</div>`;
  $('corpo').prepend(div);

  const aggiorna = () => {
    const doc = document.querySelector('input[name=doc]:checked')?.value;
    div.style.display = (doc === 'conferma') ? '' : 'none';
  };
  document.querySelectorAll('input[name=doc]').forEach(r => r.addEventListener('change', aggiorna));
  aggiorna();
}

/* ---------- piede del pannello laterale (v1.2) ----------
   Edge non riapre il pannello al riavvio e l'API non consente di
   aprirlo da soli: qui si spiega come riaprirlo in un gesto solo. */
async function piedePannello() {
  const piede = document.querySelector('footer');
  if (!piede || document.getElementById('notaPannello')) return;
  const { pannelloFisso } = await chrome.storage.local.get(['pannelloFisso']);
  const nota = document.createElement('div');
  nota.id = 'notaPannello';
  nota.style.cssText = 'padding:8px 0 0;text-align:center;color:#8C8578;font-size:11px;line-height:17px;';
  nota.innerHTML = pannelloFisso
    ? `Al riavvio di Edge il pannello non torna da solo: lo riapri con un clic
       sull&apos;icona nella barra, o con <strong>Ctrl+Shift+L</strong>.<br />
       <a href="#" id="sganciaPannello" style="color:#1E7F88;">Torna alla finestrella</a>`
    : `<a href="#" id="fissaPannello" style="color:#1E7F88;">\ud83d\udccc Fai aprire il pannello dall&apos;icona</a>
       <br />Cos&igrave; dopo ogni riavvio basta un clic (o Ctrl+Shift+L).`;
  piede.appendChild(nota);

  document.getElementById('fissaPannello')?.addEventListener('click', async ev => {
    ev.preventDefault();
    await chrome.storage.local.set({ pannelloFisso: true });
    nota.remove();
    piedePannello();
  });
  document.getElementById('sganciaPannello')?.addEventListener('click', async ev => {
    ev.preventDefault();
    await chrome.storage.local.set({ pannelloFisso: false });
    nota.remove();
    piedePannello();
  });
}

/* ---------- coda solleciti dalla home di Fidra (v1.2) ----------
   fidra-scadenze.js salva l'elenco delle prenotazioni in scadenza;
   qui, se la prenotazione aperta e' in coda, il popup si presenta
   gia' sul sollecito con "X di N" e il collegamento alla prossima. */
async function mostraCodaSolleciti() {
  const { leonardo_coda_solleciti: coda } = await chrome.storage.local.get(['leonardo_coda_solleciti']);
  if (!coda || !Array.isArray(coda.voci) || !coda.voci.length) return;
  if (Date.now() - (coda.creato || 0) > 60 * 60 * 1000) {
    chrome.storage.local.remove('leonardo_coda_solleciti');
    return;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const id = ((tab && tab.url || '').match(/reservations\/(\d+)/) || [])[1];
  if (!id) return;
  const pos = coda.voci.findIndex(v => ((v.url || '').match(/reservations\/(\d+)/) || [])[1] === id);
  if (pos < 0) return;

  const radio = document.querySelector('input[name=doc][value=sollecito]');
  if (radio) radio.checked = true;

  const div = document.createElement('div');
  div.className = 'box';
  div.id = 'codaSolleciti';
  div.style.cssText = 'margin-bottom:10px;';
  const prossima = pos + 1 < coda.voci.length;
  div.innerHTML = `\u2709 Coda solleciti: <strong>${pos + 1} di ${coda.voci.length}</strong>` +
    (prossima
      ? ` &middot; <a href="#" id="codaProssima" style="color:#1E7F88;">prossima \u2192</a>`
      : ' &middot; ultima della coda') +
    ` &middot; <a href="#" id="codaChiudi" style="color:#C0392B;">chiudi</a>` +
    `<div class="sub">Documento gi\u00e0 su "Sollecito offerta": rivedi, invia, poi passa alla prossima.</div>`;
  $('corpo').prepend(div);

  document.getElementById('codaProssima')?.addEventListener('click', async ev => {
    ev.preventDefault();
    await chrome.storage.local.set({ leonardo_coda_solleciti: { ...coda, indice: pos + 1 } });
    chrome.tabs.create({ url: coda.voci[pos + 1].url });
    window.close();
  });
  document.getElementById('codaChiudi')?.addEventListener('click', async ev => {
    ev.preventDefault();
    await chrome.storage.local.remove('leonardo_coda_solleciti');
    div.remove();
  });
}

/* ---------- Prepara il suo arrivo: link personale nella conferma ---------- */
const ARRIVO_FUNZIONE = 'https://mvuiuwakuseockotlcnp.supabase.co/functions/v1/prepara-arrivo';

async function creaLinkArrivo(lingua) {
  const { hotelKey } = await chrome.storage.local.get(['hotelKey']);
  if (!hotelKey) throw new Error('chiave hotel non impostata');
  const MN = { Jan:'01', Feb:'02', Mar:'03', Apr:'04', May:'05', Jun:'06',
               Jul:'07', Aug:'08', Sep:'09', Oct:'10', Nov:'11', Dec:'12' };
  const iso = (g) => `${DATI.anno}-${MN[DATI.mese]}-${String(g).padStart(2, '0')}`;
  const r = await fetch(ARRIVO_FUNZIONE + '?action=crea', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hotel-key': hotelKey },
    body: JSON.stringify({
      reservation_id: DATI.id,
      numero_pratica: DATI.numeroOfferta,
      intestatario: DATI.intestatario,
      email: DATI.email || null,
      lingua,
      data_arrivo: iso(DATI.giornoArrivo),
      data_partenza: iso(DATI.giornoPartenza),
      adulti: DATI.adulti,
      bambini: DATI.bambini,
      /* Se questo soggiorno ha le CURE. Serve alla pagina d'arrivo per
         decidere se mostrare la domanda sul desiderio d'orario dei fanghi:
         a chi viene per due notti di relax sarebbe rumore.

         Stessa regola che decide il blocco «cure termali» nell'email
         (deduci(d).cure): il trattamento, oppure piu' di cinque notti.
         Una seconda regola qui divergerebbe dalla prima. */
      cure: deduci(DATI).cure
    })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.url) throw new Error(j.errore || ('errore ' + r.status));
  return j.url;
}

/* usato da entrambi i pulsanti: crea (o riusa) il link se la spunta e' attiva */
async function risolviLinkArrivo(doc, lingua) {
  if (doc !== 'conferma' || MODO === 'rapido' || !$('optArrivo')?.checked) {
    if (DATI) DATI.linkArrivo = null;
    return true;
  }
  if (DATI.linkArrivo) return true;   // gia' creato in questa sessione del popup
  $('esito').textContent = 'Creo il link "Prepara il suo arrivo"\u2026';
  try {
    DATI.linkArrivo = await creaLinkArrivo(lingua);
    $('esito').textContent = '';
    return true;
  } catch (e) {
    $('esito').textContent = 'Prepara arrivo: ' + e.message + ' \u2014 togli la spunta per generare senza pulsante.';
    return false;
  }
}

/* ---------- Outlook Web: nuovo messaggio precompilato ---------- */
// Microsoft 365 → outlook.office.com · account personale → outlook.live.com/mail/0
const OUTLOOK = 'https://outlook.office.com/mail/deeplink/compose';
/* Outlook Web non supporta i link di ricerca: Microsoft non espone alcun
   parametro che esegua una ricerca. Copiamo quindi la stringa negli appunti
   e l'operatore la incolla nella casella di ricerca già aperta. */

function linkOutlook(dest, ogg) {
  return `${OUTLOOK}?to=${encodeURIComponent(dest || '')}&subject=${encodeURIComponent(ogg)}`;
}

/* ---------- copia negli appunti ---------- */
$('copia').addEventListener('click', async () => {
  if (MODO === 'rapido' && !(await preparaDatiRapidiConLink())) return;
  if (!DATI) return;
  const opzioni = {
    genere: document.querySelector('input[name=gen]:checked')?.value || 'N',
    cure:   $('optCure')?.checked,
    cane:   $('optCane')?.checked,
    promo:   $('optPromo')?.checked,
    fedelta: $('optFedelta')?.checked,
    /* v2.9.4: camere alternative — l'ospite ne sceglie una. Lo dice
       l'operatore: nei dati alternative, cambio camera e soggiorni
       distinti si somigliano tutti. */
    alternative: $('optAlternative')?.checked,
    dettaglio: $('dettaglio')?.value || '',
    dettaglioCamera: ($('dettaglio')?.value || '').trim() ? (window.__leoDettaglioCamera || '') : '',
    firma:  $('firma')?.value || 'La Reception',
    accontoAnnunciato: document.querySelector('input[name=accontoScelta]:checked')?.value === 'annunciato',
    titolo: $('titoloOspite')?.value?.trim() || ''
  };
  const lingua = document.querySelector('input[name=lng]:checked')?.value || 'it';
  const doc    = document.querySelector('input[name=doc]:checked')?.value || 'offerta';
  const MODELLI = {
    offerta:  { it:[costruisciEmail, oggetto],       de:[costruisciEmailDE, betreffDE],
                en:[costruisciEmailEN, subjectEN],   fr:[costruisciEmailFR, objetFR] },
    conferma: { it:[costruisciConferma, oggettoConferma],   de:[costruisciConfermaDE, betreffBestaetigung],
                en:[costruisciConfermaEN, subjectConfirmEN], fr:[costruisciConfermaFR, objetConfirmFR] },
    sollecito: { it:[costruisciSollecitoIT, oggettoSollecitoIT], de:[costruisciSollecitoDE, oggettoSollecitoDE],
                 en:[costruisciSollecitoEN, oggettoSollecitoEN], fr:[costruisciSollecitoFR, oggettoSollecitoFR] },
    buoni:    { it:[costruisciBuoniIT, oggettoBuoniIT], de:[costruisciBuoniDE, oggettoBuoniDE],
                en:[costruisciBuoniEN, oggettoBuoniEN], fr:[costruisciBuoniFR, oggettoBuoniFR] },
    dayspa:   { it:[costruisciDaySpaIT, oggettoDaySpaIT], de:[costruisciDaySpaDE, oggettoDaySpaDE],
                en:[costruisciDaySpaEN, oggettoDaySpaEN], fr:[costruisciDaySpaFR, oggettoDaySpaFR] }
  };
  preparaAlternative(DATI, opzioni.alternative);
  const [fnHtml, fnOgg] = MODELLI[doc][lingua] || MODELLI[doc].it;
  // v1.1: la conferma stampa l'acconto dal campo modificabile, non solo dalla
  // lettura automatica (che poteva fallire lasciando "− 0,00 €" nell'email)
  if (doc === 'conferma') {
    const campo = $('accontoRicevuto')?.value?.trim() || '';
    const valore = campo ? parseFloat(campo.replace(/\./g, '').replace(',', '.')) : NaN;
    if (!isNaN(valore) && valore >= 0) DATI.caparraVersata = valore;
  }
  if (!(await risolviLinkArrivo(doc, lingua))) return;
  const html = fnHtml(DATI, opzioni);
  const ogg  = fnOgg(DATI);
  const dest = MODO === 'rapido'
    ? (DATI.email || '')
    : (document.querySelector('input[name=dest]:checked')?.value || '');
  const e_apriOutlook = $('optOutlook')?.checked;

  try {
    await navigator.clipboard.write([new ClipboardItem({
      'text/html':  new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')], { type: 'text/plain' })
    })]);
    if (e_apriOutlook) {
      /* v1.1: l'HTML viaggia in chrome.storage e outlook-inject.js lo inserisce
         direttamente nell'editor, evitando la sanificazione del Ctrl+V di
         Outlook Web (che rimuove sfondi, font e colori). Gli appunti restano
         come riserva. numeroOfferta serve a non inserire due volte. */
      /* v1.6.7: la firma anti-doppione deve essere unica PER GENERAZIONE.
         Con il solo numero offerta, rigenerando la stessa prenotazione (es.
         dopo aver aggiunto gli extra) una scheda Outlook che conteneva già
         quel numero faceva saltare l'inserimento: mail con destinatario e
         oggetto, corpo vuoto. Il marcatore ora porta anche l'istante. */
      await chrome.storage.local.set({ leonardo_email_pendente: {
        html: html,
        creato: Date.now(),
        firmaContenuto: (DATI.numeroOfferta || 'leo') + '#' + Date.now()
      }});
      chrome.tabs.create({ url: linkOutlook(dest, ogg) });
      $('esito').textContent = doc === 'conferma'
        ? 'Outlook aperto: il testo si inserisce da solo — poi "Invia online-checkin" in Fidra'
        : 'Outlook aperto: il testo si inserisce da solo (in riserva: Ctrl+V)';
    } else {
      $('esito').textContent = dest
        ? `Copiata. Nuovo messaggio a ${dest}, poi Ctrl+V`
        : 'Copiata. Nuovo messaggio, poi Ctrl+V';
    }
  } catch (e) {
    $('esito').textContent = 'Copia non riuscita: ' + e.message;
  }
});

$('copiaOggetto').addEventListener('click', async () => {
  if (MODO === 'rapido' && !(await preparaDatiRapidiConLink())) return;
  if (!DATI) return;
  // v1.1.1: prepara l'email per una RISPOSTA alla mail del cliente.
  // Salva il contenuto: outlook-inject lo inserisce da solo appena si apre
  // l'editor di risposta (sopra la citazione). L'oggetto va negli appunti,
  // pronto da incollare quando lo si rinomina.
  const doc = document.querySelector('input[name=doc]:checked')?.value || 'offerta';
  const lingua = document.querySelector('input[name=lng]:checked')?.value || 'it';
  const opzioni = {
    genere: document.querySelector('input[name=gen]:checked')?.value || 'N',
    cure:   $('optCure')?.checked,
    cane:   $('optCane')?.checked,
    promo:   $('optPromo')?.checked,
    fedelta: $('optFedelta')?.checked,
    /* v2.9.4: camere alternative — l'ospite ne sceglie una. Lo dice
       l'operatore: nei dati alternative, cambio camera e soggiorni
       distinti si somigliano tutti. */
    alternative: $('optAlternative')?.checked,
    dettaglio: $('dettaglio')?.value || '',
    dettaglioCamera: ($('dettaglio')?.value || '').trim() ? (window.__leoDettaglioCamera || '') : '',
    firma:  $('firma')?.value || 'La Reception',
    accontoAnnunciato: document.querySelector('input[name=accontoScelta]:checked')?.value === 'annunciato',
    titolo: $('titoloOspite')?.value?.trim() || ''
  };
  const MODELLI = {
    offerta:  { it:[costruisciEmail, oggetto],       de:[costruisciEmailDE, betreffDE],
                en:[costruisciEmailEN, subjectEN],   fr:[costruisciEmailFR, objetFR] },
    conferma: { it:[costruisciConferma, oggettoConferma],   de:[costruisciConfermaDE, betreffBestaetigung],
                en:[costruisciConfermaEN, subjectConfirmEN], fr:[costruisciConfermaFR, objetConfirmFR] },
    sollecito: { it:[costruisciSollecitoIT, oggettoSollecitoIT], de:[costruisciSollecitoDE, oggettoSollecitoDE],
                 en:[costruisciSollecitoEN, oggettoSollecitoEN], fr:[costruisciSollecitoFR, oggettoSollecitoFR] },
    buoni:    { it:[costruisciBuoniIT, oggettoBuoniIT], de:[costruisciBuoniDE, oggettoBuoniDE],
                en:[costruisciBuoniEN, oggettoBuoniEN], fr:[costruisciBuoniFR, oggettoBuoniFR] },
    dayspa:   { it:[costruisciDaySpaIT, oggettoDaySpaIT], de:[costruisciDaySpaDE, oggettoDaySpaDE],
                en:[costruisciDaySpaEN, oggettoDaySpaEN], fr:[costruisciDaySpaFR, oggettoDaySpaFR] }
  };
  preparaAlternative(DATI, opzioni.alternative);
  const [fnHtml, fnOgg] = MODELLI[doc][lingua] || MODELLI[doc].it;
  if (doc === 'conferma') {
    const campo = $('accontoRicevuto')?.value?.trim() || '';
    const valore = campo ? parseFloat(campo.replace(/\./g, '').replace(',', '.')) : NaN;
    if (!isNaN(valore) && valore >= 0) DATI.caparraVersata = valore;
  }
  if (!(await risolviLinkArrivo(doc, lingua))) return;
  const html = fnHtml(DATI, opzioni);
  const ogg = fnOgg(DATI);
  try { await navigator.clipboard.writeText(ogg); } catch (e) {}
  await chrome.storage.local.set({ leonardo_email_pendente: {
    html, creato: Date.now(), firmaContenuto: (DATI.numeroOfferta || 'leo') + '#' + Date.now()
  }});
  $('esito').textContent = 'Vai su Outlook e premi Rispondi: il testo si inserisce da solo. Oggetto negli appunti.';
});
