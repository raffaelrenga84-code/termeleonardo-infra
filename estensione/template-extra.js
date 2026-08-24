/* ============================================================
   Offerta Leonardo — documenti di cortesia (v1.2)
   1) Sollecito offerta: opzione in scadenza o scaduta
   2) Info Day Spa: prezzi e istruzioni dai modelli della reception
   Usa i saluti e i formati data dei modelli principali, che sono
   caricati prima di questo file.
   ============================================================ */

/* la scadenza "9 Aug 2026" è già passata? */
function scadutaExtra(s) {
  const m = (s || '').match(/(\d{1,2})\s+([A-Za-z]{3})\s+(20\d\d)/);
  if (!m) return false;
  const MN = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
               Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  const d = new Date(+m[3], MN[m[2]] ?? 0, +m[1], 23, 59, 59);
  return d < new Date();
}

/* in italiano davanti a 8 e 11 la preposizione si elide: all'11, dall'8, l'11 */
function elidiIT(prep, data) {
  const g = parseInt(String(data), 10);
  if (g === 8 || g === 11) {
    if (prep === 'al') return `all'${data}`;
    if (prep === 'dal') return `dall'${data}`;
    if (prep === 'il') return `l'${data}`;
  }
  return `${prep} ${data}`;
}

const EXTRA_GSTC = {
  it: '<strong style="color:#4A5636;">Primo hotel termale in Europa</strong> certificato <strong style="color:#4A5636;">GSTC Hotel Standard</strong> per la sostenibilit&agrave; &middot; ente certificatore Vireo Srl',
  de: '<strong style="color:#4A5636;">Erstes Thermenhotel Europas</strong>, zertifiziert nach dem <strong style="color:#4A5636;">GSTC Hotel Standard</strong> f&uuml;r Nachhaltigkeit &middot; Zertifizierungsstelle Vireo Srl',
  en: '<strong style="color:#4A5636;">First thermal hotel in Europe</strong> certified to the <strong style="color:#4A5636;">GSTC Hotel Standard</strong> for sustainability &middot; certification body Vireo Srl',
  fr: '<strong style="color:#4A5636;">Premier h&ocirc;tel thermal d&apos;Europe</strong> certifi&eacute; <strong style="color:#4A5636;">GSTC Hotel Standard</strong> pour la durabilit&eacute; &middot; organisme certificateur Vireo Srl'
};

const EXTRA_CHIUSURA = {
  it: { riga: 'Per qualsiasi cosa risponda pure a questa email, oppure ci chiami: siamo qui tutti i giorni.', ruolo: 'Ufficio prenotazioni' },
  de: { riga: 'Antworten Sie einfach auf diese E-Mail oder rufen Sie uns an: wir sind jeden Tag f&uuml;r Sie da.', ruolo: 'Reservierungsb&uuml;ro' },
  en: { riga: 'For anything at all, just reply to this email or give us a call: we are here every day.', ruolo: 'Reservations office' },
  fr: { riga: 'Pour toute question, r&eacute;pondez simplement &agrave; cet e-mail ou appelez-nous : nous sommes l&agrave; tous les jours.', ruolo: 'Bureau des r&eacute;servations' }
};

function salutoExtra(d, o, lingua) {
  if (lingua === 'de') return anredeDE(d.intestatario, o.genere, o.titolo);
  if (lingua === 'en') return greetingEN(d.intestatario, o.genere, o.titolo);
  if (lingua === 'fr') return politesseFR(d.intestatario, o.genere, o.titolo);
  return saluto(d.intestatario, o.genere);
}

function dataExtra(giorno, mese, anno, lingua) {
  if (lingua === 'de') return datumDE(giorno, mese, anno);
  if (lingua === 'en') return dateEN(giorno, mese, anno);
  if (lingua === 'fr') return dateFR(giorno, mese, anno);
  return dataIT(giorno, mese, anno);
}

function scadenzaExtra(s, lingua) {
  if (lingua === 'de') return fristDE(s);
  if (lingua === 'en') return deadlineEN(s);
  if (lingua === 'fr') return echeanceFR(s);
  return scadenzaIT(s);
}

function corniceExtra(banda, corpo, o, lingua) {
  const c = EXTRA_CHIUSURA[lingua] || EXTRA_CHIUSURA.it;
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
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:1.5px;color:#A79E8F;">${banda}</div>
  </td></tr>

${corpo}

  <tr><td style="padding:22px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="1" style="background-color:#E4DED2;font-size:0;line-height:0;">&nbsp;</td></tr></table>
    <p style="margin:16px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">${c.riga}</p>
    <p style="margin:16px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:24px;color:#2A2E2B;">
      ${o.firma || 'La Reception'}<br />
      <span style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#8C8578;">${c.ruolo}</span>
    </p>
    <p style="margin:14px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:23px;color:#55524B;">
      +39 049 9939 200 &nbsp;&middot;&nbsp; info@termeleonardo.com
    </p>
  </td></tr>

  <tr><td align="center" style="padding:20px 36px 0 36px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="padding:9px 16px;background-color:#F1F4EA;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#5F6B44;">
        ${EXTRA_GSTC[lingua] || EXTRA_GSTC.it}
      </td>
    </tr></table>
  </td></tr>

  <tr><td align="center" style="padding:20px 36px 26px 36px;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:15px;letter-spacing:5px;color:#2A2E2B;">TERME LEONARDO</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:20px;color:#8C8578;padding-top:10px;">
      Via Monteortone, 46 &middot; 35037 Monteortone di Abano Terme (PD) &middot; <a href="https://www.hoteltermeleonardo.com" target="_blank" style="color:#8C8578;text-decoration:underline;">hoteltermeleonardo.com</a>
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

/* ============================================================
   1) SOLLECITO OFFERTA
   ============================================================ */

const SOLLECITO_T = {
  it: {
    banda: (n) => `OFFERTA N. <strong style="color:#7B756A;">${n}</strong>`,
    h1Viva: (s) => `Le teniamo la camera<br />fino ${elidiIT('al', s)}`,
    h1Morta: 'La sua opzione &egrave; scaduta:<br />possiamo ancora aiutarla?',
    intro: (arrivo, partenza, notti, ospiti, tot) =>
      `Le avevamo preparato la proposta per il soggiorno <strong style="color:#2A2E2B;">${elidiIT('dal', arrivo)} ${elidiIT('al', partenza)}</strong> — ${notti} per ${ospiti}, ${tot} &euro; in totale — e non ci &egrave; ancora arrivata una sua risposta.`,
    introDiversi: (n, ospiti, tot) =>
      `Le avevamo preparato la proposta per il suo soggiorno — ${ospiti} in ${n} camere, con i periodi indicati nell&apos;offerta, ${tot} &euro; in totale — e non ci &egrave; ancora arrivata una sua risposta.`,
    boxViva: (s) => `Il periodo che ha scelto &egrave; molto richiesto. L&apos;opzione resta sua fino ${elidiIT('al', s).replace(s, `<strong style="color:#0F5C64;">${s}</strong>`)}: dopo quella data la camera torna disponibile per altri ospiti.`,
    boxMorta: (s) => `L&apos;opzione si &egrave; chiusa il <strong style="color:#0F5C64;">${s}</strong> e la camera &egrave; tornata prenotabile. Se il soggiorno le interessa ancora, risponda a questa email: verifichiamo subito la disponibilit&agrave; e, se la camera c&apos;&egrave;, gliela riserviamo di nuovo.`,
    bottone: 'Conferma Ora',
    pagamento: (acc, num) => `Per bloccarla basta l&apos;acconto di <strong style="color:#2A2E2B;">${acc} &euro;</strong>: con carta dal pulsante qui sopra, oppure con bonifico a Tria S.r.l. — IBAN <strong style="color:#2A2E2B;">${IBAN}</strong>, causale <strong style="color:#2A2E2B;">${num}</strong>.`,
    pagamentoSolo: (acc, num) => `Per bloccarla basta l&apos;acconto di <strong style="color:#2A2E2B;">${acc} &euro;</strong> con bonifico a Tria S.r.l. — IBAN <strong style="color:#2A2E2B;">${IBAN}</strong>, causale <strong style="color:#2A2E2B;">${num}</strong>.`,
    congedo: 'Se invece i suoi piani sono cambiati, ce lo dica con un semplice cenno di risposta: nessun disturbo, e liberiamo la camera per chi &egrave; in attesa.',
    oggViva: (s, a) => `La sua opzione vale fino ${elidiIT('al', s)} — soggiorno ${elidiIT('dal', a)} · Hotel Terme Leonardo`,
    oggMorta: (a) => `La sua offerta per ${elidiIT('il', a)} è scaduta: la riprendiamo? · Hotel Terme Leonardo`
  },
  de: {
    banda: (n) => `ANGEBOT NR. <strong style="color:#7B756A;">${n}</strong>`,
    h1Viva: (s) => `Wir halten Ihr Zimmer<br />bis zum ${s} frei`,
    h1Morta: 'Ihre Option ist abgelaufen:<br />d&uuml;rfen wir noch etwas tun?',
    intro: (arrivo, partenza, notti, ospiti, tot) =>
      `Wir hatten Ihnen das Angebot f&uuml;r den Aufenthalt <strong style="color:#2A2E2B;">vom ${arrivo} bis ${partenza}</strong> vorbereitet — ${notti}, ${ospiti}, insgesamt ${tot} &euro; — und noch keine R&uuml;ckmeldung von Ihnen erhalten.`,
    introDiversi: (n, ospiti, tot) =>
      `Wir hatten Ihnen das Angebot f&uuml;r Ihren Aufenthalt vorbereitet — ${ospiti} in ${n} Zimmern, mit den im Angebot genannten Zeitr&auml;umen, insgesamt ${tot} &euro; — und noch keine R&uuml;ckmeldung von Ihnen erhalten.`,
    boxViva: (s) => `Der von Ihnen gew&auml;hlte Zeitraum ist sehr gefragt. Die Option bleibt bis zum <strong style="color:#0F5C64;">${s}</strong> f&uuml;r Sie reserviert: danach wird das Zimmer wieder f&uuml;r andere G&auml;ste frei.`,
    boxMorta: (s) => `Die Option ist am <strong style="color:#0F5C64;">${s}</strong> abgelaufen und das Zimmer wieder buchbar. Wenn Sie der Aufenthalt noch interessiert, antworten Sie einfach auf diese E-Mail: wir pr&uuml;fen sofort die Verf&uuml;gbarkeit und reservieren es Ihnen gerne erneut.`,
    bottone: 'Jetzt best&auml;tigen',
    pagamento: (acc, num) => `Zum Fixieren gen&uuml;gt die Anzahlung von <strong style="color:#2A2E2B;">${acc} &euro;</strong>: per Karte &uuml;ber die Schaltfl&auml;che oben oder per &Uuml;berweisung an Tria S.r.l. — IBAN <strong style="color:#2A2E2B;">${IBAN}</strong>, Verwendungszweck <strong style="color:#2A2E2B;">${num}</strong>.`,
    pagamentoSolo: (acc, num) => `Zum Fixieren gen&uuml;gt die Anzahlung von <strong style="color:#2A2E2B;">${acc} &euro;</strong> per &Uuml;berweisung an Tria S.r.l. — IBAN <strong style="color:#2A2E2B;">${IBAN}</strong>, Verwendungszweck <strong style="color:#2A2E2B;">${num}</strong>.`,
    congedo: 'Sollten sich Ihre Pl&auml;ne ge&auml;ndert haben, gen&uuml;gt eine kurze Antwort: gar kein Problem — dann geben wir das Zimmer f&uuml;r wartende G&auml;ste frei.',
    oggViva: (s, a) => `Ihre Option gilt bis ${s} — Aufenthalt ab ${a} · Hotel Terme Leonardo`,
    oggMorta: (a) => `Ihr Angebot für den ${a} ist abgelaufen — sollen wir es erneuern? · Hotel Terme Leonardo`
  },
  en: {
    banda: (n) => `OFFER NO. <strong style="color:#7B756A;">${n}</strong>`,
    h1Viva: (s) => `We are holding your room<br />until ${s}`,
    h1Morta: 'Your option has expired:<br />can we still help?',
    intro: (arrivo, partenza, notti, ospiti, tot) =>
      `We had prepared your offer for the stay <strong style="color:#2A2E2B;">from ${arrivo} to ${partenza}</strong> — ${notti} for ${ospiti}, ${tot} &euro; in total — and we have not yet heard back from you.`,
    introDiversi: (n, ospiti, tot) =>
      `We had prepared your offer — ${ospiti} in ${n} rooms, with the dates shown in the offer, ${tot} &euro; in total — and we have not yet heard back from you.`,
    boxViva: (s) => `The dates you chose are in high demand. The option stays yours until <strong style="color:#0F5C64;">${s}</strong>: after that, the room becomes available to other guests again.`,
    boxMorta: (s) => `The option closed on <strong style="color:#0F5C64;">${s}</strong> and the room is bookable again. If you are still interested, just reply to this email: we will check availability right away and gladly reserve it for you again.`,
    bottone: 'Confirm now',
    pagamento: (acc, num) => `A deposit of <strong style="color:#2A2E2B;">${acc} &euro;</strong> is all it takes: by card via the button above, or by bank transfer to Tria S.r.l. — IBAN <strong style="color:#2A2E2B;">${IBAN}</strong>, reference <strong style="color:#2A2E2B;">${num}</strong>.`,
    pagamentoSolo: (acc, num) => `A deposit of <strong style="color:#2A2E2B;">${acc} &euro;</strong> by bank transfer to Tria S.r.l. is all it takes — IBAN <strong style="color:#2A2E2B;">${IBAN}</strong>, reference <strong style="color:#2A2E2B;">${num}</strong>.`,
    congedo: 'If your plans have changed, a one-line reply is all we need: no trouble at all — we will release the room to guests on our waiting list.',
    oggViva: (s, a) => `Your option is valid until ${s} — stay from ${a} · Hotel Terme Leonardo`,
    oggMorta: (a) => `Your offer for ${a} has expired — shall we renew it? · Hotel Terme Leonardo`
  },
  fr: {
    banda: (n) => `OFFRE N&deg; <strong style="color:#7B756A;">${n}</strong>`,
    h1Viva: (s) => `Nous gardons votre chambre<br />jusqu&apos;au ${s}`,
    h1Morta: 'Votre option a expir&eacute; :<br />pouvons-nous encore vous aider ?',
    intro: (arrivo, partenza, notti, ospiti, tot) =>
      `Nous vous avions pr&eacute;par&eacute; l&apos;offre pour le s&eacute;jour <strong style="color:#2A2E2B;">du ${arrivo} au ${partenza}</strong> — ${notti} pour ${ospiti}, ${tot} &euro; au total — et nous n&apos;avons pas encore re&ccedil;u votre r&eacute;ponse.`,
    introDiversi: (n, ospiti, tot) =>
      `Nous vous avions pr&eacute;par&eacute; l&apos;offre pour votre s&eacute;jour — ${ospiti} en ${n} chambres, avec les p&eacute;riodes indiqu&eacute;es dans l&apos;offre, ${tot} &euro; au total — et nous n&apos;avons pas encore re&ccedil;u votre r&eacute;ponse.`,
    boxViva: (s) => `La p&eacute;riode que vous avez choisie est tr&egrave;s demand&eacute;e. L&apos;option reste la v&ocirc;tre jusqu&apos;au <strong style="color:#0F5C64;">${s}</strong> : pass&eacute; ce d&eacute;lai, la chambre redevient disponible pour d&apos;autres h&ocirc;tes.`,
    boxMorta: (s) => `L&apos;option s&apos;est termin&eacute;e le <strong style="color:#0F5C64;">${s}</strong> et la chambre est de nouveau r&eacute;servable. Si le s&eacute;jour vous int&eacute;resse toujours, r&eacute;pondez simplement &agrave; cet e-mail : nous v&eacute;rifions aussit&ocirc;t la disponibilit&eacute; et vous la r&eacute;servons volontiers &agrave; nouveau.`,
    bottone: 'Je confirme',
    pagamento: (acc, num) => `Il suffit de l&apos;acompte de <strong style="color:#2A2E2B;">${acc} &euro;</strong> : par carte via le bouton ci-dessus, ou par virement &agrave; Tria S.r.l. — IBAN <strong style="color:#2A2E2B;">${IBAN}</strong>, r&eacute;f&eacute;rence <strong style="color:#2A2E2B;">${num}</strong>.`,
    pagamentoSolo: (acc, num) => `Il suffit de l&apos;acompte de <strong style="color:#2A2E2B;">${acc} &euro;</strong> par virement &agrave; Tria S.r.l. — IBAN <strong style="color:#2A2E2B;">${IBAN}</strong>, r&eacute;f&eacute;rence <strong style="color:#2A2E2B;">${num}</strong>.`,
    congedo: 'Si vos projets ont chang&eacute;, un simple mot de r&eacute;ponse nous suffit : aucun souci — nous lib&eacute;rerons la chambre pour les h&ocirc;tes en attente.',
    oggViva: (s, a) => `Votre option est valable jusqu'au ${s} — séjour à partir du ${a} · Hôtel Terme Leonardo`,
    oggMorta: (a) => `Votre offre pour le ${a} a expiré — la renouvelons-nous ? · Hôtel Terme Leonardo`
  }
};

const OSPITI_EXTRA = {
  it: (a) => a === 1 ? '1 persona' : `${a} persone`,
  de: (a) => a === 1 ? '1 Person' : `${a} Personen`,
  en: (a) => a === 1 ? '1 guest' : `${a} guests`,
  fr: (a) => a === 1 ? '1 personne' : `${a} personnes`
};
const NOTTI_EXTRA = {
  it: (n) => n === 1 ? '1 notte' : `${n} notti`,
  de: (n) => n === 1 ? '1 Nacht' : `${n} N\u00e4chte`,
  en: (n) => n === 1 ? '1 night' : `${n} nights`,
  fr: (n) => n === 1 ? '1 nuit' : `${n} nuits`
};

function costruisciSollecitoBase(d, opzioni, lingua) {
  const o = opzioni || {};
  const t = SOLLECITO_T[lingua] || SOLLECITO_T.it;
  const arrivo = dataExtra(d.giornoArrivo, d.mese, d.anno, lingua);
  const partenza = dataExtra(d.giornoPartenza, d.mesePartenza || d.mese, d.annoPartenza || d.anno, lingua);
  const scad = scadenzaExtra(d.scadenza, lingua);
  const morta = scadutaExtra(d.scadenza);
  const notti = NOTTI_EXTRA[lingua](d.notti);
  const ospiti = OSPITI_EXTRA[lingua](d.adulti + (d.bambini || 0));

  const pagamento = morta ? '' : `
  <tr><td style="padding:18px 36px 0 36px;">
    ${d.linkPagamento ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px 0;"><tr>
      <td align="center" bgcolor="#E8751A" style="border-radius:5px;">
        <a href="${d.linkPagamento}" style="display:inline-block;padding:12px 30px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#FFFFFF;text-decoration:none;font-weight:bold;">${t.bottone}</a>
      </td>
    </tr></table>` : ''}
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;color:#55524B;">
      ${(d.linkPagamento ? t.pagamento : t.pagamentoSolo)(d.accontoFmt, d.numeroOfferta)}
    </p>
  </td></tr>`;

  const corpo = `
  <tr><td style="padding:16px 36px 0 36px;">
    <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#2A2E2B;">${salutoExtra(d, o, lingua)},</p>
    <h1 style="margin:0 0 10px 0;font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:31px;font-weight:normal;color:#2A2E2B;">
      ${morta ? t.h1Morta : t.h1Viva(scad)}
    </h1>
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
      ${periodiDiversi(d) ? t.introDiversi(d.camere.length, ospiti, d.totaleFmt) : t.intro(arrivo, partenza, notti, ospiti, d.totaleFmt)}
    </p>
  </td></tr>

  <tr><td style="padding:18px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#E3F0F1;">
      <tr>
        <td width="6" style="background-color:#1E7F88;font-size:0;line-height:0;">&nbsp;</td>
        <td style="padding:16px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:23px;color:#3C6266;">
          ${morta ? t.boxMorta(scad) : t.boxViva(scad)}
        </td>
      </tr>
    </table>
  </td></tr>
${pagamento}
  <tr><td style="padding:18px 36px 0 36px;">
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">${t.congedo}</p>
  </td></tr>`;

  return corniceExtra(t.banda(d.numeroOfferta), corpo, o, lingua);
}

function oggettoSollecitoBase(d, lingua) {
  const t = SOLLECITO_T[lingua] || SOLLECITO_T.it;
  const arrivo = dataExtra(d.giornoArrivo, d.mese, d.anno, lingua);
  return scadutaExtra(d.scadenza) ? t.oggMorta(arrivo) : t.oggViva(scadenzaExtra(d.scadenza, lingua), arrivo);
}

function costruisciSollecitoIT(d, o) { return costruisciSollecitoBase(d, o, 'it'); }
function costruisciSollecitoDE(d, o) { return costruisciSollecitoBase(d, o, 'de'); }
function costruisciSollecitoEN(d, o) { return costruisciSollecitoBase(d, o, 'en'); }
function costruisciSollecitoFR(d, o) { return costruisciSollecitoBase(d, o, 'fr'); }
function oggettoSollecitoIT(d) { return oggettoSollecitoBase(d, 'it'); }
function oggettoSollecitoDE(d) { return oggettoSollecitoBase(d, 'de'); }
function oggettoSollecitoEN(d) { return oggettoSollecitoBase(d, 'en'); }
function oggettoSollecitoFR(d) { return oggettoSollecitoBase(d, 'fr'); }

/* ============================================================
   2) INFO DAY SPA — prezzi e regole dai modelli della reception
   ============================================================ */

const DAYSPA_LINK = {
  it: 'https://www.termeleonardo.com/it/day-spa/prenotazioni',
  de: 'https://www.termeleonardo.com/de/day-spa/prenotazioni',
  en: 'https://www.termeleonardo.com/en/day-spa/prenotazioni',
  fr: 'https://www.termeleonardo.com/en/day-spa/prenotazioni'   /* pagina FR in costruzione */
};

const DAYSPA_T = {
  it: {
    banda: 'DAY SPA', h1: 'Una giornata alle nostre terme',
    intro: 'Grazie della sua richiesta: ecco prezzi e informazioni per organizzare la sua giornata di benessere.',
    prezziTitolo: 'Ingresso &middot; dalle 9:00 alle 18:30',
    prezzi: [['Dal luned&igrave; al venerd&igrave;', '35,00 &euro; a persona'],
             ['Sabato, domenica e festivi', '45,00 &euro; a persona'],
             ['Serale — solo venerd&igrave; e sabato, 18:00&ndash;22:30', '29,00 &euro; a persona']],
    prezziNota: 'Nei giorni di festa e negli eventi speciali i prezzi possono variare. Nessuna riduzione per i bambini da 1 anno in su; fino a 1 anno l&apos;ingresso &egrave; gratuito.',
    prenotaTitolo: 'Come si prenota',
    prenotaTesto: 'Il biglietto si acquista in anticipo, per tutti i giorni della settimana, dal nostro sito:',
    prenotaBottone: 'Prenoti il suo ingresso',
    prenotaNota: 'Un puntino rosso sul calendario significa che la data &egrave; al completo.',
    linkNota: '',
    compresoTitolo: 'Cosa comprende',
    compreso: [
      'Piscine termali di acqua calda, interna ed esterna comunicanti, e piscina esterna di acqua termale fredda con vista sui Colli Euganei',
      'Centro grotte SPA con biosauna, bagno turco ai vapori termali, vasca idromassaggio, lettini massaggianti, cascata d&apos;acqua termale, cascata di ghiaccio e docce emozionali con aromaterapia <span style="color:#7B756A;">(solo maggiorenni)</span>'
    ],
    tavolaTitolo: 'A tavola',
    tavola: [
      ['Bistrot Bar La Piazza', 'A bordo piscina, con terrazza sul giardino. Piatti leggeri a pranzo: antipasti, pasta, carne o pesce saltati, insalate fresche. Tutti i giorni dalle 10:00 alle 23:00: pranzo dalle 12:30 alle 14:30, spuntini fino alle 17:30'],
      ['Cena a buffet', '35,00 &euro; a persona, bevande escluse, al ristorante: insalate, antipasti caldi e freddi, primi preparati al momento, carne, pesce, frutta e dessert'],
      ['Da fuori', 'Il pranzo al sacco non &egrave; consentito']
    ],
    sapereTitolo: 'Buono a sapersi',
    sapere: [
      ['Kit SPA', 'Accappatoio e telo in spugna a noleggio per la giornata: 19,00 &euro;'],
      ['Camera d&apos;appoggio', '60,00 &euro;, disponibile dalle 9:00 alle 18:30: letto alla francese, bagno con doccia, TV, cassaforte, aria condizionata e Wi-Fi. Si prenota via email dopo l&apos;acquisto del biglietto'],
      ['In piscina', 'Cuffia e ciabattine obbligatorie'],
      ['Massaggi e trattamenti', 'Su prenotazione: conviene fissarli insieme al biglietto, gli orari migliori si esauriscono presto'],
      ['Golf Academy', 'Lezioni su prenotazione nell&apos;area pratica di 15.000 m&sup2; accanto alle piscine: postazioni semicoperte, putting green, pitching green e bunker'],
      ['Amici a quattro zampe', 'Purtroppo non sono ammessi nel parco e nelle piscine termali']
    ],
    ogg: 'Day Spa alle Terme Leonardo — prezzi e informazioni'
  },
  de: {
    banda: 'DAY SPA', h1: 'Ein Tag in unseren Thermen',
    intro: 'Vielen Dank f&uuml;r Ihre Anfrage: hier finden Sie Preise und Informationen f&uuml;r Ihren Wellnesstag.',
    prezziTitolo: 'Eintritt &middot; von 9:00 bis 18:30 Uhr',
    prezzi: [['Montag bis Freitag', '35,00 &euro; pro Person'],
             ['Samstag, Sonntag und Feiertage', '45,00 &euro; pro Person'],
             ['Abends — nur Freitag und Samstag, 18:00&ndash;22:30 Uhr', '29,00 &euro; pro Person']],
    prezziNota: 'An Feiertagen und bei besonderen Veranstaltungen k&ouml;nnen die Preise abweichen. Keine Erm&auml;&szlig;igung f&uuml;r Kinder ab 1 Jahr; bis 1 Jahr ist der Eintritt frei.',
    prenotaTitolo: 'So buchen Sie',
    prenotaTesto: 'Das Ticket wird f&uuml;r alle Wochentage im Voraus &uuml;ber unsere Website gekauft:',
    prenotaBottone: 'Eintritt buchen',
    prenotaNota: 'Ein roter Punkt im Kalender bedeutet: an diesem Tag ausgebucht.',
    linkNota: '',
    compresoTitolo: 'Was enthalten ist',
    compreso: [
      'Verbundene Thermalpools mit warmem Wasser innen und au&szlig;en sowie ein kaltes Thermalbecken im Freien mit Blick auf die Euganeischen H&uuml;gel',
      'SPA-Grottenzentrum mit Biosauna, Dampfbad mit Thermaldampf, Whirlpool, Massageliegen, Thermalwasserfall, Eiswasserfall und Erlebnisduschen mit Aromatherapie <span style="color:#7B756A;">(nur f&uuml;r Erwachsene)</span>'
    ],
    tavolaTitolo: 'Kulinarisches',
    tavola: [
      ['Bistrot Bar La Piazza', 'Direkt am Pool, mit Gartenterrasse. Leichte Gerichte zum Mittag: Vorspeisen, Pasta, kurzgebratenes Fleisch oder Fisch, frische Salate. T&auml;glich von 10:00 bis 23:00 Uhr: Mittagessen von 12:30 bis 14:30 Uhr, kleine Gerichte bis 17:30 Uhr'],
      ['Abendbuffet', '35,00 &euro; pro Person, Getr&auml;nke exklusive, im Restaurant: Salate, warme und kalte Vorspeisen, frisch zubereitete Primi, Fleisch, Fisch, Obst und Desserts'],
      ['Von drau&szlig;en', 'Mitgebrachte Speisen sind nicht gestattet']
    ],
    sapereTitolo: 'Gut zu wissen',
    sapere: [
      ['SPA-Kit', 'Bademantel und Frotteetuch zum Tagesverleih: 19,00 &euro;'],
      ['Tageszimmer', '60,00 &euro;, verf&uuml;gbar von 9:00 bis 18:30 Uhr: franz&ouml;sisches Bett, Bad mit Dusche, TV, Safe, Klimaanlage und WLAN. Buchung per E-Mail nach dem Ticketkauf'],
      ['Im Pool', 'Badehaube und Badeschuhe sind Pflicht'],
      ['Massagen und Anwendungen', 'Auf Reservierung: am besten gleich mit dem Ticket festlegen, die besten Zeiten sind schnell vergeben'],
      ['Golf Academy', 'Golfstunden auf Reservierung auf unserer 15.000-m&sup2;-&Uuml;bungsanlage neben den Thermalpools: halb&uuml;berdachte Abschl&auml;ge, Putting Green, Pitching Green und Bunker'],
      ['Vierbeiner', 'Leider sind Hunde im Park und an den Thermalpools nicht gestattet']
    ],
    ogg: 'Day Spa im Hotel Terme Leonardo — Preise und Informationen'
  },
  en: {
    banda: 'DAY SPA', h1: 'A day at our thermal spa',
    intro: 'Thank you for your kind request: here are the prices and everything you need to plan your wellness day.',
    prezziTitolo: 'Admission &middot; from 9:00 to 18:30',
    prezzi: [['Monday to Friday', '&euro; 35.00 per person'],
             ['Saturday, Sunday and holidays', '&euro; 45.00 per person'],
             ['Evening — Fridays and Saturdays only, 18:00&ndash;22:30', '&euro; 29.00 per person']],
    prezziNota: 'Prices may vary during holidays and special events. No discounts for children aged 1 year and older; infants up to 1 year enter free of charge.',
    prenotaTitolo: 'How to book',
    prenotaTesto: 'Tickets must be purchased in advance, for all days of the week, through our website:',
    prenotaBottone: 'Book your admission',
    prenotaNota: 'A red dot on the calendar means the date is fully booked.',
    linkNota: '',
    compresoTitolo: 'What is included',
    compreso: [
      'Interconnected indoor and outdoor hot thermal pools, plus an outdoor cold thermal pool with panoramic views of the Euganean Hills',
      'SPA cave centre with bio sauna, thermal steam bath, hot tub, massage beds, thermal waterfall, ice waterfall and sensory showers with aromatherapy <span style="color:#7B756A;">(adults only)</span>'
    ],
    tavolaTitolo: 'Dining',
    tavola: [
      ['Bistrot Bar La Piazza', 'By the pool, with a garden terrace. Light lunch dishes: appetizers, pasta, saut&eacute;ed meat or fish, fresh salads. Open daily from 10:00 to 23:00: lunch 12:30&ndash;14:30, light bites until 17:30'],
      ['Dinner buffet', '&euro; 35.00 per person, drinks not included, at the restaurant: salads, hot and cold appetizers, freshly prepared first courses, meat, fish, fruit and desserts'],
      ['From outside', 'Packed lunches are not allowed']
    ],
    sapereTitolo: 'Good to know',
    sapere: [
      ['SPA kit', 'Bathrobe and towel rental for the day: &euro; 19.00'],
      ['Support room', '&euro; 60.00, available from 9:00 to 18:30: French bed, bathroom with shower, TV, safe, air conditioning and free Wi-Fi. Booked by email after purchasing your ticket'],
      ['At the pool', 'Swimming cap and pool slippers are required'],
      ['Massages and treatments', 'By reservation: best booked together with your ticket, as the best times fill up quickly'],
      ['Golf Academy', 'Lessons by reservation at our 15,000 m&sup2; practice area next to the thermal pools: semi-covered bays, putting green, pitching green and bunker'],
      ['Four-legged friends', 'Unfortunately dogs are not allowed in the park or at the thermal pools']
    ],
    ogg: 'Day Spa – Information and Prices · Hotel Terme Leonardo'
  },
  fr: {
    banda: 'DAY SPA', h1: 'Une journ&eacute;e dans nos thermes',
    intro: 'Merci pour votre demande : voici les tarifs et toutes les informations pour organiser votre journ&eacute;e de bien-&ecirc;tre.',
    prezziTitolo: 'Entr&eacute;e &middot; de 9h00 &agrave; 18h30',
    prezzi: [['Du lundi au vendredi', '35,00 &euro; par personne'],
             ['Samedi, dimanche et jours f&eacute;ri&eacute;s', '45,00 &euro; par personne'],
             ['Soir&eacute;e — vendredi et samedi uniquement, 18h00&ndash;22h30', '29,00 &euro; par personne']],
    prezziNota: 'Les jours f&eacute;ri&eacute;s et lors d&apos;&eacute;v&eacute;nements sp&eacute;ciaux, les tarifs peuvent varier. Pas de r&eacute;duction pour les enfants &agrave; partir de 1 an ; jusqu&apos;&agrave; 1 an, l&apos;entr&eacute;e est gratuite.',
    prenotaTitolo: 'Comment r&eacute;server',
    prenotaTesto: 'Le billet s&apos;ach&egrave;te &agrave; l&apos;avance, pour tous les jours de la semaine, sur notre site :',
    prenotaBottone: 'R&eacute;server votre entr&eacute;e',
    prenotaNota: 'Un point rouge sur le calendrier signifie que la date est compl&egrave;te.',
    linkNota: ' <span style="color:#7B756A;font-size:12px;">(page en anglais)</span>',
    compresoTitolo: 'Ce qui est compris',
    compreso: [
      'Piscines thermales d&apos;eau chaude int&eacute;rieure et ext&eacute;rieure communicantes, et piscine ext&eacute;rieure d&apos;eau thermale froide avec vue sur les Collines Eugan&eacute;ennes',
      'Centre grottes SPA avec biosauna, hammam aux vapeurs thermales, bain &agrave; remous, lits massants, cascade d&apos;eau thermale, cascade de glace et douches sensorielles avec aromath&eacute;rapie <span style="color:#7B756A;">(adultes uniquement)</span>'
    ],
    tavolaTitolo: '&Agrave; table',
    tavola: [
      ['Bistrot Bar La Piazza', 'Au bord de la piscine, avec terrasse sur le jardin. Plats l&eacute;gers &agrave; midi : antipasti, p&acirc;tes, viande ou poisson saut&eacute;s, salades fra&icirc;ches. Tous les jours de 10h00 &agrave; 23h00 : d&eacute;jeuner de 12h30 &agrave; 14h30, en-cas jusqu&rsquo;&agrave; 17h30'],
      ['D&icirc;ner buffet', '35,00 &euro; par personne, boissons non comprises, au restaurant : salades, antipasti chauds et froids, primi pr&eacute;par&eacute;s minute, viande, poisson, fruits et desserts'],
      ['De l&apos;ext&eacute;rieur', 'Le pique-nique n&apos;est pas autoris&eacute;']
    ],
    sapereTitolo: 'Bon &agrave; savoir',
    sapere: [
      ['Kit SPA', 'Peignoir et serviette en location pour la journ&eacute;e : 19,00 &euro;'],
      ['Chambre d&apos;appoint', '60,00 &euro;, disponible de 9h00 &agrave; 18h30 : lit &agrave; la fran&ccedil;aise, salle de bain avec douche, TV, coffre-fort, climatisation et Wi-Fi. &Agrave; r&eacute;server par e-mail apr&egrave;s l&apos;achat du billet'],
      ['&Agrave; la piscine', 'Bonnet et chaussons de bain obligatoires'],
      ['Massages et soins', 'Sur r&eacute;servation : mieux vaut les fixer avec le billet, les meilleurs horaires partent vite'],
      ['Golf Academy', 'Le&ccedil;ons sur r&eacute;servation sur notre practice de 15 000 m&sup2; &agrave; c&ocirc;t&eacute; des piscines thermales : postes semi-couverts, putting green, pitching green et bunker'],
      ['Amis &agrave; quatre pattes', 'Les chiens ne sont malheureusement pas admis dans le parc ni aux piscines thermales']
    ],
    ogg: 'Day Spa — informations et tarifs · H&ocirc;tel Terme Leonardo'
  }
};

function costruisciDaySpaBase(d, opzioni, lingua) {
  const o = opzioni || {};
  const t = DAYSPA_T[lingua] || DAYSPA_T.it;
  const link = DAYSPA_LINK[lingua] || DAYSPA_LINK.it;

  const corpo = `
  <tr><td style="padding:16px 36px 0 36px;">
    <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#2A2E2B;">${salutoExtra(d, o, lingua)},</p>
    <h1 style="margin:0 0 10px 0;font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:31px;font-weight:normal;color:#2A2E2B;">${t.h1}</h1>
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">${t.intro}</p>
  </td></tr>

  <tr><td style="padding:18px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#E3F0F1;">
      <tr>
        <td width="6" style="background-color:#1E7F88;font-size:0;line-height:0;">&nbsp;</td>
        <td style="padding:18px 20px 20px 22px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#1E7F88;padding-bottom:8px;">${t.prezziTitolo}</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#3C6266;">
            ${t.prezzi.map(([q, p]) => `<tr><td style="padding:0 10px 6px 0;">${q}</td><td align="right" style="padding:0 0 6px 0;white-space:nowrap;"><strong style="color:#0F5C64;">${p}</strong></td></tr>`).join('')}
          </table>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#5C7F83;padding-top:6px;">${t.prezziNota}</div>
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:20px 36px 0 36px;">
    <h2 style="margin:0 0 8px 0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:24px;font-weight:normal;color:#2A2E2B;">${t.prenotaTitolo}</h2>
    <p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">${t.prenotaTesto}${t.linkNota}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td align="center" bgcolor="#E8751A" style="border-radius:5px;">
        <a href="${link}" style="display:inline-block;padding:12px 30px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#FFFFFF;text-decoration:none;font-weight:bold;">${t.prenotaBottone}</a>
      </td>
    </tr></table>
    <p style="margin:10px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#7B756A;">${t.prenotaNota}</p>
  </td></tr>

  <tr><td style="padding:20px 36px 0 36px;">
    <h2 style="margin:0 0 8px 0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:24px;font-weight:normal;color:#2A2E2B;">${t.compresoTitolo}</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
      ${t.compreso.map(x => `<tr><td valign="top" width="16" style="padding:0 6px 7px 0;color:#1E7F88;">&#10003;</td><td style="padding:0 0 7px 0;">${x}</td></tr>`).join('')}
    </table>
  </td></tr>

  <tr><td style="padding:14px 36px 0 36px;">
    <h2 style="margin:0 0 8px 0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:24px;font-weight:normal;color:#2A2E2B;">${t.tavolaTitolo}</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${t.tavola.map(([tit, testo], i) => `${i ? '<tr><td height="8" style="font-size:0;line-height:0;">&nbsp;</td></tr>' : ''}
      <tr><td style="padding:12px 16px;background-color:#FAF8F4;border-left:3px solid #7A8450;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">${tit}</strong><br /><span style="color:#7B756A;font-size:13px;">${testo}</span>
      </td></tr>`).join('')}
    </table>
  </td></tr>

  <tr><td style="padding:20px 36px 0 36px;">
    <h2 style="margin:0 0 10px 0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:24px;font-weight:normal;color:#2A2E2B;">${t.sapereTitolo}</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
      ${t.sapere.map(([k, v]) => `<tr><td width="150" valign="top" style="padding:0 12px 10px 0;color:#8C8578;">${k}</td><td valign="top" style="padding:0 0 10px 0;">${v}</td></tr>`).join('')}
    </table>
  </td></tr>`;

  return corniceExtra(t.banda, corpo, o, lingua);
}

function costruisciDaySpaIT(d, o) { return costruisciDaySpaBase(d, o, 'it'); }
function costruisciDaySpaDE(d, o) { return costruisciDaySpaBase(d, o, 'de'); }
function costruisciDaySpaEN(d, o) { return costruisciDaySpaBase(d, o, 'en'); }
function costruisciDaySpaFR(d, o) { return costruisciDaySpaBase(d, o, 'fr'); }
function oggettoDaySpaIT() { return DAYSPA_T.it.ogg; }
function oggettoDaySpaDE() { return DAYSPA_T.de.ogg; }
function oggettoDaySpaEN() { return DAYSPA_T.en.ogg; }
function oggettoDaySpaFR() { return DAYSPA_T.fr.ogg.replace(/&ocirc;/g, 'ô'); }

/* ============================================================
   BUONI REGALO — modello breve (v1.9.1)
   ------------------------------------------------------------
   Quando arriva un'email che chiede dei buoni, la risposta e'
   sempre la stessa: si comprano online, si pagano con carta e
   arrivano per email. Niente listino qui dentro: i tagli e le
   condizioni stanno sulla pagina, che e' l'unica fonte che si
   aggiorna da sola quando cambiano.
   ============================================================ */
const BUONI_LINK = {
  it: 'https://www.hoteltermeleonardo.com/it/buoni-regalo',
  de: 'https://www.hoteltermeleonardo.com/de/gutscheine',
  en: 'https://www.hoteltermeleonardo.com/en/gift-vouchers',
  fr: 'https://www.hoteltermeleonardo.com/fr/cheques-cadeaux'
};

const BUONI_T = {
  it: { ogg: 'Buoni regalo &mdash; Hotel Terme Leonardo',
        h1: 'I nostri buoni regalo',
        intro: 'Si acquistano direttamente online: compone il buono, paga con carta e lo riceve per email in pochi minuti, pronto da stampare o da inoltrare a chi lo ricever&agrave;.',
        bottone: 'Componi il buono regalo',
        comeTitolo: 'Cosa pu&ograve; regalare',
        come: ['Un <strong style="color:#2A2E2B;">importo libero</strong> da 25 a 1.000 &euro;, spendibile in hotel.',
               'Oppure fino a <strong style="color:#2A2E2B;">due voci</strong> scelte dal listino, ognuna in pi&ugrave; copie: ingressi Day Spa, massaggi, trattamenti viso e corpo, programmi benessere.'],
        prezziTitolo: 'Qualche prezzo, per farsi un&rsquo;idea',
        prezzi: [['Day Spa infrasettimanale &middot; piscine e grotte, lun&ndash;ven 9.00&ndash;18.30', '35 &euro;'],
                 ['Day Spa festivo &middot; sabato, domenica e festivi', '45 &euro;'],
                 ['Day Spa serale &middot; venerd&igrave; e sabato 18.00&ndash;22.30', '29 &euro;'],
                 ['Massaggi &middot; dal relax di 25 minuti all&rsquo;anticellulite di 50 minuti', 'da 40 a 70 &euro;'],
                 ['Viso e corpo &middot; dal viso al fango agli anti-age', 'da 44 a 80 &euro;'],
                 ['Programmi benessere &middot; pi&ugrave; trattamenti in una volta', 'da 90 a 130 &euro;']],
        notaSerale: 'Il Day Spa serale si pu&ograve; regalare, ma non si abbina a un trattamento nello stesso buono: di sera il centro benessere non fa trattamenti. Per regalare entrambi scelga il Day Spa infrasettimanale o festivo insieme al trattamento.',
        validitaTitolo: 'Validit&agrave; e utilizzo',
        validita: ['Dodici mesi dalla data di emissione. Se la scadenza cadesse durante la nostra chiusura invernale, la prolunghiamo fino a un mese dopo la riapertura: sul buono si leggono entrambe le date, non c&rsquo;&egrave; nulla da richiedere.',
                   'Trenta giorni prima della scadenza mandiamo un promemoria.',
                   'Il buono porta un codice e un QR: in reception basta mostrarlo. Ingressi e trattamenti su prenotazione, secondo disponibilit&agrave;.',
                   'La fattura si pu&ograve; richiedere al momento dell&rsquo;acquisto, come privato o come azienda.'] },

  de: { ogg: 'Gutscheine &mdash; Hotel Terme Leonardo',
        h1: 'Unsere Gutscheine',
        intro: 'Sie kaufen ihn direkt online: Gutschein zusammenstellen, mit Karte bezahlen und ihn innerhalb weniger Minuten per E-Mail erhalten &mdash; zum Ausdrucken oder Weiterleiten.',
        bottone: 'Gutschein zusammenstellen',
        comeTitolo: 'Was Sie verschenken k&ouml;nnen',
        come: ['Einen <strong style="color:#2A2E2B;">frei w&auml;hlbaren Betrag</strong> von 25 bis 1.000 &euro;, im Hotel einl&ouml;sbar.',
               'Oder bis zu <strong style="color:#2A2E2B;">zwei Leistungen</strong> aus der Preisliste, jeweils mehrfach: Day-Spa-Eintritte, Massagen, Gesichts- und K&ouml;rperbehandlungen, Wellnessprogramme.'],
        prezziTitolo: 'Einige Preise zur Orientierung',
        prezzi: [['Day Spa wochentags &middot; Pools und Grotten, Mo&ndash;Fr 9.00&ndash;18.30', '35 &euro;'],
                 ['Day Spa an Sonn- und Feiertagen &middot; auch samstags', '45 &euro;'],
                 ['Day Spa am Abend &middot; Freitag und Samstag 18.00&ndash;22.30', '29 &euro;'],
                 ['Massagen &middot; von 25 Minuten Relax bis Anti-Cellulite (50 Min.)', '40 bis 70 &euro;'],
                 ['Gesicht und K&ouml;rper &middot; von der Fangomaske bis Anti-Aging', '44 bis 80 &euro;'],
                 ['Wellnessprogramme &middot; mehrere Behandlungen zusammen', '90 bis 130 &euro;']],
        notaSerale: 'Den Day Spa am Abend k&ouml;nnen Sie verschenken, aber nicht zusammen mit einer Behandlung im selben Gutschein: abends f&uuml;hrt das Wellnesscenter keine Behandlungen durch. F&uuml;r beides w&auml;hlen Sie den Day Spa wochentags oder am Wochenende zusammen mit der Behandlung.',
        validitaTitolo: 'G&uuml;ltigkeit und Einl&ouml;sung',
        validita: ['Zw&ouml;lf Monate ab Ausstellung. F&auml;llt das Ablaufdatum in unsere Winterschlie&szlig;ung, verl&auml;ngern wir es bis einen Monat nach der Wiederer&ouml;ffnung: beide Daten stehen auf dem Gutschein, Sie m&uuml;ssen nichts beantragen.',
                   'Drei&szlig;ig Tage vor Ablauf senden wir eine Erinnerung.',
                   'Der Gutschein tr&auml;gt einen Code und einen QR-Code: an der Rezeption gen&uuml;gt es, ihn vorzuzeigen. Eintritte und Behandlungen nach Verf&uuml;gbarkeit und mit Voranmeldung.',
                   'Eine Rechnung k&ouml;nnen Sie beim Kauf anfordern, privat oder als Unternehmen.'] },

  en: { ogg: 'Gift vouchers &mdash; Hotel Terme Leonardo',
        h1: 'Our gift vouchers',
        intro: 'You can buy one online: put the voucher together, pay by card and receive it by email within minutes, ready to print or forward.',
        bottone: 'Create a gift voucher',
        comeTitolo: 'What you can give',
        come: ['An <strong style="color:#2A2E2B;">open amount</strong> from 25 to 1,000 &euro;, to spend at the hotel.',
               'Or up to <strong style="color:#2A2E2B;">two items</strong> from the price list, each more than once: Day Spa entries, massages, face and body treatments, wellness programmes.'],
        prezziTitolo: 'A few prices, to give you an idea',
        prezzi: [['Day Spa weekdays &middot; pools and grottoes, Mon&ndash;Fri 9.00&ndash;18.30', '&euro;35'],
                 ['Day Spa weekends and holidays', '&euro;45'],
                 ['Day Spa evening &middot; Friday and Saturday 18.00&ndash;22.30', '&euro;29'],
                 ['Massages &middot; from a 25-minute relax to a 50-minute anti-cellulite', '&euro;40 to 70'],
                 ['Face and body &middot; from thermal mud to anti-age', '&euro;44 to 80'],
                 ['Wellness programmes &middot; several treatments together', '&euro;90 to 130']],
        notaSerale: 'The evening Day Spa can be given as a gift, but not combined with a treatment in the same voucher: the spa does not carry out treatments in the evening. To give both, choose the weekday or weekend Day Spa together with the treatment.',
        validitaTitolo: 'Validity and use',
        validita: ['Twelve months from the date of issue. Should it expire during our winter closing, we extend it to one month after we reopen: both dates are printed on the voucher, with nothing to request.',
                   'Thirty days before expiry we send a reminder.',
                   'The voucher carries a code and a QR: showing it at reception is enough. Entries and treatments by appointment, subject to availability.',
                   'An invoice can be requested when buying, as a private person or as a company.'] },

  fr: { ogg: 'Bons cadeaux &mdash; Hotel Terme Leonardo',
        h1: 'Nos bons cadeaux',
        intro: 'Vous pouvez l&rsquo;acheter en ligne : composez le bon, payez par carte et recevez-le par e-mail en quelques minutes, pr&ecirc;t &agrave; imprimer ou &agrave; transf&eacute;rer.',
        bottone: 'Composer le bon cadeau',
        comeTitolo: 'Ce que vous pouvez offrir',
        come: ['Un <strong style="color:#2A2E2B;">montant libre</strong> de 25 &agrave; 1 000 &euro;, &agrave; d&eacute;penser &agrave; l&rsquo;h&ocirc;tel.',
               'Ou jusqu&rsquo;&agrave; <strong style="color:#2A2E2B;">deux prestations</strong> de la liste, chacune en plusieurs exemplaires : entr&eacute;es Day Spa, massages, soins visage et corps, programmes bien-&ecirc;tre.'],
        prezziTitolo: 'Quelques prix, pour se faire une id&eacute;e',
        prezzi: [['Day Spa en semaine &middot; piscines et grottes, lun&ndash;ven 9h00&ndash;18h30', '35 &euro;'],
                 ['Day Spa week-end et jours f&eacute;ri&eacute;s', '45 &euro;'],
                 ['Day Spa en soir&eacute;e &middot; vendredi et samedi 18h00&ndash;22h30', '29 &euro;'],
                 ['Massages &middot; du relax de 25 minutes &agrave; l&rsquo;anticellulite de 50 minutes', 'de 40 &agrave; 70 &euro;'],
                 ['Visage et corps &middot; du soin au fango aux anti-&acirc;ge', 'de 44 &agrave; 80 &euro;'],
                 ['Programmes bien-&ecirc;tre &middot; plusieurs soins ensemble', 'de 90 &agrave; 130 &euro;']],
        notaSerale: 'Le Day Spa en soir&eacute;e peut &ecirc;tre offert, mais pas associ&eacute; &agrave; un soin dans le m&ecirc;me bon : le soir, le centre de bien-&ecirc;tre ne pratique pas de soins. Pour offrir les deux, choisissez le Day Spa en semaine ou le week-end avec le soin.',
        validitaTitolo: 'Validit&eacute; et utilisation',
        validita: ['Douze mois &agrave; compter de l&rsquo;&eacute;mission. Si l&rsquo;&eacute;ch&eacute;ance tombait pendant notre fermeture hivernale, nous la prolongeons jusqu&rsquo;&agrave; un mois apr&egrave;s la r&eacute;ouverture : les deux dates figurent sur le bon, sans rien &agrave; demander.',
                   'Trente jours avant l&rsquo;&eacute;ch&eacute;ance, nous envoyons un rappel.',
                   'Le bon porte un code et un QR : il suffit de le pr&eacute;senter &agrave; la r&eacute;ception. Entr&eacute;es et soins sur r&eacute;servation, selon disponibilit&eacute;.',
                   'Une facture peut &ecirc;tre demand&eacute;e lors de l&rsquo;achat, en tant que particulier ou entreprise.'] }
};

function costruisciBuoniBase(d, opzioni, lingua) {
  const o = opzioni || {};
  const t = BUONI_T[lingua] || BUONI_T.it;
  const link = BUONI_LINK[lingua] || BUONI_LINK.it;
  const pulsante = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td align="center" bgcolor="#1E7F88" style="border-radius:5px;">
        <a href="${link}" target="_blank" style="display:inline-block;padding:13px 30px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#FFFFFF;text-decoration:none;">${t.bottone}</a>
      </td></tr></table>`;

  const corpo = `
  <tr><td style="padding:16px 36px 0 36px;">
    <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#2A2E2B;">${salutoExtra(d, o, lingua)},</p>
    <h1 style="margin:0 0 10px 0;font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:31px;font-weight:normal;color:#2A2E2B;">${t.h1}</h1>
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">${t.intro}</p>
  </td></tr>

  <tr><td style="padding:20px 36px 0 36px;">${pulsante}</td></tr>

  <tr><td style="padding:22px 36px 0 36px;">
    <h2 style="margin:0 0 8px 0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:24px;font-weight:normal;color:#2A2E2B;">${t.comeTitolo}</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
      ${t.come.map(r => `<tr><td valign="top" width="14" style="padding:0 8px 6px 0;color:#B0A897;">&bull;</td><td valign="top" style="padding:0 0 6px 0;">${r}</td></tr>`).join('')}
    </table>
  </td></tr>

  <tr><td style="padding:18px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#E3F0F1;">
      <tr>
        <td width="6" style="background-color:#1E7F88;font-size:0;line-height:0;">&nbsp;</td>
        <td style="padding:18px 20px 20px 22px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#1E7F88;padding-bottom:8px;">${t.prezziTitolo}</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#3C6266;">
            ${t.prezzi.map(([q, p]) => `<tr><td style="padding:0 12px 6px 0;">${q}</td><td align="right" valign="top" style="padding:0 0 6px 0;white-space:nowrap;"><strong style="color:#0F5C64;">${p}</strong></td></tr>`).join('')}
          </table>
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:16px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FDF6EE;">
      <tr>
        <td width="6" style="background-color:#C97B2C;font-size:0;line-height:0;">&nbsp;</td>
        <td style="padding:14px 18px;font-family:Arial,Helvetica,sans-serif;font-size:13.5px;line-height:21px;color:#55524B;">${t.notaSerale}</td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:20px 36px 0 36px;">
    <h2 style="margin:0 0 8px 0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:24px;font-weight:normal;color:#2A2E2B;">${t.validitaTitolo}</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:13.5px;line-height:21px;color:#55524B;">
      ${t.validita.map(r => `<tr><td valign="top" width="14" style="padding:0 8px 6px 0;color:#B0A897;">&bull;</td><td valign="top" style="padding:0 0 6px 0;">${r}</td></tr>`).join('')}
    </table>
  </td></tr>

  <tr><td style="padding:18px 36px 0 36px;">${pulsante}</td></tr>`;
  return corniceExtra('', corpo, o, lingua);
}

function costruisciBuoniIT(d, o) { return costruisciBuoniBase(d, o, 'it'); }
function costruisciBuoniDE(d, o) { return costruisciBuoniBase(d, o, 'de'); }
function costruisciBuoniEN(d, o) { return costruisciBuoniBase(d, o, 'en'); }
function costruisciBuoniFR(d, o) { return costruisciBuoniBase(d, o, 'fr'); }
function oggettoBuoniIT() { return BUONI_T.it.ogg.replace(/&mdash;/g, '\u2014'); }
function oggettoBuoniDE() { return BUONI_T.de.ogg.replace(/&mdash;/g, '\u2014'); }
function oggettoBuoniEN() { return BUONI_T.en.ogg.replace(/&mdash;/g, '\u2014'); }
function oggettoBuoniFR() { return BUONI_T.fr.ogg.replace(/&mdash;/g, '\u2014'); }

/* ============================================================
   CHIUSURA STAGIONALE \u2014 la risposta che si scriveva a mano (v1.0)
   ------------------------------------------------------------
   Le date e il periodo di riapertura NON stanno qui: stanno in
   `CHIUSURA` dentro template.js, che e' l'unico posto da
   aggiornare a ogni stagione. Qui c'e' solo come si dice.

   NON E' UN NO SECCO. Chi scrive per dicembre spesso viene lo
   stesso in un'altra data: l'email chiude la porta di quel periodo
   e apre quella dopo, con l'invito a scriverci per la riapertura.
   ============================================================ */
const CHIUSURA_T = {
  it: {
    ogg: 'Chiusura stagionale &mdash; Hotel Terme Leonardo',
    banda: 'CHIUSURA STAGIONALE',
    h1: 'In quel periodo siamo chiusi',
    intro: (dal, al) => `La ringraziamo per la Sua richiesta. Purtroppo non possiamo accoglierla: l&rsquo;Hotel Terme Leonardo chiude per la consueta pausa stagionale <strong style="color:#2A2E2B;">dal ${dal}</strong> e riapre <strong style="color:#2A2E2B;">${al}</strong>.`,
    invito: 'Saremo felici di ospitarla in un altro periodo: ci scriva le date che ha in mente e le prepariamo volentieri una proposta.',
    riapre: 'Se preferisce, ci risponda pure ora indicandoci un periodo dopo la riapertura: le rispondiamo appena il listino della nuova stagione &egrave; disponibile.'
  },
  de: {
    ogg: 'Saisonschlie&szlig;ung &mdash; Hotel Terme Leonardo',
    banda: 'SAISONSCHLIESSUNG',
    h1: 'In diesem Zeitraum haben wir geschlossen',
    intro: (dal, al) => `Vielen Dank f&uuml;r Ihre Anfrage. Leider k&ouml;nnen wir Sie nicht empfangen: das Hotel Terme Leonardo macht Betriebsferien <strong style="color:#2A2E2B;">ab dem ${dal}</strong> und &ouml;ffnet <strong style="color:#2A2E2B;">${al}</strong> wieder.`,
    invito: 'Wir w&uuml;rden uns freuen, Sie zu einem anderen Zeitpunkt begr&uuml;&szlig;en zu d&uuml;rfen: schreiben Sie uns Ihre Wunschtermine, wir erstellen Ihnen gerne ein Angebot.',
    riapre: 'Gerne k&ouml;nnen Sie uns auch jetzt schon einen Zeitraum nach der Wiederer&ouml;ffnung nennen: wir melden uns, sobald die Preise der neuen Saison vorliegen.'
  },
  en: {
    ogg: 'Seasonal closure &mdash; Hotel Terme Leonardo',
    banda: 'SEASONAL CLOSURE',
    h1: 'We are closed in that period',
    intro: (dal, al) => `Thank you for your enquiry. Unfortunately we cannot welcome you: Hotel Terme Leonardo closes for its usual seasonal break <strong style="color:#2A2E2B;">from ${dal}</strong> and reopens <strong style="color:#2A2E2B;">${al}</strong>.`,
    invito: 'We would be delighted to host you at another time: send us the dates you have in mind and we will gladly prepare a proposal.',
    riapre: 'If you prefer, reply now with a period after the reopening: we will get back to you as soon as the new season&rsquo;s rates are available.'
  },
  fr: {
    ogg: 'Fermeture saisonni&egrave;re &mdash; Hotel Terme Leonardo',
    banda: 'FERMETURE SAISONNI&Egrave;RE',
    h1: 'Nous sommes ferm&eacute;s durant cette p&eacute;riode',
    intro: (dal, al) => `Nous vous remercions de votre demande. Nous ne pouvons malheureusement pas vous accueillir : l&rsquo;Hotel Terme Leonardo ferme pour sa pause saisonni&egrave;re <strong style="color:#2A2E2B;">&agrave; partir du ${dal}</strong> et rouvre <strong style="color:#2A2E2B;">${al}</strong>.`,
    invito: 'Nous serions heureux de vous accueillir &agrave; une autre p&eacute;riode : indiquez-nous les dates que vous avez en t&ecirc;te et nous vous pr&eacute;parerons volontiers une proposition.',
    riapre: 'Si vous le souhaitez, r&eacute;pondez d&egrave;s maintenant en indiquant une p&eacute;riode apr&egrave;s la r&eacute;ouverture : nous vous r&eacute;pondrons d&egrave;s que les tarifs de la nouvelle saison seront disponibles.'
  }
};

/* \u00ab29 novembre 2026\u00bb e \u00aba meta' febbraio 2027\u00bb nella lingua giusta */
function dateChiusura(lingua) {
  const pezzi = (iso) => {
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? { g: +m[3], mese: MESI_ABBR_ISO[+m[2] - 1], a: +m[1] } : null;
  };
  const a = pezzi(CHIUSURA.dal), b = pezzi(CHIUSURA.al);
  const dal = a ? dataExtra(a.g, a.mese, a.a, lingua) : '';
  if (!b) return { dal, al: '' };
  if (!CHIUSURA.riaperturaVaga) return { dal, al: dataExtra(b.g, b.mese, b.a, lingua) };
  const META = {
    it: (m, y) => `a met&agrave; ${m} ${y}`,
    de: (m, y) => `Mitte ${m} ${y}`,
    en: (m, y) => `in mid-${m} ${y}`,
    fr: (m, y) => `&agrave; la mi-${m} ${y}`
  };
  const nomeMese = (MESI_LUNGHI[b.mese] || {})[lingua] || b.mese;
  return { dal, al: (META[lingua] || META.it)(nomeMese, b.a) };
}

const MESI_ABBR_ISO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function costruisciChiusuraBase(d, opzioni, lingua) {
  const o = opzioni || {};
  const t = CHIUSURA_T[lingua] || CHIUSURA_T.it;
  const q = dateChiusura(lingua);
  const corpo = `
  <tr><td style="padding:16px 36px 0 36px;">
    <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#2A2E2B;">${salutoExtra(d, o, lingua)},</p>
    <h1 style="margin:0 0 10px 0;font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:31px;font-weight:normal;color:#2A2E2B;">${t.h1}</h1>
    <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">${t.intro(q.dal, q.al)}</p>
    <p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">${t.invito}</p>
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">${t.riapre}</p>
  </td></tr>`;
  return corniceExtra(t.banda, corpo, o, lingua);
}

function costruisciChiusuraIT(d, o) { return costruisciChiusuraBase(d, o, 'it'); }
function costruisciChiusuraDE(d, o) { return costruisciChiusuraBase(d, o, 'de'); }
function costruisciChiusuraEN(d, o) { return costruisciChiusuraBase(d, o, 'en'); }
function costruisciChiusuraFR(d, o) { return costruisciChiusuraBase(d, o, 'fr'); }
function oggettoChiusuraIT() { return CHIUSURA_T.it.ogg.replace(/&mdash;/g, '\u2014'); }
function oggettoChiusuraDE() { return CHIUSURA_T.de.ogg.replace(/&mdash;/g, '\u2014').replace(/&szlig;/g, '\u00df'); }
function oggettoChiusuraEN() { return CHIUSURA_T.en.ogg.replace(/&mdash;/g, '\u2014'); }
function oggettoChiusuraFR() { return CHIUSURA_T.fr.ogg.replace(/&mdash;/g, '\u2014').replace(/&egrave;/g, '\u00e8'); }

/* ============================================================
   PREVENTIVO SOGGIORNO \u2014 il documento senza prenotazione (v1.0)
   ------------------------------------------------------------
   Le sistemazioni scelte in \u00abDisponibilita' e prezzi\u00bb con i loro
   prezzi, e nient'altro: nessun numero d'offerta, nessun acconto,
   nessuna scadenza, nessun pulsante \u00abConferma Ora\u00bb.

   NON E' UN'OFFERTA PIU' CORTA, E' UN ALTRO DOCUMENTO. Chi legge un
   numero d'offerta e un acconto capisce \u00abcamera tenuta\u00bb: qui non e'
   stata tenuta nessuna camera, e il documento lo dice in chiaro.

   I PREZZI ARRIVANO IN CENTESIMI, come li produce il modale: la
   divisione per cento avviene qui e in nessun altro posto.

   NON SI RISCRIVE NIENTE CHE ESISTA GIA'. La descrizione dei pacchetti
   (notaPacchetto), quella delle camere (CAMERE_IT / ZIMMER_DE /
   ROOMS_EN / CHAMBRES_FR), la dotazione e la riga dei bambini con il
   prezzo per eta' (rigaBambini) sono le stesse funzioni che scrivono
   le offerte vere da mesi. Una seconda copia divergerebbe dalla prima,
   ed e' il difetto che pulsanti.test.ts e' nato per sorvegliare.
   ============================================================ */
const PREVENTIVO_T = {
  it: {
    ogg: 'Preventivo per il suo soggiorno &mdash; Hotel Terme Leonardo',
    banda: 'PREVENTIVO',
    h1: 'Il preventivo per il suo soggiorno',
    intro: 'Ecco che cosa possiamo proporle per le date che ci ha indicato, con le tariffe di oggi.',
    notti: (n) => `${n} ${n === 1 ? 'notte' : 'notti'}`,
    ospiti: (a, b) => `${a} ${a === 1 ? 'adulto' : 'adulti'}${b ? ` e ${b} ${b === 1 ? 'bambino' : 'bambini'}` : ''}`,
    usoSingola: 'in uso singola',
    aPersona: 'a persona',
    totale: 'totale soggiorno',
    cure: 'di cui cure e trattamenti',
    sc5: 'sconto fedelt&agrave; 5% gi&agrave; compreso',
    sc3: 'e in pi&ugrave; 3% per il pagamento anticipato, reso alla partenza',
    sapereTitolo: 'Da sapere',
    prezzoTitolo: 'Sul prezzo e sulla disponibilit&agrave;',
    avviso: 'I prezzi sono le tariffe di oggi e cambiano con l&rsquo;occupazione. Questo preventivo <strong style="color:#2A2E2B;">non blocca la camera</strong>: la disponibilit&agrave; si verifica al momento della conferma.',
    chiudi: 'Se una di queste soluzioni le piace, ci risponda a questa email: le prepariamo l&rsquo;offerta e teniamo la camera.',
    noteCure: 'Con l&rsquo;impegnativa del suo medico il ticket &egrave; di <strong style="color:#0F5C64;">55 &euro;</strong> e copre visita medica, dodici fanghi e dodici bagni terapeutici. I turni sono al mattino.',
    noteCane: 'Anche il suo cane &egrave; il benvenuto: <strong style="color:#0F5C64;">13 &euro;</strong> al giorno, da saldare in hotel; il cibo non &egrave; compreso.',
    caparraTitolo: 'Se decide di confermare',
    caparra: (tot, pp) => `Per tenere la camera serve una caparra di <strong style="color:#0F5C64;">${tot}</strong> (${pp} a persona), che si versa con bonifico.`,
    causale: (c) => `Causale: <strong style="color:#2A2E2B;">${c}</strong>`,
    causaleSenzaNome: (data) => `Causale: <strong style="color:#2A2E2B;">il suo cognome e ${data}</strong>`,
    causaleNota: 'Il cognome e la data di arrivo bastano a farci riconoscere il versamento.',
    caparraDopo: 'Appena arriva le mandiamo la conferma con tutti i dettagli del soggiorno.',
    sceglie: (n) => `Sono ${n === 2 ? 'due' : n} soluzioni <strong style="color:#2A2E2B;">alternative</strong>: ne scelga una, i prezzi non si sommano.`,
    insieme: (n) => `Le ${n === 2 ? 'due' : n} sistemazioni sono da prendere <strong style="color:#2A2E2B;">insieme</strong>: il totale qui sotto le comprende tutte.`,
    totaleTutte: 'Totale delle sistemazioni'
  },
  de: {
    ogg: 'Ihr unverbindliches Angebot &mdash; Hotel Terme Leonardo',
    banda: 'PREISANFRAGE',
    h1: 'Die Preise f&uuml;r Ihren Aufenthalt',
    intro: 'Das k&ouml;nnen wir Ihnen f&uuml;r die genannten Termine anbieten, zu den heutigen Tarifen.',
    notti: (n) => `${n} ${n === 1 ? 'Nacht' : 'N&auml;chte'}`,
    ospiti: (a, b) => `${a} ${a === 1 ? 'Erwachsener' : 'Erwachsene'}${b ? ` und ${b} ${b === 1 ? 'Kind' : 'Kinder'}` : ''}`,
    usoSingola: 'zur Alleinbenutzung',
    aPersona: 'pro Person',
    totale: 'Gesamt',
    cure: 'davon Kuren und Behandlungen',
    sc5: '5 % Treuerabatt bereits enthalten',
    sc3: 'zus&auml;tzlich 3 % bei Vorauszahlung, bei der Abreise verrechnet',
    sapereTitolo: 'Gut zu wissen',
    prezzoTitolo: 'Zu Preis und Verf&uuml;gbarkeit',
    avviso: 'Die Preise sind die heutigen Tarife und &auml;ndern sich mit der Belegung. Mit dieser Preisangabe ist <strong style="color:#2A2E2B;">noch kein Zimmer reserviert</strong>: die Verf&uuml;gbarkeit wird bei der Best&auml;tigung gepr&uuml;ft.',
    chiudi: 'Wenn Ihnen eine dieser M&ouml;glichkeiten zusagt, antworten Sie einfach auf diese E-Mail: wir bereiten das Angebot vor und halten das Zimmer f&uuml;r Sie.',
    noteCure: 'Mit der &auml;rztlichen Verordnung betr&auml;gt der Ticketanteil <strong style="color:#0F5C64;">55 &euro;</strong> und umfasst die &auml;rztliche Untersuchung, zw&ouml;lf Fangopackungen und zw&ouml;lf Thermalb&auml;der. Die Anwendungen finden vormittags statt.',
    noteCane: 'Auch Ihr Hund ist willkommen: <strong style="color:#0F5C64;">13 &euro;</strong> pro Tag, vor Ort zu zahlen; Futter nicht inbegriffen.',
    caparraTitolo: 'Wenn Sie buchen m&ouml;chten',
    caparra: (tot, pp) => `Um das Zimmer zu halten, ist eine Anzahlung von <strong style="color:#0F5C64;">${tot}</strong> (${pp} pro Person) n&ouml;tig, per &Uuml;berweisung.`,
    causale: (c) => `Verwendungszweck: <strong style="color:#2A2E2B;">${c}</strong>`,
    causaleSenzaNome: (data) => `Verwendungszweck: <strong style="color:#2A2E2B;">Ihr Nachname und ${data}</strong>`,
    causaleNota: 'Nachname und Anreisedatum gen&uuml;gen, damit wir die Zahlung zuordnen k&ouml;nnen.',
    caparraDopo: 'Sobald sie eingeht, senden wir Ihnen die Best&auml;tigung mit allen Einzelheiten.',
    sceglie: (n) => `Es sind ${n === 2 ? 'zwei' : n} <strong style="color:#2A2E2B;">Alternativen</strong>: w&auml;hlen Sie eine davon, die Preise werden nicht addiert.`,
    insieme: (n) => `Die ${n === 2 ? 'beiden' : n} Unterk&uuml;nfte geh&ouml;ren <strong style="color:#2A2E2B;">zusammen</strong>: der Gesamtpreis unten umfasst alle.`,
    totaleTutte: 'Gesamt aller Unterk&uuml;nfte'
  },
  en: {
    ogg: 'Your quotation &mdash; Hotel Terme Leonardo',
    banda: 'QUOTATION',
    h1: 'A quotation for your stay',
    intro: 'Here is what we can offer for the dates you gave us, at today&rsquo;s rates.',
    notti: (n) => `${n} ${n === 1 ? 'night' : 'nights'}`,
    ospiti: (a, b) => `${a} ${a === 1 ? 'adult' : 'adults'}${b ? ` and ${b} ${b === 1 ? 'child' : 'children'}` : ''}`,
    usoSingola: 'for single use',
    aPersona: 'per person',
    totale: 'total stay',
    cure: 'of which spa treatments',
    sc5: '5% loyalty discount already included',
    sc3: 'plus 3% for advance payment, refunded on departure',
    sapereTitolo: 'Good to know',
    prezzoTitolo: 'About the price and availability',
    avviso: 'These are today&rsquo;s rates and they change with occupancy. This quotation <strong style="color:#2A2E2B;">does not hold the room</strong>: availability is checked at the time of confirmation.',
    chiudi: 'If one of these suits you, just reply to this email: we will prepare the offer and hold the room for you.',
    noteCure: 'With your doctor&rsquo;s prescription the ticket is <strong style="color:#0F5C64;">&euro;55</strong> and covers the medical examination, twelve mud packs and twelve thermal baths. Treatments take place in the morning.',
    noteCane: 'Your dog is welcome too: <strong style="color:#0F5C64;">&euro;13</strong> per day, payable at the hotel; food not included.',
    caparraTitolo: 'If you decide to confirm',
    caparra: (tot, pp) => `To hold the room we need a deposit of <strong style="color:#0F5C64;">${tot}</strong> (${pp} per person), by bank transfer.`,
    causale: (c) => `Reference: <strong style="color:#2A2E2B;">${c}</strong>`,
    causaleSenzaNome: (data) => `Reference: <strong style="color:#2A2E2B;">your surname and ${data}</strong>`,
    causaleNota: 'Your surname and the arrival date are enough for us to match the payment.',
    caparraDopo: 'As soon as it arrives we will send you the confirmation with all the details.',
    sceglie: (n) => `These are ${n === 2 ? 'two' : n} <strong style="color:#2A2E2B;">alternatives</strong>: please choose one, the prices are not added together.`,
    insieme: (n) => `The ${n === 2 ? 'two' : n} accommodations go <strong style="color:#2A2E2B;">together</strong>: the total below covers them all.`,
    totaleTutte: 'Total for all accommodations'
  },
  fr: {
    ogg: 'Votre devis &mdash; Hotel Terme Leonardo',
    banda: 'DEVIS',
    h1: 'Le devis pour votre s&eacute;jour',
    intro: 'Voici ce que nous pouvons vous proposer pour les dates indiqu&eacute;es, aux tarifs du jour.',
    notti: (n) => `${n} ${n === 1 ? 'nuit' : 'nuits'}`,
    ospiti: (a, b) => `${a} ${a === 1 ? 'adulte' : 'adultes'}${b ? ` et ${b} ${b === 1 ? 'enfant' : 'enfants'}` : ''}`,
    usoSingola: 'en usage individuel',
    aPersona: 'par personne',
    totale: 's&eacute;jour complet',
    cure: 'dont cures et soins',
    sc5: 'remise fid&eacute;lit&eacute; de 5 % d&eacute;j&agrave; comprise',
    sc3: 'et 3 % pour le paiement anticip&eacute;, rendus au d&eacute;part',
    sapereTitolo: '&Agrave; savoir',
    prezzoTitolo: 'Sur le prix et la disponibilit&eacute;',
    avviso: 'Ce sont les tarifs du jour et ils changent avec le taux d&rsquo;occupation. Ce devis <strong style="color:#2A2E2B;">ne bloque pas la chambre</strong> : la disponibilit&eacute; est v&eacute;rifi&eacute;e au moment de la confirmation.',
    chiudi: 'Si l&rsquo;une de ces solutions vous convient, r&eacute;pondez simplement &agrave; cet e-mail : nous pr&eacute;parons l&rsquo;offre et gardons la chambre.',
    noteCure: 'Avec l&rsquo;ordonnance de votre m&eacute;decin, le ticket est de <strong style="color:#0F5C64;">55 &euro;</strong> et comprend la visite m&eacute;dicale, douze applications de fango et douze bains thermaux. Les soins ont lieu le matin.',
    noteCane: 'Votre chien est lui aussi le bienvenu : <strong style="color:#0F5C64;">13 &euro;</strong> par jour, &agrave; r&eacute;gler &agrave; l&rsquo;h&ocirc;tel ; nourriture non comprise.',
    caparraTitolo: 'Si vous d&eacute;cidez de confirmer',
    caparra: (tot, pp) => `Pour garder la chambre, il faut des arrhes de <strong style="color:#0F5C64;">${tot}</strong> (${pp} par personne), par virement.`,
    causale: (c) => `Motif : <strong style="color:#2A2E2B;">${c}</strong>`,
    causaleSenzaNome: (data) => `Motif : <strong style="color:#2A2E2B;">votre nom et ${data}</strong>`,
    causaleNota: 'Votre nom et la date d&rsquo;arriv&eacute;e nous suffisent pour identifier le versement.',
    caparraDopo: 'D&egrave;s r&eacute;ception, nous vous envoyons la confirmation avec tous les d&eacute;tails.',
    sceglie: (n) => `Ce sont ${n === 2 ? 'deux' : n} <strong style="color:#2A2E2B;">solutions alternatives</strong> : choisissez-en une, les prix ne s&rsquo;additionnent pas.`,
    insieme: (n) => `Les ${n === 2 ? 'deux' : n} h&eacute;bergements vont <strong style="color:#2A2E2B;">ensemble</strong> : le total ci-dessous les comprend tous.`,
    totaleTutte: 'Total de tous les h&eacute;bergements'
  }
};

/* la categoria nella lingua del documento, con l'uso singola quando
   l'ospite e' solo. Le mappe sono quelle delle offerte vere. */
function categoriaPreventivo(nome, adulti, lingua) {
  let base = nome || '';
  if (lingua === 'de') base = kategorieDE(base);
  else if (lingua === 'en') base = categoryEN(base);
  else if (lingua === 'fr') base = categorieFR(base);
  else {
    if (base === base.toUpperCase() && /[A-Z]/.test(base)) {
      base = base.toLowerCase().replace(/(^|[\s&(\/-])([a-z\u00e0-\u00f9])/g, (m, p, c) => p + c.toUpperCase());
    }
    /* v2.9.6: in italiano Fidra scrive \u00abDOPPIA\u00bb, \u00abMATRIMONIALE QUEEN\u00bb,
       \u00abSINGOLA\u00bb \u2014 il sostantivo non c'e'. Nelle altre tre lingue c'e' gia'
       dentro il nome (Doppelzimmer, Double room, Chambre double), ed e'
       per questo che si vedeva solo in italiano.
       Non davanti alle suite: \u00abCamera Junior Suite\u00bb non lo dice nessuno. */
    if (!/suite/i.test(base)) base = 'Camera ' + base;
  }
  if ((adulti || 1) !== 1) return base;
  const t = PREVENTIVO_T[lingua] || PREVENTIVO_T.it;
  return `${base} ${t.usoSingola}`;
}

/* la descrizione della camera e la dotazione: gli stessi dizionari delle
   offerte vere, uno per lingua. Non se ne scrive un quinto. */
function descrizionePreventivo(categoria, lingua) {
  const diz = lingua === 'de' ? ZIMMER_DE
            : lingua === 'en' ? ROOMS_EN
            : lingua === 'fr' ? CHAMBRES_FR
            : CAMERE_IT;
  return descrizioneCamera(categoria, diz);
}

function dotazionePreventivo(lingua) {
  if (lingua === 'de') return AUSSTATTUNG_DE;
  if (lingua === 'en') return AMENITIES_EN;
  if (lingua === 'fr') return EQUIPEMENTS_FR;
  return DOTAZIONE_IT;
}

/* ============================================================
   v2.11.3 — LA CAPARRA NEL PREVENTIVO, SENZA NUMERO D'OFFERTA
   ------------------------------------------------------------
   Avevo escluso l'IBAN sostenendo che senza numero d'offerta il
   bonifico arriva in banca «senza nulla a cui attaccarlo».
   L'obiezione della proprieta' e' migliore: la causale non deve
   essere per forza un numero. COGNOME + DATA DI ARRIVO si
   riconcilia altrettanto bene, e sull'estratto conto si legge
   pure meglio di «O26/19196».

   Resta fuori il pulsante di pagamento con carta: quello si', ha
   bisogno dell'id della pratica — /deposit-payment?id=... — e
   senza pratica il link non esiste proprio.
   ============================================================ */
/* le coordinate bancarie NON si ricopiano qui: IBAN, BIC, BANCA e
   INTESTAT stanno in template.js e le usa gia' l'offerta. Un IBAN
   scritto in due posti e' un IBAN che un giorno cambia in uno solo. */
const CAPARRA_A_PERSONA = 75;

/* «Bianchi Maria 25/09/2026»: quello che l'ospite scrive nella causale */
function causalePreventivo(d) {
  const due = (n) => (n < 10 ? '0' : '') + n;
  const mese = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
                 Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 }[d.mese] || 0;
  const data = mese ? `${due(d.giornoArrivo)}/${due(mese)}/${d.anno}` : '';
  const nome = String(d.intestatario || '').trim();
  return { data, testo: nome && data ? `${nome} ${data}` : '' };
}

function bloccoCaparra(d, lingua) {
  const t = PREVENTIVO_T[lingua] || PREVENTIVO_T.it;
  const persone = d.adulti || 1;
  const totale = persone * CAPARRA_A_PERSONA;
  const c = causalePreventivo(d);
  if (!c.data) return '';   // senza data non si scrive una causale a meta'
  const soldi = (n) => importoLingua(n, lingua);
  return `
  <tr><td style="padding:18px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FAF8F4;">
      <tr><td width="4" style="background-color:#7A8450;font-size:0;line-height:0;">&nbsp;</td>
      <td style="padding:14px 18px;">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:2px;
          text-transform:uppercase;color:#7A8450;padding-bottom:6px;">${t.caparraTitolo}</div>
        <p style="margin:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
          ${t.caparra(soldi(totale), soldi(CAPARRA_A_PERSONA))}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"
          style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;color:#55524B;">
          <tr><td style="padding:0 10px 2px 0;color:#8C8578;">Intestato a</td><td style="padding:0 0 2px 0;">${INTESTAT}</td></tr>
          <tr><td style="padding:0 10px 2px 0;color:#8C8578;">Banca</td><td style="padding:0 0 2px 0;">${BANCA}</td></tr>
          <tr><td style="padding:0 10px 2px 0;color:#8C8578;">IBAN</td><td style="padding:0 0 2px 0;"><strong style="color:#2A2E2B;">${IBAN}</strong></td></tr>
          <tr><td style="padding:0 10px 0 0;color:#8C8578;">BIC</td><td style="padding:0;">${BIC}</td></tr>
        </table>
        <p style="margin:10px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;color:#55524B;">
          ${c.testo ? t.causale(c.testo) : t.causaleSenzaNome(c.data)}<br />
          <span style="color:#8C8578;font-size:12px;">${t.causaleNota}</span></p>
        <p style="margin:10px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;color:#55524B;">
          ${t.caparraDopo}</p>
      </td></tr>
    </table>
  </td></tr>`;
}

/* ============================================================
   QUELLO CHE IL PREVENTIVO NON DICEVA
   ------------------------------------------------------------
   «L'offerta che costruisci con disponibilità e prezzi non corrisponde
   alle offerte che mandiamo via mail: manca cosa comprende la tariffa,
   gli orari delle piscine, eccetera.» Vero. Il preventivo dava un
   prezzo e basta, e un prezzo senza la merce si legge come caro.

   NON SI RISCRIVE NIENTE. Quei due blocchi nell'offerta ci sono da
   sempre, in quattro lingue, e sono stati riletti da chi in hotel ci
   lavora. Riscriverli qui vorrebbe dire averne due versioni: si
   correggerebbe l'orario delle piscine in una e non nell'altra, e il
   giorno che succede nessuno se ne accorge finche' non arriva un ospite
   alle 19:00 trovando chiuso.

   Percio' stanno in una funzione sola per lingua, estratta LETTERALMENTE
   dal punto in cui era: le otto istantanee — quattro offerte e quattro
   preventivi — sono identiche al carattere prima e dopo l'estrazione.
   ============================================================ */
function bloccoCompreso(d, lingua) {
  if (lingua === 'de') return compresoDE(d);
  if (lingua === 'en') return compresoEN(d);
  if (lingua === 'fr') return compresoFR(d);
  return compresoIT(d);
}

function bloccoDaSapere(lingua) {
  if (lingua === 'de') return sapereDE();
  if (lingua === 'en') return sapereEN();
  if (lingua === 'fr') return sapereFR();
  return sapereIT();
}

function costruisciPreventivoBase(d, opzioni, lingua) {
  const o = opzioni || {};
  const t = PREVENTIVO_T[lingua] || PREVENTIVO_T.it;
  const voci = d.voci || [];

  /* una stima non si manda: il modale non la fa passare, e se ci
     arriva lo stesso e' un difetto, non un caso da gestire in silenzio */
  if (voci.some(v => v.stima)) {
    throw new Error('preventivo: una voce ha un prezzo stimato, non si manda');
  }
  if (!voci.length) throw new Error('preventivo: nessuna sistemazione scelta');

  const soldi = (cent) => importoLingua((cent || 0) / 100, lingua);
  const dal = dataExtra(d.giornoArrivo, d.mese, d.anno, lingua);
  const al = dataExtra(d.giornoPartenza, d.mesePartenza || d.mese, d.annoPartenza || d.anno, lingua);

  const righe = voci.map(v => {
    const extra = [];
    if (v.cure) extra.push(`${t.cure} ${soldi(v.cure)} ${t.aPersona}`);
    if (v.sconto5) extra.push(t.sc5);
    if (v.sconto3) extra.push(`${t.sc3} (${soldi(v.sconto3)})`);
    const desc = descrizionePreventivo(v.categoria, lingua);
    /* i bambini col loro prezzo per eta': rigaBambini li vuole in euro e
       le eta' come stringa, ed e' la stessa funzione delle offerte vere */
    const bimbi = (v.bambiniPrezzi && v.bambiniPrezzi.length)
      ? rigaBambini({ bambiniPrezzi: v.bambiniPrezzi.map(x => x / 100),
                      etaBambini: (d.etaBambini || []).join(' ') }, lingua)
      : '';
    return `
    <tr><td style="padding:0 0 14px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FAF8F4;border-left:3px solid #1E7F88;">
        <tr><td style="padding:14px 18px;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:24px;color:#2A2E2B;">${categoriaPreventivo(v.categoria, d.adulti, lingua)}</div>
          ${desc ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#7B756A;padding-top:2px;">${desc}</div>` : ''}
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;padding-top:6px;">${traduciTrattamento(v.trattamento, lingua)}</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;padding-top:8px;">
            <tr><td style="padding:0 10px 3px 0;color:#8C8578;">${t.aPersona}</td>
                <td align="right" style="padding:0 0 3px 0;">${soldi(v.prezzoPP)}${bimbi}</td></tr>
            <tr><td style="padding:0 10px 0 0;color:#8C8578;">${t.totale}</td>
                <td align="right" style="padding:0;white-space:nowrap;"><strong style="color:#0F5C64;font-size:16px;">${soldi(v.totale)}</strong></td></tr>
          </table>
          ${extra.length ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#7B756A;padding-top:6px;">${extra.join(' &middot; ')}</div>` : ''}
          ${notaPacchetto(v.trattamento, lingua)}
        </td></tr>
      </table>
    </td></tr>`;
  }).join('');

  /* cure e cane: due righe, non i blocchi interi dell'offerta. Un
     preventivo non e' il posto per i turni dei fanghi e le condizioni:
     quelle stanno nell'offerta, che si manda quando l'ospite accetta. */
  const aggiunte = [];
  if (o.cure) aggiunte.push(t.noteCure);
  if (o.cane) aggiunte.push(t.noteCane);

  const corpo = `
  <tr><td style="padding:16px 36px 0 36px;">
    <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#2A2E2B;">${salutoExtra(d, o, lingua)},</p>
    <h1 style="margin:0 0 10px 0;font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:31px;font-weight:normal;color:#2A2E2B;">${t.h1}</h1>
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">${t.intro}</p>
  </td></tr>

  <tr><td style="padding:16px 36px 0 36px;">
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#1E7F88;padding-bottom:6px;">${dal} &ndash; ${al}</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;padding-bottom:8px;">${t.notti(d.notti)} &middot; ${t.ospiti(d.adulti, d.bambini || 0)}</div>
    ${voci.length > 1 ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;padding-bottom:12px;">${
      d.insieme ? t.insieme(voci.length) : t.sceglie(voci.length)}</div>` : '<div style="padding-bottom:6px;"></div>'}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${righe}</table>
    ${d.insieme && voci.length > 1 ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#E3F0F1;margin-bottom:10px;">
      <tr><td style="padding:12px 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#3C6266;">
        ${t.totaleTutte} <strong style="color:#0F5C64;font-size:17px;">${
          soldi(voci.reduce((s2, v) => s2 + (v.totale || 0), 0))}</strong>
      </td></tr></table>` : ''}
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#A79E8F;padding:2px 0 4px 0;">${dotazionePreventivo(lingua)}</div>
  </td></tr>

  ${aggiunte.length ? `<tr><td style="padding:14px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#E3F0F1;">
      <tr><td style="padding:16px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:23px;color:#3C6266;">
        ${aggiunte.join('<br /><br />')}
      </td></tr>
    </table>
  </td></tr>` : ''}

${bloccoCompreso(d, lingua)}
${bloccoDaSapere(lingua)}

  <tr><td style="padding:16px 36px 0 36px;">
    <h2 style="margin:0 0 8px 0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:24px;font-weight:normal;color:#2A2E2B;">${t.prezzoTitolo}</h2>
    <p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">${t.avviso}</p>
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">${t.chiudi}</p>
  </td></tr>
${bloccoCaparra(d, lingua)}`;

  return corniceExtra(t.banda, corpo, o, lingua);
}

function costruisciPreventivoIT(d, o) { return costruisciPreventivoBase(d, o, 'it'); }
function costruisciPreventivoDE(d, o) { return costruisciPreventivoBase(d, o, 'de'); }
function costruisciPreventivoEN(d, o) { return costruisciPreventivoBase(d, o, 'en'); }
function costruisciPreventivoFR(d, o) { return costruisciPreventivoBase(d, o, 'fr'); }
function oggettoPreventivoIT() { return PREVENTIVO_T.it.ogg.replace(/&mdash;/g, '\u2014'); }
function oggettoPreventivoDE() { return PREVENTIVO_T.de.ogg.replace(/&mdash;/g, '\u2014'); }
function oggettoPreventivoEN() { return PREVENTIVO_T.en.ogg.replace(/&mdash;/g, '\u2014'); }
function oggettoPreventivoFR() { return PREVENTIVO_T.fr.ogg.replace(/&mdash;/g, '\u2014'); }
