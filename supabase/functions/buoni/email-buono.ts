/* ============================================================
   email-buono.ts — il buono via email, lato server.
   Stessa identità del back office: due colonne, verde acqua e oro,
   tabelle HTML perché Outlook non regge i layout moderni.
   ============================================================ */

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const eur = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 });

const ETI: Record<string, any> = {
  it: { titolo: 'Buono Regalo', haRicevuto: (n: string) => `${n}, hai ricevuto<br />un dono speciale`,
    senzaNome: 'Un dono speciale<br />per te', da: 'CON AFFETTO, DA', codice: 'CODICE BUONO',
    valido: (d: string) => `Valido fino al ${d}`,
    oggetto: 'Il suo Buono Regalo — Hotel Terme Leonardo',
    oggettoAcq: (rif: string) => `Buono regalo ${rif} emesso — Hotel Terme Leonardo`,
    caro: (n: string) => `Gentile ${n || 'Cliente'},`,
    corpoAcq: 'grazie del suo acquisto: il pagamento è stato ricevuto e il buono è stato emesso. Lo trova qui sotto, pronto da stampare o da inoltrare a chi lo riceverà.',
    corpoDest: 'qualcuno ha pensato a lei: ecco il suo buono regalo per l’Hotel Terme Leonardo. Per usarlo basta chiamarci o scriverci indicando il codice.',
    saluto: 'Un cordiale saluto,<br />Hotel Terme Leonardo' },
  de: { titolo: 'Geschenkgutschein', haRicevuto: (n: string) => `${n}, Sie haben<br />ein besonderes Geschenk erhalten`,
    senzaNome: 'Ein besonderes<br />Geschenk für Sie', da: 'HERZLICHST, VON', codice: 'GUTSCHEINCODE',
    valido: (d: string) => `Gültig bis ${d}`,
    oggetto: 'Ihr Geschenkgutschein — Hotel Terme Leonardo',
    oggettoAcq: (rif: string) => `Geschenkgutschein ${rif} ausgestellt — Hotel Terme Leonardo`,
    caro: (n: string) => `Sehr geehrte(r) ${n || 'Kundin/Kunde'},`,
    corpoAcq: 'vielen Dank für Ihren Einkauf: die Zahlung ist eingegangen und der Gutschein wurde ausgestellt. Sie finden ihn unten — zum Ausdrucken oder Weiterleiten.',
    corpoDest: 'jemand hat an Sie gedacht: hier ist Ihr Geschenkgutschein für das Hotel Terme Leonardo. Zur Einlösung genügt ein Anruf oder eine E-Mail mit dem Code.',
    saluto: 'Mit freundlichen Grüßen,<br />Hotel Terme Leonardo' },
  en: { titolo: 'Gift Voucher', haRicevuto: (n: string) => `${n}, you have received<br />a special gift`,
    senzaNome: 'A special gift<br />for you', da: 'WITH LOVE, FROM', codice: 'VOUCHER CODE',
    valido: (d: string) => `Valid until ${d}`,
    oggetto: 'Your Gift Voucher — Hotel Terme Leonardo',
    oggettoAcq: (rif: string) => `Gift voucher ${rif} issued — Hotel Terme Leonardo`,
    caro: (n: string) => `Dear ${n || 'Guest'},`,
    corpoAcq: 'thank you for your purchase: the payment has been received and the voucher has been issued. You will find it below, ready to print or forward.',
    corpoDest: 'someone was thinking of you: here is your gift voucher for Hotel Terme Leonardo. To use it, just call or write to us with the code.',
    saluto: 'Kind regards,<br />Hotel Terme Leonardo' },
  fr: { titolo: 'Bon Cadeau', haRicevuto: (n: string) => `${n}, vous avez reçu<br />un cadeau très spécial`,
    senzaNome: 'Un cadeau spécial<br />pour vous', da: 'AVEC AFFECTION, DE', codice: 'CODE DU BON',
    valido: (d: string) => `Valable jusqu'au ${d}`,
    oggetto: 'Votre Bon Cadeau — Hôtel Terme Leonardo',
    oggettoAcq: (rif: string) => `Bon cadeau ${rif} émis — Hôtel Terme Leonardo`,
    caro: (n: string) => `Cher/Chère ${n || 'Client(e)'},`,
    corpoAcq: 'merci pour votre achat : le paiement a été reçu et le bon a été émis. Vous le trouverez ci-dessous, prêt à imprimer ou à transférer.',
    corpoDest: 'quelqu’un a pensé à vous : voici votre bon cadeau pour l’Hôtel Terme Leonardo. Pour l’utiliser, appelez-nous ou écrivez-nous avec le code.',
    saluto: 'Cordialement,<br />Hôtel Terme Leonardo' }
};

const MESI: Record<string, string[]> = {
  it: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
  de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
};
function dataLingua(iso: string, l: string) {
  if (!iso) return '';
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z');
  const m = (MESI[l] || MESI.it)[d.getUTCMonth()];
  return l === 'de' ? `${d.getUTCDate()}. ${m} ${d.getUTCFullYear()}`
    : `${d.getUTCDate()} ${m} ${d.getUTCFullYear()}`;
}

const CONDIZIONI: Record<string, string> = {
  it: 'Apertura stagionale: l’hotel chiude ogni anno da fine novembre a febbraio; il buono non è valido in questo periodo. È richiesta la maggiore età per l’accesso a piscine, hotel e spa; ingressi soggetti a disponibilità e prenotazione obbligatoria. Il buono non è utilizzabile nelle prime 48 ore dall’acquisto, non è rimborsabile né convertibile in denaro; gli importi residui dopo il primo utilizzo non sono trasferibili. Validità 12 mesi dalla data di acquisto.',
  de: 'Saisonale Öffnung: das Hotel schließt jedes Jahr von Ende November bis Februar; in diesem Zeitraum ist der Gutschein nicht gültig. Für den Zutritt zu Pools, Hotel und Spa ist Volljährigkeit erforderlich; Eintritte nach Verfügbarkeit, Reservierung erforderlich. Der Gutschein ist in den ersten 48 Stunden nach dem Kauf nicht einlösbar, nicht erstattungsfähig und nicht in Bargeld umtauschbar; Restbeträge nach der ersten Einlösung sind nicht übertragbar. Gültigkeit 12 Monate ab Kaufdatum.',
  en: 'Seasonal opening: the hotel closes every year from late November to February; the voucher is not valid in this period. Guests must be of legal age to access pools, hotel and spa; admission subject to availability, booking required. The voucher cannot be used within the first 48 hours of purchase, is not refundable and cannot be exchanged for cash; any remaining amount after the first use is not transferable. Valid for 12 months from the date of purchase.',
  fr: 'Ouverture saisonnière : l’hôtel ferme chaque année de fin novembre à février ; le bon n’est pas valable durant cette période. La majorité est requise pour accéder aux piscines, à l’hôtel et au spa ; entrées soumises à disponibilité et réservation obligatoire. Le bon n’est pas utilisable dans les 48 heures suivant l’achat, n’est ni remboursable ni convertible en espèces ; les montants restants après la première utilisation ne sont pas transférables. Validité 12 mois à compter de la date d’achat.'
};

/* il buono in HTML — versione email, autosufficiente */
export function buonoEmailHTML(b: any) {
  const L = ['it', 'de', 'en', 'fr'].includes(b.lingua) ? b.lingua : 'it';
  const e = ETI[L];
  const dest = b.destinatario ? esc(b.destinatario) : '';
  return `<table cellpadding="0" cellspacing="0" border="0" width="700" style="width:700px;max-width:100%;border-collapse:collapse;font-family:Georgia,'Times New Roman',serif;background:#FFFFFF;">
<tr>
  <td width="270" valign="top" style="width:270px;background:#E4F0EA;padding:34px 26px;">
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;letter-spacing:2px;color:#1B4D4A;">LE<strong>ONARDO</strong></div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:3px;color:#7A9490;margin-top:4px;">TERME HOTEL &nbsp;&#9733;&#9733;&#9733;&#9733;</div>
    <div style="height:150px;margin:26px 0 8px;border-radius:2px;background:linear-gradient(160deg,#BEDCD4,#8FC4BC 55%,#5FA8A0);"></div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:8.5px;letter-spacing:2px;color:#7A9490;padding-top:34px;">ABANO TERME &middot; COLLI EUGANEI</div>
  </td>
  <td valign="top" style="padding:34px 30px;">
    <div style="width:34px;height:2px;background:#C9A961;margin-bottom:14px;"></div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:9.5px;letter-spacing:3px;color:#C9A961;">${e.titolo.toUpperCase()}</div>
    <div style="font-size:25px;line-height:1.3;color:#1B4D4A;margin:12px 0 0;">${dest ? e.haRicevuto(dest) : e.senzaNome}</div>
    ${b.dedica ? `<div style="font-size:13.5px;font-style:italic;color:#5C736F;margin-top:14px;line-height:1.5;">${esc(b.dedica)}</div>` : ''}
    ${b.acquirente ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:2px;color:#9AA9A6;margin-top:20px;">${e.da}</div>
    <div style="font-size:15px;font-style:italic;color:#1B4D4A;margin-top:4px;">${esc(b.acquirente)}</div>` : ''}
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:26px;border-collapse:collapse;">
      <tr><td style="border-left:3px solid #C9A961;background:#FBFAF7;padding:18px 20px;">
        <div style="font-size:17px;color:#1B4D4A;">${esc(b.descrizione)}</div>
        ${b.sottotitolo ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:2px;color:#C9A961;margin-top:7px;">${esc(b.sottotitolo)}</div>` : ''}
      </td></tr>
    </table>
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:34px;border-top:1px solid #E6E2D8;border-collapse:collapse;">
      <tr>
        <td valign="top" style="padding-top:14px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:2px;color:#9AA9A6;">${e.codice}</div>
          <div style="font-family:'Courier New',monospace;font-size:17px;letter-spacing:2px;color:#1B4D4A;margin-top:6px;">${esc(b.codice)}</div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#C9A961;margin-top:6px;">${e.valido(dataLingua(b.scade_il, L))}</div>
        </td>
        <td valign="top" align="right" style="padding-top:14px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#5C736F;">
          <strong style="color:#1B4D4A;">+39 049 9939200</strong><br />info@termeleonardo.com<br />www.termeleonardo.com
        </td>
      </tr>
    </table>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:8px;line-height:1.55;color:#B3ADA1;padding-top:22px;">${esc(CONDIZIONI[L] || CONDIZIONI.it)}</div>
  </td>
</tr>
</table>`;
}

function avvolgi(caro: string, corpo: string, saluto: string, buono: string) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#2A2E2B;max-width:700px;">
  <p>${caro}</p><p>${corpo}</p></div>
  <div style="margin:22px 0;">${buono}</div>
  <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#2A2E2B;">
  <p>${saluto}<br /><span style="color:#7B756A;font-size:13px;">+39 049 9939200 &middot; info@termeleonardo.com</span></p></div>`;
}

async function invia(a: string, oggetto: string, html: string) {
  const chiave = Deno.env.get('RESEND_API_KEY');
  if (!chiave) { console.error('email non inviata: RESEND_API_KEY mancante ->', a, oggetto); return false; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${chiave}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('MITTENTE_EMAIL') || 'Hotel Terme Leonardo <onboarding@resend.dev>',
      to: [a], subject: oggetto, html
    })
  });
  if (!r.ok) console.error('Resend', r.status, await r.text());
  return r.ok;
}

/* da chiamare quando il buono passa a "pagato" (webhook E a=pagato) */
export async function inviaBuonoEmesso(b: any) {
  const L = ['it', 'de', 'en', 'fr'].includes(b.lingua) ? b.lingua : 'it';
  const e = ETI[L];
  const buono = buonoEmailHTML(b);
  const esiti: Record<string, boolean> = {};

  if (b.acquirente_email)
    esiti.acquirente = await invia(b.acquirente_email, e.oggettoAcq(b.numero),
      avvolgi(e.caro(esc(b.acquirente)), e.corpoAcq, e.saluto, buono));

  if (b.destinatario_email && b.destinatario_email !== b.acquirente_email)
    esiti.destinatario = await invia(b.destinatario_email, e.oggetto,
      avvolgi(e.caro(esc(b.destinatario)), e.corpoDest, e.saluto, buono));

  const amm = Deno.env.get('EMAIL_AMMINISTRAZIONE');
  if (amm)
    esiti.amministrazione = await invia(amm, `Buono ${b.numero} pagato — ${eur(b.valore)} € (${b.pagamento || ''})`,
      `<p style="font-family:Arial;font-size:14px;">Buono <strong>${esc(b.numero)}</strong> · codice <strong>${esc(b.codice)}</strong><br />
      ${esc(b.descrizione)} · ${eur(b.valore)} € · ${esc(b.pagamento || '')} ${esc(b.pagamento_rif || '')}<br />
      Acquirente: ${esc(b.acquirente || '')} &lt;${esc(b.acquirente_email || '')}&gt;<br />
      Origine: ${esc(b.creato_da || '')}</p>`);

  return esiti;
}
