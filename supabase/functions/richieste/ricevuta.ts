/* ============================================================
   ricevuta.ts — quello che l'ospite riceve appena preme invia.

   PERCHE' ESISTE. Chi manda una richiesta dal sito non riceveva NULLA.
   Vedeva il riferimento sullo schermo e poi silenzio, finche' qualcuno in
   reception non rispondeva a mano. Chiusa la scheda, non gli restava ne' il
   riferimento ne' la prova di aver inviato.

   L'asimmetria era la spia: chi COMPRA un buono riceve l'email, automatica.
   Chi CHIEDE un trattamento no — ed e' lui quello che sta aspettando una
   risposta.

   NON SOSTITUISCE NIENTE. La risposta vera resta la conferma che la
   reception manda a mano da conferma.ts. Questa dice solo «e' arrivata».

   PERCHE' E' COSI' CORTA. Il rischio centrale non e' tecnico: il sistema
   ripete ovunque «questa e' una richiesta, non una prenotazione», e
   un'email col nostro logo, il riferimento e i dati del soggiorno SI LEGGE
   COME UNA CONFERMA. L'ospite si presenta convinto. E' lo stesso difetto
   dell'avviso che prometteva «giorno e prezzo» a chi aveva gia' pagato col
   buono, solo piu' caro. Ogni riga in piu' e' una riga in piu' che puo'
   essere scambiata per un impegno.

   Il blocco «cosa ha chiesto» arriva da dettagli-richiesta.ts, lo stesso
   che usa la conferma: ricopiarlo vorrebbe dire due formattazioni che un
   giorno divergono, e l'ospite leggerebbe una cosa qui e un'altra nella
   conferma — peggio che non avere la ricevuta.
   ============================================================ */

import { dettagli, esc, ETICHETTE, linguaDi } from './dettagli-richiesta.ts';

const BASE_IMG = 'https://arrivo-terme-leonardo.vercel.app/buoni/img';
const TELEFONO = '+39 049 9939200';
const EMAIL_HOTEL = 'info@termeleonardo.com';

export type Richiesta = {
  numero: string;
  tipo?: string;
  nome?: string;
  email: string;
  lingua?: string;
  dati?: Record<string, unknown> | null;
  [k: string]: unknown;
};

/* Solo i testi di QUESTA email. Le etichette dei campi stanno in
   dettagli-richiesta.ts.

   `nonPrenotazione` e' la riga che porta il peso di tutta la faccenda: e'
   l'unica cosa che impedisce a questa email di essere letta come una
   conferma. Se un domani qualcuno la accorcia o la ammorbidisce, il difetto
   torna. */
const T: Record<string, Record<string, string>> = {
  it: {
    occhiello: 'RICEVUTA', caro: 'Gentile', titolo: 'Abbiamo ricevuto la sua richiesta',
    intro: 'Ecco cosa ci ha chiesto.',
    nonPrenotazione: 'Non è ancora una prenotazione: le confermiamo noi, per email o al telefono.',
    chiusura: 'Per qualsiasi cosa risponda a questa email, oppure ci chiami.',
    dettagli: 'La sua richiesta', saluto: 'A presto,<br />Hotel Terme Leonardo',
    oggetto: 'Abbiamo ricevuto la sua richiesta',
  },
  de: {
    occhiello: 'EINGANGSBESTÄTIGUNG', caro: 'Sehr geehrte(r)', titolo: 'Wir haben Ihre Anfrage erhalten',
    intro: 'Hier ist, was Sie angefragt haben.',
    nonPrenotazione: 'Dies ist noch keine Buchung: wir bestätigen Ihnen per E-Mail oder telefonisch.',
    chiusura: 'Für alles Weitere antworten Sie auf diese E-Mail oder rufen Sie uns an.',
    dettagli: 'Ihre Anfrage', saluto: 'Bis bald,<br />Hotel Terme Leonardo',
    oggetto: 'Wir haben Ihre Anfrage erhalten',
  },
  en: {
    occhiello: 'RECEIPT', caro: 'Dear', titolo: 'We have received your request',
    intro: 'Here is what you asked for.',
    nonPrenotazione: 'This is not a booking yet: we will confirm by email or by phone.',
    chiusura: 'For anything at all, reply to this email or give us a call.',
    dettagli: 'Your request', saluto: 'See you soon,<br />Hotel Terme Leonardo',
    oggetto: 'We have received your request',
  },
  fr: {
    occhiello: 'ACCUSÉ DE RÉCEPTION', caro: 'Cher/Chère', titolo: 'Nous avons bien reçu votre demande',
    intro: 'Voici ce que vous nous avez demandé.',
    nonPrenotazione: 'Ce n’est pas encore une réservation : nous vous confirmons par e-mail ou par téléphone.',
    chiusura: 'Pour toute question, répondez à cet e-mail ou appelez-nous.',
    dettagli: 'Votre demande', saluto: 'À bientôt,<br />Hotel Terme Leonardo',
    oggetto: 'Nous avons bien reçu votre demande',
  },
};

export function ricevutaHTML(r: Richiesta): string {
  const l = linguaDi(r.lingua);
  const t = { ...ETICHETTE[l], ...T[l] };
  /* IL RIEPILOGO VEDE ANCHE LE COLONNE. Per il transfer o i trattamenti
     tutto quello che serve sta in `dati`; per una richiesta di camera no:
     le date, la camera e il pacchetto sono COLONNE della tabella, e
     passando solo `dati` il riepilogo restava vuoto — l'email annunciava
     «Ecco cosa ci ha chiesto» e mostrava il solo numero. `r` porta gia'
     dentro anche i campi di `dati` appiattiti, quindi per gli altri tipi
     non cambia niente: gli stessi valori, dalla stessa fonte. */
  const d = { ...r, ...((r.dati || {}) as Record<string, unknown>) } as Record<string, unknown>;

  return `<table cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:100%;
  border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;background:#FFFFFF;">
<tr><td style="padding:26px 28px;">
  <img src="${BASE_IMG}/logo-nero.png" width="220" alt="Hotel Terme Leonardo"
    style="display:block;width:220px;height:auto;border:0;padding-bottom:18px;
    border-bottom:1px solid #E6E2D8;" />

  <div style="font-size:10px;letter-spacing:2px;color:#C9A961;padding-top:18px;">${esc(t.occhiello)}</div>
  <div style="font-size:23px;color:#1B4D4A;margin-top:6px;font-family:Georgia,serif;">${esc(t.titolo)}</div>

  <p style="font-size:15px;line-height:1.65;color:#3C5346;margin-top:18px;">
    ${esc(t.caro)} ${esc(r.nome || '')},<br />${esc(t.intro)}
  </p>

  <table cellpadding="0" cellspacing="0" border="0" width="100%"
    style="margin-top:20px;border-collapse:collapse;border-top:1px solid #E6E2D8;">
    ${dettagli(String(r.tipo ?? ''), d, t)}
    <tr>
      <td style="padding:7px 16px 7px 0;color:#8A938F;font-size:13px;white-space:nowrap;vertical-align:top;">${esc(t.rif)}</td>
      <td style="padding:7px 0;color:#1B4D4A;font-size:15px;">${esc(r.numero)}</td>
    </tr>
  </table>

  <!-- LA RIGA CHE PORTA IL PESO. Non e' decorazione: e' l'unica cosa che
       impedisce a questa email di essere letta come una conferma. Sta in
       evidenza apposta, e non si ammorbidisce. -->
  <div style="margin-top:20px;background:#FFF6E8;border-left:4px solid #C9A961;
    padding:13px 15px;border-radius:6px;font-size:14px;line-height:1.6;color:#6B4A22;">
    <strong>${esc(t.nonPrenotazione)}</strong>
  </div>

  <p style="font-size:15px;line-height:1.65;color:#3C5346;margin-top:18px;">${esc(t.chiusura)}</p>

  <p style="font-size:15px;line-height:1.65;color:#3C5346;margin-top:18px;">${t.saluto}</p>

  <div style="border-top:1px solid #E6E2D8;margin-top:20px;padding-top:14px;
    font-size:12.5px;color:#8A938F;line-height:1.6;">
    Hotel Terme Leonardo · Via Monteortone, 46, 35037 Monteortone di Abano Terme (PD)<br />
    ${TELEFONO} · ${EMAIL_HOTEL}
  </div>
</td></tr></table>`;
}

/** Manda la ricevuta all'ospite. Non fa mai fallire la richiesta: se non
 *  parte, la richiesta e' comunque salvata e l'ospite ha gia' letto
 *  «ricevuta» sullo schermo, col riferimento. */
export async function inviaRicevuta(r: Richiesta): Promise<boolean> {
  const chiave = Deno.env.get('RESEND_API_KEY');
  if (!chiave) {
    console.error('ricevuta non inviata: RESEND_API_KEY mancante ->', r.numero);
    return false;
  }
  /* senza indirizzo non c'e' niente da provare: la validazione l'email la
     pretende, ma questa funzione non deve dipendere da quella per non
     spedire nel vuoto */
  const a = String(r.email || '').trim();
  if (!a) {
    console.error('ricevuta non inviata: ospite senza email ->', r.numero);
    return false;
  }

  const l = linguaDi(r.lingua);
  try {
    const risposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${chiave}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: Deno.env.get('MITTENTE_EMAIL') || 'Hotel Terme Leonardo <noreply@hoteltermeleonardo.com>',
        to: a,
        /* ALL'HOTEL, non all'ospite: se risponde deve arrivare in reception.
           E' l'opposto dell'avviso, dove reply_to punta all'ospite proprio
           perche' quello lo legge la reception. */
        reply_to: Deno.env.get('EMAIL_HOTEL') || EMAIL_HOTEL,
        subject: `${T[l].oggetto} · ${r.numero}`,
        html: ricevutaHTML(r),
      }),
    });
    if (!risposta.ok) {
      console.error('Resend ha risposto', risposta.status, await risposta.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error('ricevuta non inviata:', e instanceof Error ? e.message : String(e));
    return false;
  }
}
