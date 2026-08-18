/* ============================================================
   conferma.ts — la risposta che l'hotel manda all'ospite.

   E' l'unica email che l'ospite legge davvero. Ripete i dati DEFINITIVI,
   non quelli che aveva chiesto: la reception puo' aver spostato l'orario, e
   se qui restasse quello vecchio l'ospite si presenterebbe all'ora
   sbagliata.

   Costruita a tabelle come le altre: Outlook non regge i layout moderni.
   ============================================================ */

import { differenze, etichettaCampo, type Differenza } from './differenze.ts';

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

const T: Record<string, Record<string, string>> = {
  it: {
    occhiello: 'CONFERMA', caro: 'Gentile', titolo: 'La sua richiesta è confermata',
    intro: 'Le confermiamo quanto organizzato. Se qualcosa non torna, risponda a questa email o ci chiami: facciamo in tempo a correggere.',
    dettagli: 'Il dettaglio', saluto: 'A presto,<br />Hotel Terme Leonardo',
    quando: 'Quando', dove: 'Dove', persone: 'Persone', volo: 'Volo / treno',
    ritorno: 'Ritorno incluso', rif: 'Riferimento',
        noleggi: 'Noleggi', taxi: 'Taxi dall’hotel', trattamenti: 'Trattamenti',
    oggetto: 'confermata',
    modifiche: 'Cosa è cambiato rispetto alla richiesta',
    chiesto: 'Aveva chiesto', confermato: 'Confermiamo',
    servizio: 'Servizio', navetta: 'Navetta condivisa', privata: 'Auto privata',
    prezzo: 'Prezzo', allAutista: 'da pagare direttamente all’autista', oraVolo: 'volo',
  },
  de: {
    occhiello: 'BESTÄTIGUNG', caro: 'Sehr geehrte(r)', titolo: 'Ihre Anfrage ist bestätigt',
    intro: 'Hiermit bestätigen wir das Vereinbarte. Sollte etwas nicht stimmen, antworten Sie einfach auf diese E-Mail oder rufen Sie uns an: wir können es noch ändern.',
    dettagli: 'Die Einzelheiten', saluto: 'Bis bald,<br />Hotel Terme Leonardo',
    quando: 'Wann', dove: 'Wo', persone: 'Personen', volo: 'Flug / Zug',
    ritorno: 'Rückfahrt inbegriffen', rif: 'Referenz',
        noleggi: 'Verleih', taxi: 'Taxi ab Hotel', trattamenti: 'Anwendungen',
    oggetto: 'bestätigt',
    modifiche: 'Was sich gegenüber Ihrer Anfrage geändert hat',
    chiesto: 'Angefragt', confermato: 'Bestätigt',
    servizio: 'Service', navetta: 'Sammeltransfer', privata: 'Privatwagen',
    prezzo: 'Preis', allAutista: 'direkt an den Fahrer zu zahlen', oraVolo: 'Flug',
  },
  en: {
    occhiello: 'CONFIRMATION', caro: 'Dear', titolo: 'Your request is confirmed',
    intro: 'Here is what we have arranged. If anything is not right, reply to this email or call us: there is still time to change it.',
    dettagli: 'The details', saluto: 'See you soon,<br />Hotel Terme Leonardo',
    quando: 'When', dove: 'Where', persone: 'People', volo: 'Flight / train',
    ritorno: 'Return trip included', rif: 'Reference',
        noleggi: 'Rentals', taxi: 'Taxi from the hotel', trattamenti: 'Treatments',
    oggetto: 'confirmed',
    modifiche: 'What has changed from your request',
    chiesto: 'Originally requested', confermato: 'Now confirmed',
    servizio: 'Service', navetta: 'Shared shuttle', privata: 'Private car',
    prezzo: 'Price', allAutista: 'to be paid directly to the driver', oraVolo: 'flight',
  },
  fr: {
    occhiello: 'CONFIRMATION', caro: 'Cher/Chère', titolo: 'Votre demande est confirmée',
    intro: 'Voici ce que nous avons organisé. Si quelque chose ne va pas, répondez à cet e-mail ou appelez-nous : il est encore temps de corriger.',
    dettagli: 'Le détail', saluto: 'À bientôt,<br />Hotel Terme Leonardo',
    quando: 'Quand', dove: 'Où', persone: 'Personnes', volo: 'Vol / train',
    ritorno: 'Retour inclus', rif: 'Référence',
        noleggi: 'Locations', taxi: 'Taxi depuis l’hôtel', trattamenti: 'Soins',
    oggetto: 'confirmée',
    modifiche: 'Ce qui a changé par rapport à votre demande',
    chiesto: 'Demandé initialement', confermato: 'Confirmé',
    servizio: 'Service', navetta: 'Navette partagée', privata: 'Voiture privée',
    prezzo: 'Prix', allAutista: 'à régler directement au chauffeur', oraVolo: 'vol',
  },
};

/* l'ospite scrive 2026-09-10, ma legge 10/09/2026 */
function data(iso: unknown): string {
  const [a, m, g] = String(iso ?? '').split('-');
  return g ? `${g}/${m}/${a}` : '';
}

/* `vecchio` e' quello che l'ospite AVEVA chiesto, quando la reception l'ha
   cambiato e ha spuntato la casella. Compare accanto al valore nuovo, non in
   coda all'email: fino al 18 agosto 2026 stava solo la' in fondo, sotto la
   didascalia piu' pallida della pagina, mentre qui sopra il valore nuovo era
   scritto in carattere normale — e chi si fermava ai dettagli non sapeva che
   qualcosa era cambiato.

   SBARRATO PIU' LA PAROLA. Certi programmi di posta buttano via gli stili, e
   c'e' chi i colori li legge male: se cade la linea, «Aveva chiesto: 09:00»
   resta comprensibile da solo. Il grassetto sul valore nuovo si accende solo
   quando c'e' stato un cambio, cosi' le righe non toccate restano quiete. */
function riga(
  etichetta: string,
  valore: string,
  vecchio?: string | null,
  t?: Record<string, string>,
): string {
  if (!valore) return '';
  const cambio = vecchio && t
    ? `<div style="font-size:13px;color:#8A938F;padding-top:2px;">${esc(t.chiesto)}:
       <span style="text-decoration:line-through;">${esc(vecchio)}</span></div>`
    : '';
  const nuovo = cambio ? `<strong>${esc(valore)}</strong>` : esc(valore);
  return `<tr>
    <td style="padding:7px 16px 7px 0;color:#8A938F;font-size:13px;white-space:nowrap;vertical-align:top;">${esc(etichetta)}</td>
    <td style="padding:7px 0;color:#1B4D4A;font-size:15px;">${nuovo}${cambio}</td>
  </tr>`;
}

/* Le chiavi che le righe di ogni tipo leggono davvero. Serve al riquadro in
   coda per sapere quali differenze sono gia' visibili accanto a un campo e
   quali resterebbero altrimenti invisibili — es. le note del transfer, che
   `tipi.ts` accetta ma la conferma non disegna. Stessa idea di
   differenzeNonMostrate() nel back office. */
const CHIAVI_MOSTRATE: Record<string, string[]> = {
  transfer: [
    'quando', 'ora', 'ora_volo', 'luogo', 'verso', 'collettivo', 'pax', 'volo',
    'ritorno', 'ritorno_quando', 'ritorno_ora', 'prezzo_cent',
  ],
  greenfee: [
    'circolo_nome', 'data', 'ora', 'giocatori', 'golfcar', 'carrello',
    'carrello_elettrico', 'sacca', 'taxi', 'taxi_ora', 'taxi_ritorno',
  ],
  maestro: ['data', 'ora', 'persone'],
  dayspa: ['giorno', 'persone'],
  trattamenti: ['giorno', 'fascia', 'voci'],
};

/* Ogni tipo racconta le sue cose. Un tipo non ancora previsto non rompe
   niente: mostra solo il riferimento, che e' meglio di "undefined".

   Ogni voce sa CALCOLARSI da un oggetto dati qualunque. E' la riga che rende
   possibile mostrare accanto al campo quello che l'ospite aveva chiesto:
   la stessa `calcola` gira due volte, una sui dati definitivi e una su
   `dati_originali`. Scrivere le due versioni a mano vorrebbe dire due
   formattazioni della stessa cosa, e il giorno che divergono l'ospite legge
   «aveva chiesto: 2026-09-10» accanto a «10 settembre 2026». */
type Voce = { eti: string; calcola: (d: Record<string, unknown>) => string };

function vociDettagli(tipo: string, t: Record<string, string>): Voce[] {
  if (tipo === 'transfer') {
    return [
      /* con la navetta in partenza l'ora della corsa e' tre ore prima del
         volo: vedersi confermare «11:30» senza vedere il volo delle 14:30
         sembra uno sbaglio nostro */
      {
        eti: t.quando,
        calcola: (d) =>
          `${data(d.quando)}${d.ora ? ' · ' + String(d.ora) : ''}` +
          (d.ora_volo ? ` (${t.oraVolo} ${String(d.ora_volo)})` : ''),
      },
      { eti: t.dove, calcola: (d) => `${d.verso === 'partenza' ? '→' : '←'} ${String(d.luogo ?? '')}` },
      { eti: t.servizio, calcola: (d) => d.collettivo === true ? t.navetta : t.privata },
      { eti: t.persone, calcola: (d) => String(d.pax ?? '') },
      { eti: t.volo, calcola: (d) => String(d.volo ?? '') },
      /* «✓» e basta era quello che diceva prima: l'ospite non rileggeva mai
         il giorno e l'ora della seconda corsa, e non poteva accorgersi di un
         errore. Le richieste vecchie hanno solo il booleano, e per quelle il
         segno di spunta resta l'unica cosa onesta da mostrare. */
      {
        eti: t.ritorno,
        calcola: (d) =>
          d.ritorno !== true
            ? ''
            : (d.ritorno_quando
              ? `${data(d.ritorno_quando)}${d.ritorno_ora ? ' · ' + String(d.ritorno_ora) : ''}`
              : '✓'),
      },
      /* il prezzo lo conferma la reception: senza, la riga non c'e' —
         «non c'e' un prezzo» e «e' gratis» sono due cose diverse */
      { eti: t.prezzo, calcola: (d) => euro(d.prezzo_cent, t) },
    ];
  }
  if (tipo === 'greenfee') {
    return [
      { eti: t.dove, calcola: (d) => String(d.circolo_nome ?? '') },
      { eti: t.quando, calcola: (d) => `${data(d.data)}${d.ora ? ' · ' + String(d.ora) : ''}` },
      { eti: t.persone, calcola: (d) => String(d.giocatori ?? '') },
      {
        eti: t.noleggi,
        calcola: (d) =>
          [
            d.golfcar === true ? 'golf car' : '', d.carrello === true ? 'trolley' : '',
            d.carrello_elettrico === true ? 'e-trolley' : '', d.sacca === true ? 'set' : '',
          ].filter(Boolean).join(' · '),
      },
      {
        eti: t.taxi,
        calcola: (d) =>
          d.taxi === true
            ? `${String(d.taxi_ora ?? '')}${d.taxi_ritorno === true ? ' · ' + t.ritorno : ''}`
            : '',
      },
    ];
  }
  if (tipo === 'maestro') {
    return [
      { eti: t.quando, calcola: (d) => `${data(d.data)}${d.ora ? ' · ' + String(d.ora) : ''}` },
      { eti: t.persone, calcola: (d) => String(d.persone ?? '') },
    ];
  }
  if (tipo === 'dayspa') {
    return [
      { eti: t.quando, calcola: (d) => data(d.giorno) },
      { eti: t.persone, calcola: (d) => String(d.persone ?? '') },
    ];
  }
  if (tipo === 'trattamenti') {
    return [
      { eti: t.quando, calcola: (d) => `${data(d.giorno)}${d.fascia ? ' · ' + String(d.fascia) : ''}` },
      {
        eti: t.trattamenti,
        calcola: (d) => (Array.isArray(d.voci) ? (d.voci as string[]) : []).join(' · '),
      },
    ];
  }
  return [];
}

/* I centesimi come li legge una persona. Stesso trabocchetto gia' pagato in
   email-richiesta.ts e in differenze.ts: 13500 sono 135 euro, e nessuno deve
   leggerli come tredicimila. */
function euro(v: unknown, t: Record<string, string>): string {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  const cifra = (n / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${cifra} € · ${t.allAutista}`;
}

function dettagli(
  tipo: string,
  d: Record<string, unknown>,
  t: Record<string, string>,
  originali?: Record<string, unknown> | null,
): string {
  return vociDettagli(tipo, t).map((v) => {
    const adesso = v.calcola(d);
    const prima = originali ? v.calcola(originali) : '';
    return riga(v.eti, adesso, prima && prima !== adesso ? prima : null, t);
  }).join('');
}


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
  const l = ['it', 'de', 'en', 'fr'].includes(String(r.lingua)) ? String(r.lingua) : 'it';
  const t = T[l];
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
  const l = ['it', 'de', 'en', 'fr'].includes(String(r.lingua)) ? String(r.lingua) : 'it';
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
