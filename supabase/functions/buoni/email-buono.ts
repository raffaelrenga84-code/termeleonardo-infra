/* ============================================================
   email-buono.ts — il buono via email, lato server.

   UNA COLONNA, E IL BUONO VERO E' IN ALLEGATO. Dal 5 settembre 2026 il
   buono bello — carta intestata, fotografia, tutto — e' il PDF che
   pdf-buono.ts disegna e che parte allegato a queste email («il buono
   deve essere un PDF sulla carta intestata», la proprieta'). Quello che
   resta qui e' la LETTERA che lo accompagna: dice a chi e da chi, cosa
   comprende, il codice col suo QR (che si legge dal telefono, senza
   aprire l'allegato) e come si prenota. Una colonna sola, larga 620,
   senza nessuna fotografia: le tre di prima si scaricavano a ogni
   apertura e in Outlook uscivano schiacciate appena il file cambiava
   forma, e adesso la fotografia sta dove serve, sul foglio.

   Tabelle HTML e non layout moderni: Outlook non li regge.
   ============================================================ */

import { buonoDellaSpa } from './ruoli.ts';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const eur = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 });

/* nota, in tutte e quattro le lingue qui sotto: dice che ogni ingresso o
   trattamento vale per una persona e come si prenota. Diceva anche che si
   poteva venire insieme o in momenti diversi "come preferite" — una
   promessa comoda da leggere ma scomoda da gestire in reception (riscossioni
   parziali, tenere il conto di quante volte un buono a più voci è già stato
   usato): tolta su richiesta della proprietà. Vale per ogni lingua, non solo
   per quella che si sta modificando. Presidiata da buono.test.ts, che la
   confronta con la stessa nota in pagine/buoni/buono.js: deve restare
   identica lì e qui. */
/* la riga di spiegazione della proroga, in tutte e quattro le lingue.
   Non nomina mai un numero di mesi: la proroga non aggiunge mesi fissi,
   sposta a una data usabile, e quanti mesi siano dipende da quando si è
   comprato — scriverne uno sarebbe giusto per un cliente e sbagliato per
   il prossimo. Compare solo quando prorogato && scade_il_base, vedi
   buonoEmailHTML più sotto: un buono che scade a giugno non la mostra. */
export const ETI: Record<string, any> = {
  it: { titolo: 'Buono Regalo', haRicevuto: (n: string) => `${n}, hai ricevuto<br />un dono speciale`,
    senzaNome: 'Un dono speciale<br />per te', da: 'CON AFFETTO, DA', codice: 'CODICE BUONO',
    valido: (d: string) => `Valido fino al ${d}`,
    prorogato: (n: string, x: string) => `La validità sarebbe scaduta il ${n}, quando l’hotel è chiuso: l’abbiamo prorogata fino al ${x}.`,
    oggetto: 'Il suo Buono Regalo — Hotel Terme Leonardo',
    oggettoAcq: (rif: string) => `Buono regalo ${rif} emesso — Hotel Terme Leonardo`,
    caro: (n: string) => `Gentile ${n || 'Cliente'},`,
    corpoAcq: 'grazie del suo acquisto: il pagamento è stato ricevuto e il buono è stato emesso. Lo trova qui sotto, pronto da stampare o da inoltrare a chi lo riceverà.',
    corpoDest: 'qualcuno ha pensato a lei: ecco il suo buono regalo per l’Hotel Terme Leonardo. Per usarlo basta chiamarci o scriverci indicando il codice.',
    saluto: 'Un cordiale saluto,<br />Hotel Terme Leonardo',
    nota: 'Ogni ingresso o trattamento vale per una persona. Per prenotare basta chiamarci o scriverci: ci organizziamo insieme.',
    stampaBtn: 'Stampa il tuo buono',
    stampaNota: 'Il buono è in allegato a questa email, in PDF: lo apra e lo stampi, o lo inoltri a chi lo riceverà.',
    qrNota: 'Mostri questo codice in reception.' },
  de: { titolo: 'Geschenkgutschein', haRicevuto: (n: string) => `${n}, Sie haben<br />ein besonderes Geschenk erhalten`,
    senzaNome: 'Ein besonderes<br />Geschenk für Sie', da: 'HERZLICHST, VON', codice: 'GUTSCHEINCODE',
    valido: (d: string) => `Gültig bis ${d}`,
    prorogato: (n: string, x: string) => `Die Gültigkeit wäre am ${n} abgelaufen, während das Hotel geschlossen ist: Wir haben sie bis zum ${x} verlängert.`,
    oggetto: 'Ihr Geschenkgutschein — Hotel Terme Leonardo',
    oggettoAcq: (rif: string) => `Geschenkgutschein ${rif} ausgestellt — Hotel Terme Leonardo`,
    caro: (n: string) => `Sehr geehrte(r) ${n || 'Kundin/Kunde'},`,
    corpoAcq: 'vielen Dank für Ihren Einkauf: die Zahlung ist eingegangen und der Gutschein wurde ausgestellt. Sie finden ihn unten — zum Ausdrucken oder Weiterleiten.',
    corpoDest: 'jemand hat an Sie gedacht: hier ist Ihr Geschenkgutschein für das Hotel Terme Leonardo. Zur Einlösung genügt ein Anruf oder eine E-Mail mit dem Code.',
    saluto: 'Mit freundlichen Grüßen,<br />Hotel Terme Leonardo',
    nota: 'Jeder Eintritt und jede Anwendung gilt für eine Person. Für die Reservierung rufen Sie uns an oder schreiben Sie uns: wir organisieren alles gemeinsam.',
    stampaBtn: 'Gutschein ausdrucken',
    stampaNota: 'Der Gutschein liegt dieser E-Mail als PDF bei: öffnen und ausdrucken, oder an den Beschenkten weiterleiten.',
    qrNota: 'Zeigen Sie diesen Code an der Rezeption.' },
  en: { titolo: 'Gift Voucher', haRicevuto: (n: string) => `${n}, you have received<br />a special gift`,
    senzaNome: 'A special gift<br />for you', da: 'WITH LOVE, FROM', codice: 'VOUCHER CODE',
    valido: (d: string) => `Valid until ${d}`,
    prorogato: (n: string, x: string) => `It would have expired on ${n}, while the hotel is closed: we have extended it to ${x}.`,
    oggetto: 'Your Gift Voucher — Hotel Terme Leonardo',
    oggettoAcq: (rif: string) => `Gift voucher ${rif} issued — Hotel Terme Leonardo`,
    caro: (n: string) => `Dear ${n || 'Guest'},`,
    corpoAcq: 'thank you for your purchase: the payment has been received and the voucher has been issued. You will find it below, ready to print or forward.',
    corpoDest: 'someone was thinking of you: here is your gift voucher for Hotel Terme Leonardo. To use it, just call or write to us with the code.',
    saluto: 'Kind regards,<br />Hotel Terme Leonardo',
    nota: 'Each admission or treatment is for one person. To book, just call or write to us: we will arrange everything together.',
    stampaBtn: 'Print your voucher',
    stampaNota: 'The voucher is attached to this email as a PDF: open and print it, or forward it to the recipient.',
    qrNota: 'Show this code at reception.' },
  fr: { titolo: 'Bon Cadeau', haRicevuto: (n: string) => `${n}, vous avez reçu<br />un cadeau très spécial`,
    senzaNome: 'Un cadeau spécial<br />pour vous', da: 'AVEC AFFECTION, DE', codice: 'CODE DU BON',
    valido: (d: string) => `Valable jusqu'au ${d}`,
    prorogato: (n: string, x: string) => `La validité aurait expiré le ${n}, alors que l’hôtel est fermé : nous l’avons prolongée jusqu’au ${x}.`,
    oggetto: 'Votre Bon Cadeau — Hôtel Terme Leonardo',
    oggettoAcq: (rif: string) => `Bon cadeau ${rif} émis — Hôtel Terme Leonardo`,
    caro: (n: string) => `Cher/Chère ${n || 'Client(e)'},`,
    corpoAcq: 'merci pour votre achat : le paiement a été reçu et le bon a été émis. Vous le trouverez ci-dessous, prêt à imprimer ou à transférer.',
    corpoDest: 'quelqu’un a pensé à vous : voici votre bon cadeau pour l’Hôtel Terme Leonardo. Pour l’utiliser, appelez-nous ou écrivez-nous avec le code.',
    saluto: 'Cordialement,<br />Hôtel Terme Leonardo',
    nota: 'Chaque entrée ou soin vaut pour une personne. Pour réserver, appelez-nous ou écrivez-nous : nous organisons tout ensemble.',
    stampaBtn: 'Imprimer votre bon',
    stampaNota: 'Le bon est joint à cet e-mail en PDF : ouvrez-le et imprimez-le, ou transférez-le à son destinataire.',
    qrNota: 'Présentez ce code à la réception.' }
};

const MESI: Record<string, string[]> = {
  it: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
  de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
};
export function dataLingua(iso: string, l: string) {
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
  it: "Apertura stagionale: l’hotel chiude ogni anno da fine novembre a metà febbraio; il buono non è utilizzabile mentre l’hotel è chiuso. Se la scadenza cade in quel periodo la prolunghiamo noi fino a un mese dopo la riapertura, e la data prorogata è quella scritta sul buono. È richiesta la maggiore età per l’accesso a piscine, hotel e spa; ingressi soggetti a disponibilità e prenotazione obbligatoria. Il buono non è utilizzabile nelle prime 48 ore dall’acquisto, non è rimborsabile né convertibile in denaro; gli importi residui dopo il primo utilizzo non sono trasferibili. In caso di cancellazione, modifica o mancata presentazione (no show) il buono non è rimborsabile. Validità un anno dalla data di emissione, salvo la proroga indicata sopra.",
  de: "Saisonale Öffnung: das Hotel schließt jedes Jahr von Ende November bis Mitte Februar; während der Schließung ist der Gutschein nicht einlösbar. Fällt das Ablaufdatum in diesen Zeitraum, verlängern wir es bis einen Monat nach der Wiedereröffnung; das verlängerte Datum ist das auf dem Gutschein angegebene. Für den Zutritt zu Pools, Hotel und Spa ist Volljährigkeit erforderlich; Eintritte nach Verfügbarkeit, Reservierung erforderlich. Der Gutschein ist in den ersten 48 Stunden nach dem Kauf nicht einlösbar, nicht erstattungsfähig und nicht in Bargeld umtauschbar; Restbeträge nach der ersten Einlösung sind nicht übertragbar. Bei Stornierung, Änderung oder Nichterscheinen (No-Show) ist der Gutschein nicht erstattungsfähig. Gültigkeit ein Jahr ab Ausstellungsdatum, vorbehaltlich der oben genannten Verlängerung.",
  en: "Seasonal opening: the hotel closes every year from late November to mid-February; the voucher cannot be used while the hotel is closed. If the expiry date falls in that period we extend it to one month after reopening, and the extended date is the one shown on the voucher. Guests must be of legal age to access pools, hotel and spa; admission subject to availability, booking required. The voucher cannot be used within the first 48 hours of purchase, is not refundable and cannot be exchanged for cash; any remaining amount after the first use is not transferable. In case of cancellation, modification or no-show, the voucher is not refundable. Valid for one year from the date of issue, subject to the extension described above.",
  fr: "Ouverture saisonnière : l’hôtel ferme chaque année de fin novembre à mi-février ; le bon n’est pas utilisable pendant la fermeture. Si la date d’expiration tombe dans cette période, nous la prolongeons jusqu’à un mois après la réouverture, et la date prolongée est celle indiquée sur le bon. La majorité est requise pour accéder aux piscines, à l’hôtel et au spa ; entrées soumises à disponibilité et réservation obligatoire. Le bon n’est pas utilisable dans les 48 heures suivant l’achat, n’est ni remboursable ni convertible en espèces ; les montants restants après la première utilisation ne sont pas transférables. En cas d’annulation, de modification ou de non-présentation (no-show), le bon n’est pas remboursable. Validité un an à compter de la date d’émission, sous réserve de la prolongation indiquée ci-dessus."
};

/* come si prenota: sul foglio stampato ha un titolo tutto suo, e anche
   qui deve averlo. Chi compra dal sito non passa dalla reception: questa
   è l'unica volta in cui gli viene detto. (Stessi testi del back office.) */
/* `come` RESTA: il pulsante qui sotto si aggiunge, non sostituisce. Chi
   preferisce il telefono deve continuare a trovare il telefono — e chi legge
   da un programma di posta che blocca tutto vede comunque come fare. */
export const PRENOTA: Record<string, { titolo: string; come: string; bottone: string }> = {
  it: { titolo: 'COME PRENOTARE', come: 'Per prenotare ci chiami o ci scriva: fissiamo insieme il giorno e l’ora.',
    bottone: 'Prenota online' },
  de: { titolo: 'SO RESERVIEREN SIE', come: 'Rufen Sie uns an oder schreiben Sie uns: wir vereinbaren gemeinsam Tag und Uhrzeit.',
    bottone: 'Online reservieren' },
  en: { titolo: 'HOW TO BOOK', come: 'To book, call or write to us: we will arrange the day and time together.',
    bottone: 'Book online' },
  fr: { titolo: 'COMMENT RÉSERVER', come: 'Pour réserver, appelez-nous ou écrivez-nous : nous fixerons ensemble le jour et l’heure.',
    bottone: 'Réserver en ligne' }
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
export function comprende(b: { voce_id?: string | null; descrizione?: string }, lingua: string): string[] {
  const daySpa = String(b.voce_id || '').startsWith('dayspa') ||
    /day spa/i.test(String(b.descrizione || ''));
  if (!daySpa) return [];
  return COMPRENDE.dayspa[lingua] || COMPRENDE.dayspa.it;
}

/* Dove stanno le immagini dell'email: il marchio, e nient'altro. Le tre
   fotografie di prima (dayspa.jpg, valore.jpg, trattamenti.jpg) le sceglieva
   fotoBuono(), tolta il 5 settembre 2026 insieme alla colonna colorata: la
   fotografia adesso sta sul PDF in allegato, dove non si scarica a ogni
   apertura e non puo' uscire schiacciata. I file restano sul sito finche' li
   nomina pagine/buoni/buono.js, che disegna ancora il buono nel browser. */
const BASE_IMG = 'https://arrivo-terme-leonardo.vercel.app/buoni/img';

/* Dove vive la funzione `buoni` stessa — non il dominio dell'hotel (quello
   è BASE_HOTEL più sotto, per linkStampa). Qui non si tratta di un
   indirizzo che l'ospite legge o clicca: è un <img src> che il suo
   programma di posta carica da solo, e le pagine pubbliche del progetto
   (pagine/buoni/stampa/index.html, pagine/buoni/index.html) chiamano già
   questa funzione a questo stesso indirizzo direttamente, mai attraverso
   il dominio dell'hotel. */
const BASE_FUNZIONE = 'https://mvuiuwakuseockotlcnp.supabase.co/functions/v1/buoni';

/** L'indirizzo dell'immagine QR del codice — generata al volo da ?a=qr
 * (supabase/functions/buoni/qr.js + il commento sopra quell'azione in
 * index.ts spiegano perché non controlla se il codice esiste davvero: non
 * dev'essere un modo per scoprire quali buoni sono validi). Esportata per
 * il test, stessa ragione di linkStampa più sotto: l'email deve arrivare
 * esattamente a questo indirizzo, non a uno scritto a mano nel test e che
 * potrebbe divergere in silenzio. */
export function linkQr(codice: string | null | undefined): string {
  return `${BASE_FUNZIONE}?a=qr&codice=${encodeURIComponent(String(codice ?? ''))}`;
}

/* il buono in HTML — versione email, autosufficiente.

   UNA COLONNA SOLA, LARGA 620. Prima erano due: a sinistra una colonna
   verde acqua col marchio e una fotografia, a destra il buono. Con il PDF
   in allegato quella colonna non ha più niente da dire — la fotografia sta
   sul foglio — e su un telefono le due colonne si stringevano fino a
   spezzare le parole. In cima resta il marchio nero di intestazione(), lo
   stesso delle altre email.

   I RECAPITI NON SONO PIÙ QUI. Stavano nella terza casella accanto al
   codice; adesso stanno nel saluto (avvolgi, più sotto), che è dove uno
   li cerca in una lettera — e dove ci sono già per ogni altra email
   dell'hotel. Scriverli in tutti e due i posti li avrebbe fatti leggere
   due volte a due righe di distanza.

   IL QR ACCANTO AL CODICE. In portineria c'è un lettore di codici QR, ma
   chi si presenta al banco tipicamente non ha il foglio stampato — ha il
   telefono, con l'email — e senza un QR nell'email la reception finisce
   comunque a digitare il codice a mano, proprio quello che il lettore
   doveva evitare. L'immagine (linkQr, ?a=qr in index.ts) affianca il
   codice, non lo sostituisce: il codice in chiaro resta leggibile per chi
   legge da un programma che blocca le immagini, e per chi lo detta al
   telefono. Niente QR su una bozza (`b.codice` falsy): senza un codice
   vero non c'è niente da far leggere in reception — stesso freno che
   generaSvgQR ha già in buonoStampaHTML (pagine/buoni/buono.js). */
export function buonoEmailHTML(b: any) {
  const L = ['it', 'de', 'en', 'fr'].includes(b.lingua) ? b.lingua : 'it';
  const e = ETI[L];
  const dest = b.destinatario ? esc(b.destinatario) : '';
  /* i buoni con più voci arrivano con le righe separate da a capo: vanno
     rese come righe anche qui, o l'email dice una cosa e la stampa un'altra */
  const righeDescr = String(b.descrizione || '').split('\n').filter(Boolean);
  const incluso = comprende(b, L);
  const p = PRENOTA[L] || PRENOTA.it;
  return `<table cellpadding="0" cellspacing="0" border="0" width="620" style="width:620px;max-width:100%;border-collapse:collapse;font-family:Georgia,'Times New Roman',serif;background:#FFFFFF;">
<tr>
  <td valign="top" style="padding:0;">
    ${intestazione()}
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:9.5px;letter-spacing:3px;color:#C9A961;padding-top:22px;">${e.titolo.toUpperCase()}</div>
    <div style="font-size:25px;line-height:1.3;color:#1B4D4A;margin:12px 0 0;">${dest ? e.haRicevuto(dest) : e.senzaNome}</div>
    ${b.acquirente ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:2px;color:#9AA9A6;margin-top:20px;">${e.da}</div>
    <div style="font-size:15px;font-style:italic;color:#1B4D4A;margin-top:4px;">${esc(b.acquirente)}</div>` : ''}
    ${b.dedica ? `<div style="font-size:13.5px;font-style:italic;color:#5C736F;margin-top:14px;line-height:1.5;">${esc(b.dedica)}</div>` : ''}
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
          ${b.prorogato && b.scade_il_base ? `
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#8A8A8A;margin-top:3px;line-height:1.45;">
            ${e.prorogato(dataLingua(b.scade_il_base, L), dataLingua(b.scade_il, L))}
          </div>` : ''}
        </td>
        ${b.codice ? `<td valign="top" align="right" style="padding-top:14px;padding-left:16px;">
          <img src="${esc(linkQr(b.codice))}" width="92" height="92" alt="QR" style="display:block;width:92px;height:92px;border:0;" />
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:8.5px;line-height:1.4;color:#8A938F;text-align:center;margin-top:5px;max-width:100px;">${esc(e.qrNota)}</div>
        </td>` : ''}
      </tr>
    </table>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:2px;color:#C9A961;padding-top:20px;">${p.titolo}</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#4A5C59;padding-top:5px;">${esc(p.come)}</div>
    ${/* niente pulsante su una bozza (`b.codice` falsy): senza un codice vero
         il modulo aprirebbe un ?buono= vuoto, cioè il modulo semplice, e il
         pulsante prometterebbe qualcosa che non fa. Stesso freno del QR qui
         sopra e del pulsante di stampa in inviaBuonoEmesso. */''}
    ${b.codice ? bottonePrenota(b, p) : ''}
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:8px;line-height:1.55;color:#B3ADA1;padding-top:18px;">${esc(CONDIZIONI[L] || CONDIZIONI.it)}</div>
  </td>
</tr>
</table>`;
}

/* Dominio dell'hotel — non arrivo-terme-leonardo.vercel.app, che è il
   progetto Vercel che serve i file ma non è l'indirizzo che l'ospite deve
   vedere in un anno. La riscrittura /buoni/:percorso* di
   termeleonardo/frontend/vercel.json (nell'altro repository) copre
   qualunque pagina nuova sotto /buoni/: nessuna regola nuova serve là.

   ⚠ MA SOLO SENZA LA BARRA FINALE — vedi NIENTE BARRA FINALE qui sotto.
   Fino al 17 agosto 2026 questo commento diceva «/buoni/stampa/ compresa»,
   con la barra, ed era falso: con la barra la riscrittura non aggancia. */
const BASE_HOTEL = 'https://www.hoteltermeleonardo.com';

/* ============================================================
   NIENTE BARRA FINALE PRIMA DELLA QUERY. Vale per ogni indirizzo che
   componiamo verso una pagina riscritta — linkStampa qui sotto e
   linkPrenota più avanti.

   `source` in vercel.json è confrontato ALLA LETTERA: '/buoni/:percorso*'
   aggancia '/buoni/stampa', non '/buoni/stampa/'. Con la barra la richiesta
   scivola oltre tutte le regole e la serve il sito vetrina, che per
   qualunque percorso sconosciuto risponde 200 con la propria home: non un
   404 che si nota, una pagina che sembra funzionare e non è quella giusta.

   Misurato sul sito vero il 17 agosto 2026, a parità di tutto il resto:

     /buoni/stampa?codice=…&l=it     10380 byte  <title>Buono Regalo — …
     /buoni/stampa/?codice=…&l=it     6583 byte  <title>Hotel Terme Leonardo | 4 stelle…
     /it/trattamenti                 45513 byte  <title>Richieste — …
     /it/trattamenti/                 6583 byte  <title>Hotel Terme Leonardo | 4 stelle…

   I 6583 byte sono il guscio della vetrina, identico a quello di un percorso
   inventato. Il pulsante «Stampa il tuo buono» ha portato lì per giorni.

   E LA PAGINA REGGE SENZA LA BARRA: pagine/buoni/stampa/index.html importa
   tutto per percorso ASSOLUTO (/buoni/buono.js, /buoni/stampa.css,
   /buoni/img/logo.svg), quindi niente si risolve contro la cartella e niente
   cambia se la barra non c'è — è scritto apposta nel commento sopra
   quell'import. Verificato caricando l'indirizzo senza barra in un browser
   vero: il modulo gira (il <title> lo riscrive lui) e la pagina risponde
   nella lingua del parametro.

   Se qualcuno la rimette «per simmetria», i test qui accanto diventano rossi.
   ============================================================ */

/** L'indirizzo della pagina pubblica pagine/buoni/stampa/: il codice è
 * quello che la rende sua (vedi il ragionamento in stampa.ts), la lingua è
 * quella del buono — la stessa in cui è scritta questa email — così la
 * pagina non deve indovinarla. Esportata per il test: la pagina deve
 * arrivare esattamente a questo indirizzo, non a uno scritto a mano nel
 * test e che potrebbe divergere in silenzio. */
export function linkStampa(b: { codice?: string | null; lingua?: string }): string {
  const L = ['it', 'de', 'en', 'fr'].includes(String(b.lingua)) ? b.lingua : 'it';
  return `${BASE_HOTEL}/buoni/stampa?codice=${encodeURIComponent(String(b.codice ?? ''))}&l=${L}`;
}

/* ============================================================
   DOVE SI PRENOTA COL BUONO — la regola della specifica §4-bis.

   ⚠ SECONDA COPIA di moduloDelBuono()/percorsoPrenota() in
   pagine/buoni/buono.js, dove servono al foglio A4: il ragionamento completo
   — perché si guarda `descrizione` e non `voci`, perché con una voce sola
   vince l'id di listino, perché il buono a importo va ai trattamenti — sta
   scritto per esteso là, in cima a quelle due funzioni. Qui non si ripete:
   si tiene identico. Questa copia esiste perché la funzione Deno non
   raggiunge pagine/ (stessa ragione della copia di qr.js qui accanto), ed è
   presidiata da buono.test.ts, che confronta le due caso per caso.

   La tabella qui sotto è il pezzo di PERCORSI (pagine/comune/percorso.js)
   che serve a queste due sole voci, e va tenuta uguale a quella: sono i
   percorsi tradotti scritti nelle riscritture di
   termeleonardo/frontend/vercel.json. «Day Spa» non si traduce in nessuna
   delle quattro lingue — è il nome col quale l'hotel vende l'ingresso, ed è
   quello stampato sul buono.
   ============================================================ */
const PERCORSI_PRENOTA: Record<string, Record<string, string>> = {
  trattamenti: { it: 'trattamenti', de: 'behandlungen', en: 'treatments', fr: 'soins' },
  dayspa: { it: 'day-spa', de: 'day-spa', en: 'day-spa', fr: 'day-spa' }
};

const eRigaDaySpa = (riga: string) => /day spa/i.test(riga);
/* l'ha scritta componiDescrizione: piu' righe, tutte col numero davanti */
const descrizioneComposta = (righe: string[]) =>
  righe.length > 1 && righe.every((r) => /^\d+\s*×\s*\S/.test(r));

export function moduloDelBuono(b: { tipo?: string | null; voce_id?: string | null; descrizione?: string | null }): string {
  if (b?.tipo === 'valore') return 'trattamenti';
  const righe = String(b?.descrizione || '').split('\n')
    .map((r) => r.trim()).filter(Boolean);
  const id = String(b?.voce_id || '');
  /* elenco di voci vero: qui il testo E' la lista, e vale la §4-bis */
  if (descrizioneComposta(righe)) {
    return righe.some((r) => !eRigaDaySpa(r)) ? 'trattamenti' : 'dayspa';
  }
  /* tutto il resto (una voce sola, o un buono scritto in reception): comanda
     l'id di listino, che e' l'unico segno affidabile che ci sia */
  if (id) return id.startsWith('dayspa') ? 'dayspa' : 'trattamenti';
  /* senza id resta solo il testo */
  if (righe.length === 1) return eRigaDaySpa(righe[0]) ? 'dayspa' : 'trattamenti';
  return 'trattamenti';
}

/** Il percorso tradotto del modulo giusto, nella lingua del buono:
 *  '/de/behandlungen', '/fr/day-spa'. Senza dominio e senza query. */
export function percorsoPrenota(b: { lingua?: string | null; tipo?: string | null; voce_id?: string | null; descrizione?: string | null }): string {
  const L = ['it', 'de', 'en', 'fr'].includes(String(b?.lingua)) ? String(b.lingua) : 'it';
  return `/${L}/${PERCORSI_PRENOTA[moduloDelBuono(b)][L]}`;
}

/** L'indirizzo del pulsante «Prenota online»: il modulo giusto, nella lingua
 * del buono, col codice già dentro — qui si clicca, non si digita, quindi il
 * codice ci sta (sul foglio stampato invece no: vedi buonoStampaHTML). Con
 * `?buono=` il modulo riconosce il buono da solo, disegna il riquadro,
 * preseleziona la voce e dice la differenza: senza, l'ospite si troverebbe
 * un modulo vuoto e il codice da ricopiare a mano nelle note.
 * Esportata per il test, stessa ragione di linkStampa qui sopra: l'email
 * deve arrivare esattamente a questo indirizzo, non a uno scritto a mano nel
 * test e che potrebbe divergere in silenzio. */
export function linkPrenota(b: { codice?: string | null; lingua?: string | null; tipo?: string | null; voce_id?: string | null; descrizione?: string | null }): string {
  return `${BASE_HOTEL}${percorsoPrenota(b)}?buono=${encodeURIComponent(String(b?.codice ?? ''))}`;
}

/** Il pulsante «Prenota online», dentro il buono, sotto «ci chiami o ci
 * scriva». Tabella e non un <a> con padding e border-radius: è lo stesso
 * vincolo di bottoneStampa qui sotto — Outlook non regge i bottoni.
 *
 * Verde del buono (#1B4D4A) e non l'arancio dei pulsanti d'azione: questo
 * sta DENTRO il riquadro del buono, che è il regalo, e un arancio pubblicitario
 * incollato sopra un regalo si legge come pubblicità. L'arancio resta al
 * pulsante di stampa, che sta fuori dal riquadro ed è un'azione dell'email —
 * così i due pulsanti non si contendono nemmeno l'occhio. */
function bottonePrenota(b: { codice?: string | null; lingua?: string | null; tipo?: string | null; voce_id?: string | null; descrizione?: string | null }, p: { bottone: string }): string {
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin:11px 0 0;border-collapse:collapse;">
      <tr><td align="center" style="background:#1B4D4A;border-radius:5px;">
        <a href="${esc(linkPrenota(b))}" target="_blank" rel="noopener noreferrer"
          style="display:inline-block;padding:11px 22px;font-family:Arial,Helvetica,sans-serif;
          font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${esc(p.bottone)}</a>
      </td></tr>
    </table>`;
}

/** Il pulsante «Stampa il tuo buono»: stesso colore e stessa forma dei
 * pulsanti d'azione del resto del progetto (button.azione in back office e
 * .paga in regala/index.html sono sempre arancio) — un cliente che ha già
 * visto quel colore su "Paga con carta" lo riconosce qui come un'azione
 * comoda, non come pubblicità. Tabella e non un <a> nudo: nelle email è la
 * stessa tecnica di emailRichiesta() nel back office, perché Outlook non
 * rende bene padding e border-radius su un elemento inline. */
function bottoneStampa(b: { codice?: string | null; lingua?: string }, e: typeof ETI['it']): string {
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;">
    <tr><td align="center" style="background:#E8751A;border-radius:6px;">
      <a href="${esc(linkStampa(b))}" target="_blank" rel="noopener noreferrer"
        style="display:inline-block;padding:13px 26px;font-family:Arial,Helvetica,sans-serif;
        font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${esc(e.stampaBtn)}</a>
    </td></tr>
  </table>
  <div style="font-family:Arial,Helvetica,sans-serif;font-size:12.5px;color:#7B756A;margin:-10px 0 22px;">${esc(e.stampaNota)}</div>`;
}

function avvolgi(caro: string, corpo: string, saluto: string, buono: string, bottone: string) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#2A2E2B;max-width:700px;">
  <p>${caro}</p><p>${corpo}</p></div>
  <div style="margin:22px 0;">${buono}</div>
  ${bottone}
  <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#2A2E2B;">
  <p>${saluto}<br /><span style="color:#7B756A;font-size:13px;">+39 049 9939200 &middot; info@termeleonardo.com</span></p></div>`;
}

/* ============================================================
   L'ALLEGATO — il buono vero, in PDF.

   Resend prende gli allegati dentro lo stesso corpo JSON dell'email,
   `attachments: [{ filename, content }]`, col contenuto in base64. Il
   campo si mette SOLO quando c'e' qualcosa da allegare: un `attachments`
   vuoto e' un modo di chiedere guai a un'API che non ne ha bisogno.
   ============================================================ */
export type Allegato = { filename: string; content: string };

/* ⚠ SECONDA COPIA di nomeFilePdf() (pdf-buono.ts), per forza — quattro
   righe, e email-buono.test.ts le confronta caso per caso con l'originale.
   Importarla da li' farebbe dipendere QUESTO file da pdf-lib, e con lui
   ogni prova delle pagine che da qui prende le condizioni o le etichette
   (pagine/buoni/buono.test.ts): quelle girano dalla radice del repository,
   dove il pacchetto npm non si risolve, e si spegnerebbero tutte. Il verso
   giusto della dipendenza e' quello che c'e': pdf-buono.ts importa da qui. */
export function nomeFilePdf(b: { codice?: string | null }, bozza?: boolean): string {
  const c = String(b?.codice ?? '').trim().replace(/[^A-Za-z0-9-]/g, '');
  if (bozza || !c) return 'Buono-Regalo-BOZZA.pdf';
  return `Buono-Regalo-${c}.pdf`;
}

/* base64 di un Uint8Array, a blocchi. Un buono pesa un centinaio di
   migliaia di byte, e passarli tutti in un colpo a fromCharCode.apply fa
   saltare lo stack (RangeError): l'allegato non partirebbe, e il cliente
   riceverebbe l'email senza il suo buono. Il blocco da 32 KB e' la misura
   con cui questa tecnica gira dappertutto. */
function base64(b: Uint8Array): string {
  const BLOCCO = 0x8000;
  let s = '';
  for (let i = 0; i < b.length; i += BLOCCO) {
    s += String.fromCharCode.apply(null, b.subarray(i, i + BLOCCO) as unknown as number[]);
  }
  return btoa(s);
}

/** Il PDF del buono pronto da attaccare a un'email: il nome che chi lo
 * riceve si trova sul computer, e i byte in base64. */
export function allegatoPdf(b: { codice?: string | null }, pdf: Uint8Array, bozza = false): Allegato {
  return { filename: nomeFilePdf(b, bozza), content: base64(pdf) };
}

/* `cc` e' facoltativo e di default vuoto: dei tre punti che chiamano
   `invia` (acquirente, destinatario, riepilogo per la ricevuta) nessuno lo
   passa — sono email che arrivano all'ospite o a chi tiene la contabilita',
   e non devono portare in copia nessun indirizzo interno. Solo l'avviso
   interno (avvisaAmministrazione, qui sotto) lo usa, per mettere la spa in
   copia sullo STESSO invio: due invii separati non direbbero a nessuno dei
   due che l'altro l'ha ricevuto.
   `allegati` lo passano le sole due email che portano il buono vero: il
   riepilogo d'acquisto e l'avviso interno non sono il buono. */
async function invia(a: string, oggetto: string, html: string, cc: string[] = [], allegati: Allegato[] = []) {
  const chiave = Deno.env.get('RESEND_API_KEY');
  if (!chiave) { console.error('email non inviata: RESEND_API_KEY mancante ->', a, oggetto); return false; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${chiave}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('MITTENTE_EMAIL') || 'Hotel Terme Leonardo <noreply@hoteltermeleonardo.com>',
      to: [a], subject: oggetto, html,
      ...(cc.length ? { cc } : {}),
      ...(allegati.length ? { attachments: allegati } : {})
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

/* Chi riceve copia di questo buono, oltre ai destinatari di sempre.
 * Esportata perche' si possa provare senza mandare niente.
 *
 * La regola "questo buono e' della spa?" e' buonoDellaSpa() in ruoli.ts,
 * e non si riscrive qui: e' la stessa domanda che decide cosa vede la spa
 * nel back office, e chi lo vede sullo schermo e chi lo riceve per email
 * devono essere decisi dalla stessa riga.
 *
 * Senza EMAIL_SPA non si inventa un indirizzo di riserva: la copia non
 * parte, e si scrive nel registro perche' la reception possa accorgersene. */
export function destinatariInCopia(b: Record<string, unknown>): string[] {
  if (!buonoDellaSpa(b)) return [];
  const a = Deno.env.get('EMAIL_SPA');
  if (!a) {
    console.error('copia alla spa non inviata: manca EMAIL_SPA ->', b.numero);
    return [];
  }
  return [a];
}

/* il solo avviso interno: serve anche per i buoni emessi in reception,
   che non passano dal webhook e altrimenti non lascerebbero traccia —
   il promozionale, che non ha un incasso da riconciliare, in testa */
export async function avvisaAmministrazione(b: any): Promise<boolean> {
  const amm = Deno.env.get('EMAIL_AMMINISTRAZIONE');
  if (!amm) return false;
  /* la descrizione di un buono a due voci arriva su due righe: in HTML un
     ritorno a capo non si vede, e senza <br /> le voci si leggerebbero di
     fila su una riga sola. Si escapa riga per riga, perche' il <br /> e'
     markup nostro e non va escapato con il testo. Dove l'HTML non c'e'
     (ricevutaEmailHTML in tabella, il nome prodotto su Stripe) le righe si
     uniscono invece con ' · '. */
  return await invia(amm,
    `Buono ${b.numero} ${b.pagamento === 'promozionale' ? 'promozionale' : 'pagato'} — ${eur(b.valore)} € (${b.pagamento || ''})`,
    `<div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;">${intestazione()}</div>
    <p style="font-family:Arial;font-size:14px;">Buono <strong>${esc(b.numero)}</strong> · codice <strong>${esc(b.codice)}</strong><br />
    ${String(b.descrizione ?? '').split('\n').map((r: string) => esc(r)).join('<br />')} · ${eur(b.valore)} € · ${esc(b.pagamento || '')} ${esc(b.pagamento_rif || '')}<br />
    Acquirente: ${esc(b.acquirente || '')} &lt;${esc(b.acquirente_email || '')}&gt;<br />
    Origine: ${esc(b.creato_da || '')}</p>`,
    destinatariInCopia(b));
}

export type EsitoConsegna = 'inviato' | 'fallito' | 'senza-indirizzo';

/* Un buono puo' risultare "pagato" senza essere mai arrivato al cliente: e'
   successo davvero, perche' senza dominio verificato Resend rifiuta ogni
   indirizzo che non sia quello del titolare dell'account. Registrare
   l'esito e' l'unico modo perche' la reception se ne accorga.

   L'avviso all'amministrazione non conta: e' posta interna, e se arriva
   solo quello il cliente e' comunque rimasto senza niente. */
export function statoConsegna(esiti: Record<string, boolean>): EsitoConsegna {
  const alCliente = Object.entries(esiti).filter(([chi]) => chi !== 'amministrazione');
  if (!alCliente.length) return 'senza-indirizzo';
  return alCliente.every(([, andato]) => andato) ? 'inviato' : 'fallito';
}

/* da chiamare quando il buono passa a "pagato" (webhook E a=pagato).
   `pdf` sono i byte del foglio (index.ts li genera con pdf-buono.ts):
   quando ci sono, partono in allegato ad acquirente e destinatario. Quando
   non ci sono — il foglio non e' uscito — l'email parte lo stesso, senza:
   un buono che arriva senza il PDF e' un buono, un buono che non arriva no. */
export async function inviaBuonoEmesso(b: any, pdf: Uint8Array | null = null) {
  const L = ['it', 'de', 'en', 'fr'].includes(b.lingua) ? b.lingua : 'it';
  const e = ETI[L];
  const buono = buonoEmailHTML(b);
  /* il pulsante serve solo nelle due email che portano il buono vero (con
     un codice da stampare): il riepilogo d'acquisto e l'avviso interno più
     sotto non lo ricevono, apposta — non sono il buono, sono posta a
     margine, e uno di più non è "chi lo riceve" nel senso di stampa.ts */
  const bottone = b.codice ? bottoneStampa(b, e) : '';
  const allegati = pdf ? [allegatoPdf(b, pdf)] : [];
  const esiti: Record<string, boolean> = {};

  if (b.acquirente_email)
    esiti.acquirente = await invia(b.acquirente_email, e.oggettoAcq(b.numero),
      avvolgi(e.caro(esc(b.acquirente)), e.corpoAcq, e.saluto, buono, bottone), [], allegati);

  if (b.destinatario_email && b.destinatario_email !== b.acquirente_email)
    esiti.destinatario = await invia(b.destinatario_email, e.oggetto,
      avvolgi(e.caro(esc(b.destinatario)), e.corpoDest, e.saluto, buono, bottone), [], allegati);

  /* riepilogo d'acquisto a un indirizzo diverso, se richiesto */
  if (b.ricevuta_email)
    esiti.ricevuta = await invia(b.ricevuta_email,
      (RICEVUTA[L] || RICEVUTA.it).ogg(b.numero), ricevutaEmailHTML(b));

  if (Deno.env.get('EMAIL_AMMINISTRAZIONE'))
    esiti.amministrazione = await avvisaAmministrazione(b);

  return esiti;
}

/* ============================================================
   MANDARE IL BUONO A UNO SOLO DEI DUE — il pulsante «manda» del back
   office (?a=manda in index.ts).

   Serve quando l'ospite dice che non gli e' arrivato niente, o quando
   l'indirizzo si corregge dopo l'emissione: inviaBuonoEmesso qui sopra
   spedirebbe a tutti e due e rifarebbe partire anche l'avviso interno,
   che non c'entra — l'amministrazione ha gia' avuto il suo avviso quando
   il buono e' stato incassato, e riceverne un secondo uguale vorrebbe
   dire un incasso da riconciliare due volte.

   Torna anche l'indirizzo a cui e' andata: chi sta al banco deve poter
   leggere DOVE e' partita, e distinguere «non c'e' nessun indirizzo» (si
   rimedia scrivendolo) da «non e' partita» (si rimedia riprovando).
   ============================================================ */
export async function inviaBuonoA(
  b: any, chi: 'acquirente' | 'destinatario', pdf: Uint8Array | null,
): Promise<{ ok: boolean; a: string | null }> {
  const a = b[chi + '_email'] as string | null | undefined;
  if (!a) return { ok: false, a: null };
  const L = ['it', 'de', 'en', 'fr'].includes(b.lingua) ? b.lingua : 'it';
  const e = ETI[L];
  const bottone = b.codice ? bottoneStampa(b, e) : '';
  const corpo = avvolgi(e.caro(esc(b[chi])),
    chi === 'acquirente' ? e.corpoAcq : e.corpoDest,
    e.saluto, buonoEmailHTML(b), bottone);
  const ok = await invia(a, chi === 'acquirente' ? e.oggettoAcq(b.numero) : e.oggetto,
    corpo, [], pdf ? [allegatoPdf(b, pdf)] : []);
  return { ok, a };
}
