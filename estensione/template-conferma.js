/* ============================================================
   Offerta Leonardo — modelli CONFERMA (IT / DE)
   La conferma ha un compito diverso dall'offerta: l'ospite ha già
   deciso e già pagato. Serve a rassicurare e a preparare l'arrivo.
   ============================================================ */


/* Categorie Fidra (italiane) tradotte per l'ospite; i nomi propri restano. */
const MAPPA_KATEGORIECONFDE = {
  'singola senza balcone': 'Einzelzimmer ohne Balkon',
  'singola parco': 'Einzelzimmer mit Parkblick',
  'singola accessibile': 'Barrierefreies Einzelzimmer',
  'matrimoniale queen': 'Queen-Doppelzimmer',
  'doppia': 'Doppelzimmer',
  'junior suite accessibile': 'Barrierefreie Junior Suite',
  'uso singola': 'zur Alleinbenutzung'
};
function kategorieConfDE(nome) {
  let out = String(nome || '');
  const chiavi = Object.keys(MAPPA_KATEGORIECONFDE).sort((a, b) => b.length - a.length);
  for (const k of chiavi) {
    out = out.replace(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), MAPPA_KATEGORIECONFDE[k]);
  }
  return out;
}

function numeroConferma(numeroOfferta) {
  return (numeroOfferta || '').replace(/^O/, 'C');
}

function eur(n, loc) {
  return (n || 0).toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ---------- righe camere, compatte ---------- */
function categoriaConferma(nome, lingua) {
  try {
    if (lingua === 'de') return kategorieConfDE(nome);
    if (lingua === 'en' && typeof categoryEN === 'function') return categoryEN(nome);
    if (lingua === 'fr' && typeof categorieFR === 'function') return categorieFR(nome);
  } catch (e) { /* file lingua non caricato: nome originale */ }
  return nome;
}

function camereConferma(camere, lingua, d) {
  const perPersona = lingua === 'de' ? 'pro Person' : 'a persona';
  const OSPITE = { it: ['ospite', 'ospiti'], de: ['Gast', 'Gäste'],
                   en: ['guest', 'guests'], fr: ['personne', 'personnes'] };
  const NR = { it: 'nr.', de: 'Nr.', en: 'No.', fr: 'n°' };
  /* v2.0.2: con piu' camere uguali accorpate, gli ospiti sono per camera */
  const PERCAM = { it: ' per camera', de: ' pro Zimmer', en: ' per room', fr: ' par chambre' };
  return raggruppaCamere(camere).map(c => {
    const nOsp = (c.adulti || 0) + (c.bambini || 0);
    const par = OSPITE[lingua] || OSPITE.it;
    const chi = `${nOsp} ${nOsp === 1 ? par[0] : par[1]}`;
    /* nome camera in maiuscolo; in italiano si antepone CAMERA dove il nome
       non lo contiene (Doppia, Singola, Matrimoniale) ma non alle Suite */
    let nomeCam = String(categoriaConferma(c.categoria, lingua)).toUpperCase();
    if ((lingua || 'it') === 'it' && !/SUITE/.test(nomeCam)) nomeCam = 'CAMERA ' + nomeCam;
    /* v1.6: se gli ospiti della camera hanno prezzi o date diversi, niente
       "X € a persona" (sarebbe il prezzo del primo ospite spacciato per
       tutti): ogni ospite ha la sua riga e il totale camera è la somma. */
    const mista = typeof cameraMista === 'function' && cameraMista(c);
    const rigaPrezzo = mista
      ? `<span style="color:#7B756A;font-size:13px;">${typeof traduciTrattamento === 'function' ? traduciTrattamento(c.trattamento, lingua) : (c.trattamento || '')}</span>${righeSoggiornanti(c, lingua)}`
      : `<span style="color:#7B756A;font-size:13px;">${typeof traduciTrattamento === 'function' ? traduciTrattamento(c.trattamento, lingua) : (c.trattamento || '')} &middot; ${eur(c.totalePP, lingua === 'de' ? 'de-DE' : 'it-IT')} &euro; ${typeof etichettaPrezzoAdulti === 'function' ? etichettaPrezzoAdulti(c, lingua, perPersona) : perPersona}</span>${typeof rigaBambini === 'function' ? rigaBambini(c, lingua) : ''}${typeof rigaExtraCamera === 'function' ? rigaExtraCamera(c, lingua) : ''}`;
    return `<tr>
      <td style="padding:0 0 9px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#55524B;border-bottom:1px solid #F0EBE1;">
        <strong style="color:#2A2E2B;">${NR[lingua] || NR.it} ${c.quantita || 1} ${nomeCam}</strong> &middot; ${chi}${(c.quantita || 1) > 1 ? (PERCAM[lingua] || PERCAM.it) : ''}${periodiDiversi(d) ? ' &middot; ' + testoPeriodo(c, d, lingua) : ''}<br />
        ${rigaPrezzo}
        ${(!periodiDiversi(d) && !mista && typeof periodoCamera === 'function') ? periodoCamera(c, lingua) : ''}${typeof totaleCameraRiga === 'function' ? totaleCameraRiga(c, d, lingua) : ''}${typeof notaPacchetto === 'function' ? notaPacchetto(c.trattamento, lingua) : ''}
      </td>
    </tr>
    <tr><td height="9" style="font-size:0;line-height:0;">&nbsp;</td></tr>`;
  }).join('');
}

/* ============================================================
   CONFERMA — ITALIANO
   ============================================================ */
function costruisciConferma(d, opzioni) {
  const o = opzioni || {};
  const arrivo   = dataIT(d.giornoArrivo, d.mese, d.anno);
  const partenza = dataIT(d.giornoPartenza, d.mesePartenza || d.mese, d.annoPartenza || d.anno);
  const notti    = d.notti === 1 ? '1 notte' : `${d.notti} notti`;
  const ospiti   = descrizioneOspiti(d.adulti, d.bambini);
  /* bonifico annunciato: il cliente ha mandato la copia, i soldi non sono
     ancora fisicamente arrivati ma la conferma parte lo stesso. L'email non
     deve dire "ricevuto 0,00": conta l'acconto dovuto e lo dice com'è. */
  const annunciato = !!(o && o.accontoAnnunciato);
  const versato  = annunciato ? (d.caparraDovuta || d.acconto || 0) : (d.caparraVersata || 0);
  const saldoVero = (d.totale || 0) - versato;
  /* v1.6: se l'acconto supera il totale (caso 18824: 1.191 su 1.040), l'email
     non deve chiedere un saldo che non esiste né mostrare un numero negativo. */
  const credito = saldoVero < -0.005 ? -saldoVero : 0;
  const saldo   = Math.max(saldoVero, 0);

  const blocchi = [];

  /* v1.9.5: gli sconti mancavano nelle conferme. Il prezzo in Fidra arriva
     gia' scontato (3.181 → 3.152,75) e senza una riga che lo dica l'ospite
     vede solo un numero con i centesimi strani, senza capire perche'. */
  if (o.fedelta) blocchi.push(`
  <tr><td style="padding:20px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F2F5EC;">
      <tr>
        <td width="6" style="background-color:#7A8450;font-size:0;line-height:0;">&nbsp;</td>
        <td style="padding:16px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:23px;color:#55524B;">
          <strong style="color:#2A2E2B;">Siamo felici di rivederla</strong><br />
          Sul prezzo di pensione abbiamo applicato uno <strong style="color:#2A2E2B;">sconto del 5%</strong>.
          &Egrave; gi&agrave; conteggiato nei prezzi qui sopra.
        </td>
      </tr>
    </table>
  </td></tr>`);

  if (o.promo) blocchi.push(`
  <tr><td style="padding:16px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FDF6EE;">
      <tr>
        <td width="6" style="background-color:#C97B2C;font-size:0;line-height:0;">&nbsp;</td>
        <td style="padding:16px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:23px;color:#55524B;">
          <strong style="color:#2A2E2B;">3% per chi paga in anticipo il 2027</strong><br />
          Se prenota un soggiorno del 2027 e ci fa pervenire l'intero importo con bonifico
          <strong style="color:#2A2E2B;">entro il 31 gennaio 2027</strong>, alla partenza le riconosciamo il
          <strong style="color:#2A2E2B;">3% sul prezzo di pensione</strong>. L'importo non &egrave; compreso nel
          totale qui sopra: glielo consegniamo alla partenza.
        </td>
      </tr>
    </table>
  </td></tr>`);


  if (o.cure) blocchi.push(`
  <tr><td style="padding:20px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#E3F0F1;">
      <tr><td style="padding:16px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:23px;color:#3C6266;">
        <strong style="color:#0F5C64;">Le sue cure termali</strong><br />
        Il giorno dell'arrivo la aspettiamo per la visita medica di ammissione, obbligatoria prima di iniziare il ciclo.
        Ricordi di portare l'impegnativa del suo medico, la tessera sanitaria ed eventuale documentazione clinica.
        I fanghi si svolgono al mattino: la segreteria cure le confermer&agrave; il turno.
      </td></tr>
    </table>
  </td></tr>`);

  if (o.cane) blocchi.push(`
  <tr><td style="padding:16px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F1E9;">
      <tr><td style="padding:14px 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        &#128054; <strong style="color:#2A2E2B;">Anche il suo cane &egrave; il benvenuto</strong> &middot; 13 &euro; al giorno, da saldare in hotel; il cibo non &egrave; compreso.
        &Egrave; a suo agio in camera, nella hall e al Bistrot La Piazza &mdash; nelle aree comuni al guinzaglio. Non pu&ograve; invece accedere a piscine, parco e ristorante.
      </td></tr>
    </table>
  </td></tr>`);

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EDE7DC;">
<tr><td align="center" style="padding:24px 12px 40px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#FFFFFF;">

  <tr><td align="center" style="padding:26px 36px 18px 36px;">
    <a href="https://www.hoteltermeleonardo.com" target="_blank" style="text-decoration:none;"><img src="https://www.termeleonardo.com/img/logo.png" alt="LEONARDO — TERME HOTEL ****" width="247" height="64" style="display:block;margin:0 auto;border:0;" /></a>
  </td></tr>

  <tr><td style="padding:0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="46%" height="3" style="background-color:#1E7F88;font-size:0;line-height:0;">&nbsp;</td>
      <td width="4%" style="font-size:0;line-height:0;">&nbsp;</td>
      <td width="30%" height="3" style="background-color:#1E7F88;font-size:0;line-height:0;">&nbsp;</td>
      <td width="4%" style="font-size:0;line-height:0;">&nbsp;</td>
      <td width="16%" height="3" style="background-color:#8FC5C9;font-size:0;line-height:0;">&nbsp;</td>
    </tr></table>
  </td></tr>
  <tr><td align="right" style="padding:14px 36px 0 36px;">
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:1.5px;color:#A79E8F;">CONFERMA N. <strong style="color:#7B756A;">${numeroConferma(d.numeroOfferta)}</strong></div>
  </td></tr>

  <tr><td style="padding:16px 36px 0 36px;">
    <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#2A2E2B;">${saluto(d.intestatario, o.genere)},</p>
    <h1 style="margin:0 0 10px 0;font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:31px;font-weight:normal;color:#2A2E2B;">
      &Egrave; tutto confermato.<br />La aspettiamo il ${arrivo}
    </h1>
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
      ${annunciato ? 'Abbiamo ricevuto la copia del suo bonifico' : 'Abbiamo ricevuto il suo acconto'} e ${d.camere.length > 1 ? 'le sue camere sono riservate' : 'la sua camera &egrave; riservata'}. Prenotazione <strong style="color:#2A2E2B;">${numeroConferma(d.numeroOfferta)}</strong>.
    </p>
  </td></tr>

  <tr><td style="padding:18px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FAF8F4;">
      <tr><td style="padding:16px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
          <tr><td width="100" style="padding:0 10px 7px 0;color:#8C8578;">Arrivo</td><td style="padding:0 0 7px 0;"><strong style="color:#2A2E2B;">${arrivo}</strong>, dalle 15:00</td></tr>
          <tr><td style="padding:0 10px 7px 0;color:#8C8578;">Partenza</td><td style="padding:0 0 7px 0;"><strong style="color:#2A2E2B;">${partenza}</strong>, entro le 11:00</td></tr>
        
  <tr><td style="padding:0 10px 12px 0;color:#8C8578;">Soggiorno</td><td style="padding:0 0 12px 0;">${periodiDiversi(d) ? `${ospiti} in ${d.camere.length} camere &middot; periodi accanto a ogni camera` : (soggiorniMisti(d) ? `${ospiti} &middot; date indicate per ciascun ospite` : `${notti} per ${ospiti}`)}</td></tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${camereConferma(ordinaCamere(d.camere), 'it', d)}</table>${dettaglioSoggiorno(o.dettaglio, 'Come si articola il suo soggiorno', o.dettaglioCamera)}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
          <tr><td width="100" style="padding:6px 10px 5px 0;color:#8C8578;">Totale</td><td style="padding:6px 0 5px 0;">${eur(d.totale,'it-IT')} &euro;</td></tr>
          <tr><td style="padding:0 10px 5px 0;color:#8C8578;">${annunciato ? 'Acconto &middot; bonifico annunciato' : 'Acconto ricevuto'}</td><td style="padding:0 0 5px 0;">&minus; ${eur(versato,'it-IT')} &euro;</td></tr>
          <tr><td style="padding:0 10px 0 0;color:#8C8578;">Saldo all'arrivo</td><td style="padding:0;"><strong style="color:#0F5C64;font-size:16px;">${eur(saldo,'it-IT')} &euro;</strong></td></tr>
          ${credito > 0 ? `<tr><td colspan="2" style="padding:6px 0 0 0;font-size:13px;color:#55524B;">L'acconto ricevuto supera il totale di <strong>${eur(credito,'it-IT')} &euro;</strong>: regoleremo la differenza al suo arrivo.</td></tr>` : ''}
        </table>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#A79E8F;padding-top:8px;">
          Pi&ugrave; la tassa di soggiorno, 1,50 &euro; a persona al giorno per un massimo di 7 notti, che salda in hotel.
        </div>
      </td></tr>
${blocchi.join('')}
    </table>
  </td></tr>

  <tr><td style="padding:20px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#E3F0F1;">
      <tr>
        <td width="6" style="background-color:#1E7F88;font-size:0;line-height:0;">&nbsp;</td>
        <td style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:23px;color:#3C6266;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:24px;color:#0F5C64;padding-bottom:8px;">Faccia il check-in online</div>
          Le arriver&agrave; a breve una email con il link. Compilarlo prima dell'arrivo le fa guadagnare mezza giornata:
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:9px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#3C6266;">
            <tr><td valign="top" width="16" style="padding:0 6px 5px 0;color:#1E7F88;">&#10003;</td><td style="padding:0 0 5px 0;">Piscine termali gi&agrave; <strong style="color:#0F5C64;">dalle 11:30</strong>, senza aspettare le 15:00</td></tr>
            <tr><td valign="top" style="padding:0 6px 5px 0;color:#1E7F88;">&#10003;</td><td style="padding:0 0 5px 0;">Camera consegnata subito, se &egrave; gi&agrave; pronta</td></tr>
            <tr><td valign="top" style="padding:0 6px 0 0;color:#1E7F88;">&#10003;</td><td style="padding:0;">Nessuna attesa al banco all'arrivo</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:22px 36px 0 36px;">
    <h2 style="margin:0 0 6px 0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:24px;font-weight:normal;color:#2A2E2B;">Prepariamo il suo arrivo</h2>
    ${d.linkArrivo ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px 0;"><tr><td align="center" bgcolor="#1E7F88" style="border-radius:5px;"><a href="${d.linkArrivo}" style="display:inline-block;padding:11px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#FFFFFF;text-decoration:none;font-weight:bold;">Prepari il suo arrivo</a></td></tr></table><p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#7B756A;">Due minuti dal telefono: orario d&apos;arrivo, fattura, transfer. Preferisce scrivere? Risponda a questa email.</p>` : `<p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#7B756A;">
      Risponda a questa email: ce ne occupiamo noi prima che arrivi.
    </p>`}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="padding:12px 16px;background-color:#FAF8F4;border-left:3px solid #7A8450;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">A che ora pensa di arrivare?</strong><br /><span style="color:#7B756A;font-size:13px;">Cos&igrave; la accogliamo senza attese. E se prevede di arrivare dopo le 22:00, la preghiamo di avvisarci in anticipo: ci organizziamo per riceverla anche a tarda ora</span>
      </td></tr>
      <tr><td height="8" style="font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:12px 16px;background-color:#FAF8F4;border-left:3px solid #7A8450;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Transfer dall'aeroporto</strong> &middot; Venezia, navetta da 65 &euro;<br /><span style="color:#7B756A;font-size:13px;">Ci dica volo e orario. Va prenotato almeno 24 ore prima</span>${typeof bottoneServizio === 'function' ? bottoneServizio('transfer', d, 'it') : ''}
      </td></tr>
      <tr><td height="8" style="font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:12px 16px;background-color:#FAF8F4;border-left:3px solid #7A8450;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Massaggio antistress</strong> &middot; 55 &euro; (45 minuti)<br /><span style="color:#7B756A;font-size:13px;">Il pi&ugrave; richiesto. Gli orari si esauriscono presto: meglio fissarlo ora</span><br /><a href="https://www.termeleonardo.com/pdf/listino-spa-trattamenti-e-massaggi-hotel-leonardo-da-vinci-terme.pdf" target="_blank" style="color:#0F5C64;font-size:13px;text-decoration:underline;">Scarichi il listino completo di trattamenti e massaggi (PDF)</a>${typeof bottoneServizio === 'function' ? bottoneServizio('trattamenti', d, 'it') : ''}
      </td></tr>
      <tr><td height="8" style="font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:12px 16px;background-color:#FAF8F4;border-left:3px solid #7A8450;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Early Bird Swimming</strong> &middot; 20 &euro; a persona<br /><span style="color:#7B756A;font-size:13px;">Piscine gi&agrave; dalle 9:00 il giorno dell'arrivo. Da richiedere ora, non all'arrivo</span>
      </td></tr>
      <tr><td height="8" style="font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:12px 16px;background-color:#FAF8F4;border-left:3px solid #7A8450;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Un buono regalo</strong> &middot; terme e trattamenti per chi vuole lei<br /><span style="color:#7B756A;font-size:13px;">Lo prepariamo con il suo messaggio e glielo mandiamo per email, pronto da consegnare</span>${typeof bottoneServizio === 'function' ? bottoneServizio('buoni', d, 'it') : ''}
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:22px 36px 0 36px;">
    <h2 style="margin:0 0 10px 0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:24px;font-weight:normal;color:#2A2E2B;">Da sapere</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
      <tr><td width="130" valign="top" style="padding:0 12px 9px 0;color:#8C8578;">Piscine</td><td valign="top" style="padding:0 0 9px 0;">Aperte dalle 8:00 alle 19:30, il venerd&igrave; e il sabato fino alle 22:30 &middot; cuffia obbligatoria, in vendita in Reception a 3 &euro;</td></tr>
      <tr><td valign="top" style="padding:0 12px 9px 0;color:#8C8578;">Fumo</td><td valign="top" style="padding:0 0 9px 0;">Hotel per non fumatori: in camera non si fuma, sul balcone s&igrave;</td></tr>
      <tr><td valign="top" style="padding:0 12px 9px 0;color:#8C8578;">Cena</td><td valign="top" style="padding:0 0 9px 0;">Dalle 19:30, ultimo ingresso alle 20:20. Se arriva pi&ugrave; tardi ce lo dica: le lasciamo un piatto in camera</td></tr>
      <tr><td valign="top" style="padding:0 12px 9px 0;color:#8C8578;">Pranzo</td><td valign="top" style="padding:0 0 9px 0;">Al Bistrot La Piazza, anche in accappatoio: aperto dalle 10:00 alle 23:00, pranzo dalle 12:30 alle 14:30, spuntini fino alle 17:30</td></tr>
      <tr><td valign="top" style="padding:0 12px 9px 0;color:#8C8578;">Giorno di partenza</td><td valign="top" style="padding:0 0 9px 0;">Piscine incluse fino alle 11:00. Pu&ograve; prolungare fino alle 18:30 a 30 &euro; a persona, lo dica al check-out</td></tr>
      <tr><td valign="top" style="padding:0 12px 0 0;color:#8C8578;">Auto elettrica</td><td valign="top" style="padding:0;">Otto colonnine da 11 kW. La ricarica si gestisce con l'app <em>Next charge</em> o <em>My wallbox</em>: porti il suo cavo</td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:20px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F1E9;"><tr><td style="padding:14px 18px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;color:#8C8578;">
      Se dovesse cambiare programma: l'acconto &egrave; una caparra confirmatoria e viene trattenuto in caso di annullamento.
      Da due giorni prima dell'arrivo, e in caso di mancato arrivo, viene addebitato il 100% delle prestazioni prenotate.
      Gli annullamenti valgono solo per iscritto, a info@termeleonardo.com.
    </td></tr></table>
  </td></tr>

  <tr><td style="padding:22px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="1" style="background-color:#E4DED2;font-size:0;line-height:0;">&nbsp;</td></tr></table>
    <p style="margin:16px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
      Per qualsiasi cosa, prima o durante il soggiorno, ci scriva o ci chiami: siamo qui tutti i giorni.
    </p>
    <p style="margin:16px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:24px;color:#2A2E2B;">
      A presto,<br />${o.firma || 'La Reception'}
    </p>
    <p style="margin:12px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:23px;color:#55524B;">
      +39 049 9939 200 &nbsp;&middot;&nbsp; info@termeleonardo.com
    </p>
  </td></tr>

  <tr><td style="padding:22px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FAF8F4;">
      <tr>
        <td width="6" style="background-color:#7A8450;font-size:0;line-height:0;">&nbsp;</td>
        <td style="padding:16px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
          <strong style="color:#2A2E2B;">Il suo prossimo meeting alle terme?</strong><br />
          La nostra sala ospita fino a 60 persone, con proiettore, impianto audio e Wi-Fi in fibra;
          coffee break dal nostro ristorante e piscine termali per chiudere la giornata.
          Se in azienda cercate una sede per una riunione o una giornata di formazione, ci scriva: organizziamo tutto noi.
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td align="center" style="padding:20px 36px 0 36px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="padding:9px 16px;background-color:#F1F4EA;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#5F6B44;">${typeof bloccoCertificazioni === 'function' ? bloccoCertificazioni() : ''}
        <strong style="color:#4A5636;">Primo hotel termale in Europa</strong> certificato <strong style="color:#4A5636;">GSTC Hotel Standard</strong> per la sostenibilit&agrave;
      </td>
    </tr></table>
  </td></tr>

  <tr><td align="center" style="padding:20px 36px 26px 36px;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:15px;letter-spacing:5px;color:#2A2E2B;">TERME LEONARDO</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:20px;color:#8C8578;padding-top:10px;">
      Via Monteortone 46 &middot; 35037 Monteortone di Teolo (PD) &middot; <a href="https://www.hoteltermeleonardo.com" target="_blank" style="color:#8C8578;text-decoration:underline;">hoteltermeleonardo.com</a>
    </div>
  </td></tr>

</table>
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
  <tr><td align="center" style="padding:14px 36px 0 36px;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:17px;color:#A79E8F;">
    Tria S.r.l. &middot; P.IVA IT 02042330288 &middot; CIN IT028089A18QYO48ED
  </td></tr>
</table>
</td></tr>
</table>`;
}

function oggettoConferma(d) {
  return `Conferma ${numeroConferma(d.numeroOfferta)} — la aspettiamo il ${dataIT(d.giornoArrivo, d.mese, d.anno)}`;
}

/* ============================================================
   CONFERMA — TEDESCO
   ============================================================ */
function costruisciConfermaDE(d, opzioni) {
  const o = opzioni || {};
  const anreise = datumDE(d.giornoArrivo, d.mese, d.anno);
  const abreise = datumDE(d.giornoPartenza, d.mesePartenza || d.mese, d.annoPartenza || d.anno);
  const naechte = d.notti === 1 ? '1 Nacht' : `${d.notti} Nächte`;
  const gaeste  = gaesteDE(d.adulti, d.bambini);
  const annunciato = !!(o && o.accontoAnnunciato);
  const gezahlt = annunciato ? (d.caparraDovuta || d.acconto || 0) : (d.caparraVersata || 0);
  const restEcht = (d.totale || 0) - gezahlt;
  const guthaben = restEcht < -0.005 ? -restEcht : 0;   // v1.6
  const rest     = Math.max(restEcht, 0);

  const blocchi = [];

  if (o.fedelta) blocchi.push(`
  <tr><td style="padding:20px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F2F5EC;">
      <tr>
        <td width="6" style="background-color:#7A8450;font-size:0;line-height:0;">&nbsp;</td>
        <td style="padding:16px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:23px;color:#55524B;">
          <strong style="color:#2A2E2B;">Wir freuen uns, Sie wiederzusehen</strong><br />
          Auf den Pensionspreis haben wir Ihnen einen <strong style="color:#2A2E2B;">Nachlass von 5 %</strong>
          gew&auml;hrt. Er ist in den oben genannten Preisen bereits ber&uuml;cksichtigt.
        </td>
      </tr>
    </table>
  </td></tr>`);

  if (o.promo) blocchi.push(`
  <tr><td style="padding:16px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FDF6EE;">
      <tr>
        <td width="6" style="background-color:#C97B2C;font-size:0;line-height:0;">&nbsp;</td>
        <td style="padding:16px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:23px;color:#55524B;">
          <strong style="color:#2A2E2B;">3 % f&uuml;r Fr&uuml;hbucher 2027</strong><br />
          Wenn Sie einen Aufenthalt 2027 buchen und den Gesamtbetrag
          <strong style="color:#2A2E2B;">bis zum 31. Januar 2027</strong> &uuml;berweisen, erhalten Sie bei Ihrer
          Abreise <strong style="color:#2A2E2B;">3 % auf den Pensionspreis</strong>. Der Betrag ist im oben
          genannten Gesamtpreis nicht enthalten: Sie erhalten ihn bei der Abreise.
        </td>
      </tr>
    </table>
  </td></tr>`);


  if (o.cure) blocchi.push(`
  <tr><td style="padding:20px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#E3F0F1;">
      <tr><td style="padding:16px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:23px;color:#3C6266;">
        <strong style="color:#0F5C64;">Ihre Thermalkur</strong><br />
        Am Anreisetag erwarten wir Sie zur ärztlichen Aufnahmeuntersuchung, die vor Kurbeginn verpflichtend ist.
        Bitte bringen Sie die Verordnung Ihres Arztes und eventuelle Befunde mit.
        Die Fangoanwendungen finden vormittags statt; den Termin bestätigt Ihnen unser Kursekretariat.
        Für die Erstattung durch Ihre Krankenkasse stellen wir Ihnen die Unterlagen gerne aus (&sect; 13 Abs. 4 Satz 2 SGB V).
      </td></tr>
    </table>
  </td></tr>`);

  if (o.cane) blocchi.push(`
  <tr><td style="padding:16px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F1E9;">
      <tr><td style="padding:14px 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        &#128054; <strong style="color:#2A2E2B;">Auch Ihr Hund ist herzlich willkommen</strong> &middot; 13 &euro; pro Tag, vor Ort zu zahlen; Futter ist nicht inbegriffen.
        Er f&uuml;hlt sich wohl im Zimmer, in der Lobby und im Bistrot La Piazza &mdash; in den Gemeinschaftsbereichen bitte an der Leine. Keinen Zutritt hat er zu Pools, Park und Restaurant.
      </td></tr>
    </table>
  </td></tr>`);

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EDE7DC;">
<tr><td align="center" style="padding:24px 12px 40px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#FFFFFF;">

  <tr><td align="center" style="padding:26px 36px 18px 36px;">
    <a href="https://www.hoteltermeleonardo.com" target="_blank" style="text-decoration:none;"><img src="https://www.termeleonardo.com/img/logo.png" alt="LEONARDO — TERME HOTEL ****" width="247" height="64" style="display:block;margin:0 auto;border:0;" /></a>
  </td></tr>

  <tr><td style="padding:0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="46%" height="3" style="background-color:#1E7F88;font-size:0;line-height:0;">&nbsp;</td>
      <td width="4%" style="font-size:0;line-height:0;">&nbsp;</td>
      <td width="30%" height="3" style="background-color:#1E7F88;font-size:0;line-height:0;">&nbsp;</td>
      <td width="4%" style="font-size:0;line-height:0;">&nbsp;</td>
      <td width="16%" height="3" style="background-color:#8FC5C9;font-size:0;line-height:0;">&nbsp;</td>
    </tr></table>
  </td></tr>
  <tr><td align="right" style="padding:14px 36px 0 36px;">
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:1.5px;color:#A79E8F;">BEST&Auml;TIGUNG NR. <strong style="color:#7B756A;">${numeroConferma(d.numeroOfferta)}</strong></div>
  </td></tr>

  <tr><td style="padding:16px 36px 0 36px;">
    <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#2A2E2B;">${anredeDE(d.intestatario, o.genere, o.titolo)},</p>
    <h1 style="margin:0 0 10px 0;font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:31px;font-weight:normal;color:#2A2E2B;">
      Alles ist bestätigt.<br />Wir erwarten Sie am ${anreise}
    </h1>
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
      ${annunciato ? 'Wir haben die Kopie Ihrer Überweisung erhalten' : 'Ihre Anzahlung ist bei uns eingegangen'} und ${d.camere.length > 1 ? 'Ihre Zimmer sind reserviert' : 'Ihr Zimmer ist reserviert'}. Buchung <strong style="color:#2A2E2B;">${numeroConferma(d.numeroOfferta)}</strong>.
    </p>
  </td></tr>

  <tr><td style="padding:18px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FAF8F4;">
      <tr><td style="padding:16px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
          <tr><td width="100" style="padding:0 10px 7px 0;color:#8C8578;">Anreise</td><td style="padding:0 0 7px 0;"><strong style="color:#2A2E2B;">${anreise}</strong>, ab 15:00 Uhr</td></tr>
          <tr><td style="padding:0 10px 7px 0;color:#8C8578;">Abreise</td><td style="padding:0 0 7px 0;"><strong style="color:#2A2E2B;">${abreise}</strong>, bis 11:00 Uhr</td></tr>
        
  <tr><td style="padding:0 10px 12px 0;color:#8C8578;">Aufenthalt</td><td style="padding:0 0 12px 0;">${periodiDiversi(d) ? `${gaeste} in ${d.camere.length} Zimmern &middot; Zeiträume bei jedem Zimmer` : (soggiorniMisti(d) ? `${gaeste} &middot; Zeiträume bei jedem Gast angegeben` : `${naechte} für ${gaeste}`)}</td></tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${camereConferma(ordinaCamere(d.camere), 'de', d)}</table>${dettaglioSoggiorno(o.dettaglio, 'Ihr Aufenthalt im \u00dcberblick', o.dettaglioCamera)}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
          <tr><td width="130" style="padding:6px 10px 5px 0;color:#8C8578;">Gesamtpreis</td><td style="padding:6px 0 5px 0;">${eur(d.totale,'de-DE')} &euro;</td></tr>
          <tr><td style="padding:0 10px 5px 0;color:#8C8578;">${annunciato ? 'Anzahlung &middot; Überweisung angekündigt' : 'Anzahlung erhalten'}</td><td style="padding:0 0 5px 0;">&minus; ${eur(gezahlt,'de-DE')} &euro;</td></tr>
          <tr><td style="padding:0 10px 0 0;color:#8C8578;">Restbetrag vor Ort</td><td style="padding:0;"><strong style="color:#0F5C64;font-size:16px;">${eur(rest,'de-DE')} &euro;</strong></td></tr>
          ${guthaben > 0 ? `<tr><td colspan="2" style="padding:6px 0 0 0;font-size:13px;color:#55524B;">Ihre Anzahlung &uuml;bersteigt den Gesamtpreis um <strong>${eur(guthaben,'de-DE')} &euro;</strong>: die Differenz kl&auml;ren wir bei Ihrer Ankunft.</td></tr>` : ''}
        </table>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#A79E8F;padding-top:8px;">
          Zuzüglich Kurtaxe: 1,50 &euro; pro Person und Tag, maximal 7 Tage, vor Ort zu zahlen.
        </div>
      </td></tr>
${blocchi.join('')}
    </table>
  </td></tr>

  <tr><td style="padding:20px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#E3F0F1;">
      <tr>
        <td width="6" style="background-color:#1E7F88;font-size:0;line-height:0;">&nbsp;</td>
        <td style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:23px;color:#3C6266;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:24px;color:#0F5C64;padding-bottom:8px;">Erledigen Sie den Online-Check-in</div>
          Sie erhalten in Kürze eine E-Mail mit dem Link. Wenn Sie ihn vor der Anreise ausfüllen, gewinnen Sie einen halben Tag:
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:9px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#3C6266;">
            <tr><td valign="top" width="16" style="padding:0 6px 5px 0;color:#1E7F88;">&#10003;</td><td style="padding:0 0 5px 0;">Thermalpools bereits <strong style="color:#0F5C64;">ab 11:30 Uhr</strong>, ohne bis 15:00 Uhr zu warten</td></tr>
            <tr><td valign="top" style="padding:0 6px 5px 0;color:#1E7F88;">&#10003;</td><td style="padding:0 0 5px 0;">Zimmer sofort, falls es schon bereit ist</td></tr>
            <tr><td valign="top" style="padding:0 6px 0 0;color:#1E7F88;">&#10003;</td><td style="padding:0;">Keine Wartezeit an der Rezeption</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:22px 36px 0 36px;">
    <h2 style="margin:0 0 6px 0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:24px;font-weight:normal;color:#2A2E2B;">Wir bereiten Ihre Ankunft vor</h2>
    ${d.linkArrivo ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px 0;"><tr><td align="center" bgcolor="#1E7F88" style="border-radius:5px;"><a href="${d.linkArrivo}" style="display:inline-block;padding:11px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#FFFFFF;text-decoration:none;font-weight:bold;">Anreise vorbereiten</a></td></tr></table><p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#7B756A;">Zwei Minuten vom Handy: Ankunftszeit, Rechnung, Transfer. Lieber schreiben? Antworten Sie einfach auf diese E-Mail.</p>` : `<p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#7B756A;">
      Antworten Sie einfach auf diese E-Mail: wir kümmern uns vorab darum.
    </p>`}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="padding:12px 16px;background-color:#FAF8F4;border-left:3px solid #7A8450;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Wann werden Sie ankommen?</strong><br /><span style="color:#7B756A;font-size:13px;">So empfangen wir Sie ohne Wartezeit. Und sollten Sie nach 22:00 Uhr ankommen, sagen Sie uns bitte vorab Bescheid: wir richten uns darauf ein, Sie auch spät zu empfangen</span>
      </td></tr>
      <tr><td height="8" style="font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:12px 16px;background-color:#FAF8F4;border-left:3px solid #7A8450;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Transfer ab Flughafen Venedig</strong> &middot; Sammeltaxi ab 65 &euro;<br /><span style="color:#7B756A;font-size:13px;">Nennen Sie uns Flugnummer und Uhrzeit. Mindestens 24 Stunden vorher zu buchen</span>${bottoneServizio('transfer', d, 'de')}
      </td></tr>
      <tr><td height="8" style="font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:12px 16px;background-color:#FAF8F4;border-left:3px solid #7A8450;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Antistress-Massage</strong> &middot; 55 &euro; (45 Minuten)<br /><span style="color:#7B756A;font-size:13px;">Die beliebteste. Die Termine sind schnell vergeben, am besten jetzt reservieren</span><br /><a href="https://www.termeleonardo.com/pdf/listino-spa-trattamenti-e-massaggi-hotel-leonardo-da-vinci-terme-de.pdf" target="_blank" style="color:#0F5C64;font-size:13px;text-decoration:underline;">Die vollst&auml;ndige Preisliste der Behandlungen und Massagen herunterladen (PDF)</a>${bottoneServizio('trattamenti', d, 'de')}
      </td></tr>
      <tr><td height="8" style="font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:12px 16px;background-color:#FAF8F4;border-left:3px solid #7A8450;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Early Bird Swimming</strong> &middot; 20 &euro; pro Person<br /><span style="color:#7B756A;font-size:13px;">Pools schon ab 9:00 Uhr am Anreisetag. Bitte jetzt anfragen, nicht erst bei der Ankunft</span>
      </td></tr>
      <tr><td height="8" style="font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:12px 16px;background-color:#FAF8F4;border-left:3px solid #7A8450;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Ein Gutschein</strong> &middot; Therme und Behandlungen zum Verschenken<br /><span style="color:#7B756A;font-size:13px;">Wir gestalten ihn mit Ihrer pers&ouml;nlichen Widmung und senden ihn Ihnen per E-Mail, fertig zum &Uuml;berreichen</span>${typeof bottoneServizio === 'function' ? bottoneServizio('buoni', d, 'de') : ''}
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:22px 36px 0 36px;">
    <h2 style="margin:0 0 10px 0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:24px;font-weight:normal;color:#2A2E2B;">Gut zu wissen</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
      <tr><td width="130" valign="top" style="padding:0 12px 9px 0;color:#8C8578;">Pools</td><td valign="top" style="padding:0 0 9px 0;">Geöffnet von 8:00 bis 19:30 Uhr, freitags und samstags bis 22:30 Uhr &middot; Badekappe erforderlich, an der Rezeption für 3 € erhältlich</td></tr>
      <tr><td valign="top" style="padding:0 12px 9px 0;color:#8C8578;">Rauchen</td><td valign="top" style="padding:0 0 9px 0;">Nichtraucherhotel: im Zimmer wird nicht geraucht, auf dem Balkon schon</td></tr>
      <tr><td valign="top" style="padding:0 12px 9px 0;color:#8C8578;">Abendessen</td><td valign="top" style="padding:0 0 9px 0;">Ab 19:30 Uhr, letzter Einlass 20:20 Uhr. Bei späterer Ankunft sagen Sie uns Bescheid: wir stellen Ihnen einen Teller aufs Zimmer</td></tr>
      <tr><td valign="top" style="padding:0 12px 9px 0;color:#8C8578;">Mittagessen</td><td valign="top" style="padding:0 0 9px 0;">Im Bistrot La Piazza, auch im Bademantel: täglich 10:00&ndash;23:00 Uhr, Mittagessen 12:30&ndash;14:30 Uhr, kleine Gerichte bis 17:30 Uhr</td></tr>
      <tr><td valign="top" style="padding:0 12px 9px 0;color:#8C8578;">Abreisetag</td><td valign="top" style="padding:0 0 9px 0;">Pools bis 11:00 Uhr inklusive. Verl&auml;ngerung bis 18:30 Uhr zum Vorzugspreis von 30 &euro; pro Person, einfach beim Check-out sagen</td></tr>
      <tr><td valign="top" style="padding:0 12px 0 0;color:#8C8578;">E-Auto</td><td valign="top" style="padding:0;">Acht Ladestationen mit 11 kW. Die Ladung läuft über die App <em>Next charge</em> oder <em>My wallbox</em>: bitte eigenes Kabel mitbringen</td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:20px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F1E9;"><tr><td style="padding:14px 18px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;color:#8C8578;">
      Falls sich Ihre Pläne ändern: die Kaution wird bei einer Stornierung einbehalten.
      Bei Stornierung bis 7 Tage vor Reiseantritt wird nur die Kaution einbehalten, danach 100 % der gebuchten Leistungen; bei fixer Zimmernummer 70 % ab 30 Tagen und 100 % ab 7 Tagen.
      Bei vorzeitiger Abreise oder verspäteter Anreise werden auch die nicht genutzten Übernachtungen berechnet. Stornierungen nur schriftlich, an info@termeleonardo.com.
    </td></tr></table>
  </td></tr>

  <tr><td style="padding:22px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="1" style="background-color:#E4DED2;font-size:0;line-height:0;">&nbsp;</td></tr></table>
    <p style="margin:16px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
      Für alle Fragen, vor und während Ihres Aufenthalts, sind wir jederzeit gerne für Sie da.
    </p>
    <p style="margin:16px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:24px;color:#2A2E2B;">
      Mit sonnigen Grüßen aus Monteortone,<br />
      ${(o.firma || 'Die Reception').replace('La Reception','Die Reception')}
    </p>
    <p style="margin:12px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:23px;color:#55524B;">
      +39 049 9939 200 &nbsp;&middot;&nbsp; info@termeleonardo.com
    </p>
  </td></tr>

  <tr><td align="center" style="padding:20px 36px 0 36px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="padding:9px 16px;background-color:#F1F4EA;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#5F6B44;">${typeof bloccoCertificazioni === 'function' ? bloccoCertificazioni() : ''}
        <strong style="color:#4A5636;">Erstes Thermenhotel Europas</strong> &ndash; zertifiziert nach <strong style="color:#4A5636;">GSTC Hotel Standard</strong> f&uuml;r Nachhaltigkeit
      </td>
    </tr></table>
  </td></tr>

  <tr><td align="center" style="padding:20px 36px 26px 36px;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:15px;letter-spacing:5px;color:#2A2E2B;">TERME LEONARDO</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:20px;color:#8C8578;padding-top:10px;">
      Via Monteortone 46 &middot; 35037 Monteortone di Teolo (PD) &middot; <a href="https://www.hoteltermeleonardo.com" target="_blank" style="color:#8C8578;text-decoration:underline;">hoteltermeleonardo.com</a>
    </div>
  </td></tr>

</table>
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
  <tr><td align="center" style="padding:14px 36px 0 36px;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:17px;color:#A79E8F;">
    Tria S.r.l. &middot; P.IVA IT 02042330288 &middot; CIN IT028089A18QYO48ED
  </td></tr>
</table>
</td></tr>
</table>`;
}

function betreffBestaetigung(d) {
  return `Bestätigung ${numeroConferma(d.numeroOfferta)} — wir erwarten Sie am ${datumDE(d.giornoArrivo, d.mese, d.anno)}`;
}
