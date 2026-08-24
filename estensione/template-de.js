/* ============================================================
   Offerta Leonardo — modello TEDESCO
   Testi ripresi dalle offerte reali della reception,
   con l'aggiunta del § 13 SGB V e della Kurtaxe.
   ============================================================ */

const MONATE = ['Januar','Februar','März','April','Mai','Juni',
                'Juli','August','September','Oktober','November','Dezember'];
const MON_N  = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };


/* Categorie Fidra (italiane) tradotte per l'ospite; i nomi propri restano. */
const MAPPA_KATEGORIEDE = {
  'singola senza balcone': 'Einzelzimmer ohne Balkon',
  'singola parco': 'Einzelzimmer mit Parkblick',
  'singola accessibile': 'Barrierefreies Einzelzimmer',
  'matrimoniale queen': 'Queen-Doppelzimmer',
  'doppia': 'Doppelzimmer',
  'junior suite accessibile': 'Barrierefreie Junior Suite',
  'uso singola': 'zur Alleinbenutzung'
};
function kategorieDE(nome) {
  let out = String(nome || '');
  const chiavi = Object.keys(MAPPA_KATEGORIEDE).sort((a, b) => b.length - a.length);
  for (const k of chiavi) {
    out = out.replace(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), MAPPA_KATEGORIEDE[k]);
  }
  return out;
}

function datumDE(giorno, meseAbbr, anno) {
  return `${giorno}. ${MONATE[MON_N[meseAbbr]]} ${anno}`;
}

function fristDE(s) {
  const m = (s || '').match(/(\d{1,2})\s+([A-Za-z]{3})\s+(20\d\d)/);
  return m ? datumDE(+m[1], m[2], +m[3]) : s;
}

function anredeDE(nomeCompleto, genere, titolo) {
  const p = (nomeCompleto || '').trim().split(/\s+/);
  const cognome = p[0] || '';
  const t = titolo ? titolo + ' ' : '';
  if (!cognome) return 'Sehr geehrte Damen und Herren';   // v2.0.5
  if (genere === 'F') return `Sehr geehrte Frau ${t}${cognome}`;
  if (genere === 'M') return `Sehr geehrter Herr ${t}${cognome}`;
  return `Sehr geehrte Damen und Herren`;
}

function gaesteDE(erw, kinder) {
  const tot = (erw || 0) + (kinder || 0);   // v1.8.9: i bambini contano nel totale
  const a = tot === 1 ? '1 Person' : `${tot} Personen`;
  if (!kinder) return a;
  return `${a}, davon ${kinder === 1 ? '1 Kind' : kinder + ' Kinder'}`;
}

const ZIMMER_DE = {
  'queen': '16 m², Doppelbett 1,60 m, Balkon mit Gartenblick, schallisoliert',
  'doppia': '18 m², zwei zusammenstellbare Einzelbetten, Balkon, schallisoliert',
  'singola': '16 m², französisches Bett 1,45 m, Balkon mit Garten- und Poolblick',
  'junior suite abano': '28 m², bis 3 Personen: getrennter Wohn- und Schlafbereich mit Schlafsofa, Terrasse und begehbarem Kleiderschrank',
  'junior suite monteortone': '28 m², bis 4 Personen: Doppelbett und zwei Schlafsofas, Terrasse mit Gartenblick',
  'junior suite colli': '24 m² für 2 Personen, Sitzecke und begehbarer Kleiderschrank, Terrasse mit Garten- und Poolblick',
  'junior suite accessibile': 'Im ersten Stock, barrierefrei ausgestattet, ohne Balkon, eigenes Bad mit Dusche',
  'suite monteortone': '48 m², bis 4 Personen: Doppelbett und zwei Schlafsofas, Bad mit Doppelwaschbecken und Terrasse. Unsere größte Kategorie',
  'suite colli': '41 m² für 2 Personen, Terrasse mit Garten- und Poolblick, begehbarer Kleiderschrank und Bad mit Doppelwaschbecken'
};

const AUSSTATTUNG_DE = 'Alle Zimmer verfügen über Klimaanlage, Flachbild-TV mit Streamingdiensten, Telefon, Safe, Minibar, WLAN sowie eigenes Bad mit Dusche, Bademantel und Haartrockner, Parkettboden.';

function beschreibung(kategorie) {
  const c = (kategorie || '').toLowerCase();
  let best = '';
  for (const k in ZIMMER_DE) { if (c.includes(k) && k.length > best.length) best = k; }
  return best ? ZIMMER_DE[best] : '';
}

function zimmerDE(camere, d) {
  return raggruppaCamere(camere).map(c => {
    const nOsp = (c.adulti || 0) + (c.bambini || 0);
    const wer  = `${nOsp} ${nOsp === 1 ? 'Gast' : 'Gäste'}` + ((c.quantita || 1) > 1 ? ' pro Zimmer' : '');
    const desc = beschreibung(c.categoria);
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;background-color:#FAF8F4;">
      <tr>
        <td width="4" style="background-color:#1E7F88;font-size:0;line-height:0;">&nbsp;</td>
        <td style="padding:15px 18px;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:24px;color:#2A2E2B;">${intestazioneCamera(c, d, 'de', kategorieDE(c.categoria))}</div>
          ${desc ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#7B756A;padding-top:3px;">${desc}</div>` : ''}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;border-top:1px solid #E9E2D5;">
            <tr><td style="padding-top:9px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#55524B;">
              ${periodiDiversi(d) ? '' : `${wer}<br />`}
              ${cameraMista(c)
                ? `${traduciTrattamento(c.trattamento, 'de')}${righeSoggiornanti(c, 'de')}`
                : `${traduciTrattamento(c.trattamento, 'de')} &middot;
              <strong style="color:#0F5C64;">${c.totalePP.toLocaleString('de-DE',{minimumFractionDigits:2})} &euro; ${((c.adulti||0)+(c.bambini||0)) === 1 ? 'f&uuml;r den gesamten Aufenthalt' : etichettaPrezzoAdulti(c, 'de', 'pro Person')}</strong>${rigaBambini(c, 'de')}${rigaExtraCamera(c, 'de')}
              ${periodiDiversi(d) ? '' : periodoCamera(c, 'de')}`}${totaleCameraRiga(c, d, 'de')}${notaPacchetto(c.trattamento, 'de')}
            </td></tr>
          </table>
        </td>
      </tr>
    </table>`;
  }).join('') + `<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#A79E8F;padding:2px 0 4px 0;">${AUSSTATTUNG_DE}</div>`;
}

function costruisciEmailDE(d, opzioni) {
  const o = opzioni || {};
  const anreise  = datumDE(d.giornoArrivo, d.mese, d.anno);
  const abreise  = datumDE(d.giornoPartenza, d.mesePartenza || d.mese, d.annoPartenza || d.anno);
  const frist    = fristDE(d.scadenza);
  const naechte  = d.notti === 1 ? '1 Nacht' : `${d.notti} Nächte`;
  const gaeste   = gaesteDE(d.adulti, d.bambini);
  const kautionPP = Math.round(d.acconto / d.adulti);
  // il link di pagamento deve puntare alla versione tedesca del sito
  const link = (d.linkPagamento || '').replace('/it/deposit-payment', '/de/deposit-payment');

  const blocchi = [];

  if (o.cure) blocchi.push(`
  <tr><td style="padding:22px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#E3F0F1;">
      <tr><td style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:23px;color:#3C6266;">
        <strong style="color:#0F5C64;font-size:15px;">Ihre Fangokur und Ihre Krankenkasse</strong><br />
        Unser Haus ist vom italienischen Gesundheitsministerium anerkannt und damit auch im Sinne des
        <strong style="color:#0F5C64;">&sect; 13 Abs. 4 Satz 2 SGB V</strong>.
        Ihre Fangokur kann daher von Ihrer Krankenkasse bezuschusst werden.
        Bitte klären Sie die Voraussetzungen vorab mit Ihrer Kasse: die Unterlagen stellen wir Ihnen gerne aus.<br /><br />
        Die Fangoanwendungen finden vormittags statt, in sechs Terminen zwischen 5:50 und 10:30 Uhr.
        Mit Fango, Thermalbad und Ruhephase im Pool rechnen Sie etwa eine Stunde.
        Die ärztliche Aufnahmeuntersuchung ist Pflicht und findet in der Regel sonntagnachmittags statt.
      </td></tr>
    </table>
  </td></tr>`);

  if (o.fedelta) blocchi.push(`
  <tr><td style="padding:20px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F1F4EA;">
      <tr>
        <td width="6" style="background-color:#7A8450;font-size:0;line-height:0;">&nbsp;</td>
        <td style="padding:16px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
          <strong style="color:#2A2E2B;">Wir freuen uns, Sie wiederzusehen</strong><br />
          Auf den Pensionspreis haben wir Ihnen einen <strong style="color:#2A2E2B;">Nachlass von 5 %</strong>
          gew&auml;hrt. Er ist im Gesamtpreis bereits ber&uuml;cksichtigt.
        </td>
      </tr>
    </table>
  </td></tr>`);

  if (o.promo) blocchi.push(`
  <tr><td style="padding:20px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FDF3E7;">
      <tr>
        <td width="6" style="background-color:#E8751A;font-size:0;line-height:0;">&nbsp;</td>
        <td style="padding:16px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
          <strong style="color:#2A2E2B;">3 % f&uuml;r Fr&uuml;hbucher 2027</strong><br />
          W&auml;hrend der Winterschlie&szlig;ung f&uuml;hren wir die Renovierungsarbeiten weiter &mdash; auch dank
          unserer G&auml;ste, die fr&uuml;hzeitig buchen. Wenn Sie Ihren Erholungsurlaub
          <strong style="color:#2A2E2B;">2027</strong> buchen und den Gesamtbetrag
          <strong style="color:#2A2E2B;">bis zum 31. Januar 2027</strong> &uuml;berweisen, erhalten Sie bei Ihrer
          Abreise <strong style="color:#2A2E2B;">3 % auf den Pensionspreis</strong>.
          <br /><br />
          Ma&szlig;geblich ist der Zahlungseingang auf unserem Konto. Der Betrag ist im oben genannten
          Gesamtpreis <strong style="color:#2A2E2B;">nicht enthalten</strong>: Sie erhalten ihn bei der Abreise.
          Er wird nur auf den Pensionspreis berechnet &mdash; nicht auf Kuren, Behandlungen und Extras.
        </td>
      </tr>
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
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:1.5px;color:#A79E8F;">ANGEBOT NR. <strong style="color:#7B756A;">${d.numeroOfferta}</strong></div>
  </td></tr>

  <tr><td style="padding:16px 36px 0 36px;">
    <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#2A2E2B;">${anredeDE(d.intestatario, o.genere, o.titolo)},</p>
    <h1 style="margin:0 0 10px 0;font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:31px;font-weight:normal;color:#2A2E2B;">
      ${d.alternative ? altT('de').h1(d.camere.length) : `${d.camere.length > 1 ? 'Ihre Zimmer erwarten Sie' : 'Ihr Zimmer erwartet Sie'}${periodiDiversi(d) ? '' : `<br />vom ${anreise} bis ${abreise}`}`}
    </h1>
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
      ${d.alternative ? altT('de').intro(d.camere.length, frist) : `${periodiDiversi(d) ? `${gaeste} in ${d.camere.length} Zimmern, mit unterschiedlichen Zeiträumen: Sie finden sie unten bei jedem Zimmer. Wir halten Ihnen die Verfügbarkeit bis zum <strong style="color:#2A2E2B;">${frist}</strong> frei.` : `${naechte} für ${gaeste}${d.camere.length > 1 ? ` in ${d.camere.length} Zimmern` : ''}. Wir halten Ihnen die Verfügbarkeit bis zum <strong style="color:#2A2E2B;">${frist}</strong> frei.`}`}
    </p>
  </td></tr>

  <tr><td style="padding:16px 36px 0 36px;">
    ${zimmerDE(ordinaCamere(d.camere), d)}
    ${dettaglioSoggiorno(o.dettaglio, 'Ihr Aufenthalt im Überblick')}
  </td></tr>

${blocchi.join('')}
  <tr><td style="padding:14px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#E3F0F1;">
      <tr>
        <td width="6" style="background-color:#1E7F88;font-size:0;line-height:0;">&nbsp;</td>
        <td style="padding:22px 24px 22px 22px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#1E7F88;padding-bottom:6px;">Gesamtpreis</div>
          ${d.alternative ? '' : `<div style="font-family:Georgia,'Times New Roman',serif;font-size:38px;line-height:44px;color:#0F5C64;">${d.totale.toLocaleString('de-DE',{minimumFractionDigits:2})} &euro;</div>`}
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;color:#4A6E72;padding-top:4px;">
            ${d.alternative ? altT('de').coda : `für ${gaeste}${periodiDiversi(d) ? '' : `, ${naechte}`} &middot; zzgl. Kurtaxe`}
          </div>
${d.linkPagamento ? `          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;"><tr>
            <td align="center" bgcolor="#E8751A" style="border-radius:4px;">
              <a href="${link}" style="display:inline-block;padding:11px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#FFFFFF;text-decoration:none;line-height:18px;"><span style="color:#FFFFFF;text-decoration:none;">Jetzt bestätigen</span></a>
            </td>
          </tr></table>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#5C7F83;padding-top:12px;">
            Mit Karte in dreißig Sekunden. Lieber per Überweisung? Die Bankverbindung finden Sie unten.
          </div>` : ``}
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:22px 36px 0 36px;">
    <h2 style="margin:0 0 8px 0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:24px;font-weight:normal;color:#2A2E2B;">So bestätigen Sie Ihre Reservierung</h2>
    <p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
      ${d.alternative ? 'Die Anzahlung h&auml;ngt von der gew&auml;hlten M&ouml;glichkeit ab: Sie finden sie oben bei jeder einzelnen.' : `Es genügt eine Anzahlung (Kaution) von <strong style="color:#2A2E2B;">${d.acconto.toLocaleString('de-DE',{minimumFractionDigits:2})} &euro;</strong> (${kautionPP} &euro; pro Person).`}
      <strong style="color:#2A2E2B;">Sie wird vom Gesamtpreis abgezogen</strong>: bei Abreise zahlen Sie noch ${d.saldo.toLocaleString('de-DE',{minimumFractionDigits:2})} &euro;.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-left:2px solid #C8BFAE;"><tr><td style="padding:2px 0 2px 16px;">
${d.linkPagamento ? `      <p style="margin:0 0 9px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Mit Karte</strong>: über die Schaltfläche oben. Die Bestätigung erhalten Sie sofort.
      </p>` : ``}
      <p style="margin:0 0 9px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Per Überweisung</strong>: bitte wählen Sie die <strong style="color:#2A2E2B;">Echtzeitüberweisung</strong>, nicht die normale: sie kommt in Sekunden an und wir bestätigen Ihnen das Zimmer noch am selben Tag.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 12px 0;background-color:#F4F1E9;"><tr>
        <td style="padding:12px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;color:#55524B;">
          <span style="color:#8C8578;">Empfänger</span> Tria S.r.l. &ndash; Hotel Leonardo Terme<br />
          <span style="color:#8C8578;">Bank</span> Intesa Sanpaolo<br />
          <span style="color:#8C8578;">IBAN</span> <strong style="color:#2A2E2B;">IT11C0306962321100000006041</strong><br />
          <span style="color:#8C8578;">BIC</span> BCITITMM<br />
          <span style="color:#8C8578;">Verwendungszweck</span> ${d.numeroOfferta}
        </td>
      </tr></table>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Bis zum ${frist}</strong>: danach geben wir das Zimmer wieder frei.
      </p>
    </td></tr></table>
  </td></tr>

  <tr><td style="padding:20px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F1E9;"><tr><td style="padding:16px 20px;">
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#8C8578;padding-bottom:10px;">Stornobedingungen</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;color:#55524B;">
                <tr><td valign="top" width="14" style="padding:0 8px 8px 0;color:#B0A897;">&bull;</td><td valign="top" style="padding:0 0 8px 0;">Die <strong style="color:#2A2E2B;">Kaution</strong> wird bei einer Stornierung einbehalten.</td></tr>
        <tr><td valign="top" style="padding:0 8px 8px 0;color:#B0A897;">&bull;</td><td valign="top" style="padding:0 0 8px 0;">Bei einer Stornierung <strong style="color:#2A2E2B;">bis 7 Tage vor Reiseantritt</strong> wird nur die Kaution einbehalten, danach werden 100 % der gebuchten Leistungen in Rechnung gestellt.</td></tr>
        <tr><td valign="top" style="padding:0 8px 8px 0;color:#B0A897;">&bull;</td><td valign="top" style="padding:0 0 8px 0;">Bei einer Reservierung mit <strong style="color:#2A2E2B;">fixer Zimmernummer</strong>: ab 30 Tage vor Reiseantritt 70 %, ab 7 Tage 100 %.</td></tr>
        <tr><td valign="top" style="padding:0 8px 8px 0;color:#B0A897;">&bull;</td><td valign="top" style="padding:0 0 8px 0;">Bei <strong style="color:#2A2E2B;">vorzeitiger Abreise</strong> werden 100 % der gebuchten Leistungen berechnet. Bei verspäteter Anreise oder vorzeitiger Abreise werden auch die nicht in Anspruch genommenen Übernachtungen berechnet.</td></tr>
        <tr><td valign="top" style="padding:0 8px 0 0;color:#B0A897;">&bull;</td><td valign="top" style="padding:0;">Zimmerstornierungen sind nur in <strong style="color:#2A2E2B;">schriftlicher Form</strong> gültig: eine E-Mail an info@termeleonardo.com genügt.</td></tr>
      </table>
      <p style="margin:14px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#8C8578;">
        Mit der Zahlung der Anzahlung akzeptieren Sie diese Bedingungen. Da es sich um eine Beherbergungsleistung mit festem Datum handelt, besteht kein Widerrufsrecht.
      </p>
    </td></tr></table>
  </td></tr>

  <tr><td style="padding:22px 36px 0 36px;">
    <h2 style="margin:0 0 12px 0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:24px;font-weight:normal;color:#2A2E2B;">Im Preis enthalten</h2>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
      <tr>
        <td width="30" valign="top" style="padding:0 6px 12px 0;font-size:17px;line-height:22px;">&#9832;</td>
        <td valign="top" style="padding:0 0 12px 0;">
          <strong style="color:#2A2E2B;">Thermalbereich</strong><br />
          Die drei miteinander verbundenen Thermalbecken, innen und au&szlig;en &middot; ein Becken mit k&uuml;hlem Thermalwasser &middot; Grotten mit Biosauna und Dampfbad &middot; Ruhebereich nur f&uuml;r Erwachsene
        </td>
      </tr>
      <tr>
        <td valign="top" style="padding:0 6px 12px 0;font-size:17px;line-height:22px;">&#9749;</td>
        <td valign="top" style="padding:0 0 12px 0;">
          <strong style="color:#2A2E2B;">Kulinarik</strong><br />
          ${rigaATavola(d, 'de')}
        </td>
      </tr>
      <tr>
        <td valign="top" style="padding:0 6px 12px 0;font-size:17px;line-height:22px;">&#128716;</td>
        <td valign="top" style="padding:0 0 12px 0;">
          <strong style="color:#2A2E2B;">Im Zimmer</strong><br />
          Bademantel und Badetuch pro Person &middot; WLAN &middot; Balkon
        </td>
      </tr>
      <tr>
        <td valign="top" style="padding:0 6px 0 0;font-size:17px;line-height:22px;">&#127939;</td>
        <td valign="top" style="padding:0;">
          <strong style="color:#2A2E2B;">Aktiv</strong><br />
          Fitnessraum &middot; Park mit Blick auf die H&uuml;gel &middot; kostenfreier Parkplatz &middot; erm&auml;&szlig;igtes Greenfee
        </td>
      </tr>
    </table>

    <p style="margin:14px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#8C8578;">
      Nicht enthalten: Mittagessen im Bistrot, Getr&auml;nke, Wellness-Behandlungen, Thermalkuren und Transfers.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;background-color:#E3F0F1;">
      <tr>
        <td width="6" style="background-color:#1E7F88;font-size:0;line-height:0;">&nbsp;</td>
        <td style="padding:14px 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:23px;color:#3C6266;">
          <strong style="color:#0F5C64;">Erledigen Sie den Online-Check-in schon vor der Anreise.</strong>
          Dann stehen Ihnen die Thermalpools bereits <strong style="color:#0F5C64;">ab 11:30 Uhr</strong> zur Verf&uuml;gung, ohne bis 15:00 Uhr auf das Zimmer zu warten.
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:22px 36px 0 36px;">
    <h2 style="margin:0 0 6px 0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:24px;font-weight:normal;color:#2A2E2B;">Möchten Sie etwas hinzufügen?</h2>
    <p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#7B756A;">Schreiben Sie uns einfach als Antwort auf diese E-Mail.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="padding:12px 16px;background-color:#FAF8F4;border-left:3px solid #7A8450;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Transfer ab Flughafen Venedig</strong> &middot; Sammeltaxi ab 65 &euro;<br /><span style="color:#7B756A;font-size:13px;">Mindestens 24 Stunden vorher zu buchen. Nennen Sie uns Flugnummer und Uhrzeit</span>${bottoneServizio('transfer', d, 'de')}
      </td></tr>
      <tr><td height="8" style="font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:12px 16px;background-color:#FAF8F4;border-left:3px solid #7A8450;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Antistress-Massage</strong> &middot; 55 &euro; (45 Minuten)<br /><span style="color:#7B756A;font-size:13px;">Die beliebteste. Die Termine sind schnell vergeben</span><br /><a href="https://www.termeleonardo.com/pdf/listino-spa-trattamenti-e-massaggi-hotel-leonardo-da-vinci-terme-de.pdf" target="_blank" style="color:#0F5C64;font-size:13px;text-decoration:underline;">Die vollst&auml;ndige Preisliste der Behandlungen und Massagen herunterladen (PDF)</a>${bottoneServizio('trattamenti', d, 'de')}
      </td></tr>
      <tr><td height="8" style="font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:12px 16px;background-color:#FAF8F4;border-left:3px solid #7A8450;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Golf direkt am Haus</strong> &middot; Rangefee 6 &euro; f&uuml;r Hotelg&auml;ste<br /><span style="color:#7B756A;font-size:13px;">Driving Range mit 15.000 m&sup2; und 10 Abschlagpl&auml;tzen direkt neben den Thermalpools: Putting Green, Pitching Green, Bunker. Erm&auml;&szlig;igte Green Fees bei Montecchia, Padova und Frassanelle (wenige Minuten entfernt), Stunden mit unserem Pro auf Anfrage</span>
      </td></tr>
      <tr><td height="8" style="font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:12px 16px;background-color:#FAF8F4;border-left:3px solid #7A8450;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Thermalgenuss bis zuletzt</strong> &middot; Pools auch am Abreisetag, bis 18:30 Uhr &middot; <span style="color:#7B756A;font-size:13px;">30 &euro; pro Person, Vorzugspreis f&uuml;r unsere G&auml;ste. Umkleiden inklusive</span>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:22px 36px 0 36px;">
    <h2 style="margin:0 0 10px 0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:24px;font-weight:normal;color:#2A2E2B;">Gut zu wissen</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
      <tr><td width="130" valign="top" style="padding:0 12px 10px 0;color:#8C8578;">Check-in</td><td valign="top" style="padding:0 0 10px 0;">Ab 15:00 Uhr &middot; Check-out bis 11:00 Uhr</td></tr>
      <tr><td valign="top" style="padding:0 12px 10px 0;color:#8C8578;">Kurtaxe</td><td valign="top" style="padding:0 0 10px 0;">1,50 &euro; pro Person und Tag, max. 7 Tage. Vor Ort zu zahlen. Befreit sind Kinder bis zur Vollendung des 13. Lebensjahres sowie Personen mit Behinderung</td></tr>
      <tr><td valign="top" style="padding:0 12px 10px 0;color:#8C8578;">Mittagessen</td><td valign="top" style="padding:0 0 10px 0;">Bistrot La Piazza direkt am Pool, täglich 10:00&ndash;23:00 Uhr, à la carte &middot; Mittagessen 12:30&ndash;14:30 Uhr, kleine Gerichte bis 17:30 Uhr</td></tr>
      <tr><td valign="top" style="padding:0 12px 0 0;color:#8C8578;">Pools</td><td valign="top" style="padding:0;">Ge&ouml;ffnet von 8:00 bis 19:30 Uhr, freitags und samstags bis 22:30 Uhr &middot; Badekappe erforderlich, an der Rezeption f&uuml;r 3 &euro; erh&auml;ltlich</td></tr>
      <tr><td valign="top" style="padding:8px 12px 0 0;color:#8C8578;">Rauchen</td><td valign="top" style="padding:8px 0 0 0;">Nichtraucherhotel: im Zimmer wird nicht geraucht, auf dem Balkon schon</td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:22px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="1" style="background-color:#E4DED2;font-size:0;line-height:0;">&nbsp;</td></tr></table>
    <p style="margin:16px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
      Haben Sie Fragen zum Angebot? Bitte zögern Sie nicht, uns zu kontaktieren: wir sind jederzeit gerne für Sie da.
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
        <strong style="color:#4A5636;">Erstes Thermenhotel Europas</strong> &ndash; zertifiziert nach <strong style="color:#4A5636;">GSTC Hotel Standard</strong> f&uuml;r Nachhaltigkeit &middot; Zertifizierungsstelle Vireo Srl
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

function betreffDE(d) {
  return `Angebot N. #${d.numeroOfferta} — Hotel Terme Leonardo`;
}
