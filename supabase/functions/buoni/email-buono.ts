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
    saluto: 'Un cordiale saluto,<br />Hotel Terme Leonardo',
    nota: 'Salvo diversa indicazione, ogni ingresso o trattamento vale per una persona. Ingressi e trattamenti su prenotazione: basta chiamarci o scriverci.' },
  de: { titolo: 'Geschenkgutschein', haRicevuto: (n: string) => `${n}, Sie haben<br />ein besonderes Geschenk erhalten`,
    senzaNome: 'Ein besonderes<br />Geschenk für Sie', da: 'HERZLICHST, VON', codice: 'GUTSCHEINCODE',
    valido: (d: string) => `Gültig bis ${d}`,
    oggetto: 'Ihr Geschenkgutschein — Hotel Terme Leonardo',
    oggettoAcq: (rif: string) => `Geschenkgutschein ${rif} ausgestellt — Hotel Terme Leonardo`,
    caro: (n: string) => `Sehr geehrte(r) ${n || 'Kundin/Kunde'},`,
    corpoAcq: 'vielen Dank für Ihren Einkauf: die Zahlung ist eingegangen und der Gutschein wurde ausgestellt. Sie finden ihn unten — zum Ausdrucken oder Weiterleiten.',
    corpoDest: 'jemand hat an Sie gedacht: hier ist Ihr Geschenkgutschein für das Hotel Terme Leonardo. Zur Einlösung genügt ein Anruf oder eine E-Mail mit dem Code.',
    saluto: 'Mit freundlichen Grüßen,<br />Hotel Terme Leonardo',
    nota: 'Sofern nicht anders angegeben, gilt jeder Eintritt bzw. jede Anwendung für eine Person. Eintritte und Anwendungen nur mit Reservierung: rufen Sie uns einfach an oder schreiben Sie uns.' },
  en: { titolo: 'Gift Voucher', haRicevuto: (n: string) => `${n}, you have received<br />a special gift`,
    senzaNome: 'A special gift<br />for you', da: 'WITH LOVE, FROM', codice: 'VOUCHER CODE',
    valido: (d: string) => `Valid until ${d}`,
    oggetto: 'Your Gift Voucher — Hotel Terme Leonardo',
    oggettoAcq: (rif: string) => `Gift voucher ${rif} issued — Hotel Terme Leonardo`,
    caro: (n: string) => `Dear ${n || 'Guest'},`,
    corpoAcq: 'thank you for your purchase: the payment has been received and the voucher has been issued. You will find it below, ready to print or forward.',
    corpoDest: 'someone was thinking of you: here is your gift voucher for Hotel Terme Leonardo. To use it, just call or write to us with the code.',
    saluto: 'Kind regards,<br />Hotel Terme Leonardo',
    nota: 'Unless stated otherwise, each entrance or treatment is for one person. Entrances and treatments require booking: just call or write to us.' },
  fr: { titolo: 'Bon Cadeau', haRicevuto: (n: string) => `${n}, vous avez reçu<br />un cadeau très spécial`,
    senzaNome: 'Un cadeau spécial<br />pour vous', da: 'AVEC AFFECTION, DE', codice: 'CODE DU BON',
    valido: (d: string) => `Valable jusqu'au ${d}`,
    oggetto: 'Votre Bon Cadeau — Hôtel Terme Leonardo',
    oggettoAcq: (rif: string) => `Bon cadeau ${rif} émis — Hôtel Terme Leonardo`,
    caro: (n: string) => `Cher/Chère ${n || 'Client(e)'},`,
    corpoAcq: 'merci pour votre achat : le paiement a été reçu et le bon a été émis. Vous le trouverez ci-dessous, prêt à imprimer ou à transférer.',
    corpoDest: 'quelqu’un a pensé à vous : voici votre bon cadeau pour l’Hôtel Terme Leonardo. Pour l’utiliser, appelez-nous ou écrivez-nous avec le code.',
    saluto: 'Cordialement,<br />Hôtel Terme Leonardo',
    nota: 'Sauf indication contraire, chaque entrée ou soin vaut pour une personne. Entrées et soins sur réservation : appelez-nous ou écrivez-nous.' }
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

/* ⚠ due copie per forza: qui e in pagine/buoni/buono.js, da cui le prendono
   il back office e la pagina pubblica di acquisto. Questa non puo' importare
   quella: l'email va costruita a tabelle per Outlook.
   È il testo che il cliente dichiara di accettare prima di pagare: deve
   restare parola per parola identico. Presidiato da buono.test.ts, che
   confronta le due copie in tutte e quattro le lingue. */
export const CONDIZIONI: Record<string, string> = {
  it: "Apertura stagionale: l’hotel chiude ogni anno da fine novembre a febbraio; il buono non è valido in questo periodo. È richiesta la maggiore età per l’accesso a piscine, hotel e spa; ingressi soggetti a disponibilità e prenotazione obbligatoria. Il buono non è utilizzabile nelle prime 48 ore dall’acquisto, non è rimborsabile né convertibile in denaro; gli importi residui dopo il primo utilizzo non sono trasferibili. In caso di cancellazione, modifica o mancata presentazione (no show) il buono non è rimborsabile. Validità un anno dalla data di emissione.",
  de: "Saisonale Öffnung: das Hotel schließt jedes Jahr von Ende November bis Februar; in diesem Zeitraum ist der Gutschein nicht gültig. Für den Zutritt zu Pools, Hotel und Spa ist Volljährigkeit erforderlich; Eintritte nach Verfügbarkeit, Reservierung erforderlich. Der Gutschein ist in den ersten 48 Stunden nach dem Kauf nicht einlösbar, nicht erstattungsfähig und nicht in Bargeld umtauschbar; Restbeträge nach der ersten Einlösung sind nicht übertragbar. Bei Stornierung, Änderung oder Nichterscheinen (No-Show) ist der Gutschein nicht erstattungsfähig. Gültigkeit ein Jahr ab Ausstellungsdatum.",
  en: "Seasonal opening: the hotel closes every year from late November to February; the voucher is not valid in this period. Guests must be of legal age to access pools, hotel and spa; admission subject to availability, booking required. The voucher cannot be used within the first 48 hours of purchase, is not refundable and cannot be exchanged for cash; any remaining amount after the first use is not transferable. In case of cancellation, modification or no-show, the voucher is not refundable. Valid for one year from the date of issue.",
  fr: "Ouverture saisonnière : l’hôtel ferme chaque année de fin novembre à février ; le bon n’est pas valable durant cette période. La majorité est requise pour accéder aux piscines, à l’hôtel et au spa ; entrées soumises à disponibilité et réservation obligatoire. Le bon n’est pas utilisable dans les 48 heures suivant l’achat, n’est ni remboursable ni convertible en espèces ; les montants restants après la première utilisation ne sont pas transférables. En cas d’annulation, de modification ou de non-présentation (no-show), le bon n’est pas remboursable. Validité un an à compter de la date d’émission."
};

/* come si prenota: sul foglio stampato ha un titolo tutto suo, e anche
   qui deve averlo. Chi compra dal sito non passa dalla reception: questa
   è l'unica volta in cui gli viene detto. (Stessi testi del back office.) */
const PRENOTA: Record<string, { titolo: string; come: string }> = {
  it: { titolo: 'COME PRENOTARE', come: 'Per prenotare ci chiami o ci scriva: fissiamo insieme il giorno e l’ora.' },
  de: { titolo: 'SO RESERVIEREN SIE', come: 'Rufen Sie uns an oder schreiben Sie uns: wir vereinbaren gemeinsam Tag und Uhrzeit.' },
  en: { titolo: 'HOW TO BOOK', come: 'To book, call or write to us: we will arrange the day and time together.' },
  fr: { titolo: 'COMMENT RÉSERVER', come: 'Pour réserver, appelez-nous ou écrivez-nous : nous fixerons ensemble le jour et l’heure.' }
};

/* cosa comprende il Day Spa: è la voce più richiesta, e sul foglio
   stampato l'elenco c'è. Anche qui, o l'email dice meno della stampa. */
const COMPRENDE: Record<string, Record<string, string[]>> = {
  dayspa: {
    it: ['Piscine termali interna ed esterna comunicanti, con idromassaggi e giochi d’acqua',
      'Zona Relax: Biogrotta, bagno turco, vasca idromassaggio, lettini massaggianti',
      'Cascata di acqua termale, cascata di ghiaccio e docce emozionali con aromaterapia',
      'Vasca esterna di acqua termale più fresca, con bordo a sfioro e lettini prendisole'],
    de: ['Thermal-Innen- und Außenpool, miteinander verbunden, mit Sprudelliegen und Wasserspielen',
      'Relaxbereich: Biogrotte, Dampfbad, Whirlpool, Massageliegen',
      'Thermalwasserfall, Eisbrunnen und Erlebnisduschen mit Aromatherapie',
      'Außenbecken mit kühlerem Thermalwasser, Infinity-Rand und Sonnenliegen'],
    en: ['Connected indoor and outdoor thermal pools, with hydromassage and water features',
      'Relax area: Bio-grotto, steam bath, whirlpool, massage loungers',
      'Thermal waterfall, ice fountain and emotional showers with aromatherapy',
      'Outdoor pool with cooler thermal water, infinity edge and sun loungers'],
    fr: ['Piscines thermales intérieure et extérieure communicantes, avec hydromassages et jeux d’eau',
      'Espace Relax : bio-grotte, bain turc, bain à remous, lits de massage',
      'Cascade d’eau thermale, cascade de glace et douches sensorielles à l’aromathérapie',
      'Bassin extérieur d’eau thermale plus fraîche, à débordement, avec transats']
  }
};

/* l'elenco esce se il buono contiene un Day Spa, anche quando non è la
   prima voce: nei buoni con più righe può stare in mezzo */
function comprende(b: { voce_id?: string | null; descrizione?: string }, lingua: string): string[] {
  const daySpa = String(b.voce_id || '').startsWith('dayspa') ||
    /day spa/i.test(String(b.descrizione || ''));
  if (!daySpa) return [];
  return COMPRENDE.dayspa[lingua] || COMPRENDE.dayspa.it;
}

/* la foto del buono: una per tipo, servita dal sito delle pagine.
   Le immagini sono già ritagliate nel formato del riquadro, così
   restano giuste anche dove object-fit non viene applicato. */
const BASE_IMG = 'https://arrivo-terme-leonardo.vercel.app/buoni/img';
export function fotoBuono(b: { tipo?: string; voce_id?: string | null }): string {
  const id = String(b.voce_id || '');
  if (b.tipo === 'valore') return `${BASE_IMG}/valore.jpg`;
  if (id.startsWith('dayspa')) return `${BASE_IMG}/dayspa.jpg`;
  /* stesse categorie di categoriaBuono() nel back office: se cambiano
     lì, vanno cambiate anche qui, o email e stampa si smentiscono */
  if (/^(prog|relax|plantare|candle|antistress|californiano|ayurveda|hotstone|pindasweda|linfo|shiatzu)/.test(id) ||
      /^(visofango|pulizia|ialuronico|collagene|vitaminac)/.test(id) ||
      /^(scrub|riducente|seno|antiage|manicure|pedicure|epil)/.test(id))
    return `${BASE_IMG}/trattamenti.jpg`;
  return `${BASE_IMG}/valore.jpg`;
}

/* il buono in HTML — versione email, autosufficiente */
export function buonoEmailHTML(b: any) {
  const L = ['it', 'de', 'en', 'fr'].includes(b.lingua) ? b.lingua : 'it';
  const e = ETI[L];
  const dest = b.destinatario ? esc(b.destinatario) : '';
  /* i buoni con più voci arrivano con le righe separate da a capo: vanno
     rese come righe anche qui, o l'email dice una cosa e la stampa un'altra */
  const righeDescr = String(b.descrizione || '').split('\n').filter(Boolean);
  const incluso = comprende(b, L);
  const p = PRENOTA[L] || PRENOTA.it;
  return `<table cellpadding="0" cellspacing="0" border="0" width="700" style="width:700px;max-width:100%;border-collapse:collapse;font-family:Georgia,'Times New Roman',serif;background:#FFFFFF;">
<tr>
  <td width="270" valign="top" style="width:270px;background:#E4F0EA;padding:34px 26px;">
    <img src="${BASE_IMG}/logo.png" width="150" alt="Hotel Terme Leonardo" style="display:block;width:150px;height:auto;border:0;" />
    <img src="${fotoBuono(b)}" width="218" height="150" alt="" style="display:block;width:218px;height:150px;object-fit:cover;border-radius:2px;margin:26px 0 8px;" />
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
        ${righeDescr.map((r, i) => `<div style="font-size:17px;color:#1B4D4A;${i ? 'margin-top:6px;' : ''}">${esc(r)}</div>`).join('')}
        ${b.sottotitolo ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:2px;color:#C9A961;margin-top:7px;">${esc(b.sottotitolo)}</div>` : ''}
        ${incluso.length ? `<div style="margin-top:14px;">` + incluso.map((x) =>
          `<div style="font-family:Arial,Helvetica,sans-serif;font-size:11.5px;line-height:1.7;color:#4A5C59;"><span style="color:#C9A961;">&middot;</span> ${esc(x)}</div>`).join('') + `</div>` : ''}
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.6;color:#8A938F;margin-top:12px;border-top:1px solid #EFEBE0;padding-top:9px;">${esc(e.nota)}</div>
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
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:2px;color:#C9A961;padding-top:20px;">${p.titolo}</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#4A5C59;padding-top:5px;">${esc(p.come)}</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:8px;line-height:1.55;color:#B3ADA1;padding-top:18px;">${esc(CONDIZIONI[L] || CONDIZIONI.it)}</div>
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

/* Riepilogo d'acquisto per un indirizzo diverso da quello di chi compra:
   serve a chi paga per l'azienda o gira tutto al commercialista.
   NON e' una ricevuta fiscale — quella si chiede in reception — e non
   contiene il codice spendibile, che non deve girare in contabilita'. */
const RICEVUTA: Record<string, any> = {
  it: { ogg: (r: string) => `Riepilogo d'acquisto ${r} — Hotel Terme Leonardo`, tit: 'Riepilogo d’acquisto',
    numero: 'Numero', cosa: 'Acquisto', importo: 'Importo', acq: 'Acquirente',
    nota: 'Questo è un riepilogo dell’acquisto, non una ricevuta fiscale. Per la ricevuta fiscale ci contatti in reception.' },
  de: { ogg: (r: string) => `Kaufübersicht ${r} — Hotel Terme Leonardo`, tit: 'Kaufübersicht',
    numero: 'Nummer', cosa: 'Kauf', importo: 'Betrag', acq: 'Käufer',
    nota: 'Dies ist eine Kaufübersicht, keine steuerliche Quittung. Für die steuerliche Quittung wenden Sie sich bitte an die Rezeption.' },
  en: { ogg: (r: string) => `Purchase summary ${r} — Hotel Terme Leonardo`, tit: 'Purchase summary',
    numero: 'Number', cosa: 'Purchase', importo: 'Amount', acq: 'Buyer',
    nota: 'This is a purchase summary, not a fiscal receipt. For a fiscal receipt please contact our reception.' },
  fr: { ogg: (r: string) => `Récapitulatif d’achat ${r} — Hôtel Terme Leonardo`, tit: 'Récapitulatif d’achat',
    numero: 'Numéro', cosa: 'Achat', importo: 'Montant', acq: 'Acheteur',
    nota: 'Ceci est un récapitulatif d’achat, pas un reçu fiscal. Pour le reçu fiscal, contactez notre réception.' }
};

/* Intestazione per le email che NON contengono il buono: senza, uscivano
   anonime, e un'email anonima che parla di soldi somiglia a una truffa.

   Marchio nero su bianco e non logo.png: quello ha il fondo verde acqua
   incorporato perche' sul buono sta su una colonna dello stesso colore, ma
   da solo si vede il rettangolo. PNG e non SVG: nelle email l'SVG non si
   vede. Bianco e non trasparente: un nero su trasparente sparirebbe nei
   programmi di posta che invertono i colori. */
export function intestazione(): string {
  return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
    <tr><td style="padding-bottom:18px;border-bottom:1px solid #E6E2D8;">
      <img src="${BASE_IMG}/logo-nero.png" width="220" alt="Hotel Terme Leonardo"
        style="display:block;width:220px;height:auto;border:0;" />
    </td></tr>
  </table>`;
}

export function ricevutaEmailHTML(b: any): string {
  const L = ['it', 'de', 'en', 'fr'].includes(b.lingua) ? b.lingua : 'it';
  const r = RICEVUTA[L];
  const riga = (k: string, v: string) =>
    `<tr><td style="padding:5px 16px 5px 0;color:#8A938F;">${k}</td><td style="padding:5px 0;">${v}</td></tr>`;
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#2A2E2B;max-width:620px;">
    ${intestazione()}
    <div style="font-size:11px;letter-spacing:2px;color:#C9A961;text-transform:uppercase;padding-top:18px;">${r.tit}</div>
    <table style="border-collapse:collapse;margin-top:12px;font-size:14px;">
      ${riga(r.numero, esc(b.numero))}
      ${riga(r.cosa, esc(String(b.descrizione || '').split('\n').join(' · ')))}
      ${riga(r.importo, eur(b.valore) + ' €')}
      ${b.acquirente ? riga(r.acq, esc(b.acquirente)) : ''}
    </table>
    <p style="color:#7B756A;font-size:12.5px;line-height:1.6;margin-top:16px;">${esc(r.nota)}</p>
    <p style="color:#7B756A;font-size:12.5px;">+39 049 9939200 &middot; info@termeleonardo.com</p>
  </div>`;
}

/* il solo avviso interno: serve anche per i buoni emessi in reception,
   che non passano dal webhook e altrimenti non lascerebbero traccia —
   il promozionale, che non ha un incasso da riconciliare, in testa */
export async function avvisaAmministrazione(b: any): Promise<boolean> {
  const amm = Deno.env.get('EMAIL_AMMINISTRAZIONE');
  if (!amm) return false;
  return await invia(amm,
    `Buono ${b.numero} ${b.pagamento === 'promozionale' ? 'promozionale' : 'pagato'} — ${eur(b.valore)} € (${b.pagamento || ''})`,
    `<div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;">${intestazione()}</div>
    <p style="font-family:Arial;font-size:14px;">Buono <strong>${esc(b.numero)}</strong> · codice <strong>${esc(b.codice)}</strong><br />
    ${esc(b.descrizione)} · ${eur(b.valore)} € · ${esc(b.pagamento || '')} ${esc(b.pagamento_rif || '')}<br />
    Acquirente: ${esc(b.acquirente || '')} &lt;${esc(b.acquirente_email || '')}&gt;<br />
    Origine: ${esc(b.creato_da || '')}</p>`);
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

  /* riepilogo d'acquisto a un indirizzo diverso, se richiesto */
  if (b.ricevuta_email)
    esiti.ricevuta = await invia(b.ricevuta_email,
      (RICEVUTA[L] || RICEVUTA.it).ogg(b.numero), ricevutaEmailHTML(b));

  if (Deno.env.get('EMAIL_AMMINISTRAZIONE'))
    esiti.amministrazione = await avvisaAmministrazione(b);

  return esiti;
}
