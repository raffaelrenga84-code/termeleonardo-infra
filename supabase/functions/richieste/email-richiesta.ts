/* ============================================================
   email-richiesta.ts — l'avviso che arriva all'hotel quando dal sito
   entra una richiesta di preventivo.

   Costruito a tabelle come gli altri: Outlook non regge i layout moderni.
   Il campo reply_to punta all'ospite, non all'hotel: rispondere all'avviso
   deve bastare, senza ricopiare l'indirizzo a mano.
   ============================================================ */

import type { Richiesta } from './valida.ts';

/* I tipi diversi dal soggiorno portano campi propri, che arrivano qui
   insieme ai contatti: il tipo resta aperto invece di elencarli tutti. */
export type ConNumero =
  & Partial<Richiesta>
  & { numero: string; nome: string; email: string }
  & Record<string, unknown>;

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

/* Marchio nero su bianco: il logo.png del buono ha il fondo verde acqua
   incorporato e da solo mostra il rettangolo. PNG e non SVG perche' nelle
   email l'SVG non si vede; bianco e non trasparente perche' un nero su
   trasparente sparisce nei programmi che invertono i colori. */
const BASE_IMG = 'https://arrivo-terme-leonardo.vercel.app/buoni/img';

/* Ogni tipo di richiesta ha righe sue: un transfer non ha notti da contare,
   e mostrargli le righe del soggiorno riempirebbe l'avviso di "undefined". */
const ETICHETTA: Record<string, string> = {
  soggiorno: 'RICHIESTA DAL SITO',
  transfer: 'RICHIESTA TRANSFER',
  greenfee: 'RICHIESTA GREEN FEE',
  maestro: 'LEZIONE CON IL MAESTRO',
  trattamenti: 'RICHIESTA TRATTAMENTI',
};

function righeTransfer(r: Record<string, unknown>, riga: (e: string, v: string, f?: boolean) => string): string {
  const verso = r.verso === 'partenza' ? 'Partenza per' : 'Arrivo da';
  return [
    riga('Quando', `${data(String(r.quando))} alle ${String(r.ora ?? '')}`, true),
    riga(verso, String(r.luogo ?? '')),
    riga('Passeggeri', `${r.pax}${r.ritorno === true ? ' · con ritorno' : ''}`),
    riga('Volo / treno', String(r.volo ?? '')),
  ].join('');
}

function righeGreenfee(r: Record<string, unknown>, riga: (e: string, v: string, f?: boolean) => string): string {
  const noleggi = [
    r.golfcar === true ? 'golf car' : '',
    r.carrello === true ? 'carrello' : '',
    r.carrello_elettrico === true ? 'carrello elettrico' : '',
    r.sacca === true ? 'sacca' : '',
  ].filter(Boolean).join(' · ');
  return [
    riga('Circolo', String(r.circolo_nome ?? r.circolo ?? ''), true),
    riga('Quando', `${data(String(r.data))} alle ${String(r.ora ?? '')}`),
    riga('Giocatori', String(r.giocatori ?? '')),
    riga('Percorso', String(r.percorso ?? '')),
    riga('Noleggi', noleggi),
    riga('Tessera', String(r.tessera ?? '')),
    /* il taxi e' parte della stessa richiesta: la reception deve vederlo
       qui, non scoprirlo dopo aver prenotato solo il campo */
    r.taxi === true
      ? riga('Taxi', `dall’hotel alle ${String(r.taxi_ora ?? '')}${r.taxi_ritorno === true ? ' · con ritorno' : ''} → ${String(r.taxi_luogo ?? '')}`)
      : '',
  ].join('');
}

function righeMaestro(r: Record<string, unknown>, riga: (e: string, v: string, f?: boolean) => string): string {
  return [
    riga('Quando', `${data(String(r.data))} alle ${String(r.ora ?? '')}`, true),
    riga('Persone', String(r.persone ?? '')),
    riga('Livello', String(r.livello ?? '')),
  ].join('');
}

function righeTrattamenti(r: Record<string, unknown>, riga: (e: string, v: string, f?: boolean) => string): string {
  const voci = Array.isArray(r.voci) ? (r.voci as string[]) : [];
  return [
    riga('Giorno', `${data(String(r.giorno))} · ${String(r.fascia ?? '')}`, true),
    riga('Trattamenti', voci.join(' · ')),
  ].join('');
}

export function richiestaHTML(r: ConNumero): string {
  /* i campi del soggiorno sono facoltativi da quando l'avviso serve anche
     agli altri tipi: si leggono sempre passando da qui, cosi' un campo
     assente diventa una riga vuota che non si stampa, mai "undefined" */
  const s = (v: unknown) => String(v ?? '');
  const tipo = s(r.tipo) || 'soggiorno';
  const periodo = `${data(s(r.check_in))} → ${data(s(r.check_out))}`;
  const soggiorno = `${r.notti} notti · ${r.ospiti} ospiti`;
  return `<table cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:100%;
  border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;background:#FFFFFF;">
<tr><td style="padding:26px 28px;">
  <img src="${BASE_IMG}/logo-nero.png" width="220" alt="Hotel Terme Leonardo"
    style="display:block;width:220px;height:auto;border:0;padding-bottom:18px;
    border-bottom:1px solid #E6E2D8;" />
  <div style="font-size:10px;letter-spacing:2px;color:#C9A961;padding-top:18px;">${
    esc(ETICHETTA[tipo] || ETICHETTA.soggiorno)}</div>
  <div style="font-size:22px;color:#1B4D4A;margin-top:6px;font-family:Georgia,serif;">${esc(r.nome)}</div>
  <div style="font-size:12px;color:#9AA9A6;margin-top:3px;">${esc(r.numero)}</div>

  <table cellpadding="0" cellspacing="0" border="0" width="100%"
    style="margin-top:20px;border-collapse:collapse;border-top:1px solid #E6E2D8;">
    ${(() => {
      const d = r as unknown as Record<string, unknown>;
      if (tipo === 'transfer') return righeTransfer(d, riga);
      if (tipo === 'greenfee') return righeGreenfee(d, riga);
      if (tipo === 'maestro') return righeMaestro(d, riga);
      if (tipo === 'trattamenti') return righeTrattamenti(d, riga);
      return riga('Periodo', periodo, true) + riga('Soggiorno', soggiorno);
    })()}
    ${riga('Email', s(r.email))}
    ${riga('Telefono', s(r.telefono))}
    ${riga('Camera', s(r.tipo_camera))}
    ${riga('Pacchetto', s(r.pacchetto))}
    ${riga('Lingua', LINGUE[s(r.lingua)] || LINGUE.it)}
  </table>

  ${(() => {
    /* il soggiorno chiama questo campo `messaggio`, gli altri tipi `note`:
       guardarne uno solo faceva sparire in silenzio quello che l'ospite ha
       scritto, ed e' spesso la cosa piu' importante della richiesta */
    const libero = String(r.messaggio ?? r.note ?? '').trim();
    return libero
      ? `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:18px;border-collapse:collapse;">
      <tr><td style="border-left:3px solid #C9A961;background:#FBFAF7;padding:14px 16px;
        font-size:14px;line-height:1.6;color:#4A5C59;">${esc(libero)}</td></tr>
    </table>`
      : '';
  })()}

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
        from: Deno.env.get('MITTENTE_EMAIL') || 'Hotel Terme Leonardo <noreply@hoteltermeleonardo.com>',
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
