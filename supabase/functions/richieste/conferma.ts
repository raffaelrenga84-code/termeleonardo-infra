/* ============================================================
   conferma.ts — la risposta che l'hotel manda all'ospite.

   E' l'unica email che l'ospite legge davvero. Ripete i dati DEFINITIVI,
   non quelli che aveva chiesto: la reception puo' aver spostato l'orario, e
   se qui restasse quello vecchio l'ospite si presenterebbe all'ora
   sbagliata.

   Costruita a tabelle come le altre: Outlook non regge i layout moderni.
   ============================================================ */

const BASE_IMG = 'https://arrivo-terme-leonardo.vercel.app/buoni/img';
const TELEFONO = '+39 049 9939200';
const EMAIL_HOTEL = 'info@termeleonardo.com';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

export type Richiesta = {
  numero: string;
  tipo?: string;
  nome?: string;
  email: string;
  lingua?: string;
  messaggio?: string;
  dati?: Record<string, unknown> | null;
  [k: string]: unknown;
};

const T: Record<string, Record<string, string>> = {
  it: {
    occhiello: 'CONFERMA', caro: 'Gentile', titolo: 'La sua richiesta è confermata',
    intro: 'Le confermiamo quanto organizzato. Se qualcosa non torna, risponda a questa email o ci chiami: facciamo in tempo a correggere.',
    dettagli: 'Il dettaglio', saluto: 'A presto,<br />Hotel Terme Leonardo',
    quando: 'Quando', dove: 'Dove', persone: 'Persone', volo: 'Volo / treno',
    ritorno: 'Ritorno incluso', rif: 'Riferimento',
    oggetto: 'confermata',
  },
  de: {
    occhiello: 'BESTÄTIGUNG', caro: 'Sehr geehrte(r)', titolo: 'Ihre Anfrage ist bestätigt',
    intro: 'Hiermit bestätigen wir das Vereinbarte. Sollte etwas nicht stimmen, antworten Sie einfach auf diese E-Mail oder rufen Sie uns an: wir können es noch ändern.',
    dettagli: 'Die Einzelheiten', saluto: 'Bis bald,<br />Hotel Terme Leonardo',
    quando: 'Wann', dove: 'Wo', persone: 'Personen', volo: 'Flug / Zug',
    ritorno: 'Rückfahrt inbegriffen', rif: 'Referenz',
    oggetto: 'bestätigt',
  },
  en: {
    occhiello: 'CONFIRMATION', caro: 'Dear', titolo: 'Your request is confirmed',
    intro: 'Here is what we have arranged. If anything is not right, reply to this email or call us: there is still time to change it.',
    dettagli: 'The details', saluto: 'See you soon,<br />Hotel Terme Leonardo',
    quando: 'When', dove: 'Where', persone: 'People', volo: 'Flight / train',
    ritorno: 'Return trip included', rif: 'Reference',
    oggetto: 'confirmed',
  },
  fr: {
    occhiello: 'CONFIRMATION', caro: 'Cher/Chère', titolo: 'Votre demande est confirmée',
    intro: 'Voici ce que nous avons organisé. Si quelque chose ne va pas, répondez à cet e-mail ou appelez-nous : il est encore temps de corriger.',
    dettagli: 'Le détail', saluto: 'À bientôt,<br />Hotel Terme Leonardo',
    quando: 'Quand', dove: 'Où', persone: 'Personnes', volo: 'Vol / train',
    ritorno: 'Retour inclus', rif: 'Référence',
    oggetto: 'confirmée',
  },
};

/* l'ospite scrive 2026-09-10, ma legge 10/09/2026 */
function data(iso: unknown): string {
  const [a, m, g] = String(iso ?? '').split('-');
  return g ? `${g}/${m}/${a}` : '';
}

function riga(etichetta: string, valore: string): string {
  if (!valore) return '';
  return `<tr>
    <td style="padding:7px 16px 7px 0;color:#8A938F;font-size:13px;white-space:nowrap;vertical-align:top;">${esc(etichetta)}</td>
    <td style="padding:7px 0;color:#1B4D4A;font-size:15px;">${esc(valore)}</td>
  </tr>`;
}

/* Ogni tipo racconta le sue cose. Un tipo non ancora previsto non rompe
   niente: mostra solo il riferimento, che e' meglio di "undefined". */
function dettagli(tipo: string, d: Record<string, unknown>, t: Record<string, string>): string {
  if (tipo === 'transfer') {
    const verso = d.verso === 'partenza' ? '→' : '←';
    return [
      riga(t.quando, `${data(d.quando)}${d.ora ? ' · ' + String(d.ora) : ''}`),
      riga(t.dove, `${verso} ${String(d.luogo ?? '')}`),
      riga(t.persone, String(d.pax ?? '')),
      riga(t.volo, String(d.volo ?? '')),
      d.ritorno === true ? riga(t.ritorno, '✓') : '',
    ].join('');
  }
  return '';
}

export function confermaHTML(r: Richiesta): string {
  const l = ['it', 'de', 'en', 'fr'].includes(String(r.lingua)) ? String(r.lingua) : 'it';
  const t = T[l];
  const d = (r.dati || {}) as Record<string, unknown>;
  const messaggio = String(r.messaggio ?? '').trim();

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
    ${riga(t.rif, String(r.numero))}
  </table>

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
  const l = ['it', 'de', 'en', 'fr'].includes(String(r.lingua)) ? String(r.lingua) : 'it';
  try {
    const risposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${chiave}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: Deno.env.get('MITTENTE_EMAIL') || 'Hotel Terme Leonardo <onboarding@resend.dev>',
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
