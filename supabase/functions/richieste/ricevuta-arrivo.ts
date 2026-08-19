/* ============================================================
   ricevuta-arrivo.ts — l'unica email che riceve chi compila il check-in.

   Una compilazione fa nascere fino a tre richieste. Tre ricevute in fila,
   stesso minuto, stesso ospite, si leggono come un guasto: chi ha
   compilato UN modulo si aspetta UNA risposta.

   IL RIEPILOGO NON SI RISCRIVE. riepilogoRichiesta() lo sa gia' fare, ed e'
   la stessa frase che legge la reception in back office: due scritture
   divergerebbero, e l'ospite e la reception si troverebbero a parlare di
   due cose diverse con lo stesso numero in mano.

   STESSA CASA DI ricevuta.ts. Le due email arrivano allo stesso ospite,
   magari nella stessa manciata di secondi: l'involucro (tabella, non un
   div spoglio — le tabelle reggono meglio in Outlook e nelle webmail;
   logo; piede coi recapiti; la stessa tavolozza) e' ricopiato da li',
   perche' sembrino della stessa casa. Cambia solo il blocco centrale: qui
   e' un elenco di richieste coi loro numeri, non i dettagli di una sola.

   esc() e linguaDi() vengono da dettagli-richiesta.ts, non riscritte qui:
   stesso motivo del riepilogo. linguaDi() in particolare e' quello che
   tiene alla larga il difetto che riepilogo.ts (vedi il commento sopra
   riepilogoRichiesta) schiva scegliendo uno switch invece di una lookup
   diretta OGGETTO[chiave] — una lingua come 'toString' e' ereditata da
   Object.prototype ed e' verita per un ||, quindi un ripiego scritto a
   mano col || non scatterebbe mai.
   ============================================================ */
import { esc, linguaDi } from './dettagli-richiesta.ts';
import { riepilogoRichiesta } from './riepilogo.ts';

const BASE_IMG = 'https://arrivo-terme-leonardo.vercel.app/buoni/img';
const TELEFONO = '+39 049 9939200';
const EMAIL_HOTEL = 'info@termeleonardo.com';

export type Ospite = { nome: string; email: string; lingua: string };
export type RigaRicevuta = {
  numero: string;
  tipo: string;
  dati: Record<string, unknown> | null;
};

/* «le abbiamo prese in carico», e nient'altro: nessun orario confermato,
   nessun prezzo. Quelli arrivano con la conferma, quando li abbiamo. */
const TESTI: Record<string, {
  occhiello: string; titolo: string; oggetto: string;
  caro: (n: string) => string; intro: string;
  chiusura: string; saluto: string;
}> = {
  it: {
    occhiello: 'RICEVUTA',
    titolo: 'Abbiamo ricevuto i suoi dati per l’arrivo',
    oggetto: 'Abbiamo ricevuto i suoi dati per l’arrivo',
    caro: (n) => `Gentile ${n},`,
    intro: 'abbiamo ricevuto quanto segue.',
    chiusura: 'Se qualcosa non torna, risponda a questa email.',
    saluto: 'A presto,<br />Hotel Terme Leonardo',
  },
  de: {
    occhiello: 'EINGANGSBESTÄTIGUNG',
    titolo: 'Wir haben Ihre Anreisedaten erhalten',
    oggetto: 'Wir haben Ihre Anreisedaten erhalten',
    caro: (n) => `Sehr geehrte(r) ${n},`,
    intro: 'wir haben Folgendes erhalten.',
    chiusura: 'Sollte etwas nicht stimmen, antworten Sie einfach auf diese E-Mail.',
    saluto: 'Bis bald,<br />Hotel Terme Leonardo',
  },
  en: {
    occhiello: 'RECEIPT',
    titolo: 'We have received your arrival details',
    oggetto: 'We have received your arrival details',
    caro: (n) => `Dear ${n},`,
    intro: 'we have received the following.',
    chiusura: 'If anything is not right, just reply to this email.',
    saluto: 'See you soon,<br />Hotel Terme Leonardo',
  },
  fr: {
    occhiello: 'ACCUSÉ DE RÉCEPTION',
    titolo: 'Nous avons bien reçu vos informations d’arrivée',
    oggetto: 'Nous avons bien reçu vos informations d’arrivée',
    caro: (n) => `Cher/Chère ${n},`,
    intro: 'nous avons bien reçu ce qui suit.',
    chiusura: 'Si quelque chose ne va pas, répondez simplement à cet email.',
    saluto: 'À bientôt,<br />Hotel Terme Leonardo',
  },
};

export function ricevutaArrivoHTML(o: Ospite, righe: RigaRicevuta[]): string {
  const t = TESTI[linguaDi(o.lingua)];

  const voci = righe.map((r) => {
    const { etichetta, riepilogo } = riepilogoRichiesta(r as never);
    /* il numero si mostra solo dove serve davvero all'ospite: e' il
       riferimento con cui ci riscrive se qualcosa cambia */
    return `<tr>
      <td style="padding:7px 0;border-bottom:1px solid #E6E2D8;">
        <div style="color:#1B4D4A;font-size:15px;"><strong>${esc(etichetta)}</strong> · ${esc(riepilogo)}</div>
        <div style="color:#8A938F;font-size:13px;padding-top:2px;">${esc(r.numero)}</div>
      </td>
    </tr>`;
  }).join('');

  return `<table cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:100%;
  border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;background:#FFFFFF;">
<tr><td style="padding:26px 28px;">
  <img src="${BASE_IMG}/logo-nero.png" width="220" alt="Hotel Terme Leonardo"
    style="display:block;width:220px;height:auto;border:0;padding-bottom:18px;
    border-bottom:1px solid #E6E2D8;" />

  <div style="font-size:10px;letter-spacing:2px;color:#C9A961;padding-top:18px;">${esc(t.occhiello)}</div>
  <div style="font-size:23px;color:#1B4D4A;margin-top:6px;font-family:Georgia,serif;">${esc(t.titolo)}</div>

  <p style="font-size:15px;line-height:1.65;color:#3C5346;margin-top:18px;">
    ${esc(t.caro(o.nome))}<br />${esc(t.intro)}
  </p>

  <table cellpadding="0" cellspacing="0" border="0" width="100%"
    style="margin-top:20px;border-collapse:collapse;border-top:1px solid #E6E2D8;">
    ${voci}
  </table>

  <p style="font-size:15px;line-height:1.65;color:#3C5346;margin-top:18px;">${esc(t.chiusura)}</p>

  <p style="font-size:15px;line-height:1.65;color:#3C5346;margin-top:18px;">${t.saluto}</p>

  <div style="border-top:1px solid #E6E2D8;margin-top:20px;padding-top:14px;
    font-size:12.5px;color:#8A938F;line-height:1.6;">
    Hotel Terme Leonardo · Via Tiro a Segno 6, 35031 Abano Terme (PD)<br />
    ${TELEFONO} · ${EMAIL_HOTEL}
  </div>
</td></tr></table>`;
}

export async function inviaRicevutaArrivo(o: Ospite, righe: RigaRicevuta[]): Promise<boolean> {
  const chiave = Deno.env.get('RESEND_API_KEY');
  /* senza chiave la ricevuta non parte, ma le richieste sono salvate e
     hanno il loro numero: meglio una ricevuta mancata che una richiesta
     persa. E' la stessa scelta gia' fatta in ricevuta.ts. */
  if (!chiave || !o.email || righe.length === 0) return false;
  const t = TESTI[linguaDi(o.lingua)];
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
