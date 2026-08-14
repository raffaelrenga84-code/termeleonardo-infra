/* condizioni.ts — le condizioni di cancellazione, come le manda la reception.

   I testi italiani e quelli tedesco/inglese/francese NON dicono la stessa
   cosa: l'italiano addebita il 100% da due giorni prima, gli altri da sette e
   prevedono la scala del 70% a trenta giorni per le camere con numero fisso.
   E' una divergenza VOLUTA, confermata dalla proprieta' il 14 agosto 2026:
   ogni lingua tiene il testo che l'ospite riceve gia' oggi via email.

   Su una pagina web questo significa che il selettore di lingua e' anche un
   selettore di condizioni, cosa che in un'email non succede. Se un giorno
   diventasse un problema, la soluzione e' un testo solo, non un accorgimento
   tecnico. */

export const CANCELLAZIONE: Record<string, string[]> = {
  it: [
    'L’acconto è una caparra confirmatoria: in caso di annullamento viene trattenuto.',
    'Da due giorni prima dell’arrivo, e in caso di mancato arrivo, viene addebitato il 100% delle prestazioni prenotate e non usufruite.',
    'Se parte prima o arriva dopo, il soggiorno resta addebitato per intero.',
    'Gli annullamenti valgono solo per iscritto: una email a info@termeleonardo.com.',
  ],
  de: [
    'Die Kaution wird bei einer Stornierung einbehalten.',
    'Bei einer Stornierung bis 7 Tage vor Reiseantritt wird nur die Kaution einbehalten, danach werden 100 % der gebuchten Leistungen in Rechnung gestellt.',
    'Bei einer Reservierung mit fixer Zimmernummer: ab 30 Tage vor Reiseantritt 70 %, ab 7 Tage 100 %.',
    'Bei vorzeitiger Abreise oder verspäteter Anreise werden auch die nicht in Anspruch genommenen Übernachtungen berechnet.',
    'Stornierungen sind nur in schriftlicher Form gültig: eine E-Mail an info@termeleonardo.com genügt.',
  ],
  en: [
    'The deposit is retained in case of cancellation.',
    'If you cancel up to 7 days before arrival, only the deposit is retained; after that, 100% of the booked services is charged.',
    'For bookings with a fixed room number: 70% from 30 days before arrival, 100% from 7 days.',
    'Late arrival or early departure: unused nights are charged as well.',
    'Cancellations are valid in writing only: an email to info@termeleonardo.com is enough.',
  ],
  fr: [
    'Les arrhes sont conservées en cas d’annulation.',
    'En cas d’annulation jusqu’à 7 jours avant l’arrivée, seules les arrhes sont conservées ; au-delà, 100 % des prestations réservées sont facturées.',
    'Pour les réservations avec numéro de chambre fixe : 70 % à partir de 30 jours avant l’arrivée, 100 % à partir de 7 jours.',
    'Arrivée tardive ou départ anticipé : les nuitées non utilisées sont également facturées.',
    'Les annulations ne sont valables que par écrit : un e-mail à info@termeleonardo.com suffit.',
  ],
};

export const NOTA_RECESSO: Record<string, string> = {
  it: 'Trattandosi di un servizio alberghiero con data stabilita, non è previsto il diritto di recesso.',
  de: 'Da es sich um eine Beherbergungsleistung mit festem Datum handelt, besteht kein Widerrufsrecht.',
  en: 'As this is accommodation for a set date, no right of withdrawal applies.',
  fr: 'S’agissant d’un hébergement à date déterminée, le droit de rétractation ne s’applique pas.',
};

/* whitelist esplicita, non accesso diretto alla proprieta': 'toString',
   'constructor', 'hasOwnProperty' esistono su qualunque oggetto letterale
   per ereditarieta' da Object.prototype e sarebbero truthy, restituendo una
   funzione al posto dell'array di stringhe. La lingua arriva dal corpo di
   una richiesta HTTP, quindi e' un valore che viene da fuori. */
const LINGUE = ['it', 'de', 'en', 'fr'];

export function condizioni(lingua: string): { righe: string[]; recesso: string } {
  const l = LINGUE.includes(lingua) ? lingua : 'it';
  return { righe: CANCELLAZIONE[l], recesso: NOTA_RECESSO[l] };
}
