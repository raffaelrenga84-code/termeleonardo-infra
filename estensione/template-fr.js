/* ============================================================
   Offerta Leonardo — modelli FRANCESE (offerta + conferma)
   ============================================================ */

const MOIS_FR = ['janvier','février','mars','avril','mai','juin',
                 'juillet','août','septembre','octobre','novembre','décembre'];
const MON_FR = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };


/* Categorie Fidra (italiane) tradotte per l'ospite; i nomi propri restano. */
const MAPPA_CATEGORIEFR = {
  'singola senza balcone': 'Chambre simple sans balcon',
  'singola parco': 'Chambre simple c&ocirc;t&eacute; parc',
  'singola accessibile': 'Chambre simple accessible',
  'matrimoniale queen': 'Chambre Queen',
  'doppia': 'Chambre &agrave; lits jumeaux',
  'junior suite accessibile': 'Junior suite accessible',
  'uso singola': '&agrave; usage individuel'
};
function categorieFR(nome) {
  let out = String(nome || '');
  const chiavi = Object.keys(MAPPA_CATEGORIEFR).sort((a, b) => b.length - a.length);
  for (const k of chiavi) {
    out = out.replace(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), MAPPA_CATEGORIEFR[k]);
  }
  return out;
}

function dateFR(giorno, meseAbbr, anno) {
  const g = giorno === 1 ? '1er' : giorno;
  return `${g} ${MOIS_FR[MON_FR[meseAbbr]]} ${anno}`;
}
function echeanceFR(s) {
  const m = (s || '').match(/(\d{1,2})\s+([A-Za-z]{3})\s+(20\d\d)/);
  return m ? dateFR(+m[1], m[2], +m[3]) : s;
}
function argentFR(n) {
  return (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
function politesseFR(nomeCompleto, genere, titolo) {
  const p = (nomeCompleto || '').trim().split(/\s+/);
  const nom = p[0] || '';
  const t = titolo ? titolo + ' ' : '';
  if (!nom) return 'Madame, Monsieur';                    // v2.0.5
  if (genere === 'F') return `Chère Madame ${t}${nom}`;
  if (genere === 'M') return `Cher Monsieur ${t}${nom}`;
  return `Madame, Monsieur`;
}
function hotesFR(adulti, bambini) {
  const tot = (adulti || 0) + (bambini || 0);   // v1.8.9
  const a = tot === 1 ? '1 personne' : `${tot} personnes`;
  if (!bambini) return a;
  return `${a}, dont ${bambini === 1 ? '1 enfant' : bambini + ' enfants'}`;
}

const CHAMBRES_FR = {
  'queen': '16 m², lit double de 1,60 m, balcon avec vue sur le jardin, insonorisée',
  'doppia': '18 m², deux lits simples jumelables, balcon, insonorisée',
  'singola': '16 m², lit à la française de 1,45 m, balcon avec vue sur le jardin et les piscines',
  'junior suite abano': '28 m², jusqu\'à 3 personnes : coin nuit et coin salon séparés avec canapé-lit, terrasse et dressing',
  'junior suite monteortone': '28 m², jusqu\'à 4 personnes : lit double et deux canapés-lits, terrasse avec vue sur le jardin',
  'junior suite colli': '24 m² pour 2 personnes, coin salon et dressing, terrasse avec vue sur le jardin et les piscines',
  'junior suite accessibile': 'Au premier étage, aménagée pour les personnes à mobilité réduite, sans balcon, salle de bains privative avec douche',
  'suite monteortone': '48 m², jusqu\'à 4 personnes : lit double et deux canapés-lits, salle de bains avec double vasque et terrasse. Notre plus grande chambre',
  'suite colli': '41 m² pour 2 personnes, terrasse avec vue sur le jardin et les piscines, dressing et salle de bains avec double vasque'
};
const EQUIPEMENTS_FR = 'Toutes les chambres disposent de la climatisation, d\'une TV à écran plat avec services de streaming, téléphone, coffre-fort, minibar, Wi-Fi fibre, salle de bains privative avec douche, peignoir et sèche-cheveux, et d\'un parquet.';

function chambresFR(camere, d) {
  return raggruppaCamere(camere).map(c => {
    const nOsp = (c.adulti || 0) + (c.bambini || 0);
    const qui = `${nOsp} ${nOsp === 1 ? 'personne' : 'personnes'}` + ((c.quantita || 1) > 1 ? ' par chambre' : '');
    const key = (c.categoria||'').toLowerCase();
    let best=''; for (const k in CHAMBRES_FR) { if (key.includes(k) && k.length>best.length) best=k; }
    const desc = best ? CHAMBRES_FR[best] : '';
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;background-color:#FAF8F4;">
      <tr>
        <td width="4" style="background-color:#1E7F88;font-size:0;line-height:0;">&nbsp;</td>
        <td style="padding:15px 18px;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:24px;color:#2A2E2B;">${intestazioneCamera(c, d, 'fr', categorieFR(c.categoria))}</div>
          ${desc ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#7B756A;padding-top:3px;">${desc}</div>` : ''}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;border-top:1px solid #E9E2D5;">
            <tr><td style="padding-top:9px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#55524B;">
              ${periodiDiversi(d) ? '' : `${qui}<br />`}${cameraMista(c)
                ? `${traduciTrattamento(c.trattamento, 'fr')}${righeSoggiornanti(c, 'fr')}`
                : `${traduciTrattamento(c.trattamento, 'fr')} &middot;
              <strong style="color:#0F5C64;">${argentFR(c.totalePP)} ${((c.adulti||0)+(c.bambini||0)) === 1 ? 'pour tout le s&eacute;jour' : etichettaPrezzoAdulti(c, 'fr', 'par personne')}</strong>${rigaBambini(c, 'fr')}${rigaExtraCamera(c, 'fr')}
              ${periodiDiversi(d) ? '' : periodoCamera(c, 'fr')}`}${totaleCameraRiga(c, d, 'fr')}${notaPacchetto(c.trattamento, 'fr')}
            </td></tr>
          </table>
        </td>
      </tr>
    </table>`;
  }).join('') + rigaComunicanti(camere, 'fr')
    + `<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#A79E8F;padding:2px 0 4px 0;">${EQUIPEMENTS_FR}</div>`;
}

function piedeFR(firma, chiusura) {
  return `<tr><td style="padding:22px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="1" style="background-color:#E4DED2;font-size:0;line-height:0;">&nbsp;</td></tr></table>
    <p style="margin:16px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">${chiusura}</p>
    <p style="margin:16px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:24px;color:#2A2E2B;">
      ${(firma || 'La Réception').replace('La Reception','La Réception')}
    </p>
    <p style="margin:12px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:23px;color:#55524B;">
      +39 049 9939 200 &nbsp;&middot;&nbsp; info@termeleonardo.com
    </p>
  </td></tr>

  <tr><td align="center" style="padding:20px 36px 0 36px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="padding:9px 16px;background-color:#F1F4EA;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#5F6B44;">${typeof bloccoCertificazioni === 'function' ? bloccoCertificazioni() : ''}
        <strong style="color:#4A5636;">Premier h&ocirc;tel thermal d&rsquo;Europe</strong> certifi&eacute; <strong style="color:#4A5636;">GSTC Hotel Standard</strong> pour la durabilit&eacute;
      </td>
    </tr></table>
  </td></tr>

  <tr><td align="center" style="padding:20px 36px 26px 36px;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:15px;letter-spacing:5px;color:#2A2E2B;">TERME LEONARDO</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:20px;color:#8C8578;padding-top:10px;">
      Via Monteortone, 46 &middot; 35037 Monteortone di Abano Terme (PD), Italie &middot; <a href="https://www.hoteltermeleonardo.com" target="_blank" style="color:#8C8578;text-decoration:underline;">hoteltermeleonardo.com</a>
    </div>
  </td></tr>

</table>
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
  <tr><td align="center" style="padding:14px 36px 0 36px;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:17px;color:#A79E8F;">
    Tria S.r.l. &middot; TVA IT 02042330288 &middot; CIN IT028089A18QYO48ED
  </td></tr>
</table>
</td></tr>
</table>`;
}

/* ---------------- OFFERTA FR ---------------- */
function costruisciEmailFR(d, opzioni) {
  const o = opzioni || {};
  const arrivee = dateFR(d.giornoArrivo, d.mese, d.anno);
  const depart  = dateFR(d.giornoPartenza, d.mesePartenza || d.mese, d.annoPartenza || d.anno);
  const limite  = echeanceFR(d.scadenza);
  const nuits   = d.notti === 1 ? '1 nuit' : `${d.notti} nuits`;
  const hotes   = hotesFR(d.adulti, d.bambini);
  const arrhPP  = Math.round(d.acconto / d.adulti);
  const lien    = (d.linkPagamento || '').replace('/it/deposit-payment', '/fr/deposit-payment');

  const extra = [];
  if (o.cure) extra.push(`
  <tr><td style="padding:22px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#E3F0F1;">
      <tr><td style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:23px;color:#3C6266;">
        <strong style="color:#0F5C64;font-size:15px;">Les cures thermales</strong><br />
        Les applications de boue se font le matin, en six créneaux entre 5h50 et 10h30. Comptez environ une heure entre
        la boue, le bain thermal et le repos en piscine. Une visite médicale d'admission est obligatoire avant le début
        de la cure, généralement le dimanche après-midi.
      </td></tr>
    </table>
  </td></tr>`);
  if (o.cane) extra.push(`
  <tr><td style="padding:16px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F1E9;">
      <tr><td style="padding:14px 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        &#128054; <strong style="color:#2A2E2B;">Votre chien est le bienvenu lui aussi</strong> &middot; 13 &euro; par jour, &agrave; r&eacute;gler &agrave; l&rsquo;h&ocirc;tel ; la nourriture n&rsquo;est pas comprise.
        Il est &agrave; son aise en chambre, dans le hall et au Bistrot La Piazza &mdash; en laisse dans les espaces communs. Il n&rsquo;a pas acc&egrave;s aux piscines, au parc ni au restaurant.
      </td></tr>
    </table>
  </td></tr>`);
  if (o.fedelta) extra.push(`
  <tr><td style="padding:20px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F1F4EA;">
      <tr><td width="6" style="background-color:#7A8450;font-size:0;line-height:0;">&nbsp;</td>
      <td style="padding:16px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Merci de nous être fidèle</strong><br />
        Nous avons appliqué une <strong style="color:#2A2E2B;">remise fidélité de 5 %</strong> sur la part pension,
        réservée aux clients séjournant chez nous depuis au moins cinq fois.
      </td></tr>
    </table>
  </td></tr>`);
  if (o.promo) extra.push(`
  <tr><td style="padding:20px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FDF3E7;">
      <tr><td width="6" style="background-color:#E8751A;font-size:0;line-height:0;">&nbsp;</td>
      <td style="padding:16px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Tarif spécial paiement anticipé</strong><br />
        Cette proposition comprend une <strong style="color:#2A2E2B;">remise de 3 % sur la part pension</strong>, réservée
        aux clients qui réservent et règlent pendant notre fermeture hivernale. Le tarif s'applique par
        <strong style="color:#2A2E2B;">virement avant l'arrivée</strong> ou paiement en espèces à l'hôtel.
        La remise ne s'applique ni aux cures, ni aux soins, ni aux extras.
      </td></tr>
    </table>
  </td></tr>`);

  return APRI + intestazioneEN('OFFRE N°', d.numeroOfferta) + `
  <tr><td style="padding:16px 36px 0 36px;">
    <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#2A2E2B;">${politesseFR(d.intestatario, o.genere, o.titolo)},</p>
    <h1 style="margin:0 0 10px 0;font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:31px;font-weight:normal;color:#2A2E2B;">
      ${d.alternative ? altT('fr').h1(d.camere.length) : `${d.camere.length > 1 ? 'Vos chambres vous attendent' : 'Votre chambre vous attend'}${periodiDiversi(d) ? '' : `<br />du ${arrivee} au ${depart}`}`}
    </h1>
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
      ${d.alternative ? altT('fr').intro(d.camere.length, limite) : (d.cambioCamera ? altT('fr').cambio(hotes, limite) : `${periodiDiversi(d) ? `${hotes} en ${d.camere.length} chambres, avec des périodes différentes : vous les trouverez ci-dessous, à côté de chaque chambre. Nous vous les réservons jusqu'au <strong style="color:#2A2E2B;">${limite}</strong>.` : `${nuits} pour ${hotes}${d.camere.length > 1 ? ` en ${d.camere.length} chambres` : ''}. Nous vous la réservons jusqu'au <strong style="color:#2A2E2B;">${limite}</strong>.`}`)}
    </p>
  </td></tr>

  <tr><td style="padding:16px 36px 0 36px;">${chambresFR(ordinaCamere(d.camere), d)}${dettaglioSoggiorno(o.dettaglio, 'Le déroulé de votre séjour')}</td></tr>

  <tr><td style="padding:14px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#E3F0F1;">
      <tr>
        <td width="6" style="background-color:#1E7F88;font-size:0;line-height:0;">&nbsp;</td>
        <td style="padding:22px 24px 22px 22px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#1E7F88;padding-bottom:6px;">Total du séjour</div>
          ${d.alternative ? '' : `<div style="font-family:Georgia,'Times New Roman',serif;font-size:38px;line-height:44px;color:#0F5C64;">${argentFR(d.totale)}</div>`}
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;color:#4A6E72;padding-top:4px;">
            ${d.alternative ? altT('fr').coda : `pour ${hotes}${periodiDiversi(d) ? '' : `, ${nuits}`} &middot; taxe de séjour non comprise`}
          </div>
${d.linkPagamento ? `          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;"><tr>
            <td align="center" bgcolor="#E8751A" style="border-radius:4px;">
              <a href="${lien}" style="display:inline-block;padding:11px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#FFFFFF;text-decoration:none;line-height:18px;"><span style="color:#FFFFFF;text-decoration:none;">Je confirme</span></a>
            </td>
          </tr></table>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#5C7F83;padding-top:12px;">
            Par carte en trente secondes. Vous préférez le virement ? Nos coordonnées sont ci-dessous.
          </div>` : ``}
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:22px 36px 0 36px;">
    <h2 style="margin:0 0 8px 0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:24px;font-weight:normal;color:#2A2E2B;">Comment confirmer</h2>
    <p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
      ${d.alternative ? 'L&rsquo;acompte d&eacute;pend de la solution retenue : vous le trouvez ci-dessus &agrave; c&ocirc;t&eacute; de chacune.' : `Des arrhes de <strong style="color:#2A2E2B;">${argentFR(d.acconto)}</strong> (${arrhPP} € par personne) suffisent.`}
      <strong style="color:#2A2E2B;">Elles sont déduites du total</strong>${d.alternative ? '.' : `: au départ, il vous restera ${argentFR(d.saldo)}.`}
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-left:2px solid #C8BFAE;"><tr><td style="padding:2px 0 2px 16px;">
${d.linkPagamento ? `      <p style="margin:0 0 9px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Par carte</strong>: via le bouton ci-dessus. La confirmation est immédiate.
      </p>` : ``}
      <p style="margin:0 0 9px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Par virement</strong>: choisissez de préférence le <strong style="color:#2A2E2B;">virement instantané</strong>
        plutôt que le virement classique : il arrive en quelques secondes et nous vous confirmons la chambre le jour même.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 12px 0;background-color:#F4F1E9;"><tr>
        <td style="padding:12px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;color:#55524B;">
          <span style="color:#8C8578;">Bénéficiaire</span> Tria S.r.l. &ndash; Hotel Leonardo Terme<br />
          <span style="color:#8C8578;">Banque</span> Intesa Sanpaolo<br />
          <span style="color:#8C8578;">IBAN</span> <strong style="color:#2A2E2B;">IT11C0306962321100000006041</strong><br />
          <span style="color:#8C8578;">BIC</span> BCITITMM<br />
          <span style="color:#8C8578;">Motif</span> ${d.numeroOfferta}
        </td>
      </tr></table>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Avant le ${limite}</strong>: passé cette date, la chambre est remise en vente.
      </p>
    </td></tr></table>
  </td></tr>

  <tr><td style="padding:20px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F1E9;"><tr><td style="padding:16px 20px;">
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#8C8578;padding-bottom:10px;">En cas de changement</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;color:#55524B;">
                <tr><td valign="top" width="14" style="padding:0 8px 8px 0;color:#B0A897;">&bull;</td><td valign="top" style="padding:0 0 8px 0;">Les <strong style="color:#2A2E2B;">arrhes</strong> sont conservées en cas d'annulation.</td></tr>
        <tr><td valign="top" style="padding:0 8px 8px 0;color:#B0A897;">&bull;</td><td valign="top" style="padding:0 0 8px 0;">En cas d'annulation <strong style="color:#2A2E2B;">jusqu'à 7 jours avant l'arrivée</strong>, seules les arrhes sont conservées ; au-delà, 100 % des prestations réservées sont facturées.</td></tr>
        <tr><td valign="top" style="padding:0 8px 8px 0;color:#B0A897;">&bull;</td><td valign="top" style="padding:0 0 8px 0;">Pour les réservations avec <strong style="color:#2A2E2B;">numéro de chambre fixe</strong> : 70 % à partir de 30 jours avant l'arrivée, 100 % à partir de 7 jours.</td></tr>
        <tr><td valign="top" style="padding:0 8px 8px 0;color:#B0A897;">&bull;</td><td valign="top" style="padding:0 0 8px 0;">En cas de <strong style="color:#2A2E2B;">départ anticipé</strong>, 100 % des prestations réservées sont facturées. Arrivée tardive ou départ anticipé : les nuitées non utilisées sont également facturées.</td></tr>
        <tr><td valign="top" style="padding:0 8px 0 0;color:#B0A897;">&bull;</td><td valign="top" style="padding:0;">Les annulations ne sont valables que <strong style="color:#2A2E2B;">par écrit</strong> : un e-mail à info@termeleonardo.com suffit.</td></tr>
      </table>
      <p style="margin:14px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#8C8578;">
        Le versement des arrhes vaut acceptation de ces conditions. S'agissant d'un hébergement à date déterminée, le droit de rétractation ne s'applique pas.
      </p>
    </td></tr></table>
  </td></tr>

${compresoFR(d)}

  <tr><td style="padding:22px 36px 0 36px;">
    <h2 style="margin:0 0 6px 0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:24px;font-weight:normal;color:#2A2E2B;">Souhaitez-vous ajouter quelque chose ?</h2>
    <p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#7B756A;">Répondez simplement à cet e-mail.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="padding:12px 16px;background-color:#FAF8F4;border-left:3px solid #7A8450;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Transfert depuis l'a&eacute;roport</strong> &middot; Venise, navette partag&eacute;e &agrave; partir de 65 €<br /><span style="color:#7B756A;font-size:13px;">&Agrave; r&eacute;server au moins 24 heures &agrave; l'avance. Indiquez-nous votre vol et l'horaire</span>${bottoneServizio('transfer', d, 'fr')}
      </td></tr>
      <tr><td height="8" style="font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:12px 16px;background-color:#FAF8F4;border-left:3px solid #7A8450;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Massage anti-stress</strong> &middot; 55 € (45 minutes)<br /><span style="color:#7B756A;font-size:13px;">Le plus demand&eacute;. Les cr&eacute;neaux partent vite</span><br /><a href="https://www.termeleonardo.com/pdf/listino-spa-trattamenti-e-massaggi-hotel-leonardo-da-vinci-terme.pdf" target="_blank" style="color:#0F5C64;font-size:13px;text-decoration:underline;">T&eacute;l&eacute;charger la liste compl&egrave;te des soins et massages (PDF, en italien)</a>${bottoneServizio('trattamenti', d, 'fr')}
      </td></tr>
      <tr><td height="8" style="font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:12px 16px;background-color:#FAF8F4;border-left:3px solid #7A8450;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Golf &agrave; l'h&ocirc;tel</strong> &middot; practice 6 € pour nos h&ocirc;tes<br /><span style="color:#7B756A;font-size:13px;">Practice de 15 000 m&sup2; avec 10 postes &agrave; c&ocirc;t&eacute; des piscines thermales : putting green, pitching green, bunker. Green fees r&eacute;duits aux golfs de Montecchia, Padova et Frassanelle (&agrave; quelques minutes), le&ccedil;ons avec notre pro sur demande</span>
      </td></tr>
      <tr><td height="8" style="font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:12px 16px;background-color:#FAF8F4;border-left:3px solid #7A8450;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Profitez des thermes jusqu&apos;au bout</strong> &middot; piscines le jour du d&eacute;part, jusqu&apos;&agrave; 18h30 &middot; <span style="color:#7B756A;font-size:13px;">30 € par personne, tarif r&eacute;serv&eacute; &agrave; nos h&ocirc;tes. Vestiaires inclus</span>
      </td></tr>
    </table>
  </td></tr>
${extra.join('')}
${sapereFR()}
` + piedeFR(o.firma, 'Pour toute question, répondez à cet e-mail ou appelez-nous : nous sommes là tous les jours.');
}

function objetFR(d) {
  return `Votre séjour du ${dateFR(d.giornoArrivo, d.mese, d.anno)} — Hotel Terme Leonardo`;
}

/* ---------------- CONFERMA FR ---------------- */
function costruisciConfermaFR(d, opzioni) {
  const o = opzioni || {};
  const arrivee = dateFR(d.giornoArrivo, d.mese, d.anno);
  const depart  = dateFR(d.giornoPartenza, d.mesePartenza || d.mese, d.annoPartenza || d.anno);
  const nuits   = d.notti === 1 ? '1 nuit' : `${d.notti} nuits`;
  const hotes   = hotesFR(d.adulti, d.bambini);
  const annunciato = !!(o && o.accontoAnnunciato);
  const verse   = annunciato ? (d.caparraDovuta || d.acconto || 0) : (d.caparraVersata || 0);
  const soldeReel = (d.totale || 0) - verse;
  const credit  = soldeReel < -0.005 ? -soldeReel : 0;   // v1.6
  const solde   = Math.max(soldeReel, 0);

  const extra = [];
  if (o.cure) extra.push(`
  <tr><td style="padding:20px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#E3F0F1;">
      <tr><td style="padding:16px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:23px;color:#3C6266;">
        <strong style="color:#0F5C64;">Votre cure thermale</strong><br />
        Le jour de votre arrivée, nous vous attendons pour la visite médicale d'admission, obligatoire avant le début de la cure.
        Pensez à apporter l'ordonnance de votre médecin et vos éventuels documents médicaux. Les applications de boue ont lieu
        le matin ; notre secrétariat des cures vous confirmera l'horaire.
      </td></tr>
    </table>
  </td></tr>`);
  if (o.cane) extra.push(`
  <tr><td style="padding:16px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F1E9;">
      <tr><td style="padding:14px 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        &#128054; <strong style="color:#2A2E2B;">Votre chien est le bienvenu lui aussi</strong> &middot; 13 &euro; par jour, &agrave; r&eacute;gler &agrave; l&rsquo;h&ocirc;tel ; la nourriture n&rsquo;est pas comprise.
        Il est &agrave; son aise en chambre, dans le hall et au Bistrot La Piazza &mdash; en laisse dans les espaces communs. Il n&rsquo;a pas acc&egrave;s aux piscines, au parc ni au restaurant.
      </td></tr>
    </table>
  </td></tr>`);

  return APRI + intestazioneEN('RÉSERVATION N°', numeroConferma(d.numeroOfferta)) + `
  <tr><td style="padding:16px 36px 0 36px;">
    <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#2A2E2B;">${politesseFR(d.intestatario, o.genere, o.titolo)},</p>
    <h1 style="margin:0 0 10px 0;font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:31px;font-weight:normal;color:#2A2E2B;">
      Tout est confirmé.<br />Nous vous attendons le ${arrivee}
    </h1>
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
      ${annunciato ? 'Nous avons bien reçu la copie de votre virement' : 'Nous avons bien reçu vos arrhes'} et ${d.camere.length > 1 ? 'vos chambres sont r\u00e9serv\u00e9es' : 'votre chambre est r\u00e9serv\u00e9e'}. Réservation <strong style="color:#2A2E2B;">${numeroConferma(d.numeroOfferta)}</strong>.
    </p>
  </td></tr>

  <tr><td style="padding:18px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FAF8F4;">
      <tr><td style="padding:16px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
          <tr><td width="120" style="padding:0 10px 7px 0;color:#8C8578;">Arrivée</td><td style="padding:0 0 7px 0;"><strong style="color:#2A2E2B;">${arrivee}</strong>, à partir de 15h00</td></tr>
          <tr><td style="padding:0 10px 7px 0;color:#8C8578;">Départ</td><td style="padding:0 0 7px 0;"><strong style="color:#2A2E2B;">${depart}</strong>, avant 11h00</td></tr>
          <tr><td style="padding:0 10px 12px 0;color:#8C8578;">Séjour</td><td style="padding:0 0 12px 0;">${periodiDiversi(d) ? `${hotes} en ${d.camere.length} chambres &middot; périodes indiquées à côté de chaque chambre` : (soggiorniMisti(d) ? `${hotes} &middot; p&eacute;riodes indiqu&eacute;es pour chaque personne` : `${nuits} pour ${hotes}`)}</td></tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${camereConferma(ordinaCamere(d.camere), 'fr', d)}</table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
          <tr><td width="150" style="padding:6px 10px 5px 0;color:#8C8578;">Total</td><td style="padding:6px 0 5px 0;">${argentFR(d.totale)}</td></tr>
          <tr><td style="padding:0 10px 5px 0;color:#8C8578;">${annunciato ? 'Acompte &middot; virement annoncé' : 'Arrhes reçues'}</td><td style="padding:0 0 5px 0;">&minus; ${argentFR(verse)}</td></tr>
          <tr><td style="padding:0 10px 0 0;color:#8C8578;">Solde à l'arrivée</td><td style="padding:0;"><strong style="color:#0F5C64;font-size:16px;">${argentFR(solde)}</strong></td></tr>
          ${credit > 0 ? `<tr><td colspan="2" style="padding:6px 0 0 0;font-size:13px;color:#55524B;">Votre acompte d&eacute;passe le total de <strong>${argentFR(credit)}</strong> : nous r&eacute;glerons la diff&eacute;rence &agrave; votre arriv&eacute;e.</td></tr>` : ''}
        </table>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#A79E8F;padding-top:8px;">
          Plus la taxe de séjour : 1,50 € par personne et par nuit, 7 nuits maximum, à régler à l'hôtel.
        </div>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:20px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#E3F0F1;">
      <tr><td width="6" style="background-color:#1E7F88;font-size:0;line-height:0;">&nbsp;</td>
      <td style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:23px;color:#3C6266;">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:24px;color:#0F5C64;padding-bottom:8px;">Faites le check-in en ligne</div>
        Vous recevrez sous peu un e-mail avec le lien. Le remplir avant votre arrivée vous fait gagner une demi-journée :
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:9px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#3C6266;">
          <tr><td valign="top" width="16" style="padding:0 6px 5px 0;color:#1E7F88;">&#10003;</td><td style="padding:0 0 5px 0;">Piscines thermales dès <strong style="color:#0F5C64;">11h30</strong>, sans attendre 15h00</td></tr>
          <tr><td valign="top" style="padding:0 6px 5px 0;color:#1E7F88;">&#10003;</td><td style="padding:0 0 5px 0;">Chambre remise immédiatement, si elle est prête</td></tr>
          <tr><td valign="top" style="padding:0 6px 0 0;color:#1E7F88;">&#10003;</td><td style="padding:0;">Aucune attente à la réception</td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:22px 36px 0 36px;">
    <h2 style="margin:0 0 6px 0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:24px;font-weight:normal;color:#2A2E2B;">Préparons votre arrivée</h2>
    ${d.linkArrivo ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px 0;"><tr><td align="center" bgcolor="#1E7F88" style="border-radius:5px;"><a href="${d.linkArrivo}" style="display:inline-block;padding:11px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#FFFFFF;text-decoration:none;font-weight:bold;">Préparer votre arrivée</a></td></tr></table><p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#7B756A;">Deux minutes depuis votre téléphone : heure d&apos;arrivée, facture, transfert. Vous préférez écrire ? Répondez simplement à cet e-mail.</p>` : `<p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#7B756A;">Répondez à cet e-mail : nous nous en occupons avant votre venue.</p>`}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="padding:12px 16px;background-color:#FAF8F4;border-left:3px solid #7A8450;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">À quelle heure pensez-vous arriver ?</strong><br /><span style="color:#7B756A;font-size:13px;">Pour vous accueillir sans attente. Et si vous arrivez après 22h00, merci de nous prévenir à l'avance : nous nous organisons pour vous recevoir même tard</span>
      </td></tr>
      <tr><td height="8" style="font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:12px 16px;background-color:#FAF8F4;border-left:3px solid #7A8450;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Transfert depuis l'aéroport</strong> &middot; Venise, navette partagée à partir de 65 €<br /><span style="color:#7B756A;font-size:13px;">Indiquez-nous le numéro de vol et l'horaire. À réserver au moins 24 heures à l'avance</span>${bottoneServizio('transfer', d, 'fr')}
      </td></tr>
      <tr><td height="8" style="font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:12px 16px;background-color:#FAF8F4;border-left:3px solid #7A8450;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Massage antistress</strong> &middot; 55 € (45 minutes)<br /><span style="color:#7B756A;font-size:13px;">Le plus demandé. Les créneaux partent vite : mieux vaut réserver dès maintenant</span><br /><a href="https://www.termeleonardo.com/pdf/listino-spa-trattamenti-e-massaggi-hotel-leonardo-da-vinci-terme.pdf" target="_blank" style="color:#0F5C64;font-size:13px;text-decoration:underline;">T&eacute;l&eacute;charger la liste compl&egrave;te des soins et massages (PDF, en italien)</a>${bottoneServizio('trattamenti', d, 'fr')}
      </td></tr>
      <tr><td height="8" style="font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:12px 16px;background-color:#FAF8F4;border-left:3px solid #7A8450;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Early Bird Swimming</strong> &middot; 20 € par personne<br /><span style="color:#7B756A;font-size:13px;">Piscines dès 9h00 le jour de l'arrivée. À demander maintenant, pas sur place</span>
      </td></tr>${rigaPrepara('Un bon cadeau', 'thermes et soins pour la personne de votre choix', 'Nous le pr&eacute;parons avec votre message et vous l&rsquo;envoyons par email, pr&ecirc;t &agrave; offrir', bottoneServizio('buoni', d, 'fr'))}${rigaGolf(d, 'fr')}${rigaFanghi(d, o, 'fr')}
    </table>
  </td></tr>
${extra.join('')}
  <tr><td style="padding:22px 36px 0 36px;">
    <h2 style="margin:0 0 10px 0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:24px;font-weight:normal;color:#2A2E2B;">Bon à savoir</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
      <tr><td width="140" valign="top" style="padding:0 12px 9px 0;color:#8C8578;">Piscines</td><td valign="top" style="padding:0 0 9px 0;">Ouvertes de 8h &agrave; 19h30, jusqu'&agrave; 22h30 les vendredis et samedis &middot; bonnet de bain obligatoire, en vente à la réception à 3 €</td></tr>
      <tr><td valign="top" style="padding:8px 12px 0 0;color:#8C8578;">Tabac</td><td valign="top" style="padding:8px 0 0 0;">Hôtel non-fumeurs : pas en chambre, sur le balcon oui</td></tr>
      <tr><td valign="top" style="padding:0 12px 9px 0;color:#8C8578;">Dîner</td><td valign="top" style="padding:0 0 9px 0;">À partir de 19h30, dernière entrée à 20h20. Si vous arrivez plus tard, dites-le nous : nous vous laissons une assiette en chambre</td></tr>
      <tr><td valign="top" style="padding:0 12px 9px 0;color:#8C8578;">Déjeuner</td><td valign="top" style="padding:0 0 9px 0;">Au Bistrot La Piazza, en peignoir si vous le souhaitez : ouvert de 10h00 à 23h00, déjeuner de 12h30 à 14h30, en-cas jusqu&rsquo;à 17h30</td></tr>
      <tr><td valign="top" style="padding:0 12px 9px 0;color:#8C8578;">Jour du départ</td><td valign="top" style="padding:0 0 9px 0;">Piscines comprises jusqu'à 11h00. Prolongation possible jusqu'à 18h30 pour 30 € par personne — signalez-le au départ</td></tr>
      <tr><td valign="top" style="padding:0 12px 0 0;color:#8C8578;">Voiture électrique</td><td valign="top" style="padding:0;">Huit bornes de 11 kW, à gérer via l'application <em>Next charge</em> ou <em>My wallbox</em> : merci d'apporter votre câble</td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:20px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F1E9;"><tr><td style="padding:14px 18px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;color:#8C8578;">
      En cas de changement de programme : les arrhes sont conservées en cas d'annulation.
      En cas d'annulation jusqu'à 7 jours avant l'arrivée seules les arrhes sont conservées, ensuite 100 % des prestations ; avec numéro de chambre fixe, 70 % à partir de 30 jours et 100 % à partir de 7 jours.
      En cas de départ anticipé ou d'arrivée tardive, les nuitées non utilisées sont également facturées. Annulations par écrit uniquement, à info@termeleonardo.com.
    </td></tr></table>
  </td></tr>
` + piedeFR(o.firma, 'Pour tout, avant ou pendant votre séjour, écrivez-nous ou appelez-nous : nous sommes là tous les jours.');
}

function objetConfirmFR(d) {
  return `Réservation ${numeroConferma(d.numeroOfferta)} confirmée — à bientôt le ${dateFR(d.giornoArrivo, d.mese, d.anno)}`;
}

/* estratto dall'offerta perche' serve identico anche nel preventivo:
   un solo testo, un solo posto dove correggerlo */
function compresoFR(d) {
  return `  <tr><td style="padding:22px 36px 0 36px;">
    <h2 style="margin:0 0 12px 0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:24px;font-weight:normal;color:#2A2E2B;">Compris dans le tarif</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
      <tr><td width="30" valign="top" style="padding:0 6px 12px 0;font-size:17px;line-height:22px;">&#9832;</td>
          <td valign="top" style="padding:0 0 12px 0;"><strong style="color:#2A2E2B;">Espace thermal</strong><br />Les trois bassins thermaux, intérieur et extérieur, reliés entre eux &middot; un bassin d'eau thermale fraîche &middot; grottes avec bio-sauna et bain turc &middot; espace détente réservé aux adultes</td></tr>
      <tr><td valign="top" style="padding:0 6px 12px 0;font-size:17px;line-height:22px;">&#9749;</td>
          <td valign="top" style="padding:0 0 12px 0;"><strong style="color:#2A2E2B;">À table</strong><br />${rigaATavola(d, 'fr')}</td></tr>
      <tr><td valign="top" style="padding:0 6px 12px 0;font-size:17px;line-height:22px;">&#128716;</td>
          <td valign="top" style="padding:0 0 12px 0;"><strong style="color:#2A2E2B;">En chambre</strong><br />Peignoir et serviette par personne &middot; Wi-Fi fibre &middot; balcon</td></tr>
      <tr><td valign="top" style="padding:0 6px 0 0;font-size:17px;line-height:22px;">&#127939;</td>
          <td valign="top" style="padding:0;"><strong style="color:#2A2E2B;">Activités</strong><br />Salle de sport &middot; parc avec vue sur les collines &middot; parking gratuit &middot; green fee réduit</td></tr>
    </table>
    <p style="margin:14px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#8C8578;">
      Non compris : déjeuner au Bistrot, boissons, soins bien-être, cures thermales et transferts.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;background-color:#E3F0F1;">
      <tr><td width="6" style="background-color:#1E7F88;font-size:0;line-height:0;">&nbsp;</td>
      <td style="padding:14px 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:23px;color:#3C6266;">
        <strong style="color:#0F5C64;">Faites le check-in en ligne avant votre arrivée.</strong>
        Les piscines sont à vous dès <strong style="color:#0F5C64;">11h30</strong>, sans attendre 15h00, l'heure officielle d'accès à la chambre.
      </td></tr>
    </table>
  </td></tr>`;
}

/* estratto dall'offerta perche' serve identico anche nel preventivo:
   un solo testo, un solo posto dove correggerlo */
function sapereFR() {
  return `  <tr><td style="padding:22px 36px 0 36px;">
    <h2 style="margin:0 0 10px 0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:24px;font-weight:normal;color:#2A2E2B;">Bon à savoir</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
      <tr><td width="140" valign="top" style="padding:0 12px 10px 0;color:#8C8578;">Arrivée</td><td valign="top" style="padding:0 0 10px 0;">À partir de 15h00 &middot; départ avant 11h00</td></tr>
      <tr><td valign="top" style="padding:0 12px 10px 0;color:#8C8578;">Taxe de séjour</td><td valign="top" style="padding:0 0 10px 0;">1,50 € par personne et par nuit, 7 nuits maximum, à régler à l'hôtel. Exonérés : les enfants jusqu'à 13 ans et les personnes en situation de handicap</td></tr>
      <tr><td valign="top" style="padding:0 12px 10px 0;color:#8C8578;">D&eacute;jeuner</td><td valign="top" style="padding:0 0 10px 0;">Au Bistrot La Piazza au bord de la piscine, peignoir bienvenu&nbsp;: tous les jours de 10h00 &agrave; 23h00, &agrave; la carte &middot; d&eacute;jeuner de 12h30 &agrave; 14h30, en-cas jusqu&rsquo;&agrave; 17h30</td></tr>
      <tr><td valign="top" style="padding:0 12px 0 0;color:#8C8578;">Piscines</td><td valign="top" style="padding:0;">Ouvertes de 8h &agrave; 19h30, jusqu'&agrave; 22h30 les vendredis et samedis &middot; bonnet de bain obligatoire, en vente à la réception à 3 €</td></tr>
      <tr><td valign="top" style="padding:8px 12px 0 0;color:#8C8578;">Tabac</td><td valign="top" style="padding:8px 0 0 0;">Hôtel non-fumeurs : pas en chambre, sur le balcon oui</td></tr>
    </table>
  </td></tr>`;
}
