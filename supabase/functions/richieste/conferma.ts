/* ============================================================
   conferma.ts — la risposta che l'hotel manda all'ospite.

   E' l'unica email che l'ospite legge davvero. Ripete i dati DEFINITIVI,
   non quelli che aveva chiesto: la reception puo' aver spostato l'orario, e
   se qui restasse quello vecchio l'ospite si presenterebbe all'ora
   sbagliata.

   Costruita a tabelle come le altre: Outlook non regge i layout moderni.
   ============================================================ */

import { differenze, etichettaCampo, type Differenza } from './differenze.ts';
import {
  CHIAVI_MOSTRATE, dettagli, esc, ETICHETTE, linguaDi, riga,
} from './dettagli-richiesta.ts';

const BASE_IMG = 'https://arrivo-terme-leonardo.vercel.app/buoni/img';
const TELEFONO = '+39 049 9939200';
const EMAIL_HOTEL = 'info@termeleonardo.com';

export type Richiesta = {
  numero: string;
  tipo?: string;
  nome?: string;
  email: string;
  lingua?: string;
  messaggio?: string;
  dati?: Record<string, unknown> | null;
  /* La richiesta come l'ospite l'aveva scritta, mai piu' toccata dopo la
     creazione (vedi componi-richiesta.ts / index.ts, insert). Assente o
     null sulle righe mai corrette: in quel caso non c'e' niente da
     confrontare, non "tutto e' cambiato". */
  dati_originali?: Record<string, unknown> | null;
  /* La casella del back office "segnala all'ospite cosa e' cambiato". Il
     riquadro delle differenze compare SOLO se questo e' vero E ci sono
     davvero differenze — mai uno dei due da solo. */
  segnala_modifiche?: boolean;
  [k: string]: unknown;
};

/* Solo i testi che sono di questa email. Le etichette dei campi stanno in
   dettagli-richiesta.ts, e le due cose si mescolano al momento di scrivere:
   `{ ...ETICHETTE[l], ...T[l] }`. Prima erano tutte qui, e finche' l'unica
   email col blocco «cosa ha chiesto» era questa andava bene. */
const T: Record<string, Record<string, string>> = {
  it: {
    occhiello: 'CONFERMA', caro: 'Gentile', titolo: 'La sua richiesta è confermata',
    intro: 'Le confermiamo quanto organizzato. Se qualcosa non torna, risponda a questa email o ci chiami: facciamo in tempo a correggere.',
    dettagli: 'Il dettaglio', saluto: 'A presto,<br />Hotel Terme Leonardo',
    oggetto: 'confermata',
  },
  de: {
    occhiello: 'BESTÄTIGUNG', caro: 'Sehr geehrte(r)', titolo: 'Ihre Anfrage ist bestätigt',
    intro: 'Hiermit bestätigen wir das Vereinbarte. Sollte etwas nicht stimmen, antworten Sie einfach auf diese E-Mail oder rufen Sie uns an: wir können es noch ändern.',
    dettagli: 'Die Einzelheiten', saluto: 'Bis bald,<br />Hotel Terme Leonardo',
    oggetto: 'bestätigt',
  },
  en: {
    occhiello: 'CONFIRMATION', caro: 'Dear', titolo: 'Your request is confirmed',
    intro: 'Here is what we have arranged. If anything is not right, reply to this email or call us: there is still time to change it.',
    dettagli: 'The details', saluto: 'See you soon,<br />Hotel Terme Leonardo',
    oggetto: 'confirmed',
  },
  fr: {
    occhiello: 'CONFIRMATION', caro: 'Cher/Chère', titolo: 'Votre demande est confirmée',
    intro: 'Voici ce que nous avons organisé. Si quelque chose ne va pas, répondez à cet e-mail ou appelez-nous : il est encore temps de corriger.',
    dettagli: 'Le détail', saluto: 'À bientôt,<br />Hotel Terme Leonardo',
    oggetto: 'confirmée',
  },
};


/* Le differenze compaiono SOLO se l'operatore ha spuntato la casella E ci
   sono davvero differenze: `differenze()` gia' restituisce un elenco vuoto
   quando dati_originali manca, e' null, o coincide col dato attuale — qui
   basta il gate sulla casella, mai il contrario (mostrare quando manca la
   casella ma ci sarebbero differenze). */
function differenzeDaMostrare(r: Richiesta): Differenza[] {
  if (r.segnala_modifiche !== true) return [];
  return differenze(r.dati_originali, r.dati);
}

/* Una riga per differenza, nello stesso stile a due colonne di riga():
   l'etichetta e' il campo cambiato, il valore affianca cosa l'ospite aveva
   chiesto e cosa gli si conferma adesso. esc() dentro riga() copre l'intera
   stringa, quindi un valore con `<` dentro (scritto dall'ospite) esce
   sfuggito comunque. */
function rigaDifferenza(diff: Differenza, t: Record<string, string>): string {
  const prima = diff.prima || '—';
  const adesso = diff.adesso || '—';
  return riga(diff.campo, `${t.chiesto}: ${prima} → ${t.confermato}: ${adesso}`);
}

function boxDifferenze(diffs: Differenza[], t: Record<string, string>): string {
  if (diffs.length === 0) return '';
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:18px;border-collapse:collapse;">
    <tr><td style="padding-bottom:4px;font-size:12.5px;color:#8A938F;">${esc(t.modifiche)}</td></tr>
  </table>
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border-top:1px solid #E6E2D8;">
    ${diffs.map((diff) => rigaDifferenza(diff, t)).join('')}
  </table>`;
}

export function confermaHTML(r: Richiesta): string {
  const l = linguaDi(r.lingua);
  const t = { ...ETICHETTE[l], ...T[l] };
  const d = (r.dati || {}) as Record<string, unknown>;
  const messaggio = String(r.messaggio ?? '').trim();
  const diffs = differenzeDaMostrare(r);

  /* i dati com'erano, ma SOLO se c'e' qualcosa da segnalare: senza la spunta
     dell'operatore non deve comparire niente, nemmeno accanto al campo */
  const originali = diffs.length > 0 && r.dati_originali && typeof r.dati_originali === 'object'
    ? r.dati_originali as Record<string, unknown>
    : null;

  /* quello che le righe qui sopra NON hanno gia' mostrato: senza il riquadro
     in coda una modifica su un campo che quel tipo non disegna sparirebbe
     del tutto. Stessa idea di differenzeNonMostrate() nel back office. */
  const coperte = new Set(
    (CHIAVI_MOSTRATE[String(r.tipo ?? '')] ?? []).map(etichettaCampo),
  );
  const avanzi = diffs.filter((x) => !coperte.has(x.campo));

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
    ${dettagli(String(r.tipo ?? ''), d, t, originali)}
    ${riga(t.rif, String(r.numero))}
  </table>

  ${boxDifferenze(avanzi, t)}

  ${messaggio
    ? `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:18px;border-collapse:collapse;">
      <tr><td style="border-left:3px solid #C9A961;background:#FBFAF7;padding:14px 16px;
        font-size:14.5px;line-height:1.65;color:#4A5C59;">${esc(messaggio)}</td></tr>
    </table>`
    : ''}

  <p style="font-size:15px;line-height:1.65;color:#3C5346;margin-top:22px;">${t.saluto}</p>

  <div style="margin-top:22px;padding-top:14px;border-top:1px solid #E6E2D8;
    font-size:13px;color:#5C736F;line-height:1.7;">
    <strong style="color:#1B4D4A;">${TELEFONO}</strong><br />
    ${EMAIL_HOTEL}<br />www.termeleonardo.com
  </div>
</td></tr>
</table>`;
}

export async function inviaConferma(r: Richiesta): Promise<boolean> {
  const chiave = Deno.env.get('RESEND_API_KEY');
  if (!chiave) {
    console.error('conferma non inviata: RESEND_API_KEY mancante ->', r.numero);
    return false;
  }
  const l = linguaDi(r.lingua);
  try {
    const risposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${chiave}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: Deno.env.get('MITTENTE_EMAIL') || 'Hotel Terme Leonardo <noreply@hoteltermeleonardo.com>',
        to: r.email,
        /* rispondendo, l'ospite scrive all'hotel: e' la sua via per
           correggere qualcosa senza cercare l'indirizzo */
        reply_to: Deno.env.get('EMAIL_HOTEL') || EMAIL_HOTEL,
        subject: `${r.numero} · Hotel Terme Leonardo · ${T[l].oggetto}`,
        html: confermaHTML(r),
      }),
    });
    if (!risposta.ok) {
      console.error('Resend ha risposto', risposta.status, await risposta.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error('conferma non inviata:', e instanceof Error ? e.message : String(e));
    return false;
  }
}
