/* ============================================================
   ricevuta-arrivo.ts — l'unica email che riceve chi compila il check-in.

   Una compilazione fa nascere fino a tre richieste. Tre ricevute in fila,
   stesso minuto, stesso ospite, si leggono come un guasto: chi ha
   compilato UN modulo si aspetta UNA risposta.

   IL RIEPILOGO NON SI RISCRIVE. riepilogoRichiesta() lo sa gia' fare, ed e'
   la stessa frase che legge la reception in back office: due scritture
   divergerebbero, e l'ospite e la reception si troverebbero a parlare di
   due cose diverse con lo stesso numero in mano.
   ============================================================ */
import { riepilogoRichiesta } from './riepilogo.ts';

export type Ospite = { nome: string; email: string; lingua: string };
export type RigaRicevuta = {
  numero: string;
  tipo: string;
  dati: Record<string, unknown> | null;
};

const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* «le abbiamo prese in carico», e nient'altro: nessun orario confermato,
   nessun prezzo. Quelli arrivano con la conferma, quando li abbiamo. */
const TESTI: Record<string, {
  oggetto: string; caro: (n: string) => string; intro: string;
  chiusura: string; saluto: string;
}> = {
  it: {
    oggetto: 'Abbiamo ricevuto i suoi dati per l’arrivo',
    caro: (n) => `Gentile ${n},`,
    intro: 'abbiamo ricevuto quanto segue.',
    chiusura: 'Se qualcosa non torna, risponda a questa email.',
    saluto: 'A presto,<br />Hotel Terme Leonardo',
  },
  de: {
    oggetto: 'Wir haben Ihre Anreisedaten erhalten',
    caro: (n) => `Sehr geehrte(r) ${n},`,
    intro: 'wir haben Folgendes erhalten.',
    chiusura: 'Sollte etwas nicht stimmen, antworten Sie einfach auf diese E-Mail.',
    saluto: 'Bis bald,<br />Hotel Terme Leonardo',
  },
  en: {
    oggetto: 'We have received your arrival details',
    caro: (n) => `Dear ${n},`,
    intro: 'we have received the following.',
    chiusura: 'If anything is not right, just reply to this email.',
    saluto: 'See you soon,<br />Hotel Terme Leonardo',
  },
  fr: {
    oggetto: 'Nous avons bien reçu vos informations d’arrivée',
    caro: (n) => `Cher/Chère ${n},`,
    intro: 'nous avons bien reçu ce qui suit.',
    chiusura: 'Si quelque chose ne va pas, répondez simplement à cet email.',
    saluto: 'À bientôt,<br />Hotel Terme Leonardo',
  },
};

export function ricevutaArrivoHTML(o: Ospite, righe: RigaRicevuta[]): string {
  const t = TESTI[o.lingua] || TESTI.it;
  const voci = righe.map((r) => {
    const { etichetta, riepilogo } = riepilogoRichiesta(r as never);
    /* il numero si mostra solo dove serve davvero all'ospite: e' il
       riferimento con cui ci riscrive se qualcosa cambia */
    return `<tr><td style="padding:8px 0;border-bottom:1px solid #EDE9E1;">` +
      `<strong>${esc(etichetta)}</strong> · ${esc(riepilogo)}` +
      `<div style="color:#7B756A;font-size:13px;">${esc(r.numero)}</div>` +
      `</td></tr>`;
  }).join('');

  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;">` +
    `<p>${esc(t.caro(o.nome))}</p><p>${t.intro}</p>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${voci}</table>` +
    `<p style="color:#7B756A;font-size:13px;">${t.chiusura}</p>` +
    `<p>${t.saluto}</p></div>`;
}

export async function inviaRicevutaArrivo(o: Ospite, righe: RigaRicevuta[]): Promise<boolean> {
  const chiave = Deno.env.get('RESEND_API_KEY');
  /* senza chiave la ricevuta non parte, ma le richieste sono salvate e
     hanno il loro numero: meglio una ricevuta mancata che una richiesta
     persa. E' la stessa scelta gia' fatta in ricevuta.ts. */
  if (!chiave || !o.email || righe.length === 0) return false;
  const t = TESTI[o.lingua] || TESTI.it;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${chiave}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: Deno.env.get('MITTENTE_EMAIL') ||
          'Hotel Terme Leonardo <noreply@hoteltermeleonardo.com>',
        to: o.email,
        reply_to: Deno.env.get('EMAIL_HOTEL') || 'info@termeleonardo.com',
        subject: t.oggetto,
        html: ricevutaArrivoHTML(o, righe),
      }),
    });
    if (!r.ok) console.error('Resend ha risposto', r.status, await r.text());
    return r.ok;
  } catch (e) {
    console.error('ricevuta d’arrivo non inviata:', e instanceof Error ? e.message : String(e));
    return false;
  }
}
