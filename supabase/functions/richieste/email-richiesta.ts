/* ============================================================
   email-richiesta.ts — l'avviso che arriva all'hotel quando dal sito
   entra una richiesta di preventivo.

   Costruito a tabelle come gli altri: Outlook non regge i layout moderni.
   Il campo reply_to punta all'ospite, non all'hotel: rispondere all'avviso
   deve bastare, senza ricopiare l'indirizzo a mano.
   ============================================================ */

import type { Richiesta } from './valida.ts';

type ConNumero = Richiesta & { numero: string };

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

const LINGUE: Record<string, string> = {
  it: 'Italiano', de: 'Tedesco', en: 'Inglese', fr: 'Francese',
};

/* l'ospite scrive 2026-09-10, chi legge in reception pensa in 10/09/2026 */
function data(iso: string): string {
  const [a, m, g] = String(iso || '').split('-');
  return g ? `${g}/${m}/${a}` : '';
}

/* una riga solo se ha qualcosa da dire: le righe vuote fanno sembrare
   l'avviso rotto e allungano la lettura per niente */
function riga(etichetta: string, valore: string, forte = false): string {
  if (!valore) return '';
  return `<tr>
    <td style="padding:7px 14px 7px 0;color:#7A8A86;font-size:13px;white-space:nowrap;vertical-align:top;">${esc(etichetta)}</td>
    <td style="padding:7px 0;color:#1B4D4A;font-size:${forte ? '16px;font-weight:bold' : '14px'};">${esc(valore)}</td>
  </tr>`;
}

/* il marchio va in PNG: nelle email l'SVG non si vede. Stesso file usato
   dal buono, cosi' l'ospite riconosce chi gli scrive */
const BASE_IMG = 'https://arrivo-terme-leonardo.vercel.app/buoni/img';

export function richiestaHTML(r: ConNumero): string {
  const periodo = `${data(r.check_in)} → ${data(r.check_out)}`;
  const soggiorno = `${r.notti} notti · ${r.ospiti} ospiti`;
  return `<table cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:100%;
  border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;background:#FFFFFF;">
<tr><td style="padding:26px 28px;">
  <img src="${BASE_IMG}/logo.png" width="150" alt="Hotel Terme Leonardo"
    style="display:block;width:150px;height:auto;border:0;padding-bottom:16px;
    border-bottom:1px solid #E6E2D8;" />
  <div style="font-size:10px;letter-spacing:2px;color:#C9A961;padding-top:18px;">RICHIESTA DAL SITO</div>
  <div style="font-size:22px;color:#1B4D4A;margin-top:6px;font-family:Georgia,serif;">${esc(r.nome)}</div>
  <div style="font-size:12px;color:#9AA9A6;margin-top:3px;">${esc(r.numero)}</div>

  <table cellpadding="0" cellspacing="0" border="0" width="100%"
    style="margin-top:20px;border-collapse:collapse;border-top:1px solid #E6E2D8;">
    ${riga('Periodo', periodo, true)}
    ${riga('Soggiorno', soggiorno)}
    ${riga('Email', r.email)}
    ${riga('Telefono', r.telefono)}
    ${riga('Camera', r.tipo_camera)}
    ${riga('Pacchetto', r.pacchetto)}
    ${riga('Lingua', LINGUE[r.lingua] || LINGUE.it)}
  </table>

  ${r.messaggio
    ? `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:18px;border-collapse:collapse;">
      <tr><td style="border-left:3px solid #C9A961;background:#FBFAF7;padding:14px 16px;
        font-size:14px;line-height:1.6;color:#4A5C59;">${esc(r.messaggio)}</td></tr>
    </table>`
    : ''}

  <div style="margin-top:22px;padding-top:14px;border-top:1px solid #E6E2D8;font-size:12px;color:#8A938F;line-height:1.6;">
    Rispondendo a questa email si scrive direttamente all’ospite.
  </div>
</td></tr>
</table>`;
}

export async function avvisaHotel(r: ConNumero): Promise<boolean> {
  const chiave = Deno.env.get('RESEND_API_KEY');
  if (!chiave) {
    /* la richiesta e' gia' salvata: senza avviso la si ritrova nell'elenco
       del back office. Meglio un avviso mancato che una richiesta persa. */
    console.error('avviso non inviato: RESEND_API_KEY mancante ->', r.numero);
    return false;
  }
  const a = Deno.env.get('EMAIL_HOTEL') || 'info@termeleonardo.com';
  try {
    const risposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${chiave}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: Deno.env.get('MITTENTE_EMAIL') || 'Hotel Terme Leonardo <onboarding@resend.dev>',
        to: a,
        reply_to: r.email,
        subject: `${r.numero} · richiesta dal sito · ${r.nome}`,
        html: richiestaHTML(r),
      }),
    });
    if (!risposta.ok) {
      console.error('Resend ha risposto', risposta.status, await risposta.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error('avviso non inviato:', e instanceof Error ? e.message : String(e));
    return false;
  }
}
