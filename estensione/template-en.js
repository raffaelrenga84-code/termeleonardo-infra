/* ============================================================
   Offerta Leonardo — modelli INGLESE (offerta + conferma)
   ============================================================ */

const MONTHS_EN = ['January','February','March','April','May','June',
                   'July','August','September','October','November','December'];
const MON_EN = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };


/* Categorie Fidra (italiane) tradotte per l'ospite; i nomi propri restano. */
const MAPPA_CATEGORYEN = {
  'singola senza balcone': 'Single room without balcony',
  'singola parco': 'Single room with park view',
  'singola accessibile': 'Accessible single room',
  'matrimoniale queen': 'Queen room',
  'doppia': 'Twin room',
  'junior suite accessibile': 'Accessible junior suite',
  'uso singola': 'single occupancy'
};
function categoryEN(nome) {
  let out = String(nome || '');
  const chiavi = Object.keys(MAPPA_CATEGORYEN).sort((a, b) => b.length - a.length);
  for (const k of chiavi) {
    out = out.replace(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), MAPPA_CATEGORYEN[k]);
  }
  return out;
}

function dateEN(giorno, meseAbbr, anno) {
  return `${giorno} ${MONTHS_EN[MON_EN[meseAbbr]]} ${anno}`;
}
function deadlineEN(s) {
  const m = (s || '').match(/(\d{1,2})\s+([A-Za-z]{3})\s+(20\d\d)/);
  return m ? dateEN(+m[1], m[2], +m[3]) : s;
}
function moneyEN(n) {
  return '€' + (n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function greetingEN(nomeCompleto, genere, titolo) {
  const p = (nomeCompleto || '').trim().split(/\s+/);
  const surname = p[0] || '';
  const t = titolo ? titolo + ' ' : '';
  if (!surname) return 'Dear Guest';                      // v2.0.5
  if (genere === 'F') return `Dear Mrs ${t}${surname}`;
  if (genere === 'M') return `Dear Mr ${t}${surname}`;
  return `Dear Guest`;
}
function guestsEN(adulti, bambini) {
  const tot = (adulti || 0) + (bambini || 0);   // v1.8.9
  const a = tot === 1 ? '1 guest' : `${tot} guests`;
  if (!bambini) return a;
  return `${a}, including ${bambini === 1 ? '1 child' : bambini + ' children'}`;
}

const ROOMS_EN = {
  'queen': '16 m², double bed 1.60 m, balcony overlooking the garden, soundproofed',
  'doppia': '18 m², two single beds that can be joined, balcony, soundproofed',
  'singola': '16 m², French bed 1.45 m, balcony overlooking the garden and the pools',
  'junior suite abano': '28 m², up to 3 guests: separate living and sleeping areas with sofa bed, terrace and walk-in wardrobe',
  'junior suite monteortone': '28 m², up to 4 guests: double bed and two sofa beds, terrace overlooking the garden',
  'junior suite colli': '24 m² for 2 guests, seating area and walk-in wardrobe, terrace overlooking the garden and pools',
  'junior suite accessibile': 'First floor, adapted for guests with disabilities, no balcony, private bathroom with shower',
  'suite monteortone': '48 m², up to 4 guests: double bed and two sofa beds, bathroom with twin basins and terrace. Our largest room',
  'suite colli': '41 m² for 2 guests, terrace overlooking the garden and pools, walk-in wardrobe and bathroom with twin basins'
};
const AMENITIES_EN = 'Every room has air conditioning, a flat-screen TV with streaming, telephone, safe, minibar, fibre Wi-Fi, private bathroom with shower, bathrobe and hairdryer, and parquet flooring.';

function roomBlocksEN(camere, d) {
  return raggruppaCamere(camere).map(c => {
    const nOsp = (c.adulti || 0) + (c.bambini || 0);
    const who = `${nOsp} ${nOsp === 1 ? 'guest' : 'guests'}` + ((c.quantita || 1) > 1 ? ' per room' : '');
    const key = (c.categoria||'').toLowerCase();
    let best=''; for (const k in ROOMS_EN) { if (key.includes(k) && k.length>best.length) best=k; }
    const desc = best ? ROOMS_EN[best] : '';
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;background-color:#FAF8F4;">
      <tr>
        <td width="4" style="background-color:#1E7F88;font-size:0;line-height:0;">&nbsp;</td>
        <td style="padding:15px 18px;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:24px;color:#2A2E2B;">${intestazioneCamera(c, d, 'en', categoryEN(c.categoria))}</div>
          ${desc ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#7B756A;padding-top:3px;">${desc}</div>` : ''}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;border-top:1px solid #E9E2D5;">
            <tr><td style="padding-top:9px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#55524B;">
              ${periodiDiversi(d) ? '' : `${who}<br />`}${cameraMista(c)
                ? `${traduciTrattamento(c.trattamento, 'en')}${righeSoggiornanti(c, 'en')}`
                : `${traduciTrattamento(c.trattamento, 'en')} &middot;
              <strong style="color:#0F5C64;">${moneyEN(c.totalePP)} ${((c.adulti||0)+(c.bambini||0)) === 1 ? 'for the whole stay' : etichettaPrezzoAdulti(c, 'en', 'per person')}</strong>${rigaBambini(c, 'en')}${rigaExtraCamera(c, 'en')}
              ${periodiDiversi(d) ? '' : periodoCamera(c, 'en')}`}${totaleCameraRiga(c, d, 'en')}${notaPacchetto(c.trattamento, 'en')}
            </td></tr>
          </table>
        </td>
      </tr>
    </table>`;
  }).join('') + `<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#A79E8F;padding:2px 0 4px 0;">${AMENITIES_EN}</div>`;
}

function intestazioneEN(etichetta, numero) {
  return `<tr><td align="center" style="padding:26px 36px 18px 36px;">
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
  </td></tr>` + (etichetta ? `
  <tr><td align="right" style="padding:14px 36px 0 36px;">
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:1.5px;color:#A79E8F;">${etichetta} <strong style="color:#7B756A;">${numero}</strong></div>
  </td></tr>` : '');
}

function piedeEN(firma, testoChiusura) {
  return `<tr><td style="padding:22px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="1" style="background-color:#E4DED2;font-size:0;line-height:0;">&nbsp;</td></tr></table>
    <p style="margin:16px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">${testoChiusura}</p>
    <p style="margin:16px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:24px;color:#2A2E2B;">
      ${(firma || 'The Reception').replace('La Reception','The Reception')}
    </p>
    <p style="margin:12px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:23px;color:#55524B;">
      +39 049 9939 200 &nbsp;&middot;&nbsp; info@termeleonardo.com
    </p>
  </td></tr>

  <tr><td align="center" style="padding:20px 36px 0 36px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="padding:9px 16px;background-color:#F1F4EA;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#5F6B44;">${typeof bloccoCertificazioni === 'function' ? bloccoCertificazioni() : ''}
        <strong style="color:#4A5636;">First thermal hotel in Europe</strong> certified to the <strong style="color:#4A5636;">GSTC Hotel Standard</strong> for sustainability
      </td>
    </tr></table>
  </td></tr>

  <tr><td align="center" style="padding:20px 36px 26px 36px;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:15px;letter-spacing:5px;color:#2A2E2B;">TERME LEONARDO</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:20px;color:#8C8578;padding-top:10px;">
      Via Monteortone, 46 &middot; 35037 Monteortone di Abano Terme (PD), Italy &middot; <a href="https://www.hoteltermeleonardo.com" target="_blank" style="color:#8C8578;text-decoration:underline;">hoteltermeleonardo.com</a>
    </div>
  </td></tr>

</table>
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
  <tr><td align="center" style="padding:14px 36px 0 36px;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:17px;color:#A79E8F;">
    Tria S.r.l. &middot; VAT IT 02042330288 &middot; CIN IT028089A18QYO48ED
  </td></tr>
</table>
</td></tr>
</table>`;
}

const APRI = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EDE7DC;">
<tr><td align="center" style="padding:24px 12px 40px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#FFFFFF;">`;

/* ---------------- OFFERTA EN ---------------- */
function costruisciEmailEN(d, opzioni) {
  const o = opzioni || {};
  const arrival   = dateEN(d.giornoArrivo, d.mese, d.anno);
  const departure = dateEN(d.giornoPartenza, d.mesePartenza || d.mese, d.annoPartenza || d.anno);
  const deadline  = deadlineEN(d.scadenza);
  const nights    = d.notti === 1 ? '1 night' : `${d.notti} nights`;
  const guests    = guestsEN(d.adulti, d.bambini);
  const depPP     = Math.round(d.acconto / d.adulti);
  const link      = (d.linkPagamento || '').replace('/it/deposit-payment', '/en/deposit-payment');

  const extra = [];
  if (o.cure) extra.push(`
  <tr><td style="padding:22px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#E3F0F1;">
      <tr><td style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:23px;color:#3C6266;">
        <strong style="color:#0F5C64;font-size:15px;">Thermal treatments</strong><br />
        Mud therapy takes place in the morning, in six slots between 5:50 and 10:30. Allow about an hour for the mud wrap,
        the thermal bath and the rest period in the pool. A medical admission check-up is required before the cycle begins,
        usually on Sunday afternoon.
      </td></tr>
    </table>
  </td></tr>`);
  if (o.cane) extra.push(`
  <tr><td style="padding:16px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F1E9;">
      <tr><td style="padding:14px 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        &#128054; <strong style="color:#2A2E2B;">Your dog is welcome too</strong> &middot; &euro;13 per day, payable at the hotel; food is not included.
        Dogs are at home in the room, the lobby and the Bistrot La Piazza &mdash; on a leash in shared areas. They cannot access the pools, the park or the restaurant.
      </td></tr>
    </table>
  </td></tr>`);
  if (o.fedelta) extra.push(`
  <tr><td style="padding:20px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F1F4EA;">
      <tr><td width="6" style="background-color:#7A8450;font-size:0;line-height:0;">&nbsp;</td>
      <td style="padding:16px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Thank you for coming back</strong><br />
        We have applied a <strong style="color:#2A2E2B;">5% loyalty discount</strong> on the board portion, reserved for guests
        who have stayed with us at least five times.
      </td></tr>
    </table>
  </td></tr>`);
  if (o.promo) extra.push(`
  <tr><td style="padding:20px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FDF3E7;">
      <tr><td width="6" style="background-color:#E8751A;font-size:0;line-height:0;">&nbsp;</td>
      <td style="padding:16px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Special advance-payment rate</strong><br />
        This quote includes a <strong style="color:#2A2E2B;">3% discount on the board portion</strong>, for guests who book and
        pay during our winter closing period. The rate applies with <strong style="color:#2A2E2B;">bank transfer before arrival</strong>
        or cash payment at the hotel. The discount does not apply to treatments, cures or extras.
      </td></tr>
    </table>
  </td></tr>`);

  return APRI + intestazioneEN('QUOTE No.', d.numeroOfferta) + `
  <tr><td style="padding:16px 36px 0 36px;">
    <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#2A2E2B;">${greetingEN(d.intestatario, o.genere, o.titolo)},</p>
    <h1 style="margin:0 0 10px 0;font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:31px;font-weight:normal;color:#2A2E2B;">
      ${d.camere.length > 1 ? 'Your rooms are waiting' : 'Your room is waiting'}${periodiDiversi(d) ? '' : `<br />from ${arrival} to ${departure}`}
    </h1>
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
      ${periodiDiversi(d) ? `${guests} in ${d.camere.length} rooms, with different dates: you will find them below, next to each room. We will hold it for you until <strong style="color:#2A2E2B;">${deadline}</strong>.` : `${nights} for ${guests}${d.camere.length > 1 ? ` in ${d.camere.length} rooms` : ''}. We will hold it for you until <strong style="color:#2A2E2B;">${deadline}</strong>.`}
    </p>
  </td></tr>

  <tr><td style="padding:16px 36px 0 36px;">${roomBlocksEN(ordinaCamere(d.camere), d)}${dettaglioSoggiorno(o.dettaglio, 'Your stay at a glance')}</td></tr>

  <tr><td style="padding:14px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#E3F0F1;">
      <tr>
        <td width="6" style="background-color:#1E7F88;font-size:0;line-height:0;">&nbsp;</td>
        <td style="padding:22px 24px 22px 22px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#1E7F88;padding-bottom:6px;">Total for the stay</div>
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:38px;line-height:44px;color:#0F5C64;">${moneyEN(d.totale)}</div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;color:#4A6E72;padding-top:4px;">
            for ${guests}${periodiDiversi(d) ? '' : `, ${nights}`} &middot; tourist tax not included
          </div>
${d.linkPagamento ? `          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;"><tr>
            <td align="center" bgcolor="#E8751A" style="border-radius:4px;">
              <a href="${link}" style="display:inline-block;padding:11px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#FFFFFF;text-decoration:none;line-height:18px;"><span style="color:#FFFFFF;text-decoration:none;">Confirm now</span></a>
            </td>
          </tr></table>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#5C7F83;padding-top:12px;">
            Pay by card in thirty seconds. Prefer a bank transfer? Our details are below.
          </div>` : ``}
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:22px 36px 0 36px;">
    <h2 style="margin:0 0 8px 0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:24px;font-weight:normal;color:#2A2E2B;">How to confirm</h2>
    <p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
      A deposit of <strong style="color:#2A2E2B;">${moneyEN(d.acconto)}</strong> (€${depPP} per person) secures the booking.
      <strong style="color:#2A2E2B;">It is deducted from the total</strong>: on departure you will pay ${moneyEN(d.saldo)}.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-left:2px solid #C8BFAE;"><tr><td style="padding:2px 0 2px 16px;">
${d.linkPagamento ? `      <p style="margin:0 0 9px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">By card</strong>: use the button above. Confirmation is immediate.
      </p>` : ``}
      <p style="margin:0 0 9px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">By bank transfer</strong>: please choose an <strong style="color:#2A2E2B;">instant transfer</strong>
        rather than a standard one: it arrives within seconds and we can confirm your room the same day.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 12px 0;background-color:#F4F1E9;"><tr>
        <td style="padding:12px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;color:#55524B;">
          <span style="color:#8C8578;">Account holder</span> Tria S.r.l. &ndash; Hotel Leonardo Terme<br />
          <span style="color:#8C8578;">Bank</span> Intesa Sanpaolo<br />
          <span style="color:#8C8578;">IBAN</span> <strong style="color:#2A2E2B;">IT11C0306962321100000006041</strong><br />
          <span style="color:#8C8578;">BIC</span> BCITITMM<br />
          <span style="color:#8C8578;">Reference</span> ${d.numeroOfferta}
        </td>
      </tr></table>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">By ${deadline}</strong>: after that date the room is released.
      </p>
    </td></tr></table>
  </td></tr>

  <tr><td style="padding:20px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F1E9;"><tr><td style="padding:16px 20px;">
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#8C8578;padding-bottom:10px;">If your plans change</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;color:#55524B;">
                <tr><td valign="top" width="14" style="padding:0 8px 8px 0;color:#B0A897;">&bull;</td><td valign="top" style="padding:0 0 8px 0;">The <strong style="color:#2A2E2B;">deposit</strong> is retained in case of cancellation.</td></tr>
        <tr><td valign="top" style="padding:0 8px 8px 0;color:#B0A897;">&bull;</td><td valign="top" style="padding:0 0 8px 0;">If you cancel <strong style="color:#2A2E2B;">up to 7 days before arrival</strong>, only the deposit is retained; after that, 100% of the booked services is charged.</td></tr>
        <tr><td valign="top" style="padding:0 8px 8px 0;color:#B0A897;">&bull;</td><td valign="top" style="padding:0 0 8px 0;">For bookings with a <strong style="color:#2A2E2B;">fixed room number</strong>: 70% from 30 days before arrival, 100% from 7 days.</td></tr>
        <tr><td valign="top" style="padding:0 8px 8px 0;color:#B0A897;">&bull;</td><td valign="top" style="padding:0 0 8px 0;">In case of <strong style="color:#2A2E2B;">early departure</strong>, 100% of the booked services is charged. Late arrival or early departure: unused nights are charged as well.</td></tr>
        <tr><td valign="top" style="padding:0 8px 0 0;color:#B0A897;">&bull;</td><td valign="top" style="padding:0;">Cancellations are valid <strong style="color:#2A2E2B;">in writing only</strong>: an email to info@termeleonardo.com is enough.</td></tr>
      </table>
      <p style="margin:14px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#8C8578;">
        By paying the deposit you accept these terms. As this is accommodation for a set date, no right of withdrawal applies.
      </p>
    </td></tr></table>
  </td></tr>

  <tr><td style="padding:22px 36px 0 36px;">
    <h2 style="margin:0 0 12px 0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:24px;font-weight:normal;color:#2A2E2B;">Included in the rate</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
      <tr><td width="30" valign="top" style="padding:0 6px 12px 0;font-size:17px;line-height:22px;">&#9832;</td>
          <td valign="top" style="padding:0 0 12px 0;"><strong style="color:#2A2E2B;">Thermal area</strong><br />Three interconnected thermal pools, indoor and outdoor &middot; a pool with cool thermal water &middot; grottoes with bio-sauna and steam bath &middot; adults-only relaxation area</td></tr>
      <tr><td valign="top" style="padding:0 6px 12px 0;font-size:17px;line-height:22px;">&#9749;</td>
          <td valign="top" style="padding:0 0 12px 0;"><strong style="color:#2A2E2B;">At the table</strong><br />${rigaATavola(d, 'en')}</td></tr>
      <tr><td valign="top" style="padding:0 6px 12px 0;font-size:17px;line-height:22px;">&#128716;</td>
          <td valign="top" style="padding:0 0 12px 0;"><strong style="color:#2A2E2B;">In your room</strong><br />Bathrobe and towel per person &middot; fibre Wi-Fi &middot; balcony</td></tr>
      <tr><td valign="top" style="padding:0 6px 0 0;font-size:17px;line-height:22px;">&#127939;</td>
          <td valign="top" style="padding:0;"><strong style="color:#2A2E2B;">Active</strong><br />Gym &middot; park with hill views &middot; free parking &middot; reduced green fee</td></tr>
    </table>
    <p style="margin:14px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#8C8578;">
      Not included: lunch at the Bistrot, drinks, wellness treatments, thermal cures and transfers.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;background-color:#E3F0F1;">
      <tr><td width="6" style="background-color:#1E7F88;font-size:0;line-height:0;">&nbsp;</td>
      <td style="padding:14px 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:23px;color:#3C6266;">
        <strong style="color:#0F5C64;">Complete the online check-in before your arrival.</strong>
        The pools are yours from <strong style="color:#0F5C64;">11:30</strong>, without waiting for the 15:00 room check-in.
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:22px 36px 0 36px;">
    <h2 style="margin:0 0 6px 0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:24px;font-weight:normal;color:#2A2E2B;">Would you like to add anything?</h2>
    <p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#7B756A;">Just reply to this email.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="padding:12px 16px;background-color:#FAF8F4;border-left:3px solid #7A8450;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Airport transfer</strong> &middot; Venice, shared shuttle from €65<br /><span style="color:#7B756A;font-size:13px;">To be booked at least 24 hours ahead. Let us know your flight and arrival time</span>${bottoneServizio('transfer', d, 'en')}
      </td></tr>
      <tr><td height="8" style="font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:12px 16px;background-color:#FAF8F4;border-left:3px solid #7A8450;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Anti-stress massage</strong> &middot; €55 (45 minutes)<br /><span style="color:#7B756A;font-size:13px;">Our most requested. Time slots fill up quickly</span><br /><a href="https://www.termeleonardo.com/pdf/listino-spa-trattamenti-e-massaggi-hotel-leonardo-da-vinci-terme.pdf" target="_blank" style="color:#0F5C64;font-size:13px;text-decoration:underline;">Download the full treatments and massages price list (PDF, in Italian)</a>${bottoneServizio('trattamenti', d, 'en')}
      </td></tr>
      <tr><td height="8" style="font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:12px 16px;background-color:#FAF8F4;border-left:3px solid #7A8450;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Golf right at the hotel</strong> &middot; range fee €6 for hotel guests<br /><span style="color:#7B756A;font-size:13px;">15,000 m&sup2; driving range with 10 bays next to the thermal pools: putting green, pitching green, bunker. Reduced green fees at the Montecchia, Padova and Frassanelle golf clubs (minutes away), lessons with our pro on request</span>
      </td></tr>
      <tr><td height="8" style="font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:12px 16px;background-color:#FAF8F4;border-left:3px solid #7A8450;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Enjoy the thermal pools to the very end</strong> &middot; pools on departure day until 18:30 &middot; <span style="color:#7B756A;font-size:13px;">€30 per person, a rate reserved for our guests. Changing rooms included</span>
      </td></tr>
    </table>
  </td></tr>
${extra.join('')}
  <tr><td style="padding:22px 36px 0 36px;">
    <h2 style="margin:0 0 10px 0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:24px;font-weight:normal;color:#2A2E2B;">Good to know</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
      <tr><td width="130" valign="top" style="padding:0 12px 10px 0;color:#8C8578;">Check-in</td><td valign="top" style="padding:0 0 10px 0;">From 15:00 &middot; check-out by 11:00</td></tr>
      <tr><td valign="top" style="padding:0 12px 10px 0;color:#8C8578;">Tourist tax</td><td valign="top" style="padding:0 0 10px 0;">€1.50 per person per night, up to 7 nights, settled at the hotel. Children under 13 and guests with disabilities are exempt</td></tr>
      <tr><td valign="top" style="padding:0 12px 0 0;color:#8C8578;">Pools</td><td valign="top" style="padding:0;">Open from 8:00 to 19:30, until 22:30 on Fridays and Saturdays &middot; swimming cap required, on sale at reception for &euro;3</td></tr>
      <tr><td valign="top" style="padding:8px 12px 0 0;color:#8C8578;">Smoking</td><td valign="top" style="padding:8px 0 0 0;">Non-smoking hotel: not in the rooms, on the balcony yes</td></tr>
    </table>
  </td></tr>
` + piedeEN(o.firma, 'If you have any questions, simply reply to this email or give us a call — we are here every day.');
}

function subjectEN(d) {
  return `Your stay from ${dateEN(d.giornoArrivo, d.mese, d.anno)} — Hotel Terme Leonardo`;
}

/* ---------------- CONFERMA EN ---------------- */
function costruisciConfermaEN(d, opzioni) {
  const o = opzioni || {};
  const arrival   = dateEN(d.giornoArrivo, d.mese, d.anno);
  const departure = dateEN(d.giornoPartenza, d.mesePartenza || d.mese, d.annoPartenza || d.anno);
  const nights    = d.notti === 1 ? '1 night' : `${d.notti} nights`;
  const guests    = guestsEN(d.adulti, d.bambini);
  const annunciato = !!(o && o.accontoAnnunciato);
  const paid      = annunciato ? (d.caparraDovuta || d.acconto || 0) : (d.caparraVersata || 0);
  const balanceReal = (d.totale || 0) - paid;
  const credit    = balanceReal < -0.005 ? -balanceReal : 0;   // v1.6
  const balance   = Math.max(balanceReal, 0);

  const extra = [];
  if (o.cure) extra.push(`
  <tr><td style="padding:20px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#E3F0F1;">
      <tr><td style="padding:16px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:23px;color:#3C6266;">
        <strong style="color:#0F5C64;">Your thermal cure</strong><br />
        On arrival day we will see you for the medical admission check-up, required before the cycle begins.
        Please bring your doctor's referral and any relevant medical records. Mud treatments take place in the morning;
        our cure office will confirm your slot.
      </td></tr>
    </table>
  </td></tr>`);
  if (o.cane) extra.push(`
  <tr><td style="padding:16px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F1E9;">
      <tr><td style="padding:14px 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        &#128054; <strong style="color:#2A2E2B;">Your dog is welcome too</strong> &middot; &euro;13 per day, payable at the hotel; food is not included.
        Dogs are at home in the room, the lobby and the Bistrot La Piazza &mdash; on a leash in shared areas. They cannot access the pools, the park or the restaurant.
      </td></tr>
    </table>
  </td></tr>`);

  return APRI + intestazioneEN('BOOKING No.', numeroConferma(d.numeroOfferta)) + `
  <tr><td style="padding:16px 36px 0 36px;">
    <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#2A2E2B;">${greetingEN(d.intestatario, o.genere, o.titolo)},</p>
    <h1 style="margin:0 0 10px 0;font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:31px;font-weight:normal;color:#2A2E2B;">
      Everything is confirmed.<br />We look forward to ${arrival}
    </h1>
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
      ${annunciato ? 'We have received the copy of your bank transfer' : 'Your deposit has reached us'} and ${d.camere.length > 1 ? 'your rooms are reserved' : 'your room is reserved'}. Booking <strong style="color:#2A2E2B;">${numeroConferma(d.numeroOfferta)}</strong>.
    </p>
  </td></tr>

  <tr><td style="padding:18px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FAF8F4;">
      <tr><td style="padding:16px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
          <tr><td width="110" style="padding:0 10px 7px 0;color:#8C8578;">Arrival</td><td style="padding:0 0 7px 0;"><strong style="color:#2A2E2B;">${arrival}</strong>, from 15:00</td></tr>
          <tr><td style="padding:0 10px 7px 0;color:#8C8578;">Departure</td><td style="padding:0 0 7px 0;"><strong style="color:#2A2E2B;">${departure}</strong>, by 11:00</td></tr>
          <tr><td style="padding:0 10px 12px 0;color:#8C8578;">Stay</td><td style="padding:0 0 12px 0;">${periodiDiversi(d) ? `${guests} in ${d.camere.length} rooms &middot; dates shown next to each room` : (soggiorniMisti(d) ? `${guests} &middot; dates shown for each guest` : `${nights} for ${guests}`)}</td></tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${camereConferma(ordinaCamere(d.camere), 'en', d)}</table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
          <tr><td width="130" style="padding:6px 10px 5px 0;color:#8C8578;">Total</td><td style="padding:6px 0 5px 0;">${moneyEN(d.totale)}</td></tr>
          <tr><td style="padding:0 10px 5px 0;color:#8C8578;">${annunciato ? 'Deposit &middot; transfer announced' : 'Deposit received'}</td><td style="padding:0 0 5px 0;">&minus; ${moneyEN(paid)}</td></tr>
          <tr><td style="padding:0 10px 0 0;color:#8C8578;">Balance on arrival</td><td style="padding:0;"><strong style="color:#0F5C64;font-size:16px;">${moneyEN(balance)}</strong></td></tr>
          ${credit > 0 ? `<tr><td colspan="2" style="padding:6px 0 0 0;font-size:13px;color:#55524B;">Your deposit exceeds the total by <strong>${moneyEN(credit)}</strong>: we will settle the difference on arrival.</td></tr>` : ''}
        </table>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#A79E8F;padding-top:8px;">
          Plus tourist tax: €1.50 per person per night, up to 7 nights, settled at the hotel.
        </div>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:20px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#E3F0F1;">
      <tr><td width="6" style="background-color:#1E7F88;font-size:0;line-height:0;">&nbsp;</td>
      <td style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:23px;color:#3C6266;">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:24px;color:#0F5C64;padding-bottom:8px;">Complete the online check-in</div>
        You will shortly receive an email with the link. Filling it in before your arrival saves you half a day:
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:9px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#3C6266;">
          <tr><td valign="top" width="16" style="padding:0 6px 5px 0;color:#1E7F88;">&#10003;</td><td style="padding:0 0 5px 0;">Thermal pools from <strong style="color:#0F5C64;">11:30</strong>, without waiting until 15:00</td></tr>
          <tr><td valign="top" style="padding:0 6px 5px 0;color:#1E7F88;">&#10003;</td><td style="padding:0 0 5px 0;">Your room straight away, if it is ready</td></tr>
          <tr><td valign="top" style="padding:0 6px 0 0;color:#1E7F88;">&#10003;</td><td style="padding:0;">No queue at the desk on arrival</td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:22px 36px 0 36px;">
    <h2 style="margin:0 0 6px 0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:24px;font-weight:normal;color:#2A2E2B;">Let us prepare your arrival</h2>
    ${d.linkArrivo ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px 0;"><tr><td align="center" bgcolor="#1E7F88" style="border-radius:5px;"><a href="${d.linkArrivo}" style="display:inline-block;padding:11px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#FFFFFF;text-decoration:none;font-weight:bold;">Prepare your arrival</a></td></tr></table><p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#7B756A;">Two minutes from your phone: arrival time, invoice, transfer. Prefer writing? Just reply to this email.</p>` : `<p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#7B756A;">Reply to this email and we will take care of it before you get here.</p>`}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="padding:12px 16px;background-color:#FAF8F4;border-left:3px solid #7A8450;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">What time do you expect to arrive?</strong><br /><span style="color:#7B756A;font-size:13px;">So we can welcome you without waiting. And if you expect to arrive after 10 pm, please let us know in advance: we will arrange to welcome you even at a late hour</span>
      </td></tr>
      <tr><td height="8" style="font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:12px 16px;background-color:#FAF8F4;border-left:3px solid #7A8450;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Airport transfer</strong> &middot; Venice, shared shuttle from €65<br /><span style="color:#7B756A;font-size:13px;">Send us your flight number and time. To be booked at least 24 hours ahead</span>${bottoneServizio('transfer', d, 'en')}
      </td></tr>
      <tr><td height="8" style="font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:12px 16px;background-color:#FAF8F4;border-left:3px solid #7A8450;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Anti-stress massage</strong>: €55 (45 minutes)<br /><span style="color:#7B756A;font-size:13px;">Our most requested. Slots fill up quickly — best to book now</span><br /><a href="https://www.termeleonardo.com/pdf/listino-spa-trattamenti-e-massaggi-hotel-leonardo-da-vinci-terme.pdf" target="_blank" style="color:#0F5C64;font-size:13px;text-decoration:underline;">Download the full treatments and massages price list (PDF, in Italian)</a>${bottoneServizio('trattamenti', d, 'en')}
      </td></tr>
      <tr><td height="8" style="font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:12px 16px;background-color:#FAF8F4;border-left:3px solid #7A8450;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Early Bird Swimming</strong>: €20 per person<br /><span style="color:#7B756A;font-size:13px;">Pools from 9:00 on arrival day. Please request it now, not on arrival</span>
      </td></tr>${rigaPrepara('A gift voucher', 'spa and treatments for someone you choose', 'We prepare it with your message and send it to you by email, ready to give', bottoneServizio('buoni', d, 'en'))}${rigaGolf(d, 'en')}${rigaFanghi(d, o, 'en')}
    </table>
  </td></tr>
${extra.join('')}
  <tr><td style="padding:22px 36px 0 36px;">
    <h2 style="margin:0 0 10px 0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:24px;font-weight:normal;color:#2A2E2B;">Good to know</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
      <tr><td width="130" valign="top" style="padding:0 12px 9px 0;color:#8C8578;">Pools</td><td valign="top" style="padding:0 0 9px 0;">Open from 8:00 to 19:30, until 22:30 on Fridays and Saturdays &middot; swimming cap required, on sale at reception for &euro;3</td></tr>
      <tr><td valign="top" style="padding:8px 12px 0 0;color:#8C8578;">Smoking</td><td valign="top" style="padding:8px 0 0 0;">Non-smoking hotel: not in the rooms, on the balcony yes</td></tr>
      <tr><td valign="top" style="padding:0 12px 9px 0;color:#8C8578;">Dinner</td><td valign="top" style="padding:0 0 9px 0;">From 19:30, last entry 20:20. If you arrive later, let us know: we will leave a plate in your room</td></tr>
      <tr><td valign="top" style="padding:0 12px 9px 0;color:#8C8578;">Lunch</td><td valign="top" style="padding:0 0 9px 0;">At Bistrot La Piazza, bathrobes welcome: open 10:00&ndash;23:00, lunch 12:30&ndash;14:30, light bites until 17:30</td></tr>
      <tr><td valign="top" style="padding:0 12px 9px 0;color:#8C8578;">Departure day</td><td valign="top" style="padding:0 0 9px 0;">Pools included until 11:00. You can extend until 18:30 for €30 per person — just ask at check-out</td></tr>
      <tr><td valign="top" style="padding:0 12px 0 0;color:#8C8578;">Electric car</td><td valign="top" style="padding:0;">Eight 11 kW charging points, managed via the <em>Next charge</em> or <em>My wallbox</em> app: please bring your own cable</td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:20px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F1E9;"><tr><td style="padding:14px 18px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;color:#8C8578;">
      Should your plans change: the deposit is retained in case of cancellation.
      If you cancel up to 7 days before arrival only the deposit is retained, then 100% of the booked services; with a fixed room number, 70% from 30 days and 100% from 7 days.
      In case of early departure or late arrival, unused nights are charged as well. Cancellations in writing only, to info@termeleonardo.com.
    </td></tr></table>
  </td></tr>
` + piedeEN(o.firma, 'For anything at all, before or during your stay, write or call us — we are here every day.');
}

function subjectConfirmEN(d) {
  return `Booking ${numeroConferma(d.numeroOfferta)} confirmed — see you on ${dateEN(d.giornoArrivo, d.mese, d.anno)}`;
}
